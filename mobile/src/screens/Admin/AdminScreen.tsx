import React, { useState, useMemo } from 'react'
import {
  Alert, Modal, Pressable, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View, Image,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import {
  useListarMovimentacoesQuery,
  useListarPendentesQuery,
  useAprovarMovimentacaoMutation,
  useRejeitarMovimentacaoMutation,
  useCriarMovimentacaoMutation,
  type Movimentacao,
} from '../../services/api/movimentacoes'
import {
  useRascunhosPendentesQuery,
  useDecidirRascunhoMutation,
  useDashboardAdminQuery,
  type RascunhoEntrada,
} from '../../services/api/turnos'
import { useListarCorrecoesQuery } from '../../services/api/correcoes'
import { Card } from '../../components/Card'
import { ActionButton } from '../../components/ActionButton'
import { EmptyState } from '../../components/EmptyState'
import { SectionHeader } from '../../components/SectionHeader'
import { colors } from '../../theme/colors'

type Tab = 'perdas' | 'rascunhos' | 'correcoes' | 'movimentos' | 'metricas'

export function AdminScreen() {
  const [tab, setTab] = useState<Tab>('rascunhos')

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      {/* Tab bar */}
      <View style={s.tabBar}>
        {([
          { key: 'rascunhos', label: 'Rascunhos' },
          { key: 'perdas', label: 'Aprovações' },
          { key: 'correcoes', label: 'Comandas' },
          { key: 'movimentos', label: 'Movimentos' },
          { key: 'metricas', label: 'Métricas' },
        ] as { key: Tab; label: string }[]).map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[s.tabBtn, tab === t.key && s.tabBtnAtivo]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[s.tabTxt, tab === t.key && s.tabTxtAtivo]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'perdas' && <AbaPerdasContent />}
      {tab === 'rascunhos' && <AbaRascunhosContent />}
      {tab === 'correcoes' && <AbaCorrecoesContent />}
      {tab === 'movimentos' && <AbaMovimentosContent />}
      {tab === 'metricas' && <AbaMetricasContent />}
    </SafeAreaView>
  )
}

// ─── Aba Perdas ─────────────────────────────────────────────────────────────

function AbaPerdasContent() {
  const { data: pendentes = [], isLoading } = useListarPendentesQuery()
  const [aprovar] = useAprovarMovimentacaoMutation()
  const [rejeitar] = useRejeitarMovimentacaoMutation()
  const [modalId, setModalId] = useState<string | null>(null)
  const [motivo, setMotivo] = useState('')

  async function handleAprovar(id: string) {
    try {
      await aprovar({ id }).unwrap()
      Alert.alert('Aprovado', 'Movimentação aprovada e estoque atualizado.')
    } catch (e: any) { Alert.alert('Erro', e.message) }
  }

  async function confirmarRejeitar() {
    if (!modalId || !motivo.trim()) { Alert.alert('Atenção', 'Informe o motivo.'); return }
    try {
      await rejeitar({ id: modalId, motivo: motivo.trim() }).unwrap()
      setModalId(null)
    } catch (e: any) { Alert.alert('Erro', e.message) }
  }

  return (
    <>
      <ScrollView style={s.scroll} contentContainerStyle={s.content}>
        <SectionHeader title={`Aprovações Pendentes (${pendentes.length})`} />
        {isLoading && <EmptyState icon="⏳" title="Carregando..." />}
        {!isLoading && pendentes.length === 0 && (
          <EmptyState icon="✅" title="Nenhuma aprovação pendente" subtitle="Entradas e perdas em dia" />
        )}
        {pendentes.map((p) => {
          const isEntrada = p.movimentacao.tipoMov === 'Entrada'
          const justificativa = p.movimentacao.observacao ?? p.movimentacao.motivoAjuste
          return (
            <Card key={p.id} style={isEntrada ? s.cardEntrada : s.cardWarning}>
              <View style={s.cardHeader}>
                <View style={isEntrada ? s.dotEntrada : s.dotWarning} />
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>{p.movimentacao.produto.nomeBebida}</Text>
                  <Text style={s.cardSub}>
                    {isEntrada ? 'Entrada de' : 'Perda de'} {p.movimentacao.quantidade} {p.movimentacao.produto.unidadeMedida}
                  </Text>
                </View>
                <View style={[s.tipoBadge, { backgroundColor: isEntrada ? colors.successLight : colors.warningLight }]}>
                  <Text style={[s.tipoBadgeTxt, { color: isEntrada ? colors.success : colors.warning }]}>
                    {isEntrada ? '📥 Entrada' : '🗑️ Perda'}
                  </Text>
                </View>
              </View>
              <Text style={s.metaTxt}>Por: {p.solicitante.nome} ({p.solicitante.setor})</Text>
              <Text style={s.metaTxt}>Em: {new Date(p.criadoEm).toLocaleString('pt-BR')}</Text>
              {justificativa && (
                <View style={s.justificativaBox}>
                  <Text style={s.justificativaLabel}>💬 Justificativa do operador:</Text>
                  <Text style={s.justificativaTxt}>{justificativa}</Text>
                </View>
              )}
              {isEntrada && (
                <View style={s.infoCard}>
                  <Text style={s.infoTxt}>📋 Compare com as notas fiscais recebidas no dia antes de aprovar.</Text>
                </View>
              )}
              <View style={s.acoes}>
                <ActionButton label="Rejeitar" onPress={() => { setMotivo(''); setModalId(p.id) }} variant="danger" style={{ flex: 1 }} />
                <ActionButton label="Aprovar" onPress={() => handleAprovar(p.id)} style={{ flex: 1 }} />
              </View>
            </Card>
          )
        })}
      </ScrollView>

      <Modal visible={modalId !== null} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>Rejeitar movimentação</Text>
            <Text style={s.modalSub}>Informe o motivo ao solicitante.</Text>
            <TextInput style={s.input} value={motivo} onChangeText={setMotivo} placeholder="Motivo da rejeição..." placeholderTextColor={colors.textMuted} multiline numberOfLines={3} autoFocus />
            <View style={s.modalAcoes}>
              <Pressable style={s.btnCancelar} onPress={() => setModalId(null)}><Text style={s.btnCancelarTxt}>Cancelar</Text></Pressable>
              <Pressable style={s.btnConfirmar} onPress={confirmarRejeitar}><Text style={s.btnConfirmarTxt}>Rejeitar</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  )
}

