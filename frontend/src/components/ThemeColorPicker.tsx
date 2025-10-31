import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Palette, X } from 'lucide-react'
import { useTheme, hexToHsl } from '../contexts/ThemeContext'

export default function ThemeColorPicker() {
  const { themeColor, setThemeColor, getThemeColorHex } = useTheme()
  const [isOpen, setIsOpen] = useState(false)
  const colorInputRef = useRef<HTMLInputElement>(null)

  const handleColorChange = (hexColor: string) => {
    const hslColor = hexToHsl(hexColor)
    setThemeColor(hslColor)
  }

  // Converter HSL string para cor de visualização
  const getColorPreview = (hslString: string) => {
    return `hsl(${hslString})`
  }

  const currentHex = getThemeColorHex()

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        aria-label="Escolher cor do tema"
      >
        <Palette size={18} />
        <span className="text-sm">Cor do Tema</span>
        <div 
          className="ml-auto w-5 h-5 rounded-full border-2 border-border"
          style={{ backgroundColor: getColorPreview(themeColor) }}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Overlay */}
            <div
              className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
              onClick={() => setIsOpen(false)}
            >
              {/* Modal */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.2 }}
                className="relative bg-card border border-border rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-6 w-full max-w-md"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="p-1.5 sm:p-2 rounded-md sm:rounded-lg bg-primary/10">
                      <Palette className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                    </div>
                    <h3 className="text-base sm:text-lg font-semibold text-foreground">Seletor de Cores</h3>
                  </div>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 sm:p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                    aria-label="Fechar"
                  >
                    <X className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                </div>

                {/* Color Picker */}
                <div className="space-y-4 sm:space-y-6">
                  <div>
                    <label className="block text-sm sm:text-base font-medium text-foreground mb-3">
                      Escolha uma cor:
                    </label>
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                      {/* Input Color */}
                      <div className="relative flex-1 w-full">
                        <input
                          ref={colorInputRef}
                          type="color"
                          value={currentHex}
                          onChange={(e) => handleColorChange(e.target.value)}
                          className="w-full h-16 sm:h-20 rounded-lg cursor-pointer border-2 border-border bg-transparent"
                          style={{
                            WebkitAppearance: 'none',
                            appearance: 'none',
                          }}
                          aria-label="Seletor de cores RGB"
                        />
                        <style>{`
                          input[type="color"]::-webkit-color-swatch-wrapper {
                            padding: 0;
                            border-radius: 0.5rem;
                          }
                          input[type="color"]::-webkit-color-swatch {
                            border: 2px solid hsl(var(--border));
                            border-radius: 0.5rem;
                          }
                          input[type="color"]::-moz-color-swatch {
                            border: 2px solid hsl(var(--border));
                            border-radius: 0.5rem;
                          }
                        `}</style>
                      </div>
                      
                      {/* Preview */}
                      <div className="flex flex-col items-center gap-2 sm:gap-3">
                        <div 
                          className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl border-2 border-border shadow-lg"
                          style={{ backgroundColor: getColorPreview(themeColor) }}
                          title={themeColor}
                        />
                        <div className="text-center">
                          <p className="text-xs sm:text-sm font-medium text-foreground mb-1">Cor Atual</p>
                          <p className="text-xs text-muted-foreground font-mono">{currentHex.toUpperCase()}</p>
                          <p className="text-xs text-muted-foreground font-mono mt-1">HSL: {themeColor}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Informações adicionais */}
                  <div className="pt-4 border-t border-border">
                    <div className="bg-muted/30 rounded-lg p-3 sm:p-4">
                      <p className="text-xs sm:text-sm text-muted-foreground text-center">
                        A cor selecionada será aplicada em todo o sistema, funcionando tanto no modo claro quanto no modo escuro.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="mt-4 sm:mt-6 pt-4 border-t border-border flex items-center justify-end gap-2 sm:gap-3">
                  <button
                    onClick={() => setIsOpen(false)}
                    className="px-3 sm:px-4 py-2 rounded-lg bg-muted text-foreground hover:bg-muted/80 transition-colors text-sm sm:text-base"
                  >
                    Fechar
                  </button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
