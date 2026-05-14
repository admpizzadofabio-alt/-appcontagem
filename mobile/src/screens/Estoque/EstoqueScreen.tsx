import React, { useState, useMemo } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useListarEstoqueQuery, useHistoricoEstoqueQuery, type EstoqueItem } from '../../services/api/estoque'
import { EstoqueTimeline } from '../../components/EstoqueTimeline'
import { useLocalAcesso } from '../../hooks/useLocalAcesso'
import { useTurnoAtualQuery } from '../../services/api/turnos'
import { useAuth } from '../../contexts/AuthContext'
import { Card } from '../../components/Card'
import { Badge } from '../../components/Badge'
import { EmptyState } from '../../components/EmptyState'
import { SectionHeader } from '../../components/SectionHeader'
import { colors } from '../../theme/colors'

function fmtDataHora(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function _renderExpandHoje(e: EstoqueItem, _todosItens: EstoqueItem[], isAdmin: boolean, bloqueado: boolean, data?: string) {
  return (
    <>
      <Text style={{ fontSize: 12, color: colors.textSub }}>🕐 Atualizado: {fmtDataHora(e.atualizadoEm)}</Text>
      <Text style={{ fontSize: 12, color: colors.textSub }}>
        ⚠️ Mínimo: {e.produto.estoqueMinimo > 0 ? `${e.produto.estoqueMinimo} ${e.produto.unidadeMedida}` : 'não configurado'}
      </Text>
      {isAdmin && (
        <Text style={{ fontSize: 12, color: colors.textSub }}>
          💰 Custo unit.: {e.produto.custoUnitario > 0 ? `R$ ${e.produto.custoUnitario.toFixed(2)}` : 'não configurado'}
        </Text>
      )}
      {isAdmin && e.produto.custoUnitario > 0 && !bloqueado && (
        <Text style={{ fontSize: 12, color: colors.textSub }}>
          📊 Valor em estoque: R$ {(e.quantidadeAtual * e.produto.custoUnitario).toFixed(2)}
        </Text>
      )}
      {!bloqueado && <EstoqueTimeline produtoId={e.produtoId} local={e.local} quantidadeAtual={e.quantidadeAtual} unidadeMedida={e.produto.unidadeMedida} data={data} />}
    </>
  )
}

function gerarUltimos7Dias(): string[] {
  // Usa data LOCAL (não UTC). toISOString() devolve UTC e quebra após 21h BRT
  // (data salta pro dia seguinte). Aqui usamos getDate/Month/Year do horário local.
  const dias: string[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    dias.push(`${yyyy}-${mm}-${dd}`)
  }
  return dias
}

function fmtChip(iso: string, idx: number): string {
  if (idx === 0) return 'Hoje'
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

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
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())
  const dias = useMemo(() => gerarUltimos7Dias(), [])
  const [dataSelecionada, setDataSelecionada] = useState<string>(dias[0])
  const isHoje = dataSelecionada === dias[0]
  const localHistorico = local ?? 'Bar'
  const { data: historico, isLoading: loadingHistorico } = useHistoricoEstoqueQuery(
    { data: dataSelecionada, local: localHistorico },
    { skip: isHoje || !isSup }
  )

  function toggleExpand(id: string) {
    setExpandidos((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  const efetivo = veTodosLocais ? local : localOperador
  const { data = [], isLoading } = useListarEstoqueQuery(efetivo ? { local: efetivo } : undefined)

  const filtrados = data.filter((e) =>
    e.produto.nomeBebida.toLowerCase().includes(busca.toLowerCase())
  )

  // Alerta real: só conta quando o mínimo foi configurado (> 0) e a quantidade está abaixo
  const baixo = filtrados.filter((e) => e.produto.estoqueMinimo > 0 && e.quantidadeAtual <= e.produto.estoqueMinimo)
  const ok    = filtrados.filter((e) => !(e.produto.estoqueMinimo > 0 && e.quantidadeAtual <= e.produto.estoqueMinimo))

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

        {/* ── Chips de data ─────────────────────────────────── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.diasScroll} contentContainerStyle={s.diasContent}>
          {dias.map((d, idx) => {
            const temDiv = false // placeholder — será preenchido com dados reais
            return (
              <TouchableOpacity
                key={d}
                style={[s.diaChip, dataSelecionada === d && s.diaChipAtivo]}
                onPress={() => setDataSelecionada(d)}
              >
                <Text style={[s.diaChipTxt, dataSelecionada === d && s.diaChipTxtAtivo]}>{fmtChip(d, idx)}</Text>
              </TouchableOpacity>
            )
          })}
        </ScrollView>

        {qtdBloqueada && isHoje && (
          <View style={s.lockBanner}>
            <Text style={s.lockBannerTxt}>🔒 Finalize a contagem do turno para ver as quantidades</Text>
          </View>
        )}

        {/* ── View histórica (dias passados) ──────────────── */}
        {!isHoje && isSup && (
          <>
            {loadingHistorico && <EmptyState icon="⏳" title="Carregando histórico..." />}
            {!loadingHistorico && historico && !historico.temDados && (
              <EmptyState icon="📭" title={`Sem atividade em ${localHistorico} nesse dia`} />
            )}
            {!loadingHistorico && historico?.temDados && (
              <>
                {/* Card resumo do dia */}
                <Card style={s.resumoDia}>
                  <Text style={s.resumoDiaTitulo}>📅 {new Date(historico.data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })} · {localHistorico}</Text>
                  <View style={s.resumoDiaRow}>
                    <View style={s.resumoDiaItem}><Text style={s.resumoDiaVal}>{historico.resumo!.totalColibri}</Text><Text style={s.resumoDiaLabel}>Vendas</Text></View>
                    <View style={s.resumoDiaItem}><Text style={s.resumoDiaVal}>{historico.resumo!.totalEntradas}</Text><Text style={s.resumoDiaLabel}>Entradas</Text></View>
                    <View style={s.resumoDiaItem}><Text style={s.resumoDiaVal}>{historico.resumo!.totalPerdas}</Text><Text style={s.resumoDiaLabel}>Perdas</Text></View>
                    <View style={s.resumoDiaItem}>
                      <Text style={[s.resumoDiaVal, historico.resumo!.totalDivergencias > 0 && { color: colors.danger }]}>
                        {historico.resumo!.totalDivergencias}
                      </Text>
                      <Text style={s.resumoDiaLabel}>Diverg.</Text>
                    </View>
                  </View>
                </Card>

                {/* Produtos do dia */}
                {historico.produtos.map((p) => {
                  const temDiv = p.divergencia !== 0
                  const aberto = expandidos.has(p.produtoId)
                  return (
                    <Card key={p.produtoId} style={[s.itemCard, temDiv && s.itemCardDiv]}>
                      <TouchableOpacity onPress={() => toggleExpand(p.produtoId)} activeOpacity={0.8}>
                        <View style={s.itemRow}>
                          <View style={[s.dot, { backgroundColor: temDiv ? colors.danger : colors.accent }]} />
                          <View style={s.itemInfo}>
                            <Text style={s.itemName}>{p.nomeBebida}</Text>
                            <Text style={s.itemSub}>{p.categoria} · {p.unidadeMedida}</Text>
                          </View>
                          <View style={s.itemRight}>
                            <Text style={[s.itemQty, temDiv && { color: colors.danger }]}>{p.fechamento}</Text>
                            <Text style={s.itemUnit}>{p.unidadeMedida}</Text>
                          </View>
                          <Text style={s.chevron}>{aberto ? '▲' : '▼'}</Text>
                        </View>
                      </TouchableOpacity>
                      {aberto && (
                        <View style={s.expandido}>
                          <View style={s.fluxoRow}>
                            <View style={s.fluxoItem}><Text style={s.fluxoVal}>{p.abertura}</Text><Text style={s.fluxoLabel}>Abertura</Text></View>
                            {p.divergencia !== 0 && <View style={s.fluxoItem}><Text style={[s.fluxoVal, { color: colors.danger }]}>{p.divergencia > 0 ? '+' : ''}{p.divergencia}</Text><Text style={s.fluxoLabel}>Divergência</Text></View>}
                            {p.colibri > 0 && <View style={s.fluxoItem}><Text style={[s.fluxoVal, { color: colors.danger }]}>-{p.colibri}</Text><Text style={s.fluxoLabel}>Colibri</Text></View>}
                            {p.entradas > 0 && <View style={s.fluxoItem}><Text style={[s.fluxoVal, { color: colors.success }]}>+{p.entradas}</Text><Text style={s.fluxoLabel}>Entradas</Text></View>}
                            {p.perdas > 0 && <View style={s.fluxoItem}><Text style={[s.fluxoVal, { color: colors.warning }]}>-{p.perdas}</Text><Text style={s.fluxoLabel}>Perdas</Text></View>}
                            <View style={s.fluxoItem}><Text style={[s.fluxoVal, { fontWeight: '900' }]}>{p.fechamento}</Text><Text style={s.fluxoLabel}>Fechamento</Text></View>
                          </View>
                          {isAdmin && p.custoUnitario > 0 && (
                            <Text style={s.expandidoItem}>💰 Valor fechamento: R$ {(p.fechamento * p.custoUnitario).toFixed(2)}</Text>
                          )}
                          <EstoqueTimeline
                            produtoId={p.produtoId}
                            local={localHistorico}
                            quantidadeAtual={p.fechamento}
                            unidadeMedida={p.unidadeMedida}
                            data={dataSelecionada}
                          />
                        </View>
                      )}
                    </Card>
                  )
                })}
              </>
            )}
          </>
        )}

        {/* ── View de hoje ────────────────────────────────────── */}
        {isHoje && <>
        {isLoading && <EmptyState icon="⏳" title="Carregando..." />}
        {!isLoading && filtrados.length === 0 && <EmptyState icon="📭" title="Nenhum produto encontrado" />}

        {/* ── Alertas ─────────────────────────────────────────── */}
        {!qtdBloqueada && baixo.length > 0 && (
          <>
            <SectionHeader title={`⚠️ Abaixo do mínimo (${baixo.length})`} />
            {baixo.map((e) => {
              const aberto = expandidos.has(e.id)
              return (
                <Card key={e.id} style={s.itemCard}>
                  <TouchableOpacity onPress={() => toggleExpand(e.id)} activeOpacity={0.8}>
                    <View style={s.itemRow}>
                      <View style={[s.dot, { backgroundColor: colors.danger }]} />
                      <View style={s.itemInfo}>
                        <Text style={s.itemName}>{e.produto.nomeBebida}</Text>
                        <Text style={s.itemSub}>{e.produto.categoria} · {e.local} · Mín: {e.produto.estoqueMinimo} {e.produto.unidadeMedida}</Text>
                      </View>
                      <View style={s.itemRight}>
                        <Text style={[s.itemQty, { color: colors.danger }]}>{e.quantidadeAtual}</Text>
                        <Badge label="Baixo" variant="danger" />
                      </View>
                      <Text style={s.chevron}>{aberto ? '▲' : '▼'}</Text>
                    </View>
                  </TouchableOpacity>
                  {aberto && (
                    <View style={s.expandido}>
                      {_renderExpandHoje(e, data, isAdmin, qtdBloqueada, isHoje ? undefined : dataSelecionada)}
                    </View>
                  )}
                </Card>
              )
            })}
          </>
        )}

        {/* ── Em estoque ──────────────────────────────────────── */}
        {ok.length > 0 && (
          <>
            <SectionHeader title={`Em estoque (${ok.length})`} />
            {ok.map((e) => {
              const aberto = expandidos.has(e.id)
              return (
                <Card key={e.id} style={s.itemCard}>
                  <TouchableOpacity onPress={() => toggleExpand(e.id)} activeOpacity={0.8}>
                    <View style={s.itemRow}>
                      <View style={[s.dot, { backgroundColor: colors.accent }]} />
                      <View style={s.itemInfo}>
                        <Text style={s.itemName}>{e.produto.nomeBebida}</Text>
                        <Text style={s.itemSub}>{e.produto.categoria} · {e.local}</Text>
                      </View>
                      <View style={s.itemRight}>
                        <Text style={s.itemQty}>{qtdBloqueada ? '🔒' : e.quantidadeAtual}</Text>
                        {!qtdBloqueada && <Text style={s.itemUnit}>{e.produto.unidadeMedida}</Text>}
                      </View>
                      <Text style={s.chevron}>{aberto ? '▲' : '▼'}</Text>
                    </View>
                  </TouchableOpacity>
                  {aberto && (
                    <View style={s.expandido}>
                      {_renderExpandHoje(e, data, isAdmin, qtdBloqueada, isHoje ? undefined : dataSelecionada)}
                    </View>
                  )}
                </Card>
              )
            })}
          </>
        )}
        </>}
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
  chevron: { fontSize: 10, color: colors.textMuted, marginLeft: 2 },
  expandido: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border, gap: 4 },
  expandidoItem: { fontSize: 12, color: colors.textSub },
  itemCardDiv: { borderLeftWidth: 3, borderLeftColor: colors.danger },

  diasScroll: { marginHorizontal: -16, marginBottom: 4 },
  diasContent: { paddingHorizontal: 16, gap: 8, flexDirection: 'row' },
  diaChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  diaChipAtivo: { backgroundColor: colors.primary, borderColor: colors.primary },
  diaChipTxt: { fontSize: 12, fontWeight: '600', color: colors.textSub },
  diaChipTxtAtivo: { color: '#fff' },

  resumoDia: { backgroundColor: colors.accentLight, borderWidth: 1, borderColor: colors.primary, gap: 8 },
  resumoDiaTitulo: { fontSize: 13, fontWeight: '700', color: colors.primary, textTransform: 'capitalize' },
  resumoDiaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  resumoDiaItem: { alignItems: 'center', gap: 2 },
  resumoDiaVal: { fontSize: 18, fontWeight: '800', color: colors.text },
  resumoDiaLabel: { fontSize: 10, color: colors.textSub, textTransform: 'uppercase' },

  fluxoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingTop: 4 },
  fluxoItem: { alignItems: 'center', minWidth: 52 },
  fluxoVal: { fontSize: 15, fontWeight: '700', color: colors.text },
  fluxoLabel: { fontSize: 10, color: colors.textSub, textTransform: 'uppercase' },
})
