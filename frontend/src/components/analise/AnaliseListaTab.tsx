import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { analiseService, carteiraService, ativoService } from '../../services/api'
import { AtivoAnalise, FiltrosAnalise, PeriodoIndicadores } from '../../types'
import { useAnalise } from '../../contexts/AnaliseContext'
import { useAuth } from '../../contexts/AuthContext'
import { useTabNavigationGuard } from '../../hooks/useTabNavigationGuard'
import TickerWithLogo from '../TickerWithLogo'
import { formatNumber, formatCurrency } from '../../utils/formatters'
import { ExternalLink } from 'lucide-react'

function mensagemErroAnalise(err: unknown): string {
  if (err instanceof Error && err.message) return err.message
  return 'Erro ao carregar. Tente novamente.'
}

function erroFoiCancelamento(err: unknown): boolean {
  if (!err) return false
  if (err instanceof DOMException && err.name === 'AbortError') return true
  if (err instanceof Error) {
    const m = err.message.toLowerCase()
    if (m.includes('aborted') || m.includes('abort') || m.includes('canceled') || m.includes('cancelled')) {
      return true
    }
  }
  return false
}

function isFiltrosAnalise(value: unknown): value is FiltrosAnalise {
  if (!value || typeof value !== 'object') return false
  // Clique em botão passa MouseEvent — não é filtro
  if ('nativeEvent' in value) return false
  if ('preventDefault' in value && 'target' in value) return false
  return true
}

export type AnaliseProgresso = {
  status: string
  tipo?: string | null
  periodo?: string | null
  done: number
  total: number
  faltam: number
  pct: number
  current?: string | null
  message?: string
  recent?: string[]
}

const PERIODOS_INDICADORES: Array<{ value: PeriodoIndicadores; label: string; hint: string }> = [
  { value: 'atual', label: 'Agora', hint: 'DY e ROE do snapshot atual' },
  { value: '6m', label: '6M', hint: 'DY/ROE anualizados dos últimos 6 meses' },
  { value: '1a', label: '1A', hint: 'DY/ROE médios de 1 ano' },
  { value: '3a', label: '3A', hint: 'DY/ROE médios de 3 anos' },
  { value: '5a', label: '5A', hint: 'DY/ROE médios de 5 anos' },
]

function labelPeriodoCurto(periodo?: PeriodoIndicadores | string | null): string {
  const p = (periodo || 'atual') as PeriodoIndicadores
  const found = PERIODOS_INDICADORES.find((x) => x.value === p)
  return found?.label || 'Agora'
}

function periodoDosFiltros(filtros: FiltrosAnalise): PeriodoIndicadores {
  const p = filtros.periodo_indicadores || 'atual'
  return (PERIODOS_INDICADORES.some((x) => x.value === p) ? p : 'atual') as PeriodoIndicadores
}

function PeriodoIndicadoresPills({
  value,
  onChange,
  disabled,
}: {
  value: PeriodoIndicadores
  onChange: (periodo: PeriodoIndicadores) => void
  disabled?: boolean
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="block text-sm font-semibold text-foreground">Período dos indicadores</label>
        <span className="text-xs text-muted-foreground">Opcional — aplica DY, ROE, P/L, P/VP e liquidez</span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {PERIODOS_INDICADORES.map((p) => (
          <button
            key={p.value}
            type="button"
            disabled={disabled}
            title={p.hint}
            onClick={() => onChange(p.value)}
            className={`px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-all duration-200 disabled:opacity-50 ${
              value === p.value
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  )
}

const FILTROS_UNIVERSO_ACOES_BASE: FiltrosAnalise = {
  roe_min: -999999,
  dy_min: -999999,
  pl_min: -999999,
  pl_max: 999999,
  pvp_max: 999999,
  net_debt_ebitda_max: 999999,
  liq_min: 0,
  setor: '',
  setores_excluir: [],
}

const FILTROS_UNIVERSO_BDRS_BASE: FiltrosAnalise = {
  roe_min: -999999,
  dy_min: -999999,
  pl_min: -999999,
  pl_max: 999999,
  pvp_max: 999999,
  net_debt_ebitda_max: 999999,
  liq_min: 0,
  setor: '',
  setores_excluir: [],
}

const FILTROS_UNIVERSO_FIIS_BASE: FiltrosAnalise = {
  dy_min: -999999,
  dy_max: 999999,
  liq_min: 0,
  tipo_fii: '',
  segmento_fii: '',
  segmentos_excluir: [],
}

function filtrosUniversoAcoes(periodo: PeriodoIndicadores): FiltrosAnalise {
  return { ...FILTROS_UNIVERSO_ACOES_BASE, periodo_indicadores: periodo }
}

function filtrosUniversoBdrs(periodo: PeriodoIndicadores): FiltrosAnalise {
  return { ...FILTROS_UNIVERSO_BDRS_BASE, periodo_indicadores: periodo }
}

function filtrosUniversoFiis(periodo: PeriodoIndicadores): FiltrosAnalise {
  return { ...FILTROS_UNIVERSO_FIIS_BASE, periodo_indicadores: periodo }
}

const toFinite = (value: unknown, fallback: number) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

const normTexto = (value: unknown) => String(value ?? '').trim().toLowerCase()

type UniversoPorPeriodo = Partial<Record<PeriodoIndicadores, AtivoAnalise[]>>

function obterUniversoPeriodo(
  cache: UniversoPorPeriodo,
  periodo: PeriodoIndicadores,
): AtivoAnalise[] | null {
  const lista = cache[periodo]
  return lista && lista.length > 0 ? lista : null
}

function salvarUniversoPeriodo(
  cache: UniversoPorPeriodo,
  periodo: PeriodoIndicadores,
  lista: AtivoAnalise[],
): UniversoPorPeriodo {
  return { ...cache, [periodo]: lista }
}

function setorBate(ativoSetor: unknown, filtro: string | undefined): boolean {
  const f = (filtro || '').trim()
  if (!f) return true
  return normTexto(ativoSetor) === normTexto(f)
}

function setorExcluido(ativoSetor: unknown, excluir: string[] | undefined): boolean {
  if (!excluir?.length) return false
  const alvo = normTexto(ativoSetor)
  if (!alvo) return false
  return excluir.some((s) => normTexto(s) === alvo)
}

function temFiltroSetorialFiis(filtros: FiltrosAnalise): boolean {
  return !!(
    filtros.tipo_fii?.trim() ||
    filtros.segmento_fii?.trim() ||
    (filtros.segmentos_excluir && filtros.segmentos_excluir.length > 0)
  )
}

function filtrarAcoesLocalmente(lista: AtivoAnalise[], filtros: FiltrosAnalise): AtivoAnalise[] {
  const roeMin = toFinite(filtros.roe_min, 0)
  const dyMin = toFinite(filtros.dy_min, 0)
  const plMin = toFinite(filtros.pl_min, 0)
  const plMax = toFinite(filtros.pl_max, Number.POSITIVE_INFINITY)
  const pvpMax = toFinite(filtros.pvp_max, Number.POSITIVE_INFINITY)
  const liqMin = toFinite(filtros.liq_min, 0)
  const setor = (filtros.setor || '').trim()
  const excluir = filtros.setores_excluir || []

  return lista.filter((ativo) => (
    toFinite(ativo.roe, 0) >= roeMin &&
    toFinite(ativo.dividend_yield, 0) > dyMin &&
    toFinite(ativo.pl, 0) >= plMin &&
    toFinite(ativo.pl, 0) <= plMax &&
    toFinite(ativo.pvp, 0) <= pvpMax &&
    toFinite(ativo.liquidez_diaria, 0) > liqMin &&
    setorBate(ativo.setor, setor) &&
    !setorExcluido(ativo.setor, excluir)
  ))
}

function filtrarBdrsLocalmente(lista: AtivoAnalise[], filtros: FiltrosAnalise): AtivoAnalise[] {
  return filtrarAcoesLocalmente(lista, filtros)
}

type OrdenacaoAnalise = 'dy' | 'earnings_yield'

/** EY (%) = 1/P/L × 100. Só válido com P/L > 0. */
function earningsYieldPct(pl: unknown): number | null {
  const n = Number(pl)
  if (!Number.isFinite(n) || n <= 0) return null
  return (1 / n) * 100
}

function ordenarAtivosFiltrados(lista: AtivoAnalise[], ordenacao: OrdenacaoAnalise): AtivoAnalise[] {
  const copia = [...lista]
  if (ordenacao === 'earnings_yield') {
    return copia.sort((a, b) => {
      const eyA = earningsYieldPct(a.pl)
      const eyB = earningsYieldPct(b.pl)
      if (eyA == null && eyB == null) return 0
      if (eyA == null) return 1
      if (eyB == null) return -1
      return eyB - eyA
    })
  }
  return copia.sort((a, b) => toFinite(b.dividend_yield, 0) - toFinite(a.dividend_yield, 0))
}

function filtrarFiisLocalmente(lista: AtivoAnalise[], filtros: FiltrosAnalise): AtivoAnalise[] {
  const dyMin = toFinite(filtros.dy_min, 0)
  const dyMax = toFinite(filtros.dy_max, Number.POSITIVE_INFINITY)
  const liqMin = toFinite(filtros.liq_min, 0)
  const tipo = (filtros.tipo_fii || '').trim()
  const segmento = (filtros.segmento_fii || '').trim()
  const excluir = filtros.segmentos_excluir || []
  const precisaMeta = !!(tipo || segmento || excluir.length)

  return lista
    .filter((ativo) => {
      if (
        toFinite(ativo.dividend_yield, 0) < dyMin ||
        toFinite(ativo.dividend_yield, 0) > dyMax ||
        toFinite(ativo.liquidez_diaria, 0) <= liqMin
      ) {
        return false
      }

      if (!precisaMeta) return true

      const aTipo = (ativo.tipo_fii || '').trim()
      const aSeg = (ativo.segmento_fii || ativo.setor || '').trim()
      if (!aTipo && !aSeg) return false
      if (tipo && !setorBate(aTipo, tipo)) return false
      if (segmento && !setorBate(aSeg, segmento)) return false
      if (setorExcluido(aSeg, excluir)) return false
      return true
    })
    .sort((a, b) => toFinite(b.dividend_yield, 0) - toFinite(a.dividend_yield, 0))
}


const MAX_FIIS_VISIVEIS = 10

/** Rótulos em PT para setores Yahoo (valor do filtro permanece o original). */
const SETOR_LABEL: Record<string, string> = {
  'Financial Services': 'Financeiro',
  Technology: 'Tecnologia',
  'Consumer Cyclical': 'Consumo cíclico',
  'Consumer Defensive': 'Consumo defensivo',
  Healthcare: 'Saúde',
  Energy: 'Energia',
  Industrials: 'Industrial',
  'Communication Services': 'Comunicação',
  Utilities: 'Utilidades',
  'Real Estate': 'Imobiliário',
  'Basic Materials': 'Materiais básicos',
  Services: 'Serviços',
  'Consumer Staples': 'Bens de consumo',
  'Consumer Discretionary': 'Consumo discricionário',
}

const SETORES_COMUNS = [
  'Financial Services',
  'Technology',
  'Consumer Cyclical',
  'Consumer Defensive',
  'Healthcare',
  'Energy',
  'Industrials',
  'Communication Services',
  'Utilities',
  'Real Estate',
  'Basic Materials',
  'Services',
  'Consumer Staples',
  'Consumer Discretionary',
]

const SEGMENTOS_FII_COMUNS = [
  'Shopping',
  'Logística',
  'Lajes corporativas',
  'Escritórios',
  'Residencial',
  'Industrial',
  'Hospitalar',
  'Educacional',
  'Galpões',
  'Recebíveis/CRI',
  'Fundo de Fundos',
  'Híbrido',
  'Agências',
  'Hotel',
]

function labelSetor(setor: string): string {
  return SETOR_LABEL[setor] || setor
}

function coletarSetores(lista: AtivoAnalise[] | null | undefined, fallback: string[]): string[] {
  const set = new Set<string>()
  for (const s of fallback) {
    if (s.trim()) set.add(s.trim())
  }
  for (const ativo of lista || []) {
    const s = (ativo.setor || '').trim()
    if (s && s !== 'Desconhecido') set.add(s)
  }
  return Array.from(set).sort((a, b) => labelSetor(a).localeCompare(labelSetor(b), 'pt-BR'))
}

function coletarSegmentosFiis(
  lista: AtivoAnalise[] | null | undefined,
  metaMap: Record<string, { tipo?: string; segmento?: string }>,
  fallback: string[]
): string[] {
  const set = new Set<string>()
  for (const s of fallback) {
    if (s.trim()) set.add(s.trim())
  }
  for (const ativo of lista || []) {
    const s = (ativo.segmento_fii || ativo.setor || metaMap[ativo.ticker]?.segmento || '').trim()
    if (s) set.add(s)
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

function ExclusaoChips({
  label,
  opcoes,
  selecionados,
  onChange,
  formatLabel,
}: {
  label: string
  opcoes: string[]
  selecionados: string[]
  onChange: (next: string[]) => void
  formatLabel?: (value: string) => string
}) {
  const toggle = (valor: string) => {
    const ja = selecionados.some((s) => normTexto(s) === normTexto(valor))
    if (ja) {
      onChange(selecionados.filter((s) => normTexto(s) !== normTexto(valor)))
    } else {
      onChange([...selecionados, valor])
    }
  }

  return (
    <div className="space-y-2 md:col-span-2 lg:col-span-3">
      <div>
        <label className="block text-sm font-semibold text-foreground">{label}</label>
        <p className="text-xs text-muted-foreground mt-0.5">
          Oculte setores/segmentos relacionados para diversificar e evitar concentração.
        </p>
      </div>
      <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-2 border border-border rounded-xl bg-background">
        {opcoes.map((opcao) => {
          const ativo = selecionados.some((s) => normTexto(s) === normTexto(opcao))
          return (
            <button
              key={opcao}
              type="button"
              onClick={() => toggle(opcao)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                ativo
                  ? 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800'
                  : 'bg-muted/40 text-foreground border-border hover:bg-muted'
              }`}
              aria-pressed={ativo}
            >
              {formatLabel ? formatLabel(opcao) : opcao}
            </button>
          )
        })}
      </div>
      {selecionados.length > 0 && (
        <button
          type="button"
          onClick={() => onChange([])}
          className="text-xs text-muted-foreground hover:text-foreground underline"
        >
          Limpar exclusões ({selecionados.length})
        </button>
      )}
    </div>
  )
}

