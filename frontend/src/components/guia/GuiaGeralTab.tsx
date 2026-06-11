import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart3,
  ExternalLink,
  Target,
  Shield,
  BookOpen,
  Compass,
  Layers,
  UserRound,
  Wrench,
  Receipt,
  ChevronRight,
  Search,
} from 'lucide-react'
import { formatNumber, formatPercentage } from '../../utils/formatters'
import {
  GUIA_GERAL_SECTIONS,
  ASSET_TYPE_TAB_MAP,
  COMECE_AQUI,
  INVESTOR_PROFILES,
  RISCO_DIVERSIFICACAO,
  FERRAMENTAS_FINMAS,
  GLOSSARIO_TERMS,
  type GuiaTabId,
} from './geralContent'

type AssetSubtype = { name: string; technical: string[] }
type AssetTypeInfo = {
  id: string
  name: string
  technical: string[]
  pros: string[]
  cons: string[]
  subtypes?: AssetSubtype[]
  notes?: string[]
}

interface GuiaGeralTabProps {
  inputTicker: string
  setInputTicker: (value: string) => void
  handleSearchKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
  handleBuscar: () => void
  ticker: string | null
  pl: number | null
  pvp: number | null
  roePct: number | null
  dyPct: number | null
  evToEbit: number | null
  sma50: number | null
  sma200: number | null
  lastClose: number | null
  evaluateStrategies: () => any[]
  leftKey: string
  setLeftKey: (value: string) => void
  rightKey: string
  setRightKey: (value: string) => void
  left: any
  right: any
  showMarketNotes: boolean
  googleUrl: (query: string) => string
  INDICATORS: any[]
  STRATEGIES: any[]
  StrategyCard: (strategy: any) => JSX.Element
  ASSET_TYPES: AssetTypeInfo[]
  onNavigateGuiaTab: (tab: GuiaTabId) => void
}

