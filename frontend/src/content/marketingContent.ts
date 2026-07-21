import type { LucideIcon } from 'lucide-react'
import {
  Wallet,
  Calculator,
  BookOpen,
  TrendingUp,
  Target,
  ArrowRight,
  Check,
  Sparkles,
  BarChart3,
  CalendarDays,
  Trophy,
  ScanLine,
  Receipt,
  Brain,
  Zap,
  Newspaper,
  Home,
  Search,
  PieChart,
  Lock,
  Unlock,
} from 'lucide-react'

/** Telas e abas premium — fonte única para Vendas e referência de marketing. */
export const TELAS_PREMIUM = [
  {
    id: 'analise',
    path: '/analise',
    icon: BarChart3,
    titulo: 'Análise de oportunidades',
    desc: 'Tela exclusiva para encontrar os melhores ativos com base em critérios que você define.',
    itens: [
      'Filtros por tipo (ações, FIIs, BDRs), dividend yield, P/VPA, liquidez e mais',
      'Lista ranqueada com indicadores fundamentais e técnicos',
      'Comparação lado a lado entre ativos',
      'Exportação e acompanhamento dos que mais interessam',
    ],
  },
  {
    id: 'agenda-dividendos',
    path: '/agenda-dividendos',
    icon: CalendarDays,
    titulo: 'Agenda de dividendos',
    desc: 'Visualize todos os proventos previstos da sua carteira e do mercado em um calendário.',
    itens: [
      'Calendário mensal e anual de dividendos e JCP',
      'Proventos por ativo, data de pagamento e valor estimado',
      'Filtros por tipo de ativo e período',
      'Previsão de rendimento passivo',
    ],
  },
  {
    id: 'rankings',
    path: '/rankings',
    icon: Trophy,
    titulo: 'Rankings',
    desc: 'Veja como sua carteira se compara a outros investidores e descubra os ativos mais populares.',
    itens: [
      'Rankings por volume de investidores e valor aplicado',
      'Top ativos em ações, FIIs e BDRs',
      'Comparação da sua alocação com a média do mercado',
      'Insights para diversificação',
    ],
  },
  {
    id: 'noticias',
    path: '/noticias',
    icon: Newspaper,
    titulo: 'Notícias do mercado',
    desc: 'Acompanhe o cenário econômico com notícias agregadas em layout de jornal, sem sair do FinMas.',
    itens: [
      'Feed estilo jornal com destaques, categorias e paginação',
      'Busca por palavra-chave e filtro por categoria',
      'Fontes selecionadas com link para a matéria completa',
      'Atualização periódica para decisões mais informadas',
    ],
  },
  {
    id: 'conceitos',
    path: '/detalhes/conceitos',
    icon: Target,
    titulo: 'Conceitos (Detalhes)',
    desc: 'Na tela de detalhes do ativo, a aba Conceitos traz preço justo Graham, método Bazin e indicador Fear & Greed.',
    itens: [
      'Preço justo de Graham — LPA, crescimento e taxa de juros para estimativa de valor',
      'Método Bazin — Teto por dividendos com DY desejada',
      'Indicador Fear & Greed — Score de momentum e distância do topo',
    ],
  },
  {
    id: 'radar-dividendos',
    path: '/detalhes/radar-dividendos',
    icon: ScanLine,
    titulo: 'Radar de Dividendos (Detalhes)',
    desc: 'Na tela de detalhes do ativo, a aba Radar de Dividendos mostra histórico, próximos proventos e padrão de pagamentos.',
    itens: [
      'Total histórico e próximos dividendos — Quantidade paga, soma total e lista dos próximos com datas',
      'Média por dividendo — Média histórica e futura para planejar receita',
      'Padrão de meses — Em quais meses o ativo costuma pagar e timeline consolidada',
    ],
  },
  {
    id: 'carteira-impostos',
    path: '/carteira?tab=impostos',
    icon: Receipt,
    titulo: 'Impostos (Carteira)',
    desc: 'Na tela da carteira, a aba Impostos calcula IR sobre vendas e proventos com base nas suas movimentações.',
    itens: [
      'IR sobre vendas — Ganho de capital com preço médio FIFO, day trade, isenção e alíquotas por tipo de ativo',
      'IR sobre proventos — Dividendos, JCP e retenção na fonte',
      'Filtros por período e tipo, com exportação para Excel',
    ],
  },
  {
    id: 'carteira-insights',
    path: '/carteira?tab=insights',
    icon: Brain,
    titulo: 'Insights (Carteira)',
    desc: 'Na tela da carteira, a aba Insights traz análise de correlação entre ativos e sugestões automáticas.',
    itens: [
      'Matriz de correlação entre os ativos da carteira para diversificação',
      'Insights e alertas com base na composição e performance',
      'Período configurável (6 meses, 1 ano ou 2 anos)',
    ],
  },
  {
    id: 'carteira-projecao',
    path: '/carteira?tab=projecao',
    icon: Calculator,
    titulo: 'Projeção (Carteira)',
    desc: 'Na tela da carteira, a aba Projeção projeta evolução do patrimônio com dividendos e metas.',
    itens: [
      'Projeção de valor com ou sem dividendos e aportes periódicos',
      'Metas de renda e patrimônio — em quanto tempo alcançar seu alvo',
      'Gráficos e metas de aporte mensal ou anual',
    ],
  },
  {
    id: 'carteira-simulador',
    path: '/carteira?tab=simulador',
    icon: Zap,
    titulo: 'Simulador (Carteira)',
    desc: 'Na tela da carteira, a aba Simulador testa choques de CDI, IPCA e SELIC e simula cenários.',
    itens: [
      'Choques de indexadores (CDI, IPCA, SELIC) na renda fixa',
      'Cenários predefinidos: otimista, pessimista, crise, inflação alta',
      'Monte Carlo — simulações probabilísticas para o longo prazo',
    ],
  },
] as const

