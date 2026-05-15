import React from 'react'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { Provider } from 'react-redux'
import { store } from './src/store'
import { AuthProvider } from './src/contexts/AuthContext'
import { Navigation } from './src/navigation'
import { ToastProvider } from './src/components/Toast'

export default function App() {
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
