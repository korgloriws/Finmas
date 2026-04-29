import { useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Calculator, TrendingUp, Scale, DollarSign, Landmark } from 'lucide-react'
import JurosCompostosPage from './JurosCompostosPage'
import CorrecaoMonetariaPage from './CorrecaoMonetariaPage'
import ConversorMoedasPage from './ConversorMoedasPage'
import IndicadoresCalculatorPage from './IndicadoresCalculatorPage'

type CalculadoraTab = 'juros-compostos' | 'correcao-monetaria' | 'conversor' | 'indicadores'

const CALCULATOR_TABS: Array<{
  id: CalculadoraTab
  label: string
  shortLabel: string
  icon: typeof Calculator
}> = [
  { id: 'juros-compostos', label: 'Juros Compostos', shortLabel: 'Juros', icon: TrendingUp },
  { id: 'correcao-monetaria', label: 'Correção Monetária', shortLabel: 'Correção', icon: Scale },
  { id: 'conversor', label: 'Conversor de Moedas', shortLabel: 'Conversor', icon: DollarSign },
  { id: 'indicadores', label: 'Indicadores BCB', shortLabel: 'Indicadores', icon: Landmark },
]

export default function CalculadoraPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const activeTab = useMemo<CalculadoraTab>(() => {
    const raw = (searchParams.get('tab') || '').trim() as CalculadoraTab
    return CALCULATOR_TABS.some((t) => t.id === raw) ? raw : 'juros-compostos'
  }, [searchParams])

  const handleTabChange = (tab: CalculadoraTab) => {
    navigate(`/calculadora?tab=${tab}`)
  }

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="border-b border-border">
          <div className="flex overflow-x-auto scrollbar-hide">
            {CALCULATOR_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-2 px-4 sm:px-6 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'text-primary border-b-2 border-primary bg-primary/5'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.shortLabel}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {activeTab === 'juros-compostos' && <JurosCompostosPage />}
      {activeTab === 'correcao-monetaria' && <CorrecaoMonetariaPage />}
      {activeTab === 'conversor' && <ConversorMoedasPage />}
      {activeTab === 'indicadores' && <IndicadoresCalculatorPage />}
    </div>
  )
}
