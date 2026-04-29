import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import api, { TELAS_APP } from '../services/api'

interface AuthContextType {
  user: string | null
  userRole: 'usuario' | 'admin' | null
  isAdmin: boolean
  /** Telas permitidas para o usuário (null = todas). Apenas para não-admin. */
  allowedScreens: string[] | null
  /** Verifica se o usuário pode acessar a rota (path ou id da tela). Admin sempre true. */
  canAccessScreen: (pathOrId: string) => boolean
  login: (username: string, password: string) => Promise<void>
  register: (nome: string, username: string, password: string, pergunta_seguranca?: string, resposta_seguranca?: string) => Promise<void>
  logout: () => Promise<void>
  obterPergunta: (username: string) => Promise<string>
  verificarResposta: (username: string, resposta: string) => Promise<boolean>
  redefinirSenha: (username: string, novaSenha: string) => Promise<void>
  atualizarPergunta: (username: string, pergunta: string, resposta: string) => Promise<void>
  verificarPergunta: (username: string) => Promise<{tem_pergunta: boolean, pergunta?: string}>
  setUserFromToken: (username: string, role: string) => void
  /** Atualiza allowedScreens no estado (ex.: após admin alterar telas do usuário atual) */
  refreshAllowedScreens: () => Promise<void>
  /** Recarrega user, role e allowed_screens do backend (útil após login com Google) */
  checkCurrentUser: () => Promise<boolean>
  loading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<'usuario' | 'admin' | null>(null)
  const [allowedScreens, setAllowedScreens] = useState<string[] | null>(null)
  const [loading, setLoading] = useState(true)
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  
  const isAdmin = userRole === 'admin'

