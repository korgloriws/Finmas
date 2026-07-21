import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, useScroll, useTransform } from 'framer-motion'
import {
  Wallet,
  Calculator,
  BookOpen,
  Target,
  ArrowRight,
  Check,
  Moon,
  Sun,
} from 'lucide-react'
import FinmasLogo from '../components/FinmasLogo'
import { useTheme } from '../contexts/ThemeContext'
import {
  LANDING_FEATURES,
  LANDING_TARGET_AUDIENCE,
  LANDING_PREMIUM_HIGHLIGHTS,
  SEO_TITLE,
  SEO_DESCRIPTION,
} from '../content/marketingContent'

const fadeInUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-40px' },
  transition: { duration: 0.5 },
}

export default function LandingPage() {
  const { isDark, toggleTheme } = useTheme()
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  })
  const parallaxBg = useTransform(scrollYProgress, [0, 0.5, 1], ['0%', '-15%', '-25%'])
  const parallaxHero = useTransform(scrollYProgress, [0, 0.2], ['0%', '12%'])
  const opacityBg = useTransform(scrollYProgress, [0, 0.3], [1, 0.4])

  useEffect(() => {
    document.title = SEO_TITLE
    const metaDesc = document.querySelector('meta[name="description"]')
    if (metaDesc) metaDesc.setAttribute('content', SEO_DESCRIPTION)
    return () => {
      document.title = 'Finmas - Gestão Financeira'
    }
  }, [])

  return (
    <div ref={containerRef} className="h-full min-h-screen overflow-auto overflow-x-hidden bg-background text-foreground">
      {/* Header — estilo Vendas: animação de entrada + hover */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
        className={`border-b border-border sticky top-0 z-50 w-full ${
          isDark ? 'bg-black' : 'bg-card'
        }`}
      >
        {/* Mobile: mesmo posicionamento do cabeçalho da home (Layout) — px-4 py-3, logo ao centro */}
        <div className="md:hidden px-4 py-3 flex items-center justify-between">
          <div className="flex-1 min-w-0" aria-hidden />
          <Link to="/" className="flex items-center justify-center flex-shrink-0" aria-label="Finmas início">
            <FinmasLogo size="sm" showText={false} />
          </Link>
          <div className="flex items-center gap-1 flex-1 justify-end min-w-0">
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded hover:bg-accent text-muted-foreground"
              aria-label={isDark ? 'Modo claro' : 'Modo escuro'}
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <Link
              to="/login"
              className="px-3 py-2 rounded-lg border border-border hover:bg-muted text-sm font-medium"
            >
              Entrar
            </Link>
          </div>
        </div>
        {/* Desktop: logo + tagline à esquerda, botões à direita */}
        <div className="hidden md:flex w-full px-6 lg:px-12 py-4 items-center justify-between gap-3">
          <Link to="/" className="flex flex-col items-start gap-0.5 group" aria-label="Finmas início">
            <FinmasLogo size="sm" showText={false} />
            <span className="text-sm lg:text-base font-semibold text-foreground tracking-tight leading-tight border-l-2 border-primary pl-2 opacity-90 group-hover:opacity-100 transition-all duration-300">
              Sistema de controle financeiro para investidores
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2.5 rounded-lg border border-border bg-background hover:bg-muted hover:border-primary/30 text-foreground transition-all duration-300"
              aria-label={isDark ? 'Modo claro' : 'Modo escuro'}
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-muted hover:border-primary/30 text-sm font-medium transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
            >
              Entrar
            </Link>
          </div>
        </div>
      </motion.header>

      {/* Hero — gradiente, parallax, animações em sequência */}
      <section className="relative min-h-[85vh] flex items-center overflow-hidden bg-gradient-to-b from-background via-background to-muted/20 dark:to-white/[0.03]">
        <motion.div style={{ y: parallaxBg, opacity: opacityBg }} className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 -left-32 w-96 h-96 rounded-full bg-primary/15 dark:bg-primary/25 blur-3xl" />
          <div className="absolute bottom-1/4 -right-32 w-[28rem] h-[28rem] rounded-full bg-primary/10 dark:bg-primary/20 blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/[0.06] dark:bg-primary/15 blur-3xl" />
        </motion.div>
        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 dark:from-primary/20 via-transparent to-transparent pointer-events-none" />

        <div className="container max-w-5xl mx-auto px-4 pt-16 pb-20 sm:pt-20 sm:pb-28 relative">
          <motion.div style={{ y: parallaxHero }} className="text-center max-w-3xl mx-auto">
            <motion.h1
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight mb-6 leading-[1.1]"
            >
              Carteira de investimentos e
              <br />
              <span className="bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
                controle financeiro em um só lugar
              </span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto mb-6 leading-relaxed font-medium"
            >
              Pensado para quem investe: centralize sua carteira, compare a evolução com índices (IBOV, IVVB11, IFIX, IPCA, CDI, Bitcoin), controle receitas e despesas com saldo mensal coerente e use gratuitamente o guia do mercado (com módulo fiscal) e o hub de calculadoras.
            </motion.p>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55, duration: 0.5 }}
              className="text-base sm:text-lg text-muted-foreground/90 max-w-2xl mx-auto mb-10"
            >
              Tenha visão clara do que você tem e para onde vai seu dinheiro — sem planilhas soltas.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.5 }}
              className="flex flex-col sm:flex-row gap-4 justify-center"
            >
              <Link to="/login">
                <motion.span
                  className="inline-flex items-center justify-center gap-2 px-10 py-5 rounded-xl bg-primary text-primary-foreground font-bold text-lg shadow-xl shadow-primary/30 ring-2 ring-primary/40 ring-offset-2 ring-offset-background dark:ring-offset-background"
                  whileHover={{ scale: 1.05, boxShadow: '0 24px 48px -12px hsl(var(--primary) / 0.5)' }}
                  whileTap={{ scale: 0.98 }}
                >
                  Começar agora
                  <ArrowRight size={20} />
                </motion.span>
              </Link>
              <Link to="/conhecer">
                <motion.span
                  className="inline-flex items-center justify-center gap-2 px-10 py-5 rounded-xl border-2 border-border bg-card font-semibold text-lg hover:bg-accent hover:border-primary/40 transition-colors duration-300"
                  whileHover={{ scale: 1.03, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Conhecer o sistema
                </motion.span>
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Destaques — animação de entrada + hover */}
      <section className="relative border-y border-border dark:border-white/20 bg-muted/30 dark:bg-white/[0.06] py-14 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.06] dark:from-primary/10 via-transparent to-transparent pointer-events-none" />
        <div className="container max-w-5xl mx-auto px-4 relative">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { icon: Wallet, text: 'Carteira + comparativo índices' },
              { icon: Calculator, text: 'Investimentos e finanças juntos' },
              { icon: BookOpen, text: 'Guia e calculadoras grátis' },
              { icon: Target, text: 'Feito para investidores' },
            ].map(({ icon: Icon, text }, i) => (
              <motion.div
                key={text}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-30px' }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="flex flex-col items-center gap-3 p-4 rounded-2xl border border-border dark:border-white/20 bg-card/80 dark:bg-card/70 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 transition-all duration-300"
              >
                <motion.span className="p-3 rounded-xl bg-primary/10 text-primary" whileHover={{ scale: 1.1 }}>
                  <Icon className="w-8 h-8" aria-hidden />
                </motion.span>
                <span className="text-sm font-semibold text-foreground">{text}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Funções do sistema — cards com animação e hover estilo Vendas */}
      <section className="relative py-20 sm:py-24 border-t border-border dark:border-white/20 bg-muted/20 dark:bg-white/[0.04] overflow-hidden" id="funcionalidades">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.04] dark:from-primary/5 via-transparent to-transparent pointer-events-none" />
        <div className="container max-w-5xl mx-auto px-4 relative">
          <motion.div className="text-center mb-14" {...fadeInUp}>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">
              O que o Finmas oferece
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-base sm:text-lg">
              Explicação detalhada de cada função do sistema para você aproveitar ao máximo.
            </p>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {LANDING_FEATURES.map(({ icon: Icon, title, description, details, badge }, i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-30px' }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                whileHover={{ y: -6, transition: { duration: 0.2 } }}
                className="group p-6 rounded-2xl border border-border dark:border-white/20 bg-card/95 dark:bg-card/90 backdrop-blur-sm hover:border-primary/50 hover:shadow-xl hover:shadow-primary/10 dark:hover:shadow-primary/20 flex flex-col transition-all duration-300"
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <motion.span className="p-2.5 rounded-xl bg-primary/10 text-primary group-hover:bg-primary/20 group-hover:scale-105 transition-all duration-300 shrink-0">
                      <Icon size={22} />
                    </motion.span>
                    <h3 className="text-lg font-bold text-foreground">{title}</h3>
                  </div>
                  {badge && (
                    <span className="text-[10px] uppercase tracking-wide font-semibold px-2 py-1 rounded-full bg-muted text-muted-foreground shrink-0">
                      {badge}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">{description}</p>
                {details && details.length > 0 && (
                  <ul className="mt-auto space-y-1.5 text-sm text-muted-foreground">
                    {details.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <Check size={14} className="mt-0.5 flex-shrink-0 text-primary" aria-hidden />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Público-alvo — cards com entrada e hover */}
      <section className="relative border-t border-border dark:border-white/20 bg-muted/30 dark:bg-white/[0.06] py-20 sm:py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.06] dark:from-primary/10 via-transparent to-transparent pointer-events-none" />
        <div className="container max-w-5xl mx-auto px-4 relative">
          <motion.div className="text-center mb-12" {...fadeInUp}>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">
              Para quem é o Finmas
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-base sm:text-lg">
              O sistema serve a investidores de todos os níveis que querem ordem nas finanças e nos investimentos — da organização da carteira ao controle do fluxo de caixa.
            </p>
          </motion.div>
          <ul className="grid sm:grid-cols-2 max-w-4xl mx-auto gap-6 text-left list-none p-0 m-0">
            {LANDING_TARGET_AUDIENCE.map(({ title, description }, i) => (
              <li key={title}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-30px' }}
                  transition={{ duration: 0.4, delay: i * 0.08 }}
                  whileHover={{ y: -4, transition: { duration: 0.2 } }}
                  className="flex items-start gap-3 p-5 rounded-2xl bg-card/95 dark:bg-card/90 border border-border dark:border-white/20 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/10 transition-all duration-300"
                >
                  <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" aria-hidden />
                  <div>
                    <span className="font-bold text-foreground block mb-1 text-base">{title}</span>
                    <span className="text-sm text-muted-foreground leading-relaxed">{description}</span>
                  </div>
                </motion.div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Funções premium + CTA Vendas — destaque com animação e hover */}
      <section className="relative py-20 sm:py-24 border-t border-border dark:border-white/20 overflow-hidden" id="premium">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 dark:from-primary/10 via-transparent to-transparent pointer-events-none" />
        <div className="container max-w-5xl mx-auto px-4 relative">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.5 }}
            className="max-w-3xl mx-auto text-center p-8 sm:p-12 rounded-3xl border-2 border-primary/30 dark:border-primary/40 bg-primary/5 dark:bg-primary/10 shadow-xl shadow-primary/10 dark:shadow-primary/20 hover:shadow-2xl hover:shadow-primary/20 hover:border-primary/50 transition-all duration-300"
          >
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">
              Funções premium
            </h2>
            <p className="text-muted-foreground mb-8 text-base sm:text-lg">
              Além das ferramentas gratuitas e da carteira básica, assinantes têm acesso a:
            </p>
            <ul className="space-y-3 mb-10 text-left max-w-md mx-auto">
              {LANDING_PREMIUM_HIGHLIGHTS.map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-primary shrink-0" aria-hidden />
                  <span className="text-foreground">{item}</span>
                </li>
              ))}
            </ul>
            <Link to="/vendas">
              <motion.span
                className="inline-flex items-center justify-center gap-2 px-10 py-5 rounded-xl bg-primary text-primary-foreground font-bold text-lg shadow-xl shadow-primary/30"
                whileHover={{ scale: 1.05, boxShadow: '0 24px 48px -12px hsl(var(--primary) / 0.5)' }}
                whileTap={{ scale: 0.98 }}
              >
                Ver planos e assinar
                <ArrowRight size={20} />
              </motion.span>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* CTA final Login — animação e hover */}
      <section className="relative border-t border-border dark:border-white/20 py-20 sm:py-24 bg-muted/30 dark:bg-white/[0.06] overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.06] dark:from-primary/10 via-transparent to-transparent pointer-events-none" />
        <div className="container max-w-5xl mx-auto px-4 text-center relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">
              Pronto para começar?
            </h2>
            <p className="text-muted-foreground mb-10 max-w-xl mx-auto text-base sm:text-lg">
              Crie sua conta ou faça login para acessar sua carteira, ferramentas gratuitas e, se preferir, os recursos premium.
            </p>
            <Link to="/login">
              <motion.span
                className="inline-flex items-center justify-center gap-2 px-10 py-5 rounded-xl bg-primary text-primary-foreground font-bold text-lg shadow-xl shadow-primary/30"
                whileHover={{ scale: 1.05, boxShadow: '0 24px 48px -12px hsl(var(--primary) / 0.5)' }}
                whileTap={{ scale: 0.98 }}
              >
                Ir para a tela de login
                <ArrowRight size={20} />
              </motion.span>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer — mesmo estilo da página de vendas */}
      <motion.footer
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="border-t border-border dark:border-white/20 py-8 bg-card/50 dark:bg-white/[0.02]"
      >
        <div className="container max-w-5xl mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© Finmas 2026 - Seu Companheiro de Investimentos.</p>
          <p className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
            <Link to="/termos-de-uso" className="text-primary hover:underline">Termos de Uso</Link>
            <Link to="/politica-de-privacidade" className="text-primary hover:underline">Política de Privacidade</Link>
          </p>
        </div>
      </motion.footer>
    </div>
  )
}
