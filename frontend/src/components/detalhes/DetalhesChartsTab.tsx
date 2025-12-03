import { motion } from 'framer-motion'
import { 
  BarChart3, 
  TrendingUp, 
  DollarSign
} from 'lucide-react'
import { formatCurrency } from '../../utils/formatters'
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
}

export default function DetalhesChartsTab({
  periodo,
  handlePeriodoChange,
  loadingHistorico,
  chartData,
  dividendYieldChartData
}: DetalhesChartsTabProps) {
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
        {/* Gráfico de Preço */}
        <InfoSection title="Evolução do Preço de Fechamento" icon={TrendingUp}>
          {loadingHistorico ? (
            <LoadingSpinner text="Carregando gráfico..." />
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <RechartsLineChart data={chartData}>
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
                  formatter={(value: number) => [formatCurrency(value), 'Preço']}
                />
                <Line type="monotone" dataKey="Close" stroke="hsl(var(--primary))" strokeWidth={2} />
              </RechartsLineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              Histórico não disponível
            </div>
          )}
        </InfoSection>

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
    </motion.div>
  )
}
