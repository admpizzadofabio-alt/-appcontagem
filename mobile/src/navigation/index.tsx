import React from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Text, ActivityIndicator, View, StyleSheet } from 'react-native'
import { useAuth } from '../contexts/AuthContext'
import { colors } from '../theme/colors'

import { LoginScreen } from '../screens/Login/LoginScreen'
import { HomeScreen } from '../screens/Home/HomeScreen'
import { EstoqueScreen } from '../screens/Estoque/EstoqueScreen'
import { MaisScreen } from '../screens/Mais/MaisScreen'
import { MovimentacaoScreen } from '../screens/Movimentacao/MovimentacaoScreen'
import { TransferenciaScreen } from '../screens/Transferencia/TransferenciaScreen'
import { PedidosScreen } from '../screens/Pedidos/PedidosScreen'
import { RelatoriosScreen } from '../screens/Relatorios/RelatoriosScreen'
import { AdminScreen } from '../screens/Admin/AdminScreen'
import { UsuariosScreen } from '../screens/Usuarios/UsuariosScreen'
import { ProdutosScreen } from '../screens/Produtos/ProdutosScreen'
import { ColibriScreen } from '../screens/Colibri/ColibriScreen'
import { RequisicoesScreen } from '../screens/Requisicoes/RequisicoesScreen'
import { AbrirCaixaScreen } from '../screens/Turno/AbrirCaixaScreen'
import { ContagemTurnoScreen } from '../screens/Turno/ContagemTurnoScreen'
import { ResumoContagemScreen } from '../screens/Turno/ResumoContagemScreen'
import { ErroComandaScreen } from '../screens/Turno/ErroComandaScreen'
import { MeuTurnoScreen } from '../screens/MeuTurno/MeuTurnoScreen'

import type { AuthStackParams, AppStackParams, TabParams } from './types'

const AuthStack = createNativeStackNavigator<AuthStackParams>()
const AppStack = createNativeStackNavigator<AppStackParams>()
const Tab = createBottomTabNavigator<TabParams>()

function TabIcon({ icon, focused }: { icon: string; focused: boolean }) {
  return <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.4 }}>{icon}</Text>
}

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 62,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSub,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tab.Screen name="HomeTab" component={HomeScreen} options={{ title: 'Início', tabBarIcon: ({ focused }) => <TabIcon icon="🏠" focused={focused} /> }} />
      <Tab.Screen name="EstoqueTab" component={EstoqueScreen} options={{ title: 'Estoque', tabBarIcon: ({ focused }) => <TabIcon icon="📦" focused={focused} /> }} />
<Tab.Screen name="RequisicoesTab" component={RequisicoesScreen} options={{ title: 'Requisições', tabBarIcon: ({ focused }) => <TabIcon icon="🔗" focused={focused} /> }} />
      <Tab.Screen name="MaisTab" component={MaisScreen} options={{ title: 'Mais', tabBarIcon: ({ focused }) => <TabIcon icon="☰" focused={focused} /> }} />
    </Tab.Navigator>
  )
}

const HEADER_OPTS = {
  headerStyle: { backgroundColor: colors.primary },
  headerTintColor: '#fff' as string,
  headerTitleStyle: { fontWeight: '700' as const },
}

function AppNavigator() {
  return (
    <AppStack.Navigator screenOptions={HEADER_OPTS}>
      <AppStack.Screen name="Tabs" component={TabNavigator} options={{ headerShown: false }} />
      <AppStack.Screen name="Movimentacao" component={MovimentacaoScreen}
        options={({ route }) => ({
          title: route.params.tipo === 'Entrada' ? 'Registrar Entrada'
               : route.params.tipo === 'AjustePerda' ? 'Registrar Perda'
               : route.params.tipo === 'CargaInicial' ? 'Carga Inicial'
               : 'Movimentação'
        })} />
      <AppStack.Screen name="Transferencia" component={TransferenciaScreen} options={{ title: 'Transferência' }} />
<AppStack.Screen name="Pedidos" component={PedidosScreen} options={{ title: 'Pedidos de Compra' }} />
      <AppStack.Screen name="Relatorios" component={RelatoriosScreen} options={{ title: 'Relatórios' }} />
      <AppStack.Screen name="Admin" component={AdminScreen} options={{ title: 'Painel Admin' }} />
      <AppStack.Screen name="Usuarios" component={UsuariosScreen} options={{ title: 'Usuários' }} />
      <AppStack.Screen name="Produtos" component={ProdutosScreen} options={{ title: 'Produtos' }} />
      <AppStack.Screen name="Colibri" component={ColibriScreen} options={{ title: 'Integração Colibri POS' }} />
      <AppStack.Screen name="AbrirCaixa" component={AbrirCaixaScreen} options={{ title: 'Abrir Turno' }} />
      <AppStack.Screen name="ContagemTurno" component={ContagemTurnoScreen} options={{ title: 'Contagem' }} />
      <AppStack.Screen name="ResumoContagem" component={ResumoContagemScreen} options={{ title: 'Resumo da Contagem' }} />
      <AppStack.Screen name="ErroComanda" component={ErroComandaScreen} options={{ title: 'Erro de Comanda' }} />
      <AppStack.Screen name="MeuTurno" component={MeuTurnoScreen} options={{ title: 'Meu Turno' }} />
    </AppStack.Navigator>
  )
}

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
    </AuthStack.Navigator>
  )
}

export function Navigation() {
  const { usuario, loading } = useAuth()
  if (loading) return <View style={s.loader}><ActivityIndicator size="large" color={colors.primary} /></View>
  return (
    <NavigationContainer>
      {usuario ? <AppNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  )
}

const s = StyleSheet.create({
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
})
