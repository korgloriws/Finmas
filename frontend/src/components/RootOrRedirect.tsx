import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import LandingPage from '../pages/LandingPage'
import ProtectedRoute from './ProtectedRoute'
import SecurityCheck from './SecurityCheck'
import Layout from './Layout'
import HomePage from '../pages/HomePage'

/**
 * Rota raiz (/): entrada do sistema em finmas.com.br.
 * Se o usuário estiver logado, exibe o dashboard em / (sem redirecionar para /home).
 * Caso contrário, exibe a landing page pública.
 */
export default function RootOrRedirect() {
  const { user, loading, checkCurrentUser, setUserFromToken } = useAuth()
  const [oauthRechecking, setOauthRechecking] = useState(false)

  useEffect(() => {
    if (loading || user) return

    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    const username = params.get('username')
    const role = params.get('role')

    // Compatibilidade: se algum ambiente redirecionar OAuth direto para "/"
    // com token na query, promove o usuário imediatamente.
    if (!token || !username) return

    setUserFromToken(username, role || 'usuario')
    params.delete('token')
    params.delete('username')
    params.delete('role')
    const query = params.toString()
    const cleanUrl = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash || ''}`
    window.history.replaceState({}, '', cleanUrl)
  }, [loading, user, setUserFromToken])

  useEffect(() => {
    const isOAuthReturn = (() => {
      try {
        const params = new URLSearchParams(window.location.search)
        return params.get('oauth') === '1'
      } catch {
        return false
      }
    })()

    if (!isOAuthReturn || loading || user) return

    let cancelled = false
    setOauthRechecking(true)

    const run = async () => {
      // Revalida sessão ao cair em "/" após callback Google.
      // Evita decidir Landing cedo demais no primeiro ciclo pós-OAuth.
      for (let i = 0; i < 8; i += 1) {
        const authenticated = await checkCurrentUser()
        if (cancelled) return
        if (authenticated) break
        await new Promise((resolve) => setTimeout(resolve, 300))
      }
      if (!cancelled) setOauthRechecking(false)
    }

    run()
    return () => {
      cancelled = true
    }
  }, [loading, user, checkCurrentUser])

  useEffect(() => {
    if (oauthRechecking && user) {
      setOauthRechecking(false)
    }
  }, [oauthRechecking, user])

  console.log('[FINMAS-ROOT-DEBUG] render: user=', user, '| loading=', loading)

  if (loading || oauthRechecking) {
    console.log('[FINMAS-ROOT-DEBUG] -> SPINNER (loading=true)')
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" aria-hidden />
      </div>
    )
  }

  if (user) {
    console.log('[FINMAS-ROOT-DEBUG] -> HomePage (user OK)')
    return (
      <ProtectedRoute>
        <SecurityCheck>
          <Layout>
            <HomePage />
          </Layout>
        </SecurityCheck>
      </ProtectedRoute>
    )
  }

  console.warn('[FINMAS-ROOT-DEBUG] -> LandingPage (user=null, loading=false)')
  return <LandingPage />
}
