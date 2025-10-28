import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X, Search } from 'lucide-react'
import { formatCurrency } from '../../utils/formatters'

interface TesouroDiretoModalProps {
  open: boolean
  onClose: () => void
  onSelect: (titulo: any) => void
}

interface TituloTesouro {
  ticker: string
  nome: string
  codigo: string
  vencimento: string
  dias_vencimento: number
  tipo_fixacao: string
  indexador: string
  indexador_normalizado: string
  pu: number
  valor_minimo: number
  valor_maximo: number
  quantidade_disponivel: number
  valor_total: number
  data_referencia: string
  categoria: string
  liquidez: string
  cupom_semestral: boolean
  familia_td: string
}

export default function TesouroDiretoModal({ open, onClose, onSelect }: TesouroDiretoModalProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroIndexador, setFiltroIndexador] = useState('')
  const [filtroVencimento, setFiltroVencimento] = useState('')
  const [sortBy, setSortBy] = useState<'vencimento' | 'pu' | 'nome'>('vencimento')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  // Buscar títulos do Tesouro Direto
  const { data: tesouroData, isLoading, error } = useQuery({
    queryKey: ['tesouro-direto-titulos'],
    queryFn: async () => {
      const response = await fetch('/api/tesouro-direto/titulos')
      if (!response.ok) throw new Error('Erro ao buscar títulos')
      return response.json()
    },
    enabled: open,
    staleTime: 1000 * 60 * 30, // 30 minutos
  })

  const titulos = tesouroData?.titulos || []
  const categorias = tesouroData?.categorias || []
  const indexadores = tesouroData?.indexadores || []

  // Filtrar e ordenar títulos
  const titulosFiltrados = useMemo(() => {
    let filtered = titulos.filter((titulo: TituloTesouro) => {
      const matchesSearch = titulo.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           titulo.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           titulo.ticker.toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesCategoria = !filtroCategoria || titulo.categoria === filtroCategoria
      const matchesIndexador = !filtroIndexador || titulo.indexador_normalizado === filtroIndexador
      
      let matchesVencimento = true
      if (filtroVencimento === 'curto') {
        matchesVencimento = titulo.dias_vencimento <= 365
      } else if (filtroVencimento === 'medio') {
        matchesVencimento = titulo.dias_vencimento > 365 && titulo.dias_vencimento <= 1825
      } else if (filtroVencimento === 'longo') {
        matchesVencimento = titulo.dias_vencimento > 1825
      }
      
      return matchesSearch && matchesCategoria && matchesIndexador && matchesVencimento
    })

    // Ordenar
    filtered.sort((a: TituloTesouro, b: TituloTesouro) => {
      let aValue: any, bValue: any
      
      switch (sortBy) {
        case 'vencimento':
          aValue = new Date(a.vencimento).getTime()
          bValue = new Date(b.vencimento).getTime()
          break
        case 'pu':
          aValue = a.pu
          bValue = b.pu
          break
        case 'nome':
          aValue = a.nome
          bValue = b.nome
          break
        default:
          return 0
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1
      } else {
        return aValue < bValue ? 1 : -1
      }
    })

    return filtered
  }, [titulos, searchTerm, filtroCategoria, filtroIndexador, filtroVencimento, sortBy, sortOrder])

  const handleSelectTitulo = (titulo: TituloTesouro) => {
    onSelect(titulo)
    onClose()
  }

  const getLiquidezColor = (liquidez: string) => {
    switch (liquidez) {
      case 'Alta': return 'text-green-600 bg-green-50'
      case 'Média': return 'text-yellow-600 bg-yellow-50'
      case 'Baixa': return 'text-red-600 bg-red-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const getTipoFixacaoColor = (tipo: string) => {
    switch (tipo) {
      case 'PRÉ-FIXADO': return 'text-blue-600 bg-blue-50'
      case 'PÓS-FIXADO': return 'text-green-600 bg-green-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Títulos do Tesouro Direto
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {tesouroData?.total || 0} títulos disponíveis • 
              Data: {tesouroData?.data_referencia || 'N/A'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Fechar modal"
            title="Fechar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filtros */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {/* Busca */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar títulos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
            </div>
            {/* Categoria */}
            <select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              aria-label="Filtrar por categoria"
            >
              <option value="">Todas as categorias</option>
              {categorias.map((cat: string) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            {/* Indexador */}
            <select
              value={filtroIndexador}
              onChange={(e) => setFiltroIndexador(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              aria-label="Filtrar por indexador"
            >
              {indexadores.map((idx: string) => (
                <option key={idx} value={idx}>{idx}</option>
              ))}
            </select>
            {/* Vencimento */}
            <select
              value={filtroVencimento}
              onChange={(e) => setFiltroVencimento(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              aria-label="Filtrar por vencimento"
            >
              <option value="">Todos os vencimentos</option>
              <option value="curto">Curto prazo (≤ 1 ano)</option>
              <option value="medio">Médio prazo (1-5 anos)</option>
              <option value="longo">Longo prazo (&gt; 5 anos)</option>
            </select>
          </div>

          {/* Ordenação */}
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600 dark:text-gray-400">Ordenar por:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              aria-label="Ordenar títulos por"
            >
              <option value="vencimento">Vencimento</option>
              <option value="pu">Preço Unitário</option>
              <option value="nome">Nome</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>

        {/* Lista de Títulos */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600 dark:text-gray-400">Carregando títulos...</span>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-600 dark:text-red-400">Erro ao carregar títulos</p>
            </div>
          ) : titulosFiltrados.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">Nenhum título encontrado</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {titulosFiltrados.map((titulo: TituloTesouro) => (
                <div
                  key={titulo.ticker}
                  onClick={() => handleSelectTitulo(titulo)}
                  className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md transition-all cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {titulo.nome}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {titulo.codigo} • {titulo.familia_td}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTipoFixacaoColor(titulo.tipo_fixacao)}`}>
                        {titulo.tipo_fixacao}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getLiquidezColor(titulo.liquidez)}`}>
                        {titulo.liquidez}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Vencimento</p>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {new Date(titulo.vencimento).toLocaleDateString('pt-BR')}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {titulo.dias_vencimento} dias
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Preço Unitário</p>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {formatCurrency(titulo.pu)}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Indexador</p>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {titulo.indexador}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Categoria</p>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {titulo.categoria}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">
                      Min: {formatCurrency(titulo.valor_minimo)}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400">
                      Max: {formatCurrency(titulo.valor_maximo)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
