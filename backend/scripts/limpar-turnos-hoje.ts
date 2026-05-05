import { prisma } from '../src/config/prisma.js'

const hoje = new Date().toISOString().slice(0, 10)
console.log(`Limpando turnos/contagens de ${hoje}...`)

const turnos = await prisma.fechamentoTurno.findMany({
  where: { diaOperacional: hoje },
  select: { id: true, local: true, contagemId: true, status: true },
})
console.log(`Turnos encontrados: ${turnos.length}`, turnos)

const contagensIds = turnos.map(t => t.contagemId).filter(Boolean) as string[]

const itens = await prisma.itemContagem.deleteMany({
  where: { contagemId: { in: contagensIds } },
})
console.log(`Itens de contagem removidos: ${itens.count}`)

const rascunhos = await prisma.entradaRascunho.deleteMany({
  where: { contagemId: { in: contagensIds } },
})
console.log(`Rascunhos removidos: ${rascunhos.count}`)

const contagens = await prisma.contagemEstoque.deleteMany({
  where: { id: { in: contagensIds } },
})
console.log(`Contagens removidas: ${contagens.count}`)

const turnosDel = await prisma.fechamentoTurno.deleteMany({
  where: { diaOperacional: hoje },
})
console.log(`Turnos removidos: ${turnosDel.count}`)

await prisma.$disconnect()
console.log('Pronto.')
