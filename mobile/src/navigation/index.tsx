import React from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Text, View, Pressable } from 'react-native'
import { useAuth } from '../contexts/AuthContext'
import { colors } from '../theme/colors'
import { SplashScreen } from '../components/SplashScreen'

import { LoginScreen } from '../screens/Login/LoginScreen'
import { HomeScreen } from '../screens/Home/HomeScreen'
import { EstoqueScreen } from '../screens/Estoque/EstoqueScreen'
import { MaisScreen } from '../screens/Mais/MaisScreen'
import { MovimentacaoScreen } from '../screens/Movimentacao/MovimentacaoScreen'
import { TransferenciaScreen } from '../screens/Transferencia/TransferenciaScreen'
import { PedidosScreen } from '../screens/Pedidos/PedidosScreen'
import { RelatoriosScreen } from '../screens/Relatorios/RelatoriosScreen'
import { AdminScreen } from '../screens/Admin/AdminScreen'
import { AnalyticsScreen } from '../screens/Admin/AnalyticsScreen'
import { Setup2FAScreen } from '../screens/Admin/Setup2FAScreen'
import { AuditoriaScreen } from '../screens/Admin/AuditoriaScreen'
import { ContagensAdminScreen } from '../screens/Admin/ContagensAdminScreen'
import { TurnosAdminScreen } from '../screens/Admin/TurnosAdminScreen'
import { UsuariosScreen } from '../screens/Usuarios/UsuariosScreen'
import { ProdutosScreen } from '../screens/Produtos/ProdutosScreen'
import { ColibriScreen } from '../screens/Colibri/ColibriScreen'
import { RequisicoesScreen } from '../screens/Requisicoes/RequisicoesScreen'
import { AbrirTurnoScreen } from '../screens/Turno/AbrirTurnoScreen'
import { ContagemTurnoScreen } from '../screens/Turno/ContagemTurnoScreen'
import { ResumoContagemScreen } from '../screens/Turno/ResumoContagemScreen'
import { ErroComandaScreen } from '../screens/Turno/ErroComandaScreen'
import { MeuTurnoScreen } from '../screens/MeuTurno/MeuTurnoScreen'
import { SetoresScreen } from '../screens/Admin/SetoresScreen'

import type { AuthStackParams, AppStackParams, TabParams } from './types'

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() { return { hasError: true } }
  componentDidCatch() { console.error('[ErrorBoundary] Erro capturado') }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: '#fff' }}>
          <Text style={{ fontSize: 48 }}>😔</Text>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginTop: 16, textAlign: 'center' }}>Algo deu errado</Text>
          <Text style={{ fontSize: 14, color: '#666', marginTop: 8, textAlign: 'center' }}>Feche e abra o app novamente.</Text>
          <Pressable
            style={{ marginTop: 24, backgroundColor: '#1A5C37', paddingHorizontal: 28, paddingVertical: 12, borderRadius: 12 }}
            onPress={() => this.setState({ hasError: false })}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>Tentar novamente</Text>
          </Pressable>
        </View>
      )
    }
    return this.props.children
  }
}

const AuthStack = createNativeStackNavigator<AuthStackParams>()
const AppStack = createNativeStackNavigator<AppStackParams>()
const Tab = createBottomTabNavigator<TabParams>()

function TabIcon({ icon, focused }: { icon: string; focused: boolean }) {
  return <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.4 }}>{icon}</Text>
}

function CompradoresTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: 62, paddingBottom: 8 },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSub,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tab.Screen name="EstoqueTab" component={EstoqueScreen} options={{ title: 'Estoque', tabBarIcon: ({ focused }) => <TabIcon icon="📦" focused={focused} /> }} />
    </Tab.Navigator>
  )
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
    <ErrorBoundary>
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
      <AppStack.Screen name="Analytics" component={AnalyticsScreen} options={{ title: 'Analytics & Export' }} />
      <AppStack.Screen name="Setup2FA" component={Setup2FAScreen} options={{ title: 'Autenticação 2 Fatores' }} />
      <AppStack.Screen name="Auditoria" component={AuditoriaScreen} options={{ title: 'Logs de Auditoria' }} />
      <AppStack.Screen name="ContagensAdmin" component={ContagensAdminScreen} options={{ title: 'Excluir Contagem' }} />
      <AppStack.Screen name="TurnosAdmin" component={TurnosAdminScreen} options={{ title: 'Apagar Turno' }} />
      <AppStack.Screen name="Usuarios" component={UsuariosScreen} options={{ title: 'Usuários' }} />
      <AppStack.Screen name="Produtos" component={ProdutosScreen} options={{ title: 'Produtos' }} />
      <AppStack.Screen name="Colibri" component={ColibriScreen} options={{ title: 'Integração Colibri POS' }} />
      <AppStack.Screen name="AbrirTurno" component={AbrirTurnoScreen} options={{ title: 'Abrir Turno' }} />
      <AppStack.Screen name="ContagemTurno" component={ContagemTurnoScreen} options={{ title: 'Contagem' }} />
      <AppStack.Screen name="ResumoContagem" component={ResumoContagemScreen} options={{ title: 'Resumo da Contagem' }} />
      <AppStack.Screen name="ErroComanda" component={ErroComandaScreen} options={{ title: 'Erro de Comanda' }} />
      <AppStack.Screen name="MeuTurno" component={MeuTurnoScreen} options={{ title: 'Meu Turno' }} />
      <AppStack.Screen name="Setores" component={SetoresScreen} options={{ title: 'Gerenciar Setores' }} />
    </AppStack.Navigator>
    </ErrorBoundary>
  )
}

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
    </AuthStack.Navigator>
  )
}

function CompradoresAppNavigator() {
  return (
    <ErrorBoundary>
      <AppStack.Navigator screenOptions={HEADER_OPTS}>
        <AppStack.Screen name="Tabs" component={CompradoresTabNavigator} options={{ headerShown: false }} />
      </AppStack.Navigator>
    </ErrorBoundary>
  )
}

export function Navigation() {
  const { usuario, loading } = useAuth()
  if (loading) return <SplashScreen />
  return (
    <NavigationContainer>
      {!usuario
        ? <AuthNavigator />
        : usuario.nivelAcesso === 'Comprador'
          ? <CompradoresAppNavigator />
          : <AppNavigator />}
    </NavigationContainer>
  )
}
