import { z } from 'zod'

export const abrirTurnoSchema = z.object({
  local: z.enum(['Bar', 'Delivery']),
})

export const localQuerySchema = z.object({
  local: z.enum(['Bar', 'Delivery']),
})

export const registrarItemContagemSchema = z.object({
  produtoId: z.string().uuid(),
  quantidadeContada: z.coerce.number().min(0).max(999999),
})

export const finalizarItemDivergenciaSchema = z.object({
  produtoId: z.string().uuid(),
  fotoEvidencia: z.string().max(1_500_000).optional().default(''),
  justificativa: z.string().min(3, 'Justificativa obrigatória').max(500),
})

export const criarRascunhoEntradaSchema = z.object({
  produtoId: z.string().uuid(),
  quantidade: z.coerce.number().positive().max(999999),
  origemTexto: z.string().min(3, 'Descreva a origem da entrada').max(200),
  observacao: z.string().max(500).optional(),
  fotoEvidencia: z.string().min(1, 'Foto obrigatória').max(1_500_000),
})

export const decidirRascunhoSchema = z.object({
  acao: z.enum(['aprovar', 'vincular', 'rejeitar']),
  vinculadoA: z.string().uuid().optional(),
  motivoDecisao: z.string().max(500).optional(),
})

export const verificarEntradaSchema = z.object({
  produtoId: z.string().uuid(),
  quantidade: z.coerce.number().positive().max(999999),
})
