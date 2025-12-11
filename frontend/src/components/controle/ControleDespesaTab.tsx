import { useState, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'

import { 
  Trash2, DollarSign, TrendingDown, BarChart3, 
  TrendingUp, Edit, Save, X, Plus, Calendar,
  ShoppingCart, Home, Baby, Zap, Heart, Utensils, Receipt
} from 'lucide-react'
import { controleService } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import { formatCurrency } from '../../utils/formatters'

// Função para formatar data sem problemas de timezone
const formatDate = (dateString: string) => {
  if (!dateString) return ''
  // Se já está no formato YYYY-MM-DD, converter para DD/MM/YYYY
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const [year, month, day] = dateString.split('-')
    return `${day}/${month}/${year}`
  }
  return dateString
}
import { OutroGasto } from '../../types'
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts'

interface ControleDespesaTabProps {
  filtroMes: string
  filtroAno: string
  ocultarValores: boolean
}

// Categorias de despesas com ícones
const CATEGORIAS_DESPESAS = [
  { value: 'farmacia', label: 'Farmácia', icon: Heart, color: '#ef4444' },
  { value: 'supermercado', label: 'Supermercado', icon: ShoppingCart, color: '#10b981' },
  { value: 'contas_casa', label: 'Contas da Casa', icon: Home, color: '#3b82f6' },
  { value: 'contas_filhos', label: 'Contas dos Filhos', icon: Baby, color: '#f59e0b' },
  { value: 'despesas_fixas', label: 'Despesas Fixas', icon: Zap, color: '#8b5cf6' },
  { value: 'saude', label: 'Saúde', icon: Heart, color: '#ec4899' },
  { value: 'alimentacao', label: 'Alimentação', icon: Utensils, color: '#f97316' },
  { value: 'transporte', label: 'Transporte', icon: Receipt, color: '#06b6d4' },
  { value: 'lazer', label: 'Lazer', icon: Receipt, color: '#84cc16' },
  { value: 'outros', label: 'Outros', icon: Receipt, color: '#6b7280' },
  { value: 'cartao', label: 'Cartão', icon: Receipt, color: '#6b7283' },
  { value: 'investimentos', label: 'investimentos', icon: Receipt, color: '#6b7286' }
]

