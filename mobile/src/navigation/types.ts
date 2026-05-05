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
  Admin: undefined
  Usuarios: undefined
  Produtos: undefined
  Colibri: undefined
  AbrirCaixa: { local?: 'Bar' | 'Delivery' } | undefined
  ContagemTurno: { contagemId: string }
  ResumoContagem: { contagemId: string }
  ErroComanda: { local: string; turnoId?: string | null }
  MeuTurno: undefined
}
