import React, { useEffect, useState } from 'react'
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { Provider } from 'react-redux'
import * as Updates from 'expo-updates'
import { store } from './src/store'
import { AuthProvider } from './src/contexts/AuthContext'
import { Navigation } from './src/navigation'
import { ToastProvider } from './src/components/Toast'

export default function App() {
  const [statusUpdate, setStatusUpdate] = useState<'verificando' | 'baixando' | null>(null)

  useEffect(() => {
    async function aplicarUpdate() {
      if (__DEV__) return
      try {
        setStatusUpdate('verificando')
        const r = await Updates.checkForUpdateAsync()
        if (r.isAvailable) {
          setStatusUpdate('baixando')
          await Updates.fetchUpdateAsync()
          await Updates.reloadAsync()
          return
        }
        setStatusUpdate(null)
      } catch {
        setStatusUpdate(null)
      }
    }
    aplicarUpdate()
  }, [])

  if (statusUpdate) {
    return (
      <View style={s.overlay}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={s.overlayText}>
          {statusUpdate === 'verificando' ? 'Verificando atualizações…' : 'Baixando atualização…'}
        </Text>
      </View>
    )
  }

  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <ToastProvider>
          <AuthProvider>
            <StatusBar style="light" backgroundColor="#1a4731" />
            <Navigation />
          </AuthProvider>
        </ToastProvider>
      </SafeAreaProvider>
    </Provider>
  )
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#1a4731', alignItems: 'center', justifyContent: 'center', gap: 16 },
  overlayText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})
