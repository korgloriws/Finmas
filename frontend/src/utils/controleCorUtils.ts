/** Utilitários de cor para categorias do controle e gráficos (hex, degradê, CSS). */

export function normalizeHex(input: string): string {
  let t = input.trim()
  if (!t.startsWith('#')) t = `#${t}`
  const short = /^#([0-9A-Fa-f]{3})$/.exec(t)
  if (short) {
    const [, m] = short
    t = `#${m[0]}${m[0]}${m[1]}${m[1]}${m[2]}${m[2]}`
  }
  const full = /^#([0-9A-Fa-f]{6})$/.exec(t)
  if (full) return `#${full[1]}`.toUpperCase()
  return '#6B7280'
}

export function isCssGradientBackground(cor: string): boolean {
  const c = cor.trim().toLowerCase()
  return (
    c.includes('linear-gradient') ||
    c.includes('radial-gradient') ||
    c.includes('conic-gradient')
  )
}

export function extractHexesFromCss(css: string): string[] {
  const found = css.match(/#[0-9A-Fa-f]{3,8}\b/gi) ?? []
  return [...new Set(found.map((h) => normalizeHex(h)))]
}

export function tryParseLinearGradientTwoStops(cor: string): { angle: number; c1: string; c2: string } | null {
  const t = cor.trim().replace(/\s+/g, ' ')
  const m =
    /^linear-gradient\s*\(\s*(\d+)\s*deg\s*,\s*(#[0-9A-Fa-f]{3,8})(?:\s+\d+%)?\s*,\s*(#[0-9A-Fa-f]{3,8})(?:\s+\d+%)?\s*\)$/i.exec(
      t
    )
  if (!m) return null
  return {
    angle: parseInt(m[1], 10),
    c1: normalizeHex(m[2]),
    c2: normalizeHex(m[3]),
  }
}

export function relativeLuminanceHex(hex: string): number {
  const h = normalizeHex(hex).slice(1)
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  const lin = [r, g, b].map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  )
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]
}

export type CorSuperficiePreview = {
  background: string
  border: string
  color: string
  mutedColor: string
}

export function getCorSuperficiePreview(cor: string): CorSuperficiePreview {
  const raw = cor.trim()
  const mutedDark = 'rgba(15, 23, 42, 0.72)'
  const primaryDark = '#0f172a'
  const mutedLight = 'rgba(248, 250, 252, 0.76)'
  const primaryLight = '#f8fafc'

  if (!raw) {
    return {
      background: '#6B7280',
      border: '1px solid rgba(15, 23, 42, 0.14)',
      color: primaryDark,
      mutedColor: mutedDark,
    }
  }
  if (isCssGradientBackground(raw)) {
    const hexes = extractHexesFromCss(raw)
    const L =
      hexes.length > 0
        ? hexes.reduce((s, x) => s + relativeLuminanceHex(x), 0) / hexes.length
        : 0.35
    const darkBg = L <= 0.55
    return {
      background: raw,
      border: darkBg ? '1px solid rgba(248, 250, 252, 0.22)' : '1px solid rgba(15, 23, 42, 0.14)',
      color: darkBg ? primaryLight : primaryDark,
      mutedColor: darkBg ? mutedLight : mutedDark,
    }
  }
  const hex = normalizeHex(raw)
  const L = relativeLuminanceHex(hex)
  const darkBg = L <= 0.55
  return {
    background: hex,
    border: darkBg ? '1px solid rgba(248, 250, 252, 0.22)' : '1px solid rgba(15, 23, 42, 0.14)',
    color: darkBg ? primaryLight : primaryDark,
    mutedColor: darkBg ? mutedLight : mutedDark,
  }
}

/** Cor sólida para preenchimento de gráficos (Recharts etc.). */
export function corParaFillGrafico(cor: string): string {
  const t = cor.trim()
  if (!t) return '#6B7280'
  if (!isCssGradientBackground(t)) {
    return normalizeHex(t)
  }
  const hexes = extractHexesFromCss(t)
  return hexes[0] ? normalizeHex(hexes[0]) : '#6B7280'
}

export const PRESETS_DEGRADE_CATEGORIA = [
  { label: 'Roxo → Rosa', cor1: '#8B5CF6', cor2: '#EC4899', angulo: 135 },
  { label: 'Azul → Ciano', cor1: '#2563EB', cor2: '#22D3EE', angulo: 135 },
  { label: 'Verde → Lima', cor1: '#059669', cor2: '#84CC16', angulo: 120 },
  { label: 'Laranja → Vermelho', cor1: '#F97316', cor2: '#DC2626', angulo: 135 },
] as const
