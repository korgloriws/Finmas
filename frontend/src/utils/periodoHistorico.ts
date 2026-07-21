/** Períodos do gráfico de evolução (estilo Detalhes / Google Finance). */
export type PeriodoHistoricoCarteira = '1d' | '1w' | '1m' | '3m' | '6m' | '1y' | '5y' | 'max'

export const PERIODOS_HISTORICO_CARTEIRA: Array<{ value: PeriodoHistoricoCarteira; label: string }> = [
  { value: '1d', label: '1D' },
  { value: '1w', label: '1S' },
  { value: '1m', label: '1M' },
  { value: '3m', label: '3M' },
  { value: '6m', label: '6M' },
  { value: '1y', label: '1A' },
  { value: '5y', label: '5A' },
  { value: 'max', label: 'Máx' },
]

export function labelPeriodoHistorico(periodo: string): string {
  return PERIODOS_HISTORICO_CARTEIRA.find((p) => p.value === periodo)?.label || periodo
}
