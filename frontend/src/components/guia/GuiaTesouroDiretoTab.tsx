import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { 
  Building2, 
  ExternalLink, 
  BookOpen, 
  Shield, 
  DollarSign, 
  TrendingUp, 
  Info,
  Search,
  ArrowRight
} from 'lucide-react'
import { formatCurrency } from '../../utils/formatters'

interface GuiaTesouroDiretoTabProps {
  googleUrl: (query: string) => string
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

export default function GuiaTesouroDiretoTab({ googleUrl }: GuiaTesouroDiretoTabProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroIndexador, setFiltroIndexador] = useState('')
  const [filtroVencimento, setFiltroVencimento] = useState('')

  // Buscar títulos do Tesouro Direto
  const { data: tesouroData, isLoading, error } = useQuery({
    queryKey: ['tesouro-direto-titulos'],
    queryFn: async () => {
      const response = await fetch('/api/tesouro-direto/titulos')
      if (!response.ok) throw new Error('Erro ao buscar títulos')
      return response.json()
    },
    staleTime: 1000 * 60 * 30, // 30 minutos
  })

  const titulos = tesouroData?.titulos || []
  const categorias = tesouroData?.categorias || []
  const indexadores = tesouroData?.indexadores || []

  // Filtrar títulos
  const titulosFiltrados = useMemo(() => {
    return titulos.filter((titulo: TituloTesouro) => {
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
  }, [titulos, searchTerm, filtroCategoria, filtroIndexador, filtroVencimento])

  const handleTituloClick = () => {
    // Abrir o site oficial do Tesouro Direto
    window.open('https://www.tesourodireto.com.br/', '_blank')
  }

  const getLiquidezColor = (liquidez: string) => {
    switch (liquidez) {
      case 'Alta': return 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/20'
      case 'Média': return 'text-yellow-600 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-900/20'
      case 'Baixa': return 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/20'
      default: return 'text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-gray-900/20'
    }
  }

  const getTipoFixacaoColor = (tipo: string) => {
    switch (tipo) {
      case 'PRÉ-FIXADO': return 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20'
      case 'PÓS-FIXADO': return 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/20'
      default: return 'text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-gray-900/20'
    }
  }

  return (
    <div className="space-y-8">
      {/* Introdução ao Tesouro Direto */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-primary/10">
            <Building2 className="w-6 h-6 text-primary" />
          </div>
          <h3 className="text-xl font-semibold text-foreground">O que é o Tesouro Direto?</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <p className="text-muted-foreground leading-relaxed">
              O <strong>Tesouro Direto</strong> é um programa do Tesouro Nacional que permite que pessoas físicas 
              comprem e vendam títulos públicos federais pela internet, de forma simples e segura.
            </p>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold text-foreground">Segurança Máxima</h4>
                  <p className="text-sm text-muted-foreground">Títulos garantidos pelo Governo Federal</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <DollarSign className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold text-foreground">Valor Mínimo Baixo</h4>
                  <p className="text-sm text-muted-foreground">A partir de R$ 30,00</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <TrendingUp className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold text-foreground">Diversos Indexadores</h4>
                  <p className="text-sm text-muted-foreground">IPCA, SELIC, Taxa Fixa e mais</p>
                </div>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <h4 className="font-semibold text-foreground">Como Investir</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-semibold">1</div>
                <span className="text-sm">Abra uma conta em uma instituição financeira</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-semibold">2</div>
                <span className="text-sm">Acesse o site do Tesouro Direto</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-semibold">3</div>
                <span className="text-sm">Escolha o título e faça sua aplicação</span>
              </div>
            </div>
            <button
              onClick={() => window.open('https://www.tesourodireto.com.br/', '_blank')}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Acessar Tesouro Direto
            </button>
          </div>
        </div>
      </div>

      {/* Tipos de Títulos */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-primary/10">
            <BookOpen className="w-6 h-6 text-primary" />
          </div>
          <h3 className="text-xl font-semibold text-foreground">Tipos de Títulos Disponíveis</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              title: 'Tesouro Prefixado (LTN)',
              description: 'Taxa fixa conhecida no momento da compra',
              indexador: 'Taxa Fixa',
              risco: 'Baixo',
              prazo: 'Curto a Longo'
            },
            {
              title: 'Tesouro Selic (LTF)',
              description: 'Rendimento atrelado à taxa Selic',
              indexador: 'SELIC',
              risco: 'Baixo',
              prazo: 'Curto a Médio'
            },
            {
              title: 'Tesouro IPCA+ (NTN-B)',
              description: 'Proteção contra inflação + taxa fixa',
              indexador: 'IPCA + Taxa',
              risco: 'Baixo',
              prazo: 'Médio a Longo'
            },
            {
              title: 'Tesouro IGPM+ (NTN-C)',
              description: 'Proteção contra inflação medida pelo IGP-M',
              indexador: 'IGP-M + Taxa',
              risco: 'Baixo',
              prazo: 'Médio a Longo'
            },
            {
              title: 'Tesouro Educa+',
              description: 'Para financiar educação dos filhos',
              indexador: 'IPCA + Taxa',
              risco: 'Baixo',
              prazo: 'Longo'
            },
            {
              title: 'Tesouro Renda+',
              description: 'Para complementar aposentadoria',
              indexador: 'IPCA + Taxa',
              risco: 'Baixo',
              prazo: 'Longo'
            }
          ].map((titulo, index) => (
            <div 
              key={index}
              className="bg-muted/30 border border-border rounded-xl p-4 hover:shadow-lg transition-all duration-200 cursor-pointer"
              onClick={() => window.open(googleUrl(`tesouro direto ${titulo.title}`), '_blank')}
              title={`Pesquisar ${titulo.title} no Google`}
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-foreground">{titulo.title}</h4>
                <ExternalLink className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground mb-3">{titulo.description}</p>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Indexador:</span>
                  <span className="font-medium">{titulo.indexador}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Risco:</span>
                  <span className="font-medium text-green-600">{titulo.risco}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Prazo:</span>
                  <span className="font-medium">{titulo.prazo}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Títulos Disponíveis */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-primary/10">
            <TrendingUp className="w-6 h-6 text-primary" />
          </div>
          <h3 className="text-xl font-semibold text-foreground">Títulos Disponíveis Hoje</h3>
          {tesouroData && (
            <span className="text-sm text-muted-foreground">
              ({tesouroData.total} títulos • {tesouroData.data_referencia})
            </span>
          )}
        </div>

        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Buscar títulos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-background text-foreground"
            />
          </div>

          <select
            value={filtroCategoria}
            onChange={(e) => setFiltroCategoria(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-background text-foreground"
            aria-label="Filtrar por categoria"
          >
            <option value="">Todas as categorias</option>
            {categorias.map((cat: string) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <select
            value={filtroIndexador}
            onChange={(e) => setFiltroIndexador(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-background text-foreground"
            aria-label="Filtrar por indexador"
          >
            <option value="">Todos os indexadores</option>
            {indexadores.map((idx: string) => (
              <option key={idx} value={idx}>{idx}</option>
            ))}
          </select>

          <select
            value={filtroVencimento}
            onChange={(e) => setFiltroVencimento(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-background text-foreground"
            aria-label="Filtrar por vencimento"
          >
            <option value="">Todos os vencimentos</option>
            <option value="curto">Curto prazo (≤ 1 ano)</option>
            <option value="medio">Médio prazo (1-5 anos)</option>
            <option value="longo">Longo prazo (&gt; 5 anos)</option>
          </select>
        </div>

        {/* Lista de Títulos */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-3 text-muted-foreground">Carregando títulos...</span>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-600 dark:text-red-400">Erro ao carregar títulos</p>
          </div>
        ) : titulosFiltrados.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Nenhum título encontrado</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {titulosFiltrados.map((titulo: TituloTesouro) => (
              <div
                key={titulo.ticker}
                onClick={handleTituloClick}
                className="p-4 border border-border rounded-lg hover:border-primary hover:shadow-md transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                      {titulo.nome}
                    </h4>
                    <p className="text-sm text-muted-foreground">
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
                    <p className="text-xs text-muted-foreground">Vencimento</p>
                    <p className="font-medium text-foreground">
                      {new Date(titulo.vencimento).toLocaleDateString('pt-BR')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {titulo.dias_vencimento} dias
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Preço Unitário</p>
                    <p className="font-medium text-foreground">
                      {formatCurrency(titulo.pu)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Indexador</p>
                    <p className="font-medium text-foreground">{titulo.indexador}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Categoria</p>
                    <p className="font-medium text-foreground">{titulo.categoria}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Min: {formatCurrency(titulo.valor_minimo)}
                  </span>
                  <span className="text-muted-foreground">
                    Max: {formatCurrency(titulo.valor_maximo)}
                  </span>
                </div>

                <div className="flex items-center justify-center mt-3 text-primary group-hover:text-primary/80 transition-colors">
                  <span className="text-sm font-medium">Clique para investir no site oficial</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Informações Adicionais */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-primary/10">
            <Info className="w-6 h-6 text-primary" />
          </div>
          <h3 className="text-xl font-semibold text-foreground">Informações Importantes</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h4 className="font-semibold text-foreground">Vantagens</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-1">✓</span>
                <span>Segurança máxima (garantia do Governo Federal)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-1">✓</span>
                <span>Valor mínimo baixo (a partir de R$ 30)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-1">✓</span>
                <span>Liquidez diária (exceto alguns títulos)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-1">✓</span>
                <span>Diversos indexadores disponíveis</span>
              </li>
            </ul>
          </div>
          <div className="space-y-4">
            <h4 className="font-semibold text-foreground">Considerações</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-yellow-600 mt-1">⚠</span>
                <span>Rendimento pode ser menor que inflação</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-600 mt-1">⚠</span>
                <span>Imposto de renda sobre o rendimento</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-600 mt-1">⚠</span>
                <span>Risco de taxa de juros (títulos prefixados)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-600 mt-1">⚠</span>
                <span>Necessário ter conta em instituição financeira</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
