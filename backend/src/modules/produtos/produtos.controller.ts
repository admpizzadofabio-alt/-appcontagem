import { Request, Response, NextFunction } from 'express'
import { criarProdutoSchema, atualizarProdutoSchema } from './produtos.schemas.js'
import * as service from './produtos.service.js'
import { criar as criarMov } from '../movimentacoes/movimentacoes.service.js'
import { z } from 'zod'

const cargaInicialSchema = z.object({
  quantidade: z.coerce.number().positive().max(999999),
  local: z.enum(['Bar', 'Delivery']),
  observacao: z.string().max(500).optional(),
})

export async function listarHandler(req: Request, res: Response, next: NextFunction) {
  try {
    // Sem parâmetro = todos; ?ativo=true = só ativos; ?ativo=false = só inativos
    const ativoParam = req.query.ativo as string | undefined
    const apenasAtivos = ativoParam === 'true' ? true : ativoParam === 'false' ? false : undefined
    res.json(await service.listar(apenasAtivos))
  } catch (err) { next(err) }
}

export async function criarHandler(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(201).json(await service.criar(criarProdutoSchema.parse(req.body)))
  } catch (err) { next(err) }
}

export async function atualizarHandler(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await service.atualizar(String(req.params.id), atualizarProdutoSchema.parse(req.body)))
  } catch (err) { next(err) }
}

export async function deletarHandler(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await service.deletar(String(req.params.id)))
  } catch (err) { next(err) }
}

export async function excluirFisicoHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user || req.user.nivelAcesso !== 'Admin') return res.status(403).json({ error: 'Acesso negado' })
    await service.excluirFisico(String(req.params.id))
    res.status(204).end()
  } catch (err) { next(err) }
}

export async function resetarCargaInicialHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user || req.user.nivelAcesso !== 'Admin') return res.status(403).json({ error: 'Acesso negado' })
    const { local } = z.object({ local: z.enum(['Bar', 'Delivery']) }).parse(req.body)
    await service.resetarCargaInicial(String(req.params.id), local, req.user.sub, req.user.nome)
    res.json({ ok: true, mensagem: `Carga inicial de ${local} resetada. Produto pode ser reinicializado.` })
  } catch (err) { next(err) }
}

export async function cargaInicialHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) return res.status(401).json({ error: 'Não autenticado' })
    const { quantidade, local, observacao } = cargaInicialSchema.parse(req.body)
    const produtoId = String(req.params.id)
    const mov = await criarMov({
      produtoId,
      tipoMov: 'CargaInicial',
      quantidade,
      localOrigem: local,
      usuarioId: req.user.sub,
      usuarioNome: req.user.nome,
      setor: req.user.setor,
      nivelAcesso: req.user.nivelAcesso,
      observacao: observacao ?? `Carga inicial: ${quantidade} un em ${local}`,
    })
    res.status(201).json({ ok: true, movimentacao: mov, mensagem: 'Carga inicial registrada. Marco operacional definido.' })
  } catch (err) { next(err) }
}
