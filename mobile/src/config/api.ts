import axios from 'axios'
import { storage, KEYS } from './storage'

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://contagem.sistemaspizzafabio.com.br/api/v1'

export const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
})

let isRefreshing = false
let queue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = []

api.interceptors.request.use(async (config) => {
  const token = await storage.get(KEYS.ACCESS_TOKEN)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status !== 401 || original._retry) return Promise.reject(error)
    // Não tentar refresh em /auth/login e /auth/refresh — 401 nesses casos é credencial errada,
    // não token expirado.
    const url: string = original?.url ?? ''
    if (url.includes('/auth/login') || url.includes('/auth/refresh')) return Promise.reject(error)
    original._retry = true

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        queue.push({ resolve, reject })
      }).then((token) => {
        original.headers.Authorization = `Bearer ${token}`
        return api(original)
      })
    }

    isRefreshing = true
    try {
      const refreshToken = await storage.get(KEYS.REFRESH_TOKEN)
      if (!refreshToken) throw new Error('Sem refresh token')
      const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken })
      await storage.set(KEYS.ACCESS_TOKEN, data.accessToken)
      await storage.set(KEYS.REFRESH_TOKEN, data.refreshToken)
      queue.forEach((p) => p.resolve(data.accessToken))
      queue = []
      original.headers.Authorization = `Bearer ${data.accessToken}`
      return api(original)
    } catch (err) {
      queue.forEach((p) => p.reject(err))
      queue = []
      await storage.delete(KEYS.ACCESS_TOKEN)
      await storage.delete(KEYS.REFRESH_TOKEN)
      await storage.delete(KEYS.USUARIO)
      return Promise.reject(err)
    } finally {
      isRefreshing = false
    }
  }
)
