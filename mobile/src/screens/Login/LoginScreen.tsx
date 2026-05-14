import React, { useState } from 'react'
import { View, Text, StyleSheet, Alert, ActivityIndicator, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '../../contexts/AuthContext'
import { PinPad } from '../../components/PinPad'
import { colors } from '../../theme/colors'

export function LoginScreen() {
  const { signIn, signInWithBiometric, biometricAvailable } = useAuth()
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)

  async function handlePinChange(value: string) {
    setPin(value)
    if (value.length === 6) {
      setLoading(true)
      try {
        await signIn(value, true)
      } catch {
        Alert.alert('PIN inválido', 'Verifique seu PIN e tente novamente.')
        setPin('')
      } finally {
        setLoading(false)
      }
    }
  }

  async function handleBiometric() {
    try { await signInWithBiometric() }
    catch (e: any) { Alert.alert('Biometria', e.message) }
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.top}>
        <View style={s.logoBox}>
          <Text style={s.logoEmoji}>🍕</Text>
        </View>
        <Text style={s.brand}>Pizza do Fábio</Text>
        <Text style={s.tagline}>Controle de Bebidas</Text>
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Bem-vindo!</Text>
        <Text style={s.cardSub}>Digite seu PIN de 6 dígitos</Text>
      </View>

      <View style={s.pinArea}>
        {loading
          ? <ActivityIndicator size="large" color="#fff" style={{ marginVertical: 40 }} />
          : <PinPad value={pin} onChange={handlePinChange} maxLength={6} />
        }

        {biometricAvailable && !loading && (
          <TouchableOpacity style={s.bioBtn} onPress={handleBiometric} activeOpacity={0.7}>
            <Text style={s.bioIcon}>👆</Text>
            <Text style={s.bioLabel}>Entrar com Digital</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={s.footer}>v2.0 · Pizza do Fábio ERP</Text>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.primary, justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 20 },
  top: { alignItems: 'center', gap: 8, paddingTop: 16 },
  logoBox: {
    width: 88, height: 88, borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    marginBottom: 8,
  },
  logoEmoji: { fontSize: 44 },
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
