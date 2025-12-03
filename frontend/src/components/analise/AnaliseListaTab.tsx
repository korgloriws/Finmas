import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { analiseService, carteiraService, ativoService } from '../../services/api'
import { AtivoAnalise, FiltrosAnalise } from '../../types'
import { useAnalise } from '../../contexts/AnaliseContext'
import TickerWithLogo from '../TickerWithLogo'
import { formatNumber, formatCurrency } from '../../utils/formatters'
import { ExternalLink } from 'lucide-react'


// Lista de setores comuns (baseado nos setores do yfinance)
const SETORES_COMUNS = [
  'Financial Services',
  'Technology',
  'Consumer Cyclical',
  'Consumer Defensive',
  'Healthcare',
  'Energy',
  'Industrials',
  'Communication Services',
  'Utilities',
  'Real Estate',
  'Basic Materials',
  'Services',
  'Consumer Staples',
  'Consumer Discretionary',
  'Oil & Gas Integrated',
  'Utilities - Regulated Electric',
  'Real Estate Services',

]

function FiltrosAcoes({ 
  filtros, 
  onFiltroChange, 
  onFiltroStringChange,
  onBuscar, 
  loading, 
  autoSearch, 
  onAutoSearchChange 
}: {
  filtros: FiltrosAnalise
  onFiltroChange: (key: keyof FiltrosAnalise, value: number) => void
  onFiltroStringChange: (key: keyof FiltrosAnalise, value: string) => void
  onBuscar: () => void
  loading: boolean
  autoSearch: boolean
  onAutoSearchChange: (value: boolean) => void
}) {
  return (
    <div className="bg-card border border-border rounded-2xl p-6 mb-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-foreground">Filtros para Ações</h3>
          <p className="text-muted-foreground text-sm">Configure os critérios de análise</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={autoSearch}
              onChange={(e) => onAutoSearchChange(e.target.checked)}
              className="w-4 h-4 rounded border-border text-primary focus:ring-2 focus:ring-ring focus:ring-offset-0"
              aria-label="Ativar busca automática"
            />
            Busca automática
          </label>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-foreground">ROE Mínimo (%)</label>
          <input
            type="number"
            value={filtros.roe_min || ''}
            onChange={(e) => onFiltroChange('roe_min', parseFloat(e.target.value) || 0)}
            className="w-full px-4 py-3 border border-border rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200"
            placeholder="15"
            aria-label="ROE mínimo em percentual"
          />
        </div>
        
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-foreground">DY Mínimo (%)</label>
          <input
            type="number"
            value={filtros.dy_min || ''}
            onChange={(e) => onFiltroChange('dy_min', parseFloat(e.target.value) || 0)}
            className="w-full px-4 py-3 border border-border rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200"
            placeholder="12"
            aria-label="Dividend yield mínimo em percentual"
          />
        </div>
        
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-foreground">P/L Mínimo</label>
          <input
            type="number"
            value={filtros.pl_min || ''}
            onChange={(e) => onFiltroChange('pl_min', parseFloat(e.target.value) || 0)}
            className="w-full px-4 py-3 border border-border rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200"
            placeholder="1"
            aria-label="Preço sobre lucro mínimo"
          />
        </div>
        
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-foreground">P/L Máximo</label>
          <input
            type="number"
            value={filtros.pl_max || ''}
            onChange={(e) => onFiltroChange('pl_max', parseFloat(e.target.value) || 0)}
            className="w-full px-4 py-3 border border-border rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200"
            placeholder="10"
            aria-label="Preço sobre lucro máximo"
          />
        </div>
        
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-foreground">P/VP Máximo</label>
          <input
            type="number"
            value={filtros.pvp_max || ''}
            onChange={(e) => onFiltroChange('pvp_max', parseFloat(e.target.value) || 0)}
            className="w-full px-4 py-3 border border-border rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200"
            placeholder="2"
            aria-label="Preço sobre valor patrimonial máximo"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-semibold text-foreground">Dívida Líquida/EBITDA Máximo</label>
          <input
            type="number"
            step="0.1"
            value={filtros.net_debt_ebitda_max ?? 3}
            onChange={(e) => onFiltroChange('net_debt_ebitda_max', parseFloat(e.target.value))}
            className="w-full px-4 py-3 border border-border rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200"
            placeholder="3"
            aria-label="Dívida Líquida sobre EBITDA máximo"
            title="Filtra empresas com alavancagem até o limite escolhido"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-semibold text-foreground">Liquidez Mínima (R$)</label>
          <input
            type="number"
            value={filtros.liq_min ?? 100000}
            onChange={(e) => onFiltroChange('liq_min', parseFloat(e.target.value) || 0)}
            className="w-full px-4 py-3 border border-border rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200"
            placeholder="100000"
            aria-label="Liquidez mínima em reais"
            title="Filtrar por liquidez diária mínima"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-semibold text-foreground">Setor</label>
          <select
            value={filtros.setor || ''}
            onChange={(e) => onFiltroStringChange('setor', e.target.value)}
            className="w-full px-4 py-3 border border-border rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200"
            aria-label="Setor"
          >
            <option value="">Todos os setores</option>
            {SETORES_COMUNS.map((setor) => (
              <option key={setor} value={setor}>{setor}</option>
            ))}
          </select>
        </div>
      </div>
      
      <div className="mt-6 flex justify-end">
        <button
          onClick={onBuscar}
          disabled={loading}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium transition-all duration-200 shadow-sm hover:shadow-md text-sm"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Buscando...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Buscar Ações
            </>
          )}
        </button>
      </div>
    </div>
  )
}