// ─── Aba Rascunhos ───────────────────────────────────────────────────────────

function AbaRascunhosContent() {
  const { data: rascunhos = [], isLoading } = useRascunhosPendentesQuery()
  const [decidir] = useDecidirRascunhoMutation()
  const [modal, setModal] = useState<RascunhoEntrada | null>(null)
  const [motivo, setMotivo] = useState('')
  const [acao, setAcao] = useState<'aprovar' | 'rejeitar'>('aprovar')

  function abrirModal(r: RascunhoEntrada, a: 'aprovar' | 'rejeitar') {
    setModal(r)
    setAcao(a)
    setMotivo('')
  }

  async function confirmar() {
    if (!modal) return
    if (acao === 'rejeitar' && !motivo.trim()) {
      Alert.alert('Atenção', 'Informe o motivo da rejeição.')
      return
    }
    try {
      await decidir({ id: modal.id, acao, motivoDecisao: motivo.trim() || undefined }).unwrap()
      setModal(null)
      Alert.alert(
        acao === 'aprovar' ? '✅ Aprovado' : '❌ Rejeitado',
        acao === 'aprovar'
          ? `Entrada de ${modal.quantidade} ${modal.produto.unidadeMedida} registrada no estoque.`
          : 'Rascunho rejeitado.',
      )
    } catch (e: any) { Alert.alert('Erro', e.message) }
  }

  return (
    <>
      <ScrollView style={s.scroll} contentContainerStyle={s.content}>
        <SectionHeader title={`Rascunhos de Entrada (${rascunhos.length})`} />
        <Card style={s.infoCard}>
          <Text style={s.infoTxt}>
            Rascunhos são sobras detectadas na contagem. Aprove se a entrada é legítima, rejeite se suspeito.
          </Text>
        </Card>

        {isLoading && <EmptyState icon="⏳" title="Carregando..." />}
        {!isLoading && rascunhos.length === 0 && (
          <EmptyState icon="✅" title="Nenhum rascunho pendente" subtitle="Sem sobras não explicadas" />
        )}

        {rascunhos.map((r) => (
          <Card key={r.id} style={s.cardDanger}>
            <View style={s.cardHeader}>
              <View style={s.dotDanger} />
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>{r.produto.nomeBebida}</Text>
                <Text style={s.cardSub}>
                  Sobra de +{r.quantidade} {r.produto.unidadeMedida}
                  {' · '}R$ {(r.quantidade * r.produto.custoUnitario).toFixed(2)}
                </Text>
              </View>
            </View>
            <Text style={s.metaTxt}>Operador: {r.operador.nome} · {r.local}</Text>
            <Text style={s.metaTxt}>Em: {new Date(r.criadoEm).toLocaleString('pt-BR')}</Text>
            <View style={s.motivoBox}>
              <Text style={s.motivoLabel}>Origem informada:</Text>
              <Text style={s.motivoTxt}>{r.origemTexto}</Text>
            </View>
            {r.fotoEvidencia && (
              <Image source={{ uri: r.fotoEvidencia }} style={s.fotoThumb} resizeMode="cover" />
            )}
            <View style={s.acoes}>
              <ActionButton label="Rejeitar" onPress={() => abrirModal(r, 'rejeitar')} variant="danger" style={{ flex: 1 }} />
              <ActionButton label="Aprovar" onPress={() => abrirModal(r, 'aprovar')} style={{ flex: 1 }} />
            </View>
          </Card>
        ))}
      </ScrollView>

      <Modal visible={modal !== null} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>
              {acao === 'aprovar' ? '✅ Aprovar rascunho' : '❌ Rejeitar rascunho'}
            </Text>
            <Text style={s.modalSub}>
              {modal?.produto.nomeBebida} · +{modal?.quantidade} {modal?.produto.unidadeMedida}
            </Text>
            {acao === 'rejeitar' && (
              <TextInput
                style={s.input}
                value={motivo}
                onChangeText={setMotivo}
                placeholder="Motivo da rejeição (ex: produto não identificado)..."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={3}
                autoFocus
              />
            )}
            {acao === 'aprovar' && (
              <View style={s.aprovBox}>
                <Text style={s.aprovTxt}>
                  Isso criará uma Entrada de +{modal?.quantidade} {modal?.produto.unidadeMedida} no estoque {modal?.local}.
                </Text>
              </View>
            )}
            <View style={s.modalAcoes}>
              <Pressable style={s.btnCancelar} onPress={() => setModal(null)}><Text style={s.btnCancelarTxt}>Cancelar</Text></Pressable>
              <Pressable
                style={[s.btnConfirmar, acao === 'aprovar' && { backgroundColor: colors.success }]}
                onPress={confirmar}
              >
                <Text style={s.btnConfirmarTxt}>{acao === 'aprovar' ? 'Aprovar' : 'Rejeitar'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  )
}

// ─── Aba Correções ───────────────────────────────────────────────────────────

function AbaCorrecoesContent() {
  const { data: correcoes = [], isLoading } = useListarCorrecoesQuery({})

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content}>
      <SectionHeader title={`Correções de Comanda (${correcoes.length})`} />
      <Card style={s.infoCard}>
        <Text style={s.infoTxt}>
          Registros de produto servido diferente da comanda. Cada um exige foto da comanda como comprovante.
        </Text>
      </Card>

      {isLoading && <EmptyState icon="⏳" title="Carregando..." />}
      {!isLoading && correcoes.length === 0 && (
        <EmptyState icon="📋" title="Nenhuma correção registrada" subtitle="Últimos 14 dias sem erros de comanda" />
      )}

      {correcoes.map((c) => (
        <Card key={c.id} style={s.cardNeutro}>
          <View style={s.cardHeader}>
            <Text style={s.erroIcon}>📋</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>
                <Text style={{ color: colors.danger }}>{c.produtoComandado.nomeBebida}</Text>
                {' → '}
                <Text style={{ color: colors.success }}>{c.produtoServido.nomeBebida}</Text>
              </Text>
              <Text style={s.cardSub}>Qtd: {c.quantidade} · {c.local} · {c.operador.nome}</Text>
            </View>
          </View>
          <Text style={s.metaTxt}>{new Date(c.criadoEm).toLocaleString('pt-BR')}</Text>
          {c.observacao && (
            <View style={s.motivoBox}>
              <Text style={s.motivoLabel}>Obs:</Text>
              <Text style={s.motivoTxt}>{c.observacao}</Text>
            </View>
          )}
          {c.fotoComanda && (
            <Image source={{ uri: c.fotoComanda }} style={s.fotoThumb} resizeMode="cover" />
          )}
        </Card>
      ))}
    </ScrollView>
  )
}

