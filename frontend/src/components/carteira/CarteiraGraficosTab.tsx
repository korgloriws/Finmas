import { useMemo, useState } from 'react'
import { 
  TrendingUp, 
  PieChart, 
  BarChart3, 
  Trophy, 
  Activity,
  Calendar,
  TrendingDown,
  Award
} from 'lucide-react'
import { formatCurrency, formatPercentage } from '../../utils/formatters'
import { getDisplayTicker } from '../../utils/tickerUtils'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
  ComposedChart,
  Line,
} from 'recharts'
import AtivosDetalhesModal from './AtivosDetalhesModal'

interface CarteiraGraficosTabProps {
  carteira: any[]
  loadingHistorico: boolean
  historicoCarteira: {
    datas: string[]
    carteira_valor: number[]
    carteira: (number | null)[]
    ibov: (number | null)[]
    ivvb11: (number | null)[]
    ifix: (number | null)[]
    ipca: (number | null)[]
    cdi?: (number | null)[]
    carteira_price?: (number | null)[]
  } | null
  filtroPeriodo: string
  setFiltroPeriodo: (value: string) => void
  ativosPorTipo: Record<string, number>
  topAtivos: any[]
}

export default function CarteiraGraficosTab({
  carteira,
  loadingHistorico,
  historicoCarteira,
  filtroPeriodo,
  setFiltroPeriodo,
  ativosPorTipo,
  topAtivos
}: CarteiraGraficosTabProps) {
  const [indiceRef, setIndiceRef] = useState<'ibov' | 'ivvb11' | 'ifix' | 'ipca' | 'cdi'>('ibov')
  const [periodoPerformance, setPeriodoPerformance] = useState<'mensal' | 'trimestral' | 'anual'>('mensal')
  
  // Estado para modal de detalhes
  const [modalAberto, setModalAberto] = useState(false)
  const [modalTitulo, setModalTitulo] = useState('')
  const [modalAtivos, setModalAtivos] = useState<any[]>([])
  const [modalTipo, setModalTipo] = useState<'tipo' | 'ativo' | 'top'>('tipo')

  // Funções para abrir modal com dados específicos
  const abrirModalPorTipo = async (tipo: string) => {
    // Se for FII, buscar dados com metadados
    if (tipo.toLowerCase().includes('fii')) {
      try {
        const response = await fetch('/api/carteira/com-metadados-fii')
        const carteiraComMetadados = await response.json()
        const ativosDoTipo = carteiraComMetadados.filter((ativo: any) => ativo.tipo === tipo)
        setModalTitulo(`Ativos - ${tipo}`)
        setModalAtivos(ativosDoTipo)
        setModalTipo('tipo')
        setModalAberto(true)
      } catch (error) {
        console.error('Erro ao buscar metadados de FIIs:', error)
        // Fallback para dados normais
        const ativosDoTipo = carteira.filter(ativo => ativo.tipo === tipo)
        setModalTitulo(`Ativos - ${tipo}`)
        setModalAtivos(ativosDoTipo)
        setModalTipo('tipo')
        setModalAberto(true)
      }
    } else {
      const ativosDoTipo = carteira.filter(ativo => ativo.tipo === tipo)
      setModalTitulo(`Ativos - ${tipo}`)
      setModalAtivos(ativosDoTipo)
      setModalTipo('tipo')
      setModalAberto(true)
    }
  }

  const abrirModalTopAtivos = async () => {
    // Verificar se há FIIs nos top ativos
    const temFIIs = topAtivos.some(ativo => ativo.tipo && ativo.tipo.toLowerCase().includes('fii'))
    
    if (temFIIs) {
      try {
        const response = await fetch('/api/carteira/com-metadados-fii')
        const carteiraComMetadados = await response.json()
        const topAtivosComMetadados = carteiraComMetadados.filter((ativo: any) => 
          topAtivos.some(top => top.ticker === ativo.ticker)
        )
        setModalTitulo('Top Ativos por Valor')
        setModalAtivos(topAtivosComMetadados)
        setModalTipo('top')
        setModalAberto(true)
      } catch (error) {
        console.error('Erro ao buscar metadados de FIIs:', error)
        // Fallback para dados normais
        setModalTitulo('Top Ativos por Valor')
        setModalAtivos(topAtivos)
        setModalTipo('top')
        setModalAberto(true)
      }
    } else {
      setModalTitulo('Top Ativos por Valor')
      setModalAtivos(topAtivos)
      setModalTipo('top')
      setModalAberto(true)
    }
  }

  const abrirModalTodosAtivos = async () => {
    // Verificar se há FIIs na carteira
    const temFIIs = carteira.some(ativo => ativo.tipo && ativo.tipo.toLowerCase().includes('fii'))
    
    if (temFIIs) {
      try {
        const response = await fetch('/api/carteira/com-metadados-fii')
        const carteiraComMetadados = await response.json()
        setModalTitulo('Todos os Ativos')
        setModalAtivos(carteiraComMetadados)
        setModalTipo('ativo')
        setModalAberto(true)
      } catch (error) {
        console.error('Erro ao buscar metadados de FIIs:', error)
        // Fallback para dados normais
        setModalTitulo('Todos os Ativos')
        setModalAtivos(carteira)
        setModalTipo('ativo')
        setModalAberto(true)
      }
    } else {
      setModalTitulo('Todos os Ativos')
      setModalAtivos(carteira)
      setModalTipo('ativo')
      setModalAberto(true)
    }
  }

  const fecharModal = () => {
    setModalAberto(false)
    setModalTitulo('')
    setModalAtivos([])
  }

  const initialWealth = useMemo(() => {
    const arr = historicoCarteira?.carteira_valor || []
    for (let i = 0; i < arr.length; i++) {
      const v = arr[i]
      if (typeof v === 'number' && !isNaN(v)) return v
    }
    return 0
  }, [historicoCarteira])

  const indiceSeries = useMemo(() => {
    if (!historicoCarteira) return [] as Array<number | null>
    const series = (historicoCarteira as any)[indiceRef] as Array<number | null> | undefined
    return series || []
  }, [historicoCarteira, indiceRef])

  // Série de retorno por preço (exclui aportes/retiradas), rebased (já vem como índice base 100)
  const carteiraRetornoSeries = useMemo(() => {
    return (historicoCarteira?.carteira_price || historicoCarteira?.carteira || []) as Array<number | null>
  }, [historicoCarteira])

  const indiceValorSeries = useMemo(() => {
    if (!historicoCarteira || initialWealth <= 0) return [] as Array<number | null>
    return (indiceSeries || []).map((v) => {
      if (v == null || isNaN(Number(v))) return null
      return initialWealth * (Number(v) / 100)
    })
  }, [historicoCarteira, indiceSeries, initialWealth])

  // Série de valor (R$) construída a partir do retorno por preço (sem aportes)
  const carteiraValorPrecoSeries = useMemo(() => {
    if (!historicoCarteira || initialWealth <= 0) return [] as Array<number | null>
    const baseSeries = carteiraRetornoSeries || []
    return baseSeries.map((v) => {
      if (v == null || isNaN(Number(v))) return null
      return initialWealth * (Number(v) / 100)
    })
  }, [historicoCarteira, carteiraRetornoSeries, initialWealth])

  const comparativoResumo = useMemo(() => {
    // Usar carteiraValorPrecoSeries (sem aportes) em vez de carteira_valor (com aportes)
    const carteiraArr = carteiraValorPrecoSeries || []
    if (!carteiraArr.length || !indiceValorSeries.length) return null as null | {
      indiceNome: string
      indiceInicial: number
      indiceFinal: number
      carteiraInicial: number
      carteiraFinal: number
      deltaIndice: number
      deltaCarteira: number
      gapAbsoluto: number
    }
    const carteiraInicial = carteiraArr.find((v) => typeof v === 'number' && v !== null) || initialWealth || 0
    const carteiraFinal = [...carteiraArr].reverse().find((v) => typeof v === 'number' && v !== null) || initialWealth || 0
    const indiceInicial = indiceValorSeries.find((v) => typeof v === 'number' && v !== null) || 0
    const indiceFinal = [...indiceValorSeries].reverse().find((v) => typeof v === 'number' && v !== null) || 0
    const deltaIndice = (indiceFinal || 0) - (indiceInicial || 0)
    const deltaCarteira = (carteiraFinal || 0) - (carteiraInicial || 0)
    const gapAbsoluto = (carteiraFinal || 0) - (indiceFinal || 0)
    const nomeMap: Record<string, string> = { ibov: 'IBOV', ivvb11: 'IVVB11', ifix: 'IFIX', ipca: 'IPCA', cdi: 'CDI' }
    return {
      indiceNome: nomeMap[indiceRef],
      indiceInicial: indiceInicial || 0,
      indiceFinal: indiceFinal || 0,
      carteiraInicial,
      carteiraFinal,
      deltaIndice,
      deltaCarteira,
      gapAbsoluto,
    }
  }, [historicoCarteira, indiceValorSeries, indiceRef, carteiraValorPrecoSeries, initialWealth])

  // Calcular performance por período (mensal, trimestral, anual)
  const performancePorPeriodo = useMemo(() => {
    if (!historicoCarteira || !historicoCarteira.datas || historicoCarteira.datas.length === 0) {
      return []
    }

    const datas = historicoCarteira.datas
    const carteiraSeries = carteiraRetornoSeries || []
    const indiceSeriesData = indiceSeries || []

    // Agrupar dados por período
    const periodos: Record<string, {
      dataInicio: string
      dataFim: string
      carteiraInicio: number | null
      carteiraFim: number | null
      indiceInicio: number | null
      indiceFim: number | null
    }> = {}

    datas.forEach((dataStr, index) => {
      const data = new Date(dataStr)
      let chavePeriodo = ''

      if (periodoPerformance === 'mensal') {
        chavePeriodo = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`
      } else if (periodoPerformance === 'trimestral') {
        const trimestre = Math.floor(data.getMonth() / 3) + 1
        chavePeriodo = `${data.getFullYear()}-T${trimestre}`
      } else if (periodoPerformance === 'anual') {
        chavePeriodo = String(data.getFullYear())
      }

      if (!chavePeriodo) return

      if (!periodos[chavePeriodo]) {
        periodos[chavePeriodo] = {
          dataInicio: dataStr,
          dataFim: dataStr,
          carteiraInicio: carteiraSeries[index] ?? null,
          carteiraFim: carteiraSeries[index] ?? null,
          indiceInicio: indiceSeriesData[index] ?? null,
          indiceFim: indiceSeriesData[index] ?? null,
        }
      } else {
        periodos[chavePeriodo].dataFim = dataStr
        if (carteiraSeries[index] !== null && carteiraSeries[index] !== undefined) {
          periodos[chavePeriodo].carteiraFim = carteiraSeries[index]
        }
        if (indiceSeriesData[index] !== null && indiceSeriesData[index] !== undefined) {
          periodos[chavePeriodo].indiceFim = indiceSeriesData[index]
        }
      }
    })

    // Calcular performance de cada período
    const resultados = Object.entries(periodos)
      .map(([periodo, dados]) => {
        const carteiraInicio = dados.carteiraInicio
        const carteiraFim = dados.carteiraFim
        const indiceInicio = dados.indiceInicio
        const indiceFim = dados.indiceFim

        let retornoCarteira = 0
        let retornoIndice = 0
        let ganhoPerda = 0

        if (carteiraInicio !== null && carteiraFim !== null && carteiraInicio > 0) {
          retornoCarteira = ((carteiraFim / carteiraInicio) - 1) * 100
          // Calcular ganho/perda em R$ (aproximado usando initialWealth)
          ganhoPerda = initialWealth * (retornoCarteira / 100)
        }

        if (indiceInicio !== null && indiceFim !== null && indiceInicio > 0) {
          retornoIndice = ((indiceFim / indiceInicio) - 1) * 100
        }

        return {
          periodo,
          dataInicio: dados.dataInicio,
          dataFim: dados.dataFim,
          retornoCarteira,
          retornoIndice,
          ganhoPerda,
          diferenca: retornoCarteira - retornoIndice,
        }
      })
      .filter(item => item.retornoCarteira !== 0 || item.retornoIndice !== 0)
      .sort((a, b) => {
        // Ordenar por data (mais recente primeiro)
        return new Date(b.dataFim).getTime() - new Date(a.dataFim).getTime()
      })

    return resultados
  }, [historicoCarteira, carteiraRetornoSeries, indiceSeries, periodoPerformance, initialWealth])

  // Calcular Sharpe Ratio vs CDI e vs SELIC
  const sharpeRatios = useMemo(() => {
    if (!historicoCarteira || !historicoCarteira.datas || historicoCarteira.datas.length < 2) {
      return {
        vsCDI: null,
        vsSELIC: null,
        dadosInsuficientes: true
      }
    }

    const carteiraSeries = carteiraRetornoSeries || []
    const cdiSeries = historicoCarteira.cdi || []
    // SELIC não está disponível diretamente, mas CDI e SELIC são muito próximos
    // Usaremos CDI como proxy para SELIC (diferença é mínima na prática)
    const selicSeries = historicoCarteira.cdi || []

    // Calcular retornos mensais da carteira
    const retornosCarteira: number[] = []
    for (let i = 1; i < carteiraSeries.length; i++) {
      const prev = carteiraSeries[i - 1]
      const curr = carteiraSeries[i]
      if (prev !== null && curr !== null && prev > 0) {
        const retorno = ((curr / prev) - 1) * 100 // Em percentual
        retornosCarteira.push(retorno)
      }
    }

    // Calcular retornos mensais do CDI
    const retornosCDI: number[] = []
    for (let i = 1; i < cdiSeries.length; i++) {
      const prev = cdiSeries[i - 1]
      const curr = cdiSeries[i]
      if (prev !== null && curr !== null && prev > 0) {
        const retorno = ((curr / prev) - 1) * 100 // Em percentual
        retornosCDI.push(retorno)
      }
    }

    // Calcular retornos mensais do SELIC (proxy CDI)
    const retornosSELIC: number[] = []
    for (let i = 1; i < selicSeries.length; i++) {
      const prev = selicSeries[i - 1]
      const curr = selicSeries[i]
      if (prev !== null && curr !== null && prev > 0) {
        const retorno = ((curr / prev) - 1) * 100 // Em percentual
        retornosSELIC.push(retorno)
      }
    }

    // Função para calcular Sharpe Ratio
    const calcularSharpe = (retornosCarteira: number[], retornosRisco: number[]): number | null => {
      if (retornosCarteira.length < 2 || retornosRisco.length < 2) return null

      // Alinhar arrays (usar o menor tamanho)
      const minLength = Math.min(retornosCarteira.length, retornosRisco.length)
      const carteiraAlinhado = retornosCarteira.slice(-minLength)
      const riscoAlinhado = retornosRisco.slice(-minLength)

      // Calcular retorno médio excesso (carteira - taxa livre de risco)
      const excessoRetornos = carteiraAlinhado.map((ret, i) => ret - (riscoAlinhado[i] || 0))
      const retornoExcessoMedio = excessoRetornos.reduce((sum, r) => sum + r, 0) / excessoRetornos.length

      // Calcular volatilidade (desvio padrão dos retornos da carteira)
      const mediaCarteira = carteiraAlinhado.reduce((sum, r) => sum + r, 0) / carteiraAlinhado.length
      const variancia = carteiraAlinhado.reduce((sum, r) => sum + Math.pow(r - mediaCarteira, 2), 0) / carteiraAlinhado.length
      const volatilidade = Math.sqrt(variancia)

      if (volatilidade === 0) return null

      // Sharpe mensal
      const sharpeMensal = retornoExcessoMedio / volatilidade

      // Anualizar (multiplicar por √12)
      const sharpeAnualizado = sharpeMensal * Math.sqrt(12)

      return sharpeAnualizado
    }

    const sharpeCDI = calcularSharpe(retornosCarteira, retornosCDI)
    const sharpeSELIC = calcularSharpe(retornosCarteira, retornosSELIC)

    return {
      vsCDI: sharpeCDI,
      vsSELIC: sharpeSELIC,
      dadosInsuficientes: sharpeCDI === null && sharpeSELIC === null
    }
  }, [historicoCarteira, carteiraRetornoSeries])

  // Calcular Análise de Contribuição (ganhos e perdas por ativo)
  const analiseContribuicao = useMemo(() => {
    if (!carteira || carteira.length === 0) {
      return {
        ganhos: [],
        perdas: [],
        totalGanho: 0,
        totalPerda: 0,
        ganhoPerdaLiquido: 0
      }
    }

    // Calcular ganho/perda de cada ativo
    const contribuicoes = carteira.map(ativo => {
      // Calcular preço médio (preferir preco_medio, senão preco_compra)
      const precoMedio = (ativo as any)?.preco_medio ?? ativo?.preco_compra ?? null
      const precoAtual = ativo?.preco_atual ?? null
      const quantidade = ativo?.quantidade ?? 0

      if (!precoMedio || !precoAtual || quantidade <= 0) {
        return null
      }

      // Ganho/Perda absoluto em R$
      const ganhoPerdaAbs = (precoAtual - precoMedio) * quantidade
      
      // Ganho/Perda percentual
      const ganhoPerdaPct = ((precoAtual - precoMedio) / precoMedio) * 100

      // Valor investido (custo)
      const valorInvestido = precoMedio * quantidade

      return {
        ticker: ativo.ticker || '',
        nome: ativo.nome_completo || '',
        tipo: ativo.tipo || 'Desconhecido',
        ganhoPerda: ganhoPerdaAbs,
        ganhoPerdaPct,
        valorInvestido,
        valorAtual: ativo.valor_total || 0,
        quantidade,
        precoMedio,
        precoAtual
      }
    }).filter(item => item !== null) as Array<{
      ticker: string
      nome: string
      tipo: string
      ganhoPerda: number
      ganhoPerdaPct: number
      valorInvestido: number
      valorAtual: number
      quantidade: number
      precoMedio: number
      precoAtual: number
    }>

    // Separar ganhos e perdas
    const ganhos = contribuicoes
      .filter(item => item.ganhoPerda > 0)
      .sort((a, b) => b.ganhoPerda - a.ganhoPerda)
      .slice(0, 3) // Top 3

    const perdas = contribuicoes
      .filter(item => item.ganhoPerda < 0)
      .sort((a, b) => a.ganhoPerda - b.ganhoPerda) // Ordenar do menor (mais negativo) para o maior
      .slice(0, 3) // Top 3

    // Calcular totais
    const totalGanho = contribuicoes
      .filter(item => item.ganhoPerda > 0)
      .reduce((sum, item) => sum + item.ganhoPerda, 0)

    const totalPerda = Math.abs(contribuicoes
      .filter(item => item.ganhoPerda < 0)
      .reduce((sum, item) => sum + item.ganhoPerda, 0))

    const ganhoPerdaLiquido = totalGanho - totalPerda

    return {
      ganhos,
      perdas,
      totalGanho,
      totalPerda,
      ganhoPerdaLiquido
    }
  }, [carteira])

  // Função para interpretar Sharpe Ratio
  const interpretarSharpe = (sharpe: number | null): { label: string; cor: string; descricao: string } => {
    if (sharpe === null) {
      return {
        label: 'N/A',
        cor: 'text-muted-foreground',
        descricao: 'Dados insuficientes'
      }
    }

    if (sharpe >= 3) {
      return {
        label: 'Excelente',
        cor: 'text-green-600',
        descricao: 'Retorno muito superior ao risco'
      }
    } else if (sharpe >= 2) {
      return {
        label: 'Muito Bom',
        cor: 'text-green-500',
        descricao: 'Retorno superior ao risco'
      }
    } else if (sharpe >= 1) {
      return {
        label: 'Bom',
        cor: 'text-blue-500',
        descricao: 'Retorno compensa o risco'
      }
    } else if (sharpe >= 0) {
      return {
        label: 'Regular',
        cor: 'text-yellow-600',
        descricao: 'Retorno próximo ao risco'
      }
    } else {
      return {
        label: 'Ruim',
        cor: 'text-red-600',
        descricao: 'Risco não compensa'
      }
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold mb-4">Análise Gráfica</h2>
      
      {!carteira || carteira.length === 0 ? (
        <div className="text-center text-muted-foreground py-8">
          Adicione ativos à sua carteira para ver os gráficos.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Gráfico de Evolução do Patrimônio */}
          <div className="bg-card border border-border rounded-2xl p-4 md:p-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 min-w-0">
              <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0">
                  <TrendingUp className="w-6 h-6 text-primary" />
                </div>
                  <h3 className="text-lg md:text-xl font-semibold text-foreground">Evolução do Patrimônio</h3>
                </div>
                <div className="text-sm text-muted-foreground">
                  Período: {(() => {
                    const periodos = {
                      'mensal': 'Mensal',
                      'trimestral': 'Trimestral',
                      'semestral': 'Semestral',
                      'anual': 'Anual',
                      'maximo': 'Máximo'
                    }
                    return periodos[filtroPeriodo as keyof typeof periodos] || 'Mensal'
                  })()}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <select
                  value={filtroPeriodo}
                  onChange={(e) => setFiltroPeriodo(e.target.value)}
                  className="px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm min-w-0 w-full sm:w-auto"
                  aria-label="Filtrar por período"
                >
                  <option value="mensal">Mensal</option>
                  <option value="trimestral">Trimestral</option>
                  <option value="semestral">Semestral</option>
                  <option value="anual">Anual</option>
                  <option value="maximo">Máximo</option>
                </select>
                <select
                  value={indiceRef}
                  onChange={(e) => setIndiceRef(e.target.value as any)}
                  className="px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm min-w-0 w-full sm:w-auto"
                  aria-label="Índice de comparação"
                >
                  <option value="ibov">IBOV</option>
                  <option value="ivvb11">IVVB11</option>
                  <option value="ifix">IFIX</option>
                  <option value="ipca">IPCA</option>
                  <option value="cdi">CDI</option>
                </select>
              </div>
            </div>
            
            {loadingHistorico ? (
              <div className="animate-pulse h-64 bg-muted rounded-lg"></div>
            ) : historicoCarteira && historicoCarteira.datas && historicoCarteira.datas.length > 0 ? (
              <>
                {/* Resumo estatístico e comparativo */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
                  <div className="bg-muted/50 rounded-lg p-3 md:p-4">
                    <div className="text-xs md:text-sm text-muted-foreground">Patrimônio Inicial (preço)</div>
                    <div className="text-base md:text-lg font-bold text-foreground">
                      {formatCurrency(carteiraValorPrecoSeries?.[0] || initialWealth || 0)}
                    </div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 md:p-4">
                    <div className="text-xs md:text-sm text-muted-foreground">Patrimônio Atual (preço)</div>
                    <div className="text-base md:text-lg font-bold text-foreground">
                      {formatCurrency(carteiraValorPrecoSeries?.[carteiraValorPrecoSeries.length - 1] || initialWealth || 0)}
                    </div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 md:p-4">
                    <div className="text-xs md:text-sm text-muted-foreground">Ganho/Perda (R$) — preço</div>
                    <div className={`text-base md:text-lg font-bold ${
                      (() => {
                        const inicial = carteiraValorPrecoSeries?.[0] || initialWealth || 0
                        const atual = carteiraValorPrecoSeries?.[carteiraValorPrecoSeries.length - 1] || initialWealth || 0
                        return atual > inicial
                      })()
                        ? 'text-green-600' 
                        : 'text-red-600'
                    }`}>
                      {(() => {
                        const inicial = carteiraValorPrecoSeries?.[0] || initialWealth || 0
                        const atual = carteiraValorPrecoSeries?.[carteiraValorPrecoSeries.length - 1] || initialWealth || 0
                        const diferenca = atual - inicial
                        return `${diferenca >= 0 ? '+' : ''}${formatCurrency(diferenca, '')}`
                      })()}
                    </div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 md:p-4">
                    <div className="text-xs md:text-sm text-muted-foreground">Ganho/Perda (%) — preço (sem aportes)</div>
                    <div className={`text-base md:text-lg font-bold ${
                      (() => {
                        const s = carteiraRetornoSeries || []
                        const first = s.find(v => typeof v === 'number') as number | undefined
                        const last = [...s].reverse().find(v => typeof v === 'number') as number | undefined
                        return (first && last && last >= first) ? 'text-green-600' : 'text-red-600'
                      })()
                    }`}>
                      {(() => {
                        const s = carteiraRetornoSeries || []
                        const first = s.find(v => typeof v === 'number') as number | undefined
                        const last = [...s].reverse().find(v => typeof v === 'number') as number | undefined
                        if (!first || !last) return '0%'
                        const crescimento = ((last / first) - 1) * 100
                        return `${crescimento > 0 ? '+' : ''}${crescimento.toFixed(2)}%`
                      })()}
                    </div>
                  </div>
                </div>
                {comparativoResumo && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-6">
                    <div className="bg-muted/50 rounded-lg p-3 md:p-4">
                      <div className="text-xs md:text-sm text-muted-foreground">{`Se investido no ${comparativoResumo.indiceNome}`}</div>
                      <div className="text-base md:text-lg font-bold text-foreground">
                        {formatCurrency(comparativoResumo.indiceFinal)}
                      </div>
                      <div className={`text-xs md:text-sm ${comparativoResumo.deltaIndice >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {`${comparativoResumo.deltaIndice >= 0 ? '+' : ''}${formatCurrency(comparativoResumo.deltaIndice, '')}`}
                      </div>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3 md:p-4">
                      <div className="text-xs md:text-sm text-muted-foreground">Carteira (Final) — preço</div>
                      <div className="text-base md:text-lg font-bold text-foreground">
                        {formatCurrency(comparativoResumo.carteiraFinal)}
                      </div>
                      <div className={`text-xs md:text-sm ${comparativoResumo.deltaCarteira >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {`${comparativoResumo.deltaCarteira >= 0 ? '+' : ''}${formatCurrency(comparativoResumo.deltaCarteira, '')}`}
                      </div>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3 md:p-4">
                      <div className="text-xs md:text-sm text-muted-foreground">Diferença vs Índice</div>
                      <div className={`text-base md:text-lg font-bold ${comparativoResumo.gapAbsoluto >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {`${comparativoResumo.gapAbsoluto >= 0 ? '+' : ''}${formatCurrency(comparativoResumo.gapAbsoluto, '')}`}
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Gráfico único: Carteira (R$) vs Índice simulado (R$) */}
                <div className="mb-2">
                  <h4 className="text-sm font-medium text-muted-foreground mb-3">Carteira vs {indiceRef.toUpperCase()} (simulado em R$)</h4>
                  <div className="h-64 sm:h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={historicoCarteira.datas.map((d, i) => ({
                        data: d,
                        carteira_valor: carteiraValorPrecoSeries?.[i] ?? null,
                        indice_valor: indiceValorSeries?.[i] ?? null,
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis 
                          dataKey="data" 
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
                        />
                        <YAxis 
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
                          tickFormatter={(value) => formatCurrency(value, '')}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))', 
                            borderRadius: '8px',
                            color: 'hsl(var(--foreground))',
                            fontSize: '12px'
                          }}
                          formatter={(value: any, name: string) => {
                            const label = name === 'carteira_valor' ? 'Carteira (preço)' : `${indiceRef.toUpperCase()} simulado`
                            return [formatCurrency(value), label]
                          }}
                          labelFormatter={(label) => `Data: ${label}`}
                        />
                        <Legend />
                        <Area type="monotone" dataKey="carteira_valor" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} strokeWidth={2} name="Carteira (preço)" />
                        <Area type="monotone" dataKey="indice_valor" stroke="#22c55e" fill="#22c55e" fillOpacity={0.1} strokeWidth={2} name={`${indiceRef.toUpperCase()} simulado`} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

              {/* Gráfico de Retorno (%) sem aportes */}
              <div className="bg-muted/30 rounded-lg p-3 md:p-4 mb-4">
                <div className="text-xs md:text-sm text-muted-foreground mb-2">Retorno (%) — preço (exclui aportes/retiradas)</div>
                <div className="h-56 sm:h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={historicoCarteira.datas.map((d, i) => ({
                      data: d,
                      carteira_idx: (carteiraRetornoSeries?.[i] ?? null),
                      indice_idx: (historicoCarteira?.[indiceRef as keyof typeof historicoCarteira]?.[i] ?? null) as number | null,
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="data" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v: any) => (typeof v === 'number' ? `${(v - 100).toFixed(0)}%` : '')} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          color: 'hsl(var(--foreground))',
                          fontSize: '12px'
                        }}
                        formatter={(value: any, name: string) => {
                          const label = name === 'carteira_idx' ? 'Carteira (preço)' : `${indiceRef.toUpperCase()} (índice)`
                          return [`${typeof value === 'number' ? (value - 100).toFixed(2) : '0'}%`, label]
                        }}
                        labelFormatter={(label) => `Data: ${label}`}
                      />
                      <Legend />
                      <Area type="monotone" dataKey="carteira_idx" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} strokeWidth={2} name="Carteira (preço)" />
                      <Area type="monotone" dataKey="indice_idx" stroke="#22c55e" fill="#22c55e" fillOpacity={0.1} strokeWidth={2} name={`${indiceRef.toUpperCase()} (índice)`} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </>
            ) : (
            <div className="h-64 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <div className="text-lg font-semibold mb-2">Nenhum dado histórico disponível</div>
                  <div className="text-sm text-muted-foreground mb-4">
                    Adicione movimentações à sua carteira para ver a evolução patrimonial
            </div>
                  <div className="text-xs text-muted-foreground">
                    Dados de exemplo serão mostrados para demonstração
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Gráficos de Distribuição */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            {/* Distribuição por Tipo */}
            <div className="bg-card border border-border rounded-2xl p-4 md:p-6 shadow-xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0">
                  <PieChart className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-base md:text-lg font-semibold text-foreground">Distribuição por Tipo de Ativo</h3>
              </div>
              {Object.keys(ativosPorTipo).length > 0 ? (
                <div className="h-64 sm:h-80">
                  <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={Object.entries(ativosPorTipo)
                        .filter(([_, valor]) => valor > 0)
                        .map(([tipo, valor]) => ({ name: tipo, value: valor }))}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      onClick={(data) => {
                        if (data && data.name) {
                          abrirModalPorTipo(data.name)
                        }
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      {Object.entries(ativosPorTipo)
                        .filter(([_, valor]) => valor > 0)
                        .map((_, index) => (
                          <Cell key={index} fill={['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'][index % 5]} />
                        ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => [formatCurrency(value), 'Valor']} />
                  </RechartsPieChart>
                </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  Nenhum dado disponível
                </div>
              )}
            </div>

            {/* Distribuição por Ativo */}
            <div className="bg-card border border-border rounded-2xl p-4 md:p-6 shadow-xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0">
                  <BarChart3 className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-base md:text-lg font-semibold text-foreground">Distribuição por Ativo</h3>
              </div>
              {carteira.length > 0 ? (
                <div className="h-64 sm:h-80">
                  <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={carteira
                        .filter(ativo => ativo?.valor_total && ativo.valor_total > 0)
                        .slice(0, 8)
                        .map(ativo => ({
                          name: getDisplayTicker(ativo?.ticker || ''),
                          value: ativo?.valor_total || 0
                        }))}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      onClick={() => abrirModalTodosAtivos()}
                      style={{ cursor: 'pointer' }}
                    >
                      {carteira
                        .filter(ativo => ativo?.valor_total && ativo.valor_total > 0)
                        .slice(0, 8)
                        .map((_, index) => (
                          <Cell key={index} fill={['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'][index % 8]} />
                        ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => [formatCurrency(value), 'Valor']} />
                  </RechartsPieChart>
                </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  Nenhum ativo disponível
                </div>
              )}
            </div>
          </div>


          {/* Seção de Performance por Período - Sempre visível */}
          <div className="bg-card border border-border rounded-2xl p-4 md:p-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0">
                  <Calendar className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg md:text-xl font-semibold text-foreground">Performance por Período</h3>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <select
                  value={periodoPerformance}
                  onChange={(e) => setPeriodoPerformance(e.target.value as 'mensal' | 'trimestral' | 'anual')}
                  className="px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm min-w-0 w-full sm:w-auto"
                  aria-label="Filtrar período de performance"
                >
                  <option value="mensal">Mensal</option>
                  <option value="trimestral">Trimestral</option>
                  <option value="anual">Anual</option>
                </select>
              </div>
            </div>

            {performancePorPeriodo.length === 0 ? (
              <>
                <div className="text-center py-12 text-muted-foreground">
                  <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm font-medium mb-2">Nenhum dado de performance disponível</p>
                  <p className="text-xs">
                    Adicione movimentações à sua carteira para ver a performance por período
                  </p>
                </div>

                {/* Cards de Sharpe Ratio - Sempre visíveis, mesmo sem dados */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 pt-6 border-t border-border">
                  {/* Sharpe Ratio vs CDI */}
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/20 dark:to-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-xl p-5 shadow-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-blue-500/20">
                          <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <h4 className="text-sm font-semibold text-foreground">Sharpe Ratio vs CDI</h4>
                      </div>
                    </div>
                    {sharpeRatios.dadosInsuficientes ? (
                      <div className="space-y-2">
                        <div className="text-2xl font-bold text-muted-foreground">-</div>
                        <div className="text-xs text-muted-foreground">
                          Dados insuficientes para cálculo
                        </div>
                        <div className="text-xs text-muted-foreground mt-2">
                          Necessário histórico mínimo de 2 meses
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className={`text-3xl font-bold ${interpretarSharpe(sharpeRatios.vsCDI).cor}`}>
                          {sharpeRatios.vsCDI !== null ? sharpeRatios.vsCDI.toFixed(2) : '-'}
                        </div>
                        <div className={`text-sm font-semibold ${interpretarSharpe(sharpeRatios.vsCDI).cor}`}>
                          {interpretarSharpe(sharpeRatios.vsCDI).label}
                        </div>
                        <div className="text-xs text-muted-foreground mt-2">
                          {interpretarSharpe(sharpeRatios.vsCDI).descricao}
                        </div>
                        {sharpeRatios.vsCDI !== null && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {sharpeRatios.vsCDI >= 1 
                              ? ' Retorno compensa o risco assumido' 
                              : ' Risco pode não compensar o retorno'}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Sharpe Ratio vs SELIC */}
                  <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/20 dark:to-green-900/30 border border-green-200 dark:border-green-800 rounded-xl p-5 shadow-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-green-500/20">
                          <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
                        </div>
                        <h4 className="text-sm font-semibold text-foreground">Sharpe Ratio vs SELIC</h4>
                      </div>
                    </div>
                    {sharpeRatios.dadosInsuficientes ? (
                      <div className="space-y-2">
                        <div className="text-2xl font-bold text-muted-foreground">-</div>
                        <div className="text-xs text-muted-foreground">
                          Dados insuficientes para cálculo
                        </div>
                        <div className="text-xs text-muted-foreground mt-2">
                          Necessário histórico mínimo de 2 meses
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className={`text-3xl font-bold ${interpretarSharpe(sharpeRatios.vsSELIC).cor}`}>
                          {sharpeRatios.vsSELIC !== null ? sharpeRatios.vsSELIC.toFixed(2) : '-'}
                        </div>
                        <div className={`text-sm font-semibold ${interpretarSharpe(sharpeRatios.vsSELIC).cor}`}>
                          {interpretarSharpe(sharpeRatios.vsSELIC).label}
                        </div>
                        <div className="text-xs text-muted-foreground mt-2">
                          {interpretarSharpe(sharpeRatios.vsSELIC).descricao}
                        </div>
                        {sharpeRatios.vsSELIC !== null && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {sharpeRatios.vsSELIC >= 1 
                              ? ' Retorno compensa o risco assumido' 
                              : ' Risco pode não compensar o retorno'}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Tabela de Performance - Estilo Google Finance */}
                <div className="overflow-x-auto mb-6">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Período</th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-muted-foreground">Retorno Carteira</th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-muted-foreground">Retorno {indiceRef.toUpperCase()}</th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-muted-foreground">Diferença</th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-muted-foreground">Ganho/Perda (R$)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {performancePorPeriodo.map((item, index) => {
                        const isPositive = item.retornoCarteira >= 0
                        const isPositiveDiff = item.diferenca >= 0
                        
                        // Formatar período
                        let periodoFormatado = item.periodo
                        if (periodoPerformance === 'mensal') {
                          const [ano, mes] = item.periodo.split('-')
                          const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
                          periodoFormatado = `${meses[parseInt(mes) - 1]}/${ano}`
                        } else if (periodoPerformance === 'trimestral') {
                          const [ano, trimestre] = item.periodo.split('-T')
                          periodoFormatado = `${trimestre}º Trim ${ano}`
                        }

                        return (
                          <tr 
                            key={index} 
                            className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                          >
                            <td className="py-3 px-4 text-sm font-medium text-foreground">{periodoFormatado}</td>
                            <td className={`py-3 px-4 text-sm font-semibold text-right ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                              {isPositive ? '+' : ''}{formatPercentage(item.retornoCarteira)}
                            </td>
                            <td className="py-3 px-4 text-sm text-right text-muted-foreground">
                              {item.retornoIndice >= 0 ? '+' : ''}{formatPercentage(item.retornoIndice)}
                            </td>
                            <td className={`py-3 px-4 text-sm font-medium text-right ${isPositiveDiff ? 'text-green-600' : 'text-red-600'}`}>
                              {isPositiveDiff ? '+' : ''}{formatPercentage(item.diferenca)}
                            </td>
                            <td className={`py-3 px-4 text-sm font-semibold text-right ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                              {isPositive ? '+' : ''}{formatCurrency(item.ganhoPerda, '')}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Gráfico de Barras Comparativo - Estilo Google Finance */}
                <div className="mt-6">
                  <h4 className="text-sm font-medium text-muted-foreground mb-4">
                    Comparativo de Performance: Carteira vs {indiceRef.toUpperCase()}
                  </h4>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={performancePorPeriodo.slice().reverse()} // Reverter para mostrar mais antigo primeiro
                        margin={{ top: 10, right: 30, left: 20, bottom: 60 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                        <XAxis
                          dataKey="periodo"
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={11}
                          angle={-45}
                          textAnchor="end"
                          height={80}
                          tickFormatter={(value) => {
                            if (periodoPerformance === 'mensal') {
                              const [ano, mes] = value.split('-')
                              const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
                              return `${meses[parseInt(mes) - 1]}/${ano.slice(2)}`
                            } else if (periodoPerformance === 'trimestral') {
                              const [ano, trimestre] = value.split('-T')
                              return `T${trimestre}/${ano.slice(2)}`
                            }
                            return value
                          }}
                        />
                        <YAxis
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={11}
                          tickFormatter={(value) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`}
                          domain={['auto', 'auto']}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                            color: 'hsl(var(--foreground))',
                            fontSize: '12px',
                            padding: '8px 12px',
                          }}
                          formatter={(value: any, name: string) => {
                            if (name === 'retornoCarteira') {
                              return [`${value >= 0 ? '+' : ''}${formatPercentage(value)}`, 'Carteira']
                            } else if (name === 'retornoIndice') {
                              return [`${value >= 0 ? '+' : ''}${formatPercentage(value)}`, indiceRef.toUpperCase()]
                            }
                            return [value, name]
                          }}
                          labelFormatter={(label) => {
                            if (periodoPerformance === 'mensal') {
                              const [ano, mes] = label.split('-')
                              const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
                              return `${meses[parseInt(mes) - 1]} ${ano}`
                            } else if (periodoPerformance === 'trimestral') {
                              const [ano, trimestre] = label.split('-T')
                              return `${trimestre}º Trimestre ${ano}`
                            }
                            return label
                          }}
                        />
                        <Legend
                          wrapperStyle={{ paddingTop: '20px' }}
                          iconType="rect"
                        />
                        <Bar
                          dataKey="retornoCarteira"
                          name="Carteira"
                          fill="hsl(var(--primary))"
                          radius={[4, 4, 0, 0]}
                          opacity={0.8}
                        />
                        <Bar
                          dataKey="retornoIndice"
                          name={indiceRef.toUpperCase()}
                          fill="hsl(var(--muted-foreground))"
                          radius={[4, 4, 0, 0]}
                          opacity={0.5}
                        />
                        <Line
                          type="monotone"
                          dataKey="diferenca"
                          name="Diferença"
                          stroke="#22c55e"
                          strokeWidth={2}
                          dot={{ r: 4, fill: '#22c55e' }}
                          strokeDasharray="5 5"
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Resumo Estatístico */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-border">
                  <div className="bg-muted/50 rounded-lg p-4">
                    <div className="text-xs text-muted-foreground mb-1">Melhor Período</div>
                    <div className="text-lg font-bold text-green-600">
                      {(() => {
                        const melhor = performancePorPeriodo.reduce((max, item) => 
                          item.retornoCarteira > max.retornoCarteira ? item : max
                        )
                        const periodo = periodoPerformance === 'mensal' 
                          ? melhor.periodo.split('-').reverse().join('/')
                          : melhor.periodo
                        return `${periodo}: +${formatPercentage(melhor.retornoCarteira)}`
                      })()}
                    </div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-4">
                    <div className="text-xs text-muted-foreground mb-1">Pior Período</div>
                    <div className="text-lg font-bold text-red-600">
                      {(() => {
                        const pior = performancePorPeriodo.reduce((min, item) => 
                          item.retornoCarteira < min.retornoCarteira ? item : min
                        )
                        const periodo = periodoPerformance === 'mensal' 
                          ? pior.periodo.split('-').reverse().join('/')
                          : pior.periodo
                        return `${periodo}: ${formatPercentage(pior.retornoCarteira)}`
                      })()}
                    </div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-4">
                    <div className="text-xs text-muted-foreground mb-1">Média de Retorno</div>
                    <div className={`text-lg font-bold ${
                      (() => {
                        const media = performancePorPeriodo.reduce((sum, item) => sum + item.retornoCarteira, 0) / performancePorPeriodo.length
                        return media >= 0 ? 'text-green-600' : 'text-red-600'
                      })()
                    }`}>
                      {(() => {
                        const media = performancePorPeriodo.reduce((sum, item) => sum + item.retornoCarteira, 0) / performancePorPeriodo.length
                        return `${media >= 0 ? '+' : ''}${formatPercentage(media)}`
                      })()}
                    </div>
                  </div>
                </div>

                {/* Cards de Sharpe Ratio - Sempre visíveis */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 pt-6 border-t border-border">
                  {/* Sharpe Ratio vs CDI */}
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/20 dark:to-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-xl p-5 shadow-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-blue-500/20">
                          <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <h4 className="text-sm font-semibold text-foreground">Sharpe Ratio vs CDI</h4>
                      </div>
                    </div>
                    {sharpeRatios.dadosInsuficientes ? (
                      <div className="space-y-2">
                        <div className="text-2xl font-bold text-muted-foreground">-</div>
                        <div className="text-xs text-muted-foreground">
                          Dados insuficientes para cálculo
                        </div>
                        <div className="text-xs text-muted-foreground mt-2">
                          Necessário histórico mínimo de 2 meses
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className={`text-3xl font-bold ${interpretarSharpe(sharpeRatios.vsCDI).cor}`}>
                          {sharpeRatios.vsCDI !== null ? sharpeRatios.vsCDI.toFixed(2) : '-'}
                        </div>
                        <div className={`text-sm font-semibold ${interpretarSharpe(sharpeRatios.vsCDI).cor}`}>
                          {interpretarSharpe(sharpeRatios.vsCDI).label}
                        </div>
                        <div className="text-xs text-muted-foreground mt-2">
                          {interpretarSharpe(sharpeRatios.vsCDI).descricao}
                        </div>
                        {sharpeRatios.vsCDI !== null && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {sharpeRatios.vsCDI >= 1 
                              ? '✓ Retorno compensa o risco assumido' 
                              : ' Risco pode não compensar o retorno'}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Sharpe Ratio vs SELIC */}
                  <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/20 dark:to-green-900/30 border border-green-200 dark:border-green-800 rounded-xl p-5 shadow-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-green-500/20">
                          <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
                        </div>
                        <h4 className="text-sm font-semibold text-foreground">Sharpe Ratio vs SELIC</h4>
                      </div>
                    </div>
                    {sharpeRatios.dadosInsuficientes ? (
                      <div className="space-y-2">
                        <div className="text-2xl font-bold text-muted-foreground">-</div>
                        <div className="text-xs text-muted-foreground">
                          Dados insuficientes para cálculo
                        </div>
                        <div className="text-xs text-muted-foreground mt-2">
                          Necessário histórico mínimo de 2 meses
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className={`text-3xl font-bold ${interpretarSharpe(sharpeRatios.vsSELIC).cor}`}>
                          {sharpeRatios.vsSELIC !== null ? sharpeRatios.vsSELIC.toFixed(2) : '-'}
                        </div>
                        <div className={`text-sm font-semibold ${interpretarSharpe(sharpeRatios.vsSELIC).cor}`}>
                          {interpretarSharpe(sharpeRatios.vsSELIC).label}
                        </div>
                        <div className="text-xs text-muted-foreground mt-2">
                          {interpretarSharpe(sharpeRatios.vsSELIC).descricao}
                        </div>
                        {sharpeRatios.vsSELIC !== null && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {sharpeRatios.vsSELIC >= 1 
                              ? '✓ Retorno compensa o risco assumido' 
                              : 'Risco pode não compensar o retorno'}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Análise de Contribuição - Top 3 Ganhos e Perdas */}
          <div className="bg-card border border-border rounded-2xl p-4 md:p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0">
                <Award className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg md:text-xl font-semibold text-foreground">Análise de Contribuição</h3>
            </div>

            {carteira && carteira.length > 0 && (analiseContribuicao.ganhos.length > 0 || analiseContribuicao.perdas.length > 0) ? (
              <div className="space-y-6">
                {/* Cards de Resumo */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/20 dark:to-green-900/30 border border-green-200 dark:border-green-800 rounded-xl p-4">
                    <div className="text-xs text-muted-foreground mb-1">Total de Ganhos</div>
                    <div className="text-2xl font-bold text-green-600">
                      {formatCurrency(analiseContribuicao.totalGanho, '')}
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950/20 dark:to-red-900/30 border border-red-200 dark:border-red-800 rounded-xl p-4">
                    <div className="text-xs text-muted-foreground mb-1">Total de Perdas</div>
                    <div className="text-2xl font-bold text-red-600">
                      {formatCurrency(analiseContribuicao.totalPerda, '')}
                    </div>
                  </div>
                  <div className={`bg-gradient-to-br ${
                    analiseContribuicao.ganhoPerdaLiquido >= 0
                      ? 'from-blue-50 to-blue-100 dark:from-blue-950/20 dark:to-blue-900/30 border-blue-200 dark:border-blue-800'
                      : 'from-orange-50 to-orange-100 dark:from-orange-950/20 dark:to-orange-900/30 border-orange-200 dark:border-orange-800'
                  } border rounded-xl p-4`}>
                    <div className="text-xs text-muted-foreground mb-1">Resultado Líquido</div>
                    <div className={`text-2xl font-bold ${
                      analiseContribuicao.ganhoPerdaLiquido >= 0 ? 'text-blue-600' : 'text-orange-600'
                    }`}>
                      {analiseContribuicao.ganhoPerdaLiquido >= 0 ? '+' : ''}
                      {formatCurrency(analiseContribuicao.ganhoPerdaLiquido, '')}
                    </div>
                  </div>
                </div>

                {/* Top 3 Ganhos e Perdas - Side by Side */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Top 3 Ganhos */}
                  <div className="bg-gradient-to-br from-green-50/50 to-green-100/30 dark:from-green-950/10 dark:to-green-900/20 border border-green-200/50 dark:border-green-800/50 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="p-2 rounded-lg bg-green-500/20">
                        <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
                      </div>
                      <h4 className="text-base font-semibold text-foreground">Top 3 Maiores Ganhos</h4>
                    </div>
                    {analiseContribuicao.ganhos.length > 0 ? (
                      <>
                        {/* Gráfico de Barras Horizontal */}
                        <div className="h-48 mb-4">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={analiseContribuicao.ganhos.map(item => ({
                                ticker: getDisplayTicker(item.ticker),
                                ganho: item.ganhoPerda,
                                ganhoPct: item.ganhoPerdaPct
                              }))}
                              layout="vertical"
                              margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                              <XAxis
                                type="number"
                                stroke="hsl(var(--muted-foreground))"
                                fontSize={11}
                                tickFormatter={(value) => formatCurrency(value, '')}
                              />
                              <YAxis
                                type="category"
                                dataKey="ticker"
                                stroke="hsl(var(--muted-foreground))"
                                fontSize={11}
                                width={70}
                              />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: 'hsl(var(--card))',
                                  border: '1px solid hsl(var(--border))',
                                  borderRadius: '8px',
                                  color: 'hsl(var(--foreground))',
                                  fontSize: '12px',
                                  padding: '8px 12px',
                                }}
                                formatter={(value: any, name: string) => {
                                  if (name === 'ganho') {
                                    return [formatCurrency(value), 'Ganho']
                                  }
                                  return [value, name]
                                }}
                              />
                              <Bar
                                dataKey="ganho"
                                fill="#22c55e"
                                radius={[0, 4, 4, 0]}
                              >
                                {analiseContribuicao.ganhos.map((_, index) => (
                                  <Cell key={index} fill="#22c55e" />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Lista Detalhada */}
                        <div className="space-y-3">
                          {analiseContribuicao.ganhos.map((item, index) => (
                            <div
                              key={item.ticker}
                              className="bg-background/50 rounded-lg p-3 border border-green-200/30 dark:border-green-800/30"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center text-xs font-bold text-green-600 dark:text-green-400">
                                    {index + 1}
                                  </div>
                                  <div>
                                    <div className="font-semibold text-sm text-foreground">
                                      {getDisplayTicker(item.ticker)}
                                    </div>
                                    <div className="text-xs text-muted-foreground truncate max-w-[150px]">
                                      {item.nome}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-sm font-bold text-green-600">
                                    +{formatCurrency(item.ganhoPerda, '')}
                                  </div>
                                  <div className="text-xs text-green-500">
                                    +{formatPercentage(item.ganhoPerdaPct)}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Nenhum ganho registrado</p>
                      </div>
                    )}
                  </div>

                  {/* Top 3 Perdas */}
                  <div className="bg-gradient-to-br from-red-50/50 to-red-100/30 dark:from-red-950/10 dark:to-red-900/20 border border-red-200/50 dark:border-red-800/50 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="p-2 rounded-lg bg-red-500/20">
                        <TrendingDown className="w-5 h-5 text-red-600 dark:text-red-400" />
                      </div>
                      <h4 className="text-base font-semibold text-foreground">Top 3 Maiores Perdas</h4>
                    </div>
                    {analiseContribuicao.perdas.length > 0 ? (
                      <>
                        {/* Gráfico de Barras Horizontal */}
                        <div className="h-48 mb-4">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={analiseContribuicao.perdas.map(item => ({
                                ticker: getDisplayTicker(item.ticker),
                                perda: Math.abs(item.ganhoPerda), // Valor absoluto para visualização
                                perdaPct: Math.abs(item.ganhoPerdaPct)
                              }))}
                              layout="vertical"
                              margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                              <XAxis
                                type="number"
                                stroke="hsl(var(--muted-foreground))"
                                fontSize={11}
                                tickFormatter={(value) => formatCurrency(value, '')}
                              />
                              <YAxis
                                type="category"
                                dataKey="ticker"
                                stroke="hsl(var(--muted-foreground))"
                                fontSize={11}
                                width={70}
                              />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: 'hsl(var(--card))',
                                  border: '1px solid hsl(var(--border))',
                                  borderRadius: '8px',
                                  color: 'hsl(var(--foreground))',
                                  fontSize: '12px',
                                  padding: '8px 12px',
                                }}
                                formatter={(value: any, name: string) => {
                                  if (name === 'perda') {
                                    return [`-${formatCurrency(value)}`, 'Perda']
                                  }
                                  return [value, name]
                                }}
                              />
                              <Bar
                                dataKey="perda"
                                fill="#ef4444"
                                radius={[0, 4, 4, 0]}
                              >
                                {analiseContribuicao.perdas.map((_, index) => (
                                  <Cell key={index} fill="#ef4444" />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Lista Detalhada */}
                        <div className="space-y-3">
                          {analiseContribuicao.perdas.map((item, index) => (
                            <div
                              key={item.ticker}
                              className="bg-background/50 rounded-lg p-3 border border-red-200/30 dark:border-red-800/30"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center text-xs font-bold text-red-600 dark:text-red-400">
                                    {index + 1}
                                  </div>
                                  <div>
                                    <div className="font-semibold text-sm text-foreground">
                                      {getDisplayTicker(item.ticker)}
                                    </div>
                                    <div className="text-xs text-muted-foreground truncate max-w-[150px]">
                                      {item.nome}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-sm font-bold text-red-600">
                                    {formatCurrency(item.ganhoPerda, '')}
                                  </div>
                                  <div className="text-xs text-red-500">
                                    {formatPercentage(item.ganhoPerdaPct)}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <TrendingDown className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Nenhuma perda registrada</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Award className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm font-medium mb-2">Nenhum dado de contribuição disponível</p>
                <p className="text-xs">
                  Adicione ativos com preço de compra para ver a análise de contribuição
                </p>
              </div>
            )}
          </div>

          {/* Gráficos de Barras */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            {/* Top 5 Maiores Posições */}
            <div className="bg-card border border-border rounded-2xl p-4 md:p-6 shadow-xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0">
                  <Trophy className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-base md:text-lg font-semibold text-foreground">Top 5 Maiores Posições</h3>
              </div>
              {topAtivos.length > 0 ? (
                <div className="h-64 sm:h-80">
                  <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topAtivos}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="ticker" 
                      stroke="hsl(var(--muted-foreground))"
                        fontSize={10}
                        angle={-45}
                        textAnchor="end"
                        height={60}
                    />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))"
                        fontSize={10}
                      tickFormatter={(value) => formatCurrency(value).replace('R$ ', '')}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))', 
                        borderRadius: '8px',
                        color: 'hsl(var(--foreground))'
                      }}
                      formatter={(value: any) => [formatCurrency(value), 'Valor Total']}
                    />
                    <Bar 
                      dataKey="valor_total" 
                      fill="hsl(var(--primary))" 
                      radius={[4, 4, 0, 0]}
                      onClick={() => abrirModalTopAtivos()}
                      style={{ cursor: 'pointer' }}
                    />
                  </BarChart>
                </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  Nenhuma posição disponível
                </div>
              )}
            </div>

            {/* Top 10 Ativos por Valor */}
            <div className="bg-card border border-border rounded-2xl p-4 md:p-6 shadow-xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0">
                  <Activity className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-base md:text-lg font-semibold text-foreground">Top 10 Ativos por Valor</h3>
              </div>
              {carteira.length > 0 ? (
                <div className="h-64 sm:h-80">
                  <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={carteira.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="ticker" 
                      stroke="hsl(var(--muted-foreground))"
                        fontSize={10}
                      angle={-45}
                      textAnchor="end"
                        height={60}
                    />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))"
                        fontSize={10}
                      tickFormatter={(value) => formatCurrency(value).replace('R$ ', '')}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))', 
                        borderRadius: '8px',
                        color: 'hsl(var(--foreground))'
                      }}
                      formatter={(value: any) => [formatCurrency(value), 'Valor Total']}
                    />
                    <Bar 
                      dataKey="valor_total" 
                      fill="hsl(var(--primary))" 
                      radius={[4, 4, 0, 0]}
                      onClick={() => abrirModalTodosAtivos()}
                      style={{ cursor: 'pointer' }}
                    />
                  </BarChart>
                </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  Nenhum ativo disponível
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalhes dos Ativos */}
      <AtivosDetalhesModal
        isOpen={modalAberto}
        onClose={fecharModal}
        titulo={modalTitulo}
        ativos={modalAtivos}
        tipoFiltro={modalTipo}
      />
    </div>
  )
}
