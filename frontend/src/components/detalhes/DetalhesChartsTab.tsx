import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { 
  BarChart3, 
  TrendingUp, 
  DollarSign,
  Activity,
  Layers,
  TrendingDown,
  LineChart
} from 'lucide-react'
import { formatCurrency } from '../../utils/formatters'
import { ativoService } from '../../services/api'
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart as RechartsBarChart,
  Bar,
  LineChart as RechartsLineChart,
  Line,
  ComposedChart,
  Area,
  AreaChart,
} from 'recharts'

// Tooltip customizado para Dividend Yield (apenas percentual)
function DividendYieldTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    const data = payload[0]
    if (data.dataKey === 'DividendYield' || data.name === 'Dividend Yield') {
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-semibold text-foreground mb-2">
            {new Date(label).toLocaleDateString('pt-BR')}
          </p>
          <p className="text-sm text-foreground">
            <span className="text-muted-foreground">Dividend Yield: </span>
            <span className="font-semibold text-primary">{Number(data.value).toFixed(2)}%</span>
          </p>
        </div>
      )
    }
  }
  return null
}

// Componente para loading spinner
function LoadingSpinner({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm text-muted-foreground">{text}</p>
      </div>
    </div>
  )
}

// Componente para seção de informações
function InfoSection({ 
  title, 
  icon: Icon, 
  children 
}: {
  title: string
  icon: any
  children: React.ReactNode
}) {
  return (
    <div className="relative overflow-hidden bg-card border border-border rounded-xl sm:rounded-2xl p-4 sm:p-6 hover:shadow-lg transition-all duration-300">
      {/* Background pattern */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-1.5 sm:p-2 rounded-md sm:rounded-lg bg-primary text-primary-foreground shadow-lg">
            <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <h3 className="text-base sm:text-lg font-semibold text-foreground">{title}</h3>
        </div>
        {children}
      </div>
    </div>
  )
}

interface DetalhesChartsTabProps {
  periodo: string
  handlePeriodoChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
  loadingHistorico: boolean
  chartData: Array<Record<string, any>>
  dividendYieldChartData: Array<Record<string, any>>
  historicoDividendos?: Record<string, number> | null
  ticker?: string
}

export default function DetalhesChartsTab({
  periodo,
  handlePeriodoChange,
  loadingHistorico,
  chartData,
  dividendYieldChartData,
  historicoDividendos,
  ticker
}: DetalhesChartsTabProps) {
  // Buscar dados fundamentais
  const { data: fundamentals, isLoading: loadingFundamentals } = useQuery({
    queryKey: ['ativo-fundamentals', ticker],
    queryFn: () => ticker ? ativoService.getFundamentals(ticker) : null,
    enabled: !!ticker,
    staleTime: 60 * 60 * 1000, // 1 hora
    refetchOnWindowFocus: false,
  })

  const dividendosAcumulados = useMemo(() => {
    if (!historicoDividendos) return []
    
    const entries = Object.entries(historicoDividendos)
      .map(([date, value]) => ({
        date: new Date(date),
        value: value as number
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime())
    
    let acumulado = 0
    return entries.map(entry => {
      acumulado += entry.value
      return {
        Date: entry.date.toISOString(),
        Dividendo: entry.value,
        Acumulado: acumulado
      }
    })
  }, [historicoDividendos])

  // Calcular crescimento de dividendos (variação percentual)
  const crescimentoDividendos = useMemo(() => {
    if (!historicoDividendos || Object.keys(historicoDividendos).length < 2) return []
    
    const entries = Object.entries(historicoDividendos)
      .map(([date, value]) => ({
        date: new Date(date),
        value: value as number
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime())
    
    return entries.map((entry, index) => {
      if (index === 0) {
        return {
          Date: entry.date.toISOString(),
          Dividendo: entry.value,
          Crescimento: 0,
          Variacao: 0
        }
      }
      
      const anterior = entries[index - 1]
      const variacao = entry.value - anterior.value
      const crescimento = anterior.value !== 0 
        ? ((entry.value - anterior.value) / anterior.value) * 100 
        : 0
      
      return {
        Date: entry.date.toISOString(),
        Dividendo: entry.value,
        Crescimento: crescimento,
        Variacao: variacao
      }
    })
  }, [historicoDividendos])

  // Dados de volume (se disponível no chartData)
  const volumeData = useMemo(() => {
    if (!chartData || chartData.length === 0) return []
    return chartData
      .filter(item => item.Volume != null)
      .map(item => ({
        Date: item.Date,
        Volume: item.Volume || 0
      }))
  }, [chartData])
  return (
    <motion.div
      key="charts"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      {/* Controles dos gráficos */}
      <div className="relative overflow-hidden bg-card border border-border rounded-xl sm:rounded-2xl p-4 sm:p-6">
        <div className="flex items-center gap-4 flex-wrap">
          <label className="font-medium flex items-center gap-2 text-foreground">
            <div className="p-1.5 sm:p-2 rounded-md sm:rounded-lg bg-primary text-primary-foreground shadow-lg">
              <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span className="text-sm sm:text-base">Período dos Gráficos:</span>
          </label>
          <select
            value={periodo}
            onChange={handlePeriodoChange}
            className="px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all"
            aria-label="Selecionar período dos gráficos"
          >
            <option value="1mo">1 mês</option>
            <option value="3mo">3 meses</option>
            <option value="6mo">6 meses</option>
            <option value="1y">1 ano</option>
            <option value="5y">5 anos</option>
            <option value="max">Máximo</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Gráfico de Dividend Yield */}
        <InfoSection title="Evolução do Dividend Yield" icon={BarChart3}>
          {loadingHistorico ? (
            <LoadingSpinner text="Carregando gráfico..." />
          ) : dividendYieldChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <RechartsBarChart data={dividendYieldChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="Date" 
                  stroke="hsl(var(--muted-foreground))"
                  tickFormatter={(value) => new Date(value).toLocaleDateString('pt-BR')}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  tickFormatter={(value) => `${value.toFixed(1)}%`}
                  label={{ 
                    value: 'Dividend Yield (%)', 
                    angle: -90, 
                    position: 'insideLeft',
                    style: { textAnchor: 'middle', fill: 'hsl(var(--muted-foreground))' }
                  }}
                />
                <Tooltip content={<DividendYieldTooltip />} />
                <Bar dataKey="DividendYield" fill="hsl(var(--primary))" name="Dividend Yield" />
              </RechartsBarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              Dados não disponíveis
            </div>
          )}
        </InfoSection>

        {/* Gráfico de Volume de Negociação */}
        {volumeData.length > 0 && (
          <InfoSection title="Volume de Negociação" icon={Activity}>
            {loadingHistorico ? (
              <LoadingSpinner text="Carregando gráfico..." />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <RechartsBarChart data={volumeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="Date" 
                    stroke="hsl(var(--muted-foreground))"
                    tickFormatter={(value) => new Date(value).toLocaleDateString('pt-BR')}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    tickFormatter={(value) => {
                      if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`
                      if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`
                      if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`
                      return value.toString()
                    }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))', 
                      borderRadius: '8px',
                      color: 'hsl(var(--foreground))'
                    }}
                    labelFormatter={(value) => new Date(value).toLocaleDateString('pt-BR')}
                    formatter={(value: number) => [value.toLocaleString('pt-BR'), 'Volume']}
                  />
                  <Bar dataKey="Volume" fill="hsl(var(--primary))" name="Volume" />
                </RechartsBarChart>
              </ResponsiveContainer>
            )}
          </InfoSection>
        )}
      </div>

      {/* Gráfico de Dividendos em Valores */}
      <InfoSection title="Evolução dos Dividendos" icon={DollarSign}>
        {loadingHistorico ? (
          <LoadingSpinner text="Carregando gráfico..." />
        ) : dividendYieldChartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <RechartsLineChart data={dividendYieldChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="Date" 
                stroke="hsl(var(--muted-foreground))"
                tickFormatter={(value) => new Date(value).toLocaleDateString('pt-BR')}
              />
              <YAxis stroke="hsl(var(--muted-foreground))" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))', 
                  borderRadius: '8px',
                  color: 'hsl(var(--foreground))'
                }}
                labelFormatter={(value) => new Date(value).toLocaleDateString('pt-BR')}
                formatter={(value: number) => [formatCurrency(value), 'Dividendo']}
              />
              <Line type="monotone" dataKey="Dividend" stroke="hsl(var(--primary))" strokeWidth={2} />
            </RechartsLineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            Dados não disponíveis
          </div>
        )}
      </InfoSection>

      {/* Gráfico de Soma Acumulada de Dividendos */}
      {dividendosAcumulados.length > 0 && (
        <InfoSection title="Soma Acumulada de Dividendos" icon={Layers}>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={dividendosAcumulados}>
              <defs>
                <linearGradient id="colorAcumulado" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="Date" 
                stroke="hsl(var(--muted-foreground))"
                tickFormatter={(value) => new Date(value).toLocaleDateString('pt-BR')}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                tickFormatter={(value) => formatCurrency(value)}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))', 
                  borderRadius: '8px',
                  color: 'hsl(var(--foreground))'
                }}
                labelFormatter={(value) => new Date(value).toLocaleDateString('pt-BR')}
                formatter={(value: number) => [formatCurrency(value), 'Total Acumulado']}
              />
              <Area 
                type="monotone" 
                dataKey="Acumulado" 
                stroke="hsl(var(--primary))" 
                fill="url(#colorAcumulado)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </InfoSection>
      )}

      {/* Gráfico de Crescimento de Dividendos */}
      {crescimentoDividendos.length > 1 && (
        <InfoSection title="Crescimento de Dividendos" icon={TrendingUp}>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={crescimentoDividendos}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="Date" 
                stroke="hsl(var(--muted-foreground))"
                tickFormatter={(value) => new Date(value).toLocaleDateString('pt-BR')}
              />
              <YAxis 
                yAxisId="left"
                stroke="hsl(var(--muted-foreground))"
                tickFormatter={(value) => formatCurrency(value)}
                label={{ 
                  value: 'Valor do Dividendo', 
                  angle: -90, 
                  position: 'insideLeft',
                  style: { textAnchor: 'middle', fill: 'hsl(var(--muted-foreground))' }
                }}
              />
              <YAxis 
                yAxisId="right"
                orientation="right"
                stroke="hsl(var(--primary))"
                tickFormatter={(value) => `${value > 0 ? '+' : ''}${value.toFixed(1)}%`}
                label={{ 
                  value: 'Crescimento (%)', 
                  angle: 90, 
                  position: 'insideRight',
                  style: { textAnchor: 'middle', fill: 'hsl(var(--primary))' }
                }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))', 
                  borderRadius: '8px',
                  color: 'hsl(var(--foreground))'
                }}
                labelFormatter={(value) => new Date(value).toLocaleDateString('pt-BR')}
                formatter={(value: number, name: string) => {
                  if (name === 'Dividendo') return [formatCurrency(value), 'Dividendo']
                  if (name === 'Crescimento') return [`${value > 0 ? '+' : ''}${value.toFixed(2)}%`, 'Crescimento']
                  return [value, name]
                }}
              />
              <Bar 
                yAxisId="left"
                dataKey="Dividendo" 
                fill="hsl(var(--primary))" 
                name="Dividendo"
                opacity={0.7}
              />
              <Line 
                yAxisId="right"
                type="monotone" 
                dataKey="Crescimento" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                name="Crescimento"
                dot={{ fill: 'hsl(var(--primary))', r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </InfoSection>
      )}

      {/* Seção de Gráficos Fundamentais */}
      {(fundamentals || loadingFundamentals) && (
        <>
          <div className="mt-8 pt-6 border-t border-border">
            <h2 className="text-xl font-semibold text-foreground mb-6 flex items-center gap-2">
              <LineChart className="w-5 h-5 text-primary" />
              Análise Fundamental
            </h2>
          </div>

          {loadingFundamentals ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner text="Carregando dados fundamentais..." />
            </div>
          ) : fundamentals ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Crescimento de Lucro */}
            {fundamentals.earnings && fundamentals.earnings.length > 0 && (
              <InfoSection title="Crescimento de Lucro (Trimestral)" icon={TrendingUp}>
                <ResponsiveContainer width="100%" height={300}>
                    <RechartsLineChart data={fundamentals.earnings.map(e => ({
                      Date: e.date,
                      Earnings: e.earnings
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="Date" 
                        stroke="hsl(var(--muted-foreground))"
                        tickFormatter={(value) => new Date(value).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })}
                      />
                      <YAxis 
                        stroke="hsl(var(--muted-foreground))"
                        tickFormatter={(value) => formatCurrency(value)}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))', 
                          borderRadius: '8px',
                          color: 'hsl(var(--foreground))'
                        }}
                        labelFormatter={(value) => new Date(value).toLocaleDateString('pt-BR')}
                        formatter={(value: number) => [formatCurrency(value), 'Lucro']}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="Earnings" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={2}
                        dot={{ fill: 'hsl(var(--primary))', r: 4 }}
                      />
                    </RechartsLineChart>
                  </ResponsiveContainer>
              </InfoSection>
            )}

            {/* Crescimento de Receita */}
            {fundamentals.revenue && fundamentals.revenue.length > 0 && (
              <InfoSection title="Crescimento de Receita (Trimestral)" icon={TrendingUp}>
                <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={fundamentals.revenue.map(r => ({
                      Date: r.date,
                      Revenue: r.revenue
                    }))}>
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="Date" 
                        stroke="hsl(var(--muted-foreground))"
                        tickFormatter={(value) => new Date(value).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })}
                      />
                      <YAxis 
                        stroke="hsl(var(--muted-foreground))"
                        tickFormatter={(value) => formatCurrency(value)}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))', 
                          borderRadius: '8px',
                          color: 'hsl(var(--foreground))'
                        }}
                        labelFormatter={(value) => new Date(value).toLocaleDateString('pt-BR')}
                        formatter={(value: number) => [formatCurrency(value), 'Receita']}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="Revenue" 
                        stroke="hsl(var(--primary))" 
                        fill="url(#colorRevenue)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
              </InfoSection>
            )}

            {/* Evolução da Dívida */}
            {fundamentals.debt && fundamentals.debt.length > 0 && (
              <InfoSection title="Evolução da Dívida (Trimestral)" icon={TrendingDown}>
                <ResponsiveContainer width="100%" height={300}>
                    <RechartsLineChart data={fundamentals.debt.map(d => ({
                      Date: d.date,
                      Debt: d.debt
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="Date" 
                        stroke="hsl(var(--muted-foreground))"
                        tickFormatter={(value) => new Date(value).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })}
                      />
                      <YAxis 
                        stroke="hsl(var(--muted-foreground))"
                        tickFormatter={(value) => formatCurrency(value)}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))', 
                          borderRadius: '8px',
                          color: 'hsl(var(--foreground))'
                        }}
                        labelFormatter={(value) => new Date(value).toLocaleDateString('pt-BR')}
                        formatter={(value: number) => [formatCurrency(value), 'Dívida']}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="Debt" 
                        stroke="#ef4444" 
                        strokeWidth={2}
                        dot={{ fill: '#ef4444', r: 4 }}
                      />
                    </RechartsLineChart>
                  </ResponsiveContainer>
              </InfoSection>
            )}

            {/* Margens (Gross, Operating, Net) */}
            {fundamentals.gross_profit && fundamentals.gross_profit.length > 0 && 
             fundamentals.revenue && fundamentals.revenue.length > 0 && (
              <InfoSection title="Margens (Trimestral)" icon={BarChart3}>
                <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={fundamentals.revenue.map((r) => {
                      const gross = fundamentals.gross_profit?.find(g => g.date === r.date)
                      const operating = fundamentals.operating_income?.find(o => o.date === r.date)
                      const net = fundamentals.net_income?.find(n => n.date === r.date)
                      
                      return {
                        Date: r.date,
                        GrossMargin: gross && r.revenue > 0 ? (gross.gross_profit / r.revenue) * 100 : null,
                        OperatingMargin: operating && r.revenue > 0 ? (operating.operating_income / r.revenue) * 100 : null,
                        NetMargin: net && r.revenue > 0 ? (net.net_income / r.revenue) * 100 : null
                      }
                    }).filter(d => d.GrossMargin != null || d.OperatingMargin != null || d.NetMargin != null)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="Date" 
                        stroke="hsl(var(--muted-foreground))"
                        tickFormatter={(value) => new Date(value).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })}
                      />
                      <YAxis 
                        stroke="hsl(var(--muted-foreground))"
                        tickFormatter={(value) => `${value.toFixed(1)}%`}
                        label={{ 
                          value: 'Margem (%)', 
                          angle: -90, 
                          position: 'insideLeft',
                          style: { textAnchor: 'middle', fill: 'hsl(var(--muted-foreground))' }
                        }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))', 
                          borderRadius: '8px',
                          color: 'hsl(var(--foreground))'
                        }}
                        labelFormatter={(value) => new Date(value).toLocaleDateString('pt-BR')}
                        formatter={(value: number, name: string) => {
                          const labels: Record<string, string> = {
                            'GrossMargin': 'Margem Bruta',
                            'OperatingMargin': 'Margem Operacional',
                            'NetMargin': 'Margem Líquida'
                          }
                          return [`${value?.toFixed(2)}%`, labels[name] || name]
                        }}
                      />
                      {fundamentals.gross_profit && fundamentals.gross_profit.length > 0 && (
                        <Line 
                          type="monotone" 
                          dataKey="GrossMargin" 
                          stroke="#10b981" 
                          strokeWidth={2}
                          name="GrossMargin"
                          dot={{ fill: '#10b981', r: 3 }}
                        />
                      )}
                      {fundamentals.operating_income && fundamentals.operating_income.length > 0 && (
                        <Line 
                          type="monotone" 
                          dataKey="OperatingMargin" 
                          stroke="#3b82f6" 
                          strokeWidth={2}
                          name="OperatingMargin"
                          dot={{ fill: '#3b82f6', r: 3 }}
                        />
                      )}
                      {fundamentals.net_income && fundamentals.net_income.length > 0 && (
                        <Line 
                          type="monotone" 
                          dataKey="NetMargin" 
                          stroke="hsl(var(--primary))" 
                          strokeWidth={2}
                          name="NetMargin"
                          dot={{ fill: 'hsl(var(--primary))', r: 3 }}
                        />
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>
              </InfoSection>
            )}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <LineChart className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Dados fundamentais não disponíveis para este ativo</p>
              <p className="text-sm mt-2">Alguns ativos podem não ter dados trimestrais disponíveis.</p>
            </div>
          )}
        </>
      )}
    </motion.div>
  )
}
