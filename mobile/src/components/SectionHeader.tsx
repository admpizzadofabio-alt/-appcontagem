import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { colors } from '../theme/colors'

interface Props {
  title: string
  action?: { label: string; onPress: () => void }
}

export function SectionHeader({ title, action }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      {action && (
        <TouchableOpacity onPress={action.onPress}>
          <Text style={styles.action}>{action.label}</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, marginTop: 4 },
  title: { fontSize: 13, fontWeight: '700', color: colors.textSub, textTransform: 'uppercase', letterSpacing: 0.8 },
  action: { fontSize: 13, color: colors.primaryLight, fontWeight: '600' },
})
