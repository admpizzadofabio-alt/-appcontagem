import React, { useState, useRef, useEffect } from 'react'
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Animated, Easing, Image } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { useAuth } from '../../contexts/AuthContext'
import { PinPad } from '../../components/PinPad'
import { useToast } from '../../components/Toast'
import { colors } from '../../theme/colors'

export function LoginScreen() {
  const { signIn, signInWithBiometric, biometricAvailable } = useAuth()
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  // Animação de entrada: logo, brand, card e pinpad aparecem em sequência
  const logoOpacity = useRef(new Animated.Value(0)).current
  const logoScale = useRef(new Animated.Value(0.7)).current
  const brandY = useRef(new Animated.Value(20)).current
  const brandOpacity = useRef(new Animated.Value(0)).current
  const cardY = useRef(new Animated.Value(40)).current
  const cardOpacity = useRef(new Animated.Value(0)).current
  const pinOpacity = useRef(new Animated.Value(0)).current
  const bioOpacity = useRef(new Animated.Value(0)).current

  // Shake do PinPad em erro
  const shake = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.spring(logoScale, { toValue: 1, useNativeDriver: true, tension: 50, friction: 7 }),
      ]),
      Animated.parallel([
        Animated.timing(brandY, { toValue: 0, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(brandOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(cardY, { toValue: 0, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(cardOpacity, { toValue: 1, duration: 450, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(pinOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(bioOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
    ]).start()
  }, [])

  function shakePin() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {})
    shake.setValue(0)
    Animated.sequence([
      Animated.timing(shake, { toValue: 12, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -12, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start()
  }

  async function handlePinChange(value: string) {
    setPin(value)
    if (value.length === 6) {
      setLoading(true)
      try {
        await signIn(value, true)
      } catch (e: any) {
        shakePin()
        const status = e?.response?.status
        const headers = e?.response?.headers ?? {}
        const remaining = Number(headers['x-ratelimit-remaining'] ?? headers['ratelimit-remaining'] ?? NaN)
        const resetSec = Number(headers['x-ratelimit-reset'] ?? headers['ratelimit-reset'] ?? NaN)
        if (status === 429) {
          const mins = Number.isFinite(resetSec) ? Math.max(1, Math.ceil((resetSec - Date.now()/1000) / 60)) : 15
          toast.error(`Muitas tentativas. Aguarde ${mins} min.`)
        } else if (Number.isFinite(remaining) && remaining <= 0) {
          toast.error('Última tentativa antes do bloqueio.')
        } else if (Number.isFinite(remaining) && remaining <= 3) {
          toast.error(`PIN inválido — ${remaining} tentativa${remaining === 1 ? '' : 's'} restante${remaining === 1 ? '' : 's'}.`)
        } else {
          toast.error('PIN inválido. Tente novamente.')
        }
        setPin('')
      } finally {
        setLoading(false)
      }
    }
  }

  async function handleBiometric() {
    try { await signInWithBiometric() }
    catch (e: any) { toast.error(e?.message ?? 'Falha na biometria') }
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.top}>
        <Animated.View style={[s.logoBox, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
          <Image source={require('../../../assets/icon.png')} style={s.logoImage} resizeMode="contain" />
        </Animated.View>
        <Animated.Text style={[s.brand, { opacity: brandOpacity, transform: [{ translateY: brandY }] }]}>
          Pizza do Fábio
        </Animated.Text>
        <Animated.Text style={[s.tagline, { opacity: brandOpacity, transform: [{ translateY: brandY }] }]}>
          Controle de Bebidas
        </Animated.Text>
      </View>

      <Animated.View style={[s.card, { opacity: cardOpacity, transform: [{ translateY: cardY }] }]}>
        <Text style={s.cardTitle}>Bem-vindo!</Text>
        <Text style={s.cardSub}>Digite seu PIN de 6 dígitos</Text>
      </Animated.View>

      <Animated.View style={[s.pinArea, { opacity: pinOpacity, transform: [{ translateX: shake }] }]}>
        {loading
          ? <ActivityIndicator size="large" color="#fff" style={{ marginVertical: 40 }} />
          : <PinPad value={pin} onChange={handlePinChange} maxLength={6} />
        }

        {biometricAvailable && !loading && (
          <Animated.View style={{ opacity: bioOpacity }}>
            <TouchableOpacity style={s.bioBtn} onPress={handleBiometric} activeOpacity={0.7}>
              <Text style={s.bioIcon}>👆</Text>
              <Text style={s.bioLabel}>Entrar com Digital</Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </Animated.View>

      <Text style={s.footer}>v2.0 · Pizza do Fábio ERP</Text>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.primary, justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 20 },
  top: { alignItems: 'center', gap: 8, paddingTop: 16 },
  logoBox: {
    width: 140, height: 140, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  logoEmoji: { fontSize: 44 },
  logoImage: { width: 140, height: 140, borderRadius: 32 },
  brand: { color: '#fff', fontSize: 26, fontWeight: '800' },
  tagline: { color: 'rgba(255,255,255,0.55)', fontSize: 14, fontWeight: '500' },
  card: {
    backgroundColor: colors.surface, borderRadius: 28, padding: 28,
    alignItems: 'center', gap: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25, shadowRadius: 28, elevation: 14,
  },
  cardTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  cardSub: { fontSize: 13, color: colors.textSub },
  pinArea: { alignItems: 'center', gap: 24 },
  bioBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 22, paddingVertical: 12, borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  bioIcon: { fontSize: 20 },
  bioLabel: { color: '#fff', fontWeight: '600', fontSize: 14 },
  footer: { textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 11 },
})
