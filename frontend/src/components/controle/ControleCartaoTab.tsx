import { useState, useCallback, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  CreditCard, Plus, Edit, Trash2, 
  DollarSign, ShoppingCart, X, ChevronDown
} from 'lucide-react'
import { cartaoService } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import { formatCurrency } from '../../utils/formatters'
import { CartaoCadastrado, CompraCartao, BandeiraCartao, CategoriaCompra } from '../../types'
import logoMastercard from '../../assets/Mastercard-Logo.wine.svg'
import logoVisa from '../../assets/Visa_Inc._logo_(2005–2014).png'


interface ControleCartaoTabProps {
  filtroMes: string
  filtroAno: string
  ocultarValores: boolean
}

const BANDEIRAS_CARTAO: BandeiraCartao[] = [
  { value: 'visa', label: 'Visa', cor: '#1A1F71', icone: '' },
  { value: 'mastercard', label: 'Mastercard', cor: '#EB001B', icone: '' },
  { value: 'american-express', label: 'American Express', cor: '#006FCF', icone: '' },
  { value: 'elo', label: 'Elo', cor: '#FFD700', icone: '' },
  { value: 'hipercard', label: 'Hipercard', cor: '#FF6B35', icone: '' },
  { value: 'diners', label: 'Diners Club', cor: '#004B87', icone: '' },
  { value: 'discover', label: 'Discover', cor: '#FF6000', icone: '' },
  { value: 'jcb', label: 'JCB', cor: '#000000', icone: '' },
  { value: 'outro', label: 'Outro', cor: '#6B7280', icone: '' }
]

const CATEGORIAS_COMPRA: CategoriaCompra[] = [
  { value: 'alimentacao', label: 'Alimentação', cor: '#F59E0B', icone: '' },
  { value: 'transporte', label: 'Transporte', cor: '#3B82F6', icone: '' },
  { value: 'lazer', label: 'Lazer', cor: '#8B5CF6', icone: '' },
  { value: 'saude', label: 'Saúde', cor: '#EF4444', icone: '' },
  { value: 'educacao', label: 'Educação', cor: '#10B981', icone: '' },
  { value: 'vestuario', label: 'Vestuário', cor: '#F97316', icone: '' },
  { value: 'casa', label: 'Casa', cor: '#84CC16', icone: '' },
  { value: 'servicos', label: 'Serviços', cor: '#06B6D4', icone: '' },
  { value: 'outros', label: 'Outros', cor: '#6B7280', icone: '' }
]

type CorModoCartao = 'solid' | 'gradient' | 'css'

type CartaoCardPresentation = {
  background: string
  border: string
  color: string
  mutedColor: string
  /** Fundo escuro → texto claro; hover dos ícones usa overlay claro */
  usesLightInk: boolean
}

function normalizeHex(input: string): string {
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

function relativeLuminanceHex(hex: string): number {
  const h = normalizeHex(hex).slice(1)
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  const lin = [r, g, b].map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  )
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]
}

function contrastingUiFromLuminance(L: number): {
  primary: string
  muted: string
  borderSoft: string
  usesLightInk: boolean
} {
  const darkBg = L <= 0.55
  return darkBg
    ? {
        primary: '#f8fafc',
        muted: 'rgba(248, 250, 252, 0.76)',
        borderSoft: 'rgba(248, 250, 252, 0.22)',
        usesLightInk: true,
      }
    : {
        primary: '#0f172a',
        muted: 'rgba(15, 23, 42, 0.72)',
        borderSoft: 'rgba(15, 23, 42, 0.14)',
        usesLightInk: false,
      }
}

