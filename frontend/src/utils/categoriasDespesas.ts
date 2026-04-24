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

export function getCategoriaDespesa(value: string | null | undefined): CategoriaDespesa {
  if (!value) return CATEGORIA_OUTROS
  return CATEGORIAS_DESPESAS.find((c) => c.value === value) ?? CATEGORIA_OUTROS
}
