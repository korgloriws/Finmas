import { useMemo, useRef, useEffect } from 'react'
import ReactECharts from 'echarts-for-react'
import * as echarts from 'echarts'
import 'echarts-gl'
import { useTheme } from '../../contexts/ThemeContext'

export type DadoPizza = { name: string; value: number; fill: string; percentage?: string }

interface DistribuicaoCarteiraEChartsProps {
  dados: DadoPizza[]
  totalInvestido: number
  onSegmentClick?: (tipo: string) => void
  /** '3d' = barras 3D, 'pie' = pizza 2D animada */
  variant?: '3d' | 'pie'
  formatCurrency: (value: number) => string
}

export default function DistribuicaoCarteiraECharts({
  dados,
  totalInvestido,
  onSegmentClick,
  variant = '3d',
  formatCurrency
}: DistribuicaoCarteiraEChartsProps) {
  const { isDark } = useTheme()
  const chartRef = useRef<ReactECharts>(null)

  const option = useMemo(() => {
    if (!dados.length) return null

    const textColor = isDark ? '#e2e8f0' : '#1e293b'
    const bgColor = 'transparent'

    if (variant === '3d') {
      // Barras 3D: um eixo = tipo de ativo, altura = valor
      const xCategories = dados.map(d => d.name)
      const barData = dados.map((d, i) => [i, 0, d.value])
      return {
        backgroundColor: bgColor,
        tooltip: {
          trigger: 'item',
          backgroundColor: isDark ? 'rgba(30,41,59,0.95)' : 'rgba(255,255,255,0.95)',
          borderColor: isDark ? '#475569' : '#e2e8f0',
          textStyle: { color: textColor },
          formatter: (params: any) => {
            const p = params.data
            const idx = Array.isArray(p) ? p[0] : 0
            const item = dados[idx]
            if (!item) return ''
            const pct = totalInvestido > 0 ? ((item.value / totalInvestido) * 100).toFixed(1) : '0'
            return `<strong>${item.name}</strong><br/>${formatCurrency(item.value)} (${pct}%)`
          }
        },
        grid3D: {
          boxWidth: 120,
          boxHeight: 80,
          boxDepth: 60,
          viewControl: {
            autoRotate: true,
            autoRotateSpeed: 8,
            distance: 220,
            minDistance: 150,
            maxDistance: 350,
            alpha: 35,
            beta: 50
          },
          light: {
            main: { intensity: 1.2, shadow: true },
            ambient: { intensity: 0.4 }
          },
          environment: 'auto',
          axisPointer: { show: false }
        },
        xAxis3D: {
          type: 'category',
          data: xCategories,
          axisLabel: {
            color: textColor,
            rotate: 45,
            fontSize: 10
          },
          axisLine: { lineStyle: { color: isDark ? '#475569' : '#cbd5e1' } }
        },
        yAxis3D: {
          type: 'category',
          data: [''],
          axisLabel: { color: textColor },
          axisLine: { lineStyle: { color: isDark ? '#475569' : '#cbd5e1' } }
        },
        zAxis3D: {
          type: 'value',
          axisLabel: { color: textColor },
          axisLine: { lineStyle: { color: isDark ? '#475569' : '#cbd5e1' } },
          splitLine: { lineStyle: { color: isDark ? '#334155' : '#e2e8f0' } }
        },
        series: [
          {
            type: 'bar3D',
            data: barData.map((item, idx) => ({
              value: item,
              itemStyle: { color: dados[idx].fill },
              emphasis: {
                itemStyle: { color: dados[idx].fill, opacity: 1 },
                label: { show: true }
              }
            })),
            shading: 'lambert',
            label: {
              show: false
            },
            emphasis: {
              label: { show: true, color: textColor }
            },
            bevelSize: 0.3,
            bevelSmoothness: 2,
            animation: true,
            animationDuration: 1500,
            animationEasing: 'cubicOut'
          }
        ]
      }
    }

    // Pizza 2D com animação forte
    return {
      backgroundColor: bgColor,
      tooltip: {
        trigger: 'item',
        backgroundColor: isDark ? 'rgba(30,41,59,0.95)' : 'rgba(255,255,255,0.95)',
        borderColor: isDark ? '#475569' : '#e2e8f0',
        textStyle: { color: textColor },
        formatter: (params: any) => {
          const item = params.data
          const pct = item.percentage ?? (totalInvestido > 0 ? ((item.value / totalInvestido) * 100).toFixed(1) : '0')
          return `<strong>${item.name}</strong><br/>${formatCurrency(item.value)} (${pct}%)`
        }
      },
      legend: {
        orient: 'horizontal',
        bottom: 8,
        left: 'center',
        textStyle: { color: textColor, fontSize: 11 }
      },
      series: [
        {
          type: 'pie',
          radius: ['35%', '70%'],
          center: ['50%', '48%'],
          avoidLabelOverlap: true,
          itemStyle: {
            borderRadius: 6,
            borderColor: bgColor,
            borderWidth: 2
          },
          label: {
            show: true,
            color: textColor,
            fontSize: 10,
            formatter: (params: any) => (params.percent > 8 ? `${params.percent.toFixed(1)}%` : '')
          },
          emphasis: {
            label: { show: true },
            itemStyle: {
              shadowBlur: 12,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0,0,0,0.3)'
            }
          },
          data: dados.map(d => ({
            name: d.name,
            value: d.value,
            itemStyle: { color: d.fill },
            percentage: d.percentage
          })),
          animation: true,
          animationType: 'scale',
          animationDuration: 1200,
          animationEasing: 'cubicOut',
          animationDelay: (idx: number) => idx * 80
        }
      ]
    }
  }, [dados, totalInvestido, variant, formatCurrency, isDark])

  useEffect(() => {
    const chart = chartRef.current?.getEchartsInstance()
    if (!chart || !onSegmentClick) return
    const handler = (params: any) => {
      if (params?.componentType === 'series' && params?.name) {
        onSegmentClick(params.name)
      }
    }
    chart.on('click', handler)
    return () => chart.off('click', handler)
  }, [onSegmentClick])

  if (!option) return null

  return (
    <ReactECharts
      ref={chartRef}
      option={option}
      style={{ width: '100%', height: '100%', minHeight: 280 }}
      opts={{ renderer: 'canvas' }}
      notMerge
    />
  )
}