function FiltrosAcoes({ 
  filtros, 
  onFiltroChange, 
  onFiltroStringChange,
  onExclusaoChange,
  onPeriodoChange,
  setoresOpcoes,
  onBuscar, 
  loading, 
  onCancelar,
  autoSearch, 
  onAutoSearchChange 
}: {
  filtros: FiltrosAnalise
  onFiltroChange: (key: keyof FiltrosAnalise, value: number) => void
  onFiltroStringChange: (key: keyof FiltrosAnalise, value: string) => void
  onExclusaoChange: (key: 'setores_excluir', value: string[]) => void
  onPeriodoChange: (periodo: PeriodoIndicadores) => void
  setoresOpcoes: string[]
  onBuscar: () => void
  loading: boolean
  onCancelar: () => void
  autoSearch: boolean
  onAutoSearchChange: (value: boolean) => void
}) {
  const periodoLabel = labelPeriodoCurto(periodoDosFiltros(filtros))
  return (
    <div className="bg-card border border-border rounded-2xl p-6 mb-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-foreground">Filtros para Ações</h3>
          <p className="text-muted-foreground text-sm">Configure os critérios de análise — use o setor para focar ou evitar segmentos relacionados</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={autoSearch}
              onChange={(e) => onAutoSearchChange(e.target.checked)}
              className="w-4 h-4 rounded border-border text-primary focus:ring-2 focus:ring-ring focus:ring-offset-0"
              aria-label="Ativar busca automática"
            />
            Busca automática
          </label>
        </div>
      </div>

      <div className="mb-6 pb-6 border-b border-border">
        <PeriodoIndicadoresPills
          value={periodoDosFiltros(filtros)}
          onChange={onPeriodoChange}
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-foreground">ROE Mínimo (%) — {periodoLabel}</label>
          <input
            type="number"
            value={filtros.roe_min || ''}
            onChange={(e) => onFiltroChange('roe_min', parseFloat(e.target.value) || 0)}
            className="w-full px-4 py-3 border border-border rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200"
            placeholder="15"
            aria-label="ROE mínimo em percentual"
          />
        </div>
        
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-foreground">DY Mínimo (%) — {periodoLabel}</label>
          <input
            type="number"
            value={filtros.dy_min || ''}
            onChange={(e) => onFiltroChange('dy_min', parseFloat(e.target.value) || 0)}
            className="w-full px-4 py-3 border border-border rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200"
            placeholder="12"
            aria-label="Dividend yield mínimo em percentual"
          />
        </div>
        
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-foreground">P/L Mínimo — {periodoLabel}</label>
          <input
            type="number"
            value={filtros.pl_min || ''}
            onChange={(e) => onFiltroChange('pl_min', parseFloat(e.target.value) || 0)}
            className="w-full px-4 py-3 border border-border rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200"
            placeholder="1"
            aria-label="Preço sobre lucro mínimo"
          />
        </div>
        
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-foreground">P/L Máximo — {periodoLabel}</label>
          <input
            type="number"
            value={filtros.pl_max || ''}
            onChange={(e) => onFiltroChange('pl_max', parseFloat(e.target.value) || 0)}
            className="w-full px-4 py-3 border border-border rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200"
            placeholder="10"
            aria-label="Preço sobre lucro máximo"
          />
        </div>
        
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-foreground">P/VP Máximo — {periodoLabel}</label>
          <input
            type="number"
            value={filtros.pvp_max || ''}
            onChange={(e) => onFiltroChange('pvp_max', parseFloat(e.target.value) || 0)}
            className="w-full px-4 py-3 border border-border rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200"
            placeholder="2"
            aria-label="Preço sobre valor patrimonial máximo"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-semibold text-foreground">Dívida Líquida/EBITDA Máximo</label>
          <input
            type="number"
            step="0.1"
            value={filtros.net_debt_ebitda_max ?? 3}
            onChange={(e) => onFiltroChange('net_debt_ebitda_max', parseFloat(e.target.value))}
            className="w-full px-4 py-3 border border-border rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200"
            placeholder="3"
            aria-label="Dívida Líquida sobre EBITDA máximo"
            title="Usa o valor atual (não há série histórica estável no Yahoo para este filtro)"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-semibold text-foreground">Liquidez Mínima (R$) — {periodoLabel}</label>
          <input
            type="number"
            value={filtros.liq_min ?? 100000}
            onChange={(e) => onFiltroChange('liq_min', parseFloat(e.target.value) || 0)}
            className="w-full px-4 py-3 border border-border rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200"
            placeholder="100000"
            aria-label="Liquidez mínima em reais"
            title="Filtrar por liquidez diária mínima"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-semibold text-foreground">Setor (incluir)</label>
          <select
            value={filtros.setor || ''}
            onChange={(e) => onFiltroStringChange('setor', e.target.value)}
            className="w-full px-4 py-3 border border-border rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200"
            aria-label="Setor a incluir"
          >
            <option value="">Todos os setores</option>
            {setoresOpcoes.map((setor) => (
              <option key={setor} value={setor}>{labelSetor(setor)}</option>
            ))}
          </select>
        </div>

        <ExclusaoChips
          label="Excluir setores"
          opcoes={setoresOpcoes}
          selecionados={filtros.setores_excluir || []}
          onChange={(next) => onExclusaoChange('setores_excluir', next)}
          formatLabel={labelSetor}
        />
      </div>
      
      <div className="mt-6 flex justify-end gap-2">
        {loading && (
          <button
            type="button"
            onClick={onCancelar}
            className="px-4 py-2 border border-border text-foreground rounded-lg hover:bg-muted font-medium transition-all duration-200 text-sm"
          >
            Cancelar busca
          </button>
        )}
        <button
          type="button"
          onClick={() => onBuscar()}
          disabled={loading}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium transition-all duration-200 shadow-sm hover:shadow-md text-sm"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Buscando...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Buscar Ações
            </>
          )}
        </button>
      </div>
    </div>
  )
}


