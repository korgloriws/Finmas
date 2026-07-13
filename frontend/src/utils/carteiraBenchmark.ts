/**
 * Comparação equivalente carteira vs benchmarks:
 * todas as séries partem do mesmo capital na mesma data-âncora do período.
 * Modo R$: "se eu tivesse investido X, quanto teria hoje?"
 * Modo %: variação acumulada desde a âncora.
 */

export type NullableSeries = Array<number | null | undefined>

export function firstValidIndex(series: NullableSeries): number {
  for (let i = 0; i < series.length; i++) {
    const n = Number(series[i])
    if (Number.isFinite(n) && n > 0) return i
  }
  return 0
}

/** Capital de referência no início do período (patrimônio real ou valor atual). */
export function getBenchmarkBaseCapital(
  patrimonioSeries: NullableSeries,
  valorAtual: number
): number {
  for (const v of patrimonioSeries) {
    const n = Number(v)
    if (Number.isFinite(n) && n > 0) return n
  }
  for (let i = patrimonioSeries.length - 1; i >= 0; i--) {
    const n = Number(patrimonioSeries[i])
    if (Number.isFinite(n) && n > 0) return n
  }
  return valorAtual > 0 ? valorAtual : 0
}

export function scaleSeriesToCapital(
  series: NullableSeries,
  anchorIdx: number,
  baseCapital: number
): Array<number | null> {
  const anchorVal = Number(series[anchorIdx])
  if (!Number.isFinite(anchorVal) || anchorVal <= 0 || baseCapital <= 0) {
    return series.map(() => null)
  }
  return series.map((v) => {
    const n = Number(v)
    if (!Number.isFinite(n) || n <= 0) return null
    return baseCapital * (n / anchorVal)
  })
}

export function seriesToPctReturn(
  series: NullableSeries,
  anchorIdx: number
): Array<number | null> {
  const anchorVal = Number(series[anchorIdx])
  if (!Number.isFinite(anchorVal) || anchorVal <= 0) {
    return series.map(() => null)
  }
  return series.map((v) => {
    const n = Number(v)
    if (!Number.isFinite(n) || n <= 0) return null
    return (n / anchorVal - 1) * 100
  })
}

export type HistoricoBenchmarkInput = {
  datas?: string[]
  carteira_price?: NullableSeries
  carteira?: NullableSeries
  carteira_valor?: NullableSeries
  ibov?: NullableSeries
  ivvb11?: NullableSeries
  ifix?: NullableSeries
  ipca?: NullableSeries
  cdi?: NullableSeries
  btc?: NullableSeries
}

export type BenchmarkComparison = {
  anchorIdx: number
  baseCapital: number
  len: number
  carteiraReturnSeries: Array<number | null>
  carteiraRs: Array<number | null>
  carteiraPct: Array<number | null>
  indicesRs: Record<string, Array<number | null>>
  indicesPct: Record<string, Array<number | null>>
}

const BENCHMARK_KEYS = ['ibov', 'ivvb11', 'ifix', 'ipca', 'cdi', 'btc'] as const

export function buildBenchmarkComparison(
  historico: HistoricoBenchmarkInput | null | undefined,
  valorAtual: number
): BenchmarkComparison | null {
  if (!historico) return null

  const carteiraReturnRaw =
    (historico.carteira_price?.length ? historico.carteira_price : historico.carteira) || []

  const len = Math.max(
    historico.datas?.length || 0,
    carteiraReturnRaw.length,
    ...BENCHMARK_KEYS.map((k) => historico[k]?.length || 0)
  )
  if (len <= 0) return null

  const carteiraReturnSeries = Array.from({ length: len }, (_, i) => {
    const n = Number(carteiraReturnRaw[i])
    return Number.isFinite(n) && n > 0 ? n : null
  })

  if (!carteiraReturnSeries.some((v) => v != null)) return null

  const anchorIdx = firstValidIndex(carteiraReturnSeries)
  const baseCapital = getBenchmarkBaseCapital(historico.carteira_valor || [], valorAtual)
  if (baseCapital <= 0) return null

  const carteiraRs = scaleSeriesToCapital(carteiraReturnSeries, anchorIdx, baseCapital)
  const carteiraPct = seriesToPctReturn(carteiraReturnSeries, anchorIdx)

  const indicesRs: Record<string, Array<number | null>> = {}
  const indicesPct: Record<string, Array<number | null>> = {}

  for (const key of BENCHMARK_KEYS) {
    const raw = historico[key] || []
    const series = Array.from({ length: len }, (_, i) => {
      const n = Number(raw[i])
      return Number.isFinite(n) && n > 0 ? n : null
    })
    indicesRs[key] = scaleSeriesToCapital(series, anchorIdx, baseCapital)
    indicesPct[key] = seriesToPctReturn(series, anchorIdx)
  }

  return {
    anchorIdx,
    baseCapital,
    len,
    carteiraReturnSeries,
    carteiraRs,
    carteiraPct,
    indicesRs,
    indicesPct,
  }
}

export function lastValidValue(series: Array<number | null>): number | null {
  for (let i = series.length - 1; i >= 0; i--) {
    const v = series[i]
    if (v != null && Number.isFinite(v)) return v
  }
  return null
}
