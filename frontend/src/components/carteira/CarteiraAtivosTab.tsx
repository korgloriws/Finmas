import { 
  BarChart3, 
  Target, 
  ChevronUp, 
  ChevronDown, 
  Settings, 
  Edit, 
  Trash2,
  FileSpreadsheet,
  Plus
} from 'lucide-react'
import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { formatCurrency, formatDividendYield, formatPercentage, formatNumber } from '../../utils/formatters'
import TickerWithLogo from '../TickerWithLogo'
import VencimentoStatus from '../VencimentoStatus'
import B3ImportModal from './B3ImportModal'
import { B3Ativo } from '../../utils/excelParser'
import { ativoService } from '../../services/api'



function TabelaAtivosPorTipo({ 
  tipo, 
  carteira, 
  valorTotal, 
  expandedTipos, 
  setExpandedTipos, 
  movimentacoesAll, 
  indicadores, 
  editingId, 
  editQuantidade, 
  setEditQuantidade, 
  editPreco,
  setEditPreco,
  handleEditar, 
  handleSalvarEdicao, 
  handleCancelarEdicao, 
  handleRemover, 
  setManageTipoOpen, 
  setRenameTipoValue,
  getMetadadosAtivo
}: {
  tipo: string
  carteira: any[]
  valorTotal: number
  expandedTipos: Record<string, boolean>
  setExpandedTipos: (fn: (prev: Record<string, boolean>) => Record<string, boolean>) => void
  movimentacoesAll: any[]
  indicadores: any
  editingId: number | null
  editQuantidade: string
  setEditQuantidade: (value: string) => void
  editPreco: string
  setEditPreco: (value: string) => void
  handleEditar: (id: number, quantidade: number) => void
  handleSalvarEdicao: () => void
  handleCancelarEdicao: () => void
  handleRemover: (id: number) => void
  setManageTipoOpen: (value: { open: boolean; tipo?: string }) => void
  setRenameTipoValue: (value: string) => void
  getMetadadosAtivo: (ticker: string) => { tipo?: string; segmento?: string; p_vp?: number; valor_patrimonial?: number } | null
}) {
  const ativosDoTipo = carteira?.filter(ativo => ativo?.tipo === tipo) || []
  const totalTipo = ativosDoTipo.reduce((total, ativo) => total + (ativo?.valor_total || 0), 0)
  const porcentagemTipo = valorTotal > 0 ? (totalTipo / valorTotal * 100).toFixed(1) : '0.0'
  const isExpanded = expandedTipos[tipo] || false
  const podeRemoverTipo = ativosDoTipo.length === 0
  const isRendaFixa = tipo.toLowerCase().includes('renda fixa')
  const isCripto = tipo.toLowerCase().includes('cripto')
  const isFii = tipo.toLowerCase().includes('fii')

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden shadow-lg mb-6">
      <div 
        className="bg-gradient-to-r from-primary/10 to-primary/5 px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-border cursor-pointer hover:bg-primary/20 transition-colors"
        onClick={() => setExpandedTipos(prev => ({ ...prev, [tipo]: !prev[tipo] }))}
      >
        <div className="flex items-center justify-between flex-wrap gap-2 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <button className="p-1 hover:bg-white/20 rounded transition-colors flex-shrink-0">
              {isExpanded ? <ChevronUp size={18} className="sm:w-5 sm:h-5" /> : <ChevronDown size={18} className="sm:w-5 sm:h-5" />}
            </button>
            <Target className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <h3 className="text-base sm:text-lg font-semibold truncate">{tipo}</h3>
              <div className="flex flex-col xs:flex-row xs:items-center gap-1 xs:gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                <span>{ativosDoTipo.length} ativo{ativosDoTipo.length !== 1 ? 's' : ''}</span>
                <span className="hidden xs:inline">•</span>
                <span>{porcentagemTipo}% da carteira</span>
                <span className="hidden xs:inline">•</span>
                <span className="text-xs">Média DY: {ativosDoTipo.length > 0 ? 
                  formatDividendYield(ativosDoTipo.reduce((sum, ativo) => sum + (ativo?.dy || 0), 0) / ativosDoTipo.length) : 
                  'N/A'
                }</span>
              </div>
            </div>
          </div>
          <div className="text-right flex items-center gap-1 sm:gap-2 md:gap-3 flex-shrink-0">
            <div className="text-xs sm:text-sm md:text-lg font-bold">{formatCurrency(totalTipo)}</div>
            {(() => {
              const movs = movimentacoesAll || []
              let somaValoresAtuais = 0
              let somaValoresInvestidos = 0
              for (const a of ativosDoTipo) {
                const mlist = movs
                  .filter(m => m.ticker?.toUpperCase?.() === (a?.ticker || '').toUpperCase())
                  .sort((x, y) => String(x.data).localeCompare(String(y.data)))
                type Lot = { qty: number; price: number; date: string }
                const lots: Lot[] = []
                for (const m of mlist) {
                  const q = Number(m.quantidade || 0)
                  const p = Number(m.preco || 0)
                  if (m.tipo === 'compra') {
                    lots.push({ qty: q, price: p, date: m.data })
                  } else if (m.tipo === 'venda') {
                    let remaining = q
                    while (remaining > 0 && lots.length > 0) {
                      const lot = lots[0]
                      const consume = Math.min(lot.qty, remaining)
                      lot.qty -= consume
                      remaining -= consume
                      if (lot.qty <= 0) lots.shift()
                    }
                  }
                }
                const qtd = lots.reduce((s, l) => s + l.qty, 0)
                const val = lots.reduce((s, l) => s + l.qty * l.price, 0)
                const precoMed = qtd > 0 ? (val / qtd) : null
               
                const precoBase = (a as any)?.preco_medio ?? a?.preco_compra ?? precoMed
                
                if (precoBase != null) {
                    somaValoresInvestidos += precoBase * (a?.quantidade || 0)
                    somaValoresAtuais += (a?.preco_atual || 0) * (a?.quantidade || 0)
                }
              }
              const rendTipo = (somaValoresInvestidos > 0) ? ((somaValoresAtuais - somaValoresInvestidos) / somaValoresInvestidos) * 100 : null
              return (
                <div className={`text-xs font-medium ${rendTipo != null ? (rendTipo >= 0 ? 'text-emerald-600' : 'text-red-600') : 'text-muted-foreground'}`}>
                  {rendTipo != null ? `${rendTipo.toFixed(1).replace('.', ',')}%` : '-'}
                </div>
              )
            })()}
            <div className="hidden sm:block text-xs sm:text-sm text-muted-foreground">{porcentagemTipo}% do total</div>
            <button
              onClick={(e)=>{ e.stopPropagation(); setManageTipoOpen({open: true, tipo}); setRenameTipoValue(tipo) }}
              className="p-1 sm:p-2 rounded hover:bg-white/20 flex-shrink-0"
              title="Gerenciar tipo"
            >
              <Settings size={16} className="sm:w-[18px] sm:h-[18px]" />
            </button>
            {podeRemoverTipo && (
              <button
                onClick={(e)=>{
                  e.stopPropagation()
                 
                  setExpandedTipos(prev => {
                    const copy = { ...prev }
                    delete copy[tipo]
                    return copy
                  })
                }}
                className="px-1 sm:px-2 py-1 text-xs rounded bg-red-100 text-red-700 hover:bg-red-200 flex-shrink-0"
                title="Remover seção (somente tipos sem ativos)"
              >
                <span className="hidden sm:inline">Remover seção</span>
                <span className="sm:hidden">Remover</span>
              </button>
            )}
          </div>
        </div>
      </div>
      
      {isExpanded && (
        <>
          {ativosDoTipo.length > 0 ? (
            <>
              {/* Desktop Table View */}
              <div className="hidden lg:block overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-sm">Ticker</th>
                    <th className="px-3 py-2 text-left font-medium text-sm">Nome</th>
                    <th className="px-3 py-2 text-left font-medium text-sm">Quantidade</th>
                    <th className="px-3 py-2 text-left font-medium text-sm">Preço Atual</th>
                    <th className="px-3 py-2 text-left font-medium text-sm">Preço de Compra</th>
                    <th className="px-3 py-2 text-left font-medium text-sm">Valor Total</th>
                    {tipo.toLowerCase().includes('renda fixa') && (
                      <th className="px-3 py-2 text-left font-medium text-sm">Indexado</th>
                    )}
                    {tipo.toLowerCase().includes('renda fixa') && (
                      <th className="px-3 py-2 text-left font-medium text-sm">Rentab. Estimada (anual)</th>
                    )}
                    <th className="px-3 py-2 text-left font-medium text-sm">Preço Médio</th>
                    <th className="px-3 py-2 text-left font-medium text-sm">Valorização</th>
                    <th className="px-3 py-2 text-left font-medium text-sm">Rendimento</th>
                    <th className="px-3 py-2 text-left font-medium text-sm">% Carteira</th>
                    {!isRendaFixa && !isCripto && !isFii && (
                      <>
                        <th className="px-3 py-2 text-left font-medium text-sm">DY</th>
                        <th className="px-3 py-2 text-left font-medium text-sm">ROE</th>
                        <th className="px-3 py-2 text-left font-medium text-sm">P/L</th>
                        <th className="px-3 py-2 text-left font-medium text-sm">P/VP</th>
                      </>
                    )}
                    {isFii && (
                      <>
                        <th className="px-3 py-2 text-left font-medium text-sm">DY</th>
                        <th className="px-3 py-2 text-left font-medium text-sm">Segmento</th>
                        <th className="px-3 py-2 text-left font-medium text-sm">P/VP</th>
                      </>
                    )}
                    {tipo.toLowerCase().includes('renda fixa') && (
                      <th className="px-3 py-2 text-left font-medium text-sm">Vencimento</th>
                    )}
                    <th className="px-3 py-2 text-left font-medium text-sm">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {ativosDoTipo.map((ativo) => {
                    const movsDoTicker = (movimentacoesAll || [])
                      .filter(m => m.ticker?.toUpperCase?.() === (ativo?.ticker || '').toUpperCase())
                      .sort((a, b) => String(a.data).localeCompare(String(b.data)))

                    type Lot = { qty: number; price: number; date: string }
                    const lots: Lot[] = []
                    for (const m of movsDoTicker) {
                      const qty = Number(m.quantidade || 0)
                      const price = Number(m.preco || 0)
                      if (m.tipo === 'compra') {
                        lots.push({ qty, price, date: m.data })
                      } else if (m.tipo === 'venda') {
                        let remaining = qty
                        while (remaining > 0 && lots.length > 0) {
                          const lot = lots[0]
                          const consume = Math.min(lot.qty, remaining)
                          lot.qty -= consume
                          remaining -= consume
                          if (lot.qty <= 0) lots.shift()
                        }
                        
                      }
                    }
                    const totalQtd = lots.reduce((s, l) => s + l.qty, 0)
                    const totalValor = lots.reduce((s, l) => s + l.qty * l.price, 0)
                    const precoMedioLocal = totalQtd > 0 ? (totalValor / totalQtd) : null
                    // Preferir preco_medio persistido; fallback para preco_compra; senão média local
                    const precoBase = (ativo as any)?.preco_medio ?? ativo?.preco_compra ?? precoMedioLocal
                    
                    const rendimentoPct = (precoBase != null && ativo?.preco_atual)
                      ? ((ativo.preco_atual - precoBase) / precoBase) * 100
                      : null
                    const valorizacaoAbs = (precoBase != null && ativo?.preco_atual && ativo?.quantidade > 0)
                      ? (ativo.preco_atual - precoBase) * ativo.quantidade
                      : null
                    const porcentagemAtivo = valorTotal > 0 ? ((ativo?.valor_total || 0) / valorTotal * 100).toFixed(1) : '0.0'
                    return (
                      <tr key={ativo?.id} className="hover:bg-muted/40 transition-colors">
                        <td className="px-3 py-2 min-w-[140px]">
                          <TickerWithLogo ticker={ativo?.ticker || ''} nome={ativo?.nome_completo || ''} />
                        </td>
                        <td className="px-3 py-2 text-sm max-w-[200px] truncate" title={ativo?.nome_completo}>{ativo?.nome_completo}</td>
                        <td className="px-3 py-2 text-sm">
                          {editingId === ativo?.id ? (
                            <input
                              type="text"
                              value={editQuantidade}
                              onChange={(e) => setEditQuantidade(e.target.value)}
                              className="w-16 px-2 py-1 text-sm border border-border rounded bg-background text-foreground"
                              aria-label="Editar quantidade"
                              placeholder="Qtd"
                            />
                          ) : (
                            ativo?.quantidade
                          )}
                        </td>
                        <td className="px-3 py-2 text-sm font-semibold">
                          {editingId === ativo?.id ? (
                            <input
                              type="text"
                              value={editPreco}
                              onChange={(e) => setEditPreco(e.target.value)}
                              className="w-24 px-2 py-1 text-sm border border-border rounded bg-background text-foreground"
                              aria-label="Editar preço"
                              placeholder="Preço"
                            />
                          ) : (
                            formatCurrency(ativo?.preco_atual)
                          )}
                        </td>
                        <td className="px-3 py-2 text-sm font-semibold">
                          {formatCurrency(ativo?.preco_compra)}
                        </td>
                        <td className="px-3 py-2 text-sm font-semibold">{formatCurrency(ativo?.valor_total)}</td>
                        {tipo.toLowerCase().includes('renda fixa') && (
                          <td className="px-3 py-2 text-xs text-muted-foreground">
                            {ativo?.indexador ? `${ativo.indexador} ${ativo.indexador_pct ? `${ativo.indexador_pct}%` : ''}` : '-'}
                          </td>
                        )}
                        {tipo.toLowerCase().includes('renda fixa') && (
                          <td className="px-3 py-2 text-xs">
                            {(() => {
                              const pct = (ativo?.indexador_pct || 0)
                              const idx = (ativo?.indexador || '') as 'CDI'|'IPCA'|'SELIC'|''
                              const getVal = (d:any) => {
                                if (!d) return null
                                const v = parseFloat(String(d.valor))
                                return isFinite(v) ? v : null
                              }
                              const raw = idx === 'CDI' ? getVal(indicadores?.cdi)
                                : idx === 'IPCA' ? getVal(indicadores?.ipca)
                                : idx === 'SELIC' ? getVal(indicadores?.selic)
                                : null
                              if (!idx || raw == null || !pct) return '-'
              
                              const baseAnual = raw <= 2 ? ((Math.pow(1 + (raw/100), 12) - 1) * 100) : raw
                              const anual = (pct/100) * baseAnual
                              return `${anual.toFixed(1)}% a.a.`
                            })()}
                          </td>
                        )}
                        <td className="px-3 py-2 text-sm">{precoBase != null ? formatCurrency(precoBase) : '-'}</td>
                        <td className={`px-3 py-2 text-sm font-medium ${valorizacaoAbs != null ? (valorizacaoAbs >= 0 ? 'text-emerald-600' : 'text-red-600') : ''}`}>
                          {valorizacaoAbs != null ? formatCurrency(valorizacaoAbs) : '-'}
                        </td>
                        <td className={`px-3 py-2 text-sm font-medium ${rendimentoPct != null ? (rendimentoPct >= 0 ? 'text-emerald-600' : 'text-red-600') : ''}`}>
                          {rendimentoPct != null ? `${rendimentoPct.toFixed(1).replace('.', ',')}%` : '-'}
                        </td>
                        <td className="px-3 py-2 text-sm text-muted-foreground">{porcentagemAtivo}%</td>
                        {!isRendaFixa && !isCripto && !isFii && (
                          <>
                            <td className="px-3 py-2 text-green-600 font-medium text-sm">
                              {formatDividendYield(ativo?.dy)}
                            </td>
                            <td className={`px-3 py-2 font-medium text-sm ${ativo?.roe && ativo.roe > 15 ? 'text-blue-600' : ''}`}>
                              {formatPercentage(ativo?.roe ? ativo.roe * 100 : null)}
                            </td>
                            <td className="px-3 py-2 text-sm">{formatNumber(ativo?.pl)}</td>
                            <td className="px-3 py-2 text-sm">{formatNumber(ativo?.pvp)}</td>
                          </>
                        )}
                        {isFii && (
                          <>
                            <td className="px-3 py-2 text-green-600 font-medium text-sm">
                              {formatDividendYield(ativo?.dy)}
                            </td>
                            <td className="px-3 py-2 text-sm">
                              {(() => {
                                // Buscar metadados do cache (sob demanda)
                                const metadados = getMetadadosAtivo(ativo?.ticker || '')
                                return metadados?.segmento || (ativo as any)?.segmento_fii || '-'
                              })()}
                            </td>
                            <td className="px-3 py-2 text-sm">
                              {(() => {
                                const metadados = getMetadadosAtivo(ativo?.ticker || '')
                                const pvp = metadados?.p_vp
                                if (pvp !== undefined && pvp !== null) {
                                  return (
                                    <span className={pvp < 1 ? 'text-green-600 font-medium' : pvp > 1.1 ? 'text-orange-600 font-medium' : ''}>
                                      {pvp.toFixed(2)}
                                    </span>
                                  )
                                }
                                return '-'
                              })()}
                            </td>
                          </>
                        )}
                        {tipo.toLowerCase().includes('renda fixa') && (
                          <td className="px-3 py-2 text-sm">
                            <VencimentoStatus 
                              status_vencimento={ativo?.status_vencimento} 
                              vencimento={ativo?.vencimento} 
                            />
                          </td>
                        )}
                        <td className="px-3 py-2">
                          <div className="flex gap-1">
                            {editingId === ativo?.id ? (
                              <>
                                <button
                                  onClick={handleSalvarEdicao}
                                  className="p-1 text-green-600 hover:text-green-700"
                                  title="Salvar"
                                >
                                  ✓
                                </button>
                                <button
                                  onClick={handleCancelarEdicao}
                                  className="p-1 text-gray-600 hover:text-gray-700"
                                  title="Cancelar"
                                >
                                  ✕
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleEditar(ativo?.id || 0, ativo?.quantidade || 0)}
                                  className="p-1 text-blue-600 hover:text-blue-700"
                                  title="Editar"
                                >
                                  <Edit size={14} />
                                </button>
                                <button
                                  onClick={() => handleRemover(ativo?.id || 0)}
                                  className="p-1 text-red-600 hover:text-red-700"
                                  title="Remover"
                                >
                                  <Trash2 size={14} />
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

              {/* Mobile Card View */}
              <div className="lg:hidden space-y-3 p-3 sm:p-4">
                {ativosDoTipo.map((ativo) => {
                  const movsDoTicker = (movimentacoesAll || [])
                    .filter(m => m.ticker?.toUpperCase?.() === (ativo?.ticker || '').toUpperCase())
                    .sort((a, b) => String(a.data).localeCompare(String(b.data)))

                  type Lot = { qty: number; price: number; date: string }
                  const lots: Lot[] = []
                  for (const m of movsDoTicker) {
                    const qty = Number(m.quantidade || 0)
                    const price = Number(m.preco || 0)
                    if (m.tipo === 'compra') {
                      lots.push({ qty, price, date: m.data })
                    } else if (m.tipo === 'venda') {
                      let remaining = qty
                      while (remaining > 0 && lots.length > 0) {
                        const lot = lots[0]
                        const consume = Math.min(lot.qty, remaining)
                        lot.qty -= consume
                        remaining -= consume
                        if (lot.qty <= 0) lots.shift()
                      }
                    }
                  }
                  const totalQtd = lots.reduce((s, l) => s + l.qty, 0)
                  const totalValor = lots.reduce((s, l) => s + l.qty * l.price, 0)
                  const precoMedioLocal = totalQtd > 0 ? (totalValor / totalQtd) : null
                  const precoMedioMostrar = (ativo as any)?.preco_medio ?? ativo?.preco_compra ?? precoMedioLocal
                  const rendimentoPct = (precoMedioMostrar != null && ativo?.preco_atual)
                    ? ((ativo.preco_atual - precoMedioMostrar) / (precoMedioMostrar as number)) * 100
                    : null
                  const valorizacaoAbs = (precoMedioMostrar != null && ativo?.preco_atual && totalQtd > 0)
                    ? (ativo.preco_atual - (precoMedioMostrar as number)) * totalQtd
                    : null
                  const porcentagemAtivo = valorTotal > 0 ? ((ativo?.valor_total || 0) / valorTotal * 100).toFixed(1) : '0.0'
                  
                  return (
                    <div key={ativo?.id} className="bg-background border border-border rounded-lg p-3 sm:p-4 space-y-3">
                      {/* Header com Ticker e Ações */}
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <TickerWithLogo ticker={ativo?.ticker || ''} nome={ativo?.nome_completo || ''} />
                        </div>
                        <div className="flex gap-1 sm:gap-2 ml-2">
                          {editingId === ativo?.id ? (
                            <>
                              <button
                                onClick={handleSalvarEdicao}
                                className="p-1.5 sm:p-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded"
                                title="Salvar"
                              >
                                ✓
                              </button>
                              <button
                                onClick={handleCancelarEdicao}
                                className="p-1.5 sm:p-2 text-gray-600 hover:text-gray-700 hover:bg-gray-50 rounded"
                                title="Cancelar"
                              >
                                ✕
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleEditar(ativo?.id || 0, ativo?.quantidade || 0)}
                                className="p-1.5 sm:p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded"
                                title="Editar"
                              >
                                <Edit size={16} className="sm:w-[18px] sm:h-[18px]" />
                              </button>
                              <button
                                onClick={() => handleRemover(ativo?.id || 0)}
                                className="p-1.5 sm:p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded"
                                title="Remover"
                              >
                                <Trash2 size={16} className="sm:w-[18px] sm:h-[18px]" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Nome do Ativo */}
                      <div className="text-xs sm:text-sm text-muted-foreground truncate">
                        {ativo?.nome_completo}
                      </div>

                      {/* Grid de Informações Principais */}
                      <div className="grid grid-cols-2 gap-2 sm:gap-3">
                        <div className="space-y-1.5 sm:space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-muted-foreground">Quantidade</span>
                            {editingId === ativo?.id ? (
                              <input
                                type="text"
                                value={editQuantidade}
                                onChange={(e) => setEditQuantidade(e.target.value)}
                                className="w-16 sm:w-20 px-2 py-1 text-xs sm:text-sm border border-border rounded bg-background text-foreground"
                                aria-label="Editar quantidade"
                                placeholder="Qtd"
                              />
                            ) : (
                              <span className="text-xs sm:text-sm font-medium">{ativo?.quantidade}</span>
                            )}
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-muted-foreground">Preço Atual</span>
                            <span className="text-xs sm:text-sm font-semibold">{formatCurrency(ativo?.preco_atual)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-muted-foreground">Valor Total</span>
                            <span className="text-xs sm:text-sm font-semibold text-primary">{formatCurrency(ativo?.valor_total)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-muted-foreground">% Carteira</span>
                            <span className="text-xs sm:text-sm text-muted-foreground">{porcentagemAtivo}%</span>
                          </div>
                        </div>
                        
                        {!isRendaFixa && !isCripto && !isFii && (
                          <div className="space-y-1.5 sm:space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-muted-foreground">DY</span>
                              <span className="text-xs sm:text-sm text-green-600 font-medium">
                                {formatDividendYield(ativo?.dy)}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-muted-foreground">P/L</span>
                              <span className="text-xs sm:text-sm">{formatNumber(ativo?.pl)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-muted-foreground">P/VP</span>
                              <span className="text-xs sm:text-sm">{formatNumber(ativo?.pvp)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-muted-foreground">ROE</span>
                              <span className={`text-xs sm:text-sm font-medium ${ativo?.roe && ativo.roe > 15 ? 'text-blue-600' : ''}`}>
                                {formatPercentage(ativo?.roe ? ativo.roe * 100 : null)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* DY, Segmento e P/VP para FIIs */}
                      {isFii && (() => {
                        // Buscar metadados do cache (sob demanda)
                        const metadados = getMetadadosAtivo(ativo?.ticker || '')
                        const segmento = metadados?.segmento || (ativo as any)?.segmento_fii
                        const pvp = metadados?.p_vp
                        return (ativo?.dy !== undefined || segmento || pvp !== undefined) ? (
                          <div className="pt-2 sm:pt-3 border-t border-border space-y-2">
                            {ativo?.dy !== undefined && (
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-muted-foreground">DY</span>
                                <span className="text-xs sm:text-sm text-green-600 font-medium">
                                  {formatDividendYield(ativo.dy)}
                                </span>
                              </div>
                            )}
                            {segmento && (
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-muted-foreground">Segmento</span>
                                <span className="text-xs sm:text-sm font-medium">{segmento}</span>
                              </div>
                            )}
                            {pvp !== undefined && pvp !== null && (
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-muted-foreground">P/VP</span>
                                <span className={`text-xs sm:text-sm font-medium ${
                                  pvp < 1 ? 'text-green-600' : pvp > 1.1 ? 'text-orange-600' : ''
                                }`}>
                                  {pvp.toFixed(2)}
                                </span>
                              </div>
                            )}
                          </div>
                        ) : null
                      })()}

                      {/* Status de Vencimento para Renda Fixa */}
                      {tipo.toLowerCase().includes('renda fixa') && ativo?.status_vencimento && (
                        <div className="pt-2 sm:pt-3 border-t border-border">
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-muted-foreground">Vencimento</span>
                            <VencimentoStatus 
                              status_vencimento={ativo?.status_vencimento} 
                              vencimento={ativo?.vencimento} 
                            />
                          </div>
                        </div>
                      )}

                      {/* Informações Adicionais (se houver) */}
                      {(ativo?.indexador || precoMedioLocal != null || valorizacaoAbs != null || rendimentoPct != null) && (
                        <div className="pt-2 sm:pt-3 border-t border-border">
                          <div className="grid grid-cols-1 gap-1.5 sm:gap-2 text-xs">
                            {ativo?.indexador && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Indexado</span>
                                <span className="text-xs">{ativo.indexador} {ativo.indexador_pct ? `${ativo.indexador_pct}%` : ''}</span>
                              </div>
                            )}
                            {precoMedioLocal != null && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Preço Médio</span>
                                <span className="text-xs">{formatCurrency(precoMedioLocal as number)}</span>
                              </div>
                            )}
                            {valorizacaoAbs != null && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Valorização</span>
                                <span className={`text-xs font-medium ${valorizacaoAbs >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                  {formatCurrency(valorizacaoAbs)}
                                </span>
                              </div>
                            )}
                            {rendimentoPct != null && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Rendimento</span>
                                <span className={`text-xs font-medium ${rendimentoPct >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                  {rendimentoPct.toFixed(1).replace('.', ',')}%
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <div className="p-6 text-center text-muted-foreground">
              Nenhum ativo do tipo {tipo} na carteira.
            </div>
          )}
        </>
      )}
    </div>
  )
}

interface CarteiraAtivosTabProps {

  inputTicker: string
  setInputTicker: (value: string) => void
  inputQuantidade: string
  setInputQuantidade: (value: string) => void
  inputTipo: string
  setInputTipo: (value: string) => void
  inputPreco: string
  setInputPreco: (value: string) => void
  inputIndexador: string
  setInputIndexador: (value: string) => void
  inputIndexadorPct: string
  setInputIndexadorPct: (value: string) => void
  // Novos campos RF
  inputDataAplicacao?: string
  setInputDataAplicacao?: (value: string) => void
  inputVencimento?: string
  setInputVencimento?: (value: string) => void
  inputIsentoIr?: boolean
  setInputIsentoIr?: (value: boolean) => void
  handleAdicionar: () => void
  adicionarMutation: any
  

  carteira: any[]
  loadingCarteira: boolean
  ativosPorTipo: Record<string, any[]>
  valorTotal: number
  topAtivos: any[]
  

  editingId: number | null
  editQuantidade: string
  setEditQuantidade: (value: string) => void
  editPreco: string
  setEditPreco: (value: string) => void
  handleEditar: (id: number, quantidade: number) => void
  handleSalvarEdicao: () => void
  handleCancelarEdicao: () => void
  handleRemover: (id: number) => void
  
  // Estados de tipos
  expandedTipos: Record<string, boolean>
  setExpandedTipos: (fn: (prev: Record<string, boolean>) => Record<string, boolean>) => void
  setManageTipoOpen: (value: { open: boolean; tipo?: string }) => void
  setRenameTipoValue: (value: string) => void
  
  // Dados adicionais
  movimentacoesAll: any[]
  indicadores: any
  tiposDisponiveisComputed: string[]
  tesouroTitulos?: { titulos: Array<any> }
  onPickTesouro?: (item: any) => void
}

export default function CarteiraAtivosTab({
  inputTicker,
  setInputTicker,
  inputQuantidade,
  setInputQuantidade,
  inputTipo,
  setInputTipo,
  inputPreco,
  setInputPreco,
  inputIndexador,
  setInputIndexador,
  inputIndexadorPct,
  setInputIndexadorPct,
  inputDataAplicacao,
  setInputDataAplicacao,
  inputVencimento,
  setInputVencimento,
  inputIsentoIr,
  setInputIsentoIr,
  handleAdicionar,
  adicionarMutation,
  carteira,
  loadingCarteira,
  ativosPorTipo,
  valorTotal,
  topAtivos,
  editingId,
  editQuantidade,
  setEditQuantidade,
  editPreco,
  setEditPreco,
  handleEditar,
  handleSalvarEdicao,
  handleCancelarEdicao,
  handleRemover,
  expandedTipos,
  setExpandedTipos,
  setManageTipoOpen,
  setRenameTipoValue,
  movimentacoesAll,
  indicadores,
  tiposDisponiveisComputed,
  tesouroTitulos,
  onPickTesouro
}: CarteiraAtivosTabProps) {
  const [showB3Import, setShowB3Import] = useState(false)

  // Identificar FIIs na carteira para buscar metadados sob demanda
  const fiisNaCarteira = useMemo(() => {
    if (!carteira) return []
    return carteira
      .filter(ativo => {
        const tipo = (ativo?.tipo || '').toLowerCase()
        return tipo.includes('fii') || (ativo?.ticker || '').toUpperCase().endsWith('11')
      })
      .map(ativo => ativo.ticker)
  }, [carteira])

  // Buscar metadados de FIIs sob demanda (em background, não bloqueia UI)
  // Cache de 1 hora (igual ROE, DY, etc)
  const metadadosFiis = useQuery({
    queryKey: ['fii-metadados-carteira', fiisNaCarteira],
    queryFn: async () => {
      const metadados: Record<string, { tipo?: string; segmento?: string; p_vp?: number; valor_patrimonial?: number }> = {}
      
      // Buscar metadados em paralelo para todos os FIIs
      const promises = fiisNaCarteira.map(async (ticker) => {
        try {
          const metadata = await ativoService.getFiiMetadata(ticker, false)
          if (metadata) {
            metadados[ticker] = {
              tipo: metadata.tipo,
              segmento: metadata.segmento,
              p_vp: metadata.p_vp,
              valor_patrimonial: metadata.valor_patrimonial
            }
          }
        } catch (error) {
          console.warn(`Erro ao buscar metadados de ${ticker}:`, error)
        }
      })
      
      await Promise.all(promises)
      return metadados
    },
    enabled: fiisNaCarteira.length > 0,
    staleTime: 60 * 60 * 1000, // 1 hora - cache igual ROE, DY, etc
    gcTime: 2 * 60 * 60 * 1000, // 2 horas
    refetchOnWindowFocus: false,
    refetchOnMount: false, // Usa cache se disponível
  })

  // Função auxiliar para obter metadados de um ativo
  const getMetadadosAtivo = (ticker: string) => {
    return metadadosFiis.data?.[ticker] || null
  }

  const handleB3Import = async (ativos: B3Ativo[]) => {
    try {
     
      const compras = ativos.map(ativo => {

        const precoUnitario = ativo.tipo.includes('Renda Fixa') || ativo.tipo === 'Tesouro Direto' 
          ? ativo.valorTotal  
          : ativo.precoMedio 

        return {
          ticker: ativo.ticker,
          quantidade: ativo.quantidade,
          preco: precoUnitario, 
          tipo: ativo.tipo,
          data_aplicacao: ativo.dataAplicacao || new Date().toISOString().split('T')[0],
          vencimento: ativo.vencimento || '',
          indexador: ativo.indexador || '',
          indexador_pct: 0,
          isento_ir: false
        }
      })


      for (const compra of compras) {
        console.log('Adicionando compra:', compra)
        await adicionarMutation.mutateAsync({
          ticker: compra.ticker,
          quantidade: compra.quantidade,
          preco: compra.preco,
          tipo: compra.tipo,
          data_aplicacao: compra.data_aplicacao,
          vencimento: compra.vencimento,
          indexador: compra.indexador,
          indexador_pct: compra.indexador_pct,
          isento_ir: compra.isento_ir
        })
      }

      alert(`${ativos.length} ativos importados com sucesso! Os valores históricos da B3 foram preservados.`)
    } catch (error) {
      console.error('Erro ao importar ativos:', error)
      alert('Erro ao importar ativos. Tente novamente.')
    }
  }

  return (
    <div className="space-y-6">
      {/* Formulário original removido: a adição de ativos acontece via modal */}

      {/* Resumo da Carteira - Renderiza imediatamente com skeleton */}
      {loadingCarteira && (!carteira || carteira.length === 0) ? (
        <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-border rounded-lg p-3 sm:p-4 md:p-6 mb-6">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="animate-pulse h-6 bg-muted rounded w-40"></div>
            <div className="animate-pulse h-8 bg-muted rounded w-32"></div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-card border border-border rounded-lg p-2 sm:p-3 md:p-4">
                <div className="animate-pulse h-4 bg-muted rounded w-20 mb-2"></div>
                <div className="animate-pulse h-8 bg-muted rounded w-16"></div>
              </div>
            ))}
          </div>
        </div>
      ) : carteira && carteira.length > 0 && (
        <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-border rounded-lg p-3 sm:p-4 md:p-6 mb-6">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h3 className="text-base sm:text-lg font-semibold flex items-center gap-2">
              <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              Resumo da Carteira
            </h3>
            <button
              onClick={() => setShowB3Import(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-xs"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Importar B3 .xlsx
            </button>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
            <div className="bg-card border border-border rounded-lg p-2 sm:p-3 md:p-4">
              <div className="text-xs sm:text-sm text-muted-foreground">Total de Ativos</div>
              <div className="text-sm sm:text-lg md:text-xl lg:text-2xl font-bold text-primary">{carteira.length}</div>
            </div>
            <div className="bg-card border border-border rounded-lg p-2 sm:p-3 md:p-4">
              <div className="text-xs sm:text-sm text-muted-foreground">Tipos de Ativos</div>
              <div className="text-sm sm:text-lg md:text-xl lg:text-2xl font-bold text-primary">{Object.keys(ativosPorTipo).length}</div>
            </div>
            <div className="bg-card border border-border rounded-lg p-2 sm:p-3 md:p-4">
              <div className="text-xs sm:text-sm text-muted-foreground">Média DY</div>
              <div className="text-sm sm:text-lg md:text-xl lg:text-2xl font-bold text-primary">
                {formatDividendYield(carteira.reduce((sum, ativo) => sum + (ativo?.dy || 0), 0) / carteira.length)}
              </div>
            </div>
            <div className="bg-card border border-border rounded-lg p-2 sm:p-3 md:p-4">
              <div className="text-xs sm:text-sm text-muted-foreground">Maior Posição</div>
              <div className="text-sm sm:text-lg md:text-xl lg:text-2xl font-bold text-primary">
                {topAtivos[0]?.ticker || 'N/A'}
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground">
                {formatCurrency(topAtivos[0]?.valor_total || 0)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabelas por Tipo */}
      {/* Renderiza estrutura imediatamente com skeletons enquanto carrega */}
      {loadingCarteira && (!carteira || carteira.length === 0) ? (
        <div className="space-y-6">
          {/* Skeleton do Resumo */}
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-border rounded-lg p-3 sm:p-4 md:p-6 mb-6">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div className="animate-pulse h-6 bg-muted rounded w-40"></div>
              <div className="animate-pulse h-8 bg-muted rounded w-32"></div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-card border border-border rounded-lg p-2 sm:p-3 md:p-4">
                  <div className="animate-pulse h-4 bg-muted rounded w-20 mb-2"></div>
                  <div className="animate-pulse h-8 bg-muted rounded w-16"></div>
                </div>
              ))}
            </div>
          </div>
          {/* Skeleton das Tabelas por Tipo */}
          {[1, 2].map((i) => (
            <div key={i} className="bg-card border border-border rounded-lg overflow-hidden shadow-lg mb-6">
              <div className="bg-gradient-to-r from-primary/10 to-primary/5 px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="animate-pulse h-5 w-5 bg-muted rounded"></div>
                    <div className="animate-pulse h-5 w-5 bg-muted rounded"></div>
                    <div>
                      <div className="animate-pulse h-5 bg-muted rounded w-32 mb-2"></div>
                      <div className="animate-pulse h-4 bg-muted rounded w-48"></div>
                    </div>
                  </div>
                  <div className="animate-pulse h-6 bg-muted rounded w-24"></div>
                </div>
              </div>
              <div className="p-3 sm:p-4 md:p-6">
                <div className="space-y-3">
                  {[1, 2, 3].map((j) => (
                    <div key={j} className="animate-pulse h-16 bg-muted rounded"></div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : carteira && carteira.length > 0 ? (
        <div className="space-y-6">
          {Object.keys(ativosPorTipo).sort().map(tipo => (
            <TabelaAtivosPorTipo 
              key={tipo} 
              tipo={tipo}
              carteira={carteira}
              valorTotal={valorTotal}
              expandedTipos={expandedTipos}
              setExpandedTipos={setExpandedTipos}
              movimentacoesAll={movimentacoesAll}
              indicadores={indicadores}
              editingId={editingId}
              editQuantidade={editQuantidade}
              setEditQuantidade={setEditQuantidade}
              editPreco={editPreco}
              setEditPreco={setEditPreco}
              handleEditar={handleEditar}
              handleSalvarEdicao={handleSalvarEdicao}
              handleCancelarEdicao={handleCancelarEdicao}
              handleRemover={handleRemover}
              setManageTipoOpen={setManageTipoOpen}
              setRenameTipoValue={setRenameTipoValue}
              getMetadadosAtivo={getMetadadosAtivo}
            />
          ))}
        </div>
      ) : (
        /* Carteira Vazia - Mostrar opções de importação */
        <div className="text-center py-12">
          <div className="mb-8">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <BarChart3 className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              Sua carteira está vazia
            </h3>
            <p className="text-muted-foreground mb-6">
              Comece adicionando ativos manualmente ou importe um relatório da B3
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => setShowB3Import(true)}
              className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              <FileSpreadsheet className="w-5 h-5" />
              Importar da B3
            </button>
            
            <button
              onClick={() => {
                
                alert('Funcionalidade de adicionar ativo será implementada')
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              Adicionar Ativo
            </button>
          </div>

          <div className="mt-8 text-sm text-muted-foreground">
            <p><strong>Dica:</strong> Use a importação da B3 para adicionar todos os seus ativos de uma vez!</p>
          </div>
        </div>
      )}

      {/* Modal de Importação B3 */}
      <B3ImportModal
        isOpen={showB3Import}
        onClose={() => setShowB3Import(false)}
        onImport={handleB3Import}
      />
    </div>
  )
}
