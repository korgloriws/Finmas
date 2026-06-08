import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Newspaper,
  ExternalLink,
  Clock,
  RefreshCw,
  Search,
  Tag,
  Building2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { noticiasService, type Noticia } from '../services/api'
import { format, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import './NoticiasPage.css'

const ITENS_POR_PAGINA = 9
const LIMITE_FETCH = 72

function NoticiaMeta({ noticia }: { noticia: Noticia }) {
  return (
    <div className="noticias-jornal-meta">
      {noticia.categoria && (
        <span className="noticias-jornal-tag">{noticia.categoria}</span>
      )}
      {noticia.fonte && (
        <span>
          <Building2 style={{ width: 10, height: 10, display: 'inline' }} aria-hidden />
          {noticia.fonte}
        </span>
      )}
      {noticia.data && (
        <span>
          <Clock style={{ width: 10, height: 10, display: 'inline' }} aria-hidden />
          {formatDistanceToNow(new Date(noticia.data), { addSuffix: true, locale: ptBR })}
          {' · '}
          {format(new Date(noticia.data), "dd/MM/yyyy HH:mm", { locale: ptBR })}
        </span>
      )}
      <span>
        <ExternalLink style={{ width: 10, height: 10, display: 'inline' }} aria-hidden />
        Abrir matéria
      </span>
    </div>
  )
}

function PaginacaoJornal({
  pagina,
  totalPaginas,
  onPagina,
}: {
  pagina: number
  totalPaginas: number
  onPagina: (p: number) => void
}) {
  if (totalPaginas <= 1) return null

  const paginasVisiveis = useMemo(() => {
    const max = 7
    if (totalPaginas <= max) {
      return Array.from({ length: totalPaginas }, (_, i) => i + 1)
    }
    const meio = Math.min(Math.max(pagina, 4), totalPaginas - 3)
    const start = Math.max(1, meio - 3)
    const end = Math.min(totalPaginas, start + max - 1)
    const nums: number[] = []
    for (let i = start; i <= end; i++) nums.push(i)
    return nums
  }, [pagina, totalPaginas])

  return (
    <nav className="noticias-jornal-pagination" aria-label="Paginação do jornal">
      <button
        type="button"
        className="noticias-jornal-page-btn"
        disabled={pagina <= 1}
        onClick={() => onPagina(pagina - 1)}
        aria-label="Página anterior"
      >
        <ChevronLeft size={16} />
      </button>
      {paginasVisiveis[0] > 1 && (
        <>
          <button type="button" className="noticias-jornal-page-btn" onClick={() => onPagina(1)}>
            1
          </button>
          {paginasVisiveis[0] > 2 && <span className="noticias-jornal-page-info">…</span>}
        </>
      )}
      {paginasVisiveis.map((n) => (
        <button
          key={n}
          type="button"
          className={`noticias-jornal-page-btn${n === pagina ? ' active' : ''}`}
          onClick={() => onPagina(n)}
          aria-current={n === pagina ? 'page' : undefined}
        >
          {n}
        </button>
      ))}
      {paginasVisiveis[paginasVisiveis.length - 1] < totalPaginas && (
        <>
          {paginasVisiveis[paginasVisiveis.length - 1] < totalPaginas - 1 && (
            <span className="noticias-jornal-page-info">…</span>
          )}
          <button
            type="button"
            className="noticias-jornal-page-btn"
            onClick={() => onPagina(totalPaginas)}
          >
            {totalPaginas}
          </button>
        </>
      )}
      <button
        type="button"
        className="noticias-jornal-page-btn"
        disabled={pagina >= totalPaginas}
        onClick={() => onPagina(pagina + 1)}
        aria-label="Próxima página"
      >
        <ChevronRight size={16} />
      </button>
    </nav>
  )
}

export default function NoticiasPage() {
  const [pagina, setPagina] = useState(1)
  const [filtroCategoria, setFiltroCategoria] = useState<string | null>(null)
  const [filtroFonte, setFiltroFonte] = useState<string | null>(null)
  const [busca, setBusca] = useState('')

  const { data: noticias, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['noticias', 'lista', LIMITE_FETCH],
    queryFn: () => noticiasService.getNoticias(LIMITE_FETCH, false),
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const categorias = useMemo(
    () =>
      noticias
        ? (Array.from(new Set(noticias.map((n) => n.categoria).filter(Boolean))) as string[])
        : [],
    [noticias]
  )

  const fontes = useMemo(
    () =>
      noticias
        ? (Array.from(new Set(noticias.map((n) => n.fonte).filter(Boolean))) as string[])
        : [],
    [noticias]
  )

  const noticiasFiltradas = useMemo(() => {
    return (
      noticias?.filter((noticia) => {
        if (filtroCategoria && noticia.categoria !== filtroCategoria) return false
        if (filtroFonte && noticia.fonte !== filtroFonte) return false
        if (busca && !noticia.titulo.toLowerCase().includes(busca.toLowerCase())) return false
        return true
      }) || []
    )
  }, [noticias, filtroCategoria, filtroFonte, busca])

  const totalPaginas = Math.max(1, Math.ceil(noticiasFiltradas.length / ITENS_POR_PAGINA))

  useEffect(() => {
    setPagina(1)
  }, [busca, filtroCategoria, filtroFonte])

  useEffect(() => {
    if (pagina > totalPaginas) setPagina(totalPaginas)
  }, [pagina, totalPaginas])

  const noticiasPagina = useMemo(() => {
    const inicio = (pagina - 1) * ITENS_POR_PAGINA
    return noticiasFiltradas.slice(inicio, inicio + ITENS_POR_PAGINA)
  }, [noticiasFiltradas, pagina])

  const manchete = noticiasPagina[0]
  const secundarias = noticiasPagina.slice(1, 3)
  const grade = noticiasPagina.slice(3)

  const dataJornal = format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })
  const edicao = format(new Date(), "'Edição' dd/MM/yyyy — HH'h'mm", { locale: ptBR })

  return (
    <div className="noticias-jornal-outer container mx-auto px-4 py-6 sm:py-8 max-w-7xl">
      <article className="noticias-jornal-paper">
        <header className="noticias-jornal-masthead">
          <div className="noticias-jornal-brand" aria-label="Finmas Jornal">
            Finmas Jornal
          </div>
          <div className="noticias-jornal-subbrand">Mercado · Economia · Investimentos</div>
          <div className="noticias-jornal-date-line">
            <span>{dataJornal}</span>
            <span>{edicao}</span>
            <span>Pág. {pagina} de {totalPaginas}</span>
          </div>
        </header>

        <div className="noticias-jornal-toolbar">
          <div className="noticias-jornal-search-wrap">
            <Search aria-hidden />
            <input
              type="search"
              className="noticias-jornal-input"
              placeholder="Buscar manchetes..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              aria-label="Buscar notícias"
            />
          </div>
          {categorias.length > 0 && (
            <div className="noticias-jornal-search-wrap" style={{ flex: '0 1 160px' }}>
              <Tag aria-hidden style={{ left: '0.5rem' }} />
              <select
                className="noticias-jornal-select"
                value={filtroCategoria || ''}
                onChange={(e) => setFiltroCategoria(e.target.value || null)}
                aria-label="Filtrar por categoria"
              >
                <option value="">Todas seções</option>
                {categorias.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          )}
          {fontes.length > 0 && (
            <div className="noticias-jornal-search-wrap" style={{ flex: '0 1 150px' }}>
              <Building2 aria-hidden style={{ left: '0.5rem' }} />
              <select
                className="noticias-jornal-select"
                value={filtroFonte || ''}
                onChange={(e) => setFiltroFonte(e.target.value || null)}
                aria-label="Filtrar por fonte"
              >
                <option value="">Todas fontes</option>
                {fontes.map((fonte) => (
                  <option key={fonte} value={fonte}>
                    {fonte}
                  </option>
                ))}
              </select>
            </div>
          )}
          <button
            type="button"
            className="noticias-jornal-btn"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw
              size={14}
              style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }}
              className={isFetching ? 'animate-spin' : ''}
            />
            Atualizar
          </button>
        </div>

        {isLoading ? (
          <div className="noticias-jornal-lead">
            <div>
              <div className="noticias-jornal-skeleton noticias-jornal-skel-lead" />
              <div className="noticias-jornal-skeleton noticias-jornal-skel-line" />
              <div className="noticias-jornal-skeleton noticias-jornal-skel-line" style={{ width: '90%' }} />
              <div className="noticias-jornal-skeleton noticias-jornal-skel-line" style={{ width: '70%' }} />
            </div>
            <div className="noticias-jornal-skeleton noticias-jornal-skel-block" />
          </div>
        ) : noticiasFiltradas.length === 0 ? (
          <div className="noticias-jornal-empty">
            <Newspaper size={48} style={{ margin: '0 auto 1rem', opacity: 0.4 }} />
            <p>Nenhuma manchete encontrada para os filtros selecionados.</p>
          </div>
        ) : (
          <>
            {manchete && (
              <section className="noticias-jornal-lead" aria-labelledby="manchete-principal">
                <a
                  id="manchete-principal"
                  href={manchete.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="noticias-jornal-lead-link"
                >
                  <h2 className="noticias-jornal-lead-title">{manchete.titulo}</h2>
                  {manchete.resumo && (
                    <p className="noticias-jornal-lead-resumo">{manchete.resumo}</p>
                  )}
                  <NoticiaMeta noticia={manchete} />
                </a>
                {manchete.imagem_url && (
                  <a
                    href={manchete.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Imagem da matéria: ${manchete.titulo}`}
                  >
                    <img
                      src={manchete.imagem_url}
                      alt=""
                      className="noticias-jornal-lead-img"
                      loading="lazy"
                      onError={(e) => {
                        ;(e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  </a>
                )}
              </section>
            )}

            {secundarias.length > 0 && (
              <section className="noticias-jornal-secondary" aria-label="Manchetes secundárias">
                {secundarias.map((noticia) => (
                  <article key={noticia.url} className="noticias-jornal-secondary-item">
                    <a
                      href={noticia.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="noticias-jornal-secondary-link"
                    >
                      <h3 className="noticias-jornal-secondary-title">{noticia.titulo}</h3>
                      {noticia.resumo && (
                        <p className="noticias-jornal-grid-resumo">{noticia.resumo}</p>
                      )}
                      <NoticiaMeta noticia={noticia} />
                    </a>
                  </article>
                ))}
              </section>
            )}

            {grade.length > 0 && (
              <section className="noticias-jornal-grid" aria-label="Demais notícias">
                {grade.map((noticia) => (
                  <article key={noticia.url} className="noticias-jornal-grid-item">
                    <a
                      href={noticia.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="noticias-jornal-grid-link"
                    >
                      <h4 className="noticias-jornal-grid-title">{noticia.titulo}</h4>
                      {noticia.resumo && (
                        <p className="noticias-jornal-grid-resumo">{noticia.resumo}</p>
                      )}
                      <NoticiaMeta noticia={noticia} />
                    </a>
                  </article>
                ))}
              </section>
            )}
          </>
        )}

        <footer className="noticias-jornal-footer">
          <p className="noticias-jornal-page-info">
            {noticiasFiltradas.length} matérias
            {busca || filtroCategoria || filtroFonte ? ' (filtradas)' : ''}
          </p>
          <PaginacaoJornal pagina={pagina} totalPaginas={totalPaginas} onPagina={setPagina} />
        </footer>
      </article>
    </div>
  )
}
