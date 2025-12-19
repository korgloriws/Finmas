/**
 
 * @param ticker -
 * @returns 
 */
export function normalizeTicker(ticker: string): string {
  if (!ticker) return ''

  const cleanTicker = ticker.trim().toUpperCase()
  
  // Se já tem hífen ou ponto, retorna como está (já está normalizado)
  if (cleanTicker.includes('-') || cleanTicker.includes('.')) {
    return cleanTicker
  }
  
  // Verifica se termina em número (0-9)
  // Ações brasileiras terminam em números: PETR4, VALE3, ITUB4, VISC11, etc.
  // ADRs e Stocks não terminam em números: BYDYY, STLA, AAPL, TSLA, etc.
  const endsWithNumber = /[0-9]$/.test(cleanTicker)
  
  if (endsWithNumber) {
    // Termina em número → ação brasileira → adiciona .SA
    return `${cleanTicker}.SA`
  }
  
  // Não termina em número → ADR/Stock → retorna sem .SA
  return cleanTicker
}

/**
 * Remove a extensão .SA de um ticker se presente
 * @param ticker - O ticker com possível extensão
 * @returns O ticker sem extensão
 */
export function removeTickerExtension(ticker: string): string {
  if (!ticker) return ''
  
  // Remove .SA, .O, etc
  return ticker.replace(/\.(SA|O|N|TO|V|UN|AT|PR|PN|PA|PB|PC|PD|PE|PF|PG|PH|PI|PJ|PK|PL|PM|PO|PP|PQ|PR|PS|PT|PU|PV|PW|PX|PY|PZ)$/i, '')
}

/**
 * Verifica se um ticker é brasileiro (tem .SA)
 * @param ticker - O ticker para verificar
 * @returns true se for brasileiro
 */
export function isBrazilianTicker(ticker: string): boolean {
  return ticker.toUpperCase().includes('.SA')
}

/**
 * Obtém o ticker base (sem extensão) para exibição
 * @param ticker - O ticker completo
 * @returns O ticker base para exibição
 */
export function getDisplayTicker(ticker: string): string {
  return removeTickerExtension(ticker)
} 