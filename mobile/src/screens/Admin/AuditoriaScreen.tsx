import React, { useState } from 'react'
import { View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Card } from '../../components/Card'
import { SectionHeader } from '../../components/SectionHeader'
import { colors } from '../../theme/colors'
import { useAuditoriaQuery } from '../../services/api/relatorios'

const ACOES_COMUNS = ['LOGIN', 'TURNO_ABERTO', 'CONTAGEM', 'MOVIMENTACAO', 'COLIBRI', 'APROVACAO', 'REJEICAO']

function fmtData(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function AuditoriaScreen() {
  const [busca, setBusca] = useState('')
  const [acao, setAcao] = useState<string | undefined>()
  const [page, setPage] = useState(0)
  const take = 50
  const { data, isLoading } = useAuditoriaQuery({ busca: busca || undefined, acao, take, skip: page * take })

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView style={s.scroll} contentContainerStyle={s.content}>
        <Text style={s.pageTitle}>📋 Auditoria</Text>

        <Card>
          <SectionHeader title="Filtros" />
          <Text style={s.label}>Busca (nome, detalhes, ID)</Text>
          <TextInput
            style={s.input}
            placeholder="Buscar..."
            placeholderTextColor={colors.textMuted}
            value={busca}
            onChangeText={(t) => { setBusca(t); setPage(0) }}
          />
          <Text style={[s.label, { marginTop: 8 }]}>Ação</Text>
          <View style={s.chips}>
            <TouchableOpacity style={[s.chip, !acao && s.chipAtivo]} onPress={() => { setAcao(undefined); setPage(0) }}>
              <Text style={[s.chipTxt, !acao && s.chipTxtAtivo]}>Todas</Text>
            </TouchableOpacity>
            {ACOES_COMUNS.map((a) => (
              <TouchableOpacity key={a} style={[s.chip, acao === a && s.chipAtivo]} onPress={() => { setAcao(a); setPage(0) }}>
                <Text style={[s.chipTxt, acao === a && s.chipTxtAtivo]}>{a}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {isLoading && <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />}

        {data && (
          <>
            <Text style={s.total}>
              {data.total} registro(s) · página {page + 1} de {Math.max(1, Math.ceil(data.total / take))}
            </Text>

            {data.items.map((log) => (
              <Card key={log.id} style={s.logCard}>
                <View style={s.logHeader}>
                  <Text style={s.logAcao}>{log.acao}</Text>
                  <Text style={s.logData}>{fmtData(log.dataEvento)}</Text>
                </View>
                <Text style={s.logUsuario}>{log.usuarioNome} · {log.setor}</Text>
                <Text style={s.logEntidade}>{log.entidade}{log.idReferencia ? ` #${log.idReferencia.slice(0, 8)}` : ''}</Text>
                {log.detalhes && (
                  <Text style={s.logDetalhes} numberOfLines={3}>{log.detalhes}</Text>
                )}
              </Card>
            ))}

            <View style={s.pagination}>
              <TouchableOpacity
                style={[s.pageBtn, page === 0 && s.pageBtnDisabled]}
                disabled={page === 0}
                onPress={() => setPage((p) => p - 1)}
              >
                <Text style={s.pageBtnTxt}>← Anterior</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.pageBtn, (page + 1) * take >= data.total && s.pageBtnDisabled]}
                disabled={(page + 1) * take >= data.total}
                onPress={() => setPage((p) => p + 1)}
              >
                <Text style={s.pageBtnTxt}>Próxima →</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 8, paddingBottom: 40 },
  pageTitle: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 4 },
  label: { fontSize: 12, color: colors.textSub, marginBottom: 4 },
  input: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, fontSize: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipAtivo: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipTxt: { fontSize: 11, color: colors.text, fontWeight: '600' },
  chipTxtAtivo: { color: '#fff' },
  total: { fontSize: 12, color: colors.textSub, marginVertical: 8 },
  logCard: { padding: 12, gap: 4 },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  logAcao: { fontSize: 13, fontWeight: '700', color: colors.primary },
  logData: { fontSize: 11, color: colors.textSub },
  logUsuario: { fontSize: 12, color: colors.text, fontWeight: '600' },
  logEntidade: { fontSize: 11, color: colors.textSub },
  logDetalhes: { fontSize: 11, color: colors.textMuted, fontFamily: 'monospace', marginTop: 4 },
  pagination: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, gap: 8 },
  pageBtn: { flex: 1, padding: 12, backgroundColor: colors.primary, borderRadius: 8, alignItems: 'center' },
  pageBtnDisabled: { opacity: 0.4 },
  pageBtnTxt: { color: '#fff', fontWeight: '700' },
})
