import React, { useState } from 'react'
import { View, Text, ScrollView, StyleSheet, Alert, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { useListarProdutosQuery } from '../../services/api/produtos'
import { useCriarMovimentacaoMutation } from '../../services/api/movimentacoes'
import { useLocalAcesso } from '../../hooks/useLocalAcesso'
import { ActionButton } from '../../components/ActionButton'
import { Card } from '../../components/Card'
import { colors } from '../../theme/colors'

export function TransferenciaScreen() {
  const nav = useNavigation()
  const { veTodosLocais, localOperador, localOposto } = useLocalAcesso()
  const { data: produtos = [] } = useListarProdutosQuery({ ativo: true })
  const [criar, { isLoading }] = useCriarMovimentacaoMutation()

  const [produtoId, setProdutoId] = useState('')
  const [quantidade, setQuantidade] = useState('')
  const [origem, setOrigem] = useState<'Bar' | 'Delivery'>(localOperador)
  const [destino, setDestino] = useState<'Bar' | 'Delivery'>(localOposto)
  const [busca, setBusca] = useState('')

  const filtrados = produtos.filter((p) => p.nomeBebida.toLowerCase().includes(busca.toLowerCase()))
  const selecionado = produtos.find((p) => p.id === produtoId)

  async function handleSubmit() {
    if (!produtoId) return Alert.alert('Atenção', 'Selecione um produto.')
    if (origem === destino) return Alert.alert('Atenção', 'Origem e destino devem ser diferentes.')
    const qtd = parseFloat(quantidade)
    if (!qtd || qtd <= 0) return Alert.alert('Atenção', 'Informe a quantidade.')

    try {
      await criar({ produtoId, quantidade: qtd, tipoMov: 'Transferencia', localOrigem: origem, localDestino: destino }).unwrap()
      Alert.alert('Sucesso', `Transferência de ${qtd} ${selecionado?.unidadeMedida ?? ''} registrada!`, [{ text: 'OK', onPress: () => nav.goBack() }])
    } catch (e: any) {
      Alert.alert('Erro', e.message ?? 'Não foi possível transferir.')
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <ScrollView style={s.scroll} contentContainerStyle={s.content}>

        <Card>
          <Text style={s.label}>Produto</Text>
          <TextInput style={s.input} placeholder="Buscar..." placeholderTextColor={colors.textMuted} value={busca} onChangeText={setBusca} />
          <ScrollView style={s.list} nestedScrollEnabled>
            {filtrados.map((p) => (
              <Text key={p.id} style={[s.prodItem, produtoId === p.id && s.prodActive]}
                onPress={() => { setProdutoId(p.id); setBusca(p.nomeBebida) }}>
                {p.nomeBebida}
              </Text>
            ))}
          </ScrollView>
        </Card>

        <Card>
          <Text style={s.label}>Quantidade</Text>
          <TextInput style={s.inputLarge} placeholder="0" placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad" value={quantidade} onChangeText={setQuantidade} />
        </Card>

        <Card>
          <Text style={s.label}>De → Para</Text>
          {veTodosLocais ? (
            <>
              <View style={s.transferRow}>
                <View style={s.localBox}>
                  <Text style={s.localLabel}>Origem</Text>
                  {(['Bar', 'Delivery'] as const).map((l) => (
                    <Text key={l} style={[s.localOpt, origem === l && s.localOptActive]} onPress={() => setOrigem(l)}>{l}</Text>
                  ))}
                </View>
                <Text style={s.arrow}>→</Text>
                <View style={s.localBox}>
                  <Text style={s.localLabel}>Destino</Text>
                  {(['Bar', 'Delivery'] as const).map((l) => (
                    <Text key={l} style={[s.localOpt, destino === l && s.localOptActive]} onPress={() => setDestino(l)}>{l}</Text>
                  ))}
                </View>
              </View>
              {origem === destino && <Text style={s.warning}>Origem e destino devem ser diferentes</Text>}
            </>
          ) : (
            <View style={s.transferRow}>
              <View style={s.localBox}>
                <Text style={s.localLabel}>Origem</Text>
                <Text style={[s.localOpt, s.localOptActive]}>📍 {origem}</Text>
              </View>
              <Text style={s.arrow}>→</Text>
              <View style={s.localBox}>
                <Text style={s.localLabel}>Destino</Text>
                <Text style={[s.localOpt, s.localOptActive]}>{destino}</Text>
              </View>
            </View>
          )}
        </Card>

        <ActionButton label="Confirmar Transferência" onPress={handleSubmit} loading={isLoading} icon="🔄" />
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  label: { fontSize: 13, fontWeight: '700', color: colors.textSub, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  input: { backgroundColor: colors.surfaceAlt, borderRadius: 10, paddingHorizontal: 14, height: 44, fontSize: 14, color: colors.text, borderWidth: 1, borderColor: colors.border },
  inputLarge: { backgroundColor: colors.surfaceAlt, borderRadius: 10, height: 72, fontSize: 32, fontWeight: '700', color: colors.text, textAlign: 'center', borderWidth: 1, borderColor: colors.border },
  list: { maxHeight: 160 },
  prodItem: { padding: 10, borderRadius: 8, fontSize: 14, color: colors.text, marginBottom: 2 },
  prodActive: { backgroundColor: colors.primary, color: '#fff' },
  transferRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  localBox: { flex: 1, gap: 8 },
  localLabel: { fontSize: 12, color: colors.textSub, fontWeight: '600' },
  localOpt: { padding: 12, borderRadius: 10, backgroundColor: colors.surfaceAlt, textAlign: 'center', fontWeight: '600', color: colors.text, borderWidth: 1, borderColor: colors.border },
  localOptActive: { backgroundColor: colors.primary, color: '#fff', borderColor: colors.primary },
  arrow: { fontSize: 24, color: colors.primary, fontWeight: '700' },
  warning: { color: colors.danger, fontSize: 12, marginTop: 8 },
})
