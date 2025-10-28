import { 
  Building2, 
  ExternalLink, 
  BookOpen, 
  Shield, 
  DollarSign, 
  Info
} from 'lucide-react'

export default function GuiaTesouroDiretoTab() {

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
                <DollarSign className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
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

      {/* Análise Detalhada dos Títulos */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-primary/10">
            <BookOpen className="w-6 h-6 text-primary" />
          </div>
          <h3 className="text-xl font-semibold text-foreground">Análise Detalhada dos Títulos</h3>
        </div>

        {/* Tesouro Prefixado */}
        <div className="mb-8 p-6 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
              <span className="text-blue-600 dark:text-blue-400 font-bold text-sm">1</span>
            </div>
            <h4 className="text-lg font-semibold text-foreground">Tesouro Prefixado (LTN)</h4>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h5 className="font-semibold text-foreground mb-3">Como Funciona</h5>
              <p className="text-sm text-muted-foreground mb-4">
                Você compra por um preço e recebe R$ 1.000,00 na data de vencimento. 
                A taxa de juros é fixa e conhecida no momento da compra.
              </p>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Indexador:</span>
                  <span className="font-medium">Taxa Fixa</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Rendimento:</span>
                  <span className="font-medium text-green-600">Previsível</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Prazo:</span>
                  <span className="font-medium">1 a 10 anos</span>
                </div>
              </div>
            </div>
            <div>
              <h5 className="font-semibold text-foreground mb-3">Vantagens & Desvantagens</h5>
              <div className="space-y-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-green-600">✓</span>
                    <span className="text-sm font-medium text-green-800 dark:text-green-300">Vantagens</span>
                  </div>
                  <ul className="text-xs text-muted-foreground ml-4 space-y-1">
                    <li>• Rendimento previsível</li>
                    <li>• Proteção contra queda da Selic</li>
                    <li>• Boa para reserva de emergência</li>
                  </ul>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-red-600">⚠</span>
                    <span className="text-sm font-medium text-red-800 dark:text-red-300">Desvantagens</span>
                  </div>
                  <ul className="text-xs text-muted-foreground ml-4 space-y-1">
                    <li>• Não protege da inflação</li>
                    <li>• Mark-to-market (preço varia)</li>
                    <li>• Risco de taxa de juros</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tesouro Selic */}
        <div className="mb-8 p-6 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
              <span className="text-green-600 dark:text-green-400 font-bold text-sm">2</span>
            </div>
            <h4 className="text-lg font-semibold text-foreground">Tesouro Selic (LTF)</h4>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h5 className="font-semibold text-foreground mb-3">Como Funciona</h5>
              <p className="text-sm text-muted-foreground mb-4">
                Rendimento atrelado à taxa Selic (taxa básica de juros). 
                Quanto maior a Selic, maior o rendimento.
              </p>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Indexador:</span>
                  <span className="font-medium">SELIC</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Rendimento:</span>
                  <span className="font-medium text-blue-600">Variável</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Prazo:</span>
                  <span className="font-medium">1 a 5 anos</span>
                </div>
              </div>
            </div>
            <div>
              <h5 className="font-semibold text-foreground mb-3">Vantagens & Desvantagens</h5>
              <div className="space-y-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-green-600">✓</span>
                    <span className="text-sm font-medium text-green-800 dark:text-green-300">Vantagens</span>
                  </div>
                  <ul className="text-xs text-muted-foreground ml-4 space-y-1">
                    <li>• Acompanha a política monetária</li>
                    <li>• Menor volatilidade de preço</li>
                    <li>• Boa liquidez</li>
                  </ul>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-red-600">⚠</span>
                    <span className="text-sm font-medium text-red-800 dark:text-red-300">Desvantagens</span>
                  </div>
                  <ul className="text-xs text-muted-foreground ml-4 space-y-1">
                    <li>• Rendimento varia com Selic</li>
                    <li>• Não protege da inflação</li>
                    <li>• Menor rentabilidade em baixa Selic</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tesouro IPCA+ */}
        <div className="mb-8 p-6 bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800 rounded-xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/20 rounded-full flex items-center justify-center">
              <span className="text-purple-600 dark:text-purple-400 font-bold text-sm">3</span>
            </div>
            <h4 className="text-lg font-semibold text-foreground">Tesouro IPCA+ (NTN-B)</h4>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h5 className="font-semibold text-foreground mb-3">Como Funciona</h5>
              <p className="text-sm text-muted-foreground mb-4">
                Proteção contra inflação + taxa fixa. Rendimento = IPCA + taxa fixa. 
                Ideal para objetivos de longo prazo.
              </p>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Indexador:</span>
                  <span className="font-medium">IPCA + Taxa</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Rendimento:</span>
                  <span className="font-medium text-purple-600">Proteção Inflação</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Prazo:</span>
                  <span className="font-medium">5 a 30 anos</span>
                </div>
              </div>
            </div>
            <div>
              <h5 className="font-semibold text-foreground mb-3">Vantagens & Desvantagens</h5>
              <div className="space-y-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-green-600">✓</span>
                    <span className="text-sm font-medium text-green-800 dark:text-green-300">Vantagens</span>
                  </div>
                  <ul className="text-xs text-muted-foreground ml-4 space-y-1">
                    <li>• Proteção contra inflação</li>
                    <li>• Ideal para aposentadoria</li>
                    <li>• Rendimento real garantido</li>
                  </ul>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-red-600">⚠</span>
                    <span className="text-sm font-medium text-red-800 dark:text-red-300">Desvantagens</span>
                  </div>
                  <ul className="text-xs text-muted-foreground ml-4 space-y-1">
                    <li>• Mark-to-market (preço varia)</li>
                    <li>• Prazo longo para melhor rendimento</li>
                    <li>• Sensível a mudanças de taxa</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tesouro Educa+ e Renda+ */}
        <div className="mb-8 p-6 bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800 rounded-xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center">
              <span className="text-orange-600 dark:text-orange-400 font-bold text-sm">4</span>
            </div>
            <h4 className="text-lg font-semibold text-foreground">Tesouro Educa+ e Renda+</h4>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h5 className="font-semibold text-foreground mb-3">Tesouro Educa+</h5>
              <p className="text-sm text-muted-foreground mb-4">
                Específico para financiar educação dos filhos. 
                Rendimento = IPCA + taxa fixa, com vencimento em até 18 anos.
              </p>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Objetivo:</span>
                  <span className="font-medium">Educação</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Prazo:</span>
                  <span className="font-medium">Até 18 anos</span>
                </div>
              </div>
            </div>
            <div>
              <h5 className="font-semibold text-foreground mb-3">Tesouro Renda+</h5>
              <p className="text-sm text-muted-foreground mb-4">
                Para complementar aposentadoria. 
                Rendimento = IPCA + taxa fixa, com vencimento em até 20 anos.
              </p>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Objetivo:</span>
                  <span className="font-medium">Aposentadoria</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Prazo:</span>
                  <span className="font-medium">Até 20 anos</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>


      {/* Comparação entre Títulos */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-primary/10">
            <Info className="w-6 h-6 text-primary" />
          </div>
          <h3 className="text-xl font-semibold text-foreground">Comparação entre Títulos</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 font-semibold">Título</th>
                <th className="text-left py-3 px-4 font-semibold">Proteção Inflação</th>
                <th className="text-left py-3 px-4 font-semibold">Rendimento</th>
                <th className="text-left py-3 px-4 font-semibold">Prazo Ideal</th>
                <th className="text-left py-3 px-4 font-semibold">Volatilidade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td className="py-3 px-4 font-medium">Prefixado</td>
                <td className="py-3 px-4">
                  <span className="text-red-600">❌ Não</span>
                </td>
                <td className="py-3 px-4 text-green-600">Previsível</td>
                <td className="py-3 px-4">1-5 anos</td>
                <td className="py-3 px-4 text-yellow-600">Alta</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium">Selic</td>
                <td className="py-3 px-4">
                  <span className="text-red-600">❌ Não</span>
                </td>
                <td className="py-3 px-4 text-blue-600">Variável</td>
                <td className="py-3 px-4">1-3 anos</td>
                <td className="py-3 px-4 text-green-600">Baixa</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium">IPCA+</td>
                <td className="py-3 px-4">
                  <span className="text-green-600">✅ Sim</span>
                </td>
                <td className="py-3 px-4 text-purple-600">Real + Taxa</td>
                <td className="py-3 px-4">5+ anos</td>
                <td className="py-3 px-4 text-yellow-600">Média</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium">Educa+/Renda+</td>
                <td className="py-3 px-4">
                  <span className="text-green-600">✅ Sim</span>
                </td>
                <td className="py-3 px-4 text-orange-600">Real + Taxa</td>
                <td className="py-3 px-4">10+ anos</td>
                <td className="py-3 px-4 text-yellow-600">Média</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Estratégias por Objetivo */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-primary/10">
            <DollarSign className="w-6 h-6 text-primary" />
          </div>
          <h3 className="text-xl font-semibold text-foreground">Estratégias por Objetivo</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Reserva de Emergência */}
          <div className="p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-xl">
            <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <span className="w-6 h-6 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center text-blue-600 text-xs font-bold">1</span>
              Reserva de Emergência
            </h4>
            <p className="text-sm text-muted-foreground mb-3">
              Manter 3-6 meses de gastos em investimentos seguros e líquidos.
            </p>
            <div className="space-y-2">
              <div className="text-xs">
                <span className="font-medium text-green-600">✓ Recomendado:</span>
                <span className="text-muted-foreground ml-1">Tesouro Selic</span>
              </div>
              <div className="text-xs">
                <span className="font-medium text-blue-600">💡 Por quê:</span>
                <span className="text-muted-foreground ml-1">Liquidez diária, baixa volatilidade</span>
              </div>
            </div>
          </div>

          {/* Aposentadoria */}
          <div className="p-4 bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800 rounded-xl">
            <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <span className="w-6 h-6 bg-purple-100 dark:bg-purple-900/20 rounded-full flex items-center justify-center text-purple-600 text-xs font-bold">2</span>
              Aposentadoria
            </h4>
            <p className="text-sm text-muted-foreground mb-3">
              Proteger poder de compra ao longo de décadas.
            </p>
            <div className="space-y-2">
              <div className="text-xs">
                <span className="font-medium text-green-600">✓ Recomendado:</span>
                <span className="text-muted-foreground ml-1">Tesouro IPCA+ ou Renda+</span>
              </div>
              <div className="text-xs">
                <span className="font-medium text-blue-600">💡 Por quê:</span>
                <span className="text-muted-foreground ml-1">Proteção contra inflação</span>
              </div>
            </div>
          </div>

          {/* Educação dos Filhos */}
          <div className="p-4 bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800 rounded-xl">
            <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <span className="w-6 h-6 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center text-orange-600 text-xs font-bold">3</span>
              Educação dos Filhos
            </h4>
            <p className="text-sm text-muted-foreground mb-3">
              Garantir recursos para educação superior.
            </p>
            <div className="space-y-2">
              <div className="text-xs">
                <span className="font-medium text-green-600">✓ Recomendado:</span>
                <span className="text-muted-foreground ml-1">Tesouro Educa+</span>
              </div>
              <div className="text-xs">
                <span className="font-medium text-blue-600">💡 Por quê:</span>
                <span className="text-muted-foreground ml-1">Específico para educação</span>
              </div>
            </div>
          </div>

          {/* Objetivo de Curto Prazo */}
          <div className="p-4 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-xl">
            <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <span className="w-6 h-6 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center text-green-600 text-xs font-bold">4</span>
              Objetivo 1-3 anos
            </h4>
            <p className="text-sm text-muted-foreground mb-3">
              Viagem, carro, casa - objetivos específicos.
            </p>
            <div className="space-y-2">
              <div className="text-xs">
                <span className="font-medium text-green-600">✓ Recomendado:</span>
                <span className="text-muted-foreground ml-1">Tesouro Selic ou Prefixado</span>
              </div>
              <div className="text-xs">
                <span className="font-medium text-blue-600">💡 Por quê:</span>
                <span className="text-muted-foreground ml-1">Menor volatilidade</span>
              </div>
            </div>
          </div>

          {/* Diversificação */}
          <div className="p-4 bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-200 dark:border-indigo-800 rounded-xl">
            <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <span className="w-6 h-6 bg-indigo-100 dark:bg-indigo-900/20 rounded-full flex items-center justify-center text-indigo-600 text-xs font-bold">5</span>
              Diversificação
            </h4>
            <p className="text-sm text-muted-foreground mb-3">
              Combinar diferentes títulos para balancear riscos.
            </p>
            <div className="space-y-2">
              <div className="text-xs">
                <span className="font-medium text-green-600">✓ Estratégia:</span>
                <span className="text-muted-foreground ml-1">Mix de títulos</span>
              </div>
              <div className="text-xs">
                <span className="font-medium text-blue-600">💡 Exemplo:</span>
                <span className="text-muted-foreground ml-1">50% Selic + 50% IPCA+</span>
              </div>
            </div>
          </div>

          {/* Perfil Conservador */}
          <div className="p-4 bg-gray-50 dark:bg-gray-900/10 border border-gray-200 dark:border-gray-800 rounded-xl">
            <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <span className="w-6 h-6 bg-gray-100 dark:bg-gray-900/20 rounded-full flex items-center justify-center text-gray-600 text-xs font-bold">6</span>
              Perfil Conservador
            </h4>
            <p className="text-sm text-muted-foreground mb-3">
              Priorizar segurança e liquidez.
            </p>
            <div className="space-y-2">
              <div className="text-xs">
                <span className="font-medium text-green-600">✓ Recomendado:</span>
                <span className="text-muted-foreground ml-1">Tesouro Selic</span>
              </div>
              <div className="text-xs">
                <span className="font-medium text-blue-600">💡 Por quê:</span>
                <span className="text-muted-foreground ml-1">Menor risco, boa liquidez</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Informações Importantes */}
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
