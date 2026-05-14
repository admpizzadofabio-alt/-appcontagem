import React, { useState } from 'react'
import { View, Text, ScrollView, StyleSheet, Alert, TextInput, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as FileSystem from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { Card } from '../../components/Card'
import { ActionButton } from '../../components/ActionButton'
import { SectionHeader } from '../../components/SectionHeader'
import { colors } from '../../theme/colors'
import {
  useCmvRelatorioQuery, useLossRateQuery, useVendasPorHoraQuery, useTransferBalanceQuery,
} from '../../services/api/relatorios'
import { storage, KEYS } from '../../config/storage'

function toLocalISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

export function AnalyticsScreen() {
  const hoje = toLocalISO(new Date())
  const setediasAtras = (() => { const d = new Date(); d.setDate(d.getDate() - 7); return toLocalISO(d) })()
  const [dataInicio, setDataInicio] = useState(setediasAtras)
  const [dataFim, setDataFim] = useState(hoje)
  const [exporting, setExporting] = useState<string | null>(null)

  const { data: cmv } = useCmvRelatorioQuery({ dataInicio, dataFim })
  const { data: loss } = useLossRateQuery({ dataInicio, dataFim })
  const { data: vendas } = useVendasPorHoraQuery({ dataInicio, dataFim })
  const { data: transfer } = useTransferBalanceQuery({ dataInicio, dataFim })

  async function exportar(endpoint: string, filename: string) {
    setExporting(endpoint)
    try {
      const baseUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3333/api/v1'
      const url = `${baseUrl}/relatorios/export/${endpoint}${endpoint === 'estoque' ? '' : `?dataInicio=${dataInicio}&dataFim=${dataFim}`}`

      const token = await storage.get(KEYS.ACCESS_TOKEN)
      const fileUri = (FileSystem as any).documentDirectory + filename
      const result = await (FileSystem as any).downloadAsync(url, fileUri, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (result.status !== 200) {
        Alert.alert('Erro', `Download falhou (HTTP ${result.status})`)
        return
      }

      const canShare = await Sharing.isAvailableAsync()
      if (canShare) {
        await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: filename })
      } else {
        Alert.alert('Salvo', `Arquivo: ${fileUri}`)
      }
    } catch (e: any) {
      Alert.alert('Erro', e.message ?? 'Falha ao exportar')
    } finally {
      setExporting(null)
    }
  }

  const totalSaiu = transfer ? (transfer.fluxos.Bar?.saiu ?? 0) + (transfer.fluxos.Delivery?.saiu ?? 0) : 0
  const picoHora = vendas?.horas.reduce((a, b) => (b.vendas > a.vendas ? b : a), { hora: 0, label: '00:00', vendas: 0, valor: 0 })

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView style={s.scroll} contentContainerStyle={s.content}>
        <Text style={s.pageTitle}>Relatórios & Analytics</Text>

        <Card>
          <SectionHeader title="Período" />
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>De</Text>
              <TextInput style={s.input} value={dataInicio} onChangeText={setDataInicio} placeholder="YYYY-MM-DD" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Até</Text>
              <TextInput style={s.input} value={dataFim} onChangeText={setDataFim} placeholder="YYYY-MM-DD" />
            </View>
          </View>
        </Card>

        <Card>
          <SectionHeader title="📥 Exportar CSV" />
          <View style={s.gap}>
            <ActionButton
              label={exporting === 'movimentacoes' ? 'Exportando...' : 'Movimentações'}
              onPress={() => exportar('movimentacoes', `movimentacoes-${dataInicio}_${dataFim}.csv`)}
              disabled={!!exporting}
            />
            <ActionButton
              label={exporting === 'estoque' ? 'Exportando...' : 'Estoque Atual'}
              onPress={() => exportar('estoque', 'estoque-atual.csv')}
              disabled={!!exporting}
            />
            <ActionButton
              label={exporting === 'contagens' ? 'Exportando...' : 'Contagens'}
              onPress={() => exportar('contagens', `contagens-${dataInicio}_${dataFim}.csv`)}
              disabled={!!exporting}
            />
          </View>
        </Card>

        {/* CMV */}
        <Card>
          <SectionHeader title="💰 CMV — Top produtos" />
          {!cmv ? <ActivityIndicator color={colors.primary} /> : (
            <>
              <Text style={s.kpi}>Total CMV: R$ {cmv.total_cmv.toFixed(2)}</Text>
              {cmv.produtos.slice(0, 10).map((p) => (
                <View key={p.produtoId} style={s.itemRow}>
                  <Text style={s.itemNome}>{p.nome}</Text>
                  <Text style={s.itemValor}>R$ {p.cmv.toFixed(2)} ({p.pct_total}%)</Text>
                </View>
              ))}
              {cmv.produtos.length === 0 && <Text style={s.vazio}>Sem vendas no período</Text>}
            </>
          )}
        </Card>

        {/* Loss Rate */}
        <Card>
          <SectionHeader title="⬇️ Loss rate por turno" />
          {!loss ? <ActivityIndicator color={colors.primary} /> : (
            <>
              {loss.turnos.map((t) => (
                <View key={t.turnoId} style={s.itemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.itemNome}>{t.diaOperacional} · {t.local}</Text>
                    <Text style={s.itemSub}>Vendas {t.vendas} · Perdas {t.perdas}</Text>
                  </View>
                  <Text style={[s.itemValor, t.loss_rate_pct > 5 && { color: colors.danger }]}>
                    {t.loss_rate_pct}%
                  </Text>
                </View>
              ))}
              {loss.turnos.length === 0 && <Text style={s.vazio}>Sem turnos fechados no período</Text>}
            </>
          )}
        </Card>

        {/* Vendas por hora */}
        <Card>
          <SectionHeader title="🕐 Pico de vendas" />
          {!vendas ? <ActivityIndicator color={colors.primary} /> : (
            <>
              <Text style={s.kpi}>Pico: {picoHora?.label} ({picoHora?.vendas} un)</Text>
              <ScrollView horizontal>
                <View style={s.barChart}>
                  {vendas.horas.map((h) => {
                    const max = Math.max(...vendas.horas.map((x) => x.vendas), 1)
                    const altura = (h.vendas / max) * 80
                    return (
                      <View key={h.hora} style={s.barCol}>
                        <Text style={s.barNum}>{h.vendas || ''}</Text>
                        <View style={[s.bar, { height: altura, backgroundColor: h.vendas > 0 ? colors.primary : colors.border }]} />
                        <Text style={s.barLabel}>{h.label.slice(0, 2)}h</Text>
                      </View>
                    )
                  })}
                </View>
              </ScrollView>
            </>
          )}
        </Card>

        {/* Transferências */}
        <Card>
          <SectionHeader title="↔️ Transferências Bar ↔ Delivery" />
          {!transfer ? <ActivityIndicator color={colors.primary} /> : (
            <>
              <Text style={s.kpi}>{transfer.total} transferências · {totalSaiu} unidades</Text>
              {Object.entries(transfer.fluxos).map(([local, f]) => (
                <View key={local} style={s.itemRow}>
                  <Text style={s.itemNome}>{local}</Text>
                  <Text style={s.itemValor}>
                    <Text style={{ color: colors.danger }}>-{f.saiu}</Text>
                    {' / '}
                    <Text style={{ color: colors.success }}>+{f.entrou}</Text>
                    {' = '}
                    {f.saldo >= 0 ? '+' : ''}{f.saldo}
                  </Text>
                </View>
              ))}
            </>
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  pageTitle: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 4 },
  row: { flexDirection: 'row', gap: 8 },
  gap: { gap: 8 },
  label: { fontSize: 12, color: colors.textSub, marginBottom: 4 },
  input: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, fontSize: 14 },
  kpi: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 8 },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 8 },
  itemNome: { fontSize: 13, color: colors.text, flex: 1 },
  itemSub: { fontSize: 11, color: colors.textSub },
  itemValor: { fontSize: 13, fontWeight: '700', color: colors.text },
  vazio: { fontSize: 12, color: colors.textSub, fontStyle: 'italic', paddingVertical: 8 },
  barChart: { flexDirection: 'row', alignItems: 'flex-end', height: 120, paddingTop: 16, gap: 4 },
  barCol: { alignItems: 'center', width: 28 },
  bar: { width: 16, borderRadius: 2, marginVertical: 2 },
  barNum: { fontSize: 9, color: colors.textSub, height: 12 },
  barLabel: { fontSize: 9, color: colors.textMuted },
})
