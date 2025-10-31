import { motion } from 'framer-motion'
import { TrendingUp, BarChart3 } from 'lucide-react'
import {
  ResponsiveContainer,
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'

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

interface DetalhesFixedIncomeTabProps {
  fiPeriodo: "1y" | "6m" | "3y" | "5y" | "max"
  setFiPeriodo: (value: "1y" | "6m" | "3y" | "5y" | "max") => void
  fiChartData: Array<{
    label: string
    Ativo: number | null
    CDI: number | null
    SELIC: number | null
    IPCA: number | null
  }>
  fiResumo: Record<string, number> | null
}

export default function DetalhesFixedIncomeTab({
  fiPeriodo,
  setFiPeriodo,
  fiChartData,
  fiResumo
}: DetalhesFixedIncomeTabProps) {
  return (
    <motion.div
      key="fixedincome"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="space-y-4 sm:space-y-6"
    >
      {/* Filtro de período */}
      <div className="relative overflow-hidden bg-card border border-border rounded-xl sm:rounded-2xl p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
          <label className="text-sm sm:text-base font-medium text-foreground shrink-0">Período:</label>
          <select
            className="flex-1 min-w-0 px-3 py-2 text-base sm:text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all"
            value={fiPeriodo}
            onChange={(e) => setFiPeriodo(e.target.value as "1y" | "6m" | "3y" | "5y" | "max")}
            aria-label="Selecionar período de comparação"
          >
            <option value="6m">6 meses</option>
            <option value="1y">1 ano</option>
            <option value="3y">3 anos</option>
            <option value="5y">5 anos</option>
            <option value="max">Máximo</option>
          </select>
        </div>
      </div>

      {/* Gráfico comparativo rebase 100 */}
      <InfoSection title="Crescimento Comparado (Ativo x CDI x SELIC x IPCA)" icon={TrendingUp}>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <RechartsLineChart data={fiChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="label" 
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} 
                angle={-12} 
                textAnchor="end" 
                height={50}
                stroke="hsl(var(--muted-foreground))"
              />
              <YAxis 
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} 
                domain={[0, 'auto']}
                stroke="hsl(var(--muted-foreground))"
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))', 
                  borderRadius: '8px',
                  color: 'hsl(var(--foreground))'
                }}
                formatter={(v: any) => (v != null ? `${Number(v).toFixed(2)}%` : '-')} 
              />
              <Legend wrapperStyle={{ color: 'hsl(var(--foreground))' }} />
              <Line type="monotone" dataKey="Ativo" stroke="hsl(var(--primary))" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="CDI" stroke="#16a34a" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="SELIC" stroke="#f59e0b" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="IPCA" stroke="#ef4444" dot={false} strokeWidth={2} />
            </RechartsLineChart>
          </ResponsiveContainer>
        </div>
      </InfoSection>

      {/* Resumo textual da comparação */}
      {fiResumo && (
        <InfoSection title="Resumo da Comparação" icon={BarChart3}>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            {[
              { k: 'Ativo', label: 'Ativo', color: 'text-primary' },
              { k: 'CDI', label: 'CDI', color: 'text-emerald-600 dark:text-emerald-400' },
              { k: 'SELIC', label: 'SELIC', color: 'text-amber-600 dark:text-amber-400' },
              { k: 'IPCA', label: 'IPCA', color: 'text-rose-600 dark:text-rose-400' },
            ].map((it) => (
              <motion.div 
                key={it.k} 
                className="relative overflow-hidden bg-card border border-border rounded-xl sm:rounded-2xl p-4 hover:shadow-lg transition-all duration-300"
                whileHover={{ scale: 1.02 }}
                transition={{ duration: 0.2 }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative z-10">
                  <div className="text-xs sm:text-sm text-muted-foreground mb-1">{it.label} ({fiPeriodo})</div>
                  <div className={`text-lg sm:text-xl font-bold ${it.color}`}>
                    {isFinite(Number((fiResumo as any)[it.k]))
                      ? `${Number((fiResumo as any)[it.k]).toFixed(2)}%`
                      : '-'}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </InfoSection>
      )}
    </motion.div>
  )
}
