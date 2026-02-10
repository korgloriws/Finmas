import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  DollarSign,
  Calendar,
  TrendingUp,
  PieChart as PieChartIcon,
  Wallet,
  Receipt,
  AlertCircle,
} from 'lucide-react'
import { formatCurrency } from '../../utils/formatters'
import TickerWithLogo from '../TickerWithLogo'
import DistribuicaoCarteiraECharts from '../home/DistribuicaoCarteiraECharts'

interface CarteiraProventosTabProps {
  carteira: any[]
  filtroProventos: string
  setFiltroProventos: (value: string) => void
  loadingProventos: boolean
  proventosError: any
  proventos: any[]
  loadingProventosRecebidos: boolean
  proventosRecebidosError?: any
  proventosRecebidos: any[]
  dadosGraficoProventos: any[]
}

const containerStagger = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.05 },
  },
}

const itemStagger = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
}

function SummaryCard({
  value,
  label,
  icon: Icon,
  accentColor,
  index,
}: {
  value: string
  label: string
  icon: React.ElementType
  accentColor: string
  index: number
}) {
  return (
    <motion.div
      variants={itemStagger}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.08 }}
      whileHover={{ scale: 1.02 }}
      className={`
        rounded-xl sm:rounded-2xl border border-border dark:border-border/80 bg-card dark:bg-card/90
        p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow
        flex flex-col sm:flex-row items-center gap-3 sm:gap-4 text-center sm:text-left
      `}
    >
      <div className={`p-2.5 sm:p-3 rounded-xl bg-primary/10 dark:bg-primary/20 border border-primary/20 dark:border-primary/30 shrink-0 ${accentColor}`}>
        <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
      </div>
      <div className="min-w-0">
        <div className="text-lg sm:text-xl md:text-2xl font-bold text-foreground dark:text-foreground truncate">
          {value}
        </div>
        <div className="text-xs sm:text-sm text-muted-foreground dark:text-muted-foreground">
          {label}
        </div>
      </div>
    </motion.div>
  )
}

