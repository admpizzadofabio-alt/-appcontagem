import React, { useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useGetMeuTurnoQuery, type MovResumo, type ItemContagemResumo } from '../../services/api/meuTurno'
import { Card } from '../../components/Card'
import { Badge } from '../../components/Badge'
import { EmptyState } from '../../components/EmptyState'
import { colors } from '../../theme/colors'

type Aba = 'contagem' | 'movimentos' | 'erros'

function fmtHora(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function fmtData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR')
}

export function MeuTurnoScreen() {
  const { data, isLoading, refetch, isFetching } = useGetMeuTurnoQuery()
  const [aba, setAba] = useState<Aba>('contagem')

  if (isLoading) {
    return (
      <SafeAreaView style={s.safe}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} />
      </SafeAreaView>
    )
  }

  if (!data) return <EmptyState icon="📭" title="Sem turno aberto hoje" subtitle="Abra o turno para iniciar as operações" />

  const { contagem, movimentacoes, errosComanda, totais, diaOperacional, setor } = data

  // ── Contagem: separar por categoria ──
  const contagemOk     = contagem?.itens.filter((i) => i.divergenciaCategoria === 'ok'    || i.diferenca === 0) ?? []
  const contagemLeves  = contagem?.itens.filter((i) => i.divergenciaCategoria === 'leve') ?? []
  const contagemGrandes = contagem?.itens.filter((i) => i.divergenciaCategoria === 'grande') ?? []

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>

      {/* ── Header ── */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Meu Turno</Text>
          <Text style={s.headerSub}>{setor} · {fmtData(diaOperacional + 'T12:00:00')}</Text>
        </View>
        <TouchableOpacity onPress={refetch} style={s.refreshBtn} disabled={isFetching}>
          <Text style={s.refreshTxt}>{isFetching ? '⏳' : '🔄'}</Text>
        </TouchableOpacity>
      </View>

      {/* ── KPIs ── */}
      <View style={s.kpiRow}>
        <View style={[s.kpi, { backgroundColor: colors.accentLight }]}>
          <Text style={[s.kpiNum, { color: colors.primary }]}>{totais.entradas}</Text>
          <Text style={s.kpiLabel}>Entradas</Text>
        </View>
        <View style={[s.kpi, { backgroundColor: colors.dangerLight }]}>
          <Text style={[s.kpiNum, { color: colors.danger }]}>{totais.perdas}</Text>
          <Text style={s.kpiLabel}>Perdas</Text>
        </View>
        <View style={[s.kpi, { backgroundColor: colors.infoLight }]}>
          <Text style={[s.kpiNum, { color: colors.info }]}>{totais.transferencias}</Text>
          <Text style={s.kpiLabel}>Transfer.</Text>
        </View>
        <View style={[s.kpi, { backgroundColor: '#FFF3CD' }]}>
          <Text style={[s.kpiNum, { color: '#7D5400' }]}>{totais.errosComanda}</Text>
          <Text style={s.kpiLabel}>Erros</Text>
        </View>
      </View>

      {/* ── Abas ── */}
      <View style={s.tabRow}>
        {([
          { key: 'contagem', label: `📋 Contagem${contagem ? ` (${contagem.totalDesvios} desvios)` : ''}` },
          { key: 'movimentos', label: `📦 Movimentos (${totais.entradas + totais.perdas + totais.transferencias})` },
          { key: 'erros', label: `📋 Err. Comanda (${totais.errosComanda})` },
        ] as { key: Aba; label: string }[]).map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[s.tabBtn, aba === t.key && s.tabBtnAtivo]}
            onPress={() => setAba(t.key)}
          >
            <Text style={[s.tabBtnTxt, aba === t.key && s.tabBtnTxtAtivo]} numberOfLines={1}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content}>

        {/* ══ ABA: CONTAGEM ══════════════════════════════════════ */}
        {aba === 'contagem' && (
          <>
            {!contagem && (
              <EmptyState icon="📋" title="Nenhuma contagem hoje" subtitle="A contagem aparece após iniciar o turno" />
            )}

            {contagem && (
              <>
                {/* Status do turno */}
                <Card style={s.statusCard}>
                  <View style={s.statusRow}>
                    <View>
                      <Text style={s.statusLocal}>{contagem.local}</Text>
                      <Text style={s.statusHora}>
                        Aberto às {fmtHora(contagem.dataAbertura)}
                        {contagem.dataFechamento ? ` · Fechado às ${fmtHora(contagem.dataFechamento)}` : ' · Em aberto'}
                      </Text>
                    </View>
                    <Badge
                      label={contagem.status}
                      variant={contagem.status === 'Fechada' ? 'success' : contagem.status === 'Aberta' ? 'warning' : 'default'}
                    />
                  </View>
                  <View style={s.contagemStats}>
                    <View style={s.statBox}>
                      <Text style={[s.statNum, { color: colors.success }]}>{contagemOk.length}</Text>
                      <Text style={s.statLabel}>✓ OK</Text>
                    </View>
                    <View style={s.statBox}>
                      <Text style={[s.statNum, { color: colors.warning }]}>{contagemLeves.length}</Text>
                      <Text style={s.statLabel}>⚡ Leves</Text>
                    </View>
                    <View style={s.statBox}>
                      <Text style={[s.statNum, { color: colors.danger }]}>{contagemGrandes.length}</Text>
                      <Text style={s.statLabel}>🔴 Grandes</Text>
                    </View>
                  </View>
                </Card>

                {/* Divergências grandes */}
                {contagemGrandes.length > 0 && (
                  <>
                    <Text style={s.secTitle}>🔴 Divergências grandes</Text>
                    {contagemGrandes.map((i) => <ItemContagemCard key={i.produtoId} item={i} />)}
                  </>
                )}

                {/* Divergências leves */}
                {contagemLeves.length > 0 && (
                  <>
                    <Text style={s.secTitle}>⚡ Divergências leves</Text>
                    {contagemLeves.map((i) => <ItemContagemCard key={i.produtoId} item={i} />)}
                  </>
                )}

                {/* OK */}
                {contagemOk.length > 0 && (
                  <>
                    <Text style={s.secTitle}>✅ Produtos em conformidade ({contagemOk.length})</Text>
                    {contagemOk.map((i) => <ItemContagemCard key={i.produtoId} item={i} />)}
                  </>
                )}
              </>
            )}
          </>
        )}

        {/* ══ ABA: MOVIMENTOS ════════════════════════════════════ */}
        {aba === 'movimentos' && (
          <>
            {movimentacoes.entradas.length === 0 &&
             movimentacoes.perdas.length    === 0 &&
             movimentacoes.transferencias.length === 0 && (
               <EmptyState icon="📦" title="Nenhuma movimentação hoje" />
             )}

            {movimentacoes.entradas.length > 0 && (
              <>
                <Text style={s.secTitle}>📥 Entradas ({movimentacoes.entradas.length})</Text>
                {movimentacoes.entradas.map((m) => <MovCard key={m.id} mov={m} cor={colors.success} />)}
              </>
            )}

            {movimentacoes.perdas.length > 0 && (
              <>
                <Text style={s.secTitle}>🗑️ Perdas ({movimentacoes.perdas.length})</Text>
                {movimentacoes.perdas.map((m) => <MovCard key={m.id} mov={m} cor={colors.danger} />)}
              </>
            )}

            {movimentacoes.transferencias.length > 0 && (
              <>
                <Text style={s.secTitle}>🔄 Transferências ({movimentacoes.transferencias.length})</Text>
                {movimentacoes.transferencias.map((m) => <MovCard key={m.id} mov={m} cor={colors.info} />)}
              </>
            )}
          </>
        )}

        {/* ══ ABA: ERROS DE COMANDA ══════════════════════════════ */}
        {aba === 'erros' && (
          <>
            {errosComanda.length === 0 && (
              <EmptyState icon="✅" title="Nenhum erro de comanda hoje" />
            )}
            {errosComanda.map((e) => (
              <Card key={e.id} style={s.erroCard}>
                <View style={s.erroRow}>
                  <Text style={s.erroDe}>{e.produtoComandado}</Text>
                  <Text style={s.erroArrow}>→</Text>
                  <Text style={s.erroPara}>{e.produtoServido}</Text>
                </View>
                <Text style={s.erroMeta}>
                  Qtd: {e.quantidade} · {fmtHora(e.criadoEm)} · {e.operador}
                </Text>
              </Card>
            ))}
          </>
        )}

      </ScrollView>
    </SafeAreaView>
  )
}

