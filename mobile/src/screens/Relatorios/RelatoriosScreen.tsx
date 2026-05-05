import React, { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useMacroRelatorioQuery, useDivergenciasRelatorioQuery } from '../../services/api/relatorios'
import { StatCard } from '../../components/StatCard'
import { Card } from '../../components/Card'
import { Badge } from '../../components/Badge'
import { EmptyState } from '../../components/EmptyState'
import { SectionHeader } from '../../components/SectionHeader'
import { colors } from '../../theme/colors'

type Periodo = 'hoje' | 'semana' | 'mes' | 'anterior'

const PERIODOS: { key: Periodo; label: string }[] = [
  { key: 'hoje',     label: 'Hoje'         },
  { key: 'semana',   label: 'Esta semana'  },
  { key: 'mes',      label: 'Este mês'     },
  { key: 'anterior', label: 'Mês anterior' },
]

function calcDatas(p: Periodo): { dataInicio: string; dataFim: string } {
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  const hoje = new Date()

  if (p === 'hoje') {
    const s = fmt(hoje)
    return { dataInicio: s, dataFim: s }
  }

  if (p === 'semana') {
    const dow = hoje.getDay()
    const diffMon = dow === 0 ? -6 : 1 - dow
    const seg = new Date(hoje)
    seg.setDate(hoje.getDate() + diffMon)
    return { dataInicio: fmt(seg), dataFim: fmt(hoje) }
  }

  if (p === 'mes') {
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
    return { dataInicio: fmt(inicio), dataFim: fmt(hoje) }
  }

  // anterior
  const inicioAnt = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)
  const fimAnt    = new Date(hoje.getFullYear(), hoje.getMonth(), 0)
  return { dataInicio: fmt(inicioAnt), dataFim: fmt(fimAnt) }
}

function moeda(v: number) {
  return `R$ ${v.toFixed(2).replace('.', ',')}`
}

function fmtData(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export function RelatoriosScreen() {
  const [periodo, setPeriodo] = useState<Periodo>('mes')
  const { dataInicio, dataFim } = calcDatas(periodo)

  const { data: macro, isLoading } = useMacroRelatorioQuery({ dataInicio, dataFim })
  const { data: divergencias = [] }  = useDivergenciasRelatorioQuery({ dataInicio, dataFim })

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <ScrollView style={s.scroll} contentContainerStyle={s.content}>

        {/* Seletor de período */}
        <View style={s.periodoRow}>
          {PERIODOS.map((p) => (
            <Pressable
              key={p.key}
              style={[s.periodoBtn, periodo === p.key && s.periodoBtnActive]}
              onPress={() => setPeriodo(p.key)}
            >
              <Text style={[s.periodoBtnTxt, periodo === p.key && s.periodoBtnTxtActive]}>
                {p.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={s.periodoLabel}>
          {fmtData(dataInicio)} – {fmtData(dataFim)}
        </Text>

        {/* KPIs */}
        <SectionHeader title="Visão Geral" />
        {isLoading && <EmptyState icon="⏳" title="Carregando relatórios..." />}

        {macro && (
          <>
            <View style={s.statsGrid}>
              <StatCard label="Valor em Estoque" value={moeda(macro.valorAtivo)} icon="💰" style={s.statFull} />
            </View>
            <View style={s.statsRow}>
              <StatCard label="Entradas"  value={moeda(macro.totalEntradas)} icon="📥" color={colors.success} bg={colors.successLight} />
              <StatCard label="Saídas"    value={moeda(macro.totalSaidas)}   icon="📤" color={colors.info}    bg={colors.infoLight}    />
              <StatCard label="Perdas"    value={moeda(macro.totalPerdas)}   icon="🗑️" color={colors.danger}  bg={colors.dangerLight}  />
            </View>
            <View style={s.statsRow}>
              <StatCard label="Contagens" value={String(macro.contagens)} icon="📋" />
              <StatCard
                label="Aprovações Pendentes"
                value={String(macro.aprovacoesPendentes)}
                icon="🔔"
                color={macro.aprovacoesPendentes ? colors.warning : colors.success}
                bg={macro.aprovacoesPendentes ? colors.warningLight : colors.successLight}
              />
            </View>
          </>
        )}

        {/* Divergências */}
        <SectionHeader title="Divergências" />
        {divergencias.length === 0 && (
          <EmptyState icon="✅" title="Nenhuma divergência" subtitle="Todas as contagens estão em conformidade" />
        )}

        {divergencias.map((d) => (
          <Card key={d.id} style={s.divCard}>
            <View style={s.divHeader}>
              <View>
                <Text style={s.divLocal}>{d.local}</Text>
                <Text style={s.divData}>
                  {new Date(d.dataFechamento).toLocaleDateString('pt-BR')} · {d.operador.nome}
                </Text>
              </View>
              <Badge label={`${d.totalDesvios} desvio(s)`} variant={d.totalDesvios > 3 ? 'danger' : 'warning'} />
            </View>
            {d.itens.map((item, i) => (
              <View key={i} style={s.divItem}>
                <Text style={s.divProd}>{item.produto.nomeBebida}</Text>
                <Text style={[s.divDiff, item.diferenca < 0 && { color: colors.danger }]}>
                  {item.diferenca > 0 ? '+' : ''}{item.diferenca} {item.produto.unidadeMedida}
                </Text>
                {item.causaDivergencia && <Text style={s.divCausa}>↳ {item.causaDivergencia}</Text>}
              </View>
            ))}
          </Card>
        ))}

      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.background },
  scroll:  { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 32 },

  periodoRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  periodoBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  periodoBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  periodoBtnTxt:       { fontSize: 13, fontWeight: '600', color: colors.textSub },
  periodoBtnTxtActive: { color: colors.textOnPrimary },

  periodoLabel: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: -4 },

  statsGrid: { gap: 10 },
  statsRow:  { flexDirection: 'row', gap: 10 },
  statFull:  { flex: undefined },

  divCard:   { gap: 8, marginBottom: 0 },
  divHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  divLocal:  { fontSize: 15, fontWeight: '700', color: colors.text },
  divData:   { fontSize: 12, color: colors.textSub },
  divItem:   { paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: colors.border },
  divProd:   { fontSize: 13, fontWeight: '600', color: colors.text },
  divDiff:   { fontSize: 13, fontWeight: '700', color: colors.success },
  divCausa:  { fontSize: 11, color: colors.textSub, fontStyle: 'italic' },
})
