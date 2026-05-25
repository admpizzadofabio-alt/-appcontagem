import React, { useState } from 'react'
import { View, Text, ScrollView, StyleSheet, Alert, TextInput, TouchableOpacity, Clipboard } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import QRCode from 'react-native-qrcode-svg'
import { Card } from '../../components/Card'
import { ActionButton } from '../../components/ActionButton'
import { SectionHeader } from '../../components/SectionHeader'
import { colors } from '../../theme/colors'
import { useSetupTotpMutation, useEnableTotpMutation, useDisableTotpMutation } from '../../services/api/totp'

export function Setup2FAScreen() {
  const [step, setStep] = useState<'inicio' | 'qr' | 'confirmar'>('inicio')
  const [otpauthUrl, setOtpauthUrl] = useState('')
  const [secret, setSecret] = useState('')
  const [showSecret, setShowSecret] = useState(false)
  const [code, setCode] = useState('')
  const [setup, { isLoading: l1 }] = useSetupTotpMutation()
  const [enable, { isLoading: l2 }] = useEnableTotpMutation()
  const [disable] = useDisableTotpMutation()
  const loading = l1 || l2

  async function iniciar() {
    const timeout = new Promise<never>((_, rej) =>
      setTimeout(() => rej(new Error('Tempo limite atingido. Verifique sua conexão.')), 20000)
    )
    try {
      const r = await Promise.race([setup().unwrap(), timeout])
      setOtpauthUrl(r.otpauthUrl)
      setSecret(r.secret)
      setStep('qr')
    } catch (e: any) {
      Alert.alert('Erro', e.message ?? 'Falha ao iniciar')
    }
  }

  async function confirmar() {
    if (!code.match(/^\d{6}$/)) {
      Alert.alert('Atenção', 'Código deve ter 6 dígitos')
      return
    }
    try {
      await enable({ code }).unwrap()
      Alert.alert('2FA ativo', 'A partir de agora seu login exige o código do app autenticador.', [
        { text: 'OK', onPress: () => setStep('inicio') },
      ])
      setCode('')
    } catch (e: any) {
      Alert.alert('Erro', e.message ?? 'Código inválido')
    }
  }

  async function desativar() {
    Alert.alert('Desativar 2FA?', 'Login voltará a ser só PIN.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Desativar', style: 'destructive', onPress: async () => {
          try {
            await disable().unwrap()
            Alert.alert('2FA desativado')
          } catch (e: any) {
            Alert.alert('Erro', e.message)
          }
        },
      },
    ])
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView style={s.scroll} contentContainerStyle={s.content}>
        <Text style={s.pageTitle}>🔐 Autenticação em 2 fatores</Text>

        <Card>
          <SectionHeader title="O que é" />
          <Text style={s.txt}>
            Adiciona um código de 6 dígitos no login além do PIN. O código vem de um app autenticador
            (Google Authenticator, Authy, Microsoft Authenticator) instalado no seu celular.
          </Text>
          <Text style={[s.txt, { marginTop: 8 }]}>
            Use isso pra proteger contas Admin — alguém com seu PIN sozinho não consegue entrar.
          </Text>
        </Card>

        {step === 'inicio' && (
          <Card>
            <SectionHeader title="Ativar" />
            <ActionButton label={loading ? 'Aguarde...' : 'Iniciar configuração'} onPress={iniciar} disabled={loading} />
            <View style={{ height: 8 }} />
            <ActionButton label="Desativar 2FA" onPress={desativar} variant="danger" />
          </Card>
        )}

        {step === 'qr' && (
          <Card>
            <SectionHeader title="1. Escaneie o QR Code" />
            <Text style={s.txt}>Abra seu app autenticador → Adicionar conta → Escanear QR.</Text>
            <View style={s.qrWrap}>
              <QRCode value={otpauthUrl} size={200} />
            </View>
            <Text style={s.secretLabel}>Não consegue escanear? Digite manualmente:</Text>
            <View style={s.secretRow}>
              <Text style={s.secretText}>{showSecret ? secret : '••••••••••••••••'}</Text>
              <TouchableOpacity onPress={() => setShowSecret(v => !v)} style={s.secretBtn}>
                <Text style={s.secretBtnTxt}>{showSecret ? 'Ocultar' : 'Mostrar'}</Text>
              </TouchableOpacity>
              {showSecret && (
                <TouchableOpacity onPress={() => { Clipboard.setString(secret); Alert.alert('Copiado!') }} style={s.secretBtn}>
                  <Text style={s.secretBtnTxt}>Copiar</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={{ height: 12 }} />
            <ActionButton label="Próximo: confirmar código" onPress={() => setStep('confirmar')} />
          </Card>
        )}

        {step === 'confirmar' && (
          <Card>
            <SectionHeader title="2. Digite o código gerado" />
            <Text style={s.txt}>Cole o código de 6 dígitos do app autenticador:</Text>
            <TextInput
              style={s.codeInput}
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="000000"
              placeholderTextColor={colors.textMuted}
            />
            <ActionButton
              label={loading ? 'Verificando...' : 'Confirmar e ativar'}
              onPress={confirmar}
              disabled={loading || code.length !== 6}
            />
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 12 },
  pageTitle: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 4 },
  txt: { fontSize: 13, color: colors.textSub, lineHeight: 18 },
  qrWrap: { alignItems: 'center', padding: 20, backgroundColor: '#fff', borderRadius: 12, marginVertical: 12 },
  secretLabel: { fontSize: 11, color: colors.textSub, marginTop: 8 },
  secretRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  secretText: { flex: 1, fontSize: 13, fontFamily: 'monospace', color: colors.text, padding: 8, backgroundColor: colors.surface, borderRadius: 6 },
  secretBtn: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.primary, borderRadius: 6 },
  secretBtnTxt: { color: '#fff', fontSize: 11, fontWeight: '700' },
  codeInput: { fontSize: 28, fontWeight: '700', textAlign: 'center', letterSpacing: 8, padding: 16, backgroundColor: colors.surface, borderRadius: 12, marginVertical: 12, color: colors.text },
})
