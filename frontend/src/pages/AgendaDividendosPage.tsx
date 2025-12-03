import { useState, useMemo, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Calendar, TrendingUp, DollarSign, Filter, RefreshCw, Search, ExternalLink, ChevronDown, ChevronUp, Trophy, Calculator } from 'lucide-react'
import { dividendosService, ativoService } from '../services/api'
import { formatCurrency, formatDate } from '../utils/formatters'
import { getDisplayTicker, normalizeTicker } from '../utils/tickerUtils'
import LoadingSpinner from '../components/LoadingSpinner'
import CalculadoraDividendosModal from '../components/dividendos/CalculadoraDividendosModal'

export default function AgendaDividendosPage() {
  const navigate = useNavigate()
  const [mesSelecionado, setMesSelecionado] = useState(new Date().getMonth() + 1)
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear())
  const [tiposFiltro, setTiposFiltro] = useState<string[]>(['acoes', 'fiis', 'bdrs'])
  const [logosCache, setLogosCache] = useState<Record<string, string | null>>({})
  const [secoesExpandidas, setSecoesExpandidas] = useState<Record<string, boolean>>({
    acoes: true,
    fiis: true,
    bdrs: true,
    rankingAcoes: true,
    rankingFiis: true,
    rankingBdrs: true
  })
  const [abaAtiva, setAbaAtiva] = useState<'agenda' | 'ranking'>('agenda')
  const [calculadoraOpen, setCalculadoraOpen] = useState(false)
  const [calculadoraTicker, setCalculadoraTicker] = useState<string>('')
  const [calculadoraValor, setCalculadoraValor] = useState<number | undefined>(undefined)
  const [calculadoraNome, setCalculadoraNome] = useState<string>('')
  const [precosRanking, setPrecosRanking] = useState<Record<string, number>>({})
  const [tickersCarregando, setTickersCarregando] = useState<Set<string>>(new Set())
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map())
  const tickersProcessados = useRef<Set<string>>(new Set())
  const logosProcessados = useRef<Set<string>>(new Set())
  
  const { data: agenda, isLoading, error, refetch } = useQuery({
    queryKey: ['agenda-dividendos', mesSelecionado, anoSelecionado, tiposFiltro],
    queryFn: async () => {
      try {
        return await dividendosService.getAgenda(mesSelecionado, anoSelecionado, tiposFiltro)
      } catch (err: any) {
        console.error('Erro ao buscar agenda de dividendos:', err)
        // Se a resposta tem erro, lançar com mensagem mais clara
        if (err?.response?.data?.erro) {
          throw new Error(err.response.data.erro)
        }
        throw err
      }
    },
    staleTime: 30 * 60 * 1000, // 30 minutos (dados não mudam com frequência)
    retry: 2,
  })

  const toggleTipo = (tipo: string) => {
    setTiposFiltro(prev => 
      prev.includes(tipo) 
        ? prev.filter(t => t !== tipo)
        : [...prev, tipo]
    )
  }

  const handlePesquisaInterna = (ticker: string) => {
    const normalized = normalizeTicker(ticker)
    navigate(`/detalhes?ticker=${normalized}`)
  }

  const handleBuscaGoogle = (ticker: string, nome: string) => {
    const query = encodeURIComponent(`${ticker} ${nome} B3`)
    window.open(`https://www.google.com/search?q=${query}`, '_blank', 'noopener,noreferrer')
  }

  const toggleSecao = (secao: string) => {
    setSecoesExpandidas(prev => ({
      ...prev,
      [secao]: !prev[secao]
    }))
  }

  // Query para rankings - usar mes/ano da aba agenda quando na aba ranking
  const { data: ranking, isLoading: loadingRanking, error: errorRanking, refetch: refetchRanking } = useQuery({
    queryKey: ['ranking-dividendos', mesSelecionado, anoSelecionado],
    queryFn: async () => {
      try {
        // Passar mes e ano para filtrar por data-com
        return await dividendosService.getRanking(undefined, mesSelecionado, anoSelecionado)
      } catch (err: any) {
        console.error('Erro ao buscar ranking de dividendos:', err)
        if (err?.response?.data?.erro) {
          throw new Error(err.response.data.erro)
        }
        throw err
      }
    },
    staleTime: 30 * 60 * 1000, // 30 minutos
    retry: 2,
  })

  // Carregar logos dos ativos (agenda)
  useQuery({
    queryKey: ['logos-agenda', agenda?.acoes?.total, agenda?.fiis?.total, agenda?.bdrs?.total],
    queryFn: async () => {
      if (!agenda) return {}
      
      const todosTickers = [
        ...(agenda.acoes?.dividendos?.map(d => d.ticker) || []),
        ...(agenda.fiis?.dividendos?.map(d => d.ticker) || []),
        ...(agenda.bdrs?.dividendos?.map(d => d.ticker) || [])
      ]
      
      // Normalizar todos os tickers antes de buscar
      const tickersNormalizados = todosTickers.map(t => normalizeTicker(t))
      const logos = await ativoService.getLogosBatch(tickersNormalizados)
      setLogosCache(logos)
      return logos
    },
    enabled: !!agenda && (agenda.acoes?.total > 0 || agenda.fiis?.total > 0 || agenda.bdrs?.total > 0),
    staleTime: 60 * 60 * 1000, // 1 hora
  })

  // Buscar logos e cotações incrementalmente apenas para itens visíveis (em paralelo)
  useEffect(() => {
    if (!ranking || abaAtiva !== 'ranking') {
      setPrecosRanking({})
      setTickersCarregando(new Set())
      tickersProcessados.current.clear()
      logosProcessados.current.clear()
      return
    }

    const todosTickers = [
      ...(ranking.acoes?.ranking?.map(r => r.ticker) || []),
      ...(ranking.fiis?.ranking?.map(r => r.ticker) || []),
      ...(ranking.bdrs?.ranking?.map(r => r.ticker) || [])
    ]

    if (todosTickers.length === 0) return

    // Snapshot do cache atual para verificação dentro do useEffect
    let cacheSnapshot = { ...logosCache }

    // Função para buscar logo de um ticker
    const buscarLogo = async (ticker: string) => {
      const normalizedTicker = normalizeTicker(ticker)
      
      // Verificar se já está processando
      if (logosProcessados.current.has(ticker)) {
        return
      }
      
      // Verificar se já tem logo no cache (usando snapshot)
      if (cacheSnapshot[normalizedTicker]) {
        return
      }

      // Marcar como processando
      logosProcessados.current.add(ticker)

      try {
        const logoUrl = await ativoService.getLogoUrl(normalizedTicker)
        if (logoUrl) {
          // Atualizar snapshot e estado incrementalmente
          cacheSnapshot[normalizedTicker] = logoUrl
          setLogosCache(prev => ({
            ...prev,
            [normalizedTicker]: logoUrl
          }))
        }
      } catch (e) {
        console.debug(`Erro ao buscar logo para ${ticker}:`, e)
      }
    }

    // Função para buscar cotação de um ticker
    const buscarCotacao = async (ticker: string) => {
      // Verificar se já está processando ou já tem preço
      if (tickersProcessados.current.has(ticker) || precosRanking[ticker]) {
        return
      }

      // Marcar como processando
      tickersProcessados.current.add(ticker)
      setTickersCarregando(prev => new Set([...prev, ticker]))

      try {
        const normalizedTicker = normalizeTicker(ticker)
        const precoData = await ativoService.getPrecoAtual(normalizedTicker)
        if (precoData?.preco) {
          // Atualizar estado incrementalmente
          setPrecosRanking(prev => ({
            ...prev,
            [ticker]: precoData.preco
          }))
        }
      } catch (e) {
        console.debug(`Erro ao buscar cotação para ${ticker}:`, e)
      } finally {
        setTickersCarregando(prev => {
          const next = new Set(prev)
          next.delete(ticker)
          return next
        })
      }
    }

    // Função para carregar logo e cotação de um ticker (em paralelo)
    const carregarDados = (ticker: string) => {
      // Buscar logo e cotação ao mesmo tempo
      buscarLogo(ticker)
      buscarCotacao(ticker)
    }

    // Intersection Observer para detectar linhas visíveis
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const ticker = entry.target.getAttribute('data-ticker')
            if (ticker) {
              // Carregar logo e cotação ao mesmo tempo
              carregarDados(ticker)
            }
          }
        })
      },
      {
        root: null,
        rootMargin: '100px', // Começar a carregar 100px antes de ficar visível
        threshold: 0.1
      }
    )

    // Observar todas as linhas da tabela após um pequeno delay para garantir renderização
    const timeoutId = setTimeout(() => {
      const rows = rowRefs.current
      rows.forEach((row) => {
        if (row) {
          observer.observe(row)
        }
      })
    }, 100)

    
    const primeirosTickers = todosTickers.slice(0, 10)
    primeirosTickers.forEach(ticker => {
      carregarDados(ticker)
    })

    return () => {
      clearTimeout(timeoutId)
      observer.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ranking, abaAtiva, secoesExpandidas.rankingAcoes, secoesExpandidas.rankingFiis, secoesExpandidas.rankingBdrs])

  // Função para calcular valor do dividendo baseado em DY e cotação
  const calcularValorDividendo = (dividendYield: number | undefined, cotacao: number | undefined): number | null => {
    if (!dividendYield || !cotacao) return null
    // DY está em percentual, então: (DY / 100) * Cotação
    return (dividendYield / 100) * cotacao
  }

  // Função para calcular DY baseado em valor do dividendo e cotação
  const calcularDividendYield = (valorDividendo: number | undefined, cotacao: number | undefined): number | null => {
    if (!valorDividendo || !cotacao || cotacao === 0) return null
    // DY = (Valor do Dividendo / Cotação) * 100
    return (valorDividendo / cotacao) * 100
  }

  const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ]

  const anos = Array.from({ length: 3 }, (_, i) => new Date().getFullYear() + i)

  const totalGeral = useMemo(() => {
    if (!agenda) return 0
    return (agenda.acoes?.total_estimado || 0) + 
           (agenda.fiis?.total_estimado || 0) + 
           (agenda.bdrs?.total_estimado || 0)
  }, [agenda])

  const totalItens = useMemo(() => {
    if (!agenda) return 0
    return (agenda.acoes?.total || 0) + 
           (agenda.fiis?.total || 0) + 
           (agenda.bdrs?.total || 0)
  }, [agenda])

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <div className="mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2 flex items-center gap-3">
            <Calendar className="w-8 h-8 text-primary" />
            Agenda de Dividendos
          </h1>
          <p className="text-muted-foreground">
            Calendário de dividendos do mercado brasileiro
          </p>
        </div>
      </div>

      {/* Abas */}
      <div className="flex gap-2 mb-6 border-b border-border">
        <button
          onClick={() => setAbaAtiva('agenda')}
          className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
            abaAtiva === 'agenda'
              ? 'text-primary border-primary'
              : 'text-muted-foreground border-transparent hover:text-foreground'
          }`}
        >
          <Calendar className="w-5 h-5 inline mr-2" />
          Agenda
        </button>
        <button
          onClick={() => setAbaAtiva('ranking')}
          className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
            abaAtiva === 'ranking'
              ? 'text-primary border-primary'
              : 'text-muted-foreground border-transparent hover:text-foreground'
          }`}
        >
          <Trophy className="w-5 h-5 inline mr-2" />
          Rankings
        </button>
      </div>

      {/* Filtros - apenas para agenda */}
      {abaAtiva === 'agenda' && (
      <div className="bg-card border border-border rounded-xl p-4 md:p-6 mb-6 shadow-lg">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-muted-foreground" />
            <span className="font-semibold text-foreground">Filtros:</span>
          </div>
          
          <div className="flex flex-wrap gap-3">
            <select
              value={mesSelecionado}
              onChange={(e) => setMesSelecionado(Number(e.target.value))}
              className="px-4 py-2 border border-border rounded-lg bg-background text-foreground"
              aria-label="Selecionar mês"
            >
              {meses.map((mes, idx) => (
                <option key={idx} value={idx + 1}>{mes}</option>
              ))}
            </select>

            <select
              value={anoSelecionado}
              onChange={(e) => setAnoSelecionado(Number(e.target.value))}
              className="px-4 py-2 border border-border rounded-lg bg-background text-foreground"
              aria-label="Selecionar ano"
            >
              {anos.map(ano => (
                <option key={ano} value={ano}>{ano}</option>
              ))}
            </select>

            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => toggleTipo('acoes')}
                className={`px-4 py-2 rounded-lg border transition-colors ${
                  tiposFiltro.includes('acoes')
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-foreground border-border hover:bg-muted'
                }`}
              >
                Ações
              </button>
              <button
                onClick={() => toggleTipo('fiis')}
                className={`px-4 py-2 rounded-lg border transition-colors ${
                  tiposFiltro.includes('fiis')
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-foreground border-border hover:bg-muted'
                }`}
              >
                FIIs
              </button>
              <button
                onClick={() => toggleTipo('bdrs')}
                className={`px-4 py-2 rounded-lg border transition-colors ${
                  tiposFiltro.includes('bdrs')
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-foreground border-border hover:bg-muted'
                }`}
              >
                BDRs
              </button>
            </div>

            <button
              onClick={() => refetch()}
              className="px-4 py-2 rounded-lg border border-border bg-background text-foreground hover:bg-muted transition-colors flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Atualizar
            </button>
          </div>
        </div>
      </div>
      )}

      {/* Resumo - apenas para agenda */}
      {abaAtiva === 'agenda' && agenda && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-card border border-border rounded-xl p-4 shadow-lg">
            <div className="text-sm text-muted-foreground mb-1">Total de Itens</div>
            <div className="text-2xl font-bold text-foreground">{totalItens}</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 shadow-lg">
            <div className="text-sm text-muted-foreground mb-1">Total Estimado</div>
            <div className="text-2xl font-bold text-primary">{formatCurrency(totalGeral)}</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 shadow-lg">
            <div className="text-sm text-muted-foreground mb-1">Ações</div>
            <div className="text-xl font-bold text-foreground">{agenda.acoes?.total || 0}</div>
            <div className="text-sm text-muted-foreground">{formatCurrency(agenda.acoes?.total_estimado || 0)}</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 shadow-lg">
            <div className="text-sm text-muted-foreground mb-1">FIIs</div>
            <div className="text-xl font-bold text-foreground">{agenda.fiis?.total || 0}</div>
            <div className="text-sm text-muted-foreground">{formatCurrency(agenda.fiis?.total_estimado || 0)}</div>
          </div>
        </div>
      )}

      {/* Conteúdo da aba Agenda */}
      {abaAtiva === 'agenda' && (
        <>
          {/* Loading */}
      {isLoading && (
        <div className="flex justify-center items-center py-12">
          <LoadingSpinner text="Buscando agenda de dividendos..." />
        </div>
      )}

      {/* Erro */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <div className="text-sm text-red-800 dark:text-red-200">
            <strong>Erro ao carregar agenda de dividendos:</strong>
            <br />
            {error instanceof Error ? error.message : String(error)}
            <br />
            <button
              onClick={() => refetch()}
              className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      )}

      {/* Tabelas por tipo */}
      {agenda && !isLoading && (
        <div className="space-y-6">
          {/* Ações */}
          {tiposFiltro.includes('acoes') && agenda.acoes && agenda.acoes.total > 0 && (
            <div className="bg-card border border-border rounded-xl p-4 md:p-6 shadow-lg">
              <div 
                className="flex items-center gap-3 mb-4 cursor-pointer hover:bg-muted/50 p-2 rounded-lg transition-colors"
                onClick={() => toggleSecao('acoes')}
              >
                {secoesExpandidas.acoes ? (
                  <ChevronUp className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                )}
                <TrendingUp className="w-6 h-6 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Ações</h2>
                <span className="text-sm text-muted-foreground">({agenda.acoes.total} itens)</span>
              </div>
              {secoesExpandidas.acoes && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">Ticker</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">Nome</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-foreground">Data-com</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-foreground">Data Pagamento</th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-foreground">Tipo</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-foreground">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agenda.acoes.dividendos.map((item, idx) => {
                      const tickerNormalizado = normalizeTicker(item.ticker)
                      const logoUrl = logosCache[tickerNormalizado]
                      return (
                      <tr key={idx} className="border-b border-border hover:bg-muted/50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {logoUrl && (
                              <img 
                                src={logoUrl} 
                                alt={item.nome}
                                className="w-6 h-6 rounded object-cover"
                                style={{ objectFit: 'cover' }}
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none'
                                }}
                              />
                            )}
                            <span className="font-mono font-semibold text-foreground">
                              {getDisplayTicker(item.ticker)}
                            </span>
                            <div className="flex gap-1 ml-2">
                              <button
                                onClick={() => handlePesquisaInterna(item.ticker)}
                                className="p-1.5 rounded hover:bg-muted transition-colors"
                                title="Ver detalhes do ativo"
                              >
                                <Search className="w-4 h-4 text-primary" />
                              </button>
                              <button
                                onClick={() => {
                                  setCalculadoraTicker(item.ticker)
                                  setCalculadoraValor(item.valor)
                                  setCalculadoraNome(item.nome || '')
                                  setCalculadoraOpen(true)
                                }}
                                className="p-1.5 rounded hover:bg-muted transition-colors"
                                title="Calcular dividendos"
                              >
                                <Calculator className="w-4 h-4 text-green-600 dark:text-green-400" />
                              </button>
                              <button
                                onClick={() => handleBuscaGoogle(item.ticker, item.nome)}
                                className="p-1.5 rounded hover:bg-muted transition-colors"
                                title="Buscar no Google"
                              >
                                <ExternalLink className="w-4 h-4 text-muted-foreground" />
                              </button>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-foreground">{item.nome || '-'}</td>
                        <td className="py-3 px-4 text-right text-foreground">
                          {formatDate(item.data_com)}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-foreground">
                          {formatDate(item.data_pagamento)}
                        </td>
                        <td className="py-3 px-4 text-center text-sm">
                          <span className={`px-2 py-1 rounded ${
                            item.tipo_provento === 'DIVIDENDO' 
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                              : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
                          }`}>
                            {item.tipo_provento}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-foreground">
                          {formatCurrency(item.valor)}
                        </td>
                      </tr>
                    )
                    })}
                  </tbody>
                </table>
              </div>
              )}
            </div>
          )}

          {/* FIIs */}
          {tiposFiltro.includes('fiis') && agenda.fiis && agenda.fiis.total > 0 && (
            <div className="bg-card border border-border rounded-xl p-4 md:p-6 shadow-lg">
              <div 
                className="flex items-center gap-3 mb-4 cursor-pointer hover:bg-muted/50 p-2 rounded-lg transition-colors"
                onClick={() => toggleSecao('fiis')}
              >
                {secoesExpandidas.fiis ? (
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <ChevronUp className="w-5 h-5 text-muted-foreground" />
                )}
                <DollarSign className="w-6 h-6 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Fundos Imobiliários (FIIs)</h2>
                <span className="text-sm text-muted-foreground">({agenda.fiis.total} itens)</span>
              </div>
              {secoesExpandidas.fiis && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">Ticker</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">Nome</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-foreground">Data-com</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-foreground">Data Pagamento</th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-foreground">Tipo</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-foreground">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agenda.fiis.dividendos.map((item, idx) => {
                      const tickerNormalizado = normalizeTicker(item.ticker)
                      const logoUrl = logosCache[tickerNormalizado]
                      return (
                      <tr key={idx} className="border-b border-border hover:bg-muted/50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {logoUrl && (
                              <img 
                                src={logoUrl} 
                                alt={item.nome}
                                className="w-6 h-6 rounded object-cover"
                                style={{ objectFit: 'cover' }}
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none'
                                }}
                              />
                            )}
                            <span className="font-mono font-semibold text-foreground">
                              {getDisplayTicker(item.ticker)}
                            </span>
                            <div className="flex gap-1 ml-2">
                              <button
                                onClick={() => handlePesquisaInterna(item.ticker)}
                                className="p-1.5 rounded hover:bg-muted transition-colors"
                                title="Ver detalhes do ativo"
                              >
                                <Search className="w-4 h-4 text-primary" />
                              </button>
                              <button
                                onClick={() => {
                                  setCalculadoraTicker(item.ticker)
                                  setCalculadoraValor(item.valor)
                                  setCalculadoraNome(item.nome || '')
                                  setCalculadoraOpen(true)
                                }}
                                className="p-1.5 rounded hover:bg-muted transition-colors"
                                title="Calcular dividendos"
                              >
                                <Calculator className="w-4 h-4 text-green-600 dark:text-green-400" />
                              </button>
                              <button
                                onClick={() => handleBuscaGoogle(item.ticker, item.nome)}
                                className="p-1.5 rounded hover:bg-muted transition-colors"
                                title="Buscar no Google"
                              >
                                <ExternalLink className="w-4 h-4 text-muted-foreground" />
                              </button>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-foreground">{item.nome || '-'}</td>
                        <td className="py-3 px-4 text-right text-foreground">
                          {formatDate(item.data_com)}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-foreground">
                          {formatDate(item.data_pagamento)}
                        </td>
                        <td className="py-3 px-4 text-center text-sm">
                          <span className={`px-2 py-1 rounded ${
                            item.tipo_provento === 'DIVIDENDO' 
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                              : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
                          }`}>
                            {item.tipo_provento}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-foreground">
                          {formatCurrency(item.valor)}
                        </td>
                      </tr>
                      )
                    })} 
                  </tbody>
                </table>
              </div>
              )}
            </div>
          )}

          {/* BDRs */}
          {tiposFiltro.includes('bdrs') && agenda.bdrs && agenda.bdrs.total > 0 && (
            <div className="bg-card border border-border rounded-xl p-4 md:p-6 shadow-lg">
              <div 
                className="flex items-center gap-3 mb-4 cursor-pointer hover:bg-muted/50 p-2 rounded-lg transition-colors"
                onClick={() => toggleSecao('bdrs')}
              >
                {secoesExpandidas.bdrs ? (
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <ChevronUp className="w-5 h-5 text-muted-foreground" />
                )}
                <TrendingUp className="w-6 h-6 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">BDRs</h2>
                <span className="text-sm text-muted-foreground">({agenda.bdrs.total} itens)</span>
              </div>
              {secoesExpandidas.bdrs && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">Ticker</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">Nome</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-foreground">Data-com</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-foreground">Data Pagamento</th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-foreground">Tipo</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-foreground">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agenda.bdrs.dividendos.map((item, idx) => {
                      const tickerNormalizado = normalizeTicker(item.ticker)
                      const logoUrl = logosCache[tickerNormalizado]
                      return (
                      <tr key={idx} className="border-b border-border hover:bg-muted/50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {logoUrl && (
                              <img 
                                src={logoUrl} 
                                alt={item.nome}
                                className="w-6 h-6 rounded object-cover"
                                style={{ objectFit: 'cover' }}
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none'
                                }}
                              />
                            )}
                            <span className="font-mono font-semibold text-foreground">
                              {getDisplayTicker(item.ticker)}
                            </span>
                            <div className="flex gap-1 ml-2">
                              <button
                                onClick={() => handlePesquisaInterna(item.ticker)}
                                className="p-1.5 rounded hover:bg-muted transition-colors"
                                title="Ver detalhes do ativo"
                              >
                                <Search className="w-4 h-4 text-primary" />
                              </button>
                              <button
                                onClick={() => {
                                  setCalculadoraTicker(item.ticker)
                                  setCalculadoraValor(item.valor)
                                  setCalculadoraNome(item.nome || '')
                                  setCalculadoraOpen(true)
                                }}
                                className="p-1.5 rounded hover:bg-muted transition-colors"
                                title="Calcular dividendos"
                              >
                                <Calculator className="w-4 h-4 text-green-600 dark:text-green-400" />
                              </button>
                              <button
                                onClick={() => handleBuscaGoogle(item.ticker, item.nome)}
                                className="p-1.5 rounded hover:bg-muted transition-colors"
                                title="Buscar no Google"
                              >
                                <ExternalLink className="w-4 h-4 text-muted-foreground" />
                              </button>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-foreground">{item.nome || '-'}</td>
                        <td className="py-3 px-4 text-right text-foreground">
                          {formatDate(item.data_com)}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-foreground">
                          {formatDate(item.data_pagamento)}
                        </td>
                        <td className="py-3 px-4 text-center text-sm">
                          <span className={`px-2 py-1 rounded ${
                            item.tipo_provento === 'DIVIDENDO' 
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                              : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
                          }`}>
                            {item.tipo_provento}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-foreground">
                          {formatCurrency(item.valor)}
                        </td>
                      </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              )}
            </div>
          )}

          {/* Mensagem quando não há dados */}
          {totalItens === 0 && !isLoading && (
            <div className="bg-card border border-border rounded-xl p-8 text-center">
              <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                Nenhum dividendo encontrado para {meses[mesSelecionado - 1]} de {anoSelecionado}
              </p>
            </div>
          )}
        </div>
      )}
      </>)}

      {/* Conteúdo da aba Rankings */}
      {abaAtiva === 'ranking' && (
        <>
          {/* Loading */}
          {loadingRanking && (
            <div className="flex justify-center items-center py-12">
              <LoadingSpinner text="Buscando rankings de dividendos..." />
            </div>
          )}

          {/* Erro */}
          {errorRanking && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
              <div className="text-sm text-red-800 dark:text-red-200">
                <strong>Erro ao carregar rankings de dividendos:</strong>
                <br />
                {errorRanking instanceof Error ? errorRanking.message : String(errorRanking)}
                <br />
                <button
                  onClick={() => refetchRanking()}
                  className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                >
                  Tentar novamente
                </button>
              </div>
            </div>
          )}

          {/* Rankings */}
          {ranking && !loadingRanking && (
            <div className="space-y-6">
              {/* Ações */}
              {ranking.acoes && ranking.acoes.total > 0 && (
                <div className="bg-card border border-border rounded-xl p-4 md:p-6 shadow-lg">
                  <div 
                    className="flex items-center gap-3 mb-4 cursor-pointer hover:bg-muted/50 p-2 rounded-lg transition-colors"
                    onClick={() => toggleSecao('rankingAcoes')}
                  >
                    {secoesExpandidas.rankingAcoes ? (
                      <ChevronUp className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    )}
                    <TrendingUp className="w-6 h-6 text-primary" />
                    <h2 className="text-xl font-semibold text-foreground">Ranking de Ações</h2>
                    <span className="text-sm text-muted-foreground">({ranking.acoes.total} itens)</span>
                  </div>
                  {secoesExpandidas.rankingAcoes && (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-center py-3 px-4 text-sm font-semibold text-foreground">Posição</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">Ticker</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">Nome</th>
                          <th className="text-right py-3 px-4 text-sm font-semibold text-foreground">Cotação</th>
                          <th className="text-right py-3 px-4 text-sm font-semibold text-foreground">Dividend Yield</th>
                          <th className="text-right py-3 px-4 text-sm font-semibold text-foreground">Valor Dividendo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ranking.acoes.ranking.map((item, idx) => {
                          const tickerNormalizado = normalizeTicker(item.ticker)
                          const logoUrl = logosCache[tickerNormalizado]
                          return (
                            <tr 
                              key={idx} 
                              ref={(el) => {
                                if (el) {
                                  rowRefs.current.set(item.ticker, el)
                                } else {
                                  rowRefs.current.delete(item.ticker)
                                }
                              }}
                              data-ticker={item.ticker}
                              className="border-b border-border hover:bg-muted/50 transition-colors"
                            >
                              <td className="py-3 px-4 text-center font-bold text-foreground">
                                <span className={`px-2 py-1 rounded ${
                                  item.posicao <= 3 
                                    ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200'
                                    : 'text-muted-foreground'
                                }`}>
                                  #{item.posicao}
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  {logoUrl && (
                                    <img 
                                      src={logoUrl} 
                                      alt={item.nome}
                                      className="w-6 h-6 rounded object-cover"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none'
                                      }}
                                    />
                                  )}
                                  <span className="font-mono font-semibold text-foreground">
                                    {getDisplayTicker(item.ticker)}
                                  </span>
                                  <div className="flex gap-1 ml-2">
                                    <button
                                      onClick={() => handlePesquisaInterna(item.ticker)}
                                      className="p-1.5 rounded hover:bg-muted transition-colors"
                                      title="Ver detalhes do ativo"
                                    >
                                      <Search className="w-4 h-4 text-primary" />
                                    </button>
                                    <button
                                      onClick={() => handleBuscaGoogle(item.ticker, item.nome)}
                                      className="p-1.5 rounded hover:bg-muted transition-colors"
                                      title="Buscar no Google"
                                    >
                                      <ExternalLink className="w-4 h-4 text-muted-foreground" />
                                    </button>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-foreground">{item.nome || '-'}</td>
                              <td className="py-3 px-4 text-right font-semibold text-foreground">
                                {precosRanking[item.ticker] ? (
                                  formatCurrency(precosRanking[item.ticker])
                                ) : tickersCarregando.has(item.ticker) ? (
                                  <span className="text-muted-foreground text-xs">Carregando...</span>
                                ) : (
                                  '-'
                                )}
                              </td>
                              <td className="py-3 px-4 text-right font-semibold text-foreground">
                                {(() => {
                                  const cotacao = precosRanking[item.ticker]
                                  const valorDividendo = item.valor_dividendo
                                  // Se temos cotação e valor do dividendo, calcular DY
                                  const dyCalculado = calcularDividendYield(valorDividendo, cotacao)
                                  // Priorizar DY calculado se tiver cotação, senão usar o valor original
                                  if (dyCalculado !== null) {
                                    return `${dyCalculado.toFixed(2)}%`
                                  }
                                  return item.dividend_yield ? `${item.dividend_yield.toFixed(2)}%` : '-'
                                })()}
                              </td>
                              <td className="py-3 px-4 text-right font-semibold text-foreground">
                                {(() => {
                                  const cotacao = precosRanking[item.ticker]
                                  const valorCalculado = calcularValorDividendo(item.dividend_yield, cotacao)
                                  // Priorizar valor calculado se tiver cotação, senão usar o valor original
                                  if (valorCalculado !== null) {
                                    return formatCurrency(valorCalculado)
                                  }
                                  return item.valor_dividendo ? formatCurrency(item.valor_dividendo) : '-'
                                })()}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  )}
                </div>
              )}

              {/* FIIs */}
              {ranking.fiis && ranking.fiis.total > 0 && (
                <div className="bg-card border border-border rounded-xl p-4 md:p-6 shadow-lg">
                  <div 
                    className="flex items-center gap-3 mb-4 cursor-pointer hover:bg-muted/50 p-2 rounded-lg transition-colors"
                    onClick={() => toggleSecao('rankingFiis')}
                  >
                    {secoesExpandidas.rankingFiis ? (
                      <ChevronUp className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    )}
                    <DollarSign className="w-6 h-6 text-primary" />
                    <h2 className="text-xl font-semibold text-foreground">Ranking de FIIs</h2>
                    <span className="text-sm text-muted-foreground">({ranking.fiis.total} itens)</span>
                  </div>
                  {secoesExpandidas.rankingFiis && (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-center py-3 px-4 text-sm font-semibold text-foreground">Posição</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">Ticker</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">Nome</th>
                          <th className="text-right py-3 px-4 text-sm font-semibold text-foreground">Cotação</th>
                          <th className="text-right py-3 px-4 text-sm font-semibold text-foreground">Dividend Yield</th>
                          <th className="text-right py-3 px-4 text-sm font-semibold text-foreground">Valor Dividendo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ranking.fiis.ranking.map((item, idx) => {
                          const tickerNormalizado = normalizeTicker(item.ticker)
                          const logoUrl = logosCache[tickerNormalizado]
                          return (
                            <tr 
                              key={idx} 
                              ref={(el) => {
                                if (el) {
                                  rowRefs.current.set(item.ticker, el)
                                } else {
                                  rowRefs.current.delete(item.ticker)
                                }
                              }}
                              data-ticker={item.ticker}
                              className="border-b border-border hover:bg-muted/50 transition-colors"
                            >
                              <td className="py-3 px-4 text-center font-bold text-foreground">
                                <span className={`px-2 py-1 rounded ${
                                  item.posicao <= 3 
                                    ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200'
                                    : 'text-muted-foreground'
                                }`}>
                                  #{item.posicao}
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  {logoUrl && (
                                    <img 
                                      src={logoUrl} 
                                      alt={item.nome}
                                      className="w-6 h-6 rounded object-cover"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none'
                                      }}
                                    />
                                  )}
                                  <span className="font-mono font-semibold text-foreground">
                                    {getDisplayTicker(item.ticker)}
                                  </span>
                                  <div className="flex gap-1 ml-2">
                                    <button
                                      onClick={() => handlePesquisaInterna(item.ticker)}
                                      className="p-1.5 rounded hover:bg-muted transition-colors"
                                      title="Ver detalhes do ativo"
                                    >
                                      <Search className="w-4 h-4 text-primary" />
                                    </button>
                                    <button
                                      onClick={() => handleBuscaGoogle(item.ticker, item.nome)}
                                      className="p-1.5 rounded hover:bg-muted transition-colors"
                                      title="Buscar no Google"
                                    >
                                      <ExternalLink className="w-4 h-4 text-muted-foreground" />
                                    </button>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-foreground">{item.nome || '-'}</td>
                              <td className="py-3 px-4 text-right font-semibold text-foreground">
                                {precosRanking[item.ticker] ? (
                                  formatCurrency(precosRanking[item.ticker])
                                ) : tickersCarregando.has(item.ticker) ? (
                                  <span className="text-muted-foreground text-xs">Carregando...</span>
                                ) : (
                                  '-'
                                )}
                              </td>
                              <td className="py-3 px-4 text-right font-semibold text-foreground">
                                {(() => {
                                  const cotacao = precosRanking[item.ticker]
                                  const valorDividendo = item.valor_dividendo
                                  // Se temos cotação e valor do dividendo, calcular DY
                                  const dyCalculado = calcularDividendYield(valorDividendo, cotacao)
                                  // Priorizar DY calculado se tiver cotação, senão usar o valor original
                                  if (dyCalculado !== null) {
                                    return `${dyCalculado.toFixed(2)}%`
                                  }
                                  return item.dividend_yield ? `${item.dividend_yield.toFixed(2)}%` : '-'
                                })()}
                              </td>
                              <td className="py-3 px-4 text-right font-semibold text-foreground">
                                {(() => {
                                  const cotacao = precosRanking[item.ticker]
                                  const valorCalculado = calcularValorDividendo(item.dividend_yield, cotacao)
                                  // Priorizar valor calculado se tiver cotação, senão usar o valor original
                                  if (valorCalculado !== null) {
                                    return formatCurrency(valorCalculado)
                                  }
                                  return item.valor_dividendo ? formatCurrency(item.valor_dividendo) : '-'
                                })()}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  )}
                </div>
              )}

              {/* BDRs */}
              {ranking.bdrs && ranking.bdrs.total > 0 && (
                <div className="bg-card border border-border rounded-xl p-4 md:p-6 shadow-lg">
                  <div 
                    className="flex items-center gap-3 mb-4 cursor-pointer hover:bg-muted/50 p-2 rounded-lg transition-colors"
                    onClick={() => toggleSecao('rankingBdrs')}
                  >
                    {secoesExpandidas.rankingBdrs ? (
                      <ChevronUp className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    )}
                    <TrendingUp className="w-6 h-6 text-primary" />
                    <h2 className="text-xl font-semibold text-foreground">Ranking de BDRs</h2>
                    <span className="text-sm text-muted-foreground">({ranking.bdrs.total} itens)</span>
                  </div>
                  {secoesExpandidas.rankingBdrs && (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-center py-3 px-4 text-sm font-semibold text-foreground">Posição</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">Ticker</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">Nome</th>
                          <th className="text-right py-3 px-4 text-sm font-semibold text-foreground">Cotação</th>
                          <th className="text-right py-3 px-4 text-sm font-semibold text-foreground">Dividend Yield</th>
                          <th className="text-right py-3 px-4 text-sm font-semibold text-foreground">Valor Dividendo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ranking.bdrs.ranking.map((item, idx) => {
                          const tickerNormalizado = normalizeTicker(item.ticker)
                          const logoUrl = logosCache[tickerNormalizado]
                          return (
                            <tr 
                              key={idx} 
                              ref={(el) => {
                                if (el) {
                                  rowRefs.current.set(item.ticker, el)
                                } else {
                                  rowRefs.current.delete(item.ticker)
                                }
                              }}
                              data-ticker={item.ticker}
                              className="border-b border-border hover:bg-muted/50 transition-colors"
                            >
                              <td className="py-3 px-4 text-center font-bold text-foreground">
                                <span className={`px-2 py-1 rounded ${
                                  item.posicao <= 3 
                                    ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200'
                                    : 'text-muted-foreground'
                                }`}>
                                  #{item.posicao}
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  {logoUrl && (
                                    <img 
                                      src={logoUrl} 
                                      alt={item.nome}
                                      className="w-6 h-6 rounded object-cover"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none'
                                      }}
                                    />
                                  )}
                                  <span className="font-mono font-semibold text-foreground">
                                    {getDisplayTicker(item.ticker)}
                                  </span>
                                  <div className="flex gap-1 ml-2">
                                    <button
                                      onClick={() => handlePesquisaInterna(item.ticker)}
                                      className="p-1.5 rounded hover:bg-muted transition-colors"
                                      title="Ver detalhes do ativo"
                                    >
                                      <Search className="w-4 h-4 text-primary" />
                                    </button>
                                    <button
                                      onClick={() => handleBuscaGoogle(item.ticker, item.nome)}
                                      className="p-1.5 rounded hover:bg-muted transition-colors"
                                      title="Buscar no Google"
                                    >
                                      <ExternalLink className="w-4 h-4 text-muted-foreground" />
                                    </button>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-foreground">{item.nome || '-'}</td>
                              <td className="py-3 px-4 text-right font-semibold text-foreground">
                                {precosRanking[item.ticker] ? (
                                  formatCurrency(precosRanking[item.ticker])
                                ) : tickersCarregando.has(item.ticker) ? (
                                  <span className="text-muted-foreground text-xs">Carregando...</span>
                                ) : (
                                  '-'
                                )}
                              </td>
                              <td className="py-3 px-4 text-right font-semibold text-foreground">
                                {(() => {
                                  const cotacao = precosRanking[item.ticker]
                                  const valorDividendo = item.valor_dividendo
                                  // Se temos cotação e valor do dividendo, calcular DY
                                  const dyCalculado = calcularDividendYield(valorDividendo, cotacao)
                                  // Priorizar DY calculado se tiver cotação, senão usar o valor original
                                  if (dyCalculado !== null) {
                                    return `${dyCalculado.toFixed(2)}%`
                                  }
                                  return item.dividend_yield ? `${item.dividend_yield.toFixed(2)}%` : '-'
                                })()}
                              </td>
                              <td className="py-3 px-4 text-right font-semibold text-foreground">
                                {(() => {
                                  const cotacao = precosRanking[item.ticker]
                                  const valorCalculado = calcularValorDividendo(item.dividend_yield, cotacao)
                                  // Priorizar valor calculado se tiver cotação, senão usar o valor original
                                  if (valorCalculado !== null) {
                                    return formatCurrency(valorCalculado)
                                  }
                                  return item.valor_dividendo ? formatCurrency(item.valor_dividendo) : '-'
                                })()}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  )}
                </div>
              )}

              {/* Mensagem quando não há dados */}
              {(!ranking.acoes || ranking.acoes.total === 0) && 
               (!ranking.fiis || ranking.fiis.total === 0) && 
               (!ranking.bdrs || ranking.bdrs.total === 0) && 
               !loadingRanking && (
                <div className="bg-card border border-border rounded-xl p-8 text-center">
                  <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    Nenhum ranking encontrado
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Modal Calculadora de Dividendos */}
      <CalculadoraDividendosModal
        isOpen={calculadoraOpen}
        onClose={() => setCalculadoraOpen(false)}
        ticker={calculadoraTicker}
        valorDividendo={calculadoraValor}
        nomeAtivo={calculadoraNome}
      />
    </div>
  )
}

