import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Calendar, TrendingUp, DollarSign, Filter, RefreshCw, Search, ExternalLink, ChevronDown, ChevronUp, Trophy, Calculator } from 'lucide-react'
import { dividendosService, ativoService } from '../services/api'
import { formatCurrency } from '../utils/formatters'
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

  // Carregar logos dos ativos (ranking)
  useQuery({
    queryKey: ['logos-ranking', ranking?.acoes?.total, ranking?.fiis?.total, ranking?.bdrs?.total],
    queryFn: async () => {
      if (!ranking) return {}
      
      const todosTickers = [
        ...(ranking.acoes?.ranking?.map(r => r.ticker) || []),
        ...(ranking.fiis?.ranking?.map(r => r.ticker) || []),
        ...(ranking.bdrs?.ranking?.map(r => r.ticker) || [])
      ]
      
      if (todosTickers.length === 0) return {}
      
      const tickersNormalizados = todosTickers.map(t => normalizeTicker(t))
      const logos = await ativoService.getLogosBatch(tickersNormalizados)
      setLogosCache(prev => ({ ...prev, ...logos }))
      return logos
    },
    enabled: !!ranking && abaAtiva === 'ranking',
    staleTime: 60 * 60 * 1000, // 1 hora
  })

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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2 flex items-center gap-3">
              <Calendar className="w-8 h-8 text-primary" />
              Agenda de Dividendos
            </h1>
            <p className="text-muted-foreground">
              Calendário de dividendos do mercado brasileiro
            </p>
          </div>
          <button
            onClick={() => {
              setCalculadoraTicker('')
              setCalculadoraValor(undefined)
              setCalculadoraNome('')
              setCalculadoraOpen(true)
            }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors shadow-lg"
            title="Calculadora de Dividendos"
          >
            <Calculator className="w-5 h-5" />
            <span className="hidden md:inline">Calculadora</span>
          </button>
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
                                className="w-6 h-6 rounded object-contain"
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
                          {new Date(item.data_com).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-foreground">
                          {new Date(item.data_pagamento).toLocaleDateString('pt-BR')}
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
                                className="w-6 h-6 rounded object-contain"
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
                          {new Date(item.data_com).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-foreground">
                          {new Date(item.data_pagamento).toLocaleDateString('pt-BR')}
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
                                className="w-6 h-6 rounded object-contain"
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
                          {new Date(item.data_com).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-foreground">
                          {new Date(item.data_pagamento).toLocaleDateString('pt-BR')}
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
                          <th className="text-right py-3 px-4 text-sm font-semibold text-foreground">Dividend Yield</th>
                          <th className="text-right py-3 px-4 text-sm font-semibold text-foreground">Valor Dividendo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ranking.acoes.ranking.map((item, idx) => {
                          const tickerNormalizado = normalizeTicker(item.ticker)
                          const logoUrl = logosCache[tickerNormalizado]
                          return (
                            <tr key={idx} className="border-b border-border hover:bg-muted/50 transition-colors">
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
                                      className="w-6 h-6 rounded object-contain"
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
                                {item.dividend_yield ? `${item.dividend_yield.toFixed(2)}%` : '-'}
                              </td>
                              <td className="py-3 px-4 text-right font-semibold text-foreground">
                                {item.valor_dividendo ? formatCurrency(item.valor_dividendo) : '-'}
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
                          <th className="text-right py-3 px-4 text-sm font-semibold text-foreground">Dividend Yield</th>
                          <th className="text-right py-3 px-4 text-sm font-semibold text-foreground">Valor Dividendo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ranking.fiis.ranking.map((item, idx) => {
                          const tickerNormalizado = normalizeTicker(item.ticker)
                          const logoUrl = logosCache[tickerNormalizado]
                          return (
                            <tr key={idx} className="border-b border-border hover:bg-muted/50 transition-colors">
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
                                      className="w-6 h-6 rounded object-contain"
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
                                {item.dividend_yield ? `${item.dividend_yield.toFixed(2)}%` : '-'}
                              </td>
                              <td className="py-3 px-4 text-right font-semibold text-foreground">
                                {item.valor_dividendo ? formatCurrency(item.valor_dividendo) : '-'}
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
                          <th className="text-right py-3 px-4 text-sm font-semibold text-foreground">Dividend Yield</th>
                          <th className="text-right py-3 px-4 text-sm font-semibold text-foreground">Valor Dividendo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ranking.bdrs.ranking.map((item, idx) => {
                          const tickerNormalizado = normalizeTicker(item.ticker)
                          const logoUrl = logosCache[tickerNormalizado]
                          return (
                            <tr key={idx} className="border-b border-border hover:bg-muted/50 transition-colors">
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
                                      className="w-6 h-6 rounded object-contain"
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
                                {item.dividend_yield ? `${item.dividend_yield.toFixed(2)}%` : '-'}
                              </td>
                              <td className="py-3 px-4 text-right font-semibold text-foreground">
                                {item.valor_dividendo ? formatCurrency(item.valor_dividendo) : '-'}
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

