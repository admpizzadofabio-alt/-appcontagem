import React, { useState } from 'react'
import { View, Text, ScrollView, StyleSheet, Alert, TextInput, Modal, Pressable, TouchableOpacity, Image } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native'
import { useListarProdutosQuery } from '../../services/api/produtos'
import { useCriarMovimentacaoMutation } from '../../services/api/movimentacoes'
import { useVerificarEntradaMutation, useTurnoAtualQuery, type VerificarEntradaResult } from '../../services/api/turnos'
import { useLocalAcesso } from '../../hooks/useLocalAcesso'
import * as ImagePicker from 'expo-image-picker'
import { ActionButton } from '../../components/ActionButton'
import { Card } from '../../components/Card'
import { colors } from '../../theme/colors'
import type { AppStackParams } from '../../navigation/types'

type Route = RouteProp<AppStackParams, 'Movimentacao'>

const MOTIVOS_PERDA = ['Quebra/Queda', 'Vencimento', 'Consumo interno', 'Erro de contagem', 'Outro']
const LOCAIS = ['Bar', 'Delivery']

export function MovimentacaoScreen() {
  const { params } = useRoute<Route>()
  const nav = useNavigation()
  const tipo = params.tipo
  const { veTodosLocais, localOperador } = useLocalAcesso()

  const { data: produtos = [] } = useListarProdutosQuery({ ativo: true })
  const [criar, { isLoading }] = useCriarMovimentacaoMutation()
  const [verificar] = useVerificarEntradaMutation()

  const [produtoId, setProdutoId] = useState('')
  const [quantidade, setQuantidade] = useState('')
  const [local, setLocal] = useState<'Bar' | 'Delivery'>(localOperador)
  const [motivo, setMotivo] = useState('')
  const [observacao, setObservacao] = useState('')
  const [busca, setBusca] = useState('')
  const [verificacao, setVerificacao] = useState<VerificarEntradaResult | null>(null)
  const [justificativa, setJustificativa] = useState('')
  const [fotoPerda, setFotoPerda] = useState<string | null>(null)

  const { data: turnoAtual } = useTurnoAtualQuery(
    { local: local as 'Bar' | 'Delivery' },
    { skip: tipo !== 'AjustePerda' },
  )

  const produtosFiltrados = produtos.filter((p) =>
    p.nomeBebida.toLowerCase().includes(busca.toLowerCase())
  )
  const produtoSelecionado = produtos.find((p) => p.id === produtoId)

  const qtdNum = parseFloat(quantidade)
  const isGrandePerda = tipo === 'AjustePerda' && !!produtoSelecionado && qtdNum > 0 && qtdNum > produtoSelecionado.perdaThreshold
  const bloqueadoSemTurno = isGrandePerda && !turnoAtual
  const avisoContagemAberta = isGrandePerda && !!turnoAtual && turnoAtual.contagem?.status !== 'Fechada'

  async function tirarFotoPerda() {
    const perm = await ImagePicker.requestCameraPermissionsAsync()
    if (!perm.granted) { Alert.alert('Permissão negada', 'Permita o uso da câmera nas configurações'); return }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.6, base64: true })
    if (!result.canceled && result.assets[0]?.base64) {
      setFotoPerda(`data:image/jpeg;base64,${result.assets[0].base64}`)
    }
  }

  async function executarRegistro(qtd: number, pendente?: boolean, just?: string) {
    try {
      await criar({
        produtoId, quantidade: qtd, tipoMov: tipo,
        localOrigem: local,
        motivoAjuste: motivo || undefined,
        observacao: observacao || undefined,
        imagemComprovante: fotoPerda || undefined,
        pendente,
        justificativaEntrada: just || undefined,
      }).unwrap()
      if (pendente) {
        Alert.alert('Enviado para aprovação!', 'O Admin irá comparar com as notas fiscais e aprovar ou rejeitar.', [{ text: 'OK', onPress: () => nav.goBack() }])
      } else if (tipo === 'AjustePerda') {
        Alert.alert('Perda registrada!', `${qtd} ${produtoSelecionado?.unidadeMedida ?? 'unidades'} descontadas do estoque ${local}.`, [{ text: 'OK', onPress: () => nav.goBack() }])
      } else if (tipo === 'Entrada') {
        Alert.alert('Entrada registrada!', `${qtd} ${produtoSelecionado?.unidadeMedida ?? 'unidades'} adicionados ao estoque ${local}.\nAdmin pode revisar e corrigir no painel se necessário.`, [{ text: 'OK', onPress: () => nav.goBack() }])
      } else {
        Alert.alert('Sucesso', 'Movimentação registrada!', [{ text: 'OK', onPress: () => nav.goBack() }])
      }
    } catch (e: any) {
      Alert.alert('Erro', e.message ?? 'Não foi possível registrar.')
    }
  }

  async function handleSubmit() {
    if (!produtoId) return Alert.alert('Atenção', 'Selecione um produto.')
    const qtd = parseFloat(quantidade)
    if (!qtd || qtd <= 0) return Alert.alert('Atenção', 'Informe a quantidade.')
    if (tipo === 'AjustePerda' && !motivo) return Alert.alert('Atenção', 'Informe o motivo da perda.')
    if (tipo === 'AjustePerda' && !fotoPerda) return Alert.alert('Atenção', 'Foto da perda é obrigatória.')

    // Anti-duplicação só em entradas normais (não carga inicial)
    if (tipo === 'Entrada') {
      try {
        const v = await verificar({ produtoId, quantidade: qtd }).unwrap()
        if (v.tipo !== 'ok') {
          setVerificacao(v)
          return // Modal vai decidir
        }
      } catch {
        // Se verificação falhar, segue normal
      }
    }

    await executarRegistro(qtd)
  }

  function confirmarComJustificativa() {
    if (!justificativa.trim()) {
      Alert.alert('Atenção', 'Informe a justificativa para enviar à aprovação.')
      return
    }
    const qtd = parseFloat(quantidade)
    setVerificacao(null)
    executarRegistro(qtd, true, justificativa.trim())
    setJustificativa('')
  }

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <ScrollView style={s.scroll} contentContainerStyle={s.content}>

        {tipo === 'Entrada' && (
          <View style={s.bannerEntrada}>
            <Text style={s.bannerCargaIcon}>📥</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.bannerEntradaTitulo}>Entrada de Mercadoria</Text>
              <Text style={s.bannerEntradaSub}>Conte o que chegou e registre. Entra no estoque imediatamente. Admin revisa no painel.</Text>
            </View>
          </View>
        )}

        {tipo === 'CargaInicial' && (
          <View style={s.bannerCarga}>
            <Text style={s.bannerCargaIcon}>📦</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.bannerCargaTitulo}>Carga Inicial de Estoque</Text>
              <Text style={s.bannerCargaSub}>Use para definir o estoque de partida. Não aparece como entrada operacional nos relatórios.</Text>
            </View>
          </View>
        )}

        <Card>
          <Text style={s.sectionTitle}>Produto</Text>
          <TextInput style={s.input} placeholder="Buscar produto..." placeholderTextColor={colors.textMuted} value={busca} onChangeText={setBusca} />
          <ScrollView style={s.list} nestedScrollEnabled>
            {produtosFiltrados.map((p) => (
              <View key={p.id} style={[s.prodItem, produtoId === p.id && s.prodItemActive]}>
                <Text style={[s.prodName, produtoId === p.id && { color: '#fff' }]} onPress={() => { setProdutoId(p.id); setBusca(p.nomeBebida) }}>
                  {p.nomeBebida}
                </Text>
              </View>
            ))}
          </ScrollView>
        </Card>

        <Card>
          <Text style={s.sectionTitle}>Quantidade</Text>
          <TextInput style={s.inputLarge} placeholder="0" placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad" value={quantidade} onChangeText={setQuantidade} />
          {produtoSelecionado && <Text style={s.unit}>{produtoSelecionado.unidadeMedida}</Text>}
        </Card>

        <Card>
          <Text style={s.sectionTitle}>Local</Text>
          {veTodosLocais ? (
            <View style={s.tabs}>
              {LOCAIS.map((l) => (
                <View key={l} style={[s.tab, local === l && s.tabActive]}>
                  <Text style={[s.tabText, local === l && s.tabTextActive]} onPress={() => setLocal(l as 'Bar' | 'Delivery')}>{l}</Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={[s.tab, s.tabActive]}>
              <Text style={[s.tabText, s.tabTextActive]}>📍 {localOperador}</Text>
            </View>
          )}
        </Card>

        {tipo === 'AjustePerda' && (
          <Card>
            <Text style={s.sectionTitle}>Foto da Perda *</Text>
            <TouchableOpacity style={s.fotoBtn} onPress={tirarFotoPerda} activeOpacity={0.8}>
              {fotoPerda
                ? <Image source={{ uri: fotoPerda }} style={s.fotoPreview} resizeMode="cover" />
                : <Text style={s.fotoBtnTxt}>📷 Tirar foto como prova</Text>
              }
            </TouchableOpacity>
          </Card>
        )}

        {tipo === 'AjustePerda' && (
          <Card>
            <Text style={s.sectionTitle}>Motivo da Perda *</Text>
            <View style={s.motivoGrid}>
              {MOTIVOS_PERDA.map((m) => (
                <View key={m} style={[s.motivoItem, motivo === m && s.motivoActive]}>
                  <Text style={[s.motivoText, motivo === m && { color: '#fff' }]} onPress={() => setMotivo(m)}>{m}</Text>
                </View>
              ))}
            </View>
          </Card>
        )}

        <Card>
          <Text style={s.sectionTitle}>Observação (opcional)</Text>
          <TextInput style={[s.input, { height: 80 }]} placeholder="Adicione uma observação..." placeholderTextColor={colors.textMuted}
            multiline value={observacao} onChangeText={setObservacao} />
        </Card>

        {bloqueadoSemTurno && (
          <View style={s.alertDanger}>
            <Text style={s.alertDangerText}>🔒 Perda grande sem turno aberto. Abra o turno primeiro para registrar.</Text>
          </View>
        )}

        {avisoContagemAberta && (
          <View style={s.alert}>
            <Text style={s.alertText}>⚠️ Contagem em andamento. Para evitar desconto duplicado, registre esta perda após finalizar a contagem.</Text>
          </View>
        )}

        {isGrandePerda && !bloqueadoSemTurno && !avisoContagemAberta && (
          <View style={s.alert}>
            <Text style={s.alertText}>⚠️ Quantidade grande — admin receberá um alerta no painel.</Text>
          </View>
        )}

        <ActionButton
          label={tipo === 'CargaInicial' ? 'Registrar Carga Inicial' : 'Registrar'}
          onPress={handleSubmit}
          loading={isLoading}
          disabled={bloqueadoSemTurno}
          icon={tipo === 'Entrada' ? '📥' : tipo === 'AjustePerda' ? '🗑️' : tipo === 'CargaInicial' ? '📦' : '📝'}
        />

      </ScrollView>

      <Modal visible={verificacao !== null} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={s.modal}>
            {verificacao?.tipo === 'bloqueado' ? (
              <>
                <Text style={s.modalIcon}>🛑</Text>
                <Text style={s.modalTitle}>Entrada Bloqueada</Text>
                <Text style={s.modalSub}>
                  Já foi registrada uma entrada IDÊNTICA nas últimas 24h:
                </Text>
                <View style={s.modalBox}>
                  <Text style={s.modalBoxTxt}>
                    +{verificacao.duplicata?.quantidade} {verificacao.duplicata?.produto.unidadeMedida} de {verificacao.duplicata?.produto.nomeBebida}
                  </Text>
                  <Text style={s.modalBoxSub}>
                    Por: {verificacao.duplicata?.usuario.nome} ({verificacao.duplicata?.usuario.nivelAcesso})
                  </Text>
                  <Text style={s.modalBoxSub}>
                    Em: {verificacao.duplicata && new Date(verificacao.duplicata.dataMov).toLocaleString('pt-BR')}
                  </Text>
                </View>
                <Text style={s.modalHint}>
                  Se a contagem mostrou divergência, registre como rascunho na contagem inicial do turno.
                </Text>
                <Pressable style={s.btnEntendi} onPress={() => setVerificacao(null)}>
                  <Text style={s.btnEntendiTxt}>Entendi</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={s.modalIcon}>⚠️</Text>
                <Text style={s.modalTitle}>Entrada Recente</Text>
                <Text style={s.modalSub}>Já existe entrada deste produto nas últimas 12h:</Text>
                {verificacao?.recentes?.slice(0, 3).map((r) => (
                  <View key={r.id} style={s.modalBox}>
                    <Text style={s.modalBoxTxt}>+{r.quantidade} {r.produto.unidadeMedida}</Text>
                    <Text style={s.modalBoxSub}>{r.usuario.nome} · {new Date(r.dataMov).toLocaleString('pt-BR')}</Text>
                  </View>
                ))}
                <Text style={s.modalHint}>Se esta é uma compra adicional, informe a justificativa. O Admin irá comparar com as notas e aprovar.</Text>
                <TextInput
                  style={s.modalInput}
                  placeholder="Ex: Segunda compra do dia, nota diferente..."
                  placeholderTextColor="#aaa"
                  value={justificativa}
                  onChangeText={setJustificativa}
                  multiline
                  numberOfLines={2}
                />
                <View style={s.modalRow}>
                  <Pressable style={s.btnCancel} onPress={() => { setVerificacao(null); setJustificativa('') }}>
                    <Text style={s.btnCancelTxt}>Cancelar</Text>
                  </Pressable>
                  <Pressable style={s.btnConfirmar} onPress={confirmarComJustificativa}>
                    <Text style={s.btnConfirmarTxt}>Enviar p/ aprovação</Text>
                  </Pressable>
                </View>
              </>
            )}
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
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.textSub, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  input: { backgroundColor: colors.surfaceAlt, borderRadius: 10, paddingHorizontal: 14, height: 44, fontSize: 14, color: colors.text, borderWidth: 1, borderColor: colors.border },
  inputLarge: { backgroundColor: colors.surfaceAlt, borderRadius: 10, paddingHorizontal: 14, height: 72, fontSize: 32, fontWeight: '700', color: colors.text, textAlign: 'center', borderWidth: 1, borderColor: colors.border },
  unit: { textAlign: 'center', color: colors.textSub, marginTop: 6, fontSize: 13 },
  list: { maxHeight: 180 },
  prodItem: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, marginBottom: 4 },
  prodItemActive: { backgroundColor: colors.primary },
  prodName: { fontSize: 14, color: colors.text, fontWeight: '500' },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: colors.surfaceAlt, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.textSub },
  tabTextActive: { color: '#fff' },
  motivoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  motivoItem: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
  motivoActive: { backgroundColor: colors.danger, borderColor: colors.danger },
  motivoText: { fontSize: 13, fontWeight: '500', color: colors.text },
  alert: { backgroundColor: colors.warningLight, borderRadius: 12, padding: 14, borderLeftWidth: 4, borderLeftColor: colors.warning },
  alertText: { color: colors.warning, fontSize: 13, fontWeight: '500', lineHeight: 20 },
  alertDanger: { backgroundColor: colors.dangerLight, borderRadius: 12, padding: 14, borderLeftWidth: 4, borderLeftColor: colors.danger },
  alertDangerText: { color: colors.danger, fontSize: 13, fontWeight: '500', lineHeight: 20 },
  fotoBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, minHeight: 100, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  fotoPreview: { width: '100%', height: 140, borderRadius: 10 },
  fotoBtnTxt: { fontSize: 14, color: colors.textSub, padding: 20 },

  bannerEntrada: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.successLight, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.success },
  bannerEntradaTitulo: { fontSize: 13, fontWeight: '800', color: colors.success },
  bannerEntradaSub: { fontSize: 11, color: colors.success, marginTop: 2, lineHeight: 16, opacity: 0.85 },

  bannerCarga: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#EEF2FF', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#C7D2FE' },
  bannerCargaIcon: { fontSize: 28 },
  bannerCargaTitulo: { fontSize: 13, fontWeight: '800', color: '#3730A3' },
  bannerCargaSub: { fontSize: 11, color: '#4338CA', marginTop: 2, lineHeight: 16 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
  modal: { backgroundColor: colors.surface, borderRadius: 18, padding: 22, gap: 8 },
  modalIcon: { fontSize: 40, textAlign: 'center' },
  modalTitle: { fontSize: 17, fontWeight: '800', color: colors.text, textAlign: 'center' },
  modalSub: { fontSize: 13, color: colors.textSub, textAlign: 'center', marginTop: 4 },
  modalBox: { backgroundColor: colors.surfaceAlt, padding: 12, borderRadius: 10, marginTop: 8, borderLeftWidth: 3, borderLeftColor: colors.warning },
  modalBoxTxt: { fontSize: 14, fontWeight: '700', color: colors.text },
  modalBoxSub: { fontSize: 11, color: colors.textSub, marginTop: 2 },
  modalHint: { fontSize: 12, color: colors.textSub, textAlign: 'center', marginTop: 12, fontStyle: 'italic' },
  modalInput: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, fontSize: 13, color: colors.text, backgroundColor: colors.surfaceAlt, textAlignVertical: 'top', minHeight: 60, marginTop: 4 },
  modalRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  btnCancel: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  btnCancelTxt: { fontSize: 14, fontWeight: '700', color: colors.textSub },
  btnConfirmar: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center' },
  btnConfirmarTxt: { fontSize: 14, fontWeight: '700', color: '#fff' },
  btnEntendi: { padding: 14, borderRadius: 12, backgroundColor: colors.danger, alignItems: 'center', marginTop: 12 },
  btnEntendiTxt: { fontSize: 14, fontWeight: '700', color: '#fff' },
})
