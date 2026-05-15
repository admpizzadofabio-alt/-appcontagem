import React, { useEffect } from 'react'
import { Modal, View, Text, StyleSheet, Pressable } from 'react-native'
import LottieView from 'lottie-react-native'
import * as Haptics from 'expo-haptics'
import { colors } from '../theme/colors'

interface Props {
  visible: boolean
  titulo: string
  subtitulo?: string
  onClose: () => void
  autoCloseMs?: number
}

export function SuccessOverlay({ visible, titulo, subtitulo, onClose, autoCloseMs = 1800 }: Props) {
  useEffect(() => {
    if (!visible) return
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    const t = setTimeout(onClose, autoCloseMs)
    return () => clearTimeout(t)
  }, [visible])

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <View style={s.card}>
          <LottieView
            source={require('../../assets/animations/success.lottie')}
            autoPlay
            loop={false}
            style={s.anim}
          />
          <Text style={s.titulo}>{titulo}</Text>
          {subtitulo && <Text style={s.subtitulo}>{subtitulo}</Text>}
        </View>
      </Pressable>
    </Modal>
  )
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  card: { backgroundColor: colors.surface, borderRadius: 24, padding: 28, alignItems: 'center', minWidth: 260, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 24, shadowOffset: { width: 0, height: 8 }, elevation: 12 },
  anim: { width: 160, height: 160 },
  titulo: { fontSize: 18, fontWeight: '800', color: colors.text, textAlign: 'center', marginTop: 4 },
  subtitulo: { fontSize: 13, color: colors.textSub, textAlign: 'center', marginTop: 6, lineHeight: 18 },
})
