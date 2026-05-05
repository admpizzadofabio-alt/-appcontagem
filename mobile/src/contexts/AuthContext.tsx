import React, { createContext, useContext, useState, useEffect } from 'react'
import * as LocalAuthentication from 'expo-local-authentication'
import { storage, KEYS } from '../config/storage'
import { api } from '../config/api'

export interface Usuario {
  id: string
  nome: string
  setor: string
  nivelAcesso: 'Operador' | 'Supervisor' | 'Admin'
}

interface AuthContextData {
  usuario: Usuario | null
  loading: boolean
  biometricAvailable: boolean
  signIn: (pin: string, saveBiometric?: boolean) => Promise<void>
  signInWithBiometric: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [loading, setLoading] = useState(true)
  const [biometricAvailable, setBiometricAvailable] = useState(false)

  useEffect(() => {
    async function init() {
      try {
        const [token, userStr, bioEnabled, bioSupported] = await Promise.all([
          storage.get(KEYS.ACCESS_TOKEN),
          storage.get(KEYS.USUARIO),
          storage.get(KEYS.BIOMETRIC_ENABLED),
          LocalAuthentication.hasHardwareAsync(),
        ])
        setBiometricAvailable(bioSupported && bioEnabled === 'true')
        if (token && userStr) setUsuario(JSON.parse(userStr))
      } catch {
        // ignora erro de sessão
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  async function signIn(pin: string, saveBiometric = false) {
    const { data } = await api.post('/auth/login', { pin })
    await storage.set(KEYS.ACCESS_TOKEN, data.accessToken)
    await storage.set(KEYS.REFRESH_TOKEN, data.refreshToken)
    await storage.set(KEYS.USUARIO, JSON.stringify(data.usuario))
    if (saveBiometric) {
      await storage.set(KEYS.BIOMETRIC_ENABLED, 'true')
      setBiometricAvailable(true)
    }
    setUsuario(data.usuario)
  }

  async function signInWithBiometric() {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Use sua digital para entrar',
      fallbackLabel: 'Usar PIN',
    })
    if (!result.success) throw new Error('Biometria falhou')
    const userStr = await storage.get(KEYS.USUARIO)
    const token = await storage.get(KEYS.ACCESS_TOKEN)
    if (!userStr || !token) throw new Error('Sessão expirada. Entre com seu PIN.')
    setUsuario(JSON.parse(userStr))
  }

  async function signOut() {
    try { await api.post('/auth/logout') } catch {}
    await Promise.all([
      storage.delete(KEYS.ACCESS_TOKEN),
      storage.delete(KEYS.REFRESH_TOKEN),
      storage.delete(KEYS.USUARIO),
    ])
    setUsuario(null)
  }

  return (
    <AuthContext.Provider value={{ usuario, loading, biometricAvailable, signIn, signInWithBiometric, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
