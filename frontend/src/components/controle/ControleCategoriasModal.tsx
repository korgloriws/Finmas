import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { controleService } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import { useControleCategorias } from '../../contexts/ControleCategoriasContext'
import type { ControleCategoriaGastoApi } from '../../types'
import {
  normalizeHex,
  getCorSuperficiePreview,
  tryParseLinearGradientTwoStops,
  isCssGradientBackground,
  PRESETS_DEGRADE_CATEGORIA,
} from '../../utils/controleCorUtils'
import { CONTROLE_ICONS_OPCOES } from '../../utils/categoriasDespesas'

const NOVA_CATEGORIA_VALUE = '__nova__'

type CorModo = 'solid' | 'gradient' | 'css'

function corPayloadFromForm(
  corModo: CorModo,
  inputCor: string,
  corCssLivre: string
): string {
  if (corModo === 'css') return (corCssLivre.trim() || '#6B7280')
  if (corModo === 'gradient') return inputCor.trim()
  return normalizeHex(inputCor)
}

function initFormFromApi(row: ControleCategoriaGastoApi) {
  const cor = row.cor?.trim() || '#6B7280'
  const parsed = tryParseLinearGradientTwoStops(cor)
  if (parsed) {
    return {
      corModo: 'gradient' as CorModo,
      inputCor: cor,
      corHex1: parsed.c1,
      corHex2: parsed.c2,
      corAngulo: parsed.angle,
      corCssLivre: '',
    }
  }
  if (isCssGradientBackground(cor)) {
    return {
      corModo: 'css' as CorModo,
      inputCor: cor,
      corHex1: '#8B5CF6',
      corHex2: '#EC4899',
      corAngulo: 135,
      corCssLivre: cor,
    }
  }
  return {
    corModo: 'solid' as CorModo,
    inputCor: normalizeHex(cor),
    corHex1: '#8B5CF6',
    corHex2: '#EC4899',
    corAngulo: 135,
    corCssLivre: '',
  }
}

