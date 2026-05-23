import { useAuth } from '../contexts/AuthContext'

export type Local = string

export function useLocalAcesso() {
  const { usuario } = useAuth()
  const isAdmin = usuario?.nivelAcesso === 'Admin'
  const isSupervisor = usuario?.nivelAcesso === 'Supervisor'
  const veTodosLocais = isAdmin || isSupervisor

  const setor = usuario?.setor
  const localOperador: string = setor && setor !== 'Admin' && setor !== 'Todos' ? setor : 'Bar'

  return {
    isAdmin,
    isSupervisor,
    veTodosLocais,
    localOperador,
  }
}