export default function ControleDespesaTab({ 
  filtroMes, 
  filtroAno, 
  ocultarValores
}: ControleDespesaTabProps) {
  const { user } = useAuth()
  const [inputNome, setInputNome] = useState('')
  const [inputValor, setInputValor] = useState('')
  const [inputData, setInputData] = useState(new Date().toISOString().split('T')[0])
  const [inputCategoria, setInputCategoria] = useState('')
  const [inputTipo, setInputTipo] = useState('')
  const [inputObservacao, setInputObservacao] = useState('')
  const [inputIsPrevisao, setInputIsPrevisao] = useState(false)
  const [editingDespesaId, setEditingDespesaId] = useState<number | null>(null)
  const [editDespesaNome, setEditDespesaNome] = useState('')
  const [editDespesaValor, setEditDespesaValor] = useState('')
  const [editDespesaData, setEditDespesaData] = useState('')
  const [editDespesaCategoria, setEditDespesaCategoria] = useState('')
  const [editDespesaTipo, setEditDespesaTipo] = useState('')
  const [editDespesaObservacao, setEditDespesaObservacao] = useState('')
  

  const [previsoes, setPrevisoes] = useState<Array<{
    id: string
    nome: string
    valor: number
    data: string
    categoria: string
    tipo: string
    observacao?: string
  }>>([])

  const queryClient = useQueryClient()

  // SEGURANCA: Incluir user em todas as queryKeys para isolamento entre usuários
  const { data: outros, isLoading: loadingOutros } = useQuery<OutroGasto[]>({
    queryKey: ['outros', user, filtroMes, filtroAno],
    queryFn: () => controleService.getOutros(filtroMes, filtroAno),
    enabled: !!user,
    retry: 1,
    refetchOnWindowFocus: false,
  })

  

  
  const adicionarOutroMutation = useMutation({
    mutationFn: ({ nome, valor, opts }: { nome: string; valor: number; opts?: any }) =>
      controleService.adicionarOutro(nome, valor, opts),
    onSuccess: () => {
      // SEGURANCA: Incluir user na invalidação para garantir isolamento
      queryClient.invalidateQueries({ queryKey: ['outros', user] })
      queryClient.invalidateQueries({ queryKey: ['receitas-despesas', user] })
      queryClient.invalidateQueries({ queryKey: ['saldo', user] })
      limparFormulario()
    },
  })

  const atualizarOutroMutation = useMutation({
    mutationFn: ({ id, nome, valor, opts }: { id: number; nome: string; valor: number; opts?: any }) =>
      controleService.atualizarOutro(id, nome, valor, opts),
    onSuccess: () => {
      // SEGURANCA: Incluir user na invalidação para garantir isolamento
      queryClient.invalidateQueries({ queryKey: ['outros', user] })
      queryClient.invalidateQueries({ queryKey: ['receitas-despesas', user] })
      queryClient.invalidateQueries({ queryKey: ['saldo', user] })
    },
  })

  const removerOutroMutation = useMutation({
    mutationFn: controleService.removerOutro,
    onSuccess: () => {
      // SEGURANCA: Incluir user na invalidação para garantir isolamento
      queryClient.invalidateQueries({ queryKey: ['outros', user] })
      queryClient.invalidateQueries({ queryKey: ['receitas-despesas', user] })
      queryClient.invalidateQueries({ queryKey: ['saldo', user] })
    },
  })


  const limparFormulario = useCallback(() => {
    setInputNome('')
    setInputValor('')
    setInputData(new Date().toISOString().split('T')[0])
    setInputCategoria('')
    setInputTipo('')
    setInputObservacao('')
    setInputIsPrevisao(false)
  }, [])


  const handleAdicionarDespesa = useCallback(() => {
    if (!inputNome || !inputValor) return
    
    const valor = parseFloat(inputValor.replace(',', '.'))
    if (!isFinite(valor) || valor <= 0) return

    
    let dataFinal = inputData || new Date().toISOString().split('T')[0]
    try {
      // Verificar se a data é válida (formato YYYY-MM-DD)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dataFinal)) {
        dataFinal = new Date().toISOString().split('T')[0]
      }
      // Não fazer conversão de timezone - usar a data exatamente como enviada
    } catch (error) {
      dataFinal = new Date().toISOString().split('T')[0]
    }

    // Se for previsão, adicionar apenas ao estado local (visual)
    if (inputIsPrevisao) {
      const novaPrevisao = {
        id: Date.now().toString(),
        nome: inputNome,
        valor,
        data: dataFinal,
        categoria: inputCategoria,
        tipo: inputTipo,
        observacao: inputObservacao
      }
      setPrevisoes(prev => [...prev, novaPrevisao])
      limparFormulario()
      return
    }

    // Se não for previsão, seguir fluxo normal
    const opts = {
      data: dataFinal,
      categoria: inputCategoria,
      tipo: inputTipo,
      pago: 'Sim',
      observacao: inputObservacao || undefined
    }

    adicionarOutroMutation.mutate({ nome: inputNome, valor, opts })
  }, [inputNome, inputValor, inputData, inputCategoria, inputTipo, inputObservacao, inputIsPrevisao, adicionarOutroMutation, limparFormulario])

  const handleRemoverDespesa = useCallback((id: number) => {
    if (confirm('Tem certeza que deseja remover esta despesa?')) {
      removerOutroMutation.mutate(id)
    }
  }, [removerOutroMutation])

  // Função para pagar uma previsão (converter em despesa real)
  const handlePagarPrevisao = useCallback((previsaoId: string) => {
    const previsao = previsoes.find(p => p.id === previsaoId)
    if (!previsao) return

    // Converter previsão em despesa real
    const opts = {
      data: previsao.data,
      categoria: previsao.categoria,
      tipo: previsao.tipo,
      pago: 'Sim',
      observacao: previsao.observacao || undefined
    }

    // Adicionar como despesa real
    adicionarOutroMutation.mutate({ 
      nome: previsao.nome, 
      valor: previsao.valor, 
      opts 
    })

    // Remover da lista de previsões
    setPrevisoes(prev => prev.filter(p => p.id !== previsaoId))
  }, [previsoes, adicionarOutroMutation])

  // Função para remover uma previsão
  const handleRemoverPrevisao = useCallback((previsaoId: string) => {
    if (confirm('Tem certeza que deseja remover esta previsão?')) {
      setPrevisoes(prev => prev.filter(p => p.id !== previsaoId))
    }
  }, [])

  const handleIniciarEdicaoDespesa = useCallback((despesa: OutroGasto) => {
    setEditingDespesaId(despesa.id)
    setEditDespesaNome(despesa.nome)
    setEditDespesaValor(despesa.valor.toString())
    setEditDespesaData(despesa.data)
    setEditDespesaCategoria(despesa.categoria || '')
    setEditDespesaTipo(despesa.tipo || 'variavel')
    setEditDespesaObservacao(despesa.observacao || '')
  }, [])

  const handleCancelarEdicaoDespesa = useCallback(() => {
    setEditingDespesaId(null)
    setEditDespesaNome('')
    setEditDespesaValor('')
    setEditDespesaData('')
    setEditDespesaCategoria('')
    setEditDespesaTipo('')
    setEditDespesaObservacao('')
  }, [])

  const handleSalvarEdicaoDespesa = useCallback(() => {
    if (!editingDespesaId || !editDespesaNome || !editDespesaValor) return
    
    const valor = parseFloat(editDespesaValor.replace(',', '.'))
    if (!isFinite(valor) || valor <= 0) return

    const opts = {
      data: editDespesaData || new Date().toISOString().split('T')[0],
      categoria: editDespesaCategoria,
      tipo: editDespesaTipo,
      pago: 'Sim',
      observacao: editDespesaObservacao || undefined
    }

    atualizarOutroMutation.mutate({ id: editingDespesaId, nome: editDespesaNome, valor, opts })
    
    handleCancelarEdicaoDespesa()
  }, [editingDespesaId, editDespesaNome, editDespesaValor, editDespesaData, editDespesaCategoria, editDespesaTipo, editDespesaObservacao, atualizarOutroMutation])

  
  const despesasUnificadas = useMemo(() => {
    const outrosArray = Array.isArray(outros) ? outros : []
    
    return outrosArray.map(item => ({ ...item, fonte: 'outro' as const }))
  }, [outros])

  // Cálculos
  const totalDespesas = despesasUnificadas.reduce((total, despesa) => total + despesa.valor, 0)
  const totalDespesasCount = despesasUnificadas.length
  const despesasPagas = despesasUnificadas.length
  const despesasNaoPagas = 0

  // Totais por categoria
  const totaisPorCategoria = useMemo(() => {
    const acc: Record<string, number> = {}
    despesasUnificadas.forEach((d) => {
      const categoria = d.categoria || 'outros'
      acc[categoria] = (acc[categoria] || 0) + (d.valor || 0)
    })
    return Object.entries(acc)
      .map(([name, value]) => ({ 
        name, 
        value,
        categoria: CATEGORIAS_DESPESAS.find(c => c.value === name) || CATEGORIAS_DESPESAS[CATEGORIAS_DESPESAS.length - 1]
      }))
      .sort((a, b) => b.value - a.value)
  }, [despesasUnificadas])

  // Totais por tipo
  const totaisPorTipo = useMemo(() => {
    const result = { fixo: 0, variavel: 0 }
    despesasUnificadas.forEach((d) => {
      const key = (String(d.tipo) === 'fixo') ? 'fixo' : 'variavel'
      result[key as 'fixo' | 'variavel'] += d.valor || 0
    })
    return [
      { name: 'Fixas', value: result.fixo, fill: '#6366F1' },
      { name: 'Variáveis', value: result.variavel, fill: '#F59E0B' },
    ]
  }, [despesasUnificadas])

  const loading = loadingOutros

  return (
    <>
      {/* Formulário de Adição */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border rounded-2xl p-6 shadow-xl"
      >
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <Plus className="w-5 h-5 text-primary" />
          </div>
          Adicionar Despesa
        </h2>
        
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Nome da Despesa
            </label>
            <input
              type="text"
              value={inputNome}
              onChange={(e) => setInputNome(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Ex: Farmácia, Supermercado..."
              aria-label="Nome da despesa"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Valor
            </label>
            <input
              type="number"
              value={inputValor}
              onChange={(e) => setInputValor(e.target.value.replace(',', '.'))}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              step="0.01"
              min="0"
              placeholder="0.00"
              aria-label="Valor da despesa"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Data
            </label>
            <input
              type="date"
              value={inputData}
              onChange={(e) => setInputData(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Data da despesa"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Categoria
            </label>
            <select
              value={inputCategoria}
              onChange={(e) => setInputCategoria(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Categoria da despesa"
            >
              {CATEGORIAS_DESPESAS.map(categoria => (
                <option key={categoria.value} value={categoria.value}>
                  {categoria.label}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Tipo
            </label>
            <select
              value={inputTipo}
              onChange={(e) => setInputTipo(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Tipo da despesa"
            >
              <option value="fixo">Fixo</option>
              <option value="variavel">Variável</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Status
            </label>
            <select
              value={inputIsPrevisao ? 'previsao' : 'despesa'}
              onChange={(e) => setInputIsPrevisao(e.target.value === 'previsao')}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Status da despesa"
            >
              <option value="despesa">Despesa</option>
              <option value="previsao">Previsão</option>
            </select>
          </div>
          
        </div>
        
        <div className="mt-4">
          <label className="block text-sm font-medium text-foreground mb-1">
            Observação (opcional)
          </label>
          <textarea
            value={inputObservacao}
            onChange={(e) => setInputObservacao(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            rows={2}
            placeholder="Observações sobre a despesa..."
            aria-label="Observação da despesa"
          />
        </div>
        
        <div className="mt-4">
          <button
            onClick={handleAdicionarDespesa}
            disabled={adicionarOutroMutation.isPending}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {adicionarOutroMutation.isPending ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            Adicionar Despesa
          </button>
        </div>
      </motion.div>

      {/* Estatísticas */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 mt-8"
      >
        <div className="bg-card border border-border rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <DollarSign className="w-5 h-5 text-destructive" />
            </div>
            <span className="text-sm text-muted-foreground">Total Despesas</span>
          </div>
          <div className="text-2xl font-bold text-foreground">
            {ocultarValores ? '••••••' : formatCurrency(totalDespesas)}
          </div>
        </div>
        
        <div className="bg-card border border-border rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Calendar className="w-5 h-5 text-primary" />
            </div>
            <span className="text-sm text-muted-foreground">Total Lançamentos</span>
          </div>
          <div className="text-2xl font-bold text-foreground">{totalDespesasCount}</div>
        </div>
        
        <div className="bg-card border border-border rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <TrendingUp className="w-5 h-5 text-positive" />
            </div>
            <span className="text-sm text-muted-foreground">Pagas</span>
          </div>
          <div className="text-2xl font-bold text-foreground">{despesasPagas}</div>
        </div>
        
        <div className="bg-card border border-border rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <TrendingDown className="w-5 h-5 text-negative" />
            </div>
            <span className="text-sm text-muted-foreground">Não Pagas</span>
          </div>
          <div className="text-2xl font-bold text-foreground">{despesasNaoPagas}</div>
        </div>
      </motion.div>

      {/* Seção de Previsões */}
      {previsoes.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-2xl p-6 shadow-xl mb-6"
        >
          <h3 className="text-lg font-semibold mb-4 text-foreground flex items-center gap-2">
            <div className="p-2 rounded-lg bg-warning/10">
              <Calendar className="w-5 h-5 text-warning" />
            </div>
            Previsões de Gastos
          </h3>
          
          <div className="space-y-3">
            {previsoes.map((previsao) => {
              const categoria = CATEGORIAS_DESPESAS.find(c => c.value === previsao.categoria) || CATEGORIAS_DESPESAS[CATEGORIAS_DESPESAS.length - 1]
              const IconComponent = categoria.icon
              
              return (
                <div key={previsao.id} className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-warning/10">
                      <IconComponent className="w-4 h-4 text-warning" />
                    </div>
                    <div>
                      <div className="font-medium">{previsao.nome}</div>
                      <div className="text-sm text-muted-foreground">
                        {formatCurrency(previsao.valor)} • {formatDate(previsao.data)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePagarPrevisao(previsao.id)}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Pagar
                    </button>
                    <button
                      onClick={() => handleRemoverPrevisao(previsao.id)}
                      className="p-2 text-destructive hover:bg-destructive/10 rounded"
                      title="Remover previsão"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>
      )}

      {/* Conteúdo Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tabela de Despesas */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-card border border-border rounded-2xl p-6 shadow-xl"
        >
          <h3 className="text-lg font-semibold mb-4 text-foreground">Histórico de Despesas</h3>
          
          {loading ? (
            <div className="text-center text-muted-foreground py-8">
              Carregando despesas...
            </div>
          ) : despesasUnificadas && despesasUnificadas.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Nome</th>
                    <th className="px-4 py-3 text-left font-medium">Valor</th>
                    <th className="px-4 py-3 text-left font-medium">Data</th>
                    <th className="px-4 py-3 text-left font-medium">Categoria</th>
                    <th className="px-4 py-3 text-left font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {despesasUnificadas.map((despesa) => {
                    const categoria = CATEGORIAS_DESPESAS.find(c => c.value === despesa.categoria) || CATEGORIAS_DESPESAS[CATEGORIAS_DESPESAS.length - 1]
                    const IconComponent = categoria.icon
                    
                    return (
                      <tr key={despesa.id + '-' + despesa.fonte} className="hover:bg-muted/40 transition-colors">
                        <td className="px-4 py-3">
                          {editingDespesaId === despesa.id ? (
                            <input
                              type="text"
                              value={editDespesaNome}
                              onChange={(e) => setEditDespesaNome(e.target.value)}
                              className="px-2 py-1 text-sm border border-border rounded bg-background w-full"
                              placeholder="Nome da despesa"
                              aria-label="Nome da despesa"
                            />
                          ) : (
                            <div>
                              <div className="font-medium">{despesa.nome}</div>
                              <div className="text-xs text-muted-foreground flex items-center gap-1">
                                <IconComponent size={12} />
                                {categoria.label}
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 font-semibold">
                          {editingDespesaId === despesa.id ? (
                            <input
                              type="number"
                              value={editDespesaValor}
                              onChange={(e) => setEditDespesaValor(e.target.value.replace(',', '.'))}
                              className="px-2 py-1 text-sm border border-border rounded bg-background w-24"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              aria-label="Valor da despesa"
                            />
                          ) : (
                            formatCurrency(despesa.valor)
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {formatDate(despesa.data)}
                        </td>
                        <td className="px-4 py-3">
                          {editingDespesaId === despesa.id ? (
                            <select
                              value={editDespesaCategoria}
                              onChange={(e) => setEditDespesaCategoria(e.target.value)}
                              className="px-2 py-1 text-sm border border-border rounded bg-background"
                              aria-label="Categoria da despesa"
                            >
                              {CATEGORIAS_DESPESAS.map(cat => (
                                <option key={cat.value} value={cat.value}>
                                  {cat.label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span 
                              className="px-2 py-1 rounded text-xs font-medium flex items-center gap-1 w-fit"
                              style={{ backgroundColor: `${categoria.color}20`, color: categoria.color }}
                            >
                              <IconComponent size={12} />
                              {categoria.label}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            {editingDespesaId === (despesa as any).id ? (
                              <>
                                <button
                                  onClick={handleSalvarEdicaoDespesa}
                                  className="p-1 text-primary hover:bg-primary/10 rounded"
                                  title="Salvar"
                                  disabled={atualizarOutroMutation.isPending}
                                >
                                  <Save size={16} />
                                </button>
                                <button
                                  onClick={handleCancelarEdicaoDespesa}
                                  className="p-1 text-muted-foreground hover:bg-muted rounded"
                                  title="Cancelar"
                                >
                                  <X size={16} />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleIniciarEdicaoDespesa(despesa)}
                                  className="p-1 text-primary hover:bg-primary/10 rounded"
                                  title="Editar"
                                >
                                  <Edit size={16} />
                                </button>
                                <button
                                  onClick={() => handleRemoverDespesa(despesa.id)}
                                  className="p-1 text-destructive hover:bg-destructive/10 rounded"
                                  title="Remover"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              Nenhuma despesa encontrada para o período selecionado.
            </div>
          )}
        </motion.div>

        {/* Gráficos de Análise */}
        <div className="space-y-6">
          {/* Gráfico de Categorias */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-card border border-border rounded-2xl p-6 shadow-xl"
          >
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <BarChart3 className="w-5 h-5 text-primary" />
              </div>
              Gastos por Categoria
            </h3>
            
            {totaisPorCategoria.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={totaisPorCategoria}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {totaisPorCategoria.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.categoria.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => [formatCurrency(value), 'Valor']} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                Nenhum dado disponível para o período selecionado.
              </div>
            )}
          </motion.div>

          {/* Gráfico de Tipos */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-card border border-border rounded-2xl p-6 shadow-xl"
          >
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <BarChart3 className="w-5 h-5 text-primary" />
              </div>
              Gastos por Tipo
            </h3>
            
            {totaisPorTipo.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={totaisPorTipo}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value: any) => [formatCurrency(value), 'Valor']} />
                  <Bar dataKey="value" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-32 flex items-center justify-center text-muted-foreground">
                Nenhum dado disponível.
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </>
  )
}
