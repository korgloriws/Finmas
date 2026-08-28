import { motion } from 'framer-motion'
import { formatPercentage } from '../../utils/formatters'
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart as RechartsBarChart,
  Bar,
  ScatterChart,
  Scatter,
} from 'recharts'
import { AtivoAnalise } from '../../types'

interface AnaliseGraficosTabProps {
  ativosAcoes: AtivoAnalise[]
  ativosBdrs: AtivoAnalise[]
  ativosFiis: AtivoAnalise[]
}

export default function AnaliseGraficosTab({ 
  ativosAcoes, 
  ativosBdrs, 
  ativosFiis 
}: AnaliseGraficosTabProps) {

  const todosAtivos = [
    ...ativosAcoes,
    ...ativosBdrs,
    ...ativosFiis
  ]

  if (todosAtivos.length === 0) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-16"
      >
        <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <div className="space-y-2">
          <p className="text-lg font-semibold text-foreground">Nenhum dado para exibir</p>
          <p className="text-muted-foreground">Aplique filtros na aba "Lista" para ver os gráficos</p>
        </div>
      </motion.div>
    )
  }

  const topDy = [...todosAtivos]
    .sort((a, b) => (b.dividend_yield || 0) - (a.dividend_yield || 0))
    .slice(0, 5)
    .map(ativo => ({
      ticker: ativo.ticker,
      valor: ativo.dividend_yield || 0
    }))

  const topRoe = [...todosAtivos]
    .sort((a, b) => (b.roe || 0) - (a.roe || 0))
    .slice(0, 5)
    .map(ativo => ({
      ticker: ativo.ticker,
      valor: ativo.roe || 0
    }))

  const topEarningsYield = [...todosAtivos]
    .map(ativo => {
      const pl = Number(ativo.pl)
      const ey = Number.isFinite(pl) && pl > 0 ? (1 / pl) * 100 : null
      return { ticker: ativo.ticker, valor: ey }
    })
    .filter((x): x is { ticker: string; valor: number } => x.valor != null)
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 5)

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* P/L vs Dividend Yield */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
        <div className="mb-6">
          <h3 className="text-xl font-bold text-foreground">P/L vs Dividend Yield</h3>
          <p className="text-muted-foreground text-sm">Análise de correlação entre preço/lucro e dividend yield</p>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart data={todosAtivos}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              dataKey="pl" 
              name="P/L" 
              stroke="hsl(var(--muted-foreground))" 
              fontSize={12}
              tick={{ fontSize: 11 }}
            />
            <YAxis 
              dataKey="dividend_yield" 
              name="Dividend Yield (%)" 
              stroke="hsl(var(--muted-foreground))" 
              fontSize={12}
              tick={{ fontSize: 11 }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--card))', 
                border: '1px solid hsl(var(--border))', 
                borderRadius: '12px',
                color: 'hsl(var(--foreground))',
                fontSize: '13px',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
              }}
              formatter={(value: any, name: string) => [value, name]} 
            />
            <Scatter dataKey="dividend_yield" fill="hsl(var(--primary))" />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Top 5 Dividend Yield */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-foreground">Top 5 Dividend Yield</h3>
            <p className="text-muted-foreground text-sm">Maiores DY entre os ativos já filtrados</p>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <RechartsBarChart data={topDy}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="ticker" 
                stroke="hsl(var(--muted-foreground))" 
                fontSize={11}
                tick={{ fontSize: 9 }}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))" 
                fontSize={11}
                tick={{ fontSize: 9 }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))', 
                  borderRadius: '12px',
                  color: 'hsl(var(--foreground))',
                  fontSize: '13px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                }}
                formatter={(value: any) => [formatPercentage(value), 'DY']} 
              />
              <Bar dataKey="valor" fill="hsl(var(--positive))" />
            </RechartsBarChart>
          </ResponsiveContainer>
        </div>

        {/* Top 5 ROE */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-foreground">Top 5 ROE</h3>
            <p className="text-muted-foreground text-sm">Maiores ROE entre os ativos já filtrados</p>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <RechartsBarChart data={topRoe}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="ticker" 
                stroke="hsl(var(--muted-foreground))" 
                fontSize={11}
                tick={{ fontSize: 9 }}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))" 
                fontSize={11}
                tick={{ fontSize: 9 }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))', 
                  borderRadius: '12px',
                  color: 'hsl(var(--foreground))',
                  fontSize: '13px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                }}
                formatter={(value: any) => [formatPercentage(value), 'ROE']} 
              />
              <Bar dataKey="valor" fill="hsl(var(--primary))" />
            </RechartsBarChart>
          </ResponsiveContainer>
        </div>

        {/* Top 5 Earnings Yield — mais baratas entre as filtradas */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-foreground">Top 5 Earnings Yield</h3>
            <p className="text-muted-foreground text-sm">
              Mais baratas entre quem já passou no filtro (EY = 1 ÷ P/L)
            </p>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <RechartsBarChart data={topEarningsYield}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="ticker" 
                stroke="hsl(var(--muted-foreground))" 
                fontSize={11}
                tick={{ fontSize: 9 }}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))" 
                fontSize={11}
                tick={{ fontSize: 9 }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))', 
                  borderRadius: '12px',
                  color: 'hsl(var(--foreground))',
                  fontSize: '13px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                }}
                formatter={(value: any) => [`${Number(value).toFixed(2)}%`, 'Earnings Yield']} 
              />
              <Bar dataKey="valor" fill="hsl(var(--accent))" />
            </RechartsBarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </motion.div>
  )
}
