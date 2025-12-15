import { useState } from 'react'
import { toast } from 'react-hot-toast'
import { formatCurrency } from '../../utils/formatters'
import { Download, Upload, Database, AlertTriangle } from 'lucide-react'

interface CarteiraRelatoriosTabProps {
  carteira: any[]
  carteiraService: any
}

export default function CarteiraRelatoriosTab({
  carteira,
  carteiraService
}: CarteiraRelatoriosTabProps) {
  const [repMes, setRepMes] = useState('01')
  const [repAno, setRepAno] = useState(String(new Date().getFullYear()))
  const [repRendPeriodo, setRepRendPeriodo] = useState('mensal')
  const [previewMovs, setPreviewMovs] = useState<any[]>([])
  const [loadingPreviewMovs, setLoadingPreviewMovs] = useState(false)
  const [previewRend, setPreviewRend] = useState<{ datas: string[], carteira_valor: number[] }>({ datas: [], carteira_valor: [] })
  const [loadingPreviewRend, setLoadingPreviewRend] = useState(false)

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold mb-4">Relatórios</h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Movimentações */}
        <div className="bg-muted/30 rounded-lg p-4">
          <h3 className="font-semibold mb-2">Movimentações</h3>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex items-center gap-2">
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
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  try {
                    const blob = await carteiraService.downloadMovimentacoesCSV({ mes: repMes, ano: repAno })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url; a.download = 'movimentacoes.csv'
                    document.body.appendChild(a)
                    a.click()
                    a.remove(); URL.revokeObjectURL(url)
                  } catch (e: any) {
                    toast.error('Falha ao baixar CSV')
                  }
                }}
                className="px-3 py-2 rounded bg-primary text-primary-foreground hover:bg-primary/90"
              >CSV</button>
              <button
                onClick={async () => {
                  try {
                    const blob = await carteiraService.downloadMovimentacoesPDF({ mes: repMes, ano: repAno })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url; a.download = 'movimentacoes.pdf'
                    document.body.appendChild(a)
                    a.click()
                    a.remove(); URL.revokeObjectURL(url)
                  } catch (e: any) {
                    toast.error('Falha ao baixar PDF')
                  }
                }}
                className="px-3 py-2 rounded bg-secondary text-secondary-foreground hover:bg-secondary/80"
              >PDF</button>
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
              >Prévia</button>
            </div>
          </div>
          {/* Prévia Movimentações */}
          <div className="mt-3">
            {loadingPreviewMovs ? (
              <div className="text-sm text-muted-foreground">Carregando…</div>
            ) : previewMovs && previewMovs.length > 0 ? (
              <div className="overflow-x-auto">
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
        <div className="bg-muted/30 rounded-lg p-4">
          <h3 className="font-semibold mb-2">Posições (Atual)</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                try {
                  const blob = await carteiraService.downloadPosicoesCSV()
                  const url = URL.createObjectURL(blob); const a = document.createElement('a')
                  a.href = url; a.download = 'posicoes.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
                } catch {
                  toast.error('Falha ao baixar CSV')
                }
              }}
              className="px-3 py-2 rounded bg-primary text-primary-foreground hover:bg-primary/90"
            >CSV</button>
            <button
              onClick={async () => {
                try {
                  const blob = await carteiraService.downloadPosicoesPDF()
                  const url = URL.createObjectURL(blob); const a = document.createElement('a')
                  a.href = url; a.download = 'posicoes.pdf'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
                } catch {
                  toast.error('Falha ao baixar PDF')
                }
              }}
              className="px-3 py-2 rounded bg-secondary text-secondary-foreground hover:bg-secondary/80"
            >PDF</button>
          </div>
          {/* Prévia Posições */}
          <div className="mt-3 overflow-x-auto">
            {carteira && carteira.length > 0 ? (
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
            ) : (
              <div className="text-sm text-muted-foreground">Sem posições.</div>
            )}
          </div>
        </div>

        {/* Rendimentos no período */}
        <div className="bg-muted/30 rounded-lg p-4">
          <h3 className="font-semibold mb-2">Rendimentos (Período)</h3>
          <div className="flex items-center gap-2">
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
                  const blob = await carteiraService.downloadRendimentosCSV(repRendPeriodo)
                  const url = URL.createObjectURL(blob); const a = document.createElement('a')
                  a.href = url; a.download = 'rendimentos.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
                } catch {
                  toast.error('Falha ao baixar CSV')
                }
              }}
              className="px-3 py-2 rounded bg-primary text-primary-foreground hover:bg-primary/90"
            >CSV</button>
            <button
              onClick={async () => {
                try {
                  const blob = await carteiraService.downloadRendimentosPDF(repRendPeriodo)
                  const url = URL.createObjectURL(blob); const a = document.createElement('a')
                  a.href = url; a.download = 'rendimentos.pdf'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
                } catch {
                  toast.error('Falha ao baixar PDF')
                }
              }}
              className="px-3 py-2 rounded bg-secondary text-secondary-foreground hover:bg-secondary/80"
            >PDF</button>
            <button
              onClick={async () => {
                setLoadingPreviewRend(true)
                try {
                  const data = await carteiraService.getHistorico(repRendPeriodo)
                  setPreviewRend({ datas: data.datas || [], carteira_valor: data.carteira_valor || [] })
                } catch {
                  toast.error('Falha ao carregar prévia')
                  setPreviewRend({ datas: [], carteira_valor: [] })
                } finally {
                  setLoadingPreviewRend(false)
                }
              }}
              className="px-3 py-2 rounded bg-muted text-foreground hover:bg-muted/80"
            >Prévia</button>
          </div>
          {/* Prévia Rendimentos */}
          <div className="mt-3 overflow-x-auto">
            {loadingPreviewRend ? (
              <div className="text-sm text-muted-foreground">Carregando…</div>
            ) : previewRend && previewRend.datas.length > 0 ? (
              <table className="w-full min-w-[500px] text-sm">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="px-3 py-2 text-left">Período</th>
                    <th className="px-3 py-2 text-left">Valor Carteira</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRend.datas.slice(-50).map((d: string, i: number) => (
                    <tr key={`${d}-${i}`} className="border-b border-border">
                      <td className="px-3 py-2">{d}</td>
                      <td className="px-3 py-2">{formatCurrency(previewRend.carteira_valor[Math.max(0, previewRend.carteira_valor.length - previewRend.datas.slice(-50).length + i)])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-sm text-muted-foreground">Sem dados para o período.</div>
            )}
          </div>
        </div>
      </div>

      {/* Seção de Backup e Restauração */}
      <div className="mt-8 border-t border-border pt-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Database className="w-5 h-5 text-primary" />
          Backup e Restauração do Banco de Dados
        </h2>
        
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/20 dark:to-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-xl p-6 space-y-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-700 dark:text-blue-300">
              <p className="font-medium mb-1">Importante sobre backups:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>O backup contém todos os seus dados (carteira, movimentações, histórico, etc.)</li>
                <li>Guarde o backup em local seguro - você pode restaurá-lo a qualquer momento</li>
                <li>A restauração substitui todos os dados atuais pelos dados do backup</li>
                <li>Recomendamos fazer backup regularmente antes de grandes alterações</li>
              </ul>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            {/* Download Backup */}
            <div className="bg-card border border-border rounded-lg p-5">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Download className="w-5 h-5 text-green-600 dark:text-green-400" />
                Fazer Backup
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Baixe uma cópia completa do seu banco de dados para guardar localmente ou fazer backup externo.
              </p>
              <button
                onClick={async () => {
                  try {
                    toast.loading('Gerando backup...', { id: 'backup' })
                    const blob = await carteiraService.downloadBackup()
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `backup_${new Date().toISOString().split('T')[0]}.${blob.type.includes('zip') ? 'zip' : 'sql'}`
                    document.body.appendChild(a)
                    a.click()
                    a.remove()
                    URL.revokeObjectURL(url)
                    toast.success('Backup baixado com sucesso!', { id: 'backup' })
                  } catch (error: any) {
                    console.error('Erro ao fazer backup:', error)
                    toast.error(error?.response?.data?.error || 'Erro ao fazer backup', { id: 'backup' })
                  }
                }}
                className="w-full px-4 py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Baixar Backup
              </button>
            </div>

            {/* Upload/Restore Backup */}
            <div className="bg-card border border-border rounded-lg p-5">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Upload className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                Restaurar Backup
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Restaure um backup anterior. <strong className="text-red-600 dark:text-red-400">Atenção:</strong> Isso substituirá todos os dados atuais!
              </p>
              <input
                type="file"
                accept=".zip,.sql"
                className="hidden"
                id="backup-file-input"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return

                  if (!confirm('ATENÇÃO: Isso substituirá TODOS os seus dados atuais pelos dados do backup. Deseja continuar?')) {
                    e.target.value = ''
                    return
                  }

                  try {
                    toast.loading('Restaurando backup...', { id: 'restore' })
                    const result = await carteiraService.restoreBackup(file)
                    if (result.success) {
                      toast.success('Backup restaurado com sucesso! A página será recarregada.', { id: 'restore', duration: 5000 })
                      setTimeout(() => {
                        window.location.reload()
                      }, 2000)
                    } else {
                      toast.error(result.message || 'Erro ao restaurar backup', { id: 'restore' })
                    }
                  } catch (error: any) {
                    console.error('Erro ao restaurar backup:', error)
                    toast.error(error?.response?.data?.error || 'Erro ao restaurar backup', { id: 'restore' })
                  } finally {
                    e.target.value = ''
                  }
                }}
              />
              <label
                htmlFor="backup-file-input"
                className="w-full px-4 py-3 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                Selecionar e Restaurar Backup
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
