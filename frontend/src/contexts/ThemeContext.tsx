import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

// Cor custom em formato HSL: "hue saturation% lightness%"
interface ThemeContextType {
  isDark: boolean
  toggleTheme: () => void
  themeColor: string // HSL format: "hue saturation% lightness%"
  setThemeColor: (color: string) => void // Recebe HSL format
  getThemeColorHex: () => string // Retorna HEX para o input color
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

// Função para converter HEX para HSL (formato usado: "hue saturation% lightness%")
export function hexToHsl(hex: string): string {
  // Remove o # se existir
  hex = hex.replace('#', '')
  
  // Converte para RGB
  const r = parseInt(hex.substring(0, 2), 16) / 255
  const g = parseInt(hex.substring(2, 4), 16) / 255
  const b = parseInt(hex.substring(4, 6), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h: number, s: number, l: number

  l = (max + min) / 2

  if (max === min) {
    h = s = 0 // acromático
  } else {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6
        break
      case g:
        h = ((b - r) / d + 2) / 6
        break
      case b:
        h = ((r - g) / d + 4) / 6
        break
      default:
        h = 0
    }
  }

  // Converte para o formato que usamos: "hue saturation% lightness%"
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`
}

// Função para converter HSL string para HEX (para o input color)
export function hslToHex(hslString: string): string {
  const match = hslString.match(/(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%/)
  if (!match) return '#ff6b35' // fallback para laranja

  const h = parseFloat(match[1]) / 360
  const s = parseFloat(match[2]) / 100
  const l = parseFloat(match[3]) / 100

  let r: number, g: number, b: number

  if (s === 0) {
    r = g = b = l // acromático
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1
      if (t > 1) t -= 1
      if (t < 1/6) return p + (q - p) * 6 * t
      if (t < 1/2) return q
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
      return p
    }

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q

    r = hue2rgb(p, q, h + 1/3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1/3)
  }

  const toHex = (c: number) => {
    const hex = Math.round(c * 255).toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme')
    return saved ? saved === 'dark' : true
  })

  // Cor padrão: laranja (24 95% 53%)
  const [themeColor, setThemeColorState] = useState<string>(() => {
    const saved = localStorage.getItem('theme-color')
    return saved || '24 95% 53%'
  })

  useEffect(() => {
    localStorage.setItem('theme', isDark ? 'dark' : 'light')
    if (isDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [isDark])

  // Aplicar cor do tema (mesma cor para claro e escuro)
  useEffect(() => {
    localStorage.setItem('theme-color', themeColor)
    
    // Aplicar a cor primária dinamicamente
    const root = document.documentElement
    root.style.setProperty('--primary', themeColor)
    root.style.setProperty('--ring', themeColor)
  }, [themeColor])

  const toggleTheme = () => {
    setIsDark(!isDark)
  }

  const setThemeColor = (color: string) => {
    setThemeColorState(color)
  }

  const getThemeColorHex = () => {
    return hslToHex(themeColor)
  }

  return (
    <ThemeContext.Provider value={{ 
      isDark, 
      toggleTheme, 
      themeColor, 
      setThemeColor,
      getThemeColorHex
    }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
} 