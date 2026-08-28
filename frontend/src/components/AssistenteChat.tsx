import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Bot, Loader2, MessageCircle, Send, Sparkles, X } from 'lucide-react'
import { assistenteService, AssistenteMensagem } from '../services/api'
import { useAuth } from '../contexts/AuthContext'

type ChatMsg = {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  meta?: string
}

const SUGGESTIONS = [
  'Como está a concentração da minha carteira?',
  'Me dá insights para diversificar melhor',
  'Quais notícias recentes do mercado?',
  'Explique DY, ROE e P/L de forma simples',
]

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export default function AssistenteChat() {
  const { user } = useAuth()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Olá! Sou o assistente do FinMas. Posso analisar sua carteira, explicar indicadores da tela e buscar notícias — sempre com dados do sistema.',
    },
  ])
  const listRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const contexto = useMemo(() => {
    const params = new URLSearchParams(location.search)
    const path = location.pathname
    let titulo = 'FinMas'
    if (path.startsWith('/analise')) titulo = 'Análise de oportunidades'
    else if (path.startsWith('/carteira')) titulo = 'Carteira'
    else if (path.startsWith('/detalhes')) titulo = 'Detalhes dos ativos'
    else if (path.startsWith('/controle')) titulo = 'Controle financeiro'
    else if (path.startsWith('/noticias')) titulo = 'Notícias'
    else if (path === '/') titulo = 'Home'

    return {
      rota: path,
      titulo,
      aba: params.get('tab') || undefined,
      subaba: params.get('sub') || undefined,
      ticker: params.get('ticker') || undefined,
    }
  }, [location.pathname, location.search])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    assistenteService
      .status()
      .then((s) => {
        if (!cancelled) setConfigured(!!s.configured)
      })
      .catch(() => {
        if (!cancelled) setConfigured(false)
      })
    return () => {
      cancelled = true
    }
  }, [user])

  useEffect(() => {
    if (!open) return
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, open, loading])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const enviar = useCallback(
    async (textoOverride?: string) => {
      const texto = (textoOverride ?? input).trim()
      if (!texto || loading) return

      setInput('')
      setError(null)
      const userMsg: ChatMsg = { id: uid(), role: 'user', content: texto }
      setMessages((prev) => [...prev, userMsg])
      setLoading(true)

      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl

      const historico: AssistenteMensagem[] = [...messages, userMsg]
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .filter((m) => m.id !== 'welcome')
        .slice(-10)
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))

      try {
        const res = await assistenteService.chat(
          { mensagem: texto, historico, contexto },
          { signal: ctrl.signal }
        )
        if (!res.ok) {
          setError(res.error || 'Não foi possível responder agora.')
          setMessages((prev) => [
            ...prev,
            {
              id: uid(),
              role: 'assistant',
              content:
                res.code === 'missing_api_key'
                  ? 'O assistente ainda não está configurado. Adicione OPENROUTER_API_KEY no .env do backend e reinicie o Flask.'
                  : res.error || 'Falha ao consultar o assistente.',
            },
          ])
          return
        }
        const tools = res.tools_used?.length ? ` · tools: ${res.tools_used.join(', ')}` : ''
        setMessages((prev) => [
          ...prev,
          {
            id: uid(),
            role: 'assistant',
            content: res.reply || 'Sem resposta.',
            meta: res.model ? `${res.model}${tools}` : undefined,
          },
        ])
        if (configured === false) setConfigured(true)
      } catch (e: any) {
        if (e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED') return
        const isTimeout = e?.code === 'ECONNABORTED' || String(e?.message || '').toLowerCase().includes('timeout')
        const msg = e?.response?.data?.error || e?.message || 'Erro de rede'
        setError(String(msg))
        setMessages((prev) => [
          ...prev,
          {
            id: uid(),
            role: 'assistant',
            content: isTimeout
              ? 'A resposta demorou demais. Tente de novo com uma pergunta mais direta (ex.: “o que tem nesta tela?” ou “resumo da minha carteira”).'
              : 'Tive um problema para responder. Tente novamente em instantes.',
          },
        ])
      } finally {
        setLoading(false)
        if (abortRef.current === ctrl) abortRef.current = null
      }
    },
    [configured, contexto, input, loading, messages]
  )

  if (!user) return null

  return (
    <>
      <motion.button
        type="button"
        aria-label="Abrir assistente FinMas"
        onClick={() => setOpen(true)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.96 }}
        className="fixed bottom-5 right-5 z-[90] flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <MessageCircle className="h-5 w-5" />
      </motion.button>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-[95] flex items-end justify-end sm:items-center sm:justify-center p-0 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/45"
              onClick={() => setOpen(false)}
            />

            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="relative z-10 flex h-[min(720px,92vh)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl border border-border bg-card shadow-2xl"
              role="dialog"
              aria-modal="true"
              aria-label="Assistente FinMas"
            >
              <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 bg-muted/30">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shrink-0">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">Assistente FinMas</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {contexto.titulo}
                      {configured === false ? ' · configure OPENROUTER_API_KEY' : ' · OpenRouter + tools'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="p-2 rounded-lg hover:bg-accent text-muted-foreground"
                  aria-label="Fechar assistente"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                        m.role === 'user'
                          ? 'bg-primary text-primary-foreground rounded-br-md'
                          : 'bg-muted text-foreground rounded-bl-md'
                      }`}
                    >
                      {m.role === 'assistant' && (
                        <div className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                          <Bot className="h-3 w-3" />
                          Assistente
                        </div>
                      )}
                      <p className="whitespace-pre-wrap">{m.content}</p>
                      {m.meta && (
                        <p className="mt-1.5 text-[10px] opacity-70 break-all">{m.meta}</p>
                      )}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Analisando com tools...
                  </div>
                )}
              </div>

              {!loading && messages.length <= 2 && (
                <div className="px-4 pb-2 flex flex-wrap gap-1.5">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => void enviar(s)}
                      className="text-[11px] px-2.5 py-1 rounded-full border border-border bg-background hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {error && (
                <div className="px-4 pb-1">
                  <p className="text-[11px] text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}

              <form
                className="border-t border-border p-3 flex items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  void enviar()
                }}
              >
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      void enviar()
                    }
                  }}
                  rows={2}
                  placeholder="Pergunte sobre carteira, indicadores, tela atual..."
                  className="flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  aria-label="Mensagem para o assistente"
                  disabled={loading}
                />
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="h-10 w-10 shrink-0 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50 hover:bg-primary/90"
                  aria-label="Enviar"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
