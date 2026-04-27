import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { cancelInflightRequests } from '../services/api'

/**
 * useTabNavigationGuard
 * ----------------------------------------------------------------------------
 * Versão "intra-página" do NavigationGuard.
 *
 * O NavigationGuard global cancela requisições quando o usuário muda de
 * **rota** (location.pathname). Mas várias páginas têm abas internas pesadas
 * (CarteiraPage, DetalhesPage, AnaliseListaTab...) onde o usuário pode trocar
 * de aba a qualquer momento. O padrão `enabled: activeTab === 'X'` impede a
 * próxima query de iniciar, mas NÃO cancela uma request que já está em voo,
 * deixando o backend processando "zombies" e ocupando slot da fila do axios.
 *
 * Este hook resolve esse gap: sempre que o valor observado (a aba ativa)
 * muda, ele aborta os requests em voo e cancela queries em fetch.
 *
 * Mutations (POST/PUT/DELETE/PATCH) são preservadas pelo cancelInflightRequests
 * — você não perde um "salvar" se trocar de aba durante a gravação.
 *
 * Uso:
 *   const [activeTab, setActiveTab] = useState('ativos')
 *   useTabNavigationGuard(activeTab)
 *
 * Importante: chame ANTES dos useQuery do componente para garantir que a fila
 * esteja limpa quando os hooks da nova aba dispararem seus fetches.
 */
export function useTabNavigationGuard(activeTab: string | null | undefined): void {
  const queryClient = useQueryClient()
  const prevTab = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    if (prevTab.current !== undefined && prevTab.current !== activeTab) {
      const cancelados = cancelInflightRequests()
      queryClient.cancelQueries({ fetchStatus: 'fetching' })

      if (cancelados > 0 && import.meta.env.DEV) {
        console.log(
          `[TabGuard] ${cancelados} request(s) canceladas: aba "${prevTab.current}" → "${activeTab}"`
        )
      }
    }
    prevTab.current = activeTab
  }, [activeTab, queryClient])
}

export default useTabNavigationGuard
