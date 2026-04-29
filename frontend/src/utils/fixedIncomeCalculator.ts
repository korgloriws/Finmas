export type FixedIncomeIndexer = 'CDI' | 'IPCA' | 'SELIC' | 'PREFIXADO' | 'CDI+' | 'IPCA+'

type IndicatorRawValue = { valor?: unknown } | number | string | null | undefined

export interface FixedIncomeBaseRates {
  cdi?: IndicatorRawValue
  ipca?: IndicatorRawValue
  selic?: IndicatorRawValue
}

const asNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') {
    const normalized = value.replace(',', '.').trim()
    if (!normalized) return null
    const parsed = Number.parseFloat(normalized)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

const getRawIndicatorValue = (value: IndicatorRawValue): number | null => {
  if (value && typeof value === 'object' && 'valor' in value) {
    return asNumber(value.valor)
  }
  return asNumber(value)
}

const monthlyToAnnualRate = (monthlyRatePercent: number): number => {
  return (Math.pow(1 + monthlyRatePercent / 100, 12) - 1) * 100
}

const dailyToAnnualRate = (dailyRatePercent: number): number => {
  return (Math.pow(1 + dailyRatePercent / 100, 252) - 1) * 100
}

/**
 * Converte valor bruto do indexador para taxa anual em porcentagem.
 * Suporta retornos em formato mensal (%) e anual (%).
 */
export const normalizeIndexerAnnualRate = (
  indexer: Extract<FixedIncomeIndexer, 'CDI' | 'IPCA' | 'SELIC'>,
  rawValue: IndicatorRawValue
): number | null => {
  const raw = getRawIndicatorValue(rawValue)
  if (raw === null || raw <= 0) return null

  // CDI/SELIC podem vir em % ao dia (ex.: 0.054266), mensal ou anual.
  if (indexer === 'CDI' || indexer === 'SELIC') {
    if (raw <= 0.2) return dailyToAnnualRate(raw)
    if (raw <= 2) return monthlyToAnnualRate(raw)
    return raw
  }

  // IPCA costuma vir mensal quando baixo, ou anual em alguns endpoints.
  if (raw <= 2) return monthlyToAnnualRate(raw)
  return raw
}

/**
 * Normaliza percentual do indexador.
 * Ex.: 1.2 (fator) -> 120 (% do indexador).
 */
export const normalizeIndexerPercent = (
  indexer: FixedIncomeIndexer,
  rawPercent: number | null | undefined
): number | null => {
  if (rawPercent === null || rawPercent === undefined || !Number.isFinite(rawPercent) || rawPercent <= 0) {
    // Compatibilidade com dados legados: indexadores-base sem percentual explícito
    // devem ser tratados como 100% do indexador.
    if (indexer === 'CDI' || indexer === 'IPCA' || indexer === 'SELIC') return 100
    return null
  }

  const pct = Number(rawPercent)

  if (indexer === 'CDI' || indexer === 'IPCA' || indexer === 'SELIC') {
    // Compatibilidade com dados antigos/inconsistentes: 1.2 significa 120%.
    if (pct > 0 && pct <= 3) return pct * 100
    return pct
  }

  // Para indexadores de taxa fixa, manter valor informado.
  return pct
}


export const calculateFixedIncomeAnnualRate = (
  indexer: FixedIncomeIndexer,
  indexerPercent: number | null | undefined,
  rates: FixedIncomeBaseRates
): number | null => {
  const normalizedPercent = normalizeIndexerPercent(indexer, indexerPercent)

  if (indexer === 'CDI' || indexer === 'IPCA' || indexer === 'SELIC') {
    if (!normalizedPercent) return null
    const baseAnnual =
      indexer === 'CDI'
        ? normalizeIndexerAnnualRate('CDI', rates.cdi)
        : indexer === 'IPCA'
          ? normalizeIndexerAnnualRate('IPCA', rates.ipca)
          : normalizeIndexerAnnualRate('SELIC', rates.selic)
    if (!baseAnnual) return null
    return (normalizedPercent / 100) * baseAnnual
  }

  if (indexer === 'CDI+') {
    const cdiAnnual = normalizeIndexerAnnualRate('CDI', rates.cdi)
    if (cdiAnnual === null || normalizedPercent === null) return null
    return cdiAnnual + normalizedPercent
  }

  if (indexer === 'IPCA+') {
    const ipcaAnnual = normalizeIndexerAnnualRate('IPCA', rates.ipca)
    if (ipcaAnnual === null || normalizedPercent === null) return null
    return ipcaAnnual + normalizedPercent
  }

  if (indexer === 'PREFIXADO') {
    return normalizedPercent
  }

  return null
}
