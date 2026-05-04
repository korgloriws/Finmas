import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useQuery } from '@tanstack/react-query'
import { controleService } from '../services/api'
import { useAuth } from './AuthContext'
import {
  CATEGORIAS_DESPESAS,
  mapControleApiToCategoria,
  getCategoriaDespesa,
} from '../utils/categoriasDespesas'
import type { CategoriaDespesa } from '../utils/categoriasDespesas'
import type { ControleCategoriaGastoApi } from '../types'
import ControleCategoriasModal from '../components/controle/ControleCategoriasModal'

type ControleCategoriasContextValue = {
  categorias: CategoriaDespesa[]
  categoriasApi: ControleCategoriaGastoApi[]
  isLoading: boolean
  resolveCategoria: (slug?: string | null) => CategoriaDespesa
  /** Abre o modal; opcionalmente pré-seleciona a categoria (slug) no formulário. */
  openGerenciarCategorias: (categoriaSlug?: string | null) => void
}

const ControleCategoriasContext = createContext<ControleCategoriasContextValue | null>(null)

export function ControleCategoriasProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [modalOpen, setModalOpen] = useState(false)
  const [modalInitialSlug, setModalInitialSlug] = useState<string | null>(null)

  const { data: categoriasApi = [], isLoading } = useQuery({
    queryKey: ['controle-categorias-gasto', user],
    queryFn: () => controleService.getCategoriasGasto(),
    enabled: !!user,
    staleTime: 60_000,
  })

  const categorias = useMemo(() => {
    if (!categoriasApi.length) return CATEGORIAS_DESPESAS
    return categoriasApi.map(mapControleApiToCategoria)
  }, [categoriasApi])

  const resolveCategoria = useCallback(
    (slug?: string | null) => getCategoriaDespesa(slug, categorias),
    [categorias]
  )

  const openGerenciarCategorias = useCallback((categoriaSlug?: string | null) => {
    setModalInitialSlug(categoriaSlug ?? null)
    setModalOpen(true)
  }, [])

  const closeGerenciarCategorias = useCallback(() => {
    setModalOpen(false)
    setModalInitialSlug(null)
  }, [])

  const value = useMemo(
    () => ({
      categorias,
      categoriasApi,
      isLoading,
      resolveCategoria,
      openGerenciarCategorias,
    }),
    [categorias, categoriasApi, isLoading, resolveCategoria, openGerenciarCategorias]
  )

  return (
    <ControleCategoriasContext.Provider value={value}>
      {children}
      <ControleCategoriasModal
        open={modalOpen}
        initialSlug={modalInitialSlug}
        onClose={closeGerenciarCategorias}
      />
    </ControleCategoriasContext.Provider>
  )
}

export function useControleCategorias(): ControleCategoriasContextValue {
  const ctx = useContext(ControleCategoriasContext)
  if (!ctx) {
    throw new Error('useControleCategorias só pode ser usado dentro de ControleCategoriasProvider')
  }
  return ctx
}
