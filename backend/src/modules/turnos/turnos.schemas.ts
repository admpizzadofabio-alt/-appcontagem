import { z } from 'zod'

export const abrirTurnoSchema = z.object({
  local: z.enum(['Bar', 'Delivery']),
})

export const localQuerySchema = z.object({
  local: z.enum(['Bar', 'Delivery']),
})

export const registrarItemContagemSchema = z.object({
  produtoId: z.string().uuid(),
  quantidadeContada: z.coerce.number().min(0),
})

export const finalizarItemDivergenciaSchema = z.object({
  produtoId: z.string().uuid(),
  fotoEvidencia: z.string().min(1, 'Foto é obrigatória'),
  justificativa: z.string().min(3, 'Justificativa obrigatória'),
})

export const criarRascunhoEntradaSchema = z.object({
  produtoId: z.string().uuid(),
  quantidade: z.coerce.number().positive(),
  origemTexto: z.string().min(3, 'Descreva a origem da entrada'),
  observacao: z.string().optional(),
  fotoEvidencia: z.string().min(1, 'Foto obrigatória'),
})

export const decidirRascunhoSchema = z.object({
  acao: z.enum(['aprovar', 'vincular', 'rejeitar']),
  vinculadoA: z.string().uuid().optional(),
  motivoDecisao: z.string().optional(),
})

export const verificarEntradaSchema = z.object({
  produtoId: z.string().uuid(),
  quantidade: z.coerce.number().positive(),
})
