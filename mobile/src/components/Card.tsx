import React, { useRef } from 'react'
import { View, StyleSheet, StyleProp, ViewStyle, Animated, Pressable } from 'react-native'
import * as Haptics from 'expo-haptics'
import { colors } from '../theme/colors'

interface Props {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
  padding?: number
  onPress?: () => void
}

export function Card({ children, style, padding = 16, onPress }: Props) {
  const scale = useRef(new Animated.Value(1)).current

  if (!onPress) {
    return <View style={[styles.card, { padding }, style]}>{children}</View>
  }

  const animTo = (to: number) => Animated.spring(scale, { toValue: to, useNativeDriver: true, tension: 200, friction: 12 }).start()

  return (
    <Pressable
      onPressIn={() => animTo(0.97)}
      onPressOut={() => animTo(1)}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); onPress() }}
    >
      <Animated.View style={[styles.card, { padding, transform: [{ scale }] }, style]}>
        {children}
      </Animated.View>
    </Pressable>
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
