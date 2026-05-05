import type { Request, Response, NextFunction } from 'express'
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
    res.status(201).json(await turnos.abrirTurno(local, req.user!.sub))
  } catch (e) { next(e) }
}

export async function postFechar(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await turnos.fecharTurno(String(req.params.id)))
  } catch (e) { next(e) }
}

export async function deleteTurno(req: Request, res: Response, next: NextFunction) {
  try {
    await turnos.deletarTurno(String(req.params.id))
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
    res.json(await turnos.listarItensContagem(String(req.params.id)))
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
    res.json(await turnos.registrarItem(String(req.params.id), produtoId, quantidadeContada, req.user!.sub))
  } catch (e) { next(e) }
}

export async function postContagemFoto(req: Request, res: Response, next: NextFunction) {
  try {
    const { produtoId, fotoEvidencia, justificativa } = finalizarItemDivergenciaSchema.parse(req.body)
    res.json(await turnos.registrarFotoEvidencia(String(req.params.id), produtoId, fotoEvidencia, justificativa))
  } catch (e) { next(e) }
}

export async function postContagemFinalizar(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await turnos.finalizarContagem(String(req.params.id), req.user!.sub))
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
