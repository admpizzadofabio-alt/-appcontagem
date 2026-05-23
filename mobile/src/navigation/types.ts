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
  ContagensAdmin: undefined
  TurnosAdmin: undefined
  Setup2FA: undefined
  Admin: undefined
  Usuarios: undefined
  Produtos: undefined
  Colibri: undefined
  Setores: undefined
  AbrirTurno: { local?: string } | undefined
  ContagemTurno: { contagemId: string; colibriPendente?: boolean }
  ResumoContagem: { contagemId: string }
  ErroComanda: { local: string; turnoId?: string | null }
  MeuTurno: undefined
}
