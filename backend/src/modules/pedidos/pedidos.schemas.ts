import { z } from 'zod'

const itemPedidoSchema = z.object({
  produtoId: z.string().uuid().optional(),
  nomeProduto: z.string().min(1).max(200),
  quantidade: z.coerce.number().positive().max(99999),
  observacao: z.string().max(500).optional(),
  urgente: z.boolean().default(false),
})

export const criarPedidoSchema = z.object({
  itens: z.array(itemPedidoSchema).min(1, 'Pedido deve ter pelo menos 1 item').max(100, 'Máximo 100 itens por pedido'),
})

export const atualizarStatusSchema = z.object({
  status: z.enum(['Pendente', 'EmAnalise', 'Atendido', 'Cancelado']),
})

export const editarPedidoSchema = z.object({
  nomeProduto: z.string().min(1).max(200).optional(),
  quantidade: z.coerce.number().positive().max(99999).optional(),
  observacao: z.string().max(500).optional(),
  urgente: z.boolean().optional(),
})

export type CriarPedidoInput = z.infer<typeof criarPedidoSchema>
export type AtualizarStatusInput = z.infer<typeof atualizarStatusSchema>
export type EditarPedidoInput = z.infer<typeof editarPedidoSchema>
