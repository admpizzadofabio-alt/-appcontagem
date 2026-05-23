import React, { useState } from 'react'
import { View, Text, ScrollView, StyleSheet, Alert, TextInput, TouchableOpacity, Switch } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useListarSetoresQuery, useCriarSetorMutation, useEditarSetorMutation, useExcluirSetorMutation } from '../../services/api/setores'
import type { Setor } from '../../services/api/setores'
import { ActionButton } from '../../components/ActionButton'
import { Card } from '../../components/Card'
import { Badge } from '../../components/Badge'
import { EmptyState } from '../../components/EmptyState'
import { colors } from '../../theme/colors'

export function SetoresScreen() {
  const { data: setores = [], isLoading } = useListarSetoresQuery()
  const [criar, { isLoading: criando }] = useCriarSetorMutation()
  const [editar, { isLoading: editando }] = useEditarSetorMutation()
  const [excluir] = useExcluirSetorMutation()

  const [showForm, setShowForm] = useState(false)
  const [nome, setNome] = useState('')
  const [temEstoque, setTemEstoque] = useState(false)

  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editNome, setEditNome] = useState('')
  const [editTemEstoque, setEditTemEstoque] = useState(false)

  function abrirEdicao(s: Setor) {
    setEditandoId(s.id)
    setEditNome(s.nome)
    setEditTemEstoque(s.temEstoque)
    setShowForm(false)
  }

  function cancelarEdicao() {
    setEditandoId(null)
    setEditNome('')
  }

  async function handleCriar() {
    if (!nome.trim()) return Alert.alert('Atenção', 'Informe o nome do setor.')
    try {
      await criar({ nome: nome.trim(), temEstoque }).unwrap()
      setNome('')
      setTemEstoque(false)
      setShowForm(false)
      Alert.alert('Setor criado!')
    } catch (e: any) { Alert.alert('Erro', e.message) }
  }

  async function handleEditar() {
    if (!editNome.trim()) return Alert.alert('Atenção', 'Nome não pode ficar vazio.')
    try {
      await editar({ id: editandoId!, nome: editNome.trim(), temEstoque: editTemEstoque }).unwrap()
      cancelarEdicao()
      Alert.alert('Setor atualizado!')
    } catch (e: any) { Alert.alert('Erro', e.message) }
  }

  async function handleToggleAtivo(s: Setor) {
    const acao = s.ativo ? 'desativar' : 'ativar'
    Alert.alert(
      `${s.ativo ? 'Desativar' : 'Ativar'} setor`,
      `Deseja ${acao} o setor "${s.nome}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: s.ativo ? 'Desativar' : 'Ativar',
          style: s.ativo ? 'destructive' : 'default',
          onPress: async () => {
            try {
              await editar({ id: s.id, ativo: !s.ativo }).unwrap()
            } catch (e: any) { Alert.alert('Erro', e.message) }
          },
        },
      ],
    )
  }

  async function handleExcluir(s: Setor) {
    Alert.alert(
      '⚠️ Excluir setor',
      `Excluir "${s.nome}" permanentemente? Isso só é possível se nenhum usuário estiver vinculado.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await excluir(s.id).unwrap()
              Alert.alert('Setor excluído.')
            } catch (e: any) { Alert.alert('Erro', e.message) }
          },
        },
      ],
    )
  }

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <ScrollView style={s.scroll} contentContainerStyle={s.content}>

        <ActionButton
          label="Novo Setor"
          onPress={() => { setShowForm(!showForm); cancelarEdicao() }}
          variant={showForm ? 'ghost' : 'primary'}
          icon="🏷️"
        />

        {showForm && (
          <Card style={s.form}>
            <Text style={s.formTitle}>Criar Setor</Text>
            <TextInput
              style={s.input}
              placeholder="Nome do setor *"
              placeholderTextColor={colors.textMuted}
              value={nome}
              onChangeText={setNome}
              maxLength={50}
            />
            <View style={s.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.switchLabel}>Tem estoque físico</Text>
                <Text style={s.switchSub}>Ativa contagem e movimentações</Text>
              </View>
              <Switch
                value={temEstoque}
                onValueChange={setTemEstoque}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#fff"
              />
            </View>
            <ActionButton label="Criar Setor" onPress={handleCriar} loading={criando} />
          </Card>
        )}

        {isLoading && <EmptyState icon="⏳" title="Carregando..." />}

        {setores.map((setor) => {
          const editando = editandoId === setor.id
          return (
            <Card key={setor.id} style={[s.card, !setor.ativo && s.cardInativo] as any}>
              <View style={s.cardRow}>
                <View style={s.cardInfo}>
                  <Text style={s.cardNome}>{setor.nome}</Text>
                  <Text style={s.cardMeta}>
                    {setor.temEstoque ? '📦 Com estoque' : '🏷️ Sem estoque'}
                  </Text>
                </View>
                <View style={s.cardRight}>
                  <Badge label={setor.ativo ? 'Ativo' : 'Inativo'} variant={setor.ativo ? 'success' : 'default'} />
                  <View style={s.cardActions}>
                    <TouchableOpacity onPress={() => editando ? cancelarEdicao() : abrirEdicao(setor)} style={s.editBtn}>
                      <Text style={s.editBtnTxt}>{editando ? 'Cancelar' : '✏️ Editar'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleToggleAtivo(setor)} style={s.toggleBtn}>
                      <Text style={s.toggleTxt}>{setor.ativo ? 'Desativar' : 'Ativar'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleExcluir(setor)} style={s.deleteBtn}>
                      <Text style={s.deleteTxt}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {editando && (
                <View style={s.editForm}>
                  <View style={s.divider} />
                  <Text style={s.fieldLabel}>Nome</Text>
                  <TextInput
                    style={s.input}
                    value={editNome}
                    onChangeText={setEditNome}
                    placeholder="Nome do setor *"
                    placeholderTextColor={colors.textMuted}
                    maxLength={50}
                  />
                  <View style={s.switchRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.switchLabel}>Tem estoque físico</Text>
                      <Text style={s.switchSub}>Ativa contagem e movimentações</Text>
                    </View>
                    <Switch
                      value={editTemEstoque}
                      onValueChange={setEditTemEstoque}
                      trackColor={{ false: colors.border, true: colors.primary }}
                      thumbColor="#fff"
                    />
                  </View>
                  <TouchableOpacity
                    style={[s.salvarBtn, editando && { opacity: 0.6 }]}
                    onPress={handleEditar}
                    disabled={editando}
                  >
                    <Text style={s.salvarBtnTxt}>{editando ? 'Salvando...' : 'Salvar alterações'}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </Card>
          )
        })}

        {!isLoading && setores.length === 0 && (
          <EmptyState icon="🏷️" title="Nenhum setor cadastrado" subtitle="Crie o primeiro setor acima" />
        )}

      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 10, paddingBottom: 32 },
  form: { gap: 10 },
  formTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  input: { backgroundColor: colors.surfaceAlt, borderRadius: 10, paddingHorizontal: 14, height: 44, fontSize: 14, color: colors.text, borderWidth: 1, borderColor: colors.border },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: colors.textSub, textTransform: 'uppercase' },
  switchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceAlt, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: colors.border },
  switchLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  switchSub: { fontSize: 11, color: colors.textSub, marginTop: 2 },
  card: { marginBottom: 0 },
  cardInativo: { opacity: 0.55 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardInfo: { flex: 1 },
  cardNome: { fontSize: 14, fontWeight: '700', color: colors.text },
  cardMeta: { fontSize: 12, color: colors.textSub, marginTop: 2 },
  cardRight: { alignItems: 'flex-end', gap: 4 },
  cardActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  editBtn: { padding: 4 },
  editBtnTxt: { fontSize: 12, color: colors.warning, fontWeight: '700' },
  toggleBtn: { padding: 4 },
  toggleTxt: { fontSize: 12, color: colors.primaryLight, fontWeight: '600' },
  deleteBtn: { padding: 4 },
  deleteTxt: { fontSize: 14 },
  editForm: { gap: 10, marginTop: 4 },
  divider: { height: 1, backgroundColor: colors.divider, marginBottom: 6 },
  salvarBtn: { backgroundColor: colors.primary, borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 4 },
  salvarBtnTxt: { color: '#fff', fontSize: 14, fontWeight: '800' },
})
