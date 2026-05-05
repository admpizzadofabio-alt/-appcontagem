import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native'
import { colors } from '../theme/colors'

interface Props {
  title: string
  subtitle?: string
  right?: React.ReactNode
  icon?: string
  onPress?: () => void
  style?: ViewStyle
  danger?: boolean
}

export function ListItem({ title, subtitle, right, icon, onPress, style, danger }: Props) {
  const Wrapper = onPress ? TouchableOpacity : View
  return (
    <Wrapper style={[styles.item, style]} onPress={onPress} activeOpacity={0.7}>
      {icon && (
        <View style={[styles.iconBox, danger && { backgroundColor: colors.dangerLight }]}>
          <Text style={styles.iconText}>{icon}</Text>
        </View>
      )}
      <View style={styles.body}>
        <Text style={[styles.title, danger && { color: colors.danger }]} numberOfLines={1}>{title}</Text>
        {subtitle && <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>}
      </View>
      {right && <View style={styles.right}>{right}</View>}
    </Wrapper>
  )
}

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    gap: 12,
    marginBottom: 8,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 1,
  },
  iconBox: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: colors.accentLight,
    alignItems: 'center', justifyContent: 'center',
  },
  iconText: { fontSize: 18 },
  body: { flex: 1 },
  title: { fontSize: 14, fontWeight: '600', color: colors.text },
  subtitle: { fontSize: 12, color: colors.textSub, marginTop: 2 },
  right: { alignItems: 'flex-end' },
})
