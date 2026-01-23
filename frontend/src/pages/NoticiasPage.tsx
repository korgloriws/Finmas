import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { 
  Newspaper, 
  ExternalLink, 
  Clock, 
  RefreshCw, 
  Search,
  Tag,
  Building2
} from 'lucide-react'
import { noticiasService } from '../services/api'
import { formatDistanceToNow, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export default function NoticiasPage() {
  const [limite, setLimite] = useState(20)
  const [filtroCategoria, setFiltroCategoria] = useState<string | null>(null)
  const [filtroFonte, setFiltroFonte] = useState<string | null>(null)
  const [busca, setBusca] = useState('')

  const { data: noticias, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['noticias', 'lista', limite],
    queryFn: () => noticiasService.getNoticias(limite, false),
    staleTime: 10 * 60 * 1000, // 10 minutos
    refetchOnWindowFocus: false,
  })

  // Extrair categorias e fontes únicas
  const categorias = noticias 
    ? Array.from(new Set(noticias.map(n => n.categoria).filter(Boolean))) as string[]
    : []
  
  const fontes = noticias
    ? Array.from(new Set(noticias.map(n => n.fonte).filter(Boolean))) as string[]
    : []

  // Filtrar notícias
  const noticiasFiltradas = noticias?.filter(noticia => {
    if (filtroCategoria && noticia.categoria !== filtroCategoria) return false
    if (filtroFonte && noticia.fonte !== filtroFonte) return false
    if (busca && !noticia.titulo.toLowerCase().includes(busca.toLowerCase())) return false
    return true
  }) || []

  const handleRefresh = () => {
    refetch()
  }

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8 max-w-7xl">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 sm:mb-8"
      >
        <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary text-primary-foreground">
              <Newspaper className="w-6 h-6 sm:w-8 sm:h-8" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">Notícias do Mercado</h1>
              <p className="text-sm sm:text-base text-muted-foreground">
                Acompanhe as últimas notícias dos principais portais financeiros
              </p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isFetching}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Atualizar</span>
          </button>
        </div>

        {/* Filtros e Busca */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          {/* Busca */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar notícias..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Filtro Categoria */}
          {categorias.length > 0 && (
            <div className="relative">
              <Tag className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <select
                value={filtroCategoria || ''}
                onChange={(e) => setFiltroCategoria(e.target.value || null)}
                aria-label="Filtrar por categoria"
                className="pl-10 pr-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary appearance-none min-w-[150px]"
              >
                <option value="">Todas categorias</option>
                {categorias.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          )}

          {/* Filtro Fonte */}
          {fontes.length > 0 && (
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <select
                value={filtroFonte || ''}
                onChange={(e) => setFiltroFonte(e.target.value || null)}
                aria-label="Filtrar por fonte"
                className="pl-10 pr-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary appearance-none min-w-[150px]"
              >
                <option value="">Todas fontes</option>
                {fontes.map(fonte => (
                  <option key={fonte} value={fonte}>{fonte}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </motion.div>

      {/* Lista de Notícias */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-6 animate-pulse">
              <div className="h-6 bg-muted rounded w-3/4 mb-3"></div>
              <div className="h-4 bg-muted rounded w-1/2"></div>
            </div>
          ))}
        </div>
      ) : noticiasFiltradas.length === 0 ? (
        <div className="text-center py-12">
          <Newspaper className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <p className="text-lg text-muted-foreground">Nenhuma notícia encontrada</p>
        </div>
      ) : (
        <div className="space-y-4">
          {noticiasFiltradas.map((noticia, index) => (
            <motion.a
              key={noticia.url}
              href={noticia.url}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              className="block bg-card border border-border rounded-xl p-4 sm:p-6 hover:shadow-lg transition-all group"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg sm:text-xl font-bold mb-2 group-hover:text-primary transition-colors line-clamp-2">
                    {noticia.titulo}
                  </h3>
                  
                  {noticia.resumo && (
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                      {noticia.resumo}
                    </p>
                  )}

                  <div className="flex items-center gap-4 flex-wrap text-xs sm:text-sm text-muted-foreground">
                    {noticia.categoria && (
                      <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary">
                        <Tag className="w-3 h-3" />
                        {noticia.categoria}
                      </span>
                    )}
                    {noticia.fonte && (
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        {noticia.fonte}
                      </span>
                    )}
                    {noticia.data && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDistanceToNow(new Date(noticia.data), {
                          addSuffix: true,
                          locale: ptBR
                        })}
                        {' • '}
                        {format(new Date(noticia.data), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                    )}
                  </div>
                </div>
                <ExternalLink className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 mt-1" />
              </div>
            </motion.a>
          ))}
        </div>
      )}

      {/* Carregar mais */}
      {noticiasFiltradas.length > 0 && noticiasFiltradas.length >= limite && (
        <div className="mt-6 text-center">
          <button
            onClick={() => setLimite(limite + 20)}
            className="px-6 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Carregar mais notícias
          </button>
        </div>
      )}
    </div>
  )
}
