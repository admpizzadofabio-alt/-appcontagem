import { fetchVendas } from '../src/modules/colibri/colibriApiClient.js'

const vendas = await fetchVendas('2026-05-04', '2026-05-04')
const ordenado = vendas.sort((a, b) => b.quantitySold - a.quantitySold)
console.log(`\nVendas Colibri — 2026-05-04 (${ordenado.length} produtos)\n`)
for (const v of ordenado) {
  console.log(`  ${String(v.quantitySold).padStart(4)} x  ${v.productName}  [${v.groupName}]`)
}
