import React, { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Animated, Easing } from 'react-native'
import LottieView from 'lottie-react-native'
import { colors } from '../theme/colors'

export function SplashScreen() {
  const logoOpacity = useRef(new Animated.Value(0)).current
  const logoScale = useRef(new Animated.Value(0.8)).current
  const subOpacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.spring(logoScale, { toValue: 1, useNativeDriver: true, tension: 40, friction: 7 }),
      ]),
      Animated.timing(subOpacity, { toValue: 1, duration: 400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start()
  }, [])

  return (
    <View style={s.wrap}>
      <Animated.View style={[s.logoBox, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
        <Text style={s.logo}>📦</Text>
        <Text style={s.titulo}>APPCONTAGEM</Text>
      </Animated.View>
      <Animated.View style={[s.lottieBox, { opacity: subOpacity }]}>
        <LottieView
          source={require('../../assets/animations/loading.lottie')}
          autoPlay
          loop
          style={s.lottie}
        />
      </Animated.View>
    </View>
  )
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  logoBox: { alignItems: 'center', gap: 12 },
  logo: { fontSize: 64 },
  titulo: { fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: 2 },
  lottieBox: { marginTop: 40, height: 80 },
  lottie: { width: 120, height: 80 },
})
