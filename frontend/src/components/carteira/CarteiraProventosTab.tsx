import { formatCurrency } from '../../utils/formatters'
import TickerWithLogo from '../TickerWithLogo'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface CarteiraProventosTabProps {
  carteira: any[]
  filtroProventos: string
  setFiltroProventos: (value: string) => void
  loadingProventos: boolean
  proventosError: any
  proventos: any[]
  loadingProventosRecebidos: boolean
  proventosRecebidosError?: any
  proventosRecebidos: any[]
  dadosGraficoProventos: any[]
}

export default function CarteiraProventosTab({
  carteira,
  filtroProventos,
  setFiltroProventos,
  loadingProventos,
  proventosError,
  proventos,
  loadingProventosRecebidos,
  proventosRecebidosError,
  proventosRecebidos,
  dadosGraficoProventos
}: CarteiraProventosTabProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-lg md:text-xl font-semibold">Proventos</h2>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          <label className="text-sm font-medium">Filtro por período:</label>
          <select
            value={filtroProventos}
            onChange={(e) => setFiltroProventos(e.target.value as any)}
            className="px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm w-full sm:w-auto"
            aria-label="Filtrar proventos por período"
          >
            <option value="mes">Mês atual</option>
            <option value="6meses">6 meses</option>
            <option value="1ano">1 ano</option>
            <option value="5anos">5 anos</option>
            <option value="total">Total</option>
          </select>
        </div>
      </div>
      
      {!carteira || carteira.length === 0 ? (
        <div className="text-center text-muted-foreground py-8">
          Adicione ativos à sua carteira para ver os proventos.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Seção 1: Proventos Pagos (Histórico) — fonte: yfinance (histórico do ativo) */}
          <div className="bg-muted/30 rounded-lg p-4 md:p-6">
            <h3 className="text-lg font-semibold mb-4">Proventos Pagos (Histórico)</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Histórico de dividendos do ativo no período (fonte: dados de mercado). Não considera data de compra.
            </p>
            
            {loadingProventos ? (
              <div className="text-center text-muted-foreground py-8">
                Carregando histórico de proventos...
              </div>
            ) : proventosError ? (
              <div className="text-center py-8 rounded-lg bg-destructive/10 border border-destructive/20">
                <p className="font-medium text-destructive">Não foi possível carregar o histórico de proventos.</p>
                <p className="text-sm text-muted-foreground mt-1">{proventosError?.message || 'Verifique sua conexão ou tente mais tarde.'}</p>
              </div>
            ) : proventos && proventos.length > 0 ? (
              <div className="space-y-4">
                {/* Resumo do histórico */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 mb-6">
                  <div className="text-center bg-muted/30 rounded-lg p-3 md:p-4">
                    <div className="text-xl md:text-2xl font-bold text-primary">
                      {proventos.filter(p => p.proventos && p.proventos.length > 0).length}
                    </div>
                    <div className="text-xs md:text-sm text-muted-foreground">Ativos com Proventos</div>
                  </div>
                  <div className="text-center bg-muted/30 rounded-lg p-3 md:p-4">
                    <div className="text-xl md:text-2xl font-bold text-primary">
                      {proventos.reduce((total, p) => total + (p.proventos?.length || 0), 0)}
                    </div>
                    <div className="text-xs md:text-sm text-muted-foreground">Total de Proventos</div>
                  </div>
                  <div className="text-center bg-muted/30 rounded-lg p-3 md:p-4 sm:col-span-2 lg:col-span-1">
                    <div className="text-lg md:text-2xl font-bold text-primary">
                      {formatCurrency(proventos.reduce((total: number, p: any) => 
                        total + (p.proventos?.reduce((sum: number, prov: any) => sum + prov.valor, 0) || 0), 0
                      ))}
                    </div>
                    <div className="text-xs md:text-sm text-muted-foreground">Valor Total</div>
                  </div>
                </div>

                {/* Lista de proventos pagos */}
                <div className="space-y-4">
                  {proventos.map((ativo) => (
                    <div key={ativo.ticker} className="bg-background rounded-lg p-4 border border-border">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="min-w-0 truncate">
                            <TickerWithLogo ticker={ativo.ticker} nome={ativo.nome} size="md" />
                          </div>
                          {ativo.erro && (
                            <span className="text-xs sm:text-sm text-red-500 bg-red-100 px-2 py-1 rounded">
                              {ativo.erro}
                            </span>
                          )}
                        </div>
                        <div className="text-left sm:text-right">
                          <div className="text-base sm:text-lg font-bold">
                            {formatCurrency(ativo.proventos?.reduce((sum: number, prov: any) => sum + prov.valor, 0) || 0)}
                          </div>
                          <div className="text-xs sm:text-sm text-muted-foreground">
                            {ativo.proventos?.length || 0} provento{ativo.proventos?.length !== 1 ? 's' : ''}
                          </div>
                        </div>
                      </div>
                      
                      {ativo.proventos && ativo.proventos.length > 0 ? (
                        <>
                          {/* Desktop Table View */}
                          <div className="hidden md:block overflow-x-auto">
                            <table className="w-full min-w-[640px]">
                              <thead className="bg-muted/30">
                                <tr>
                                  <th className="px-4 py-2 text-left font-medium">Data</th>
                                  <th className="px-4 py-2 text-left font-medium">Tipo</th>
                                  <th className="px-4 py-2 text-left font-medium">Valor (R$)</th>
                                </tr>
                              </thead>
                              <tbody>
                                {ativo.proventos.map((provento: any, index: number) => (
                                  <tr key={index} className="hover:bg-muted/40 transition-colors">
                                    <td className="px-4 py-2">
                                      {new Date(provento.data).toLocaleDateString('pt-BR')}
                                    </td>
                                    <td className="px-4 py-2">
                                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                                        {provento.tipo}
                                      </span>
                                    </td>
                                    <td className="px-4 py-2 font-semibold">
                                      {formatCurrency(provento.valor)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {/* Mobile Card View */}
                          <div className="md:hidden space-y-3">
                            {ativo.proventos.map((provento: any, index: number) => (
                              <div key={index} className="bg-muted/30 rounded-lg p-3 border border-border">
                                <div className="flex justify-between items-start mb-2">
                                  <div className="text-sm font-medium">
                                    {new Date(provento.data).toLocaleDateString('pt-BR')}
                                  </div>
                                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                                    {provento.tipo}
                                  </span>
                                </div>
                                <div className="text-lg font-bold text-primary">
                                  {formatCurrency(provento.valor)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : !ativo.erro ? (
                        <div className="text-center text-muted-foreground py-4">
                          Nenhum provento encontrado para este ativo no período selecionado.
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                Nenhum provento encontrado para os ativos da carteira no período selecionado.
              </div>
            )}
          </div>

          {/* Seção 2: Proventos Recebidos — considera data de compra (só após ser dono do ativo) */}
          <div className="bg-muted/30 rounded-lg p-4 md:p-6">
            <h3 className="text-lg font-semibold mb-4">Proventos Recebidos (Baseado na Carteira)</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Proventos que você efetivamente recebeu: apenas dividendos com data de pagamento após a data da primeira compra do ativo.
            </p>
            
            {loadingProventosRecebidos ? (
              <div className="text-center text-muted-foreground py-8">
                Carregando proventos recebidos...
              </div>
            ) : proventosRecebidosError ? (
              <div className="text-center py-8 rounded-lg bg-destructive/10 border border-destructive/20">
                <p className="font-medium text-destructive">Não foi possível carregar os proventos recebidos.</p>
                <p className="text-sm text-muted-foreground mt-1">{proventosRecebidosError?.message || 'Verifique sua conexão ou tente mais tarde.'}</p>
              </div>
            ) : proventosRecebidos && proventosRecebidos.length > 0 ? (
              <div className="space-y-6">
                {/* Resumo de Proventos Recebidos */}
                <div className="bg-muted/30 rounded-lg p-4 md:p-6">
                  <h3 className="text-base md:text-lg font-semibold mb-4">Resumo de Proventos Recebidos</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                    <div className="text-center bg-background rounded-lg p-3 md:p-4">
                      <div className="text-xl md:text-2xl font-bold text-primary">
                        {proventosRecebidos.length}
                      </div>
                      <div className="text-xs md:text-sm text-muted-foreground">Ativos com Proventos</div>
                    </div>
                    <div className="text-center bg-background rounded-lg p-3 md:p-4">
                      <div className="text-lg md:text-2xl font-bold text-primary">
                        {formatCurrency(proventosRecebidos.reduce((total, p) => total + p.total_recebido, 0))}
                      </div>
                      <div className="text-xs md:text-sm text-muted-foreground">Valor Total Recebido</div>
                    </div>
                    <div className="text-center bg-background rounded-lg p-3 md:p-4 sm:col-span-2 lg:col-span-1">
                      <div className="text-xl md:text-2xl font-bold text-primary">
                        {proventosRecebidos.reduce((total, p) => total + p.proventos_recebidos.length, 0)}
                      </div>
                      <div className="text-xs md:text-sm text-muted-foreground">Total de Proventos</div>
                    </div>
                  </div>
                </div>

                {/* Lista de Proventos por Ativo */}
                <div className="space-y-4">
                  {proventosRecebidos?.map((provento) => (
                    <div key={provento.ticker} className="bg-muted/30 rounded-lg p-4 md:p-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="min-w-0 truncate">
                            <TickerWithLogo ticker={provento.ticker} nome={provento.nome} size="md" />
                          </div>
                          <div className="text-xs sm:text-sm text-muted-foreground">
                            <div>{provento.quantidade_carteira} ações</div>
                            {provento.data_aquisicao && (
                              <div className="text-xs">
                                (Adquirido em {new Date(provento.data_aquisicao).toLocaleDateString('pt-BR')})
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-left sm:text-right">
                          <div className="text-base sm:text-lg font-bold">
                            {formatCurrency(provento.total_recebido)}
                          </div>
                          <div className="text-xs sm:text-sm text-muted-foreground">
                            {provento.proventos_recebidos.length} provento{provento.proventos_recebidos.length !== 1 ? 's' : ''}
                          </div>
                        </div>
                      </div>
                      
                      {provento.proventos_recebidos && provento.proventos_recebidos.length > 0 ? (
                        <>
                          {/* Desktop Table View */}
                          <div className="hidden md:block overflow-x-auto">
                            <table className="w-full min-w-[720px]">
                              <thead className="bg-muted/30">
                                <tr>
                                  <th className="px-4 py-2 text-left font-medium">Data</th>
                                  <th className="px-4 py-2 text-left font-medium">Valor Unitário</th>
                                  <th className="px-4 py-2 text-left font-medium">Quantidade</th>
                                  <th className="px-4 py-2 text-left font-medium">Valor Recebido</th>
                                </tr>
                              </thead>
                              <tbody>
                                {provento.proventos_recebidos.map((prov: any, index: number) => (
                                  <tr key={index} className="hover:bg-muted/40 transition-colors">
                                    <td className="px-4 py-2">
                                      {new Date(prov.data).toLocaleDateString('pt-BR')}
                                    </td>
                                    <td className="px-4 py-2">
                                      {formatCurrency(prov.valor_unitario)}
                                    </td>
                                    <td className="px-4 py-2">
                                      {prov.quantidade}
                                    </td>
                                    <td className="px-4 py-2 font-semibold">
                                      {formatCurrency(prov.valor_recebido)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {/* Mobile Card View */}
                          <div className="md:hidden space-y-3">
                                                          {provento.proventos_recebidos.map((prov: any, index: number) => (
                              <div key={index} className="bg-background rounded-lg p-3 border border-border">
                                <div className="flex justify-between items-start mb-2">
                                  <div className="text-sm font-medium">
                                    {new Date(prov.data).toLocaleDateString('pt-BR')}
                                  </div>
                                  <div className="text-right">
                                    <div className="text-sm text-muted-foreground">
                                      {prov.quantidade} ações
                                    </div>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                  <div>
                                    <div className="text-xs text-muted-foreground">Valor Unitário</div>
                                    <div className="font-medium">{formatCurrency(prov.valor_unitario)}</div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-muted-foreground">Valor Recebido</div>
                                    <div className="font-bold text-primary">{formatCurrency(prov.valor_recebido)}</div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <div className="text-center text-muted-foreground py-4">
                          Nenhum provento recebido para este ativo no período selecionado.
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                Nenhum provento recebido para os ativos da carteira no período selecionado.
              </div>
            )}
          </div>

          {/* Gráfico de Proventos */}
          <div className="bg-muted/30 rounded-lg p-4 md:p-6">
            <h3 className="text-base md:text-lg font-semibold mb-4">Proventos por Mês</h3>
            {dadosGraficoProventos.length > 0 ? (
              <div className="w-full min-h-[280px] h-72 sm:h-80 md:h-[340px] overflow-visible">
                <ResponsiveContainer width="100%" height="100%" minHeight={280}>
                  <BarChart data={dadosGraficoProventos} margin={{ top: 12, right: 20, left: 12, bottom: 64 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="mes" 
                      stroke="hsl(var(--muted-foreground))"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(value) => {
                        if (!value || typeof value !== 'string') return String(value ?? '')
                        const [ano, mes] = value.split('-')
                        return mes && ano ? `${mes}/${ano.slice(2)}` : value
                      }}
                      angle={-45}
                      textAnchor="end"
                      height={56}
                    />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))"
                      tick={{ fontSize: 11 }}
                      width={56}
                      tickFormatter={(value) => formatCurrency(value, '')}
                      domain={['auto', 'auto']}
                      allowDataOverflow={false}
                    />
                    <Tooltip 
                      formatter={(value: number) => [formatCurrency(value), 'Valor Recebido']}
                      labelFormatter={(label) => {
                        if (!label || typeof label !== 'string') return String(label ?? '')
                        const [ano, mes] = label.split('-')
                        return mes && ano ? `${mes}/${ano}` : label
                      }}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))', 
                        borderRadius: '8px',
                        color: 'hsl(var(--foreground))'
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar 
                      dataKey="valor" 
                      name="Valor Recebido"
                      fill="#10b981" 
                      radius={[4, 4, 0, 0]}
                      isAnimationActive
                      animationDuration={800}
                      animationEasing="ease-out"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                Nenhum provento recebido no período selecionado para gerar o gráfico.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
