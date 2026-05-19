import React, { useState } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, TextInput, Modal, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useListarTurnosAdminQuery, useApagarTurnoAdminMutation, type TurnoAdminItem } from '../../services/api/turnos'
import { CalendarPicker } from '../../components/CalendarPicker'
import { colors } from '../../theme/colors'

type Local = 'Bar' | 'Delivery' | 'Vinhos' | ''

function fmtData(iso: string) {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function TurnosAdminScreen() {
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [local, setLocal] = useState<Local>('')
  const [alvo, setAlvo] = useState<TurnoAdminItem | null>(null)
  const [motivo, setMotivo] = useState('')

  const filtros = {
    dataInicio: dataInicio || undefined,
    dataFim: dataFim || undefined,
    local: local || undefined,
  }
  const { data: turnos = [], isLoading, refetch } = useListarTurnosAdminQuery(filtros)
  const [apagar, { isLoading: apagando }] = useApagarTurnoAdminMutation()

  async function confirmarExclusao() {
    if (!alvo) return
    if (motivo.trim().length < 10) {
      Alert.alert('Motivo obrigatório', 'Descreva o motivo (mínimo 10 caracteres).')
      return
    }
    try {
      await apagar({ id: alvo.id, motivo: motivo.trim() }).unwrap()
      setAlvo(null)
      setMotivo('')
      Alert.alert('✅ Turno apagado', 'Rollback completo: estoque, ajustes de contagem e vendas Colibri do turno foram revertidos.')
      refetch()
    } catch (e: any) {
      Alert.alert('Erro', e?.data?.message ?? 'Falha ao apagar turno')
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.content}>

        <View style={s.aviso}>
          <Text style={s.avisoTxt}>
            ⚠️ Apagar turno faz ROLLBACK COMPLETO: reverte estoque, apaga ajustes de contagem e estorna vendas Colibri do período. Use com cuidado.
          </Text>
        </View>

        <Text style={s.label}>Data início</Text>
        <CalendarPicker value={dataInicio} onChange={setDataInicio} placeholder="Todas as datas" />

        <Text style={s.label}>Data fim</Text>
        <CalendarPicker value={dataFim} onChange={setDataFim} placeholder="Todas as datas" />

        <Text style={s.label}>Local</Text>
        <View style={s.chipRow}>
          {(['', 'Bar', 'Delivery', 'Vinhos'] as Local[]).map((l) => (
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

        {!isLoading && turnos.length === 0 && (
          <Text style={s.vazio}>Nenhum turno encontrado no período.</Text>
        )}

        {turnos.map((t) => (
          <View key={t.id} style={s.card}>
            <View style={s.cardHead}>
              <Text style={s.cardTitle}>{t.local}</Text>
              <View style={[s.statusBadge, t.status === 'Fechado' ? s.badgeOk : s.badgeOpen]}>
                <Text style={s.statusTxt}>{t.status}</Text>
              </View>
            </View>
            <Text style={s.cardMeta}>📅 Aberto: {fmtData(t.abertoEm)}</Text>
            {t.fechadoEm && <Text style={s.cardMeta}>🔒 Fechado: {fmtData(t.fechadoEm)}</Text>}
            <Text style={s.cardMeta}>👤 {t.operadorNome}</Text>
            <Text style={s.cardMeta}>📊 {t.totalDivergencias} divergência(s) · R$ {t.valorDivergencias.toFixed(2)}</Text>
            {!t.contagemId && <Text style={s.cardMetaAlerta}>⚠️ Sem contagem associada</Text>}
            <TouchableOpacity
              style={s.btnExcluir}
              onPress={() => { setAlvo(t); setMotivo('') }}
              activeOpacity={0.8}
            >
              <Text style={s.btnExcluirTxt}>🗑️  Apagar turno (rollback completo)</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      <Modal visible={alvo !== null} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>Apagar turno</Text>
            <Text style={s.modalSub}>
              {alvo && `${alvo.local} · ${fmtData(alvo.abertoEm)}`}
            </Text>

            <View style={s.alertaModal}>
              <Text style={s.alertaModalTxt}>
                🚨 Esta ação é IRREVERSÍVEL e vai:{'\n'}
                • Reverter ajustes de contagem no estoque{'\n'}
                • Estornar vendas Colibri do turno{'\n'}
                • Apagar contagem, itens e rascunhos{'\n'}
                • Desvincular correções de venda
              </Text>
            </View>

            <Text style={s.modalLabel}>Motivo (obrigatório, mínimo 10 caracteres)</Text>
            <TextInput
              style={[s.input, { height: 80 }]}
              value={motivo}
              onChangeText={setMotivo}
              placeholder="Ex: Turno de teste, dia errado, valores incorretos..."
              placeholderTextColor={colors.textMuted}
              multiline
              textAlignVertical="top"
            />

            <View style={s.modalAcoes}>
              <TouchableOpacity style={s.btnCancelar} onPress={() => { setAlvo(null); setMotivo('') }}>
                <Text style={s.btnCancelarTxt}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.btnConfirmar, apagando && { opacity: 0.6 }]}
                onPress={confirmarExclusao}
                disabled={apagando}
              >
                <Text style={s.btnConfirmarTxt}>{apagando ? 'Apagando...' : 'Confirmar rollback'}</Text>
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

  aviso:    { backgroundColor: '#FDEAEA', borderRadius: 10, padding: 12, borderLeftWidth: 4, borderLeftColor: '#C0392B', marginBottom: 16 },
  avisoTxt: { fontSize: 12, color: '#7D1F1F', lineHeight: 18 },

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
  cardMetaAlerta: { fontSize: 12, color: colors.warning, fontWeight: '600' },

  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeOk:     { backgroundColor: colors.successLight },
  badgeOpen:   { backgroundColor: colors.warningLight },
  statusTxt:   { fontSize: 11, fontWeight: '700', color: colors.text },

  btnExcluir:    { marginTop: 10, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.danger, alignItems: 'center' },
  btnExcluirTxt: { color: colors.danger, fontSize: 13, fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal:        { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 14 },
  modalTitle:   { fontSize: 17, fontWeight: '800', color: colors.text },
  modalSub:     { fontSize: 13, color: colors.textSub, marginTop: -6 },
  modalLabel:   { fontSize: 12, fontWeight: '700', color: colors.textSub },

  alertaModal:    { backgroundColor: '#FDEAEA', borderRadius: 10, padding: 12, borderLeftWidth: 4, borderLeftColor: '#C0392B' },
  alertaModalTxt: { fontSize: 12, color: '#7D1F1F', lineHeight: 18 },

  modalAcoes:     { flexDirection: 'row', gap: 10, marginTop: 6 },
  btnCancelar:    { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  btnCancelarTxt: { fontSize: 14, fontWeight: '700', color: colors.textSub },
  btnConfirmar:   { flex: 1, padding: 14, borderRadius: 12, backgroundColor: colors.danger, alignItems: 'center' },
  btnConfirmarTxt:{ fontSize: 14, fontWeight: '700', color: '#fff' },
})
