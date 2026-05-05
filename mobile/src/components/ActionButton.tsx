import React from 'react'
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle } from 'react-native'
import { colors } from '../theme/colors'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'

interface Props {
  label: string
  onPress: () => void
  variant?: Variant
  loading?: boolean
  disabled?: boolean
  style?: ViewStyle
  icon?: string
}

const variantStyles: Record<Variant, { bg: string; text: string; border?: string }> = {
  primary: { bg: colors.primary, text: '#fff' },
  secondary: { bg: colors.accentLight, text: colors.primary },
  danger: { bg: colors.dangerLight, text: colors.danger },
  ghost: { bg: 'transparent', text: colors.primary, border: colors.border },
}

export function ActionButton({ label, onPress, variant = 'primary', loading, disabled, style, icon }: Props) {
  const v = variantStyles[variant]
  return (
    <TouchableOpacity
      style={[
        styles.btn,
        { backgroundColor: v.bg, borderColor: v.border ?? 'transparent', borderWidth: v.border ? 1 : 0 },
        (disabled || loading) && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading
        ? <ActivityIndicator color={v.text} size="small" />
        : <Text style={[styles.label, { color: v.text }]}>{icon ? `${icon}  ${label}` : label}</Text>
      }
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  btn: {
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  disabled: { opacity: 0.5 },
  label: { fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },
})
