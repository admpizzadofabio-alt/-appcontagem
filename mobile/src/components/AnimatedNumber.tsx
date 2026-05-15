import React, { useEffect, useRef, useState } from 'react'
import { Animated, Text, TextStyle, StyleProp, Easing } from 'react-native'

interface Props {
  value: number
  style?: StyleProp<TextStyle>
  duration?: number
  decimals?: number
  suffix?: string
}

export function AnimatedNumber({ value, style, duration = 600, decimals = 0, suffix }: Props) {
  const animated = useRef(new Animated.Value(value)).current
  const [display, setDisplay] = useState(value)
  const isFirstRender = useRef(true)

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      setDisplay(value)
      animated.setValue(value)
      return
    }
    const listener = animated.addListener(({ value: v }) => setDisplay(v))
    Animated.timing(animated, {
      toValue: value,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start()
    return () => animated.removeListener(listener)
  }, [value, duration])

  const txt = decimals > 0 ? display.toFixed(decimals) : Math.round(display).toString()
  return <Text style={style}>{txt}{suffix ?? ''}</Text>
}
