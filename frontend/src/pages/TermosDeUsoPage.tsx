import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Sun, Moon } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import FinmasLogo from '../components/FinmasLogo'

const TermosDeUsoPage = () => {
  const { isDark, toggleTheme } = useTheme()

  return (
    <div className="h-full min-h-screen overflow-auto bg-background text-foreground">
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
        className={`border-b border-border sticky top-0 z-10 w-full ${
          isDark ? 'bg-black' : 'bg-card'
        }`}
      >
        <div className="md:hidden px-4 py-3 flex items-center justify-between">
          <div className="flex-1 min-w-0" aria-hidden />
          <Link to="/" className="flex items-center justify-center flex-shrink-0 text-foreground hover:opacity-90 transition-opacity" aria-label="Finmas início">
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
          </div>
        </div>
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
          </div>
        </div>
      </motion.header>

      <main className="container max-w-3xl mx-auto px-4 py-8">
        <p className="text-sm text-muted-foreground mb-8">
          Última atualização: março de 2026. Ao utilizar o Finmas, você concorda com os termos abaixo.
        </p>

        <article className="prose prose-sm dark:prose-invert max-w-none">
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-foreground mb-3">1. Uso do serviço</h2>
            <p className="text-muted-foreground leading-relaxed mb-2">
              O Finmas é uma plataforma de controle financeiro e acompanhamento de investimentos. O uso do serviço é pessoal e não comercial. Você concorda a:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1 mb-4">
              <li>Fornecer informações verdadeiras no cadastro e mantê-las atualizadas.</li>
              <li>Manter a confidencialidade da sua senha e da sua conta.</li>
              <li>Não utilizar o serviço para fins ilegais ou que violem direitos de terceiros.</li>
              <li>Não tentar acessar dados de outros usuários nem interferir no funcionamento do sistema.</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed">
              Recursos gratuitos e premium estão sujeitos à disponibilidade e podem ser alterados conforme a evolução do produto.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-foreground mb-3">2. Responsabilidades</h2>
            <p className="text-muted-foreground leading-relaxed mb-2">
              O Finmas oferece ferramentas de organização e visualização de dados. Fica estabelecido que:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1 mb-4">
              <li>O Finmas não é uma instituição financeira, corretora ou consultoria de investimentos.</li>
              <li>Dados e cálculos exibidos têm caráter informativo e não constituem recomendação de compra, venda ou aplicação.</li>
              <li>O usuário é responsável por suas decisões financeiras e por conferir as informações que insere na plataforma.</li>
              <li>O Finmas empenha-se em manter a segurança e a disponibilidade do serviço, sem garantir ausência de falhas ou interrupções.</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed">
              Em nenhuma hipótese o Finmas será responsável por perdas financeiras ou indiretas decorrentes do uso ou da indisponibilidade do serviço.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-foreground mb-3">3. Cancelamento</h2>
            <p className="text-muted-foreground leading-relaxed mb-2">
              Você pode encerrar o uso do serviço a qualquer momento, deixando de acessar a plataforma ou solicitando a exclusão da conta nas configurações (quando disponível). O Finmas reserva-se o direito de:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1 mb-4">
              <li>Suspender ou encerrar contas que violem estes termos ou a lei.</li>
              <li>Interromper ofertas gratuitas ou planos pagos, com aviso prévio quando aplicável.</li>
              <li>Encerrar o serviço como um todo, com comunicação prévia aos usuários.</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed">
              Em planos pagos, o cancelamento da assinatura segue as regras da plataforma de pagamento utilizada (ex.: não renovação no próximo ciclo). Reembolsos estão sujeitos à política vigente no momento da contratação.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-foreground mb-3">4. Lei aplicável</h2>
            <p className="text-muted-foreground leading-relaxed mb-2">
              Estes Termos de Uso são regidos pelas leis da República Federativa do Brasil. Eventuais disputas relativas ao uso do Finmas serão submetidas ao foro da comarca do domicílio do usuário, com renúncia a qualquer outro, por mais privilegiado que seja.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              O Finmas pode alterar estes termos periodicamente. Alterações relevantes serão comunicadas por meio do site ou do aplicativo. O uso continuado do serviço após a publicação das mudanças constitui aceitação dos novos termos.
            </p>
          </section>
        </article>

      </main>

      <motion.footer
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="border-t border-border dark:border-white/20 py-8 bg-card/50 dark:bg-white/[0.02]"
      >
        <div className="container max-w-5xl mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© Finmas. Seu acompanhamento de investimentos em um só lugar.</p>
          <p className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
            <Link to="/politica-de-privacidade" className="text-primary hover:underline">Política de Privacidade</Link>
            <Link to="/" className="text-primary hover:underline">Voltar ao início</Link>
          </p>
        </div>
      </motion.footer>
    </div>
  )
}

export default TermosDeUsoPage
