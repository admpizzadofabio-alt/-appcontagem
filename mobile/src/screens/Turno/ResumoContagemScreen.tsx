import React, { useState, useMemo } from 'react'
import { View, Text, ScrollView, StyleSheet, Alert, TextInput, TouchableOpacity, ActivityIndicator, Modal, Pressable, Image } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation, useRoute, CommonActions, RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import * as ImagePicker from 'expo-image-picker'
import {
  useContagemQuery,
  useRegistrarFotoContagemMutation,
  useFinalizarContagemMutation,
  useCriarRascunhoEntradaMutation,
  type ItemContagem,
} from '../../services/api/turnos'
import { useListarCorrecoesQuery } from '../../services/api/correcoes'
import { Card } from '../../components/Card'
import { ActionButton } from '../../components/ActionButton'
import { colors } from '../../theme/colors'
import type { AppStackParams } from '../../navigation/types'

type Nav = NativeStackNavigationProp<AppStackParams>
type RouteT = RouteProp<AppStackParams, 'ResumoContagem'>

export function ResumoContagemScreen() {
  const navigation = useNavigation<Nav>()
  const route = useRoute<RouteT>()
  const contagemId = route.params.contagemId

  const { data: contagem, isLoading, refetch } = useContagemQuery(contagemId)
  const [registrarFoto] = useRegistrarFotoContagemMutation()
  const [finalizar, { isLoading: finalizando }] = useFinalizarContagemMutation()
  const [criarRascunho] = useCriarRascunhoEntradaMutation()
  const { data: correcoes = [] } = useListarCorrecoesQuery({ turnoId: contagemId })

  const [itemModal, setItemModal] = useState<ItemContagem | null>(null)
  const [foto, setFoto] = useState<string | null>(null)
  const [justif, setJustif] = useState('')
  const [origemTexto, setOrigemTexto] = useState('')
  const [observacao, setObservacao] = useState('')
  const [modoRascunho, setModoRascunho] = useState(false)

  const itens = contagem?.itens ?? []
  const semMovimento = itens.filter((i) => i.divergenciaCategoria === 'ok' && i.quantidadeSistema === 0 && i.quantidadeContada === 0)
  const ok = itens.filter((i) => i.divergenciaCategoria === 'ok' && (i.quantidadeSistema > 0 || i.quantidadeContada > 0))
  const leves = itens.filter((i) => i.divergenciaCategoria === 'leve')
  const grandes = itens.filter((i) => i.divergenciaCategoria === 'grande')
  const vendasSemEstoque = itens.filter(
    (i) => (i.vendidoColibri ?? 0) > 0 && i.quantidadeContada < (i.vendidoColibri ?? 0) && i.divergenciaCategoria !== 'grande',
  )
  const pendentesJustificativa = [...leves, ...grandes, ...vendasSemEstoque].filter((i) => !i.justificativa)

  if (isLoading || !contagem) {
    return <SafeAreaView style={s.safe}><ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} /></SafeAreaView>
  }

  async function tirarFoto() {
    // Só câmera — galeria removida pra evitar reuso de fotos antigas e garantir
    // que toda evidência seja capturada no momento (auditoria/anti-fraude).
    const perm = await ImagePicker.requestCameraPermissionsAsync()
    if (!perm.granted) {
      Alert.alert('Permissão negada', 'Permita o uso da câmera nas configurações')
      return
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.6, base64: true })
    if (!result.canceled && result.assets[0]?.base64) setFoto(`data:image/jpeg;base64,${result.assets[0].base64}`)
  }

  function abrirItemModal(item: ItemContagem) {
    setItemModal(item)
    setFoto(item.fotoEvidencia ?? null)
    setJustif(item.justificativa ?? '')
    setOrigemTexto('')
    setObservacao('')
    // Se sobra (diferença positiva grande), modo rascunho disponível
    setModoRascunho(false)
  }

  async function salvarFotoEJustif() {
    if (!itemModal || !justif.trim()) {
      Alert.alert('Atenção', 'Justificativa obrigatória')
      return
    }
    const isQuebraPerda = justif.startsWith('Quebra ou perda')
    if (isQuebraPerda && !foto) {
      Alert.alert('Foto obrigatória', 'Quebra ou perda exige foto da evidência (garrafa quebrada, produto danificado etc.)')
      return
    }
    try {
      await registrarFoto({ contagemId, produtoId: itemModal.produtoId, fotoEvidencia: foto ?? '', justificativa: justif.trim() }).unwrap()
      setItemModal(null)
      refetch()
    } catch (e: any) {
      Alert.alert('Erro', e.message)
    }
  }

  async function salvarRascunho() {
    if (!itemModal || !origemTexto.trim()) {
      Alert.alert('Atenção', 'Informe a origem da entrada')
      return
    }
    if (itemModal.diferenca <= 0) {
      Alert.alert('Atenção', 'Rascunho de entrada só serve para sobras')
      return
    }
    try {
      await criarRascunho({
        contagemId,
        produtoId: itemModal.produtoId,
        quantidade: itemModal.diferenca,
        origemTexto: origemTexto.trim(),
        observacao: observacao.trim() || undefined,
        fotoEvidencia: foto ?? '',
      }).unwrap()
      // Salva também justificativa no item (vinculando ao rascunho)
      await registrarFoto({
        contagemId,
        produtoId: itemModal.produtoId,
        fotoEvidencia: foto ?? '',
        justificativa: `Rascunho de entrada criado: ${origemTexto.trim()}`,
      }).unwrap()
      setItemModal(null)
      refetch()
      Alert.alert('Rascunho criado', 'Aguardando aprovação do Admin')
    } catch (e: any) {
      Alert.alert('Erro', e.message)
    }
  }

  async function handleFinalizar() {
    if (pendentesJustificativa.length > 0) {
      Alert.alert('Atenção', `${pendentesJustificativa.length} item(s) sem justificativa`)
      return
    }
    const totalRevisao = grandes.length + vendasSemEstoque.length
    Alert.alert(
      'Finalizar contagem',
      `Confirmar?\n• ${ok.length} conferidos\n• ${semMovimento.length} sem movimento\n• ${leves.length} ajustes leves automáticos\n• ${totalRevisao} vão para revisão Admin`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Finalizar',
          onPress: async () => {
            try {
              await finalizar(contagemId).unwrap()
              Alert.alert('✅ Contagem concluída', 'Turno aberto. Bom turno!', [
                {
                  text: 'OK',
                  onPress: () =>
                    navigation.dispatch(
                      CommonActions.reset({ index: 0, routes: [{ name: 'Tabs' }] }),
                    ),
                },
              ])
            } catch (e: any) {
              Alert.alert('Erro', e.message)
            }
          },
        },
      ],
    )
  }

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <ScrollView style={s.scroll} contentContainerStyle={s.content}>

        <Card style={s.statsCard}>
          <View style={s.statsRow}>
            <View style={s.stat}>
              <Text style={[s.statNum, { color: colors.success }]}>{ok.length}</Text>
              <Text style={s.statLabel}>Conferidos</Text>
            </View>
            <View style={s.stat}>
              <Text style={[s.statNum, { color: colors.textMuted }]}>{semMovimento.length}</Text>
              <Text style={s.statLabel}>Sem mov.</Text>
            </View>
            <View style={s.stat}>
              <Text style={[s.statNum, { color: colors.warning }]}>{leves.length}</Text>
              <Text style={s.statLabel}>Leves</Text>
            </View>
            <View style={s.stat}>
              <Text style={[s.statNum, { color: colors.danger }]}>{grandes.length + vendasSemEstoque.length}</Text>
              <Text style={s.statLabel}>Revisão</Text>
            </View>
          </View>
        </Card>

        {ok.length > 0 && (
          <>
            <Text style={s.section}>✅ Conferidos sem divergência ({ok.length})</Text>
            {ok.map((it) => (
              <Card key={it.id} style={s.itemCard}>
                <Text style={s.itemNome}>{it.produto.nomeBebida}</Text>
                <Text style={[s.itemDiff, { color: colors.success }]}>
                  Sistema {it.quantidadeSistema} = Contado {it.quantidadeContada}
                </Text>
              </Card>
            ))}
          </>
        )}

        {leves.length > 0 && (
          <>
            <Text style={s.section}>🟡 Divergências leves (justificativa obrigatória)</Text>
            {leves.map((it) => (
              <TouchableOpacity key={it.id} onPress={() => abrirItemModal(it)} disabled={contagem.status === 'Fechada'}>
                <Card style={[s.itemCard, !it.justificativa && contagem.status !== 'Fechada' && s.itemPendente] as any}>
                  <Text style={s.itemNome}>{it.produto.nomeBebida}</Text>
                  <Text style={s.itemDiff}>
                    Esperado: {it.quantidadeSistema} · Contado: {it.quantidadeContada} · Dif: {it.diferenca > 0 ? '+' : ''}{it.diferenca}
                  </Text>
                  <Text style={[s.itemAcao, it.justificativa && { color: colors.success }]}>
                    {it.justificativa ? '✓ Justificativa salva' : '✏️ Toque para justificar'}
                  </Text>
                </Card>
              </TouchableOpacity>
            ))}
          </>
        )}

        {grandes.length > 0 && (
          <>
            <Text style={s.section}>🔴 Divergências grandes (justificativa obrigatória)</Text>
            {grandes.map((it) => (
              <TouchableOpacity key={it.id} onPress={() => abrirItemModal(it)} disabled={contagem.status === 'Fechada'}>
                <Card style={[s.itemCard, !it.justificativa && contagem.status !== 'Fechada' && s.itemPendente] as any}>
                  <Text style={s.itemNome}>{it.produto.nomeBebida}</Text>
                  <Text style={s.itemDiff}>
                    Esperado: {it.quantidadeSistema} · Contado: {it.quantidadeContada} · Dif: {it.diferenca > 0 ? '+' : ''}{it.diferenca}
                  </Text>
                  <Text style={[s.itemAcao, it.justificativa && { color: colors.success }]}>
                    {it.justificativa ? '✓ Justificativa salva' : '✏️ Toque para justificar'}
                  </Text>
                </Card>
              </TouchableOpacity>
            ))}
          </>
        )}

        {vendasSemEstoque.length > 0 && (
          <>
            <Text style={s.section}>🟠 Vendidas no Colibri sem estoque (justifique e segue para Admin)</Text>
            {vendasSemEstoque.map((it) => (
              <TouchableOpacity key={it.id} onPress={() => abrirItemModal(it)} disabled={contagem.status === 'Fechada'}>
                <Card style={[s.itemCard, !it.justificativa && s.itemPendente] as any}>
                  <Text style={s.itemNome}>{it.produto.nomeBebida}</Text>
                  <Text style={s.itemDiff}>
                    Vendido Colibri: {it.vendidoColibri ?? 0} · Contado: {it.quantidadeContada} · Estoque sistema: {it.quantidadeSistema}
                  </Text>
                  <Text style={[s.itemAcao, it.justificativa && { color: colors.success }]}>
                    {it.justificativa ? '✓ Justificativa salva — Admin revisará' : '✏️ Toque para justificar'}
                  </Text>
                </Card>
              </TouchableOpacity>
            ))}
          </>
        )}

        {correcoes.length > 0 && (
          <>
            <Text style={s.section}>📋 Correções de comanda ({correcoes.length})</Text>
            {correcoes.map((c) => (
              <Card key={c.id} style={s.itemCard}>
                <Text style={s.itemNome}>
                  <Text style={{ color: colors.danger }}>{c.produtoComandado.nomeBebida}</Text>
                  {'  →  '}
                  <Text style={{ color: colors.success }}>{c.produtoServido.nomeBebida}</Text>
                </Text>
                <Text style={s.itemDiff}>
                  Qtd: {c.quantidade} · {c.operador.nome}
                </Text>
              </Card>
            ))}
          </>
        )}

        <View style={{ height: 12 }} />

        {contagem.status !== 'Fechada' && (
          <ActionButton
            label={finalizando ? 'Finalizando...' : 'Confirmar e abrir turno'}
            onPress={handleFinalizar}
            disabled={finalizando || pendentesJustificativa.length > 0}
          />
        )}
      </ScrollView>

      <Modal visible={itemModal !== null} transparent animationType="slide">
        <View style={s.overlay}>
          <ScrollView style={s.modal}>
            <Text style={s.modalTitle}>{itemModal?.produto.nomeBebida}</Text>
            <Text style={s.modalSub}>
              Esperado {itemModal?.quantidadeSistema} · Contado {itemModal?.quantidadeContada} · Dif {itemModal && itemModal.diferenca > 0 ? '+' : ''}{itemModal?.diferenca}
            </Text>

            {itemModal && itemModal.diferenca > 0 && (
              <View style={s.toggleRow}>
                <TouchableOpacity
                  style={[s.toggleBtn, !modoRascunho && s.toggleBtnAtivo]}
                  onPress={() => setModoRascunho(false)}
                >
                  <Text style={[s.toggleBtnTxt, !modoRascunho && s.toggleBtnTxtAtivo]}>Justificar divergência</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.toggleBtn, modoRascunho && s.toggleBtnAtivo]}
                  onPress={() => setModoRascunho(true)}
                >
                  <Text style={[s.toggleBtnTxt, modoRascunho && s.toggleBtnTxtAtivo]}>Registrar entrada</Text>
                </TouchableOpacity>
              </View>
            )}

            <Text style={s.fieldLabel}>
              📸 Foto {justif.startsWith('Quebra ou perda') ? '(obrigatória)' : '(opcional)'}
            </Text>
            {foto && <Image source={{ uri: foto }} style={s.fotoPreview} />}
            <TouchableOpacity style={s.fotoBtn} onPress={tirarFoto}>
              <Text style={s.fotoBtnTxt}>{foto ? '🔄 Tirar outra foto' : '📷 Tirar foto'}</Text>
            </TouchableOpacity>

            {modoRascunho ? (
              <>
                <Text style={s.fieldLabel}>Origem da entrada *</Text>
                <TextInput
                  style={s.input}
                  value={origemTexto}
                  onChangeText={setOrigemTexto}
                  placeholder="Ex: Compra sem nota, devolução de cliente..."
                  placeholderTextColor={colors.textMuted}
                  multiline
                />
                <Text style={s.fieldLabel}>Observação (opcional)</Text>
                <TextInput
                  style={s.input}
                  value={observacao}
                  onChangeText={setObservacao}
                  placeholder="Detalhes adicionais"
                  placeholderTextColor={colors.textMuted}
                  multiline
                />
                <Text style={s.hint}>
                  ⚠️ Cria rascunho de entrada de +{itemModal?.diferenca} unidades. Aguardará aprovação do Admin.
                </Text>
              </>
            ) : (
              <>
                <Text style={s.fieldLabel}>Categoria (toque para selecionar)</Text>
                <View style={s.chipsRow}>
                  {[
                    { key: 'erro_contagem', label: 'Erro de contagem' },
                    { key: 'venda_sem_estoque', label: 'Venda sem estoque' },
                    { key: 'possivel_desvio', label: 'Possível desvio' },
                    { key: 'quebra_perda', label: 'Quebra/perda' },
                    { key: 'outro', label: 'Outro' },
                  ].map((c) => {
                    const labelMap: Record<string, string> = {
                      erro_contagem: 'Erro de contagem ao abrir o turno',
                      venda_sem_estoque: 'Vendido no Colibri sem estoque físico',
                      possivel_desvio: 'Suspeita de desvio/furto',
                      quebra_perda: 'Quebra ou perda não registrada',
                      outro: '',
                    }
                    const ativo = justif.startsWith(labelMap[c.key]) || (c.key === 'outro' && !Object.values(labelMap).slice(0, -1).some((v) => justif.startsWith(v)))
                    return (
                      <TouchableOpacity
                        key={c.key}
                        style={[s.chip, ativo && s.chipAtivo]}
                        onPress={() => {
                          if (c.key === 'outro') setJustif('')
                          else setJustif(labelMap[c.key])
                        }}
                      >
                        <Text style={[s.chipTxt, ativo && s.chipTxtAtivo]}>{c.label}</Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
                <Text style={s.fieldLabel}>Justificativa *</Text>
                <TextInput
                  style={s.input}
                  value={justif}
                  onChangeText={setJustif}
                  placeholder="Detalhe brevemente..."
                  placeholderTextColor={colors.textMuted}
                  multiline
                />
              </>
            )}

            <View style={s.modalAcoes}>
              <Pressable style={s.btnCancelar} onPress={() => setItemModal(null)}>
                <Text style={s.btnCancelarTxt}>Cancelar</Text>
              </Pressable>
              <Pressable style={s.btnSalvar} onPress={modoRascunho ? salvarRascunho : salvarFotoEJustif}>
                <Text style={s.btnSalvarTxt}>{modoRascunho ? 'Criar rascunho' : 'Salvar'}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 32 },

  statsCard: {},
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center', gap: 4 },
  statNum: { fontSize: 28, fontWeight: '800' },
  statLabel: { fontSize: 12, color: colors.textSub, fontWeight: '600' },

  section: { fontSize: 13, fontWeight: '700', color: colors.text, marginTop: 8 },
  itemCard: {},
  itemPendente: { borderLeftWidth: 4, borderLeftColor: colors.danger },
  itemNome: { fontSize: 14, fontWeight: '700', color: colors.text },
  itemDiff: { fontSize: 12, color: colors.textSub, marginTop: 2 },
  itemAcao: { fontSize: 12, fontWeight: '700', color: colors.danger, marginTop: 6 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modal: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '90%' },
  modalTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  modalSub: { fontSize: 12, color: colors.textSub, marginTop: 2, marginBottom: 12 },

  toggleRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  toggleBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: 'center', backgroundColor: colors.surface },
  toggleBtnAtivo: { backgroundColor: colors.accentLight, borderColor: colors.primary },
  toggleBtnTxt: { fontSize: 12, fontWeight: '600', color: colors.textSub },
  toggleBtnTxtAtivo: { color: colors.primary },

  fieldLabel: { fontSize: 11, fontWeight: '700', color: colors.textSub, marginTop: 12, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, fontSize: 14, color: colors.text, backgroundColor: colors.surfaceAlt, minHeight: 44 },
  fotoPreview: { width: '100%', height: 180, borderRadius: 10, marginBottom: 8 },
  fotoBtn: { padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.primary, alignItems: 'center', backgroundColor: colors.accentLight },
  fotoBtnTxt: { fontSize: 13, fontWeight: '700', color: colors.primary },
  hint: { fontSize: 11, color: colors.warning, marginTop: 8, fontStyle: 'italic' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipAtivo: { borderColor: colors.primary, backgroundColor: colors.accentLight },
  chipTxt: { fontSize: 12, color: colors.textSub },
  chipTxtAtivo: { color: colors.primary, fontWeight: '700' },

  modalAcoes: { flexDirection: 'row', gap: 10, marginTop: 16, marginBottom: 8 },
  btnCancelar: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  btnCancelarTxt: { fontSize: 14, fontWeight: '700', color: colors.textSub },
  btnSalvar: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center' },
  btnSalvarTxt: { fontSize: 14, fontWeight: '700', color: '#fff' },
})
