import { useEffect, useState, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

interface SecurityCheckProps {
  children: React.ReactNode
}

// Cache key para localStorage
const CACHE_KEY_PREFIX = 'finmas_security_check_'
const CACHE_TTL = 5 * 60 * 1000 // 5 minutos

interface CachedResult {
  hasSecurityQuestion: boolean
  timestamp: number
}

export default function SecurityCheck({ children }: SecurityCheckProps) {
  const { user, verificarPergunta } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [hasSecurityQuestion, setHasSecurityQuestion] = useState<boolean | null>(null)
  const hasCheckedRef = useRef(false)
  const isCheckingRef = useRef(false)

  // Função para obter cache
  const getCachedResult = (username: string): boolean | null => {
    try {
      const cacheKey = `${CACHE_KEY_PREFIX}${username}`
      const cached = localStorage.getItem(cacheKey)
      if (!cached) return null

      const parsed: CachedResult = JSON.parse(cached)
      const now = Date.now()
      
      // Verificar se o cache ainda é válido
      if (now - parsed.timestamp < CACHE_TTL) {
        return parsed.hasSecurityQuestion
      }
      
      // Cache expirado, remover
      localStorage.removeItem(cacheKey)
      return null
    } catch (error) {
      return null
    }
  }

  // Função para salvar no cache
  const setCachedResult = (username: string, hasSecurityQuestion: boolean) => {
    try {
      const cacheKey = `${CACHE_KEY_PREFIX}${username}`
      const cacheData: CachedResult = {
        hasSecurityQuestion,
        timestamp: Date.now()
      }
      localStorage.setItem(cacheKey, JSON.stringify(cacheData))
    } catch (error) {
      // Ignorar erros de localStorage (pode estar cheio ou desabilitado)
    }
  }

  // Verificar pergunta de segurança em background (não bloqueia renderização)
  useEffect(() => {
    const checkSecurityQuestion = async () => {
      if (!user) {
        setHasSecurityQuestion(null)
        hasCheckedRef.current = false
        return
      }

      // Evitar múltiplas verificações simultâneas
      if (isCheckingRef.current) return
      
      // Verificar cache primeiro
      const cached = getCachedResult(user)
      if (cached !== null) {
        setHasSecurityQuestion(cached)
        hasCheckedRef.current = true
        return
      }

      // Se já verificou, não verificar novamente imediatamente
      // (deixa o cache expirar naturalmente)
      if (hasCheckedRef.current) {
        return
      }

      // Primeira verificação - fazer em background (não bloqueia)
      isCheckingRef.current = true
      hasCheckedRef.current = true
      
      try {
        const resultado = await verificarPergunta(user)
        const hasQuestion = resultado.tem_pergunta
        setHasSecurityQuestion(hasQuestion)
        setCachedResult(user, hasQuestion)
      } catch (error: any) {
        console.error('Erro ao verificar pergunta de segurança:', error)
        // Em caso de erro, assumir que tem pergunta (mais seguro)
        setHasSecurityQuestion(true)
        setCachedResult(user, true)
      } finally {
        isCheckingRef.current = false
      }
    }

    checkSecurityQuestion()
  }, [user, verificarPergunta])

  // Redirecionar apenas se não tiver pergunta E não estiver na página de config
  useEffect(() => {
    if (hasSecurityQuestion === false && location.pathname !== '/configurar-seguranca') {
      navigate('/configurar-seguranca', { replace: true })
    }
  }, [hasSecurityQuestion, location.pathname, navigate])

  // PERFORMANCE: Renderizar página IMEDIATAMENTE, não bloquear
  // A verificação acontece em background e só redireciona se necessário
  return <>{children}</>
} 