import React, { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '../../contexts/AuthContext'
import { useSummaryEstoqueQuery } from '../../services/api/estoque'
import { useListarPendentesQuery, useListarTransferenciasPendentesQuery } from '../../services/api/movimentacoes'
import { useTurnoAtualQuery } from '../../services/api/turnos'
import { StatCard } from '../../components/StatCard'
import { Card } from '../../components/Card'
import { SectionHeader } from '../../components/SectionHeader'
import { BotaoColibriCarregar } from '../../components/BotaoColibriCarregar'
import { useColibriNovosQuery } from '../../services/api/colibri'
import { useListarProdutosQuery } from '../../services/api/produtos'
import { colors } from '../../theme/colors'
import type { AppStackParams } from '../../navigation/types'

type Nav = NativeStackNavigationProp<AppStackParams>

export function HomeScreen() {
  const nav = useNavigation<Nav>()
  const { usuario, signOut } = useAuth()
  const { data: summary } = useSummaryEstoqueQuery()
  const { data: pendentes } = useListarPendentesQuery()

  const isAdmin = usuario?.nivelAcesso === 'Admin'
  const isSup = isAdmin || usuario?.nivelAcesso === 'Supervisor'
  const localOperador = (usuario?.setor === 'Delivery' ? 'Delivery' : 'Bar') as 'Bar' | 'Delivery'
  // Polling: 15s para sincronizar turno aberto/fechado por outro dispositivo (admin/outro op)
  const { data: turnoAtual } = useTurnoAtualQuery({ local: localOperador }, { pollingInterval: 15000 })
  const { data: turnoDelivery } = useTurnoAtualQuery({ local: 'Delivery' }, { skip: !isAdmin, pollingInterval: 15000 })
  const { data: turnoBar } = useTurnoAtualQuery({ local: 'Bar' }, { skip: !isAdmin, pollingInterval: 15000 })
  const { data: colibriNovos } = useColibriNovosQuery(undefined, {
    skip: !isSup,
    pollingInterval: 60 * 60 * 1000, // re-verifica a cada 1h
  })
  const { data: produtosAtivos = [] } = useListarProdutosQuery({ ativo: true }, { skip: !isSup })
  const semCargaCount = produtosAtivos.filter((p) => !p.marcoInicialEm).length

  const [pendentesVistos, setPendentesVistos] = useState<Set<string>>(new Set())
  const pendentesNovos = isAdmin ? (pendentes ?? []).filter((p) => !pendentesVistos.has(p.id)) : []

  function irParaAprovacoes() {
    setPendentesVistos(new Set((pendentes ?? []).map((p) => p.id)))
    nav.navigate('Admin')
  }

  const turnoAberto = !!turnoAtual
  const contagemFinalizada = turnoAtual?.contagem?.status === 'Fechada'
  const operacoesLiberadas = isAdmin || (turnoAberto && contagemFinalizada)
  const turnosAdmin = isAdmin ? [turnoBar, turnoDelivery].filter(Boolean) : []
  const algumTurnoAberto = isAdmin ? turnosAdmin.length > 0 : turnoAberto

  const localOutro = (localOperador === 'Bar' ? 'Delivery' : 'Bar') as 'Bar' | 'Delivery'
  const turnoOutro = localOperador === 'Bar' ? turnoDelivery : turnoBar
  const { data: transfPendentes = [] } = useListarTransferenciasPendentesQuery(
    { local: localOperador },
    { skip: !operacoesLiberadas },
  )
  const { data: transfPendentesOutro = [] } = useListarTransferenciasPendentesQuery(
    { local: localOutro },
    { skip: !isAdmin },
  )

  function bloqueadoAlert() {
    if (!turnoAberto) {
      Alert.alert('Turno não aberto', 'Abra o turno e finalize a contagem antes de registrar movimentações.')
    } else {
      Alert.alert('Contagem pendente', 'Finalize a contagem do turno antes de registrar movimentações.')
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <Text style={s.greeting}>Olá, {usuario?.nome?.split(' ')[0]} 👋</Text>
            <Text style={s.headerSub}>{usuario?.setor} · {usuario?.nivelAcesso}</Text>
          </View>
          <TouchableOpacity style={s.avatarBtn}
            onPress={() => Alert.alert('Sair', 'Deseja encerrar a sessão?', [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Sair', style: 'destructive', onPress: signOut }
            ])}>
            <Text style={s.avatarText}>{usuario?.nome?.charAt(0) ?? '?'}</Text>
          </TouchableOpacity>
        </View>

        {/* KPIs */}
        <SectionHeader title="Resumo do Estoque" />
        <View style={s.statsRow}>
          <StatCard
            label="Valor Ativo"
            value={summary ? `R$ ${summary.totalValor.toFixed(0)}` : '—'}
            icon="💰"
            color={colors.primary}
            bg={colors.accentLight}
          />
          <StatCard
            label="Alertas"
            value={summary ? String(summary.alertas) : '—'}
            icon="⚠️"
            color={summary?.alertas ? colors.danger : colors.success}
            bg={summary?.alertas ? colors.dangerLight : colors.successLight}
          />
          {isSup && (
            <StatCard
              label="Aprovações"
              value={String(pendentes?.length ?? 0)}
              icon="🔔"
              color={pendentes?.length ? colors.warning : colors.success}
              bg={pendentes?.length ? colors.warningLight : colors.successLight}
            />
          )}
        </View>

        {/* Abrir Turno em destaque — só mostra quando não há nenhum turno aberto */}
        {!algumTurnoAberto && (
          <TouchableOpacity
            style={s.openCaixaBtn}
            onPress={() => nav.navigate('AbrirTurno', usuario?.setor === 'Delivery' ? { local: 'Delivery' } : { local: 'Bar' })}
            activeOpacity={0.85}
          >
            <Text style={s.openCaixaIcon}>🔓</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.openCaixaTitle}>Abrir Turno</Text>
              <Text style={s.openCaixaSub}>Iniciar turno com contagem</Text>
            </View>
            <Text style={s.openCaixaArrow}>›</Text>
          </TouchableOpacity>
        )}

        {/* Status do turno — Admin vê um card por local aberto, Operador vê o próprio */}
        {isAdmin ? turnosAdmin.map((t) => {
          const tContagemOk = t!.contagem?.status === 'Fechada'
          return (
            <TouchableOpacity
              key={t!.id}
              style={[s.turnoStatusCard, tContagemOk ? s.turnoStatusOk : s.turnoStatusBloqueado]}
              onPress={() => nav.navigate('AbrirTurno', { local: t!.local as 'Bar' | 'Delivery' })}
              activeOpacity={0.85}
            >
              <Text style={s.turnoStatusIcon}>{tContagemOk ? '🟢' : '🟡'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.turnoStatusTitle}>
                  {tContagemOk ? 'Turno em operação' : 'Contagem pendente'}
                </Text>
                <Text style={s.turnoStatusSub}>
                  {tContagemOk
                    ? `${t!.local} · Operações liberadas`
                    : `${t!.local} · Finalize a contagem para liberar operações`}
                </Text>
              </View>
              <Text style={s.turnoStatusArrow}>›</Text>
            </TouchableOpacity>
          )
        }) : (
          <TouchableOpacity
            style={[s.turnoStatusCard, operacoesLiberadas ? s.turnoStatusOk : s.turnoStatusBloqueado]}
            onPress={() => nav.navigate('AbrirTurno', { local: localOperador })}
            activeOpacity={0.85}
          >
            <Text style={s.turnoStatusIcon}>{operacoesLiberadas ? '🟢' : turnoAberto ? '🟡' : '🔴'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.turnoStatusTitle}>
                {operacoesLiberadas ? 'Turno em operação' : turnoAberto ? 'Contagem pendente' : 'Sem turno aberto'}
              </Text>
              <Text style={s.turnoStatusSub}>
                {operacoesLiberadas
                  ? `${localOperador} · Operações liberadas`
                  : turnoAberto
                    ? 'Finalize a contagem para liberar operações'
                    : 'Abra o turno para iniciar o dia'}
              </Text>
            </View>
            <Text style={s.turnoStatusArrow}>›</Text>
          </TouchableOpacity>
        )}

        {/* Alerta de aprovações pendentes — Admin */}
        {pendentesNovos.length > 0 && (
          <TouchableOpacity style={s.alertaRevisaoCard} onPress={irParaAprovacoes} activeOpacity={0.85}>
            <Text style={s.alertaRevisaoIcon}>🔔</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.alertaRevisaoTitle}>
                {pendentesNovos.length} aprovação{pendentesNovos.length !== 1 ? 'ões' : ''} pendente{pendentesNovos.length !== 1 ? 's' : ''}
              </Text>
              <Text style={s.alertaRevisaoSub}>Entradas e perdas aguardando revisão · Toque para ver</Text>
            </View>
            <Text style={s.alertaRevisaoArrow}>›</Text>
          </TouchableOpacity>
        )}

        {/* Transferências pendentes de confirmação */}
        {transfPendentes.length > 0 && (
          <TouchableOpacity
            style={s.transfPendenteCard}
            onPress={() => nav.navigate('AbrirTurno', { local: localOperador })}
            activeOpacity={0.85}
          >
            <Text style={s.transfPendenteIcon}>📦</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.transfPendenteTitle}>
                {transfPendentes.length} transferência{transfPendentes.length !== 1 ? 's' : ''} aguardando confirmação
              </Text>
              <Text style={s.transfPendenteSub}>{localOperador} · Toque para confirmar recebimento</Text>
            </View>
            <Text style={s.transfPendenteArrow}>›</Text>
          </TouchableOpacity>
        )}
        {isAdmin && transfPendentesOutro.length > 0 && (
          <TouchableOpacity
            style={s.transfPendenteCard}
            onPress={() => nav.navigate('AbrirTurno', { local: localOutro })}
            activeOpacity={0.85}
          >
            <Text style={s.transfPendenteIcon}>📦</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.transfPendenteTitle}>
                {transfPendentesOutro.length} transferência{transfPendentesOutro.length !== 1 ? 's' : ''} aguardando confirmação
              </Text>
              <Text style={s.transfPendenteSub}>{localOutro} · Toque para confirmar recebimento</Text>
            </View>
            <Text style={s.transfPendenteArrow}>›</Text>
          </TouchableOpacity>
        )}

        {/* Aviso: produtos sem carga inicial */}
        {isSup && semCargaCount > 0 && (
          <TouchableOpacity style={s.semCargaCard} onPress={() => nav.navigate('Produtos')} activeOpacity={0.85}>
            <Text style={s.semCargaIcon}>⚠️</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.semCargaTitle}>
                {semCargaCount} produto(s) sem carga inicial
              </Text>
              <Text style={s.semCargaSub}>
                Colibri não desconta vendas sem carga. Toque para definir.
              </Text>
            </View>
            <Text style={s.semCargaArrow}>›</Text>
          </TouchableOpacity>
        )}

        {/* Vendas Colibri — importar antes de abrir turno/contar */}
        <View style={s.colibriHeaderRow}>
          <Text style={s.colibriHeaderTitle}>Integração Colibri</Text>
          {isSup && (colibriNovos?.count ?? 0) > 0 && (
            <View style={s.badgeWrap}>
              <Text style={s.badgeTxt}>{colibriNovos!.count}</Text>
            </View>
          )}
        </View>

        {isSup && (colibriNovos?.count ?? 0) > 0 && (
          <TouchableOpacity style={s.novosProdutosCard} onPress={() => nav.navigate('Colibri')} activeOpacity={0.85}>
            <Text style={s.novosProdutosIcon}>🆕</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.novosProdutosTitle}>
                {colibriNovos!.count} produto(s) novo(s) no Colibri
              </Text>
              <Text style={s.novosProdutosSub}>
                {colibriNovos!.itens.slice(0, 2).map(i => i.colibriNome).join(', ')}
                {colibriNovos!.count > 2 ? ` e mais ${colibriNovos!.count - 2}…` : ''}
              </Text>
            </View>
            <Text style={s.novosProdutosArrow}>›</Text>
          </TouchableOpacity>
        )}

        <View style={{ marginBottom: 16 }}>
          <BotaoColibriCarregar />
        </View>

        {/* Ações rápidas */}
        <SectionHeader title="Ações Rápidas" />
        <View style={s.actionsGrid}>
          {[
            { label: 'Entrada', icon: '📥', cor: '#1A7F4B', bg: '#E8F5EE', descricao: 'Registrar mercadoria', onPress: () => operacoesLiberadas ? nav.navigate('Movimentacao', { tipo: 'Entrada' }) : bloqueadoAlert() },
            { label: 'Perda', icon: '🗑️', cor: '#C0392B', bg: '#FDEAEA', descricao: 'Registrar quebra', onPress: () => operacoesLiberadas ? nav.navigate('Movimentacao', { tipo: 'AjustePerda' }) : bloqueadoAlert() },
            { label: 'Transferência', icon: '🔄', cor: '#1A6FA8', bg: '#E8F4FB', descricao: 'Bar ↔ Delivery', onPress: () => operacoesLiberadas ? nav.navigate('Transferencia') : bloqueadoAlert() },
            { label: 'Err. Comanda', icon: '📋', cor: '#7D5400', bg: '#FFF3CD', descricao: 'Produto trocado', onPress: () => operacoesLiberadas ? nav.navigate('ErroComanda', { local: localOperador, turnoId: turnoAtual?.contagemId ?? undefined }) : bloqueadoAlert() },
          ].map((a) => (
            <TouchableOpacity
              key={a.label}
              style={[s.actionCard, { backgroundColor: operacoesLiberadas ? a.bg : colors.surfaceAlt }]}
              onPress={a.onPress}
              activeOpacity={0.82}
            >
              <View style={[s.actionIconWrap, { backgroundColor: operacoesLiberadas ? a.cor + '22' : colors.border + '44' }]}>
                <Text style={s.actionIcon}>{operacoesLiberadas ? a.icon : '🔒'}</Text>
              </View>
              <Text style={[s.actionLabel, { color: operacoesLiberadas ? a.cor : colors.textMuted }]}>{a.label}</Text>
              <Text style={[s.actionDesc, { color: operacoesLiberadas ? a.cor + 'AA' : colors.textMuted }]}>{a.descricao}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Menu adicional */}
        <SectionHeader title="Gestão" />
        <Card style={s.menuCard} padding={8}>
          {[
            { icon: '📅', label: 'Meu Turno', onPress: () => nav.navigate('MeuTurno') },
            { icon: '🛒', label: 'Pedidos de Compra', onPress: () => nav.navigate('Pedidos') },
            { icon: '📈', label: 'Relatórios', onPress: () => nav.navigate('Relatorios') },
            ...(isSup ? [{ icon: '✅', label: 'Aprovações Pendentes', onPress: () => nav.navigate('Admin') }] : []),
          ].map((item) => (
            <TouchableOpacity key={item.label} style={s.menuItem} onPress={item.onPress} activeOpacity={0.7}>
              <Text style={s.menuIcon}>{item.icon}</Text>
              <Text style={s.menuLabel}>{item.label}</Text>
              <Text style={s.menuArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </Card>


        {isAdmin && (
          <>
            <SectionHeader title="Administração" />


            <Card style={s.menuCard} padding={8}>
              {[
                { icon: '👥', label: 'Usuários', onPress: () => nav.navigate('Usuarios') },
                { icon: '🍺', label: 'Produtos', onPress: () => nav.navigate('Produtos') },
                { icon: '📦', label: 'Carga Inicial de Estoque', onPress: () => nav.navigate('Movimentacao', { tipo: 'CargaInicial' }) },
              ].map((item) => (
                <TouchableOpacity key={item.label} style={s.menuItem} onPress={item.onPress} activeOpacity={0.7}>
                  <Text style={s.menuIcon}>{item.icon}</Text>
                  <Text style={s.menuLabel}>{item.label}</Text>
                  <Text style={s.menuArrow}>›</Text>
                </TouchableOpacity>
              ))}
            </Card>
          </>
        )}

      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 4, paddingBottom: 32 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.primary, borderRadius: 20, padding: 18, marginBottom: 16 },
  headerLeft: { gap: 2 },
  greeting: { color: '#fff', fontSize: 18, fontWeight: '700' },
  headerSub: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
  avatarBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },

  turnoStatusCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, padding: 14, marginBottom: 12, gap: 12, borderWidth: 1 },
  turnoStatusOk: { backgroundColor: colors.successLight, borderColor: colors.success },
  turnoStatusBloqueado: { backgroundColor: colors.warningLight, borderColor: colors.warning },
  turnoStatusIcon: { fontSize: 22 },
  turnoStatusTitle: { fontSize: 13, fontWeight: '800', color: colors.text },
  turnoStatusSub: { fontSize: 11, color: colors.textSub, marginTop: 2 },
  turnoStatusArrow: { fontSize: 20, color: colors.textMuted },

  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  actionCard: {
    width: '47%', borderRadius: 20, padding: 18, gap: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  actionIconWrap: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  actionIcon: { fontSize: 24 },
  actionLabel: { fontSize: 14, fontWeight: '800', marginTop: 2 },
  actionDesc: { fontSize: 11, fontWeight: '500' },

  menuCard: { marginBottom: 16, borderRadius: 16 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 12, gap: 12, borderBottomWidth: 1, borderBottomColor: colors.divider },
  menuIcon: { fontSize: 20 },
  menuLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text },
  menuArrow: { fontSize: 20, color: colors.textMuted },

  openCaixaBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.accentLight, borderRadius: 16, padding: 16, marginBottom: 16, gap: 14, borderWidth: 1, borderColor: colors.primary },
  openCaixaIcon: { fontSize: 28 },
  openCaixaTitle: { fontSize: 15, fontWeight: '800', color: colors.primary },
  openCaixaSub: { fontSize: 12, color: colors.primaryDark, marginTop: 2 },
  openCaixaArrow: { fontSize: 24, color: colors.primary, fontWeight: '300' },

  // Badge Colibri novos produtos
  colibriHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, marginBottom: 4 },
  colibriHeaderTitle: { fontSize: 13, fontWeight: '700', color: colors.textSub, textTransform: 'uppercase', letterSpacing: 0.5, flex: 1 },
  badgeWrap: { backgroundColor: colors.danger, borderRadius: 10, minWidth: 20, height: 20, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  badgeTxt: { color: '#fff', fontSize: 11, fontWeight: '800' },
  novosProdutosCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#EEF6FF', borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#3B82F6' },
  novosProdutosIcon: { fontSize: 26 },
  novosProdutosTitle: { fontSize: 13, fontWeight: '800', color: '#1D4ED8' },
  novosProdutosSub: { fontSize: 11, color: '#3B82F6', marginTop: 2 },
  novosProdutosArrow: { fontSize: 22, color: '#3B82F6' },
  transfPendenteCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.infoLight, borderRadius: 14, padding: 14, marginBottom: 4, borderWidth: 1, borderColor: colors.info },
  transfPendenteIcon: { fontSize: 26 },
  transfPendenteTitle: { fontSize: 13, fontWeight: '800', color: colors.info },
  transfPendenteSub: { fontSize: 11, color: colors.info, marginTop: 2 },
  transfPendenteArrow: { fontSize: 22, color: colors.info },

  semCargaCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFF3CD', borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#FFC107' },
  semCargaIcon: { fontSize: 26 },
  semCargaTitle: { fontSize: 13, fontWeight: '800', color: '#7D5400' },
  semCargaSub: { fontSize: 11, color: '#7D5400', marginTop: 2 },
  semCargaArrow: { fontSize: 22, color: '#7D5400' },

  // Alerta produtos pendentes
  alertaRevisaoCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFF3CD', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#FFC107', marginBottom: 4,
  },
  alertaRevisaoIcon: { fontSize: 26 },
  alertaRevisaoTitle: { fontSize: 13, fontWeight: '800', color: '#7D5400' },
  alertaRevisaoSub: { fontSize: 11, color: '#9A6700', marginTop: 2 },
  alertaRevisaoArrow: { fontSize: 22, color: '#7D5400', fontWeight: '300' },
})
