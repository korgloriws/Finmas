import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, useScroll, useTransform } from 'framer-motion'
import {
  Crown,
  Check,
  ArrowRight,
  Sparkles,
  TrendingUp,
  ArrowLeft,
  Sun,
  Moon,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import FinmasLogo from '../components/FinmasLogo'
import {
  TELAS_PREMIUM,
  PRECO_MENSAL,
  PRECO_ANUAL_TOTAL,
  PRECO_ANUAL_MES,
  formatarMoedaMarketing,
  GMAIL_SUPORTE,
  VENDAS_HERO_PILLS,
  PLANO_MENSAL_ITENS,
  PLANO_ANUAL_ITENS,
} from '../content/marketingContent'

/** @deprecated use TELAS_PREMIUM from marketingContent — mantido para compatibilidade com referências externas */
export const telasPremium = TELAS_PREMIUM

const fadeInUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-40px' },
  transition: { duration: 0.5 },
}

export default function VendasPage() {
  const { user } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  })

  // Parallax: elementos de fundo movem mais devagar que o scroll
  const parallaxBg = useTransform(scrollYProgress, [0, 0.5, 1], ['0%', '-15%', '-25%'])
  const parallaxHero = useTransform(scrollYProgress, [0, 0.2], ['0%', '12%'])
  const opacityBg = useTransform(scrollYProgress, [0, 0.3], [1, 0.4])

  return (
    <div ref={containerRef} className="h-full min-h-screen overflow-auto overflow-x-hidden bg-background text-foreground">
      {/* Header */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
        className={`border-b border-border sticky top-0 z-10 w-full ${
          isDark ? 'bg-black' : 'bg-card'
        }`}
      >
        {/* Mobile: mesmo posicionamento do cabeçalho da home (Layout) — px-4 py-3, logo ao centro */}
        <div className="md:hidden px-4 py-3 flex items-center justify-between">
          <div className="flex-1 min-w-0" aria-hidden />
          <Link to="/" className="flex items-center justify-center flex-shrink-0 text-foreground hover:opacity-90 transition-opacity">
            <FinmasLogo size="sm" showText={false} />
          </Link>
          <div className="flex items-center gap-1 flex-1 justify-end min-w-0">
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded hover:bg-accent text-muted-foreground"
              aria-label={isDark ? 'Usar tema claro' : 'Usar tema escuro'}
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            {user ? (
              <Link to="/" className="px-3 py-2 rounded-lg border border-border hover:bg-muted text-sm font-medium flex items-center gap-1.5">
                <ArrowLeft className="w-4 h-4" />
                Sair
              </Link>
            ) : (
              <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground px-2 py-1">
                Já tenho conta
              </Link>
            )}
          </div>
        </div>
        {/* Desktop */}
        <div className="hidden md:flex w-full px-6 lg:px-12 py-4 items-center justify-between gap-3">
          <Link to="/" className="flex items-center text-foreground hover:opacity-90 transition-opacity duration-300">
            <FinmasLogo size="sm" showText={false} />
          </Link>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2.5 rounded-lg border border-border bg-background hover:bg-muted hover:border-primary/30 text-foreground transition-all duration-300"
              aria-label={isDark ? 'Usar tema claro' : 'Usar tema escuro'}
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            {user ? (
              <Link
                to="/"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-muted hover:border-primary/30 text-sm font-medium transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
              >
                <ArrowLeft className="w-4 h-4" />
                Finalizar depois
              </Link>
            ) : (
              <Link
                to="/login"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-300"
              >
                Já tenho conta
              </Link>
            )}
          </div>
        </div>
      </motion.header>

      <main>
        {/* Hero – foco em conversão: destaque, animações e copy persuasivo */}
        <section className="relative min-h-[85vh] flex items-center overflow-hidden bg-gradient-to-b from-background via-background to-muted/20 dark:to-white/[0.03]">
          {/* Fundo com mais presença */}
          <motion.div
            style={{ y: parallaxBg, opacity: opacityBg }}
            className="absolute inset-0 pointer-events-none"
          >
            <div className="absolute top-1/4 -left-32 w-96 h-96 rounded-full bg-primary/15 dark:bg-primary/25 blur-3xl" />
            <div className="absolute bottom-1/4 -right-32 w-[28rem] h-[28rem] rounded-full bg-primary/10 dark:bg-primary/20 blur-3xl" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/[0.06] dark:bg-primary/15 blur-3xl" />
          </motion.div>
          <div className="absolute inset-0 bg-gradient-to-b from-primary/10 dark:from-primary/20 via-transparent to-transparent pointer-events-none" />

          <div className="container max-w-5xl mx-auto px-4 pt-16 pb-20 sm:pt-20 sm:pb-28 relative">
            <motion.div
              style={{ y: parallaxHero }}
              className="text-center max-w-3xl mx-auto"
            >
              {/* Badge – entra primeiro */}
              <motion.div
                initial={{ opacity: 0, y: 16, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.15, duration: 0.5 }}
                className="mb-8"
              >
                <motion.span
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary/15 dark:bg-primary/25 text-primary font-semibold text-sm border border-primary/20 dark:border-primary/30 shadow-lg shadow-primary/10"
                  whileHover={{ scale: 1.02 }}
                >
                  <Sparkles className="w-4 h-4" />
                  Plano Premium
                </motion.span>
              </motion.div>

              {/* Título principal – grande e impactante */}
              <motion.h1
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.6 }}
                className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground mb-6 leading-[1.1]"
              >
                Invista com mais
                <br />
                <span className="bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
                  confiança e controle
                </span>
              </motion.h1>

              {/* Subtítulo – benefício + preço */}
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.5 }}
                className="text-xl sm:text-2xl text-muted-foreground mb-4 max-w-2xl mx-auto font-medium"
              >
                Análise, dividendos, notícias, comparativo vs índices, impostos e projeção da carteira em um só lugar.
              </motion.p>
              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.65, duration: 0.5 }}
                className="text-lg text-primary font-semibold mb-10"
              >
                A partir de {formatarMoedaMarketing(PRECO_ANUAL_MES)}/mês no plano anual
              </motion.p>

              {/* Pills de destaque */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 0.4 }}
                className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-10"
              >
                {VENDAS_HERO_PILLS.map((label, i) => (
                  <motion.span
                    key={label}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.9 + i * 0.06, duration: 0.35 }}
                    className="px-4 py-2 rounded-lg bg-card/80 dark:bg-card/60 border border-border text-sm font-medium text-foreground shadow-sm"
                  >
                    {label}
                  </motion.span>
                ))}
              </motion.div>

              {/* CTA principal */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.1, duration: 0.5 }}
                className="flex flex-col sm:flex-row items-center justify-center gap-4"
              >
                <a href="#planos">
                  <motion.span
                    className="inline-flex items-center justify-center gap-2 px-10 py-5 rounded-xl bg-primary text-primary-foreground font-bold text-lg shadow-xl shadow-primary/30 ring-2 ring-primary/40 ring-offset-2 ring-offset-background dark:ring-offset-background"
                    whileHover={{ scale: 1.05, boxShadow: '0 24px 48px -12px hsl(var(--primary) / 0.5)' }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Ver planos e valores
                    <ArrowRight className="w-5 h-5" />
                  </motion.span>
                </a>
                <span className="text-sm text-muted-foreground">Sem compromisso · Cancele quando quiser</span>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* O que você ganha no Premium – única seção, fonte: telasPremium */}
        <section className="relative py-20 sm:py-24 border-t border-border dark:border-white/20 bg-muted/30 dark:bg-white/[0.06] overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.06] dark:from-primary/10 via-transparent to-transparent pointer-events-none" />
          <div className="container max-w-5xl mx-auto px-4 relative">
            <motion.div className="text-center mb-14" {...fadeInUp}>
              <span className="text-primary font-medium text-sm uppercase tracking-wider">Exclusivo Premium</span>
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mt-2 mb-3">
                O que você ganha no Premium
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto text-base">
                Com o plano premium você tem acesso a todas as telas abaixo, além de todo o resto do app.
              </p>
            </motion.div>
            <div className="grid md:grid-cols-3 gap-6">
              {TELAS_PREMIUM.map((tela, i) => (
                <motion.div
                  key={tela.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-30px' }}
                  transition={{ duration: 0.4, delay: i * 0.06 }}
                  whileHover={{ y: -6, transition: { duration: 0.2 } }}
                  className="group p-6 rounded-2xl border border-border dark:border-white/20 bg-card/95 dark:bg-card/90 backdrop-blur-sm hover:border-primary/50 hover:shadow-xl hover:shadow-primary/10 dark:hover:shadow-primary/20 transition-all duration-300"
                >
                  <div className="p-3 rounded-xl bg-primary/10 w-fit mb-4 group-hover:bg-primary/20 group-hover:scale-105 transition-all duration-300">
                    <tela.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-bold text-foreground mb-2">{tela.titulo}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{tela.desc}</p>
                  <ul className="space-y-2">
                    {tela.itens.map((item, j) => (
                      <li key={j} className="flex items-start gap-2 text-sm text-foreground">
                        <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Preços */}
        <section id="planos" className="relative py-20 sm:py-24 bg-background border-t border-border dark:border-white/20 overflow-hidden">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 dark:via-primary/10 to-primary/10 dark:to-primary/20 pointer-events-none"
          />
          <div className="container max-w-5xl mx-auto px-4 relative">
            <motion.div className="text-center mb-12" {...fadeInUp}>
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
                Escolha seu plano
              </h2>
              <p className="text-muted-foreground">
                Acesso completo às ferramentas premium. Cancele quando quiser.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
              {/* Mensal */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4 }}
                whileHover={{ y: -6, boxShadow: '0 20px 40px -15px hsl(var(--border))' }}
                className="relative p-6 sm:p-8 rounded-2xl border-2 border-border dark:border-white/25 bg-card flex flex-col"
              >
                <div className="mb-6">
                  <span className="text-sm font-medium text-muted-foreground">Mensal</span>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-foreground">
                      {formatarMoedaMarketing(PRECO_MENSAL)}
                    </span>
                    <span className="text-muted-foreground">/mês</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">Cobrança mensal</p>
                </div>
                <ul className="space-y-3">
                  {PLANO_MENSAL_ITENS.map((x) => (
                    <li key={x} className="flex items-center gap-2 text-sm text-foreground">
                      <Check className="w-4 h-4 text-primary flex-shrink-0" />
                      {x}
                    </li>
                  ))}
                </ul>
              </motion.div>

              {/* Anual - Destaque */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.1 }}
                whileHover={{ y: -6, boxShadow: '0 24px 48px -12px hsl(var(--primary) / 0.25)' }}
                className="relative p-6 sm:p-8 rounded-2xl border-2 border-primary bg-card shadow-lg shadow-primary/10 flex flex-col"
              >
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" />
                  10% de desconto
                </div>
                <div className="mb-6">
                  <span className="text-sm font-medium text-primary">Anual</span>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-foreground">
                      {formatarMoedaMarketing(PRECO_ANUAL_MES)}
                    </span>
                    <span className="text-muted-foreground">/mês</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {formatarMoedaMarketing(PRECO_ANUAL_TOTAL)}/ano · Economize {formatarMoedaMarketing(PRECO_MENSAL * 12 - PRECO_ANUAL_TOTAL)}
                  </p>
                </div>
                <ul className="space-y-3">
                  {PLANO_ANUAL_ITENS.map((x) => (
                    <li key={x} className="flex items-center gap-2 text-sm text-foreground">
                      <Check className="w-4 h-4 text-primary flex-shrink-0" />
                      {x}
                    </li>
                  ))}
                </ul>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.15 }}
              className="mt-10 flex justify-center"
            >
              <a href={GMAIL_SUPORTE} target="_blank" rel="noopener noreferrer">
                <motion.span
                  className="inline-flex items-center justify-center gap-2 px-10 py-5 rounded-xl bg-primary text-primary-foreground font-semibold text-lg shadow-xl shadow-primary/30 ring-2 ring-primary/40 ring-offset-2 ring-offset-background dark:ring-offset-background"
                  whileHover={{ scale: 1.03, boxShadow: '0 24px 48px -12px hsl(var(--primary) / 0.45)' }}
                  whileTap={{ scale: 0.98 }}
                >
                  Contatar agora
                  <ArrowRight className="w-5 h-5" />
                </motion.span>
              </a>
            </motion.div>
          </div>
        </section>

        {/* CTA final */}
        <section className="relative py-20 sm:py-24 border-t border-border dark:border-white/20 bg-gradient-to-b from-muted/40 dark:from-white/[0.06] via-primary/5 dark:via-primary/10 to-background overflow-hidden">
          <div className="container max-w-5xl mx-auto px-4 text-center relative">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="inline-flex p-4 rounded-2xl bg-primary/10 text-primary mb-6"
            >
              <Crown className="w-12 h-12" />
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-2xl font-bold text-foreground mb-2"
            >
              Pronto para ter acesso a tudo?
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-muted-foreground mb-8 max-w-md mx-auto"
            >
              Crie sua conta ou faça login e fale com o administrador para ativar o plano premium.
            </motion.p>
            <a href={GMAIL_SUPORTE} target="_blank" rel="noopener noreferrer">
              <motion.span
                className="inline-flex items-center justify-center gap-2 px-10 py-5 rounded-xl bg-primary text-primary-foreground font-semibold text-lg shadow-xl shadow-primary/30 ring-2 ring-primary/40 ring-offset-2 ring-offset-background dark:ring-offset-background"
                whileHover={{ scale: 1.05, boxShadow: '0 24px 48px -12px hsl(var(--primary) / 0.45)' }}
                whileTap={{ scale: 0.98 }}
              >
                Contatar agora
                <ArrowRight className="w-5 h-5" />
              </motion.span>
            </a>
          </div>
        </section>
      </main>

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
