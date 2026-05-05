import { z } from 'zod'

const itemPedidoSchema = z.object({
  produtoId: z.string().uuid().optional(),
  nomeProduto: z.string().min(1),
  quantidade: z.coerce.number().positive(),
  observacao: z.string().optional(),
  urgente: z.boolean().default(false),
})

export const criarPedidoSchema = z.object({
  itens: z.array(itemPedidoSchema).min(1, 'Pedido deve ter pelo menos 1 item'),
})

export const atualizarStatusSchema = z.object({
  status: z.enum(['Pendente', 'EmAnalise', 'Atendido', 'Cancelado']),
})

export const editarPedidoSchema = z.object({
  nomeProduto: z.string().min(1).optional(),
  quantidade: z.coerce.number().positive().optional(),
  observacao: z.string().optional(),
  urgente: z.boolean().optional(),
})

export type CriarPedidoInput = z.infer<typeof criarPedidoSchema>
export type AtualizarStatusInput = z.infer<typeof atualizarStatusSchema>
export type EditarPedidoInput = z.infer<typeof editarPedidoSchema>
