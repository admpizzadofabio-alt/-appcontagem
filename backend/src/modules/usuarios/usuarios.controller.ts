import { Request, Response, NextFunction } from 'express'
import { criarUsuarioSchema, atualizarUsuarioSchema } from './usuarios.schemas.js'
import * as service from './usuarios.service.js'

export async function listarHandler(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await service.listar())
  } catch (err) { next(err) }
}

export async function criarHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const data = criarUsuarioSchema.parse(req.body)
    res.status(201).json(await service.criar(data))
  } catch (err) { next(err) }
}

export async function atualizarHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const data = atualizarUsuarioSchema.parse(req.body)
    res.json(await service.atualizar(String(req.params.id), data))
  } catch (err) { next(err) }
}

export async function toggleAtivoHandler(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await service.toggleAtivo(String(req.params.id)))
  } catch (err) { next(err) }
}
