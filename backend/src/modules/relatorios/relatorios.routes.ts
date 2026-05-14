import { Router } from 'express'
import { requireAuth, requireNivel } from '../../middlewares/auth.js'
import { macroHandler, saidasHandler, perdasHandler, divergenciasHandler, auditoriaHandler } from './relatorios.controller.js'
import { exportMovimentacoes, exportEstoqueAtual, exportContagens } from './export.service.js'
import { cmvPorProduto, lossRatePorTurno, vendasPorHora, transferBalance } from './analytics.service.js'

const router = Router()
router.use(requireAuth, requireNivel(['Supervisor', 'Admin']))

router.get('/macro', macroHandler)
router.get('/saidas', saidasHandler)
router.get('/perdas', perdasHandler)
router.get('/divergencias', divergenciasHandler)
router.get('/auditoria', auditoriaHandler)

// Exports CSV (Excel abre nativo). Datas em YYYY-MM-DD.
router.get('/export/movimentacoes', async (req, res, next) => {
  try {
    const csv = await exportMovimentacoes(String(req.query.dataInicio), String(req.query.dataFim))
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="movimentacoes-${req.query.dataInicio}_${req.query.dataFim}.csv"`)
    res.send('﻿' + csv) // BOM pra Excel reconhecer UTF-8
  } catch (e) { next(e) }
})

router.get('/export/estoque', async (_req, res, next) => {
  try {
    const csv = await exportEstoqueAtual()
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="estoque-atual.csv"`)
    res.send('﻿' + csv)
  } catch (e) { next(e) }
})

router.get('/export/contagens', async (req, res, next) => {
  try {
    const csv = await exportContagens(String(req.query.dataInicio), String(req.query.dataFim))
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="contagens-${req.query.dataInicio}_${req.query.dataFim}.csv"`)
    res.send('﻿' + csv)
  } catch (e) { next(e) }
})

// Analytics
router.get('/cmv', async (req, res, next) => {
  try { res.json(await cmvPorProduto(String(req.query.dataInicio), String(req.query.dataFim))) } catch (e) { next(e) }
})
router.get('/loss-rate', async (req, res, next) => {
  try { res.json(await lossRatePorTurno(String(req.query.dataInicio), String(req.query.dataFim))) } catch (e) { next(e) }
})
router.get('/vendas-por-hora', async (req, res, next) => {
  try { res.json(await vendasPorHora(String(req.query.dataInicio), String(req.query.dataFim))) } catch (e) { next(e) }
})
router.get('/transferencias', async (req, res, next) => {
  try { res.json(await transferBalance(String(req.query.dataInicio), String(req.query.dataFim))) } catch (e) { next(e) }
})

export { router as relatoriosRouter }