// ── Sub-componentes ────────────────────────────────────────────

function ItemContagemCard({ item }: { item: ItemContagemResumo }) {
  const diff = item.diferenca
  return (
    <Card style={[
      s.itemCard,
      diff < 0 ? s.itemCardRed : diff > 0 ? s.itemCardYellow : s.itemCardGreen,
    ] as any}>
      <View style={s.itemRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.itemNome}>{item.nomeBebida}</Text>
          {item.causaDivergencia && (
            <Text style={s.itemCausa}>↳ {item.causaDivergencia}</Text>
          )}
        </View>
        <View style={s.itemNums}>
          <Text style={s.itemDiff}>
            {diff === 0 ? '=' : diff > 0 ? `+${diff.toFixed(0)}` : diff.toFixed(0)} {item.unidadeMedida}
          </Text>
          <Text style={s.itemComp}>
            {item.quantidadeContada.toFixed(0)} / {item.quantidadeSistema.toFixed(0)}
          </Text>
        </View>
      </View>
    </Card>
  )
}

function MovCard({ mov, cor }: { mov: MovResumo; cor: string }) {
  return (
    <Card style={s.movCard}>
      <View style={s.movRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.movNome}>{mov.nomeBebida}</Text>
          {mov.operador && <Text style={s.movMeta}>👤 {mov.operador}</Text>}
          {mov.motivo && <Text style={s.movMeta}>↳ {mov.motivo}</Text>}
          {mov.observacao && <Text style={s.movMeta}>💬 {mov.observacao}</Text>}
        </View>
        <View style={s.movRight}>
          <Text style={[s.movQtd, { color: cor }]}>
            {mov.quantidade.toFixed(0)} {mov.unidade}
          </Text>
          <Text style={s.movHora}>{fmtHora(mov.dataMov)}</Text>
          {mov.aprovacaoStatus === 'Pendente' && (
            <Badge label="Pendente" variant="warning" />
          )}
        </View>
      </View>
    </Card>
  )
}

