import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Trophy, RefreshCw, ExternalLink, ChevronDown, ChevronUp, BarChart3 } from 'lucide-react'
import { rankingService, ativoService } from '../services/api'
import { formatCurrency } from '../utils/formatters'
import { normalizeTicker } from '../utils/tickerUtils'
import LoadingSpinner from '../components/LoadingSpinner'

export default function RankingsPage() {
  const navigate = useNavigate()
  const [tipoSelecionado, setTipoSelecionado] = useState<'acoes' | 'fiis' | 'bdrs' | 'criptos'>('acoes')
  const [secoesExpandidas, setSecoesExpandidas] = useState<Record<string, boolean>>({})
  const [logosCache, setLogosCache] = useState<Record<string, string | null>>({})

  const { data: rankings, isLoading, error, refetch } = useQuery({
    queryKey: ['rankings-investidor10', tipoSelecionado],
    queryFn: () => rankingService.getRankingsInvestidor10(tipoSelecionado),
    staleTime: 10 * 60 * 1000, // 10 minutos
    retry: 2,
  })

  // Carregar logos dos ativos
  const todosTickers = useMemo(() => {
    if (!rankings || !rankings.rankings) return []
    return rankings.rankings.map(r => r.ticker) || []
  }, [rankings])

  useQuery({
    queryKey: ['logos-rankings', todosTickers.length],
    queryFn: async () => {
      if (todosTickers.length === 0) return {}
      const tickersNormalizados = todosTickers.map(t => normalizeTicker(t))
      const logos = await ativoService.getLogosBatch(tickersNormalizados)
      setLogosCache(logos)
      return logos
    },
    enabled: todosTickers.length > 0,
    staleTime: 60 * 60 * 1000, // 1 hora
  })

  const toggleSecao = (secao: string) => {
    setSecoesExpandidas(prev => ({
      ...prev,
      [secao]: !prev[secao]
    }))
  }

  const handlePesquisaInterna = (ticker: string) => {
    const normalized = normalizeTicker(ticker)
    navigate(`/detalhes?ticker=${normalized}`)
  }

  const handleBuscaGoogle = (ticker: string, nome: string) => {
    const query = encodeURIComponent(`${ticker} ${nome} B3`)
    window.open(`https://www.google.com/search?q=${query}`, '_blank', 'noopener,noreferrer')
  }

  const formatarValor = (item: {
    valor: number | string | null
    valor_formatado?: string | null
    tipo_valor: 'percent' | 'money' | null
  }) => {
    // Se já tem valor_formatado do backend, usar ele
    if (item.valor_formatado) {
      return item.valor_formatado
    }
    
    // Caso contrário, formatar aqui
    if (item.valor === null || item.valor === undefined) return '-'
    
    if (item.tipo_valor === 'percent') {
      if (typeof item.valor === 'number') {
        return `${item.valor.toFixed(2)}%`
      }
      return `${item.valor}%`
    } else if (item.tipo_valor === 'money') {
      if (typeof item.valor === 'number') {
        return formatCurrency(item.valor)
      }
      // Se for string, tentar limpar e formatar
      if (typeof item.valor === 'string') {
        // Se já está formatado (tem R$ ou US$), retornar como está
        if (item.valor.includes('R$') || item.valor.includes('US$') || item.valor.includes('$')) {
          return item.valor
        }
        // Tentar converter string para número
        const numMatch = item.valor.match(/[\d,\.]+/)
        if (numMatch) {
          const numStr = numMatch[0].replace(',', '.')
          const num = parseFloat(numStr)
          if (!isNaN(num)) {
            return formatCurrency(num)
          }
        }
        return item.valor
      }
      return formatCurrency(item.valor)
    }
    
    return String(item.valor)
  }

  const getTipoLabel = (tipo: string) => {
    const labels: Record<string, string> = {
      'acoes': 'Ações',
      'fiis': 'FIIs',
      'bdrs': 'BDRs',
      'criptos': 'Criptomoedas'
    }
    return labels[tipo] || tipo
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <LoadingSpinner text="Carregando rankings..." />
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <h2 className="text-xl font-bold text-red-800 dark:text-red-200 mb-2">Erro ao carregar rankings</h2>
          <p className="text-red-600 dark:text-red-300">
            {error instanceof Error ? error.message : 'Erro desconhecido'}
          </p>
          <button
            onClick={() => refetch()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    )
  }

  if (!rankings || rankings.erro) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
          <h2 className="text-xl font-bold text-yellow-800 dark:text-yellow-200 mb-2">Erro ao buscar rankings</h2>
          <p className="text-yellow-600 dark:text-yellow-300">
            {rankings?.erro || 'Erro desconhecido'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Trophy className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">Rankings do Mercado</h1>
          </div>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </button>
        </div>

        {/* Filtro de tipo */}
        <div className="flex gap-2 mb-4">
          {(['acoes', 'fiis', 'bdrs', 'criptos'] as const).map(tipo => (
            <button
              key={tipo}
              onClick={() => setTipoSelecionado(tipo)}
              className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
                tipoSelecionado === tipo
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {getTipoLabel(tipo)}
            </button>
          ))}
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-sm text-muted-foreground mb-1">Total de Rankings</div>
            <div className="text-2xl font-bold text-foreground">{rankings.total_tipos_ranking}</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-sm text-muted-foreground mb-1">Total de Ativos</div>
            <div className="text-2xl font-bold text-foreground">{rankings.total_rankings}</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-sm text-muted-foreground mb-1">Tipo Selecionado</div>
            <div className="text-2xl font-bold text-foreground">{getTipoLabel(tipoSelecionado)}</div>
          </div>
        </div>
      </div>

      {/* Rankings por tipo - Grid de 3 colunas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(rankings.rankings_por_tipo || {}).map(([tipoRanking, items]) => {
          const secaoKey = `${tipoRanking}-${tipoSelecionado}`
          const isExpanded = secoesExpandidas[secaoKey] !== false

          return (
            <div key={tipoRanking} className="bg-card border border-border rounded-xl overflow-hidden flex flex-col">
              {/* Header da seção */}
              <button
                onClick={() => toggleSecao(secaoKey)}
                className="w-full flex items-center justify-between p-4 bg-muted/50 hover:bg-muted/70 transition-colors"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <BarChart3 className="w-4 h-4 text-primary flex-shrink-0" />
                  <h2 className="text-base font-bold text-foreground truncate">{tipoRanking}</h2>
                  <span className="text-xs text-muted-foreground flex-shrink-0">({items.length})</span>
                </div>
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                )}
              </button>

              {/* Conteúdo da seção - Lista vertical */}
              {isExpanded && (
                <div className="p-3 flex-1 overflow-y-auto max-h-[600px]">
                  <div className="space-y-2">
                    {items.map((item, index) => {
                      const tickerNormalizado = normalizeTicker(item.ticker)
                      const logoUrl = logosCache[tickerNormalizado] || logosCache[item.ticker] || null
                      
                      return (
                        <motion.a
                          key={`${item.ticker}-${index}`}
                          href={`/detalhes?ticker=${tickerNormalizado}`}
                          onClick={(e) => {
                            e.preventDefault()
                            handlePesquisaInterna(item.ticker)
                          }}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.2, delay: index * 0.02 }}
                          whileHover={{ x: 4 }}
                          className="group block"
                        >
                          <div className="flex items-center justify-between p-3 bg-background border border-border rounded-lg hover:border-primary/50 hover:bg-muted/30 hover:shadow-md transition-all duration-200">
                            {/* Container esquerdo: Logo + Info */}
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              {/* Logo */}
                              <div className="flex-shrink-0">
                                {logoUrl ? (
                                  <motion.img
                                    src={logoUrl}
                                    alt={item.ticker}
                                    className="w-10 h-10 rounded-lg object-cover border border-border shadow-sm group-hover:shadow-md transition-shadow"
                                    style={{ objectFit: 'cover' }}
                                    whileHover={{ scale: 1.1, rotate: 5 }}
                                  />
                                ) : (
                                  <motion.div
                                    className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-white font-bold text-xs shadow-sm group-hover:shadow-md transition-shadow"
                                    whileHover={{ scale: 1.1, rotate: 5 }}
                                  >
                                    {item.ticker.replace('.SA', '').replace('.sa', '').slice(0, 4)}
                                  </motion.div>
                                )}
                              </div>

                              {/* Informações */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <h3 className="font-bold text-sm text-foreground truncate">{item.ticker}</h3>
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      handleBuscaGoogle(item.ticker, item.nome)
                                    }}
                                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-muted rounded transition-all flex-shrink-0"
                                    title="Buscar no Google"
                                  >
                                    <ExternalLink className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                                  </button>
                                </div>
                                <p className="text-xs text-muted-foreground truncate">{item.nome}</p>
                              </div>
                            </div>

                            {/* Container direito: Valor */}
                            <div className="flex-shrink-0 ml-2 text-right">
                              <div className={`text-sm font-bold ${
                                item.tipo_valor === 'percent' 
                                  ? 'text-green-600 dark:text-green-400' 
                                  : 'text-blue-600 dark:text-blue-400'
                              }`}>
                                {formatarValor(item)}
                              </div>
                            </div>
                          </div>
                        </motion.a>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Mensagem se não houver rankings */}
      {Object.keys(rankings.rankings_por_tipo || {}).length === 0 && (
        <div className="text-center py-12 bg-card border border-border rounded-xl">
          <Trophy className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Nenhum ranking encontrado</p>
        </div>
      )}
    </div>
  )
}

