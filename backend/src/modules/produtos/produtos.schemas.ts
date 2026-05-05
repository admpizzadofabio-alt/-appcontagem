import { z } from 'zod'

export const criarProdutoSchema = z.object({
  nomeBebida: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  categoria: z.string().min(1),
  unidadeMedida: z.string().min(1),
  volumePadrao: z.string().optional(),
  custoUnitario: z.coerce.number().min(0).default(0),
  estoqueMinimo: z.coerce.number().min(0).default(0),
  perdaThreshold: z.coerce.number().min(0).default(5),
  setorPadrao: z.enum(['Bar', 'Delivery', 'Todos']).default('Todos'),
  imagem: z.string().optional(),
})

export const atualizarProdutoSchema = criarProdutoSchema.partial()

export type CriarProdutoInput = z.infer<typeof criarProdutoSchema>
export type AtualizarProdutoInput = z.infer<typeof atualizarProdutoSchema>