function FiltrosBdrs({ 
  filtros, 
  onFiltroChange, 
  onFiltroStringChange,
  onExclusaoChange,
  onPeriodoChange,
  setoresOpcoes,
  onBuscar, 
  loading, 
  onCancelar,
  autoSearch, 
  onAutoSearchChange 
}: {
  filtros: FiltrosAnalise
  onFiltroChange: (key: keyof FiltrosAnalise, value: number) => void
  onFiltroStringChange: (key: keyof FiltrosAnalise, value: string) => void
  onExclusaoChange: (key: 'setores_excluir', value: string[]) => void
  onPeriodoChange: (periodo: PeriodoIndicadores) => void
  setoresOpcoes: string[]
  onBuscar: () => void
  loading: boolean
  onCancelar: () => void
  autoSearch: boolean
  onAutoSearchChange: (value: boolean) => void
}) {
  const periodoLabel = labelPeriodoCurto(periodoDosFiltros(filtros))
  return (
    <div className="bg-card border border-border rounded-2xl p-6 mb-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-foreground">Filtros para BDRs</h3>
          <p className="text-muted-foreground text-sm">Configure os critérios de análise — use o setor para focar ou evitar segmentos relacionados</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={autoSearch}
              onChange={(e) => onAutoSearchChange(e.target.checked)}
              className="w-4 h-4 rounded border-border text-primary focus:ring-2 focus:ring-ring focus:ring-offset-0"
              aria-label="Ativar busca automática"
            />
            Busca automática
          </label>
        </div>
      </div>

      <div className="mb-6 pb-6 border-b border-border">
        <PeriodoIndicadoresPills
          value={periodoDosFiltros(filtros)}
          onChange={onPeriodoChange}
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-foreground">ROE Mínimo (%) — {periodoLabel}</label>
          <input
            type="number"
            value={filtros.roe_min || ''}
            onChange={(e) => onFiltroChange('roe_min', parseFloat(e.target.value) || 0)}
            className="w-full px-4 py-3 border border-border rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200"
            placeholder="15"
            aria-label="ROE mínimo em percentual"
          />
        </div>
        
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-foreground">DY Mínimo (%) — {periodoLabel}</label>
          <input
            type="number"
            value={filtros.dy_min || ''}
            onChange={(e) => onFiltroChange('dy_min', parseFloat(e.target.value) || 0)}
            className="w-full px-4 py-3 border border-border rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200"
            placeholder="3"
            aria-label="Dividend yield mínimo em percentual"
          />
        </div>
        
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-foreground">P/L Mínimo — {periodoLabel}</label>
          <input
            type="number"
            value={filtros.pl_min || ''}
            onChange={(e) => onFiltroChange('pl_min', parseFloat(e.target.value) || 0)}
            className="w-full px-4 py-3 border border-border rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200"
            placeholder="1"
            aria-label="Preço sobre lucro mínimo"
          />
        </div>
        
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-foreground">P/L Máximo — {periodoLabel}</label>
          <input
            type="number"
            value={filtros.pl_max || ''}
            onChange={(e) => onFiltroChange('pl_max', parseFloat(e.target.value) || 0)}
            className="w-full px-4 py-3 border border-border rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200"
            placeholder="15"
            aria-label="Preço sobre lucro máximo"
          />
        </div>
        
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-foreground">P/VP Máximo — {periodoLabel}</label>
          <input
            type="number"
            value={filtros.pvp_max || ''}
            onChange={(e) => onFiltroChange('pvp_max', parseFloat(e.target.value) || 0)}
            className="w-full px-4 py-3 border border-border rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200"
            placeholder="2"
            aria-label="Preço sobre valor patrimonial máximo"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-semibold text-foreground">Liquidez Mínima (R$) — {periodoLabel}</label>
          <input
            type="number"
            value={filtros.liq_min ?? 10000}
            onChange={(e) => onFiltroChange('liq_min', parseFloat(e.target.value) || 0)}
            className="w-full px-4 py-3 border border-border rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200"
            placeholder="10000"
            aria-label="Liquidez mínima em reais"
            title="Filtrar por liquidez diária mínima"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-semibold text-foreground">Setor (incluir)</label>
          <select
            value={filtros.setor || ''}
            onChange={(e) => onFiltroStringChange('setor', e.target.value)}
            className="w-full px-4 py-3 border border-border rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200"
            aria-label="Setor a incluir"
          >
            <option value="">Todos os setores</option>
            {setoresOpcoes.map((setor) => (
              <option key={setor} value={setor}>{labelSetor(setor)}</option>
            ))}
          </select>
        </div>

        <ExclusaoChips
          label="Excluir setores"
          opcoes={setoresOpcoes}
          selecionados={filtros.setores_excluir || []}
          onChange={(next) => onExclusaoChange('setores_excluir', next)}
          formatLabel={labelSetor}
        />
      </div>
      
      <div className="mt-6 flex justify-end gap-2">
        {loading && (
          <button
            type="button"
            onClick={onCancelar}
            className="px-4 py-2 border border-border text-foreground rounded-lg hover:bg-muted font-medium transition-all duration-200 text-sm"
          >
            Cancelar busca
          </button>
        )}
        <button
          onClick={() => onBuscar()}
          disabled={loading}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium transition-all duration-200 shadow-sm hover:shadow-md text-sm"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Buscando...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Buscar BDRs
            </>
          )}
        </button>
      </div>
    </div>
  )
}


function FiltrosFiis({ 
  filtros, 
  onFiltroChange, 
  onFiltroStringChange,
  onExclusaoChange,
  onPeriodoChange,
  segmentosOpcoes,
  onBuscar, 
  loading, 
  onCancelar,
  autoSearch, 
  onAutoSearchChange 
}: {
  filtros: FiltrosAnalise
  onFiltroChange: (key: keyof FiltrosAnalise, value: number) => void
  onFiltroStringChange: (key: keyof FiltrosAnalise, value: string) => void
  onExclusaoChange: (key: 'segmentos_excluir', value: string[]) => void
  onPeriodoChange: (periodo: PeriodoIndicadores) => void
  segmentosOpcoes: string[]
  onBuscar: () => void
  loading: boolean
  onCancelar: () => void
  autoSearch: boolean
  onAutoSearchChange: (value: boolean) => void
}) {
  const periodoLabel = labelPeriodoCurto(periodoDosFiltros(filtros))
  return (
    <div className="bg-card border border-border rounded-2xl p-6 mb-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-foreground">Filtros para FIIs</h3>
          <p className="text-muted-foreground text-sm">Configure os critérios — o segmento atua como setor para diversificar a lista</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={autoSearch}
              onChange={(e) => onAutoSearchChange(e.target.checked)}
              className="w-4 h-4 rounded border-border text-primary focus:ring-2 focus:ring-ring focus:ring-offset-0"
              aria-label="Ativar busca automática"
            />
            Busca automática
          </label>
        </div>
      </div>

      <div className="mb-6 pb-6 border-b border-border">
        <PeriodoIndicadoresPills
          value={periodoDosFiltros(filtros)}
          onChange={onPeriodoChange}
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-foreground">DY Mínimo (%) — {periodoLabel}</label>
          <input
            type="number"
            value={filtros.dy_min || ''}
            onChange={(e) => onFiltroChange('dy_min', parseFloat(e.target.value) || 0)}
            className="w-full px-4 py-3 border border-border rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200"
            placeholder="12"
            aria-label="Dividend yield mínimo em percentual"
          />
        </div>
        
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-foreground">DY Máximo (%) — {periodoLabel}</label>
          <input
            type="number"
            value={filtros.dy_max || ''}
            onChange={(e) => onFiltroChange('dy_max', parseFloat(e.target.value) || 0)}
            className="w-full px-4 py-3 border border-border rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200"
            placeholder="15"
            aria-label="Dividend yield máximo em percentual"
          />
        </div>
        
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-foreground">Liquidez Mínima (R$) — {periodoLabel}</label>
          <input
            type="number"
            value={filtros.liq_min || ''}
            onChange={(e) => onFiltroChange('liq_min', parseFloat(e.target.value) || 0)}
            className="w-full px-4 py-3 border border-border rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200"
            placeholder="1000000"
            aria-label="Liquidez mínima em reais"
          />
        </div>
        
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-foreground">Tipo de FII</label>
          <select
            value={filtros.tipo_fii || ''}
            onChange={(e) => onFiltroStringChange('tipo_fii', e.target.value)}
            className="w-full px-4 py-3 border border-border rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200"
            aria-label="Tipo de FII"
          >
            <option value="">Todos os tipos</option>
            <option value="Tijolo">Tijolo</option>
            <option value="Papel">Papel</option>
            <option value="Híbrido">Híbrido</option>
          </select>
        </div>
        
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-foreground">Segmento / setor (incluir)</label>
          <select
            value={filtros.segmento_fii || ''}
            onChange={(e) => onFiltroStringChange('segmento_fii', e.target.value)}
            className="w-full px-4 py-3 border border-border rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200"
            aria-label="Segmento do FII a incluir"
          >
            <option value="">Todos os segmentos</option>
            {segmentosOpcoes.map((seg) => (
              <option key={seg} value={seg}>{seg}</option>
            ))}
          </select>
        </div>

        <ExclusaoChips
          label="Excluir segmentos (setores)"
          opcoes={segmentosOpcoes}
          selecionados={filtros.segmentos_excluir || []}
          onChange={(next) => onExclusaoChange('segmentos_excluir', next)}
        />
      </div>
      
      <div className="mt-6 flex justify-end gap-2">
        {loading && (
          <button
            type="button"
            onClick={onCancelar}
            className="px-4 py-2 border border-border text-foreground rounded-lg hover:bg-muted font-medium transition-all duration-200 text-sm"
          >
            Cancelar busca
          </button>
        )}
        <button
          onClick={() => onBuscar()}
          disabled={loading}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium transition-all duration-200 shadow-sm hover:shadow-md text-sm"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Buscando...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Buscar FIIs
            </>
          )}
        </button>
      </div>
    </div>
  )
}


