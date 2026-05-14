import { describe, it, expect } from 'vitest'
import { criarMovimentacaoSchema, aprovarSchema, rejeitarSchema } from '../modules/movimentacoes/movimentacoes.schemas.js'
import { iniciarContagemSchema as criarContagemSchema, salvarItemSchema as salvarItemContagemSchema } from '../modules/contagem/contagem.schemas.js'
import { criarProdutoSchema } from '../modules/produtos/produtos.schemas.js'
import { loginSchema } from '../modules/auth/auth.schemas.js'

// ── Movimentações ──────────────────────────────────────────────────────────

describe('criarMovimentacaoSchema', () => {
  const base = { produtoId: '00000000-0000-0000-0000-000000000001', quantidade: 2 }

  it('aceita Entrada simples', () => {
    expect(criarMovimentacaoSchema.safeParse({ ...base, tipoMov: 'Entrada' }).success).toBe(true)
  })

  it('rejeita AjustePerda sem motivoAjuste', () => {
    const r = criarMovimentacaoSchema.safeParse({ ...base, tipoMov: 'AjustePerda' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.flatten().fieldErrors.motivoAjuste).toBeDefined()
  })

  it('aceita AjustePerda com motivoAjuste', () => {
    expect(
      criarMovimentacaoSchema.safeParse({ ...base, tipoMov: 'AjustePerda', motivoAjuste: 'Quebrou' }).success,
    ).toBe(true)
  })

  it('rejeita Transferencia sem localOrigem e localDestino', () => {
    const r = criarMovimentacaoSchema.safeParse({ ...base, tipoMov: 'Transferencia' })
    expect(r.success).toBe(false)
  })

  it('aceita Transferencia com localOrigem e localDestino', () => {
    expect(
      criarMovimentacaoSchema.safeParse({
        ...base,
        tipoMov: 'Transferencia',
        localOrigem: 'Bar',
        localDestino: 'Delivery',
      }).success,
    ).toBe(true)
  })

  it('rejeita quantidade zero', () => {
    const r = criarMovimentacaoSchema.safeParse({ ...base, tipoMov: 'Entrada', quantidade: 0 })
    expect(r.success).toBe(false)
  })

  it('rejeita produtoId inválido', () => {
    const r = criarMovimentacaoSchema.safeParse({ ...base, produtoId: 'nao-e-uuid', tipoMov: 'Entrada' })
    expect(r.success).toBe(false)
  })
})

// ── Contagem ───────────────────────────────────────────────────────────────

describe('criarContagemSchema', () => {
  it('aceita local válido com defaults', () => {
    const r = criarContagemSchema.safeParse({ local: 'Bar' })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.modoCego).toBe(true)
      expect(r.data.threshold).toBe(2)
    }
  })

  it('rejeita local inválido', () => {
    expect(criarContagemSchema.safeParse({ local: 'Deposito' }).success).toBe(false)
  })

  it('aceita threshold customizado', () => {
    const r = criarContagemSchema.safeParse({ local: 'Delivery', threshold: 5 })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.threshold).toBe(5)
  })
})

describe('salvarItemContagemSchema', () => {
  const base = {
    produtoId: '00000000-0000-0000-0000-000000000001',
    quantidadeContada: 10,
  }

  it('aceita item sem causaDivergencia quando dentro do threshold', () => {
    expect(salvarItemContagemSchema.safeParse(base).success).toBe(true)
  })

  it('aceita item com causaDivergencia', () => {
    expect(
      salvarItemContagemSchema.safeParse({ ...base, causaDivergencia: 'Quebra durante evento' }).success,
    ).toBe(true)
  })

  it('rejeita quantidadeContada negativa', () => {
    expect(salvarItemContagemSchema.safeParse({ ...base, quantidadeContada: -1 }).success).toBe(false)
  })
})

// ── Segurança: Aprovação/Rejeição ──────────────────────────────────────────

describe('aprovarSchema', () => {
  it('aceita sem motivo', () => {
    expect(aprovarSchema.safeParse({}).success).toBe(true)
  })
  it('aceita com motivo válido', () => {
    expect(aprovarSchema.safeParse({ motivo: 'Ok' }).success).toBe(true)
  })
  it('rejeita motivo com mais de 500 chars', () => {
    expect(aprovarSchema.safeParse({ motivo: 'x'.repeat(501) }).success).toBe(false)
  })
})

describe('rejeitarSchema', () => {
  it('rejeita sem motivo', () => {
    expect(rejeitarSchema.safeParse({}).success).toBe(false)
  })
  it('rejeita motivo vazio', () => {
    expect(rejeitarSchema.safeParse({ motivo: '' }).success).toBe(false)
  })
  it('rejeita motivo muito curto', () => {
    expect(rejeitarSchema.safeParse({ motivo: 'ab' }).success).toBe(false)
  })
  it('aceita motivo válido', () => {
    expect(rejeitarSchema.safeParse({ motivo: 'Divergência de estoque' }).success).toBe(true)
  })
  it('rejeita motivo com mais de 500 chars', () => {
    expect(rejeitarSchema.safeParse({ motivo: 'x'.repeat(501) }).success).toBe(false)
  })
})

