import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Sun, Moon } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import FinmasLogo from '../components/FinmasLogo'

const PoliticaPrivacidadePage = () => {
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
          Última atualização: março de 2026. Esta política descreve como o Finmas trata seus dados pessoais.
        </p>

        <article className="prose prose-sm dark:prose-invert max-w-none">
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-foreground mb-3">1. Dados coletados</h2>
            <p className="text-muted-foreground leading-relaxed mb-2">
              O Finmas pode coletar e processar os seguintes dados:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1 mb-4">
              <li><strong className="text-foreground">Cadastro e conta:</strong> nome, e-mail (ou identificador de login), senha (armazenada de forma segura e irreversível), pergunta e resposta de segurança.</li>
              <li><strong className="text-foreground">Uso do serviço:</strong> dados financeiros e de investimentos que você insere (carteira, lançamentos, ativos, transações), preferências e configurações da conta.</li>
              <li><strong className="text-foreground">Técnicos:</strong> endereço IP, tipo de navegador, páginas visitadas e horários de acesso, para operação e segurança do sistema.</li>
              <li><strong className="text-foreground">Login com terceiros:</strong> ao usar login social (ex.: Google), recebemos o identificador e, conforme permissão, nome e e-mail vinculados àquele provedor.</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed">
              Não vendemos seus dados pessoais. Dados inseridos por você (carteira, lançamentos etc.) são usados apenas para exibir e calcular informações dentro do seu uso do Finmas.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-foreground mb-3">2. Finalidade</h2>
            <p className="text-muted-foreground leading-relaxed mb-2">
              Os dados são utilizados para:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1 mb-4">
              <li>Prestar, manter e melhorar o serviço (controle financeiro, carteira, relatórios, ferramentas).</li>
              <li>Identificar você e garantir a segurança da sua conta (autenticação, recuperação de senha).</li>
              <li>Cumprir obrigações legais e regulatórias e responder a requisições de autoridades.</li>
              <li>Comunicar alterações importantes do serviço ou desta política, quando necessário.</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-foreground mb-3">3. Base legal</h2>
            <p className="text-muted-foreground leading-relaxed mb-2">
              O tratamento dos dados pessoais pelo Finmas tem as seguintes bases legais, nos termos da Lei Geral de Proteção de Dados (LGPD – Lei nº 13.709/2018):
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1 mb-4">
              <li><strong className="text-foreground">Execução de contrato:</strong> para fornecer o serviço contratado ou solicitado por você.</li>
              <li><strong className="text-foreground">Consentimento:</strong> quando aplicável (ex.: envio de comunicações de marketing, quando oferecido).</li>
              <li><strong className="text-foreground">Legítimo interesse:</strong> para operação, segurança e melhoria do serviço, dentro dos limites da lei.</li>
              <li><strong className="text-foreground">Obrigação legal:</strong> quando necessário para cumprir lei ou ordem de autoridade.</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-foreground mb-3">4. Retenção</h2>
            <p className="text-muted-foreground leading-relaxed mb-2">
              Mantemos seus dados pelo tempo necessário para as finalidades descritas e para cumprimento de obrigações legais. Em regra:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1 mb-4">
              <li>Dados da conta e do uso do serviço são mantidos enquanto a conta estiver ativa e, após encerramento, pelo período exigido por lei ou para defesa de direitos.</li>
              <li>Dados técnicos e de acesso podem ser armazenados por período limitado para segurança e auditoria.</li>
              <li>Após a exclusão da conta ou pedido de exclusão de dados, os dados são removidos ou anonimizados, salvo retenção legal ou contratual.</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-foreground mb-3">5. Direitos do titular</h2>
            <p className="text-muted-foreground leading-relaxed mb-2">
              Nos termos da LGPD, você tem direito a:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1 mb-4">
              <li><strong className="text-foreground">Acesso:</strong> confirmar se tratamos seus dados e obter cópia ou informação sobre o tratamento.</li>
              <li><strong className="text-foreground">Correção:</strong> corrigir dados incompletos, desatualizados ou incorretos (muitos deles podem ser alterados nas configurações da conta).</li>
              <li><strong className="text-foreground">Exclusão:</strong> solicitar a exclusão dos dados tratados com base em consentimento ou quando a lei permitir, observadas as exceções legais.</li>
              <li><strong className="text-foreground">Portabilidade:</strong> solicitar a portabilidade dos dados a outro fornecedor de serviço, quando aplicável.</li>
              <li>Além disso: revogar consentimento (quando o tratamento for baseado em consentimento), obter informações sobre com quem compartilhamos dados e apresentar reclamação à autoridade nacional (ANPD).</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed">
              Para exercer esses direitos, utilize o canal de contato indicado na seção &quot;Contato do encarregado&quot; abaixo.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-foreground mb-3">6. Contato do encarregado</h2>
            <p className="text-muted-foreground leading-relaxed mb-2">
              Para questões sobre privacidade, exercício de direitos de titular ou para comunicar o encarregado de dados (DPO), entre em contato:
            </p>
            <ul className="list-none pl-0 text-muted-foreground space-y-1 mb-4">
              <li><strong className="text-foreground">E-mail:</strong> finmasfinanceiro@gmail.com</li>
              <li><strong className="text-foreground">Assunto sugerido:</strong> &quot;Privacidade / LGPD&quot; ou &quot;Direitos do titular&quot;</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed">
              Responderemos em prazo razoável, conforme previsto na LGPD. Alterações relevantes nesta política serão comunicadas pelo site ou pelo aplicativo.
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
            <Link to="/termos-de-uso" className="text-primary hover:underline">Termos de Uso</Link>
            <Link to="/" className="text-primary hover:underline">Voltar ao início</Link>
          </p>
        </div>
      </motion.footer>
    </div>
  )
}

export default PoliticaPrivacidadePage
