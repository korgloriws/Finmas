import { useRef, useEffect, useMemo, memo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { rankingService, ativoService } from '../../services/api'
import { normalizeTicker } from '../../utils/tickerUtils'
import { formatCurrency, formatPercentage } from '../../utils/formatters'

interface TopRankingsCarouselProps {
  delay?: number
}

const TopRankingsCarousel = memo(({ delay = 0 }: TopRankingsCarouselProps) => {
  const carouselRef = useRef<HTMLDivElement>(null)
  const scrollInitializedRef = useRef(false)
  const intervalIdRef = useRef<NodeJS.Timeout | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Buscar rankings de todos os tipos
  const { data: rankingsAcoes } = useQuery({
    queryKey: ['rankings-top-acoes'],
    queryFn: () => rankingService.getRankingsInvestidor10('acoes'),
    staleTime: 10 * 60 * 1000,
    retry: 2,
  })

  const { data: rankingsFiis } = useQuery({
    queryKey: ['rankings-top-fiis'],
    queryFn: () => rankingService.getRankingsInvestidor10('fiis'),
    staleTime: 10 * 60 * 1000,
    retry: 2,
  })

  const { data: rankingsBdrs } = useQuery({
    queryKey: ['rankings-top-bdrs'],
    queryFn: () => rankingService.getRankingsInvestidor10('bdrs'),
    staleTime: 10 * 60 * 1000,
    retry: 2,
  })

  const { data: rankingsCriptos } = useQuery({
    queryKey: ['rankings-top-criptos'],
    queryFn: () => rankingService.getRankingsInvestidor10('criptos'),
    staleTime: 10 * 60 * 1000,
    retry: 2,
  })

  // Pegar o primeiro item de cada tipo de ranking de cada categoria
  const topAtivos = useMemo(() => {
    const ativos: Array<{
      ticker: string
      nome: string
      rankingTipo: string
      valor: string | number | null
      tipo_valor: 'percent' | 'money' | null
      categoria: string
    }> = []
    
    const processarRankings = (rankings: any, categoria: string) => {
      if (!rankings?.rankings_por_tipo) return
      
      Object.entries(rankings.rankings_por_tipo).forEach(([tipoRanking, items]) => {
        if (items && Array.isArray(items) && items.length > 0) {
          ativos.push({
            ticker: items[0].ticker,
            nome: items[0].nome,
            rankingTipo: tipoRanking,
            valor: items[0].valor,
            tipo_valor: items[0].tipo_valor,
            categoria: categoria
          })
        }
      })
    }
    
    processarRankings(rankingsAcoes, 'Ações')
    processarRankings(rankingsFiis, 'FIIs')
    processarRankings(rankingsBdrs, 'BDRs')
    processarRankings(rankingsCriptos, 'Criptos')
    
    return ativos
  }, [rankingsAcoes, rankingsFiis, rankingsBdrs, rankingsCriptos])

  // Buscar logos dos top ativos
  const tickersParaBuscar = useMemo(() => {
    return topAtivos.map(a => normalizeTicker(a.ticker))
  }, [topAtivos])

  const { data: logos } = useQuery({
    queryKey: ['logos-top-rankings', tickersParaBuscar.length],
    queryFn: async () => {
      if (tickersParaBuscar.length === 0) return {}
      return await ativoService.getLogosBatch(tickersParaBuscar)
    },
    enabled: tickersParaBuscar.length > 0,
    staleTime: 60 * 60 * 1000,
  })

  // Buscar cotações e variações
  const { data: precosData } = useQuery({
    queryKey: ['precos-top-rankings', tickersParaBuscar.join(',')],
    queryFn: async () => {
      if (tickersParaBuscar.length === 0) return {}
      
      const precos: Record<string, { preco: number; variacao: number }> = {}
      
      await Promise.all(
        tickersParaBuscar.map(async (ticker) => {
          try {
            const detalhes = await ativoService.getDetalhes(ticker)
            if (detalhes?.info?.currentPrice) {
              precos[ticker] = {
                preco: detalhes.info.currentPrice,
                variacao: detalhes.info.regularMarketChangePercent || 0
              }
            }
          } catch (e) {
            // Ignorar erros individuais
          }
        })
      )
      
      return precos
    },
    enabled: tickersParaBuscar.length > 0,
    staleTime: 2 * 60 * 1000,
  })

  // Refs para manter estado do scroll
  const isPausedRef = useRef(false)
  const handlersRef = useRef<{
    mouseEnter: (() => void) | null
    mouseLeave: (() => void) | null
  }>({ mouseEnter: null, mouseLeave: null })

  // Auto-scroll do carrossel
  useEffect(() => {
    if (scrollInitializedRef.current) return
    if (!topAtivos || topAtivos.length === 0) return

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = setTimeout(() => {
      if (!carouselRef.current) return
      if (scrollInitializedRef.current) return

      const container = carouselRef.current
      scrollInitializedRef.current = true

      const scroll = () => {
        if (!container || isPausedRef.current) return

        const maxScroll = container.scrollWidth - container.clientWidth
        if (maxScroll <= 0) return

        container.scrollLeft += 1
        if (container.scrollLeft >= maxScroll) {
          container.scrollLeft = 0
        }
      }

      const handleMouseEnter = () => {
        isPausedRef.current = true
      }
      const handleMouseLeave = () => {
        isPausedRef.current = false
      }

      handlersRef.current.mouseEnter = handleMouseEnter
      handlersRef.current.mouseLeave = handleMouseLeave

      container.addEventListener('mouseenter', handleMouseEnter)
      container.addEventListener('mouseleave', handleMouseLeave)

      intervalIdRef.current = setInterval(scroll, 16)
    }, 500)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [topAtivos])

  // Cleanup
  useEffect(() => {
    return () => {
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current)
        intervalIdRef.current = null
      }
      if (carouselRef.current && handlersRef.current.mouseEnter && handlersRef.current.mouseLeave) {
        carouselRef.current.removeEventListener('mouseenter', handlersRef.current.mouseEnter)
        carouselRef.current.removeEventListener('mouseleave', handlersRef.current.mouseLeave)
      }
      scrollInitializedRef.current = false
    }
  }, [])

  if (!topAtivos || topAtivos.length === 0) {
    return null
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className="bg-card border border-border rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-lg sm:shadow-xl"
    >
      <div 
        ref={carouselRef}
        className="overflow-x-auto scrollbar-hide"
        style={{ scrollBehavior: 'smooth' }}
      >
        <div className="flex gap-3 pb-2" style={{ minWidth: 'max-content' }}>
          {topAtivos.map((ativo, index) => {
            const tickerNormalizado = normalizeTicker(ativo.ticker)
            const logoUrl = logos?.[tickerNormalizado] || logos?.[ativo.ticker] || null
            const precoInfo = precosData?.[tickerNormalizado] || precosData?.[ativo.ticker]
            const variacao = precoInfo?.variacao || 0
            const preco = precoInfo?.preco

            return (
              <motion.div
                key={`${ativo.ticker}-${index}`}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: delay + index * 0.1 }}
                onClick={() => window.location.href = `/detalhes?ticker=${tickerNormalizado}`}
                className="flex-shrink-0 w-32 sm:w-40 bg-background border border-border rounded-lg p-3 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group"
              >
                <div className="flex justify-center mb-2">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt={ativo.ticker}
                      className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg object-cover"
                      style={{ objectFit: 'cover' }}
                    />
                  ) : (
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-white font-bold text-xs">
                      {ativo.ticker.replace('.SA', '').replace('.sa', '').replace('-USD', '').slice(0, 4)}
                    </div>
                  )}
                </div>

                <div className="text-center mb-2">
                  <p className="text-xs sm:text-sm font-bold text-foreground truncate">{ativo.ticker}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{ativo.rankingTipo}</p>
                </div>

                <div className="space-y-1">
                  {preco ? (
                    <p className="text-xs sm:text-sm font-semibold text-foreground text-center">
                      {formatCurrency(preco)}
                    </p>
                  ) : null}
                  {variacao !== 0 && (
                    <div className={`flex items-center justify-center gap-1 ${
                      variacao >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    }`}>
                      {variacao >= 0 ? (
                        <ArrowUpRight className="w-3 h-3" />
                      ) : (
                        <ArrowDownRight className="w-3 h-3" />
                      )}
                      <span className="text-xs font-semibold">
                        {formatPercentage(Math.abs(variacao))}
                      </span>
                    </div>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </motion.div>
  )
})

TopRankingsCarousel.displayName = 'TopRankingsCarousel'

export default TopRankingsCarousel

