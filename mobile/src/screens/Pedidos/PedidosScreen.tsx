import React, { useState } from 'react'
import { View, Text, ScrollView, StyleSheet, Alert, TextInput, TouchableOpacity, Modal, Pressable, ViewStyle } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useListarPedidosQuery, useCriarPedidoMutation, useAtualizarStatusPedidoMutation, useEditarPedidoMutation, useExcluirPedidoMutation } from '../../services/api/pedidos'
import { useListarProdutosQuery } from '../../services/api/produtos'
import { useAuth } from '../../contexts/AuthContext'
import { Card } from '../../components/Card'
import { Badge } from '../../components/Badge'
import { ActionButton } from '../../components/ActionButton'
import { EmptyState } from '../../components/EmptyState'
import { SectionHeader } from '../../components/SectionHeader'
import { colors } from '../../theme/colors'
import type { Pedido } from '../../services/api/pedidos'

const STATUS_VARIANT: Record<string, 'warning' | 'info' | 'success' | 'danger'> = {
  Pendente: 'warning', EmAnalise: 'info', Atendido: 'success', Cancelado: 'danger',
}

export function PedidosScreen() {
  const { usuario } = useAuth()
  const { data: pedidos = [], isLoading } = useListarPedidosQuery()
  const { data: produtos = [] } = useListarProdutosQuery({ ativo: true })
  const [criar, { isLoading: criando }] = useCriarPedidoMutation()
  const [atualizar] = useAtualizarStatusPedidoMutation()
  const [editar] = useEditarPedidoMutation()
  const [excluir] = useExcluirPedidoMutation()

  const [showForm, setShowForm] = useState(false)
  const [nomeProduto, setNomeProduto] = useState('')
  const [produtoIdSel, setProdutoIdSel] = useState<string | undefined>()
  const [quantidade, setQuantidade] = useState('')
  const [urgente, setUrgente] = useState(false)
  const [observacao, setObservacao] = useState('')
  const [showPicker, setShowPicker] = useState(false)
  const [buscaPicker, setBuscaPicker] = useState('')

  const [editando, setEditando] = useState<Pedido | null>(null)
  const [editNome, setEditNome] = useState('')
  const [editQtd, setEditQtd] = useState('')
  const [editObs, setEditObs] = useState('')
  const [editUrgente, setEditUrgente] = useState(false)

  const isSup = usuario?.nivelAcesso !== 'Operador'
  const isAdmin = usuario?.nivelAcesso === 'Admin'

  function abrirEdicao(p: Pedido) {
    setEditando(p)
    setEditNome(p.nomeProduto)
    setEditQtd(String(p.quantidade))
    setEditObs(p.observacao ?? '')
    setEditUrgente(p.urgente)
  }

  async function confirmarEdicao() {
    if (!editando) return
    try {
      await editar({ id: editando.id, nomeProduto: editNome, quantidade: parseFloat(editQtd) || editando.quantidade, observacao: editObs || undefined, urgente: editUrgente }).unwrap()
      setEditando(null)
    } catch (e: any) { Alert.alert('Erro', e.message) }
  }

  function handleExcluir(id: string, nome: string) {
    Alert.alert('Excluir pedido', `Excluir pedido de "${nome}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: async () => {
        try { await excluir(id).unwrap() }
        catch (e: any) { Alert.alert('Erro', e.message) }
      }},
    ])
  }

  async function handleCriar() {
    if (!nomeProduto.trim()) return Alert.alert('Atenção', 'Informe o produto.')
    const qtd = parseFloat(quantidade)
    if (!qtd) return Alert.alert('Atenção', 'Informe a quantidade.')
    try {
      await criar({ itens: [{ produtoId: produtoIdSel, nomeProduto, quantidade: qtd, urgente, observacao: observacao || undefined }] }).unwrap()
      setNomeProduto(''); setProdutoIdSel(undefined); setQuantidade(''); setUrgente(false); setObservacao(''); setShowForm(false)
      Alert.alert('Pedido criado!', 'Seu pedido foi registrado.')
    } catch (e: any) {
      Alert.alert('Erro', e.message)
    }
  }

  const produtosFiltradosPicker = (produtos as any[]).filter((p) =>
    p.nomeBebida.toLowerCase().includes(buscaPicker.toLowerCase())
  )

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <ScrollView style={s.scroll} contentContainerStyle={s.content}>

        <ActionButton label="Novo Pedido" onPress={() => setShowForm(!showForm)} variant={showForm ? 'ghost' : 'primary'} icon="🛒" />

        {showForm && (
          <Card style={s.form}>
            <Text style={s.formTitle}>Novo Pedido de Compra</Text>
            <TouchableOpacity style={s.pickerBtn} onPress={() => { setBuscaPicker(''); setShowPicker(true) }}>
              <Text style={nomeProduto ? s.pickerBtnTxt : s.pickerBtnPlaceholder}>
                {nomeProduto || 'Selecionar produto *'}
              </Text>
              <Text style={s.pickerArrow}>›</Text>
            </TouchableOpacity>
            <TextInput style={s.input} placeholder="Quantidade *" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" value={quantidade} onChangeText={setQuantidade} />
            <TextInput style={[s.input, { height: 70 }]} placeholder="Observação (opcional)" placeholderTextColor={colors.textMuted} multiline value={observacao} onChangeText={setObservacao} />
            <TouchableOpacity style={[s.urgenteBtn, urgente && s.urgenteActive]} onPress={() => setUrgente(!urgente)}>
              <Text style={[s.urgenteText, urgente && { color: colors.warning }]}>⚡ Urgente{urgente ? ' (ativado)' : ''}</Text>
            </TouchableOpacity>
            <ActionButton label="Enviar Pedido" onPress={handleCriar} loading={criando} />
          </Card>
        )}

        <SectionHeader title={`Pedidos (${pedidos.length})`} />
        {isLoading && <EmptyState icon="⏳" title="Carregando..." />}
        {!isLoading && pedidos.length === 0 && <EmptyState icon="🛒" title="Nenhum pedido" subtitle="Crie um novo pedido acima" />}

        {pedidos.map((p) => (
          <Card key={p.id} style={StyleSheet.flatten([s.pedidoCard, p.urgente && s.pedidoUrgente]) as ViewStyle}>
            <View style={s.pedidoHeader}>
              <Text style={s.pedidoNome}>{p.nomeProduto}{p.urgente ? ' ⚡' : ''}</Text>
              <Badge label={p.status} variant={STATUS_VARIANT[p.status] ?? 'default'} />
            </View>
            <Text style={s.pedidoInfo}>Qtd: {p.quantidade} · Setor: {p.setorSolicitante}</Text>
            <Text style={s.pedidoInfo}>Por: {p.usuario?.nome} · {new Date(p.dataPedido).toLocaleDateString('pt-BR')}</Text>
            {p.observacao && <Text style={s.pedidoObs}>{p.observacao}</Text>}
            {isSup && p.status === 'Pendente' && (
              <View style={s.acoes}>
                <ActionButton label="✅ Atendido" onPress={() => atualizar({ id: p.id, status: 'Atendido' })} style={{ flex: 1 }} />
                <ActionButton label="Cancelar" onPress={() => atualizar({ id: p.id, status: 'Cancelado' })} variant="secondary" style={{ flex: 1 }} />
              </View>
            )}
            {isAdmin && (
              <View style={s.adminAcoes}>
                <TouchableOpacity onPress={() => abrirEdicao(p)}>
                  <Text style={s.editBtn}>Editar</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleExcluir(p.id, p.nomeProduto)}>
                  <Text style={s.excluirBtn}>Excluir</Text>
                </TouchableOpacity>
              </View>
            )}
          </Card>
        ))}
      </ScrollView>

      {/* Modal seletor de produto */}
      <Modal visible={showPicker} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={[s.modal, { maxHeight: '80%' }]}>
            <Text style={s.modalTitle}>Selecionar produto</Text>
            <TextInput
              style={s.input}
              placeholder="Buscar..."
              placeholderTextColor={colors.textMuted}
              value={buscaPicker}
              onChangeText={setBuscaPicker}
              autoFocus
            />
            <ScrollView style={{ marginTop: 8 }} nestedScrollEnabled>
              {produtosFiltradosPicker.map((p: any) => (
                <Pressable
                  key={p.id}
                  style={[s.pickerItem, produtoIdSel === p.id && s.pickerItemAtivo]}
                  onPress={() => {
                    setNomeProduto(p.nomeBebida)
                    setProdutoIdSel(p.id)
                    setShowPicker(false)
                  }}
                >
                  <Text style={[s.pickerItemTxt, produtoIdSel === p.id && s.pickerItemTxtAtivo]}>
                    {p.nomeBebida}
                  </Text>
                  <Text style={s.pickerItemSub}>{p.categoria} · {p.setorPadrao}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable style={[s.btnCancelar, { marginTop: 8 }]} onPress={() => setShowPicker(false)}>
              <Text style={s.btnCancelarTxt}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={editando !== null} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>Editar pedido</Text>
            <TextInput style={s.input} value={editNome} onChangeText={setEditNome} placeholder="Nome do produto" placeholderTextColor={colors.textMuted} />
            <TextInput style={s.input} value={editQtd} onChangeText={setEditQtd} placeholder="Quantidade" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" />
            <TextInput style={[s.input, { height: 60 }]} value={editObs} onChangeText={setEditObs} placeholder="Observação" placeholderTextColor={colors.textMuted} multiline />
            <TouchableOpacity style={[s.urgenteBtn, editUrgente && s.urgenteActive]} onPress={() => setEditUrgente(!editUrgente)}>
              <Text style={[s.urgenteText, editUrgente && { color: colors.warning }]}>⚡ Urgente{editUrgente ? ' (ativado)' : ''}</Text>
            </TouchableOpacity>
            <View style={s.modalAcoes}>
              <Pressable style={s.btnCancelar} onPress={() => setEditando(null)}>
                <Text style={s.btnCancelarTxt}>Cancelar</Text>
              </Pressable>
              <Pressable style={s.btnSalvar} onPress={confirmarEdicao}>
                <Text style={s.btnSalvarTxt}>Salvar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  form: { gap: 10 },
  formTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  input: { backgroundColor: colors.surfaceAlt, borderRadius: 10, paddingHorizontal: 14, height: 44, fontSize: 14, color: colors.text, borderWidth: 1, borderColor: colors.border },
  pickerBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceAlt, borderRadius: 10, paddingHorizontal: 14, height: 44, borderWidth: 1, borderColor: colors.border },
  pickerBtnTxt: { flex: 1, fontSize: 14, color: colors.text },
  pickerBtnPlaceholder: { flex: 1, fontSize: 14, color: colors.textMuted },
  pickerArrow: { fontSize: 20, color: colors.textMuted },
  pickerItem: { paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: colors.divider },
  pickerItemAtivo: { backgroundColor: colors.accentLight, borderRadius: 8, paddingHorizontal: 8 },
  pickerItemTxt: { fontSize: 14, fontWeight: '600', color: colors.text },
  pickerItemTxtAtivo: { color: colors.primary },
  pickerItemSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  urgenteBtn: { padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  urgenteActive: { backgroundColor: colors.warningLight, borderColor: colors.warning },
  urgenteText: { fontWeight: '600', color: colors.textSub },
  pedidoCard: { gap: 6, marginBottom: 0 },
  pedidoUrgente: { borderLeftWidth: 4, borderLeftColor: colors.warning },
  pedidoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  pedidoNome: { fontSize: 15, fontWeight: '700', color: colors.text, flex: 1 },
  pedidoInfo: { fontSize: 12, color: colors.textSub },
  pedidoObs: { fontSize: 12, color: colors.textSub, fontStyle: 'italic' },
  acoes: { flexDirection: 'row', gap: 8, marginTop: 4 },
  adminAcoes: { flexDirection: 'row', gap: 16, marginTop: 4, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 8 },
  editBtn: { fontSize: 12, color: colors.info, fontWeight: '600' },
  excluirBtn: { fontSize: 12, color: colors.danger, fontWeight: '600' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 10 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: 4 },
  modalAcoes: { flexDirection: 'row', gap: 10, marginTop: 4 },
  btnCancelar: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  btnCancelarTxt: { fontSize: 14, fontWeight: '700', color: colors.textSub },
  btnSalvar: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center' },
  btnSalvarTxt: { fontSize: 14, fontWeight: '700', color: '#fff' },
})