export const PRECO_MENSAL = 29.9
export const DESCONTO_ANUAL = 0.1
export const PRECO_ANUAL_TOTAL = PRECO_MENSAL * 12 * (1 - DESCONTO_ANUAL)
export const PRECO_ANUAL_MES = PRECO_ANUAL_TOTAL / 12

export function formatarMoedaMarketing(val: number) {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })
}

export const GMAIL_SUPORTE = 'https://mail.google.com/mail/?view=cm&to=finmasfinanceiro@gmail.com'

export type LandingFeature = {
  icon: LucideIcon
  title: string
  description: string
  details?: string[]
  badge?: string
}

export const LANDING_FEATURES: LandingFeature[] = [
  {
    icon: Home,
    title: 'Home — painel do investidor',
    description:
      'Visão rápida do patrimônio, saldo mensal (receitas − despesas registradas), evolução da carteira comparada a índices (IBOV, IVVB11, IFIX, IPCA, CDI, Bitcoin), metas e atalhos para as principais telas.',
    details: [
      'Cards de receitas, despesas, saldo e carteira do mês',
      'Gráfico de evolução com comparativo equivalente aos índices',
      'Distribuição da carteira e insights de concentração',
      'Metas anuais e ações rápidas para investir e organizar finanças',
    ],
    badge: 'Com login',
  },
  {
    icon: Wallet,
    title: 'Carteira de investimentos',
    description:
      'Centralize ações, FIIs, BDRs, ETFs, criptomoedas e renda fixa. Importe posições da B3, acompanhe valorização, proventos, rebalanceamento e gráficos com comparativo patrimonial vs benchmarks no mesmo capital inicial.',
    details: [
      'Importação de relatório B3 e registro manual de ativos',
      'Renda fixa com indexadores CDI, IPCA, SELIC e prefixado',
      'Comparativo vs índices em R$ ou % (sem distorcer por aportes)',
      'Evolução do patrimônio real com snapshots históricos',
      'Abas: ativos, gráficos, proventos, rebalanceamento, movimentações e relatórios',
      'Premium: impostos, insights, projeção e simulador de cenários',
    ],
    badge: 'Com login',
  },
  {
    icon: Search,
    title: 'Detalhes dos ativos',
    description:
      'Para cada ativo, veja fundamentos, histórico de preços, dividendos e indicadores como P/L, P/VP, ROE e DY. Assinantes premium têm as abas Conceitos (Graham, Bazin, Fear & Greed) e Radar de Dividendos.',
    details: [
      'Fundamentos e indicadores: P/L, P/VP, ROE, DY, EV/EBIT',
      'Histórico de preços e de dividendos',
      'Conceitos e Radar de Dividendos (premium)',
      'Pesquisa por ticker com acesso livre à consulta básica',
    ],
    badge: 'Consulta livre',
  },
  {
    icon: PieChart,
    title: 'Análise de oportunidades',
    description:
      'Listas ranqueadas com filtros por tipo (ações, FIIs, BDRs), dividend yield, P/VPA, liquidez e outros critérios. Compare ativos lado a lado para apoiar compras e vendas.',
    details: [
      'Filtros por tipo de ativo, DY, P/VPA, liquidez e mais',
      'Listas ranqueadas com indicadores fundamentais e técnicos',
      'Comparação lado a lado entre ativos',
      'Exportação e lista de acompanhamento',
    ],
    badge: 'Premium',
  },
  {
    icon: Calculator,
    title: 'Controle financeiro',
    description:
      'Receitas, despesas, cartões e fluxo de caixa na mesma plataforma da carteira. Saldo mensal considera despesas efetivamente registradas — compras no cartão só entram ao marcar como pagas.',
    details: [
      'Abas: financeiro, receitas, despesas, alimentação (marmitas) e cartões',
      'Categorias personalizáveis com cor sólida, degradê ou CSS avançado',
      'Saldo coerente: receitas − despesas registradas (sem antecipar cartão)',
      'Gráficos de evolução e distribuição por categoria',
      'Controle de cartões, parcelas e compras',
    ],
    badge: 'Com login',
  },
  {
    icon: BookOpen,
    title: 'Guia do mercado',
    description:
      'Conteúdo educativo reorganizado: Guia Geral com Comece aqui, perfil de investidor, risco, estratégias, glossário com busca e links para ferramentas do FinMas. Inclui guias por classe de ativo e Guia Fiscal dedicado.',
    details: [
      'Guia Geral: classes, perfil, risco, estratégias e glossário pesquisável',
      'Guias por classe: renda fixa, variável, internacional e Tesouro Direto',
      'Guia Fiscal: alíquotas, DARF, eficiência tributária e checklist por perfil',
      'Comparador de estratégias e indicadores explicados',
      'Acesso gratuito, sem cadastro',
    ],
    badge: 'Gratuito',
  },
  {
    icon: TrendingUp,
    title: 'Hub de calculadoras financeiras',
    description:
      'Ambiente único em /calculadora com cinco ferramentas gratuitas para simular cenários, comparar investimentos e consultar indicadores do Banco Central.',
    details: [
      'Juros compostos com aporte único ou recorrente',
      'Correção monetária (IPCA, IGP-M e outros índices)',
      'Conversor de moedas com cotações atualizadas',
      'Indicadores BCB (SELIC, CDI, IPCA etc.)',
      'Comparação de investimentos lado a lado',
      'Acesso gratuito, sem cadastro',
    ],
    badge: 'Gratuito',
  },
  {
    icon: CalendarDays,
    title: 'Agenda de dividendos',
    description:
      'Calendário de proventos (dividendos, JCP) da sua carteira e do mercado. Veja datas de pagamento, valores estimados e planeje sua renda passiva.',
    details: [
      'Proventos previstos por ativo e por mês',
      'Datas de pagamento e ex-dividendo',
      'Filtros por período e tipo de ativo',
      'Previsão de rendimento passivo',
    ],
    badge: 'Premium',
  },
  {
    icon: Newspaper,
    title: 'Notícias e rankings',
    description:
      'Notícias do mercado em layout de jornal com busca e paginação, além de rankings de ativos por volume e valor aplicado na base FinMas.',
    details: [
      'Notícias agregadas com destaque, categorias e busca',
      'Rankings por volume de investidores e valor aplicado',
      'Top ativos em ações, FIIs e BDRs',
      'Integrado ao restante do sistema',
    ],
    badge: 'Premium',
  },
]

