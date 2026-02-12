import { useState, useCallback, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  TrendingUp,
  Calculator,
  RefreshCw,
  ArrowRight,
  Globe,
  Loader2,
  Lightbulb,
} from 'lucide-react'
import { ativoService } from '../services/api'
import { formatCurrency } from '../utils/formatters'
import { normalizeTicker, getDisplayTicker } from '../utils/tickerUtils'

const CURRENCY_PAIRS = [
  { from: 'BRL', to: 'USD', name: 'Real → Dólar', symbol: 'BRLUSD=X' },
  { from: 'USD', to: 'BRL', name: 'Dólar → Real', symbol: 'USDBRL=X' },
  { from: 'EUR', to: 'BRL', name: 'Euro → Real', symbol: 'EURBRL=X' },
  { from: 'BRL', to: 'EUR', name: 'Real → Euro', symbol: 'BRLEUR=X' },
  { from: 'GBP', to: 'BRL', name: 'Libra → Real', symbol: 'GBPBRL=X' },
  { from: 'BRL', to: 'GBP', name: 'Real → Libra', symbol: 'BRLGBP=X' },
  { from: 'USD', to: 'EUR', name: 'Dólar → Euro', symbol: 'USDEUR=X' },
  { from: 'EUR', to: 'USD', name: 'Euro → Dólar', symbol: 'EURUSD=X' },
  { from: 'USD', to: 'GBP', name: 'Dólar → Libra', symbol: 'USDGBP=X' },
  { from: 'GBP', to: 'USD', name: 'Libra → Dólar', symbol: 'GBPUSD=X' },
  { from: 'JPY', to: 'USD', name: 'Iene → Dólar', symbol: 'JPYUSD=X' },
  { from: 'USD', to: 'JPY', name: 'Dólar → Iene', symbol: 'USDJPY=X' },
  { from: 'CNY', to: 'USD', name: 'Yuan → Dólar', symbol: 'CNYUSD=X' },
  { from: 'USD', to: 'CNY', name: 'Dólar → Yuan', symbol: 'USDCNY=X' },
]


const CURRENCIES = [
  { code: 'BRL', name: 'Real Brasileiro', symbol: 'R$' },
  { code: 'USD', name: 'Dólar Americano', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'Libra Esterlina', symbol: '£' },
  { code: 'JPY', name: 'Iene Japonês', symbol: '¥' },
  { code: 'CNY', name: 'Yuan Chinês', symbol: '¥' },
  { code: 'CAD', name: 'Dólar Canadense', symbol: 'C$' },
  { code: 'AUD', name: 'Dólar Australiano', symbol: 'A$' },
  { code: 'CHF', name: 'Franco Suíço', symbol: 'CHF' },
  { code: 'SEK', name: 'Coroa Sueca', symbol: 'kr' },
  { code: 'NOK', name: 'Coroa Norueguesa', symbol: 'kr' },
  { code: 'DKK', name: 'Coroa Dinamarquesa', symbol: 'kr' },
  { code: 'PLN', name: 'Złoty Polonês', symbol: 'zł' },
  { code: 'CZK', name: 'Coroa Tcheca', symbol: 'Kč' },
  { code: 'HUF', name: 'Forint Húngaro', symbol: 'Ft' },
  { code: 'RUB', name: 'Rublo Russo', symbol: '₽' },
  { code: 'INR', name: 'Rúpia Indiana', symbol: '₹' },
  { code: 'KRW', name: 'Won Sul-Coreano', symbol: '₩' },
  { code: 'SGD', name: 'Dólar de Singapura', symbol: 'S$' },
  { code: 'HKD', name: 'Dólar de Hong Kong', symbol: 'HK$' },
  { code: 'NZD', name: 'Dólar Neozelandês', symbol: 'NZ$' },
  { code: 'MXN', name: 'Peso Mexicano', symbol: '$' },
  { code: 'ARS', name: 'Peso Argentino', symbol: '$' },
  { code: 'CLP', name: 'Peso Chileno', symbol: '$' },
  { code: 'COP', name: 'Peso Colombiano', symbol: '$' },
  { code: 'PEN', name: 'Sol Peruano', symbol: 'S/' },
  { code: 'UYU', name: 'Peso Uruguaio', symbol: '$' },
  { code: 'PYG', name: 'Guarani Paraguaio', symbol: '₲' },
  { code: 'BOB', name: 'Boliviano', symbol: 'Bs' },
  { code: 'VEF', name: 'Bolívar Venezuelano', symbol: 'Bs' },
]

// Limitar as opções às moedas realmente suportadas pelos pares definidos
const SUPPORTED_CODES = Array.from(new Set(CURRENCY_PAIRS.flatMap(p => [p.from, p.to])))
const SUPPORTED_CURRENCIES = CURRENCIES.filter(c => SUPPORTED_CODES.includes(c.code))

