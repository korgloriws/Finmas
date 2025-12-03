import { motion } from 'framer-motion'
import { 
  DollarSign, 
  Target, 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  FileText,
  Building2,
  Globe,
  Users,
  PieChart,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ExternalLink,
  BarChart3,
  Award
} from 'lucide-react'
import { formatCurrency, formatPercentage, formatNumber, formatDividendYield } from '../../utils/formatters'
import PortfolioFIIComponent from './PortfolioFII'


function MetricCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend, 
  loading 
}: {
  title: string
  value: string
  subtitle?: string
  icon: any
  trend?: { value: number; isPositive: boolean }
  loading?: boolean
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
        <div className="flex items-start justify-between mb-3">
          <div className="p-1.5 sm:p-2 rounded-md sm:rounded-lg bg-primary text-primary-foreground shadow-lg">
            <Icon className="w-3 h-3 sm:w-4 sm:h-4" />
          </div>
          {trend && !loading && (
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1 }}
              className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
                trend.isPositive 
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              }`}
            >
              {trend.isPositive ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              <span>{Math.abs(trend.value).toFixed(2)}%</span>
            </motion.div>
          )}
        </div>
        
        <div className="space-y-1">
          <h3 className="text-sm sm:text-base font-semibold text-muted-foreground leading-tight">{title}</h3>
          {loading ? (
            <div className="animate-pulse">
              <div className="h-6 bg-muted rounded w-24"></div>
            </div>
          ) : (
            <p className="text-xl sm:text-2xl font-bold text-foreground leading-tight">{value}</p>
          )}
          {subtitle && (
            <p className="text-xs sm:text-sm text-muted-foreground leading-tight">{subtitle}</p>
          )}
        </div>
      </div>
    </motion.div>
  )
}


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
        <div className="flex items-center gap-2 mb-4">
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
        {typeof value === 'string' && value.startsWith('http') ? (
          <a 
            href={value} 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline"
            title="Abrir link"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        ) : (
          value
        )}
      </span>
    </div>
  )
}


function calcularVariacao(valorAtual: number, valorAnterior: number): number {
  if (!valorAnterior || valorAnterior === 0) return 0
  return ((valorAtual - valorAnterior) / valorAnterior) * 100
}

interface DetalhesVisaoGeralTabProps {
  ticker: string
  info: any
  logoUrl: string | null | undefined
  historico: Array<Record<string, any>> | undefined
  loadingHistorico: boolean
  strategyDetails: {
    meets: boolean
    criteria: Array<{ label: string; value: string; ok: boolean }>
  }
  tipoAtivo: string
  fiiInfo: any
  fiiMetadata?: any
  grahamBadge: { label: string; color: string } | null
  bazinBadge: { label: string; color: string } | null
  enterpriseValue: number | null
  ebitComputed: number | null
  evToEbit: number | null
  liquidezDiaria: number
}

export default function DetalhesVisaoGeralTab({
  ticker,
  info,
  logoUrl,
  historico,
  loadingHistorico,
  strategyDetails,
  tipoAtivo,
  fiiInfo,
  fiiMetadata,
  grahamBadge,
  bazinBadge,
  enterpriseValue,
  ebitComputed,
  evToEbit,
  liquidezDiaria
}: DetalhesVisaoGeralTabProps) {
  return (
    <motion.div
      key="overview"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      {/* Header do ativo */}
      <motion.div 
        className="relative overflow-hidden bg-card border-2 border-primary/20 rounded-xl sm:rounded-2xl p-6 sm:p-8 hover:shadow-2xl hover:border-primary/40 transition-all duration-500 group"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        whileHover={{ scale: 1.01 }}
      >
        {/* Background pattern animado */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent opacity-100 group-hover:opacity-100 transition-opacity duration-500" />
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-primary/5 to-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        
        {/* Efeito de brilho animado */}
        <motion.div 
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
          animate={{
            x: ['-100%', '200%'],
          }}
          transition={{
            repeat: Infinity,
            duration: 3,
            ease: 'linear'
          }}
        />
        
        <div className="relative z-10 flex items-center gap-6 flex-wrap">
          {logoUrl ? (
            <motion.div
              initial={{ rotateY: 90, opacity: 0 }}
              animate={{ rotateY: 0, opacity: 1 }}
              transition={{ duration: 0.6, type: 'spring', stiffness: 100 }}
              whileHover={{ rotateY: 180, scale: 1.1 }}
              style={{ perspective: 1000 }}
              className="relative"
            >
              <div className="absolute inset-0 bg-primary/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500" />
              <motion.img 
              src={logoUrl} 
              alt={ticker} 
                className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-xl sm:rounded-2xl object-cover border-2 border-primary/30 shadow-xl group-hover:shadow-2xl group-hover:border-primary/50 transition-all duration-500"
                style={{ transformStyle: 'preserve-3d', objectFit: 'cover' }}
              />
            </motion.div>
          ) : (
            <motion.div
              initial={{ rotateY: 90, opacity: 0 }}
              animate={{ rotateY: 0, opacity: 1 }}
              transition={{ duration: 0.6, type: 'spring', stiffness: 100 }}
              whileHover={{ rotateY: 180, scale: 1.1 }}
              style={{ perspective: 1000 }}
              className="relative"
            >
              <div className="absolute inset-0 bg-primary/30 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500" />
              <motion.div 
                className="relative w-24 h-24 sm:w-32 sm:h-32 bg-gradient-to-br from-primary via-primary/80 to-primary/60 rounded-xl sm:rounded-2xl flex items-center justify-center text-white font-bold text-xl sm:text-2xl shadow-xl group-hover:shadow-2xl transition-all duration-500"
                style={{ transformStyle: 'preserve-3d' }}
              >
              {ticker.replace('.SA', '').replace('.sa', '').slice(0, 4)}
              </motion.div>
            </motion.div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-2">
              <h2 className="text-xl sm:text-2xl font-bold text-foreground min-w-0 break-words">{info.longName}</h2>
              
              {/* Selo Dinâmico da Estratégia */}
              <motion.div
                key={strategyDetails.meets ? 'in-strategy' : 'out-strategy'}
                initial={{ opacity: 0, scale: 0, rotate: -180, y: -20 }}
                animate={{ 
                  opacity: 1, 
                  scale: 1,
                  rotate: 0,
                  y: 0
                }}
                transition={{ 
                  type: "spring",
                  stiffness: 300,
                  damping: 20,
                  duration: 0.6
                }}
                whileHover={{ 
                  scale: 1.08,
                  rotate: [0, -3, 3, 0],
                  transition: { duration: 0.3 }
                }}
                className="relative shrink-0"
              >
                {strategyDetails.meets ? (
                  // Selo VERDE - Na Estratégia
                  <motion.div
                    className="relative inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white overflow-visible cursor-pointer"
                    style={{
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)',
                      clipPath: 'polygon(0% 0%, 100% 0%, 100% 85%, 50% 100%, 0% 85%)',
                      borderRadius: '8px 8px 8px 8px',
                    }}
                    animate={{
                      boxShadow: [
                        '0 0 20px rgba(16, 185, 129, 0.4), inset 0 0 20px rgba(255, 255, 255, 0.1)',
                        '0 0 35px rgba(16, 185, 129, 0.7), inset 0 0 25px rgba(255, 255, 255, 0.2)',
                        '0 0 20px rgba(16, 185, 129, 0.4), inset 0 0 20px rgba(255, 255, 255, 0.1)',
                      ],
                    }}
                    transition={{
                      duration: 2.5,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                    title="✅ Está dentro da estratégia"
                  >
                    {/* Brilho metálico animado */}
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-transparent"
                      animate={{
                        opacity: [0.3, 0.6, 0.3],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                    />
                    
                    {/* Brilho deslizante */}
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent"
                      animate={{
                        x: ['-100%', '200%'],
                      }}
                      transition={{
                        repeat: Infinity,
                        duration: 3,
                        ease: 'linear'
                      }}
                    />
                    
                    {/* Efeito de pulso externo */}
                    <motion.div
                      className="absolute -inset-2 bg-green-400/30 blur-md rounded-lg"
                      style={{
                        clipPath: 'polygon(0% 0%, 100% 0%, 100% 85%, 50% 100%, 0% 85%)',
                      }}
                      animate={{
                        opacity: [0.3, 0.6, 0.3],
                        scale: [1, 1.1, 1]
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                    />
                    
                    {/* Partículas de brilho */}
                    {[...Array(3)].map((_, i) => (
                      <motion.div
                        key={i}
                        className="absolute w-1 h-1 bg-white rounded-full"
                        style={{
                          left: `${20 + i * 30}%`,
                          top: `${30 + i * 20}%`,
                        }}
                        animate={{
                          opacity: [0, 1, 0],
                          scale: [0, 1.5, 0],
                          y: [0, -10, 0],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          delay: i * 0.3,
                          ease: "easeInOut"
                        }}
                      />
                    ))}
                    
                    <span className="relative z-10 flex items-center gap-2">
                      <motion.div
                        animate={{ 
                          rotate: [0, 360],
                          scale: [1, 1.1, 1]
                        }}
                        transition={{
                          rotate: {
                            duration: 3,
                            repeat: Infinity,
                            ease: "linear"
                          },
                          scale: {
                            duration: 1.5,
                            repeat: Infinity,
                            ease: "easeInOut"
                          }
                        }}
                      >
                        <CheckCircle className="w-5 h-5" strokeWidth={3} />
                      </motion.div>
                      <motion.span 
                        className="hidden sm:inline whitespace-nowrap"
                        animate={{
                          textShadow: [
                            '0 0 5px rgba(255,255,255,0.5)',
                            '0 0 10px rgba(255,255,255,0.8)',
                            '0 0 5px rgba(255,255,255,0.5)',
                          ]
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeInOut"
                        }}
                      >
                        Na Estratégia
                      </motion.span>
                      <motion.span 
                        className="sm:hidden"
                        animate={{
                          scale: [1, 1.2, 1]
                        }}
                        transition={{
                          duration: 1,
                          repeat: Infinity,
                          ease: "easeInOut"
                        }}
                      >
                        ✓
                      </motion.span>
                    </span>
                  </motion.div>
                ) : (
                  // Selo VERMELHO - Fora da Estratégia
                  <motion.div
                    className="relative inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white overflow-visible cursor-pointer"
                    style={{
                      background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 50%, #b91c1c 100%)',
                      clipPath: 'polygon(0% 0%, 100% 0%, 100% 85%, 50% 100%, 0% 85%)',
                      borderRadius: '8px 8px 8px 8px',
                    }}
                    animate={{
                      boxShadow: [
                        '0 0 15px rgba(239, 68, 68, 0.3), inset 0 0 15px rgba(255, 255, 255, 0.1)',
                        '0 0 30px rgba(239, 68, 68, 0.6), inset 0 0 20px rgba(255, 255, 255, 0.15)',
                        '0 0 15px rgba(239, 68, 68, 0.3), inset 0 0 15px rgba(255, 255, 255, 0.1)',
                      ],
                    }}
                    transition={{
                      duration: 2.5,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                    title="❌ Está fora da estratégia"
                  >
                    {/* Brilho metálico animado */}
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent"
                      animate={{
                        opacity: [0.2, 0.4, 0.2],
                      }}
                      transition={{
                        duration: 2.5,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                    />
                    
                    {/* Efeito de ondas */}
                    <motion.div
                      className="absolute inset-0"
                      animate={{
                        background: [
                          'radial-gradient(circle at 30% 50%, rgba(255,255,255,0.15) 0%, transparent 50%)',
                          'radial-gradient(circle at 70% 50%, rgba(255,255,255,0.15) 0%, transparent 50%)',
                          'radial-gradient(circle at 30% 50%, rgba(255,255,255,0.15) 0%, transparent 50%)',
                        ],
                      }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                    />
                    
                    {/* Linha de brilho deslizante */}
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                      animate={{
                        x: ['-100%', '200%'],
                      }}
                      transition={{
                        repeat: Infinity,
                        duration: 3.5,
                        ease: 'linear'
                      }}
                    />
                    
                    {/* Efeito de pulso externo */}
                    <motion.div
                      className="absolute -inset-2 bg-red-400/20 blur-md rounded-lg"
                      style={{
                        clipPath: 'polygon(0% 0%, 100% 0%, 100% 85%, 50% 100%, 0% 85%)',
                      }}
                      animate={{
                        opacity: [0.2, 0.4, 0.2],
                        scale: [1, 1.05, 1]
                      }}
                      transition={{
                        duration: 2.5,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                    />
                    
                    {/* Partículas de alerta */}
                    {[...Array(3)].map((_, i) => (
                      <motion.div
                        key={i}
                        className="absolute w-1 h-1 bg-white/60 rounded-full"
                        style={{
                          left: `${20 + i * 30}%`,
                          top: `${30 + i * 20}%`,
                        }}
                        animate={{
                          opacity: [0, 0.8, 0],
                          scale: [0, 1.2, 0],
                          y: [0, -8, 0],
                        }}
                        transition={{
                          duration: 2.5,
                          repeat: Infinity,
                          delay: i * 0.4,
                          ease: "easeInOut"
                        }}
                      />
                    ))}
                    
                    <span className="relative z-10 flex items-center gap-2">
                      <motion.div
                        animate={{ 
                          rotate: [0, -10, 10, 0],
                          scale: [1, 1.1, 1]
                        }}
                        transition={{
                          rotate: {
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeInOut"
                          },
                          scale: {
                            duration: 1.5,
                            repeat: Infinity,
                            ease: "easeInOut"
                          }
                        }}
                      >
                        <XCircle className="w-5 h-5" strokeWidth={3} />
                      </motion.div>
                      <motion.span 
                        className="hidden sm:inline whitespace-nowrap"
                        animate={{
                          textShadow: [
                            '0 0 5px rgba(255,255,255,0.3)',
                            '0 0 8px rgba(255,255,255,0.5)',
                            '0 0 5px rgba(255,255,255,0.3)',
                          ]
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeInOut"
                        }}
                      >
                        Fora da Estratégia
                      </motion.span>
                      <motion.span 
                        className="sm:hidden"
                        animate={{
                          scale: [1, 1.2, 1],
                          rotate: [0, -5, 5, 0]
                        }}
                        transition={{
                          duration: 1,
                          repeat: Infinity,
                          ease: "easeInOut"
                        }}
                      >
                        ✗
                      </motion.span>
                    </span>
                  </motion.div>
                )}
              </motion.div>
            </div>
            <div className="w-full mt-2 flex items-center gap-1 sm:gap-2 text-xs text-muted-foreground flex-wrap">
              <span className="hidden md:inline">Critérios:</span>
              {strategyDetails.criteria.map((c, idx) => (
                <motion.span
                  key={idx}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.03 * idx }}
                  className={`inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full border text-xs ${
                    c.ok
                      ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/10 dark:text-green-300 dark:border-green-800'
                      : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/10 dark:text-red-300 dark:border-red-800'
                  }`}
                  title={`${c.label}: ${c.value}`}
                >
                  {c.ok ? (
                    <CheckCircle className="w-3 h-3" />
                  ) : (
                    <XCircle className="w-3 h-3" />
                  )}
                  <span className="max-w-[80px] sm:max-w-[120px] truncate">{c.label}</span>
                </motion.span>
              ))}
              {tipoAtivo === 'FII' && (
                <>
                  {fiiInfo?.tipo && (
                    <span
                      className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full border bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/10 dark:text-purple-300 dark:border-purple-800 text-xs"
                      title={`Tipo de FII: ${fiiInfo?.tipo}${fiiInfo?.fonte_metadata ? ` (Fonte: ${fiiInfo.fonte_metadata})` : ''}`}
                    >
                      <PieChart className="w-3 h-3" />
                      <span className="max-w-[100px] sm:max-w-[140px] truncate">{fiiInfo?.tipo}</span>
                    </span>
                  )}
                  {fiiInfo?.segmento && (
                    <span
                      className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full border bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/10 dark:text-indigo-300 dark:border-indigo-800 text-xs"
                      title={`Segmento: ${fiiInfo?.segmento}${fiiInfo?.fonte_metadata ? ` (Fonte: ${fiiInfo.fonte_metadata})` : ''}`}
                    >
                      <Building2 className="w-3 h-3" />
                      <span className="max-w-[120px] sm:max-w-[160px] truncate">{fiiInfo?.segmento}</span>
                    </span>
                  )}
                </>
              )}
              {/* Selos de Graham e Bazin no overview (responsivos) */}
              {grahamBadge && (
                <span className={`inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full border text-xs font-medium ${
                  grahamBadge.color === 'green' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/10 dark:text-green-300 dark:border-green-800' :
                  grahamBadge.color === 'yellow' ? 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/10 dark:text-yellow-300 dark:border-yellow-800' :
                  'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/10 dark:text-red-300 dark:border-red-800'
                }`}>
                  <span className="hidden sm:inline">{grahamBadge.label}</span>
                  <span className="sm:hidden">{grahamBadge.label.split(' ')[0]}</span>
                </span>
              )}
              {bazinBadge && (
                <span className={`inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full border text-xs font-medium ${
                  bazinBadge.color === 'green' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/10 dark:text-green-300 dark:border-green-800' :
                  'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/10 dark:text-red-300 dark:border-red-800'
                }`}>
                  <span className="hidden sm:inline">{bazinBadge.label}</span>
                  <span className="sm:hidden">{bazinBadge.label.split(' ')[0]}</span>
                </span>
              )}
            </div>
            <p className="text-base sm:text-lg text-muted-foreground mt-1">{info.symbol}</p>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-3 text-xs sm:text-sm text-muted-foreground">
              {info.sector && (
                <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-muted/50">
                  <Building2 className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span>{info.sector}</span>
                </span>
              )}
              {info.country && (
                <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-muted/50">
                  <Globe className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span>{info.country}</span>
                </span>
              )}
              {info.website && (
                <a 
                  href={info.website} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                >
                  <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span>Website</span>
                </a>
              )}
              <a 
                href={`https://www.google.com/search?q=${encodeURIComponent(ticker)}`}
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                title="Pesquisar no Google"
              >
                <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4" />
                <span>Google</span>
              </a>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Métricas principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        <MetricCard
          title="Preço Atual"
          value={formatCurrency(info.currentPrice)}
          icon={DollarSign}
          trend={historico && historico.length > 1 ? {
            value: calcularVariacao(historico[historico.length - 1].Close, historico[historico.length - 2].Close),
            isPositive: historico[historico.length - 1].Close > historico[historico.length - 2].Close
          } : undefined}
          loading={loadingHistorico}
        />
        <MetricCard
          title="P/L"
          value={formatNumber(info.trailingPE)}
          subtitle="Price/Earnings"
          icon={Target}
        />
        <MetricCard
          title="P/VP"
          value={formatNumber(info.priceToBook)}
          subtitle="Price/Book Value"
          icon={FileText}
        />
        <MetricCard
          title="Dividend Yield"
          value={formatDividendYield(info.dividendYield)}
          icon={TrendingUp}
        />
        <MetricCard
          title="ROE"
          value={formatPercentage(info.returnOnEquity ? info.returnOnEquity * 100 : null)}
          subtitle="Return on Equity"
          icon={Activity}
        />
        <MetricCard
          title="Liquidez Diária"
          value={formatCurrency(liquidezDiaria)}

          icon={BarChart3}
        />
      </div>

      {/* Informações da empresa / FII */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <InfoSection title="Informações Gerais" icon={Building2}>
          <div className="space-y-0.5">
            <InfoRow label="Nome Completo" value={info.longName} icon={FileText} />
            <InfoRow label="Ticker" value={info.symbol} icon={Award} />
            <InfoRow label="País" value={info.country} icon={Globe} />
            <InfoRow label="Setor" value={info.sector} icon={Building2} />
            {/* Campos adicionais para FII */}
            <InfoRow label="Tipo de FII" value={fiiInfo?.tipo} icon={PieChart} />
            <InfoRow label="Segmento" value={fiiInfo?.segmento} icon={Target} />
            <InfoRow label="Gestora" value={fiiInfo?.gestora} icon={Users} />
            <InfoRow label="Administradora" value={fiiInfo?.administradora} icon={Users} />
            <InfoRow label="Patrimônio Líquido" value={formatCurrency(fiiInfo?.patrimonio_liquido)} icon={DollarSign} />
            <InfoRow label="Vacância" value={fiiInfo?.vacancia ? `${fiiInfo.vacancia}%` : '-'} icon={AlertTriangle} />
            <InfoRow label="Nº de Cotistas" value={fiiInfo?.num_cotistas?.toLocaleString('pt-BR')} icon={Users} />
            <InfoRow label="Nº de Imóveis" value={fiiInfo?.num_imoveis?.toString()} icon={Building2} />
            <InfoRow label="Indústria" value={info.industry} icon={Target} />
            <InfoRow label="Website" value={info.website} icon={ExternalLink} />
            <InfoRow label="Funcionários" value={info.fullTimeEmployees?.toLocaleString('pt-BR')} icon={Users} />
            <InfoRow label="Moeda" value={info.currency} icon={DollarSign} />
          </div>
        </InfoSection>

        <InfoSection title="Indicadores de Mercado" icon={TrendingUp}>
          <div className="space-y-0.5">
            <InfoRow label="Market Cap" value={formatCurrency(info.marketCap)} icon={DollarSign} />
            <InfoRow label="Enterprise Value (EV)" value={formatCurrency(enterpriseValue)} icon={DollarSign} />
            <InfoRow label="EBIT (estimado)" value={formatCurrency(ebitComputed)} icon={Target} />
            <InfoRow label="EV/EBIT" value={formatNumber(evToEbit)} icon={FileText} />
            <InfoRow label="Volume Médio" value={formatCurrency(info.averageVolume)} icon={BarChart3} />
            <InfoRow label="Beta" value={formatNumber(info.beta)} icon={Activity} />
            <InfoRow label="Média 50 dias" value={formatCurrency(info.fiftyDayAverage)} icon={TrendingUp} />
            <InfoRow label="Média 200 dias" value={formatCurrency(info.twoHundredDayAverage)} icon={TrendingUp} />
            <InfoRow label="Máx 52 Semanas" value={formatCurrency(info.fiftyTwoWeekHigh)} icon={TrendingUp} />
            <InfoRow label="Mín 52 Semanas" value={formatCurrency(info.fiftyTwoWeekLow)} icon={TrendingDown} />
          </div>
        </InfoSection>
      </div>

      {/* Seção de Portfólio para FIIs */}
      {tipoAtivo === 'FII' && fiiMetadata?.portfolio && (
        <div className="mt-8">
          <InfoSection title="Portfólio do FII" icon={Building2}>
            <PortfolioFIIComponent portfolio={fiiMetadata.portfolio} />
          </InfoSection>
        </div>
      )}
    </motion.div>
  )
}
