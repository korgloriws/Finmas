import { useControleCategorias } from '../../contexts/ControleCategoriasContext'

const GERENCIAR = '__gerenciar_categorias__'

export default function ControleCategoriaSelect({
  value,
  onChange,
  id,
  className,
  disabled,
  allowEmpty,
  emptyLabel = 'Sem categoria',
  ariaLabel = 'Categoria',
}: {
  value: string
  onChange: (v: string) => void
  id?: string
  className?: string
  disabled?: boolean
  allowEmpty?: boolean
  emptyLabel?: string
  ariaLabel?: string
}) {
  const { categorias, openGerenciarCategorias } = useControleCategorias()

  return (
    <select
      id={id}
      disabled={disabled}
      className={className}
      value={value}
      onChange={(e) => {
        const v = e.target.value
        if (v === GERENCIAR) {
          openGerenciarCategorias(value || undefined)
          return
        }
        onChange(v)
      }}
      aria-label={ariaLabel}
    >
      {allowEmpty && <option value="">{emptyLabel}</option>}
      {categorias.map((c) => (
        <option key={c.value} value={c.value}>
          {c.label}
        </option>
      ))}
      <option value={GERENCIAR}>— Gerenciar categorias…</option>
    </select>
  )
}
