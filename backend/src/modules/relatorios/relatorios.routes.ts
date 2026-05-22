import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { requireAuth, requireNivel } from '../../middlewares/auth.js'
import { macroHandler, saidasHandler, perdasHandler, divergenciasHandler, auditoriaHandler } from './relatorios.controller.js'
import { exportMovimentacoes, exportEstoqueAtual, exportContagens } from './export.service.js'
import { cmvPorProduto, lossRatePorTurno, vendasPorHora, transferBalance } from './analytics.service.js'

const byUser = (req: any) => req.user?.sub ?? req.ip ?? 'anon'

const relatorioLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyGenerator: byUser,
  skip: () => process.env.NODE_ENV === 'test',
  message: { code: 'TOO_MANY_REQUESTS', message: 'Limite de relatórios atingido. Tente em 15 minutos.' },
})

const exportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: byUser,
  skip: () => process.env.NODE_ENV === 'test',
  message: { code: 'TOO_MANY_REQUESTS', message: 'Limite de exports atingido. Tente em 15 minutos.' },
})

const router = Router()
router.use(requireAuth, requireNivel(['Supervisor', 'Admin']))

router.get('/macro', relatorioLimiter, macroHandler)
router.get('/saidas', relatorioLimiter, saidasHandler)
router.get('/perdas', relatorioLimiter, perdasHandler)
router.get('/divergencias', relatorioLimiter, divergenciasHandler)
router.get('/auditoria', relatorioLimiter, auditoriaHandler)

function safeDate(v: unknown): string {
  const s = String(v ?? '')
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ''
}

function parseDates(req: import('express').Request, res: import('express').Response): { di: string; df: string } | null {
  const di = safeDate(req.query.dataInicio)
  const df = safeDate(req.query.dataFim)
  if (!di || !df) { res.status(400).json({ error: 'dataInicio e dataFim são obrigatórios no formato YYYY-MM-DD' }); return null }
  return { di, df }
}

// Exports CSV (Excel abre nativo). Datas em YYYY-MM-DD.
router.get('/export/movimentacoes', exportLimiter, async (req, res, next) => {
  try {
    const dates = parseDates(req, res); if (!dates) return
    const { di, df } = dates
    const csv = await exportMovimentacoes(di, df)
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="movimentacoes-${di}_${df}.csv"`)
    res.send('﻿' + csv) // BOM pra Excel reconhecer UTF-8
  } catch (e) { next(e) }
})

router.get('/export/estoque', exportLimiter, async (_req, res, next) => {
  try {
    const csv = await exportEstoqueAtual()
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="estoque-atual.csv"`)
    res.send('﻿' + csv)
  } catch (e) { next(e) }
})

router.get('/export/contagens', exportLimiter, async (req, res, next) => {
  try {
    const dates = parseDates(req, res); if (!dates) return
    const { di, df } = dates
    const csv = await exportContagens(di, df)
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="contagens-${di}_${df}.csv"`)
    res.send('﻿' + csv)
  } catch (e) { next(e) }
})

// Analytics
router.get('/cmv', relatorioLimiter, async (req, res, next) => {
  try { const d = parseDates(req, res); if (!d) return; res.json(await cmvPorProduto(d.di, d.df)) } catch (e) { next(e) }
})
router.get('/loss-rate', relatorioLimiter, async (req, res, next) => {
  try { const d = parseDates(req, res); if (!d) return; res.json(await lossRatePorTurno(d.di, d.df)) } catch (e) { next(e) }
})
router.get('/vendas-por-hora', relatorioLimiter, async (req, res, next) => {
  try { const d = parseDates(req, res); if (!d) return; res.json(await vendasPorHora(d.di, d.df)) } catch (e) { next(e) }
})
router.get('/transferencias', relatorioLimiter, async (req, res, next) => {
  try { const d = parseDates(req, res); if (!d) return; res.json(await transferBalance(d.di, d.df)) } catch (e) { next(e) }
})

export { router as relatoriosRouter }
