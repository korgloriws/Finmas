import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { AtivoAnalise, FiltrosAnalise, PeriodoIndicadores } from '../types'
import { useAuth } from './AuthContext'

export type UniversoPorPeriodo = Partial<Record<PeriodoIndicadores, AtivoAnalise[]>>

interface AnaliseContextType {
  ativosAcoes: AtivoAnalise[]
  ativosBdrs: AtivoAnalise[]
  ativosFiis: AtivoAnalise[]

  setAtivosAcoes: (ativos: AtivoAnalise[]) => void
  setAtivosBdrs: (ativos: AtivoAnalise[]) => void
  setAtivosFiis: (ativos: AtivoAnalise[]) => void

  filtrosAcoes: FiltrosAnalise
  filtrosBdrs: FiltrosAnalise
  filtrosFiis: FiltrosAnalise

  setFiltrosAcoes: (filtros: FiltrosAnalise) => void
  setFiltrosBdrs: (filtros: FiltrosAnalise) => void
  setFiltrosFiis: (filtros: FiltrosAnalise) => void

  universoAcoes: UniversoPorPeriodo
  universoBdrs: UniversoPorPeriodo
  universoFiis: UniversoPorPeriodo
  salvarUniversoAcoes: (periodo: PeriodoIndicadores, lista: AtivoAnalise[]) => void
  salvarUniversoBdrs: (periodo: PeriodoIndicadores, lista: AtivoAnalise[]) => void
  salvarUniversoFiis: (periodo: PeriodoIndicadores, lista: AtivoAnalise[]) => void

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
  const { user } = useAuth()
  const [ativosAcoes, setAtivosAcoes] = useState<AtivoAnalise[]>([])
  const [ativosBdrs, setAtivosBdrs] = useState<AtivoAnalise[]>([])
  const [ativosFiis, setAtivosFiis] = useState<AtivoAnalise[]>([])
  const [universoAcoes, setUniversoAcoes] = useState<UniversoPorPeriodo>({})
  const [universoBdrs, setUniversoBdrs] = useState<UniversoPorPeriodo>({})
  const [universoFiis, setUniversoFiis] = useState<UniversoPorPeriodo>({})

  const [filtrosAcoes, setFiltrosAcoes] = useState<FiltrosAnalise>({
    roe_min: 15,
    dy_min: 12,
    pl_min: 1,
    pl_max: 15,
    pvp_max: 2,
    net_debt_ebitda_max: 3,
    liq_min: 100000,
    periodo_indicadores: 'atual',
  })

  const [filtrosBdrs, setFiltrosBdrs] = useState<FiltrosAnalise>({
    roe_min: 15,
    dy_min: 3,
    pl_min: 1,
    pl_max: 25,
    pvp_max: 2,
    net_debt_ebitda_max: 3,
    liq_min: 100000,
    periodo_indicadores: 'atual',
  })

  const [filtrosFiis, setFiltrosFiis] = useState<FiltrosAnalise>({
    dy_min: 12,
    dy_max: 15,
    liq_min: 500000,
    periodo_indicadores: 'atual',
  })

  useEffect(() => {
    setAtivosAcoes([])
    setAtivosBdrs([])
    setAtivosFiis([])
    setUniversoAcoes({})
    setUniversoBdrs({})
    setUniversoFiis({})
  }, [user])

  const salvarUniversoAcoes = useCallback((periodo: PeriodoIndicadores, lista: AtivoAnalise[]) => {
    setUniversoAcoes((prev) => ({ ...prev, [periodo]: lista }))
  }, [])

  const salvarUniversoBdrs = useCallback((periodo: PeriodoIndicadores, lista: AtivoAnalise[]) => {
    setUniversoBdrs((prev) => ({ ...prev, [periodo]: lista }))
  }, [])

  const salvarUniversoFiis = useCallback((periodo: PeriodoIndicadores, lista: AtivoAnalise[]) => {
    setUniversoFiis((prev) => ({ ...prev, [periodo]: lista }))
  }, [])

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
    universoAcoes,
    universoBdrs,
    universoFiis,
    salvarUniversoAcoes,
    salvarUniversoBdrs,
    salvarUniversoFiis,
    getTodosAtivos,
  }

  return (
    <AnaliseContext.Provider value={value}>
      {children}
    </AnaliseContext.Provider>
  )
}
