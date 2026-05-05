import * as SecureStore from 'expo-secure-store'

export const storage = {
  get: (key: string) => SecureStore.getItemAsync(key),
  set: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  delete: (key: string) => SecureStore.deleteItemAsync(key),
}

export const KEYS = {
  ACCESS_TOKEN: 'accessToken',
  REFRESH_TOKEN: 'refreshToken',
  USUARIO: 'usuario',
  BIOMETRIC_ENABLED: 'biometricEnabled',
} as const
