import { 
  BarChart3, 
  Target, 
  ChevronUp, 
  ChevronDown, 
  Settings, 
  Edit, 
  Trash2,
  FileSpreadsheet,
  Plus,
  DollarSign
} from 'lucide-react'
import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { formatCurrency, formatDividendYield, formatPercentage, formatNumber } from '../../utils/formatters'
import {
  calculateFixedIncomeAnnualRate,
  normalizeIndexerAnnualRate,
  normalizeIndexerPercent,
  type FixedIncomeIndexer
} from '../../utils/fixedIncomeCalculator'
import TickerWithLogo from '../TickerWithLogo'
import VencimentoStatus from '../VencimentoStatus'
import B3ImportModal from './B3ImportModal'
import { B3Ativo } from '../../utils/excelParser'
import { ativoService, carteiraService } from '../../services/api'



export type PeriodoValorizacao = '1m' | '3m' | '6m' | '1a' | 'ytd'

type Lot = { qty: number; price: number; date: string }
type IndicadoresFundamentais = { dy: number | null; pl: number | null; pvp: number | null; roe: number | null }

const toNumberOrNull = (value: unknown): number | null => {
  if (value == null) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

const getIndicatorNumber = (value: unknown): number | null => {
  if (value == null) return null
  if (typeof value === 'object' && value !== null && 'valor' in (value as Record<string, unknown>)) {
    return toNumberOrNull((value as Record<string, unknown>).valor)
  }
  return toNumberOrNull(value)
}

const buildRemainingLots = (movimentacoes: any[]): Lot[] => {
  const lots: Lot[] = []
  for (const m of movimentacoes) {
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
  return lots
}

const calcularDiasCorridos = (dataBase?: string | null) => {
  if (!dataBase) return null
  const base = new Date(String(dataBase).slice(0, 10) + 'T00:00:00')
  if (Number.isNaN(base.getTime())) return null
  const hoje = new Date()
  const dias = Math.floor((hoje.getTime() - base.getTime()) / (1000 * 60 * 60 * 24))
  return dias >= 0 ? dias : 0
}

const calcularAliquotaIrRegressiva = (dias: number | null, isentoIr?: boolean) => {
  if (isentoIr) return 0
  if (dias === null) return 22.5
  if (dias <= 365) return 22.5
  if (dias <= 720) return 17.5
  return 15
}

const calcularMetricasAtivo = (ativo: any, movimentacoesAll: any[], isRendaFixa: boolean) => {
  const tickerAlvo = String(ativo?.ticker || '').trim().toUpperCase()
  const nomeAlvo = String(ativo?.nome_completo || '').trim().toLowerCase()
  const movsDoTicker = (movimentacoesAll || [])
    .filter((m) => {
      const tickerMov = String(m?.ticker || '').trim().toUpperCase()
      const nomeMov = String(m?.nome_completo || '').trim().toLowerCase()
      if (tickerAlvo && tickerMov && tickerMov === tickerAlvo) return true
      if (nomeAlvo && nomeMov && nomeMov === nomeAlvo) return true
      return false
    })
    .sort((a, b) => String(a.data).localeCompare(String(b.data)))

  const lots = buildRemainingLots(movsDoTicker)
  const totalQtd = lots.reduce((s, l) => s + l.qty, 0)
  const totalValor = lots.reduce((s, l) => s + l.qty * l.price, 0)
  const precoMedioLocal = totalQtd > 0 ? (totalValor / totalQtd) : null
  const precoBase = (ativo as any)?.preco_medio ?? ativo?.preco_compra ?? precoMedioLocal

  const quantidadeAtivo = Number(ativo?.quantidade || 0)
  const precoAtual = Number(ativo?.preco_atual || 0)
  const quantidadeParaValorizacao = quantidadeAtivo > 0 ? quantidadeAtivo : totalQtd

  if (isRendaFixa) {
    let valorInvestido = 0
    for (const mov of movsDoTicker) {
      const qty = Number(mov?.quantidade || 0)
      const prc = Number(mov?.preco || 0)
      const tipoMov = String(mov?.tipo || '').toLowerCase()
      if (!Number.isFinite(qty) || !Number.isFinite(prc) || qty <= 0 || prc <= 0) continue
      if (tipoMov === 'venda') valorInvestido -= qty * prc
      else valorInvestido += qty * prc
    }
    if (valorInvestido < 0) valorInvestido = 0

    if (valorInvestido <= 0 && quantidadeAtivo > 0) {
      const precoBaseFallback = Number(
        (ativo as any)?.preco_compra ??
        (ativo as any)?.preco_medio ??
        precoMedioLocal ??
        0
      )
      if (Number.isFinite(precoBaseFallback) && precoBaseFallback > 0) {
        valorInvestido = precoBaseFallback * quantidadeAtivo
      }
    }

    const valorAtualTotal = Number(ativo?.valor_total || 0)
    const valorizacaoAbsRf = valorInvestido > 0 ? (valorAtualTotal - valorInvestido) : null
    const rendimentoPctRf = valorInvestido > 0 ? ((valorAtualTotal - valorInvestido) / valorInvestido) * 100 : null

    const valorBrutoRf = Number.isFinite(valorAtualTotal) ? valorAtualTotal : null
    const diasRf = calcularDiasCorridos(((ativo as any)?.data_aplicacao as string | undefined) || (ativo?.data_adicao as string | undefined))
    const aliquotaIrRf = calcularAliquotaIrRegressiva(diasRf, Boolean((ativo as any)?.isento_ir))
    const ganhoBrutoRf = (valorBrutoRf != null && valorInvestido > 0) ? Math.max(valorBrutoRf - valorInvestido, 0) : null
    const irValorRf = (ganhoBrutoRf != null) ? (ganhoBrutoRf * aliquotaIrRf / 100) : null
    const valorLiquidoRf = (valorBrutoRf != null && irValorRf != null) ? valorBrutoRf - irValorRf : null

    const precoBaseRf = (quantidadeAtivo > 0 && valorInvestido > 0)
      ? (valorInvestido / quantidadeAtivo)
      : (precoMedioLocal ?? null)

    return {
      precoMedioLocal,
      precoBase: precoBaseRf,
      rendimentoPct: rendimentoPctRf,
      valorizacaoAbs: valorizacaoAbsRf,
      valorInvestido: valorInvestido > 0 ? valorInvestido : null,
      valorBrutoRf,
      valorLiquidoRf
    }
  }

  const rendimentoPct = (precoBase != null && precoAtual)
    ? ((precoAtual - precoBase) / precoBase) * 100
    : null
  const valorizacaoAbs = (precoBase != null && precoAtual && quantidadeParaValorizacao > 0)
    ? (precoAtual - precoBase) * quantidadeParaValorizacao
    : null

  const valorBrutoRf = isRendaFixa ? Number(ativo?.valor_total || 0) : null
  const valorInvestidoRf = (precoBase != null && quantidadeAtivo > 0)
    ? Number(precoBase) * quantidadeAtivo
    : null
  const diasRf = calcularDiasCorridos(((ativo as any)?.data_aplicacao as string | undefined) || (ativo?.data_adicao as string | undefined))
  const aliquotaIrRf = calcularAliquotaIrRegressiva(diasRf, Boolean((ativo as any)?.isento_ir))
  const ganhoBrutoRf = (valorBrutoRf != null && valorInvestidoRf != null) ? Math.max(valorBrutoRf - valorInvestidoRf, 0) : null
  const irValorRf = (ganhoBrutoRf != null) ? (ganhoBrutoRf * aliquotaIrRf / 100) : null
  const valorLiquidoRf = (valorBrutoRf != null && irValorRf != null) ? valorBrutoRf - irValorRf : null

  return {
    precoMedioLocal,
    precoBase,
    rendimentoPct,
    valorizacaoAbs,
    valorInvestido: (precoBase != null && quantidadeParaValorizacao > 0)
      ? Number(precoBase) * quantidadeParaValorizacao
      : null,
    valorBrutoRf,
    valorLiquidoRf
  }
}

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
  getMetadadosAtivo,
  getIndicadoresAtivo,
  valorizacaoPeriodoMap,
  periodoLabel,
  onAporteRendaFixa,
  onOpenAddAtivo
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
  getIndicadoresAtivo: (ativo: any) => IndicadoresFundamentais
  valorizacaoPeriodoMap?: Record<number, { valorizacao_reais: number | null; valorizacao_pct: number | null; preco_inicio_periodo?: number | null }>
  periodoLabel?: string
  onAporteRendaFixa?: (ativo: any) => void
  onOpenAddAtivo?: () => void
}) {
  const ativosDoTipo = carteira?.filter(ativo => ativo?.tipo === tipo) || []
  const totalTipo = ativosDoTipo.reduce((total, ativo) => total + (ativo?.valor_total || 0), 0)
  const dyMedioTipo = ativosDoTipo.length > 0
    ? (ativosDoTipo.reduce((sum, ativo) => sum + (getIndicadoresAtivo(ativo).dy || 0), 0) / ativosDoTipo.length)
    : null
  const porcentagemTipo = valorTotal > 0 ? (totalTipo / valorTotal * 100).toFixed(1) : '0.0'
  const isExpanded = expandedTipos[tipo] || false
  const podeRemoverTipo = ativosDoTipo.length === 0
  const isRendaFixa = tipo.toLowerCase().includes('renda fixa')
  const isCripto = tipo.toLowerCase().includes('cripto')
  const isFii = tipo.toLowerCase().includes('fii')
  const ipca12mAnual = normalizeIndexerAnnualRate('IPCA', (indicadores as any)?.ipca_12m ?? (indicadores as any)?.ipca)
  const ipcaMensalRaw = getIndicatorNumber((indicadores as any)?.ipca_mensal)

  const { valorizacaoReaisBarra, rendPctBarra } = (() => {
    if (valorizacaoPeriodoMap && periodoLabel) {
      let somaReais = 0
      let somaValorInicio = 0
      for (const a of ativosDoTipo) {
        const id = Number(a?.id)
        const d = Number.isNaN(id) ? undefined : valorizacaoPeriodoMap[id]
        if (d?.valorizacao_reais != null) somaReais += d.valorizacao_reais
        if (d?.preco_inicio_periodo != null && (a?.quantidade || 0) > 0)
          somaValorInicio += d.preco_inicio_periodo * (a?.quantidade || 0)
      }
      const pct = somaValorInicio > 0 ? (somaReais / somaValorInicio) * 100 : null
      return { valorizacaoReaisBarra: somaReais, rendPctBarra: pct }
    }
    const movs = movimentacoesAll || []
    let somaValoresAtuais = 0
    let somaValoresInvestidos = 0
    for (const a of ativosDoTipo) {
      const metrica = calcularMetricasAtivo(a, movs, isRendaFixa)
      const valorInvestido = Number(metrica?.valorInvestido)
      if (Number.isFinite(valorInvestido) && valorInvestido > 0) {
        somaValoresInvestidos += valorInvestido
        somaValoresAtuais += isRendaFixa
          ? Number(a?.valor_total || 0)
          : (a?.preco_atual || 0) * (a?.quantidade || 0)
      }
    }
    const rendTipo = (somaValoresInvestidos > 0) ? ((somaValoresAtuais - somaValoresInvestidos) / somaValoresInvestidos) * 100 : null
    const reais = somaValoresInvestidos > 0 ? somaValoresAtuais - somaValoresInvestidos : null
    return { valorizacaoReaisBarra: reais, rendPctBarra: rendTipo }
  })()

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
                  formatDividendYield(dyMedioTipo) : 
                  'N/A'
                }</span>
              </div>
            </div>
          </div>
          <div className="text-right flex items-center gap-1 sm:gap-2 md:gap-3 flex-shrink-0">
            <div className="text-xs sm:text-sm md:text-lg font-bold">{formatCurrency(totalTipo)}</div>
            {valorizacaoReaisBarra != null ? (
              <div className={`text-xs font-medium ${valorizacaoReaisBarra >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {valorizacaoReaisBarra >= 0 ? '+' : ''}{formatCurrency(valorizacaoReaisBarra)}
              </div>
            ) : null}
            <div className={`text-xs font-medium ${rendPctBarra != null ? (rendPctBarra >= 0 ? 'text-emerald-600' : 'text-red-600') : 'text-muted-foreground'}`}>
              {rendPctBarra != null ? `${rendPctBarra >= 0 ? '+' : ''}${rendPctBarra.toFixed(1).replace('.', ',')}%` : '-'}
            </div>
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
              {isRendaFixa && (
                <div className="px-3 sm:px-4 md:px-6 py-3 border-b border-border bg-muted/20 text-xs text-muted-foreground">
                  Base dos indexadores: IPCA (12m){' '}
                  <strong className="text-foreground">
                    {ipca12mAnual != null ? `${ipca12mAnual.toFixed(2).replace('.', ',')}% a.a.` : 'N/D'}
                  </strong>
                  {' '}| IPCA mensal{' '}
                  <strong className="text-foreground">
                    {ipcaMensalRaw != null ? `${ipcaMensalRaw.toFixed(2).replace('.', ',')}%` : 'N/D'}
                  </strong>
                </div>
              )}

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
                      <th className="px-3 py-2 text-left font-medium text-sm">Rentab. Estimada (a.a.)</th>
                    )}
                    {tipo.toLowerCase().includes('renda fixa') && (
                      <th className="px-3 py-2 text-left font-medium text-sm">Valor Bruto</th>
                    )}
                    {tipo.toLowerCase().includes('renda fixa') && (
                      <th className="px-3 py-2 text-left font-medium text-sm">Valor Líquido (IR)</th>
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
                    const indicadoresAtivo = getIndicadoresAtivo(ativo)
                    const metrica = calcularMetricasAtivo(ativo, movimentacoesAll, isRendaFixa)
                    const precoBase = metrica.precoBase
                    const rendimentoPct = metrica.rendimentoPct
                    const valorizacaoAbs = metrica.valorizacaoAbs
                    const porcentagemAtivo = valorTotal > 0 ? ((ativo?.valor_total || 0) / valorTotal * 100).toFixed(1) : '0.0'
                    const valorBrutoRf = metrica.valorBrutoRf
                    const valorLiquidoRf = metrica.valorLiquidoRf
                    return (
                      <tr key={ativo?.id} className="hover:bg-muted/40 transition-colors">
                        <td className="px-3 py-2 min-w-[140px]">
                          <TickerWithLogo ticker={ativo?.ticker || ''} nome={ativo?.nome_completo || ''} />
                        </td>
                        <td className="px-3 py-2 text-sm max-w-[240px]">
                          <div className="truncate" title={ativo?.nome_completo}>{ativo?.nome_completo}</div>
                          {isRendaFixa && (((ativo as any)?.tipo_renda_fixa) || ((ativo as any)?.emissor_rf)) && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {(ativo as any)?.tipo_renda_fixa && (
                                <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-700 px-2 py-0.5 text-[10px] font-semibold">
                                  {(ativo as any).tipo_renda_fixa}
                                </span>
                              )}
                              {(ativo as any)?.emissor_rf && (
                                <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                                  {(ativo as any).emissor_rf}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
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
                            {(() => {
                              const idx = (ativo?.indexador || '') as FixedIncomeIndexer | ''
                              if (!idx) return '-'
                              const pct = normalizeIndexerPercent(idx, ativo?.indexador_pct ?? null)
                              return `${idx}${pct ? ` ${pct.toFixed(2)}%` : ''}`
                            })()}
                          </td>
                        )}
                        {tipo.toLowerCase().includes('renda fixa') && (
                          <td className="px-3 py-2 text-xs">
                            {(() => {
                              const idx = (ativo?.indexador || '') as FixedIncomeIndexer | ''
                              if (!idx) return '-'

                              const anual = calculateFixedIncomeAnnualRate(
                                idx,
                                ativo?.indexador_pct ?? null,
                                {
                                  cdi: indicadores?.cdi,
                                  ipca: indicadores?.ipca,
                                  selic: indicadores?.selic
                                }
                              )

                              if (anual === null) return '-'
                              return `${anual.toFixed(2)}% a.a.`
                            })()}
                          </td>
                        )}
                        {tipo.toLowerCase().includes('renda fixa') && (
                          <td className="px-3 py-2 text-sm font-semibold">
                            {valorBrutoRf != null ? formatCurrency(valorBrutoRf) : '-'}
                          </td>
                        )}
                        {tipo.toLowerCase().includes('renda fixa') && (
                          <td className="px-3 py-2 text-sm font-semibold text-primary">
                            {valorLiquidoRf != null ? formatCurrency(valorLiquidoRf) : '-'}
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
                              {formatDividendYield(indicadoresAtivo.dy)}
                            </td>
                            <td className={`px-3 py-2 font-medium text-sm ${indicadoresAtivo.roe && indicadoresAtivo.roe > 0.15 ? 'text-blue-600' : ''}`}>
                              {formatPercentage(indicadoresAtivo.roe != null ? indicadoresAtivo.roe * 100 : null)}
                            </td>
                            <td className="px-3 py-2 text-sm">{formatNumber(indicadoresAtivo.pl)}</td>
                            <td className="px-3 py-2 text-sm">{formatNumber(indicadoresAtivo.pvp)}</td>
                          </>
                        )}
                        {isFii && (
                          <>
                            <td className="px-3 py-2 text-green-600 font-medium text-sm">
                              {formatDividendYield(indicadoresAtivo.dy)}
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
                                {isRendaFixa && onAporteRendaFixa && (
                                  <button
                                    onClick={() => onAporteRendaFixa(ativo)}
                                    className="p-1 text-amber-600 hover:text-amber-700"
                                    title="Registrar aporte"
                                  >
                                    <DollarSign size={14} />
                                  </button>
                                )}
                                {onOpenAddAtivo && (
                                  <button
                                    onClick={onOpenAddAtivo}
                                    className="p-1 text-green-600 hover:text-green-700"
                                    title="Adicionar ativo"
                                  >
                                    <Plus size={14} />
                                  </button>
                                )}
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
                  const indicadoresAtivo = getIndicadoresAtivo(ativo)
                  const metrica = calcularMetricasAtivo(ativo, movimentacoesAll, isRendaFixa)
                  const precoMedioLocal = metrica.precoMedioLocal
                  const rendimentoPct = metrica.rendimentoPct
                  const valorizacaoAbs = metrica.valorizacaoAbs
                  const porcentagemAtivo = valorTotal > 0 ? ((ativo?.valor_total || 0) / valorTotal * 100).toFixed(1) : '0.0'
                  const valorBrutoRf = metrica.valorBrutoRf
                  const valorLiquidoRf = metrica.valorLiquidoRf
                  
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
                              {isRendaFixa && onAporteRendaFixa && (
                                <button
                                  onClick={() => onAporteRendaFixa(ativo)}
                                  className="p-1.5 sm:p-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded"
                                  title="Registrar aporte"
                                >
                                  <DollarSign size={16} className="sm:w-[18px] sm:h-[18px]" />
                                </button>
                              )}
                              {onOpenAddAtivo && (
                                <button
                                  onClick={onOpenAddAtivo}
                                  className="p-1.5 sm:p-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded"
                                  title="Adicionar ativo"
                                >
                                  <Plus size={16} className="sm:w-[18px] sm:h-[18px]" />
                                </button>
                              )}
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
                      {isRendaFixa && (((ativo as any)?.tipo_renda_fixa) || ((ativo as any)?.emissor_rf)) && (
                        <div className="flex flex-wrap gap-1">
                          {(ativo as any)?.tipo_renda_fixa && (
                            <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-700 px-2 py-0.5 text-[10px] font-semibold">
                              {(ativo as any).tipo_renda_fixa}
                            </span>
                          )}
                          {(ativo as any)?.emissor_rf && (
                            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                              {(ativo as any).emissor_rf}
                            </span>
                          )}
                        </div>
                      )}

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
                                {formatDividendYield(indicadoresAtivo.dy)}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-muted-foreground">P/L</span>
                              <span className="text-xs sm:text-sm">{formatNumber(indicadoresAtivo.pl)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-muted-foreground">P/VP</span>
                              <span className="text-xs sm:text-sm">{formatNumber(indicadoresAtivo.pvp)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-muted-foreground">ROE</span>
                              <span className={`text-xs sm:text-sm font-medium ${indicadoresAtivo.roe && indicadoresAtivo.roe > 0.15 ? 'text-blue-600' : ''}`}>
                                {formatPercentage(indicadoresAtivo.roe != null ? indicadoresAtivo.roe * 100 : null)}
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
                        return (indicadoresAtivo.dy !== undefined || segmento || pvp !== undefined) ? (
                          <div className="pt-2 sm:pt-3 border-t border-border space-y-2">
                            {indicadoresAtivo.dy !== undefined && (
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-muted-foreground">DY</span>
                                <span className="text-xs sm:text-sm text-green-600 font-medium">
                                  {formatDividendYield(indicadoresAtivo.dy)}
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

                      {tipo.toLowerCase().includes('renda fixa') && (
                        <div className="pt-2 sm:pt-3 border-t border-border space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-muted-foreground">Valor Bruto</span>
                            <span className="text-xs sm:text-sm font-semibold">{valorBrutoRf != null ? formatCurrency(valorBrutoRf) : '-'}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-muted-foreground">Valor Líquido (IR)</span>
                            <span className="text-xs sm:text-sm font-semibold text-primary">{valorLiquidoRf != null ? formatCurrency(valorLiquidoRf) : '-'}</span>
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
  user?: string | null
  adicionarMutation: any
  

  carteira: any[]
  loadingCarteira: boolean
  ativosPorTipo: Record<string, number>
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
  onAporteRendaFixa?: (ativo: any) => void
  /** Abre o modal de adicionar ativo (empty state) */
  onOpenAddAtivo?: () => void
}

export default function CarteiraAtivosTab({
  user,
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
  onAporteRendaFixa,
  onOpenAddAtivo
}: CarteiraAtivosTabProps) {
  const [showB3Import, setShowB3Import] = useState(false)
  const [periodoValorizacao, setPeriodoValorizacao] = useState<PeriodoValorizacao>('1m')

  const periodoParaFetch = periodoValorizacao
  const carteiraFingerprint = useMemo(() => {
    if (!Array.isArray(carteira) || carteira.length === 0) return 'empty'
    return carteira
      .map((a: any) => `${a?.id ?? ''}:${String(a?.ticker ?? '')}`)
      .sort()
      .join('|')
  }, [carteira])

  const { data: valorizacaoPeriodoList, isFetching: carregandoValorizacaoPeriodo, isError: erroValorizacaoPeriodo } = useQuery({
    queryKey: ['carteira-valorizacao-periodo', user || 'anon', periodoParaFetch, carteiraFingerprint],
    queryFn: () => carteiraService.getValorizacaoPeriodo(periodoValorizacao as string),
    enabled: !!periodoParaFetch && !!carteira?.length,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  })

  const valorizacaoPeriodoMap = useMemo(() => {
    if (!valorizacaoPeriodoList || !Array.isArray(valorizacaoPeriodoList)) return undefined
    const map: Record<number, { valorizacao_reais: number | null; valorizacao_pct: number | null; preco_inicio_periodo?: number | null }> = {}
    for (const item of valorizacaoPeriodoList as Array<{ id: number; valorizacao_reais: number | null; valorizacao_pct: number | null; preco_inicio_periodo?: number | null }>) {
      const id = Number(item.id)
      if (!Number.isNaN(id)) {
        map[id] = {
          valorizacao_reais: item.valorizacao_reais,
          valorizacao_pct: item.valorizacao_pct,
          preco_inicio_periodo: item.preco_inicio_periodo ?? null,
        }
      }
    }
    return map
  }, [valorizacaoPeriodoList])

  const periodoLabel = periodoValorizacao === '1m' ? '1 mês'
    : periodoValorizacao === '3m' ? '3 meses'
    : periodoValorizacao === '6m' ? '6 meses'
    : periodoValorizacao === '1a' ? '1 ano'
    : 'YTD'

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

  const tickersIndicadoresFaltantes = useMemo(() => {
    if (!carteira) return []
    const set = new Set<string>()
    for (const ativo of carteira) {
      const tipo = String(ativo?.tipo || '').toLowerCase()
      if (tipo.includes('renda fixa') || tipo.includes('cripto')) continue
      if (ativo?.dy == null || ativo?.pl == null || ativo?.pvp == null || ativo?.roe == null) {
        const ticker = String(ativo?.ticker || '').trim().toUpperCase()
        if (ticker) set.add(ticker)
      }
    }
    return Array.from(set)
  }, [carteira])

  const indicadoresAtivosQuery = useQuery({
    queryKey: ['carteira-indicadores-fundamentos', tickersIndicadoresFaltantes],
    queryFn: async () => {
      const map: Record<string, IndicadoresFundamentais> = {}
      await Promise.all(
        tickersIndicadoresFaltantes.map(async (ticker) => {
          try {
            const detalhes = await ativoService.getDetalhes(ticker)
            const info = (detalhes as any)?.info || {}
            map[ticker] = {
              dy: toNumberOrNull(info?.dividendYield),
              pl: toNumberOrNull(info?.trailingPE),
              pvp: toNumberOrNull(info?.priceToBook),
              roe: toNumberOrNull(info?.returnOnEquity),
            }
          } catch {
            map[ticker] = { dy: null, pl: null, pvp: null, roe: null }
          }
        })
      )
      return map
    },
    enabled: tickersIndicadoresFaltantes.length > 0,
    staleTime: 60 * 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })

  const getIndicadoresAtivo = (ativo: any): IndicadoresFundamentais => {
    const ticker = String(ativo?.ticker || '').trim().toUpperCase()
    const fallback = indicadoresAtivosQuery.data?.[ticker]
    return {
      dy: toNumberOrNull(ativo?.dy) ?? fallback?.dy ?? null,
      pl: toNumberOrNull(ativo?.pl) ?? fallback?.pl ?? null,
      pvp: toNumberOrNull(ativo?.pvp) ?? fallback?.pvp ?? null,
      roe: toNumberOrNull(ativo?.roe) ?? fallback?.roe ?? null,
    }
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
        <>
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
                {formatDividendYield(carteira.reduce((sum, ativo) => sum + (getIndicadoresAtivo(ativo).dy || 0), 0) / carteira.length)}
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
        </>
      )}

      {/* Filtro de período: acima da primeira barra, com rótulo claro */}
      {carteira && carteira.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 py-2 px-1">
          <span className="text-sm text-muted-foreground">
            Período da valorização (R$ e %) nas barras abaixo:
          </span>
          <div className="flex flex-wrap gap-1">
            {(['1m', '3m', '6m', '1a', 'ytd'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriodoValorizacao(p)}
                disabled={carregandoValorizacaoPeriodo}
                className={`px-2.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  periodoValorizacao === p ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                } ${carregandoValorizacaoPeriodo ? 'opacity-60 cursor-wait' : ''}`}
              >
                {p === '1m' ? '1 mês' : p === '3m' ? '3 meses' : p === '6m' ? '6 meses' : p === '1a' ? '1 ano' : 'YTD'}
              </button>
            ))}
          </div>
          {carregandoValorizacaoPeriodo && <span className="text-sm text-muted-foreground">Carregando…</span>}
          {erroValorizacaoPeriodo && (
            <span className="text-sm text-destructive" title="Recarregue a página ou tente outro período">Erro ao carregar</span>
          )}
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
              getIndicadoresAtivo={getIndicadoresAtivo}
              valorizacaoPeriodoMap={valorizacaoPeriodoMap}
              periodoLabel={periodoLabel}
              onAporteRendaFixa={onAporteRendaFixa}
              onOpenAddAtivo={onOpenAddAtivo}
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
              onClick={() => onOpenAddAtivo?.()}
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
