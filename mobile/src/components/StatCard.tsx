import React from 'react'
import { View, Text, StyleSheet, ViewStyle } from 'react-native'
import { colors } from '../theme/colors'

interface Props {
  label: string
  value: string
  icon: string
  color?: string
  bg?: string
  style?: ViewStyle
}

export function StatCard({ label, value, icon, color = colors.primary, bg = colors.accentLight, style }: Props) {
  return (
    <View style={[styles.card, style]}>
      <View style={[styles.iconBox, { backgroundColor: bg }]}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <Text style={[styles.value, { color }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
    flex: 1,
    minWidth: 80,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  icon: { fontSize: 20 },
  value: { fontSize: 20, fontWeight: '700', marginBottom: 2 },
  label: { fontSize: 11, color: colors.textSub, textAlign: 'center', fontWeight: '500' },
})