export default function CarteiraProventosTab({
  carteira,
  filtroProventos,
  setFiltroProventos,
  loadingProventos,
  proventosError,
  proventos,
  loadingProventosRecebidos,
  proventosRecebidosError,
  proventosRecebidos,
  dadosGraficoProventos: _dadosGraficoProventos, // mantido na interface; gráfico agora é pizza por ativo
}: CarteiraProventosTabProps) {
  const hasCarteira = carteira && carteira.length > 0
  const [abaProventos, setAbaProventos] = useState<'historico' | 'recebidos'>('recebidos')

  const totalRecebido = proventosRecebidos?.reduce((s, p) => s + p.total_recebido, 0) ?? 0
  const totalProventosRecebidos = proventosRecebidos?.reduce((s, p) => s + (p.proventos_recebidos?.length ?? 0), 0) ?? 0
  const pieData = (proventosRecebidos ?? [])
    .filter((r) => (r.total_recebido ?? 0) > 0)
    .map((r, i) => {
      const cores = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#22c55e', '#ef4444']
      return {
        name: r.ticker || r.nome || '?',
        value: r.total_recebido ?? 0,
        fill: cores[i % cores.length],
      }
    })

  return (
    <div className="w-full max-w-full overflow-visible space-y-6 sm:space-y-8 min-w-0">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 rounded-xl bg-primary/10 dark:bg-primary/20 border border-primary/20 dark:border-primary/30 shrink-0">
            <DollarSign className="h-6 w-6 text-primary" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg md:text-xl font-semibold text-foreground dark:text-foreground">Proventos</h2>
            <p className="text-xs sm:text-sm text-muted-foreground dark:text-muted-foreground truncate">
              Histórico e recebidos por período
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 min-w-0">
          <label className="text-sm font-medium text-foreground dark:text-foreground shrink-0">
            Período:
          </label>
          <select
            value={filtroProventos}
            onChange={(e) => setFiltroProventos(e.target.value as any)}
            className="px-3 py-2 border border-border dark:border-border/80 rounded-lg bg-background dark:bg-background text-foreground text-sm w-full sm:w-auto min-w-0 focus:ring-2 focus:ring-primary/20 focus:border-primary"
            aria-label="Filtrar proventos por período"
          >
            <option value="mes">Mês atual</option>
            <option value="6meses">6 meses</option>
            <option value="1ano">1 ano</option>
            <option value="5anos">5 anos</option>
            <option value="total">Total</option>
          </select>
        </div>
      </motion.div>

      {!hasCarteira ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-2xl border border-dashed border-border dark:border-border/80 bg-muted/20 dark:bg-muted/30 py-16 text-center"
        >
          <DollarSign className="h-12 w-12 text-muted-foreground/50 dark:text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-muted-foreground dark:text-muted-foreground">
            Adicione ativos à sua carteira para ver os proventos.
          </p>
        </motion.div>
      ) : (
        <motion.div
          variants={containerStagger}
          initial="hidden"
          animate="show"
          className="space-y-6 sm:space-y-8"
        >
          {/* Resumo em destaque (dados recebidos) */}
          <motion.section
            variants={itemStagger}
            className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4"
          >
            <SummaryCard
              value={formatCurrency(totalRecebido)}
              label="Valor total recebido"
              icon={DollarSign}
              accentColor="text-primary"
              index={0}
            />
            <SummaryCard
              value={String(proventosRecebidos?.length ?? 0)}
              label="Ativos com proventos"
              icon={Wallet}
              accentColor="text-green-500 dark:text-green-400"
              index={1}
            />
            <SummaryCard
              value={String(totalProventosRecebidos)}
              label="Total de proventos"
              icon={Calendar}
              accentColor="text-blue-500 dark:text-blue-400"
              index={2}
            />
          </motion.section>

          {/* Gráfico Pizza: composição por ativo */}
          <motion.section
            variants={itemStagger}
            className="rounded-xl sm:rounded-2xl border border-border dark:border-border/80 bg-card/50 dark:bg-card/60 p-4 sm:p-5 md:p-6 shadow-sm overflow-visible"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-background dark:bg-background/80 border border-border dark:border-border/80 text-emerald-500 dark:text-emerald-400">
                <PieChartIcon className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-foreground dark:text-foreground">
                  Composição dos proventos recebidos por ativo
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground dark:text-muted-foreground">
                  Participação de cada ativo no total recebido no período
                </p>
              </div>
            </div>
            {pieData.length > 0 ? (
              <div className="w-full min-h-[260px] sm:min-h-[300px] md:min-h-[320px] h-64 sm:h-80 overflow-visible">
                <DistribuicaoCarteiraECharts
                  variant="pie"
                  dados={pieData}
                  totalInvestido={totalRecebido}
                  formatCurrency={(v) => formatCurrency(v)}
                />
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground dark:text-muted-foreground rounded-lg border border-dashed border-border dark:border-border/80">
                Nenhum provento recebido no período para exibir o gráfico.
              </div>
            )}
          </motion.section>

          {/* Tabs: Histórico | Recebidos */}
          <motion.section
            variants={itemStagger}
            className="rounded-xl sm:rounded-2xl border border-border dark:border-border/80 bg-card/50 dark:bg-card/60 overflow-hidden shadow-sm"
          >
            <div className="flex border-b border-border dark:border-border/80 bg-muted/20 dark:bg-muted/30">
              <button
                type="button"
                onClick={() => setAbaProventos('historico')}
                className={`flex-1 px-4 py-3 text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
                  abaProventos === 'historico'
                    ? 'bg-background dark:bg-background text-foreground dark:text-foreground shadow-sm border-b-2 border-primary'
                    : 'text-muted-foreground dark:text-muted-foreground hover:text-foreground dark:hover:text-foreground'
                }`}
              >
                <Receipt className="h-4 w-4" />
                Histórico (pagos)
              </button>
              <button
                type="button"
                onClick={() => setAbaProventos('recebidos')}
                className={`flex-1 px-4 py-3 text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
                  abaProventos === 'recebidos'
                    ? 'bg-background dark:bg-background text-foreground dark:text-foreground shadow-sm border-b-2 border-primary'
                    : 'text-muted-foreground dark:text-muted-foreground hover:text-foreground dark:hover:text-foreground'
                }`}
              >
                <TrendingUp className="h-4 w-4" />
                Recebidos (carteira)
              </button>
            </div>
            <div className="p-4 sm:p-5 md:p-6 overflow-visible">
              {abaProventos === 'historico' && (
                <HistoricoContent
                  loadingProventos={loadingProventos}
                  proventosError={proventosError}
                  proventos={proventos}
                  formatCurrency={formatCurrency}
                  SummaryCard={SummaryCard}
                />
              )}
              {abaProventos === 'recebidos' && (
                <RecebidosContent
                  loadingProventosRecebidos={loadingProventosRecebidos}
                  proventosRecebidosError={proventosRecebidosError}
                  proventosRecebidos={proventosRecebidos}
                  formatCurrency={formatCurrency}
                  SummaryCard={SummaryCard}
                />
              )}
            </div>
          </motion.section>
        </motion.div>
      )}
    </div>
  )
}