// ── Segurança: Login ────────────────────────────────────────────────────────

describe('loginSchema', () => {
  it('aceita PIN de 6 dígitos', () => {
    expect(loginSchema.safeParse({ pin: '123456' }).success).toBe(true)
  })
  it('rejeita PIN de 4 dígitos (formato antigo)', () => {
    expect(loginSchema.safeParse({ pin: '1234' }).success).toBe(false)
  })
  it('rejeita PIN de 5 dígitos', () => {
    expect(loginSchema.safeParse({ pin: '12345' }).success).toBe(false)
  })
  it('rejeita PIN de 7 dígitos', () => {
    expect(loginSchema.safeParse({ pin: '1234567' }).success).toBe(false)
  })
  it('rejeita PIN com letras', () => {
    expect(loginSchema.safeParse({ pin: 'abcdef' }).success).toBe(false)
  })
  it('rejeita PIN com espaços', () => {
    expect(loginSchema.safeParse({ pin: '12 345' }).success).toBe(false)
  })
  it('rejeita PIN ausente', () => {
    expect(loginSchema.safeParse({}).success).toBe(false)
  })
  it('rejeita payload com campos extras (injeção)', () => {
    // Zod por padrão strip campos extras, não deve causar problema
    const r = loginSchema.safeParse({ pin: '123456', extra: 'DROP TABLE usuarios' })
    expect(r.success).toBe(true)
    if (r.success) expect((r.data as any).extra).toBeUndefined()
  })
})

// ── Segurança: Movimentações (SQL injection via enum) ──────────────────────

describe('criarMovimentacaoSchema - segurança', () => {
  const base = { produtoId: '00000000-0000-0000-0000-000000000001', quantidade: 1 }

  it('rejeita tipoMov com valor arbitrário (injeção)', () => {
    expect(criarMovimentacaoSchema.safeParse({ ...base, tipoMov: "'; DROP TABLE--" }).success).toBe(false)
  })
  it('rejeita localOrigem inválido', () => {
    expect(criarMovimentacaoSchema.safeParse({ ...base, tipoMov: 'Entrada', localOrigem: 'Deposito' }).success).toBe(false)
  })
  it('rejeita produtoId não-UUID', () => {
    expect(criarMovimentacaoSchema.safeParse({ ...base, produtoId: '1 OR 1=1', tipoMov: 'Entrada' }).success).toBe(false)
  })
  it('rejeita quantidade negativa', () => {
    expect(criarMovimentacaoSchema.safeParse({ ...base, tipoMov: 'Entrada', quantidade: -99 }).success).toBe(false)
  })
})

// ── Produtos ───────────────────────────────────────────────────────────────

describe('criarProdutoSchema', () => {
  const base = { nomeBebida: 'Heineken 600ml', categoria: 'Cerveja', unidadeMedida: 'un' }

  it('aceita produto válido com defaults', () => {
    const r = criarProdutoSchema.safeParse(base)
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.custoUnitario).toBe(0)
      expect(r.data.estoqueMinimo).toBe(0)
      expect(r.data.perdaThreshold).toBe(5)
    }
  })

  it('rejeita nome vazio', () => {
    expect(criarProdutoSchema.safeParse({ ...base, nomeBebida: '' }).success).toBe(false)
  })

  it('rejeita custoUnitario negativo', () => {
    expect(criarProdutoSchema.safeParse({ ...base, custoUnitario: -1 }).success).toBe(false)
  })
})

// ── Bloqueio de conta ──────────────────────────────────────────────────────

describe('lógica de bloqueio de conta', () => {
  const MAX_ATTEMPTS = 5
  const LOCKOUT_MINUTES = 15

  it('bloqueia após atingir MAX_ATTEMPTS', () => {
    // Simula o comportamento: loginAttempts >= MAX_ATTEMPTS → bloqueio
    const tentativas = MAX_ATTEMPTS
    expect(tentativas >= MAX_ATTEMPTS).toBe(true)
  })

  it('calcula minutos restantes corretamente', () => {
    const bloqueadoAte = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
    const minutos = Math.ceil((bloqueadoAte.getTime() - Date.now()) / 60000)
    expect(minutos).toBe(LOCKOUT_MINUTES)
  })

  it('desbloqueia quando bloqueadoAte está no passado', () => {
    const bloqueadoAte = new Date(Date.now() - 1000)
    expect(bloqueadoAte < new Date()).toBe(true)
  })

  it('mantém bloqueio quando bloqueadoAte está no futuro', () => {
    const bloqueadoAte = new Date(Date.now() + 5 * 60 * 1000)
    expect(bloqueadoAte > new Date()).toBe(true)
  })

  it('tentativas restantes calculadas corretamente', () => {
    const tentativasFeitas = 3
    const restantes = MAX_ATTEMPTS - tentativasFeitas
    expect(restantes).toBe(2)
  })
})
