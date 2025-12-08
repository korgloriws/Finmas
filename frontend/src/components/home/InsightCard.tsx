import { motion } from 'framer-motion'

interface InsightCardProps {
  title: string
  message: string
  type?: 'success' | 'warning' | 'info'
  icon: any
  delay?: number
}

export default function InsightCard({ 
  title, 
  message, 
  type = 'info',
  icon: Icon,
  delay = 0
}: InsightCardProps) {
  const colors = {
    success: {
      bg: 'bg-primary/5',
      border: 'border-primary/20',
      iconBg: 'bg-primary/10',
      iconColor: 'text-primary',
      titleColor: 'text-foreground',
      messageColor: 'text-muted-foreground'
    },
    warning: {
      bg: 'bg-destructive/5',
      border: 'border-destructive/20',
      iconBg: 'bg-destructive/10',
      iconColor: 'text-destructive',
      titleColor: 'text-foreground',
      messageColor: 'text-muted-foreground'
    },
    info: {
      bg: 'bg-primary/5',
      border: 'border-primary/20',
      iconBg: 'bg-primary/10',
      iconColor: 'text-primary',
      titleColor: 'text-foreground',
      messageColor: 'text-muted-foreground'
    }
  }
  const color = colors[type]
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      whileHover={{ scale: 1.02 }}
      className={`p-3 sm:p-4 ${color.bg} rounded-lg sm:rounded-xl border ${color.border} hover:shadow-lg transition-all duration-200`}
    >
      <div className="flex items-start gap-2 sm:gap-3">
        <div className={`p-1.5 sm:p-2 rounded-md sm:rounded-lg ${color.iconBg} flex-shrink-0`}>
          <Icon className={`w-3 h-3 sm:w-4 sm:h-4 ${color.iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className={`font-semibold ${color.titleColor} mb-1 sm:mb-2 text-sm sm:text-base leading-tight`}>{title}</h3>
          <p className={`text-xs sm:text-sm ${color.messageColor} leading-relaxed`}>{message}</p>
        </div>
      </div>
    </motion.div>
  )
}

