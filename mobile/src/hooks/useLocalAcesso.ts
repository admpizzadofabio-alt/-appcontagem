import { useAuth } from '../contexts/AuthContext'

export type Local = 'Bar' | 'Delivery'

export function useLocalAcesso() {
  const { usuario } = useAuth()
  const isAdmin = usuario?.nivelAcesso === 'Admin'
  const isSupervisor = usuario?.nivelAcesso === 'Supervisor'
  const veTodosLocais = isAdmin || isSupervisor

  const localOperador: Local = usuario?.setor === 'Delivery' ? 'Delivery' : 'Bar'
  const localOposto: Local = localOperador === 'Bar' ? 'Delivery' : 'Bar'

  return {
    isAdmin,
    isSupervisor,
    veTodosLocais,
    localOperador,
    localOposto,
    locaisPermitidos: (veTodosLocais ? ['Bar', 'Delivery'] : [localOperador]) as Local[],
  }
}
