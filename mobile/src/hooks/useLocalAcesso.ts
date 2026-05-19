import { useAuth } from '../contexts/AuthContext'

export type Local = 'Bar' | 'Delivery' | 'Vinhos'

export function useLocalAcesso() {
  const { usuario } = useAuth()
  const isAdmin = usuario?.nivelAcesso === 'Admin'
  const isSupervisor = usuario?.nivelAcesso === 'Supervisor'
  const veTodosLocais = isAdmin || isSupervisor

  const setor = usuario?.setor
  const localOperador: Local =
    setor === 'Delivery' ? 'Delivery'
    : setor === 'Vinhos' ? 'Vinhos'
    : 'Bar'

  const TODOS_LOCAIS: Local[] = ['Bar', 'Delivery', 'Vinhos']
  const outrosLocais: Local[] = TODOS_LOCAIS.filter((l) => l !== localOperador)
  // Mantido para retro-compat: primeiro local "diferente do operador".
  // Para operador Vinhos, retorna 'Bar' (mas usar `outrosLocais` é preferível).
  const localOposto: Local = outrosLocais[0] ?? 'Bar'

  return {
    isAdmin,
    isSupervisor,
    veTodosLocais,
    localOperador,
    localOposto,
    outrosLocais,
    locaisPermitidos: (veTodosLocais ? TODOS_LOCAIS : [localOperador]) as Local[],
  }
}