function FiltrosBdrs({ 
  filtros, 
  onFiltroChange, 
  onFiltroStringChange,
  onBuscar, 
  loading, 
  autoSearch, 
  onAutoSearchChange 
}: {
  filtros: FiltrosAnalise
  onFiltroChange: (key: keyof FiltrosAnalise, value: number) => void
  onFiltroStringChange: (key: keyof FiltrosAnalise, value: string) => void
  onBuscar: () => void
  loading: boolean
  autoSearch: boolean
  onAutoSearchChange: (value: boolean) => void
}) {
  return (
    <div className="bg-card border border-border rounded-2xl p-6 mb-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-foreground">Filtros para BDRs</h3>
          <p className="text-muted-foreground text-sm">Configure os critérios de análise</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={autoSearch}
              onChange={(e) => onAutoSearchChange(e.target.checked)}
              className="w-4 h-4 rounded border-border text-primary focus:ring-2 focus:ring-ring focus:ring-offset-0"
              aria-label="Ativar busca automática"
            />
            Busca automática
          </label>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-foreground">ROE Mínimo (%)</label>
          <input
            type="number"
            value={filtros.roe_min || ''}
            onChange={(e) => onFiltroChange('roe_min', parseFloat(e.target.value) || 0)}
            className="w-full px-4 py-3 border border-border rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200"
            placeholder="15"
            aria-label="ROE mínimo em percentual"
          />
        </div>
        
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-foreground">DY Mínimo (%)</label>
          <input
            type="number"
            value={filtros.dy_min || ''}
            onChange={(e) => onFiltroChange('dy_min', parseFloat(e.target.value) || 0)}
            className="w-full px-4 py-3 border border-border rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200"
            placeholder="3"
            aria-label="Dividend yield mínimo em percentual"
          />
        </div>
        
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-foreground">P/L Mínimo</label>
          <input
            type="number"
            value={filtros.pl_min || ''}
            onChange={(e) => onFiltroChange('pl_min', parseFloat(e.target.value) || 0)}
            className="w-full px-4 py-3 border border-border rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200"
            placeholder="1"
            aria-label="Preço sobre lucro mínimo"
          />
        </div>
        
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-foreground">P/L Máximo</label>
          <input
            type="number"
            value={filtros.pl_max || ''}
            onChange={(e) => onFiltroChange('pl_max', parseFloat(e.target.value) || 0)}
            className="w-full px-4 py-3 border border-border rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200"
            placeholder="15"
            aria-label="Preço sobre lucro máximo"
          />
        </div>
        
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-foreground">P/VP Máximo</label>
          <input
            type="number"
            value={filtros.pvp_max || ''}
            onChange={(e) => onFiltroChange('pvp_max', parseFloat(e.target.value) || 0)}
            className="w-full px-4 py-3 border border-border rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200"
            placeholder="2"
            aria-label="Preço sobre valor patrimonial máximo"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-semibold text-foreground">Liquidez Mínima (R$)</label>
          <input
            type="number"
            value={filtros.liq_min ?? 10000}
            onChange={(e) => onFiltroChange('liq_min', parseFloat(e.target.value) || 0)}
            className="w-full px-4 py-3 border border-border rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200"
            placeholder="10000"
            aria-label="Liquidez mínima em reais"
            title="Filtrar por liquidez diária mínima"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-semibold text-foreground">Setor</label>
          <select
            value={filtros.setor || ''}
            onChange={(e) => onFiltroStringChange('setor', e.target.value)}
            className="w-full px-4 py-3 border border-border rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200"
            aria-label="Setor"
          >
            <option value="">Todos os setores</option>
            {SETORES_COMUNS.map((setor) => (
              <option key={setor} value={setor}>{setor}</option>
            ))}
          </select>
        </div>
      </div>
      
      <div className="mt-6 flex justify-end">
        <button
          onClick={onBuscar}
          disabled={loading}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium transition-all duration-200 shadow-sm hover:shadow-md text-sm"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Buscando...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Buscar BDRs
            </>
          )}
        </button>
      </div>
    </div>
  )
}


