import { motion } from 'framer-motion'
import {
  Trophy,
  TrendingUp,
  BarChart3,
  PieChart,
  Medal,
  Award,
} from 'lucide-react'
import { formatDividendYield } from '../../utils/formatters'
import TickerWithLogo from '../TickerWithLogo'

interface CarteiraRankingTabProps {
  carteira: any[]
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
}

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
}

type RankingConfig = {
  key: string
  title: string
  icon: React.ElementType
  iconColor: string
  iconColorDark: string
  accentClass: string
  accentClassDark: string
  getValue: (a: any) => number
  formatValue: (a: any) => string
  filter: (a: any) => boolean
  sortDesc: boolean
}

function PodiumPlace({
  ativo,
  position,
  formatValue,
  accentClass,
  accentClassDark,
  delay,
}: {
  ativo: any
  position: 1 | 2 | 3
  formatValue: (a: any) => string
  accentClass: string
  accentClassDark: string
  delay: number
}) {
  const heights = {
    1: 'min-h-[150px] sm:min-h-[165px] md:min-h-[180px]',
    2: 'min-h-[120px] sm:min-h-[130px] md:min-h-[140px]',
    3: 'min-h-[100px] sm:min-h-[110px] md:min-h-[120px]',
  }
  const order = { 1: 'order-2', 2: 'order-1', 3: 'order-3' }
  const medals = {
    1: {
      Icon: Trophy,
      label: '1º',
      bg: 'from-amber-400 to-amber-600',
      bgDark: 'dark:from-amber-300 dark:to-amber-500',
      text: 'text-amber-950',
      textDark: 'dark:text-amber-950',
      shadow: 'shadow-amber-500/40',
      shadowDark: 'dark:shadow-amber-400/30',
    },
    2: {
      Icon: Medal,
      label: '2º',
      bg: 'from-slate-300 to-slate-500',
      bgDark: 'dark:from-slate-400 dark:to-slate-600',
      text: 'text-slate-800',
      textDark: 'dark:text-slate-900',
      shadow: 'shadow-slate-400/40',
      shadowDark: 'dark:shadow-slate-500/40',
    },
    3: {
      Icon: Award,
      label: '3º',
      bg: 'from-amber-700 to-amber-900',
      bgDark: 'dark:from-amber-600 dark:to-amber-800',
      text: 'text-amber-100',
      textDark: 'dark:text-amber-100',
      shadow: 'shadow-amber-800/40',
      shadowDark: 'dark:shadow-amber-600/40',
    },
  }
  const m = medals[position]

  return (
    <motion.div
      variants={item}
      className={`flex flex-col items-center justify-end min-w-0 ${order[position]} ${heights[position]}`}
      style={{ perspective: '800px' }}
    >
      <motion.div
        initial={{ opacity: 0, rotateY: -24, scale: 0.85 }}
        animate={{
          opacity: 1,
          rotateY: 0,
          scale: 1,
        }}
        transition={{ duration: 0.5, delay, type: 'spring', stiffness: 80, damping: 18 }}
        whileHover={{
          scale: 1.03,
          rotateY: 4,
          rotateX: 2,
          transition: { duration: 0.2 },
        }}
        style={{
          transformStyle: 'preserve-3d',
          transformOrigin: 'center bottom',
          boxShadow: '0 10px 40px -12px rgba(0,0,0,0.25), 0 4px 12px -4px rgba(0,0,0,0.15)',
        }}
        className={`
          w-full min-w-0 max-w-full rounded-xl sm:rounded-2xl border-2 border-border/50 bg-card dark:bg-card/95
          p-3 sm:p-4 dark:border-border/80
          flex flex-col items-center justify-end gap-1.5 sm:gap-2
          [transform-style:preserve-3d] [backface-visibility:visible] overflow-visible
        `}
      >
        <motion.div
          animate={{
            y: [0, -3, 0],
            boxShadow: [
              '0 4px 14px 0 rgba(0,0,0,0.15)',
              '0 6px 20px 2px rgba(0,0,0,0.12)',
              '0 4px 14px 0 rgba(0,0,0,0.15)',
            ],
          }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          className={`
            inline-flex h-9 w-9 sm:h-11 sm:w-11 rounded-full bg-gradient-to-br ${m.bg} ${m.bgDark}
            ${m.text} ${m.textDark} items-center justify-center shadow-lg ${m.shadow} ${m.shadowDark}
            ring-2 ring-white/30 dark:ring-white/20 shrink-0
          `}
        >
          <motion.div
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          >
            <m.Icon className="h-4 w-4 sm:h-6 sm:w-6" strokeWidth={2.5} />
          </motion.div>
        </motion.div>
        <span className="text-[10px] sm:text-xs font-bold text-muted-foreground dark:text-muted-foreground uppercase tracking-wider shrink-0">
          {m.label}
        </span>
        <div className="w-full flex justify-center min-h-[28px] sm:min-h-[32px] overflow-visible" style={{ transform: 'translateZ(8px)' }}>
          <div className="min-w-0 max-w-full flex justify-center">
            <TickerWithLogo ticker={ativo?.ticker || ''} size="sm" />
          </div>
        </div>
        <span className={`text-base sm:text-lg font-bold truncate max-w-full text-center ${accentClass} ${accentClassDark}`} style={{ transform: 'translateZ(4px)' }}>
          {formatValue(ativo)}
        </span>
      </motion.div>
    </motion.div>
  )
}

function RankingSection({
  config,
  list,
  index,
}: {
  config: RankingConfig
  list: any[]
  index: number
}) {
  const [podium, rest] = [list.slice(0, 3), list.slice(3, 7)]
  const Icon = config.icon

  return (
    <motion.section
      initial={{ opacity: 0, y: 28, rotateX: 12 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ duration: 0.5, delay: index * 0.12, type: 'spring', stiffness: 90, damping: 20 }}
      style={{ perspective: '1000px', transformStyle: 'preserve-3d' }}
      className="rounded-xl sm:rounded-2xl border border-border dark:border-border/80 bg-card/50 dark:bg-card/60 p-4 sm:p-5 md:p-6 shadow-lg dark:shadow-xl dark:shadow-black/20 overflow-visible min-w-0"
    >
      <motion.div
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.12 + 0.15, duration: 0.35 }}
        className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6 min-w-0"
      >
        <motion.div
          animate={{ rotate: [0, 8, -8, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          className={`p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-background dark:bg-background/80 border border-border dark:border-border/80 shrink-0 ${config.iconColor} ${config.iconColorDark}`}
        >
          <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
        </motion.div>
        <h3 className="text-base sm:text-lg font-semibold text-foreground dark:text-foreground truncate min-w-0">{config.title}</h3>
      </motion.div>

      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground dark:text-muted-foreground py-4">
          Nenhum ativo com dados para este ranking.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 sm:gap-3 md:gap-4 items-end mb-4 sm:mb-6 overflow-visible min-w-0" style={{ perspective: '900px' }}>
            {[
              { ativo: podium[1], position: 2 as const },
              { ativo: podium[0], position: 1 as const },
              { ativo: podium[2], position: 3 as const },
            ]
              .filter((x): x is { ativo: any; position: 1 | 2 | 3 } => !!x.ativo)
              .map(({ ativo, position }, i) => (
                <PodiumPlace
                  key={ativo?.id || ativo?.ticker}
                  ativo={ativo}
                  position={position}
                  formatValue={config.formatValue}
                  accentClass={config.accentClass}
                  accentClassDark={config.accentClassDark}
                  delay={0.2 + i * 0.1}
                />
              ))}
          </div>

          {rest.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ delay: 0.45, duration: 0.4 }}
              className="pt-3 sm:pt-4 border-t border-border dark:border-border/80 overflow-visible"
            >
              <p className="text-xs font-medium text-muted-foreground dark:text-muted-foreground uppercase tracking-wider mb-2 sm:mb-3">
                Demais posições
              </p>
              <motion.div
                className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2 min-w-0"
                variants={container}
                initial="hidden"
                animate="show"
              >
                {rest.map((ativo, i) => (
                  <motion.div
                    key={ativo?.id || ativo?.ticker}
                    variants={item}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + i * 0.06 }}
                    whileHover={{ scale: 1.02, x: 2 }}
                    className="flex justify-between items-center gap-1.5 sm:gap-2 p-1.5 sm:p-2 rounded-lg bg-muted/40 dark:bg-muted/50 hover:bg-muted/60 dark:hover:bg-muted/60 transition-colors border border-transparent hover:border-border/50 dark:hover:border-border/50 min-w-0 overflow-hidden"
                  >
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <TickerWithLogo ticker={ativo?.ticker || ''} size="sm" />
                    </div>
                    <span className={`text-xs sm:text-sm font-semibold shrink-0 min-w-0 truncate max-w-[5rem] sm:max-w-none ${config.accentClass} ${config.accentClassDark}`}>
                      {config.formatValue(ativo)}
                    </span>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          )}
        </>
      )}
    </motion.section>
  )
}