function HistoricoContent({
  loadingProventos,
  proventosError,
  proventos,
  formatCurrency,
  SummaryCard,
}: {
  loadingProventos: boolean
  proventosError: any
  proventos: any[]
  formatCurrency: (v: number, prefix?: string) => string
  SummaryCard: React.ComponentType<any>
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2.5 rounded-xl bg-background dark:bg-background/80 border border-border dark:border-border/80 text-blue-500 dark:text-blue-400">
          <Receipt className="h-5 w-5 sm:h-6 sm:w-6" />
        </div>
        <div>
          <h3 className="text-base sm:text-lg font-semibold text-foreground dark:text-foreground">
            Proventos Pagos (Histórico)
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground dark:text-muted-foreground">
            Dividendos do ativo no período (dados de mercado). Não considera data de compra.
          </p>
        </div>
      </div>

      {loadingProventos ? (
        <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground dark:text-muted-foreground">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full"
          />
          <span>Carregando histórico...</span>
        </div>
      ) : proventosError ? (
        <div className="flex flex-col items-center justify-center py-8 rounded-xl bg-destructive/10 dark:bg-destructive/20 border border-destructive/20 dark:border-destructive/30">
          <AlertCircle className="h-10 w-10 text-destructive mb-2" />
          <p className="font-medium text-destructive text-center">Não foi possível carregar o histórico.</p>
          <p className="text-sm text-muted-foreground dark:text-muted-foreground mt-1 text-center">
            {proventosError?.message || 'Verifique sua conexão ou tente mais tarde.'}
          </p>
        </div>
      ) : proventos && proventos.length > 0 ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <SummaryCard
              value={String(proventos.filter(p => p.proventos && p.proventos.length > 0).length)}
              label="Ativos com Proventos"
              icon={Wallet}
              accentColor="text-blue-500 dark:text-blue-400"
              index={0}
            />
            <SummaryCard
              value={String(proventos.reduce((total, p) => total + (p.proventos?.length || 0), 0))}
              label="Total de Proventos"
              icon={Calendar}
              accentColor="text-green-500 dark:text-green-400"
              index={1}
            />
            <SummaryCard
              value={formatCurrency(proventos.reduce((total: number, p: any) =>
                total + (p.proventos?.reduce((sum: number, prov: any) => sum + prov.valor, 0) || 0), 0
              ))}
              label="Valor Total"
              icon={DollarSign}
              accentColor="text-primary"
              index={2}
            />
          </div>
          <div className="space-y-4">
            {proventos.map((ativo, idx) => (
              <motion.div
                key={ativo.ticker}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 + idx * 0.03 }}
                className="rounded-xl border border-border dark:border-border/80 bg-background dark:bg-background/80 p-4 overflow-visible"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="min-w-0 truncate">
                      <TickerWithLogo ticker={ativo.ticker} nome={ativo.nome} size="md" />
                    </div>
                    {ativo.erro && (
                      <span className="text-xs sm:text-sm text-destructive bg-destructive/10 dark:bg-destructive/20 px-2 py-1 rounded shrink-0">
                        {ativo.erro}
                      </span>
                    )}
                  </div>
                  <div className="text-left sm:text-right shrink-0">
                    <div className="text-base sm:text-lg font-bold text-foreground dark:text-foreground">
                      {formatCurrency(ativo.proventos?.reduce((sum: number, prov: any) => sum + prov.valor, 0) || 0)}
                    </div>
                    <div className="text-xs sm:text-sm text-muted-foreground dark:text-muted-foreground">
                      {ativo.proventos?.length || 0} provento{ativo.proventos?.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
                {ativo.proventos && ativo.proventos.length > 0 ? (
                  <>
                    <div className="hidden md:block overflow-x-auto -mx-1">
                      <table className="w-full min-w-[640px]">
                        <thead className="bg-muted/30 dark:bg-muted/40">
                          <tr>
                            <th className="px-4 py-2 text-left text-sm font-medium text-foreground dark:text-foreground">Data</th>
                            <th className="px-4 py-2 text-left text-sm font-medium text-foreground dark:text-foreground">Tipo</th>
                            <th className="px-4 py-2 text-left text-sm font-medium text-foreground dark:text-foreground">Valor (R$)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ativo.proventos.map((provento: any, index: number) => (
                            <tr key={index} className="hover:bg-muted/40 dark:hover:bg-muted/50 transition-colors border-b border-border/50 dark:border-border/50 last:border-0">
                              <td className="px-4 py-2 text-sm">{new Date(provento.data).toLocaleDateString('pt-BR')}</td>
                              <td className="px-4 py-2">
                                <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded text-xs">
                                  {provento.tipo}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-sm font-semibold">{formatCurrency(provento.valor)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="md:hidden space-y-3">
                      {ativo.proventos.map((provento: any, index: number) => (
                        <div key={index} className="rounded-lg p-3 bg-muted/30 dark:bg-muted/40 border border-border/50 dark:border-border/50">
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-sm font-medium text-foreground dark:text-foreground">
                              {new Date(provento.data).toLocaleDateString('pt-BR')}
                            </span>
                            <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded text-xs">
                              {provento.tipo}
                            </span>
                          </div>
                          <div className="text-lg font-bold text-primary">{formatCurrency(provento.valor)}</div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : !ativo.erro ? (
                  <div className="text-center text-muted-foreground dark:text-muted-foreground py-4 text-sm">
                    Nenhum provento no período selecionado.
                  </div>
                ) : null}
              </motion.div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center text-muted-foreground dark:text-muted-foreground py-8">
          Nenhum provento encontrado para os ativos no período selecionado.
        </div>
      )}
    </div>
  )
}

function RecebidosContent({
  loadingProventosRecebidos,
  proventosRecebidosError,
  proventosRecebidos,
  formatCurrency,
  SummaryCard,
}: {
  loadingProventosRecebidos: boolean
  proventosRecebidosError: any
  proventosRecebidos: any[]
  formatCurrency: (v: number, prefix?: string) => string
  SummaryCard: React.ComponentType<any>
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2.5 rounded-xl bg-background dark:bg-background/80 border border-border dark:border-border/80 text-green-500 dark:text-green-400">
          <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6" />
        </div>
        <div>
          <h3 className="text-base sm:text-lg font-semibold text-foreground dark:text-foreground">
            Proventos Recebidos (Baseado na Carteira)
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground dark:text-muted-foreground">
            Valores que você efetivamente recebeu (após data da primeira compra).
          </p>
        </div>
      </div>

      {loadingProventosRecebidos ? (
        <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground dark:text-muted-foreground">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full"
          />
          <span>Carregando proventos recebidos...</span>
        </div>
      ) : proventosRecebidosError ? (
        <div className="flex flex-col items-center justify-center py-8 rounded-xl bg-destructive/10 dark:bg-destructive/20 border border-destructive/20 dark:border-destructive/30">
          <AlertCircle className="h-10 w-10 text-destructive mb-2" />
          <p className="font-medium text-destructive text-center">Não foi possível carregar os proventos recebidos.</p>
          <p className="text-sm text-muted-foreground dark:text-muted-foreground mt-1 text-center">
            {proventosRecebidosError?.message || 'Verifique sua conexão ou tente mais tarde.'}
          </p>
        </div>
      ) : proventosRecebidos && proventosRecebidos.length > 0 ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <SummaryCard
              value={String(proventosRecebidos.length)}
              label="Ativos com Proventos"
              icon={Wallet}
              accentColor="text-green-500 dark:text-green-400"
              index={0}
            />
            <SummaryCard
              value={formatCurrency(proventosRecebidos.reduce((total, p) => total + p.total_recebido, 0))}
              label="Valor Total Recebido"
              icon={DollarSign}
              accentColor="text-primary"
              index={1}
            />
            <SummaryCard
              value={String(proventosRecebidos.reduce((total, p) => total + (p.proventos_recebidos?.length ?? 0), 0))}
              label="Total de Proventos"
              icon={Calendar}
              accentColor="text-blue-500 dark:text-blue-400"
              index={2}
            />
          </div>
          <div className="space-y-4">
            {proventosRecebidos?.map((item, idx) => (
              <motion.div
                key={item.ticker}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 + idx * 0.03 }}
                className="rounded-xl border border-border dark:border-border/80 bg-muted/20 dark:bg-muted/30 p-4 sm:p-5 overflow-visible"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="min-w-0 truncate">
                      <TickerWithLogo ticker={item.ticker} nome={item.nome} size="md" />
                    </div>
                    <div className="text-xs sm:text-sm text-muted-foreground dark:text-muted-foreground shrink-0">
                      <div>{item.quantidade_carteira} ações</div>
                      {item.data_aquisicao && (
                        <div className="text-xs">Adquirido em {new Date(item.data_aquisicao).toLocaleDateString('pt-BR')}</div>
                      )}
                    </div>
                  </div>
                  <div className="text-left sm:text-right shrink-0">
                    <div className="text-base sm:text-lg font-bold text-foreground dark:text-foreground">
                      {formatCurrency(item.total_recebido)}
                    </div>
                    <div className="text-xs sm:text-sm text-muted-foreground dark:text-muted-foreground">
                      {item.proventos_recebidos?.length ?? 0} provento{(item.proventos_recebidos?.length ?? 0) !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
                {item.proventos_recebidos && item.proventos_recebidos.length > 0 ? (
                  <>
                    <div className="hidden md:block overflow-x-auto -mx-1">
                      <table className="w-full min-w-[720px]">
                        <thead className="bg-muted/30 dark:bg-muted/40">
                          <tr>
                            <th className="px-4 py-2 text-left text-sm font-medium text-foreground dark:text-foreground">Data</th>
                            <th className="px-4 py-2 text-left text-sm font-medium text-foreground dark:text-foreground">Valor Unit.</th>
                            <th className="px-4 py-2 text-left text-sm font-medium text-foreground dark:text-foreground">Qtd</th>
                            <th className="px-4 py-2 text-left text-sm font-medium text-foreground dark:text-foreground">Valor Recebido</th>
                          </tr>
                        </thead>
                        <tbody>
                          {item.proventos_recebidos.map((prov: any, index: number) => (
                            <tr key={index} className="hover:bg-muted/40 dark:hover:bg-muted/50 transition-colors border-b border-border/50 dark:border-border/50 last:border-0">
                              <td className="px-4 py-2 text-sm">{new Date(prov.data).toLocaleDateString('pt-BR')}</td>
                              <td className="px-4 py-2 text-sm">{formatCurrency(prov.valor_unitario)}</td>
                              <td className="px-4 py-2 text-sm">{prov.quantidade}</td>
                              <td className="px-4 py-2 text-sm font-semibold">{formatCurrency(prov.valor_recebido)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="md:hidden space-y-3">
                      {item.proventos_recebidos.map((prov: any, index: number) => (
                        <div key={index} className="rounded-lg p-3 bg-background dark:bg-background/80 border border-border dark:border-border/80">
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-sm font-medium text-foreground dark:text-foreground">
                              {new Date(prov.data).toLocaleDateString('pt-BR')}
                            </span>
                            <span className="text-sm text-muted-foreground dark:text-muted-foreground">{prov.quantidade} ações</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <div className="text-xs text-muted-foreground dark:text-muted-foreground">Unit.</div>
                              <div className="font-medium">{formatCurrency(prov.valor_unitario)}</div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground dark:text-muted-foreground">Recebido</div>
                              <div className="font-bold text-primary">{formatCurrency(prov.valor_recebido)}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-center text-muted-foreground dark:text-muted-foreground py-4 text-sm">
                    Nenhum provento recebido no período.
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center text-muted-foreground dark:text-muted-foreground py-8">
          Nenhum provento recebido para os ativos no período selecionado.
        </div>
      )}
    </div>
  )
}