import React from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useAuth } from '../../contexts/AuthContext'
import { SectionHeader } from '../../components/SectionHeader'
import { colors } from '../../theme/colors'
import type { AppStackParams } from '../../navigation/types'
import { useRevisoesPendentesQuery } from '../../services/api/turnos'
import { useListarPendentesQuery } from '../../services/api/movimentacoes'

type Nav = NativeStackNavigationProp<AppStackParams>

interface MenuItem {
  icon: string
  label: string
  sub: string
  onPress: () => void
  role?: 'Supervisor' | 'Admin'
  badge?: number
}

export function MaisScreen() {
  const navigation = useNavigation<Nav>()
  const { usuario, signOut } = useAuth()
  const nivel = usuario?.nivelAcesso
  const isSupervisor = nivel === 'Supervisor' || nivel === 'Admin'
  const { data: revisoes = [] } = useRevisoesPendentesQuery(undefined, { skip: !isSupervisor })
  const { data: pendentesAprov = [] } = useListarPendentesQuery(undefined, { skip: !isSupervisor })
  const totalPendentes = revisoes.length + pendentesAprov.length

  function handleSignOut() {
    Alert.alert('Sair', 'Deseja encerrar a sessão?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: signOut },
    ])
  }

  const operacional: MenuItem[] = [
    {
      icon: '🔄',
      label: 'Transferência',
      sub: 'Mover estoque entre Bar e Delivery',
      onPress: () => navigation.navigate('Transferencia'),
    },
    {
      icon: '🛒',
      label: 'Pedidos de Compra',
      sub: 'Solicitar reposição de produtos',
      onPress: () => navigation.navigate('Pedidos'),
    },
    {
      icon: '📊',
      label: 'Relatórios',
      sub: 'Visão geral, divergências e auditoria',
      onPress: () => navigation.navigate('Relatorios'),
      role: 'Supervisor',
    },
  ]

  const gestao: MenuItem[] = [
    {
      icon: '✅',
      label: 'Aprovações',
      sub: 'Gerenciar movimentações pendentes',
      onPress: () => navigation.navigate('Admin'),
      role: 'Supervisor',
      badge: totalPendentes > 0 ? totalPendentes : undefined,
    },
    {
      icon: '👥',
      label: 'Usuários',
      sub: 'Criar e gerenciar operadores',
      onPress: () => navigation.navigate('Usuarios'),
      role: 'Admin',
    },
    {
      icon: '🍺',
      label: 'Produtos',
      sub: 'Cadastrar e configurar produtos',
      onPress: () => navigation.navigate('Produtos'),
      role: 'Admin',
    },
    {
      icon: '🔗',
      label: 'Colibri POS',
      sub: 'Importar vendas e baixar estoque automaticamente',
      onPress: () => navigation.navigate('Colibri'),
      role: 'Admin',
    },
    {
      icon: '📊',
      label: 'Analytics & Export',
      sub: 'CMV, loss rate, vendas por hora, transferências e export CSV',
      onPress: () => navigation.navigate('Analytics'),
      role: 'Supervisor',
    },
    {
      icon: '📋',
      label: 'Logs de Auditoria',
      sub: 'Filtrar e buscar nos logs do sistema',
      onPress: () => navigation.navigate('Auditoria'),
      role: 'Admin',
    },
    {
      icon: '🔐',
      label: 'Autenticação 2 Fatores',
      sub: 'Adicionar código TOTP no login',
      onPress: () => navigation.navigate('Setup2FA'),
      role: 'Admin',
    },
  ]

  function canSee(role?: 'Supervisor' | 'Admin') {
    if (!role) return true
    if (role === 'Supervisor') return nivel === 'Supervisor' || nivel === 'Admin'
    return nivel === 'Admin'
  }

  const visibleOperacional = operacional.filter((m) => canSee(m.role))
  const visibleGestao = gestao.filter((m) => canSee(m.role))

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <ScrollView style={s.scroll} contentContainerStyle={s.content}>

        <View style={s.profile}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{usuario?.nome.charAt(0) ?? '?'}</Text>
          </View>
          <View>
            <Text style={s.profileName}>{usuario?.nome}</Text>
            <Text style={s.profileMeta}>{usuario?.setor} · {usuario?.nivelAcesso}</Text>
          </View>
        </View>

        <SectionHeader title="Operacional" />
        {visibleOperacional.map((item) => (
          <MenuCard key={item.label} {...item} />
        ))}

        {visibleGestao.length > 0 && (
          <>
            <SectionHeader title="Gestão" />
            {visibleGestao.map((item) => (
              <MenuCard key={item.label} {...item} />
            ))}
          </>
        )}

        <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut}>
          <Text style={s.signOutText}>🚪  Sair da conta</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  )
}

function MenuCard({ icon, label, sub, onPress, badge }: MenuItem) {
  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.75}>
      <View style={s.cardIcon}>
        <Text style={s.cardIconText}>{icon}</Text>
      </View>
      <View style={s.cardBody}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={s.cardLabel}>{label}</Text>
          {badge !== undefined && badge > 0 && (
            <View style={s.badge}>
              <Text style={s.badgeTxt}>{badge}</Text>
            </View>
          )}
        </View>
        <Text style={s.cardSub}>{sub}</Text>
      </View>
      <Text style={s.chevron}>›</Text>
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 10, paddingBottom: 40 },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 4, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.accentLight, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 22, fontWeight: '700', color: colors.primary },
  profileName: { fontSize: 16, fontWeight: '700', color: colors.text },
  profileMeta: { fontSize: 13, color: colors.textSub, marginTop: 2 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.surface, borderRadius: 14, padding: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  cardIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.accentLight, alignItems: 'center', justifyContent: 'center' },
  cardIconText: { fontSize: 20 },
  cardBody: { flex: 1, gap: 2 },
  cardLabel: { fontSize: 14, fontWeight: '700', color: colors.text },
  cardSub: { fontSize: 12, color: colors.textSub },
  chevron: { fontSize: 22, color: colors.textMuted, fontWeight: '300' },
  signOutBtn: { marginTop: 8, padding: 16, borderRadius: 14, backgroundColor: colors.surface, alignItems: 'center', borderWidth: 1, borderColor: colors.dangerLight },
  signOutText: { fontSize: 14, fontWeight: '600', color: colors.danger },
  badge: { backgroundColor: colors.danger, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  badgeTxt: { fontSize: 11, fontWeight: '800', color: '#fff' },
})
