import type { ElementType } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Crown,
  LogOut,
  Home,
  Sparkles,
  BarChart3,
  Filter,
  List,
  TrendingUp,
  Check,
  Target,
  CalendarDays,
  Calendar,
  DollarSign,
  Layers,
  Trophy,
  Users,
  PieChart,
  Lightbulb,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { TELAS_APP } from '../services/api'

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.15 },
  },
}

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
}

const analiseSteps = [
  {
    icon: Filter,
    title: 'Defina seus critérios',
    text: 'Escolha o tipo (Ações, FIIs ou BDRs) e ajuste filtros como Dividend Yield, P/VPA, P/L, ROE e liquidez. Só aparecem ativos que passam nos seus critérios.',
  },
  {
    icon: List,
    title: 'Lista ranqueada',
    text: 'Veja uma lista ordenada com os melhores ativos, indicadores fundamentais e técnicos. Identifique no mesmo lugar quais você já tem na carteira.',
  },
  {
    icon: BarChart3,
    title: 'Gráficos e comparação',
    text: 'Visualize desempenho em gráficos e compare ativos lado a lado para tomar decisões com mais segurança.',
  },
  {
    icon: Target,
    title: 'Exporte e acompanhe',
    text: 'Exporte os resultados e acompanhe os ativos que mais interessam para não perder oportunidades.',
  },
]

const agendaDividendosSteps = [
  {
    icon: Calendar,
    title: 'Calendário de proventos',
    text: 'Visualize em um calendário mensal e anual todos os dividendos e JCP previstos — da sua carteira e do mercado. Nada passa em branco.',
  },
  {
    icon: Layers,
    title: 'Por ativo e por data',
    text: 'Veja valor estimado, data de pagamento e tipo de provento (dividendo, JCP, FII etc.) por ativo. Filtre por tipo e período.',
  },
  {
    icon: DollarSign,
    title: 'Previsão de rendimento',
    text: 'Saiba quanto deve entrar a cada mês ou ano com os proventos. Planeje sua renda passiva e compare com seus objetivos.',
  },
  {
    icon: CalendarDays,
    title: 'Organize sua agenda',
    text: 'Antecipe datas importantes e não perca prazos. Tudo em um só lugar, integrado à sua carteira.',
  },
]

const rankingsSteps = [
  {
    icon: Trophy,
    title: 'Top ativos do mercado',
    text: 'Veja os ativos mais escolhidos por outros investidores — por volume de pessoas e por valor aplicado. Ações, FIIs e BDRs em rankings separados.',
  },
  {
    icon: Users,
    title: 'Compare com a comunidade',
    text: 'Descubra onde a maioria está investindo e como sua carteira se compara. Entenda se você está mais concentrado ou mais diversificado que a média.',
  },
  {
    icon: PieChart,
    title: 'Sua alocação vs. mercado',
    text: 'Veja a distribuição da sua carteira lado a lado com a alocação média dos usuários. Ajuda a revisar setores e tipos de ativo.',
  },
  {
    icon: Lightbulb,
    title: 'Insights para diversificação',
    text: 'Use os rankings como referência para encontrar oportunidades e equilibrar sua carteira com base no que o mercado está fazendo.',
  },
]

