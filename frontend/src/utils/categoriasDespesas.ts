import {
  Heart,
  ShoppingCart,
  Home,
  Baby,
  Zap,
  Utensils,
  Car,
  Gamepad2,
  Receipt,
  CreditCard,
  TrendingUp,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ControleCategoriaGastoApi } from '../types'

export interface CategoriaDespesa {
  value: string
  label: string
  icon: LucideIcon
  color: string
}

export const CATEGORIAS_DESPESAS: CategoriaDespesa[] = [
  { value: 'farmacia',       label: 'Farmácia',          icon: Heart,        color: '#ef4444' },
  { value: 'supermercado',   label: 'Supermercado',      icon: ShoppingCart, color: '#10b981' },
  { value: 'contas_casa',    label: 'Contas da Casa',    icon: Home,         color: '#3b82f6' },
  { value: 'contas_filhos',  label: 'Contas dos Filhos', icon: Baby,         color: '#f59e0b' },
  { value: 'despesas_fixas', label: 'Despesas Fixas',    icon: Zap,          color: '#8b5cf6' },
  { value: 'saude',          label: 'Saúde',             icon: Heart,        color: '#ec4899' },
  { value: 'alimentacao',    label: 'Alimentação',       icon: Utensils,     color: '#f97316' },
  { value: 'transporte',     label: 'Transporte',        icon: Car,          color: '#06b6d4' },
  { value: 'lazer',          label: 'Lazer',             icon: Gamepad2,     color: '#84cc16' },
  { value: 'cartao',         label: 'Cartão',            icon: CreditCard,   color: '#0ea5e9' },
  { value: 'investimentos',  label: 'Investimentos',     icon: TrendingUp,   color: '#14b8a6' },
  { value: 'outros',         label: 'Outros',            icon: Receipt,      color: '#6b7280' },
]

export const CATEGORIA_OUTROS: CategoriaDespesa =
  CATEGORIAS_DESPESAS.find((c) => c.value === 'outros') ?? CATEGORIAS_DESPESAS[CATEGORIAS_DESPESAS.length - 1]

const ICON_REGISTRY: Record<string, LucideIcon> = {
  Heart,
  ShoppingCart,
  Home,
  Baby,
  Zap,
  Utensils,
  Car,
  Gamepad2,
  Receipt,
  CreditCard,
  TrendingUp,
}

/** Ícones disponíveis ao criar/editar categoria no controle. */
export const CONTROLE_ICONS_OPCOES = Object.keys(ICON_REGISTRY).sort() as string[]

export function resolveControleCategoryIcon(key: string | null | undefined): LucideIcon {
  if (key && ICON_REGISTRY[key]) return ICON_REGISTRY[key]
  return Receipt
}

export function mapControleApiToCategoria(row: ControleCategoriaGastoApi): CategoriaDespesa {
  return {
    value: row.slug,
    label: row.label,
    icon: resolveControleCategoryIcon(row.icon_key),
    color: row.cor,
  }
}

export function getCategoriaDespesa(
  value: string | null | undefined,
  catalog?: CategoriaDespesa[]
): CategoriaDespesa {
  const base = catalog && catalog.length > 0 ? catalog : CATEGORIAS_DESPESAS
  const fallback =
    base.find((c) => c.value === 'outros') ?? CATEGORIA_OUTROS
  if (!value) return fallback
  const hit = base.find((c) => c.value === value)
  if (hit) return hit
  return {
    value,
    label: value,
    icon: Receipt,
    color: '#94a3b8',
  }
}
