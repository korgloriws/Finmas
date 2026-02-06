import { useMemo, useRef, useEffect, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import 'echarts'
import 'echarts-gl'
import { useTheme } from '../../contexts/ThemeContext'

const MOBILE_BREAKPOINT = 640

export type DadoPizza = { name: string; value: number; fill: string; percentage?: string }

interface DistribuicaoCarteiraEChartsProps {
  dados: DadoPizza[]
  totalInvestido: number
  onSegmentClick?: (tipo: string) => void
  /** '3d' = barras 3D, 'pie' = pizza 2D animada */
  variant?: '3d' | 'pie'
  formatCurrency: (value: number) => string
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT)
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return isMobile
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
  const isMobile = useIsMobile()

  const option = useMemo(() => {
    if (!dados.length) return null

    const textColor = isDark ? '#e2e8f0' : '#1e293b'
    const bgColor = 'transparent'

    if (variant === '3d') {
      const xCategories = dados.map(d => d.name)
      const barData = dados.map((d, i) => [i, 0, d.value])
      return {
        backgroundColor: bgColor,
        tooltip: {
          trigger: 'item',
          backgroundColor: isDark ? 'rgba(30,41,59,0.95)' : 'rgba(255,255,255,0.95)',
          borderColor: isDark ? '#475569' : '#e2e8f0',
          textStyle: { color: textColor, fontSize: isMobile ? 12 : 13 },
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
          boxWidth: isMobile ? 80 : 120,
          boxHeight: isMobile ? 50 : 80,
          boxDepth: isMobile ? 40 : 60,
          viewControl: {
            autoRotate: !isMobile,
            autoRotateSpeed: 8,
            distance: isMobile ? 180 : 220,
            minDistance: isMobile ? 100 : 150,
            maxDistance: isMobile ? 280 : 350,
            alpha: 35,
            beta: 50
          },
          light: {
            main: { intensity: 1.2, shadow: !isMobile },
            ambient: { intensity: isMobile ? 0.5 : 0.4 }
          },
          environment: 'auto',
          axisPointer: { show: false }
        },
        xAxis3D: {
          type: 'category',
          data: xCategories,
          axisLabel: {
            color: textColor,
            rotate: isMobile ? 35 : 45,
            fontSize: isMobile ? 8 : 10
          },
          axisLine: { lineStyle: { color: isDark ? '#475569' : '#cbd5e1' } }
        },
        yAxis3D: {
          type: 'category',
          data: [''],
          axisLabel: { color: textColor, fontSize: isMobile ? 8 : 10 },
          axisLine: { lineStyle: { color: isDark ? '#475569' : '#cbd5e1' } }
        },
        zAxis3D: {
          type: 'value',
          axisLabel: { color: textColor, fontSize: isMobile ? 8 : 10 },
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
            label: { show: false },
            emphasis: { label: { show: true, color: textColor, fontSize: isMobile ? 9 : 11 } },
            bevelSize: isMobile ? 0.2 : 0.3,
            bevelSmoothness: 2,
            animation: true,
            animationDuration: isMobile ? 1000 : 1500,
            animationEasing: 'cubicOut'
          }
        ]
      }
    }

    // Pizza 2D: responsivo (radius em %)
    return {
      backgroundColor: bgColor,
      tooltip: {
        trigger: 'item',
        backgroundColor: isDark ? 'rgba(30,41,59,0.95)' : 'rgba(255,255,255,0.95)',
        borderColor: isDark ? '#475569' : '#e2e8f0',
        textStyle: { color: textColor, fontSize: isMobile ? 12 : 13 },
        formatter: (params: any) => {
          const item = params.data
          const pct = item.percentage ?? (totalInvestido > 0 ? ((item.value / totalInvestido) * 100).toFixed(1) : '0')
          return `<strong>${item.name}</strong><br/>${formatCurrency(item.value)} (${pct}%)`
        }
      },
      legend: {
        orient: 'horizontal',
        bottom: isMobile ? 0 : 8,
        left: 'center',
        textStyle: { color: textColor, fontSize: isMobile ? 10 : 11 }
      },
      series: [
        {
          type: 'pie',
          radius: isMobile ? ['28%', '58%'] : ['35%', '70%'],
          center: ['50%', isMobile ? '42%' : '48%'],
          avoidLabelOverlap: true,
          itemStyle: {
            borderRadius: 6,
            borderColor: bgColor,
            borderWidth: 2
          },
          label: {
            show: true,
            color: textColor,
            fontSize: isMobile ? 9 : 10,
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
  }, [dados, totalInvestido, variant, formatCurrency, isDark, isMobile])

  useEffect(() => {
    const chart = chartRef.current?.getEchartsInstance()
    if (!chart || !onSegmentClick) return
    const handler = (params: any) => {
      if (params?.componentType === 'series' && params?.name) {
        onSegmentClick(params.name)
      }
    }
    chart.on('click', handler)
    return () => {
      chart.off('click', handler)
    }
  }, [onSegmentClick])

  if (!option) return null

  return (
    <div className="w-full h-full min-h-[280px] sm:min-h-[256px] md:min-h-[320px] overflow-visible">
      <ReactECharts
        ref={chartRef}
        option={option}
        style={{ width: '100%', height: '100%', minHeight: 280 }}
        opts={{ renderer: 'canvas' }}
        notMerge
      />
    </div>
  )
}
