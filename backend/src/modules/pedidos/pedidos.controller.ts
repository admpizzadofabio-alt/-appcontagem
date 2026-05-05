import { Request, Response, NextFunction } from 'express'
import { criarPedidoSchema, atualizarStatusSchema, editarPedidoSchema } from './pedidos.schemas.js'
import * as service from './pedidos.service.js'

export async function listarHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { status, setor } = req.query as Record<string, string>
    res.json(await service.listar({ status, setor, nivelAcesso: req.user!.nivelAcesso }))
  } catch (err) { next(err) }
}

export async function criarHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { itens } = criarPedidoSchema.parse(req.body)
    res.status(201).json(await service.criar(itens, req.user!.sub, req.user!.setor))
  } catch (err) { next(err) }
}

export async function atualizarStatusHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { status } = atualizarStatusSchema.parse(req.body)
    res.json(await service.atualizarStatus(String(req.params.id), status))
  } catch (err) { next(err) }
}

export async function editarHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const data = editarPedidoSchema.parse(req.body)
    res.json(await service.editar(String(req.params.id), data))
  } catch (err) { next(err) }
}

export async function excluirHandler(req: Request, res: Response, next: NextFunction) {
  try {
    await service.excluir(String(req.params.id))
    res.status(204).end()
  } catch (err) { next(err) }
}
