export type AuthStackParams = {
  Login: undefined
}

export type TabParams = {
  HomeTab: undefined
  EstoqueTab: undefined
  RequisicoesTab: undefined
  MaisTab: undefined
}

export type AppStackParams = {
  Tabs: undefined
  Movimentacao: { tipo: 'Entrada' | 'Saida' | 'AjustePerda' | 'CargaInicial' }
  Transferencia: undefined
Pedidos: undefined
  Relatorios: undefined
  Analytics: undefined
  Auditoria: undefined
  Setup2FA: undefined
  Admin: undefined
  Usuarios: undefined
  Produtos: undefined
  Colibri: undefined
  AbrirTurno: { local?: 'Bar' | 'Delivery' } | undefined
  ContagemTurno: { contagemId: string; colibriPendente?: boolean }
  ResumoContagem: { contagemId: string }
  ErroComanda: { local: string; turnoId?: string | null }
  MeuTurno: undefined
}
