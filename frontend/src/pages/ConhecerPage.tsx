import { Link } from 'react-router-dom'
import {
  Home,
  Search,
  Wallet,
  Calculator,
  BookOpen,
  BarChart3,
  Newspaper,
  Calendar,
  TrendingUp,
  DollarSign,
  Scale,
  Trophy,
  ArrowRight,
  Lock,
  Unlock,
} from 'lucide-react'

const TELAS: Array<{
  path: string
  label: string
  icon: typeof Home
  description: string
  requiresLogin: boolean
}> = [
  {
    path: '/',
    label: 'Home',
    icon: Home,
    requiresLogin: true,
    description: 'Seu painel principal: resumo do patrimônio, evolução da carteira, metas e indicadores em um só lugar. Gráficos de valorização, distribuição por tipo de ativo e visão rápida do que importa para suas decisões.',
  },
  {
    path: '/detalhes',
    label: 'Detalhes dos ativos',
    icon: Search,
    requiresLogin: false,
    description: 'Pesquise qualquer ativo e veja preço atual, histórico de cotações, fundamentos (P/L, P/VP, ROE, DY), dividendos e análise aprofundada. Assinantes têm acesso às abas Conceitos e Radar de Dividendos.',
  },
  {
    path: '/carteira',
    label: 'Carteira',
    icon: Wallet,
    requiresLogin: true,
    description: 'Central da sua carteira: acompanhe ações, FIIs, BDRs, ETFs, criptomoedas e renda fixa. Importe posições da B3, veja valorização por período, proventos, gráficos, rebalanceamento, impostos e projeções. Ajuste preços e registre vendas com poucos cliques.',
  },
  {
    path: '/controle',
    label: 'Controle Financeiro',
    icon: Calculator,
    requiresLogin: true,
    description: 'Organize receitas, despesas, cartões e fluxo de caixa. Acompanhe saldo, categorize gastos e tenha visão clara do que entra e sai. Ideal para quem quer finanças pessoais e investimentos na mesma ferramenta.',
  },
  {
    path: '/guia',
    label: 'Guia do Mercado',
    icon: BookOpen,
    requiresLogin: false,
    description: 'Conteúdo educativo sobre classes de ativos, riscos, diversificação e boas práticas. Acesso livre para você estudar e tomar decisões mais conscientes.',
  },
  {
    path: '/analise',
    label: 'Análise de oportunidades',
    icon: BarChart3,
    requiresLogin: true,
    description: 'Listas filtradas por tipo (ações, FIIs, BDRs), rankings, comparação com o mercado e gráficos para encontrar oportunidades. Use critérios e dados fundamentais para apoiar suas escolhas.',
  },
  {
    path: '/noticias',
    label: 'Notícias',
    icon: Newspaper,
    requiresLogin: true,
    description: 'Notícias do mercado reunidas para você se manter informado sem sair do sistema. Acompanhe o que impacta seus ativos e o cenário econômico.',
  },
  {
    path: '/agenda-dividendos',
    label: 'Agenda de Dividendos',
    icon: Calendar,
    requiresLogin: true,
    description: 'Calendário de proventos (dividendos, JCP, aluguéis) e eventos corporativos dos ativos da sua carteira. Nunca perca uma data importante.',
  },
  {
    path: '/juros-compostos',
    label: 'Calculadora de Juros Compostos',
    icon: TrendingUp,
    requiresLogin: false,
    description: 'Simule o crescimento do patrimônio com aportes periódicos e taxa de retorno. Veja em quanto tempo atinge um objetivo e o efeito dos juros compostos no longo prazo. Acesso livre.',
  },
  {
    path: '/conversor',
    label: 'Conversor de Moedas',
    icon: DollarSign,
    requiresLogin: false,
    description: 'Converta entre moedas com cotações atualizadas. Útil para ativos em dólar, viagens ou planejamento em outra moeda. Acesso livre.',
  },
  {
    path: '/correcao-monetaria',
    label: 'Correção Monetária',
    icon: Scale,
    requiresLogin: false,
    description: 'Aplique índices como IPCA, IGP-M e outros para corrigir valores no tempo. Calcule quanto um valor do passado vale hoje ou projete correção futura. Acesso livre.',
  },
  {
    path: '/rankings',
    label: 'Rankings',
    icon: Trophy,
    requiresLogin: true,
    description: 'Rankings de ativos por diversos critérios. Compare desempenho, dividendos e indicadores para identificar opções alinhadas ao seu perfil.',
  },
]

export default function ConhecerPage() {
  return (
    <div className="container max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl sm:text-3xl font-bold mb-2">Conhecer sistema completo</h1>
      <p className="text-muted-foreground mb-10">
        Cada tela foi pensada para trazer informação e controle para suas finanças e investimentos. Navegue pelas descrições abaixo e acesse as que estão liberadas; para as demais, faça login e aproveite tudo.
      </p>

      <div className="space-y-6">
        {TELAS.map(({ path, label, icon: Icon, description, requiresLogin }) => (
          <div
            key={path}
            className="p-6 rounded-2xl border border-border bg-card hover:border-primary/40 transition-colors"
          >
            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
              <div className="flex items-center gap-3 shrink-0">
                <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                  <Icon size={24} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">{label}</h2>
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                    {requiresLogin ? (
                      <>
                        <Lock size={12} />
                        Requer login
                      </>
                    ) : (
                      <>
                        <Unlock size={12} />
                        Acesso livre
                      </>
                    )}
                  </span>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {description}
                </p>
                <Link
                  to={path}
                  className="inline-flex items-center gap-2 mt-4 text-sm font-medium text-primary hover:underline"
                >
                  {requiresLogin ? 'Acessar (faça login se necessário)' : 'Acessar'}
                  <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-12 p-6 rounded-2xl bg-primary/10 border border-primary/20 text-center">
        <p className="text-sm font-medium text-foreground mb-2">
          Quer usar todas as telas?
        </p>
        <p className="text-sm text-muted-foreground mb-4">
          Crie sua conta ou faça login para acessar Home, Carteira, Controle, Análise, Notícias, Agenda e Rankings.
        </p>
        <Link
          to="/login"
          className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
        >
          Ir para o login
          <ArrowRight size={18} />
        </Link>
      </div>
    </div>
  )
}
