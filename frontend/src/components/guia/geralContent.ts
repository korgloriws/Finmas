export type GuiaTabId =
  | 'geral'
  | 'renda-fixa'
  | 'renda-variavel'
  | 'renda-variavel-internacional'
  | 'renda-fixa-internacional'
  | 'tesouro-direto'
  | 'fiscal'

export const GUIA_GERAL_SECTIONS = [
  { id: 'comecar', label: 'Comece aqui' },
  { id: 'classes', label: 'Classes de ativo' },
  { id: 'perfil', label: 'Perfil de investidor' },
  { id: 'risco', label: 'Risco e diversificação' },
  { id: 'estrategias', label: 'Estratégias' },
  { id: 'comparador', label: 'Comparador' },
  { id: 'ferramentas', label: 'Ferramentas' },
  { id: 'indicadores', label: 'Indicadores' },
  { id: 'analise-ativo', label: 'Análise por ativo' },
  { id: 'fiscal', label: 'Tributação' },
  { id: 'glossario', label: 'Glossário' },
] as const

export const ASSET_TYPE_TAB_MAP: Record<string, GuiaTabId | null> = {
  acoes: 'renda-variavel',
  etfs: 'renda-variavel',
  fiis: 'renda-variavel',
  stocks: 'renda-variavel-internacional',
  fundos: null,
  'renda-fixa': 'renda-fixa',
}

export const COMECE_AQUI = {
  intro:
    'Investir é alocar recursos hoje para buscar retorno no futuro — com riscos. O mercado financeiro reúne diferentes classes de ativos (renda fixa, ações, FIIs, exterior), cada uma com liquidez, volatilidade e tributação próprias.',
  pillars: [
    {
      title: 'Defina objetivos e prazo',
      content:
        'Metas de curto prazo (viagem, reserva) pedem liquidez e menor volatilidade. Metas de longo prazo (aposentadoria, independência financeira) permitem assumir mais oscilação em busca de retorno real.',
    },
    {
      title: 'Monte a reserva de emergência primeiro',
      content:
        'Antes de buscar retorno, guarde de 3 a 12 meses de despesas essenciais em ativos líquidos e de baixo risco (ex.: Tesouro Selic, CDB com liquidez diária). Sem reserva, qualquer queda no mercado vira problema de caixa.',
    },
    {
      title: 'Entenda juros compostos',
      content:
        'Reinvestir rendimentos faz o patrimônio crescer de forma exponencial ao longo do tempo. Pequenas diferenças de taxa e de disciplina (aportes regulares) impactam muito o resultado em 10, 20 ou 30 anos.',
    },
    {
      title: 'Estude antes de operar',
      content:
        'Conheça o produto, o emissor, a liquidez, os custos e a tributação. Use este guia, as abas por classe de ativo e as calculadoras do FinMas para simular cenários antes de decidir.',
    },
  ],
  compoundExample: {
    title: 'Exemplo rápido de juros compostos',
    lines: [
      'R$ 500/mês a 0,8% a.m. (~10% a.a.) por 20 anos → cerca de R$ 295 mil acumulados.',
      'O mesmo aporte a 0,5% a.m. (~6% a.a.) → cerca de R$ 205 mil.',
      'A diferença de taxa e de tempo no mercado costuma pesar mais que “acertar o ativo” no curto prazo.',
    ],
  },
}

