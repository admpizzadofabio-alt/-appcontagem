import React, { useState, useMemo } from 'react'
import {
  View, Text, ScrollView, StyleSheet, Alert, TouchableOpacity,
  TextInput, Image, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import * as ImagePicker from 'expo-image-picker'
import { useListarProdutosQuery } from '../../services/api/produtos'
import { useRegistrarCorrecaoMutation } from '../../services/api/correcoes'
import { colors } from '../../theme/colors'
import type { AppStackParams } from '../../navigation/types'

type Nav = NativeStackNavigationProp<AppStackParams>
type RouteT = RouteProp<AppStackParams, 'ErroComanda'>

export function ErroComandaScreen() {
  const navigation = useNavigation<Nav>()
  const route = useRoute<RouteT>()
  const { local, turnoId } = route.params

  const { data: produtos = [], isLoading } = useListarProdutosQuery({ ativo: true })
  const [registrar, { isLoading: salvando }] = useRegistrarCorrecaoMutation()

  const [produtoComandadoId, setProdutoComandadoId] = useState('')
  const [produtoServidoId, setProdutoServidoId] = useState('')
  const [quantidade, setQuantidade] = useState('1')
  const [foto, setFoto] = useState<string | null>(null)
  const [observacao, setObservacao] = useState('')
  const [buscaComandado, setBuscaComandado] = useState('')
  const [buscaServido, setBuscaServido] = useState('')
  const [passo, setPasso] = useState<'form' | 'sucesso'>('form')

  const produtosOrdenados = useMemo(
    () => [...produtos].sort((a, b) => a.nomeBebida.localeCompare(b.nomeBebida)),
    [produtos],
  )

  const filtradosComandado = useMemo(
    () => buscaComandado.length > 0
      ? produtosOrdenados.filter((p) => p.nomeBebida.toLowerCase().includes(buscaComandado.toLowerCase()))
      : [],
    [produtosOrdenados, buscaComandado],
  )

  const filtradosServido = useMemo(
    () => buscaServido.length > 0
      ? produtosOrdenados.filter((p) => p.nomeBebida.toLowerCase().includes(buscaServido.toLowerCase()))
      : [],
    [produtosOrdenados, buscaServido],
  )

  const prodComandado = produtos.find((p) => p.id === produtoComandadoId)
  const prodServido = produtos.find((p) => p.id === produtoServidoId)

  async function tirarFoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync()
    if (!perm.granted) {
      Alert.alert('Permissão negada', 'Permita o uso da câmera nas configurações')
      return
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.6,
      base64: true,
    })
    if (!result.canceled && result.assets[0]?.base64) {
      setFoto(`data:image/jpeg;base64,${result.assets[0].base64}`)
    }
  }

  async function handleSalvar() {
    if (!turnoId) { Alert.alert('Atenção', 'É necessário ter um turno aberto para registrar erro de comanda.'); return }
    const qtd = parseFloat(quantidade.replace(',', '.'))
    if (!produtoComandadoId) { Alert.alert('Atenção', 'Selecione o produto que estava na comanda'); return }
    if (!produtoServidoId) { Alert.alert('Atenção', 'Selecione o produto que foi realmente servido'); return }
    if (produtoComandadoId === produtoServidoId) { Alert.alert('Atenção', 'Os produtos não podem ser iguais'); return }
    if (isNaN(qtd) || qtd <= 0) { Alert.alert('Atenção', 'Quantidade inválida'); return }
    if (!foto) { Alert.alert('Atenção', 'Foto da comanda é obrigatória'); return }

    try {
      await registrar({
        local: local as 'Bar' | 'Delivery',
        turnoId: turnoId ?? null,
        produtoComandadoId,
        produtoServidoId,
        quantidade: qtd,
        fotoComanda: foto,
        observacao: observacao.trim() || undefined,
      }).unwrap()
      setPasso('sucesso')
    } catch (e: any) {
      Alert.alert('Erro', e.message ?? 'Falha ao registrar correção')
    }
  }

  if (isLoading) {
    return <SafeAreaView style={s.safe}><ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} /></SafeAreaView>
  }

  if (passo === 'sucesso') {
    return (
      <SafeAreaView style={s.safe} edges={['bottom']}>
        <View style={s.sucessoBox}>
          <Text style={s.sucessoIcon}>✅</Text>
          <Text style={s.sucessoTitle}>Correção registrada</Text>
          <Text style={s.sucessoSub}>
            O estoque de {prodServido?.nomeBebida} foi ajustado corretamente.{'\n'}
            A comanda de {prodComandado?.nomeBebida} ficará pendente para o Admin conciliar.
          </Text>
          <TouchableOpacity style={s.btnVoltar} onPress={() => navigation.goBack()}>
            <Text style={s.btnVoltarTxt}>Voltar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <ScrollView style={s.scroll} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">

        <View style={s.localBanner}>
          <Text style={s.localBannerTxt}>📍 Setor: <Text style={s.localBannerDestaque}>{local}</Text></Text>
          {!turnoId && <Text style={s.semTurnoTxt}>⚠️ Sem turno aberto — registro bloqueado</Text>}
        </View>

        <View style={s.alertBanner}>
          <Text style={s.alertTxt}>
            📋 Use quando o produto servido foi diferente do que está na comanda.{'\n'}
            Foto da comanda é obrigatória como comprovante.
          </Text>
        </View>

        {/* Produto na comanda (errado) */}
        <Text style={s.fieldLabel}>Na comanda (produto errado) *</Text>
        {prodComandado ? (
          <TouchableOpacity style={s.selectedProd} onPress={() => { setProdutoComandadoId(''); setBuscaComandado('') }}>
            <Text style={s.selectedProdNome}>{prodComandado.nomeBebida}</Text>
            <Text style={s.selectedProdSub}>Toque para alterar</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TextInput
              style={s.input}
              value={buscaComandado}
              onChangeText={setBuscaComandado}
              placeholder="Buscar produto..."
              placeholderTextColor={colors.textMuted}
            />
            {filtradosComandado.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={s.prodItem}
                onPress={() => { setProdutoComandadoId(p.id); setBuscaComandado('') }}
              >
                <Text style={s.prodItemTxt}>{p.nomeBebida}</Text>
                <Text style={s.prodItemSub}>{p.categoria}</Text>
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* Produto servido (certo) */}
        <Text style={[s.fieldLabel, { marginTop: 16 }]}>Realmente servido (produto certo) *</Text>
        {prodServido ? (
          <TouchableOpacity style={[s.selectedProd, s.selectedProdVerde]} onPress={() => { setProdutoServidoId(''); setBuscaServido('') }}>
            <Text style={s.selectedProdNome}>{prodServido.nomeBebida}</Text>
            <Text style={s.selectedProdSub}>Toque para alterar</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TextInput
              style={s.input}
              value={buscaServido}
              onChangeText={setBuscaServido}
              placeholder="Buscar produto..."
              placeholderTextColor={colors.textMuted}
            />
            {filtradosServido.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={s.prodItem}
                onPress={() => { setProdutoServidoId(p.id); setBuscaServido('') }}
              >
                <Text style={s.prodItemTxt}>{p.nomeBebida}</Text>
                <Text style={s.prodItemSub}>{p.categoria}</Text>
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* Quantidade */}
        <Text style={[s.fieldLabel, { marginTop: 16 }]}>Quantidade *</Text>
        <TextInput
          style={[s.input, s.inputQtd]}
          value={quantidade}
          onChangeText={setQuantidade}
          keyboardType="decimal-pad"
          placeholder="1"
          placeholderTextColor={colors.textMuted}
          selectTextOnFocus
        />

        {/* Foto da comanda */}
        <Text style={[s.fieldLabel, { marginTop: 16 }]}>📸 Foto da comanda * (obrigatória)</Text>
        {foto && <Image source={{ uri: foto }} style={s.fotoPreview} />}
        <TouchableOpacity style={s.fotoBtn} onPress={tirarFoto}>
          <Text style={s.fotoBtnTxt}>{foto ? '🔄 Tirar outra foto' : '📷 Tirar foto da comanda'}</Text>
        </TouchableOpacity>

        {/* Observação */}
        <Text style={[s.fieldLabel, { marginTop: 16 }]}>Observação (opcional)</Text>
        <TextInput
          style={s.input}
          value={observacao}
          onChangeText={setObservacao}
          placeholder="Detalhes adicionais..."
          placeholderTextColor={colors.textMuted}
          multiline
        />

        <TouchableOpacity
          style={[s.btnSalvar, salvando && { opacity: 0.6 }]}
          onPress={handleSalvar}
          disabled={salvando}
        >
          <Text style={s.btnSalvarTxt}>{salvando ? 'Registrando...' : 'Registrar correção'}</Text>
        </TouchableOpacity>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 6 },

  localBanner: { backgroundColor: colors.infoLight, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: colors.info },
  localBannerTxt: { fontSize: 13, color: colors.info, fontWeight: '600' },
  localBannerDestaque: { fontWeight: '800', fontSize: 15 },
  semTurnoTxt: { fontSize: 12, color: colors.danger, fontWeight: '700', marginTop: 4 },
  alertBanner: { backgroundColor: colors.warningLight, borderRadius: 12, padding: 12, marginBottom: 8 },
  alertTxt: { fontSize: 12, color: colors.warning, lineHeight: 18 },

  fieldLabel: { fontSize: 11, fontWeight: '700', color: colors.textSub, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, fontSize: 14, color: colors.text, backgroundColor: colors.surface, minHeight: 44 },
  inputQtd: { fontSize: 24, fontWeight: '800', textAlign: 'center', paddingVertical: 16 },

  selectedProd: { borderWidth: 2, borderColor: colors.danger, borderRadius: 10, padding: 12, backgroundColor: colors.dangerLight },
  selectedProdVerde: { borderColor: colors.success, backgroundColor: colors.successLight },
  selectedProdNome: { fontSize: 15, fontWeight: '700', color: colors.text },
  selectedProdSub: { fontSize: 11, color: colors.textSub, marginTop: 2 },

  prodItem: { paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface, borderRadius: 8, marginBottom: 2 },
  prodItemTxt: { fontSize: 14, fontWeight: '600', color: colors.text },
  prodItemSub: { fontSize: 11, color: colors.textSub, marginTop: 2 },

  fotoPreview: { width: '100%', height: 180, borderRadius: 10, marginBottom: 8 },
  fotoBtn: { padding: 14, borderRadius: 10, borderWidth: 1, borderColor: colors.primary, alignItems: 'center', backgroundColor: colors.accentLight },
  fotoBtnTxt: { fontSize: 13, fontWeight: '700', color: colors.primary },

  btnSalvar: { marginTop: 20, padding: 16, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center' },
  btnSalvarTxt: { fontSize: 15, fontWeight: '800', color: '#fff' },

  sucessoBox: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 16 },
  sucessoIcon: { fontSize: 64 },
  sucessoTitle: { fontSize: 20, fontWeight: '800', color: colors.text, textAlign: 'center' },
  sucessoSub: { fontSize: 14, color: colors.textSub, textAlign: 'center', lineHeight: 20 },
  btnVoltar: { marginTop: 16, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12, backgroundColor: colors.primary },
  btnVoltarTxt: { fontSize: 15, fontWeight: '700', color: '#fff' },
})
