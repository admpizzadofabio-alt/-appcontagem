import React from 'react'
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native'
import { colors } from '../theme/colors'

interface Props {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
  padding?: number
}

export function Card({ children, style, padding = 16 }: Props) {
  return (
    <View style={[styles.card, { padding }, style]}>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
})
