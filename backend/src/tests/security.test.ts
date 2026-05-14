/**
 * Testes de regressão de segurança — trava as correções dos VULN-001 a VULN-020.
 *
 * Objetivo: se alguém modificar um controller/service e remover uma guarda de segurança,
 * o teste falha e o pentester (ou pipeline CI) detecta antes de chegar em produção.
 *
 * Estratégia: usa supertest contra a app real, banco PostgreSQL com os 3 usuários do seed
 * (admin/bar/delivery, PINs 1234/1111/2222). Cada teste cria seus próprios recursos e limpa no afterAll.
 *
 * Pré-requisito: rodar `npm run prisma:seed` antes para garantir os 3 usuários canônicos.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { app } from '../app.js'
import { prisma } from '../config/prisma.js'

let tokenAdmin: string
let tokenBar: string
let tokenDelivery: string

async function login(pin: string): Promise<string> {
  const r = await request(app).post('/api/v1/auth/login').send({ pin })
  expect(r.status).toBe(200)
  return r.body.accessToken
}

beforeAll(async () => {
  tokenAdmin = await login('123456')
  tokenBar = await login('111111')
  tokenDelivery = await login('222222')
})

afterAll(async () => {
  // Cleanup: cancela contagens abertas criadas durante os testes
  await prisma.contagemEstoque.updateMany({
    where: { status: 'Aberta' },
    data: { status: 'Cancelada' },
  })
  await prisma.$disconnect()
})

// ─── VULN-001 / 003 / 017 / 018 — BOLA em contagem ──────────────────────────

describe('BOLA — contagem de outro operador (VULN-001, 017, 018)', () => {
  let contagemId: string

  beforeAll(async () => {
    // Cancela qualquer contagem aberta para garantir estado limpo
    await prisma.contagemEstoque.updateMany({
      where: { status: 'Aberta' },
      data: { status: 'Cancelada' },
    })
    // Bar abre uma contagem
    const r = await request(app)
      .post('/api/v1/contagem')
      .set('Authorization', `Bearer ${tokenBar}`)
      .send({ local: 'Bar', modoCego: true })
    expect(r.status).toBe(201)
    contagemId = r.body.id
  })

  it('Operador alheio recebe 404 (não 403) no GET — não vaza existência', async () => {
    const r = await request(app)
      .get(`/api/v1/contagem/${contagemId}`)
      .set('Authorization', `Bearer ${tokenDelivery}`)
    expect(r.status).toBe(404)
    expect(r.body.message).toMatch(/não encontrada/i)
  })

  it('Operador alheio recebe 404 no DELETE', async () => {
    const r = await request(app)
      .delete(`/api/v1/contagem/${contagemId}`)
      .set('Authorization', `Bearer ${tokenDelivery}`)
    expect(r.status).toBe(404)
  })

  it('Operador alheio recebe 404 no PATCH /item', async () => {
    const r = await request(app)
      .patch(`/api/v1/contagem/${contagemId}/item`)
      .set('Authorization', `Bearer ${tokenDelivery}`)
      .send({ produtoId: '00000000-0000-0000-0000-000000000001', quantidadeContada: 999 })
    expect(r.status).toBe(404)
  })

  it('Operador alheio recebe 404 no POST /processar', async () => {
    const r = await request(app)
      .post(`/api/v1/contagem/${contagemId}/processar`)
      .set('Authorization', `Bearer ${tokenDelivery}`)
    expect(r.status).toBe(404)
  })

  it('Listagem de contagens só mostra as do próprio operador', async () => {
    const r = await request(app)
      .get('/api/v1/contagem')
      .set('Authorization', `Bearer ${tokenDelivery}`)
    expect(r.status).toBe(200)
    expect(Array.isArray(r.body)).toBe(true)
    for (const c of r.body) {
      expect(c.operadorId).toBe('operador-delivery')
    }
  })

  it('Admin pode acessar contagem de qualquer operador', async () => {
    const r = await request(app)
      .get(`/api/v1/contagem/${contagemId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
    expect(r.status).toBe(200)
    expect(r.body.id).toBe(contagemId)
  })

  it('Próprio dono pode acessar a contagem', async () => {
    const r = await request(app)
      .get(`/api/v1/contagem/${contagemId}`)
      .set('Authorization', `Bearer ${tokenBar}`)
    expect(r.status).toBe(200)
  })
})

// ─── VULN-005 / 016 — Sector scoping em listagens ────────────────────────────

describe('Sector scoping — Operador só vê dados do próprio setor (VULN-005, 016)', () => {
  it('Operador Bar GET /movimentacoes recebe somente local=Bar', async () => {
    const r = await request(app)
      .get('/api/v1/movimentacoes')
      .set('Authorization', `Bearer ${tokenBar}`)
    expect(r.status).toBe(200)
    expect(Array.isArray(r.body)).toBe(true)
    for (const m of r.body) {
      const inBar = m.localOrigem === 'Bar' || m.localDestino === 'Bar'
      expect(inBar).toBe(true)
    }
  })

  it('Operador Bar GET /pedidos recebe somente do próprio setor (sem opt-in)', async () => {
    const r = await request(app)
      .get('/api/v1/pedidos')
      .set('Authorization', `Bearer ${tokenBar}`)
    expect(r.status).toBe(200)
    expect(Array.isArray(r.body)).toBe(true)
    for (const p of r.body) {
      expect(p.setorSolicitante).toBe('Bar')
    }
  })

  it('Admin GET /pedidos sem filtro vê pedidos de qualquer setor', async () => {
    const r = await request(app)
      .get('/api/v1/pedidos')
      .set('Authorization', `Bearer ${tokenAdmin}`)
    expect(r.status).toBe(200)
    // Não deve haver filtro forçado para Admin (cobertura de privilégio)
  })
})

// ─── VULN-013 / 014 — Function-level auth (acesso a dados sensíveis) ────────

describe('Function-level auth — endpoints sensíveis (VULN-013, 014)', () => {
  it('Operador GET /cmv → 403', async () => {
    const r = await request(app)
      .get('/api/v1/cmv?dataInicio=2026-01-01&dataFim=2026-12-31')
      .set('Authorization', `Bearer ${tokenBar}`)
    expect(r.status).toBe(403)
  })

  it('Supervisor/Admin GET /cmv → 200 (cobertura de privilégio)', async () => {
    const r = await request(app)
      .get('/api/v1/cmv?dataInicio=2026-01-01&dataFim=2026-12-31')
      .set('Authorization', `Bearer ${tokenAdmin}`)
    expect(r.status).toBe(200)
  })

  it('Operador GET /relatorios/macro → 403', async () => {
    const r = await request(app)
      .get('/api/v1/relatorios/macro')
      .set('Authorization', `Bearer ${tokenBar}`)
    expect(r.status).toBe(403)
  })

  it('Operador POST /produtos → 403', async () => {
    const r = await request(app)
      .post('/api/v1/produtos')
      .set('Authorization', `Bearer ${tokenBar}`)
      .send({
        nomeBebida: 'Pirateado',
        categoria: 'Cerveja',
        unidadeMedida: 'Un',
        custoUnitario: 1,
        setorPadrao: 'Bar',
      })
    expect(r.status).toBe(403)
  })
})

// ─── VULN-019 — Swagger restrito a Admin ────────────────────────────────────

describe('Swagger — restrito a Admin (VULN-019)', () => {
  it('Sem token → 401', async () => {
    const r = await request(app).get('/api/docs/')
    expect(r.status).toBe(401)
  })

  it('Operador → 403', async () => {
    const r = await request(app).get('/api/docs/').set('Authorization', `Bearer ${tokenBar}`)
    expect(r.status).toBe(403)
  })

  it('Admin → 200', async () => {
    const r = await request(app).get('/api/docs/').set('Authorization', `Bearer ${tokenAdmin}`)
    expect(r.status).toBe(200)
  })
})

// ─── Auth básico ────────────────────────────────────────────────────────────

describe('Auth — controles básicos', () => {
  it('Sem token → 401 em endpoint protegido', async () => {
    const r = await request(app).get('/api/v1/estoque')
    expect(r.status).toBe(401)
  })

  it('Token inválido → 401', async () => {
    const r = await request(app).get('/api/v1/estoque').set('Authorization', 'Bearer abc.def.ghi')
    expect(r.status).toBe(401)
  })

  it('PIN errado → 401 com mensagem genérica', async () => {
    const r = await request(app).post('/api/v1/auth/login').send({ pin: '000000' })
    expect(r.status).toBe(401)
    expect(r.body.message).toBe('PIN inválido')
  })

  it('PIN com formato inválido (4 dígitos) → 422', async () => {
    const r = await request(app).post('/api/v1/auth/login').send({ pin: '1234' })
    expect(r.status).toBe(422)
  })

  it('PIN com letras → 422', async () => {
    const r = await request(app).post('/api/v1/auth/login').send({ pin: 'abcdef' })
    expect(r.status).toBe(422)
  })

  it('Hash do PIN no banco está em argon2id (VULN-020)', async () => {
    const u = await prisma.usuario.findUnique({ where: { id: 'admin-master' } })
    expect(u?.pinFormat).toBe('argon2id')
    expect(u?.pin).toMatch(/^\$argon2id\$/)
  })
})

// ─── VULN-023 — Hardening de schemas Zod ────────────────────────────────────

describe('Schema hardening — input validation strict (VULN-023)', () => {
  it('Admin não consegue criar usuário com PIN ≠ 6 dígitos (consistência com loginSchema)', async () => {
    const r = await request(app)
      .post('/api/v1/usuarios')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ nome: 'Teste', pin: '1234', setor: 'Bar', nivelAcesso: 'Operador' })
    expect(r.status).toBe(422)
    expect(JSON.stringify(r.body)).toMatch(/PIN deve ter exatamente 6 dígitos/)
  })

  it('Pedido com 1000 itens é rejeitado (DoS prevention)', async () => {
    const itens = Array.from({ length: 1000 }, () => ({
      nomeProduto: 'X',
      quantidade: 1,
    }))
    const r = await request(app)
      .post('/api/v1/pedidos')
      .set('Authorization', `Bearer ${tokenBar}`)
      .send({ itens })
    expect(r.status).toBe(422)
    expect(JSON.stringify(r.body)).toMatch(/Máximo 100/)
  })

  it('String muito longa em campo de movimentação é rejeitada (memory bloat prevention)', async () => {
    const r = await request(app)
      .post('/api/v1/movimentacoes')
      .set('Authorization', `Bearer ${tokenBar}`)
      .send({
        produtoId: '00000000-0000-0000-0000-000000000001',
        tipoMov: 'Entrada',
        quantidade: 1,
        observacao: 'x'.repeat(10_000),  // 10k chars
      })
    expect(r.status).toBe(422)
  })
})

// ─── VULN-009 — Error handler não vaza interno ──────────────────────────────

describe('Error disclosure — mensagens genéricas (VULN-009)', () => {
  it('Endpoint inexistente não vaza stack trace', async () => {
    const r = await request(app).get('/api/v1/inexistente').set('Authorization', `Bearer ${tokenAdmin}`)
    // 404 do Express, sem stack
    expect(r.status).toBe(404)
    expect(JSON.stringify(r.body)).not.toMatch(/at\s+\w+\s+\(/)  // não tem "at fn (file)"
  })
})
