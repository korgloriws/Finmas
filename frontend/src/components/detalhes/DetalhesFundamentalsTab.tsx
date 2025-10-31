import { motion } from 'framer-motion'
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  FileText,
  Award,
  AlertTriangle,
  PieChart,
  Activity,
  Calendar
} from 'lucide-react'
import { formatCurrency, formatPercentage, formatNumber } from '../../utils/formatters'


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


function InfoRow({ 
  label, 
  value, 
  icon: Icon 
}: {
  label: string
  value: string | number | null | undefined
  icon: any
}) {
  if (!value || value === '-') return null

  return (
    <div className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="w-4 h-4 text-primary/70" />
        <span>{label}</span>
      </div>
      <span className="text-sm font-medium text-foreground">
        {value}
      </span>
    </div>
  )
}

interface DetalhesFundamentalsTabProps {
  info: any
  fiiInfo: any
}

export default function DetalhesFundamentalsTab({
  info,
  fiiInfo
}: DetalhesFundamentalsTabProps) {
  return (
    <motion.div
      key="fundamentals"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <InfoSection title="Resultados e Crescimento" icon={TrendingUp}>
          <div className="space-y-0.5">
            <InfoRow label="Receita Total" value={formatCurrency(info.totalRevenue)} icon={DollarSign} />
            <InfoRow label="Lucro Líquido" value={formatCurrency(info.netIncomeToCommon)} icon={DollarSign} />
            <InfoRow label="EBITDA" value={formatCurrency(info.ebitda)} icon={DollarSign} />
            <InfoRow label="Lucro por Ação (EPS)" value={formatCurrency(info.trailingEps, '')} icon={Award} />
            <InfoRow label="BVPS" value={formatCurrency(info.bookValue)} icon={FileText} />
            <InfoRow label="Crescimento Receita (5y)" value={formatPercentage(info.revenueGrowth ? info.revenueGrowth * 100 : null)} icon={TrendingUp} />
            <InfoRow label="Crescimento Lucro (5y)" value={formatPercentage(info.earningsGrowth ? info.earningsGrowth * 100 : null)} icon={TrendingUp} />
          </div>
        </InfoSection>

        <InfoSection title="Endividamento" icon={TrendingDown}>
          <div className="space-y-0.5">
            <InfoRow label="Dívida Líquida" value={formatCurrency(info.netDebt)} icon={AlertTriangle} />
            <InfoRow label="Dívida Líquida/EBITDA" value={info.netDebtToEbitda != null ? formatNumber(info.netDebtToEbitda) : '-'} icon={AlertTriangle} />
            <InfoRow label="Dívida/Ativos" value={formatPercentage(info.debtToAssets ? info.debtToAssets * 100 : null)} icon={AlertTriangle} />
            <InfoRow label="Dívida/Capital" value={formatPercentage(info.debtToCapital ? info.debtToCapital * 100 : null)} icon={AlertTriangle} />
            <InfoRow label="Dívida/Fluxo de Caixa" value={formatPercentage(info.debtToCashFlow ? info.debtToCashFlow * 100 : null)} icon={AlertTriangle} />
            <InfoRow label="Dívida/Fluxo de Caixa Livre" value={formatPercentage(info.debtToFreeCashFlow ? info.debtToFreeCashFlow * 100 : null)} icon={AlertTriangle} />
            <InfoRow label="Dívida/EBIT" value={formatPercentage(info.debtToEbit ? info.debtToEbit * 100 : null)} icon={AlertTriangle} />
            <InfoRow label="Dívida/Lucro Líquido" value={formatPercentage(info.debtToNetIncome ? info.debtToNetIncome * 100 : null)} icon={AlertTriangle} />
          </div>
        </InfoSection>

        <InfoSection title="Dividendos" icon={DollarSign}>
          <div className="space-y-0.5">
            <InfoRow label="Último Dividendo" value={formatCurrency(info.lastDiv)} icon={DollarSign} />
            <InfoRow label="Dividendos por Ação" value={formatCurrency(info.dividendRate)} icon={DollarSign} />
            <InfoRow label="Payout Ratio" value={formatPercentage(info.payoutRatio ? info.payoutRatio * 100 : null)} icon={PieChart} />
            {/* FII extras */}
            <InfoRow label="DY 12 meses (calc.)" value={fiiInfo?.dy_12m != null ? `${fiiInfo.dy_12m.toFixed(2)}%` : '-'} icon={TrendingUp} />
            <InfoRow label="Dividendo médio (12m)" value={formatCurrency(fiiInfo?.dividendo_medio_12m)} icon={DollarSign} />
            <InfoRow label="Último rendimento" value={formatCurrency(fiiInfo?.ultimo_rendimento_valor)} icon={DollarSign} />
            <InfoRow label="Data último rendimento" value={fiiInfo?.ultimo_rendimento_data ? new Date(fiiInfo.ultimo_rendimento_data).toLocaleDateString('pt-BR') : '-'} icon={Calendar} />
          </div>
        </InfoSection>

        <InfoSection title="Eficiência Operacional" icon={Activity}>
          <div className="space-y-0.5">
            <InfoRow label="Margem Bruta" value={formatPercentage(info.grossMargins ? info.grossMargins * 100 : null)} icon={TrendingUp} />
            <InfoRow label="Margem Operacional" value={formatPercentage(info.operatingMargins ? info.operatingMargins * 100 : null)} icon={TrendingUp} />
            <InfoRow label="Margem Líquida" value={formatPercentage(info.profitMargins ? info.profitMargins * 100 : null)} icon={TrendingUp} />
            <InfoRow label="ROA" value={formatPercentage(info.returnOnAssets ? info.returnOnAssets * 100 : null)} icon={Activity} />
            <InfoRow label="ROIC" value={formatPercentage(info.returnOnInvestedCapital ? info.returnOnInvestedCapital * 100 : null)} icon={Activity} />
          </div>
        </InfoSection>
      </div>
    </motion.div>
  )
}
