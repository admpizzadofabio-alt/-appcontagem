import React from 'react'
import { View, Text, ScrollView, ActivityIndicator, StyleSheet, Alert, TouchableOpacity } from 'react-native'
import { useListarMovimentacoesQuery, useDeletarMovimentacaoMutation } from '../services/api/movimentacoes'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from './Toast'
import { colors } from '../theme/colors'

type Props = {
  produtoId: string
  local: string
  quantidadeAtual: number
  unidadeMedida: string
  // data ausente = mostra últimas movimentações (Hoje); presente = filtra estritamente
  data?: string
  ultimaContagemEm?: string | null
  ultimaContagemQuantidade?: number | null
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

export function EstoqueTimeline({ produtoId, local, quantidadeAtual, unidadeMedida, data, ultimaContagemEm, ultimaContagemQuantidade }: Props) {
  const { usuario } = useAuth()
  const isAdmin = usuario?.nivelAcesso === 'Admin'
  const [deletar, { isLoading: deletando }] = useDeletarMovimentacaoMutation()
  const toast = useToast()

  function pedirDelecao(movId: string, label: string) {
    Alert.alert(
      'Apagar movimentação',
      `Tem certeza que quer apagar "${label}"? O estoque será revertido. Esta ação é registrada na auditoria.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Apagar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletar(movId).unwrap()
              toast.success('Movimentação apagada e estoque revertido')
            } catch (e: any) {
              toast.error(e?.data?.message ?? 'Não foi possível apagar')
            }
          },
        },
      ],
    )
  }

  const { data: movs = [], isLoading } = useListarMovimentacoesQuery(
    data ? { produtoId, local, dataInicio: data, dataFim: data } : { produtoId, local },
  )

  if (isLoading) return <ActivityIndicator color={colors.primary} style={{ marginTop: 8 }} />
  if (movs.length === 0 && !ultimaContagemEm) return <Text style={s.vazio}>{data ? 'Sem movimentações nesse dia' : 'Sem movimentações registradas'}</Text>

  // Agrupa movs do mesmo tipo+dia em 1 nó. Para Entrada e CargaInicial mantém timestamp
  // exato pra permitir ordenação cronológica (não agrupa eventos individuais).
  type Event = {
    key: string
    timestamp: string // ISO date for sorting
    tipoMov: string
    quantidade: number
    count: number
    localOrigem?: string
    localDestino?: string
    isColibri: boolean
    isContagem?: boolean
    contagemValor?: number | null
    movId?: string // id da movimentação individual (apenas quando count === 1)
  }
  const groups: Event[] = []
  for (const m of movs) {
    const dia = m.dataMov.slice(0, 10)
    const isColibri = m.tipoMov === 'Saida' && m.observacao?.includes('Colibri')
    const tipoKey = isColibri ? 'Colibri' : m.tipoMov
    // Saída/Colibri: agrupa por dia (vendas individuais poluem). Outros: 1 nó por evento.
    const podeAgrupar = isColibri || m.tipoMov === 'Saida'
    const key = podeAgrupar
      ? `${tipoKey}:${dia}:${m.localOrigem ?? ''}:${m.localDestino ?? ''}`
      : `${tipoKey}:${m.id}`
    const existing = podeAgrupar ? groups.find((g) => g.key === key) : null
    if (existing) {
      existing.quantidade += m.quantidade
      existing.count++
      if (m.dataMov > existing.timestamp) existing.timestamp = m.dataMov
      existing.movId = undefined // ambíguo agora
    } else {
      groups.push({
        key, timestamp: m.dataMov, tipoMov: m.tipoMov, quantidade: m.quantidade, count: 1,
        localOrigem: m.localOrigem, localDestino: m.localDestino, isColibri: !!isColibri,
        movId: podeAgrupar ? undefined : m.id,
      })
    }
  }

  // Adiciona o nó de contagem como um evento na timeline (se houver)
  if (ultimaContagemEm && (!data || ultimaContagemEm.slice(0, 10) === data)) {
    groups.push({
      key: `contagem:${ultimaContagemEm}`,
      timestamp: ultimaContagemEm,
      tipoMov: 'Contagem',
      quantidade: ultimaContagemQuantidade ?? 0,
      count: 1,
      isColibri: false,
      isContagem: true,
      contagemValor: ultimaContagemQuantidade,
    })
  }

  // Ordena cronologicamente (mais antigo → mais recente) e pega os 10 últimos
  groups.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  const ultimos = groups.slice(-10)

  return (
    <View style={s.wrap}>
      <Text style={s.titulo}>Linha do tempo</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {ultimos.map((g, idx) => {
          if (g.isContagem) {
            return (
              <View key={g.key} style={s.nodeWrap}>
                <View style={[s.node, { borderColor: colors.success }]}>
                  <Text style={s.nodeIcon}>🔍</Text>
                  <Text style={[s.nodeQty, { color: colors.success }]}>
                    {g.contagemValor !== null && g.contagemValor !== undefined ? g.contagemValor : '✓'}
                  </Text>
                  <Text style={s.nodeLabel}>Contado</Text>
                  <Text style={s.nodeData}>{fmtData(g.timestamp)}</Text>
                </View>
                <Text style={s.seta}>→</Text>
              </View>
            )
          }
          const cfg = TIPO_CONFIG[g.tipoMov] ?? { icon: '•', cor: colors.textSub, label: g.tipoMov }
          const label = g.isColibri ? 'Colibri' : cfg.label
          const icon = g.isColibri ? '🛒' : cfg.icon
          const cor = g.isColibri ? colors.info : cfg.cor
          const s2 = sinal(g.tipoMov, local, g.localOrigem, g.localDestino)
          const podeApagar = isAdmin && !!g.movId && g.tipoMov !== 'CargaInicial'

          return (
            <View key={g.key} style={s.nodeWrap}>
              <TouchableOpacity
                disabled={!podeApagar || deletando}
                onLongPress={() => podeApagar && pedirDelecao(g.movId!, `${label} ${s2}${g.quantidade}`)}
                activeOpacity={podeApagar ? 0.7 : 1}
              >
                <View style={[s.node, { borderColor: cor }]}>
                  <Text style={s.nodeIcon}>{icon}</Text>
                  <Text style={[s.nodeQty, { color: cor }]}>{s2}{g.quantidade}</Text>
                  <Text style={s.nodeLabel}>{label}{g.count > 1 ? ` (${g.count}x)` : ''}</Text>
                  <Text style={s.nodeData}>{fmtData(g.timestamp)}</Text>
                </View>
              </TouchableOpacity>
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
