import React from 'react'
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Alert } from 'react-native'
import { useImportarPendenteMutation, useUltimaImportacaoQuery } from '../services/api/colibri'
import { colors } from '../theme/colors'

function fmtDataHora(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function horasDesde(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (60 * 60 * 1000))
}

interface Props {
  /** Compact: card menor sem borda, pra usar dentro de outros containers (ex.: Home). */
  compact?: boolean
}

export function BotaoColibriCarregar({ compact = false }: Props) {
  const { data: ultima, refetch } = useUltimaImportacaoQuery()
  const [importar, { isLoading }] = useImportarPendenteMutation()

  const desatualizada = ultima ? horasDesde(ultima.importadoEm) >= 12 : true

  async function carregar() {
    try {
      const r = await importar().unwrap()
      refetch()

      if (r.status === 'aguardando') {
        Alert.alert('Aguardando Colibri', r.aviso ?? 'Dados ainda subindo no Colibri.')
        return
      }
      if (r.status === 'em_andamento') {
        Alert.alert('Importação em andamento', 'Aguarde alguns segundos e tente novamente.')
        return
      }
      if (r.status === 'sem_periodo') {
        Alert.alert('Tudo em dia', r.aviso ?? 'Nenhum período pendente.')
        return
      }

      const periodo = r.dataInicio === r.dataFim ? r.dataInicio : `${r.dataInicio} a ${r.dataFim}`
      Alert.alert(
        'Importação concluída',
        `Período: ${periodo}\n\n` +
          `✓ ${r.totalImportados} produto(s) atualizado(s)\n` +
          `📦 ${r.totalVendas} venda(s) processada(s)\n` +
          (r.totalIgnorados > 0 ? `⚠️ ${r.totalIgnorados} ignorada(s) (sem mapeamento)\n` : '') +
          (r.erros.length > 0 ? `\n❌ ${r.erros.length} erro(s)` : ''),
      )
    } catch (e: any) {
      Alert.alert('Erro ao importar', e?.data?.message ?? e?.message ?? 'Falha desconhecida')
    }
  }

  return (
    <View style={[s.wrap, compact && s.wrapCompact, desatualizada && !compact && s.wrapAlerta]}>
      <View style={s.row}>
        <Text style={s.icon}>🛒</Text>
        <View style={{ flex: 1 }}>
          <Text style={s.titulo}>Vendas Colibri</Text>
          {ultima ? (
            <Text style={s.sub}>
              Última: {fmtDataHora(ultima.importadoEm)} ·{' '}
              <Text style={ultima.status === 'ok' ? s.statusOk : s.statusParcial}>
                {ultima.totalImportados} prod ({ultima.status})
              </Text>
            </Text>
          ) : (
            <Text style={s.sub}>Nunca importado</Text>
          )}
          {desatualizada && ultima && (
            <Text style={s.alerta}>⚠️ Última importação há mais de 12h</Text>
          )}
        </View>
      </View>

      <TouchableOpacity
        style={[s.btn, isLoading && s.btnDisabled]}
        onPress={carregar}
        disabled={isLoading}
        activeOpacity={0.85}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={s.btnTxt}>Carregar Vendas Colibri</Text>
        )}
      </TouchableOpacity>
    </View>
  )
}

const s = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  wrapCompact: {
    padding: 12,
    borderWidth: 0,
    backgroundColor: colors.surfaceAlt,
  },
  wrapAlerta: {
    borderColor: colors.warning,
    backgroundColor: '#FFF8E7',
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  icon: { fontSize: 22 },
  titulo: { fontSize: 14, fontWeight: '700', color: colors.text },
  sub: { fontSize: 12, color: colors.textSub, marginTop: 2 },
  statusOk: { color: colors.success, fontWeight: '600' },
  statusParcial: { color: colors.warning, fontWeight: '600' },
  alerta: { fontSize: 11, color: colors.warning, fontWeight: '600', marginTop: 4 },
  btn: {
    backgroundColor: colors.primary,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnTxt: { color: '#fff', fontWeight: '700', fontSize: 13 },
})
