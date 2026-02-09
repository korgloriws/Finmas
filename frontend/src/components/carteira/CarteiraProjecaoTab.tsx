import { useState, useMemo, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { carteiraService } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import { 
  Calculator, 
  TrendingUp, 
  DollarSign, 
  Calendar,
  AlertTriangle,
  BarChart3,
  Target,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Info
} from 'lucide-react'
import { formatCurrency, formatPercentage } from '../../utils/formatters'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface CarteiraProjecaoTabProps {
  carteira: any[]
  /** Histórico da carteira (período definido por filtroPeriodo). Vindo da página para evitar fetch duplicado e respeitar o período selecionado. */
  historicoCarteira?: any
  loadingHistoricoCarteira?: boolean
  proventosRecebidos?: any[]
  filtroPeriodo?: string
  setFiltroPeriodo?: (value: string) => void
}

interface ProjecaoData {
  mes: number
  valor: number
  valorComDividendos: number
  dividendosAcumulados: number
}

export default function CarteiraProjecaoTab({
  carteira,
  historicoCarteira,
  loadingHistoricoCarteira = false,
  proventosRecebidos,
  filtroPeriodo,
  setFiltroPeriodo
}: CarteiraProjecaoTabProps) {
  const { user } = useAuth()
  const [anosProjecao, setAnosProjecao] = useState<string>('5')
  const [considerarDividendos, setConsiderarDividendos] = useState(true)
  const [valorInicial, setValorInicial] = useState('')
  const [considerarAportes, setConsiderarAportes] = useState(false)
  const [aporteMensal, setAporteMensal] = useState('')
  const [goalTipo, setGoalTipo] = useState<'renda'|'patrimonio'>('renda')
  const [goalAlvo, setGoalAlvo] = useState('')
  const [goalHorizonteMeses, setGoalHorizonteMeses] = useState('')
  const [usarCrescimentoManual, setUsarCrescimentoManual] = useState(false)
  const [crescimentoManual, setCrescimentoManual] = useState('')
  
  // Metas de Aportes
  const [showMetaAporteForm, setShowMetaAporteForm] = useState(false)
  const [metaAporteTipo, setMetaAporteTipo] = useState<'mensal' | 'rebalanceamento' | 'anual'>('mensal')
  const [metaAporteValor, setMetaAporteValor] = useState('')
  const [metaAporteDataInicio, setMetaAporteDataInicio] = useState(new Date().toISOString().split('T')[0])
  const [metaAporteDataFim, setMetaAporteDataFim] = useState('')
  
  // queryClient precisa ser declarado ANTES de ser usado nas mutations
  const queryClient = useQueryClient()
  
  // Esta aba só é montada quando activeTab === 'projecao' (CarteiraPage), então as queries abaixo só rodam quando o usuário está na aba Projeção — sem requests extras ao abrir a Carteira.
  const { data: metasAportes } = useQuery({
    queryKey: ['metas-aportes', user],
    queryFn: carteiraService.getMetasAportes,
    enabled: !!user,
    staleTime: 30_000,
  })
  
  const { data: statusAportes } = useQuery({
    queryKey: ['status-aportes', user],
    queryFn: () => carteiraService.getStatusAportes(),
    enabled: !!user && !!metasAportes && metasAportes.length > 0,
    staleTime: 30_000,
    refetchInterval: 60_000, // Atualiza a cada minuto
  })
  
  // Status integrado: combina goals com metas de aportes
  const { data: statusIntegrado } = useQuery({
    queryKey: ['status-integrado-metas', user],
    queryFn: carteiraService.getStatusIntegradoMetas,
    enabled: !!user,
    staleTime: 30_000,
    refetchInterval: 60_000, // Atualiza a cada minuto
  }) as { data: any }
  
  const saveMetaAporteMutation = useMutation({
    mutationFn: carteiraService.saveMetaAporte,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metas-aportes', user] })
      queryClient.invalidateQueries({ queryKey: ['status-aportes', user] })
      setShowMetaAporteForm(false)
      setMetaAporteValor('')
    }
  })
  
  const deleteMetaAporteMutation = useMutation({
    mutationFn: carteiraService.deleteMetaAporte,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metas-aportes', user] })
      queryClient.invalidateQueries({ queryKey: ['status-aportes', user] })
      queryClient.invalidateQueries({ queryKey: ['status-integrado-metas', user] })
    }
  })

  const valorAtualCarteira = useMemo(() => {
    return carteira?.reduce((total, ativo) => total + (ativo.valor_total || 0), 0) || 0
  }, [carteira])

  // Histórico vem da página (historicoCarteira) para respeitar filtroPeriodo e evitar fetch duplicado.
  const { data: goal } = useQuery({
    queryKey: ['goals', user],
    queryFn: carteiraService.getGoals,
    enabled: !!user,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
  const saveGoalsMutation = useMutation({
    mutationFn: carteiraService.saveGoals,
    onSuccess: () => {
      // SEGURANCA: Incluir user na invalidação para garantir isolamento
      queryClient.invalidateQueries({ queryKey: ['goals', user] })
    }
  })
  const projectGoalsQuery = useQuery({
    queryKey: ['goals-projecao', user, goalTipo, goalAlvo, goalHorizonteMeses, usarCrescimentoManual, crescimentoManual],
    queryFn: async () => {
      const payload: any = { tipo: goalTipo }
      if (goalAlvo) payload.alvo = parseFloat(goalAlvo)
      if (goalHorizonteMeses) payload.horizonte_meses = parseInt(goalHorizonteMeses)
      
      // Incluir taxa de crescimento se definida manualmente
      if (usarCrescimentoManual && crescimentoManual) {
        payload.taxa_crescimento = parseFloat(crescimentoManual) / 100
      }
      
      return carteiraService.projectGoals(payload)
    },
    enabled: !!goalTipo && (!!goalAlvo || !!goal),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })

  // Invalidar status integrado quando goals ou metas de aportes mudarem
  // Usar useRef para evitar loops infinitos
  const prevGoalRef = useRef<any>(null)
  const prevMetasAportesRef = useRef<any>(null)
  const invalidatingRef = useRef(false)
  const lastInvalidationRef = useRef<number>(0)
  
  useEffect(() => {
    // Prevenir múltiplas invalidações simultâneas ou muito frequentes
    const now = Date.now()
    if (invalidatingRef.current || (now - lastInvalidationRef.current) < 2000) {
      return
    }
    
    // Só invalidar se realmente mudou (comparação profunda básica)
    const goalId = goal?.id || goal?.tipo || JSON.stringify(goal) || null
    const prevGoalId = prevGoalRef.current?.id || prevGoalRef.current?.tipo || JSON.stringify(prevGoalRef.current) || null
    const goalChanged = goalId !== prevGoalId
    
    const metasKey = metasAportes ? `${metasAportes.length}-${JSON.stringify(metasAportes.map((m: any) => m.id))}` : 'null'
    const prevMetasKey = prevMetasAportesRef.current ? `${prevMetasAportesRef.current.length}-${JSON.stringify(prevMetasAportesRef.current.map((m: any) => m.id))}` : 'null'
    const metasChanged = metasKey !== prevMetasKey
    
    if ((goalChanged || metasChanged) && (goal || metasAportes)) {
      invalidatingRef.current = true
      lastInvalidationRef.current = now
      queryClient.invalidateQueries({ queryKey: ['status-integrado-metas', user] })
      prevGoalRef.current = goal
      prevMetasAportesRef.current = metasAportes
      
      // Resetar flag após um delay
      setTimeout(() => {
        invalidatingRef.current = false
      }, 2000)
    }
  }, [goal, metasAportes, user, queryClient])

  const crescimentoMedioAnual = useMemo(() => {
    const datas: string[] = Array.isArray(historicoCarteira?.datas) ? historicoCarteira!.datas : []
    // Usar carteira_price (valorização real sem aportes/retiradas) como prioridade
    const valoresPrice: Array<number | null | undefined> = Array.isArray(historicoCarteira?.carteira_price) ? historicoCarteira!.carteira_price : []
    
    // Se não tiver carteira_price, usar carteira (rebased) como fallback
    const valoresRebased: Array<number | null | undefined> = Array.isArray(historicoCarteira?.carteira) ? (historicoCarteira as any).carteira : []

    // Priorizar carteira_price, senão usar carteira rebased
    const valores: Array<number | null | undefined> = valoresPrice.length > 0 ? valoresPrice : valoresRebased
    
    if (datas.length < 2 || valores.length < 2) return 0
    
    // Agrupar por ano e calcular taxa anual baseada nos meses com registro
    const dadosPorAno = new Map<number, { primeiro: number | null, ultimo: number | null, meses: number }>()
    
    for (let i = 0; i < datas.length; i++) {
      const dataStr = datas[i]
      if (!dataStr) continue
      
      // Extrair ano da data (formato YYYY-MM ou YYYY-MM-DD)
      const ano = parseInt(dataStr.substring(0, 4))
      if (isNaN(ano)) continue
      
      const valor = Number(valores[i])
      if (!Number.isFinite(valor) || valor <= 0) continue
      
      if (!dadosPorAno.has(ano)) {
        dadosPorAno.set(ano, { primeiro: valor, ultimo: valor, meses: 1 })
      } else {
        const dados = dadosPorAno.get(ano)!
        dados.ultimo = valor
        dados.meses++
      }
    }
    
    // Calcular taxa de crescimento anual para cada ano completo
    const taxasAnuais: number[] = []
    
    for (const dados of dadosPorAno.values()) {
      if (dados.primeiro && dados.ultimo && dados.primeiro > 0 && dados.ultimo > 0) {
        // Taxa de crescimento do ano
        const taxaAno = (dados.ultimo - dados.primeiro) / dados.primeiro
        if (Number.isFinite(taxaAno)) {
          taxasAnuais.push(taxaAno)
        }
      }
    }
    
    // Se não tiver dados anuais suficientes, calcular taxa mensal média e anualizar
    if (taxasAnuais.length === 0) {
    const retornosMensais: number[] = []
    for (let i = 1; i < valores.length; i++) {
      const prev = Number(valores[i - 1])
      const cur = Number(valores[i])
      if (!Number.isFinite(prev) || !Number.isFinite(cur) || prev <= 0 || cur <= 0) continue
      const r = (cur - prev) / prev
      if (Number.isFinite(r)) retornosMensais.push(r)
    }
    if (retornosMensais.length === 0) return 0
    const mediaMensal = retornosMensais.reduce((s, r) => s + r, 0) / retornosMensais.length
    let crescimentoAnual = Math.pow(1 + mediaMensal, 12) - 1
      if (!Number.isFinite(crescimentoAnual)) crescimentoAnual = 0
      crescimentoAnual = Math.max(-0.9, Math.min(2.0, crescimentoAnual))
      return Math.max(0, crescimentoAnual)
    }
    
    // Calcular média das taxas anuais
    const mediaTaxaAnual = taxasAnuais.reduce((s, t) => s + t, 0) / taxasAnuais.length
    
    // Validar e limitar taxa
    let crescimentoAnual = mediaTaxaAnual
    if (!Number.isFinite(crescimentoAnual)) crescimentoAnual = 0
    crescimentoAnual = Math.max(-0.9, Math.min(2.0, crescimentoAnual))
    return Math.max(0, crescimentoAnual)
  }, [historicoCarteira])

  // Estatísticas mensais: quantidade de meses, último mês e média mensal
  const monthlyStats = useMemo(() => {
    const datas: string[] = Array.isArray(historicoCarteira?.datas) ? historicoCarteira!.datas : []
    // Usar carteira_price (valorização real sem aportes/retiradas) como prioridade
    const valoresPrice: Array<number | null | undefined> = Array.isArray(historicoCarteira?.carteira_price) ? historicoCarteira!.carteira_price : []
    // Se não tiver carteira_price, usar carteira (rebased) como fallback
    const valoresRebased: Array<number | null | undefined> = Array.isArray((historicoCarteira as any)?.carteira) ? (historicoCarteira as any).carteira : []
    // Priorizar carteira_price, senão usar carteira rebased
    const valores: Array<number | null | undefined> = valoresPrice.length > 0 ? valoresPrice : valoresRebased
    const records: { label: string; r: number }[] = []
    for (let i = 1; i < valores.length; i++) {
      const prev = Number(valores[i - 1])
      const cur = Number(valores[i])
      if (!Number.isFinite(prev) || !Number.isFinite(cur) || prev <= 0 || cur <= 0) continue
      const r = (cur - prev) / prev
      if (!Number.isFinite(r)) continue
      const label = Array.isArray(datas) && datas[i] ? datas[i] : `${i}`
      records.push({ label, r })
    }
    const count = records.length
    const avg = count > 0 ? records.reduce((s, it) => s + it.r, 0) / count : 0
    const last = count > 0 ? records[count - 1] : null
    return { count, avg, last }
  }, [historicoCarteira])

  const historicoIncompleto = useMemo(() => {
    const datas = Array.isArray(historicoCarteira?.datas) ? historicoCarteira!.datas : []
    // Usar carteira_price (valorização real sem aportes/retiradas) como prioridade
    const valoresPrice: Array<number | null | undefined> = Array.isArray(historicoCarteira?.carteira_price) ? historicoCarteira!.carteira_price : []
    // Se não tiver carteira_price, usar carteira (rebased) como fallback
    const valoresRebased: Array<number | null | undefined> = Array.isArray((historicoCarteira as any)?.carteira) ? (historicoCarteira as any).carteira : []
    // Priorizar carteira_price, senão usar carteira rebased
    const valores: Array<number | null | undefined> = valoresPrice.length > 0 ? valoresPrice : valoresRebased
    const pontosValidos = datas.reduce((acc: number, _d: string, i: number) => {
      const v = Number(valores[i])
      return acc + (Number.isFinite(v) && v > 0 ? 1 : 0)
    }, 0)
    return pontosValidos < 2
  }, [historicoCarteira])

  
  const dividendosMediosMensais = useMemo(() => {
    if (!proventosRecebidos || proventosRecebidos.length === 0) return 0
    const eventos = proventosRecebidos.flatMap((a: any) => a.proventos_recebidos || [])
    if (!eventos || eventos.length === 0) return 0
    let minDt: Date | null = null
    let maxDt: Date | null = null
    let soma = 0
    for (const e of eventos) {
      const d = new Date(e.data)
      if (!isNaN(d.getTime())) {
        if (!minDt || d < minDt) minDt = d
        if (!maxDt || d > maxDt) maxDt = d
      }
      soma += Number(e.valor_recebido || 0)
    }
    if (!minDt || !maxDt) return 0
    const months = Math.max(1, Math.round(((maxDt.getFullYear() - minDt.getFullYear()) * 12) + (maxDt.getMonth() - minDt.getMonth()) + 1))
    return soma / months
  }, [proventosRecebidos])



  const projecao = useMemo(() => {
    try {
      const valorInicialNumRaw = parseFloat(valorInicial)
      const valorInicialNum = Number.isFinite(valorInicialNumRaw) && valorInicialNumRaw > 0 ? valorInicialNumRaw : valorAtualCarteira
      
      // Usar crescimento manual se ativado, senão usar o automático
      const crescimentoAnualUsado = usarCrescimentoManual && crescimentoManual 
        ? parseFloat(crescimentoManual) / 100 
        : crescimentoMedioAnual
      const taxaMensalRaw = crescimentoAnualUsado / 12
      const taxaMensal = Number.isFinite(taxaMensalRaw) && !isNaN(taxaMensalRaw) ? taxaMensalRaw : 0
      const dividendosMensais = Number.isFinite(dividendosMediosMensais) && !isNaN(dividendosMediosMensais) ? dividendosMediosMensais : 0
      
      // Limitar anos de projeção para evitar travamentos (máximo 50 anos = 600 meses)
      const anosInt = Math.min(50, Math.max(1, parseInt(String(anosProjecao)) || 1))
      const meses = anosInt * 12
      const aporteMensalNumRaw = parseFloat(aporteMensal)
      const aporteMensalNum = considerarAportes && Number.isFinite(aporteMensalNumRaw) && aporteMensalNumRaw > 0 ? aporteMensalNumRaw : 0

      const dados: ProjecaoData[] = []
      let valorAtual = Number.isFinite(valorInicialNum) && !isNaN(valorInicialNum) ? valorInicialNum : 0
      let valorComDividendosAtual = valorAtual
      let dividendosAcumulados = 0
      let aportesAcumulados = 0

      for (let mes = 0; mes <= meses; mes++) {
        // Validar valores antes de adicionar
        const valorSafe = Number.isFinite(valorAtual) && !isNaN(valorAtual) ? valorAtual : 0
        const valorComDividendosSafe = Number.isFinite(valorComDividendosAtual) && !isNaN(valorComDividendosAtual) ? valorComDividendosAtual : 0
        const dividendosSafe = Number.isFinite(dividendosAcumulados) && !isNaN(dividendosAcumulados) ? dividendosAcumulados : 0
        
        dados.push({
          mes,
          valor: valorSafe,
          valorComDividendos: valorComDividendosSafe,
          dividendosAcumulados: dividendosSafe
        })

        if (mes < meses) {
          // Calcular crescimento com validação
          const crescimento = Number.isFinite(valorAtual) && !isNaN(valorAtual) && Number.isFinite(taxaMensal) && !isNaN(taxaMensal)
            ? (valorAtual * taxaMensal)
            : 0
          
          valorAtual = (Number.isFinite(valorAtual) && !isNaN(valorAtual) ? valorAtual : 0) + (Number.isFinite(crescimento) && !isNaN(crescimento) ? crescimento : 0)

          if (considerarDividendos) {
            const dividendosMes = Number.isFinite(dividendosMensais) && !isNaN(dividendosMensais) ? dividendosMensais : 0
            dividendosAcumulados = (Number.isFinite(dividendosAcumulados) && !isNaN(dividendosAcumulados) ? dividendosAcumulados : 0) + dividendosMes
            const crescimentoSafe = Number.isFinite(crescimento) && !isNaN(crescimento) ? crescimento : 0
            valorComDividendosAtual = (Number.isFinite(valorComDividendosAtual) && !isNaN(valorComDividendosAtual) ? valorComDividendosAtual : 0) + crescimentoSafe + dividendosMes
          } else {
            valorComDividendosAtual = valorAtual
          }

          if (aporteMensalNum > 0 && Number.isFinite(aporteMensalNum) && !isNaN(aporteMensalNum)) {
            valorAtual += aporteMensalNum
            valorComDividendosAtual += aporteMensalNum
            aportesAcumulados += aporteMensalNum
          }
        }
      }

      return dados
    } catch (error) {
      console.error('Erro ao calcular projeção:', error)
      // Retornar dados vazios em caso de erro
      return []
    }
  }, [valorInicial, valorAtualCarteira, crescimentoMedioAnual, dividendosMediosMensais, anosProjecao, considerarDividendos, considerarAportes, aporteMensal, usarCrescimentoManual, crescimentoManual])

  const anosIntOut = Math.max(1, parseInt(String(anosProjecao)) || 1)
  const valorFinal = projecao[projecao.length - 1]?.valor || 0
  const valorFinalComDividendos = projecao[projecao.length - 1]?.valorComDividendos || 0
  const totalDividendos = projecao[projecao.length - 1]?.dividendosAcumulados || 0
  const totalAportes = (anosIntOut * 12) * (parseFloat(aporteMensal) || 0) * (considerarAportes ? 1 : 0)

  if (loadingHistoricoCarteira) {
    return (
      <div className="min-h-[320px] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Carregando projeção...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Calculator className="w-6 h-6 text-blue-600" />
          <h2 className="text-2xl font-bold">Calculadora de Projeção</h2>
        </div>
        {filtroPeriodo && setFiltroPeriodo && (
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Período de análise:</label>
            <select
              value={filtroPeriodo}
              onChange={(e) => setFiltroPeriodo(e.target.value)}
              className="px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
              aria-label="Período de análise para cálculo de crescimento"
            >
              <option value="mensal">Mensal</option>
              <option value="trimestral">Trimestral</option>
              <option value="semestral">Semestral</option>
              <option value="anual">Anual</option>
              <option value="maximo">Máximo</option>
            </select>
          </div>
        )}
      </div>

      {/* Avisos importantes */}
      <div className="space-y-4">
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-amber-50 border border-amber-200 rounded-lg p-4"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-amber-800">
              <p className="font-medium mb-1">Aviso Importante</p>
              <p>
                Esta projeção é baseada em dados históricos e médias calculadas. 
                <strong> O passado não é garantia de resultados futuros.</strong> 
                Use apenas como referência para planejamento financeiro.
              </p>
            </div>
          </div>
        </motion.div>

        {historicoIncompleto && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-blue-50 border border-blue-200 rounded-lg p-4"
          >
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Dados históricos insuficientes</p>
                <p>
                  Estamos usando uma taxa padrão para estimar o crescimento anual,
                  pois o histórico disponível não é suficiente para um cálculo baseado em dados reais.
                </p>
              </div>
            </div>
          </motion.div>
        )}

         {/* Aviso sobre dividendos */}
         {(!proventosRecebidos || proventosRecebidos.length === 0) && (
           <motion.div 
             initial={{ opacity: 0, y: -10 }}
             animate={{ opacity: 1, y: 0 }}
             className="bg-blue-50 border border-blue-200 rounded-lg p-4"
           >
             <div className="flex items-start gap-3">
               <DollarSign className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
               <div className="text-sm text-blue-800">
                 <p className="font-medium mb-1">Sobre os Dividendos</p>
                 <p>
                   Como não há histórico de proventos recebidos, a projeção será baseada apenas no 
                   <strong> crescimento de capital</strong> (sem dividendos). 
                   Para incluir dividendos na projeção, é necessário ter dados históricos de proventos recebidos.
                 </p>
               </div>
             </div>
           </motion.div>
         )}
      </div>

      {/* Metas e Projeções (Novo Painel) */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-primary/5 to-secondary/5 border-2 border-primary/20 rounded-xl p-6 shadow-lg"
      >
        <h3 className="text-xl font-bold mb-6 flex items-center gap-3">
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
          >
            <Target className="w-6 h-6 text-primary" />
          </motion.div>
          <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Metas e Projeções
          </span>
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium mb-2">Tipo da Meta</label>
            <select title="Tipo da Meta" aria-label="Tipo da Meta" value={goalTipo} onChange={(e)=>setGoalTipo(e.target.value as any)} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary">
              <option value="renda">Renda mensal alvo</option>
              <option value="patrimonio">Patrimônio alvo</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Alvo ({goalTipo==='renda' ? 'R$/mês' : 'R$'})</label>
            <input type="number" value={goalAlvo} onChange={(e)=>setGoalAlvo(e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary" placeholder={goalTipo==='renda' ? 'Ex.: 5000' : 'Ex.: 1000000'} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Horizonte (meses)</label>
            <input type="number" value={goalHorizonteMeses} onChange={(e)=>setGoalHorizonteMeses(e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary" placeholder="Ex.: 120" />
          </div>
        </div>
        
        <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <button
            onClick={()=> saveGoalsMutation.mutate({ tipo: goalTipo, alvo: parseFloat(goalAlvo||'0'), horizonte_meses: goalHorizonteMeses ? parseInt(goalHorizonteMeses) : undefined })}
            className="px-6 py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transform hover:scale-105 transition-all duration-200 shadow-lg"
            disabled={saveGoalsMutation.isPending}
          >
            {saveGoalsMutation.isPending ? 'Salvando...' : 'Salvar Meta'}
          </button>
          
          {projectGoalsQuery.data && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-muted/50 border border-primary/20 rounded-lg p-4 flex-1"
            >
              <div className="text-sm text-muted-foreground mb-2">
                <span className="font-medium">Resultado da Projeção:</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-primary" />
                  <span className="text-sm">Capital alvo:</span>
                  <span className="font-bold text-primary">{formatCurrency(projectGoalsQuery.data.capital_alvo)}</span>
                </div>
                <motion.div 
                  className="flex items-center gap-2"
                  animate={{ 
                    scale: [1, 1.05, 1],
                    boxShadow: [
                      "0 0 0 0 hsl(var(--primary) / 0.4)",
                      "0 0 0 8px hsl(var(--primary) / 0.1)",
                      "0 0 0 0 hsl(var(--primary) / 0.4)"
                    ]
                  }}
                  transition={{ 
                    scale: { duration: 2, repeat: Infinity, repeatDelay: 4 },
                    boxShadow: { duration: 2, repeat: Infinity, repeatDelay: 4 }
                  }}
                >
                  <TrendingUp className="w-4 h-4 text-secondary" />
                  <span className="text-sm font-medium">Aporte sugerido:</span>
                  <span className="font-bold text-lg text-primary bg-primary/10 px-2 py-1 rounded">
                    {formatCurrency(projectGoalsQuery.data.aporte_sugerido)} / mês
                  </span>
                </motion.div>
              </div>
              {(projectGoalsQuery.data as any).taxa_anual_usada && (
                <div className="mt-3 pt-3 border-t border-primary/20">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Taxa de crescimento usada:</span>
                    <span className={`font-medium ${(projectGoalsQuery.data as any).taxa_manual ? 'text-primary' : 'text-green-600'}`}>
                      {formatPercentage((projectGoalsQuery.data as any).taxa_anual_usada * 100)}
                      {(projectGoalsQuery.data as any).taxa_manual && (
                        <span className="ml-1">(manual)</span>
                      )}
                    </span>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Status Integrado Completo: Goals + Metas de Aportes + Projeções */}
      {statusIntegrado && statusIntegrado.analise_completa && 
       statusIntegrado.analise_completa.progresso_objetivo !== undefined && 
       statusIntegrado.analise_completa.progresso_objetivo !== null && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-primary/10 via-secondary/5 to-primary/10 border-2 border-primary/30 rounded-xl p-6 shadow-lg"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold flex items-center gap-3">
              <Target className="w-7 h-7 text-primary" />
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Visão Completa: Objetivo, Aportes & Projeções
              </span>
            </h3>
          </div>

          {/* Análise Completa */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            {/* Progresso do Objetivo */}
            <div className="bg-background/80 rounded-lg p-6 border border-primary/20">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-lg">Progresso do Objetivo</h4>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  (statusIntegrado.analise_completa.progresso_objetivo ?? 0) >= 50
                    ? 'bg-green-500/20 text-green-700 dark:text-green-400'
                    : (statusIntegrado.analise_completa.progresso_objetivo ?? 0) >= 25
                    ? 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400'
                    : 'bg-red-500/20 text-red-700 dark:text-red-400'
                }`}>
                  {(statusIntegrado.analise_completa.progresso_objetivo ?? 0).toFixed(1)}%
                </span>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Patrimônio Atual</span>
                  <span className="font-semibold">{formatCurrency(statusIntegrado.analise_completa.saldo_atual)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Objetivo Final</span>
                  <span className="font-semibold text-primary">{formatCurrency(statusIntegrado.analise_completa.capital_alvo)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Faltante</span>
                  <span className="font-semibold text-orange-600">{formatCurrency(statusIntegrado.analise_completa.faltante_objetivo)}</span>
                </div>
              </div>

              <div className="mt-4">
                <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, statusIntegrado.analise_completa.progresso_objetivo ?? 0)}%` }}
                    transition={{ duration: 1.5 }}
                    className={`h-full ${
                      (statusIntegrado.analise_completa.progresso_objetivo ?? 0) >= 50 ? 'bg-green-500'
                        : (statusIntegrado.analise_completa.progresso_objetivo ?? 0) >= 25 ? 'bg-yellow-500'
                        : 'bg-red-500'
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Comparação de Aportes */}
            <div className="bg-background/80 rounded-lg p-6 border border-primary/20">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-lg">Comparação de Aportes</h4>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  (statusIntegrado.analise_completa.percentual_vs_sugerido ?? 0) >= 100
                    ? 'bg-green-500/20 text-green-700 dark:text-green-400'
                    : (statusIntegrado.analise_completa.percentual_vs_sugerido ?? 0) >= 50
                    ? 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400'
                    : 'bg-red-500/20 text-red-700 dark:text-red-400'
                }`}>
                  {(statusIntegrado.analise_completa.percentual_vs_sugerido ?? 0).toFixed(1)}%
                </span>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Aporte Sugerido</span>
                  <span className="font-semibold text-primary">{formatCurrency(statusIntegrado.analise_completa.aporte_sugerido)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Aporte Real</span>
                  <span className="font-semibold text-green-600">{formatCurrency(statusIntegrado.analise_completa.aporte_real)}</span>
                </div>
                {statusIntegrado.analise_completa.aporte_meta_definida > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Meta Definida</span>
                    <span className="font-semibold text-blue-600">{formatCurrency(statusIntegrado.analise_completa.aporte_meta_definida)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Faltante</span>
                  <span className="font-semibold text-orange-600">{formatCurrency(statusIntegrado.analise_completa.faltante_vs_sugerido)}</span>
                </div>
              </div>

              <div className="mt-4">
                <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, statusIntegrado.analise_completa.percentual_vs_sugerido ?? 0)}%` }}
                    transition={{ duration: 1.5 }}
                    className={`h-full ${
                      (statusIntegrado.analise_completa.percentual_vs_sugerido ?? 0) >= 100 ? 'bg-green-500'
                        : (statusIntegrado.analise_completa.percentual_vs_sugerido ?? 0) >= 50 ? 'bg-yellow-500'
                        : 'bg-red-500'
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Informações da Meta */}
            <div className="bg-background/80 rounded-lg p-6 border border-primary/20">
              <h4 className="font-semibold text-lg mb-4">Informações da Meta</h4>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tipo</span>
                  <span className="font-semibold capitalize">{statusIntegrado.goal?.tipo || 'N/A'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Horizonte Original</span>
                  <span className="font-semibold">{((statusIntegrado.analise_completa.horizonte_original_meses ?? 0) / 12).toFixed(1)} anos</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Taxa Mensal</span>
                  <span className="font-semibold">{(statusIntegrado.analise_completa.taxa_mensal ?? 0).toFixed(2)}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Projeções com Diferentes Cenários */}
          {(statusIntegrado as any).projecoes && Object.keys((statusIntegrado as any).projecoes).length > 0 && (
            <div className="mb-6">
              <h4 className="font-semibold text-lg mb-4">Projeções: Quando Você Atingirá a Meta</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(statusIntegrado as any).projecoes.com_aporte_sugerido && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-5 h-5 text-blue-600" />
                      <span className="font-semibold text-blue-800 dark:text-blue-300">Cenário Ideal</span>
                    </div>
                    <div className="text-sm space-y-1">
                      <p><strong>Aporte:</strong> {formatCurrency((statusIntegrado as any).projecoes?.com_aporte_sugerido?.aporte_mensal ?? 0)}/mês</p>
                      <p><strong>Tempo:</strong> {((statusIntegrado as any).projecoes?.com_aporte_sugerido?.anos_necessarios ?? 0).toFixed(1)} anos</p>
                      <p className={(statusIntegrado as any).projecoes?.com_aporte_sugerido?.atingivel ? 'text-green-600' : 'text-red-600'}>
                        {(statusIntegrado as any).projecoes?.com_aporte_sugerido?.atingivel ? '✓ Atingível' : '⚠ Pode não ser atingível'}
                      </p>
                    </div>
                  </div>
                )}
                
                {(statusIntegrado as any).projecoes.com_aporte_real && (
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="w-5 h-5 text-green-600" />
                      <span className="font-semibold text-green-800 dark:text-green-300">Cenário Atual</span>
                    </div>
                    <div className="text-sm space-y-1">
                      <p><strong>Aporte:</strong> {formatCurrency((statusIntegrado as any).projecoes?.com_aporte_real?.aporte_mensal ?? 0)}/mês</p>
                      <p><strong>Tempo:</strong> {((statusIntegrado as any).projecoes?.com_aporte_real?.anos_necessarios ?? 0).toFixed(1)} anos</p>
                      <p className={(statusIntegrado as any).projecoes?.com_aporte_real?.atingivel ? 'text-green-600' : 'text-red-600'}>
                        {(statusIntegrado as any).projecoes?.com_aporte_real?.atingivel ? '✓ Atingível' : '⚠ Pode não ser atingível'}
                      </p>
                    </div>
                  </div>
                )}
                
                {(statusIntegrado as any).projecoes.com_meta_aporte && (
                  <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="w-5 h-5 text-purple-600" />
                      <span className="font-semibold text-purple-800 dark:text-purple-300">Com Meta Definida</span>
                    </div>
                    <div className="text-sm space-y-1">
                      <p><strong>Aporte:</strong> {formatCurrency((statusIntegrado as any).projecoes?.com_meta_aporte?.aporte_mensal ?? 0)}/mês</p>
                      <p><strong>Tempo:</strong> {((statusIntegrado as any).projecoes?.com_meta_aporte?.anos_necessarios ?? 0).toFixed(1)} anos</p>
                      <p className={(statusIntegrado as any).projecoes?.com_meta_aporte?.atingivel ? 'text-green-600' : 'text-red-600'}>
                        {(statusIntegrado as any).projecoes?.com_meta_aporte?.atingivel ? '✓ Atingível' : '⚠ Pode não ser atingível'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Sugestões Inteligentes */}
          {(statusIntegrado as any).sugestoes && (statusIntegrado as any).sugestoes.length > 0 && (
            <div className="mb-6">
              <h4 className="font-semibold text-lg mb-4">Sugestões e Recomendações</h4>
              <div className="space-y-3">
                {(statusIntegrado as any).sugestoes.map((sugestao: any, idx: number) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className={`rounded-lg p-4 border ${
                      sugestao.tipo === 'critico' 
                        ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                        : sugestao.tipo === 'atencao'
                        ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
                        : sugestao.tipo === 'sucesso'
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                        : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {sugestao.tipo === 'critico' && <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />}
                      {sugestao.tipo === 'atencao' && <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5" />}
                      {sugestao.tipo === 'sucesso' && <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />}
                      {sugestao.tipo === 'info' && <Info className="w-5 h-5 text-blue-600 mt-0.5" />}
                      <div className="flex-1">
                        <h5 className="font-semibold mb-1">{sugestao.titulo}</h5>
                        <p className="text-sm mb-2">{sugestao.mensagem}</p>
                        {sugestao.acao_sugerida && (
                          <p className="text-sm font-medium text-primary">{sugestao.acao_sugerida}</p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Metas de Aportes */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border rounded-xl p-6 shadow-sm"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold flex items-center gap-3">
            <Target className="w-6 h-6 text-primary" />
            Metas de Aportes
          </h3>
          <button
            onClick={() => setShowMetaAporteForm(!showMetaAporteForm)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 flex items-center gap-2 text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nova Meta
          </button>
        </div>

        {/* Formulário de Nova Meta */}
        {showMetaAporteForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-muted/30 border border-border rounded-lg p-4 mb-6"
          >
            <h4 className="font-semibold mb-4">Criar Nova Meta de Aporte</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Tipo de Período</label>
                <select
                  value={metaAporteTipo}
                  onChange={(e) => setMetaAporteTipo(e.target.value as any)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                  aria-label="Tipo de período da meta de aporte"
                >
                  <option value="mensal">Mensal</option>
                  <option value="rebalanceamento">Por Rebalanceamento</option>
                  <option value="anual">Anual</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Valor da Meta (R$)</label>
                <input
                  type="number"
                  value={metaAporteValor}
                  onChange={(e) => setMetaAporteValor(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                  placeholder="Ex.: 5000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Data Início</label>
                <input
                  type="date"
                  value={metaAporteDataInicio}
                  onChange={(e) => setMetaAporteDataInicio(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                  aria-label="Data de início da meta de aporte"
                />
              </div>
              {(metaAporteTipo === 'rebalanceamento' || metaAporteTipo === 'anual') && (
                <div>
                  <label className="block text-sm font-medium mb-2">Data Fim (opcional)</label>
                  <input
                    type="date"
                    value={metaAporteDataFim}
                    onChange={(e) => setMetaAporteDataFim(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                    aria-label="Data de fim da meta de aporte (opcional)"
                  />
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => {
                  if (!metaAporteValor) return
                  saveMetaAporteMutation.mutate({
                    tipo_periodo: metaAporteTipo,
                    valor_meta: parseFloat(metaAporteValor),
                    data_inicio: metaAporteDataInicio,
                    data_fim: metaAporteDataFim || undefined,
                    ativo: true
                  })
                }}
                disabled={saveMetaAporteMutation.isPending || !metaAporteValor}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 text-sm font-medium"
              >
                {saveMetaAporteMutation.isPending ? 'Salvando...' : 'Salvar'}
              </button>
              <button
                onClick={() => {
                  setShowMetaAporteForm(false)
                  setMetaAporteValor('')
                }}
                className="px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 text-sm font-medium"
              >
                Cancelar
              </button>
            </div>
          </motion.div>
        )}

        {/* Status das Metas */}
        {statusAportes && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-primary/10 to-secondary/10 border-2 border-primary/20 rounded-lg p-6 mb-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-lg">Status da Meta Ativa</h4>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                (statusAportes.percentual_concluido ?? 0) >= 100 
                  ? 'bg-green-500/20 text-green-700 dark:text-green-400'
                  : (statusAportes.percentual_concluido ?? 0) >= 50
                  ? 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400'
                  : 'bg-red-500/20 text-red-700 dark:text-red-400'
              }`}>
                {(statusAportes.percentual_concluido ?? 0).toFixed(1)}% concluído
              </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-background/50 rounded-lg p-4">
                <div className="text-sm text-muted-foreground mb-1">Meta</div>
                <div className="text-xl font-bold">{formatCurrency(statusAportes.meta.valor_meta)}</div>
                <div className="text-xs text-muted-foreground mt-1 capitalize">{statusAportes.meta.tipo_periodo}</div>
              </div>
              <div className="bg-background/50 rounded-lg p-4">
                <div className="text-sm text-muted-foreground mb-1">Realizado</div>
                <div className="text-xl font-bold text-green-600">{formatCurrency(statusAportes.realizado.valor)}</div>
                <div className="text-xs text-muted-foreground mt-1">{statusAportes.realizado.quantidade_movimentacoes} movimentações</div>
              </div>
              <div className="bg-background/50 rounded-lg p-4">
                <div className="text-sm text-muted-foreground mb-1">Faltante</div>
                <div className="text-xl font-bold text-orange-600">{formatCurrency(statusAportes.faltante)}</div>
              </div>
              <div className="bg-background/50 rounded-lg p-4">
                <div className="text-sm text-muted-foreground mb-1">Sugestão Mensal</div>
                <div className="text-xl font-bold text-primary">{formatCurrency(statusAportes.sugestao_mensal)}</div>
              </div>
            </div>

            {/* Barra de Progresso */}
            <div className="mb-4">
              <div className="w-full bg-muted rounded-full h-4 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, statusAportes.percentual_concluido ?? 0)}%` }}
                    transition={{ duration: 1 }}
                    className={`h-full ${
                      (statusAportes.percentual_concluido ?? 0) >= 100 
                        ? 'bg-green-500' 
                        : (statusAportes.percentual_concluido ?? 0) >= 50
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    }`}
                />
              </div>
            </div>

            {/* Alertas */}
            {statusAportes.alertas && statusAportes.alertas.length > 0 && (
              <div className="space-y-2">
                {statusAportes.alertas.map((alerta, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm text-orange-600 bg-orange-50 dark:bg-orange-900/20 p-2 rounded">
                    <AlertTriangle className="w-4 h-4" />
                    {alerta}
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Lista de Metas */}
        {metasAportes && metasAportes.length > 0 ? (
          <div className="space-y-3">
            {metasAportes.map((meta) => (
              <div key={meta.id} className="bg-muted/30 border border-border rounded-lg p-4 flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold">{formatCurrency(meta.valor_meta)}</span>
                    <span className="text-xs text-muted-foreground capitalize">({meta.tipo_periodo})</span>
                    {meta.ativo ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {meta.data_inicio} {meta.data_fim && `- ${meta.data_fim}`}
                  </div>
                </div>
                <button
                  onClick={() => deleteMetaAporteMutation.mutate(meta.id)}
                  disabled={deleteMetaAporteMutation.isPending}
                  className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  title="Excluir meta"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Target className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Nenhuma meta de aporte cadastrada</p>
            <p className="text-sm mt-1">Crie uma meta para acompanhar seus aportes</p>
          </div>
        )}
      </motion.div>

      {/* Configurações */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-card border border-border rounded-lg p-6"
        >
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-600" />
            Configurações da Projeção
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Valor Inicial (R$)
              </label>
              <input
                type="number"
                value={valorInicial}
                onChange={(e) => setValorInicial(e.target.value)}
                placeholder={formatCurrency(valorAtualCarteira, '')}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Deixe vazio para usar o valor atual da carteira: {formatCurrency(valorAtualCarteira)}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Período de Projeção (anos)
              </label>
              <input
                type="number"
                min="1"
                max="30"
                value={anosProjecao}
                onChange={(e) => setAnosProjecao(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                title="Período de projeção em anos"
              />
            </div>

            <div>
              <div className="flex items-center gap-3 mb-2">
                <input
                  type="checkbox"
                  id="usarCrescimentoManual"
                  checked={usarCrescimentoManual}
                  onChange={(e) => setUsarCrescimentoManual(e.target.checked)}
                  className="rounded border-border"
                />
                <label htmlFor="usarCrescimentoManual" className="text-sm font-medium">
                  Definir crescimento manual
                </label>
              </div>
              {usarCrescimentoManual && (
                <div className="space-y-2">
                  <input
                    type="number"
                    step="0.1"
                    value={crescimentoManual}
                    onChange={(e) => setCrescimentoManual(e.target.value)}
                    placeholder={`Ex.: ${((crescimentoMedioAnual ?? 0) * 100).toFixed(1)}`}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    title="Taxa de crescimento anual em porcentagem"
                  />
                  <p className="text-xs text-muted-foreground">
                    Taxa automática: {formatPercentage((crescimentoMedioAnual ?? 0) * 100)} • 
                    Digite a taxa desejada (ex: 12.5 para 12,5% ao ano)
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="considerarDividendos"
                checked={considerarDividendos}
                onChange={(e) => setConsiderarDividendos(e.target.checked)}
                className="rounded border-border"
              />
              <label htmlFor="considerarDividendos" className="text-sm font-medium">
                Considerar reinvestimento de dividendos
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="considerarAportes"
                  checked={considerarAportes}
                  onChange={(e) => setConsiderarAportes(e.target.checked)}
                  className="rounded border-border"
                />
                <label htmlFor="considerarAportes" className="text-sm font-medium">
                  Considerar aportes mensais
                </label>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground">Aporte mensal</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={aporteMensal}
                  onChange={(e) => setAporteMensal(e.target.value)}
                  placeholder="Ex.: 500"
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  disabled={!considerarAportes}
                />
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-card border border-border rounded-lg p-6"
        >
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-green-600" />
            Dados Base
          </h3>
          
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Crescimento médio anual:</span>
              <span className="font-medium text-green-600">
                {formatPercentage((crescimentoMedioAnual ?? 0) * 100)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Taxa usada na projeção:</span>
              <span className={`font-medium ${usarCrescimentoManual ? 'text-primary' : 'text-green-600'}`}>
                {usarCrescimentoManual && crescimentoManual 
                  ? formatPercentage(parseFloat(crescimentoManual) || 0)
                  : formatPercentage((crescimentoMedioAnual ?? 0) * 100)
                }
                {usarCrescimentoManual && crescimentoManual && (
                  <span className="text-xs text-muted-foreground ml-1">(manual)</span>
                )}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Meses analisados:</span>
              <span className="font-medium">
                {monthlyStats.count}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Crescimento do último mês{monthlyStats.last?.label ? ` (${monthlyStats.last.label})` : ''}:</span>
              <span className="font-medium">
                {monthlyStats.last ? formatPercentage(monthlyStats.last.r * 100) : '-'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Média mensal:</span>
              <span className="font-medium">
                {formatPercentage(monthlyStats.avg * 100)}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-muted-foreground">Dividendos médios mensais:</span>
              <span className="font-medium text-blue-600">
                {formatCurrency(dividendosMediosMensais)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Valor atual da carteira:</span>
              <span className="font-medium">
                {formatCurrency(valorAtualCarteira)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Período de análise:</span>
              <span className="font-medium">
                {filtroPeriodo === 'mensal' ? 'Mensal' :
                 filtroPeriodo === 'trimestral' ? 'Trimestral' :
                 filtroPeriodo === 'semestral' ? 'Semestral' :
                 filtroPeriodo === 'anual' ? 'Anual' :
                 filtroPeriodo === 'maximo' ? 'Máximo' : 'Últimos 12 meses'}
              </span>
            </div>
             <div className="flex justify-between">
               <span className="text-muted-foreground">Fonte dos dividendos:</span>
               <span className="font-medium text-xs">
                 {proventosRecebidos && proventosRecebidos.length > 0 ? 'Dados históricos' : 'Sem dados históricos'}
               </span>
             </div>
          </div>
        </motion.div>
      </div>

      {/* Resultados */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border rounded-lg p-6"
      >
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-purple-600" />
          Resultados da Projeção
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">Valor Final</span>
            </div>
            <p className="text-xl font-bold text-blue-900">
              {formatCurrency(valorFinal)}
            </p>
            <p className="text-xs text-blue-700">
              Sem dividendos
            </p>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-green-800">Com Dividendos</span>
            </div>
            <p className="text-xl font-bold text-green-900">
              {formatCurrency(valorFinalComDividendos)}
            </p>
            <p className="text-xs text-green-700">
              {considerarDividendos ? 'Reinvestidos' : 'Não considerados'}
            </p>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-purple-600" />
              <span className="text-sm font-medium text-purple-800">Dividendos Totais</span>
            </div>
            <p className="text-xl font-bold text-purple-900">
              {formatCurrency(totalDividendos)}
            </p>
            <p className="text-xs text-purple-700">
              Em {anosProjecao} anos
            </p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-medium text-amber-800">Aportes Totais</span>
            </div>
            <p className="text-xl font-bold text-amber-900">
              {formatCurrency(totalAportes)}
            </p>
            <p className="text-xs text-amber-700">
              {considerarAportes ? `Em ${anosProjecao} anos` : 'Sem aportes'}
            </p>
          </div>
        </div>

        {/* Gráfico */}
        <div className="w-full min-h-[280px] h-72 sm:h-80 md:h-[340px] overflow-visible">
          <ResponsiveContainer width="100%" height="100%" minHeight={280}>
            <LineChart data={projecao} margin={{ top: 12, right: 20, left: 12, bottom: 28 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis 
                dataKey="mes" 
                stroke="hsl(var(--muted-foreground))"
                tick={{ fontSize: 11 }}
                tickFormatter={(value) => `${Math.floor(value / 12)}a`}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                tick={{ fontSize: 11 }}
                width={56}
                tickFormatter={(value) => formatCurrency(value, '')}
                domain={['auto', 'auto']}
                allowDataOverflow={false}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))', 
                  borderRadius: '8px',
                  color: 'hsl(var(--foreground))'
                }}
                formatter={(value: any, name: string) => [
                  formatCurrency(value), 
                  name === 'valor' ? 'Sem Dividendos' : 'Com Dividendos'
                ]}
                labelFormatter={(value) => (value != null ? `Mês ${value} (${Math.floor(Number(value) / 12)} anos)` : '')}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line 
                type="monotone" 
                dataKey="valor" 
                name="Sem Dividendos"
                stroke="#3b82f6" 
                strokeWidth={2.5}
                dot={false}
                isAnimationActive
                animationDuration={800}
                animationEasing="ease-out"
              />
              {considerarDividendos && (
                <Line 
                  type="monotone" 
                  dataKey="valorComDividendos" 
                  name="Com Dividendos"
                  stroke="#10b981" 
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive
                  animationDuration={1000}
                  animationEasing="ease-out"
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Tabela de detalhes */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border rounded-lg p-6"
      >
        <h3 className="text-lg font-semibold mb-4">Projeção Detalhada (Anos)</h3>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr>
                <th className="px-4 py-2 text-left">Ano</th>
                <th className="px-4 py-2 text-left">Valor Sem Dividendos</th>
                <th className="px-4 py-2 text-left">Valor Com Dividendos</th>
                <th className="px-4 py-2 text-left">Dividendos Acumulados</th>
                <th className="px-4 py-2 text-left">Diferença</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: Math.max(1, parseInt(String(anosProjecao)) || 1) }, (_, i) => {
                const mesIndex = (i + 1) * 12
                const dadosAno = projecao[mesIndex]
                if (!dadosAno) return null
                
                const diferenca = dadosAno.valorComDividendos - dadosAno.valor
                
                return (
                  <tr key={i} className="hover:bg-muted/40">
                    <td className="px-4 py-2 font-medium">{i + 1}</td>
                    <td className="px-4 py-2">{formatCurrency(dadosAno.valor)}</td>
                    <td className="px-4 py-2">{formatCurrency(dadosAno.valorComDividendos)}</td>
                    <td className="px-4 py-2">{formatCurrency(dadosAno.dividendosAcumulados)}</td>
                    <td className="px-4 py-2 text-green-600 font-medium">
                      +{formatCurrency(diferenca)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  )
}
