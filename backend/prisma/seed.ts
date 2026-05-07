import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed...')

  const hash1234 = await bcrypt.hash('1234', 12)
  const hash1111 = await bcrypt.hash('1111', 12)
  const hash2222 = await bcrypt.hash('2222', 12)

  // upsert.update vazio: se o usuário já existir, NÃO sobrescreve o PIN.
  // O PIN só é setado na criação inicial. Re-rodar o seed é seguro pra PINs alterados.
  await prisma.usuario.upsert({
    where: { id: 'admin-master' },
    update: {},
    create: {
      id: 'admin-master',
      nome: 'Admin Master',
      pin: hash1234,
      pinFormat: 'bcrypt',
      setor: 'Admin',
      nivelAcesso: 'Admin',
      ativo: true,
    },
  })

  await prisma.usuario.upsert({
    where: { id: 'operador-bar' },
    update: {},
    create: {
      id: 'operador-bar',
      nome: 'Operador Bar',
      pin: hash1111,
      pinFormat: 'bcrypt',
      setor: 'Bar',
      nivelAcesso: 'Operador',
      ativo: true,
    },
  })

  await prisma.usuario.upsert({
    where: { id: 'operador-delivery' },
    update: {},
    create: {
      id: 'operador-delivery',
      nome: 'Operador Delivery',
      pin: hash2222,
      pinFormat: 'bcrypt',
      setor: 'Delivery',
      nivelAcesso: 'Operador',
      ativo: true,
    },
  })

  // Produtos de exemplo
  const produtos = [
    { nomeBebida: 'Heineken Long Neck', categoria: 'Cerveja', unidadeMedida: 'Un', volumePadrao: '330ml', custoUnitario: 5.50, estoqueMinimo: 24, setorPadrao: 'Bar' },
    { nomeBebida: 'Budweiser Long Neck', categoria: 'Cerveja', unidadeMedida: 'Un', volumePadrao: '330ml', custoUnitario: 4.80, estoqueMinimo: 24, setorPadrao: 'Bar' },
    { nomeBebida: 'Água Mineral 500ml', categoria: 'Água', unidadeMedida: 'Un', volumePadrao: '500ml', custoUnitario: 1.20, estoqueMinimo: 48, setorPadrao: 'Todos' },
    { nomeBebida: 'Coca-Cola Lata 350ml', categoria: 'Refrigerante', unidadeMedida: 'Un', volumePadrao: '350ml', custoUnitario: 3.00, estoqueMinimo: 36, setorPadrao: 'Todos' },
    { nomeBebida: 'Suco de Laranja 1L', categoria: 'Suco', unidadeMedida: 'Un', volumePadrao: '1L', custoUnitario: 6.00, estoqueMinimo: 12, setorPadrao: 'Delivery' },
  ]

  for (const p of produtos) {
    await prisma.produto.create({ data: p }).catch(() => {})
  }

  console.log(`✅ Seed concluído!`)
  console.log(`   Admin: PIN 1234`)
  console.log(`   Bar:   PIN 1111`)
  console.log(`   Delivery: PIN 2222`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
