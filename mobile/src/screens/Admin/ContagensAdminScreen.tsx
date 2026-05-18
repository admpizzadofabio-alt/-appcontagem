import React, { useState } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, TextInput, Modal, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useListarContagensAdminQuery, useExcluirContagemMutation, type ContagemAdminItem } from '../../services/api/turnos'
import { colors } from '../../theme/colors'

type Local = 'Bar' | 'Delivery' | ''

function fmtData(iso: string) {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function ContagensAdminScreen() {
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [local, setLocal] = useState<Local>('')
  const [alvo, setAlvo] = useState<ContagemAdminItem | null>(null)
  const [motivo, setMotivo] = useState('')

  const filtros = {
    dataInicio: dataInicio || undefined,
    dataFim: dataFim || undefined,
    local: local || undefined,
  }
  const { data: contagens = [], isLoading, refetch } = useListarContagensAdminQuery(filtros)
  const [excluir, { isLoading: excluindo }] = useExcluirContagemMutation()

  async function confirmarExclusao() {
    if (!alvo) return
    if (motivo.trim().length < 10) {
      Alert.alert('Motivo obrigatório', 'Descreva o motivo da exclusão (mínimo 10 caracteres).')
      return
    }
    try {
      await excluir({ id: alvo.id, motivo: motivo.trim() }).unwrap()
      setAlvo(null)
      setMotivo('')
      Alert.alert('✅ Contagem excluída', 'O registro foi removido do histórico. O estoque atual permanece como está.')
      refetch()
    } catch (e: any) {
      Alert.alert('Erro', e?.data?.message ?? 'Falha ao excluir contagem')
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.content}>

        <View style={s.aviso}>
          <Text style={s.avisoTxt}>
            ⚠️ Excluir apenas remove o registro do histórico. Os ajustes de estoque já aplicados NÃO serão revertidos.
          </Text>
        </View>

        <Text style={s.label}>Data início (YYYY-MM-DD)</Text>
        <TextInput
          style={s.input}
          value={dataInicio}
          onChangeText={setDataInicio}
          placeholder="2026-05-01"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
        />

        <Text style={s.label}>Data fim (YYYY-MM-DD)</Text>
        <TextInput
          style={s.input}
          value={dataFim}
          onChangeText={setDataFim}
          placeholder="2026-05-17"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
        />

        <Text style={s.label}>Local</Text>
        <View style={s.chipRow}>
          {(['', 'Bar', 'Delivery'] as Local[]).map((l) => (
            <TouchableOpacity
              key={l || 'todos'}
              style={[s.chip, local === l && s.chipActive]}
              onPress={() => setLocal(l)}
            >
              <Text style={[s.chipTxt, local === l && s.chipTxtActive]}>{l || 'Todos'}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 16 }} />

        {isLoading && <ActivityIndicator color={colors.primary} />}

        {!isLoading && contagens.length === 0 && (
          <Text style={s.vazio}>Nenhuma contagem encontrada no período.</Text>
        )}

        {contagens.map((c) => (
          <View key={c.id} style={s.card}>
            <View style={s.cardHead}>
              <Text style={s.cardTitle}>{c.local}</Text>
              <View style={[s.statusBadge, c.status === 'Fechada' ? s.badgeOk : s.badgeOpen]}>
                <Text style={s.statusTxt}>{c.status}</Text>
              </View>
            </View>
            <Text style={s.cardMeta}>📅 {fmtData(c.dataAbertura)}</Text>
            <Text style={s.cardMeta}>👤 {c.operador.nome}</Text>
            <Text style={s.cardMeta}>📦 {c._count.itens} item(s) · {c.totalDesvios} divergência(s)</Text>
            <TouchableOpacity
              style={s.btnExcluir}
              onPress={() => { setAlvo(c); setMotivo('') }}
              activeOpacity={0.8}
            >
              <Text style={s.btnExcluirTxt}>🗑️  Excluir do histórico</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      {/* Modal motivo */}
      <Modal visible={alvo !== null} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>Excluir contagem</Text>
            <Text style={s.modalSub}>
              {alvo && `${alvo.local} · ${fmtData(alvo.dataAbertura)}`}
            </Text>

            <Text style={s.modalLabel}>Motivo (obrigatório, mínimo 10 caracteres)</Text>
            <TextInput
              style={[s.input, { height: 80 }]}
              value={motivo}
              onChangeText={setMotivo}
              placeholder="Ex: Contagem realizada com produtos errados, será refeita..."
              placeholderTextColor={colors.textMuted}
              multiline
              textAlignVertical="top"
            />

            <View style={s.modalAcoes}>
              <TouchableOpacity style={s.btnCancelar} onPress={() => { setAlvo(null); setMotivo('') }}>
                <Text style={s.btnCancelarTxt}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.btnConfirmar, excluindo && { opacity: 0.6 }]}
                onPress={confirmarExclusao}
                disabled={excluindo}
              >
                <Text style={s.btnConfirmarTxt}>{excluindo ? 'Excluindo...' : 'Confirmar exclusão'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 32 },

  aviso:    { backgroundColor: '#FFF3CD', borderRadius: 10, padding: 12, borderLeftWidth: 4, borderLeftColor: '#FFC107', marginBottom: 16 },
  avisoTxt: { fontSize: 12, color: '#7D5400', lineHeight: 18 },

  label: { fontSize: 11, fontWeight: '700', color: colors.textSub, textTransform: 'uppercase', marginTop: 12, marginBottom: 6 },
  input: { backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: colors.text, borderWidth: 1, borderColor: colors.border },

  chipRow:      { flexDirection: 'row', gap: 8, marginTop: 4 },
  chip:         { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  chipActive:   { backgroundColor: colors.primary, borderColor: colors.primary },
  chipTxt:      { fontSize: 13, fontWeight: '600', color: colors.textSub },
  chipTxtActive:{ color: '#fff' },

  vazio: { textAlign: 'center', color: colors.textSub, marginTop: 24, fontSize: 13 },

  card:     { backgroundColor: colors.surface, borderRadius: 14, padding: 14, gap: 4, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardTitle:{ fontSize: 15, fontWeight: '800', color: colors.text },
  cardMeta: { fontSize: 12, color: colors.textSub },

  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeOk:     { backgroundColor: colors.successLight },
  badgeOpen:   { backgroundColor: colors.warningLight },
  statusTxt:   { fontSize: 11, fontWeight: '700', color: colors.text },

  btnExcluir:    { marginTop: 10, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.danger, alignItems: 'center' },
  btnExcluirTxt: { color: colors.danger, fontSize: 13, fontWeight: '700' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 14 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  modalSub:   { fontSize: 13, color: colors.textSub, marginTop: -6 },
  modalLabel: { fontSize: 12, fontWeight: '700', color: colors.textSub },

  modalAcoes:     { flexDirection: 'row', gap: 10, marginTop: 6 },
  btnCancelar:    { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  btnCancelarTxt: { fontSize: 14, fontWeight: '700', color: colors.textSub },
  btnConfirmar:   { flex: 1, padding: 14, borderRadius: 12, backgroundColor: colors.danger, alignItems: 'center' },
  btnConfirmarTxt:{ fontSize: 14, fontWeight: '700', color: '#fff' },
})
