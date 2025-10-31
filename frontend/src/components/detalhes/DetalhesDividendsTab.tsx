import { motion } from 'framer-motion'
import { 
  Calendar, 
  DollarSign, 
  TrendingUp, 
  Award
} from 'lucide-react'
import { formatCurrency } from '../../utils/formatters'


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

interface DetalhesDividendsTabProps {
  periodoDividendos: string
  handlePeriodoDividendosChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
  dividendData: Array<{ Date: string; Dividend: number }>
}

export default function DetalhesDividendsTab({
  periodoDividendos,
  handlePeriodoDividendosChange,
  dividendData
}: DetalhesDividendsTabProps) {
  return (
    <motion.div
      key="dividends"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      {/* Controles dos proventos */}
      <div className="relative overflow-hidden bg-card border border-border rounded-xl sm:rounded-2xl p-4 sm:p-6">
        <div className="flex items-center gap-4 flex-wrap">
          <label className="font-medium flex items-center gap-2 text-foreground">
            <div className="p-1.5 sm:p-2 rounded-md sm:rounded-lg bg-primary text-primary-foreground shadow-lg">
              <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span className="text-sm sm:text-base">Período dos Proventos:</span>
          </label>
          <select
            value={periodoDividendos}
            onChange={handlePeriodoDividendosChange}
            className="px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all"
            aria-label="Selecionar período dos proventos"
          >
            <option value="1mo">1 mês</option>
            <option value="3mo">3 meses</option>
            <option value="6mo">6 meses</option>
            <option value="1y">1 ano</option>
            <option value="2y">2 anos</option>
            <option value="5y">5 anos</option>
            <option value="max">Máximo</option>
          </select>
        </div>
      </div>

      {/* Tabela de Proventos */}
      <InfoSection title="Histórico de Proventos" icon={DollarSign}>
        {dividendData.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead className="bg-muted/30">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-foreground">Data</th>
                  <th className="px-4 py-3 text-left font-medium text-foreground">Valor do Dividendo</th>
                </tr>
              </thead>
              <tbody>
                {dividendData.map((item, index) => (
                  <motion.tr 
                    key={item.Date} 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`${index % 2 === 0 ? 'bg-background' : 'bg-muted/20'} hover:bg-muted/40 transition-colors`}
                  >
                    <td className="px-4 py-3 font-medium text-foreground">
                      {new Date(item.Date).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 font-semibold text-primary">
                      {formatCurrency(item.Dividend)}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum provento encontrado para este período.</p>
          </div>
        )}
      </InfoSection>

      {/* Resumo dos Proventos */}
      {dividendData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          <InfoSection title="Total de Proventos" icon={DollarSign}>
            <div className="text-center">
              <p className="text-xl sm:text-2xl font-bold text-foreground">
                {formatCurrency(dividendData.reduce((sum, item) => sum + item.Dividend, 0))}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Soma de todos os proventos
              </p>
            </div>
          </InfoSection>

          <InfoSection title="Média por Provento" icon={TrendingUp}>
            <div className="text-center">
              <p className="text-xl sm:text-2xl font-bold text-foreground">
                {formatCurrency(dividendData.reduce((sum, item) => sum + item.Dividend, 0) / dividendData.length)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Média do período
              </p>
            </div>
          </InfoSection>

          <InfoSection title="Maior Provento" icon={Award}>
            <div className="text-center">
              <p className="text-xl sm:text-2xl font-bold text-foreground">
                {formatCurrency(Math.max(...dividendData.map(item => item.Dividend)))}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Maior valor do período
              </p>
            </div>
          </InfoSection>
        </div>
      )}
    </motion.div>
  )
}
