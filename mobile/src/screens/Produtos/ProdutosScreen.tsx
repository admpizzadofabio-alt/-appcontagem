import React, { useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet, Alert,
  TextInput, TouchableOpacity, Modal, Pressable, Image,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'

async function pickPhoto(): Promise<string | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync()
  if (!perm.granted) {
    Alert.alert('Permissão negada', 'Permita o uso da câmera nas configurações')
    return null
  }
  const r = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.5, base64: true })
  if (!r.canceled && r.assets[0]?.base64) return `data:image/jpeg;base64,${r.assets[0].base64}`
  return null
}
import {
  useListarProdutosQuery,
  useCargaInicialMutation,
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
  const [cargaInicial] = useCargaInicialMutation()

  async function handleCargaInicial(p: { id: string; nomeBebida: string; setorPadrao: string }) {
    Alert.prompt(
      'Carga Inicial — ' + p.nomeBebida,
      `Quantidade física no estoque agora (${p.setorPadrao === 'Delivery' ? 'Delivery' : 'Bar'}).\nA partir deste momento o Colibri começa a descontar.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async (txt?: string) => {
            const qtd = parseFloat((txt ?? '').replace(',', '.'))
            if (Number.isNaN(qtd) || qtd <= 0) return Alert.alert('Atenção', 'Quantidade inválida')
            const local = p.setorPadrao === 'Delivery' ? 'Delivery' : 'Bar'
            try {
              const r = await cargaInicial({ id: p.id, quantidade: qtd, local }).unwrap()
              Alert.alert('✅ Carga registrada', r.mensagem)
            } catch (e: any) {
              Alert.alert('Erro', e.message)
            }
          },
        },
      ],
      'plain-text',
      '',
      'numeric',
    )
  }

  // ── Estado: criar ──
  const [showForm,   setShowForm]   = useState(false)
  const [nome,       setNome]       = useState('')
  const [categoria,  setCategoria]  = useState('Cerveja')
  const [unidade,    setUnidade]    = useState('un')
  const [custo,      setCusto]      = useState('')
  const [minimo,     setMinimo]     = useState('')
  const [threshold,  setThreshold]  = useState('5')
  const [setor,      setSetor]      = useState<Setor>('Todos')
  const [imagem,     setImagem]     = useState<string | null>(null)

  // ── Estado: editar ──
  const [editProd,      setEditProd]      = useState<Produto | null>(null)
  const [editNome,      setEditNome]      = useState('')
  const [editCusto,     setEditCusto]     = useState('')
  const [editMinimo,    setEditMinimo]    = useState('')
  const [editThreshold, setEditThreshold] = useState('5')
  const [editSetor,     setEditSetor]     = useState<Setor>('Todos')
  const [editImagem,    setEditImagem]    = useState<string | null>(null)

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
        imagem: imagem ?? undefined,
      } as any).unwrap()
      setNome(''); setCusto(''); setMinimo(''); setThreshold('5')
      setCategoria('Cerveja'); setUnidade('un'); setSetor('Todos'); setImagem(null)
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

            <Text style={s.fieldLabel}>📸 Foto (opcional)</Text>
            {imagem && <Image source={{ uri: imagem }} style={s.fotoPreview} />}
            <TouchableOpacity style={s.fotoBtn} onPress={async () => {
              const img = await pickPhoto()
              if (img) setImagem(img)
            }}>
              <Text style={s.fotoBtnTxt}>{imagem ? '🔄 Trocar foto' : '📷 Tirar foto'}</Text>
            </TouchableOpacity>

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
                  <Text style={s.prodMeta}>
                    {p.categoria} · {p.unidadeMedida} ·{' '}
                    <Text style={p.estoqueMinimo === 0 ? s.minimoZero : s.minimoOk}>
                      Mín: {p.estoqueMinimo === 0 ? '⚠️ não definido' : p.estoqueMinimo}
                    </Text>
                  </Text>
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
              {!p.marcoInicialEm && p.ativo && (
                <TouchableOpacity onPress={() => handleCargaInicial(p)} style={s.cargaBanner}>
                  <Text style={s.cargaBannerTxt}>⚠️ Sem carga inicial — Colibri não opera. Toque para definir.</Text>
                </TouchableOpacity>
              )}
              <View style={s.acoes}>
                {/* Editar sempre disponível */}
                <TouchableOpacity onPress={() => abrirEdicao(p)} style={s.editarBtnWrap}>
                  <Text style={s.editarBtn}>✏️ Editar</Text>
                </TouchableOpacity>

                {p.ativo && p.marcoInicialEm && (
                  <TouchableOpacity onPress={() => handleCargaInicial(p)}>
                    <Text style={s.editarBtn}>📦 Carga</Text>
                  </TouchableOpacity>
                )}

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

            {/* Estoque mínimo em destaque */}
            <View style={[s.minimoBox, !editMinimo || editMinimo === '0' ? s.minimoBoxAlerta : s.minimoBoxOk]}>
              <View style={s.minimoBoxHeader}>
                <Text style={s.minimoBoxLabel}>⚠️ Estoque Mínimo</Text>
                {(!editMinimo || editMinimo === '0') && (
                  <Text style={s.minimoBoxDica}>Não configurado — alerta não vai funcionar</Text>
                )}
              </View>
              <TextInput
                style={[s.input, s.minimoInput]}
                value={editMinimo}
                onChangeText={setEditMinimo}
                placeholder="Ex: 24"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
              />
              <Text style={s.minimoHint}>Abaixo desse valor o produto aparece como "Baixo" no estoque</Text>
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
                <Text style={s.fieldLabel}>Lim. perda %</Text>
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
  fotoBtn: { padding: 12, backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: 'center', marginBottom: 8 },
  fotoBtnTxt: { color: colors.primary, fontWeight: '700' },
  fotoPreview: { width: 100, height: 100, borderRadius: 8, marginBottom: 8 },
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
  cargaBanner: { backgroundColor: '#FFF3CD', borderRadius: 8, padding: 8, marginVertical: 6, borderLeftWidth: 3, borderLeftColor: '#FFC107' },
  cargaBannerTxt: { fontSize: 12, color: '#7D5400', fontWeight: '600' },

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

  // Mínimo destaque
  minimoZero:      { color: colors.warning, fontWeight: '700' },
  minimoOk:        { color: colors.success, fontWeight: '600' },
  minimoBox:       { borderRadius: 12, padding: 14, gap: 8, borderWidth: 2 },
  minimoBoxAlerta: { backgroundColor: colors.warningLight, borderColor: colors.warning },
  minimoBoxOk:     { backgroundColor: colors.successLight, borderColor: colors.success },
  minimoBoxHeader: { gap: 2 },
  minimoBoxLabel:  { fontSize: 13, fontWeight: '800', color: colors.text },
  minimoBoxDica:   { fontSize: 11, color: colors.warning, fontWeight: '600' },
  minimoInput:     { backgroundColor: colors.surface },
  minimoHint:      { fontSize: 11, color: colors.textSub },

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
