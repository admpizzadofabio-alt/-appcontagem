import { z } from 'zod'

export const criarMovimentacaoSchema = z.object({
  produtoId: z.string().uuid('ID do produto inválido'),
  tipoMov: z.enum(['Entrada', 'Saida', 'Transferencia', 'AjustePerda', 'AjusteContagem', 'CargaInicial']),
  quantidade: z.coerce.number().positive('Quantidade deve ser positiva'),
  localOrigem: z.enum(['Bar', 'Delivery']).optional(),
  localDestino: z.enum(['Bar', 'Delivery']).optional(),
  observacao: z.string().optional(),
  motivoAjuste: z.string().optional(),
  imagemComprovante: z.string().optional(),
  pendente: z.boolean().optional(),
  justificativaEntrada: z.string().optional(),
}).refine((d) => {
  if (d.tipoMov === 'AjustePerda' && !d.motivoAjuste) return false
  return true
}, { message: 'Motivo é obrigatório para ajuste de perda', path: ['motivoAjuste'] })
.refine((d) => {
  if (d.tipoMov === 'Transferencia' && (!d.localOrigem || !d.localDestino)) return false
  return true
}, { message: 'Transferência requer local de origem e destino', path: ['localOrigem'] })

export const filtrosMovimentacaoSchema = z.object({
  produtoId: z.string().optional(),
  tipoMov: z.string().optional(),
  local: z.string().optional(),
  dataInicio: z.string().optional(),
  dataFim: z.string().optional(),
})

export const aprovarSchema = z.object({
  motivo: z.string().max(500).optional(),
})

export const rejeitarSchema = z.object({
  motivo: z.string().min(3, 'Motivo é obrigatório para rejeição').max(500),
})

export type CriarMovimentacaoInput = z.infer<typeof criarMovimentacaoSchema>
export type FiltrosMovimentacao = z.infer<typeof filtrosMovimentacaoSchema>
