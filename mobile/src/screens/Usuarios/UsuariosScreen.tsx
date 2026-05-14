import React, { useState } from 'react'
import { View, Text, ScrollView, StyleSheet, Alert, TextInput, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useListarUsuariosQuery, useCriarUsuarioMutation, useAtualizarUsuarioMutation, useToggleUsuarioMutation } from '../../services/api/usuarios'
import type { Usuario } from '../../services/api/usuarios'
import { ActionButton } from '../../components/ActionButton'
import { Card } from '../../components/Card'
import { Badge } from '../../components/Badge'
import { EmptyState } from '../../components/EmptyState'
import { colors } from '../../theme/colors'

const SETORES = ['Bar', 'Delivery', 'Admin', 'Todos']
const NIVEIS = ['Operador', 'Supervisor', 'Admin']

export function UsuariosScreen() {
  const { data: usuarios = [], isLoading } = useListarUsuariosQuery()
  const [criar, { isLoading: criando }] = useCriarUsuarioMutation()
  const [atualizar, { isLoading: atualizando }] = useAtualizarUsuarioMutation()
  const [toggle] = useToggleUsuarioMutation()

  // Create form
  const [showForm, setShowForm] = useState(false)
  const [nome, setNome] = useState('')
  const [pin, setPin] = useState('')
  const [setor, setSetor] = useState('Bar')
  const [nivel, setNivel] = useState('Operador')

  // Edit state
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editNome, setEditNome] = useState('')
  const [editPin, setEditPin] = useState('')
  const [editSetor, setEditSetor] = useState('Bar')
  const [editNivel, setEditNivel] = useState('Operador')

  function abrirEdicao(u: Usuario) {
    setEditandoId(u.id)
    setEditNome(u.nome)
    setEditPin('')
    setEditSetor(u.setor)
    setEditNivel(u.nivelAcesso)
    setShowForm(false)
  }

  function cancelarEdicao() {
    setEditandoId(null)
    setEditPin('')
  }

  async function handleCriar() {
    if (!nome.trim() || !/^\d{6}$/.test(pin)) return Alert.alert('Atenção', 'Preencha nome e PIN de 6 dígitos.')
    try {
      await criar({ nome, pin, setor, nivelAcesso: nivel }).unwrap()
      setNome(''); setPin(''); setShowForm(false)
      Alert.alert('Usuário criado!')
    } catch (e: any) { Alert.alert('Erro', e.message) }
  }

  async function handleAtualizar() {
    if (!editNome.trim()) return Alert.alert('Atenção', 'Nome não pode ficar vazio.')
    if (editPin && !/^\d{6}$/.test(editPin)) return Alert.alert('Atenção', 'PIN deve ter exatamente 6 dígitos.')
    try {
      await atualizar({
        id: editandoId!,
        nome: editNome.trim(),
        setor: editSetor,
        nivelAcesso: editNivel,
        ...(editPin ? { pin: editPin } : {}),
      }).unwrap()
      cancelarEdicao()
      Alert.alert('Usuário atualizado!')
    } catch (e: any) { Alert.alert('Erro', e.message) }
  }

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <ScrollView style={s.scroll} contentContainerStyle={s.content}>

        <ActionButton label="Novo Usuário" onPress={() => { setShowForm(!showForm); setEditandoId(null) }} variant={showForm ? 'ghost' : 'primary'} icon="👤" />

        {showForm && (
          <Card style={s.form}>
            <Text style={s.formTitle}>Criar Usuário</Text>
            <TextInput style={s.input} placeholder="Nome *" placeholderTextColor={colors.textMuted} value={nome} onChangeText={setNome} />
            <TextInput style={s.input} placeholder="PIN (6 dígitos) *" placeholderTextColor={colors.textMuted} keyboardType="number-pad" maxLength={6} secureTextEntry value={pin} onChangeText={setPin} />

            <Text style={s.fieldLabel}>Setor</Text>
            <View style={s.opts}>
              {SETORES.map((s_) => (
                <TouchableOpacity key={s_} style={[s.opt, setor === s_ && s.optActive]} onPress={() => setSetor(s_)}>
                  <Text style={[s.optText, setor === s_ && s.optTextActive]}>{s_}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.fieldLabel}>Nível de Acesso</Text>
            <View style={s.opts}>
              {NIVEIS.map((n) => (
                <TouchableOpacity key={n} style={[s.opt, nivel === n && s.optActive]} onPress={() => setNivel(n)}>
                  <Text style={[s.optText, nivel === n && s.optTextActive]}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <ActionButton label="Criar Usuário" onPress={handleCriar} loading={criando} />
          </Card>
        )}

        {isLoading && <EmptyState icon="⏳" title="Carregando..." />}

        {usuarios.map((u) => {
          const editando = editandoId === u.id
          return (
            <Card key={u.id} style={[s.userCard, !u.ativo && s.userInativo] as any}>
              <View style={s.userRow}>
                <View style={[s.avatar, editando && s.avatarEdit]}>
                  <Text style={s.avatarText}>{u.nome.charAt(0)}</Text>
                </View>
                <View style={s.userInfo}>
                  <Text style={s.userName}>{u.nome}</Text>
                  <Text style={s.userMeta}>{u.setor} · {u.nivelAcesso}</Text>
                </View>
                <View style={s.userRight}>
                  <Badge label={u.ativo ? 'Ativo' : 'Inativo'} variant={u.ativo ? 'success' : 'default'} />
                  <View style={s.userActions}>
                    <TouchableOpacity onPress={() => editando ? cancelarEdicao() : abrirEdicao(u)} style={s.editBtn}>
                      <Text style={s.editBtnTxt}>{editando ? 'Cancelar' : '✏️ Editar'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => toggle(u.id)} style={s.toggleBtn}>
                      <Text style={s.toggleText}>{u.ativo ? 'Desativar' : 'Ativar'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {editando && (
                <View style={s.editForm}>
                  <View style={s.editDivider} />

                  <Text style={s.fieldLabel}>Nome</Text>
                  <TextInput
                    style={s.input}
                    value={editNome}
                    onChangeText={setEditNome}
                    placeholder="Nome *"
                    placeholderTextColor={colors.textMuted}
                  />

                  <Text style={s.fieldLabel}>Novo PIN (deixe vazio para não alterar)</Text>
                  <TextInput
                    style={s.input}
                    value={editPin}
                    onChangeText={setEditPin}
                    placeholder="Novo PIN (6 dígitos)"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="number-pad"
                    maxLength={6}
                    secureTextEntry
                  />

                  <Text style={s.fieldLabel}>Setor</Text>
                  <View style={s.opts}>
                    {SETORES.map((s_) => (
                      <TouchableOpacity key={s_} style={[s.opt, editSetor === s_ && s.optActive]} onPress={() => setEditSetor(s_)}>
                        <Text style={[s.optText, editSetor === s_ && s.optTextActive]}>{s_}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={s.fieldLabel}>Nível de Acesso</Text>
                  <View style={s.opts}>
                    {NIVEIS.map((n) => (
                      <TouchableOpacity key={n} style={[s.opt, editNivel === n && s.optActive]} onPress={() => setEditNivel(n)}>
                        <Text style={[s.optText, editNivel === n && s.optTextActive]}>{n}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <TouchableOpacity
                    style={[s.salvarBtn, atualizando && { opacity: 0.6 }]}
                    onPress={handleAtualizar}
                    disabled={atualizando}
                  >
                    <Text style={s.salvarBtnTxt}>{atualizando ? 'Salvando...' : 'Salvar alterações'}</Text>
                  </TouchableOpacity>
                </View>
              )}
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
  content: { padding: 16, gap: 10, paddingBottom: 32 },
  form: { gap: 10 },
  formTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  input: { backgroundColor: colors.surfaceAlt, borderRadius: 10, paddingHorizontal: 14, height: 44, fontSize: 14, color: colors.text, borderWidth: 1, borderColor: colors.border },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: colors.textSub, textTransform: 'uppercase' },
  opts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  opt: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
  optActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  optText: { fontSize: 13, fontWeight: '600', color: colors.textSub },
  optTextActive: { color: '#fff' },

  userCard: { marginBottom: 0 },
  userInativo: { opacity: 0.55 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accentLight, alignItems: 'center', justifyContent: 'center' },
  avatarEdit: { backgroundColor: colors.warningLight },
  avatarText: { fontSize: 18, fontWeight: '700', color: colors.primary },
  userInfo: { flex: 1 },
  userName: { fontSize: 14, fontWeight: '700', color: colors.text },
  userMeta: { fontSize: 12, color: colors.textSub },
  userRight: { alignItems: 'flex-end', gap: 4 },
  userActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  editBtn: { padding: 4 },
  editBtnTxt: { fontSize: 12, color: colors.warning, fontWeight: '700' },
  toggleBtn: { padding: 4 },
  toggleText: { fontSize: 12, color: colors.primaryLight, fontWeight: '600' },

  editForm: { gap: 10, marginTop: 4 },
  editDivider: { height: 1, backgroundColor: colors.divider, marginBottom: 6 },
  salvarBtn: { backgroundColor: colors.primary, borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 4 },
  salvarBtnTxt: { color: '#fff', fontSize: 14, fontWeight: '800' },
})