function BlocoTelaPremium({
  icon: Icon,
  titulo,
  subtitulo,
  steps,
  beneficios,
  ctaTexto,
}: {
  icon: ElementType
  titulo: string
  subtitulo: string
  steps: { icon: ElementType; title: string; text: string }[]
  beneficios: string[]
  ctaTexto: string
}) {
  const { logout, canAccessScreen } = useAuth()
  const firstAllowed = TELAS_APP.find((t) => canAccessScreen(t.path))?.path ?? '/'

  return (
    <div className="min-h-[80vh] flex flex-col">
      <div className="flex-1 container max-w-2xl mx-auto px-4 py-8 sm:py-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="text-center mb-8"
        >
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ repeat: Infinity, duration: 2.5 }}
            className="inline-flex p-4 rounded-2xl bg-primary/10 dark:bg-primary/20 text-primary mb-6"
          >
            <Icon className="w-14 h-14 sm:w-16 sm:h-16" />
          </motion.div>
          <motion.span
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="inline-block text-sm font-medium text-primary mb-2"
          >
            Conteúdo Premium
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="text-2xl sm:text-3xl font-bold text-foreground mb-2"
          >
            {titulo}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="text-muted-foreground max-w-lg mx-auto"
          >
            {subtitulo}
          </motion.p>
        </motion.div>

        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="space-y-4 mb-10"
        >
          <motion.h2 variants={item} className="text-lg font-semibold text-foreground flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Como funcionaria para você
          </motion.h2>
          {steps.map((step) => (
            <motion.div
              key={step.title}
              variants={item}
              className="flex gap-4 p-4 rounded-xl border border-border dark:border-white/20 bg-card hover:border-primary/30 transition-colors duration-300"
            >
              <div className="flex-shrink-0 p-2.5 rounded-lg bg-primary/10 text-primary">
                <step.icon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.text}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="rounded-xl border border-border dark:border-white/20 bg-muted/30 dark:bg-white/[0.04] p-5 mb-10"
        >
          <p className="text-sm font-medium text-foreground mb-3">Com o Premium você tem:</p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {beneficios.map((line) => (
              <li key={line} className="flex items-center gap-2">
                <Check className="w-4 h-4 text-primary flex-shrink-0" />
                {line}
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="flex flex-col sm:flex-row flex-wrap gap-3 justify-center"
        >
          <Link to="/vendas">
            <motion.span
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold shadow-lg shadow-primary/25 ring-2 ring-primary/40 ring-offset-2 ring-offset-background dark:ring-offset-background"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
            >
              <Sparkles className="w-5 h-5" />
              {ctaTexto}
            </motion.span>
          </Link>
          {firstAllowed && canAccessScreen(firstAllowed) && (
            <Link to={firstAllowed}>
              <motion.span
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border-2 border-border hover:bg-muted font-medium"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Home className="w-4 h-4" />
                Voltar ao início
              </motion.span>
            </Link>
          )}
          <button
            type="button"
            onClick={() => logout()}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-border hover:bg-muted text-muted-foreground"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </motion.div>
      </div>
    </div>
  )
}

export default function AcessoNegadoPage() {
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from
  const { logout, canAccessScreen } = useAuth()
  const firstAllowed = TELAS_APP.find((t) => canAccessScreen(t.path))?.path ?? '/'
  const isAnalise = from === '/analise'
  const isAgendaDividendos = from === '/agenda-dividendos'
  const isRankings = from === '/rankings'

  if (isAnalise) {
    return (
      <BlocoTelaPremium
        icon={BarChart3}
        titulo="Análise de Oportunidades"
        subtitulo="Esta tela é exclusiva para assinantes premium. Veja como ela funciona e o que você ganha com acesso."
        steps={analiseSteps}
        beneficios={[
          'Filtros por tipo (ações, FIIs, BDRs), dividend yield, P/VPA, liquidez e mais',
          'Lista ranqueada com indicadores fundamentais e técnicos',
          'Comparação lado a lado entre ativos',
          'Exportação e acompanhamento dos que mais interessam',
        ]}
        ctaTexto="Quero ter acesso à Análise"
      />
    )
  }

  if (isAgendaDividendos) {
    return (
      <BlocoTelaPremium
        icon={CalendarDays}
        titulo="Agenda de Dividendos"
        subtitulo="Esta tela é exclusiva para assinantes premium. Veja como ela funciona e o que você ganha com acesso."
        steps={agendaDividendosSteps}
        beneficios={[
          'Calendário mensal e anual de dividendos e JCP',
          'Proventos por ativo, data de pagamento e valor estimado',
          'Filtros por tipo de ativo e período',
          'Previsão de rendimento passivo',
        ]}
        ctaTexto="Quero ter acesso à Agenda de Dividendos"
      />
    )
  }

  if (isRankings) {
    return (
      <BlocoTelaPremium
        icon={Trophy}
        titulo="Rankings"
        subtitulo="Esta tela é exclusiva para assinantes premium. Veja como ela funciona e o que você ganha com acesso."
        steps={rankingsSteps}
        beneficios={[
          'Rankings por volume de investidores e valor aplicado',
          'Top ativos em ações, FIIs e BDRs',
          'Comparação da sua alocação com a média do mercado',
          'Insights para diversificação',
        ]}
        ctaTexto="Quero ter acesso aos Rankings"
      />
    )
  }

  /* Genérico: conteúdo exclusivo (outras telas bloqueadas) */
  return (
    <div className="min-h-[70vh] flex flex-col justify-center">
      <div className="container max-w-md mx-auto px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ repeat: Infinity, duration: 2.5 }}
            className="inline-flex p-4 rounded-2xl bg-primary/10 dark:bg-primary/20 text-primary mb-6"
          >
            <Crown className="w-14 h-14 sm:w-16 sm:h-16" />
          </motion.div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Conteúdo exclusivo</h1>
          <p className="text-muted-foreground mb-8">
            Este conteúdo está disponível apenas para usuários premium. Entre em contato com o administrador para liberar acesso.
          </p>
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 justify-center">
            <Link to="/vendas">
              <motion.span
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
              >
                <Sparkles className="w-4 h-4" />
                Conhecer plano premium
              </motion.span>
            </Link>
            {firstAllowed && canAccessScreen(firstAllowed) && (
              <Link to={firstAllowed} className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-muted">
                <Home className="w-4 h-4" />
                Ir para o início
              </Link>
            )}
            <button
              type="button"
              onClick={() => logout()}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-muted"
            >
              <LogOut className="w-4 h-4" />
              Sair
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