export const INVESTOR_PROFILES = [
  {
    id: 'conservador',
    name: 'Conservador',
    horizon: 'Curto a médio prazo',
    focus: 'Preservação de capital e previsibilidade',
    allocation: 'Predominância em renda fixa (Tesouro Selic, CDB, LCI/LCA) e reserva líquida.',
    risks: 'Retorno real pode ficar baixo se a inflação subir; evitar concentrar em prefixado longo sem entender marcação a mercado.',
  },
  {
    id: 'moderado',
    name: 'Moderado',
    horizon: 'Médio a longo prazo',
    focus: 'Equilíbrio entre segurança e crescimento',
    allocation: 'Mix de renda fixa (IPCA+, CDI), FIIs, ETFs e ações de qualidade; parcela internacional opcional.',
    risks: 'Carteira muito “morna” pode não acompanhar metas de longo prazo; rebalancear evita drift de risco.',
  },
  {
    id: 'arrojado',
    name: 'Arrojado',
    horizon: 'Longo prazo',
    focus: 'Crescimento patrimonial e aceitação de volatilidade',
    allocation: 'Maior peso em ações, small caps, exterior, cripto (se fizer sentido) e estratégias ativas.',
    risks: 'Drawdowns profundos exigem disciplina; concentração setorial e alavancagem amplificam perdas.',
  },
]

export const RISCO_DIVERSIFICACAO = {
  principles: [
    {
      title: 'Risco não é só “perder tudo”',
      content:
        'Inclui volatilidade (oscilação de preço), risco de crédito (emissor), liquidez (dificuldade de vender), cambial e regulatório. Cada classe carrega um mix diferente.',
    },
    {
      title: 'Diversificação reduz risco específico',
      content:
        'Espalhar por classes, setores, prazos e moedas diminui a dependência de um único ativo ou evento. Não elimina risco de mercado sistêmico.',
    },
    {
      title: 'Correlação importa',
      content:
        'Ativos que caem juntos oferecem pouca proteção. Renda fixa e bolsa costumam ter comportamentos distintos em crises; exterior pode ajudar quando o Brasil sofre isoladamente.',
    },
  ],
  allocationExamples: [
    {
      name: 'Conservador (referência)',
      mix: '70–85% renda fixa · 10–20% FIIs/ETFs · 0–10% ações',
      note: 'Foco em reserva e previsibilidade.',
    },
    {
      name: 'Moderado (referência)',
      mix: '40–55% renda fixa · 15–25% FIIs · 20–35% ações/ETFs · 5–15% exterior',
      note: 'Equilíbrio clássico para horizonte de 5+ anos.',
    },
    {
      name: 'Arrojado (referência)',
      mix: '15–30% renda fixa · 15–25% FIIs · 40–55% ações · 10–20% exterior/outros',
      note: 'Aceita ciclos de queda maiores em troca de potencial de retorno.',
    },
  ],
  practices: [
    'Rebalancear quando a alocação real se afastar do alvo (disponível na Carteira do FinMas).',
    'Evitar alavancagem e concentração excessiva em um ticker ou setor.',
    'Manter reserva de emergência separada da carteira de investimentos.',
    'Revisar metas e perfil a cada 12–24 meses ou após mudanças de vida (casamento, filhos, renda).',
  ],
}

export const FERRAMENTAS_FINMAS = [
  {
    title: 'Calculadora de Juros Compostos',
    description: 'Simule aportes mensais, taxa e prazo para visualizar o efeito do tempo no patrimônio.',
    to: '/calculadora?tab=juros-compostos',
  },
  {
    title: 'Comparar Investimentos',
    description: 'Compare CDB, Tesouro, LCI/LCA e outros cenários lado a lado.',
    to: '/calculadora?tab=comparacao-investimentos',
  },
  {
    title: 'Correção Monetária',
    description: 'Atualize valores pelo IPCA, IGP-M e outros índices oficiais do BCB.',
    to: '/calculadora?tab=correcao-monetaria',
  },
  {
    title: 'Carteira e Rebalanceamento',
    description: 'Acompanhe alocação por classe e ajuste metas de peso na sua carteira.',
    to: '/carteira',
  },
]