export const LANDING_TARGET_AUDIENCE = [
  {
    title: 'Carteira e controle financeiro juntos',
    description:
      'Para quem quer investimentos e finanças do dia a dia na mesma plataforma: organize posições, acompanhe valorização e proventos, registre receitas e despesas com saldo mensal coerente e tenha visão integrada do patrimônio.',
  },
  {
    title: 'Quem compara performance com o mercado',
    description:
      'Gráficos que mostram como sua carteira teria evoluído vs IBOV, IVVB11, IFIX, IPCA, CDI e Bitcoin no mesmo capital inicial — em reais ou em percentual — para avaliar se valeu a pena o risco assumido.',
  },
  {
    title: 'Quem acompanha dividendos, valorização e alocação',
    description:
      'Proventos recebidos e previstos, rebalanceamento, metas de alocação e relatórios da carteira. Premium: agenda de dividendos, radar de proventos por ativo e projeções de longo prazo.',
  },
  {
    title: 'Ferramentas em português para o mercado brasileiro',
    description:
      'Interface e conteúdo em português, pensados para B3, índices locais, cotações em R$, impostos e regulamentação brasileira. Guia do mercado, calculadoras e correção monetária disponíveis gratuitamente.',
  },
] as const

export const LANDING_PREMIUM_HIGHLIGHTS = [
  'Análise de oportunidades com filtros e comparação entre ativos',
  'Agenda de dividendos e Rankings da base FinMas',
  'Notícias do mercado em layout de jornal',
  'Conceitos e Radar de Dividendos (abas em Detalhes)',
  'Impostos, Insights, Projeção e Simulador na Carteira',
  'Acesso completo a todas as telas premium do sistema',
] as const