export default function CarteiraRankingTab({
  carteira,
}: CarteiraRankingTabProps) {
  const configs: RankingConfig[] = [
    {
      key: 'roe',
      title: 'Top ROE',
      icon: Trophy,
      iconColor: 'text-blue-500',
      iconColorDark: 'dark:text-blue-400',
      accentClass: 'text-blue-600',
      accentClassDark: 'dark:text-blue-400',
      getValue: (a) => a?.roe ?? 0,
      formatValue: (a) => `${(a?.roe ?? 0).toFixed(2)}%`,
      filter: (a) => !!a?.roe && a.roe > 0,
      sortDesc: true,
    },
    {
      key: 'dy',
      title: 'Top Dividend Yield',
      icon: TrendingUp,
      iconColor: 'text-green-500',
      iconColorDark: 'dark:text-green-400',
      accentClass: 'text-green-600',
      accentClassDark: 'dark:text-green-400',
      getValue: (a) => a?.dy ?? 0,
      formatValue: (a) => formatDividendYield(a?.dy),
      filter: (a) => !!a?.dy && a.dy > 0,
      sortDesc: true,
    },
    {
      key: 'pl',
      title: 'Top P/L (Menor)',
      icon: BarChart3,
      iconColor: 'text-yellow-500',
      iconColorDark: 'dark:text-yellow-400',
      accentClass: 'text-yellow-600',
      accentClassDark: 'dark:text-yellow-400',
      getValue: (a) => a?.pl ?? 0,
      formatValue: (a) => (a?.pl ?? 0).toFixed(2),
      filter: (a) => !!a?.pl && a.pl > 0,
      sortDesc: false,
    },
    {
      key: 'pvp',
      title: 'Top P/VP (Menor)',
      icon: PieChart,
      iconColor: 'text-orange-500',
      iconColorDark: 'dark:text-orange-400',
      accentClass: 'text-orange-600',
      accentClassDark: 'dark:text-orange-400',
      getValue: (a) => a?.pvp ?? 0,
      formatValue: (a) => (a?.pvp ?? 0).toFixed(2),
      filter: (a) => !!a?.pvp && a.pvp > 0,
      sortDesc: false,
    },
  ]

  const hasCarteira = carteira && carteira.length > 0

  return (
    <div className="w-full max-w-full overflow-visible space-y-6 sm:space-y-8 px-0 min-w-0">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex items-center gap-2 sm:gap-3 min-w-0 flex-wrap"
      >
        <motion.div
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          className="p-2 sm:p-2.5 rounded-xl bg-primary/10 dark:bg-primary/20 border border-primary/20 dark:border-primary/30 shrink-0"
        >
          <Trophy className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
        </motion.div>
        <div className="min-w-0">
          <h2 className="text-lg sm:text-xl font-semibold text-foreground dark:text-foreground truncate">Rankings da Carteira</h2>
          <p className="text-xs sm:text-sm text-muted-foreground dark:text-muted-foreground">
            Pódio e melhores posições por indicador
          </p>
        </div>
      </motion.div>

      {hasCarteira ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 md:gap-6 overflow-visible min-w-0">
          {configs.map((config, index) => {
            const list = carteira
              .filter(config.filter)
              .sort((a, b) =>
                config.sortDesc
                  ? config.getValue(b) - config.getValue(a)
                  : config.getValue(a) - config.getValue(b)
              )
              .slice(0, 7)
            return (
              <RankingSection key={config.key} config={config} list={list} index={index} />
            )
          })}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="rounded-2xl border border-dashed border-border dark:border-border/80 bg-muted/20 dark:bg-muted/30 py-16 text-center"
        >
          <motion.div
            animate={{ opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          </motion.div>
          <p className="text-muted-foreground dark:text-muted-foreground">
            Adicione ativos à sua carteira para ver os rankings.
          </p>
        </motion.div>
      )}
    </div>
  )
}
