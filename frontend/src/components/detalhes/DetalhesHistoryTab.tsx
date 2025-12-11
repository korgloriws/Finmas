import { motion } from 'framer-motion'
import { 
  FileText, 
  Building2, 
  Target, 
  Globe, 
  Users, 
  ExternalLink,
  MapPin,
  Phone
} from 'lucide-react'

// Componente para linha de informação (versão elegante)
function InfoRow({ 
  label, 
  value, 
  icon: Icon 
}: {
  label: string
  value: string | number | null | undefined
  icon: any
}) {
  if (!value || value === '-') return null

  return (
    <div className="flex items-start gap-3 py-2 border-b border-border/30 last:border-0">
      <div className="flex-shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-primary/60" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-muted-foreground mb-1">{label}</div>
        <div className="text-sm text-foreground/90">
          {typeof value === 'string' && value.startsWith('http') ? (
            <a 
              href={value} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline flex items-center gap-1 inline-flex"
              title="Abrir link"
            >
              <span>Visitar Website</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          ) : (
            value
          )}
        </div>
      </div>
    </div>
  )
}

interface DetalhesHistoryTabProps {
  info: any
}

export default function DetalhesHistoryTab({
  info
}: DetalhesHistoryTabProps) {
  const businessSummary = info.longBusinessSummary && String(info.longBusinessSummary).trim()
    ? String(info.longBusinessSummary)
    : null

  const enderecoCompleto = [
    info.address1, 
    info.address2, 
    info.city, 
    info.state, 
    info.zip, 
    info.country
  ].filter(Boolean).join(', ') || null

  return (
    <motion.div
      key="history"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* História da Empresa - Estilo Carta/Caderno */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="relative"
      >
        {/* Card principal */}
        <div className="relative bg-card border border-border rounded-xl sm:rounded-2xl shadow-lg overflow-hidden">
          {/* Linhas de pauta de caderno (marca d'água) */}
          <div 
            className="absolute inset-0 pointer-events-none opacity-20 dark:opacity-10"
            style={{
              backgroundImage: `
                repeating-linear-gradient(
                  transparent,
                  transparent 24px,
                  var(--border) 24px,
                  var(--border) 25px
                )
              `,
              backgroundPosition: '0 0',
              backgroundSize: '100% 25px'
            }}
          />

          {/* Conteúdo */}
          <div className="relative z-10 p-6 sm:p-8 md:p-10">
            {/* Cabeçalho */}
            <div className="mb-8 pb-6 border-b border-border">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-foreground">
                    {info.longName || info.shortName || 'História da Empresa'}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {info.sector && info.industry ? `${info.sector} • ${info.industry}` : info.sector || info.industry || ''}
                  </p>
                </div>
              </div>
            </div>

            {/* Texto da história em duas colunas */}
            {businessSummary ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
                {(() => {
                  // Dividir o texto em parágrafos menores para melhor leitura
                  const paragraphs = businessSummary
                    .split(/\n\n+/) // Dividir por quebras duplas
                    .map(p => p.trim())
                    .filter(p => p.length > 0)
                    .flatMap(paragraph => {
                      // Se o parágrafo for muito longo (> 500 caracteres), dividir em sentenças
                      if (paragraph.length > 500) {
                        return paragraph
                          .split(/[.!?]+\s+/) // Dividir por pontuação
                          .map(s => s.trim())
                          .filter(s => s.length > 0)
                          .reduce((acc: string[], sentence: string) => {
                            // Agrupar sentenças em blocos de ~250 caracteres para duas colunas
                            if (acc.length === 0 || acc[acc.length - 1].length + sentence.length > 250) {
                              acc.push(sentence)
                            } else {
                              acc[acc.length - 1] += '. ' + sentence
                            }
                            return acc
                          }, [])
                      }
                      return [paragraph]
                    })

                  // Dividir parágrafos em duas colunas (meio a meio)
                  const midPoint = Math.ceil(paragraphs.length / 2)
                  const coluna1 = paragraphs.slice(0, midPoint)
                  const coluna2 = paragraphs.slice(midPoint)

                  return (
                    <>
                      {/* Coluna 1 */}
                      <div className="space-y-5">
                        {coluna1.map((paragraph: string, index: number) => (
                          <motion.p
                            key={`col1-${index}`}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: 0.2 + index * 0.05 }}
                            className="text-base sm:text-lg leading-relaxed text-foreground/90"
                            style={{
                              textAlign: 'justify',
                              hyphens: 'auto',
                              wordBreak: 'break-word'
                            }}
                          >
                            {paragraph}
                          </motion.p>
                        ))}
                      </div>

                      {/* Coluna 2 */}
                      <div className="space-y-5">
                        {coluna2.map((paragraph: string, index: number) => (
                          <motion.p
                            key={`col2-${index}`}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: 0.2 + (midPoint + index) * 0.05 }}
                            className="text-base sm:text-lg leading-relaxed text-foreground/90"
                            style={{
                              textAlign: 'justify',
                              hyphens: 'auto',
                              wordBreak: 'break-word'
                            }}
                          >
                            {paragraph}
                          </motion.p>
                        ))}
                      </div>
                    </>
                  )
                })()}
              </div>
            ) : (
              <div className="text-center py-12">
                <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
                <p className="text-muted-foreground italic">História da empresa não disponível no momento.</p>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Informações de Contato - Estilo Elegante */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
        {/* Informações Corporativas */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-lg">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border">
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">Informações Corporativas</h3>
          </div>
          <div className="space-y-1">
            <InfoRow label="Setor" value={info.sector} icon={Target} />
            <InfoRow label="Indústria" value={info.industry} icon={Building2} />
            <InfoRow label="País" value={info.country} icon={Globe} />
            <InfoRow label="Funcionários" value={info.fullTimeEmployees?.toLocaleString('pt-BR')} icon={Users} />
          </div>
        </div>

        {/* Contato e Localização */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-lg">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border">
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
              <MapPin className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">Contato e Localização</h3>
          </div>
          <div className="space-y-1">
            <InfoRow label="Endereço" value={enderecoCompleto} icon={MapPin} />
            <InfoRow label="Cidade" value={info.city} icon={MapPin} />
            <InfoRow label="Estado" value={info.state} icon={MapPin} />
            <InfoRow label="CEP" value={info.zip} icon={MapPin} />
            <InfoRow label="Telefone" value={info.phone} icon={Phone} />
            <InfoRow label="Fax" value={info.fax} icon={Phone} />
            <InfoRow label="Website" value={info.website} icon={ExternalLink} />
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
