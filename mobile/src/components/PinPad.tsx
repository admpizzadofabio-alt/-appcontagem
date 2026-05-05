import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { colors } from '../theme/colors'

interface Props {
  value: string
  onChange: (v: string) => void
  maxLength?: number
}

const KEYS = [['1','2','3'],['4','5','6'],['7','8','9'],['','0','⌫']]

export function PinPad({ value, onChange, maxLength = 4 }: Props) {
  function handleKey(k: string) {
    if (k === '⌫') { onChange(value.slice(0, -1)); return }
    if (k === '' || value.length >= maxLength) return
    onChange(value + k)
  }

  return (
    <View style={styles.container}>
      <View style={styles.dots}>
        {Array.from({ length: maxLength }).map((_, i) => (
          <View key={i} style={[styles.dot, value.length > i && styles.dotFilled]} />
        ))}
      </View>
      <View style={styles.pad}>
        {KEYS.map((row, r) => (
          <View key={r} style={styles.row}>
            {row.map((k, c) => (
              k === '' ? <View key={c} style={styles.keyEmpty} /> : (
                <TouchableOpacity key={c} style={styles.key} onPress={() => handleKey(k)} activeOpacity={0.7}>
                  <Text style={styles.keyText}>{k}</Text>
                </TouchableOpacity>
              )
            ))}
          </View>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 28 },
  dots: { flexDirection: 'row', gap: 20 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)' },
  dotFilled: { backgroundColor: '#fff', borderColor: '#fff' },
  pad: { width: 280, gap: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  key: {
    width: 82, height: 68,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  keyEmpty: { width: 82, height: 68 },
  keyText: { color: '#fff', fontSize: 26, fontWeight: '500' },
})
