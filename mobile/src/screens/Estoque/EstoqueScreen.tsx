import React, { useState } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useListarEstoqueQuery } from '../../services/api/estoque'
import { useLocalAcesso } from '../../hooks/useLocalAcesso'
import { useTurnoAtualQuery } from '../../services/api/turnos'
import { useAuth } from '../../contexts/AuthContext'
import { Card } from '../../components/Card'
import { Badge } from '../../components/Badge'
import { EmptyState } from '../../components/EmptyState'
import { SectionHeader } from '../../components/SectionHeader'
import { colors } from '../../theme/colors'

export function EstoqueScreen() {
  const { usuario } = useAuth()
  const { veTodosLocais, localOperador } = useLocalAcesso()
  const isAdmin = usuario?.nivelAcesso === 'Admin'
  const isSup = isAdmin || usuario?.nivelAcesso === 'Supervisor'
  const { data: turnoAtual } = useTurnoAtualQuery(
    { local: localOperador! },
    { skip: isSup || !localOperador }
  )
  const contagemFinalizada = turnoAtual?.contagem?.status === 'Fechada'
  const qtdBloqueada = !isSup && !contagemFinalizada

  const [local, setLocal] = useState<'Bar' | 'Delivery' | undefined>(veTodosLocais ? undefined : localOperador)
  const [busca, setBusca] = useState('')
  const efetivo = veTodosLocais ? local : localOperador
  const { data = [], isLoading } = useListarEstoqueQuery(efetivo ? { local: efetivo } : undefined)

  const filtrados = data.filter((e) =>
    e.produto.nomeBebida.toLowerCase().includes(busca.toLowerCase())
  )

  const baixo = filtrados.filter((e) => e.quantidadeAtual <= e.produto.estoqueMinimo)

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView style={s.scroll} contentContainerStyle={s.content}>
        <Text style={s.pageTitle}>Estoque Atual</Text>

        <TextInput style={s.search} placeholder="Buscar produto..." placeholderTextColor={colors.textMuted} value={busca} onChangeText={setBusca} />

        {veTodosLocais ? (
          <View style={s.tabs}>
            {([undefined, 'Bar', 'Delivery'] as const).map((l) => (
              <TouchableOpacity key={String(l)} style={[s.tab, local === l && s.tabActive]} onPress={() => setLocal(l)}>
                <Text style={[s.tabText, local === l && s.tabTextActive]}>{l ?? 'Todos'}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={s.lockBanner}>
            <Text style={s.lockBannerTxt}>📍 Setor: {localOperador}</Text>
          </View>
        )}

        {qtdBloqueada && (
          <View style={s.lockBanner}>
            <Text style={s.lockBannerTxt}>🔒 Finalize a contagem do turno para ver as quantidades</Text>
          </View>
        )}

        {!qtdBloqueada && baixo.length > 0 && (
          <>
            <SectionHeader title={`⚠️ Abaixo do mínimo (${baixo.length})`} />
            {baixo.map((e) => (
              <Card key={e.id} style={s.itemCard}>
                <View style={s.itemRow}>
                  <View style={s.itemInfo}>
                    <Text style={s.itemName}>{e.produto.nomeBebida}</Text>
                    <Text style={s.itemSub}>{e.local} · Mín: {e.produto.estoqueMinimo} {e.produto.unidadeMedida}</Text>
                  </View>
                  <View style={s.itemRight}>
                    <Text style={[s.itemQty, { color: colors.danger }]}>{e.quantidadeAtual}</Text>
                    <Badge label="Baixo" variant="danger" />
                  </View>
                </View>
              </Card>
            ))}
          </>
        )}

        <SectionHeader title={`Todos os Produtos (${filtrados.length})`} />
        {isLoading && <EmptyState icon="⏳" title="Carregando..." />}
        {!isLoading && filtrados.length === 0 && <EmptyState icon="📭" title="Nenhum produto encontrado" />}
        {filtrados.map((e) => {
          const alerta = e.quantidadeAtual <= e.produto.estoqueMinimo
          return (
            <Card key={e.id} style={s.itemCard}>
              <View style={s.itemRow}>
                <View style={[s.dot, { backgroundColor: alerta ? colors.danger : colors.accent }]} />
                <View style={s.itemInfo}>
                  <Text style={s.itemName}>{e.produto.nomeBebida}</Text>
                  <Text style={s.itemSub}>{e.produto.categoria} · {e.local}</Text>
                </View>
                <View style={s.itemRight}>
                  <Text style={[s.itemQty, alerta && !qtdBloqueada && { color: colors.danger }]}>
                    {qtdBloqueada ? '🔒' : e.quantidadeAtual}
                  </Text>
                  {!qtdBloqueada && <Text style={s.itemUnit}>{e.produto.unidadeMedida}</Text>}
                </View>
              </View>
            </Card>
          )
        })}
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 8, paddingBottom: 32 },
  pageTitle: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 4 },
  search: { backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 16, height: 44, fontSize: 14, color: colors.text, borderWidth: 1, borderColor: colors.border },
  tabs: { flexDirection: 'row', gap: 8, marginVertical: 4 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.surface, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.textSub },
  tabTextActive: { color: '#fff' },
  lockBanner: { backgroundColor: colors.accentLight, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.primary },
  lockBannerTxt: { fontSize: 13, fontWeight: '700', color: colors.primary, textAlign: 'center' },
  itemCard: { marginBottom: 0 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: '600', color: colors.text },
  itemSub: { fontSize: 12, color: colors.textSub },
  itemRight: { alignItems: 'flex-end', gap: 4 },
  itemQty: { fontSize: 20, fontWeight: '700', color: colors.primary },
  itemUnit: { fontSize: 11, color: colors.textSub },
})
