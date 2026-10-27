import { Clock3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PROSPECTIVE_LOADING_DESCRIPTION } from './prospective-loading'

/** Visual metadata only: never participates in rates, dates or project colours. */
export function ProspectiveLoadingBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span
      role="img"
      aria-label={`Перспектива. ${PROSPECTIVE_LOADING_DESCRIPTION}`}
      title={PROSPECTIVE_LOADING_DESCRIPTION}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-sm bg-amber-100 text-amber-950 font-semibold',
        compact ? 'h-3 w-3' : 'h-4 w-[82px] text-[10px] leading-none',
      )}
    >
      {compact ? <Clock3 size={10} aria-hidden="true" /> : 'Перспектива'}
    </span>
  )
}
