export function formatCurrency(value: number | null | undefined, prefix = 'R$'): string {
  if (value == null || !Number.isFinite(Number(value))) return '-'
  const v = Number(value)
  
  if (Math.abs(v) >= 1e9) {
    return `${prefix} ${(v / 1e9).toFixed(2)} bi`.replace('.', ',')
  }
  if (Math.abs(v) >= 1e6) {
    return `${prefix} ${(v / 1e6).toFixed(2)} mi`.replace('.', ',')
  }
  
  return `${prefix} ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatPercentage(value: number | null | undefined, decimals = 2): string {
  if (value == null || !Number.isFinite(Number(value))) return '-'
  const v = Number(value)
  return `${v.toFixed(decimals)}%`.replace('.', ',')
}

export function formatNumber(value: number | null | undefined, decimals = 2): string {
  if (value == null || !Number.isFinite(Number(value))) return '-'
  const v = Number(value)
  return v.toFixed(decimals).replace('.', ',')
}

export function formatDividendYield(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value))) return '-'
  const v = Number(value)
  
  // Se o valor for maior que 1, já está em percentual
  if (v > 1) {
    return `${v.toFixed(2)}%`.replace('.', ',')
  }
  // Se for menor que 1, multiplicar por 100
  return `${(v * 100).toFixed(2)}%`.replace('.', ',')
}

export function normalizeTicker(ticker: string): string {
  const normalized = ticker.trim().toUpperCase()
  
  // Se já tem ponto ou hífen, retorna como está
  if (normalized.includes('.') || normalized.includes('-')) {
    return normalized
  }
  
  // Verifica se termina em número (ações brasileiras)
  const endsWithNumber = /[0-9]$/.test(normalized)
  
  if (endsWithNumber) {
    return normalized + '.SA'
  }
  
  return normalized
} 


export function formatDate(dateString: string): string {
  if (!dateString) return '-'
  
  // Se já está no formato YYYY-MM-DD, parsear diretamente
  const parts = dateString.split('-')
  if (parts.length === 3) {
    const [year, month, day] = parts
    // Criar data local (não UTC) para evitar problemas de timezone
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    return date.toLocaleDateString('pt-BR')
  }
  
  // Se for outro formato, tentar parsear normalmente
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('pt-BR')
} 