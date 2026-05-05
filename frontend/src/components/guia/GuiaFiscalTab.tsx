import { ShieldCheck, Scale, Clock3, UserRoundCheck, Globe, ExternalLink, Receipt, Landmark } from 'lucide-react'

type FiscalFonte = {
  label: string
  url: string
}

const FONTES_OFICIAIS: FiscalFonte[] = [
  {
    label: 'Lei 14.754/2023 (aplicações no exterior e offshores) - Planalto',
    url: 'https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2023/lei/l14754.htm',
  },
  {
    label: 'Lei 11.033/2004 (renda fixa, FIIs e outros pontos) - Planalto',
    url: 'https://www.planalto.gov.br/ccivil_03/_Ato2004-2006/2004/Lei/L11033.htm',
  },
  {
    label: 'RFB: isenções em bolsa (ações até limite mensal, regras e exceções)',
    url: 'https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/pagamento/renda-variavel/bolsa-de-valores-1/isencoes',
  },
  {
    label: 'IN RFB 1.888/2019 (obrigações de criptoativos) - atos e orientações',
    url: 'https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/declaracoes-e-demonstrativos/criptoativos/atos-referentes-a-in-rfb-1888-2019',
  },
]

const ALIQUOTAS_REFERENCIA = [
  {
    classe: 'Renda fixa (IR regressivo)',
    regra: '22,5% até 180 dias; 20% de 181 a 360; 17,5% de 361 a 720; 15% acima de 720 dias.',
    observacao: 'Regras gerais da tabela regressiva (Lei 11.033/2004 e normas correlatas).',
  },
  {
    classe: 'Ações - operação comum',
    regra: '15% sobre ganho líquido tributável.',
    observacao: 'Há regra de isenção mensal para vendas no mercado à vista dentro do limite legal da RFB.',
  },
  {
    classe: 'Ações - day trade',
    regra: '20% sobre ganho líquido.',
    observacao: 'Sem a isenção de vendas mensais do mercado à vista.',
  },
  {
    classe: 'FIIs - ganho de capital na venda de cotas',
    regra: '20% sobre ganho líquido.',
    observacao: 'Rendimentos periódicos podem ter tratamento distinto conforme requisitos legais vigentes.',
  },
  {
    classe: 'Criptoativos (ganho de capital PF)',
    regra: 'Regra de ganho de capital conforme legislação vigente e ambiente da operação.',
    observacao: 'Além do imposto, há obrigação acessória de reporte em cenários da IN RFB 1.888/2019.',
  },
  {
    classe: 'Aplicações no exterior (PF residente no Brasil)',
    regra: 'Regra específica da Lei 14.754/2023 (alíquota anual própria no regime atual).',
    observacao: 'Apuração e declaração segregadas exigem controle documental disciplinado.',
  },
]

