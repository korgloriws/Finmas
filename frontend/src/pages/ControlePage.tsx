import { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { useSearchParams } from 'react-router-dom'

import { 
  DollarSign, TrendingDown, BarChart3, 
  Eye, EyeOff, TrendingUp, AlertTriangle, 
  ArrowUpRight, ArrowDownRight,
  ChefHat, CreditCard, Calendar
} from 'lucide-react'
import {
  controleService,
  cartaoService,
  marmitasService,
  fetchDespesasControleComFallback,
  fetchReceitasDespesasComFallback,
} from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import HelpTips from '../components/HelpTips'
// Lazy loading dos componentes de controle
import { lazy, Suspense } from 'react'
import LoadingSpinner from '../components/LoadingSpinner'

const ControleAlimentacaoTab = lazy(() => import('../components/controle/ControleAlimentacaoTab'))
const ControleReceitaTab = lazy(() => import('../components/controle/ControleReceitaTab'))
const ControleDespesaTab = lazy(() => import('../components/controle/ControleDespesaTab'))
const ControleCartaoTab = lazy(() => import('../components/controle/ControleCartaoTab'))
import { formatCurrency } from '../utils/formatters'
import { ControleCategoriasProvider, useControleCategorias } from '../contexts/ControleCategoriasContext'
import { EvolucaoFinanceira, ReceitasDespesas } from '../types'
// Lazy loading de gráficos pesados
import { 
  ComposedChart,
  BarChart,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Line, 
  Cell, 
  Area, 
  Bar,
  Legend
} from '../components/LazyChart'
import DistribuicaoCarteiraECharts from '../components/home/DistribuicaoCarteiraECharts'

function ControlePageContent() {
  const { user } = useAuth()
  const { resolveCategoria } = useControleCategorias()
  const [searchParams, setSearchParams] = useSearchParams()
  
  const getNomeMes = (mes: number) => {
    return new Date(2024, mes - 1).toLocaleDateString('pt-BR', { month: 'long' })
  }

  const [filtroMes, setFiltroMes] = useState<string>(String(new Date().getMonth() + 1).padStart(2, '0'))
  const [filtroAno, setFiltroAno] = useState<string>(String(new Date().getFullYear()))
  const [ocultarValores, setOcultarValores] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [abrirMesPicker, setAbrirMesPicker] = useState(false)
  const [periodoEvolucao, setPeriodoEvolucao] = useState<'3m' | '6m' | '12m'>('6m')
  const [carregarComparacao, setCarregarComparacao] = useState(false)
  const [carregarDadosSecundarios, setCarregarDadosSecundarios] = useState(false)
  
  const tabsValidas = ['financeiro', 'receitas', 'despesas', 'alimentacao', 'cartoes'] as const
  type AbaControle = typeof tabsValidas[number]
  const [abaAtiva, setAbaAtiva] = useState<AbaControle>(() => {
    const tab = searchParams.get('tab')
    return (tabsValidas as readonly string[]).includes(tab || '') ? (tab as AbaControle) : 'financeiro'
  })

  useEffect(() => {
    const tab = searchParams.get('tab')
    const abaUrl = (tabsValidas as readonly string[]).includes(tab || '') ? (tab as AbaControle) : 'financeiro'
    if (abaUrl !== abaAtiva) setAbaAtiva(abaUrl)
  }, [searchParams, abaAtiva])

  useEffect(() => {
    if (!user || abaAtiva !== 'financeiro') {
      setCarregarComparacao(false)
      setCarregarDadosSecundarios(false)
      return
    }

    // Despesas/cartões alimentam os gráficos da aba — carregar cedo.
    setCarregarDadosSecundarios(true)
    const timerComparacao = window.setTimeout(() => setCarregarComparacao(true), 300)

    return () => {
      window.clearTimeout(timerComparacao)
    }
  }, [user, abaAtiva, filtroMes, filtroAno])

  const selecionarAba = (aba: AbaControle) => {
    setAbaAtiva(aba)
    const next = new URLSearchParams(searchParams)
    next.set('tab', aba)
    setSearchParams(next, { replace: true })
  }

  useEffect(() => {
    const handleError = () => {
      setHasError(true)
    }
    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', () => {
      setHasError(true)
    })
    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', () => {
        setHasError(true)
      })
    }
  }, [])


  // SEGURANCA: Incluir user em todas as queryKeys para isolamento entre usuários
  // Os 3 endpoints abaixo são rápidos (SQLite local + cache em memória), então
  // não há ganho de batch — o limitador global de 3 GETs paralelos já cobre.
  // O cancelamento por NavigationGuard funciona normalmente em cada um.
  const { data: receitasDespesas } = useQuery<ReceitasDespesas>({
    queryKey: ['receitas-despesas', user, filtroMes, filtroAno],
    queryFn: ({ signal }) => fetchReceitasDespesasComFallback(filtroMes, filtroAno, { signal }),
    enabled: !!user && abaAtiva === 'financeiro',
    retry: 1,
    refetchOnWindowFocus: false,
    staleTime: 1 * 60 * 1000, // 1 minuto
  })

  const { data: saldo } = useQuery<{ saldo: number }>({
    queryKey: ['saldo', user, filtroMes, filtroAno],
    queryFn: () => controleService.getSaldo(filtroMes, filtroAno),
    enabled: !!user && abaAtiva === 'financeiro',
    retry: 1,
    refetchOnWindowFocus: false,
    staleTime: 1 * 60 * 1000, // 1 minuto
  })

  const { data: dadosGraficoEvolucao } = useQuery<EvolucaoFinanceira[]>({
    queryKey: ['evolucao-financeira', user, filtroMes, filtroAno, periodoEvolucao],
    queryFn: () => controleService.getEvolucaoFinanceira(filtroMes, filtroAno),
    enabled: !!user && abaAtiva === 'financeiro',
    retry: 1,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // 5 minutos
  })

  const { data: dadosComparacao } = useQuery<EvolucaoFinanceira[]>({
    queryKey: ['evolucao-financeira-comparacao', user, filtroMes, filtroAno],
    queryFn: () => {
      const mesAnterior = parseInt(filtroMes) - 1
      const anoAnterior = mesAnterior === 0 ? parseInt(filtroAno) - 1 : parseInt(filtroAno)
      const mesAnteriorStr = mesAnterior === 0 ? '12' : mesAnterior.toString().padStart(2, '0')
      return controleService.getEvolucaoFinanceira(mesAnteriorStr, anoAnterior.toString())
    },
    enabled: !!user && abaAtiva === 'financeiro' && carregarComparacao,
    retry: 1,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // 5 minutos
  })

  // Dados de abas específicas: sob demanda, com preload leve na aba financeiro.
  const { data: despesasMes, isLoading: despesasLoading } = useQuery({
    queryKey: ['controle-despesas-agregado', user, filtroMes, filtroAno],
    queryFn: ({ signal }) => fetchDespesasControleComFallback(filtroMes, filtroAno, { signal }),
    enabled: !!user && (abaAtiva === 'despesas' || (abaAtiva === 'financeiro' && carregarDadosSecundarios)),
    retry: 2,
    refetchOnWindowFocus: false,
    refetchOnMount: abaAtiva === 'despesas' || abaAtiva === 'financeiro' ? 'always' : false,
    staleTime: 2 * 60 * 1000,
  })

  const outros = despesasMes?.outros

  const { data: cartoes, isLoading: cartoesLoading, isFetching: cartoesFetching } = useQuery({
    queryKey: ['cartoes-cadastrados', user, filtroMes, filtroAno],
    queryFn: () => cartaoService.getCartoesCadastrados(filtroMes, filtroAno),
    enabled: !!user && (abaAtiva === 'cartoes' || (abaAtiva === 'financeiro' && carregarDadosSecundarios)),
    retry: 1,
    refetchOnWindowFocus: false,
    staleTime: 2 * 60 * 1000,
  })

  const { data: marmitas } = useQuery({
    queryKey: ['marmitas', user, filtroMes, filtroAno],
    queryFn: () => marmitasService.getMarmitas(parseInt(filtroMes), parseInt(filtroAno)),
    enabled: !!user && (abaAtiva === 'alimentacao' || (abaAtiva === 'financeiro' && carregarDadosSecundarios)),
    retry: 1,
    refetchOnWindowFocus: false,
    staleTime: 2 * 60 * 1000, // 2 minutos
  })



  const comparacaoMensal = useMemo(() => {
    if (!Array.isArray(dadosGraficoEvolucao) || !Array.isArray(dadosComparacao) || dadosGraficoEvolucao.length === 0 || dadosComparacao.length === 0) return null
    
    const totalReceitasAtual = dadosGraficoEvolucao.reduce((sum, item) => sum + (item?.receitas || 0), 0)
    const totalDespesasAtual = dadosGraficoEvolucao.reduce((sum, item) => sum + (item?.despesas || 0), 0)
    const saldoAtual = totalReceitasAtual - totalDespesasAtual
    
    const totalReceitasAnterior = dadosComparacao.reduce((sum, item) => sum + (item?.receitas || 0), 0)
    const totalDespesasAnterior = dadosComparacao.reduce((sum, item) => sum + (item?.despesas || 0), 0)
    const saldoAnterior = totalReceitasAnterior - totalDespesasAnterior
    
    return {
      receitas: {
        atual: totalReceitasAtual,
        anterior: totalReceitasAnterior,
        variacao: totalReceitasAnterior > 0 ? ((totalReceitasAtual - totalReceitasAnterior) / totalReceitasAnterior) * 100 : 0
      },
      despesas: {
        atual: totalDespesasAtual,
        anterior: totalDespesasAnterior,
        variacao: totalDespesasAnterior > 0 ? ((totalDespesasAtual - totalDespesasAnterior) / totalDespesasAnterior) * 100 : 0
      },
      saldo: {
        atual: saldoAtual,
        anterior: saldoAnterior,
        variacao: saldoAnterior !== 0 ? ((saldoAtual - saldoAnterior) / Math.abs(saldoAnterior)) * 100 : 0
      }
    }
  }, [dadosGraficoEvolucao, dadosComparacao])

  const dadosGraficoReceitasDespesas = useMemo(() => [
    { name: 'Receitas', value: receitasDespesas?.receitas || 0, fill: '#10b981' },
    { name: 'Despesas', value: receitasDespesas?.despesas || 0, fill: '#ef4444' }
  ], [receitasDespesas])
  const receitasValor = receitasDespesas?.receitas ?? 0
  const despesasValor = receitasDespesas?.despesas ?? 0

  // Fluxo de caixa: apenas despesas registradas (aba Despesas / outros_gastos)
  const despesasUnificadas = useMemo(() => {
    const outrosArray = Array.isArray(outros) ? outros : []
    return outrosArray.map((item) => ({ ...item, fonte: 'outro' as const }))
  }, [outros])


  const totaisPorCategoria = useMemo(() => {
    const acc: Record<string, number> = {}
    despesasUnificadas.forEach((d) => {
      const categoria = d.categoria || 'outros'
      acc[categoria] = (acc[categoria] || 0) + (d.valor || 0)
    })
    return Object.entries(acc)
      .map(([name, value]) => ({
        name,
        value,
        categoria: resolveCategoria(name),
      }))
      .sort((a, b) => b.value - a.value)
  }, [despesasUnificadas, resolveCategoria])


  const totaisPorTipo = useMemo(() => {
    const result = { fixo: 0, variavel: 0 }
    despesasUnificadas.forEach((d) => {
      const t = String(d.tipo || '').toLowerCase().trim()
      const key = (t === 'fixo' || t === 'fixa') ? 'fixo' : 'variavel'
      result[key as 'fixo' | 'variavel'] += Number(d.valor) || 0
    })
    return [
      { name: 'Fixas', value: result.fixo, fill: '#6366F1' },
      { name: 'Variáveis', value: result.variavel, fill: '#F59E0B' },
    ]
  }, [despesasUnificadas])

  const totalDespesasTipo = useMemo(
    () => totaisPorTipo.reduce((s, i) => s + i.value, 0),
    [totaisPorTipo]
  )

  // Calcular totais reais para cartões e alimentação
  const totalCartoes = useMemo(() => {
    if (!cartoes || !Array.isArray(cartoes)) return 0
    return cartoes.reduce((total, cartao) => {
      const t = Number((cartao as any).total_compras)
      return total + (Number.isFinite(t) ? t : 0)
    }, 0)
  }, [cartoes])

  const cartoesComGasto = useMemo(() => {
    if (!Array.isArray(cartoes)) return []
    return [...cartoes]
      .map((c: any) => ({
        id: c.id,
        nome: String(c.nome || 'Cartão'),
        cor: String(c.cor || '#6366F1'),
        limite: Number(c.limite) || 0,
        total: Number(c.total_compras) || 0,
        pago: Boolean(c.pago),
      }))
      .sort((a, b) => b.total - a.total)
  }, [cartoes])

  const totalAlimentacao = useMemo(() => {
    if (!marmitas || !Array.isArray(marmitas)) return 0
    return marmitas.reduce((total, marmita) => total + (marmita.valor || 0), 0)
  }, [marmitas])

  if (hasError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Erro no Sistema</h1>
          <p className="text-muted-foreground mb-4">Ocorreu um erro inesperado. Tente recarregar a página.</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 text-sm"
          >
            Recarregar Página
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Cabeçalho */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Controle Financeiro</h1>
          <p className="text-muted-foreground">Gerencie suas receitas, despesas e acompanhe sua evolução financeira</p>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="relative">
              <button
                aria-haspopup="dialog"
                onClick={() => setAbrirMesPicker(v => !v)}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-card/60 backdrop-blur border border-border rounded-full text-sm hover:bg-card/80 transition shadow-sm"
              >
                <Calendar className="w-4 h-4" />
                <span className="hidden sm:inline select-none">{getNomeMes(parseInt(filtroMes))} {filtroAno}</span>
              </button>
              {abrirMesPicker && (
                <div className="absolute left-0 mt-2 w-64 bg-popover text-popover-foreground border border-border rounded-lg shadow-lg p-3 z-20">
          <div className="flex items-center gap-2">
              <select
                      aria-label="Selecionar mês"
                value={filtroMes}
                onChange={(e) => setFiltroMes(e.target.value)}
                      className="flex-1 px-2 py-1 border border-border rounded bg-background text-foreground text-sm"
                    >
                      {Array.from({ length: 12 }, (_, i) => {
                        const month = i + 1
                        return (
                          <option key={month} value={String(month).padStart(2, '0')}>
                            {new Date(2024, i).toLocaleDateString('pt-BR', { month: 'long' })}
                          </option>
                        )
                      })}
              </select>
              <select
                      aria-label="Selecionar ano"
                value={filtroAno}
                onChange={(e) => setFiltroAno(e.target.value)}
                      className="w-[90px] px-2 py-1 border border-border rounded bg-background text-foreground text-sm"
                    >
                      {Array.from({ length: 5 }, (_, i) => {
                        const year = new Date().getFullYear() - 2 + i
                        return (
                          <option key={year} value={String(year)}>
                            {year}
                          </option>
                        )
                      })}
              </select>
            <button
                      onClick={() => setAbrirMesPicker(false)}
                      className="px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm hover:bg-primary/90"
            >
                      OK
            </button>
                  </div>
                </div>
          )}
          </div>
        </div>

          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setOcultarValores(!ocultarValores)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all shadow-sm ${
                ocultarValores 
                  ? 'bg-orange-100 text-orange-700 border border-orange-200 hover:bg-orange-200' 
                  : 'bg-blue-100 text-blue-700 border border-blue-200 hover:bg-blue-200'
              }`}
              title={ocultarValores ? 'Clique para mostrar todos os valores' : 'Clique para ocultar todos os valores'}
            >
              {ocultarValores ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              <span className="hidden sm:inline">
                {ocultarValores ? 'Mostrar' : 'Ocultar'} Todos os Valores
              </span>
              <span className="sm:hidden">
                {ocultarValores ? 'Mostrar' : 'Ocultar'}
              </span>
            </motion.button>
          </div>
        </div>

        {/* Abas */}
        <div className="flex flex-wrap gap-2 mb-8">
        <button
          onClick={() => selecionarAba('financeiro')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors text-sm ${
            abaAtiva === 'financeiro'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
            <BarChart3 size={16} />
          Financeiro
        </button>
          <button
            onClick={() => selecionarAba('receitas')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors text-sm ${
              abaAtiva === 'receitas'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            <DollarSign size={16} />
            Receitas
          </button>
          <button
            onClick={() => selecionarAba('despesas')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors text-sm ${
              abaAtiva === 'despesas'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            <TrendingDown size={16} />
            Despesas
          </button>
          <button
            onClick={() => selecionarAba('cartoes')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors text-sm ${
              abaAtiva === 'cartoes'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            <CreditCard size={16} />
            Cartões
        </button>
        <button
          onClick={() => selecionarAba('alimentacao')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors text-sm ${
            abaAtiva === 'alimentacao'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          <ChefHat size={16} />
          Alimentação
        </button>
                </div>

        {/* Conteúdo da Aba Financeiro - Dashboard analítico */}
      {abaAtiva === 'financeiro' && (
        <>
            <div className="mb-6">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-1">Dashboard Financeiro</h2>
              <p className="text-sm text-muted-foreground">
                Análise de {getNomeMes(parseInt(filtroMes))} {filtroAno} — receitas, despesas, cartões e tendência
              </p>
            </div>

            {/* 1) KPIs do mês */}
            <section className="mb-8">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Resumo do mês</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition cursor-pointer"
                  onClick={() => selecionarAba('receitas')}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 rounded-lg bg-emerald-500/10"><DollarSign className="w-5 h-5 text-emerald-600" /></div>
                    <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                  </div>
                  <h4 className="text-sm text-muted-foreground mb-1">Receitas</h4>
                  <p className="text-2xl font-bold text-foreground">{ocultarValores ? '***' : formatCurrency(receitasDespesas?.receitas || 0)}</p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                  className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition cursor-pointer"
                  onClick={() => selecionarAba('despesas')}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 rounded-lg bg-destructive/10"><TrendingDown className="w-5 h-5 text-destructive" /></div>
                    <ArrowDownRight className="w-4 h-4 text-destructive" />
                  </div>
                  <h4 className="text-sm text-muted-foreground mb-1">Despesas registradas</h4>
                  <p className="text-2xl font-bold text-foreground">{ocultarValores ? '***' : formatCurrency(receitasDespesas?.despesas || 0)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {totalDespesasTipo > 0
                      ? `${Math.round((totaisPorTipo[0].value / totalDespesasTipo) * 100)}% fixas · ${Math.round((totaisPorTipo[1].value / totalDespesasTipo) * 100)}% variáveis`
                      : (despesasLoading ? 'Carregando detalhe…' : 'Sem detalhe por tipo')}
                  </p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition cursor-pointer"
                  onClick={() => selecionarAba('cartoes')}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 rounded-lg bg-indigo-500/10"><CreditCard className="w-5 h-5 text-indigo-600" /></div>
                    <ArrowUpRight className="w-4 h-4 text-indigo-600" />
                  </div>
                  <h4 className="text-sm text-muted-foreground mb-1">Cartões (compras do mês)</h4>
                  <p className="text-2xl font-bold text-foreground">
                    {cartoesLoading || cartoesFetching ? '…' : (ocultarValores ? '***' : formatCurrency(totalCartoes))}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {Array.isArray(cartoes)
                      ? `${cartoes.length} ${cartoes.length === 1 ? 'cartão ativo' : 'cartões ativos'}`
                      : '—'}
                  </p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition cursor-pointer"
                  onClick={() => selecionarAba('alimentacao')}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 rounded-lg bg-amber-500/10"><ChefHat className="w-5 h-5 text-amber-600" /></div>
                    <ArrowUpRight className="w-4 h-4 text-amber-600" />
                  </div>
                  <h4 className="text-sm text-muted-foreground mb-1">Alimentação</h4>
                  <p className="text-2xl font-bold text-foreground">{ocultarValores ? '***' : formatCurrency(totalAlimentacao)}</p>
                </motion.div>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-card border border-border rounded-xl p-6 shadow-sm"
              >
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Saldo do mês</h4>
                    <p className={`text-3xl sm:text-4xl font-bold ${(saldo?.saldo || 0) >= 0 ? 'text-positive' : 'text-negative'}`}>
                      {ocultarValores ? '***' : formatCurrency(saldo?.saldo || 0)}
                    </p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className={`text-sm font-semibold ${(saldo?.saldo || 0) >= 0 ? 'text-positive' : 'text-negative'}`}>
                      {(saldo?.saldo || 0) >= 0 ? 'Resultado positivo' : 'Resultado negativo'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {receitasValor > 0
                        ? `${Math.round((despesasValor / receitasValor) * 100)}% das receitas comprometidas em despesas`
                        : 'Sem receitas no período'}
                    </p>
                    {receitasValor > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Taxa de economia: {Math.round(((saldo?.saldo || 0) / receitasValor) * 100)}%
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            </section>

            {/* 2) Análise de despesas */}
            <section className="mb-8">
              <div className="flex items-center justify-between gap-2 mb-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Análise de despesas</h3>
                <button type="button" onClick={() => selecionarAba('despesas')} className="text-xs text-primary hover:underline">
                  Gerenciar despesas →
                </button>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-card border border-border rounded-xl p-5 shadow-sm"
                >
                  <h4 className="text-base font-semibold text-foreground mb-1">Por categoria</h4>
                  <p className="text-xs text-muted-foreground mb-4">Distribuição do que foi registrado em Despesas</p>
                  {despesasLoading ? (
                    <div className="min-h-[220px] flex items-center justify-center text-muted-foreground text-sm">Carregando…</div>
                  ) : totaisPorCategoria.length > 0 ? (
                    <>
                      <div className="w-full min-h-[220px] h-56 overflow-visible">
                        <DistribuicaoCarteiraECharts
                          variant="pie"
                          dados={totaisPorCategoria.map(({ value, categoria }) => ({
                            name: categoria.label,
                            value,
                            fill: categoria.color,
                          }))}
                          totalInvestido={totaisPorCategoria.reduce((s, d) => s + d.value, 0)}
                          formatCurrency={(v) => (ocultarValores ? '••••••' : formatCurrency(v))}
                        />
                      </div>
                      <ul className="mt-3 space-y-1.5 max-h-36 overflow-y-auto">
                        {totaisPorCategoria.slice(0, 6).map((item) => {
                          const somaCat = totaisPorCategoria.reduce((s, d) => s + d.value, 0)
                          const pct = somaCat > 0 ? (item.value / somaCat) * 100 : 0
                          return (
                            <li key={item.name} className="flex items-center justify-between text-xs gap-2">
                              <span className="flex items-center gap-2 min-w-0">
                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: item.categoria.color }} />
                                <span className="truncate text-foreground">{item.categoria.label}</span>
                              </span>
                              <span className="text-muted-foreground shrink-0">
                                {ocultarValores ? '•••' : formatCurrency(item.value)} · {pct.toFixed(0)}%
                              </span>
                            </li>
                          )
                        })}
                      </ul>
                    </>
                  ) : (
                    <div className="min-h-[180px] flex flex-col items-center justify-center text-center text-muted-foreground rounded-lg border border-dashed border-border px-4">
                      <p className="text-sm">Nenhuma despesa registrada neste mês.</p>
                      <button type="button" onClick={() => selecionarAba('despesas')} className="mt-2 text-xs text-primary hover:underline">
                        Adicionar despesa
                      </button>
                    </div>
                  )}
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                  className="bg-card border border-border rounded-xl p-5 shadow-sm"
                >
                  <h4 className="text-base font-semibold text-foreground mb-1">Fixas vs variáveis</h4>
                  <p className="text-xs text-muted-foreground mb-4">Quanto do orçamento é recorrente</p>
                  {despesasLoading ? (
                    <div className="min-h-[200px] flex items-center justify-center text-muted-foreground text-sm">Carregando…</div>
                  ) : totalDespesasTipo > 0 ? (
                    <>
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        {totaisPorTipo.map((item) => (
                          <div key={item.name} className="rounded-lg border border-border bg-muted/20 p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ background: item.fill }} />
                              <span className="text-xs text-muted-foreground">{item.name}</span>
                            </div>
                            <p className="text-lg font-bold text-foreground">
                              {ocultarValores ? '***' : formatCurrency(item.value)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {Math.round((item.value / totalDespesasTipo) * 100)}% do total
                            </p>
                          </div>
                        ))}
                      </div>
                      <div className="w-full min-h-[160px] overflow-visible">
                        <ResponsiveContainer width="100%" height={160}>
                          <BarChart data={totaisPorTipo} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                            <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} />
                            <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} tickFormatter={(v) => (ocultarValores ? '••••' : typeof v === 'number' && v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))} />
                            <Tooltip
                              contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }}
                              formatter={(value: any) => [ocultarValores ? '••••••' : formatCurrency(value), 'Valor']}
                            />
                            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                              {totaisPorTipo.map((entry, index) => (
                                <Cell key={`cell-tipo-${index}`} fill={entry.fill} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </>
                  ) : (
                    <div className="min-h-[180px] flex flex-col items-center justify-center text-center text-muted-foreground rounded-lg border border-dashed border-border px-4">
                      <p className="text-sm">Sem despesas classificadas como fixa/variável neste mês.</p>
                      <p className="text-xs mt-1">Ao registrar, escolha o tipo para alimentar este gráfico.</p>
                    </div>
                  )}
                </motion.div>
              </div>
            </section>

            {/* 3) Cartões — detalhe analítico */}
            <section className="mb-8">
              <div className="flex items-center justify-between gap-2 mb-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cartões no mês</h3>
                <button type="button" onClick={() => selecionarAba('cartoes')} className="text-xs text-primary hover:underline">
                  Abrir cartões →
                </button>
              </div>
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card border border-border rounded-xl p-5 shadow-sm"
              >
                {cartoesLoading || cartoesFetching ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">Carregando cartões…</p>
                ) : !cartoesComGasto.length ? (
                  <div className="py-8 text-center text-muted-foreground">
                    <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nenhum cartão cadastrado.</p>
                    <button type="button" onClick={() => selecionarAba('cartoes')} className="mt-2 text-xs text-primary hover:underline">
                      Cadastrar cartão
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Total de compras no mês</p>
                        <p className="text-2xl font-bold text-foreground">{ocultarValores ? '***' : formatCurrency(totalCartoes)}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {cartoesComGasto.filter((c) => c.total > 0).length} com gasto · {cartoesComGasto.filter((c) => c.pago).length} marcado(s) como pago
                      </p>
                    </div>
                    <div className="space-y-3">
                      {cartoesComGasto.map((c) => {
                        const uso = c.limite > 0 ? Math.min(100, (c.total / c.limite) * 100) : 0
                        return (
                          <div key={c.id} className="rounded-lg border border-border p-3">
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: c.cor }} />
                                <span className="font-medium text-sm text-foreground truncate">{c.nome}</span>
                                {c.pago && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">Pago</span>
                                )}
                              </div>
                              <span className="text-sm font-semibold text-foreground shrink-0">
                                {ocultarValores ? '***' : formatCurrency(c.total)}
                              </span>
                            </div>
                            {c.limite > 0 && (
                              <>
                                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                  <div
                                    className="h-full rounded-full transition-all"
                                    style={{ width: `${uso}%`, background: c.cor }}
                                  />
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-1">
                                  {uso.toFixed(0)}% do limite ({ocultarValores ? '***' : formatCurrency(c.limite)})
                                </p>
                              </>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}
              </motion.div>
            </section>

            {/* 4) Evolução e composição */}
            <section className="mb-8">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Tendência e composição</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <motion.div
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-card border border-border rounded-xl p-5 shadow-sm"
              >
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-base font-semibold text-foreground">Evolução financeira</h4>
                <div className="flex items-center gap-2">
                    <select
                      value={periodoEvolucao}
                      onChange={(e) => setPeriodoEvolucao(e.target.value as '3m' | '6m' | '12m')}
                      className="px-3 py-1 text-sm border border-border rounded bg-background text-foreground"
                      aria-label="Selecionar período"
                    >
                      <option value="3m">3 meses</option>
                      <option value="6m">6 meses</option>
                      <option value="12m">12 meses</option>
                    </select>
          </div>
        </div>

                {comparacaoMensal && (
                  <div className="mb-4">
                    <h5 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                      <TrendingUp className="w-3.5 h-3.5" />
                      vs mês anterior
                    </h5>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: 'Receitas', d: comparacaoMensal.receitas, goodUp: true },
                        { label: 'Despesas', d: comparacaoMensal.despesas, goodUp: false },
                        { label: 'Saldo', d: comparacaoMensal.saldo, goodUp: true },
                      ].map(({ label, d, goodUp }) => {
                        const bom = goodUp ? d.variacao >= 0 : d.variacao <= 0
                        return (
                          <div key={label} className="bg-muted/30 rounded-lg p-2.5">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] text-muted-foreground">{label}</span>
                              <span className={`flex items-center gap-0.5 text-[10px] ${bom ? 'text-positive' : 'text-destructive'}`}>
                                {d.variacao >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                                {Math.abs(d.variacao).toFixed(0)}%
                              </span>
                            </div>
                            <div className="text-sm font-bold text-foreground truncate">
                              {ocultarValores ? '••••' : formatCurrency(d.atual)}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                <div className="w-full min-h-[260px] overflow-visible">
                  <ResponsiveContainer width="100%" height={260}>
                    <ComposedChart
                      data={dadosGraficoEvolucao || []}
                      margin={{ top: 8, right: 12, left: 4, bottom: 4 }}
                    >
                      <defs>
                        <linearGradient id="ctrlEvolReceitas" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="ctrlEvolDespesas" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis
                        dataKey="data"
                        stroke="hsl(var(--muted-foreground))"
                        tick={{ fontSize: 11 }}
                        tickFormatter={(value) => {
                          const date = new Date(value)
                          return `${date.getDate()}/${date.getMonth() + 1}`
                        }}
                      />
                      <YAxis
                        stroke="hsl(var(--muted-foreground))"
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v) => (ocultarValores ? '••••' : typeof v === 'number' && v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          color: 'hsl(var(--foreground))',
                        }}
                        formatter={(value, name) => [
                          ocultarValores ? '••••••' : formatCurrency(Number(value)),
                          name === 'receitas' ? 'Receitas' : name === 'despesas' ? 'Despesas' : name === 'saldo_acumulado' ? 'Saldo Acumulado' : name,
                        ]}
                        labelFormatter={(value) => new Date(value).toLocaleDateString('pt-BR')}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} formatter={(value) => (value === 'receitas' ? 'Receitas' : value === 'despesas' ? 'Despesas' : value === 'saldo_acumulado' ? 'Saldo Acumulado' : value)} />
                      <Area type="monotone" dataKey="receitas" name="receitas" stroke="#10b981" fill="url(#ctrlEvolReceitas)" strokeWidth={2} />
                      <Area type="monotone" dataKey="despesas" name="despesas" stroke="#ef4444" fill="url(#ctrlEvolDespesas)" strokeWidth={2} />
                      <Line type="monotone" dataKey="saldo_acumulado" name="saldo_acumulado" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 3 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
          </motion.div>

          <motion.div
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-card border border-border rounded-xl p-5 shadow-sm"
              >
                <h4 className="text-base font-semibold text-foreground mb-1">Receitas vs despesas</h4>
                <p className="text-xs text-muted-foreground mb-4">Composição do fluxo no mês selecionado</p>
                {(receitasDespesas?.receitas || 0) + (receitasDespesas?.despesas || 0) > 0 ? (
                  <div className="w-full min-h-[260px] h-64 overflow-visible">
                    <DistribuicaoCarteiraECharts
                      variant="pie"
                      dados={dadosGraficoReceitasDespesas}
                      totalInvestido={(receitasDespesas?.receitas || 0) + (receitasDespesas?.despesas || 0)}
                      formatCurrency={(v) => (ocultarValores ? '••••••' : formatCurrency(v))}
                    />
                  </div>
                ) : (
                  <div className="min-h-[220px] flex items-center justify-center text-muted-foreground rounded-lg border border-dashed border-border text-sm">
                    Nenhum dado disponível para o período.
                  </div>
                )}

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground mb-1">Tendência</p>
                    <p className="text-sm font-semibold text-foreground">
                      {receitasValor > despesasValor ? 'Receitas > despesas' : receitasValor < despesasValor ? 'Despesas > receitas' : 'Em equilíbrio'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground mb-1">Meta (20% economia)</p>
                    <p className="text-sm font-semibold text-foreground">
                      {receitasValor > 0
                        ? `${Math.min(999, Math.round(((saldo?.saldo || 0) / (receitasValor * 0.2)) * 100))}%`
                        : '—'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground mb-1">Maior categoria</p>
                    <p className="text-sm font-semibold text-foreground truncate">
                      {totaisPorCategoria[0]?.categoria.label || '—'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {totaisPorCategoria[0] ? (ocultarValores ? '***' : formatCurrency(totaisPorCategoria[0].value)) : ''}
                    </p>
                  </div>
                </div>
          </motion.div>
              </div>
            </section>

            {/* Ações rápidas compactas */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              {[
                { aba: 'receitas' as const, label: 'Receita', icon: DollarSign, tone: 'text-emerald-600 bg-emerald-500/10' },
                { aba: 'despesas' as const, label: 'Despesa', icon: TrendingDown, tone: 'text-destructive bg-destructive/10' },
                { aba: 'cartoes' as const, label: 'Cartões', icon: CreditCard, tone: 'text-indigo-600 bg-indigo-500/10' },
                { aba: 'alimentacao' as const, label: 'Alimentação', icon: ChefHat, tone: 'text-amber-600 bg-amber-500/10' },
              ].map(({ aba, label, icon: Icon, tone }) => (
                <button
                  key={aba}
                  type="button"
                  onClick={() => selecionarAba(aba)}
                  className="flex items-center gap-2 rounded-xl border border-border bg-card p-3 text-left hover:bg-muted/40 transition shadow-sm"
                >
                  <span className={`p-2 rounded-lg ${tone}`}><Icon className="w-4 h-4" /></span>
                  <span className="text-sm font-medium text-foreground">{label}</span>
                </button>
              ))}
            </div>
        </>
      )}

        {/* Conteúdo da Aba Receitas */}
        {abaAtiva === 'receitas' && (
          <Suspense fallback={<LoadingSpinner text="Carregando receitas..." />}>
            <ControleReceitaTab
              filtroMes={filtroMes}
              filtroAno={filtroAno}
              ocultarValores={ocultarValores}
            />
          </Suspense>
        )}

        {/* Conteúdo da Aba Despesas */}
        {abaAtiva === 'despesas' && (
          <Suspense fallback={<LoadingSpinner text="Carregando despesas..." />}>
            <ControleDespesaTab
              filtroMes={filtroMes}
              filtroAno={filtroAno}
              ocultarValores={ocultarValores}
            />
          </Suspense>
        )}

        {/* Conteúdo da Aba Cartões */}
        {abaAtiva === 'cartoes' && (
          <Suspense fallback={<LoadingSpinner text="Carregando cartões..." />}>
            <ControleCartaoTab
              filtroMes={filtroMes}
              filtroAno={filtroAno}
              ocultarValores={ocultarValores}
            />
          </Suspense>
        )}

        {/* Conteúdo da Aba Alimentação */}
        {abaAtiva === 'alimentacao' && (
          <Suspense fallback={<LoadingSpinner text="Carregando alimentação..." />}>
            <ControleAlimentacaoTab
              filtroMes={filtroMes}
              filtroAno={filtroAno}
              ocultarValores={ocultarValores}
            />
          </Suspense>
        )}

        <HelpTips tips={[]} />
            </div>
    </div>
  )
}

export default function ControlePage() {
  return (
    <ControleCategoriasProvider>
      <ControlePageContent />
    </ControleCategoriasProvider>
  )
}