export default function ConversorMoedasPage() {
  const [amount, setAmount] = useState<string>('1')
  const [fromCurrency, setFromCurrency] = useState('BRL')
  const [toCurrency, setToCurrency] = useState('USD')
  const [searchTicker, setSearchTicker] = useState('')
  const [selectedTicker, setSelectedTicker] = useState('')
  const [activeTab, setActiveTab] = useState<'conversor' | 'ativos'>('conversor')


  const getExchangeRate = useCallback(async (from: string, to: string) => {
    if (from === to) return 1
    
 
    const directPair = CURRENCY_PAIRS.find(p => p.from === from && p.to === to)
    if (directPair) {
      try {
        const data = await ativoService.getExchangeRate(directPair.symbol)
        return data.rate || 0
      } catch (error) {
        console.error(`Erro ao buscar taxa para ${directPair.symbol}:`, error)
        return 0
      }
    }
    

    const fromToUSD = CURRENCY_PAIRS.find(p => p.from === from && p.to === 'USD')
    const usdToTo = CURRENCY_PAIRS.find(p => p.from === 'USD' && p.to === to)
    
    if (fromToUSD && usdToTo) {
      try {
        const fromData = await ativoService.getExchangeRate(fromToUSD.symbol)
        const toData = await ativoService.getExchangeRate(usdToTo.symbol)
        const fromRate = fromData.rate || 0
        const toRate = toData.rate || 0
        return fromRate * toRate
      } catch (error) {
        console.error('Erro ao buscar taxas intermediárias:', error)
        return 0
      }
    }
    
    return 0
  }, [])

  // Buscar taxa de câmbio principal
  const exchangeRateQuery = useQuery({
    queryKey: ['exchange-rate', fromCurrency, toCurrency],
    queryFn: () => getExchangeRate(fromCurrency, toCurrency),
    enabled: fromCurrency !== toCurrency,
    staleTime: 60_000, // 1 minuto
  })

  // Buscar informações do ativo
  const ativoQuery = useQuery({
    queryKey: ['ativo-info', selectedTicker],
    queryFn: () => ativoService.getDetalhes(selectedTicker),
    enabled: !!selectedTicker,
  })

  // Buscar logo do ativo
  const logoQuery = useQuery({
    queryKey: ['logo', selectedTicker],
    queryFn: () => ativoService.getLogoUrl(selectedTicker),
    enabled: !!selectedTicker,
  })

  // Calcular conversão
  const convertedAmount = useMemo(() => {
    const numAmount = parseFloat(amount) || 0
    const rate = fromCurrency === toCurrency ? 1 : (exchangeRateQuery.data || 0)
    return numAmount * rate
  }, [amount, exchangeRateQuery.data, fromCurrency, toCurrency])

  const searchResults = useMemo(() => {
    if (!searchTicker.trim()) return []
    
    const normalized = normalizeTicker(searchTicker.trim())
    const results: string[] = []
    

    const suggestions = [
      'PETR4.SA', 'VALE3.SA', 'ITUB4.SA', 'BBDC4.SA', 'ABEV3.SA',
      'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA',
      'BOVA11.SA', 'SMAL11.SA', 'IVVB11.SA', 'HASH11.SA',
      'VISC11.SA', 'XPML11.SA', 'HGLG11.SA', 'HGRE11.SA'
    ]
    
    suggestions.forEach(suggestion => {
      if (suggestion.toLowerCase().includes(normalized.toLowerCase())) {
        results.push(suggestion)
      }
    })
    
    return results.slice(0, 10)
  }, [searchTicker])

  

  const handleSearch = useCallback(() => {
    if (searchTicker.trim()) {
      const normalized = normalizeTicker(searchTicker.trim())
      setSelectedTicker(getDisplayTicker(normalized))
    }
  }, [searchTicker])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }, [handleSearch])

  const getCurrencySymbol = (code: string) => {
    return CURRENCIES.find(c => c.code === code)?.symbol || code
  }

  // getCurrencyName não utilizado, removido para evitar warning

  const formatCurrencyByCode = (value: number, code: string) => {
    const symbol = getCurrencySymbol(code)
    return `${symbol}${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const AssetProjection = ({ 
    fromCurrency, 
    toCurrency, 
    price, 
    getExchangeRate 
  }: { 
    fromCurrency: string
    toCurrency: string
    price: number
    getExchangeRate: (from: string, to: string) => Promise<number>
  }) => {
    const [rate, setRate] = useState<number | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
      const fetchRate = async () => {
        setLoading(true)
        try {
          const exchangeRate = await getExchangeRate(fromCurrency, toCurrency)
          setRate(exchangeRate)
        } catch (error) {
          console.error('Erro ao buscar taxa:', error)
          setRate(0)
        } finally {
          setLoading(false)
        }
      }

      fetchRate()
    }, [fromCurrency, toCurrency, getExchangeRate])

    const convertedPrice = price * (rate || 0)

    return (
      <div className="bg-card border border-border dark:border-white/20 rounded-xl p-4 shadow-sm hover:border-primary/20 transition-colors">
        <div className="flex items-center justify-between mb-2">
          <span className="font-medium text-foreground">{toCurrency}</span>
          <Globe className="w-4 h-4 text-muted-foreground" />
        </div>
        {loading ? (
          <div className="animate-pulse space-y-2">
            <div className="h-6 bg-muted rounded w-24"></div>
            <div className="h-3 bg-muted rounded w-32"></div>
          </div>
        ) : (
          <>
            <p className="text-lg font-bold text-primary">
              {formatCurrencyByCode(convertedPrice, toCurrency)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Taxa: 1 {fromCurrency} = {formatCurrencyByCode(rate || 0, toCurrency)}
            </p>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8 p-4 sm:p-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <Globe className="w-6 h-6 sm:w-7 sm:h-7 text-primary" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Conversor de Moedas</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Taxas de câmbio e projeção de ativos em outras moedas
            </p>
          </div>
        </div>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => exchangeRateQuery.refetch()}
          disabled={exchangeRateQuery.isFetching}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-70"
        >
          {exchangeRateQuery.isFetching ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Atualizar taxas
        </motion.button>
      </motion.div>

      {/* Dica */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="flex gap-3 p-4 rounded-xl border border-border dark:border-white/20 bg-primary/5 dark:bg-primary/10"
      >
        <Lightbulb className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
        <div className="text-sm text-foreground">
          <p className="font-medium mb-0.5">Taxas de câmbio</p>
          <p className="text-muted-foreground">
            Use o conversor para valores em viagem ou para ver ativos em outra moeda. As taxas são atualizadas periodicamente.
          </p>
        </div>
      </motion.div>

      {/* Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
        className="bg-card border border-border dark:border-white/20 rounded-xl sm:rounded-2xl shadow-lg overflow-hidden"
      >
        <div className="border-b border-border dark:border-white/20">
          <div className="flex overflow-x-auto scrollbar-hide">
            {[
              { id: 'conversor', label: 'Conversor', icon: Calculator, shortLabel: 'Conversor' },
              { id: 'ativos', label: 'Projeção de Ativos', icon: TrendingUp, shortLabel: 'Ativos' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-1 sm:gap-2 px-3 sm:px-6 py-3 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                  activeTab === tab.id
                    ? 'text-primary border-b-2 border-primary bg-primary/5'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
                }`}
              >
                <tab.icon className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                <span className="hidden xs:inline">{tab.label}</span>
                <span className="xs:hidden">{tab.shortLabel}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 sm:p-6">
          {activeTab === 'conversor' && (
            <motion.div
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* Conversor Principal */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Valor</label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-4 py-3 border border-border dark:border-white/20 rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">De</label>
                  <select
                    value={fromCurrency}
                    onChange={(e) => setFromCurrency(e.target.value)}
                    className="w-full px-4 py-3 border border-border dark:border-white/20 rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    aria-label="Selecionar moeda de origem"
                  >
                    {SUPPORTED_CURRENCIES.map(currency => (
                      <option key={currency.code} value={currency.code}>
                        {currency.code} - {currency.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Para</label>
                  <select
                    value={toCurrency}
                    onChange={(e) => setToCurrency(e.target.value)}
                    className="w-full px-4 py-3 border border-border dark:border-white/20 rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    aria-label="Selecionar moeda de destino"
                  >
                    {SUPPORTED_CURRENCIES.map(currency => (
                      <option key={currency.code} value={currency.code}>
                        {currency.code} - {currency.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Resultado em destaque */}
              <div className="rounded-xl border-2 border-primary/40 dark:border-primary/50 bg-primary/5 dark:bg-primary/10 p-5 sm:p-6 shadow-lg shadow-primary/5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Taxa de câmbio</p>
                    <p className="text-lg sm:text-xl font-bold text-foreground">
                      {exchangeRateQuery.isLoading ? (
                        <span className="inline-flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Carregando...
                        </span>
                      ) : (
                        `1 ${fromCurrency} = ${formatCurrencyByCode((fromCurrency === toCurrency ? 1 : (exchangeRateQuery.data || 0)), toCurrency)}`
                      )}
                    </p>
                  </div>
                  <ArrowRight className="w-8 h-8 text-primary flex-shrink-0 hidden sm:block" />
                  <div className="space-y-1 sm:text-right">
                    <p className="text-sm text-muted-foreground">Resultado</p>
                    <p className="text-2xl sm:text-3xl font-bold text-primary">
                      {exchangeRateQuery.isLoading ? (
                        <span className="inline-flex items-center gap-2">
                          <Loader2 className="w-5 h-5 animate-spin" />
                        </span>
                      ) : (
                        formatCurrencyByCode(convertedAmount, toCurrency)
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Pares Populares */}
              <div className="space-y-3">
                <h3 className="text-base font-semibold text-foreground">Pares populares</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {CURRENCY_PAIRS.slice(0, 6).map((pair) => (
                    <motion.button
                      key={pair.symbol}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setFromCurrency(pair.from)
                        setToCurrency(pair.to)
                      }}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        fromCurrency === pair.from && toCurrency === pair.to
                          ? 'border-primary bg-primary/10 dark:bg-primary/20'
                          : 'border-border dark:border-white/20 hover:border-primary/40 bg-card'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground">{pair.name}</span>
                        <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'ativos' && (
            <motion.div
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={searchTicker}
                      onChange={(e) => setSearchTicker(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Digite o ticker (ex: PETR4, AAPL, MSFT)..."
                      className="w-full px-4 py-3 border border-border dark:border-white/20 rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSearch}
                    className="px-5 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors whitespace-nowrap"
                  >
                    Buscar
                  </motion.button>
                </div>

                {searchResults.length > 0 && !selectedTicker && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {searchResults.map((ticker) => (
                      <motion.button
                        key={ticker}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setSelectedTicker(ticker)}
                        className="p-3 text-sm border border-border dark:border-white/20 rounded-xl hover:border-primary/40 hover:bg-primary/5 transition-colors text-left"
                      >
                        {ticker}
                      </motion.button>
                    ))}
                  </div>
                )}
              </div>

              {selectedTicker && ativoQuery.data && (
                <div className="bg-card border border-border dark:border-white/20 rounded-xl p-6 space-y-6 shadow-sm">
                  {/* Header do Ativo */}
                  <div className="flex items-center gap-4">
                    {logoQuery.data ? (
                      <img 
                        src={logoQuery.data} 
                        alt={selectedTicker} 
                        className="w-12 h-12 rounded-lg object-cover border border-border"
                        style={{ objectFit: 'cover' }}
                      />
                    ) : (
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold">
                        {selectedTicker.slice(0, 2)}
                      </div>
                    )}
                    <div>
                      <h3 className="text-xl font-bold">{ativoQuery.data.info?.longName || selectedTicker}</h3>
                      <p className="text-muted-foreground">{selectedTicker}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-muted/30 dark:bg-white/[0.04] rounded-xl p-4 border border-border dark:border-white/10">
                      <p className="text-sm text-muted-foreground">Preço atual</p>
                      <p className="text-xl font-bold text-foreground">
                        {formatCurrency(ativoQuery.data.info?.currentPrice)}
                      </p>
                    </div>
                    <div className="bg-muted/30 dark:bg-white/[0.04] rounded-xl p-4 border border-border dark:border-white/10">
                      <p className="text-sm text-muted-foreground">Moeda</p>
                      <p className="text-xl font-bold text-foreground">
                        {ativoQuery.data.info?.currency || 'N/A'}
                      </p>
                    </div>
                    <div className="bg-muted/30 dark:bg-white/[0.04] rounded-xl p-4 border border-border dark:border-white/10">
                      <p className="text-sm text-muted-foreground">Market cap</p>
                      <p className="text-xl font-bold text-foreground">
                        {formatCurrency(ativoQuery.data.info?.marketCap)}
                      </p>
                    </div>
                  </div>

                  {/* Projeções em Diferentes Moedas */}
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold">Projeções em Diferentes Moedas</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {['BRL', 'USD', 'EUR', 'GBP', 'JPY', 'CNY'].map((currency) => {
                        if (currency === ativoQuery.data.info?.currency) return null
                        
                        return (
                          <AssetProjection 
                            key={currency}
                            fromCurrency={ativoQuery.data.info?.currency || 'USD'}
                            toCurrency={currency}
                            price={ativoQuery.data.info?.currentPrice || 0}
                            getExchangeRate={getExchangeRate}
                          />
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}

              {selectedTicker && ativoQuery.isLoading && (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Carregando dados do ativo...</p>
                  </div>
                </div>
              )}

              {selectedTicker && ativoQuery.error && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4">
                  <p className="text-destructive font-medium">Erro ao carregar dados do ativo.</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Verifique se o ticker está correto e tente novamente.
                  </p>
                </div>
              )}
            </motion.div>
          )}

        </div>
      </motion.div>
    </div>
  )
}