// ─── Aba Movimentos ──────────────────────────────────────────────────────────

const TIPO_LABEL: Record<string, string> = {
  Entrada: 'Entrada',
  Saida: 'Saída',
  AjustePerda: 'Perda',
  Transferencia: 'Transferência',
  AjusteContagem: 'Aj. Contagem',
  CargaInicial: 'Carga Inicial',
}

const TIPO_ICONE: Record<string, string> = {
  Entrada: '📥',
  Saida: '📤',
  AjustePerda: '🗑️',
  Transferencia: '↔️',
  AjusteContagem: '📋',
  CargaInicial: '📦',
}

const TIPO_COLOR: Record<string, string> = {
  Entrada: colors.success,
  Saida: colors.warning,
  AjustePerda: colors.danger,
  Transferencia: colors.info,
  AjusteContagem: colors.primary,
  CargaInicial: colors.success,
}

type PeriodoFiltro = 'hoje' | 'semana' | 'mes' | 'todos'
type VistaFiltro = 'produto' | 'cronologico'
type TipoFiltro = 'todos' | 'Entrada' | 'AjustePerda' | 'Transferencia' | 'Saida' | 'CargaInicial'

type GrupoProduto = {
  produtoId: string
  nomeBebida: string
  unidadeMedida: string
  perdaThreshold: number
  movimentos: Movimentacao[]
  totalEntrada: number
  totalPerda: number
  totalSaida: number
  totalTransf: number
  temGrandePerda: boolean
}