function extractHexesFromCss(css: string): string[] {
  const found = css.match(/#[0-9A-Fa-f]{3,8}\b/gi) ?? []
  return [...new Set(found.map((h) => normalizeHex(h)))]
}

function isCssGradientBackground(cor: string): boolean {
  const c = cor.trim().toLowerCase()
  return (
    c.includes('linear-gradient') ||
    c.includes('radial-gradient') ||
    c.includes('conic-gradient')
  )
}

function getCartaoCardPresentation(cor: string): CartaoCardPresentation {
  const raw = cor.trim()
  if (!raw) {
    const fb = '#6B7280'
    const L = relativeLuminanceHex(fb)
    const ui = contrastingUiFromLuminance(L)
    return {
      background: fb,
      border: `1px solid ${ui.borderSoft}`,
      color: ui.primary,
      mutedColor: ui.muted,
      usesLightInk: ui.usesLightInk,
    }
  }
  if (isCssGradientBackground(raw)) {
    const hexes = extractHexesFromCss(raw)
    const L =
      hexes.length > 0
        ? hexes.reduce((s, x) => s + relativeLuminanceHex(x), 0) / hexes.length
        : 0.35
    const ui = contrastingUiFromLuminance(L)
    return {
      background: raw,
      border: `1px solid ${ui.borderSoft}`,
      color: ui.primary,
      mutedColor: ui.muted,
      usesLightInk: ui.usesLightInk,
    }
  }
  const hex = normalizeHex(raw)
  const L = relativeLuminanceHex(hex)
  const ui = contrastingUiFromLuminance(L)
  return {
    background: hex,
    border: `1px solid ${ui.borderSoft}`,
    color: ui.primary,
    mutedColor: ui.muted,
    usesLightInk: ui.usesLightInk,
  }
}

function tryParseLinearGradientTwoStops(cor: string): { angle: number; c1: string; c2: string } | null {
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

const PRESETS_DEGRADE: { label: string; cor1: string; cor2: string; angulo: number }[] = [
  { label: 'Roxo → Rosa', cor1: '#8B5CF6', cor2: '#EC4899', angulo: 135 },
  { label: 'Azul → Ciano', cor1: '#2563EB', cor2: '#22D3EE', angulo: 135 },
  { label: 'Verde → Lima', cor1: '#059669', cor2: '#84CC16', angulo: 120 },
  { label: 'Laranja → Vermelho', cor1: '#F97316', cor2: '#DC2626', angulo: 135 },
  { label: 'Índigo → Roxo', cor1: '#4F46E5', cor2: '#9333EA', angulo: 145 },
  { label: 'Noturno', cor1: '#0F172A', cor2: '#334155', angulo: 160 },
]

export default function ControleCartaoTab({ 
  filtroMes, 
  filtroAno, 
  ocultarValores
}: ControleCartaoTabProps) {
  const { user } = useAuth()
  
  const [inputNome, setInputNome] = useState('')
  const [inputBandeira, setInputBandeira] = useState('')
  const [inputLimite, setInputLimite] = useState('')
  const [inputVencimento, setInputVencimento] = useState('')
  const [inputCor, setInputCor] = useState('#1A1F71')
  const [corModo, setCorModo] = useState<CorModoCartao>('solid')
  const [corHex1, setCorHex1] = useState('#8B5CF6')
  const [corHex2, setCorHex2] = useState('#EC4899')
  const [corAngulo, setCorAngulo] = useState(135)
  const [corCssLivre, setCorCssLivre] = useState('')

  const [inputCompraNome, setInputCompraNome] = useState('')
  const [inputCompraValor, setInputCompraValor] = useState('')
  const [inputCompraData, setInputCompraData] = useState('')
  const [inputCompraCategoria, setInputCompraCategoria] = useState('')
  const [inputCompraObservacao, setInputCompraObservacao] = useState('')


  const [cartaoSelecionado, setCartaoSelecionado] = useState<number | null>(null)
  const [mostrarFormularioCartao, setMostrarFormularioCartao] = useState(false)
  const [mostrarFormularioCompra, setMostrarFormularioCompra] = useState(false)
  const [modoValorTotal, setModoValorTotal] = useState(false)
  const [editingCartaoId, setEditingCartaoId] = useState<number | null>(null)
  const [editandoCartao, setEditandoCartao] = useState(false)
  const [mostrarModalPagamento, setMostrarModalPagamento] = useState(false)
  const [cartaoParaPagar, setCartaoParaPagar] = useState<CartaoCadastrado | null>(null)
  const [mesPagamento, setMesPagamento] = useState<string>(String(new Date().getMonth() + 1).padStart(2, '0'))
  const [anoPagamento, setAnoPagamento] = useState<string>(String(new Date().getFullYear()))

  const queryClient = useQueryClient()

  // SEGURANCA: Incluir user em todas as queryKeys para isolamento entre usuários
  // Queries
  const { data: cartoes, isLoading: cartoesLoading } = useQuery<CartaoCadastrado[]>({
    queryKey: ['cartoes-cadastrados', user, filtroMes, filtroAno],
    queryFn: () => cartaoService.getCartoesCadastrados(),
    enabled: !!user,
    retry: 1,
    refetchOnWindowFocus: false,
  })


  const { data: compras, isLoading: comprasLoading } = useQuery<CompraCartao[]>({
    queryKey: ['compras-cartao', user, cartaoSelecionado, filtroMes, filtroAno],
    queryFn: () => cartaoService.getComprasCartao(cartaoSelecionado!, filtroMes, filtroAno),
    enabled: !!user && !!cartaoSelecionado,
    retry: 1,
    refetchOnWindowFocus: false,
  })

  const { data: totalCompras, isLoading: totalLoading } = useQuery<number>({
    queryKey: ['total-compras-cartao', user, cartaoSelecionado, filtroMes, filtroAno],
    queryFn: () => cartaoService.getTotalComprasCartao(cartaoSelecionado!, filtroMes, filtroAno),
    enabled: !!user && !!cartaoSelecionado,
    retry: 1,
    refetchOnWindowFocus: false,
  })

  // Mutations
  const adicionarCartaoMutation = useMutation({
    mutationFn: cartaoService.adicionarCartaoCadastrado,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cartoes-cadastrados', user] })
      limparFormularioCartao()
    },
  })

  const atualizarCartaoMutation = useMutation({
    mutationFn: cartaoService.atualizarCartaoCadastrado,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cartoes-cadastrados', user] })
      setEditingCartaoId(null)
      setEditandoCartao(false)
      limparFormularioCartao()
    },
  })


  const removerCartaoMutation = useMutation({
    mutationFn: cartaoService.removerCartaoCadastrado,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cartoes-cadastrados', user] })
      if (cartaoSelecionado === editingCartaoId) {
        setCartaoSelecionado(null)
      }
    },
  })

  const adicionarCompraMutation = useMutation({
    mutationFn: cartaoService.adicionarCompraCartao,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compras-cartao', user] })
      queryClient.invalidateQueries({ queryKey: ['total-compras-cartao', user] })
      limparFormularioCompra()
    },
  })


  const removerCompraMutation = useMutation({
    mutationFn: cartaoService.removerCompraCartao,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compras-cartao', user] })
      queryClient.invalidateQueries({ queryKey: ['total-compras-cartao', user] })
    },
  })

  const marcarCartaoPagoMutation = useMutation({
    mutationFn: ({ cartaoId, mesPagamento, anoPagamento }: { cartaoId: number, mesPagamento: number, anoPagamento: number }) =>
      cartaoService.marcarCartaoComoPago(cartaoId, mesPagamento, anoPagamento),
    onSuccess: () => {
      // Invalidar todas as queries relacionadas
      queryClient.invalidateQueries({ queryKey: ['cartoes-cadastrados', user] })
      queryClient.invalidateQueries({ queryKey: ['outros', user] })
      queryClient.invalidateQueries({ queryKey: ['receitas-despesas', user] })
      queryClient.invalidateQueries({ queryKey: ['marmitas', user] })
      queryClient.invalidateQueries({ queryKey: ['receitas', user] })
      queryClient.invalidateQueries({ queryKey: ['saldo', user] })
      
      // Forçar refetch das queries principais
      queryClient.refetchQueries({ queryKey: ['outros', user] })
      queryClient.refetchQueries({ queryKey: ['receitas-despesas', user] })
      queryClient.refetchQueries({ queryKey: ['saldo', user] })
      
      // Mostrar notificação de sucesso
      alert('Cartão marcado como pago! A despesa foi adicionada, o saldo foi atualizado e o limite foi devolvido.')
      
      setMostrarModalPagamento(false)
      setCartaoParaPagar(null)
    },
    onError: (error) => {
      console.error('Erro ao marcar cartão como pago:', error)
      alert('Erro ao marcar cartão como pago. Tente novamente.')
    },
  })

  const desmarcarCartaoPagoMutation = useMutation({
    mutationFn: cartaoService.desmarcarCartaoComoPago,
    onSuccess: () => {

      queryClient.invalidateQueries({ queryKey: ['cartoes-cadastrados', user] })
      queryClient.invalidateQueries({ queryKey: ['outros', user] })
      queryClient.invalidateQueries({ queryKey: ['receitas-despesas', user] })
      queryClient.invalidateQueries({ queryKey: ['marmitas', user] })
      queryClient.invalidateQueries({ queryKey: ['receitas', user] })
      queryClient.invalidateQueries({ queryKey: ['saldo', user] })
      
 
      queryClient.refetchQueries({ queryKey: ['outros', user] })
      queryClient.refetchQueries({ queryKey: ['receitas-despesas', user] })
      queryClient.refetchQueries({ queryKey: ['saldo', user] })
      

      alert('Cartão desmarcado como pago! A despesa foi removida e o saldo foi atualizado.')
    },
    onError: (error) => {
      console.error('Erro ao desmarcar cartão como pago:', error)
      alert('Erro ao desmarcar cartão como pago. Tente novamente.')
    },
  })

  // Funções auxiliares
  const resetCamposCartaoPadrao = useCallback(() => {
    setInputNome('')
    setInputBandeira('visa')
    setInputLimite('')
    setInputVencimento('')
    setInputCor('#1A1F71')
    setCorModo('solid')
    setCorHex1('#8B5CF6')
    setCorHex2('#EC4899')
    setCorAngulo(135)
    setCorCssLivre('')
  }, [])

  const limparFormularioCartao = useCallback(() => {
    resetCamposCartaoPadrao()
    setMostrarFormularioCartao(false)
    setEditandoCartao(false)
    setEditingCartaoId(null)
  }, [resetCamposCartaoPadrao])

  useEffect(() => {
    if (corModo !== 'gradient') return
    const c1 = normalizeHex(corHex1)
    const c2 = normalizeHex(corHex2)
    const clamped = Math.min(360, Math.max(0, Number.isFinite(corAngulo) ? corAngulo : 135))
    setInputCor(`linear-gradient(${clamped}deg, ${c1} 0%, ${c2} 100%)`)
  }, [corModo, corHex1, corHex2, corAngulo])

  const iniciarEdicaoCartao = useCallback((cartao: CartaoCadastrado) => {
    setEditingCartaoId(cartao.id)
    setEditandoCartao(true)
    setInputNome(cartao.nome)
    setInputBandeira(cartao.bandeira)
    setInputLimite(cartao.limite.toString())
    setInputVencimento(cartao.vencimento.toString())
    const parsed = tryParseLinearGradientTwoStops(cartao.cor)
    if (parsed) {
      setCorModo('gradient')
      setCorHex1(parsed.c1)
      setCorHex2(parsed.c2)
      setCorAngulo(parsed.angle)
      setInputCor(cartao.cor)
      setCorCssLivre('')
    } else if (isCssGradientBackground(cartao.cor)) {
      setCorModo('css')
      setCorCssLivre(cartao.cor)
      setInputCor(cartao.cor)
    } else {
      setCorModo('solid')
      const hex = normalizeHex(cartao.cor)
      setInputCor(hex)
      setCorCssLivre('')
    }
    setMostrarFormularioCartao(true)
  }, [])

  const cancelarEdicaoCartao = useCallback(() => {
    setEditingCartaoId(null)
    setEditandoCartao(false)
    limparFormularioCartao()
  }, [limparFormularioCartao])

  const limparFormularioCompra = useCallback(() => {
    setInputCompraNome('')
    setInputCompraValor('')
    setInputCompraData('')
    setInputCompraCategoria('alimentacao')
    setInputCompraObservacao('')
    setMostrarFormularioCompra(false)
  }, [])

  const handleToggleModo = useCallback((novoModo: boolean) => {
    setModoValorTotal(novoModo)
    // Limpar formulário quando mudar de modo
    setInputCompraNome('')
    setInputCompraValor('')
    setInputCompraData('')
    setInputCompraCategoria('alimentacao')
    setInputCompraObservacao('')
  }, [])

  // Handlers
  const handleAdicionarCartao = useCallback(() => {
    if (!inputNome || !inputLimite || !inputVencimento) return

    const limite = parseFloat(inputLimite.replace(',', '.'))
    const vencimento = parseInt(inputVencimento)
    
    if (!isFinite(limite) || limite <= 0 || !isFinite(vencimento) || vencimento < 1 || vencimento > 31) return

    const corPayload =
      corModo === 'css'
        ? (corCssLivre.trim() || '#6B7280')
        : corModo === 'gradient'
          ? inputCor.trim()
          : normalizeHex(inputCor)

    if (editandoCartao && editingCartaoId) {
      atualizarCartaoMutation.mutate({
        id: editingCartaoId,
        nome: inputNome,
        bandeira: inputBandeira,
        limite,
        vencimento,
        cor: corPayload
      })
    } else {
      adicionarCartaoMutation.mutate({
        nome: inputNome,
        bandeira: inputBandeira,
        limite,
        vencimento,
        cor: corPayload
      })
    }
  }, [
    inputNome,
    inputBandeira,
    inputLimite,
    inputVencimento,
    inputCor,
    corModo,
    corCssLivre,
    editandoCartao,
    editingCartaoId,
    adicionarCartaoMutation,
    atualizarCartaoMutation,
  ])

  const handleAdicionarCompra = useCallback(() => {
    if (!inputCompraNome || !inputCompraValor || !cartaoSelecionado) return

    const valor = parseFloat(inputCompraValor.replace(',', '.'))
    if (!isFinite(valor) || valor <= 0) return

    adicionarCompraMutation.mutate({
      cartao_id: cartaoSelecionado,
      nome: inputCompraNome,
      valor,
      data: inputCompraData || new Date().toISOString().split('T')[0],
      categoria: inputCompraCategoria,
      observacao: inputCompraObservacao || undefined
    })
  }, [inputCompraNome, inputCompraValor, inputCompraData, inputCompraCategoria, inputCompraObservacao, cartaoSelecionado, adicionarCompraMutation])

  const handleRemoverCartao = useCallback((id: number) => {
    if (confirm('Tem certeza que deseja remover este cartão?')) {
      removerCartaoMutation.mutate(id)
    }
  }, [removerCartaoMutation])

  const handleRemoverCompra = useCallback((id: number) => {
    if (confirm('Tem certeza que deseja remover esta compra?')) {
      removerCompraMutation.mutate(id)
    }
  }, [removerCompraMutation])

  const handleMarcarComoPago = useCallback((cartao: CartaoCadastrado) => {
    setCartaoParaPagar(cartao)
    setMostrarModalPagamento(true)
  }, [])

  const handleConfirmarPagamento = useCallback(() => {
    if (cartaoParaPagar) {
      marcarCartaoPagoMutation.mutate({
        cartaoId: cartaoParaPagar.id,
        mesPagamento: parseInt(mesPagamento),
        anoPagamento: parseInt(anoPagamento)
      })
    }
  }, [cartaoParaPagar, mesPagamento, anoPagamento, marcarCartaoPagoMutation])

  const handleDesmarcarPagamento = useCallback((cartaoId: number) => {
    if (confirm('Tem certeza que deseja desmarcar este cartão como pago? A despesa correspondente será removida.')) {
      desmarcarCartaoPagoMutation.mutate(cartaoId)
    }
  }, [desmarcarCartaoPagoMutation])

  const handleDefinirValorTotal = useCallback(() => {
    if (!cartaoSelecionado || !inputCompraValor) return
    
    const valor = parseFloat(inputCompraValor.replace(',', '.'))
    if (isNaN(valor) || valor <= 0) {
      alert('Por favor, insira um valor válido')
      return
    }

    // Adicionar como uma compra única com o valor total
    adicionarCompraMutation.mutate({
      cartao_id: cartaoSelecionado,
      nome: 'Valor Total da Fatura',
      valor: valor,
      data: inputCompraData || new Date().toISOString().split('T')[0],
      categoria: 'outros',
      observacao: 'Valor total definido pelo usuário'
    })
  }, [cartaoSelecionado, inputCompraValor, inputCompraData, adicionarCompraMutation])

  // Cálculos
  const cartaoAtual = useMemo(() => {
    if (!cartaoSelecionado || !cartoes) return null
    return cartoes.find((c: CartaoCadastrado) => c.id === cartaoSelecionado)
  }, [cartaoSelecionado, cartoes])

  const limiteRestante = useMemo(() => {
    if (!cartaoAtual || !totalCompras) return 0
    return cartaoAtual.limite - totalCompras
  }, [cartaoAtual, totalCompras])

  const percentualUso = useMemo(() => {
    if (!cartaoAtual || !totalCompras) return 0
    return (totalCompras / cartaoAtual.limite) * 100
  }, [cartaoAtual, totalCompras])

  const previewCartaoForm = useMemo(() => {
    const raw =
      corModo === 'css'
        ? corCssLivre.trim() || '#6B7280'
        : corModo === 'gradient'
          ? (() => {
              const c1 = normalizeHex(corHex1)
              const c2 = normalizeHex(corHex2)
              const ang = Number.isFinite(corAngulo) ? corAngulo : 135
              const clamped = Math.min(360, Math.max(0, ang))
              return `linear-gradient(${clamped}deg, ${c1} 0%, ${c2} 100%)`
            })()
          : normalizeHex(inputCor)
    return getCartaoCardPresentation(raw)
  }, [corModo, corCssLivre, inputCor, corHex1, corHex2, corAngulo])

  // Estados de loading combinados
  const isLoading = cartoesLoading || comprasLoading || totalLoading

  return (
    <div className="space-y-6">
      {/* Animação de Carregamento */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex items-center justify-center py-12"
          >
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                <CreditCard className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-primary" />
              </div>
              <div className="text-center">
                <p className="text-lg font-medium text-foreground">Carregando cartões...</p>
                <p className="text-sm text-muted-foreground">Aguarde enquanto buscamos seus dados</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Conteúdo Principal */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: isLoading ? 0.3 : 1 }}
        transition={{ duration: 0.3 }}
        className={isLoading ? 'pointer-events-none' : ''}
      >
        {/* Cabeçalho */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Cartões de Crédito</h2>
            <p className="text-muted-foreground">Gerencie seus cartões e compras</p>
          </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              resetCamposCartaoPadrao()
              setEditingCartaoId(null)
              setEditandoCartao(false)
              setMostrarFormularioCartao(true)
            }}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 flex items-center gap-2"
          >
            <Plus size={20} />
            Novo Cartão
          </button>
        </div>
      </div>

      {/* Lista de Cartões */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cartoes?.map((cartao: CartaoCadastrado) => {
          const bandeira = BANDEIRAS_CARTAO.find(b => b.value === cartao.bandeira) || BANDEIRAS_CARTAO[0]
          const isSelected = cartaoSelecionado === cartao.id
          const cardPresentation = getCartaoCardPresentation(cartao.cor)

          return (
            <motion.div
              key={cartao.id}
              className={`relative p-6 rounded-xl cursor-pointer transition-all duration-200 ${
                isSelected 
                  ? 'ring-2 ring-blue-500 shadow-lg scale-105' 
                  : 'hover:shadow-md hover:scale-102'
              } ${editingCartaoId === cartao.id ? 'ring-2 ring-yellow-500' : ''}`}
              style={{
                background: cardPresentation.background,
                border: cardPresentation.border,
                color: cardPresentation.color,
              }}
              onClick={() => {
                if (cartaoSelecionado === cartao.id) {
                  setCartaoSelecionado(null)
                  setMostrarFormularioCompra(false)
                } else {
                  setCartaoSelecionado(cartao.id)
                  setMostrarFormularioCompra(false)
                }
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {/* Bandeira */}
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium" style={{ color: cardPresentation.mutedColor }}>
                  {bandeira.label}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      iniciarEdicaoCartao(cartao)
                    }}
                    className={`p-1 rounded transition-colors ${
                      cardPresentation.usesLightInk ? 'hover:bg-white/15' : 'hover:bg-black/10'
                    } ${editingCartaoId === cartao.id ? (cardPresentation.usesLightInk ? 'bg-white/15' : 'bg-black/10') : ''}`}
                    style={{ color: cardPresentation.color }}
                    title={editingCartaoId === cartao.id ? 'Editando cartão' : 'Editar cartão'}
                  >
                    <Edit size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemoverCartao(cartao.id)
                    }}
                    className="p-1 rounded text-red-600 hover:bg-red-600/15 dark:text-red-400 dark:hover:bg-red-400/15"
                    title="Remover cartão"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Nome do Cartão */}
              <h3 className="text-lg font-semibold mb-2">
                {cartao.nome}
              </h3>

              {/* Limite */}
              <div className="mb-2">
                <p className="text-sm" style={{ color: cardPresentation.mutedColor }}>
                  Limite
                </p>
                <p className="text-xl font-bold">
                  {ocultarValores ? '••••••' : formatCurrency(cartao.limite)}
                </p>
              </div>

              {/* Vencimento */}
              <div className="mb-4">
                <p className="text-sm" style={{ color: cardPresentation.mutedColor }}>
                  Vencimento
                </p>
                <p className="text-lg font-semibold">
                  {cartao.vencimento}º
                </p>
              </div>

              {/* Status */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${
                    cartao.ativo ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                  <span className="text-xs" style={{ color: cardPresentation.mutedColor }}>
                    {cartao.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                {isSelected && (
                  <ChevronDown size={16} style={{ color: cardPresentation.mutedColor }} />
                )}
              </div>

              {(cartao.bandeira === 'visa' || cartao.bandeira === 'mastercard') && (
                <div className="mt-4 flex justify-end pointer-events-none select-none" aria-hidden>
                  <img
                    src={cartao.bandeira === 'visa' ? logoVisa : logoMastercard}
                    alt=""
                    className={
                      cartao.bandeira === 'visa'
                        ? 'h-7 sm:h-8 w-auto max-w-[84px] object-contain object-right opacity-95'
                        : 'h-9 sm:h-10 w-auto max-w-[56px] object-contain object-right opacity-95'
                    }
                    draggable={false}
                  />
                </div>
              )}

              {/* Botões de Pagamento */}
              <div className="mt-3 flex gap-2">
                {Boolean(cartao.pago) ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDesmarcarPagamento(cartao.id)
                    }}
                    className="flex-1 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm flex items-center justify-center gap-2"
                    disabled={desmarcarCartaoPagoMutation.isPending}
                  >
                    <X size={14} />
                    Desmarcar Pago
                  </button>
                ) : (
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleMarcarComoPago(cartao)
                    }}
                    className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm flex items-center justify-center gap-2 relative z-10"
                  >
                    <DollarSign size={14} />
                    Marcar Pago
                  </button>
                )}
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Detalhes do Cartão Selecionado */}
      <AnimatePresence>
        {cartaoSelecionado && cartaoAtual && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-card border border-border rounded-2xl p-6 shadow-xl"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-semibold text-foreground">
                  {cartaoAtual.nome}
                </h3>
                <p className="text-muted-foreground">
                  {BANDEIRAS_CARTAO.find(b => b.value === cartaoAtual.bandeira)?.label}
                </p>
              </div>
              <button
                onClick={() => setMostrarFormularioCompra(true)}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 flex items-center gap-2"
              >
                <Plus size={16} />
                Nova Compra
              </button>
            </div>

            {/* Estatísticas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-card border border-border rounded-2xl p-4 shadow-xl">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <DollarSign className="w-5 h-5 text-primary" />
                  </div>
                  <span className="text-sm font-medium text-muted-foreground">Limite</span>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {ocultarValores ? '••••••' : formatCurrency(cartaoAtual.limite)}
                </p>
              </div>

              <div className="bg-card border border-border rounded-2xl p-4 shadow-xl">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <ShoppingCart className="w-5 h-5 text-destructive" />
                  </div>
                  <span className="text-sm font-medium text-muted-foreground">Gasto</span>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {ocultarValores ? '••••••' : formatCurrency(totalCompras || 0)}
                </p>
              </div>

              <div className="bg-card border border-border rounded-2xl p-4 shadow-xl">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <CreditCard className="w-5 h-5 text-positive" />
                  </div>
                  <span className="text-sm font-medium text-muted-foreground">Disponível</span>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {ocultarValores ? '••••••' : formatCurrency(limiteRestante)}
                </p>
              </div>
            </div>

            {/* Barra de Progresso */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-muted-foreground">Uso do Limite</span>
                <span className="text-sm font-bold text-foreground">
                  {percentualUso.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all duration-300 ${
                    percentualUso > 90 ? 'bg-red-500' :
                    percentualUso > 70 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(percentualUso, 100)}%` }}
                />
              </div>
            </div>

            {/* Lista de Compras */}
            <div>
              <h4 className="text-lg font-semibold text-foreground mb-4">
                Compras do Mês
              </h4>
              {compras && compras.length > 0 ? (
                <div className="space-y-2">
                  {compras.map((compra) => {
                    const categoria = CATEGORIAS_COMPRA.find(c => c.value === compra.categoria) || CATEGORIAS_COMPRA[CATEGORIAS_COMPRA.length - 1]
                    
                    return (
                      <div
                        key={compra.id}
                        className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className="w-3 h-3 rounded-full shrink-0 border border-border"
                            style={{ backgroundColor: categoria.cor }}
                            aria-hidden
                          />
                          <div>
                            <p className="font-medium text-foreground">{compra.nome}</p>
                            <p className="text-sm text-muted-foreground">
                              {categoria.label} • {new Date(compra.data).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-foreground">
                            {ocultarValores ? '••••' : formatCurrency(compra.valor)}
                          </p>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleRemoverCompra(compra.id)}
                              className="p-1 text-destructive hover:bg-destructive/10 rounded"
                              title="Remover compra"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <ShoppingCart className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma compra registrada este mês</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Formulário de Cartão */}
      <AnimatePresence>
        {mostrarFormularioCartao && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto py-8"
            onClick={cancelarEdicaoCartao}
          >
            <motion.div
              className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg mx-4 shadow-xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-foreground">
                  {editandoCartao ? 'Editar Cartão' : 'Novo Cartão'}
                </h3>
                <button
                  onClick={cancelarEdicaoCartao}
                  className="p-1 text-muted-foreground hover:text-foreground"
                  title="Fechar formulário"
                  aria-label="Fechar formulário"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Nome do Cartão
                  </label>
                  <input
                    type="text"
                    value={inputNome}
                    onChange={(e) => setInputNome(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Ex: Cartão Nubank"
                    aria-label="Nome do cartão"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Bandeira
                  </label>
                  <select
                    value={inputBandeira}
                    onChange={(e) => setInputBandeira(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    aria-label="Bandeira do cartão"
                  >
                    {BANDEIRAS_CARTAO.map((bandeira) => (
                      <option key={bandeira.value} value={bandeira.value}>
                        {bandeira.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Limite
                  </label>
                  <input
                    type="text"
                    value={inputLimite}
                    onChange={(e) => setInputLimite(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="0,00"
                    aria-label="Limite do cartão"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Dia de Vencimento
                  </label>
                  <input
                    type="number"
                    value={inputVencimento}
                    onChange={(e) => setInputVencimento(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="15"
                    min="1"
                    max="31"
                    aria-label="Dia de vencimento"
                  />
                </div>

                <div className="rounded-xl border border-border p-4 space-y-3 bg-muted/20">
                  <label className="block text-sm font-medium text-foreground">
                    Cor do cartão
                  </label>
                  <div
                    className="h-16 rounded-lg px-3 flex flex-col justify-center gap-0.5 transition-all duration-200 overflow-hidden box-border"
                    style={{
                      background: previewCartaoForm.background,
                      border: previewCartaoForm.border,
                      color: previewCartaoForm.color,
                    }}
                    aria-hidden
                  >
                    <span className="text-sm font-semibold truncate">
                      Prévia da leitura
                    </span>
                    <span className="text-xs truncate" style={{ color: previewCartaoForm.mutedColor }}>
                      Texto secundário sobre o fundo
                    </span>
                  </div>
                  <div className="flex rounded-lg bg-muted/60 p-1 gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setCorModo('solid')
                        setInputCor(normalizeHex(corHex1))
                      }}
                      className={`flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        corModo === 'solid'
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground'
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
                      className={`flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        corModo === 'gradient'
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground'
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
                      className={`flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        corModo === 'css'
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      CSS avançado
                    </button>
                  </div>

                  {corModo === 'solid' && (
                    <>
                      <div className="flex flex-wrap items-center gap-3">
                        <label className="text-xs text-muted-foreground whitespace-nowrap">
                          Cor do fundo
                        </label>
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
                          title="Escolher cor"
                          aria-label="Seletor de cor"
                        />
                        <input
                          type="text"
                          value={inputCor}
                          onChange={(e) => setInputCor(e.target.value)}
                          onBlur={() => setInputCor(normalizeHex(inputCor))}
                          className="flex-1 min-w-[8rem] px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                          placeholder="#RRGGBB ou RRGGBB"
                          spellCheck={false}
                          aria-label="Cor em hexadecimal"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Fundo totalmente sólido. Aceita #RGB ou #RRGGBB; inválido vira cinza ao sair do
                        campo. O texto do cartão ajusta contraste automaticamente (claro ou escuro).
                      </p>
                    </>
                  )}

                  {corModo === 'gradient' && (
                    <>
                      <div className="flex flex-wrap gap-3 items-end">
                        <div className="space-y-1">
                          <span className="text-xs text-muted-foreground">Cor 1</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={normalizeHex(corHex1)}
                              onChange={(e) => setCorHex1(e.target.value.toUpperCase())}
                              className="h-10 w-14 cursor-pointer rounded border border-border bg-background p-1"
                              aria-label="Primeira cor do degradê"
                            />
                            <input
                              type="text"
                              value={corHex1}
                              onChange={(e) => setCorHex1(e.target.value)}
                              onBlur={() => setCorHex1(normalizeHex(corHex1))}
                              className="w-28 px-2 py-2 border border-border rounded-md bg-background font-mono text-sm"
                              spellCheck={false}
                              aria-label="Hex cor 1"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <span className="text-xs text-muted-foreground">Cor 2</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={normalizeHex(corHex2)}
                              onChange={(e) => setCorHex2(e.target.value.toUpperCase())}
                              className="h-10 w-14 cursor-pointer rounded border border-border bg-background p-1"
                              aria-label="Segunda cor do degradê"
                            />
                            <input
                              type="text"
                              value={corHex2}
                              onChange={(e) => setCorHex2(e.target.value)}
                              onBlur={() => setCorHex2(normalizeHex(corHex2))}
                              className="w-28 px-2 py-2 border border-border rounded-md bg-background font-mono text-sm"
                              spellCheck={false}
                              aria-label="Hex cor 2"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-1">
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
                          aria-label="Ângulo do degradê"
                        />
                      </div>
                      <div className="space-y-2">
                        <span className="text-xs font-medium text-muted-foreground">
                          Sugestões
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {PRESETS_DEGRADE.map((p) => (
                            <button
                              key={p.label}
                              type="button"
                              onClick={() => {
                                setCorModo('gradient')
                                setCorHex1(p.cor1)
                                setCorHex2(p.cor2)
                                setCorAngulo(p.angulo)
                              }}
                              className="px-2 py-1 text-xs rounded-md border border-border bg-background hover:bg-muted/80 transition-colors"
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground font-mono break-all">
                        Valor salvo: {inputCor}
                      </p>
                    </>
                  )}

                  {corModo === 'css' && (
                    <>
                      <textarea
                        value={corCssLivre}
                        onChange={(e) => setCorCssLivre(e.target.value)}
                        className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring min-h-[88px]"
                        placeholder='Ex.: linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)'
                        spellCheck={false}
                        aria-label="CSS do fundo do cartão"
                      />
                      <p className="text-xs text-muted-foreground">
                        Cole ou escreva um valor CSS válido para{' '}
                        <code className="text-foreground">background</code> (degradês lineares,
                        radiais etc.).
                      </p>
                    </>
                  )}
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <button
                  onClick={handleAdicionarCartao}
                  disabled={adicionarCartaoMutation.isPending}
                  className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {(adicionarCartaoMutation.isPending || atualizarCartaoMutation.isPending) ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  {editandoCartao ? 'Salvar Alterações' : 'Adicionar Cartão'}
                </button>
                <button
                  onClick={cancelarEdicaoCartao}
                  className="px-4 py-2 bg-muted text-muted-foreground rounded-md hover:bg-muted/80"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Formulário de Compra */}
      <AnimatePresence>
        {mostrarFormularioCompra && cartaoSelecionado && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setMostrarFormularioCompra(false)}
          >
            <motion.div
              className="bg-card border border-border rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-foreground">
                  {modoValorTotal ? 'Definir Valor Total' : 'Nova Compra'}
                </h3>
                <button
                  onClick={() => setMostrarFormularioCompra(false)}
                  className="p-1 text-muted-foreground hover:text-foreground"
                  title="Fechar formulário de compra"
                  aria-label="Fechar formulário de compra"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Toggle entre modo individual e valor total */}
              <div className="flex items-center gap-2 mb-4 p-2 bg-muted/50 rounded-lg">
                <button
                  onClick={() => handleToggleModo(false)}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    !modoValorTotal
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Compras Individuais
                </button>
                <button
                  onClick={() => handleToggleModo(true)}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    modoValorTotal
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Valor Total
                </button>
              </div>

              <div className="space-y-4">
                {!modoValorTotal && (
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Descrição da Compra
                    </label>
                    <input
                      type="text"
                      value={inputCompraNome}
                      onChange={(e) => setInputCompraNome(e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      placeholder="Ex: Supermercado"
                      aria-label="Descrição da compra"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    {modoValorTotal ? 'Valor Total da Fatura' : 'Valor'}
                  </label>
                  <input
                    type="text"
                    value={inputCompraValor}
                    onChange={(e) => setInputCompraValor(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder={modoValorTotal ? "Ex: 1.250,00" : "0,00"}
                    aria-label={modoValorTotal ? "Valor total da fatura" : "Valor da compra"}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Data
                  </label>
                  <input
                    type="date"
                    value={inputCompraData}
                    onChange={(e) => setInputCompraData(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    aria-label="Data da compra"
                  />
                </div>

                {!modoValorTotal && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">
                        Categoria
                      </label>
                      <select
                        value={inputCompraCategoria}
                        onChange={(e) => setInputCompraCategoria(e.target.value)}
                        className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        aria-label="Categoria da compra"
                      >
                        {CATEGORIAS_COMPRA.map((categoria) => (
                          <option key={categoria.value} value={categoria.value}>
                            {categoria.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">
                        Observação (opcional)
                      </label>
                      <textarea
                        value={inputCompraObservacao}
                        onChange={(e) => setInputCompraObservacao(e.target.value)}
                        className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder="Observações adicionais..."
                        rows={3}
                        aria-label="Observação da compra"
                      />
                    </div>
                  </>
                )}

                {modoValorTotal && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      <strong>Dica:</strong> Este valor será adicionado como uma compra única "Valor Total da Fatura". 
                      Use este modo quando você já tem o valor total da fatura do cartão.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-6">
                <button
                  onClick={modoValorTotal ? handleDefinirValorTotal : handleAdicionarCompra}
                  disabled={adicionarCompraMutation.isPending}
                  className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {adicionarCompraMutation.isPending ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  {modoValorTotal ? 'Definir Valor Total' : 'Adicionar Compra'}
                </button>
                <button
                  onClick={() => setMostrarFormularioCompra(false)}
                  className="px-4 py-2 bg-muted text-muted-foreground rounded-md hover:bg-muted/80"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de Confirmação de Pagamento */}
      <AnimatePresence>
        {mostrarModalPagamento && cartaoParaPagar && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setMostrarModalPagamento(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-card border border-border rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-foreground mb-4">
                Marcar Cartão como Pago
              </h3>
              
              <div className="mb-4">
                <p className="text-sm text-muted-foreground mb-2">
                  Cartão: <span className="font-semibold text-foreground">{cartaoParaPagar.nome}</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  Este cartão será convertido em despesa no mês selecionado.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Mês do Pagamento
                  </label>
                  <select
                    value={mesPagamento}
                    onChange={(e) => setMesPagamento(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    aria-label="Selecionar mês do pagamento"
                    title="Selecionar mês do pagamento"
                  >
                    {Array.from({ length: 12 }, (_, i) => {
                      const month = i + 1
                      return (
                        <option key={month} value={String(month).padStart(2, '0')}>
                          {new Date(2024, i).toLocaleDateString('pt-BR', { month: 'long' })}
                        </option>
                      )
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Ano do Pagamento
                  </label>
                  <select
                    value={anoPagamento}
                    onChange={(e) => setAnoPagamento(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    aria-label="Selecionar ano do pagamento"
                    title="Selecionar ano do pagamento"
                  >
                    {Array.from({ length: 5 }, (_, i) => {
                      const year = new Date().getFullYear() - 2 + i
                      return (
                        <option key={year} value={String(year)}>
                          {year}
                        </option>
                      )
                    })}
                  </select>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleConfirmarPagamento}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
                  disabled={marcarCartaoPagoMutation.isPending}
                >
                  <DollarSign size={16} />
                  {marcarCartaoPagoMutation.isPending ? 'Processando...' : 'Confirmar Pagamento'}
                </button>
                <button
                  onClick={() => setMostrarModalPagamento(false)}
                  className="px-4 py-2 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      </motion.div>
    </div>
  )
}