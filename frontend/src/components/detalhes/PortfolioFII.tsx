import { motion } from 'framer-motion'
import { 
  Building2, 
  MapPin, 
  BarChart3, 
  PieChart,
  FileText,
  Globe,
  Home,
  ExternalLink,
  Map
} from 'lucide-react'
import { PortfolioFII, ImovelPortfolio, TituloPortfolio } from '../../types'

interface PortfolioFIIProps {
  portfolio: PortfolioFII
  loading?: boolean
}

function ImovelCard({ imovel }: { imovel: ImovelPortfolio }) {
  // Criar URLs de busca para Google e Google Maps
  const searchQuery = `${imovel.nome} ${imovel.endereco} ${imovel.cidade} ${imovel.estado}`.replace(/\s+/g, '+')
  const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(searchQuery)}`

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-lg p-4 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <h4 className="font-medium text-foreground">{imovel.nome}</h4>
        </div>
        <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
          {imovel.tipo}
        </span>
      </div>
      
      <div className="space-y-1 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <MapPin className="h-3 w-3" />
          <span>{imovel.endereco}</span>
        </div>
        <div className="flex items-center gap-2">
          <Globe className="h-3 w-3" />
          <span>{imovel.cidade} - {imovel.estado}</span>
        </div>
        {imovel.area > 0 && (
          <div className="flex items-center gap-2">
            <BarChart3 className="h-3 w-3" />
            <span>{imovel.area.toLocaleString('pt-BR')} m²</span>
          </div>
        )}
      </div>

      {/* Links para Google e Google Maps */}
      <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border">
        <a
          href={googleUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
          title="Buscar no Google"
        >
          <ExternalLink className="h-3 w-3" />
          Google
        </a>
        <span className="text-muted-foreground">•</span>
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 transition-colors"
          title="Ver no Google Maps"
        >
          <Map className="h-3 w-3" />
          Maps
        </a>
      </div>
    </motion.div>
  )
}

function TituloCard({ titulo }: { titulo: TituloPortfolio }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-lg p-4 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-green-600 dark:text-green-400" />
          <h4 className="font-medium text-foreground">{titulo.codigo}</h4>
        </div>
        <span className="text-sm font-medium text-green-600 dark:text-green-400">
          {titulo.percentual.toFixed(1)}%
        </span>
      </div>
      
      <p className="text-sm text-muted-foreground">{titulo.descricao}</p>
    </motion.div>
  )
}

function EstadosChart({ estados }: { estados: Record<string, number> }) {
  const estadosArray = Object.entries(estados)
    .sort(([,a], [,b]) => b - a)

  const colors = [
    '#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', 
    '#EF4444', '#8B5CF6', '#EC4899', '#6366F1',
    '#84CC16', '#F97316', '#14B8A6', '#A855F7'
  ]

  return (
    <div className="space-y-4">
      <h4 className="font-medium text-foreground flex items-center gap-2">
        <PieChart className="h-4 w-4 text-purple-600 dark:text-purple-400" />
        Distribuição por Estados
      </h4>
      
      <div className="flex flex-col lg:flex-row items-center gap-6">
        {/* Gráfico de Pizza */}
        <div className="flex-shrink-0">
          <div className="relative w-48 h-48">
            <svg viewBox="0 0 100 100" className="w-full h-full">
              {estadosArray.map(([estado, percentual], index) => {
                const startAngle = estadosArray.slice(0, index).reduce((sum, [, value]) => sum + (value * 3.6), 0)
                const endAngle = startAngle + (percentual * 3.6)
                const radius = 40
                const centerX = 50
                const centerY = 50
                
                const x1 = centerX + radius * Math.cos((startAngle - 90) * Math.PI / 180)
                const y1 = centerY + radius * Math.sin((startAngle - 90) * Math.PI / 180)
                const x2 = centerX + radius * Math.cos((endAngle - 90) * Math.PI / 180)
                const y2 = centerY + radius * Math.sin((endAngle - 90) * Math.PI / 180)
                
                const largeArcFlag = percentual > 50 ? 1 : 0
                const pathData = [
                  `M ${centerX} ${centerY}`,
                  `L ${x1} ${y1}`,
                  `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
                  'Z'
                ].join(' ')

                return (
                  <path
                    key={estado}
                    d={pathData}
                    fill={colors[index % colors.length]}
                    className="hover:opacity-80 transition-opacity cursor-pointer"
                  />
                )
              })}
            </svg>
          </div>
        </div>
        
        {/* Legenda Melhorada */}
        <div className="flex-1 min-w-0">
          <div className="space-y-2">
            {estadosArray.map(([estado, percentual], index) => (
              <div 
                key={estado} 
                className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div 
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: colors[index % colors.length] }}
                  />
                  <span className="font-medium text-foreground">{estado}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className="h-2 rounded-full transition-all duration-300"
                      style={{ 
                        width: `${percentual}%`,
                        backgroundColor: colors[index % colors.length]
                      }}
                    />
                  </div>
                  <span className="font-semibold text-foreground min-w-[3rem] text-right">
                    {percentual.toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PortfolioFIIComponent({ portfolio, loading }: PortfolioFIIProps) {
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (!portfolio) {
    return (
      <div className="text-center py-8">
        <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">Nenhum dado de portfólio disponível</p>
      </div>
    )
  }

  const { imoveis, titulos, estados_distribuicao, tipos_imoveis } = portfolio

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Resumo do Portfólio */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <Building2 className="h-6 w-6 text-blue-600 dark:text-blue-400 mx-auto mb-2" />
          <div className="text-2xl font-bold text-foreground">{imoveis.length}</div>
          <div className="text-sm text-muted-foreground">Imóveis</div>
        </div>
        
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <FileText className="h-6 w-6 text-green-600 dark:text-green-400 mx-auto mb-2" />
          <div className="text-2xl font-bold text-foreground">{titulos.length}</div>
          <div className="text-sm text-muted-foreground">Títulos</div>
        </div>
        
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <Globe className="h-6 w-6 text-purple-600 dark:text-purple-400 mx-auto mb-2" />
          <div className="text-2xl font-bold text-foreground">{Object.keys(estados_distribuicao).length}</div>
          <div className="text-sm text-muted-foreground">Estados</div>
        </div>
        
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <BarChart3 className="h-6 w-6 text-orange-600 dark:text-orange-400 mx-auto mb-2" />
          <div className="text-2xl font-bold text-foreground">{tipos_imoveis.length}</div>
          <div className="text-sm text-muted-foreground">Tipos</div>
        </div>
      </div>

      {/* Tipos de Imóveis */}
      {tipos_imoveis.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-4">
          <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
            <Home className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            Tipos de Imóveis
          </h4>
          <div className="flex flex-wrap gap-2">
            {tipos_imoveis.map((tipo, index) => (
              <span 
                key={index}
                className="bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 px-3 py-1 rounded-full text-sm"
              >
                {tipo}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Distribuição por Estados */}
      {Object.keys(estados_distribuicao).length > 0 && (
        <div className="bg-card border border-border rounded-lg p-4">
          <EstadosChart estados={estados_distribuicao} />
        </div>
      )}

      {/* Imóveis */}
      {imoveis.length > 0 && (
        <div>
          <h4 className="font-medium text-foreground mb-4 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            Imóveis ({imoveis.length})
          </h4>
          <div className="max-h-96 overflow-y-auto border border-border rounded-lg p-4 bg-gray-50 dark:bg-gray-900/50">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {imoveis.map((imovel, index) => (
                <ImovelCard key={index} imovel={imovel} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Títulos */}
      {titulos.length > 0 && (
        <div>
          <h4 className="font-medium text-foreground mb-4 flex items-center gap-2">
            <FileText className="h-4 w-4 text-green-600 dark:text-green-400" />
            Títulos ({titulos.length})
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {titulos.map((titulo, index) => (
              <TituloCard key={index} titulo={titulo} />
            ))}
          </div>
        </div>
      )}
    </motion.div>
  )
}