export default function GuiaFiscalTab() {
  return (
    <div className="space-y-8">
      <div className="bg-card border border-border rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-primary/10">
            <ShieldCheck className="w-6 h-6 text-primary" />
          </div>
          <h3 className="text-xl font-semibold text-foreground">
            Guia Fiscal do Investidor (Brasil e Exterior)
          </h3>
        </div>
        <p className="text-muted-foreground leading-relaxed">
          Este módulo foca em <strong className="text-foreground">eficiência fiscal legal</strong>:
          reduzir atrito tributário com alocação, prazo e escolha de veículo, sem evasão e sem risco
          desnecessário de compliance.
        </p>
        <p className="text-xs text-muted-foreground mt-3">
          Atualizado para orientar com base nas regras vigentes e fontes oficiais. Em caso de operação
          complexa (offshore, derivativos, sucessão), valide com contador tributarista.
        </p>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 rounded-lg bg-primary/10">
            <Scale className="w-6 h-6 text-primary" />
          </div>
          <h3 className="text-xl font-semibold text-foreground">Estratégias fiscais legais mais usadas</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-muted/30 border border-border rounded-xl p-4">
            <h4 className="font-semibold text-foreground mb-2">1) Priorizar menor giro em renda variável</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>- Menos operações tende a reduzir imposto e custo operacional.</li>
              <li>- Favorece estratégia de longo prazo e diferimento de tributação.</li>
              <li>- Day trade tende a ter maior atrito fiscal e operacional.</li>
            </ul>
          </div>
          <div className="bg-muted/30 border border-border rounded-xl p-4">
            <h4 className="font-semibold text-foreground mb-2">2) Usar veículos com tratamento fiscal eficiente</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>- LCI/LCA, debêntures incentivadas e outros veículos podem ter tratamento favorecido.</li>
              <li>- Em FIIs, acompanhar regras de isenção de rendimentos e eventuais mudanças legais.</li>
              <li>- Sempre comparar retorno líquido (após imposto), não só taxa bruta.</li>
            </ul>
          </div>
          <div className="bg-muted/30 border border-border rounded-xl p-4">
            <h4 className="font-semibold text-foreground mb-2">3) Compensar prejuízos quando permitido</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>- Prejuízos podem reduzir base tributável de ganhos da mesma natureza, conforme regra.</li>
              <li>- Controle mensal de operações evita perda de crédito fiscal.</li>
              <li>- Guardar notas e relatórios da corretora simplifica apuração/declaração.</li>
            </ul>
          </div>
          <div className="bg-muted/30 border border-border rounded-xl p-4">
            <h4 className="font-semibold text-foreground mb-2">4) Planejar Brasil + exterior de forma integrada</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>- Lei 14.754/2023 alterou regras de tributação de aplicações no exterior para PF.</li>
              <li>- Planejar moeda, prazo e realização de ganhos evita surpresas no ajuste anual.</li>
              <li>- Em estruturas internacionais, governança documental é obrigatória.</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 rounded-lg bg-primary/10">
            <Landmark className="w-6 h-6 text-primary" />
          </div>
          <h3 className="text-xl font-semibold text-foreground">Alíquotas: progressivas, regressivas e por classe</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Na prática, o investidor convive com três lógicas: <strong className="text-foreground">regressiva por prazo</strong> (renda fixa),
          <strong className="text-foreground"> alíquota por tipo de operação</strong> (ações/FIIs/day trade) e
          <strong className="text-foreground"> regimes específicos</strong> (exterior e cripto).
        </p>
        <div className="space-y-3">
          {ALIQUOTAS_REFERENCIA.map((item) => (
            <div key={item.classe} className="rounded-xl border border-border bg-muted/20 p-4">
              <p className="font-semibold text-foreground">{item.classe}</p>
              <p className="text-sm text-muted-foreground mt-1">{item.regra}</p>
              <p className="text-xs text-muted-foreground mt-1">{item.observacao}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          Use esta tabela como guia educacional. Para cálculo definitivo, confirme na legislação/fonte oficial e na sua apuração mensal.
        </p>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 rounded-lg bg-primary/10">
            <Receipt className="w-6 h-6 text-primary" />
          </div>
          <h3 className="text-xl font-semibold text-foreground">DARF: como, quando e por que emitir</h3>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl border border-border bg-muted/20 p-4">
            <p className="font-semibold text-foreground mb-2">Por que existe DARF?</p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>- É o documento de arrecadação para recolher imposto devido em operações fora da retenção final na fonte.</li>
              <li>- Evita acúmulo de passivo tributário, multa e juros por atraso.</li>
              <li>- Organiza a vida fiscal mensal e facilita a declaração anual.</li>
            </ul>
          </div>
          <div className="rounded-xl border border-border bg-muted/20 p-4">
            <p className="font-semibold text-foreground mb-2">Quando normalmente há DARF?</p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>- Ganho líquido tributável em bolsa (ações/FIIs/day trade), após compensações permitidas.</li>
              <li>- Operações em que o imposto não foi totalmente quitado na fonte.</li>
              <li>- Situações específicas de ganho de capital e regimes aplicáveis do mês.</li>
            </ul>
          </div>
          <div className="rounded-xl border border-border bg-muted/20 p-4 lg:col-span-2">
            <p className="font-semibold text-foreground mb-2">Fluxo prático mensal (resumo)</p>
            <ol className="space-y-1 text-sm text-muted-foreground">
              <li>1) Consolidar notas, extratos e relatórios por classe/operação.</li>
              <li>2) Separar operações comuns x day trade x FIIs x exterior/cripto.</li>
              <li>3) Calcular ganho líquido do mês e compensar prejuízos permitidos.</li>
              <li>4) Aplicar alíquota correta da classe/operação.</li>
              <li>5) Emitir e pagar DARF no prazo aplicável.</li>
              <li>6) Arquivar comprovante de pagamento para declaração anual.</li>
            </ol>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6 shadow-xl">
        <h3 className="text-xl font-semibold text-foreground mb-4">Benefícios e atritos fiscais por classe de ativo</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="rounded-xl border border-border bg-muted/20 p-4">
            <p className="font-semibold text-foreground mb-1">Renda fixa bancária e títulos públicos</p>
            <p className="text-muted-foreground">Previsibilidade e tabela regressiva: quanto maior o prazo, menor a alíquota na regra geral.</p>
          </div>
          <div className="rounded-xl border border-border bg-muted/20 p-4">
            <p className="font-semibold text-foreground mb-1">LCI/LCA e incentivados</p>
            <p className="text-muted-foreground">Podem ter tratamento favorecido para PF; comparar sempre retorno líquido x risco de crédito e liquidez.</p>
          </div>
          <div className="rounded-xl border border-border bg-muted/20 p-4">
            <p className="font-semibold text-foreground mb-1">Ações</p>
            <p className="text-muted-foreground">Operação comum tende a ser mais eficiente que alto giro; day trade tem maior alíquota e maior atrito fiscal.</p>
          </div>
          <div className="rounded-xl border border-border bg-muted/20 p-4">
            <p className="font-semibold text-foreground mb-1">FIIs</p>
            <p className="text-muted-foreground">Tratamento dos rendimentos e ganho na venda é diferente; acompanhar requisitos legais vigentes e mudanças normativas.</p>
          </div>
          <div className="rounded-xl border border-border bg-muted/20 p-4">
            <p className="font-semibold text-foreground mb-1">Exterior (stocks/ETFs/fundos)</p>
            <p className="text-muted-foreground">Regime próprio atualizado na Lei 14.754/2023; exige disciplina anual de apuração e documentação.</p>
          </div>
          <div className="rounded-xl border border-border bg-muted/20 p-4">
            <p className="font-semibold text-foreground mb-1">Criptoativos</p>
            <p className="text-muted-foreground">Além da tributação de ganho, há obrigação acessória em cenários da IN 1.888; compliance é parte do retorno.</p>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 rounded-lg bg-primary/10">
            <Clock3 className="w-6 h-6 text-primary" />
          </div>
          <h3 className="text-xl font-semibold text-foreground">Estratégia por horizonte de tempo</h3>
        </div>
        <div className="space-y-4">
          <div className="bg-muted/30 border border-border rounded-xl p-4">
            <p className="font-semibold text-foreground mb-1">Curto prazo (até 12 meses)</p>
            <p className="text-sm text-muted-foreground">
              Priorize simplicidade de apuração, controle de risco e liquidez. Evite excesso de giro sem
              tese clara, pois o custo fiscal pode consumir retorno.
            </p>
          </div>
          <div className="bg-muted/30 border border-border rounded-xl p-4">
            <p className="font-semibold text-foreground mb-1">Médio prazo (1 a 5 anos)</p>
            <p className="text-sm text-muted-foreground">
              Combine renda fixa (prazos e indexadores) e renda variável de qualidade. Compare sempre
              retorno líquido e use compensação de prejuízo de forma disciplinada.
            </p>
          </div>
          <div className="bg-muted/30 border border-border rounded-xl p-4">
            <p className="font-semibold text-foreground mb-1">Longo prazo (5+ anos)</p>
            <p className="text-sm text-muted-foreground">
              Estruture uma carteira de baixo giro, com rebalanceamento racional e foco em eficiência
              tributária acumulada ao longo dos ciclos.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 rounded-lg bg-primary/10">
              <UserRoundCheck className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold text-foreground">Por perfil (suitability)</h3>
          </div>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p><strong className="text-foreground">Conservador:</strong> foco em previsibilidade, baixa rotação, instrumentos de simples declaração e boa documentação.</p>
            <p><strong className="text-foreground">Moderado:</strong> equilíbrio entre eficiência fiscal e diversificação (Brasil + exterior), com regras de rebalanceamento.</p>
            <p><strong className="text-foreground">Arrojado:</strong> maior exposição a risco com disciplina tributária mensal (apuração, DARF quando aplicável e trilha documental).</p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 rounded-lg bg-primary/10">
              <Globe className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold text-foreground">Perfil de sustentabilidade</h3>
          </div>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p><strong className="text-foreground">ESG/Sustentável:</strong> selecione veículos alinhados ao tema e compare retorno líquido versus alternativas convencionais.</p>
            <p>Debêntures incentivadas de infraestrutura (incluindo projetos com viés sustentável) podem melhorar eficiência fiscal conforme enquadramento legal.</p>
            <p>Mantenha o racional econômico: benefício fiscal ajuda, mas não substitui risco de crédito, liquidez e qualidade do ativo.</p>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6 shadow-xl">
        <h3 className="text-xl font-semibold text-foreground mb-4">Checklist prático (iniciante ao avançado)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-muted-foreground">
          <div className="bg-muted/30 border border-border rounded-xl p-4">
            <p className="font-semibold text-foreground mb-2">Iniciante</p>
            <ul className="space-y-1">
              <li>- Consolidar notas de corretagem e extratos mensais.</li>
              <li>- Entender diferença entre isenção, alíquota e obrigação declaratória.</li>
              <li>- Avaliar produtos pelo retorno líquido, não só rentabilidade bruta.</li>
            </ul>
          </div>
          <div className="bg-muted/30 border border-border rounded-xl p-4">
            <p className="font-semibold text-foreground mb-2">Avançado</p>
            <ul className="space-y-1">
              <li>- Rodar apuração mensal por classe/operação e compensações.</li>
              <li>- Integrar plano fiscal com alocação tática e cambial.</li>
              <li>- Revisão anual de compliance (Brasil + exterior + cripto).</li>
              <li>- Simular cenários de realização de lucro para minimizar pico tributário anual.</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6 shadow-xl">
        <h3 className="text-xl font-semibold text-foreground mb-4">Fontes oficiais e legislação</h3>
        <div className="space-y-3">
          {FONTES_OFICIAIS.map((fonte) => (
            <a
              key={fonte.url}
              href={fonte.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-3 p-3 rounded-xl border border-border bg-muted/20 hover:bg-muted/40 transition-colors"
            >
              <ExternalLink className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <span className="text-sm text-foreground">{fonte.label}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
