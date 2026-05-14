import { z } from 'zod'

export const criarMovimentacaoSchema = z.object({
  produtoId: z.string().uuid('ID do produto inválido'),
  tipoMov: z.enum(['Entrada', 'Saida', 'Transferencia', 'AjustePerda', 'AjusteContagem', 'CargaInicial']),
  quantidade: z.coerce.number().positive('Quantidade deve ser positiva').max(999999),
  localOrigem: z.enum(['Bar', 'Delivery']).optional(),
  localDestino: z.enum(['Bar', 'Delivery']).optional(),
  observacao: z.string().max(500).optional(),
  motivoAjuste: z.string().max(500).optional(),
  imagemComprovante: z.string().max(1_500_000).optional(),
  pendente: z.boolean().optional(),
  justificativaEntrada: z.string().max(500).optional(),
}).refine((d) => {
  if (d.tipoMov === 'AjustePerda' && !d.motivoAjuste) return false
  return true
}, { message: 'Motivo é obrigatório para ajuste de perda', path: ['motivoAjuste'] })
.refine((d) => {
  if (d.tipoMov === 'Transferencia' && (!d.localOrigem || !d.localDestino)) return false
  return true
}, { message: 'Transferência requer local de origem e destino', path: ['localOrigem'] })

const dataIsoSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Formato YYYY-MM-DD esperado').optional()

export const filtrosMovimentacaoSchema = z.object({
  produtoId: z.string().uuid().optional(),
  tipoMov: z.enum(['Entrada', 'Saida', 'Transferencia', 'AjustePerda', 'AjusteContagem', 'CargaInicial']).optional(),
  local: z.enum(['Bar', 'Delivery']).optional(),
  dataInicio: dataIsoSchema,
  dataFim: dataIsoSchema,
  take: z.coerce.number().int().min(1).max(500).optional(),
  skip: z.coerce.number().int().min(0).optional(),
})

export const aprovarSchema = z.object({
  motivo: z.string().max(500).optional(),
})

export const rejeitarSchema = z.object({
  motivo: z.string().min(3, 'Motivo é obrigatório para rejeição').max(500),
})

export type CriarMovimentacaoInput = z.infer<typeof criarMovimentacaoSchema>
export type FiltrosMovimentacao = z.infer<typeof filtrosMovimentacaoSchema>