function AbaMovimentosContent() {
  const [localFiltro, setLocalFiltro] = useState<'Bar' | 'Delivery' | undefined>(undefined)
  const [tipoFiltro, setTipoFiltro] = useState<TipoFiltro>('todos')
  const [periodo, setPeriodo] = useState<PeriodoFiltro>('todos')
  const [vista, setVista] = useState<VistaFiltro>('produto')
  const [busca, setBusca] = useState('')
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())
  const [detalheModal, setDetalheModal] = useState<Movimentacao | null>(null)
  const [corrModal, setCorrModal] = useState<Movimentacao | null>(null)
  const [qtdCorreta, setQtdCorreta] = useState('')
  const [fotoNota, setFotoNota] = useState<string | null>(null)
  const [corrigindo, setCorrigindo] = useState(false)

  const { data: movimentos = [], isLoading, refetch } = useListarMovimentacoesQuery(
    localFiltro ? { local: localFiltro } : undefined,
  )
  const [criar] = useCriarMovimentacaoMutation()

  const hoje = new Date()

  const movimentosFiltrados = useMemo(() => {
    return movimentos.filter((m) => {
      const data = new Date(m.dataMov)
      if (periodo === 'hoje' && data.toDateString() !== hoje.toDateString()) return false
      if (periodo === 'semana') {
        const limite = new Date(hoje); limite.setDate(hoje.getDate() - 7)
        if (data < limite) return false
      }
      if (periodo === 'mes') {
        const limite = new Date(hoje); limite.setDate(hoje.getDate() - 30)
        if (data < limite) return false
      }
      if (tipoFiltro !== 'todos' && m.tipoMov !== tipoFiltro) return false
      if (busca && !m.produto.nomeBebida.toLowerCase().includes(busca.toLowerCase())) return false
      return true
    })
  }, [movimentos, periodo, tipoFiltro, busca])

  const hojeTotal = useMemo(() => movimentos.filter((m) => new Date(m.dataMov).toDateString() === hoje.toDateString()).length, [movimentos])
  const alertasGrandes = useMemo(() => movimentosFiltrados.filter((m) => m.tipoMov === 'AjustePerda' && m.quantidade > m.produto.perdaThreshold), [movimentosFiltrados])

  const grupos = useMemo<GrupoProduto[]>(() => {
    const map = new Map<string, GrupoProduto>()
    for (const m of movimentosFiltrados) {
      if (!map.has(m.produtoId)) {
        map.set(m.produtoId, {
          produtoId: m.produtoId,
          nomeBebida: m.produto.nomeBebida,
          unidadeMedida: m.produto.unidadeMedida,
          perdaThreshold: m.produto.perdaThreshold,
          movimentos: [],
          totalEntrada: 0, totalPerda: 0, totalSaida: 0, totalTransf: 0,
          temGrandePerda: false,
        })
      }
      const g = map.get(m.produtoId)!
      g.movimentos.push(m)
      if (['Entrada', 'CargaInicial'].includes(m.tipoMov)) g.totalEntrada += m.quantidade
      else if (m.tipoMov === 'Saida') g.totalSaida += m.quantidade
      else if (m.tipoMov === 'AjustePerda') { g.totalPerda += m.quantidade; if (m.quantidade > m.produto.perdaThreshold) g.temGrandePerda = true }
      else if (m.tipoMov === 'Transferencia') g.totalTransf += m.quantidade
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.temGrandePerda && !b.temGrandePerda) return -1
      if (!a.temGrandePerda && b.temGrandePerda) return 1
      return a.nomeBebida.localeCompare(b.nomeBebida)
    })
  }, [movimentosFiltrados])

  function toggleExpandido(id: string) {
    setExpandidos((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function tirarFotoNota() {
    const perm = await ImagePicker.requestCameraPermissionsAsync()
    if (!perm.granted) { Alert.alert('Permissão negada', 'Permita o uso da câmera nas configurações'); return }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.6, base64: true })
    if (!result.canceled && result.assets[0]?.base64) setFotoNota(`data:image/jpeg;base64,${result.assets[0].base64}`)
  }

  async function aplicarCorrecao() {
    if (!corrModal) return
    const correta = parseFloat(qtdCorreta.replace(',', '.'))
    if (!correta || correta < 0) { Alert.alert('Atenção', 'Informe a quantidade correta.'); return }
    if (!fotoNota) { Alert.alert('Atenção', 'Foto da nota é obrigatória para correção.'); return }
    const diff = correta - corrModal.quantidade
    if (diff === 0) { Alert.alert('Sem diferença', 'Quantidade igual à original.'); return }
    setCorrigindo(true)
    try {
      await criar({
        produtoId: corrModal.produtoId,
        tipoMov: diff > 0 ? 'Entrada' : 'Saida',
        quantidade: Math.abs(diff),
        localOrigem: corrModal.localOrigem ?? corrModal.localDestino ?? 'Bar',
        imagemComprovante: fotoNota,
        observacao: `Correção de entrada - nota fiscal. Registrado: ${corrModal.quantidade}, correto: ${correta} ${corrModal.produto.unidadeMedida}`,
      }).unwrap()
      Alert.alert('Correção aplicada', `Estoque ajustado em ${diff > 0 ? '+' : ''}${diff} ${corrModal.produto.unidadeMedida}.`)
      setCorrModal(null)
      refetch()
    } catch (e: any) { Alert.alert('Erro', e.message) }
    finally { setCorrigindo(false) }
  }

  function renderMovimentoLinha(m: Movimentacao) {
    const cor = TIPO_COLOR[m.tipoMov] ?? colors.textSub
    const sinal = ['Entrada', 'CargaInicial'].includes(m.tipoMov) ? '+' : m.tipoMov === 'Transferencia' ? '↔' : '-'
    const isGrande = m.tipoMov === 'AjustePerda' && m.quantidade > m.produto.perdaThreshold
    return (
      <TouchableOpacity key={m.id} style={[s.movLinha, isGrande && s.movLinhaAlerta]} onPress={() => setDetalheModal(m)} activeOpacity={0.75}>
        <Text style={[s.movLinhaIcone, { color: cor }]}>{TIPO_ICONE[m.tipoMov] ?? '•'}</Text>
        <View style={{ flex: 1 }}>
          <Text style={s.movLinhaNome} numberOfLines={1}>{m.produto.nomeBebida}</Text>
          <Text style={s.movLinhaSub}>{m.usuario.nome} · {new Date(m.dataMov).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</Text>
        </View>
        <Text style={[s.movLinhaQtd, { color: isGrande ? colors.danger : cor }]}>{sinal}{m.quantidade} {m.produto.unidadeMedida}</Text>
        {isGrande && <Text style={s.movLinhaAlertaIcon}>🔴</Text>}
      </TouchableOpacity>
    )
  }

  function renderGrupo(g: GrupoProduto) {
    const expandido = expandidos.has(g.produtoId)
    const cardStyle = g.temGrandePerda ? s.grupoCardAlerta : s.grupoCard
    return (
      <Card key={g.produtoId} style={cardStyle}>
        <TouchableOpacity onPress={() => toggleExpandido(g.produtoId)} activeOpacity={0.8}>
          <View style={s.grupoHeader}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {g.temGrandePerda && <Text>🔴</Text>}
                <Text style={s.grupoNome} numberOfLines={1}>{g.nomeBebida}</Text>
              </View>
              <Text style={s.grupoSub}>{g.movimentos.length} mov · {g.unidadeMedida}</Text>
            </View>
            <Text style={s.grupoSeta}>{expandido ? '▲' : '▼'}</Text>
          </View>
          <View style={s.grupoIndicadores}>
            {g.totalEntrada > 0 && (
              <View style={[s.grupoIndicador, { backgroundColor: colors.successLight }]}>
                <Text style={[s.grupoIndicadorTxt, { color: colors.success }]}>↑ {g.totalEntrada}</Text>
              </View>
            )}
            {g.totalPerda > 0 && (
              <View style={[s.grupoIndicador, { backgroundColor: colors.dangerLight }]}>
                <Text style={[s.grupoIndicadorTxt, { color: colors.danger }]}>↓ {g.totalPerda}</Text>
              </View>
            )}
            {g.totalSaida > 0 && (
              <View style={[s.grupoIndicador, { backgroundColor: colors.warningLight }]}>
                <Text style={[s.grupoIndicadorTxt, { color: colors.warning }]}>↓ {g.totalSaida}</Text>
              </View>
            )}
            {g.totalTransf > 0 && (
              <View style={[s.grupoIndicador, { backgroundColor: colors.infoLight }]}>
                <Text style={[s.grupoIndicadorTxt, { color: colors.info }]}>↔ {g.totalTransf}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>

        {expandido && (
          <View style={s.grupoDetalhe}>
            {g.movimentos.map((m) => {
              const cor = TIPO_COLOR[m.tipoMov] ?? colors.textSub
              const isGrande = m.tipoMov === 'AjustePerda' && m.quantidade > m.produto.perdaThreshold
              const local = m.tipoMov === 'Transferencia'
                ? `${m.localOrigem} → ${m.localDestino}`
                : (m.localOrigem ?? m.localDestino ?? '—')
              return (
                <View key={m.id} style={[s.grupoItemLinha, isGrande && { backgroundColor: colors.dangerLight }]}>
                  <View style={[s.tipoBadge, { backgroundColor: cor + '22' }]}>
                    <Text style={[s.tipoBadgeTxt, { color: cor }]}>{TIPO_LABEL[m.tipoMov]}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.grupoItemQtd}>{m.quantidade} {m.produto.unidadeMedida} · {local}</Text>
                    <Text style={s.grupoItemMeta}>{m.usuario.nome} · {new Date(m.dataMov).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</Text>
                    {m.observacao ? <Text style={s.grupoItemMeta}>Obs: {m.observacao}</Text> : null}
                  </View>
                  {isGrande && <Text>🔴</Text>}
                  {m.tipoMov === 'Entrada' && (
                    <TouchableOpacity style={s.corrigirBtn} onPress={() => { setQtdCorreta(String(m.quantidade)); setFotoNota(null); setCorrModal(m) }}>
                      <Text style={s.corrigirBtnTxt}>✏️</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )
            })}
          </View>
        )}
      </Card>
    )
  }

  return (
    <>
      <ScrollView style={s.scroll} contentContainerStyle={s.content}>

        {/* KPI Summary */}
        <View style={s.movSummary}>
          <View style={s.movSummaryItem}>
            <Text style={s.movSummaryNum}>{hojeTotal}</Text>
            <Text style={s.movSummaryLabel}>Hoje</Text>
          </View>
          <View style={[s.movSummaryItem, alertasGrandes.length > 0 && { backgroundColor: colors.dangerLight }]}>
            <Text style={[s.movSummaryNum, alertasGrandes.length > 0 && { color: colors.danger }]}>{alertasGrandes.length}</Text>
            <Text style={s.movSummaryLabel}>Alertas</Text>
          </View>
          <View style={s.movSummaryItem}>
            <Text style={s.movSummaryNum}>{grupos.length}</Text>
            <Text style={s.movSummaryLabel}>Produtos</Text>
          </View>
          <View style={s.movSummaryItem}>
            <Text style={s.movSummaryNum}>{movimentosFiltrados.length}</Text>
            <Text style={s.movSummaryLabel}>Total</Text>
          </View>
        </View>

        {/* Busca */}
        <TextInput
          style={s.movBusca}
          placeholder="🔍  Buscar produto..."
          placeholderTextColor={colors.textMuted}
          value={busca}
          onChangeText={setBusca}
        />

        {/* Período */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipsRow}>
          {([['hoje', 'Hoje'], ['semana', '7 dias'], ['mes', '30 dias'], ['todos', 'Todos']] as [PeriodoFiltro, string][]).map(([v, l]) => (
            <TouchableOpacity key={v} style={[s.chip, periodo === v && s.chipAtivo]} onPress={() => setPeriodo(v)}>
              <Text style={[s.chipTxt, periodo === v && s.chipTxtAtivo]}>{l}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Tipo */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipsRow}>
          {([['todos', 'Tudo'], ['Entrada', '📥 Entrada'], ['AjustePerda', '🗑️ Perda'], ['Transferencia', '↔️ Transf.'], ['Saida', '📤 Saída'], ['CargaInicial', '📦 Carga']] as [TipoFiltro, string][]).map(([v, l]) => (
            <TouchableOpacity key={v} style={[s.chip, tipoFiltro === v && s.chipAtivo]} onPress={() => setTipoFiltro(v)}>
              <Text style={[s.chipTxt, tipoFiltro === v && s.chipTxtAtivo]}>{l}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Local + Vista */}
        <View style={s.movControles}>
          <View style={[s.localRow, { flex: 1 }]}>
            {([undefined, 'Bar', 'Delivery'] as const).map((l) => (
              <TouchableOpacity key={l ?? 'todos'} style={[s.localBtn, localFiltro === l && s.localBtnAtivo]} onPress={() => setLocalFiltro(l)}>
                <Text style={[s.localBtnTxt, localFiltro === l && s.localBtnTxtAtivo]}>{l ?? 'Todos'}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={s.vistaToggle}>
            <TouchableOpacity style={[s.vistaBtn, vista === 'produto' && s.vistaBtnAtivo]} onPress={() => setVista('produto')}>
              <Text style={[s.vistaBtnTxt, vista === 'produto' && s.vistaBtnTxtAtivo]}>📦</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.vistaBtn, vista === 'cronologico' && s.vistaBtnAtivo]} onPress={() => setVista('cronologico')}>
              <Text style={[s.vistaBtnTxt, vista === 'cronologico' && s.vistaBtnTxtAtivo]}>📋</Text>
            </TouchableOpacity>
          </View>
        </View>

        {isLoading && <EmptyState icon="⏳" title="Carregando..." />}
        {!isLoading && movimentosFiltrados.length === 0 && (
          <EmptyState icon="📋" title="Nenhuma movimentação encontrada" subtitle="Tente mudar os filtros" />
        )}

        {/* Alertas */}
        {alertasGrandes.length > 0 && (
          <View style={s.alertaSection}>
            <Text style={s.alertaSectionTxt}>🔴 {alertasGrandes.length} perda{alertasGrandes.length !== 1 ? 's' : ''} grande{alertasGrandes.length !== 1 ? 's' : ''} — requer atenção</Text>
          </View>
        )}

        {/* Conteúdo */}
        {vista === 'produto'
          ? grupos.map(renderGrupo)
          : movimentosFiltrados.map(renderMovimentoLinha)
        }
      </ScrollView>

      {/* Modal detalhe (cronológico) */}
      <Modal visible={detalheModal !== null} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={s.modal}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 24 }}>{TIPO_ICONE[detalheModal?.tipoMov ?? ''] ?? '📋'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.modalTitle}>{detalheModal?.produto.nomeBebida}</Text>
                <Text style={s.modalSub}>{TIPO_LABEL[detalheModal?.tipoMov ?? ''] ?? detalheModal?.tipoMov}</Text>
              </View>
            </View>
            <View style={s.aprovBox}>
              <Text style={s.aprovTxt}>
                {detalheModal?.quantidade} {detalheModal?.produto.unidadeMedida}
                {detalheModal?.tipoMov === 'Transferencia' ? ` · ${detalheModal.localOrigem} → ${detalheModal.localDestino}` : ` · ${detalheModal?.localOrigem ?? detalheModal?.localDestino ?? '—'}`}
              </Text>
            </View>
            <Text style={s.metaTxt}>Por: {detalheModal?.usuario.nome}</Text>
            <Text style={s.metaTxt}>{detalheModal && new Date(detalheModal.dataMov).toLocaleString('pt-BR')}</Text>
            {detalheModal?.observacao && <Text style={s.metaTxt}>Obs: {detalheModal.observacao}</Text>}
            {detalheModal?.tipoMov === 'Entrada' && (
              <TouchableOpacity style={[s.corrigirBtn, { alignSelf: 'stretch', alignItems: 'center', marginTop: 4 }]} onPress={() => { setQtdCorreta(String(detalheModal.quantidade)); setFotoNota(null); setCorrModal(detalheModal); setDetalheModal(null) }}>
                <Text style={s.corrigirBtnTxt}>✏️ Corrigir quantidade</Text>
              </TouchableOpacity>
            )}
            <Pressable style={[s.btnCancelar, { marginTop: 8 }]} onPress={() => setDetalheModal(null)}>
              <Text style={s.btnCancelarTxt}>Fechar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Modal correção */}
      <Modal visible={corrModal !== null} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>Corrigir Entrada</Text>
            <Text style={s.modalSub}>{corrModal?.produto.nomeBebida}</Text>
            <View style={s.aprovBox}>
              <Text style={s.aprovTxt}>Registrado: {corrModal?.quantidade} {corrModal?.produto.unidadeMedida}</Text>
            </View>
            <Text style={[s.motivoLabel, { marginTop: 4 }]}>Quantidade correta (nota fiscal):</Text>
            <TextInput style={[s.input, { minHeight: 48, textAlignVertical: 'center' }]} value={qtdCorreta} onChangeText={setQtdCorreta} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.textMuted} />
            <Text style={[s.motivoLabel, { marginTop: 4 }]}>Foto da nota (obrigatório):</Text>
            <TouchableOpacity style={s.fotoBtn} onPress={tirarFotoNota}>
              {fotoNota ? <Image source={{ uri: fotoNota }} style={s.fotoThumb} resizeMode="cover" /> : <Text style={s.fotoBtnTxt}>📷 Tirar foto da nota</Text>}
            </TouchableOpacity>
            <View style={s.modalAcoes}>
              <Pressable style={s.btnCancelar} onPress={() => setCorrModal(null)}><Text style={s.btnCancelarTxt}>Cancelar</Text></Pressable>
              <Pressable style={[s.btnConfirmar, { backgroundColor: colors.primary }]} onPress={aplicarCorrecao} disabled={corrigindo}>
                <Text style={s.btnConfirmarTxt}>{corrigindo ? 'Aplicando...' : 'Aplicar'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  )
}

// ─── Aba Métricas ────────────────────────────────────────────────────────────

function AbaMetricasContent() {
  const { data: dash, isLoading } = useDashboardAdminQuery()

  if (isLoading || !dash) return <EmptyState icon="⏳" title="Carregando..." />

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content}>
      {/* KPIs rápidos */}
      <View style={s.kpiRow}>
        <View style={[s.kpi, { backgroundColor: dash.rascunhosPendentes > 0 ? colors.dangerLight : colors.successLight }]}>
          <Text style={[s.kpiNum, { color: dash.rascunhosPendentes > 0 ? colors.danger : colors.success }]}>
            {dash.rascunhosPendentes}
          </Text>
          <Text style={s.kpiLabel}>Rascunhos pendentes</Text>
        </View>
        <View style={[s.kpi, { backgroundColor: colors.infoLight }]}>
          <Text style={[s.kpiNum, { color: colors.info }]}>{dash.correcoesRecentes}</Text>
          <Text style={s.kpiLabel}>Correções (14 dias)</Text>
        </View>
      </View>

      {/* Turnos por operador */}
      {dash.operadores.length > 0 && (
        <>
          <SectionHeader title="Operadores (14 dias)" />
          {dash.operadores.map((op) => (
            <Card key={op.id} style={s.opCard}>
              <View style={s.opRow}>
                <View style={s.opAvatar}>
                  <Text style={s.opAvatarTxt}>{op.nome.charAt(0)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.opNome}>{op.nome}</Text>
                  <Text style={s.opSub}>{op.turnos} turno{op.turnos !== 1 ? 's' : ''}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[s.opGap, op.divergenciasGrandes > 0 && { color: colors.danger }]}>
                    {op.divergenciasGrandes} grande{op.divergenciasGrandes !== 1 ? 's' : ''}
                  </Text>
                  {op.valorGap > 0 && (
                    <Text style={s.opValor}>Gap R$ {op.valorGap.toFixed(2)}</Text>
                  )}
                </View>
              </View>
            </Card>
          ))}
        </>
      )}

      {/* Histórico de turnos */}
      <SectionHeader title="Histórico de Turnos" />
      {dash.turnos.length === 0 && (
        <EmptyState icon="📋" title="Nenhum turno nos últimos 14 dias" />
      )}
      {dash.turnos.map((t) => (
        <Card key={t.id} style={[s.turnoCard, t.fechadoSemContagem && s.turnoSemContagem] as any}>
          <View style={s.turnoRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.turnoLocal}>{t.local} · {t.diaOperacional}</Text>
              <Text style={s.turnoHora}>
                {new Date(t.abertoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                {t.fechadoEm && ` – ${new Date(t.fechadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 2 }}>
              {t.status === 'Aberto' ? (
                <View style={s.badge}><Text style={s.badgeTxt}>● Aberto</Text></View>
              ) : t.fechadoSemContagem ? (
                <View style={[s.badge, s.badgeDanger]}><Text style={[s.badgeTxt, { color: colors.danger }]}>Sem contagem</Text></View>
              ) : (
                <View style={[s.badge, s.badgeOk]}><Text style={[s.badgeTxt, { color: colors.success }]}>Fechado</Text></View>
              )}
              {t.divergenciasGrandes > 0 && (
                <Text style={s.turnoDivGrande}>🔴 {t.divergenciasGrandes} grandes</Text>
              )}
              {t.valorDivergencias > 0 && (
                <Text style={s.turnoValor}>R$ {t.valorDivergencias.toFixed(2)}</Text>
              )}
            </View>
          </View>
        </Card>
      ))}
    </ScrollView>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 10, paddingBottom: 32 },

  tabBar: { flexDirection: 'row', backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnAtivo: { borderBottomColor: colors.primary },
  tabTxt: { fontSize: 12, fontWeight: '600', color: colors.textSub },
  tabTxtAtivo: { color: colors.primary, fontWeight: '700' },

  cardEntrada: { gap: 8, borderLeftWidth: 4, borderLeftColor: colors.success },
  cardWarning: { gap: 8, borderLeftWidth: 4, borderLeftColor: colors.warning },
  cardDanger: { gap: 8, borderLeftWidth: 4, borderLeftColor: colors.danger },
  cardNeutro: { gap: 8 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dotEntrada: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.success },
  dotWarning: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.warning },
  dotDanger: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.danger },
  erroIcon: { fontSize: 20 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  cardSub: { fontSize: 12, color: colors.textSub, marginTop: 2 },
  metaTxt: { fontSize: 12, color: colors.textSub },
  motivoBox: { backgroundColor: colors.surfaceAlt, borderRadius: 8, padding: 10 },
  motivoLabel: { fontSize: 11, fontWeight: '700', color: colors.textSub, marginBottom: 2 },
  motivoTxt: { fontSize: 13, color: colors.text },
  fotoThumb: { width: '100%', height: 140, borderRadius: 8 },
  justificativaBox: { backgroundColor: colors.warningLight, borderRadius: 8, padding: 10, borderLeftWidth: 3, borderLeftColor: colors.warning },
  justificativaLabel: { fontSize: 11, fontWeight: '700', color: colors.warning, marginBottom: 3 },
  justificativaTxt: { fontSize: 13, color: colors.text },
  acoes: { flexDirection: 'row', gap: 8, marginTop: 4 },

  infoCard: { backgroundColor: colors.infoLight },
  infoTxt: { fontSize: 12, color: colors.info, lineHeight: 18 },

  // Modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  modal: { backgroundColor: colors.surface, borderRadius: 20, padding: 24, gap: 12 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  modalSub: { fontSize: 13, color: colors.textSub },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    padding: 12, fontSize: 14, color: colors.text,
    backgroundColor: colors.surfaceAlt, textAlignVertical: 'top', minHeight: 80,
  },
  aprovBox: { backgroundColor: colors.successLight, borderRadius: 10, padding: 12 },
  aprovTxt: { fontSize: 13, color: colors.success, lineHeight: 19 },
  modalAcoes: { flexDirection: 'row', gap: 10, marginTop: 4 },
  btnCancelar: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  btnCancelarTxt: { fontSize: 14, fontWeight: '700', color: colors.textSub },
  btnConfirmar: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: colors.danger, alignItems: 'center' },
  btnConfirmarTxt: { fontSize: 14, fontWeight: '700', color: '#fff' },

  // Movimentos
  localRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  localBtn: { flex: 1, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center', backgroundColor: colors.surface },
  localBtnAtivo: { borderColor: colors.primary, backgroundColor: colors.accentLight },
  localBtnTxt: { fontSize: 12, fontWeight: '700', color: colors.textSub },
  localBtnTxtAtivo: { color: colors.primary },
  tipoBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  tipoBadgeTxt: { fontSize: 11, fontWeight: '700' },
  pendenteBadge: { backgroundColor: colors.warningLight, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  pendenteTxt: { fontSize: 11, fontWeight: '700', color: colors.warning },
  corrigirBtn: { marginTop: 8, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.accentLight },
  corrigirBtnTxt: { fontSize: 12, fontWeight: '700', color: colors.primary },
  fotoBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, minHeight: 80, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  fotoBtnTxt: { fontSize: 14, color: colors.textSub, padding: 20 },
  cardGrandePerda: { borderColor: colors.danger, borderWidth: 1.5 },
  grandePerdaBanner: { backgroundColor: colors.dangerLight, borderRadius: 6, padding: 6, marginBottom: 4 },
  grandePerdaTxt: { fontSize: 11, fontWeight: '700', color: colors.danger },
  alertaSection: { backgroundColor: colors.dangerLight, borderRadius: 10, padding: 12, borderLeftWidth: 4, borderLeftColor: colors.danger },
  alertaSectionTxt: { fontSize: 13, fontWeight: '700', color: colors.danger },
  separador: { height: 1, backgroundColor: colors.border, marginVertical: 4 },

  // Movimentos novo painel
  movSummary: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  movSummaryItem: { flex: 1, backgroundColor: colors.surface, borderRadius: 12, padding: 10, alignItems: 'center', gap: 2, borderWidth: 1, borderColor: colors.border },
  movSummaryNum: { fontSize: 22, fontWeight: '800', color: colors.text },
  movSummaryLabel: { fontSize: 10, fontWeight: '600', color: colors.textSub, textAlign: 'center' },
  movBusca: { backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 14, height: 42, fontSize: 13, color: colors.text, borderWidth: 1, borderColor: colors.border, marginBottom: 4 },
  chipsRow: { marginBottom: 6 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginRight: 6 },
  chipAtivo: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipTxt: { fontSize: 12, fontWeight: '600', color: colors.textSub },
  chipTxtAtivo: { color: '#fff' },
  movControles: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  vistaToggle: { flexDirection: 'row', borderRadius: 10, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  vistaBtn: { padding: 9, backgroundColor: colors.surface },
  vistaBtnAtivo: { backgroundColor: colors.primary },
  vistaBtnTxt: { fontSize: 16 },
  vistaBtnTxtAtivo: { fontSize: 16 },

  // Vista por produto
  grupoCard: { gap: 8 },
  grupoCardAlerta: { gap: 8, borderWidth: 1.5, borderColor: colors.danger },
  grupoHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  grupoNome: { fontSize: 14, fontWeight: '800', color: colors.text },
  grupoSub: { fontSize: 11, color: colors.textSub, marginTop: 1 },
  grupoSeta: { fontSize: 12, color: colors.textSub },
  grupoIndicadores: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 4 },
  grupoIndicador: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  grupoIndicadorTxt: { fontSize: 12, fontWeight: '700' },
  grupoDetalhe: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, gap: 6 },
  grupoItemLinha: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, borderRadius: 8, backgroundColor: colors.surfaceAlt },
  grupoItemQtd: { fontSize: 12, fontWeight: '700', color: colors.text },
  grupoItemMeta: { fontSize: 11, color: colors.textSub },

  // Vista cronológica
  movLinha: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  movLinhaAlerta: { borderColor: colors.danger, backgroundColor: colors.dangerLight },
  movLinhaIcone: { fontSize: 20, width: 28, textAlign: 'center' },
  movLinhaNome: { fontSize: 13, fontWeight: '700', color: colors.text },
  movLinhaSub: { fontSize: 11, color: colors.textSub, marginTop: 1 },
  movLinhaQtd: { fontSize: 13, fontWeight: '800' },
  movLinhaAlertaIcon: { fontSize: 14 },

  // Métricas
  kpiRow: { flexDirection: 'row', gap: 10 },
  kpi: { flex: 1, borderRadius: 14, padding: 14, alignItems: 'center', gap: 4 },
  kpiNum: { fontSize: 30, fontWeight: '800' },
  kpiLabel: { fontSize: 11, fontWeight: '600', color: colors.textSub, textAlign: 'center' },

  opCard: { gap: 0 },
  opRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  opAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accentLight, alignItems: 'center', justifyContent: 'center' },
  opAvatarTxt: { fontSize: 18, fontWeight: '700', color: colors.primary },
  opNome: { fontSize: 14, fontWeight: '700', color: colors.text },
  opSub: { fontSize: 12, color: colors.textSub },
  opGap: { fontSize: 13, fontWeight: '700', color: colors.textSub },
  opValor: { fontSize: 11, color: colors.danger, fontWeight: '600' },

  turnoCard: { gap: 4 },
  turnoSemContagem: { borderLeftWidth: 4, borderLeftColor: colors.danger },
  turnoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  turnoLocal: { fontSize: 13, fontWeight: '700', color: colors.text },
  turnoHora: { fontSize: 12, color: colors.textSub },
  turnoDivGrande: { fontSize: 11, color: colors.danger, fontWeight: '600' },
  turnoValor: { fontSize: 11, color: colors.textSub },
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: colors.surfaceAlt },
  badgeOk: { backgroundColor: colors.successLight },
  badgeDanger: { backgroundColor: colors.dangerLight },
  badgeTxt: { fontSize: 11, fontWeight: '700', color: colors.textSub },
})