function TabelaAtivos({ 
  ativos, 
  loading, 
  error, 
  tipo,
  isAtivoNaCarteira,
  fiiMetadataMap,
  onRetry,
  periodoLabel = 'Agora',
  ordenacao = 'dy',
  onOrdenacaoChange,
  progresso,
}: {
  ativos: AtivoAnalise[]
  loading: boolean
  error: string | null
  tipo: string
  isAtivoNaCarteira: (ticker: string) => boolean
  fiiMetadataMap?: Record<string, { tipo?: string; segmento?: string }>
  onRetry?: () => void
  periodoLabel?: string
  ordenacao?: OrdenacaoAnalise
  onOrdenacaoChange?: (ordenacao: OrdenacaoAnalise) => void
  progresso?: AnaliseProgresso | null
}) {
  const permiteOrdenacaoEy = tipo === 'Ações' || tipo === 'BDRs'

  const ativosOrdenados = useMemo(() => {
    if (!permiteOrdenacaoEy) return ativos
    return ordenarAtivosFiltrados(ativos, ordenacao)
  }, [ativos, ordenacao, permiteOrdenacaoEy])

  if (loading) {
    const total = progresso?.total || 0
    const done = progresso?.done || 0
    const faltam = progresso?.faltam ?? Math.max(total - done, 0)
    const pct = total > 0 ? Math.min(100, Math.max(0, progresso?.pct ?? (done / total) * 100)) : 0
    const recent = [...(progresso?.recent || [])].reverse()

    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-5 max-w-lg mx-auto w-full px-2">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto"></div>
          <div className="space-y-2">
            <p className="text-lg font-semibold text-foreground">Analisando {tipo} ({periodoLabel})</p>
            <p className="text-sm text-muted-foreground">
              {progresso?.current
                ? `Agora: ${progresso.current}`
                : progresso?.message || 'Preparando busca no mercado...'}
            </p>
          </div>

          <div className="space-y-2 text-left">
            <div className="flex items-center justify-between text-xs sm:text-sm text-muted-foreground">
              <span>
                {total > 0 ? `${done} de ${total} processados` : 'Iniciando...'}
              </span>
              <span>{total > 0 ? `${faltam} restantes · ${pct.toFixed(0)}%` : '—'}</span>
            </div>
            <div className="h-2.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${total > 0 ? pct : 8}%` }}
              />
            </div>
          </div>

          {recent.length > 0 && (
            <div className="rounded-xl border border-border bg-muted/30 p-3 text-left max-h-40 overflow-y-auto">
              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Log recente</p>
              <ul className="space-y-1 font-mono text-xs text-foreground">
                {recent.map((ticker, idx) => (
                  <li key={`${ticker}-${idx}`} className="truncate">
                    ✓ {ticker}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Você pode trocar o período para cancelar e reiniciar, ou usar Cancelar busca.
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-2xl p-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-red-800 dark:text-red-300">Erro ao carregar {tipo}</p>
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          </div>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="self-start px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 font-medium text-sm"
            >
              Tentar novamente
            </button>
          )}
        </div>
      </div>
    )
  }

  if (ativos.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div className="space-y-2">
          <p className="text-lg font-semibold text-foreground">Nenhum {tipo} encontrado</p>
          <p className="text-muted-foreground">Tente ajustar os filtros de busca</p>
        </div>
      </div>
    )
  }

  const isFiiTable = tipo === 'FIIs'
  const ativosVisiveis = isFiiTable ? ativosOrdenados.slice(0, MAX_FIIS_VISIVEIS) : ativosOrdenados
  const fiisOcultos = isFiiTable ? Math.max(0, ativosOrdenados.length - MAX_FIIS_VISIVEIS) : 0

  return (
    <div className="space-y-3">
      {permiteOrdenacaoEy && onOrdenacaoChange && (
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Ordenar resultados filtrados</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Só quem já passou no seu critério (ROE, DY, P/L, P/VP, liquidez…). Isto não altera o filtro.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => onOrdenacaoChange('dy')}
                className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-colors ${
                  ordenacao === 'dy'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                Dividend Yield
              </button>
              <button
                type="button"
                onClick={() => onOrdenacaoChange('earnings_yield')}
                className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-colors ${
                  ordenacao === 'earnings_yield'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                Earnings Yield (mais baratas)
              </button>
            </div>
          </div>
          {ordenacao === 'earnings_yield' && (
            <div className="rounded-xl border border-primary/25 bg-primary/5 px-3 py-2.5 text-xs sm:text-sm text-foreground">
              <strong>Ranking de baratas entre as filtradas:</strong> Earnings Yield = 1 ÷ P/L (em %).
              Quanto maior, mais barata — apenas entre ativos que já entraram no seu filtro.
            </div>
          )}
        </div>
      )}

    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
      {/* Mobile: cards responsivos (evita corte visual da tabela em telas pequenas) */}
      <div className="md:hidden divide-y divide-border">
        {ativosVisiveis.map((ativo) => {
          const fiiMeta = fiiMetadataMap?.[ativo.ticker]
          const ey = earningsYieldPct(ativo.pl)
          return (
            <div key={ativo.ticker} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <TickerWithLogo ticker={ativo.ticker} />
                  <p className="mt-1 text-sm font-semibold text-foreground truncate">{ativo.nome_completo}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {isFiiTable
                      ? (fiiMeta?.segmento || ativo.segmento_fii || ativo.setor || 'Sem segmento')
                      : (ativo.setor ? labelSetor(ativo.setor) : (ativo.industria || 'N/A'))}
                  </p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-semibold shrink-0 ${
                  ativo.tipo === 'Ação' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300' :
                  ativo.tipo === 'FII' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300' :
                  'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300'
                }`}>
                  {ativo.tipo}
                </span>
              </div>

              {isFiiTable && (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-muted/40 rounded-lg p-2">
                    <p className="text-muted-foreground">Tipo FII</p>
                    <p className="font-semibold text-foreground">{fiiMeta?.tipo || ativo.tipo_fii || '-'}</p>
                  </div>
                  <div className="bg-muted/40 rounded-lg p-2">
                    <p className="text-muted-foreground">Segmento / setor</p>
                    <p className="font-semibold text-foreground">{fiiMeta?.segmento || ativo.segmento_fii || ativo.setor || '-'}</p>
                  </div>
                </div>
              )}

              {!isFiiTable && (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-muted/40 rounded-lg p-2">
                    <p className="text-muted-foreground">Setor</p>
                    <p className="font-semibold text-foreground">{ativo.setor ? labelSetor(ativo.setor) : '-'}</p>
                  </div>
                  <div className="bg-muted/40 rounded-lg p-2">
                    <p className="text-muted-foreground">Indústria</p>
                    <p className="font-semibold text-foreground truncate">{ativo.industria || '-'}</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-muted/40 rounded-lg p-2">
                  <p className="text-muted-foreground">Preço</p>
                  <p className="font-semibold text-foreground">{formatCurrency(Number.isFinite(Number(ativo.preco_atual)) ? Number(ativo.preco_atual) : 0)}</p>
                </div>
                <div className="bg-muted/40 rounded-lg p-2">
                  <p className="text-muted-foreground">DY ({periodoLabel})</p>
                  <p className="font-semibold text-foreground">{Number.isFinite(Number(ativo.dividend_yield)) ? Number(ativo.dividend_yield).toFixed(2) : '0.00'}%</p>
                </div>
                <div className="bg-muted/40 rounded-lg p-2">
                  <p className="text-muted-foreground">P/L ({periodoLabel})</p>
                  <p className="font-semibold text-foreground">{Number.isFinite(Number(ativo.pl)) ? Number(ativo.pl).toFixed(2) : '-'}</p>
                </div>
                {!isFiiTable && (
                  <div className={`rounded-lg p-2 ${ordenacao === 'earnings_yield' ? 'bg-primary/10 ring-1 ring-primary/30' : 'bg-muted/40'}`}>
                    <p className="text-muted-foreground">Earnings Yield</p>
                    <p className="font-semibold text-foreground">{ey != null ? `${ey.toFixed(2)}%` : '-'}</p>
                  </div>
                )}
                <div className="bg-muted/40 rounded-lg p-2">
                  <p className="text-muted-foreground">P/VP ({periodoLabel})</p>
                  <p className="font-semibold text-foreground">{Number.isFinite(Number(ativo.pvp)) ? Number(ativo.pvp).toFixed(2) : '-'}</p>
                </div>
                <div className="bg-muted/40 rounded-lg p-2">
                  <p className="text-muted-foreground">ROE ({periodoLabel})</p>
                  <p className="font-semibold text-foreground">{Number.isFinite(Number(ativo.roe)) ? Number(ativo.roe).toFixed(2) : '0.00'}%</p>
                </div>
                <div className="bg-muted/40 rounded-lg p-2">
                  <p className="text-muted-foreground">Liquidez ({periodoLabel})</p>
                  <p className="font-semibold text-foreground">{formatCurrency(ativo.liquidez_diaria || 0)}</p>
                </div>
              </div>

              <div>
                {isAtivoNaCarteira(ativo.ticker) ? (
                  <span className="px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300 rounded-full text-xs font-semibold">
                    Na Carteira
                  </span>
                ) : (
                  <span className="px-2 py-1 bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300 rounded-full text-xs font-semibold">
                    Disponível
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Desktop/tablet: tabela completa */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Ticker</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Nome</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Tipo</th>
              {isFiiTable && (
                <>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Tipo FII</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Segmento / setor</th>
                </>
              )}
              {!isFiiTable && (
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Setor</th>
              )}
              <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Preço</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">DY ({periodoLabel})</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">P/L ({periodoLabel})</th>
              {!isFiiTable && (
                <th
                  className={`px-6 py-4 text-left text-sm font-semibold ${ordenacao === 'earnings_yield' ? 'text-primary' : 'text-foreground'}`}
                  title="Earnings Yield = 1 ÷ P/L. Ranking só entre quem já passou no filtro."
                >
                  EY ({periodoLabel})
                </th>
              )}
              <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">P/VP ({periodoLabel})</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">ROE ({periodoLabel})</th>
              {!isFiiTable && (
                <>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Indústria</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">País</th>
                </>
              )}
              <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Liquidez ({periodoLabel})</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {ativosVisiveis.map((ativo) => {
              const fiiMeta = fiiMetadataMap?.[ativo.ticker]
              const ey = earningsYieldPct(ativo.pl)
              
              return (
              <tr key={ativo.ticker} className="hover:bg-muted/30 transition-colors duration-200">
                <td className="px-6 py-4">
                  <TickerWithLogo ticker={ativo.ticker} />
                </td>
                <td className="px-6 py-4">
                  <div className="space-y-1">
                    <p className="font-semibold text-foreground text-sm">{ativo.nome_completo}</p>
                    <p className="text-xs text-muted-foreground">{ativo.industria}</p>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                    ativo.tipo === 'Ação' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300' : 
                    ativo.tipo === 'FII' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300' : 
                    'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300'
                  }`}>
                    {ativo.tipo}
                  </span>
                </td>
                {isFiiTable && (
                  <>
                    <td className="px-6 py-4">
                      {(fiiMeta?.tipo || ativo.tipo_fii) ? (
                        <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                          (fiiMeta?.tipo || ativo.tipo_fii) === 'Tijolo' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300' :
                          (fiiMeta?.tipo || ativo.tipo_fii) === 'Papel' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-300' :
                          'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300'
                        }`}>
                          {fiiMeta?.tipo || ativo.tipo_fii}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-foreground">
                        {fiiMeta?.segmento || ativo.segmento_fii || ativo.setor || '-'}
                      </span>
                    </td>
                  </>
                )}
                {!isFiiTable && (
                  <td className="px-6 py-4">
                    <span className="text-sm font-medium text-foreground">
                      {ativo.setor ? labelSetor(ativo.setor) : '-'}
                    </span>
                  </td>
                )}
                <td className="px-6 py-4">
                  <span className="font-bold text-foreground text-sm">
                    {formatCurrency(Number.isFinite(Number(ativo.preco_atual)) ? Number(ativo.preco_atual) : 0)}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                    ativo.dividend_yield >= 12 ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300' : 
                    ativo.dividend_yield >= 6 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300' : 
                    'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
                  }`}>
                    {Number.isFinite(Number(ativo.dividend_yield)) ? Number(ativo.dividend_yield).toFixed(2) : '0.00'}%
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                    ativo.pl <= 10 ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300' : 
                    ativo.pl <= 20 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300' : 
                    'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
                  }`}>
                    {Number.isFinite(Number(ativo.pl)) ? Number(ativo.pl).toFixed(2) : '-'}
                  </span>
                </td>
                {!isFiiTable && (
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                      ordenacao === 'earnings_yield'
                        ? 'bg-primary/15 text-primary'
                        : ey != null && ey >= 10
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
                          : ey != null && ey >= 5
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300'
                            : 'bg-muted text-muted-foreground'
                    }`}>
                      {ey != null ? `${ey.toFixed(2)}%` : '-'}
                    </span>
                  </td>
                )}
                <td className="px-6 py-4">
                  <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                    ativo.pvp <= 1.5 ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300' : 
                    ativo.pvp <= 3 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300' : 
                    'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
                  }`}>
                    {Number.isFinite(Number(ativo.pvp)) ? Number(ativo.pvp).toFixed(2) : '-'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                    ativo.roe >= 15 ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300' : 
                    ativo.roe >= 10 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300' : 
                    'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
                  }`}>
                    {Number.isFinite(Number(ativo.roe)) ? Number(ativo.roe).toFixed(2) : '0.00'}%
                  </span>
                </td>
                {!isFiiTable && (
                  <>
                    <td className="px-6 py-4">
                      <span className="text-sm text-muted-foreground">
                        {ativo.industria || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-muted-foreground">
                        {ativo.pais || 'N/A'}
                      </span>
                    </td>
                  </>
                )}
                <td className="px-6 py-4">
                  <div className="space-y-1">
                    <div className="font-semibold text-sm text-foreground">
                      {formatCurrency(ativo.liquidez_diaria || 0)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Vol: {formatNumber(ativo.volume_medio || 0)}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  {isAtivoNaCarteira(ativo.ticker) ? (
                    <span className="px-3 py-1.5 bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300 rounded-full text-xs font-semibold">
                      Na Carteira
                    </span>
                  ) : (
                    <span className="px-3 py-1.5 bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300 rounded-full text-xs font-semibold">
                      Disponível
                    </span>
                  )}
                </td>
              </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {fiisOcultos > 0 && (
        <div className="px-6 py-3 bg-muted/30 border-t border-border text-center">
          <p className="text-xs text-muted-foreground">
            Exibindo os <span className="font-semibold text-foreground">{MAX_FIIS_VISIVEIS} FIIs</span> com maior DY.
            Mais <span className="font-semibold text-foreground">{fiisOcultos}</span> FIIs passaram nos filtros e foram ocultados.
            Refine os filtros para ajustar a lista.
          </p>
        </div>
      )}
    </div>
    </div>
  )
}

// Componente para tabela de CRIs
function TabelaCRIs() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cris, setCris] = useState<any[]>([])

  const carregarCRIs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/mercados/cris?limite=50')
      const data = await response.json()
      if (data.cris) {
        setCris(data.cris)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar CRIs')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    carregarCRIs()
  }, [carregarCRIs])

  const abrirDetalhesGoogle = (cri: any) => {
    const query = `${cri.nome} ${cri.codigo_identificacao} CRI investimento`
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`
    window.open(url, '_blank')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto"></div>
          <div className="space-y-2">
            <p className="text-lg font-semibold text-foreground">Carregando CRIs...</p>
            <p className="text-sm text-muted-foreground">Buscando dados do mercado</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-2xl p-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-red-800 dark:text-red-300">Erro ao carregar CRIs</p>
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
      <div className="px-4 py-2 bg-purple-50 dark:bg-purple-900/20 border-b border-border">
        <p className="text-xs text-purple-600 dark:text-purple-400 flex items-center gap-1">
          <ExternalLink className="h-3 w-3" />
          Clique em qualquer CRI para pesquisar detalhes no Google
        </p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
        {cris.map((cri: any, index: number) => (
          <div
            key={index}
            onClick={() => abrirDetalhesGoogle(cri)}
            className="p-4 border border-border rounded-lg hover:border-primary hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                  {cri.nome}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {cri.codigo_identificacao}
                </p>
              </div>
              <div className="flex gap-2">
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300">
                  {cri.tipo}
                </span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  cri.fase === 'Funcionamento Normal'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
                    : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300'
                }`}>
                  {cri.fase}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <p className="text-xs text-muted-foreground">Número da Emissão</p>
                <p className="font-medium text-foreground">{cri.numero_emissao}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Data de Emissão</p>
                <p className="font-medium text-foreground">{cri.data_emissao}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 mb-3">
              <div>
                <p className="text-xs text-muted-foreground">Devedor</p>
                <p className="font-medium text-foreground">{cri.nome_devedor}</p>
                <p className="text-xs text-muted-foreground">{cri.qualificacao_devedor}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <p className="text-xs text-muted-foreground">Séries</p>
                <p className="font-medium text-foreground">{cri.series}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tipo de Fundo</p>
                <p className="font-medium text-foreground">{cri.tipo_fundo}</p>
              </div>
            </div>

            <div className="flex items-center justify-center mt-3 text-primary group-hover:text-primary/80 transition-colors">
              <span className="text-sm font-medium">Clique para pesquisar detalhes</span>
              <ExternalLink className="w-4 h-4 ml-1" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Componente para tabela de CRAs
function TabelaCRAs() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cras, setCras] = useState<any[]>([])

  const carregarCRAs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/mercados/cras?limite=50')
      const data = await response.json()
      if (data.cras) {
        setCras(data.cras)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar CRAs')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    carregarCRAs()
  }, [carregarCRAs])

  const abrirDetalhesGoogle = (cra: any) => {
    const query = `${cra.nome} ${cra.codigo_identificacao} CRA investimento`
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`
    window.open(url, '_blank')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto"></div>
          <div className="space-y-2">
            <p className="text-lg font-semibold text-foreground">Carregando CRAs...</p>
            <p className="text-sm text-muted-foreground">Buscando dados do mercado</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-2xl p-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-red-800 dark:text-red-300">Erro ao carregar CRAs</p>
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (cras.length === 0) {
    return (
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">Nenhum CRA disponível</h3>
          <p className="text-muted-foreground mb-4">
            Os Certificados de Recebíveis do Agronegócio (CRAs) não estão disponíveis no momento.
          </p>
          <p className="text-sm text-muted-foreground">
            CRAs são menos comuns que CRIs no mercado brasileiro. Tente novamente mais tarde.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
      <div className="px-4 py-2 bg-orange-50 dark:bg-orange-900/20 border-b border-border">
        <p className="text-xs text-orange-600 dark:text-orange-400 flex items-center gap-1">
          <ExternalLink className="h-3 w-3" />
          Clique em qualquer CRA para pesquisar detalhes no Google
        </p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
        {cras.map((cra: any, index: number) => (
          <div
            key={index}
            onClick={() => abrirDetalhesGoogle(cra)}
            className="p-4 border border-border rounded-lg hover:border-primary hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                  {cra.nome}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {cra.codigo_identificacao}
                </p>
              </div>
              <div className="flex gap-2">
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300">
                  {cra.tipo}
                </span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  cra.fase === 'Funcionamento Normal'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
                    : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300'
                }`}>
                  {cra.fase}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <p className="text-xs text-muted-foreground">Número da Emissão</p>
                <p className="font-medium text-foreground">{cra.numero_emissao}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Data de Emissão</p>
                <p className="font-medium text-foreground">{cra.data_emissao}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 mb-3">
              <div>
                <p className="text-xs text-muted-foreground">Devedor</p>
                <p className="font-medium text-foreground">{cra.nome_devedor}</p>
                <p className="text-xs text-muted-foreground">{cra.qualificacao_devedor}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <p className="text-xs text-muted-foreground">Séries</p>
                <p className="font-medium text-foreground">{cra.series}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tipo de Fundo</p>
                <p className="font-medium text-foreground">{cra.tipo_fundo}</p>
              </div>
            </div>

            <div className="flex items-center justify-center mt-3 text-primary group-hover:text-primary/80 transition-colors">
              <span className="text-sm font-medium">Clique para pesquisar detalhes</span>
              <ExternalLink className="w-4 h-4 ml-1" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Componente para tabela de Debentures
