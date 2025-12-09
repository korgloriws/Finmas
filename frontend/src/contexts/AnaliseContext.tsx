import { createContext, useContext, useState, ReactNode } from 'react'
import { AtivoAnalise, FiltrosAnalise } from '../types'

interface AnaliseContextType {
  // Estados para dados dos ativos
  ativosAcoes: AtivoAnalise[]
  ativosBdrs: AtivoAnalise[]
  ativosFiis: AtivoAnalise[]
  
  // Setters para os dados
  setAtivosAcoes: (ativos: AtivoAnalise[]) => void
  setAtivosBdrs: (ativos: AtivoAnalise[]) => void
  setAtivosFiis: (ativos: AtivoAnalise[]) => void
  
  // Filtros padrão
  filtrosAcoes: FiltrosAnalise
  filtrosBdrs: FiltrosAnalise
  filtrosFiis: FiltrosAnalise
  
  // Setters para os filtros
  setFiltrosAcoes: (filtros: FiltrosAnalise) => void
  setFiltrosBdrs: (filtros: FiltrosAnalise) => void
  setFiltrosFiis: (filtros: FiltrosAnalise) => void
  
  // Função para obter todos os ativos combinados
  getTodosAtivos: () => AtivoAnalise[]
}

const AnaliseContext = createContext<AnaliseContextType | undefined>(undefined)

export const useAnalise = () => {
  const context = useContext(AnaliseContext)
  if (context === undefined) {
    throw new Error('useAnalise must be used within an AnaliseProvider')
  }
  return context
}

interface AnaliseProviderProps {
  children: ReactNode
}

export const AnaliseProvider = ({ children }: AnaliseProviderProps) => {
  const [ativosAcoes, setAtivosAcoes] = useState<AtivoAnalise[]>([])
  const [ativosBdrs, setAtivosBdrs] = useState<AtivoAnalise[]>([])
  const [ativosFiis, setAtivosFiis] = useState<AtivoAnalise[]>([])

  // Filtros padrão
  const [filtrosAcoes, setFiltrosAcoes] = useState<FiltrosAnalise>({
    roe_min: 15,
    dy_min: 12,
    pl_min: 1,
    pl_max: 15,
    pvp_max: 2,
    net_debt_ebitda_max: 3,
    liq_min: 100000
  })

  const [filtrosBdrs, setFiltrosBdrs] = useState<FiltrosAnalise>({
    roe_min: 15,
    dy_min: 3,
    pl_min: 1,
    pl_max: 25,
    pvp_max: 2,
    net_debt_ebitda_max: 3,
    liq_min: 10000
  })

  const [filtrosFiis, setFiltrosFiis] = useState<FiltrosAnalise>({
    dy_min: 12,
    dy_max: 15,
    liq_min: 500000
  })

  const getTodosAtivos = () => {
    return [...ativosAcoes, ...ativosBdrs, ...ativosFiis]
  }

  const value = {
    ativosAcoes,
    ativosBdrs,
    ativosFiis,
    setAtivosAcoes,
    setAtivosBdrs,
    setAtivosFiis,
    filtrosAcoes,
    filtrosBdrs,
    filtrosFiis,
    setFiltrosAcoes,
    setFiltrosBdrs,
    setFiltrosFiis,
    getTodosAtivos
  }

  return (
    <AnaliseContext.Provider value={value}>
      {children}
    </AnaliseContext.Provider>
  )
}
