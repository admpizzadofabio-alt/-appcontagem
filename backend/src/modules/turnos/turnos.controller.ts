import type { Request, Response, NextFunction } from 'express'
import { AppError } from '../../shared/errors.js'
import * as turnos from './turnos.service.js'
import * as rascunhos from './rascunhos.service.js'

export async function getDashboard(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await turnos.getDashboardAdmin())
  } catch (e) { next(e) }
}
import {
  abrirTurnoSchema,
  localQuerySchema,
  registrarItemContagemSchema,
  finalizarItemDivergenciaSchema,
  criarRascunhoEntradaSchema,
  decidirRascunhoSchema,
  verificarEntradaSchema,
} from './turnos.schemas.js'

export async function getAtual(req: Request, res: Response, next: NextFunction) {
  try {
    const { local } = localQuerySchema.parse(req.query)
    res.json(await turnos.getTurnoAtual(local))
  } catch (e) { next(e) }
}

export async function postAbrir(req: Request, res: Response, next: NextFunction) {
  try {
    const { local } = abrirTurnoSchema.parse(req.body)
    res.status(201).json(await turnos.abrirTurno(local, req.user!.sub, req.user!.setor, req.user!.nivelAcesso))
  } catch (e) { next(e) }
}

export async function postFechar(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await turnos.fecharTurno(String(req.params.id)))
  } catch (e) { next(e) }
}

export async function deleteTurno(req: Request, res: Response, next: NextFunction) {
  try {
    await turnos.deletarTurno(String(req.params.id), req.user!.setor, req.user!.nivelAcesso)
    res.json({ ok: true })
  } catch (e) { next(e) }
}

export async function getHistorico(req: Request, res: Response, next: NextFunction) {
  try {
    const local = req.query.local as string | undefined
    res.json(await turnos.listarHistoricoTurnos(local))
  } catch (e) { next(e) }
}

export async function getContagem(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id)
    const user = req.user!
    const contagem = await turnos.listarItensContagem(id)

    const isSup = user.nivelAcesso === 'Admin' || user.nivelAcesso === 'Supervisor'
    const isDono = contagem.operadorId === user.sub
    if (!isSup && !isDono) {
      throw new AppError('Acesso negado: contagem de outro operador', 403, 'FORBIDDEN')
    }
    res.json(contagem)
  } catch (e) { next(e) }
}

export async function getContagemCega(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await turnos.listarItensContagemCega(String(req.params.id)))
  } catch (e) { next(e) }
}

export async function postContagemItem(req: Request, res: Response, next: NextFunction) {
  try {
    const { produtoId, quantidadeContada } = registrarItemContagemSchema.parse(req.body)
    res.json(await turnos.registrarItem(String(req.params.id), req.user!.sub, req.user!.nivelAcesso, produtoId, quantidadeContada))
  } catch (e) { next(e) }
}

export async function postContagemFoto(req: Request, res: Response, next: NextFunction) {
  try {
    const { produtoId, fotoEvidencia, justificativa } = finalizarItemDivergenciaSchema.parse(req.body)
    res.json(await turnos.registrarFotoEvidencia(String(req.params.id), req.user!.sub, req.user!.nivelAcesso, produtoId, fotoEvidencia, justificativa))
  } catch (e) { next(e) }
}

export async function postContagemFinalizar(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await turnos.finalizarContagem(String(req.params.id), req.user!.sub, req.user!.nivelAcesso))
  } catch (e) { next(e) }
}

export async function postVerificarEntrada(req: Request, res: Response, next: NextFunction) {
  try {
    const { produtoId, quantidade } = verificarEntradaSchema.parse(req.body)
    res.json(await turnos.verificarEntradaRecente(produtoId, quantidade))
  } catch (e) { next(e) }
}

export async function postRascunho(req: Request, res: Response, next: NextFunction) {
  try {
    const data = criarRascunhoEntradaSchema.parse(req.body)
    const contagemId = String(req.params.id)
    const contagem = await turnos.listarItensContagem(contagemId)
    if (!['Admin', 'Supervisor'].includes(req.user!.nivelAcesso) && contagem.operadorId !== req.user!.sub)
      throw new AppError('Acesso negado: contagem pertence a outro operador', 403, 'FORBIDDEN')
    res.status(201).json(
      await rascunhos.criarRascunho({
        ...data,
        contagemId,
        operadorId: req.user!.sub,
        local: contagem.local,
      }),
    )
  } catch (e) { next(e) }
}

export async function getRascunhosPendentes(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await rascunhos.listarRascunhosPendentes())
  } catch (e) { next(e) }
}

export async function postDecidirRascunho(req: Request, res: Response, next: NextFunction) {
  try {
    const { acao, vinculadoA, motivoDecisao } = decidirRascunhoSchema.parse(req.body)
    res.json(
      await rascunhos.decidirRascunho(
        String(req.params.id),
        acao,
        req.user!.sub,
        req.user!.nome,
        vinculadoA,
        motivoDecisao,
      ),
    )
  } catch (e) { next(e) }
}

export async function getRevisoesPendentes(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await turnos.listarRevisoesPendentes())
  } catch (e) { next(e) }
}

export async function postDecidirRevisao(req: Request, res: Response, next: NextFunction) {
  try {
    const { acao, decisao, novaQuantidade } = req.body as { acao: 'aceitar' | 'ajustar' | 'perda' | 'recontagem'; decisao?: string; novaQuantidade?: number }
    if (!['aceitar', 'ajustar', 'perda', 'recontagem'].includes(acao)) {
      throw new AppError('Ação inválida', 400)
    }
    res.json(await turnos.decidirRevisao(String(req.params.id), acao, req.user!.sub, decisao, novaQuantidade))
  } catch (e) { next(e) }
}