function FiltrosFiis({ 
  filtros, 
  onFiltroChange, 
  onFiltroStringChange,
  onBuscar, 
  loading, 
  autoSearch, 
  onAutoSearchChange 
}: {
  filtros: FiltrosAnalise
  onFiltroChange: (key: keyof FiltrosAnalise, value: number) => void
  onFiltroStringChange: (key: keyof FiltrosAnalise, value: string) => void
  onBuscar: () => void
  loading: boolean
  autoSearch: boolean
  onAutoSearchChange: (value: boolean) => void
}) {
  return (
    <div className="bg-card border border-border rounded-2xl p-6 mb-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-foreground">Filtros para FIIs</h3>
          <p className="text-muted-foreground text-sm">Configure os critérios de análise</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={autoSearch}
              onChange={(e) => onAutoSearchChange(e.target.checked)}
              className="w-4 h-4 rounded border-border text-primary focus:ring-2 focus:ring-ring focus:ring-offset-0"
              aria-label="Ativar busca automática"
            />
            Busca automática
          </label>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-foreground">DY Mínimo (%)</label>
          <input
            type="number"
            value={filtros.dy_min || ''}
            onChange={(e) => onFiltroChange('dy_min', parseFloat(e.target.value) || 0)}
            className="w-full px-4 py-3 border border-border rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200"
            placeholder="12"
            aria-label="Dividend yield mínimo em percentual"
          />
        </div>
        
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-foreground">DY Máximo (%)</label>
          <input
            type="number"
            value={filtros.dy_max || ''}
            onChange={(e) => onFiltroChange('dy_max', parseFloat(e.target.value) || 0)}
            className="w-full px-4 py-3 border border-border rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200"
            placeholder="15"
            aria-label="Dividend yield máximo em percentual"
          />
        </div>
        
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-foreground">Liquidez Mínima (R$)</label>
          <input
            type="number"
            value={filtros.liq_min || ''}
            onChange={(e) => onFiltroChange('liq_min', parseFloat(e.target.value) || 0)}
            className="w-full px-4 py-3 border border-border rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200"
            placeholder="1000000"
            aria-label="Liquidez mínima em reais"
          />
        </div>
        
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-foreground">Tipo de FII</label>
          <select
            value={filtros.tipo_fii || ''}
            onChange={(e) => onFiltroStringChange('tipo_fii', e.target.value)}
            className="w-full px-4 py-3 border border-border rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200"
            aria-label="Tipo de FII"
          >
            <option value="">Todos os tipos</option>
            <option value="Tijolo">Tijolo</option>
            <option value="Papel">Papel</option>
            <option value="Híbrido">Híbrido</option>
          </select>
        </div>
        
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-foreground">Segmento</label>
          <select
            value={filtros.segmento_fii || ''}
            onChange={(e) => onFiltroStringChange('segmento_fii', e.target.value)}
            className="w-full px-4 py-3 border border-border rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200"
            aria-label="Segmento do FII"
          >
            <option value="">Todos os segmentos</option>
            <option value="Shopping">Shopping</option>
            <option value="Logística">Logística</option>
            <option value="Lajes corporativas">Lajes corporativas</option>
            <option value="Escritórios">Escritórios</option>
            <option value="Residencial">Residencial</option>
            <option value="Industrial">Industrial</option>
            <option value="Hospitalar">Hospitalar</option>
            <option value="Educacional">Educacional</option>
            <option value="Galpões">Galpões</option>
            <option value="Recebíveis/CRI">Recebíveis/CRI</option>
          </select>
        </div>
      </div>
      
      <div className="mt-6 flex justify-end">
        <button
          onClick={onBuscar}
          disabled={loading}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium transition-all duration-200 shadow-sm hover:shadow-md text-sm"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Buscando...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Buscar FIIs
            </>
          )}
        </button>
      </div>
    </div>
  )
}


