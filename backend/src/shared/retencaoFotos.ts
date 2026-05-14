/**
 * Política de retenção de fotos: apaga base64 de movimentos/contagens antigos
 * (>90 dias) que NÃO estão em revisão pendente. Mantém o registro do movimento,
 * só zera o campo de imagem pra liberar espaço no banco.
 *
 * Por que apagar fotos antigas:
 * - Base64 de imagem ocupa 1MB+ por foto. 1 ano = milhares = GB.
 * - Após 90 dias, contestar uma quebra/perda é raríssimo (já fechou o mês).
 * - Auditoria mantida: log de quem fez/quando/justificativa persiste.
 */
import { prisma } from '../config/prisma.js'
import { logger } from '../config/logger.js'

const DIAS_RETENCAO = 90

export async function limparFotosAntigas() {
  const limite = new Date()
  limite.setDate(limite.getDate() - DIAS_RETENCAO)

  // Fotos de divergência em itens de contagem
  const r1 = await prisma.itemContagem.updateMany({
    where: {
      fotoEvidencia: { not: null },
      revisaoStatus: { not: 'Pendente' }, // não toca em revisões pendentes
      contagem: { dataFechamento: { lt: limite } },
    },
    data: { fotoEvidencia: null },
  })

  // Fotos de comprovante em movimentações
  const r2 = await prisma.movimentacaoEstoque.updateMany({
    where: {
      imagemComprovante: { not: null },
      dataMov: { lt: limite },
      aprovacaoStatus: { not: 'Pendente' },
    },
    data: { imagemComprovante: null },
  })

  // CorrecaoVenda.fotoComanda é NOT NULL — não pode ser limpa.
  // (decisão: manter foto da correção indefinidamente, é prova jurídica de erro)

  const total = r1.count + r2.count
  if (total > 0) {
    logger.info({ itens: r1.count, movs: r2.count }, 'Retenção de fotos: limpeza concluída')
  }
  return total
}