export default function ControleCategoriasModal({
  open,
  onClose,
  initialSlug = null,
}: {
  open: boolean
  onClose: () => void
  initialSlug?: string | null
}) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { categoriasApi } = useControleCategorias()

  const [editingId, setEditingId] = useState<number | null>(null)
  const [label, setLabel] = useState('')
  const [iconKey, setIconKey] = useState('Receipt')
  const [corModo, setCorModo] = useState<CorModo>('solid')
  const [inputCor, setInputCor] = useState('#6B7280')
  const [corHex1, setCorHex1] = useState('#8B5CF6')
  const [corHex2, setCorHex2] = useState('#EC4899')
  const [corAngulo, setCorAngulo] = useState(135)
  const [corCssLivre, setCorCssLivre] = useState('')

  const resetNovo = useCallback(() => {
    setEditingId(null)
    setLabel('')
    setIconKey('Receipt')
    setCorModo('solid')
    setInputCor('#6B7280')
    setCorHex1('#8B5CF6')
    setCorHex2('#EC4899')
    setCorAngulo(135)
    setCorCssLivre('')
  }, [])

  const iniciarEdicao = useCallback((row: ControleCategoriaGastoApi) => {
    setEditingId(row.id)
    setLabel(row.label)
    setIconKey(row.icon_key || 'Receipt')
    const st = initFormFromApi(row)
    setCorModo(st.corModo)
    setInputCor(st.inputCor)
    setCorHex1(st.corHex1)
    setCorHex2(st.corHex2)
    setCorAngulo(st.corAngulo)
    setCorCssLivre(st.corCssLivre)
  }, [])

  const formularioSemeadoRef = useRef(false)

  useEffect(() => {
    if (!open) {
      formularioSemeadoRef.current = false
      return
    }
    if (formularioSemeadoRef.current) return

    if (initialSlug) {
      const row = categoriasApi.find((c) => c.slug === initialSlug)
      if (!row && categoriasApi.length === 0) return
      if (row) iniciarEdicao(row)
      else resetNovo()
    } else {
      resetNovo()
    }
    formularioSemeadoRef.current = true
  }, [open, initialSlug, categoriasApi, iniciarEdicao, resetNovo])

  const aoEscolherCategoriaNoFormulario = useCallback(
    (valor: string) => {
      if (valor === NOVA_CATEGORIA_VALUE) {
        resetNovo()
        return
      }
      const id = Number.parseInt(valor, 10)
      const row = categoriasApi.find((r) => r.id === id)
      if (row) iniciarEdicao(row)
    },
    [categoriasApi, iniciarEdicao, resetNovo]
  )

  useEffect(() => {
    if (corModo !== 'gradient') return
    const c1 = normalizeHex(corHex1)
    const c2 = normalizeHex(corHex2)
    const ang = Number.isFinite(corAngulo) ? corAngulo : 135
    const clamped = Math.min(360, Math.max(0, ang))
    setInputCor(`linear-gradient(${clamped}deg, ${c1} 0%, ${c2} 100%)`)
  }, [corModo, corHex1, corHex2, corAngulo])

  const preview = useMemo(() => {
    const raw = corPayloadFromForm(corModo, inputCor, corCssLivre)
    return getCorSuperficiePreview(raw)
  }, [corModo, inputCor, corCssLivre])

  const salvarMutation = useMutation({
    mutationFn: async () => {
      const cor = corPayloadFromForm(corModo, inputCor, corCssLivre)
      if (!label.trim()) throw new Error('Informe o nome da categoria')
      if (editingId != null) {
        return controleService.atualizarCategoriaGasto(editingId, {
          label: label.trim(),
          cor,
          icon_key: iconKey || null,
        })
      }
      return controleService.adicionarCategoriaGasto({
        label: label.trim(),
        cor,
        icon_key: iconKey || undefined,
      })
    },
    onSuccess: (res: { success?: boolean; message?: string }) => {
      if (res && typeof res === 'object' && res.success === false) {
        alert(res.message || 'Não foi possível salvar')
        return
      }
      queryClient.invalidateQueries({ queryKey: ['controle-categorias-gasto', user] })
      queryClient.invalidateQueries({ queryKey: ['receitas', user] })
      queryClient.invalidateQueries({ queryKey: ['outros', user] })
      resetNovo()
    },
    onError: (e: unknown) => {
      let msg = 'Erro ao salvar'
      if (axios.isAxiosError(e)) {
        const d = e.response?.data
        if (d && typeof d === 'object' && 'error' in d && typeof (d as { error: unknown }).error === 'string') {
          msg = (d as { error: string }).error
        } else if (d && typeof d === 'object' && 'message' in d && typeof (d as { message: unknown }).message === 'string') {
          msg = (d as { message: string }).message
        } else if (e.message) {
          msg = e.message
        }
      } else if (e instanceof Error && e.message) {
        msg = e.message
      }
      alert(msg)
    },
  })

  const removerMutation = useMutation({
    mutationFn: (id: number) => controleService.removerCategoriaGasto(id),
    onSuccess: (res: { success?: boolean; message?: string }) => {
      if (res && typeof res === 'object' && res.success === false) {
        alert(res.message || 'Não foi possível remover')
        return
      }
      queryClient.invalidateQueries({ queryKey: ['controle-categorias-gasto', user] })
      queryClient.invalidateQueries({ queryKey: ['receitas', user] })
      queryClient.invalidateQueries({ queryKey: ['outros', user] })
      resetNovo()
    },
    onError: (e: unknown) => {
      let msg = 'Erro ao remover categoria'
      if (axios.isAxiosError(e)) {
        const d = e.response?.data
        if (d && typeof d === 'object' && 'error' in d && typeof (d as { error: unknown }).error === 'string') {
          msg = (d as { error: string }).error
        } else if (e.message) {
          msg = e.message
        }
      }
      alert(msg)
    },
  })

  const handleRemover = (row: ControleCategoriaGastoApi) => {
    if (
      !confirm(
        `Remover a categoria "${row.label}"? Lançamentos dessa categoria passam para Outros.`
      )
    )
      return
    removerMutation.mutate(row.id)
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 overflow-y-auto py-8 px-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Categorias de gastos</h3>
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                aria-label="Fechar"
              >
                <X size={20} />
              </button>
            </div>

            <p className="text-sm text-muted-foreground mb-4">
              Monte nome, ícone e cores no formulário abaixo; nada é enviado ao servidor até você usar o
              botão no final (Criar categoria ou Aplicar alterações). As mesmas categorias aparecem nas
              despesas, receitas e gráficos. O slug interno é criado na primeira gravação e não muda ao
              renomear.
            </p>

            <div className="rounded-xl border border-border p-4 space-y-3 bg-muted/15 mb-4">
              <h4 className="text-sm font-semibold">Formulário</h4>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Categoria
                </label>
                <select
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
                  aria-label="Escolher categoria existente ou nova"
                  value={editingId == null ? NOVA_CATEGORIA_VALUE : String(editingId)}
                  onChange={(e) => aoEscolherCategoriaNoFormulario(e.target.value)}
                >
                  <option value={NOVA_CATEGORIA_VALUE}>Nova categoria</option>
                  {categoriasApi.map((row) => (
                    <option key={row.id} value={String(row.id)}>
                      {row.label} ({row.slug})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground mt-1.5">
                  Preencha os campos e use Aplicar para gravar; nada é enviado antes disso.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Nome
                </label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
                  placeholder="Ex.: Educação"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Ícone
                </label>
                <select
                  value={iconKey}
                  onChange={(e) => setIconKey(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
                  aria-label="Ícone da categoria"
                >
                  {CONTROLE_ICONS_OPCOES.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>

              <div
                className="h-14 rounded-lg px-3 flex flex-col justify-center gap-0.5 overflow-hidden border box-border text-sm"
                style={{
                  background: preview.background,
                  border: preview.border,
                  color: preview.color,
                }}
              >
                <span className="font-semibold truncate">{label || 'Nome da categoria'}</span>
                <span className="text-xs truncate" style={{ color: preview.mutedColor }}>
                  Prévia nos gráficos e listas
                </span>
              </div>

              <div className="flex rounded-lg bg-muted/60 p-1 gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setCorModo('solid')
                    setInputCor(normalizeHex(corHex1))
                  }}
                  className={`flex-1 px-2 py-1.5 rounded-md text-xs font-medium ${
                    corModo === 'solid'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground'
                  }`}
                >
                  Cor sólida
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCorHex1(normalizeHex(inputCor))
                    setCorModo('gradient')
                  }}
                  className={`flex-1 px-2 py-1.5 rounded-md text-xs font-medium ${
                    corModo === 'gradient'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground'
                  }`}
                >
                  Degradê
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCorCssLivre(inputCor)
                    setCorModo('css')
                  }}
                  className={`flex-1 px-2 py-1.5 rounded-md text-xs font-medium ${
                    corModo === 'css'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground'
                  }`}
                >
                  CSS avançado
                </button>
              </div>

              {corModo === 'solid' && (
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="color"
                    value={
                      /^#[0-9A-Fa-f]{6}$/.test(normalizeHex(inputCor))
                        ? normalizeHex(inputCor)
                        : '#6B7280'
                    }
                    onChange={(e) => {
                      setCorModo('solid')
                      setInputCor(e.target.value.toUpperCase())
                    }}
                    className="h-10 w-14 cursor-pointer rounded border border-border bg-background p-1"
                    aria-label="Seletor de cor sólida"
                  />
                  <input
                    type="text"
                    value={inputCor}
                    onChange={(e) => setInputCor(e.target.value)}
                    onBlur={() => setInputCor(normalizeHex(inputCor))}
                    className="flex-1 min-w-[8rem] px-3 py-2 border border-border rounded-md bg-background font-mono text-sm"
                    placeholder="#RRGGBB"
                    aria-label="Hex da cor sólida"
                  />
                </div>
              )}

              {corModo === 'gradient' && (
                <>
                  <div className="flex flex-wrap gap-3">
                    <div>
                      <span className="text-xs text-muted-foreground block mb-1">Cor 1</span>
                      <div className="flex gap-2 items-center">
                        <input
                          type="color"
                          value={normalizeHex(corHex1)}
                          onChange={(e) => setCorHex1(e.target.value.toUpperCase())}
                          className="h-9 w-12 rounded border border-border p-1"
                          aria-label="Cor 1 do degradê"
                        />
                        <input
                          type="text"
                          value={corHex1}
                          onChange={(e) => setCorHex1(e.target.value)}
                          onBlur={() => setCorHex1(normalizeHex(corHex1))}
                          className="w-24 px-2 py-1 border border-border rounded font-mono text-xs"
                          aria-label="Hex cor 1"
                        />
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block mb-1">Cor 2</span>
                      <div className="flex gap-2 items-center">
                        <input
                          type="color"
                          value={normalizeHex(corHex2)}
                          onChange={(e) => setCorHex2(e.target.value.toUpperCase())}
                          className="h-9 w-12 rounded border border-border p-1"
                          aria-label="Cor 2 do degradê"
                        />
                        <input
                          type="text"
                          value={corHex2}
                          onChange={(e) => setCorHex2(e.target.value)}
                          onBlur={() => setCorHex2(normalizeHex(corHex2))}
                          className="w-24 px-2 py-1 border border-border rounded font-mono text-xs"
                          aria-label="Hex cor 2"
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">
                      Ângulo: {Math.min(360, Math.max(0, corAngulo))}°
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={360}
                      value={Math.min(360, Math.max(0, corAngulo))}
                      onChange={(e) => setCorAngulo(parseInt(e.target.value, 10))}
                      className="w-full"
                      aria-label="Ângulo do degradê em graus"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {PRESETS_DEGRADE_CATEGORIA.map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => {
                          setCorModo('gradient')
                          setCorHex1(p.cor1)
                          setCorHex2(p.cor2)
                          setCorAngulo(p.angulo)
                        }}
                        className="px-2 py-1 text-xs rounded-md border border-border bg-background hover:bg-muted/80"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {corModo === 'css' && (
                <textarea
                  value={corCssLivre}
                  onChange={(e) => setCorCssLivre(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background font-mono text-xs min-h-[72px]"
                  placeholder="linear-gradient(135deg, #6366F1 0%, #EC4899 100%)"
                />
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  disabled={salvarMutation.isPending}
                  onClick={() => salvarMutation.mutate()}
                  className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm disabled:opacity-50"
                >
                  {salvarMutation.isPending
                    ? 'Aplicando…'
                    : editingId != null
                      ? 'Aplicar alterações'
                      : 'Criar categoria'}
                </button>
                {editingId != null && (
                  <button
                    type="button"
                    onClick={resetNovo}
                    className="px-4 py-2 rounded-lg bg-muted text-muted-foreground text-sm"
                  >
                    Voltar para nova
                  </button>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-border p-3 mb-1">
              <h4 className="text-sm font-semibold text-foreground mb-2">Categorias salvas</h4>
              <p className="text-xs text-muted-foreground mb-2">
                Para alterar uma categoria existente, escolha-a no campo &quot;Categoria&quot; acima. Aqui você
                pode remover (lançamentos vão para Outros).
              </p>
              <div className="rounded-lg border border-border divide-y divide-border max-h-40 overflow-y-auto">
                {categoriasApi.map((row) => (
                  <div
                    key={row.id}
                    className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/40"
                  >
                    <span
                      className="w-3 h-3 rounded-full shrink-0 border border-border"
                      style={{
                        background: row.cor?.trim().startsWith('linear-gradient')
                          ? row.cor
                          : normalizeHex(row.cor || '#6B7280'),
                      }}
                    />
                    <span className="flex-1 truncate font-medium">{row.label}</span>
                    <span className="text-xs text-muted-foreground truncate max-w-[5rem] hidden sm:inline">
                      {row.slug}
                    </span>
                    <button
                      type="button"
                      className="px-2 py-1 rounded-md text-xs font-medium border border-border hover:bg-muted text-destructive disabled:opacity-40 disabled:pointer-events-none shrink-0"
                      disabled={row.slug === 'outros'}
                      onClick={() => handleRemover(row)}
                    >
                      Remover
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