// ── Estilos ────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.background },
  scroll:  { flex: 1 },
  content: { padding: 14, gap: 10, paddingBottom: 36 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.primary, padding: 16,
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  headerSub:   { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },
  refreshBtn:  { padding: 8 },
  refreshTxt:  { fontSize: 22 },

  kpiRow: { flexDirection: 'row', backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  kpi:    { flex: 1, alignItems: 'center', paddingVertical: 12, gap: 2 },
  kpiNum: { fontSize: 22, fontWeight: '800' },
  kpiLabel: { fontSize: 10, fontWeight: '600', color: colors.textSub, textTransform: 'uppercase' },

  tabRow: { flexDirection: 'row', backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: 8, paddingVertical: 6, gap: 6 },
  tabBtn: { flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: 'center', backgroundColor: colors.surfaceAlt, paddingHorizontal: 4 },
  tabBtnAtivo: { backgroundColor: colors.primary },
  tabBtnTxt:   { fontSize: 11, fontWeight: '600', color: colors.textSub },
  tabBtnTxtAtivo: { color: '#fff' },

  secTitle: { fontSize: 13, fontWeight: '700', color: colors.textSub, textTransform: 'uppercase', marginTop: 4 },

  // Contagem status
  statusCard:   { gap: 12 },
  statusRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  statusLocal:  { fontSize: 15, fontWeight: '700', color: colors.text },
  statusHora:   { fontSize: 12, color: colors.textSub, marginTop: 2 },
  contagemStats: { flexDirection: 'row', justifyContent: 'space-around' },
  statBox:      { alignItems: 'center', gap: 2 },
  statNum:      { fontSize: 24, fontWeight: '800' },
  statLabel:    { fontSize: 11, color: colors.textSub },

  // Item contagem
  itemCard:        { padding: 12, gap: 2 },
  itemCardGreen:   { borderLeftWidth: 4, borderLeftColor: colors.success },
  itemCardYellow:  { borderLeftWidth: 4, borderLeftColor: colors.warning },
  itemCardRed:     { borderLeftWidth: 4, borderLeftColor: colors.danger },
  itemRow:         { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemNome:        { fontSize: 14, fontWeight: '700', color: colors.text },
  itemCausa:       { fontSize: 11, color: colors.textSub, fontStyle: 'italic' },
  itemNums:        { alignItems: 'flex-end', gap: 2 },
  itemDiff:        { fontSize: 15, fontWeight: '800', color: colors.text },
  itemComp:        { fontSize: 11, color: colors.textSub },

  // Movimentações
  movCard:  { padding: 12 },
  movRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  movNome:  { fontSize: 14, fontWeight: '700', color: colors.text },
  movMeta:  { fontSize: 11, color: colors.textSub, marginTop: 2, fontStyle: 'italic' },
  movRight: { alignItems: 'flex-end', gap: 4 },
  movQtd:   { fontSize: 15, fontWeight: '800' },
  movHora:  { fontSize: 11, color: colors.textSub },

  // Erros de comanda
  erroCard:  { padding: 12, gap: 4 },
  erroRow:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  erroDe:    { flex: 1, fontSize: 13, fontWeight: '700', color: colors.danger },
  erroArrow: { fontSize: 16, color: colors.textMuted },
  erroPara:  { flex: 1, fontSize: 13, fontWeight: '700', color: colors.success, textAlign: 'right' },
  erroMeta:  { fontSize: 11, color: colors.textSub },
})
