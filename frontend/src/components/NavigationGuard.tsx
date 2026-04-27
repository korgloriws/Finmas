import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { cancelInflightRequests } from '../services/api'

/**
 * NavigationGuard
 * ----------------------------------------------------------------------------
 * Cancela todas as requisições pendentes (em voo + na fila do limitador)
 * sempre que o usuário muda de rota.
 *
 * Cenários cobertos:
 *
 * 1) Entrei na Home → fui para Carteira:
 *    Requests da Home são abortadas, slots da fila liberam, Carteira começa
 *    a carregar imediatamente sem competir com nada.
 *
 * 2) Entrei na Home → fui para Detalhes:
 *    Igual ao caso 1, mas agora Detalhes é prioritária.
 *
 * 3) Entrei na Home → fui para Carteira → voltei para Home:
 *    A simetria funciona: ao sair de Home, suas requests cancelam; ao voltar,
 *    as requests da Carteira cancelam, e Home retoma seu carregamento do zero.
 *
 * Por que ficar fora do <Routes>:
 *  - Precisamos detectar a mudança ANTES dos componentes da nova rota
 *    montarem seus próprios useQuery, para que a fila esteja limpa quando
 *    eles começarem a fetchar.
 *  - useLocation só funciona dentro do BrowserRouter (já é o caso aqui).
 *
 * Importante: este componente não renderiza UI. Existe apenas para reagir
 * a mudanças de location.pathname. Mudanças apenas de query string ou hash
 * NÃO disparam o cancelamento — comportamento desejado para tabs/filtros.
 */
export default function NavigationGuard() {
  const location = useLocation()
  const queryClient = useQueryClient()
  const prevPath = useRef<string | null>(null)

  useEffect(() => {
    const currentPath = location.pathname
    const previousPath = prevPath.current

    if (previousPath !== null && previousPath !== currentPath) {
      // 1) Camada de rede (axios): aborta connections em voo + esvazia fila
      const cancelados = cancelInflightRequests()

      // 2) Camada de cache (React Query): marca queries como canceladas
      //    e libera o estado de loading dos componentes
      queryClient.cancelQueries({ fetchStatus: 'fetching' })

      // Log apenas em dev: ajuda a validar o comportamento
      if (cancelados > 0 && import.meta.env.DEV) {
        console.log(
          `[NavigationGuard] ${cancelados} request(s) canceladas: ${previousPath} → ${currentPath}`
        )
      }
    }

    prevPath.current = currentPath
  }, [location.pathname, queryClient])

  return null
}