function TabelaAtivos({ 
  ativos, 
  loading, 
  error, 
  tipo,
  isAtivoNaCarteira,
  fiiMetadataMap
}: {
  ativos: AtivoAnalise[]
  loading: boolean
  error: string | null
  tipo: string
  isAtivoNaCarteira: (ticker: string) => boolean
  fiiMetadataMap?: Record<string, { tipo?: string; segmento?: string }>
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto"></div>
          <div className="space-y-2">
            <p className="text-lg font-semibold text-foreground">Carregando {tipo}...</p>
            <p className="text-sm text-muted-foreground">Analisando dados do mercado</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-2xl p-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-red-800 dark:text-red-300">Erro ao carregar {tipo}</p>
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (ativos.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div className="space-y-2">
          <p className="text-lg font-semibold text-foreground">Nenhum {tipo} encontrado</p>
          <p className="text-muted-foreground">Tente ajustar os filtros de busca</p>
        </div>
      </div>
    )
  }

  const isFiiTable = tipo === 'FIIs'

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Ticker</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Nome</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Tipo</th>
              {isFiiTable && (
                <>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Tipo FII</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Segmento</th>
                </>
              )}
              <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Preço</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">DY</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">P/L</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">P/VP</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">ROE</th>
              {!isFiiTable && (
                <>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Indústria</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">País</th>
                </>
              )}
              <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Liquidez</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {ativos.map((ativo) => {
              const fiiMeta = fiiMetadataMap?.[ativo.ticker]
              
              return (
              <tr key={ativo.ticker} className="hover:bg-muted/30 transition-colors duration-200">
                <td className="px-6 py-4">
                  <TickerWithLogo ticker={ativo.ticker} />
                </td>
                <td className="px-6 py-4">
                  <div className="space-y-1">
                    <p className="font-semibold text-foreground text-sm">{ativo.nome_completo}</p>
                    <p className="text-xs text-muted-foreground">{ativo.industria}</p>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                    ativo.tipo === 'Ação' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300' : 
                    ativo.tipo === 'FII' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300' : 
                    'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300'
                  }`}>
                    {ativo.tipo}
                  </span>
                </td>
                {isFiiTable && (
                  <>
                    <td className="px-6 py-4">
                      {fiiMeta?.tipo ? (
                        <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                          fiiMeta.tipo === 'Tijolo' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300' :
                          fiiMeta.tipo === 'Papel' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-300' :
                          'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300'
                        }`}>
                          {fiiMeta.tipo}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Carregando...</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-foreground">
                        {fiiMeta?.segmento || '-'}
                      </span>
                    </td>
                  </>
                )}
                <td className="px-6 py-4">
                  <span className="font-bold text-foreground text-sm">
                    {formatCurrency(Number.isFinite(Number(ativo.preco_atual)) ? Number(ativo.preco_atual) : 0)}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                    ativo.dividend_yield >= 12 ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300' : 
                    ativo.dividend_yield >= 6 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300' : 
                    'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
                  }`}>
                    {Number.isFinite(Number(ativo.dividend_yield)) ? Number(ativo.dividend_yield).toFixed(2) : '0.00'}%
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                    ativo.pl <= 10 ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300' : 
                    ativo.pl <= 20 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300' : 
                    'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
                  }`}>
                    {Number.isFinite(Number(ativo.pl)) ? Number(ativo.pl).toFixed(2) : '-'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                    ativo.pvp <= 1.5 ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300' : 
                    ativo.pvp <= 3 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300' : 
                    'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
                  }`}>
                    {Number.isFinite(Number(ativo.pvp)) ? Number(ativo.pvp).toFixed(2) : '-'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                    ativo.roe >= 15 ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300' : 
                    ativo.roe >= 10 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300' : 
                    'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
                  }`}>
                    {Number.isFinite(Number(ativo.roe)) ? Number(ativo.roe).toFixed(2) : '0.00'}%
                  </span>
                </td>
                {!isFiiTable && (
                  <>
                    <td className="px-6 py-4">
                      <span className="text-sm text-muted-foreground">
                        {ativo.industria || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-muted-foreground">
                        {ativo.pais || 'N/A'}
                      </span>
                    </td>
                  </>
                )}
                <td className="px-6 py-4">
                  <div className="space-y-1">
                    <div className="font-semibold text-sm text-foreground">
                      {formatCurrency(ativo.liquidez_diaria || 0)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Vol: {formatNumber(ativo.volume_medio || 0)}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  {isAtivoNaCarteira(ativo.ticker) ? (
                    <span className="px-3 py-1.5 bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300 rounded-full text-xs font-semibold">
                      Na Carteira
                    </span>
                  ) : (
                    <span className="px-3 py-1.5 bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300 rounded-full text-xs font-semibold">
                      Disponível
                    </span>
                  )}
                </td>
              </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Componente para tabela de CRIs
function TabelaCRIs() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cris, setCris] = useState<any[]>([])

  const carregarCRIs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/mercados/cris?limite=50')
      const data = await response.json()
      if (data.cris) {
        setCris(data.cris)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar CRIs')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    carregarCRIs()
  }, [carregarCRIs])

  const abrirDetalhesGoogle = (cri: any) => {
    const query = `${cri.nome} ${cri.codigo_identificacao} CRI investimento`
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`
    window.open(url, '_blank')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto"></div>
          <div className="space-y-2">
            <p className="text-lg font-semibold text-foreground">Carregando CRIs...</p>
            <p className="text-sm text-muted-foreground">Buscando dados do mercado</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-2xl p-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-red-800 dark:text-red-300">Erro ao carregar CRIs</p>
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
      <div className="px-4 py-2 bg-purple-50 dark:bg-purple-900/20 border-b border-border">
        <p className="text-xs text-purple-600 dark:text-purple-400 flex items-center gap-1">
          <ExternalLink className="h-3 w-3" />
          Clique em qualquer CRI para pesquisar detalhes no Google
        </p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
        {cris.map((cri: any, index: number) => (
          <div
            key={index}
            onClick={() => abrirDetalhesGoogle(cri)}
            className="p-4 border border-border rounded-lg hover:border-primary hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                  {cri.nome}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {cri.codigo_identificacao}
                </p>
              </div>
              <div className="flex gap-2">
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300">
                  {cri.tipo}
                </span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  cri.fase === 'Funcionamento Normal'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
                    : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300'
                }`}>
                  {cri.fase}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <p className="text-xs text-muted-foreground">Número da Emissão</p>
                <p className="font-medium text-foreground">{cri.numero_emissao}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Data de Emissão</p>
                <p className="font-medium text-foreground">{cri.data_emissao}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 mb-3">
              <div>
                <p className="text-xs text-muted-foreground">Devedor</p>
                <p className="font-medium text-foreground">{cri.nome_devedor}</p>
                <p className="text-xs text-muted-foreground">{cri.qualificacao_devedor}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <p className="text-xs text-muted-foreground">Séries</p>
                <p className="font-medium text-foreground">{cri.series}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tipo de Fundo</p>
                <p className="font-medium text-foreground">{cri.tipo_fundo}</p>
              </div>
            </div>

            <div className="flex items-center justify-center mt-3 text-primary group-hover:text-primary/80 transition-colors">
              <span className="text-sm font-medium">Clique para pesquisar detalhes</span>
              <ExternalLink className="w-4 h-4 ml-1" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Componente para tabela de CRAs
