import { motion } from 'framer-motion'
import { 
  Target, 
  DollarSign, 
  TrendingUp
} from 'lucide-react'
import { formatCurrency } from '../../utils/formatters'

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

// Componente para card de métrica
function MetricCard({ 
  title, 
  value, 
  icon: Icon
}: {
  title: string
  value: string
  icon: any
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
      className="relative overflow-hidden bg-card border border-border rounded-xl sm:rounded-2xl p-4 hover:shadow-lg sm:hover:shadow-xl transition-all duration-300"
    >
      {/* Background pattern */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 sm:p-2 rounded-md sm:rounded-lg bg-primary text-primary-foreground shadow-lg">
              <Icon className="w-3 h-3 sm:w-4 sm:h-4" />
            </div>
            <h3 className="text-sm sm:text-base font-semibold text-muted-foreground leading-tight">{title}</h3>
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-xl sm:text-2xl font-bold text-foreground leading-tight">{value}</p>
        </div>
      </div>
    </motion.div>
  )
}

interface DetalhesConceptsTabProps {
  info: any
  grahamBadge: { label: string; color: string } | null
  bazinBadge: { label: string; color: string } | null
  grahamEPSText: string
  setGrahamEPSText: (value: string) => void
  commitGrahamEPS: () => void
  grahamGText: string
  setGrahamGText: (value: string) => void
  commitGrahamG: () => void
  grahamYText: string
  setGrahamYText: (value: string) => void
  commitGrahamY: () => void
  grahamFairPrice: number | null
  dividends12m: number | null
  bazinRatePct: number
  setBazinRatePct: (value: number) => void
  bazinCeilingPrice: number | null
  historico?: Array<Record<string, any>> | null
}

export default function DetalhesConceptsTab({
  info,
  grahamBadge,
  bazinBadge,
  grahamEPSText,
  setGrahamEPSText,
  commitGrahamEPS,
  grahamGText,
  setGrahamGText,
  commitGrahamG,
  grahamYText,
  setGrahamYText,
  commitGrahamY,
  grahamFairPrice,
  dividends12m,
  bazinRatePct,
  setBazinRatePct,
  bazinCeilingPrice,
  historico
}: DetalhesConceptsTabProps) {
  
  const fearGreed = (() => {
    try {
      const series = Array.isArray(historico) ? historico : []
      if (series.length < 20) return null
      const closes: number[] = series
        .map(r => Number(r.Close ?? (r as any).close))
        .filter(v => isFinite(v))
      if (closes.length < 20) return null
      const last = closes[closes.length - 1]
      const sma = (arr: number[], win: number) => {
        if (arr.length < win) return NaN
        let sum = 0
        for (let i = arr.length - win; i < arr.length; i++) sum += arr[i]
        return sum / win
      }
      const sma50 = sma(closes, 50)
      const sma200 = sma(closes, 200)
      const maxN = Math.max(...closes.slice(-Math.min(closes.length, 252)))
      const minN = Math.min(...closes.slice(-Math.min(closes.length, 252)))
      const range = maxN - minN || 1

      const compMomentumShort = isFinite(sma50) ? Math.max(0, Math.min(100, 50 + ((last - sma50) / sma50) * 400)) : 50
      const compMomentumLong = isFinite(sma200) ? Math.max(0, Math.min(100, 50 + ((last - sma200) / sma200) * 300)) : 50
      const compDistanceFromTop = Math.max(0, Math.min(100, ((last - minN) / range) * 100))
      const components = [
        { key: 'Momentum curto (vs SMA50)', value: Math.round(compMomentumShort) },
        { key: 'Momentum longo (vs SMA200)', value: Math.round(compMomentumLong) },
        { key: 'Distância do topo 12m', value: Math.round(compDistanceFromTop) },
      ]
      const score = Math.round(components.reduce((s, c) => s + c.value, 0) / components.length)
      return { score, components }
    } catch {
      return null
    }
  })()
  return (
    <motion.div
      key="concepts"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      {/* Preço Justo de Graham */}
      <InfoSection title="Preço Justo de Graham" icon={Target}>
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground leading-relaxed">
            Fórmula clássica (adaptada): <strong>V = LPA × (8,5 + 2g) × (4,4 / Y)</strong><br/>
            Onde: LPA = lucro por ação (EPS), g = crescimento esperado anual (%), Y = taxa de juros de referência (%).<br/>
            Quanto maior o crescimento e menor a taxa de juros, maior o preço justo estimado.
          </div>
          {/* Selos */}
          <div className="flex flex-wrap gap-2">
            {grahamBadge && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${
                grahamBadge.color === 'green' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/10 dark:text-green-300 dark:border-green-800' :
                grahamBadge.color === 'yellow' ? 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/10 dark:text-yellow-300 dark:border-yellow-800' :
                'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/10 dark:text-red-300 dark:border-red-800'
              }`}>
                {grahamBadge.label}
              </span>
            )}
          </div>
          {/* Parâmetros e resultados */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-foreground">LPA (EPS)</label>
              <input
                type="text"
                value={grahamEPSText}
                onChange={(e)=>setGrahamEPSText(e.target.value)}
                onKeyDown={(e)=>{ if (e.key==='Enter') commitGrahamEPS() }}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all"
                placeholder="Ex.: 5.32"
              />
              <div className="text-xs text-muted-foreground mt-1">Pressione Enter para aplicar; padrão: EPS automático.</div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-foreground">Crescimento (g) %</label>
              <input
                type="text"
                value={grahamGText}
                onChange={(e)=>setGrahamGText(e.target.value)}
                onKeyDown={(e)=>{ if (e.key==='Enter') commitGrahamG() }}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all"
                placeholder="Ex.: 10"
              />
              <div className="text-xs text-muted-foreground mt-1">Pressione Enter para aplicar; padrão: crescimento automático.</div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-foreground">Taxa de juros (Y) %</label>
              <input
                type="text"
                value={grahamYText}
                onChange={(e)=>setGrahamYText(e.target.value)}
                onKeyDown={(e)=>{ if (e.key==='Enter') commitGrahamY() }}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all"
                placeholder="Ex.: 15"
              />
              <div className="text-xs text-muted-foreground mt-1">Pressione Enter para aplicar; padrão: taxa automática (SELIC se BR).</div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricCard title="Preço Justo (Graham)" value={formatCurrency(grahamFairPrice)} icon={DollarSign} />
            <MetricCard title="Preço Atual" value={formatCurrency(info.currentPrice)} icon={DollarSign} />
            <MetricCard title="Margem vs Atual" value={grahamFairPrice!=null&&info.currentPrice? `${(((grahamFairPrice-info.currentPrice)/info.currentPrice)*100).toFixed(2)}%` : '-'} icon={TrendingUp} />
          </div>
        </div>
      </InfoSection>

      {/* Método Bazin */}
      <InfoSection title="Método Bazin (Teto por Dividendos)" icon={DollarSign}>
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground leading-relaxed">
            Fórmula: <strong>Preço Teto = Dividendos dos últimos 12 meses / (Taxa de DY desejada)</strong>.<br/>
            Ex.: se a empresa pagou R$ 2,00 em 12 meses e você deseja 8% ao ano, o teto seria 2 / 0,08 = R$ 25,00.
          </div>
          {/* Selo */}
          <div className="flex flex-wrap gap-2">
            {bazinBadge && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${
                bazinBadge.color === 'green' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/10 dark:text-green-300 dark:border-green-800' :
                'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/10 dark:text-red-300 dark:border-red-800'
              }`}>
                {bazinBadge.label}
              </span>
            )}
          </div>
          {/* Parâmetros e resultados */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-foreground">Dividendos 12m</label>
              <div className="px-3 py-2 border border-border rounded-lg bg-background text-foreground">
                {formatCurrency(dividends12m)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Se indisponível, usa dividendRate anual do yfinance.</div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-foreground">Taxa DY desejada (%)</label>
              <input 
                type="number" 
                value={bazinRatePct} 
                onChange={(e)=>setBazinRatePct(parseFloat(e.target.value)||0)} 
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all" 
                placeholder="Ex.: 8" 
                title="Taxa mínima desejada de DY em %"
              />
              <div className="text-xs text-muted-foreground mt-1">Ajuste conforme seu objetivo (ex.: 8% a.a.).</div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-foreground">Preço Teto (Bazin)</label>
              <div className="px-3 py-2 border border-border rounded-lg bg-background text-foreground">
                {formatCurrency(bazinCeilingPrice)}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricCard title="Preço Teto (Bazin)" value={formatCurrency(bazinCeilingPrice)} icon={DollarSign} />
            <MetricCard title="Preço Atual" value={formatCurrency(info.currentPrice)} icon={DollarSign} />
            <MetricCard title="Margem vs Atual" value={bazinCeilingPrice!=null&&info.currentPrice? `${(((bazinCeilingPrice-info.currentPrice)/info.currentPrice)*100).toFixed(2)}%` : '-'} icon={TrendingUp} />
          </div>
        </div>
      </InfoSection>

      {/* Fear & Greed - Gauge com ponteiro (responsivo) */}
      <InfoSection title="Fear & Greed (Heurístico)" icon={TrendingUp}>
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground leading-relaxed">
            Termômetro de sentimento baseado em preço atual vs médias móveis (SMA50/200) e distância do topo recente. Escala 0 (medo) a 100 (ganância).
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 items-start">
            {/* Gauge semicircular com ponteiro */}
            <div className="relative overflow-hidden bg-card border border-border rounded-xl sm:rounded-2xl p-4 sm:p-6 flex flex-col items-center">
              {(() => {
                const score = Math.max(0, Math.min(100, fearGreed?.score ?? 0))
                const angle = -90 + (score / 100) * 180 // -90 a +90
                const needleColor = score < 35 ? '#ef4444' : score < 65 ? '#f59e0b' : '#10b981'
                return (
                  <svg
                    viewBox="0 0 240 160"
                    width="100%"
                    className="w-full max-w-[520px]"
                    preserveAspectRatio="xMidYMid meet"
                    style={{ overflow: 'visible' }}
                  >
                    {/* Arco de fundo */}
                    <path d="M30,140 A90,90 0 0,1 210,140" fill="none" stroke="#e5e7eb" strokeWidth="18" strokeLinecap="round" />
                    {/* Arco colorido em faixas (medo→ganância) */}
                    <defs>
                      <linearGradient id="fg-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#ef4444" />
                        <stop offset="50%" stopColor="#f59e0b" />
                        <stop offset="100%" stopColor="#10b981" />
                      </linearGradient>
                    </defs>
                    <path d="M30,140 A90,90 0 0,1 210,140" fill="none" stroke="url(#fg-gradient)" strokeWidth="12" strokeLinecap="round" />
                    {/* Ponteiro */}
                    <g transform={`rotate(${angle} 120 140)`}>
                      <line x1="120" y1="140" x2="120" y2="44" stroke={needleColor} strokeWidth="4" strokeLinecap="round" />
                      <circle cx="120" cy="140" r="6" fill={needleColor} />
                    </g>
                  </svg>
                )
              })()}
            </div>

            {/* Texto e componentes explicativos */}
            <div className="space-y-4">
              <div className="relative overflow-hidden bg-card border border-border rounded-xl sm:rounded-2xl p-4">
                {(() => {
                  const s = Math.max(0, Math.min(100, fearGreed?.score ?? 0))
                  const badge = s < 25 ? { text: 'Medo', cls: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300' } :
                               s < 50 ? { text: 'Cautela', cls: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300' } :
                               s < 75 ? { text: 'Ganância moderada', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300' } :
                                         { text: 'Ganância elevada', cls: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300' }
                  return (
                    <>
                      <div className="flex items-center justify-between">
                        <h4 className="text-base font-semibold text-foreground">Leitura do índice</h4>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${badge.cls}`}>{badge.text}</span>
                      </div>
                      <div className="mt-2 text-sm text-muted-foreground leading-relaxed">
                        Interpretação rápida: valores mais baixos sugerem ambiente de medo (possíveis descontos), enquanto valores altos indicam maior euforia (risco de preços esticados). Use em conjunto com fundamentos e gestão de risco.
                      </div>
                      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div className="px-2 py-1 rounded bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-red-300">0–25 Medo</div>
                        <div className="px-2 py-1 rounded bg-yellow-50 dark:bg-yellow-900/10 text-yellow-800 dark:text-yellow-300">25–50 Cautela</div>
                        <div className="px-2 py-1 rounded bg-amber-50 dark:bg-amber-900/10 text-amber-800 dark:text-amber-300">50–75 Ganância moderada</div>
                        <div className="px-2 py-1 rounded bg-green-50 dark:bg-green-900/10 text-green-800 dark:text-green-300">75–100 Ganância elevada</div>
                      </div>
                    </>
                  )
                })()}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {(fearGreed?.components || []).map((c, i) => (
                  <div key={i} className="relative overflow-hidden bg-card border border-border rounded-xl p-4">
                    <div className="text-xs text-muted-foreground mb-1">{c.key}</div>
                    <div className="mt-2 h-1.5 rounded bg-muted overflow-hidden">
                      <div className="h-1.5 bg-primary" style={{ width: `${c.value}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            Para que serve: medir rapidamente o sentimento do mercado sobre o ativo. Útil para calibrar entrada/saída junto a critérios fundamentais (Graham/Bazin), nunca isoladamente.
          </div>
        </div>
      </InfoSection>
    </motion.div>
  )
}
