import React, { createContext, useContext, useState, useRef, useCallback } from 'react'
import { Animated, Text, StyleSheet, View, Platform, Easing } from 'react-native'
import * as Haptics from 'expo-haptics'
import { colors } from '../theme/colors'

type ToastKind = 'success' | 'error' | 'info' | 'warning'
type ToastItem = { id: number; kind: ToastKind; mensagem: string }

interface ToastApi {
  show: (mensagem: string, kind?: ToastKind) => void
  success: (mensagem: string) => void
  error: (mensagem: string) => void
  info: (mensagem: string) => void
  warning: (mensagem: string) => void
}

const ToastContext = createContext<ToastApi>({} as ToastApi)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [item, setItem] = useState<ToastItem | null>(null)
  const slide = useRef(new Animated.Value(-120)).current
  const opacity = useRef(new Animated.Value(0)).current
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const hide = useCallback(() => {
    Animated.parallel([
      Animated.timing(slide, { toValue: -120, duration: 220, useNativeDriver: true, easing: Easing.in(Easing.cubic) }),
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => setItem(null))
  }, [])

  const show = useCallback((mensagem: string, kind: ToastKind = 'info') => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setItem({ id: Date.now(), kind, mensagem })
    const haptic = kind === 'success' ? Haptics.NotificationFeedbackType.Success
      : kind === 'error' ? Haptics.NotificationFeedbackType.Error
      : kind === 'warning' ? Haptics.NotificationFeedbackType.Warning
      : null
    if (haptic) Haptics.notificationAsync(haptic).catch(() => {})
    Animated.parallel([
      Animated.spring(slide, { toValue: 0, useNativeDriver: true, tension: 60, friction: 8 }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start()
    timeoutRef.current = setTimeout(hide, 2600)
  }, [hide])

  const api: ToastApi = {
    show,
    success: (m) => show(m, 'success'),
    error: (m) => show(m, 'error'),
    info: (m) => show(m, 'info'),
    warning: (m) => show(m, 'warning'),
  }

  const bgColor = item?.kind === 'success' ? colors.success
    : item?.kind === 'error' ? colors.danger
    : item?.kind === 'warning' ? colors.warning
    : colors.primary
  const icon = item?.kind === 'success' ? '✓'
    : item?.kind === 'error' ? '✕'
    : item?.kind === 'warning' ? '⚠'
    : 'ℹ'

  return (
    <ToastContext.Provider value={api}>
      {children}
      {item && (
        <Animated.View pointerEvents="none" style={[s.wrap, { transform: [{ translateY: slide }], opacity }]}>
          <View style={[s.toast, { backgroundColor: bgColor }]}>
            <Text style={s.icon}>{icon}</Text>
            <Text style={s.msg} numberOfLines={3}>{item.mensagem}</Text>
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}

const s = StyleSheet.create({
  wrap: { position: 'absolute', top: Platform.OS === 'ios' ? 60 : 32, left: 16, right: 16, zIndex: 9999 },
  toast: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 18, borderRadius: 14, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  icon: { color: '#fff', fontSize: 18, fontWeight: '900' },
  msg: { color: '#fff', fontSize: 14, fontWeight: '600', flex: 1 },
})
