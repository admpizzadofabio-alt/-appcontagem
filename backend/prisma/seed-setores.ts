import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const SETORES_PADRAO = [
  { nome: 'Bar',      temEstoque: true  },
  { nome: 'Delivery', temEstoque: true  },
  { nome: 'Vinhos',   temEstoque: true  },
  { nome: 'Cozinha',  temEstoque: false },
  { nome: 'Salão',    temEstoque: false },
]

async function main() {
  let inseridos = 0
  for (const s of SETORES_PADRAO) {
    const existente = await prisma.setor.findUnique({ where: { nome: s.nome } })
    if (!existente) {
      await prisma.setor.create({ data: { nome: s.nome, temEstoque: s.temEstoque, ativo: true } })
      inseridos++
    }
  }
  if (inseridos > 0) console.log(`✅ Setores padrão criados: ${inseridos}`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
