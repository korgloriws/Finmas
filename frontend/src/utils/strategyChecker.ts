import { FiltrosAnalise } from '../types'

/**
 * Verifica se um ativo atende aos critérios de filtros baseado no tipo
 */
export function verificarEstrategia(
  tipoAtivo: 'Ação' | 'BDR' | 'FII',
  filtros: FiltrosAnalise,
  dados: {
    roePct: number | null
    dyPct: number | null
    pl: number | null
    pvp: number | null
    liquidezDiaria: number
    netDebtEbitda?: number | null
  }
): {
  meets: boolean
  criteria: Array<{ label: string; value: string; ok: boolean }>
} {
  const { roePct, dyPct, pl, pvp, liquidezDiaria, netDebtEbitda } = dados
  const criteria: Array<{ label: string; value: string; ok: boolean }> = []

  if (tipoAtivo === 'FII') {
    // FIIs: DY entre min e max, liquidez mínima
    const c1 = dyPct != null && 
      (filtros.dy_min == null || dyPct >= filtros.dy_min) &&
      (filtros.dy_max == null || dyPct <= filtros.dy_max)
    
    const c2 = liquidezDiaria >= (filtros.liq_min || 0)
    
    criteria.push({
      label: `DY ${filtros.dy_min != null ? `≥ ${filtros.dy_min}%` : ''}${filtros.dy_max != null ? ` ≤ ${filtros.dy_max}%` : ''}`,
      ok: Boolean(c1),
      value: dyPct != null ? `${dyPct.toFixed(2)}%` : '-'
    })
    
    criteria.push({
      label: `Liquidez ≥ ${(filtros.liq_min || 0).toLocaleString('pt-BR')}`,
      ok: Boolean(c2),
      value: liquidezDiaria.toLocaleString('pt-BR')
    })

    return {
      meets: Boolean(c1 && c2),
      criteria
    }
  }

  if (tipoAtivo === 'BDR') {
    // BDRs: ROE, DY, P/L, P/VP, liquidez, net_debt/ebitda
    const c1 = roePct != null && (filtros.roe_min == null || roePct >= filtros.roe_min)
    const c2 = dyPct != null && (filtros.dy_min == null || dyPct >= filtros.dy_min)
    const c3 = pl != null && 
      (filtros.pl_min == null || pl >= filtros.pl_min) &&
      (filtros.pl_max == null || pl <= filtros.pl_max)
    const c4 = pvp != null && (filtros.pvp_max == null || pvp <= filtros.pvp_max)
    const c5 = liquidezDiaria >= (filtros.liq_min || 0)
    const c6 = netDebtEbitda == null || filtros.net_debt_ebitda_max == null || netDebtEbitda <= filtros.net_debt_ebitda_max

    criteria.push({
      label: `ROE ≥ ${filtros.roe_min || 0}%`,
      ok: Boolean(c1),
      value: roePct != null ? `${roePct.toFixed(2)}%` : '-'
    })
    
    criteria.push({
      label: `DY ≥ ${filtros.dy_min || 0}%`,
      ok: Boolean(c2),
      value: dyPct != null ? `${dyPct.toFixed(2)}%` : '-'
    })
    
    criteria.push({
      label: `P/L ${filtros.pl_min != null ? `≥ ${filtros.pl_min}` : ''} ${filtros.pl_max != null ? `≤ ${filtros.pl_max}` : ''}`,
      ok: Boolean(c3),
      value: pl != null ? pl.toFixed(2) : '-'
    })
    
    criteria.push({
      label: `P/VP ≤ ${filtros.pvp_max || 0}`,
      ok: Boolean(c4),
      value: pvp != null ? pvp.toFixed(2) : '-'
    })
    
    criteria.push({
      label: `Liquidez ≥ ${(filtros.liq_min || 0).toLocaleString('pt-BR')}`,
      ok: Boolean(c5),
      value: liquidezDiaria.toLocaleString('pt-BR')
    })

    if (filtros.net_debt_ebitda_max != null) {
      criteria.push({
        label: `Dívida/EBITDA ≤ ${filtros.net_debt_ebitda_max}`,
        ok: Boolean(c6),
        value: netDebtEbitda != null ? netDebtEbitda.toFixed(2) : '-'
      })
    }

    return {
      meets: Boolean(c1 && c2 && c3 && c4 && c5 && c6),
      criteria
    }
  }

  // Ações (default)
  const c1 = roePct != null && (filtros.roe_min == null || roePct >= filtros.roe_min)
  const c2 = dyPct != null && (filtros.dy_min == null || dyPct >= filtros.dy_min)
  const c3 = pl != null && 
    (filtros.pl_min == null || pl >= filtros.pl_min) &&
    (filtros.pl_max == null || pl <= filtros.pl_max)
  const c4 = pvp != null && (filtros.pvp_max == null || pvp <= filtros.pvp_max)
  const c5 = liquidezDiaria >= (filtros.liq_min || 0)
  const c6 = netDebtEbitda == null || filtros.net_debt_ebitda_max == null || netDebtEbitda <= filtros.net_debt_ebitda_max

  criteria.push({
    label: `ROE ≥ ${filtros.roe_min || 0}%`,
    ok: Boolean(c1),
    value: roePct != null ? `${roePct.toFixed(2)}%` : '-'
  })
  
  criteria.push({
    label: `DY ≥ ${filtros.dy_min || 0}%`,
    ok: Boolean(c2),
    value: dyPct != null ? `${dyPct.toFixed(2)}%` : '-'
  })
  
  criteria.push({
    label: `P/L ${filtros.pl_min != null ? `≥ ${filtros.pl_min}` : ''} ${filtros.pl_max != null ? `≤ ${filtros.pl_max}` : ''}`,
    ok: Boolean(c3),
    value: pl != null ? pl.toFixed(2) : '-'
  })
  
  criteria.push({
    label: `P/VP ≤ ${filtros.pvp_max || 0}`,
    ok: Boolean(c4),
    value: pvp != null ? pvp.toFixed(2) : '-'
  })
  
  criteria.push({
    label: `Liquidez ≥ ${(filtros.liq_min || 0).toLocaleString('pt-BR')}`,
    ok: Boolean(c5),
    value: liquidezDiaria.toLocaleString('pt-BR')
  })

  if (filtros.net_debt_ebitda_max != null) {
    criteria.push({
      label: `Dívida/EBITDA ≤ ${filtros.net_debt_ebitda_max}`,
      ok: Boolean(c6),
      value: netDebtEbitda != null ? netDebtEbitda.toFixed(2) : '-'
    })
  }

  return {
    meets: Boolean(c1 && c2 && c3 && c4 && c5 && c6),
    criteria
  }
}

