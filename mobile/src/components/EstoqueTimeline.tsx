import React from 'react'
import { View, Text, ScrollView, ActivityIndicator, StyleSheet } from 'react-native'
import { useListarMovimentacoesQuery } from '../services/api/movimentacoes'
import { colors } from '../theme/colors'

type Props = {
  produtoId: string
  local: string
  quantidadeAtual: number
  unidadeMedida: string
  // data ausente = mostra últimas movimentações (Hoje); presente = filtra estritamente
  data?: string
}

const TIPO_CONFIG: Record<string, { icon: string; cor: string; label: string }> = {
  CargaInicial:    { icon: '📦', cor: colors.primary,  label: 'Carga'     },
  Entrada:         { icon: '⬆️',  cor: colors.success,  label: 'Entrada'   },
  Saida:           { icon: '🛒',  cor: colors.info,     label: 'Venda'     },
  AjustePerda:     { icon: '⬇️',  cor: colors.danger,   label: 'Perda'     },
  AjusteContagem:  { icon: '📋',  cor: colors.warning,  label: 'Contagem'  },
  Transferencia:   { icon: '↔️',  cor: colors.textSub,  label: 'Transf.'   },
}

function sinal(tipoMov: string, local: string, localOrigem?: string, localDestino?: string) {
  if (['Entrada', 'CargaInicial'].includes(tipoMov)) return '+'
  if (['Saida', 'AjustePerda'].includes(tipoMov)) return '-'
  if (tipoMov === 'Transferencia') return localDestino === local ? '+' : '-'
  if (tipoMov === 'AjusteContagem') return localDestino === local ? ('+') : '-'
  return ''
}

function fmtData(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export function EstoqueTimeline({ produtoId, local, quantidadeAtual, unidadeMedida, data }: Props) {
  const { data: movs = [], isLoading } = useListarMovimentacoesQuery(
    data ? { produtoId, local, dataInicio: data, dataFim: data } : { produtoId, local },
  )

  if (isLoading) return <ActivityIndicator color={colors.primary} style={{ marginTop: 8 }} />
  if (movs.length === 0) return <Text style={s.vazio}>{data ? 'Sem movimentações nesse dia' : 'Sem movimentações registradas'}</Text>

  // Agrupa movs do mesmo tipo+dia em 1 nó (ex.: 3 -1 COLIBRI 13/05 vira "-3 COLIBRI (3x)")
  type Group = {
    key: string; tipoMov: string; dia: string; quantidade: number; count: number
    localOrigem?: string; localDestino?: string; isColibri: boolean
  }
  const groups: Group[] = []
  for (const m of movs) {
    const dia = m.dataMov.slice(0, 10)
    const isColibri = m.tipoMov === 'Saida' && m.observacao?.includes('Colibri')
    const tipoKey = isColibri ? 'Colibri' : m.tipoMov
    const key = `${tipoKey}:${dia}:${m.localOrigem ?? ''}:${m.localDestino ?? ''}`
    const existing = groups.find((g) => g.key === key)
    if (existing) {
      existing.quantidade += m.quantidade
      existing.count++
    } else {
      groups.push({
        key, tipoMov: m.tipoMov, dia, quantidade: m.quantidade, count: 1,
        localOrigem: m.localOrigem, localDestino: m.localDestino, isColibri: !!isColibri,
      })
    }
  }
  const ultimos = groups.reverse().slice(0, 10)

  return (
    <View style={s.wrap}>
      <Text style={s.titulo}>Linha do tempo</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {ultimos.map((g, idx) => {
          const cfg = TIPO_CONFIG[g.tipoMov] ?? { icon: '•', cor: colors.textSub, label: g.tipoMov }
          const label = g.isColibri ? 'Colibri' : cfg.label
          const icon = g.isColibri ? '🛒' : cfg.icon
          const cor = g.isColibri ? colors.info : cfg.cor
          const s2 = sinal(g.tipoMov, local, g.localOrigem, g.localDestino)

          return (
            <View key={g.key} style={s.nodeWrap}>
              <View style={[s.node, { borderColor: cor }]}>
                <Text style={s.nodeIcon}>{icon}</Text>
                <Text style={[s.nodeQty, { color: cor }]}>{s2}{g.quantidade}</Text>
                <Text style={s.nodeLabel}>{label}{g.count > 1 ? ` (${g.count}x)` : ''}</Text>
                <Text style={s.nodeData}>{fmtData(g.dia + 'T12:00:00')}</Text>
              </View>
              {idx < ultimos.length - 1 && <Text style={s.seta}>→</Text>}
            </View>
          )
        })}

        {/* Nó final: estoque atual */}
        <View style={s.nodeWrap}>
          <Text style={s.seta}>→</Text>
          <View style={[s.node, s.nodeAtual]}>
            <Text style={s.nodeIcon}>📊</Text>
            <Text style={[s.nodeQty, { color: colors.primary }]}>{quantidadeAtual}</Text>
            <Text style={s.nodeLabel}>{unidadeMedida}</Text>
            <Text style={s.nodeData}>Atual</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  wrap: { marginTop: 8 },
  titulo: { fontSize: 11, fontWeight: '700', color: colors.textSub, textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 },
  scroll: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingBottom: 4 },
  nodeWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  node: { alignItems: 'center', padding: 8, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface, minWidth: 62, gap: 2 },
  nodeAtual: { borderColor: colors.primary, backgroundColor: colors.accentLight },
  nodeIcon: { fontSize: 14 },
  nodeQty: { fontSize: 14, fontWeight: '800', color: colors.text },
  nodeLabel: { fontSize: 9, color: colors.textSub, textTransform: 'uppercase', textAlign: 'center' },
  nodeData: { fontSize: 9, color: colors.textMuted },
  seta: { fontSize: 12, color: colors.textMuted },
  vazio: { fontSize: 12, color: colors.textSub, fontStyle: 'italic', marginTop: 4 },
})
