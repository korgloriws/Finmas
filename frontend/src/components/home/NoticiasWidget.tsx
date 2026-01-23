import { useRef, useEffect, memo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Newspaper, ExternalLink, Clock, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'
import { noticiasService } from '../../services/api'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface NoticiasWidgetProps {
  delay?: number
}

const NoticiasWidget = memo(({ delay = 0 }: NoticiasWidgetProps) => {
  const carouselRef = useRef<HTMLDivElement>(null)
  const scrollInitializedRef = useRef(false)
  const intervalIdRef = useRef<NodeJS.Timeout | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isPausedRef = useRef(false)
  const [currentIndex, setCurrentIndex] = useState(0)

  const { data: noticias, isLoading } = useQuery({
    queryKey: ['noticias', 'widget'],
    queryFn: () => noticiasService.getNoticias(5, false),
    staleTime: 10 * 60 * 1000, // 10 minutos
    refetchOnWindowFocus: false,
  })

  // Auto-scroll do carrossel
  useEffect(() => {
    if (scrollInitializedRef.current) return
    if (!noticias || noticias.length === 0) return

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = setTimeout(() => {
      if (!carouselRef.current) return
      if (scrollInitializedRef.current) return

      const container = carouselRef.current
      scrollInitializedRef.current = true

      const scrollToNext = () => {
        if (!container || isPausedRef.current) return

        const maxIndex = noticias.length - 1
        setCurrentIndex((prev) => {
          const next = (prev + 1) % (maxIndex + 1)
          const cardWidth = container.clientWidth
          container.scrollTo({
            left: next * cardWidth,
            behavior: 'smooth'
          })
          return next
        })
      }

      const handleMouseEnter = () => {
        isPausedRef.current = true
      }
      const handleMouseLeave = () => {
        isPausedRef.current = false
      }

      container.addEventListener('mouseenter', handleMouseEnter)
      container.addEventListener('mouseleave', handleMouseLeave)

      intervalIdRef.current = setInterval(scrollToNext, 4000) // Muda a cada 4 segundos
    }, 500)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current)
        intervalIdRef.current = null
      }
    }
  }, [noticias])

  // Limpar intervalos ao desmontar
  useEffect(() => {
    return () => {
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current)
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const scrollToIndex = (index: number) => {
    if (!carouselRef.current || !noticias) return
    const cardWidth = carouselRef.current.clientWidth
    carouselRef.current.scrollTo({
      left: index * cardWidth,
      behavior: 'smooth'
    })
    setCurrentIndex(index)
  }

  const scrollPrev = () => {
    if (!noticias) return
    const newIndex = currentIndex === 0 
      ? noticias.length - 1 
      : currentIndex - 1
    scrollToIndex(newIndex)
  }

  const scrollNext = () => {
    if (!noticias) return
    const newIndex = (currentIndex + 1) % noticias.length
    scrollToIndex(newIndex)
  }

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay }}
        className="bg-card border border-border rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-lg"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-primary text-primary-foreground">
            <Newspaper className="w-5 h-5" />
          </div>
          <h2 className="text-lg sm:text-xl font-bold">Últimas Notícias</h2>
        </div>
        <div className="h-48 bg-muted rounded-lg animate-pulse"></div>
      </motion.div>
    )
  }

  if (!noticias || noticias.length === 0) {
    return null
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className="bg-card border border-border rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-lg"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary text-primary-foreground">
            <Newspaper className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <h2 className="text-lg sm:text-xl font-bold">Últimas Notícias</h2>
        </div>
        <Link
          to="/noticias"
          className="text-sm text-primary hover:underline flex items-center gap-1"
        >
          Ver todas
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Carrossel */}
      <div className="relative">
        <div
          ref={carouselRef}
          className="flex overflow-x-hidden scroll-smooth snap-x snap-mandatory gap-4"
          style={{ 
            scrollbarWidth: 'none', 
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch'
          }}
          onScroll={(e) => {
            if (!carouselRef.current) return
            const container = e.currentTarget
            const cardWidth = container.clientWidth
            const newIndex = Math.round(container.scrollLeft / cardWidth)
            if (newIndex !== currentIndex) {
              setCurrentIndex(newIndex)
            }
          }}
        >
          {noticias.map((noticia, index) => (
            <motion.a
              key={noticia.url}
              href={noticia.url}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: delay + index * 0.1 }}
              className="min-w-full snap-start flex-shrink-0"
              style={{ minWidth: '100%' }}
            >
              <div className="bg-gradient-to-br from-primary/5 to-primary/10 border border-border rounded-xl p-4 sm:p-6 hover:shadow-lg transition-all group cursor-pointer min-h-[200px] sm:min-h-[240px]">
                <div className="flex flex-col h-full">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <h3 className="text-lg sm:text-xl font-bold line-clamp-3 group-hover:text-primary transition-colors flex-1">
                      {noticia.titulo}
                    </h3>
                    <ExternalLink className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 mt-1" />
                  </div>
                  
                  {noticia.resumo && (
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-3 flex-1">
                      {noticia.resumo}
                    </p>
                  )}

                  <div className="flex items-center gap-3 flex-wrap text-xs sm:text-sm text-muted-foreground mt-auto">
                    {noticia.categoria && (
                      <span className="px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">
                        {noticia.categoria}
                      </span>
                    )}
                    {noticia.fonte && (
                      <span className="font-medium">{noticia.fonte}</span>
                    )}
                    {noticia.data && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDistanceToNow(new Date(noticia.data), {
                          addSuffix: true,
                          locale: ptBR
                        })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </motion.a>
          ))}
        </div>

        {/* Botões de navegação */}
        {noticias.length > 1 && (
          <>
            <button
              onClick={scrollPrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-background/80 backdrop-blur-sm border border-border hover:bg-background transition-colors shadow-lg z-10"
              aria-label="Notícia anterior"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={scrollNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-background/80 backdrop-blur-sm border border-border hover:bg-background transition-colors shadow-lg z-10"
              aria-label="Próxima notícia"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}

        {/* Indicadores de página */}
        {noticias.length > 1 && (
          <div className="flex justify-center gap-2 mt-4">
            {noticias.map((_, index) => (
              <button
                key={index}
                onClick={() => scrollToIndex(index)}
                className={`h-2 rounded-full transition-all ${
                  currentIndex === index
                    ? 'w-8 bg-primary'
                    : 'w-2 bg-muted hover:bg-primary/50'
                }`}
                aria-label={`Ir para notícia ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
})

NoticiasWidget.displayName = 'NoticiasWidget'

export default NoticiasWidget