function TabelaDebentures() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [debentures, setDebentures] = useState<any[]>([])

  const carregarDebentures = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/mercados/debentures?limite=50')
      const data = await response.json()
      if (data.debentures) {
        setDebentures(data.debentures)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar Debentures')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    carregarDebentures()
  }, [carregarDebentures])

  const abrirDetalhesGoogle = (debenture: any) => {
    const query = `${debenture.emissor} ${debenture.codigo} debenture investimento`
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`
    window.open(url, '_blank')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto"></div>
          <div className="space-y-2">
            <p className="text-lg font-semibold text-foreground">Carregando Debentures...</p>
            <p className="text-sm text-muted-foreground">Buscando dados do mercado</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-2xl p-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-red-800 dark:text-red-300">Erro ao carregar Debentures</p>
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
      <div className="px-4 py-2 bg-green-50 dark:bg-green-900/20 border-b border-border">
        <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
          <ExternalLink className="h-3 w-3" />
          Clique em qualquer Debenture para pesquisar detalhes no Google
        </p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
        {debentures.map((debenture: any, index: number) => (
          <div
            key={index}
            onClick={() => abrirDetalhesGoogle(debenture)}
            className="p-4 border border-border rounded-lg hover:border-primary hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                  {debenture.emissor}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {debenture.codigo}
                </p>
              </div>
              <div className="flex gap-2">
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300">
                  Debenture
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 mb-3">
              <div>
                <p className="text-xs text-muted-foreground">Agente Fiduciário</p>
                <p className="font-medium text-foreground">{debenture.agente_fiduciario}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <p className="text-xs text-muted-foreground">Volume de Emissão</p>
                <p className="font-medium text-foreground">{debenture.volume_emissao}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Data de Vencimento</p>
                <p className="font-medium text-foreground">{debenture.data_vencimento}</p>
              </div>
            </div>

            <div className="flex items-center justify-center mt-3 text-primary group-hover:text-primary/80 transition-colors">
              <span className="text-sm font-medium">Clique para pesquisar detalhes</span>
              <ExternalLink className="w-4 h-4 ml-1" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}


export default function AnaliseListaTab() {
  const { user } = useAuth()
  const [activeSubTab, setActiveSubTab] = useState<'acoes' | 'bdrs' | 'fiis' | 'cris' | 'cras' | 'debentures' | 'tesouro'>('acoes')

  // Cancela requests pendentes ao trocar de sub-aba. O endpoint /api/analise/ativos
  // pode levar dezenas de segundos paralelizando yfinance — se o usuário
  // troca de "Ações" para "FIIs" no meio, queremos liberar o slot do backend.
  useTabNavigationGuard(activeSubTab)
  

  const { 
    ativosAcoes, 
    ativosBdrs, 
    ativosFiis, 
    setAtivosAcoes, 
    setAtivosBdrs, 
    setAtivosFiis 
  } = useAnalise()
  

  // Usar filtros do contexto
  const { filtrosAcoes, filtrosBdrs, filtrosFiis, setFiltrosAcoes, setFiltrosBdrs, setFiltrosFiis } = useAnalise()

 
  const [loadingAcoes, setLoadingAcoes] = useState(false)
  const [loadingBdrs, setLoadingBdrs] = useState(false)
  const [loadingFiis, setLoadingFiis] = useState(false)
  const [progressoAcoes, setProgressoAcoes] = useState<AnaliseProgresso | null>(null)
  const [progressoBdrs, setProgressoBdrs] = useState<AnaliseProgresso | null>(null)
  const [progressoFiis, setProgressoFiis] = useState<AnaliseProgresso | null>(null)

  const [errorAcoes, setErrorAcoes] = useState<string | null>(null)
  const [errorBdrs, setErrorBdrs] = useState<string | null>(null)
  const [errorFiis, setErrorFiis] = useState<string | null>(null)


  const [autoSearchAcoes, setAutoSearchAcoes] = useState(false)
  const [autoSearchBdrs, setAutoSearchBdrs] = useState(false)
  const [autoSearchFiis, setAutoSearchFiis] = useState(false)
  const [ordenacaoAcoes, setOrdenacaoAcoes] = useState<OrdenacaoAnalise>('dy')
  const [ordenacaoBdrs, setOrdenacaoBdrs] = useState<OrdenacaoAnalise>('dy')


  const [fiiMetadataMap, setFiiMetadataMap] = useState<Record<string, { tipo?: string; segmento?: string }>>({})
  const [universoTick, setUniversoTick] = useState(0)
  const abortAcoesRef = useRef<AbortController | null>(null)
  const abortBdrsRef = useRef<AbortController | null>(null)
  const abortFiisRef = useRef<AbortController | null>(null)
  const universoAcoesRef = useRef<UniversoPorPeriodo>({})
  const universoBdrsRef = useRef<UniversoPorPeriodo>({})
  const universoFiisRef = useRef<UniversoPorPeriodo>({})
  const filtrosAcoesRef = useRef<FiltrosAnalise>(filtrosAcoes)
  const filtrosBdrsRef = useRef<FiltrosAnalise>(filtrosBdrs)
  const filtrosFiisRef = useRef<FiltrosAnalise>(filtrosFiis)
  const enrichFiisGenRef = useRef(0)

  const setoresAcoesOpcoes = useMemo(
    () => coletarSetores(
      obterUniversoPeriodo(universoAcoesRef.current, periodoDosFiltros(filtrosAcoes)) || ativosAcoes,
      SETORES_COMUNS,
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ativosAcoes, universoTick, filtrosAcoes.periodo_indicadores]
  )
  const setoresBdrsOpcoes = useMemo(
    () => coletarSetores(
      obterUniversoPeriodo(universoBdrsRef.current, periodoDosFiltros(filtrosBdrs)) || ativosBdrs,
      SETORES_COMUNS,
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ativosBdrs, universoTick, filtrosBdrs.periodo_indicadores]
  )
  const segmentosFiisOpcoes = useMemo(
    () => coletarSegmentosFiis(
      obterUniversoPeriodo(universoFiisRef.current, periodoDosFiltros(filtrosFiis)) || ativosFiis,
      fiiMetadataMap,
      SEGMENTOS_FII_COMUNS,
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ativosFiis, fiiMetadataMap, universoTick, filtrosFiis.periodo_indicadores]
  )

  // SEGURANCA: Incluir user na queryKey para isolamento entre usuários
  const { data: carteira } = useQuery({
    queryKey: ['carteira', user],
    queryFn: carteiraService.getCarteira,
    enabled: !!user,
    retry: false,
    refetchOnWindowFocus: false
  })


  const tickersNaCarteira = new Set(carteira?.map(ativo => ativo.ticker.toUpperCase()) || [])
  const isAtivoNaCarteira = (ticker: string) => {
    return tickersNaCarteira.has(ticker.toUpperCase())
  }


  useEffect(() => {
    if (!ativosFiis || ativosFiis.length === 0) return

    // Como a tabela só renderiza os primeiros MAX_FIIS_VISIVEIS, buscar metadata
    // apenas desses tickers — evita 30+ requests desnecessárias ao FundsExplorer.
    const fiisVisiveis = ativosFiis.slice(0, MAX_FIIS_VISIVEIS)
    const faltando = fiisVisiveis.filter((f) => !fiiMetadataMap[f.ticker] && !f.segmento_fii)
    if (faltando.length === 0) return

    let cancelled = false
    const buscarMetadados = async () => {
      const newMetadataMap: Record<string, { tipo?: string; segmento?: string }> = {}

      const batchSize = 5
      for (let i = 0; i < faltando.length; i += batchSize) {
        if (cancelled) return
        const batch = faltando.slice(i, i + batchSize)

        const promises = batch.map(async (fii) => {
          try {
            const metadata = await ativoService.getFiiMetadata(fii.ticker, false)
            if (metadata) {
              newMetadataMap[fii.ticker] = {
                tipo: metadata.tipo,
                segmento: metadata.segmento
              }
            }
          } catch (error) {
            console.error(`Erro ao buscar metadata de ${fii.ticker}:`, error)
          }
        })

        await Promise.all(promises)
        if (cancelled) return

        setFiiMetadataMap(prev => ({ ...prev, ...newMetadataMap }))

        if (Object.keys(newMetadataMap).length > 0) {
          const periodo = periodoDosFiltros(filtrosFiisRef.current)
          const atual = obterUniversoPeriodo(universoFiisRef.current, periodo)
          if (atual) {
            const atualizado = atual.map((a) => {
              const meta = newMetadataMap[a.ticker]
              if (!meta) return a
              return {
                ...a,
                tipo_fii: meta.tipo ?? a.tipo_fii,
                segmento_fii: meta.segmento ?? a.segmento_fii,
                setor: meta.segmento || a.setor,
              }
            })
            universoFiisRef.current = salvarUniversoPeriodo(universoFiisRef.current, periodo, atualizado)
            setUniversoTick((t) => t + 1)
          }
        }

        if (i + batchSize < faltando.length) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      }
    }

    buscarMetadados()
    return () => { cancelled = true }
    // fiiMetadataMap propositalmente fora: evita loop; só busca o que ainda falta
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativosFiis])

  const enriquecerUniversoFiis = useCallback(async (lista: AtivoAnalise[]) => {
    const gen = ++enrichFiisGenRef.current
    const pendentes = lista.filter((a) => !a.segmento_fii && !a.tipo_fii)
    if (pendentes.length === 0) return

    const batchSize = 8
    for (let i = 0; i < pendentes.length; i += batchSize) {
      if (enrichFiisGenRef.current !== gen) return
      const batch = pendentes.slice(i, i + batchSize)
      const newMetadataMap: Record<string, { tipo?: string; segmento?: string }> = {}

      await Promise.all(batch.map(async (fii) => {
        try {
          const metadata = await ativoService.getFiiMetadata(fii.ticker, false)
          if (metadata) {
            newMetadataMap[fii.ticker] = {
              tipo: metadata.tipo,
              segmento: metadata.segmento,
            }
          }
        } catch {
          // ignora ticker sem meta
        }
      }))

      if (enrichFiisGenRef.current !== gen) return
      if (Object.keys(newMetadataMap).length === 0) continue

      setFiiMetadataMap((prev) => ({ ...prev, ...newMetadataMap }))
      const periodo = periodoDosFiltros(filtrosFiisRef.current)
      const atual = obterUniversoPeriodo(universoFiisRef.current, periodo)
      if (atual) {
        const atualizado = atual.map((a) => {
          const meta = newMetadataMap[a.ticker]
          if (!meta) return a
          return {
            ...a,
            tipo_fii: meta.tipo ?? a.tipo_fii,
            segmento_fii: meta.segmento ?? a.segmento_fii,
            setor: meta.segmento || a.setor,
          }
        })
        universoFiisRef.current = salvarUniversoPeriodo(universoFiisRef.current, periodo, atualizado)
        setUniversoTick((t) => t + 1)
        if (temFiltroSetorialFiis(filtrosFiisRef.current)) {
          setAtivosFiis(filtrarFiisLocalmente(atualizado, filtrosFiisRef.current))
        }
      }

      if (i + batchSize < pendentes.length) {
        await new Promise((r) => setTimeout(r, 300))
      }
    }
  }, [setAtivosFiis])

  const cancelarBuscaAcoes = useCallback(() => {
    void analiseService.cancelarBusca().catch(() => undefined)
    abortAcoesRef.current?.abort()
    abortAcoesRef.current = null
    setLoadingAcoes(false)
    setProgressoAcoes(null)
  }, [])

  const cancelarBuscaBdrs = useCallback(() => {
    void analiseService.cancelarBusca().catch(() => undefined)
    abortBdrsRef.current?.abort()
    abortBdrsRef.current = null
    setLoadingBdrs(false)
    setProgressoBdrs(null)
  }, [])

  const cancelarBuscaFiis = useCallback(() => {
    void analiseService.cancelarBusca().catch(() => undefined)
    abortFiisRef.current?.abort()
    abortFiisRef.current = null
    setLoadingFiis(false)
    setProgressoFiis(null)
  }, [])

  useEffect(() => {
    const loading = loadingAcoes || loadingBdrs || loadingFiis
    if (!loading) return

    let cancelled = false
    const tick = async () => {
      try {
        const p = await analiseService.getProgresso()
        if (cancelled) return
        if (loadingAcoes) setProgressoAcoes(p)
        if (loadingBdrs) setProgressoBdrs(p)
        if (loadingFiis) setProgressoFiis(p)
      } catch {
        // ignore poll errors
      }
    }
    void tick()
    const id = window.setInterval(() => { void tick() }, 700)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [loadingAcoes, loadingBdrs, loadingFiis])

  useEffect(() => {
    return () => {
      abortAcoesRef.current?.abort()
      abortBdrsRef.current?.abort()
      abortFiisRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    filtrosAcoesRef.current = filtrosAcoes
  }, [filtrosAcoes])

  useEffect(() => {
    filtrosBdrsRef.current = filtrosBdrs
  }, [filtrosBdrs])

  useEffect(() => {
    filtrosFiisRef.current = filtrosFiis
  }, [filtrosFiis])

  useEffect(() => {
    const periodo = periodoDosFiltros(filtrosAcoes)
    const universo = obterUniversoPeriodo(universoAcoesRef.current, periodo)
    if (!universo) return
    setAtivosAcoes(filtrarAcoesLocalmente(universo, filtrosAcoes))
  }, [filtrosAcoes, setAtivosAcoes])

  useEffect(() => {
    const periodo = periodoDosFiltros(filtrosBdrs)
    const universo = obterUniversoPeriodo(universoBdrsRef.current, periodo)
    if (!universo) return
    setAtivosBdrs(filtrarBdrsLocalmente(universo, filtrosBdrs))
  }, [filtrosBdrs, setAtivosBdrs])

  useEffect(() => {
    const periodo = periodoDosFiltros(filtrosFiis)
    const universo = obterUniversoPeriodo(universoFiisRef.current, periodo)
    if (!universo) return
    if (temFiltroSetorialFiis(filtrosFiis)) {
      const temMeta = universo.some((a) => a.segmento_fii || a.tipo_fii)
      if (!temMeta) return
    }
    setAtivosFiis(filtrarFiisLocalmente(universo, filtrosFiis))
  }, [filtrosFiis, setAtivosFiis])

  const handleBuscarAcoes = useCallback(async (filtrosOverride?: FiltrosAnalise) => {
    const filtrosAtuais = isFiltrosAnalise(filtrosOverride) ? filtrosOverride : filtrosAcoesRef.current
    const periodo = periodoDosFiltros(filtrosAtuais)
    const cached = obterUniversoPeriodo(universoAcoesRef.current, periodo)

    // Já buscamos este período: só refiltra em memória
    if (cached) {
      setErrorAcoes(null)
      setAtivosAcoes(filtrarAcoesLocalmente(cached, filtrosAtuais))
      return
    }

    try {
      await analiseService.cancelarBusca()
    } catch {}
    abortAcoesRef.current?.abort()
    const ctrl = new AbortController()
    abortAcoesRef.current = ctrl
    setLoadingAcoes(true)
    setProgressoAcoes({
      status: 'running',
      done: 0,
      total: 0,
      faltam: 0,
      pct: 0,
      message: `Carregando universo (${labelPeriodoCurto(periodo)})...`,
      recent: [],
      periodo,
    })
    setErrorAcoes(null)
    try {
      const universo = await analiseService.getAtivos('acoes', filtrosUniversoAcoes(periodo), { signal: ctrl.signal })
      if (ctrl.signal.aborted) return
      universoAcoesRef.current = salvarUniversoPeriodo(universoAcoesRef.current, periodo, universo)
      setUniversoTick((t) => t + 1)
      setAtivosAcoes(filtrarAcoesLocalmente(universo, filtrosAcoesRef.current))
    } catch (error) {
      if (!erroFoiCancelamento(error)) {
        setErrorAcoes(mensagemErroAnalise(error))
      }
    } finally {
      if (abortAcoesRef.current === ctrl) {
        setLoadingAcoes(false)
        setProgressoAcoes(null)
        abortAcoesRef.current = null
      }
    }
  }, [setAtivosAcoes])

  const handleBuscarBdrs = useCallback(async (filtrosOverride?: FiltrosAnalise) => {
    const filtrosAtuais = isFiltrosAnalise(filtrosOverride) ? filtrosOverride : filtrosBdrsRef.current
    const periodo = periodoDosFiltros(filtrosAtuais)
    const cached = obterUniversoPeriodo(universoBdrsRef.current, periodo)

    if (cached) {
      setErrorBdrs(null)
      setAtivosBdrs(filtrarBdrsLocalmente(cached, filtrosAtuais))
      return
    }

    try {
      await analiseService.cancelarBusca()
    } catch {}
    abortBdrsRef.current?.abort()
    const ctrl = new AbortController()
    abortBdrsRef.current = ctrl
    setLoadingBdrs(true)
    setProgressoBdrs({
      status: 'running',
      done: 0,
      total: 0,
      faltam: 0,
      pct: 0,
      message: `Carregando universo (${labelPeriodoCurto(periodo)})...`,
      recent: [],
      periodo,
    })
    setErrorBdrs(null)
    try {
      const universo = await analiseService.getAtivos('bdrs', filtrosUniversoBdrs(periodo), { signal: ctrl.signal })
      if (ctrl.signal.aborted) return
      universoBdrsRef.current = salvarUniversoPeriodo(universoBdrsRef.current, periodo, universo)
      setUniversoTick((t) => t + 1)
      setAtivosBdrs(filtrarBdrsLocalmente(universo, filtrosBdrsRef.current))
    } catch (error) {
      if (!erroFoiCancelamento(error)) {
        setErrorBdrs(mensagemErroAnalise(error))
      }
    } finally {
      if (abortBdrsRef.current === ctrl) {
        setLoadingBdrs(false)
        setProgressoBdrs(null)
        abortBdrsRef.current = null
      }
    }
  }, [setAtivosBdrs])

  const handleBuscarFiis = useCallback(async (filtrosOverride?: FiltrosAnalise) => {
    const filtrosAtuais = isFiltrosAnalise(filtrosOverride) ? filtrosOverride : filtrosFiisRef.current
    const periodo = periodoDosFiltros(filtrosAtuais)
    const setorial = temFiltroSetorialFiis(filtrosAtuais)
    const cached = obterUniversoPeriodo(universoFiisRef.current, periodo)
    const universoTemMeta = !!cached?.some((a) => a.segmento_fii || a.tipo_fii)

    if (cached && (!setorial || universoTemMeta)) {
      setErrorFiis(null)
      setAtivosFiis(filtrarFiisLocalmente(cached, filtrosAtuais))
      return
    }

    try {
      await analiseService.cancelarBusca()
    } catch {}
    abortFiisRef.current?.abort()
    const ctrl = new AbortController()
    abortFiisRef.current = ctrl
    setLoadingFiis(true)
    setProgressoFiis({
      status: 'running',
      done: 0,
      total: 0,
      faltam: 0,
      pct: 0,
      message: `Carregando universo (${labelPeriodoCurto(periodo)})...`,
      recent: [],
      periodo,
    })
    setErrorFiis(null)
    try {
      if (setorial && !(cached && universoTemMeta)) {
        const dados = await analiseService.getAtivos('fiis', { ...filtrosAtuais, periodo_indicadores: periodo }, { signal: ctrl.signal })
        if (ctrl.signal.aborted) return
        setAtivosFiis(dados)
      } else {
        const novoUniverso = await analiseService.getAtivos('fiis', filtrosUniversoFiis(periodo), { signal: ctrl.signal })
        if (ctrl.signal.aborted) return
        universoFiisRef.current = salvarUniversoPeriodo(universoFiisRef.current, periodo, novoUniverso)
        setUniversoTick((t) => t + 1)
        setAtivosFiis(filtrarFiisLocalmente(novoUniverso, filtrosFiisRef.current))
        void enriquecerUniversoFiis(novoUniverso)
      }
    } catch (error) {
      if (!erroFoiCancelamento(error)) {
        setErrorFiis(mensagemErroAnalise(error))
      }
    } finally {
      if (abortFiisRef.current === ctrl) {
        setLoadingFiis(false)
        setProgressoFiis(null)
        abortFiisRef.current = null
      }
    }
  }, [enriquecerUniversoFiis, setAtivosFiis])

  // Filtros: com cache do período, o useEffect refiltra localmente (sem nova API)
  const handleFiltroAcoesChange = useCallback((key: keyof FiltrosAnalise, value: number) => {
    const nextFiltros = { ...filtrosAcoes, [key]: value }
    setFiltrosAcoes(nextFiltros)
    const periodo = periodoDosFiltros(nextFiltros)
    if (autoSearchAcoes && !obterUniversoPeriodo(universoAcoesRef.current, periodo)) {
      void handleBuscarAcoes(nextFiltros)
    }
  }, [autoSearchAcoes, filtrosAcoes, handleBuscarAcoes, setFiltrosAcoes])

  const handleFiltroAcoesStringChange = useCallback((key: keyof FiltrosAnalise, value: string) => {
    const nextFiltros = { ...filtrosAcoes, [key]: value }
    setFiltrosAcoes(nextFiltros)
    const periodo = periodoDosFiltros(nextFiltros)
    if (autoSearchAcoes && !obterUniversoPeriodo(universoAcoesRef.current, periodo)) {
      void handleBuscarAcoes(nextFiltros)
    }
  }, [autoSearchAcoes, filtrosAcoes, handleBuscarAcoes, setFiltrosAcoes])

  const handleFiltroAcoesExclusaoChange = useCallback((key: 'setores_excluir', value: string[]) => {
    const nextFiltros = { ...filtrosAcoes, [key]: value }
    setFiltrosAcoes(nextFiltros)
    const periodo = periodoDosFiltros(nextFiltros)
    if (autoSearchAcoes && !obterUniversoPeriodo(universoAcoesRef.current, periodo)) {
      void handleBuscarAcoes(nextFiltros)
    }
  }, [autoSearchAcoes, filtrosAcoes, handleBuscarAcoes, setFiltrosAcoes])

  const handleFiltroBdrsChange = useCallback((key: keyof FiltrosAnalise, value: number) => {
    const nextFiltros = { ...filtrosBdrs, [key]: value }
    setFiltrosBdrs(nextFiltros)
    const periodo = periodoDosFiltros(nextFiltros)
    if (autoSearchBdrs && !obterUniversoPeriodo(universoBdrsRef.current, periodo)) {
      void handleBuscarBdrs(nextFiltros)
    }
  }, [autoSearchBdrs, filtrosBdrs, handleBuscarBdrs, setFiltrosBdrs])

  const handleFiltroBdrsStringChange = useCallback((key: keyof FiltrosAnalise, value: string) => {
    const nextFiltros = { ...filtrosBdrs, [key]: value }
    setFiltrosBdrs(nextFiltros)
    const periodo = periodoDosFiltros(nextFiltros)
    if (autoSearchBdrs && !obterUniversoPeriodo(universoBdrsRef.current, periodo)) {
      void handleBuscarBdrs(nextFiltros)
    }
  }, [autoSearchBdrs, filtrosBdrs, handleBuscarBdrs, setFiltrosBdrs])

  const handleFiltroBdrsExclusaoChange = useCallback((key: 'setores_excluir', value: string[]) => {
    const nextFiltros = { ...filtrosBdrs, [key]: value }
    setFiltrosBdrs(nextFiltros)
    const periodo = periodoDosFiltros(nextFiltros)
    if (autoSearchBdrs && !obterUniversoPeriodo(universoBdrsRef.current, periodo)) {
      void handleBuscarBdrs(nextFiltros)
    }
  }, [autoSearchBdrs, filtrosBdrs, handleBuscarBdrs, setFiltrosBdrs])

  const handleFiltroFiisChange = useCallback((key: keyof FiltrosAnalise, value: number) => {
    const nextFiltros = { ...filtrosFiis, [key]: value }
    setFiltrosFiis(nextFiltros)
    const periodo = periodoDosFiltros(nextFiltros)
    if (autoSearchFiis && !obterUniversoPeriodo(universoFiisRef.current, periodo)) {
      void handleBuscarFiis(nextFiltros)
    }
  }, [autoSearchFiis, filtrosFiis, handleBuscarFiis, setFiltrosFiis])

  const handleFiltroFiisStringChange = useCallback((key: keyof FiltrosAnalise, value: string) => {
    const nextFiltros = { ...filtrosFiis, [key]: value }
    setFiltrosFiis(nextFiltros)
    const periodo = periodoDosFiltros(nextFiltros)
    if (autoSearchFiis && !obterUniversoPeriodo(universoFiisRef.current, periodo)) {
      void handleBuscarFiis(nextFiltros)
    }
  }, [autoSearchFiis, filtrosFiis, handleBuscarFiis, setFiltrosFiis])

  const handleFiltroFiisExclusaoChange = useCallback((key: 'segmentos_excluir', value: string[]) => {
    const nextFiltros = { ...filtrosFiis, [key]: value }
    setFiltrosFiis(nextFiltros)
    const periodo = periodoDosFiltros(nextFiltros)
    if (autoSearchFiis && !obterUniversoPeriodo(universoFiisRef.current, periodo)) {
      void handleBuscarFiis(nextFiltros)
    }
  }, [autoSearchFiis, filtrosFiis, handleBuscarFiis, setFiltrosFiis])

  const handlePeriodoAcoesChange = useCallback((periodo: PeriodoIndicadores) => {
    if (periodoDosFiltros(filtrosAcoes) === periodo) return
    const nextFiltros = { ...filtrosAcoes, periodo_indicadores: periodo }
    setFiltrosAcoes(nextFiltros)
    // Se o período já foi buscado: useEffect filtra na hora.
    // Se não: busca só esse período.
    if (!obterUniversoPeriodo(universoAcoesRef.current, periodo)) {
      if (loadingAcoes || autoSearchAcoes || ativosAcoes.length > 0) {
        void handleBuscarAcoes(nextFiltros)
      }
    }
  }, [autoSearchAcoes, ativosAcoes.length, filtrosAcoes, handleBuscarAcoes, loadingAcoes, setFiltrosAcoes])

  const handlePeriodoBdrsChange = useCallback((periodo: PeriodoIndicadores) => {
    if (periodoDosFiltros(filtrosBdrs) === periodo) return
    const nextFiltros = { ...filtrosBdrs, periodo_indicadores: periodo }
    setFiltrosBdrs(nextFiltros)
    if (!obterUniversoPeriodo(universoBdrsRef.current, periodo)) {
      if (loadingBdrs || autoSearchBdrs || ativosBdrs.length > 0) {
        void handleBuscarBdrs(nextFiltros)
      }
    }
  }, [autoSearchBdrs, ativosBdrs.length, filtrosBdrs, handleBuscarBdrs, loadingBdrs, setFiltrosBdrs])

  const handlePeriodoFiisChange = useCallback((periodo: PeriodoIndicadores) => {
    if (periodoDosFiltros(filtrosFiis) === periodo) return
    const nextFiltros = { ...filtrosFiis, periodo_indicadores: periodo }
    setFiltrosFiis(nextFiltros)
    if (!obterUniversoPeriodo(universoFiisRef.current, periodo)) {
      if (loadingFiis || autoSearchFiis || ativosFiis.length > 0) {
        void handleBuscarFiis(nextFiltros)
      }
    }
  }, [autoSearchFiis, ativosFiis.length, filtrosFiis, handleBuscarFiis, loadingFiis, setFiltrosFiis])

  return (
    <div>
      {/* Sub-tabs para tipos de ativos */}
      <div className="bg-card border border-border rounded-2xl p-2 mb-6 shadow-sm">
        <div className="flex overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setActiveSubTab('acoes')}
            className={`flex-1 px-4 py-3 text-sm font-semibold transition-all duration-200 whitespace-nowrap flex-shrink-0 rounded-xl ${
              activeSubTab === 'acoes'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              Ações
            </div>
          </button>
          <button
            onClick={() => setActiveSubTab('bdrs')}
            className={`flex-1 px-4 py-3 text-sm font-semibold transition-all duration-200 whitespace-nowrap flex-shrink-0 rounded-xl ${
              activeSubTab === 'bdrs'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              BDRs
            </div>
          </button>
          <button
            onClick={() => setActiveSubTab('fiis')}
            className={`flex-1 px-4 py-3 text-sm font-semibold transition-all duration-200 whitespace-nowrap flex-shrink-0 rounded-xl ${
              activeSubTab === 'fiis'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              FIIs
            </div>
          </button>
          <button
            onClick={() => setActiveSubTab('cris')}
            className={`flex-1 px-4 py-3 text-sm font-semibold transition-all duration-200 whitespace-nowrap flex-shrink-0 rounded-xl ${
              activeSubTab === 'cris'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              CRIs
            </div>
          </button>
          <button
            onClick={() => setActiveSubTab('cras')}
            className={`flex-1 px-4 py-3 text-sm font-semibold transition-all duration-200 whitespace-nowrap flex-shrink-0 rounded-xl ${
              activeSubTab === 'cras'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              CRAs
            </div>
          </button>
        <button
          onClick={() => setActiveSubTab('debentures')}
          className={`flex-1 px-4 py-3 text-sm font-semibold transition-all duration-200 whitespace-nowrap flex-shrink-0 rounded-xl ${
            activeSubTab === 'debentures'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            Debentures
          </div>
        </button>
        <button
          onClick={() => setActiveSubTab('tesouro')}
          className={`flex-1 px-4 py-3 text-sm font-semibold transition-all duration-200 whitespace-nowrap flex-shrink-0 rounded-xl ${
            activeSubTab === 'tesouro'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Tesouro Direto
          </div>
        </button>
        </div>
      </div>

      {/* Conteúdo das sub-tabs */}
      <AnimatePresence mode="wait">
        {activeSubTab === 'acoes' && (
          <motion.div
            key="acoes"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <FiltrosAcoes 
              filtros={filtrosAcoes}
              onFiltroChange={handleFiltroAcoesChange}
              onFiltroStringChange={handleFiltroAcoesStringChange}
              onExclusaoChange={handleFiltroAcoesExclusaoChange}
              onPeriodoChange={handlePeriodoAcoesChange}
              setoresOpcoes={setoresAcoesOpcoes}
              onBuscar={handleBuscarAcoes}
              loading={loadingAcoes}
              onCancelar={cancelarBuscaAcoes}
              autoSearch={autoSearchAcoes}
              onAutoSearchChange={setAutoSearchAcoes}
            />
            <TabelaAtivos 
              ativos={ativosAcoes} 
              loading={loadingAcoes} 
              error={errorAcoes} 
              tipo="Ações"
              isAtivoNaCarteira={isAtivoNaCarteira}
              onRetry={() => { void handleBuscarAcoes() }}
              periodoLabel={labelPeriodoCurto(periodoDosFiltros(filtrosAcoes))}
              ordenacao={ordenacaoAcoes}
              onOrdenacaoChange={setOrdenacaoAcoes}
              progresso={progressoAcoes}
            />
          </motion.div>
        )}

        {activeSubTab === 'bdrs' && (
          <motion.div
            key="bdrs"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <FiltrosBdrs 
              filtros={filtrosBdrs}
              onFiltroChange={handleFiltroBdrsChange}
              onFiltroStringChange={handleFiltroBdrsStringChange}
              onExclusaoChange={handleFiltroBdrsExclusaoChange}
              onPeriodoChange={handlePeriodoBdrsChange}
              setoresOpcoes={setoresBdrsOpcoes}
              onBuscar={handleBuscarBdrs}
              loading={loadingBdrs}
              onCancelar={cancelarBuscaBdrs}
              autoSearch={autoSearchBdrs}
              onAutoSearchChange={setAutoSearchBdrs}
            />
            <TabelaAtivos 
              ativos={ativosBdrs} 
              loading={loadingBdrs} 
              error={errorBdrs} 
              tipo="BDRs"
              isAtivoNaCarteira={isAtivoNaCarteira}
              onRetry={() => { void handleBuscarBdrs() }}
              periodoLabel={labelPeriodoCurto(periodoDosFiltros(filtrosBdrs))}
              ordenacao={ordenacaoBdrs}
              onOrdenacaoChange={setOrdenacaoBdrs}
              progresso={progressoBdrs}
            />
          </motion.div>
        )}

        {activeSubTab === 'fiis' && (
          <motion.div
            key="fiis"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <FiltrosFiis 
              filtros={filtrosFiis}
              onFiltroChange={handleFiltroFiisChange}
              onFiltroStringChange={handleFiltroFiisStringChange}
              onExclusaoChange={handleFiltroFiisExclusaoChange}
              onPeriodoChange={handlePeriodoFiisChange}
              segmentosOpcoes={segmentosFiisOpcoes}
              onBuscar={handleBuscarFiis}
              loading={loadingFiis}
              onCancelar={cancelarBuscaFiis}
              autoSearch={autoSearchFiis}
              onAutoSearchChange={setAutoSearchFiis}
            />
            <TabelaAtivos 
              ativos={ativosFiis} 
              loading={loadingFiis} 
              error={errorFiis} 
              tipo="FIIs"
              isAtivoNaCarteira={isAtivoNaCarteira}
              fiiMetadataMap={fiiMetadataMap}
              onRetry={() => { void handleBuscarFiis() }}
              periodoLabel={labelPeriodoCurto(periodoDosFiltros(filtrosFiis))}
              progresso={progressoFiis}
            />
          </motion.div>
        )}

        {activeSubTab === 'cris' && (
          <motion.div
            key="cris"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <TabelaCRIs />
          </motion.div>
        )}

        {activeSubTab === 'cras' && (
          <motion.div
            key="cras"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <TabelaCRAs />
          </motion.div>
        )}

        {activeSubTab === 'debentures' && (
          <motion.div
            key="debentures"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <TabelaDebentures />
          </motion.div>
        )}

        {activeSubTab === 'tesouro' && (
          <motion.div
            key="tesouro"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <TabelaTesouroDireto />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Componente para tabela de Tesouro Direto
function TabelaTesouroDireto() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [titulos, setTitulos] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroIndexador, setFiltroIndexador] = useState('')

  const carregarTitulos = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/tesouro-direto/titulos')
      const data = await response.json()
      if (data.titulos) {
        setTitulos(data.titulos)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar títulos do Tesouro Direto')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    carregarTitulos()
  }, [carregarTitulos])

  const abrirTesouroDireto = () => {
    window.open('https://www.tesourodireto.com.br/', '_blank')
  }

  const titulosFiltrados = titulos.filter((titulo: any) => {
    const matchesSearch = titulo.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         titulo.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         titulo.ticker.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesCategoria = !filtroCategoria || titulo.categoria === filtroCategoria
    const matchesIndexador = !filtroIndexador || titulo.indexador_normalizado === filtroIndexador
    
    return matchesSearch && matchesCategoria && matchesIndexador
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto"></div>
          <div className="space-y-2">
            <p className="text-lg font-semibold text-foreground">Carregando Títulos do Tesouro Direto...</p>
            <p className="text-sm text-muted-foreground">Buscando dados do Tesouro Nacional</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-2xl p-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-red-800 dark:text-red-300">Erro ao carregar títulos do Tesouro Direto</p>
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative">
          <input
            type="text"
            placeholder="Buscar títulos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-background text-foreground"
          />
        </div>

        <select
          value={filtroCategoria}
          onChange={(e) => setFiltroCategoria(e.target.value)}
          className="px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-background text-foreground"
          aria-label="Filtrar por categoria"
        >
          <option value="">Todas as categorias</option>
          <option value="Taxa Fixa">Taxa Fixa</option>
          <option value="Taxa Selic">Taxa Selic</option>
          <option value="Inflação (IPCA)">Inflação (IPCA)</option>
          <option value="Educação">Educação</option>
          <option value="Renda">Renda</option>
        </select>

        <select
          value={filtroIndexador}
          onChange={(e) => setFiltroIndexador(e.target.value)}
          className="px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-background text-foreground"
          aria-label="Filtrar por indexador"
        >
          <option value="">Todos os indexadores</option>
          <option value="PREFIXADO">PREFIXADO</option>
          <option value="SELIC">SELIC</option>
          <option value="IPCA">IPCA</option>
        </select>
      </div>

      {/* Lista de Títulos */}
      {titulosFiltrados.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Nenhum título do Tesouro Direto encontrado
          </h3>
          <p className="text-muted-foreground mb-4">
            Tente ajustar os filtros ou verifique sua conexão.
          </p>
          <button
            onClick={carregarTitulos}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            Tentar Novamente
          </button>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          <div className="px-4 py-2 bg-yellow-50 dark:bg-yellow-900/20 border-b border-border">
            <p className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
              <ExternalLink className="h-3 w-3" />
              Clique em qualquer título para acessar o site oficial do Tesouro Direto
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
            {titulosFiltrados.map((titulo: any, index: number) => (
              <div
                key={index}
                onClick={abrirTesouroDireto}
                className="p-4 border border-border rounded-lg hover:border-primary hover:shadow-md transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                      {titulo.nome}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {titulo.codigo} • {titulo.familia_td}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      titulo.tipo_fixacao === 'PRÉ-FIXADO' 
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300'
                        : 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
                    }`}>
                      {titulo.tipo_fixacao}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      titulo.liquidez === 'Alta'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
                        : titulo.liquidez === 'Média'
                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300'
                        : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
                    }`}>
                      {titulo.liquidez}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Vencimento</p>
                    <p className="font-medium text-foreground">
                      {new Date(titulo.vencimento).toLocaleDateString('pt-BR')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {titulo.dias_vencimento} dias
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Preço Unitário</p>
                    <p className="font-medium text-foreground">
                      R$ {titulo.pu.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Indexador</p>
                    <p className="font-medium text-foreground">{titulo.indexador}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Categoria</p>
                    <p className="font-medium text-foreground">{titulo.categoria}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Min: R$ {titulo.valor_minimo.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-muted-foreground">
                    Max: R$ {titulo.valor_maximo.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex items-center justify-center mt-3 text-primary group-hover:text-primary/80 transition-colors">
                  <span className="text-sm font-medium">Clique para investir no site oficial</span>
                  <ExternalLink className="w-4 h-4 ml-1" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
