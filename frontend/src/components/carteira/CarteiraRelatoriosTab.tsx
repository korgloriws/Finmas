import { useMemo, useState } from 'react'
import { toast } from 'react-hot-toast'
import { formatCurrency } from '../../utils/formatters'
import {
  FileSpreadsheet,
  FileText,
  TrendingUp,
  CalendarDays
} from 'lucide-react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from '../LazyChart'

const toNumberOrZero = (value: unknown): number => {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

const formatCompactCurrency = (value: number) => {
  const v = Number(value || 0)
  const abs = Math.abs(v)
  if (abs >= 1_000_000_000) return `R$ ${(v / 1_000_000_000).toFixed(1)} bi`
  if (abs >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)} mi`
  if (abs >= 1_000) return `R$ ${(v / 1_000).toFixed(1)}k`
  return formatCurrency(v)
}

const buildRendimentoFallbackFromCarteira = (carteira: any[]) => {
  return (carteira || [])
    .map((ativo: any) => {
      const quantidade = toNumberOrZero(ativo?.quantidade)
      const precoAtual = toNumberOrZero(ativo?.preco_atual)
      const precoBaseRaw = ativo?.preco_medio ?? ativo?.preco_compra
      const precoBase = Number(precoBaseRaw)
      if (!Number.isFinite(precoBase) || precoBase <= 0 || quantidade <= 0 || precoAtual <= 0) {
        return null
      }
      const valorizacaoReais = (precoAtual - precoBase) * quantidade
      const valorizacaoPct = ((precoAtual - precoBase) / precoBase) * 100
      return {
        id: Number(ativo?.id ?? 0),
        ticker: String(ativo?.ticker || '-'),
        quantidade,
        preco_inicio_periodo: precoBase,
        preco_atual: precoAtual,
        valorizacao_reais: valorizacaoReais,
        valorizacao_pct: valorizacaoPct,
        fonte: 'atual'
      }
    })
    .filter(Boolean) as Array<{
      id: number
      ticker: string
      quantidade: number
      preco_inicio_periodo: number
      preco_atual: number
      valorizacao_reais: number
      valorizacao_pct: number
      fonte: 'atual'
    }>
}

interface CarteiraRelatoriosTabProps {
  carteira: any[]
  carteiraService: any
}

export default function CarteiraRelatoriosTab({
  carteira,
  carteiraService
}: CarteiraRelatoriosTabProps) {
  const chartPalette = ['#2563EB', '#7C3AED', '#14B8A6', '#F59E0B', '#EC4899', '#22C55E', '#F97316', '#06B6D4']
  const [repMes, setRepMes] = useState('01')
  const [repAno, setRepAno] = useState(String(new Date().getFullYear()))
  const [repRendPeriodo, setRepRendPeriodo] = useState('mensal')
  const [previewMovs, setPreviewMovs] = useState<any[]>([])
  const [loadingPreviewMovs, setLoadingPreviewMovs] = useState(false)
  const [previewRend, setPreviewRend] = useState<{ datas: string[], carteira_valor: number[], carteira_price?: Array<number | null> }>({ datas: [], carteira_valor: [], carteira_price: [] })
  const [previewValorizacaoPeriodo, setPreviewValorizacaoPeriodo] = useState<Array<{
    id: number
    ticker: string
    quantidade: number
    preco_atual: number
    preco_inicio_periodo?: number | null
    valorizacao_reais: number | null
    valorizacao_pct: number | null
  }>>([])
  const [loadingPreviewRend, setLoadingPreviewRend] = useState(false)

  const periodoRendimentoLabel: Record<string, string> = {
    mensal: 'Mensal',
    trimestral: 'Trimestral',
    semestral: 'Semestral',
    anual: 'Anual',
    maximo: 'Máximo'
  }
  const periodoRendimentoToAtivos: Record<string, string> = {
    mensal: '1m',
    trimestral: '3m',
    semestral: '6m',
    anual: '1a',
    maximo: 'ytd'
  }

  const resumoMovimentacoes = useMemo(() => {
    const normalizeType = (tipo: unknown) => String(tipo || '').trim().toLowerCase()
    let compras = 0
    let vendas = 0
    for (const mov of previewMovs || []) {
      const quantidade = Number(mov?.quantidade ?? 0)
      const preco = Number(mov?.preco ?? 0)
      const valor = Math.abs(quantidade * preco)
      const tipo = normalizeType(mov?.tipo)
      if (tipo === 'venda') {
        vendas += valor
      } else if (tipo === 'compra') {
        compras += valor
      }
    }
    const saldo = compras - vendas
    return { compras, vendas, saldo, quantidadeRegistros: previewMovs?.length || 0 }
  }, [previewMovs])

  const movimentacoesSerieData = useMemo(() => {
    const porData = new Map<string, { data: string; compras: number; vendas: number }>()
    for (const mov of previewMovs || []) {
      const data = String(mov?.data || '').slice(0, 10)
      if (!data) continue
      const qtd = toNumberOrZero(mov?.quantidade)
      const preco = toNumberOrZero(mov?.preco)
      const valor = Math.abs(qtd * preco)
      const tipo = String(mov?.tipo || '').trim().toLowerCase()
      if (!porData.has(data)) porData.set(data, { data, compras: 0, vendas: 0 })
      const atual = porData.get(data)!
      if (tipo === 'venda') atual.vendas += valor
      else if (tipo === 'compra') atual.compras += valor
    }
    return Array.from(porData.values())
      .sort((a, b) => a.data.localeCompare(b.data))
      .slice(-12)
      .map((item) => ({
        ...item,
        label: `${item.data.slice(8, 10)}/${item.data.slice(5, 7)}`
      }))
  }, [previewMovs])

  const movimentacoesTipoData = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const mov of previewMovs || []) {
      const tipo = String(mov?.tipo || 'outro').trim().toLowerCase()
      const qtd = toNumberOrZero(mov?.quantidade)
      const preco = toNumberOrZero(mov?.preco)
      const valor = Math.abs(qtd * preco)
      mapa.set(tipo, (mapa.get(tipo) || 0) + valor)
    }
    return Array.from(mapa.entries())
      .map(([tipo, valor]) => ({ tipo: tipo.toUpperCase(), valor }))
      .sort((a, b) => b.valor - a.valor)
  }, [previewMovs])

  const rendimentoRowsExibicao = useMemo(() => {
    const rowsPeriodo = (previewValorizacaoPeriodo || [])
      .filter((item) => item?.valorizacao_reais != null && item?.valorizacao_pct != null)
      .map((item) => ({
        ...item,
        fonte: 'periodo' as const
      }))

    if (rowsPeriodo.length > 0) return rowsPeriodo
    return buildRendimentoFallbackFromCarteira(carteira || [])
  }, [previewValorizacaoPeriodo, carteira])

  const posicoesTopData = useMemo(() => {
    return (carteira || [])
      .map((it: any) => ({
        ticker: String(it?.ticker || '-'),
        valor: toNumberOrZero(it?.valor_total),
        tipo: String(it?.tipo || '-')
      }))
      .filter((it) => it.valor > 0)
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 8)
  }, [carteira])

  const posicoesTipoData = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const it of carteira || []) {
      const tipo = String(it?.tipo || 'Outros')
      const valor = toNumberOrZero(it?.valor_total)
      if (valor <= 0) continue
      mapa.set(tipo, (mapa.get(tipo) || 0) + valor)
    }
    return Array.from(mapa.entries())
      .map(([tipo, valor]) => ({ tipo, valor }))
      .sort((a, b) => b.valor - a.valor)
  }, [carteira])

  const rendimentoChartData = useMemo(() => {
    if (!previewRend?.datas?.length) return []
    const serieRendimento = (previewRend.carteira_price || []).map((v: any) =>
      typeof v === 'number' && Number.isFinite(v) ? Number(v) : null
    )
    const temSerieRendimento = serieRendimento.some((v) => v !== null)

    return previewRend.datas.map((data, idx) => {
      const valor = Number(previewRend.carteira_valor?.[idx] ?? 0)
      const indiceAtual = temSerieRendimento
        ? Number(serieRendimento[idx] ?? 100)
        : (idx === 0 ? 100 : 100 + (((valor / Number(previewRend.carteira_valor?.[0] || valor)) - 1) * 100))
      const indiceAnterior = idx > 0
        ? (
            temSerieRendimento
              ? Number(serieRendimento[idx - 1] ?? indiceAtual)
              : 100 + (((Number(previewRend.carteira_valor?.[idx - 1] ?? valor) / Number(previewRend.carteira_valor?.[0] || valor)) - 1) * 100)
          )
        : indiceAtual
      const rendimentoPeriodo = indiceAnterior > 0 ? ((indiceAtual / indiceAnterior) - 1) * 100 : 0
      const rendimentoAcumulado = indiceAtual - 100
      return {
        data,
        valor,
        indiceAtual,
        rendimentoPeriodo,
        rendimentoAcumulado
      }
    })
  }, [previewRend])

  const resumoRendimento = useMemo(() => {
    if (!rendimentoRowsExibicao.length) return null

    let somaReais = 0
    let somaValorInicio = 0
    let ativosComBase = 0
    for (const item of rendimentoRowsExibicao) {
      if (item?.valorizacao_reais != null) somaReais += Number(item.valorizacao_reais || 0)
      if (item?.preco_inicio_periodo != null && (item?.quantidade || 0) > 0) {
        somaValorInicio += Number(item.preco_inicio_periodo || 0) * Number(item.quantidade || 0)
        ativosComBase += 1
      }
    }

    const rendimentoPct = somaValorInicio > 0 ? (somaReais / somaValorInicio) * 100 : null
    const valorInicial = somaValorInicio > 0 ? somaValorInicio : null
    const valorFinal = somaValorInicio > 0 ? somaValorInicio + somaReais : null

    return {
      inicial: valorInicial,
      final: valorFinal,
      evolucao: rendimentoPct,
      valorizacaoReais: somaReais,
      ativosComBase,
      fonte: (rendimentoRowsExibicao[0] as any)?.fonte || 'atual'
    }
  }, [rendimentoRowsExibicao])

  const rendimentoTopData = useMemo(() => {
    return (rendimentoRowsExibicao || [])
      .map((item) => ({
        ticker: String(item?.ticker || '-'),
        valorizacao: Number(item?.valorizacao_reais || 0),
        rendimento: Number(item?.valorizacao_pct || 0)
      }))
      .sort((a, b) => b.valorizacao - a.valorizacao)
      .slice(0, 8)
  }, [rendimentoRowsExibicao])

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold mb-4">Relatórios e Backup</h2>
      <div className="grid grid-cols-1 2xl:grid-cols-3 gap-6">
        {/* Movimentações */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" />
              Movimentações
            </h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Relatório de compras e vendas por mês/ano com exportação em XLSX e PDF.
          </p>

          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <select 
                aria-label="Selecione o mês" 
                className="px-3 py-2 border border-border rounded bg-background text-foreground" 
                value={repMes} 
                onChange={e=>setRepMes(e.target.value)}
              >
                {Array.from({ length: 12 }).map((_, i) => {
                  const v = String(i+1).padStart(2, '0')
                  return <option key={v} value={v}>{v}</option>
                })}
              </select>
              <select 
                aria-label="Selecione o ano" 
                className="px-3 py-2 border border-border rounded bg-background text-foreground" 
                value={repAno} 
                onChange={e=>setRepAno(e.target.value)}
              >
                {Array.from({ length: 10 }).map((_, i) => {
                  const y = new Date().getFullYear() - i
                  return <option key={y} value={String(y)}>{y}</option>
                })}
              </select>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={async () => {
                  try {
                    toast.loading('Gerando XLSX...', { id: 'mov-xlsx' })
                    const blob = await carteiraService.downloadMovimentacoesXLSX({ mes: repMes, ano: repAno })
                    downloadBlob(blob, `movimentacoes_${repMes}_${repAno}.xlsx`)
                    toast.success('Relatório XLSX gerado com sucesso', { id: 'mov-xlsx' })
                  } catch {
                    toast.error('Falha ao baixar XLSX', { id: 'mov-xlsx' })
                  }
                }}
                className="px-3 py-2 rounded bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2"
              >
                <FileSpreadsheet className="w-4 h-4" />
                XLSX
              </button>
              <button
                onClick={async () => {
                  try {
                    toast.loading('Gerando PDF...', { id: 'mov-pdf' })
                    const blob = await carteiraService.downloadMovimentacoesPDF({ mes: repMes, ano: repAno })
                    downloadBlob(blob, `movimentacoes_${repMes}_${repAno}.pdf`)
                    toast.success('Relatório PDF gerado com sucesso', { id: 'mov-pdf' })
                  } catch {
                    toast.error('Falha ao baixar PDF', { id: 'mov-pdf' })
                  }
                }}
                className="px-3 py-2 rounded bg-secondary text-secondary-foreground hover:bg-secondary/80 inline-flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                PDF
              </button>
              <button
                onClick={async () => {
                  try {
                    const blob = await carteiraService.downloadMovimentacoesCSV({ mes: repMes, ano: repAno })
                    downloadBlob(blob, `movimentacoes_${repMes}_${repAno}.csv`)
                  } catch {
                    toast.error('Falha ao baixar CSV')
                  }
                }}
                className="px-3 py-2 rounded border border-border bg-background text-foreground hover:bg-muted/40"
              >
                CSV
              </button>
              <button
                onClick={async () => {
                  setLoadingPreviewMovs(true)
                  try {
                    const data = await carteiraService.getMovimentacoes(Number(repMes), Number(repAno))
                    setPreviewMovs(data)
                  } catch {
                    toast.error('Falha ao carregar prévia')
                    setPreviewMovs([])
                  } finally {
                    setLoadingPreviewMovs(false)
                  }
                }}
                className="px-3 py-2 rounded bg-muted text-foreground hover:bg-muted/80"
              >
                Prévia
              </button>
            </div>
          </div>
          {/* Prévia Movimentações */}
          <div className="mt-3">
            {loadingPreviewMovs ? (
              <div className="text-sm text-muted-foreground">Carregando…</div>
            ) : previewMovs && previewMovs.length > 0 ? (
              <div className="space-y-3 overflow-x-auto">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <div className="rounded-lg border border-border bg-muted/20 p-2">
                    <div className="text-[11px] text-muted-foreground">Registros</div>
                    <div className="text-sm font-semibold">{resumoMovimentacoes.quantidadeRegistros}</div>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/20 p-2">
                    <div className="text-[11px] text-muted-foreground">Compras</div>
                    <div className="text-sm font-semibold text-blue-600 dark:text-blue-400">{formatCurrency(resumoMovimentacoes.compras)}</div>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/20 p-2">
                    <div className="text-[11px] text-muted-foreground">Vendas</div>
                    <div className="text-sm font-semibold text-purple-600 dark:text-purple-400">{formatCurrency(resumoMovimentacoes.vendas)}</div>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/20 p-2">
                    <div className="text-[11px] text-muted-foreground">Saldo líquido (Compras - Vendas)</div>
                    <div className={`text-sm font-semibold ${resumoMovimentacoes.saldo >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {formatCurrency(resumoMovimentacoes.saldo)}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <div className="h-64 w-full rounded-lg border border-border bg-card p-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={movimentacoesSerieData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => formatCompactCurrency(v)} width={70} />
                        <Tooltip
                          formatter={(value: any, name: any) => [formatCurrency(Number(value || 0)), name === 'compras' ? 'Compras' : 'Vendas']}
                          labelFormatter={(label) => `Período: ${label}`}
                        />
                        <Legend />
                        <Bar dataKey="compras" name="compras" fill="#2563EB" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="vendas" name="vendas" fill="#7C3AED" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="h-64 w-full rounded-lg border border-border bg-card p-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={movimentacoesTipoData}
                          dataKey="valor"
                          nameKey="tipo"
                          cx="50%"
                          cy="50%"
                          innerRadius={36}
                          outerRadius={72}
                          label={false}
                          labelLine={false}
                        >
                          {movimentacoesTipoData.map((_: any, index: number) => (
                            <Cell key={`mov-cell-${index}`} fill={chartPalette[index % chartPalette.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: any) => formatCurrency(Number(value || 0))} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <table className="w-full min-w-[700px] text-sm">
                  <thead className="bg-muted/30">
                    <tr>
                      <th className="px-3 py-2 text-left">Data</th>
                      <th className="px-3 py-2 text-left">Ticker</th>
                      <th className="px-3 py-2 text-left">Tipo</th>
                      <th className="px-3 py-2 text-left">Quantidade</th>
                      <th className="px-3 py-2 text-left">Preço</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewMovs.slice(0, 50).map((m: any) => (
                      <tr key={m.id} className="border-b border-border">
                        <td className="px-3 py-2">{String(m.data).slice(0,10)}</td>
                        <td className="px-3 py-2">{m.ticker}</td>
                        <td className="px-3 py-2">{m.tipo}</td>
                        <td className="px-3 py-2">{m.quantidade}</td>
                        <td className="px-3 py-2">{formatCurrency(m.preco)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {previewMovs.length > 50 && (
                  <div className="text-xs text-muted-foreground mt-2">Mostrando 50 de {previewMovs.length} registros.</div>
                )}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Sem dados para o período.</div>
            )}
          </div>
        </div>

        {/* Posições atuais */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
          <h3 className="font-semibold">Posições (Atual)</h3>
          <p className="text-xs text-muted-foreground">
            Consolidado da posição atual da carteira, ideal para guarda e auditoria mensal.
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={async () => {
                try {
                  toast.loading('Gerando XLSX...', { id: 'pos-xlsx' })
                  const blob = await carteiraService.downloadPosicoesXLSX()
                  downloadBlob(blob, 'posicoes_carteira.xlsx')
                  toast.success('Relatório XLSX gerado com sucesso', { id: 'pos-xlsx' })
                } catch {
                  toast.error('Falha ao baixar XLSX', { id: 'pos-xlsx' })
                }
              }}
              className="px-3 py-2 rounded bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2"
            >
              <FileSpreadsheet className="w-4 h-4" />
              XLSX
            </button>
            <button
              onClick={async () => {
                try {
                  toast.loading('Gerando PDF...', { id: 'pos-pdf' })
                  const blob = await carteiraService.downloadPosicoesPDF()
                  downloadBlob(blob, 'posicoes_carteira.pdf')
                  toast.success('Relatório PDF gerado com sucesso', { id: 'pos-pdf' })
                } catch {
                  toast.error('Falha ao baixar PDF', { id: 'pos-pdf' })
                }
              }}
              className="px-3 py-2 rounded bg-secondary text-secondary-foreground hover:bg-secondary/80 inline-flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              PDF
            </button>
            <button
              onClick={async () => {
                try {
                  const blob = await carteiraService.downloadPosicoesCSV()
                  downloadBlob(blob, 'posicoes_carteira.csv')
                } catch {
                  toast.error('Falha ao baixar CSV')
                }
              }}
              className="px-3 py-2 rounded border border-border bg-background text-foreground hover:bg-muted/40"
            >
              CSV
            </button>
          </div>
          {/* Prévia Posições */}
          <div className="mt-3 overflow-x-auto">
            {carteira && carteira.length > 0 ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3">
                  <div className="h-64 w-full rounded-lg border border-border bg-card p-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={posicoesTopData} margin={{ top: 8, right: 8, left: 8, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                        <XAxis dataKey="ticker" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={52} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => formatCompactCurrency(v)} width={70} />
                        <Tooltip formatter={(value: any) => formatCurrency(Number(value || 0))} />
                        <Bar dataKey="valor" fill="#14B8A6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="h-64 w-full rounded-lg border border-border bg-card p-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={posicoesTipoData}
                          dataKey="valor"
                          nameKey="tipo"
                          cx="50%"
                          cy="50%"
                          innerRadius={36}
                          outerRadius={74}
                          label={false}
                          labelLine={false}
                        >
                          {posicoesTipoData.map((_: any, index: number) => (
                            <Cell key={`pos-cell-${index}`} fill={chartPalette[index % chartPalette.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: any) => formatCurrency(Number(value || 0))} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <table className="w-full min-w-[700px] text-sm">
                  <thead className="bg-muted/30">
                    <tr>
                      <th className="px-3 py-2 text-left">Ticker</th>
                      <th className="px-3 py-2 text-left">Nome</th>
                      <th className="px-3 py-2 text-left">Quantidade</th>
                      <th className="px-3 py-2 text-left">Preço</th>
                      <th className="px-3 py-2 text-left">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {carteira.slice(0, 50).map((it: any) => (
                      <tr key={it.id} className="border-b border-border">
                        <td className="px-3 py-2">{it.ticker}</td>
                        <td className="px-3 py-2">{it.nome_completo}</td>
                        <td className="px-3 py-2">{it.quantidade}</td>
                        <td className="px-3 py-2">{formatCurrency(it.preco_atual)}</td>
                        <td className="px-3 py-2">{formatCurrency(it.valor_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Sem posições.</div>
            )}
          </div>
        </div>

        {/* Rendimentos no período */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
          <h3 className="font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Rendimentos (Período)
          </h3>
          <p className="text-xs text-muted-foreground">
            Série de evolução da carteira com visão de rentabilidade para exportação em PDF e XLSX.
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <select 
              aria-label="Período dos rendimentos" 
              title="Selecione o período dos rendimentos"
              className="px-3 py-2 border border-border rounded bg-background text-foreground" 
              value={repRendPeriodo} 
              onChange={e=>setRepRendPeriodo(e.target.value as any)}
            >
              <option value="mensal">Mensal</option>
              <option value="trimestral">Trimestral</option>
              <option value="semestral">Semestral</option>
              <option value="anual">Anual</option>
              <option value="maximo">Máximo</option>
            </select>
            <button
              onClick={async () => {
                try {
                  toast.loading('Gerando XLSX...', { id: 'rend-xlsx' })
                  const blob = await carteiraService.downloadRendimentosXLSX(repRendPeriodo)
                  downloadBlob(blob, `rendimentos_${repRendPeriodo}.xlsx`)
                  toast.success('Relatório XLSX gerado com sucesso', { id: 'rend-xlsx' })
                } catch {
                  toast.error('Falha ao baixar XLSX', { id: 'rend-xlsx' })
                }
              }}
              className="px-3 py-2 rounded bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2"
            >
              <FileSpreadsheet className="w-4 h-4" />
              XLSX
            </button>
            <button
              onClick={async () => {
                try {
                  toast.loading('Gerando PDF...', { id: 'rend-pdf' })
                  const blob = await carteiraService.downloadRendimentosPDF(repRendPeriodo)
                  downloadBlob(blob, `rendimentos_${repRendPeriodo}.pdf`)
                  toast.success('Relatório PDF gerado com sucesso', { id: 'rend-pdf' })
                } catch {
                  toast.error('Falha ao baixar PDF', { id: 'rend-pdf' })
                }
              }}
              className="px-3 py-2 rounded bg-secondary text-secondary-foreground hover:bg-secondary/80 inline-flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              PDF
            </button>
            <button
              onClick={async () => {
                try {
                  const blob = await carteiraService.downloadRendimentosCSV(repRendPeriodo)
                  downloadBlob(blob, `rendimentos_${repRendPeriodo}.csv`)
                } catch {
                  toast.error('Falha ao baixar CSV')
                }
              }}
              className="px-3 py-2 rounded border border-border bg-background text-foreground hover:bg-muted/40"
            >
              CSV
            </button>
            <button
              onClick={async () => {
                setLoadingPreviewRend(true)
                try {
                  const [historicoResult, valorizacaoResult] = await Promise.allSettled([
                    carteiraService.getHistorico(repRendPeriodo),
                    carteiraService.getValorizacaoPeriodo(periodoRendimentoToAtivos[repRendPeriodo] || '1m')
                  ])

                  if (historicoResult.status === 'fulfilled') {
                    const historicoData = historicoResult.value
                    setPreviewRend({
                      datas: historicoData?.datas || [],
                      carteira_valor: historicoData?.carteira_valor || [],
                      carteira_price: historicoData?.carteira_price || []
                    })
                  } else {
                    setPreviewRend({ datas: [], carteira_valor: [], carteira_price: [] })
                  }

                  if (valorizacaoResult.status === 'fulfilled') {
                    const valorizacaoData = valorizacaoResult.value
                    setPreviewValorizacaoPeriodo(Array.isArray(valorizacaoData) ? valorizacaoData : [])
                  } else {
                    setPreviewValorizacaoPeriodo([])
                  }

                  if (historicoResult.status === 'rejected' && valorizacaoResult.status === 'rejected') {
                    toast.error('Falha ao carregar prévia')
                  }
                } catch {
                  toast.error('Falha ao carregar prévia')
                  setPreviewRend({ datas: [], carteira_valor: [], carteira_price: [] })
                  setPreviewValorizacaoPeriodo([])
                } finally {
                  setLoadingPreviewRend(false)
                }
              }}
              className="px-3 py-2 rounded bg-muted text-foreground hover:bg-muted/80"
            >Prévia</button>
          </div>

          {resumoRendimento && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <div className="text-xs text-muted-foreground">Valor inicial</div>
                <div className="text-sm font-semibold">{resumoRendimento.inicial != null ? formatCurrency(resumoRendimento.inicial) : '-'}</div>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <div className="text-xs text-muted-foreground">Valor final</div>
                <div className="text-sm font-semibold">{resumoRendimento.final != null ? formatCurrency(resumoRendimento.final) : '-'}</div>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <div className="text-xs text-muted-foreground">Evolução ({periodoRendimentoLabel[repRendPeriodo] || repRendPeriodo})</div>
                <div className={`text-sm font-semibold ${Number(resumoRendimento.evolucao || 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {resumoRendimento.evolucao != null ? `${resumoRendimento.evolucao.toFixed(2)}%` : '-'}
                </div>
                <div className={`text-xs mt-1 ${Number(resumoRendimento.valorizacaoReais || 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {formatCurrency(resumoRendimento.valorizacaoReais || 0)} em {resumoRendimento.ativosComBase} ativo(s)
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">
                  Base: {resumoRendimento.fonte === 'periodo' ? 'histórico do período' : 'preço médio/preço compra (igual aba Ativos)'}
                </div>
              </div>
            </div>
          )}

          {rendimentoRowsExibicao.length > 0 && (
            <div className="space-y-3 overflow-x-auto">
              <div className="h-64 w-full rounded-lg border border-border bg-card p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rendimentoTopData} margin={{ top: 8, right: 8, left: 8, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                    <XAxis dataKey="ticker" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={52} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => formatCompactCurrency(v)} width={70} />
                    <Tooltip
                      formatter={(value: any, name: any, props: any) => {
                        if (name === 'valorizacao') {
                          return [
                            `${formatCurrency(Number(value || 0))} (${Number(props?.payload?.rendimento || 0).toFixed(2)}%)`,
                            'Valorização'
                          ]
                        }
                        return [value, name]
                      }}
                    />
                    <Bar dataKey="valorizacao" fill="#2563EB" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <table className="w-full min-w-[700px] text-sm">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="px-3 py-2 text-left">Ticker</th>
                    <th className="px-3 py-2 text-left">Quantidade</th>
                    <th className="px-3 py-2 text-left">Preço início período</th>
                    <th className="px-3 py-2 text-left">Preço atual</th>
                    <th className="px-3 py-2 text-left">Valorização (R$)</th>
                    <th className="px-3 py-2 text-left">Rendimento (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {rendimentoRowsExibicao
                    .sort((a, b) => Number(b.valorizacao_reais || 0) - Number(a.valorizacao_reais || 0))
                    .map((item) => (
                      <tr key={`${item.id}-${item.ticker}`} className="border-b border-border">
                        <td className="px-3 py-2">{item.ticker}</td>
                        <td className="px-3 py-2">{Number(item.quantidade || 0).toFixed(4)}</td>
                        <td className="px-3 py-2">{item.preco_inicio_periodo != null ? formatCurrency(item.preco_inicio_periodo) : '-'}</td>
                        <td className="px-3 py-2">{formatCurrency(Number(item.preco_atual || 0))}</td>
                        <td className={`px-3 py-2 font-medium ${Number(item.valorizacao_reais || 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {item.valorizacao_reais != null ? formatCurrency(item.valorizacao_reais) : '-'}
                        </td>
                        <td className={`px-3 py-2 font-medium ${Number(item.valorizacao_pct || 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {item.valorizacao_pct != null ? `${Number(item.valorizacao_pct).toFixed(2)}%` : '-'}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Prévia Rendimentos */}
          <div className="mt-3 overflow-x-auto">
            {loadingPreviewRend ? (
              <div className="text-sm text-muted-foreground">Carregando…</div>
            ) : previewRend && previewRend.datas.length > 0 ? (
              <div className="space-y-4">
                <div className="h-64 w-full rounded-lg border border-border bg-card p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={rendimentoChartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.25} />
                      <XAxis dataKey="data" tick={{ fontSize: 11 }} />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        tickFormatter={(value: number) => formatCompactCurrency(value)}
                        width={70}
                      />
                      <Tooltip
                        formatter={(value: any, name: any) => {
                          if (name === 'valor') return [formatCurrency(Number(value)), 'Valor carteira']
                          if (name === 'rendimentoPeriodo') return [`${Number(value).toFixed(2)}%`, 'Rendimento do período']
                          if (name === 'rendimentoAcumulado') return [`${Number(value).toFixed(2)}%`, 'Rendimento acumulado']
                          return [value, name]
                        }}
                        labelFormatter={(label) => `Período: ${label}`}
                      />
                      <Line
                        type="monotone"
                        dataKey="valor"
                        name="valor"
                        stroke="#2563EB"
                        strokeWidth={2.5}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <table className="w-full min-w-[500px] text-sm">
                  <thead className="bg-muted/30">
                    <tr>
                      <th className="px-3 py-2 text-left">Período</th>
                      <th className="px-3 py-2 text-left">Valor Carteira</th>
                      <th className="px-3 py-2 text-left">Rendimento período</th>
                      <th className="px-3 py-2 text-left">Rendimento acumulado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rendimentoChartData.slice(-50).map((item: any, i: number) => (
                      <tr key={`${item.data}-${i}`} className="border-b border-border">
                        <td className="px-3 py-2">{item.data}</td>
                        <td className="px-3 py-2">{formatCurrency(item.valor)}</td>
                        <td className={`px-3 py-2 ${item.rendimentoPeriodo >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {item.rendimentoPeriodo.toFixed(2)}%
                        </td>
                        <td className={`px-3 py-2 ${item.rendimentoAcumulado >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {item.rendimentoAcumulado.toFixed(2)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : rendimentoRowsExibicao.length > 0 ? (
              <div className="text-sm text-muted-foreground">
                Dados históricos de série temporal indisponíveis para este período, mas o rendimento por ativo foi calculado acima.
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Sem dados para o período.</div>
            )}
          </div>
        </div>
      </div>

    </div>
  )
}
