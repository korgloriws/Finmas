import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Search, 
  BarChart3, 
  DollarSign, 
  Target, 
  FileText,
  PieChart,
  LineChart,
  RefreshCw,
  ScanLine,
} from 'lucide-react'
import { ativoService } from '../services/api'
import { AtivoDetalhes, AtivoInfo } from '../types'
import { normalizeTicker, getDisplayTicker } from '../utils/tickerUtils'
import { useAnalise } from '../contexts/AnaliseContext'
import { verificarEstrategia } from '../utils/strategyChecker'
import DetalhesVisaoGeralTab from '../components/detalhes/DetalhesVisaoGeralTab'
import DetalhesFundamentalsTab from '../components/detalhes/DetalhesFundamentalsTab'
import DetalhesChartsTab from '../components/detalhes/DetalhesChartsTab'
import DetalhesDividendsTab from '../components/detalhes/DetalhesDividendsTab'
import DetalhesHistoryTab from '../components/detalhes/DetalhesHistoryTab'
import DetalhesConceptsTab from '../components/detalhes/DetalhesConceptsTab'
import DetalhesComparisonTab from '../components/detalhes/DetalhesComparisonTab'
import DetalhesFixedIncomeTab from '../components/detalhes/DetalhesFixedIncomeTab'
import DetalhesRadarDividendosTab from '../components/detalhes/DetalhesRadarDividendosTab'

