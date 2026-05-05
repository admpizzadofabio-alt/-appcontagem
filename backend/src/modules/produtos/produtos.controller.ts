import { Request, Response, NextFunction } from 'express'
import { criarProdutoSchema, atualizarProdutoSchema } from './produtos.schemas.js'
import * as service from './produtos.service.js'

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
    await service.excluirFisico(String(req.params.id))
    res.status(204).end()
  } catch (err) { next(err) }
}