function TabelaCRAs() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cras, setCras] = useState<any[]>([])

  const carregarCRAs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/mercados/cras?limite=50')
      const data = await response.json()
      if (data.cras) {
        setCras(data.cras)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar CRAs')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    carregarCRAs()
  }, [carregarCRAs])

  const abrirDetalhesGoogle = (cra: any) => {
    const query = `${cra.nome} ${cra.codigo_identificacao} CRA investimento`
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`
    window.open(url, '_blank')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto"></div>
          <div className="space-y-2">
            <p className="text-lg font-semibold text-foreground">Carregando CRAs...</p>
            <p className="text-sm text-muted-foreground">Buscando dados do mercado</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-2xl p-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-red-800 dark:text-red-300">Erro ao carregar CRAs</p>
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (cras.length === 0) {
    return (
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">Nenhum CRA disponível</h3>
          <p className="text-muted-foreground mb-4">
            Os Certificados de Recebíveis do Agronegócio (CRAs) não estão disponíveis no momento.
          </p>
          <p className="text-sm text-muted-foreground">
            CRAs são menos comuns que CRIs no mercado brasileiro. Tente novamente mais tarde.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
      <div className="px-4 py-2 bg-orange-50 dark:bg-orange-900/20 border-b border-border">
        <p className="text-xs text-orange-600 dark:text-orange-400 flex items-center gap-1">
          <ExternalLink className="h-3 w-3" />
          Clique em qualquer CRA para pesquisar detalhes no Google
        </p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
        {cras.map((cra: any, index: number) => (
          <div
            key={index}
            onClick={() => abrirDetalhesGoogle(cra)}
            className="p-4 border border-border rounded-lg hover:border-primary hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                  {cra.nome}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {cra.codigo_identificacao}
                </p>
              </div>
              <div className="flex gap-2">
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300">
                  {cra.tipo}
                </span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  cra.fase === 'Funcionamento Normal'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
                    : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300'
                }`}>
                  {cra.fase}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <p className="text-xs text-muted-foreground">Número da Emissão</p>
                <p className="font-medium text-foreground">{cra.numero_emissao}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Data de Emissão</p>
                <p className="font-medium text-foreground">{cra.data_emissao}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 mb-3">
              <div>
                <p className="text-xs text-muted-foreground">Devedor</p>
                <p className="font-medium text-foreground">{cra.nome_devedor}</p>
                <p className="text-xs text-muted-foreground">{cra.qualificacao_devedor}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <p className="text-xs text-muted-foreground">Séries</p>
                <p className="font-medium text-foreground">{cra.series}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tipo de Fundo</p>
                <p className="font-medium text-foreground">{cra.tipo_fundo}</p>
              </div>
            </div>

            <div className="flex items-center justify-center mt-3 text-primary group-hover:text-primary/80 transition-colors">
              <span className="text-sm font-medium">Clique para pesquisar detalhes</span>
              <ExternalLink className="w-4 h-4 ml-1" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Componente para tabela de Debentures