export const GLOSSARIO_TERMS: Array<{ term: string; definition: string; category: string }> = [
  { term: 'Aporte', definition: 'Valor novo investido na carteira, somado ao que já estava aplicado.', category: 'Geral' },
  { term: 'Ativo', definition: 'Qualquer investimento negociável ou aplicável (ação, CDB, cota de FII etc.).', category: 'Geral' },
  { term: 'Benchmark', definition: 'Índice de referência para comparar desempenho (ex.: IBOV, CDI, IPCA).', category: 'Geral' },
  { term: 'CDI', definition: 'Certificado de Depósito Interbancário; referência para grande parte da renda fixa no Brasil.', category: 'Renda Fixa' },
  { term: 'Correlação', definition: 'Grau em que dois ativos se movem juntos; baixa correlação ajuda na diversificação.', category: 'Risco' },
  { term: 'Day trade', definition: 'Compra e venda do mesmo ativo no mesmo dia; tributação específica (20% no Brasil).', category: 'Tributação' },
  { term: 'Drawdown', definition: 'Queda do patrimônio ou preço em relação ao pico anterior.', category: 'Risco' },
  { term: 'Duration', definition: 'Sensibilidade do preço de um título de RF a mudanças na taxa de juros.', category: 'Renda Fixa' },
  { term: 'DY (Dividend Yield)', definition: 'Proventos dos últimos 12 meses divididos pelo preço atual da cota/ação.', category: 'Indicadores' },
  { term: 'EV/EBIT', definition: 'Valor da empresa (equity + dívida líquida) sobre lucro operacional.', category: 'Indicadores' },
  { term: 'FCF (Fluxo de Caixa Livre)', definition: 'Caixa gerado pelo negócio após investimentos necessários (capex).', category: 'Indicadores' },
  { term: 'FGC', definition: 'Fundo Garantidor de Créditos; protege depósitos em instituições associadas até o limite legal.', category: 'Renda Fixa' },
  { term: 'IPCA', definition: 'Índice oficial de inflação ao consumidor no Brasil; base de títulos IPCA+.', category: 'Renda Fixa' },
  { term: 'Liquidez', definition: 'Facilidade de converter o ativo em dinheiro sem grande impacto no preço.', category: 'Geral' },
  { term: 'Marcação a mercado', definition: 'Reavaliação diária do preço de títulos de RF conforme taxas de mercado.', category: 'Renda Fixa' },
  { term: 'P/L', definition: 'Preço da ação dividido pelo lucro por ação; indica quantos anos de lucro o preço embute.', category: 'Indicadores' },
  { term: 'P/VP', definition: 'Preço sobre valor patrimonial por ação; comum em bancos e empresas intensivas em capital.', category: 'Indicadores' },
  { term: 'Payout', definition: 'Percentual do lucro distribuído como proventos aos acionistas.', category: 'Indicadores' },
  { term: 'Prefixado', definition: 'Título com taxa fixa definida na compra; sensível a alta de juros antes do vencimento.', category: 'Renda Fixa' },
  { term: 'Rebalanceamento', definition: 'Ajuste dos pesos da carteira para voltar à alocação alvo.', category: 'Carteira' },
  { term: 'ROE', definition: 'Retorno sobre o patrimônio líquido; mede rentabilidade do capital dos acionistas.', category: 'Indicadores' },
  { term: 'ROIC', definition: 'Retorno sobre o capital investido (dívida + equity); comparar com custo de capital (WACC).', category: 'Indicadores' },
  { term: 'Selic', definition: 'Taxa básica de juros da economia brasileira; referência para Tesouro Selic e CDI.', category: 'Renda Fixa' },
  { term: 'Spread', definition: 'Diferença entre duas taxas (ex.: CDB paga CDI + 1% a.a.).', category: 'Renda Fixa' },
  { term: 'Volatilidade', definition: 'Amplitude das oscilações de preço ou retorno de um ativo ao longo do tempo.', category: 'Risco' },
  { term: 'WACC', definition: 'Custo médio ponderado de capital; taxa mínima de retorno para criar valor na empresa.', category: 'Indicadores' },
]