export default function DetalhesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [inputTicker, setInputTicker] = useState('')
  const [periodo, setPeriodo] = useState('1y')
  const [periodoOverview, setPeriodoOverview] = useState<'1d' | '1w' | '1m' | '3m' | '6m' | '1y' | '5y' | 'max'>('1y') // Período para gráfico da visão geral
  const [fiPeriodo, setFiPeriodo] = useState<'6m' | '1y' | '3y' | '5y' | 'max'>('1y')
  const [, setTickersComparar] = useState<string[]>([])
  const compararInputRef = useRef<HTMLInputElement>(null)
  const [periodoDividendos, setPeriodoDividendos] = useState('1y')
  const [activeTab, setActiveTab] = useState<'overview' | 'fundamentals' | 'charts' | 'comparison' | 'dividends' | 'history' | 'concepts' | 'fixedincome' | 'radar-dividendos'>('overview')

  // Obter filtros do contexto de análise
  const { filtrosAcoes, filtrosBdrs, filtrosFiis } = useAnalise()

  const ticker = searchParams.get('ticker') || ''

  const { data: detalhes, isLoading: loadingDetalhes, error: errorDetalhes, refetch: refetchDetalhes } = useQuery<AtivoDetalhes & { fii?: Record<string, any> }>({
    queryKey: ['ativo-detalhes', ticker],
    queryFn: () => ativoService.getDetalhes(ticker),
    enabled: !!ticker,
  })

  
  const isFiiBrasileiro = ticker && (ticker.toUpperCase().endsWith('11.SA') || ticker.toUpperCase().endsWith('11'))
  
  // OTIMIZAÇÃO: Carregar metadados básicos do FII sem portfólio (mais rápido)
  const { data: fiiMetadata } = useQuery({
    queryKey: ['fii-metadata', ticker],
    queryFn: () => ativoService.getFiiMetadata(ticker, false), // false = sem portfólio
    enabled: Boolean(ticker) && Boolean(isFiiBrasileiro),
    staleTime: 60 * 60 * 1000, 
    retry: 1, 
  })

  // OTIMIZAÇÃO: Carregar portfólio apenas quando necessário (aba overview ativa e é FII de tijolo)
  const { data: fiiMetadataComPortfolio } = useQuery({
    queryKey: ['fii-metadata-portfolio', ticker],
    queryFn: () => ativoService.getFiiMetadata(ticker, true), // true = com portfólio
    enabled: Boolean(ticker) && Boolean(isFiiBrasileiro) && activeTab === 'overview' && fiiMetadata?.tipo === 'Tijolo',
    staleTime: 60 * 60 * 1000, 
    retry: 1, 
  })
  
  // Usar metadados com portfólio se disponível, senão usar os básicos
  const fiiMetadataFinal = fiiMetadataComPortfolio || fiiMetadata

  // Mapear período do frontend para formato do yfinance
  const mapearPeriodoParaYFinance = (periodo: string): string => {
    const mapa: Record<string, string> = {
      '1d': '1d',
      '1w': '5d', // yfinance não tem '1w', usa '5d' (5 dias úteis ≈ 1 semana)
      '1m': '1mo',
      '3m': '3mo',
      '6m': '6mo',
      '1y': '1y',
      '5y': '5y',
      'max': 'max'
    }
    return mapa[periodo] || '1y'
  }

  // Carregar histórico para overview (com período específico) e charts
  const { data: historicoOverview, isLoading: loadingHistoricoOverview } = useQuery<Array<Record<string, any>>>({
    queryKey: ['ativo-historico-overview', ticker, periodoOverview],
    queryFn: () => ativoService.getHistorico(ticker, mapearPeriodoParaYFinance(periodoOverview)),
    enabled: !!ticker && activeTab === 'overview', // Carrega apenas na aba overview
    staleTime: 10 * 60 * 1000, // 10 minutos de cache
    refetchOnWindowFocus: false,
  })

  // Carregar histórico para charts (com período da aba charts)
  const { data: historico, isLoading: loadingHistorico } = useQuery<Array<Record<string, any>>>({
    queryKey: ['ativo-historico', ticker, periodo],
    queryFn: () => ativoService.getHistorico(ticker, periodo),
    enabled: !!ticker && activeTab === 'charts', // Carrega apenas na aba charts
    staleTime: 10 * 60 * 1000, // 10 minutos de cache
    refetchOnWindowFocus: false,
  })

  
  const yfPeriodMap: Record<typeof fiPeriodo, string> = {
    '6m': '6mo',
    '1y': '1y',
    '3y': '3y',
    '5y': '5y',
    'max': 'max',
  }
  // OTIMIZAÇÃO: Carregar histórico FI apenas quando necessário (aba charts)
  const { data: historicoFI } = useQuery<Array<Record<string, any>>>({
    queryKey: ['ativo-historico-fi', ticker, fiPeriodo],
    queryFn: () => ativoService.getHistorico(ticker, yfPeriodMap[fiPeriodo]),
    enabled: !!ticker && activeTab === 'charts', // Só carrega na aba de gráficos
    staleTime: 10 * 60 * 1000, // 10 minutos de cache
    refetchOnWindowFocus: false,
  })



  const [comparacao, setComparacao] = useState<AtivoInfo[]>([])
  const [loadingComparacao, setLoadingComparacao] = useState(false)

  const handleBuscar = useCallback(() => {
    if (inputTicker.trim()) {
      const normalizedTicker = normalizeTicker(inputTicker.trim())
      setSearchParams({ ticker: getDisplayTicker(normalizedTicker) })
    }
  }, [inputTicker, setSearchParams])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInputTicker(e.target.value)
  }, [])

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleBuscar()
    }
  }, [handleBuscar])



  

  const handleComparar = useCallback(async () => {
    const value = compararInputRef.current?.value || ''
    if (!value.trim()) {
      setTickersComparar([])
      setComparacao([])
      return
    }
    const tickers = value.split(',').map(t => t.trim()).filter(t => t)
    setTickersComparar(tickers)
    
    setLoadingComparacao(true)
    try {
      const resultado = await ativoService.comparar([...tickers, ticker].filter(Boolean))
      setComparacao(resultado)
    } catch (error) {
      console.error('Erro ao comparar ativos:', error)
      setComparacao([])
    } finally {
      setLoadingComparacao(false)
    }
  }, [ticker])

  const handleCompararKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleComparar()
    }
  }, [handleComparar])

  const handlePeriodoChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setPeriodo(e.target.value)
  }, [])

  const handlePeriodoDividendosChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setPeriodoDividendos(e.target.value)
  }, [])

  const { data: logoUrl } = useQuery<string | null>({
    queryKey: ['logo', ticker],
    queryFn: () => ativoService.getLogoUrl(ticker),
    enabled: !!ticker,
  })

  useEffect(() => {
    if (ticker && ticker !== inputTicker) {
      setInputTicker(ticker)
    }
  }, [ticker])


  const info: any = detalhes?.info || {}
  
 
  const fiiInfo: any = useMemo(() => {
    const baseFiiInfo = detalhes?.fii || {}
    

    if (fiiMetadata && Object.keys(fiiMetadata).length > 0) {
      return {
        ...baseFiiInfo,
       
        tipo: fiiMetadata.tipo || baseFiiInfo.tipo,
        segmento: fiiMetadata.segmento || baseFiiInfo.segmento,
        vacancia: fiiMetadata.vacancia ?? baseFiiInfo.vacancia,
        num_cotistas: fiiMetadata.num_cotistas ?? baseFiiInfo.num_cotistas,
        gestora: fiiMetadata.gestora || baseFiiInfo.gestora,
        fonte_metadata: fiiMetadata.fonte, 
      }
    }
    
    return baseFiiInfo
  }, [detalhes?.fii, fiiMetadata])

  
  const tipoAtivo: 'Ação' | 'BDR' | 'FII' = useMemo(() => {
    const sym = (info?.symbol || ticker || '').toUpperCase()
    const base = sym.replace('.SA', '')
    if (base.endsWith('11')) return 'FII'
    const sufixo = base.slice(-2)
    const num = parseInt(sufixo, 10)
    if ([31, 32, 33, 34, 35, 36, 39, 40].includes(num)) return 'BDR'
    return 'Ação'
  }, [info, ticker])


  const roePct = useMemo(() => {
    const v = info?.returnOnEquity as number | undefined
    if (v == null) return null
    return v * 100 
  }, [info])

  const dyPct = useMemo(() => {
    
    if (tipoAtivo === 'FII') {
      if (typeof fiiInfo?.dy_12m === 'number') return fiiInfo.dy_12m
      const d = info?.dividendYield as number | undefined
      return d != null ? d * 100 : null
    }
    const d = info?.dividendYield as number | undefined
    return d != null ? d * 100 : null
  }, [info, fiiInfo, tipoAtivo])

  const pl = info?.trailingPE ?? null
  const pvp = info?.priceToBook ?? null
  const volumeMedio = info?.averageDailyVolume10Day ?? info?.averageVolume ?? 0
  const precoAtual = info?.currentPrice ?? info?.regularMarketPrice ?? 0
  const liquidezDiaria = precoAtual * volumeMedio

  // EV/EBIT: usar enterpriseValue e melhor proxy de EBIT disponível
  const enterpriseValue: number | null = info?.enterpriseValue ?? null
  const ebitComputed: number | null = useMemo(() => {
    const ebit = (info as any)?.ebit
    if (typeof ebit === 'number') return ebit
    const operatingIncome = (info as any)?.operatingIncome
    if (typeof operatingIncome === 'number') return operatingIncome
    const ebitda = (info as any)?.ebitda
    const da = (info as any)?.depreciationAndAmortization
    if (typeof ebitda === 'number' && typeof da === 'number') return ebitda - da
    return null
  }, [info])
  const evToEbit: number | null = useMemo(() => {
    if (enterpriseValue == null || ebitComputed == null) return null
    if (!isFinite(enterpriseValue) || !isFinite(ebitComputed) || ebitComputed === 0) return null
    return enterpriseValue / ebitComputed
  }, [enterpriseValue, ebitComputed])

  // Conceitos: entradas e cálculos (Graham e Bazin)
  const defaultGrowthPct = useMemo(() => {
    const eg = (info?.earningsGrowth != null) ? (Number(info.earningsGrowth) * 100) : null
    const rg = (info?.revenueGrowth != null) ? (Number(info.revenueGrowth) * 100) : null
    if (eg != null && isFinite(eg)) return eg
    if (rg != null && isFinite(rg)) return rg
    return 0
  }, [info])
  const grahamGrowthPctValue = defaultGrowthPct
  const isBrazilian = useMemo(() => {
    const sym = (info?.symbol || ticker || '').toUpperCase()
    return sym.endsWith('.SA') || (info?.country?.toLowerCase?.() === 'brazil')
  }, [info, ticker])
  const { data: selicPct } = useQuery<number | undefined>({
    queryKey: ['selic-rate', ticker],
    enabled: !!ticker && isBrazilian,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
    queryFn: async () => {
      const codes = [1178, 432, 4189]
      for (const code of codes) {
        try {
          const res = await fetch(`https://api.bcb.gov.br/dados/serie/bcdata.sgs.${code}/dados/ultimos/1?formato=json`)
          if (!res.ok) continue
          const json = await res.json()
          const val = parseFloat(json?.[0]?.valor)
          if (isFinite(val) && val > 0) return val
        } catch (_) {
          continue
        }
      }
      return undefined
    }
  })
  const grahamYieldPctValue = selicPct ?? 6.0
  const [bazinRatePct, setBazinRatePct] = useState<number>(8.0)
 
  const [grahamEPSOverride, setGrahamEPSOverride] = useState<number | null>(null)
  const [grahamGOverride, setGrahamGOverride] = useState<number | null>(null)
  const [grahamYOverride, setGrahamYOverride] = useState<number | null>(null)
  const [grahamEPSText, setGrahamEPSText] = useState<string>('')
  const [grahamGText, setGrahamGText] = useState<string>('')
  const [grahamYText, setGrahamYText] = useState<string>('')

  const eps = (typeof info?.trailingEps === 'number') ? Number(info.trailingEps) : null
  const effectiveEPS = grahamEPSOverride ?? eps
  const effectiveG = grahamGOverride ?? grahamGrowthPctValue
  const effectiveY = grahamYOverride ?? grahamYieldPctValue
  const grahamFairPrice = useMemo(() => {
    if (effectiveEPS == null || !isFinite(effectiveEPS)) return null
    const g = Number(effectiveG)
    const Y = Number(effectiveY)
    if (!isFinite(g) || !isFinite(Y) || Y <= 0) return null
    const base = 8.5 + 2 * g
    const factor = 4.4 / Y
    return effectiveEPS * base * factor
  }, [effectiveEPS, effectiveG, effectiveY])

  
  const fiStartDate = useMemo(() => {
    const now = new Date()
    const d = new Date(now)
    if (fiPeriodo === '6m') d.setMonth(d.getMonth() - 6)
    else if (fiPeriodo === '1y') d.setFullYear(d.getFullYear() - 1)
    else if (fiPeriodo === '3y') d.setFullYear(d.getFullYear() - 3)
    else if (fiPeriodo === '5y') d.setFullYear(d.getFullYear() - 5)
    else d.setFullYear(d.getFullYear() - 10)
    return d
  }, [fiPeriodo])
  const fiEndDate = useMemo(() => new Date(), [])
  const toBr = (dt: Date) => {
    const day = String(dt.getDate()).padStart(2, '0')
    const mm = String(dt.getMonth() + 1).padStart(2, '0')
    const yy = dt.getFullYear()
    return `${day}/${mm}/${yy}`
  }
  const toLabel = (dt: Date) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
  const monthEnds = useMemo(() => {
    const out: Date[] = []
    const cur = new Date(fiStartDate.getFullYear(), fiStartDate.getMonth(), 1)
    const end = new Date(fiEndDate.getFullYear(), fiEndDate.getMonth(), 1)
    const nextMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 1)
    const monthEnd = (d: Date) => new Date(new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime() - 24 * 3600 * 1000)
    let it = new Date(cur)
    while (it <= end) {
      out.push(monthEnd(it))
      it = nextMonth(it)
    }
    return out
  }, [fiStartDate, fiEndDate])


  const { data: cdiDaily } = useQuery<{ date: Date; idx: number }[]>({
    queryKey: ['cdi-daily', fiPeriodo],
    enabled: true,
    staleTime: 60_000,
    queryFn: async () => {
      const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados?formato=json&dataInicial=${toBr(fiStartDate)}&dataFinal=${toBr(fiEndDate)}`
      const r = await fetch(url)
      if (!r.ok) return []
      const arr: Array<{ data: string; valor: string }> = await r.json()
      const parsed = arr
        .map(it => ({ dt: it.data.split('/').map(Number) as any, v: parseFloat(String(it.valor).replace(',', '.')) }))
        .filter(it => isFinite(it.v) && Array.isArray(it.dt) && it.dt.length === 3)
        .map(it => ({ date: new Date(it.dt[2], it.dt[1] - 1, it.dt[0]), taxaAA: it.v }))
        .sort((a, b) => a.date.getTime() - b.date.getTime())
      let base = 100
      const out: { date: Date; idx: number }[] = []
      for (const p of parsed) {
        const daily = Math.pow(1 + p.taxaAA / 100, 1 / 252)
        base *= daily
        out.push({ date: p.date, idx: base })
      }
      return out
    }
  })
  const cdiMonthly = useMemo(() => {
    if (!cdiDaily || cdiDaily.length === 0) return [] as { label: string; value: number | null }[]
    const byMonth = new Map<string, number>()
    for (const pt of cdiDaily) {
      const lab = toLabel(pt.date)
      byMonth.set(lab, pt.idx)
    }
    return monthEnds.map(me => ({ label: toLabel(me), value: byMonth.get(toLabel(me)) ?? null }))
  }, [cdiDaily, monthEnds])

  // SELIC aproximada: usa taxa anual (selicPct) constante no período → compõe mês a mês
  const selicMonthly = useMemo(() => {
    const taxa = typeof selicPct === 'number' && isFinite(selicPct) && selicPct > 0 ? selicPct : undefined
    let base = 100
    const out: { label: string; value: number | null }[] = []
    for (let i = 0; i < monthEnds.length; i++) {
      if (i === 0) {
        out.push({ label: toLabel(monthEnds[i]), value: base })
      } else {
        if (taxa != null) base *= Math.pow(1 + taxa / 100, 1 / 12)
        out.push({ label: toLabel(monthEnds[i]), value: taxa != null ? base : null })
      }
    }
    return out
  }, [monthEnds, selicPct])

  // IPCA mensal (BCB 433) → índice base 100
  const { data: ipcaRaw } = useQuery<Array<{ label: string; value: number }>>({
    queryKey: ['ipca-monthly', fiPeriodo],
    enabled: true,
    staleTime: 60_000,
    queryFn: async () => {
      const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados?formato=json`
      const r = await fetch(url)
      if (!r.ok) return []
      const arr: Array<{ data: string; valor: string }> = await r.json()
      const map = new Map<string, number>()
      for (const it of arr) {
        const [_, mm, yy] = it.data.split('/')
        const key = `${yy}-${mm}`
        const v = parseFloat(String(it.valor).replace(',', '.'))
        if (isFinite(v)) map.set(key, v)
      }
      // Recorta só o período solicitado
      const labels = monthEnds.map(d => toLabel(d))
      return labels.map(lab => ({ label: lab, value: map.get(lab) ?? NaN }))
    }
  })
  const ipcaMonthly = useMemo(() => {
    if (!ipcaRaw || ipcaRaw.length === 0) return [] as { label: string; value: number | null }[]
    let base = 100
    const out: { label: string; value: number | null }[] = []
    for (const row of ipcaRaw) {
      const v = row.value
      if (isFinite(v)) base *= (1 + v / 100)
      out.push({ label: row.label, value: isFinite(v) ? base : null })
    }
    return out
  }, [ipcaRaw])

  // Ativo → último fechamento de cada mês rebase 100
  const ativoMonthly = useMemo(() => {
    const series = Array.isArray(historicoFI) ? historicoFI : []
    if (series.length === 0) return [] as { label: string; value: number | null }[]
    // Mapear último close por mês
    const byMonth = new Map<string, number>()
    for (const r of series) {
      const dateStr = r.Date || r.date || r.DateTime || r.time || null
      const close = r.Close ?? r.close ?? r.price
      if (!dateStr || !isFinite(Number(close))) continue
      const dt = new Date(dateStr)
      const lab = toLabel(dt)
      byMonth.set(lab, Number(close))
    }
    const labels = monthEnds.map(d => toLabel(d))
    const vals = labels.map(lab => byMonth.get(lab)).filter(v => typeof v === 'number') as number[]
    if (vals.length === 0) return labels.map(lab => ({ label: lab, value: null }))
    const first = vals[0]!
    return labels.map(lab => {
      const v = byMonth.get(lab)
      return { label: lab, value: typeof v === 'number' ? (v / first) * 100 : null }
    })
  }, [historicoFI, monthEnds])

  const fiChartData = useMemo(() => {
    const labels = monthEnds.map(d => toLabel(d))
    const toMap = (rows: { label: string; value: number | null }[]) => {
      const m = new Map<string, number | null>()
      for (const r of rows) m.set(r.label, r.value)
      return m
    }
    const mAtivo = toMap(ativoMonthly)
    const mCDI = toMap(cdiMonthly)
    const mSELIC = toMap(selicMonthly)
    const mIPCA = toMap(ipcaMonthly)
    return labels.map(lab => ({
      label: lab,
      Ativo: mAtivo.get(lab) ?? null,
      CDI: mCDI.get(lab) ?? null,
      SELIC: mSELIC.get(lab) ?? null,
      IPCA: mIPCA.get(lab) ?? null,
    }))
  }, [monthEnds, ativoMonthly, cdiMonthly, selicMonthly, ipcaMonthly])

  const fiResumo = useMemo(() => {
    const series = fiChartData
    if (!series || series.length < 2) return null as null | Record<string, number>
    const first = series.find(r => r.Ativo != null || r.CDI != null || r.SELIC != null || r.IPCA != null)
    const last = [...series].reverse().find(r => r.Ativo != null || r.CDI != null || r.SELIC != null || r.IPCA != null)
    if (!first || !last) return null
    const calc = (k: 'Ativo'|'CDI'|'SELIC'|'IPCA') => {
      const a = first[k]
      const b = last[k]
      if (a == null || b == null) return NaN
      return (b / a - 1) * 100
    }
    return {
      Ativo: calc('Ativo'),
      CDI: calc('CDI'),
      SELIC: calc('SELIC'),
      IPCA: calc('IPCA'),
    }
  }, [fiChartData])

  const dividends12m = useMemo(() => {
    try {
      const map = detalhes?.dividends
      if (!map) return null
      const now = new Date()
      const cutoff = new Date(now.getTime() - 365 * 24 * 3600 * 1000)
      let sum = 0
      for (const [iso, val] of Object.entries(map)) {
        const dt = new Date(iso)
        if (dt >= cutoff) sum += Number(val || 0)
      }
      if (sum > 0) return sum
      const dr = (typeof info?.dividendRate === 'number') ? Number(info.dividendRate) : null
      return dr != null ? dr : null
    } catch {
      const dr = (typeof info?.dividendRate === 'number') ? Number(info.dividendRate) : null
      return dr != null ? dr : null
    }
  }, [detalhes, info])
  const bazinCeilingPrice = useMemo(() => {
    if (dividends12m == null || !isFinite(dividends12m)) return null
    const r = Number(bazinRatePct)
    if (!isFinite(r) || r <= 0) return null
    return dividends12m / (r / 100)
  }, [dividends12m, bazinRatePct])


  useEffect(() => {
    if (grahamEPSOverride == null) setGrahamEPSText(eps != null ? String(eps) : '')
  }, [eps, grahamEPSOverride])
  useEffect(() => {
    if (grahamGOverride == null) setGrahamGText(isFinite(grahamGrowthPctValue) ? String(Number(grahamGrowthPctValue.toFixed(2))) : '')
  }, [grahamGrowthPctValue, grahamGOverride])
  useEffect(() => {
    if (grahamYOverride == null) setGrahamYText(isFinite(grahamYieldPctValue) ? String(Number(grahamYieldPctValue.toFixed(2))) : '')
  }, [grahamYieldPctValue, grahamYOverride])
  useEffect(() => {
    // Ao trocar de ticker, resetar overrides para voltar ao automático
    setGrahamEPSOverride(null)
    setGrahamGOverride(null)
    setGrahamYOverride(null)
  }, [ticker])

  // Funções de commit (Enter) para aplicar overrides (ou limpar para voltar ao automático)
  const commitGrahamEPS = useCallback(() => {
    const raw = grahamEPSText?.trim()
    if (!raw) { setGrahamEPSOverride(null); return }
    const val = parseFloat(raw.replace(',', '.'))
    if (isFinite(val)) setGrahamEPSOverride(val)
    else setGrahamEPSOverride(null)
  }, [grahamEPSText])
  const commitGrahamG = useCallback(() => {
    const raw = grahamGText?.trim()
    if (!raw) { setGrahamGOverride(null); return }
    const val = parseFloat(raw.replace(',', '.'))
    if (isFinite(val)) setGrahamGOverride(val)
    else setGrahamGOverride(null)
  }, [grahamGText])
  const commitGrahamY = useCallback(() => {
    const raw = grahamYText?.trim()
    if (!raw) { setGrahamYOverride(null); return }
    const val = parseFloat(raw.replace(',', '.'))
    if (isFinite(val)) setGrahamYOverride(val)
    else setGrahamYOverride(null)
  }, [grahamYText])

  // Selos de atendimento por critério
  const grahamBadge = useMemo(() => {
    const price = typeof info?.currentPrice === 'number' ? Number(info.currentPrice) : null
    if (grahamFairPrice == null || price == null || !isFinite(price)) return null
    const ratio = price / grahamFairPrice
    if (!isFinite(ratio)) return null
    if (ratio <= 0.8) return { label: 'Barata (Graham)', color: 'green' as const }
    if (ratio <= 1.1) return { label: 'Justa (Graham)', color: 'yellow' as const }
    return { label: 'Cara (Graham)', color: 'red' as const }
  }, [info, grahamFairPrice])

  const bazinBadge = useMemo(() => {
    const price = typeof info?.currentPrice === 'number' ? Number(info.currentPrice) : null
    if (bazinCeilingPrice == null || price == null || !isFinite(price)) return null
    if (price <= bazinCeilingPrice) return { label: 'Abaixo do teto (Bazin)', color: 'green' as const }
    return { label: 'Acima do teto (Bazin)', color: 'red' as const }
  }, [info, bazinCeilingPrice])

  // Calcular net_debt/ebitda se disponível
  const netDebtEbitda = useMemo(() => {
    if (enterpriseValue == null || ebitComputed == null) return null
    // Tentar obter dívida líquida dos dados
    const totalDebt = (info as any)?.totalDebt
    const cash = (info as any)?.totalCash
    if (totalDebt != null && cash != null) {
      const netDebt = totalDebt - cash
      if (ebitComputed > 0 && isFinite(netDebt) && isFinite(ebitComputed)) {
        return netDebt / ebitComputed
      }
    }
    return null
  }, [enterpriseValue, ebitComputed, info])

  // Regras da estratégia por tipo usando filtros do contexto
  const strategyDetails = useMemo(() => {
    const filtros = tipoAtivo === 'FII' ? filtrosFiis : tipoAtivo === 'BDR' ? filtrosBdrs : filtrosAcoes
    
    return verificarEstrategia(tipoAtivo, filtros, {
      roePct,
      dyPct,
      pl,
      pvp,
      liquidezDiaria,
      netDebtEbitda
    })
  }, [tipoAtivo, roePct, dyPct, pl, pvp, liquidezDiaria, netDebtEbitda, filtrosAcoes, filtrosBdrs, filtrosFiis])

  // Componente de loading animado
  const LoadingSpinner = ({ text }: { text: string }) => (
    <motion.div 
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-12 space-y-4"
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full"
      />
      <div className="text-center space-y-2">
        <p className="text-lg font-medium text-foreground">{text}</p>
        <p className="text-sm text-muted-foreground">
          Carregando dados ...
        </p>
      </div>
    </motion.div>
  )









  const chartData = useMemo(() => {
    if (!historico || historico.length === 0) return []
    
    return historico.map(item => ({
      ...item,
      Date: new Date(item.Date).toISOString().split('T')[0]
    }))
  }, [historico])

  // Fear & Greed será calculado diretamente na aba Conceitos

  const dividendData = useMemo(() => {
    if (!detalhes?.dividends) return []
    
    
    const now = new Date()
    let startDate: Date
    
    switch (periodoDividendos) {
      case '1mo':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
        break
      case '3mo':
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())
        break
      case '6mo':
        startDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate())
        break
      case '1y':
        startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
        break
      case '2y':
        startDate = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate())
        break
      case '5y':
        startDate = new Date(now.getFullYear() - 5, now.getMonth(), now.getDate())
        break
      case 'max':
      default:
        startDate = new Date(0) 
        break
    }
    
    return Object.entries(detalhes.dividends)
      .filter(([date]) => new Date(date) >= startDate)
      .map(([date, dividend]) => ({
        Date: date,
        Dividend: dividend,
        DividendYield: 0, 
        Price: 0 
      }))
      .sort((a, b) => new Date(a.Date).getTime() - new Date(b.Date).getTime())
  }, [detalhes, periodoDividendos])

  
  const dividendYieldChartData = useMemo(() => {
    if (!historico || !detalhes?.dividends || historico.length === 0) return []
    
    // Normalizar datas do histórico para comparação
    const historicoNormalizado = historico.map(h => {
      const dateStr = h.Date || h.date || h.DateTime || h.time
      let date: Date
      if (typeof dateStr === 'string') {
        date = new Date(dateStr)
      } else if (dateStr instanceof Date) {
        date = dateStr
      } else {
        return null
      }
      return {
        date: date,
        dateStr: date.toISOString().split('T')[0], // YYYY-MM-DD
        timestamp: date.getTime(),
        close: h.Close || h.close || h.price || null
      }
    }).filter(h => h !== null && h.close !== null && isFinite(h.close)) as Array<{
      date: Date
      dateStr: string
      timestamp: number
      close: number
    }>
    
    if (historicoNormalizado.length === 0) return []
    
    // Ordenar histórico por data
    historicoNormalizado.sort((a, b) => a.timestamp - b.timestamp)
    
    return Object.entries(detalhes.dividends)
      .map(([dividendDateStr, dividend]) => {
        const dividendDate = new Date(dividendDateStr)
        const dividendTimestamp = dividendDate.getTime()
        const dividendDateOnly = dividendDate.toISOString().split('T')[0]
        
        // Tentar encontrar preço exato na data do dividendo
        let priceData = historicoNormalizado.find(h => h.dateStr === dividendDateOnly)
        
        // Se não encontrar exato, buscar o preço mais próximo (antes ou no dia do dividendo)
        if (!priceData) {
          // Buscar o último preço disponível antes ou no dia do dividendo
          priceData = historicoNormalizado
            .filter(h => h.timestamp <= dividendTimestamp)
            .sort((a, b) => b.timestamp - a.timestamp)[0]
        }
        
        // Se ainda não encontrar, buscar o primeiro preço disponível após o dividendo
        if (!priceData) {
          priceData = historicoNormalizado
            .filter(h => h.timestamp >= dividendTimestamp)
            .sort((a, b) => a.timestamp - b.timestamp)[0]
        }
        
        // Se não encontrar nenhum preço, pular este dividendo
        if (!priceData || !priceData.close || priceData.close <= 0) {
          return null
        }
        
        const price = priceData.close
        const dividendYield = (dividend / price) * 100
        
        // Validar se o dividend yield é razoável (entre 0% e 100%)
        if (!isFinite(dividendYield) || dividendYield <= 0 || dividendYield > 100) {
          return null
        }
        
        return {
          Date: dividendDateStr,
        Dividend: dividend,
          DividendYield: dividendYield,
        Price: price
      }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => new Date(a.Date).getTime() - new Date(b.Date).getTime())
  }, [historico, detalhes])

  
  const comparisonData = useMemo(() => {
    if (!comparacao || comparacao.length === 0) return []
    
    return comparacao.map(ativo => ({
      ticker: ativo.ticker,
      preco: ativo.preco_atual || 0,
      pl: ativo.pl || 0,
      pvp: ativo.pvp || 0,
      dy: ativo.dy || 0,
      roe: ativo.roe || 0
    }))
  }, [comparacao])

  if (!ticker) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <h1 className="text-3xl font-bold text-foreground">Detalhes do Ativo</h1>
        
        <div className="flex gap-4 items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={20} />
            <input
              type="text"
              placeholder="Digite o ticker (ex: PETR4, AAPL, MSFT, ITUB4.SA, VISC11)..."
              value={inputTicker}
              onChange={handleInputChange}
              onKeyDown={handleSearchKeyDown}
              className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleBuscar}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            Buscar
          </motion.button>
        </div>

        <div className="text-center text-muted-foreground">
          <p>Digite um ticker para buscar os detalhes do ativo.</p>
          <p className="text-sm mt-2">Exemplos: PETR4, AAPL, MSFT, ITUB4.SA, VISC11, TSLA, BOVA11.SA, AMZO34.SA</p>
        </div>
      </motion.div>
    )
  }

  if (loadingDetalhes) {
    return <LoadingSpinner text="Carregando detalhes do ativo..." />
  }

  if (errorDetalhes || !detalhes?.info?.longName) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <h1 className="text-3xl font-bold text-foreground">Detalhes do Ativo</h1>
        
        <div className="flex gap-4 items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={20} />
            <input
              type="text"
              placeholder="Digite o ticker (ex: PETR4, AAPL, MSFT, ITUB4.SA, VISC11)..."
              value={inputTicker}
              onChange={handleInputChange}
              onKeyDown={handleSearchKeyDown}
              className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleBuscar}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            Buscar
          </motion.button>
        </div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-destructive/10 border border-destructive/20 rounded-lg p-4"
        >
          <p className="text-destructive font-medium">Nenhuma informação detalhada disponível para o ticker informado.</p>
          <p className="text-sm text-muted-foreground mt-2">
            Exemplos válidos: PETR4, AAPL, MSFT, ITUB4.SA, VISC11, TSLA, BOVA11.SA, AMZO34.SA
          </p>
        </motion.div>
      </motion.div>
    )
  }


  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header com busca */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <h1 className="text-3xl font-bold text-foreground">Detalhes do Ativo</h1>
        
        <div className="flex gap-2 sm:gap-4 items-center w-full lg:w-auto">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={20} />
          <input
            type="text"
              placeholder="Digite o ticker..."
            value={inputTicker}
            onChange={handleInputChange}
            onKeyDown={handleSearchKeyDown}
            className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          onClick={handleBuscar}
          className="px-4 sm:px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors whitespace-nowrap"
        >
          Buscar
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => refetchDetalhes()}
            className="p-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </motion.button>
        </div>
      </div>

      {/* Tabs de navegação */}
      <div className="bg-card border border-border rounded-lg">
        <div className="border-b border-border">
          <div className="flex overflow-x-auto">
            {[
              { id: 'overview', label: 'Visão Geral', icon: PieChart },
              { id: 'fundamentals', label: 'Fundamentos', icon: Target },
              { id: 'charts', label: 'Gráficos', icon: LineChart },
              { id: 'dividends', label: 'Proventos', icon: DollarSign },
              { id: 'radar-dividendos', label: 'Radar de Dividendos', icon: ScanLine },
              { id: 'history', label: 'História', icon: FileText },
              { id: 'concepts', label: 'Conceitos', icon: Target },
              { id: 'comparison', label: 'Comparação', icon: BarChart3 },
              { id: 'fixedincome', label: 'Renda Fixa', icon: DollarSign },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
        </button>
            ))}
          </div>
      </div>

        <div className="p-6">
          <AnimatePresence mode="wait">
            {activeTab === 'fixedincome' && (
              <DetalhesFixedIncomeTab
                fiPeriodo={fiPeriodo}
                setFiPeriodo={setFiPeriodo}
                fiChartData={fiChartData}
                fiResumo={fiResumo}
              />
            )}
            {activeTab === 'overview' && (
              <DetalhesVisaoGeralTab
                ticker={ticker}
                info={info}
                logoUrl={logoUrl}
                historico={historicoOverview}
                loadingHistorico={loadingHistoricoOverview}
                periodo={periodoOverview}
                onPeriodoChange={setPeriodoOverview}
                strategyDetails={strategyDetails}
                tipoAtivo={tipoAtivo}
                fiiInfo={fiiInfo}
                fiiMetadata={fiiMetadataFinal}
                grahamBadge={grahamBadge}
                bazinBadge={bazinBadge}
                enterpriseValue={enterpriseValue}
                ebitComputed={ebitComputed}
                evToEbit={evToEbit}
                liquidezDiaria={liquidezDiaria}
              />
            )}

            {activeTab === 'fundamentals' && (
              <DetalhesFundamentalsTab
                info={info}
                fiiInfo={fiiInfo}
              />
            )}

            {activeTab === 'charts' && (
              <DetalhesChartsTab
                periodo={periodo}
                handlePeriodoChange={handlePeriodoChange}
                loadingHistorico={loadingHistorico}
                chartData={chartData}
                dividendYieldChartData={dividendYieldChartData}
                historicoDividendos={detalhes?.dividends || null}
                ticker={ticker}
              />
            )}

            {activeTab === 'dividends' && (
              <DetalhesDividendsTab
                periodoDividendos={periodoDividendos}
                handlePeriodoDividendosChange={handlePeriodoDividendosChange}
                dividendData={dividendData}
              />
            )}

            {activeTab === 'radar-dividendos' && (
              <DetalhesRadarDividendosTab
                ticker={ticker}
                historicoDividendos={detalhes?.dividends || null}
                tipoAtivo={tipoAtivo}
              />
            )}

            {activeTab === 'history' && (
              <DetalhesHistoryTab
                info={info}
              />
            )}

            {activeTab === 'comparison' && (
              <DetalhesComparisonTab
                compararInputRef={compararInputRef}
                handleCompararKeyDown={handleCompararKeyDown}
                handleComparar={handleComparar}
                loadingComparacao={loadingComparacao}
                comparacao={comparacao}
                comparisonData={comparisonData}
              />
            )}

            {activeTab === 'concepts' && (
              <DetalhesConceptsTab
                info={info}
                grahamBadge={grahamBadge}
                bazinBadge={bazinBadge}
                grahamEPSText={grahamEPSText}
                setGrahamEPSText={setGrahamEPSText}
                commitGrahamEPS={commitGrahamEPS}
                grahamGText={grahamGText}
                setGrahamGText={setGrahamGText}
                commitGrahamG={commitGrahamG}
                grahamYText={grahamYText}
                setGrahamYText={setGrahamYText}
                commitGrahamY={commitGrahamY}
                grahamFairPrice={grahamFairPrice}
                dividends12m={dividends12m}
                bazinRatePct={bazinRatePct}
                setBazinRatePct={setBazinRatePct}
                bazinCeilingPrice={bazinCeilingPrice}
                historico={historico}
              />
            )}
          </AnimatePresence>
      </div>
    </div>
    </motion.div>
  )
} 