const scrollToSection = (id: string) => {
  const el = document.getElementById(id)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const BulletList = ({ items, color = 'bg-primary' }: { items: string[]; color?: string }) => (
  <ul className="space-y-2">
    {items.map((item) => (
      <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
        <div className={`w-2 h-2 ${color} rounded-full mt-2 flex-shrink-0`} />
        <span>{item}</span>
      </li>
    ))}
  </ul>
)

const SectionHeader = ({
  id,
  icon: Icon,
  title,
}: {
  id: string
  icon: React.ComponentType<{ className?: string }>
  title: string
}) => (
  <div id={id} className="flex items-center gap-3 mb-6 scroll-mt-24">
    <div className="p-2 rounded-lg bg-primary/10">
      <Icon className="w-6 h-6 text-primary" />
    </div>
    <h3 className="text-xl font-semibold text-foreground">{title}</h3>
  </div>
)

export default function GuiaGeralTab({
  inputTicker,
  setInputTicker,
  handleSearchKeyDown,
  handleBuscar,
  ticker,
  pl,
  pvp,
  roePct,
  dyPct,
  evToEbit,
  sma50,
  sma200,
  lastClose,
  evaluateStrategies,
  leftKey,
  setLeftKey,
  rightKey,
  setRightKey,
  left,
  right,
  showMarketNotes,
  googleUrl,
  INDICATORS,
  STRATEGIES,
  StrategyCard,
  ASSET_TYPES,
  onNavigateGuiaTab,
}: GuiaGeralTabProps) {
  const [glossarioQuery, setGlossarioQuery] = useState('')

  const glossarioFiltrado = useMemo(() => {
    const q = glossarioQuery.trim().toLowerCase()
    if (!q) return GLOSSARIO_TERMS
    return GLOSSARIO_TERMS.filter(
      (item) =>
        item.term.toLowerCase().includes(q) ||
        item.definition.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
    )
  }, [glossarioQuery])

  return (
    <div className="space-y-8">
      {/* Índice de navegação */}
      <nav
        aria-label="Índice do Guia Geral"
        className="sticky top-0 z-10 bg-card/95 backdrop-blur border border-border rounded-2xl p-4 shadow-lg"
      >
        <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">Neste guia</p>
        <div className="flex flex-wrap gap-2">
          {GUIA_GERAL_SECTIONS.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => scrollToSection(section.id)}
              className="px-3 py-1.5 rounded-lg text-xs sm:text-sm bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
            >
              {section.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Comece aqui */}
      <section className="bg-card border border-border rounded-2xl p-6 shadow-xl">
        <SectionHeader id="comecar" icon={Compass} title="Comece aqui" />
        <p className="text-muted-foreground leading-relaxed mb-6">{COMECE_AQUI.intro}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {COMECE_AQUI.pillars.map((pillar) => (
            <div key={pillar.title} className="bg-muted/30 border border-border rounded-xl p-4">
              <h4 className="font-semibold text-foreground mb-2">{pillar.title}</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">{pillar.content}</p>
            </div>
          ))}
        </div>
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
          <h4 className="font-semibold text-foreground mb-2">{COMECE_AQUI.compoundExample.title}</h4>
          <BulletList items={COMECE_AQUI.compoundExample.lines} color="bg-primary" />
          <Link
            to="/calculadora?tab=juros-compostos"
            className="inline-flex items-center gap-1 mt-3 text-sm text-primary hover:underline font-medium"
          >
            Simular na calculadora
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Classes de ativo */}
      <section className="bg-card border border-border rounded-2xl p-6 shadow-xl">
        <SectionHeader id="classes" icon={Layers} title="Panorama das classes de ativo" />
        <p className="text-sm text-muted-foreground mb-6">
          Cada classe tem papel diferente na carteira. Clique em &quot;Aprofundar&quot; para ir à aba específica deste guia.
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {ASSET_TYPES.map((asset) => {
            const targetTab = ASSET_TYPE_TAB_MAP[asset.id]
            return (
              <div key={asset.id} className="bg-muted/30 border border-border rounded-xl p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <h4 className="text-lg font-semibold text-foreground">{asset.name}</h4>
                  {targetTab && (
                    <button
                      type="button"
                      onClick={() => onNavigateGuiaTab(targetTab)}
                      className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                    >
                      Aprofundar
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <BulletList items={asset.technical} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-2">Vantagens</p>
                    <BulletList items={asset.pros} color="bg-emerald-500" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-2">Atenções</p>
                    <BulletList items={asset.cons} color="bg-red-500" />
                  </div>
                </div>
                {asset.notes?.length ? (
                  <p className="text-xs text-muted-foreground italic border-t border-border pt-3">{asset.notes.join(' ')}</p>
                ) : null}
                {asset.subtypes?.length ? (
                  <div className="border-t border-border pt-3">
                    <p className="text-xs font-semibold text-foreground mb-2">Principais produtos</p>
                    <div className="flex flex-wrap gap-2">
                      {asset.subtypes.map((sub) => (
                        <span
                          key={sub.name}
                          className="px-2 py-1 rounded-md bg-background border border-border text-xs text-muted-foreground"
                          title={sub.technical.join(' ')}
                        >
                          {sub.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </section>

      {/* Perfil de investidor */}
      <section className="bg-card border border-border rounded-2xl p-6 shadow-xl">
        <SectionHeader id="perfil" icon={UserRound} title="Perfil de investidor" />
        <p className="text-sm text-muted-foreground mb-6">
          Referências educativas — não substituem análise da sua situação financeira, objetivos e tolerância a quedas.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {INVESTOR_PROFILES.map((profile) => (
            <div key={profile.id} className="bg-muted/30 border border-border rounded-xl p-4 space-y-3">
              <h4 className="font-semibold text-foreground text-lg">{profile.name}</h4>
              <div className="space-y-2 text-sm">
                <p>
                  <span className="font-medium text-foreground">Horizonte: </span>
                  <span className="text-muted-foreground">{profile.horizon}</span>
                </p>
                <p>
                  <span className="font-medium text-foreground">Foco: </span>
                  <span className="text-muted-foreground">{profile.focus}</span>
                </p>
                <p>
                  <span className="font-medium text-foreground">Alocação típica: </span>
                  <span className="text-muted-foreground">{profile.allocation}</span>
                </p>
                <p>
                  <span className="font-medium text-foreground">Riscos a observar: </span>
                  <span className="text-muted-foreground">{profile.risks}</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Risco e diversificação */}
      <section className="bg-card border border-border rounded-2xl p-6 shadow-xl">
        <SectionHeader id="risco" icon={Shield} title="Risco, diversificação e correlação" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {RISCO_DIVERSIFICACAO.principles.map((item) => (
            <div key={item.title} className="bg-muted/30 border border-border rounded-xl p-4">
              <h4 className="font-semibold text-foreground mb-2">{item.title}</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">{item.content}</p>
            </div>
          ))}
        </div>
        <h4 className="font-semibold text-foreground mb-3">Exemplos de alocação (referência)</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {RISCO_DIVERSIFICACAO.allocationExamples.map((ex) => (
            <div key={ex.name} className="bg-muted/30 border border-border rounded-xl p-4">
              <p className="font-semibold text-foreground mb-1">{ex.name}</p>
              <p className="text-sm text-primary font-medium mb-2">{ex.mix}</p>
              <p className="text-xs text-muted-foreground">{ex.note}</p>
            </div>
          ))}
        </div>
        <div className="bg-muted/30 border border-border rounded-xl p-4">
          <p className="font-semibold text-foreground mb-3">Boas práticas</p>
          <BulletList items={RISCO_DIVERSIFICACAO.practices} color="bg-blue-500" />
          <Link
            to="/carteira"
            className="inline-flex items-center gap-1 mt-4 text-sm text-primary hover:underline font-medium"
          >
            Abrir Carteira e rebalanceamento
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Estratégias */}
      <section className="bg-card border border-border rounded-2xl p-6 shadow-xl">
        <SectionHeader id="estrategias" icon={Target} title="Principais estratégias" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {STRATEGIES.map((s) => (
            <div key={s.key}>{StrategyCard(s)}</div>
          ))}
        </div>
      </section>

      {/* Comparador */}
      <section className="bg-card border border-border rounded-2xl p-6 shadow-xl">
        <SectionHeader id="comparador" icon={BarChart3} title="Comparador de estratégias" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label htmlFor="sel-left" className="block text-sm text-muted-foreground mb-2">
              Estratégia A
            </label>
            <select
              id="sel-left"
              className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-200"
              value={leftKey}
              onChange={(e) => setLeftKey(e.target.value)}
            >
              {STRATEGIES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="sel-right" className="block text-sm text-muted-foreground mb-2">
              Estratégia B
            </label>
            <select
              id="sel-right"
              className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-200"
              value={rightKey}
              onChange={(e) => setRightKey(e.target.value)}
            >
              {STRATEGIES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div key={left.key}>{StrategyCard(left)}</div>
          <div key={right.key}>{StrategyCard(right)}</div>
        </div>
      </section>

      {/* Ferramentas FinMas */}
      <section className="bg-card border border-border rounded-2xl p-6 shadow-xl">
        <SectionHeader id="ferramentas" icon={Wrench} title="Ferramentas do FinMas" />
        <p className="text-sm text-muted-foreground mb-6">
          Use as calculadoras e a carteira para transformar o que você aprendeu em números concretos.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FERRAMENTAS_FINMAS.map((tool) => (
            <Link
              key={tool.to}
              to={tool.to}
              className="group bg-muted/30 border border-border rounded-xl p-4 hover:border-primary/40 hover:shadow-md transition-all"
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors">{tool.title}</h4>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">{tool.description}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Indicadores */}
      <section className="bg-card border border-border rounded-2xl p-6 shadow-xl">
        <SectionHeader id="indicadores" icon={BarChart3} title="Indicadores: definições e fórmulas" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {INDICATORS.map((it) => (
            <div
              key={it.id}
              className="bg-muted/30 border border-border rounded-xl p-4 hover:shadow-lg transition-all duration-200 cursor-pointer"
              onClick={() => window.open(googleUrl(`${it.name} indicador financeiro`), '_blank')}
              title={`Pesquisar ${it.name} no Google`}
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-foreground text-lg">{it.name}</h4>
                <div className="p-2 rounded-lg bg-primary/10">
                  <ExternalLink className="w-4 h-4 text-primary" />
                </div>
              </div>
              <div className="bg-background/50 rounded-lg p-3 mb-3">
                <p className="text-sm text-muted-foreground font-mono">{it.formula}</p>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-semibold text-foreground mb-2">Conceito técnico</p>
                  <BulletList items={it.technical} />
                </div>
                {showMarketNotes && it.notes?.length ? (
                  <div>
                    <p className="text-sm font-semibold text-foreground mb-2">Notas de mercado</p>
                    <BulletList items={it.notes} color="bg-orange-500" />
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Análise por ativo */}
      <section className="bg-card border border-border rounded-2xl p-6 shadow-xl">
        <SectionHeader id="analise-ativo" icon={BarChart3} title="Análise por ativo e enquadramento" />
        <p className="text-sm text-muted-foreground mb-6">
          Busque um ticker de ação para ver métricas e um score heurístico por estratégia. Para FIIs, ETFs e renda fixa,
          use as abas específicas e a página de Detalhes.
        </p>
        <div className="mb-8 max-w-2xl">
          <div className="flex items-center gap-3 w-full">
            <div className="flex-1">
              <label htmlFor="guia-ticker" className="sr-only">
                Buscar ativo
              </label>
              <input
                id="guia-ticker"
                type="text"
                className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-200 text-foreground placeholder:text-muted-foreground"
                placeholder="Digite o ticker (ex.: PETR4, VALE3, ITUB4)"
                value={inputTicker}
                onChange={(e) => setInputTicker(e.target.value)}
                onKeyDown={handleSearchKeyDown}
              />
            </div>
            <button
              onClick={handleBuscar}
              className="px-6 py-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200 font-medium shadow-lg hover:shadow-xl"
            >
              Buscar
            </button>
          </div>
        </div>

        {!ticker ? (
          <div className="text-center py-12">
            <BarChart3 className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-lg text-muted-foreground">Informe um ticker para avaliar enquadramento por estratégia</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'P/L', value: formatNumber(pl) },
                { label: 'P/VP', value: formatNumber(pvp) },
                { label: 'ROE', value: formatPercentage(roePct) },
                { label: 'DY', value: formatPercentage(dyPct) },
                { label: 'EV/EBIT', value: formatNumber(evToEbit) },
                { label: 'SMA50', value: formatNumber(sma50) },
                { label: 'SMA200', value: formatNumber(sma200) },
                { label: 'Fechamento', value: formatNumber(lastClose) },
              ].map((metric) => (
                <div key={metric.label} className="text-center p-4 bg-muted/30 rounded-xl">
                  <p className="text-xs text-muted-foreground mb-1">{metric.label}</p>
                  <p className="text-lg font-bold text-foreground">{metric.value}</p>
                </div>
              ))}
            </div>

            <div>
              <h4 className="text-lg font-semibold text-foreground mb-4">Adequação às estratégias</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {evaluateStrategies().map((f) => {
                  const s = STRATEGIES.find((x) => x.key === f.key)!
                  return (
                    <div
                      key={f.key}
                      className="bg-muted/30 border border-border rounded-xl p-4 hover:shadow-lg transition-all duration-200"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="font-semibold text-foreground">{s.name}</h5>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            f.score >= 3
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : f.score >= 1
                                ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          }`}
                        >
                          Score: {f.score}
                        </span>
                      </div>
                      {f.reasons.length > 0 && (
                        <div className="mb-3">
                          <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-2">Pontos a favor</p>
                          <BulletList items={f.reasons} color="bg-emerald-500" />
                        </div>
                      )}
                      {f.cautions.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-orange-600 dark:text-orange-400 mb-2">Atenções</p>
                          <BulletList items={f.cautions} color="bg-orange-500" />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-4 text-center italic">
                Regras heurísticas e objetivas, sem recomendações. Use com julgamento e contexto setorial.
              </p>
              {ticker && (
                <div className="text-center mt-4">
                  <Link
                    to={`/detalhes?ticker=${encodeURIComponent(ticker)}`}
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline font-medium"
                  >
                    Ver página completa de {ticker}
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Tributação — link ao Guia Fiscal */}
      <section className="bg-card border border-border rounded-2xl p-6 shadow-xl">
        <SectionHeader id="fiscal" icon={Receipt} title="Tributação no Brasil" />
        <p className="text-muted-foreground leading-relaxed mb-4">
          Alíquotas, isenções, DARF, renda fixa regressiva, FIIs, cripto e investimentos no exterior mudam com a
          legislação. O FinMas mantém um módulo dedicado com referências oficiais.
        </p>
        <ul className="space-y-2 mb-6">
          <li className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="w-2 h-2 bg-primary rounded-full" />
            Ações: 15% (comum) e 20% (day trade), com regras de isenção mensal
          </li>
          <li className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="w-2 h-2 bg-primary rounded-full" />
            FIIs: ganho de capital na venda; rendimentos com regras específicas
          </li>
          <li className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="w-2 h-2 bg-primary rounded-full" />
            Renda fixa: tabela regressiva de IR (15% a 22,5% conforme prazo)
          </li>
        </ul>
        <button
          type="button"
          onClick={() => onNavigateGuiaTab('fiscal')}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Abrir Guia Fiscal completo
          <ChevronRight className="w-4 h-4" />
        </button>
      </section>

      {/* Glossário */}
      <section className="bg-card border border-border rounded-2xl p-6 shadow-xl">
        <SectionHeader id="glossario" icon={BookOpen} title="Glossário essencial" />
        <div className="relative max-w-md mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="search"
            value={glossarioQuery}
            onChange={(e) => setGlossarioQuery(e.target.value)}
            placeholder="Buscar termo..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary text-sm"
            aria-label="Buscar no glossário"
          />
        </div>
        {glossarioFiltrado.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum termo encontrado para &quot;{glossarioQuery}&quot;.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {glossarioFiltrado.map((item) => (
              <div key={item.term} className="bg-muted/30 border border-border rounded-xl p-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-semibold text-foreground text-sm">{item.term}</span>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground bg-background px-1.5 py-0.5 rounded border border-border">
                    {item.category}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.definition}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
