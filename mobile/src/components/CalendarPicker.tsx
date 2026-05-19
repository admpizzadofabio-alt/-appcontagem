import React, { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native'
import { colors } from '../theme/colors'

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

interface Props {
  value: string
  onChange: (date: string) => void
  placeholder?: string
}

function fmtBR(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export function CalendarPicker({ value, onChange, placeholder }: Props) {
  const [open, setOpen] = useState(false)
  const today = new Date()
  const init = value ? new Date(value + 'T00:00:00') : today
  const [year, setYear] = useState(init.getFullYear())
  const [month, setMonth] = useState(init.getMonth())

  function navigate(delta: number) {
    let m = month + delta
    let y = year
    if (m < 0) { m = 11; y-- }
    if (m > 11) { m = 0; y++ }
    setMonth(m); setYear(y)
  }

  function select(day: number) {
    const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    onChange(iso)
    setOpen(false)
  }

  function limpar() {
    onChange('')
    setOpen(false)
  }

  function abrir() {
    if (value) {
      const d = new Date(value + 'T00:00:00')
      setYear(d.getFullYear())
      setMonth(d.getMonth())
    } else {
      setYear(today.getFullYear())
      setMonth(today.getMonth())
    }
    setOpen(true)
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayOfWeek = new Date(year, month, 1).getDay()
  const grid: (number | null)[] = []
  for (let i = 0; i < firstDayOfWeek; i++) grid.push(null)
  for (let d = 1; d <= daysInMonth; d++) grid.push(d)
  while (grid.length % 7 !== 0) grid.push(null)

  const sel = value ? value.split('-').map(Number) : null

  return (
    <>
      <TouchableOpacity style={s.input} onPress={abrir} activeOpacity={0.7}>
        <Text style={value ? s.inputTxt : s.inputPlaceholder}>
          {value ? fmtBR(value) : (placeholder ?? 'Selecionar data')}
        </Text>
        <Text style={s.icon}>📅</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={s.modal} onStartShouldSetResponder={() => true}>
            <View style={s.header}>
              <TouchableOpacity onPress={() => navigate(-1)} style={s.navBtnWrap}>
                <Text style={s.navBtn}>◀</Text>
              </TouchableOpacity>
              <Text style={s.title}>{MESES[month]} {year}</Text>
              <TouchableOpacity onPress={() => navigate(1)} style={s.navBtnWrap}>
                <Text style={s.navBtn}>▶</Text>
              </TouchableOpacity>
            </View>

            <View style={s.weekRow}>
              {SEMANA.map((d, i) => <Text key={i} style={s.weekDay}>{d}</Text>)}
            </View>

            <View style={s.grid}>
              {grid.map((day, i) => {
                if (day === null) return <View key={i} style={s.cell} />
                const isSelected = !!(sel && sel[0] === year && sel[1] === month + 1 && sel[2] === day)
                const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day
                return (
                  <TouchableOpacity
                    key={i}
                    style={[s.cell, s.cellDay, isSelected && s.cellSelected, isToday && !isSelected && s.cellToday]}
                    onPress={() => select(day)}
                    activeOpacity={0.6}
                  >
                    <Text style={[s.cellTxt, isSelected && s.cellTxtSelected, isToday && !isSelected && s.cellTxtToday]}>{day}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            <View style={s.footer}>
              <TouchableOpacity onPress={limpar} style={s.footerBtn}>
                <Text style={s.footerBtnTxt}>Limpar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setOpen(false)} style={s.footerBtn}>
                <Text style={s.footerBtnTxt}>Fechar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  )
}

const s = StyleSheet.create({
  input: {
    backgroundColor: colors.surface, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 14,
    borderWidth: 1, borderColor: colors.border,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  inputTxt: { fontSize: 14, color: colors.text, fontWeight: '600' },
  inputPlaceholder: { fontSize: 14, color: colors.textMuted },
  icon: { fontSize: 18 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center' },
  modal: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, width: 320 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  navBtnWrap: { padding: 6 },
  navBtn: { fontSize: 18, color: colors.primary, fontWeight: '700' },
  title: { fontSize: 16, fontWeight: '800', color: colors.text },

  weekRow: { flexDirection: 'row', marginBottom: 4 },
  weekDay: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '700', color: colors.textSub, paddingVertical: 6 },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.2857%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  cellDay: { borderRadius: 18 },
  cellSelected: { backgroundColor: colors.primary },
  cellToday: { borderWidth: 1, borderColor: colors.primary, borderRadius: 18 },
  cellTxt: { fontSize: 14, color: colors.text },
  cellTxtSelected: { color: '#fff', fontWeight: '800' },
  cellTxtToday: { color: colors.primary, fontWeight: '700' },

  footer: { flexDirection: 'row', gap: 10, marginTop: 14 },
  footerBtn: { flex: 1, padding: 12, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: colors.border },
  footerBtnTxt: { color: colors.textSub, fontSize: 14, fontWeight: '600' },
})
