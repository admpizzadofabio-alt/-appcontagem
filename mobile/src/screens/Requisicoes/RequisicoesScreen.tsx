import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors } from '../../theme/colors'

export function RequisicoesScreen() {
  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <View style={s.container}>
        <View style={s.badge}>
          <Text style={s.badgeTxt}>EM DESENVOLVIMENTO</Text>
        </View>
        <Text style={s.icon}>🔗</Text>
        <Text style={s.title}>Requisições de Estoque</Text>
        <Text style={s.sub}>
          Esta área receberá solicitações de outros aplicativos integrados ao sistema.
        </Text>
        <View style={s.infoBox}>
          <Text style={s.infoItem}>📥  Receber pedidos externos</Text>
          <Text style={s.infoItem}>✅  Aprovar ou recusar requisições</Text>
          <Text style={s.infoItem}>📊  Acompanhar status em tempo real</Text>
          <Text style={s.infoItem}>🔔  Notificações de novas solicitações</Text>
        </View>
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 16 },

  badge: { backgroundColor: colors.warningLight, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: colors.warning },
  badgeTxt: { fontSize: 11, fontWeight: '800', color: colors.warning, letterSpacing: 1 },

  icon: { fontSize: 56, marginTop: 8 },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, textAlign: 'center' },
  sub: { fontSize: 14, color: colors.textSub, textAlign: 'center', lineHeight: 21, maxWidth: 280 },

  infoBox: { backgroundColor: colors.surface, borderRadius: 16, padding: 20, gap: 12, width: '100%', marginTop: 8, borderWidth: 1, borderColor: colors.border },
  infoItem: { fontSize: 14, color: colors.textSub, lineHeight: 20 },
})