function TabelaDebentures() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [debentures, setDebentures] = useState<any[]>([])

  const carregarDebentures = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/mercados/debentures?limite=50')
      const data = await response.json()
      if (data.debentures) {
        setDebentures(data.debentures)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar Debentures')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    carregarDebentures()
  }, [carregarDebentures])

  const abrirDetalhesGoogle = (debenture: any) => {
    const query = `${debenture.emissor} ${debenture.codigo} debenture investimento`
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`
    window.open(url, '_blank')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto"></div>
          <div className="space-y-2">
            <p className="text-lg font-semibold text-foreground">Carregando Debentures...</p>
            <p className="text-sm text-muted-foreground">Buscando dados do mercado</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-2xl p-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-red-800 dark:text-red-300">Erro ao carregar Debentures</p>
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
      <div className="px-4 py-2 bg-green-50 dark:bg-green-900/20 border-b border-border">
        <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
          <ExternalLink className="h-3 w-3" />
          Clique em qualquer Debenture para pesquisar detalhes no Google
        </p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
        {debentures.map((debenture: any, index: number) => (
          <div
            key={index}
            onClick={() => abrirDetalhesGoogle(debenture)}
            className="p-4 border border-border rounded-lg hover:border-primary hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                  {debenture.emissor}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {debenture.codigo}
                </p>
              </div>
              <div className="flex gap-2">
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300">
                  Debenture
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 mb-3">
              <div>
                <p className="text-xs text-muted-foreground">Agente Fiduciário</p>
                <p className="font-medium text-foreground">{debenture.agente_fiduciario}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <p className="text-xs text-muted-foreground">Volume de Emissão</p>
                <p className="font-medium text-foreground">{debenture.volume_emissao}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Data de Vencimento</p>
                <p className="font-medium text-foreground">{debenture.data_vencimento}</p>
              </div>
            </div>

            <div className="flex items-center justify-center mt-3 text-primary group-hover:text-primary/80 transition-colors">
              <span className="text-sm font-medium">Clique para pesquisar detalhes</span>
              <ExternalLink className="w-4 h-4 ml-1" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}


export default function AnaliseListaTab() {
  const [activeSubTab, setActiveSubTab] = useState<'acoes' | 'bdrs' | 'fiis' | 'cris' | 'cras' | 'debentures' | 'tesouro'>('acoes')
  

  const { 
    ativosAcoes, 
    ativosBdrs, 
    ativosFiis, 
    setAtivosAcoes, 
    setAtivosBdrs, 
    setAtivosFiis 
  } = useAnalise()
  

  // Usar filtros do contexto
  const { filtrosAcoes, filtrosBdrs, filtrosFiis, setFiltrosAcoes, setFiltrosBdrs, setFiltrosFiis } = useAnalise()

 
  const [loadingAcoes, setLoadingAcoes] = useState(false)
  const [loadingBdrs, setLoadingBdrs] = useState(false)
  const [loadingFiis, setLoadingFiis] = useState(false)

 
  const [errorAcoes, setErrorAcoes] = useState<string | null>(null)
  const [errorBdrs, setErrorBdrs] = useState<string | null>(null)
  const [errorFiis, setErrorFiis] = useState<string | null>(null)


  const [autoSearchAcoes, setAutoSearchAcoes] = useState(false)
  const [autoSearchBdrs, setAutoSearchBdrs] = useState(false)
  const [autoSearchFiis, setAutoSearchFiis] = useState(false)


  const [fiiMetadataMap, setFiiMetadataMap] = useState<Record<string, { tipo?: string; segmento?: string }>>({})

  const { data: carteira } = useQuery({
    queryKey: ['carteira'],
    queryFn: carteiraService.getCarteira,
    retry: 3,
    refetchOnWindowFocus: false
  })


  const tickersNaCarteira = new Set(carteira?.map(ativo => ativo.ticker.toUpperCase()) || [])
  const isAtivoNaCarteira = (ticker: string) => {
    return tickersNaCarteira.has(ticker.toUpperCase())
  }


  useEffect(() => {
    if (!ativosFiis || ativosFiis.length === 0) return

    const buscarMetadados = async () => {
      const newMetadataMap: Record<string, { tipo?: string; segmento?: string }> = {}
      
   
      const batchSize = 5
      for (let i = 0; i < ativosFiis.length; i += batchSize) {
        const batch = ativosFiis.slice(i, i + batchSize)
        
        const promises = batch.map(async (fii) => {
          try {
            const metadata = await ativoService.getFiiMetadata(fii.ticker)
            if (metadata) {
              newMetadataMap[fii.ticker] = {
                tipo: metadata.tipo,
                segmento: metadata.segmento
              }
            }
          } catch (error) {
            console.error(`Erro ao buscar metadata de ${fii.ticker}:`, error)
          }
        })
        
        await Promise.all(promises)
        
      
        setFiiMetadataMap(prev => ({ ...prev, ...newMetadataMap }))
        
        
        if (i + batchSize < ativosFiis.length) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      }
    }

    buscarMetadados()
  }, [ativosFiis])

  // Funções de busca (declaradas primeiro para serem usadas nas funções de mudança de filtro)
  const handleBuscarAcoes = useCallback(async () => {
    setLoadingAcoes(true)
    setErrorAcoes(null)
    try {
      const data = await analiseService.getAtivos('acoes', filtrosAcoes)
      setAtivosAcoes(data)
    } catch (error) {
      setErrorAcoes(error instanceof Error ? error.message : 'Erro ao buscar ações')
    } finally {
      setLoadingAcoes(false)
    }
  }, [filtrosAcoes])

  const handleBuscarBdrs = useCallback(async () => {
    setLoadingBdrs(true)
    setErrorBdrs(null)
    try {
      const data = await analiseService.getAtivos('bdrs', filtrosBdrs)
      setAtivosBdrs(data)
    } catch (error) {
      setErrorBdrs(error instanceof Error ? error.message : 'Erro ao buscar BDRs')
    } finally {
      setLoadingBdrs(false)
    }
  }, [filtrosBdrs])

  const handleBuscarFiis = useCallback(async () => {
    setLoadingFiis(true)
    setErrorFiis(null)
    try {
      const data = await analiseService.getAtivos('fiis', filtrosFiis)
      setAtivosFiis(data)
    } catch (error) {
      setErrorFiis(error instanceof Error ? error.message : 'Erro ao buscar FIIs')
    } finally {
      setLoadingFiis(false)
    }
  }, [filtrosFiis])

  // Funções de mudança de filtro
  const handleFiltroAcoesChange = useCallback((key: keyof FiltrosAnalise, value: number) => {
    setFiltrosAcoes({ ...filtrosAcoes, [key]: value })
    if (autoSearchAcoes) {
      setTimeout(() => handleBuscarAcoes(), 500)
    }
  }, [autoSearchAcoes, filtrosAcoes, handleBuscarAcoes])

  const handleFiltroAcoesStringChange = useCallback((key: keyof FiltrosAnalise, value: string) => {
    setFiltrosAcoes({ ...filtrosAcoes, [key]: value })
    if (autoSearchAcoes) {
      setTimeout(() => handleBuscarAcoes(), 500)
    }
  }, [autoSearchAcoes, filtrosAcoes, handleBuscarAcoes])

  const handleFiltroBdrsChange = useCallback((key: keyof FiltrosAnalise, value: number) => {
    setFiltrosBdrs({ ...filtrosBdrs, [key]: value })
    if (autoSearchBdrs) {
      setTimeout(() => handleBuscarBdrs(), 500)
    }
  }, [autoSearchBdrs, filtrosBdrs, handleBuscarBdrs])

  const handleFiltroBdrsStringChange = useCallback((key: keyof FiltrosAnalise, value: string) => {
    setFiltrosBdrs({ ...filtrosBdrs, [key]: value })
    if (autoSearchBdrs) {
      setTimeout(() => handleBuscarBdrs(), 500)
    }
  }, [autoSearchBdrs, filtrosBdrs, handleBuscarBdrs])

  const handleFiltroFiisChange = useCallback((key: keyof FiltrosAnalise, value: number) => {
    setFiltrosFiis({ ...filtrosFiis, [key]: value })
    if (autoSearchFiis) {
      setTimeout(() => handleBuscarFiis(), 500)
    }
  }, [autoSearchFiis, filtrosFiis, handleBuscarFiis])

  const handleFiltroFiisStringChange = useCallback((key: keyof FiltrosAnalise, value: string) => {
    setFiltrosFiis({ ...filtrosFiis, [key]: value })
    if (autoSearchFiis) {
      setTimeout(() => handleBuscarFiis(), 500)
    }
  }, [autoSearchFiis, filtrosFiis, handleBuscarFiis])

  return (
    <div>
      {/* Sub-tabs para tipos de ativos */}
      <div className="bg-card border border-border rounded-2xl p-2 mb-6 shadow-sm">
        <div className="flex overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setActiveSubTab('acoes')}
            className={`flex-1 px-4 py-3 text-sm font-semibold transition-all duration-200 whitespace-nowrap flex-shrink-0 rounded-xl ${
              activeSubTab === 'acoes'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              Ações
            </div>
          </button>
          <button
            onClick={() => setActiveSubTab('bdrs')}
            className={`flex-1 px-4 py-3 text-sm font-semibold transition-all duration-200 whitespace-nowrap flex-shrink-0 rounded-xl ${
              activeSubTab === 'bdrs'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              BDRs
            </div>
          </button>
          <button
            onClick={() => setActiveSubTab('fiis')}
            className={`flex-1 px-4 py-3 text-sm font-semibold transition-all duration-200 whitespace-nowrap flex-shrink-0 rounded-xl ${
              activeSubTab === 'fiis'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              FIIs
            </div>
          </button>
          <button
            onClick={() => setActiveSubTab('cris')}
            className={`flex-1 px-4 py-3 text-sm font-semibold transition-all duration-200 whitespace-nowrap flex-shrink-0 rounded-xl ${
              activeSubTab === 'cris'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              CRIs
            </div>
          </button>
          <button
            onClick={() => setActiveSubTab('cras')}
            className={`flex-1 px-4 py-3 text-sm font-semibold transition-all duration-200 whitespace-nowrap flex-shrink-0 rounded-xl ${
              activeSubTab === 'cras'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              CRAs
            </div>
          </button>
        <button
          onClick={() => setActiveSubTab('debentures')}
          className={`flex-1 px-4 py-3 text-sm font-semibold transition-all duration-200 whitespace-nowrap flex-shrink-0 rounded-xl ${
            activeSubTab === 'debentures'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            Debentures
          </div>
        </button>
        <button
          onClick={() => setActiveSubTab('tesouro')}
          className={`flex-1 px-4 py-3 text-sm font-semibold transition-all duration-200 whitespace-nowrap flex-shrink-0 rounded-xl ${
            activeSubTab === 'tesouro'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Tesouro Direto
          </div>
        </button>
        </div>
      </div>

      {/* Conteúdo das sub-tabs */}
      <AnimatePresence mode="wait">
        {activeSubTab === 'acoes' && (
          <motion.div
            key="acoes"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <FiltrosAcoes 
              filtros={filtrosAcoes}
              onFiltroChange={handleFiltroAcoesChange}
              onFiltroStringChange={handleFiltroAcoesStringChange}
              onBuscar={handleBuscarAcoes}
              loading={loadingAcoes}
              autoSearch={autoSearchAcoes}
              onAutoSearchChange={setAutoSearchAcoes}
            />
            <TabelaAtivos 
              ativos={ativosAcoes} 
              loading={loadingAcoes} 
              error={errorAcoes} 
              tipo="Ações"
              isAtivoNaCarteira={isAtivoNaCarteira}
            />
          </motion.div>
        )}

        {activeSubTab === 'bdrs' && (
          <motion.div
            key="bdrs"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <FiltrosBdrs 
              filtros={filtrosBdrs}
              onFiltroChange={handleFiltroBdrsChange}
              onFiltroStringChange={handleFiltroBdrsStringChange}
              onBuscar={handleBuscarBdrs}
              loading={loadingBdrs}
              autoSearch={autoSearchBdrs}
              onAutoSearchChange={setAutoSearchBdrs}
            />
            <TabelaAtivos 
              ativos={ativosBdrs} 
              loading={loadingBdrs} 
              error={errorBdrs} 
              tipo="BDRs"
              isAtivoNaCarteira={isAtivoNaCarteira}
            />
          </motion.div>
        )}

        {activeSubTab === 'fiis' && (
          <motion.div
            key="fiis"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <FiltrosFiis 
              filtros={filtrosFiis}
              onFiltroChange={handleFiltroFiisChange}
              onFiltroStringChange={handleFiltroFiisStringChange}
              onBuscar={handleBuscarFiis}
              loading={loadingFiis}
              autoSearch={autoSearchFiis}
              onAutoSearchChange={setAutoSearchFiis}
            />
            <TabelaAtivos 
              ativos={ativosFiis} 
              loading={loadingFiis} 
              error={errorFiis} 
              tipo="FIIs"
              isAtivoNaCarteira={isAtivoNaCarteira}
              fiiMetadataMap={fiiMetadataMap}
            />
          </motion.div>
        )}

        {activeSubTab === 'cris' && (
          <motion.div
            key="cris"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <TabelaCRIs />
          </motion.div>
        )}

        {activeSubTab === 'cras' && (
          <motion.div
            key="cras"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <TabelaCRAs />
          </motion.div>
        )}

        {activeSubTab === 'debentures' && (
          <motion.div
            key="debentures"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <TabelaDebentures />
          </motion.div>
        )}

        {activeSubTab === 'tesouro' && (
          <motion.div
            key="tesouro"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <TabelaTesouroDireto />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Componente para tabela de Tesouro Direto
function TabelaTesouroDireto() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [titulos, setTitulos] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroIndexador, setFiltroIndexador] = useState('')

  const carregarTitulos = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/tesouro-direto/titulos')
      const data = await response.json()
      if (data.titulos) {
        setTitulos(data.titulos)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar títulos do Tesouro Direto')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    carregarTitulos()
  }, [carregarTitulos])

  const abrirTesouroDireto = () => {
    window.open('https://www.tesourodireto.com.br/', '_blank')
  }

  const titulosFiltrados = titulos.filter((titulo: any) => {
    const matchesSearch = titulo.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         titulo.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         titulo.ticker.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesCategoria = !filtroCategoria || titulo.categoria === filtroCategoria
    const matchesIndexador = !filtroIndexador || titulo.indexador_normalizado === filtroIndexador
    
    return matchesSearch && matchesCategoria && matchesIndexador
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto"></div>
          <div className="space-y-2">
            <p className="text-lg font-semibold text-foreground">Carregando Títulos do Tesouro Direto...</p>
            <p className="text-sm text-muted-foreground">Buscando dados do Tesouro Nacional</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-2xl p-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-red-800 dark:text-red-300">Erro ao carregar títulos do Tesouro Direto</p>
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative">
          <input
            type="text"
            placeholder="Buscar títulos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-background text-foreground"
          />
        </div>

        <select
          value={filtroCategoria}
          onChange={(e) => setFiltroCategoria(e.target.value)}
          className="px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-background text-foreground"
          aria-label="Filtrar por categoria"
        >
          <option value="">Todas as categorias</option>
          <option value="Taxa Fixa">Taxa Fixa</option>
          <option value="Taxa Selic">Taxa Selic</option>
          <option value="Inflação (IPCA)">Inflação (IPCA)</option>
          <option value="Educação">Educação</option>
          <option value="Renda">Renda</option>
        </select>

        <select
          value={filtroIndexador}
          onChange={(e) => setFiltroIndexador(e.target.value)}
          className="px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-background text-foreground"
          aria-label="Filtrar por indexador"
        >
          <option value="">Todos os indexadores</option>
          <option value="PREFIXADO">PREFIXADO</option>
          <option value="SELIC">SELIC</option>
          <option value="IPCA">IPCA</option>
        </select>
      </div>

      {/* Lista de Títulos */}
      {titulosFiltrados.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Nenhum título do Tesouro Direto encontrado
          </h3>
          <p className="text-muted-foreground mb-4">
            Tente ajustar os filtros ou verifique sua conexão.
          </p>
          <button
            onClick={carregarTitulos}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            Tentar Novamente
          </button>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          <div className="px-4 py-2 bg-yellow-50 dark:bg-yellow-900/20 border-b border-border">
            <p className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
              <ExternalLink className="h-3 w-3" />
              Clique em qualquer título para acessar o site oficial do Tesouro Direto
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
            {titulosFiltrados.map((titulo: any, index: number) => (
              <div
                key={index}
                onClick={abrirTesouroDireto}
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
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      titulo.tipo_fixacao === 'PRÉ-FIXADO' 
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300'
                        : 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
                    }`}>
                      {titulo.tipo_fixacao}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      titulo.liquidez === 'Alta'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
                        : titulo.liquidez === 'Média'
                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300'
                        : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
                    }`}>
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
                      R$ {titulo.pu.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                    Min: R$ {titulo.valor_minimo.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-muted-foreground">
                    Max: R$ {titulo.valor_maximo.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex items-center justify-center mt-3 text-primary group-hover:text-primary/80 transition-colors">
                  <span className="text-sm font-medium">Clique para investir no site oficial</span>
                  <ExternalLink className="w-4 h-4 ml-1" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