export const LANDING_HERO_PILLS = [
  'Comparativo vs índices',
  'Guia fiscal',
  'Calculadoras',
  'Controle financeiro',
  'Dividendos',
  'Impostos',
] as const

export const VENDAS_HERO_PILLS = [
  'Análise',
  'Dividendos',
  'Notícias',
  'Impostos',
  'Projeção',
  'Comparativo índices',
] as const

export const PLANO_MENSAL_ITENS = [
  'Análise de oportunidades',
  'Agenda de dividendos e Rankings',
  'Notícias do mercado',
  'Conceitos e Radar de Dividendos (Detalhes)',
  'Impostos, Insights, Projeção e Simulador (Carteira)',
  'Todas as ferramentas premium para gestão avançada da carteira',
] as const

export const PLANO_ANUAL_ITENS = [
  'Tudo do plano mensal',
  '12 meses pelo preço de 10,8',
  'Melhor custo-benefício',
] as const

export const SEO_TITLE = 'Finmas – Gestão de investimentos e controle financeiro'
export const SEO_DESCRIPTION =
  'Plataforma para carteira de investimentos, comparativo vs índices, controle financeiro e análise de ativos. Inclui guia do mercado com módulo fiscal, hub de calculadoras, conversor, correção monetária e indicadores BCB — gratuitos.'

/** Telas do tour "Conhecer o sistema" — alinhado às rotas atuais. */
export const CONHECER_TELAS: Array<{
  path: string
  label: string
  icon: LucideIcon
  description: string
  requiresLogin: boolean
}> = [
  {
    path: '/home',
    label: 'Home',
    icon: Home,
    requiresLogin: true,
    description:
      'Painel com patrimônio, saldo mensal, evolução da carteira comparada a índices, distribuição por tipo de ativo, metas e atalhos rápidos.',
  },
  {
    path: '/detalhes',
    label: 'Detalhes dos ativos',
    icon: Search,
    requiresLogin: false,
    description:
      'Pesquise qualquer ativo e veja cotação, fundamentos (P/L, P/VP, ROE, DY), histórico e dividendos. Premium: abas Conceitos e Radar de Dividendos.',
  },
  {
    path: '/carteira',
    label: 'Carteira',
    icon: Wallet,
    requiresLogin: true,
    description:
      'Central da carteira: importação B3, valorização, proventos, gráficos com comparativo vs índices, rebalanceamento, movimentações e relatórios. Premium: impostos, insights, projeção e simulador.',
  },
  {
    path: '/controle',
    label: 'Controle Financeiro',
    icon: Calculator,
    requiresLogin: true,
    description:
      'Receitas, despesas, cartões, marmitas e fluxo de caixa. Saldo mensal coerente (despesas registradas). Categorias personalizáveis com cores e degradê.',
  },
  {
    path: '/guia',
    label: 'Guia do Mercado',
    icon: BookOpen,
    requiresLogin: false,
    description:
      'Guia Geral expandido (Comece aqui, perfil, risco, glossário com busca), guias por classe de ativo e Guia Fiscal. Acesso livre.',
  },
  {
    path: '/calculadora',
    label: 'Calculadoras financeiras',
    icon: TrendingUp,
    requiresLogin: false,
    description:
      'Hub gratuito com juros compostos, correção monetária, conversor de moedas, indicadores BCB e comparação de investimentos.',
  },
  {
    path: '/analise',
    label: 'Análise de oportunidades',
    icon: BarChart3,
    requiresLogin: true,
    description:
      'Listas filtradas por tipo, DY, P/VPA e liquidez; comparação entre ativos e exportação. Recurso premium.',
  },
  {
    path: '/noticias',
    label: 'Notícias',
    icon: Newspaper,
    requiresLogin: true,
    description:
      'Notícias do mercado em layout de jornal, com busca, categorias e paginação. Recurso premium.',
  },
  {
    path: '/agenda-dividendos',
    label: 'Agenda de Dividendos',
    icon: CalendarDays,
    requiresLogin: true,
    description:
      'Calendário de proventos da carteira e do mercado. Datas de pagamento e previsão de renda passiva. Premium.',
  },
  {
    path: '/rankings',
    label: 'Rankings',
    icon: Trophy,
    requiresLogin: true,
    description:
      'Rankings de ativos por critérios da base FinMas. Compare alocação e descubra ativos populares. Premium.',
  },
]

// Re-export icons used by pages that need them in hero pills etc.
export { Check, ArrowRight, Sparkles, Lock, Unlock }
