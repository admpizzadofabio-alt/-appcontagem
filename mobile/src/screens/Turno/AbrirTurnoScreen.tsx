import React, { useState } from 'react'
import { View, Text, ScrollView, StyleSheet, Alert, TouchableOpacity, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useTurnoAtualQuery, useAbrirTurnoMutation, useFecharTurnoMutation, useDeletarTurnoMutation } from '../../services/api/turnos'
import { useListarTransferenciasPendentesQuery, useConfirmarTransferenciaMutation, useRejeitarTransferenciaMutation } from '../../services/api/movimentacoes'
import { useAuth } from '../../contexts/AuthContext'
import { useLocalAcesso } from '../../hooks/useLocalAcesso'
import { Card } from '../../components/Card'
import { ActionButton } from '../../components/ActionButton'
import { colors } from '../../theme/colors'
import type { AppStackParams } from '../../navigation/types'

type Nav = NativeStackNavigationProp<AppStackParams>
type RouteT = RouteProp<AppStackParams, 'AbrirTurno'>

export function AbrirTurnoScreen() {
  const navigation = useNavigation<Nav>()
  const route = useRoute<RouteT>()
  const { usuario } = useAuth()
  const { veTodosLocais } = useLocalAcesso()

  const localInicial: 'Bar' | 'Delivery' = route.params?.local ?? (usuario?.setor === 'Delivery' ? 'Delivery' : 'Bar')
  const [local, setLocal] = useState<'Bar' | 'Delivery'>(localInicial)

  const { data: turnoAtual, isLoading, refetch } = useTurnoAtualQuery({ local })
  const [abrir, { isLoading: abrindo }] = useAbrirTurnoMutation()
  const [fechar, { isLoading: fechando }] = useFecharTurnoMutation()
  const [deletar, { isLoading: deletando }] = useDeletarTurnoMutation()
  const { data: transferenciasPendentes = [] } = useListarTransferenciasPendentesQuery({ local })
  const [confirmarTransferencia] = useConfirmarTransferenciaMutation()
  const [rejeitarTransferencia] = useRejeitarTransferenciaMutation()

  async function handleConfirmarTransferencia(
    id: string,
    nomeProduto: string,
    setorPadrao: string,
    localDestino: string,
  ) {
    Alert.alert(
      'Confirmar recebimento',
      `Confirma o recebimento de ${nomeProduto}? O estoque será atualizado agora.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              await confirmarTransferencia(id).unwrap()
              const setorOk = setorPadrao === 'Todos' || setorPadrao === localDestino
              const isAdmin = usuario?.nivelAcesso === 'Admin' || usuario?.nivelAcesso === 'Supervisor'
              if (!setorOk && isAdmin) {
                Alert.alert(
                  '⚠️ Atenção Admin',
                  `"${nomeProduto}" está cadastrado como produto do ${setorPadrao}, mas foi transferido para ${localDestino}.\n\nAtualize o setor do produto para "Todos" para que apareça na contagem e estoque do ${localDestino}.`,
                  [{ text: 'Entendido' }],
                )
              } else {
                Alert.alert('Recebido!', 'Estoque atualizado com sucesso.')
              }
            } catch (e: any) {
              Alert.alert('Erro', e.message ?? 'Falha ao confirmar transferência')
            }
          },
        },
      ],
    )
  }

  async function handleDeletar() {
    Alert.alert(
      '⚠️ Apagar turno (modo teste)',
      'Isso apaga PERMANENTEMENTE o turno, a contagem e desvincula movimentos/erros. Use só em testes.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Apagar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletar(turnoAtual!.id).unwrap()
              refetch()
            } catch (e: any) {
              Alert.alert('Erro', e.message ?? 'Falha ao apagar turno')
            }
          },
        },
      ],
    )
  }

  async function handleRejeitarTransferencia(id: string, nomeProduto: string) {
    Alert.alert(
      'Recusar transferência',
      `Recusar o recebimento de "${nomeProduto}"? O estoque não será alterado.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Recusar',
          style: 'destructive',
          onPress: async () => {
            try {
              await rejeitarTransferencia(id).unwrap()
              Alert.alert('Recusado', 'Transferência recusada. Nenhum estoque foi alterado.')
            } catch (e: any) {
              Alert.alert('Erro', e.message ?? 'Falha ao recusar transferência')
            }
          },
        },
      ],
    )
  }

  async function handleFechar() {
    Alert.alert(
      'Fechar Turno',
      'Tem certeza que deseja fechar o turno manualmente?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Fechar Turno',
          style: 'destructive',
          onPress: async () => {
            try {
              await fechar(turnoAtual!.id).unwrap()
              refetch()
            } catch (e: any) {
              Alert.alert('Erro', e.message ?? 'Falha ao fechar turno')
            }
          },
        },
      ],
    )
  }

  async function handleAbrir() {
    try {
      const t = await abrir({ local }).unwrap()
      navigation.replace('ContagemTurno', { contagemId: t.contagemId!, colibriPendente: t.colibriPendente })
    } catch (e: any) {
      Alert.alert('Erro', e.message ?? 'Falha ao abrir turno')
    }
  }

  function continuarContagem() {
    if (turnoAtual?.contagemId) {
      navigation.navigate('ContagemTurno', { contagemId: turnoAtual.contagemId, colibriPendente: turnoAtual.colibriPendente })
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <ScrollView style={s.scroll} contentContainerStyle={s.content}>

        {veTodosLocais ? (
          <View style={s.localRow}>
            {(['Bar', 'Delivery'] as const).map((l) => (
              <TouchableOpacity
                key={l}
                style={[s.localBtn, local === l && s.localBtnAtivo]}
                onPress={() => setLocal(l)}
              >
                <Text style={[s.localBtnTxt, local === l && s.localBtnTxtAtivo]}>{l}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={[s.localBtn, s.localBtnAtivo, { marginBottom: 4 }]}>
            <Text style={[s.localBtnTxt, s.localBtnTxtAtivo]}>📍 {local}</Text>
          </View>
        )}

        {isLoading && <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />}

        {!isLoading && turnoAtual && (
          <>
            <Card style={s.statusCard}>
              <View style={s.statusHeader}>
                <View style={s.dot} />
                <Text style={s.statusTitle}>Turno aberto</Text>
              </View>
              <Text style={s.statusInfo}>📅 {turnoAtual.diaOperacional}</Text>
              <Text style={s.statusInfo}>🕐 Aberto em {new Date(turnoAtual.abertoEm).toLocaleTimeString('pt-BR')}</Text>
              {turnoAtual.abertoPorNome && (
                <Text style={s.statusInfo}>👤 Aberto por {turnoAtual.abertoPorNome}</Text>
              )}
              {turnoAtual.contagem && (
                <Text style={s.statusInfo}>
                  📋 Contagem: {turnoAtual.contagem.itens.filter((i) => i.quantidadeContada > 0 || i.divergenciaCategoria).length} de {turnoAtual.totalDivergencias || turnoAtual.contagem.totalItens}
                </Text>
              )}
            </Card>

            {transferenciasPendentes.length > 0 && (
              <Card style={s.transferenciaCard}>
                <Text style={s.transferenciaTitle}>📦 {transferenciasPendentes.length} transferência{transferenciasPendentes.length !== 1 ? 's' : ''} aguardando confirmação</Text>
                {transferenciasPendentes.map((t) => (
                  <View key={t.id} style={s.transferenciaItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.transferenciaProduto}>{t.produto.nomeBebida}</Text>
                      <Text style={s.transferenciaSub}>{t.quantidade} {t.produto.unidadeMedida} · De: {t.localOrigem} · Por: {t.usuario.nome}</Text>
                    </View>
                    <View style={s.transferenciaAcoes}>
                      <TouchableOpacity
                        style={s.recusarBtn}
                        onPress={() => handleRejeitarTransferencia(t.id, t.produto.nomeBebida)}
                      >
                        <Text style={s.recusarBtnTxt}>Recusar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={s.confirmarBtn}
                        onPress={() => handleConfirmarTransferencia(t.id, t.produto.nomeBebida, t.produto.setorPadrao, t.localDestino)}
                      >
                        <Text style={s.confirmarBtnTxt}>Confirmar</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </Card>
            )}

            {turnoAtual.contagem?.status === 'Aberta' ? (
              <ActionButton label="⚠️ Contagem pendente — toque para continuar" variant="danger" onPress={continuarContagem} />
            ) : (
              <>
                <Card style={s.infoCard}>
                  <Text style={s.infoTxt}>✅ Contagem finalizada. Turno em operação.</Text>
                </Card>
                {turnoAtual.contagemId && (
                  <TouchableOpacity
                    style={s.verResumoBtn}
                    onPress={() => navigation.navigate('ResumoContagem', { contagemId: turnoAtual.contagemId! })}
                    activeOpacity={0.8}
                  >
                    <Text style={s.verResumoBtnTxt}>📋 Ver resumo da contagem</Text>
                  </TouchableOpacity>
                )}
              </>
            )}


            {usuario?.nivelAcesso === 'Admin' && (
              <>
                <TouchableOpacity
                  style={s.fecharTurnoBtn}
                  onPress={handleFechar}
                  disabled={fechando}
                  activeOpacity={0.85}
                >
                  <Text style={s.fecharTurnoTxt}>{fechando ? 'Fechando...' : '🔒 Fechar Turno Manualmente'}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={s.deletarTurnoBtn}
                  onPress={handleDeletar}
                  disabled={deletando}
                  activeOpacity={0.85}
                >
                  <Text style={s.deletarTurnoTxt}>{deletando ? 'Apagando...' : '🗑️ Apagar Turno (modo teste)'}</Text>
                </TouchableOpacity>
              </>
            )}

          </>
        )}


        {!isLoading && !turnoAtual && (
          <>
            {transferenciasPendentes.length > 0 && (
              <Card style={s.transferenciaCard}>
                <Text style={s.transferenciaTitle}>📦 {transferenciasPendentes.length} transferência{transferenciasPendentes.length !== 1 ? 's' : ''} aguardando confirmação</Text>
                {transferenciasPendentes.map((t) => (
                  <View key={t.id} style={s.transferenciaItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.transferenciaProduto}>{t.produto.nomeBebida}</Text>
                      <Text style={s.transferenciaSub}>{t.quantidade} {t.produto.unidadeMedida} · De: {t.localOrigem} · Por: {t.usuario.nome}</Text>
                    </View>
                    <View style={s.transferenciaAcoes}>
                      <TouchableOpacity
                        style={s.recusarBtn}
                        onPress={() => handleRejeitarTransferencia(t.id, t.produto.nomeBebida)}
                      >
                        <Text style={s.recusarBtnTxt}>Recusar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={s.confirmarBtn}
                        onPress={() => handleConfirmarTransferencia(t.id, t.produto.nomeBebida, t.produto.setorPadrao, t.localDestino)}
                      >
                        <Text style={s.confirmarBtnTxt}>Confirmar</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </Card>
            )}

            <Card style={s.welcomeCard}>
              <Text style={s.welcomeIcon}>🔓</Text>
              <Text style={s.welcomeTitle}>Abrir turno do {local}</Text>
              <Text style={s.welcomeSub}>
                Para iniciar o turno, faça a contagem inicial do estoque. Conta cada produto e digita a quantidade real na geladeira/prateleira.
              </Text>
            </Card>

            <Card style={s.infoCard}>
              <Text style={s.infoTitle}>📋 Como funciona</Text>
              <Text style={s.infoTxt}>1. Você conta um produto por vez (modo cego — não vê o esperado)</Text>
              <Text style={s.infoTxt}>2. Sistema compara com o estoque do sistema</Text>
              <Text style={s.infoTxt}>3. Pequenas diferenças são ajustadas automaticamente</Text>
              <Text style={s.infoTxt}>4. Diferenças grandes precisam de foto + Admin aprovar</Text>
            </Card>

            <ActionButton
              label={abrindo ? 'Abrindo...' : `Iniciar contagem do ${local}`}
              onPress={handleAbrir}
              disabled={abrindo}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 32 },

  localRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  localBtn: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center', backgroundColor: colors.surface },
  localBtnAtivo: { borderColor: colors.primary, backgroundColor: colors.accentLight },
  localBtnTxt: { fontSize: 14, fontWeight: '700', color: colors.textSub },
  localBtnTxtAtivo: { color: colors.primary },

  welcomeCard: { alignItems: 'center', gap: 8, padding: 24 },
  welcomeIcon: { fontSize: 48 },
  welcomeTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  welcomeSub: { fontSize: 13, color: colors.textSub, textAlign: 'center', lineHeight: 19 },

  statusCard: { gap: 6 },
  statusHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.success },
  statusTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  statusInfo: { fontSize: 13, color: colors.textSub },

  infoCard: { backgroundColor: colors.infoLight, gap: 4 },
  infoTitle: { fontSize: 13, fontWeight: '700', color: colors.info, marginBottom: 4 },
  infoTxt: { fontSize: 12, color: colors.info, lineHeight: 18 },

  verResumoBtn: { alignItems: 'center', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.accentLight },
  verResumoBtnTxt: { fontSize: 13, fontWeight: '700', color: colors.primary },

  fecharTurnoBtn: { alignItems: 'center', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.danger, backgroundColor: colors.dangerLight },
  fecharTurnoTxt: { fontSize: 14, fontWeight: '700', color: colors.danger },

  deletarTurnoBtn: { alignItems: 'center', padding: 14, borderRadius: 14, borderWidth: 2, borderColor: '#7D1F1F', backgroundColor: '#2A0E0E', borderStyle: 'dashed' },
  deletarTurnoTxt: { fontSize: 13, fontWeight: '700', color: '#FF6B6B' },

  transferenciaCard: { gap: 10, backgroundColor: colors.infoLight, borderWidth: 1, borderColor: colors.info },
  transferenciaTitle: { fontSize: 13, fontWeight: '800', color: colors.info },
  transferenciaItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 6, borderTopWidth: 1, borderTopColor: colors.border },
  transferenciaProduto: { fontSize: 13, fontWeight: '700', color: colors.text },
  transferenciaSub: { fontSize: 11, color: colors.textSub, marginTop: 2 },
  transferenciaAcoes: { flexDirection: 'row', gap: 6 },
  confirmarBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.info },
  confirmarBtnTxt: { fontSize: 12, fontWeight: '700', color: '#fff' },
  recusarBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.dangerLight, borderWidth: 1, borderColor: colors.danger },
  recusarBtnTxt: { fontSize: 12, fontWeight: '700', color: colors.danger },

  erroComandaBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.warningLight, borderRadius: 14, padding: 14, gap: 12, borderWidth: 1, borderColor: colors.warning },
  erroComandaIcon: { fontSize: 24 },
  erroComandaTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  erroComandaSub: { fontSize: 11, color: colors.textSub, marginTop: 2 },
  erroComandaArrow: { fontSize: 22, color: colors.warning },
})
