import { z } from 'zod'

export const criarProdutoSchema = z.object({
  nomeBebida: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres').max(200),
  categoria: z.string().min(1).max(80),
  unidadeMedida: z.string().min(1).max(20),
  volumePadrao: z.string().max(20).optional(),
  custoUnitario: z.coerce.number().min(0).max(999999).default(0),
  estoqueMinimo: z.coerce.number().min(0).max(999999).default(0),
  perdaThreshold: z.coerce.number().min(0).max(999999).default(5),
  setorPadrao: z.enum(['Bar', 'Delivery', 'Todos']).default('Todos'),
  // Validação granular de formato/tamanho de imagem fica em validarImagem.ts (chamado pelo service).
  // Aqui o limite de 1.5MB cobre a string base64 inflated (imagem real até ~1.1MB).
  imagem: z.string().max(1_500_000).optional(),
})

export const atualizarProdutoSchema = criarProdutoSchema.partial()

export type CriarProdutoInput = z.infer<typeof criarProdutoSchema>
export type AtualizarProdutoInput = z.infer<typeof atualizarProdutoSchema>
