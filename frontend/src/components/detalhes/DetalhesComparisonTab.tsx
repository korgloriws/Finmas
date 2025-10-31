import { motion } from 'framer-motion'
import { 
  Zap, 
  DollarSign, 
  Target, 
  FileText, 
  TrendingUp, 
  Activity
} from 'lucide-react'
import { formatCurrency, formatNumber, formatDividendYield, formatPercentage } from '../../utils/formatters'
import TickerWithLogo from '../TickerWithLogo'
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart as RechartsBarChart,
  Bar,
} from 'recharts'

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

interface DetalhesComparisonTabProps {
  compararInputRef: React.RefObject<HTMLInputElement>
  handleCompararKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
  handleComparar: () => void
  loadingComparacao: boolean
  comparacao: Array<{
    ticker: string
    nome: string
    preco_atual: number | null
    pl: number | null
    pvp: number | null
    dy: number | null
    roe: number | null
    setor: string | null
    pais: string | null
  }>
  comparisonData: Array<{
    ticker: string
    preco: number
    pl: number
    pvp: number
    dy: number
    roe: number
  }>
}

export default function DetalhesComparisonTab({
  compararInputRef,
  handleCompararKeyDown,
  handleComparar,
  loadingComparacao,
  comparacao,
  comparisonData
}: DetalhesComparisonTabProps) {
  return (
    <motion.div
      key="comparison"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      {/* Input para comparação */}
      <InfoSection title="Comparação com Outros Ativos" icon={Zap}>
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
            <label className="font-medium flex items-center gap-2 text-foreground text-sm sm:text-base shrink-0">
              <span className="hidden sm:inline">Comparar com outros ativos:</span>
              <span className="sm:hidden">Comparar:</span>
            </label>
            <div className="flex-1 min-w-0">
              <input
                type="text"
                placeholder="Ex: PETR4, ITUB4, VALE3"
                ref={compararInputRef}
                onKeyDown={handleCompararKeyDown}
                className="w-full px-3 py-2.5 sm:py-2 text-base sm:text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all placeholder:text-muted-foreground"
              />
              <p className="text-xs text-muted-foreground mt-1 sm:hidden">
                Digite tickers separados por vírgula
              </p>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleComparar}
              className="px-4 sm:px-6 py-2.5 sm:py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium text-sm sm:text-base shrink-0"
            >
              Comparar
            </motion.button>
          </div>

          {/* Tabela de Comparação */}
          {loadingComparacao ? (
            <LoadingSpinner text="Carregando comparação..." />
          ) : comparacao && comparacao.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-foreground">Ticker</th>
                    <th className="px-4 py-3 text-left font-medium text-foreground">Nome</th>
                    <th className="px-4 py-3 text-left font-medium text-foreground">Preço Atual</th>
                    <th className="px-4 py-3 text-left font-medium text-foreground">P/L</th>
                    <th className="px-4 py-3 text-left font-medium text-foreground">P/VP</th>
                    <th className="px-4 py-3 text-left font-medium text-foreground">DY</th>
                    <th className="px-4 py-3 text-left font-medium text-foreground">ROE</th>
                    <th className="px-4 py-3 text-left font-medium text-foreground">Setor</th>
                    <th className="px-4 py-3 text-left font-medium text-foreground">País</th>
                  </tr>
                </thead>
                <tbody>
                  {comparacao.map((ativo, index) => (
                    <motion.tr 
                      key={ativo.ticker} 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className={`${index % 2 === 0 ? 'bg-background' : 'bg-muted/20'} hover:bg-muted/40 transition-colors`}
                    >
                      <td className="px-4 py-3 min-w-[120px]">
                        <TickerWithLogo ticker={ativo.ticker} size="sm" />
                      </td>
                      <td className="px-4 py-3 text-foreground">{ativo.nome || '-'}</td>
                      <td className="px-4 py-3 font-semibold text-foreground">{formatCurrency(ativo.preco_atual)}</td>
                      <td className="px-4 py-3 text-foreground">{formatNumber(ativo.pl)}</td>
                      <td className="px-4 py-3 text-foreground">{formatNumber(ativo.pvp)}</td>
                      <td className="px-4 py-3 text-primary font-medium">{formatDividendYield(ativo.dy)}</td>
                      <td className="px-4 py-3 text-foreground">{formatPercentage(ativo.roe ? ativo.roe * 100 : null)}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{ativo.setor || '-'}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{ativo.pais || '-'}</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {/* Gráficos de comparação */}
          {comparisonData.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mt-6">
              <InfoSection title="Comparação de Preços" icon={DollarSign}>
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsBarChart data={comparisonData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="ticker" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))', 
                        borderRadius: '8px',
                        color: 'hsl(var(--foreground))'
                      }}
                      formatter={(value: number) => [formatCurrency(value), 'Preço']}
                    />
                    <Bar dataKey="preco" fill="hsl(var(--primary))" />
                  </RechartsBarChart>
                </ResponsiveContainer>
              </InfoSection>

              <InfoSection title="Comparação de P/L" icon={Target}>
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsBarChart data={comparisonData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="ticker" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))', 
                        borderRadius: '8px',
                        color: 'hsl(var(--foreground))'
                      }}
                      formatter={(value: number) => [value.toFixed(2), 'P/L']}
                    />
                    <Bar dataKey="pl" fill="hsl(var(--primary))" />
                  </RechartsBarChart>
                </ResponsiveContainer>
              </InfoSection>

              <InfoSection title="Comparação de P/VP" icon={FileText}>
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsBarChart data={comparisonData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="ticker" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))', 
                        borderRadius: '8px',
                        color: 'hsl(var(--foreground))'
                      }}
                      formatter={(value: number) => [value.toFixed(2), 'P/VP']}
                    />
                    <Bar dataKey="pvp" fill="hsl(var(--primary))" />
                  </RechartsBarChart>
                </ResponsiveContainer>
              </InfoSection>

              <InfoSection title="Comparação de Dividend Yield" icon={TrendingUp}>
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsBarChart data={comparisonData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="ticker" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))', 
                        borderRadius: '8px',
                        color: 'hsl(var(--foreground))'
                      }}
                      formatter={(value: number) => [`${value.toFixed(2)}%`, 'DY']}
                    />
                    <Bar dataKey="dy" fill="hsl(var(--primary))" />
                  </RechartsBarChart>
                </ResponsiveContainer>
              </InfoSection>

              <InfoSection title="Comparação de ROE" icon={Activity}>
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsBarChart data={comparisonData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="ticker" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))', 
                        borderRadius: '8px',
                        color: 'hsl(var(--foreground))'
                      }}
                      formatter={(value: number) => [`${value.toFixed(2)}%`, 'ROE']}
                    />
                    <Bar dataKey="roe" fill="hsl(var(--primary))" />
                  </RechartsBarChart>
                </ResponsiveContainer>
              </InfoSection>
            </div>
          )}
        </div>
      </InfoSection>
    </motion.div>
  )
}
