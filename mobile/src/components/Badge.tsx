import React from 'react'
import { View, Text, StyleSheet, ViewStyle } from 'react-native'
import { colors } from '../theme/colors'

type Variant = 'success' | 'warning' | 'danger' | 'info' | 'default'

const variantMap: Record<Variant, { bg: string; text: string }> = {
  success: { bg: colors.successLight, text: colors.success },
  warning: { bg: colors.warningLight, text: colors.warning },
  danger: { bg: colors.dangerLight, text: colors.danger },
  info: { bg: colors.infoLight, text: colors.info },
  default: { bg: colors.divider, text: colors.textSub },
}

interface Props {
  label: string
  variant?: Variant
  style?: ViewStyle
}

export function Badge({ label, variant = 'default', style }: Props) {
  const { bg, text } = variantMap[variant]
  return (
    <View style={[styles.badge, { backgroundColor: bg }, style]}>
      <Text style={[styles.text, { color: text }]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  text: { fontSize: 12, fontWeight: '600' },
})
