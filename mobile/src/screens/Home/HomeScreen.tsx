import React from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '../../contexts/AuthContext'
import { useSummaryEstoqueQuery } from '../../services/api/estoque'
import { useListarPendentesQuery } from '../../services/api/movimentacoes'
import { useTurnoAtualQuery } from '../../services/api/turnos'
import { StatCard } from '../../components/StatCard'
import { Card } from '../../components/Card'
import { SectionHeader } from '../../components/SectionHeader'
import { BotaoColibriCarregar } from '../../components/BotaoColibriCarregar'
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
  const { data: turnoAtual } = useTurnoAtualQuery({ local: localOperador }, { skip: isAdmin })

  const turnoAberto = !!turnoAtual
  const contagemFinalizada = turnoAtual?.contagem?.status === 'Fechada'
  const operacoesLiberadas = isAdmin || (turnoAberto && contagemFinalizada)

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

        {/* Abrir Turno em destaque — só mostra quando não há turno aberto (ou para Admin) */}
        {(isAdmin || !turnoAberto) && (
          <TouchableOpacity
            style={s.openCaixaBtn}
            onPress={() => nav.navigate('AbrirCaixa', usuario?.setor === 'Delivery' ? { local: 'Delivery' } : { local: 'Bar' })}
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

        {/* Status do turno */}
        {!isAdmin && (
          <TouchableOpacity
            style={[s.turnoStatusCard, operacoesLiberadas ? s.turnoStatusOk : s.turnoStatusBloqueado]}
            onPress={() => nav.navigate('AbrirCaixa', { local: localOperador })}
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

        {/* Vendas Colibri — importar antes de abrir turno/contar */}
        <SectionHeader title="Integração Colibri" />
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
