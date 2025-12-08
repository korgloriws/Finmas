import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowUpRight, ArrowDownRight } from 'lucide-react'

interface CardPrincipalProps {
  title: string
  value: string
  subtitle?: string
  icon: any
  to: string
  trend?: { value: number; isPositive: boolean }
  loading?: boolean
  delay?: number
}

export default function CardPrincipal({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  to, 
  trend,
  loading = false,
  delay = 0
}: CardPrincipalProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <Link to={to} className="block touch-manipulation">
        <div className="relative overflow-hidden bg-card border border-border rounded-xl sm:rounded-2xl p-3 sm:p-4 hover:shadow-lg sm:hover:shadow-2xl transition-all duration-300 cursor-pointer min-h-[100px] sm:min-h-[120px] touch-manipulation">
          {/* Background pattern */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
          <div className="relative z-10 h-full flex flex-col">
            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <div className="p-1.5 sm:p-2 rounded-md sm:rounded-lg bg-primary text-primary-foreground shadow-lg">
                <Icon className="w-3 h-3 sm:w-4 sm:h-4" />
              </div>
              {trend && !loading && (
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.5 }}
                  className={`flex items-center gap-1 px-2 sm:px-2 py-1 rounded-full text-xs font-semibold ${
                    trend.isPositive 
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  }`}
                >
                  {trend.isPositive ? <ArrowUpRight size={10} className="sm:w-3 sm:h-3" /> : <ArrowDownRight size={10} className="sm:w-3 sm:h-3" />}
                  <span className="hidden xs:inline">{trend.value}%</span>
                </motion.div>
              )}
            </div>
            
            <div className="space-y-1 flex-1">
              <h3 className="text-sm sm:text-base font-semibold text-foreground leading-tight">{title}</h3>
              {loading ? (
                <div className="animate-pulse">
                  <div className="h-4 sm:h-6 bg-muted rounded w-16 sm:w-24"></div>
                </div>
              ) : (
                <p className="text-lg sm:text-xl font-bold text-foreground leading-tight">{value}</p>
              )}
              {subtitle && <p className="text-xs sm:text-sm text-muted-foreground leading-tight">{subtitle}</p>}
            </div>
            
            <div className="mt-2 sm:mt-3 flex items-center text-xs text-muted-foreground">
              <span>Ver detalhes</span>
              <ArrowUpRight className="w-3 h-3 sm:w-3 sm:h-3 ml-1 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

