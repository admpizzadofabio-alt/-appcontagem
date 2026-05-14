import React, { useState, useMemo } from 'react'
import {
  View, Text, StyleSheet, Alert, TextInput,
  TouchableOpacity, ActivityIndicator, FlatList,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useContagemCegaQuery, useRegistrarItemContagemMutation } from '../../services/api/turnos'
import { useAuth } from '../../contexts/AuthContext'
import { colors } from '../../theme/colors'
import type { AppStackParams } from '../../navigation/types'

type Nav = NativeStackNavigationProp<AppStackParams>
type RouteT = RouteProp<AppStackParams, 'ContagemTurno'>

// Ícones por categoria
const ICONES: Record<string, string> = {
  Cerveja: '🍺', Refrigerante: '🥤', Água: '💧',
  Suco: '🧃', Vinho: '🍷', Destilado: '🥃', Outros: '📦',
}
const BG_CORES: Record<string, string> = {
  Cerveja: '#FFF8E1', Refrigerante: '#E3F2FD', Água: '#E0F7FA',
  Suco: '#FFF3E0', Vinho: '#FCE4EC', Destilado: '#F3E5F5', Outros: '#F5F5F5',
}

export function ContagemTurnoScreen() {
  const navigation = useNavigation<Nav>()
  const route      = useRoute<RouteT>()
  const contagemId      = route.params.contagemId
  const colibriPendente = route.params.colibriPendente ?? false
  const { usuario } = useAuth()

  const { data: contagem, isLoading, refetch } = useContagemCegaQuery(contagemId)
  const [registrar, { isLoading: salvando }]    = useRegistrarItemContagemMutation()

  const [quantidades, setQuantidades] = useState<Record<string, string>>({})
  const [editando,    setEditando]    = useState<string | null>(null)
  const [ordem,       setOrdem]       = useState<string[]>([])

  // O backend já filtra produtos pelo local do turno (setorPadrao = local ou 'Todos')
  const itensOriginais = useMemo(() => contagem?.itens ?? [], [contagem])

  // ── Aplica ordem customizada ──
  const itens = useMemo(() => {
    if (ordem.length === 0) return itensOriginais
    const mapa = new Map(itensOriginais.map((i) => [i.produtoId, i]))
    const ordenados = ordem.map((id) => mapa.get(id)).filter(Boolean) as typeof itensOriginais
    const idsOrdem = new Set(ordem)
    const extras = itensOriginais.filter((i) => !idsOrdem.has(i.produtoId))
    return [...ordenados, ...extras]
  }, [itensOriginais, ordem])

  function moverItem(produtoId: string, direcao: 'up' | 'down') {
    const lista = itens.map((i) => i.produtoId)
    const idx   = lista.indexOf(produtoId)
    if (direcao === 'up' && idx === 0) return
    if (direcao === 'down' && idx === lista.length - 1) return
    const nova = [...lista]
    const troca = direcao === 'up' ? idx - 1 : idx + 1
    ;[nova[idx], nova[troca]] = [nova[troca], nova[idx]]
    setOrdem(nova)
  }

  function ajustar(produtoId: string, delta: number) {
    setQuantidades((prev) => {
      const atual = parseFloat(prev[produtoId] ?? '0')
      const novo  = Math.max(0, atual + delta)
      return { ...prev, [produtoId]: String(novo) }
    })
  }

  async function salvarItem(produtoId: string) {
    const qtd = parseFloat(quantidades[produtoId] ?? '0')
    try {
      await registrar({ contagemId, produtoId, quantidadeContada: qtd }).unwrap()
    } catch (e: any) {
      Alert.alert('Erro', e.message)
    }
  }

  async function handleFinalizar() {
    const naoContados = itens.filter((i) => quantidades[i.produtoId] === undefined && !i.contadoPor)
    if (naoContados.length > 0) {
      const lista = naoContados.map((i) => `• ${i.produto.nomeBebida}`).join('\n')
      Alert.alert(
        'Produtos não contados',
        `${naoContados.length} produto(s) não foram contados:\n\n${lista}\n\nDeseja finalizar mesmo assim? Eles serão salvos como zero.`,
        [
          { text: 'Voltar e contar', style: 'cancel' },
          { text: 'Finalizar mesmo assim', style: 'destructive', onPress: confirmarFinalizacao },
        ]
      )
    } else {
      confirmarFinalizacao()
    }
  }

  function confirmarFinalizacao() {
    Alert.alert(
      'Confirmar finalização',
      'Tem certeza que deseja finalizar a contagem? Esta ação não pode ser desfeita.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Confirmar', onPress: finalizarDeFato },
      ]
    )
  }

  async function finalizarDeFato() {
    try {
      for (const [produtoId, qtdStr] of Object.entries(quantidades)) {
        const qtd = parseFloat(qtdStr)
        if (!isNaN(qtd)) {
          await registrar({ contagemId, produtoId, quantidadeContada: qtd }).unwrap()
        }
      }
      // Salva itens não contados como zero
      const naoContados = itens.filter((i) => quantidades[i.produtoId] === undefined && !i.contadoPor)
      for (const item of naoContados) {
        await registrar({ contagemId, produtoId: item.produtoId, quantidadeContada: 0 }).unwrap()
      }
      await refetch()
      navigation.replace('ResumoContagem', { contagemId })
    } catch (e: any) {
      Alert.alert('Erro', e.message)
    }
  }

  if (isLoading || !contagem) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.loadingBox}>
          <ActivityIndicator color="#4A90D9" size="large" />
          <Text style={s.loadingTxt}>Carregando produtos...</Text>
        </View>
      </SafeAreaView>
    )
  }

  const totalContados = itens.filter((i) => quantidades[i.produtoId] !== undefined || i.contadoPor).length
  const progresso     = itens.length > 0 ? (totalContados / itens.length) * 100 : 0
  const pendentes     = itens.length - totalContados
  const podeFinalizar = pendentes === 0

  function renderItem({ item, index }: { item: typeof itens[0]; index: number }) {
    const jaContou = item.contadoPor
    const qtyStr   = quantidades[item.produtoId] ?? (jaContou ? String(item.quantidadeContada) : undefined)
    const contado  = qtyStr !== undefined
    const qtdNum   = parseFloat(qtyStr ?? '0')
    const emEdicao = editando === item.produtoId
    const icone    = ICONES[item.produto.categoria] ?? '📦'
    const bgCor    = BG_CORES[item.produto.categoria] ?? '#F5F5F5'

    return (
      <View style={[s.row, !contado && s.rowNaoContado]}>
        {/* Reorder + ícone */}
        <View style={s.rowLeft}>
          <TouchableOpacity
            style={s.moveBtn}
            onPress={() => moverItem(item.produtoId, 'up')}
            disabled={index === 0}
            activeOpacity={0.5}
          >
            <Text style={[s.moveTxt, index === 0 && s.moveOff]}>▲</Text>
          </TouchableOpacity>

          <View style={[s.iconBox, { backgroundColor: bgCor }]}>
            <Text style={s.iconTxt}>{icone}</Text>
          </View>

          <TouchableOpacity
            style={s.moveBtn}
            onPress={() => moverItem(item.produtoId, 'down')}
            disabled={index === itens.length - 1}
            activeOpacity={0.5}
          >
            <Text style={[s.moveTxt, index === itens.length - 1 && s.moveOff]}>▼</Text>
          </TouchableOpacity>
        </View>

        {/* Nome e unidade */}
        <View style={s.rowCenter}>
          <Text style={s.prodNome} numberOfLines={2}>{item.produto.nomeBebida}</Text>
          <Text style={s.prodUnit}>{item.produto.unidadeMedida}</Text>
        </View>

        {/* Controles − qty + */}
        <View style={s.rowRight}>
          <TouchableOpacity
            style={s.circleBtn}
            onPress={() => { ajustar(item.produtoId, -1) }}
            activeOpacity={0.7}
          >
            <Text style={s.circleBtnTxt}>−</Text>
          </TouchableOpacity>

          {emEdicao ? (
            <TextInput
              style={s.qtyInput}
              value={qtyStr ?? '0'}
              keyboardType="decimal-pad"
              autoFocus
              onChangeText={(v) => setQuantidades((p) => ({ ...p, [item.produtoId]: v }))}
              onBlur={() => { setEditando(null); salvarItem(item.produtoId) }}
              selectTextOnFocus
            />
          ) : (
            <TouchableOpacity onPress={() => setEditando(item.produtoId)} activeOpacity={0.8}>
              <Text style={[s.qtyTxt, !contado && s.qtyTxtEmpty]}>
                {contado ? qtdNum.toFixed(0) : '0'}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[s.circleBtn, s.circleBtnPlus]}
            onPress={() => { ajustar(item.produtoId, 1) }}
            activeOpacity={0.7}
          >
            <Text style={s.circleBtnPlusTxt}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>

      {/* ── Header ── */}
      <View style={s.header}>
        <View style={s.headerRow}>
          <View>
            <Text style={s.headerTitle}>{contagem.local}</Text>
            <Text style={s.headerSub}>Contagem de estoque</Text>
          </View>
          <View style={s.progressBadge}>
            <Text style={s.progressBadgeTxt}>{totalContados}/{itens.length}</Text>
          </View>
        </View>
        <View style={s.progressBg}>
          <View style={[s.progressFill, { width: `${progresso}%` as any }]} />
        </View>
      </View>

      {/* ── Banner Colibri pendente ── */}
      {colibriPendente && (
        <View style={s.colibriAviso}>
          <Text style={s.colibriAvisoTxt}>
            Vendas do Colibri ainda nao foram carregadas. O Esperado pode estar acima do real. Justifique divergencias como "Colibri fora do ar".
          </Text>
        </View>
      )}

      {/* ── Lista ── */}
      <FlatList
        data={itens}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ItemSeparatorComponent={() => <View style={s.separator} />}
        ListFooterComponent={
          <TouchableOpacity
            style={[s.finalizarBtn, salvando && s.finalizarBtnBloqueado]}
            onPress={handleFinalizar}
            disabled={salvando}
            activeOpacity={0.85}
          >
            <Text style={s.finalizarTxt}>
              {salvando ? 'Processando...' : 'Finalizar Contagem'}
            </Text>
          </TouchableOpacity>
        }
      />
    </SafeAreaView>
  )
}

// ═══════════════════════════════════════════════════════════════
const BLUE = '#4A90D9'

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },

  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingTxt: { color: '#999', fontSize: 14 },

  // Header
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  headerRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#1C1C1E' },
  headerSub:   { fontSize: 12, color: '#999', marginTop: 2 },

  progressBadge: {
    backgroundColor: BLUE,
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20,
  },
  progressBadgeTxt: { color: '#fff', fontSize: 13, fontWeight: '700' },

  progressBg: {
    height: 4, borderRadius: 2,
    backgroundColor: '#F0F0F0',
  },
  progressFill: {
    height: 4, borderRadius: 2,
    backgroundColor: BLUE,
  },

  // Lista
  list: { paddingBottom: 40 },
  separator: { height: 1, backgroundColor: '#F5F5F5', marginLeft: 90 },
  colibriAviso: { backgroundColor: '#FFF3CD', borderLeftWidth: 4, borderLeftColor: '#F59E0B', marginHorizontal: 12, marginBottom: 8, padding: 10, borderRadius: 6 },
  colibriAvisoTxt: { color: '#92400E', fontSize: 13, lineHeight: 18 },

  // Cada linha
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    gap: 12,
  },
  rowNaoContado: {
    backgroundColor: '#FFF3CD',
    borderLeftWidth: 3,
    borderLeftColor: '#FFC107',
  },

  // Lado esquerdo: mover + ícone
  rowLeft: { alignItems: 'center', gap: 2, width: 60 },

  moveBtn: { padding: 2 },
  moveTxt: { fontSize: 10, color: '#CCC', fontWeight: '700' },
  moveOff: { opacity: 0.2 },

  iconBox: {
    width: 50, height: 50, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  iconTxt: { fontSize: 28 },

  // Centro: nome
  rowCenter: { flex: 1, gap: 2 },
  prodNome: { fontSize: 15, fontWeight: '600', color: '#1C1C1E' },
  prodUnit: { fontSize: 12, color: '#999' },

  // Direita: - qty +
  rowRight: {
    flexDirection: 'row', alignItems: 'center',
    gap: 10,
  },

  circleBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#EBF2FA',
    alignItems: 'center', justifyContent: 'center',
  },
  circleBtnTxt: {
    fontSize: 20, fontWeight: '700', color: BLUE,
    lineHeight: 22,
  },
  circleBtnPlus: {
    backgroundColor: BLUE,
  },
  circleBtnPlusTxt: {
    fontSize: 20, fontWeight: '700', color: '#fff',
    lineHeight: 22,
  },

  qtyTxt: {
    fontSize: 20, fontWeight: '700', color: '#1C1C1E',
    minWidth: 36, textAlign: 'center',
  },
  qtyTxtEmpty: { color: '#CCC' },

  qtyInput: {
    fontSize: 20, fontWeight: '700', color: BLUE,
    minWidth: 50, textAlign: 'center',
    borderBottomWidth: 2, borderBottomColor: BLUE,
    paddingVertical: 2,
  },

  // Botão finalizar
  finalizarBtn: {
    backgroundColor: BLUE,
    margin: 16, marginTop: 24,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: BLUE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  finalizarTxt: {
    color: '#fff', fontSize: 16, fontWeight: '700',
    letterSpacing: 0.3,
  },
  finalizarBtnBloqueado: {
    backgroundColor: '#B0BEC5',
    shadowOpacity: 0,
    elevation: 0,
  },
})
