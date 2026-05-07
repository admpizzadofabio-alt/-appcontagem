import { Request, Response, NextFunction } from 'express'
import { criarMovimentacaoSchema, filtrosMovimentacaoSchema, aprovarSchema, rejeitarSchema } from './movimentacoes.schemas.js'
import * as service from './movimentacoes.service.js'

export async function listarHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const filtros = filtrosMovimentacaoSchema.parse(req.query)
    res.json(await service.listar(filtros))
  } catch (err) { next(err) }
}

export async function criarHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const data = criarMovimentacaoSchema.parse(req.body)
    const result = await service.criar({
      ...data,
      usuarioId: req.user!.sub,
      usuarioNome: req.user!.nome,
      setor: req.user!.setor,
      nivelAcesso: req.user!.nivelAcesso,
      pendente: data.pendente,
      justificativaEntrada: data.justificativaEntrada,
    })
    res.status(201).json(result)
  } catch (err) { next(err) }
}

export async function listarPendentesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await service.listarPendentes())
  } catch (err) { next(err) }
}

export async function listarTransferenciasPendentesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const isPrivileged = ['Admin', 'Supervisor'].includes(req.user!.nivelAcesso)
    const local = isPrivileged ? String(req.query.local ?? req.user!.setor) : req.user!.setor
    res.json(await service.listarTransferenciasPendentes(local))
  } catch (err) { next(err) }
}

export async function confirmarTransferenciaHandler(req: Request, res: Response, next: NextFunction) {
  try {
    await service.confirmarTransferencia(String(req.params.id), req.user!.sub, req.user!.nome, req.user!.setor, req.user!.nivelAcesso)
    res.json({ message: 'Transferência confirmada com sucesso' })
  } catch (err) { next(err) }
}

export async function aprovarHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { motivo } = aprovarSchema.parse(req.body)
    await service.aprovar(String(req.params.id), req.user!.sub, req.user!.nome, motivo)
    res.status(200).json({ message: 'Aprovado com sucesso' })
  } catch (err) { next(err) }
}

export async function rejeitarHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { motivo } = rejeitarSchema.parse(req.body)
    await service.rejeitar(String(req.params.id), req.user!.sub, req.user!.nome, motivo)
    res.status(200).json({ message: 'Rejeitado com sucesso' })
  } catch (err) { next(err) }
}