  const canAccessScreen = useCallback((pathOrId: string) => {
    if (!user) return false
    if (isAdmin) return true
    // null, undefined ou lista vazia = sem restrição (acesso a todas as telas)
    if (allowedScreens === null || allowedScreens === undefined) return true
    if (Array.isArray(allowedScreens) && allowedScreens.length === 0) return true
    const normalized = (pathOrId === '/' || pathOrId === '/home') ? 'home' : pathOrId.replace(/^\//, '')
    const id = TELAS_APP.find(t => t.path === pathOrId || t.path === `/${normalized}` || t.id === pathOrId || t.id === normalized)?.id ?? normalized
    return allowedScreens.includes(id)
  }, [user, isAdmin, allowedScreens])

  useEffect(() => {
    // Segurança: não manter username autenticado em storage persistente.
    try {
      window.localStorage.removeItem('finmas_user')
    } catch {
      /* ignore */
    }
    checkCurrentUser()
  }, [])

  const checkCurrentUser = useCallback(async (): Promise<boolean> => {
    try {
      const response = await api.get('/auth/usuario-atual')

      if (response.data.username) {
        setUser(response.data.username)
        setUserRole(response.data.role || 'usuario')
        setAllowedScreens(response.data.allowed_screens ?? null)
        return true
      } else {
        setUser(null)
        setUserRole(null)
        setAllowedScreens(null)
        return false
      }
    } catch (error: any) {
      setUser(null)
      setUserRole(null)
      setAllowedScreens(null)
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  const refreshAllowedScreens = useCallback(async () => {
    if (!user) return
    try {
      const response = await api.get('/auth/usuario-atual')
      setAllowedScreens(response.data.allowed_screens ?? null)
    } catch (error: any) {
      // Mesma lógica do checkCurrentUser: aborts não devem zerar o estado.
      const isAbort =
        error?.code === 'ERR_CANCELED' ||
        error?.name === 'CanceledError' ||
        error?.name === 'AbortError'
      if (isAbort) return
      setAllowedScreens(null)
    }
  }, [user])

  const login = async (username: string, password: string) => {
    try {
      const response = await api.post('/auth/login', {
        username,
        senha: password
      })
      
      if (response.data.username) {
        setUser(response.data.username)
        setUserRole(response.data.role || 'usuario')
        await checkCurrentUser()
      } else {
        throw new Error('Erro no login')
      }
    } catch (error: any) {
      if (error.response?.data?.error) {
        throw new Error(error.response.data.error)
      }
      throw new Error('Erro ao fazer login')
    }
  }

  const register = async (nome: string, username: string, password: string, pergunta_seguranca?: string, resposta_seguranca?: string) => {
    try {
      const response = await api.post('/auth/registro', {
        nome,
        username,
        senha: password,
        pergunta_seguranca,
        resposta_seguranca
      })
      
      if (response.status === 201) {

        setUser(null)
        navigate('/login', { replace: true })
      } else {
        throw new Error('Erro no registro')
      }
    } catch (error: any) {
      if (error.response?.data?.error) {
        throw new Error(error.response.data.error)
      }
      throw new Error('Erro ao fazer registro')
    }
  }

  const obterPergunta = async (username: string) => {
    try {
      const response = await api.post('/auth/obter-pergunta', { username })
      return response.data.pergunta
    } catch (error: any) {
      if (error.response?.data?.error) {
        throw new Error(error.response.data.error)
      }
      throw new Error('Erro ao obter pergunta de segurança')
    }
  }

  const verificarResposta = async (username: string, resposta: string) => {
    try {
      await api.post('/auth/verificar-resposta', { username, resposta })
      return true
    } catch (error: any) {
      if (error.response?.data?.error) {
        throw new Error(error.response.data.error)
      }
      throw new Error('Erro ao verificar resposta')
    }
  }

  const redefinirSenha = async (username: string, novaSenha: string) => {
    try {
      await api.post('/auth/redefinir-senha', { username, nova_senha: novaSenha })
    } catch (error: any) {
      if (error.response?.data?.error) {
        throw new Error(error.response.data.error)
      }
      throw new Error('Erro ao redefinir senha')
    }
  }

  const atualizarPergunta = async (username: string, pergunta: string, resposta: string) => {
    try {
      await api.post('/auth/atualizar-pergunta', { username, pergunta, resposta })
      // Invalidar cache do SecurityCheck após atualizar pergunta
      try {
        const cacheKey = `finmas_security_check_${username}`
        window.localStorage.removeItem(cacheKey)
      } catch {
        /* ignore */
      }
    } catch (error: any) {
      if (error.response?.data?.error) {
        throw new Error(error.response.data.error)
      }
      throw new Error('Erro ao atualizar pergunta de segurança')
    }
  }

  // useCallback: SecurityCheck usa esta função em useEffect deps. Sem memoização
  // o effect re-rodaria a cada render do AuthProvider.
  const verificarPergunta = useCallback(async (username: string) => {
    try {
      const response = await api.post('/auth/verificar-pergunta', { username })
      return response.data
    } catch (error: any) {
      if (error.response?.data?.error) {
        throw new Error(error.response.data.error)
      }
      throw new Error('Erro ao verificar pergunta de segurança')
    }
  }, [])

  const logout = async () => {
    //  SEGURANÇA: Salvar username ANTES de limpar estado
    // Isso é crítico para poder invalidar o cache específico do usuário
    const currentUser = user
    
    try {
      //  SEGURANÇA: Invalidar cache específico do usuário ANTES de fazer logout
      // Isso garante que nenhum dado do usuário permaneça em cache
      if (currentUser) {
        try {
          // Invalidar todas as queries que incluem o username
          queryClient.removeQueries({
            predicate: (query) => {
              const queryKey = query.queryKey
              // Verificar se a queryKey inclui o username
              if (Array.isArray(queryKey)) {
                return queryKey.includes(currentUser) || 
                       queryKey.some(key => 
                         typeof key === 'string' && key.includes(currentUser)
                       )
              }
              return false
            }
          })
          
          // Invalidar queries conhecidas que usam username (por segurança extra)
          const queriesComUser = [
            ['carteira', currentUser],
            ['carteira-insights', currentUser],
            ['batch-home', currentUser],
            ['home-resumo', currentUser],
            ['carteira-historico', currentUser],
            ['movimentacoes', currentUser],
            ['movimentacoes-all', currentUser],
            ['proventos', currentUser],
            ['proventos-recebidos', currentUser],
            ['historico-carteira', currentUser],
            ['rebalance-config', currentUser],
            ['rebalance-status', currentUser],
            ['rebalance-history', currentUser],
            ['tipos-ativos', currentUser],
            ['perfil'],
            ['admin-usuarios'],
          ]
          
          queriesComUser.forEach(queryKey => {
            queryClient.removeQueries({ queryKey })
          })
          
          console.log(`[SEGURANÇA] Cache do React Query invalidado para usuário: ${currentUser}`)
        } catch (cacheError) {
          // Não falhar o logout se houver erro ao limpar cache
          console.warn('[AVISO] Erro ao invalidar cache específico do usuário:', cacheError)
        }
      }
      
      // Fazer logout no backend
      await api.post('/auth/logout')
      
      //  SEGURANÇA: Limpar estado do usuário
      setUser(null)
      setUserRole(null)
      setAllowedScreens(null)
      
      //  SEGURANÇA: Limpar TODO o cache (segurança extra)
      // Isso garante que mesmo queries sem username sejam limpas
      queryClient.clear()
      
      // Limpar localStorage (incluindo cache do SecurityCheck)
      try {
        // Limpar cache do SecurityCheck para o usuário atual
        if (currentUser) {
          const cacheKey = `finmas_security_check_${currentUser}`
          window.localStorage.removeItem(cacheKey)
        }
      } catch {
        /* ignore */
      }
      
      // Navegar para a tela de login sem recarregar a página
      navigate('/login', { replace: true })
    } catch (error) {
      console.error('Erro ao fazer logout:', error)
      
      //  SEGURANÇA: Mesmo com erro, limpar TUDO
      if (currentUser) {
        try {
          queryClient.removeQueries({
            predicate: (query) => {
              const queryKey = query.queryKey
              if (Array.isArray(queryKey)) {
                return queryKey.includes(currentUser) || 
                       queryKey.some(key => 
                         typeof key === 'string' && key.includes(currentUser)
                       )
              }
              return false
            }
          })
        } catch {
          /* ignore */
        }
      }
      
      setUser(null)
      setUserRole(null)
      setAllowedScreens(null)
      queryClient.clear()
      
      try {
        if (currentUser) {
          const cacheKey = `finmas_security_check_${currentUser}`
          window.localStorage.removeItem(cacheKey)
        }
      } catch {
        /* ignore */
      }
      
      navigate('/login', { replace: true })
    }
  }

  // useCallback: GoogleCallbackPage usa esta função em useEffect deps. Sem
  // memoização o effect re-rodaria em loop, causando race condition entre
  // setUserFromToken e checkCurrentUser que podia zerar o usuário recém-logado.
  const setUserFromToken = useCallback((username: string, role: string) => {
    //  SEGURANÇA: Limpar cache antes de definir novo usuário
    // Isso garante que dados de usuários anteriores não sejam mantidos
    try {
      queryClient.clear()
    } catch {
      /* ignore */
    }

    // Definir novo usuário (allowed_screens será carregado no próximo checkCurrentUser)
    setUser(username)
    setUserRole(role as 'usuario' | 'admin')
    setAllowedScreens(null)
    setLoading(false)
    console.log(`[SEGURANÇA] Usuário definido via token: ${username}, cache limpo`)
  }, [queryClient])

  const value = {
    user,
    userRole,
    isAdmin,
    allowedScreens,
    canAccessScreen,
    login,
    register,
    logout,
    obterPergunta,
    verificarResposta,
    redefinirSenha,
    atualizarPergunta,
    verificarPergunta,
    setUserFromToken,
    refreshAllowedScreens,
    checkCurrentUser,
    loading
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
} 