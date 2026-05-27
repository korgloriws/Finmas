import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { toast } from 'react-hot-toast'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'

import { 
  Minus, 
  Target, 
  BarChart3, 
  Trophy, 
  Calendar, 
  Brain, 
  History,
  FileText,
  TrendingUp,
  Activity,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Calculator,
  PlusCircle,
  Zap,
  Eye,
  EyeOff,
  Receipt,
  Check,
  BookOpen,
  Sparkles,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { carteiraService } from '../services/api'
import { AtivoCarteira, Movimentacao } from '../types'
import { formatCurrency } from '../utils/formatters'
import HelpTips from '../components/HelpTips'
import { normalizeTicker, getDisplayTicker } from '../utils/tickerUtils'
import { useTabNavigationGuard } from '../hooks/useTabNavigationGuard'

// Importações diretas (sem lazy loading para evitar crashes)
import CarteiraAtivosTab from '../components/carteira/CarteiraAtivosTab'
import CarteiraGraficosTab from '../components/carteira/CarteiraGraficosTab'
import CarteiraRankingTab from '../components/carteira/CarteiraRankingTab'
import CarteiraProventosTab from '../components/carteira/CarteiraProventosTab'
import CarteiraInsightsTab from '../components/carteira/CarteiraInsightsTab'
import CarteiraImpostosTab from '../components/carteira/CarteiraImpostosTab'
import CarteiraRebalanceamentoTab from '../components/carteira/CarteiraRebalanceamentoTab'
import CarteiraMovimentacoesTab from '../components/carteira/CarteiraMovimentacoesTab'
import CarteiraProjecaoTab from '../components/carteira/CarteiraProjecaoTab'
import CarteiraRelatoriosTab from '../components/carteira/CarteiraRelatoriosTab'
import CarteiraSimuladorTab from '../components/carteira/CarteiraSimuladorTab'
import AddAtivoModal from '../components/carteira/AddAtivoModal'
import EditAtivoModal from '../components/carteira/EditAtivoModal'
import VenderAtivoModal from '../components/carteira/VenderAtivoModal'
import RendaFixaFormModal from '../components/carteira/RendaFixaFormModal'

export default function CarteiraPage() {
  const { user, canAccessScreen } = useAuth()
  const podeVerImpostos = canAccessScreen('carteira-impostos')
  const podeVerInsights = canAccessScreen('carteira-insights')
  const podeVerProjecao = canAccessScreen('carteira-projecao')
  const podeVerSimulador = canAccessScreen('carteira-simulador')
  const [searchParams, setSearchParams] = useSearchParams()
  const [inputTicker, setInputTicker] = useState('')
  const [inputQuantidade, setInputQuantidade] = useState('')
  const [inputTipo, setInputTipo] = useState('')
  const [inputPreco, setInputPreco] = useState('')
  const [inputIndexador, setInputIndexador] = useState<'CDI' | 'IPCA' | 'SELIC' | 'PREFIXADO' | ''>('')
  const [inputIndexadorPct, setInputIndexadorPct] = useState('')

  const [inputDataAplicacao, setInputDataAplicacao] = useState<string>(new Date().toISOString().split('T')[0])
  const [inputVencimento, setInputVencimento] = useState<string>('')
  const [inputIsentoIr, setInputIsentoIr] = useState<boolean>(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editQuantidade, setEditQuantidade] = useState('')
  const [editPreco, setEditPreco] = useState('')
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [ativoParaEditar, setAtivoParaEditar] = useState<any>(null)
  const [rendaFixaModalOpen, setRendaFixaModalOpen] = useState(false)
  const [ativoRendaFixaParaEditar, setAtivoRendaFixaParaEditar] = useState<any>(null)
  const [venderModalOpen, setVenderModalOpen] = useState(false)
  const [ativoParaVender, setAtivoParaVender] = useState<any>(null)
  const [aporteModalOpen, setAporteModalOpen] = useState(false)
  const [ativoParaAporte, setAtivoParaAporte] = useState<any>(null)
  const [aporteValor, setAporteValor] = useState('')
  const [aporteData, setAporteData] = useState<string>(new Date().toISOString().split('T')[0])
  const [historicoAportes, setHistoricoAportes] = useState<any[]>([])
  const [loadingHistoricoAportes, setLoadingHistoricoAportes] = useState(false)
  const [filtroMes, setFiltroMes] = useState<number>(new Date().getMonth() + 1)
  const [filtroAno, setFiltroAno] = useState<number>(new Date().getFullYear())
  const [activeTab, setActiveTab] = useState(() => {
    const tabFromUrl = searchParams.get('tab')
    const validTabs = ['ativos', 'graficos', 'ranking', 'proventos', 'insights', 'rebalance', 'movimentacoes', 'relatorios', 'projecao', 'simulador', 'impostos']
    return validTabs.includes(tabFromUrl || '') ? tabFromUrl! : 'ativos'
  })

  // Cancela requests pendentes ao trocar de aba (evita "zombies" no backend
  // quando uma query pesada — ex: proventos-recebidos — fica em voo após o
  // usuário sair da aba que a disparou). Mutations são preservadas.
  useTabNavigationGuard(activeTab)

  const [manageTipoOpen, setManageTipoOpen] = useState<{open: boolean; tipo?: string}>({open: false})
  const [renameTipoValue, setRenameTipoValue] = useState('')
  // Carregamento sob demanda - insights (só na aba insights e se tiver acesso)
  const { data: insights, isLoading: loadingInsights } = useQuery({
    queryKey: ['carteira-insights', user],
    queryFn: carteiraService.getInsights,
    enabled: !!user && activeTab === 'insights' && podeVerInsights,
    staleTime: 10 * 60 * 1000, // 10 minutos - insights mudam pouco
    refetchOnWindowFocus: false,
    refetchOnMount: false, // PERFORMANCE: Usa cache se disponível
  })
  // Carregamento sob demanda - rebalanceamento (só na aba rebalance)
  const { data: rbConfig } = useQuery({
    queryKey: ['rebalance-config', user],
    queryFn: carteiraService.getRebalanceConfig,
    enabled: !!user && activeTab === 'rebalance',
    refetchOnWindowFocus: false,
    refetchOnMount: false, 
    staleTime: 10 * 60 * 1000, 
  })
  const { data: rbStatus, refetch: refetchRbStatus } = useQuery({
    queryKey: ['rebalance-status', user],
    queryFn: carteiraService.getRebalanceStatus,
    enabled: !!user && activeTab === 'rebalance',
    refetchOnWindowFocus: false,
    refetchOnMount: false, 
    staleTime: 5 * 60 * 1000, 
  })
  const { data: rbHistory } = useQuery({
    queryKey: ['rebalance-history', user],
    queryFn: carteiraService.getRebalanceHistory,
    enabled: !!user && activeTab === 'rebalance',
    refetchOnWindowFocus: false,
    refetchOnMount: false, 
    staleTime: 10 * 60 * 1000, 
  })
  const saveRebalanceMutation = useMutation({
    mutationFn: carteiraService.saveRebalanceConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rebalance-config', user] })
      queryClient.invalidateQueries({ queryKey: ['rebalance-status', user] })
      queryClient.invalidateQueries({ queryKey: ['rebalance-history', user] })
      refetchRbStatus()
      toast.success('Configuração salva')
    },
    onError: (err: any) => {
      if (err?.response?.status === 401) {
        toast.error('Sessão expirada. Faça login novamente.')
      } else {
        toast.error('Falha ao salvar configuração')
      }
    }
  })
  const [idealPreview, setIdealPreview] = useState<{ periodo: string; targets: Record<string, number> } | null>(null)
  

  useEffect(() => {
    if (rbConfig && !idealPreview) {
      const cfg: any = rbConfig as any
      const initTargets = cfg?.targets || {}
      const initPeriodo = cfg?.periodo || 'mensal'
      setIdealPreview({ periodo: initPeriodo, targets: initTargets })
    }
  }, [rbConfig, idealPreview])


  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
        e.preventDefault()
        if (activeTab === 'ativos') setAddModalOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activeTab])
  const idealTargets = useMemo(() => {
    return idealPreview?.targets ?? (rbConfig as any)?.targets ?? {}
  }, [idealPreview, rbConfig])
  const [ocultarValor, setOcultarValor] = useState(true)
  const [addModalOpen, setAddModalOpen] = useState(false)
 
  const [expandedTipos, setExpandedTipos] = useState<Record<string, boolean>>({
    'Ação': true,
    'FII': true,
    'BDR': true,
    'Criptomoeda': true,
    'Fixa': true
  })
  const [filtroPeriodo, setFiltroPeriodo] = useState<'semanal' | 'mensal' | 'trimestral' | 'semestral' | 'anual' | 'maximo'>('mensal')
  const [filtroProventos, setFiltroProventos] = useState<'mes' | '6meses' | '1ano' | '5anos' | 'total'>('mes')
  const [filtroProventosGraficos, setFiltroProventosGraficos] = useState<'mes' | '6meses' | '1ano' | '5anos' | 'total'>('total')

  const queryClient = useQueryClient()

  // Controle para evitar atualizações muito frequentes
  const ultimaAtualizacaoPrecos = useRef<number>(0)
  const MIN_INTERVALO_ATUALIZACAO = 30 * 1000 // 30 segundos - mínimo entre atualizações

  // Carregamento prioritário - carteira principal
  // PERFORMANCE: Usa cache se disponível, atualiza dados em background se necessário
  const { data: carteira, isLoading: loadingCarteira, refetch: refetchCarteira } = useQuery<AtivoCarteira[]>({
    queryKey: ['carteira', user], 
    queryFn: async () => await carteiraService.getCarteira(),
    enabled: !!user, 
    staleTime: 5 * 60 * 1000, // 5 minutos - dados considerados frescos por mais tempo
    gcTime: 15 * 60 * 1000, // 15 minutos - mantém em cache por mais tempo
    refetchOnWindowFocus: false, // Não refazer ao focar janela
    refetchOnReconnect: false, // Não refazer ao reconectar
    refetchOnMount: false, // PERFORMANCE: Não recarrega ao montar - usa cache se disponível
    // Os dados serão atualizados em background quando necessário via refresh manual ou invalidação
  })


  // Atualizar preços em background quando abrir a aba "Ativos"
  // Usa endpoint atômico (GET /carteira?refresh=1) para evitar corrida entre
  // "refresh" e "refetch" e garantir que a UI receba os valores mais recentes.
  useEffect(() => {
    if (activeTab === 'ativos' && carteira && carteira.length > 0) {
      const agora = Date.now()
      const tempoDesdeUltimaAtualizacao = agora - ultimaAtualizacaoPrecos.current
      
      // Só atualiza se passou o intervalo mínimo (evita atualizações muito frequentes)
      if (tempoDesdeUltimaAtualizacao >= MIN_INTERVALO_ATUALIZACAO) {
        ultimaAtualizacaoPrecos.current = agora
        
        carteiraService.getCarteiraRefresh()
          .then((carteiraAtualizada) => {
            // Atualiza imediatamente o cache principal da carteira
            // para refletir preços/indicadores novos sem esperar outra query.
            queryClient.setQueryData(['carteira', user], carteiraAtualizada)

            // Invalida dados derivados que dependem da carteira atualizada.
            queryClient.invalidateQueries({ queryKey: ['carteira-valorizacao-periodo'] })
            queryClient.invalidateQueries({ queryKey: ['home-resumo', user] })

            toast.success('Valores atualizados', { id: 'carteira-valores-atualizados' })
          })
          .catch((error) => {
            // Fallback: se refresh falhar, tenta pelo menos refetch normal.
            console.warn('Erro ao atualizar preços:', error)
            refetchCarteira()
          })
      }
    }
  }, [activeTab, carteira?.length, queryClient, refetchCarteira, user]) // Atualiza quando a carteira finalmente carregar na aba de ativos

  const { data: tiposApi } = useQuery({
    queryKey: ['tipos-ativos', user],
    queryFn: carteiraService.getTipos,
    enabled: !!user,
    refetchOnWindowFocus: false,
    refetchOnMount: false, // PERFORMANCE: Usa cache se disponível
    staleTime: 15 * 60 * 1000, // 15 minutos - tipos mudam raramente
  })
  const tiposDisponiveisComputed = useMemo(() => {
    const fromCarteira = (carteira || []).map(a => (a?.tipo || 'Desconhecido')).filter(Boolean) as string[]
    const fromApi = (tiposApi || []) as string[]
    return Array.from(new Set([ ...fromApi, ...fromCarteira ]))
  }, [carteira, tiposApi])

  const emissorRfSuggestions = useMemo(() => {
    const s = new Set<string>()
    for (const a of carteira || []) {
      const tl = (a?.tipo || '').toLowerCase()
      if (!tl.includes('renda fixa')) continue
      const e = (a as AtivoCarteira & { emissor_rf?: string | null }).emissor_rf
      const v = e != null ? String(e).trim() : ''
      if (v) s.add(v)
    }
    return Array.from(s).sort((x, y) => x.localeCompare(y, 'pt-BR'))
  }, [carteira])

  // Carregamento sob demanda - movimentações (só na aba movimentações)
  const { data: movimentacoes, isLoading: loadingMovimentacoes } = useQuery<Movimentacao[]>({
    queryKey: ['movimentacoes', user, filtroMes, filtroAno], 
    queryFn: () => carteiraService.getMovimentacoes(filtroMes, filtroAno),
    enabled: !!user && (activeTab === 'movimentacoes' || activeTab === 'impostos'),
    staleTime: 5 * 60 * 1000, // 5 minutos - dados considerados frescos
    refetchOnMount: false, // PERFORMANCE: Usa cache se disponível
    refetchOnWindowFocus: false,
  })

  const { data: movimentacoesAll } = useQuery<Movimentacao[]>({
    queryKey: ['movimentacoes-all', user],
    queryFn: () => carteiraService.getMovimentacoes(),
    enabled: !!user && (activeTab === 'movimentacoes' || activeTab === 'impostos'),
    refetchOnWindowFocus: false,
    refetchOnMount: false, // PERFORMANCE: Usa cache se disponível
    staleTime: 10 * 60 * 1000, // 10 minutos - dados completos mudam pouco
  })

  
  // Carregamento sob demanda - proventos (só na aba proventos)
  const { data: proventos, isLoading: loadingProventos, error: proventosError } = useQuery({
    queryKey: ['proventos', user, carteira?.map(ativo => ativo?.ticker), filtroProventos], 
    queryFn: () => carteiraService.getProventosComFiltro(carteira?.map(ativo => ativo?.ticker || '') || [], filtroProventos),
    enabled: !!user && !!carteira && carteira.length > 0 && activeTab === 'proventos', 
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnMount: false, // PERFORMANCE: Usa cache se disponível
    staleTime: 10 * 60 * 1000, // 10 minutos - dados de proventos mudam pouco
  })

  
  // OTIMIZAÇÃO: Carregar indicadores apenas na aba de ativos (onde são usados)
  const { data: indicadores } = useQuery({
    queryKey: ['indicadores'],
    queryFn: carteiraService.getIndicadores,
    enabled: activeTab === 'ativos', // Só carrega na aba principal
    staleTime: 10 * 60 * 1000, // 10 minutos - indicadores mudam pouco
    refetchOnWindowFocus: false,
    refetchOnMount: false, // PERFORMANCE: Usa cache se disponível
  })

  // OTIMIZAÇÃO: Carregar dados do tesouro apenas quando necessário (aba de ativos para renda fixa)
  const { data: tesouroData } = useQuery({
    queryKey: ['tesouro-titulos'],
    queryFn: carteiraService.getTesouroTitulos,
    enabled: activeTab === 'ativos', // Só carrega na aba principal
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })

  
  
  const { data: proventosRecebidos, isLoading: loadingProventosRecebidos, error: proventosRecebidosError } = useQuery({
    queryKey: ['proventos-recebidos', user, filtroProventos],
    queryFn: () => carteiraService.getProventosRecebidos(filtroProventos),
    enabled: !!user && !!carteira && carteira.length > 0 && (activeTab === 'proventos' || activeTab === 'projecao' || activeTab === 'impostos'),
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnMount: false, // PERFORMANCE: Usa cache se disponível
    staleTime: 10 * 60 * 1000, // 10 minutos
  })

  // Proventos recebidos para a aba Gráficos (filtro de período próprio)
  const { data: proventosRecebidosGraficos, isLoading: loadingProventosGraficos } = useQuery({
    queryKey: ['proventos-recebidos-graficos', user, filtroProventosGraficos],
    queryFn: () => carteiraService.getProventosRecebidos(filtroProventosGraficos),
    enabled: !!user && !!carteira && carteira.length > 0 && activeTab === 'graficos',
    retry: 1,
    refetchOnWindowFocus: false,
    staleTime: 10 * 60 * 1000,
  })



  const { data: historicoCarteira, isLoading: loadingHistorico, refetch: refetchHistorico } = useQuery({
    queryKey: ['historico-carteira', user, filtroPeriodo],
    queryFn: () => carteiraService.getHistorico(filtroPeriodo),
    enabled: !!user && (activeTab === 'projecao' || activeTab === 'graficos'),
    retry: 3,
    staleTime: 10 * 60 * 1000, 
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false, 
  })


  const { data: historicoParaCalendario } = useQuery({
    queryKey: ['historico-carteira-calendario', user],
    queryFn: () => carteiraService.getHistorico('maximo'),
    enabled: !!user && activeTab === 'graficos',
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  // Aba Gráficos: ler saldo e histórico em tempo real do banco ao abrir a aba
  useEffect(() => {
    if (activeTab === 'graficos') {
      refetchCarteira()
      refetchHistorico()
    }
  }, [activeTab, refetchCarteira, refetchHistorico])

  const adicionarMutation = useMutation({
    mutationFn: ({ ticker, quantidade, tipo, preco_inicial, nome_personalizado, indexador, indexador_pct, data_aplicacao, vencimento, isento_ir }: { ticker: string; quantidade: number; tipo: string; preco_inicial?: number; nome_personalizado?: string; indexador?: 'CDI'|'IPCA'|'SELIC'|'PREFIXADO'|'CDI+'|'IPCA+'; indexador_pct?: number; data_aplicacao?: string; vencimento?: string; isento_ir?: boolean }) =>
      carteiraService.adicionarAtivo(ticker, quantidade, tipo, preco_inicial, nome_personalizado, indexador, indexador_pct, data_aplicacao, vencimento, isento_ir),
    onSuccess: () => {
      // Invalidar e forçar refetch imediato das queries ativas
      queryClient.invalidateQueries({ queryKey: ['carteira', user] })
      queryClient.invalidateQueries({ queryKey: ['movimentacoes', user] })
      queryClient.invalidateQueries({ queryKey: ['historico-carteira', user] })
      queryClient.invalidateQueries({ queryKey: ['proventos', user] })
      queryClient.invalidateQueries({ queryKey: ['proventos-recebidos', user] })
      
      // Forçar refetch imediato da carteira se estiver sendo observada (aba ativos ativa)
      queryClient.refetchQueries({ queryKey: ['carteira', user] })
      // Forçar refetch de movimentações se a aba estiver ativa
      if (activeTab === 'movimentacoes') {
        queryClient.refetchQueries({ queryKey: ['movimentacoes', user] })
      }
      
      setInputTicker('')
      setInputQuantidade('')
      setInputTipo('')
      setInputPreco('')
      setInputIndexador('')
      setInputIndexadorPct('')
      setInputDataAplicacao('')
      setInputVencimento('')
      setInputIsentoIr(false)
      
      toast.success('Ativo adicionado com sucesso!')
    },
    onError: (error: any) => {
      console.error('Erro ao adicionar ativo:', error)
      toast.error('Erro ao adicionar ativo. Tente novamente.')
    },
  })

  const atualizarMutation = useMutation({
    mutationFn: ({ id, quantidade, preco_atual }: { id: number; quantidade?: number; preco_atual?: number }) =>
      carteiraService.atualizarAtivo(id, { quantidade, preco_atual }),
    onSuccess: () => {
      // Invalidar e forçar refetch imediato das queries ativas
      queryClient.invalidateQueries({ queryKey: ['carteira', user] })
      queryClient.invalidateQueries({ queryKey: ['historico-carteira', user] })
      queryClient.invalidateQueries({ queryKey: ['proventos', user] })
      queryClient.invalidateQueries({ queryKey: ['proventos-recebidos', user] })
      queryClient.invalidateQueries({ queryKey: ['movimentacoes', user] })
      queryClient.invalidateQueries({ queryKey: ['movimentacoes-all', user] })
      // Invalidar queries da HomePage para atualizar cards e gráficos
      queryClient.invalidateQueries({ queryKey: ['home-resumo', user] })
      queryClient.invalidateQueries({ queryKey: ['carteira-historico', user] })
      
      // Forçar refetch imediato da carteira se estiver sendo observada (aba ativos ativa)
      queryClient.refetchQueries({ queryKey: ['carteira', user] })
      // Forçar refetch de movimentações se a aba estiver ativa
      if (activeTab === 'movimentacoes') {
        queryClient.refetchQueries({ queryKey: ['movimentacoes', user] })
        queryClient.refetchQueries({ queryKey: ['movimentacoes-all', user] })
      }
      
      setEditingId(null)
      setEditQuantidade('')
      setEditPreco('')
    },
  })

  const aporteRendaFixaMutation = useMutation({
    mutationFn: async (payload: {
      ativo: any
      quantidade: number
      preco_aporte: number
      data_aplicacao: string
    }) => {
      const a = payload.ativo || {}
      return carteiraService.adicionarAtivo(
        a.ticker || a.nome_completo,
        payload.quantidade,
        a.tipo || 'Renda Fixa',
        payload.preco_aporte,
        a.nome_completo || undefined,
        a.indexador || undefined,
        typeof a.indexador_pct === 'number' ? a.indexador_pct : (a.indexador_pct ? Number(a.indexador_pct) : undefined),
        payload.data_aplicacao || undefined,
        a.vencimento || undefined,
        typeof a.isento_ir === 'boolean' ? a.isento_ir : undefined,
        typeof a.liquidez_diaria === 'boolean' ? a.liquidez_diaria : undefined,
        false,
        a.emissor_rf || undefined,
        a.tipo_renda_fixa || undefined
      )
    },
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ['carteira', user] })
      const previousCarteira = queryClient.getQueryData<AtivoCarteira[]>(['carteira', user])
      queryClient.setQueryData<AtivoCarteira[]>(['carteira', user], (old) => {
        if (!old || !Array.isArray(old)) return old
        return old.map((item: any) => {
          if (!item || item.id !== payload.ativo?.id) return item
          const qtdAtual = Number(item.quantidade || 0)
          const qtdAdd = Number(payload.quantidade || 0)
          const novoQtd = qtdAtual + qtdAdd
          const valorAporte = Number(payload.preco_aporte || 0) * qtdAdd
          return {
            ...item,
            quantidade: novoQtd,
            valor_total: Number(item.valor_total || 0) + (Number.isFinite(valorAporte) ? valorAporte : 0),
          }
        })
      })
      return { previousCarteira }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['carteira', user] })
      queryClient.invalidateQueries({ queryKey: ['movimentacoes', user] })
      queryClient.invalidateQueries({ queryKey: ['movimentacoes-all', user] })
      queryClient.invalidateQueries({ queryKey: ['historico-carteira', user] })
      queryClient.invalidateQueries({ queryKey: ['carteira-valorizacao-periodo'] })
      queryClient.invalidateQueries({ queryKey: ['home-resumo', user] })
      queryClient.refetchQueries({ queryKey: ['carteira', user] })
      setAporteModalOpen(false)
      setAtivoParaAporte(null)
      setAporteValor('')
      toast.success('Aporte em renda fixa registrado com sucesso!')
    },
    onError: (error: any, _payload, context) => {
      if (context?.previousCarteira) {
        queryClient.setQueryData(['carteira', user], context.previousCarteira)
      }
      toast.error(error?.response?.data?.error || 'Erro ao registrar aporte')
    },
  })

  const handleAporteRendaFixa = useCallback((ativo: any) => {
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    setAtivoParaAporte(ativo)
    setAporteValor('')
    setAporteData(todayStr)
    setAporteModalOpen(true)
  }, [])

  const handleSalvarAporte = useCallback(() => {
    if (!ativoParaAporte) return
    const valorAporte = parseFloat(String(aporteValor).replace(',', '.'))
    if (!Number.isFinite(valorAporte) || valorAporte <= 0) {
      toast.error('Valor do aporte inválido')
      return
    }
    const precoReferencia = Number(ativoParaAporte?.preco_atual || 1)
    if (!Number.isFinite(precoReferencia) || precoReferencia <= 0) {
      toast.error('Preço de referência inválido para calcular o aporte')
      return
    }
    const quantidade = valorAporte / precoReferencia
    const dataAporte = String(aporteData || '').trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataAporte)) {
      toast.error('Data inválida. Use o formato YYYY-MM-DD')
      return
    }

    aporteRendaFixaMutation.mutate({
      ativo: ativoParaAporte,
      quantidade,
      preco_aporte: precoReferencia,
      data_aplicacao: dataAporte,
    })
  }, [ativoParaAporte, aporteValor, aporteData, aporteRendaFixaMutation])

  useEffect(() => {
    const carregarHistoricoAportes = async () => {
      if (!aporteModalOpen || !ativoParaAporte?.ticker) {
        setHistoricoAportes([])
        return
      }
      try {
        setLoadingHistoricoAportes(true)
        const movs = await carteiraService.getMovimentacoes()
        const tickerAlvo = String(ativoParaAporte.ticker || '').toUpperCase()
        const comprasTicker = (Array.isArray(movs) ? movs : [])
          .filter((m: any) => String(m?.ticker || '').toUpperCase() === tickerAlvo && String(m?.tipo || '').toLowerCase() === 'compra')
          .sort((a: any, b: any) => String(b?.data || '').localeCompare(String(a?.data || '')))
        setHistoricoAportes(comprasTicker)
      } catch {
        setHistoricoAportes([])
      } finally {
        setLoadingHistoricoAportes(false)
      }
    }
    carregarHistoricoAportes()
  }, [aporteModalOpen, ativoParaAporte?.ticker])


  const handleAdicionar = useCallback(() => {
    if (!inputTicker.trim() || !inputQuantidade.trim()) return
    
    const quantidade = parseFloat(inputQuantidade.replace(',', '.'))
    if (isNaN(quantidade) || quantidade <= 0) return
    
    const normalizedTicker = normalizeTicker(inputTicker.trim())
    

    let precoInicialNum: number | undefined
    if (inputPreco && inputPreco.trim() !== '') {
      const pn = parseFloat(inputPreco.replace(',', '.'))
      if (!isNaN(pn)) precoInicialNum = pn
    }
    const finalTipo = inputTipo || ''
    const finalTicker = getDisplayTicker(normalizedTicker)
    const payload: any = {
      ticker: finalTicker,
      quantidade,
      tipo: finalTipo,
      preco_inicial: precoInicialNum,
      nome_personalizado: undefined,
      indexador: (inputIndexador || undefined) as any,
      indexador_pct: inputIndexadorPct && !isNaN(parseFloat(inputIndexadorPct.replace(',', '.'))) ? parseFloat(inputIndexadorPct.replace(',', '.')) : undefined,
    }
    if (inputDataAplicacao) payload.data_aplicacao = inputDataAplicacao
    if (inputVencimento) payload.vencimento = inputVencimento
    if (inputIsentoIr) payload.isento_ir = true
    adicionarMutation.mutate(payload)
  }, [inputTicker, inputQuantidade, inputTipo, inputPreco, inputIndexador, inputIndexadorPct, adicionarMutation])

  const handlePickTesouro = useCallback((item: any) => {
    // Preenche campos com base no título escolhido
    const idxNorm = (item?.indexador_normalizado || item?.indexador || '').toUpperCase()
    const tipo = 'Renda Fixa Pública'
    setInputTipo(tipo)
    // Ticker simbólico: TD-<INDEX>-<AAAA>
    const ano = item?.vencimento ? String(item.vencimento).slice(0,4) : 'NA'
    const simb = `TD-${idxNorm || 'X'}-${ano}`
    setInputTicker(simb)
    // Indexador/taxa
    if (idxNorm === 'PREFIXADO') {
      setInputIndexador('PREFIXADO')
      setInputIndexadorPct(typeof item?.taxa_compra_aa === 'number' ? String(item.taxa_compra_aa) : '')
    } else if (idxNorm === 'IPCA') {
      setInputIndexador('IPCA')
      
      setInputIndexadorPct('')
    } else if (idxNorm === 'SELIC') {
      setInputIndexador('SELIC')
      setInputIndexadorPct('100')
    } else {
      setInputIndexador('')
      setInputIndexadorPct('')
    }
    // Datas
    const today = new Date()
    setInputDataAplicacao(`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`)
    if (item?.vencimento) setInputVencimento(String(item.vencimento).slice(0,10))
  }, [])

  const handleRemover = useCallback((id: number) => {
    const ativo = (carteira || []).find((a: any) => a?.id === id)
    if (ativo) {
      setAtivoParaVender(ativo)
      setVenderModalOpen(true)
    }
  }, [carteira])

  const handleEditar = useCallback((id: number) => {
    const ativo = (carteira || []).find((a: any) => a?.id === id)
    if (ativo) {
      // Verificar se é renda fixa
      const tipoLower = (ativo?.tipo || '').toLowerCase()
      const isRendaFixa = tipoLower.includes('renda fixa') || 
                          tipoLower.includes('tesouro') ||
                          tipoLower.includes('cdb') ||
                          tipoLower.includes('lci') ||
                          tipoLower.includes('lca') ||
                          tipoLower.includes('debênture') ||
                          tipoLower.includes('debenture')
      
      if (isRendaFixa) {
        // Abrir modal de renda fixa em modo edição
        setAtivoRendaFixaParaEditar(ativo)
        setRendaFixaModalOpen(true)
      } else {
        // Abrir modal de edição normal para outros ativos
        setAtivoParaEditar(ativo)
        setEditModalOpen(true)
      }
    }
  }, [carteira])

  const handleSalvarEdicao = useCallback(() => {
    if (!editingId) return
    const payload: { id: number; quantidade?: number; preco_atual?: number } = { id: editingId }
    if (editQuantidade.trim()) {
      const quantidade = parseFloat(editQuantidade.replace(',', '.'))
      if (!isNaN(quantidade) && quantidade > 0) payload.quantidade = quantidade
    }
    if (editPreco.trim()) {
      const preco = parseFloat(editPreco.replace(',', '.'))
      if (!isNaN(preco) && preco >= 0) payload.preco_atual = preco
    }
    if (payload.quantidade == null && payload.preco_atual == null) return
    atualizarMutation.mutate(payload)
  }, [editingId, editQuantidade, editPreco, atualizarMutation])

  const handleCancelarEdicao = useCallback(() => {
    setEditingId(null)
    setEditQuantidade('')
  }, [])


  const valorTotal = carteira?.reduce((total, ativo) => total + (ativo?.valor_total || 0), 0) || 0
  const ativosPorTipo = carteira?.reduce((acc, ativo) => {
    const tipo = ativo?.tipo || 'Desconhecido'
    acc[tipo] = (acc[tipo] || 0) + (ativo?.valor_total || 0)
    return acc
  }, {} as Record<string, number>) || {}

  const ativosPositivos = carteira?.filter(ativo => ativo?.dy && ativo.dy > 0).length || 0
  const topAtivos = carteira?.slice(0, 5) || []

  const dadosGraficoProventos = useMemo(() => {
    if (!proventosRecebidos || proventosRecebidos.length === 0) return []
    
    const proventosPorMes: Record<string, number> = {}
    
    proventosRecebidos.forEach(ativo => {
      ativo.proventos_recebidos.forEach(provento => {
        const data = new Date(provento.data)
        const mesAno = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`
        
        if (!proventosPorMes[mesAno]) {
          proventosPorMes[mesAno] = 0
        }
        proventosPorMes[mesAno] += provento.valor_recebido
      })
    })
    
    return Object.entries(proventosPorMes)
      .map(([mesAno, valor]) => ({
        mes: mesAno,
        valor: valor
      }))
      .sort((a, b) => a.mes.localeCompare(b.mes))
      .slice(-12) 
  }, [proventosRecebidos])


  const IndicadorVisual = ({ 
    label, 
    valor, 
    variacao, 
    icon: Icon, 
    color = 'blue',
    loading = false
  }: { 
    label: string
    valor: string
    variacao?: number
    icon: any
    color?: string
    loading?: boolean
  }) => (
    <div className="bg-card border border-border rounded-lg p-4 hover:shadow-lg transition-all duration-200">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className={`w-5 h-5 text-${color}-500`} />
          <span className="font-medium text-sm text-muted-foreground">{label}</span>
        </div>
        {variacao !== undefined && !loading && (
          <div className={`flex items-center gap-1 text-sm ${
            variacao > 0 ? 'text-green-500' : variacao < 0 ? 'text-red-500' : 'text-gray-500'
          }`}>
            {variacao > 0 ? <ArrowUpRight size={14} /> : variacao < 0 ? <ArrowDownRight size={14} /> : <Minus size={14} />}
            <span>{Math.abs(variacao).toFixed(2)}%</span>
          </div>
        )}
      </div>
      {loading ? (
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-24"></div>
        </div>
      ) : (
        <div className="text-2xl font-bold">{valor}</div>
      )}
    </div>
  )


  const TabButton = ({ id, label, icon: Icon, isActive }: { id: string; label: string; icon: any; isActive: boolean }) => (
    <button
      onClick={() => {
        setActiveTab(id)
        setSearchParams({ tab: id }, { replace: true })
      }}
      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all duration-200 text-sm ${
        isActive 
          ? 'bg-primary text-primary-foreground shadow-md' 
          : 'bg-muted text-muted-foreground hover:bg-muted/80'
      }`}
    >
      <Icon size={14} />
      {label}
    </button>
  )






  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold">Minha Carteira</h1>
          <HelpTips
            title="Como usar a Carteira"
            tips={[
              { title: 'Adicionar ativos', content: 'Use o formulário para incluir ticker, quantidade, tipo e opcionalmente preço e indexador (CDI/IPCA/SELIC). Itens sem dados do yfinance também são aceitos.' },
              { title: 'Tipos dinâmicos', content: 'Crie/renomeie tipos. As tabelas se adaptam automaticamente aos tipos existentes na carteira.' },
              { title: 'Indexados', content: 'Preencha % do indexador para ver a rentabilidade estimada anual, calculada com base em CDI/IPCA/SELIC reais.' },
              { title: 'Rebalanceamento', content: 'Na aba Rebalanceamento, defina metas por classe, período e registre histórico. O status mostra desvios e sugestões.' },
            ]}
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setOcultarValor(!ocultarValor)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50 transition-colors text-sm"
            title={ocultarValor ? 'Mostrar valor' : 'Ocultar valor'}
          >
            {ocultarValor ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            <span>{ocultarValor ? 'Mostrar Valor' : 'Ocultar Valor'}</span>
          </button>
        </div>
      </div>

      {/* Indicadores Visuais - Renderizam imediatamente com skeletons */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <IndicadorVisual
          label="Valor Total"
          valor={ocultarValor ? '•••••••' : formatCurrency(valorTotal)}
          icon={DollarSign}
          color="green"
          loading={loadingCarteira}
        />
        <IndicadorVisual
          label="Total de Ativos"
          valor={carteira?.length.toString() || '0'}
          icon={Target}
          color="blue"
          loading={loadingCarteira}
        />
        <IndicadorVisual
          label="Ativos com DY"
          valor={`${ativosPositivos} / ${carteira?.length || 0}`}
          icon={TrendingUp}
          color="purple"
          loading={loadingCarteira}
        />
        <IndicadorVisual
          label="Movimentações"
          valor={movimentacoes?.length.toString() || '0'}
          icon={Activity}
          color="orange"
          loading={loadingCarteira}
        />
      </div>

      
      {/* Navegação por Abas */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <TabButton id="ativos" label="Ativos" icon={Target} isActive={activeTab === 'ativos'} />
        <TabButton id="graficos" label="Gráficos" icon={BarChart3} isActive={activeTab === 'graficos'} />
        <TabButton id="ranking" label="Ranking" icon={Trophy} isActive={activeTab === 'ranking'} />
        <TabButton id="proventos" label="Proventos" icon={Calendar} isActive={activeTab === 'proventos'} />
        <TabButton id="impostos" label="Impostos" icon={Receipt} isActive={activeTab === 'impostos'} />
        <TabButton id="insights" label="Insights" icon={Brain} isActive={activeTab === 'insights'} />
        <TabButton id="rebalance" label="Rebalanceamento" icon={Target} isActive={activeTab === 'rebalance'} />
        <TabButton id="movimentacoes" label="Movimentações" icon={History} isActive={activeTab === 'movimentacoes'} />
        <TabButton id="relatorios" label="Relatórios & Backup" icon={FileText} isActive={activeTab === 'relatorios'} />
        <TabButton id="projecao" label="Projeção" icon={Calculator} isActive={activeTab === 'projecao'} />
        <TabButton id="simulador" label="Simulador" icon={Zap} isActive={activeTab === 'simulador'} />
      </div>

      {/* Conteúdo das Abas */}
      <div className="bg-card border border-border rounded-lg p-6 shadow-lg">
        {/* CTA destacado para adicionar ativo (somente na aba Ativos) */}
        {activeTab === 'ativos' && (
          <div className="mb-4 rounded-xl border border-border bg-gradient-to-r from-primary/10 to-primary/5 p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">Adicionar novo ativo</div>
              <div className="text-base sm:text-lg font-semibold text-foreground truncate">Ações, FIIs, BDRs e Renda Fixa</div>
              <div className="text-xs text-muted-foreground">Dica: pressione Ctrl+I para abrir rapidamente</div>
            </div>
            <button
              onClick={()=>setAddModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 shadow text-sm"
            >
              <PlusCircle size={18} /> Adicionar Ativo
            </button>
          </div>
        )}
        {/* Modal de gerenciamento de tipo */}
        {manageTipoOpen.open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={()=>setManageTipoOpen({open:false})}></div>
            <div className="relative bg-card border border-border rounded-lg p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-semibold mb-4">Gerenciar tipo: {manageTipoOpen.tipo}</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Renomear para</label>
                  <input
                    type="text"
                    value={renameTipoValue}
                    onChange={(e)=>setRenameTipoValue(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-border rounded bg-background text-foreground text-sm"
                    placeholder="Novo nome do tipo"
                    aria-label="Novo nome do tipo"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    onClick={()=>setManageTipoOpen({open:false})}
                    className="px-2.5 py-1.5 rounded bg-muted text-foreground hover:bg-muted/80 text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={async ()=>{
                      if (!manageTipoOpen.tipo) return
                      try {
                        await carteiraService.renomearTipo(manageTipoOpen.tipo, renameTipoValue)
                        queryClient.invalidateQueries({ queryKey: ['tipos-ativos', user] })
                        queryClient.invalidateQueries({ queryKey: ['carteira', user] })
                        setManageTipoOpen({open:false})
                      } catch {}
                    }}
                    className="px-2.5 py-1.5 rounded bg-primary text-primary-foreground hover:bg-primary/90 text-sm"
                  >
                    Salvar
                  </button>
                  {/* Exclusão removida do modal conforme solicitado */}
                </div>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'ativos' && (
          <CarteiraAtivosTab
            adicionarMutation={adicionarMutation}
            carteira={carteira || []}
            loadingCarteira={loadingCarteira}
            ativosPorTipo={ativosPorTipo}
            valorTotal={valorTotal}
            editingId={editingId}
            editQuantidade={editQuantidade}
            setEditQuantidade={setEditQuantidade}
            editPreco={editPreco}
            setEditPreco={setEditPreco}
            handleEditar={handleEditar}
            handleSalvarEdicao={handleSalvarEdicao}
            handleCancelarEdicao={handleCancelarEdicao}
            handleRemover={handleRemover}
            expandedTipos={expandedTipos}
            setExpandedTipos={setExpandedTipos}
            setManageTipoOpen={setManageTipoOpen}
            setRenameTipoValue={setRenameTipoValue}
            movimentacoesAll={movimentacoesAll || []}
            indicadores={indicadores}
            topAtivos={topAtivos}
            onAporteRendaFixa={handleAporteRendaFixa}
            onOpenAddAtivo={() => setAddModalOpen(true)}
          />
        )}

        {activeTab === 'graficos' && (
          <CarteiraGraficosTab
            carteira={carteira || []}
            valorTotal={valorTotal}
            loadingHistorico={loadingHistorico}
            historicoCarteira={historicoCarteira as any || null}
            historicoParaCalendario={historicoParaCalendario as any || null}
            filtroPeriodo={filtroPeriodo}
            setFiltroPeriodo={(value: string) => setFiltroPeriodo(value as "mensal" | "trimestral" | "semestral" | "anual" | "maximo")}
            ativosPorTipo={ativosPorTipo}
            proventosRecebidos={proventosRecebidosGraficos ?? []}
            loadingProventos={loadingProventosGraficos}
            filtroProventosGraficos={filtroProventosGraficos}
            setFiltroProventosGraficos={(v: string) => setFiltroProventosGraficos(v as 'mes' | '6meses' | '1ano' | '5anos' | 'total')}
          />
        )}


        {activeTab === 'ranking' && (
          <CarteiraRankingTab
            carteira={carteira || []}
          />
        )}

        {activeTab === 'proventos' && (
          <CarteiraProventosTab
            carteira={carteira || []}
            filtroProventos={filtroProventos}
            setFiltroProventos={(value: string) => setFiltroProventos(value as any)}
            loadingProventos={loadingProventos}
            proventosError={proventosError}
            proventos={proventos || []}
            loadingProventosRecebidos={loadingProventosRecebidos}
            proventosRecebidosError={proventosRecebidosError}
            proventosRecebidos={proventosRecebidos || []}
            dadosGraficoProventos={dadosGraficoProventos || []}
          />
        )}

        {activeTab === 'impostos' && !podeVerImpostos && (
          <motion.div
            key="impostos-premium"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="py-8 sm:py-12"
          >
            <div className="max-w-xl mx-auto text-center space-y-6">
              <div className="inline-flex p-4 rounded-2xl bg-primary/10 dark:bg-primary/20 text-primary">
                <Receipt className="w-12 h-12" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground mb-1">Aba Impostos</h3>
                <p className="text-sm text-muted-foreground">
                  Conteúdo exclusivo para assinantes premium. Veja o que você ganha com acesso.
                </p>
              </div>
              <div className="text-left rounded-xl border border-border dark:border-white/20 bg-muted/30 dark:bg-white/[0.04] p-5 space-y-3">
                <p className="text-sm font-medium text-foreground flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  O que tem na aba Impostos
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    <span><strong className="text-foreground">IR sobre vendas</strong> — Ganho de capital com preço médio FIFO, day trade, isenção até R$ 20 mil/mês e alíquotas por tipo de ativo (ações, FIIs, BDRs, renda fixa).</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    <span><strong className="text-foreground">IR sobre proventos</strong> — Dividendos, JCP e outros proventos com retenção na fonte e imposto devido.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    <span><strong className="text-foreground">Filtros e exportação</strong> — Por período (mês, trimestre, ano, total) e tipo (vendas/proventos), com exportação para Excel.</span>
                  </li>
                </ul>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  to="/vendas"
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90"
                >
                  <Sparkles className="w-4 h-4" />
                  Quero ter acesso à aba Impostos
                </Link>
                <button
                  type="button"
                  onClick={() => setActiveTab('ativos')}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-border hover:bg-muted text-sm font-medium"
                >
                  Ver outra aba
                </button>
              </div>
            </div>
          </motion.div>
        )}
        {activeTab === 'impostos' && podeVerImpostos && (
          <CarteiraImpostosTab
            carteira={carteira || []}
            movimentacoes={movimentacoesAll || []}
            proventosRecebidos={proventosRecebidos || []}
            loadingMovimentacoes={loadingMovimentacoes}
            loadingProventos={loadingProventosRecebidos}
          />
        )}

        {activeTab === 'insights' && !podeVerInsights && (
          <motion.div
            key="insights-premium"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="py-8 sm:py-12"
          >
            <div className="max-w-xl mx-auto text-center space-y-6">
              <div className="inline-flex p-4 rounded-2xl bg-primary/10 dark:bg-primary/20 text-primary">
                <Brain className="w-12 h-12" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground mb-1">Aba Insights</h3>
                <p className="text-sm text-muted-foreground">
                  Conteúdo exclusivo para assinantes premium. Veja o que você ganha com acesso.
                </p>
              </div>
              <div className="text-left rounded-xl border border-border dark:border-white/20 bg-muted/30 dark:bg-white/[0.04] p-5 space-y-3">
                <p className="text-sm font-medium text-foreground flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  O que tem na aba Insights
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    <span><strong className="text-foreground">Análise de correlação</strong> — Matriz de correlação entre os ativos da carteira para entender diversificação e risco.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    <span><strong className="text-foreground">Insights automáticos</strong> — Sugestões e alertas com base na composição e performance da sua carteira.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    <span><strong className="text-foreground">Período configurável</strong> — Correlação em 6 meses, 1 ano ou 2 anos para diferentes horizontes.</span>
                  </li>
                </ul>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  to="/vendas"
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90"
                >
                  <Sparkles className="w-4 h-4" />
                  Quero ter acesso à aba Insights
                </Link>
                <button
                  type="button"
                  onClick={() => setActiveTab('ativos')}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-border hover:bg-muted text-sm font-medium"
                >
                  Ver outra aba
                </button>
              </div>
            </div>
          </motion.div>
        )}
        {activeTab === 'insights' && podeVerInsights && (
          <CarteiraInsightsTab
            carteira={carteira || []}
            loadingInsights={loadingInsights}
            insights={insights}
          />
        )}

        {activeTab === 'rebalance' && (
          <CarteiraRebalanceamentoTab
            carteira={carteira || []}
                valorTotal={valorTotal}
            rbConfig={rbConfig}
            idealPreview={idealPreview}
            setIdealPreview={setIdealPreview}
            idealTargets={idealTargets}
            rbStatus={rbStatus}
            rbHistory={rbHistory}
            saveRebalanceMutation={saveRebalanceMutation}
            queryClient={queryClient}
            user={user}
            carteiraService={carteiraService}
            toast={toast}
          />
        )}

        {activeTab === 'movimentacoes' && (
          <CarteiraMovimentacoesTab
            filtroMes={filtroMes}
            setFiltroMes={setFiltroMes}
            filtroAno={filtroAno}
            setFiltroAno={setFiltroAno}
            loadingMovimentacoes={loadingMovimentacoes}
            movimentacoes={movimentacoes || []}
          />
        )}

        {activeTab === 'relatorios' && (
          <CarteiraRelatoriosTab
            carteira={carteira || []}
            carteiraService={carteiraService}
          />
        )}

        {activeTab === 'projecao' && !podeVerProjecao && (
          <motion.div
            key="projecao-premium"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="py-8 sm:py-12"
          >
            <div className="max-w-xl mx-auto text-center space-y-6">
              <div className="inline-flex p-4 rounded-2xl bg-primary/10 dark:bg-primary/20 text-primary">
                <Calculator className="w-12 h-12" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground mb-1">Aba Projeção</h3>
                <p className="text-sm text-muted-foreground">
                  Conteúdo exclusivo para assinantes premium. Veja o que você ganha com acesso.
                </p>
              </div>
              <div className="text-left rounded-xl border border-border dark:border-white/20 bg-muted/30 dark:bg-white/[0.04] p-5 space-y-3">
                <p className="text-sm font-medium text-foreground flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  O que tem na aba Projeção
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    <span><strong className="text-foreground">Projeção de valor</strong> — Evolução do patrimônio com ou sem dividendos e com aportes periódicos.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    <span><strong className="text-foreground">Metas de renda e patrimônio</strong> — Defina um alvo e veja em quanto tempo sua carteira pode alcançar.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    <span><strong className="text-foreground">Gráficos e metas de aporte</strong> — Histórico, projeção futura e acompanhamento de metas de aporte mensal ou anual.</span>
                  </li>
                </ul>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  to="/vendas"
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90"
                >
                  <Sparkles className="w-4 h-4" />
                  Quero ter acesso à aba Projeção
                </Link>
                <button
                  type="button"
                  onClick={() => setActiveTab('ativos')}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-border hover:bg-muted text-sm font-medium"
                >
                  Ver outra aba
                </button>
              </div>
            </div>
          </motion.div>
        )}
        {activeTab === 'projecao' && podeVerProjecao && (
          <CarteiraProjecaoTab
            carteira={carteira || []}
            historicoCarteira={historicoCarteira ?? undefined}
            loadingHistoricoCarteira={loadingHistorico}
            proventosRecebidos={proventosRecebidos || []}
            filtroPeriodo={filtroPeriodo}
            setFiltroPeriodo={(value: string) => setFiltroPeriodo(value as "mensal" | "trimestral" | "semestral" | "anual" | "maximo")}
          />
        )}

        {activeTab === 'simulador' && !podeVerSimulador && (
          <motion.div
            key="simulador-premium"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="py-8 sm:py-12"
          >
            <div className="max-w-xl mx-auto text-center space-y-6">
              <div className="inline-flex p-4 rounded-2xl bg-primary/10 dark:bg-primary/20 text-primary">
                <Zap className="w-12 h-12" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground mb-1">Aba Simulador</h3>
                <p className="text-sm text-muted-foreground">
                  Conteúdo exclusivo para assinantes premium. Veja o que você ganha com acesso.
                </p>
              </div>
              <div className="text-left rounded-xl border border-border dark:border-white/20 bg-muted/30 dark:bg-white/[0.04] p-5 space-y-3">
                <p className="text-sm font-medium text-foreground flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  O que tem na aba Simulador
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    <span><strong className="text-foreground">Choques de indexadores</strong> — Simule impacto de variações em CDI, IPCA e SELIC na sua carteira de renda fixa.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    <span><strong className="text-foreground">Cenários predefinidos</strong> — Otimista, pessimista, crise e inflação alta para stress test rápido.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    <span><strong className="text-foreground">Monte Carlo</strong> — Simulações probabilísticas para enxergar faixas de resultado no longo prazo.</span>
                  </li>
                </ul>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  to="/vendas"
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90"
                >
                  <Sparkles className="w-4 h-4" />
                  Quero ter acesso à aba Simulador
                </Link>
                <button
                  type="button"
                  onClick={() => setActiveTab('ativos')}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-border hover:bg-muted text-sm font-medium"
                >
                  Ver outra aba
                </button>
              </div>
            </div>
          </motion.div>
        )}
        {activeTab === 'simulador' && podeVerSimulador && (
          <CarteiraSimuladorTab carteira={carteira || []} />
        )}
      </div>
      {/* FAB mobile para adicionar ativo rapidamente (somente na aba Ativos) */}
      {activeTab === 'ativos' && (
        <div className="md:hidden fixed bottom-6 right-6 z-20">
          <button
            onClick={() => setAddModalOpen(true)}
            className="rounded-full p-4 bg-primary text-primary-foreground shadow-lg"
            aria-label="Adicionar ativo"
            title="Adicionar ativo"
          >
            <PlusCircle size={20} />
          </button>
        </div>
      )}
      {activeTab === 'ativos' && addModalOpen && (
        <AddAtivoModal open={addModalOpen} onClose={()=>setAddModalOpen(false)} carteira={carteira || []} />
      )}

      {aporteModalOpen && ativoParaAporte && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-border rounded-t-xl sm:rounded-lg p-4 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto space-y-4"
          >
            <div>
              <h3 className="text-lg font-semibold">Registrar aporte em renda fixa</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Título: <strong>{ativoParaAporte?.ticker || ativoParaAporte?.nome_completo}</strong>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                O aporte pede apenas valor e data. O sistema converte internamente pela cotação atual do título.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label htmlFor="aporte-valor-input" className="block text-sm font-medium mb-1">Valor do aporte (R$)</label>
                <input
                  id="aporte-valor-input"
                  type="text"
                  inputMode="decimal"
                  value={aporteValor}
                  onChange={(e) => setAporteValor(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                  placeholder="Ex.: 1500,00"
                />
              </div>
              <div>
                <label htmlFor="aporte-cotacao-atual" className="block text-sm font-medium mb-1">Cotação de referência atual</label>
                <input
                  id="aporte-cotacao-atual"
                  type="text"
                  readOnly
                  value={formatCurrency(Number(ativoParaAporte?.preco_atual || 1))}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-muted text-muted-foreground"
                />
              </div>
              <div>
                <label htmlFor="aporte-data-input" className="block text-sm font-medium mb-1">Data do aporte</label>
                <input
                  id="aporte-data-input"
                  type="date"
                  value={aporteData}
                  onChange={(e) => setAporteData(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                />
              </div>
            </div>

            <div className="border-t border-border pt-3 space-y-2">
              <h4 className="text-sm font-semibold">Histórico de aportes/compras</h4>
              {loadingHistoricoAportes ? (
                <div className="text-sm text-muted-foreground">Carregando histórico…</div>
              ) : historicoAportes.length > 0 ? (
                <div className="max-h-40 overflow-y-auto border border-border rounded">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/30">
                      <tr>
                        <th className="px-2 py-1 text-left">Data</th>
                        <th className="px-2 py-1 text-left">Qtd</th>
                        <th className="px-2 py-1 text-left">Preço</th>
                        <th className="px-2 py-1 text-left">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historicoAportes.slice(0, 50).map((m: any, idx: number) => {
                        const qtd = Number(m?.quantidade || 0)
                        const preco = Number(m?.preco || 0)
                        return (
                          <tr key={`${m?.id || idx}-${m?.data || ''}`} className="border-b border-border/50">
                            <td className="px-2 py-1">{String(m?.data || '').slice(0, 10)}</td>
                            <td className="px-2 py-1">{qtd.toFixed(4)}</td>
                            <td className="px-2 py-1">{formatCurrency(preco)}</td>
                            <td className="px-2 py-1">{formatCurrency(qtd * preco)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Sem histórico de aportes para este título.</div>
              )}
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setAporteModalOpen(false)
                  setAtivoParaAporte(null)
                }}
                className="w-full sm:w-auto px-4 py-2.5 border border-border rounded-lg hover:bg-muted transition-colors"
                disabled={aporteRendaFixaMutation.isPending}
              >
                Cancelar
              </button>
              <button
                onClick={handleSalvarAporte}
                disabled={aporteRendaFixaMutation.isPending}
                className="w-full sm:w-auto px-4 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {aporteRendaFixaMutation.isPending ? 'Salvando...' : 'Confirmar aporte'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
      
      {/* Modal de editar ativo */}
      {editModalOpen && (
        <EditAtivoModal
          open={editModalOpen}
          onClose={() => {
            setEditModalOpen(false)
            setAtivoParaEditar(null)
          }}
          ativo={ativoParaEditar}
        />
      )}

      {/* Modal de vender ativo (aberto pelo botão apagar) */}
      {venderModalOpen && (
        <VenderAtivoModal
          open={venderModalOpen}
          onClose={() => {
            setVenderModalOpen(false)
            setAtivoParaVender(null)
          }}
          ativo={ativoParaVender}
        />
      )}

      {/* Modal de editar renda fixa */}
      {rendaFixaModalOpen && (
        <RendaFixaFormModal
          open={rendaFixaModalOpen}
          onClose={() => {
            setRendaFixaModalOpen(false)
            setAtivoRendaFixaParaEditar(null)
          }}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['carteira', user] })
            queryClient.invalidateQueries({ queryKey: ['carteira'] })
          }}
          initialData={ativoRendaFixaParaEditar}
          editingMode={true}
          emissorSuggestions={emissorRfSuggestions}
        />
      )}
    </div>
  )
} 



