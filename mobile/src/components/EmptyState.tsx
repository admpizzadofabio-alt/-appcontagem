import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { colors } from '../theme/colors'

interface Props {
  icon?: string
  title: string
  subtitle?: string
}

export function EmptyState({ icon = '📭', title, subtitle }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  icon: { fontSize: 48, marginBottom: 8 },
  title: { fontSize: 16, fontWeight: '600', color: colors.text, textAlign: 'center' },
  subtitle: { fontSize: 13, color: colors.textSub, textAlign: 'center', lineHeight: 20 },
})
