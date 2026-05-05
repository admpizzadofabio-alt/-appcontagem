import React, { useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet, Alert,
  TextInput, TouchableOpacity, Modal, Pressable,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  useListarProdutosQuery,
  useCriarProdutoMutation,
  useAtualizarProdutoMutation,
  useDeletarProdutoMutation,
  useExcluirProdutoMutation,
  type Produto,
} from '../../services/api/produtos'
import { ActionButton } from '../../components/ActionButton'
import { Card } from '../../components/Card'
import { Badge } from '../../components/Badge'
import { EmptyState } from '../../components/EmptyState'
import { colors } from '../../theme/colors'

const CATEGORIAS = ['Cerveja', 'Refrigerante', 'Água', 'Suco', 'Vinho', 'Destilado', 'Outros']
const UNIDADES   = ['un', 'L', 'ml', 'cx', 'fardo']
const SETORES    = ['Bar', 'Delivery', 'Todos'] as const
const SETOR_LABEL: Record<string, string> = { Bar: '🍺 Bar', Delivery: '🛵 Delivery', Todos: '🔄 Bar + Delivery' }

type Setor = 'Bar' | 'Delivery' | 'Todos'

export function ProdutosScreen() {
  const { data: produtos = [], isLoading } = useListarProdutosQuery()
  const [criar,    { isLoading: criando }]  = useCriarProdutoMutation()
  const [atualizar, { isLoading: salvando }] = useAtualizarProdutoMutation()
  const [deletar]  = useDeletarProdutoMutation()
  const [excluir]  = useExcluirProdutoMutation()

  // ── Estado: criar ──
  const [showForm,   setShowForm]   = useState(false)
  const [nome,       setNome]       = useState('')
  const [categoria,  setCategoria]  = useState('Cerveja')
  const [unidade,    setUnidade]    = useState('un')
  const [custo,      setCusto]      = useState('')
  const [minimo,     setMinimo]     = useState('')
  const [threshold,  setThreshold]  = useState('5')
  const [setor,      setSetor]      = useState<Setor>('Todos')

  // ── Estado: editar ──
  const [editProd,      setEditProd]      = useState<Produto | null>(null)
  const [editNome,      setEditNome]      = useState('')
  const [editCusto,     setEditCusto]     = useState('')
  const [editMinimo,    setEditMinimo]    = useState('')
  const [editThreshold, setEditThreshold] = useState('5')
  const [editSetor,     setEditSetor]     = useState<Setor>('Todos')

  const [busca,       setBusca]       = useState('')
  const [filtroAtivo, setFiltroAtivo] = useState<boolean | null>(true) // null = todos

  const filtrados = produtos
    .filter((p) => filtroAtivo === null ? true : p.ativo === filtroAtivo)
    .filter((p) => p.nomeBebida.toLowerCase().includes(busca.toLowerCase()))

  const totalInativos = produtos.filter((p) => !p.ativo).length

  const pendentesRevisao = produtos.filter(
    (p) => p.ativo && p.revisadoAdmin === false
  )

  // ── Criar ──
  async function handleCriar() {
    if (!nome.trim()) return Alert.alert('Atenção', 'Informe o nome do produto.')
    try {
      await criar({
        nomeBebida: nome,
        categoria,
        unidadeMedida: unidade,
        custoUnitario: parseFloat(custo) || 0,
        estoqueMinimo: parseFloat(minimo) || 0,
        perdaThreshold: parseFloat(threshold) || 5,
        setorPadrao: setor,
      }).unwrap()
      setNome(''); setCusto(''); setMinimo(''); setThreshold('5')
      setCategoria('Cerveja'); setUnidade('un'); setSetor('Todos')
      setShowForm(false)
      Alert.alert('✅ Produto criado!')
    } catch (e: any) { Alert.alert('Erro', e.message) }
  }

  // ── Abrir modal de edição ──
  function abrirEdicao(p: Produto) {
    setEditProd(p)
    setEditNome(p.nomeBebida)
    setEditCusto(p.custoUnitario > 0 ? String(p.custoUnitario) : '')
    setEditMinimo(p.estoqueMinimo > 0 ? String(p.estoqueMinimo) : '')
    setEditThreshold(String(p.perdaThreshold ?? 5))
    setEditSetor((p.setorPadrao as Setor) ?? 'Todos')
  }

  async function handleSalvarEdicao() {
    if (!editProd) return
    if (!editNome.trim()) return Alert.alert('Atenção', 'Informe o nome.')
    try {
      await atualizar({
        id: editProd.id,
        nomeBebida: editNome.trim(),
        custoUnitario: parseFloat(editCusto) || 0,
        estoqueMinimo: parseFloat(editMinimo) || 0,
        perdaThreshold: parseFloat(editThreshold) || 5,
        setorPadrao: editSetor,
      }).unwrap()
      setEditProd(null)
    } catch (e: any) { Alert.alert('Erro', e.message) }
  }

  // ── Desativar / Reativar / Excluir ──
  function handleDeletar(id: string, nome: string) {
    Alert.alert('Desativar produto', `Desativar "${nome}"?\n\nFica oculto mas o histórico é mantido.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Desativar', style: 'destructive', onPress: () => deletar(id) },
    ])
  }

  function handleReativar(id: string, nome: string) {
    Alert.alert('Reativar produto', `Reativar "${nome}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Reativar', onPress: () => atualizar({ id, ativo: true }) },
    ])
  }

  function handleExcluir(id: string, nome: string) {
    Alert.alert(
      'Excluir produto',
      `Excluir "${nome}" permanentemente?\n\nSó possível sem movimentações registradas.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir', style: 'destructive',
          onPress: async () => {
            try {
              await excluir(id).unwrap()
              Alert.alert('Excluído', 'Produto removido.')
            } catch (e: any) { Alert.alert('Não é possível excluir', e.message) }
          },
        },
      ],
    )
  }

  // ── Badge de setor ──
  function setorColor(s: string) {
    if (s === 'Bar')      return { bg: colors.accentLight,  txt: colors.primary }
    if (s === 'Delivery') return { bg: colors.infoLight,    txt: colors.info    }
    return                       { bg: colors.surfaceAlt,   txt: colors.textSub }
  }

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <ScrollView style={s.scroll} contentContainerStyle={s.content}>

        {/* Banner revisão */}
        {pendentesRevisao.length > 0 && (
          <View style={s.bannerRevisao}>
            <View style={s.bannerRevisaoHeader}>
              <Text style={s.bannerRevisaoIcon}>🆕</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.bannerRevisaoTitle}>
                  {pendentesRevisao.length} produto{pendentesRevisao.length > 1 ? 's' : ''} importado{pendentesRevisao.length > 1 ? 's' : ''} aguardando revisão
                </Text>
                <Text style={s.bannerRevisaoSub}>Toque em ✏️ Editar para definir setor e custo</Text>
              </View>
            </View>
            <View style={s.bannerRevisaoLista}>
              {pendentesRevisao.map((p) => (
                <Text key={p.id} style={s.bannerRevisaoItem}>• {p.nomeBebida}</Text>
              ))}
            </View>
          </View>
        )}

        {/* Toggle Ativos / Inativos */}
        <View style={s.toggleFiltro}>
          <TouchableOpacity
            style={[s.toggleBtn, filtroAtivo === true && s.toggleBtnAtivo]}
            onPress={() => setFiltroAtivo(true)}
          >
            <Text style={[s.toggleBtnTxt, filtroAtivo === true && s.toggleBtnTxtAtivo]}>Ativos</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.toggleBtn, filtroAtivo === false && s.toggleBtnDesativado]}
            onPress={() => setFiltroAtivo(false)}
          >
            <Text style={[s.toggleBtnTxt, filtroAtivo === false && { color: colors.danger, fontWeight: '700' }]}>
              Inativos {totalInativos > 0 ? `(${totalInativos})` : ''}
            </Text>
          </TouchableOpacity>
        </View>

        <TextInput
          style={s.search}
          placeholder="Buscar produto..."
          placeholderTextColor={colors.textMuted}
          value={busca}
          onChangeText={setBusca}
        />
        <ActionButton
          label="Novo Produto"
          onPress={() => setShowForm(!showForm)}
          variant={showForm ? 'ghost' : 'primary'}
          icon="🍺"
        />


        {/* Formulário criar */}
        {showForm && (
          <Card style={s.form}>
            <Text style={s.formTitle}>Novo Produto</Text>
            <TextInput
              style={s.input}
              placeholder="Nome *"
              placeholderTextColor={colors.textMuted}
              value={nome}
              onChangeText={setNome}
            />

            <Text style={s.fieldLabel}>Setor</Text>
            <View style={s.chipRow}>
              {SETORES.map((st) => (
                <TouchableOpacity
                  key={st}
                  style={[s.chip, setor === st && s.chipActive]}
                  onPress={() => setSetor(st)}
                >
                  <Text style={[s.chipText, setor === st && s.chipTextActive]}>{SETOR_LABEL[st]}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.fieldLabel}>Categoria</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={s.chipRow}>
                {CATEGORIAS.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[s.chip, categoria === c && s.chipActive]}
                    onPress={() => setCategoria(c)}
                  >
                    <Text style={[s.chipText, categoria === c && s.chipTextActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={s.fieldLabel}>Unidade</Text>
            <View style={s.chipRow}>
              {UNIDADES.map((u) => (
                <TouchableOpacity
                  key={u}
                  style={[s.chip, unidade === u && s.chipActive]}
                  onPress={() => setUnidade(u)}
                >
                  <Text style={[s.chipText, unidade === u && s.chipTextActive]}>{u}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={s.row}>
              <View style={s.col}>
                <Text style={s.fieldLabel}>Custo (R$)</Text>
                <TextInput style={s.input} placeholder="0,00" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" value={custo} onChangeText={setCusto} />
              </View>
              <View style={s.col}>
                <Text style={s.fieldLabel}>Mínimo</Text>
                <TextInput style={s.input} placeholder="0" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" value={minimo} onChangeText={setMinimo} />
              </View>
              <View style={s.col}>
                <Text style={s.fieldLabel}>Lim. perda</Text>
                <TextInput style={s.input} placeholder="5" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" value={threshold} onChangeText={setThreshold} />
              </View>
            </View>

            <ActionButton label="Salvar Produto" onPress={handleCriar} loading={criando} />
          </Card>
        )}

        {isLoading && <EmptyState icon="⏳" title="Carregando..." />}
        {!isLoading && filtrados.length === 0 && <EmptyState icon="🍺" title="Nenhum produto" />}

        {filtrados.map((p) => {
          const sc = setorColor(p.setorPadrao)
          const pendente = p.ativo && p.revisadoAdmin === false
          return (
            <Card key={p.id} style={[s.prodCard, !p.ativo && { opacity: 0.5 }, pendente && s.prodCardPendente] as any}>
              <View style={s.prodHeader}>
                <View style={s.prodInfo}>
                  <Text style={s.prodNome}>{p.nomeBebida}</Text>
                  <Text style={s.prodMeta}>{p.categoria} · {p.unidadeMedida} · Mín: {p.estoqueMinimo}</Text>
                </View>
                <View style={s.prodRight}>
                  <Text style={s.prodCusto}>R$ {p.custoUnitario.toFixed(2)}</Text>
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    <View style={[s.setorBadge, { backgroundColor: sc.bg }]}>
                      <Text style={[s.setorBadgeTxt, { color: sc.txt }]}>{SETOR_LABEL[p.setorPadrao] ?? p.setorPadrao}</Text>
                    </View>
                    <Badge label={p.ativo ? 'Ativo' : 'Inativo'} variant={p.ativo ? 'success' : 'default'} />
                  </View>
                </View>
              </View>
              <View style={s.acoes}>
                {/* Editar sempre disponível */}
                <TouchableOpacity onPress={() => abrirEdicao(p)} style={s.editarBtnWrap}>
                  <Text style={s.editarBtn}>✏️ Editar</Text>
                </TouchableOpacity>

                {p.ativo ? (
                  <TouchableOpacity onPress={() => handleDeletar(p.id, p.nomeBebida)}>
                    <Text style={s.desativarBtn}>Desativar</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={() => handleReativar(p.id, p.nomeBebida)}>
                    <Text style={s.reativarBtn}>Reativar</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity onPress={() => handleExcluir(p.id, p.nomeBebida)}>
                  <Text style={s.excluirBtn}>Excluir</Text>
                </TouchableOpacity>
              </View>
            </Card>
          )
        })}
      </ScrollView>

      {/* Modal de edição */}
      <Modal visible={editProd !== null} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>Editar Produto</Text>
            <Text style={s.modalSub}>{editProd?.nomeBebida}</Text>

            <Text style={s.fieldLabel}>Nome</Text>
            <TextInput
              style={s.input}
              value={editNome}
              onChangeText={setEditNome}
              placeholder="Nome do produto"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={s.fieldLabel}>Setor *</Text>
            <View style={s.chipRow}>
              {SETORES.map((st) => (
                <TouchableOpacity
                  key={st}
                  style={[s.chip, s.chipLarge, editSetor === st && s.chipActive]}
                  onPress={() => setEditSetor(st)}
                >
                  <Text style={[s.chipText, editSetor === st && s.chipTextActive]}>
                    {SETOR_LABEL[st]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={s.row}>
              <View style={s.col}>
                <Text style={s.fieldLabel}>Custo (R$)</Text>
                <TextInput
                  style={s.input}
                  value={editCusto}
                  onChangeText={setEditCusto}
                  placeholder="0,00"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={s.col}>
                <Text style={s.fieldLabel}>Estoque mín.</Text>
                <TextInput
                  style={s.input}
                  value={editMinimo}
                  onChangeText={setEditMinimo}
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={s.col}>
                <Text style={s.fieldLabel}>Lim. perda</Text>
                <TextInput
                  style={s.input}
                  value={editThreshold}
                  onChangeText={setEditThreshold}
                  placeholder="5"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            <View style={s.modalAcoes}>
              <Pressable style={s.btnCancelar} onPress={() => setEditProd(null)}>
                <Text style={s.btnCancelarTxt}>Cancelar</Text>
              </Pressable>
              <Pressable style={[s.btnSalvar, salvando && { opacity: 0.6 }]} onPress={handleSalvarEdicao} disabled={salvando}>
                <Text style={s.btnSalvarTxt}>{salvando ? 'Salvando...' : 'Salvar'}</Text>
              </Pressable>
            </View>

            {/* Desativar / Reativar direto no modal */}
            {editProd?.ativo ? (
              <Pressable
                style={s.btnDesativarModal}
                onPress={() => {
                  setEditProd(null)
                  handleDeletar(editProd!.id, editProd!.nomeBebida)
                }}
              >
                <Text style={s.btnDesativarModalTxt}>Desativar produto</Text>
              </Pressable>
            ) : (
              <Pressable
                style={s.btnReativarModal}
                onPress={() => {
                  setEditProd(null)
                  handleReativar(editProd!.id, editProd!.nomeBebida)
                }}
              >
                <Text style={s.btnReativarModalTxt}>Reativar produto</Text>
              </Pressable>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.background },
  scroll:  { flex: 1 },
  content: { padding: 16, gap: 10, paddingBottom: 32 },

  search: {
    backgroundColor: colors.surface, borderRadius: 12,
    paddingHorizontal: 16, height: 44, fontSize: 14,
    color: colors.text, borderWidth: 1, borderColor: colors.border,
  },

  toggleFiltro:        { flexDirection: 'row', gap: 8 },
  toggleBtn:           { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center', backgroundColor: colors.surface },
  toggleBtnAtivo:      { backgroundColor: colors.accentLight, borderColor: colors.primary },
  toggleBtnDesativado: { backgroundColor: colors.dangerLight,  borderColor: colors.danger },
  toggleBtnTxt:        { fontSize: 13, fontWeight: '600', color: colors.textSub },
  toggleBtnTxtAtivo:   { color: colors.primary, fontWeight: '700' },
  // Formulário criar
  form:       { gap: 10 },
  formTitle:  { fontSize: 15, fontWeight: '700', color: colors.text },
  input: {
    backgroundColor: colors.surfaceAlt, borderRadius: 10,
    paddingHorizontal: 14, height: 44, fontSize: 14,
    color: colors.text, borderWidth: 1, borderColor: colors.border,
  },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: colors.textSub, textTransform: 'uppercase' },
  chipRow:     { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  chip:        { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
  chipLarge:   { paddingHorizontal: 16, paddingVertical: 10, flex: 1, alignItems: 'center' },
  chipActive:  { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText:    { fontSize: 13, fontWeight: '500', color: colors.textSub },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  row: { flexDirection: 'row', gap: 8 },
  col: { flex: 1, gap: 4 },

  // Cards de produto
  prodCard:         { gap: 6 },
  prodCardPendente: { borderLeftWidth: 3, borderLeftColor: '#FFC107' },
  prodHeader:       { flexDirection: 'row', justifyContent: 'space-between' },
  prodInfo:         { flex: 1, gap: 2 },
  prodNome:         { fontSize: 14, fontWeight: '700', color: colors.text },
  prodMeta:         { fontSize: 12, color: colors.textSub },
  prodRight:        { alignItems: 'flex-end', gap: 4 },
  prodCusto:        { fontSize: 14, fontWeight: '700', color: colors.primary },

  setorBadge:    { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  setorBadgeTxt: { fontSize: 11, fontWeight: '700' },

  acoes:        { flexDirection: 'row', gap: 14, marginTop: 4, alignItems: 'center' },
  editarBtnWrap:{ backgroundColor: colors.accentLight, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  editarBtn:    { fontSize: 12, color: colors.primary, fontWeight: '700' },
  desativarBtn: { fontSize: 12, color: colors.warning, fontWeight: '600' },
  reativarBtn:  { fontSize: 12, color: colors.success, fontWeight: '600' },
  excluirBtn:   { fontSize: 12, color: colors.danger,  fontWeight: '600' },

  // Modal edição
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal:      { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 12, maxHeight: '90%' },
  modalTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  modalSub:   { fontSize: 13, color: colors.textSub, marginTop: -6 },
  modalAcoes: { flexDirection: 'row', gap: 10, marginTop: 4 },
  btnCancelar:    { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  btnCancelarTxt: { fontSize: 14, fontWeight: '700', color: colors.textSub },
  btnSalvar:      { flex: 1, padding: 14, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center' },
  btnSalvarTxt:   { fontSize: 14, fontWeight: '700', color: '#fff' },
  btnDesativarModal:    { padding: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.warning, marginTop: -4 },
  btnDesativarModalTxt: { fontSize: 13, fontWeight: '700', color: colors.warning },
  btnReativarModal:     { padding: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.success, marginTop: -4 },
  btnReativarModalTxt:  { fontSize: 13, fontWeight: '700', color: colors.success },

  // Banner revisão
  bannerRevisao: {
    backgroundColor: '#FFF3CD', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#FFC107', gap: 10,
  },
  bannerRevisaoHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bannerRevisaoIcon:   { fontSize: 24 },
  bannerRevisaoTitle:  { fontSize: 13, fontWeight: '800', color: '#7D5400' },
  bannerRevisaoSub:    { fontSize: 11, color: '#9A6700', marginTop: 1 },
  bannerRevisaoLista:  { gap: 4, paddingLeft: 4 },
  bannerRevisaoItem:   { fontSize: 12, color: '#7D5400', fontWeight: '600' },
})
