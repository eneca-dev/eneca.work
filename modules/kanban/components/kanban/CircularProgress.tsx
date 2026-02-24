'use client'

import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

// ============================================================================
// Variants Configuration
// ============================================================================

type CircularProgressVariant = 'task' | 'compact' | 'swimlane'

const variantConfig = {
  task: {
    radius: 10,
    size: 'w-6 h-6',
    strokeWidth: 2,
    center: 12,
    fontSize: 'text-[7px]',
    colored: true,
  },
  compact: {
    radius: 12,
    size: 'w-7 h-7',
    strokeWidth: 2.5,
    center: 14,
    fontSize: 'text-[8px]',
    colored: true,
  },
  swimlane: {
    radius: 16,
    size: 'w-10 h-10',
    strokeWidth: 2.5,
    center: 20,
    fontSize: 'text-[10px]',
    colored: false, // neutral style
  },
}

// ============================================================================
// Component
// ============================================================================

interface CircularProgressProps {
  /** Progress value 0-100 */
  progress: number
  /** Size variant */
  variant?: CircularProgressVariant
  /** Tooltip content (optional) */
  tooltip?: React.ReactNode
  /** Click handler (optional) */
  onClick?: (e: React.MouseEvent) => void
  /** Additional className */
  className?: string
}

/**
 * Unified circular progress indicator for kanban module
 *
 * Variants:
 * - task: Small (24px) for task rows, colored
 * - compact: Medium (28px) for card headers, colored with tooltip
 * - swimlane: Large (40px) for swimlane headers, neutral color
 */
export function CircularProgress({
  progress,
  variant = 'compact',
  tooltip,
  onClick,
  className,
}: CircularProgressProps) {
  const config = variantConfig[variant]
  const circumference = 2 * Math.PI * config.radius
  const strokeDashoffset = circumference - (progress / 100) * circumference

  const getProgressColor = () => {
    if (!config.colored) {
      return 'text-foreground/60'
    }
    if (progress === 100) return 'text-emerald-500'
    if (progress > 50) return 'text-primary'
    if (progress > 0) return 'text-amber-500'
    return 'text-muted-foreground/30'
  }

  const circle = (
    <div
      className={cn(
        'relative inline-flex items-center justify-center',
        config.colored ? 'cursor-help' : '',
        onClick && 'cursor-pointer hover:underline',
        className
      )}
      onClick={onClick}
    >
      <svg className={cn(config.size, '-rotate-90')}>
        {/* Background circle */}
        <circle
          cx={config.center}
          cy={config.center}
          r={config.radius}
          stroke="currentColor"
          strokeWidth={config.strokeWidth}
          fill="none"
          className={config.colored ? 'text-muted' : 'text-border'}
        />
        {/* Progress circle */}
        <circle
          cx={config.center}
          cy={config.center}
          r={config.radius}
          stroke="currentColor"
          strokeWidth={config.strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className={cn('transition-all duration-500', getProgressColor())}
          strokeLinecap="round"
        />
      </svg>
      {/* Percentage text */}
      <span
        className={cn(
          'absolute font-medium pointer-events-none',
          config.fontSize,
          config.colored ? 'text-foreground' : 'text-muted-foreground'
        )}
      >
        {progress}%
      </span>
    </div>
  )

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{circle}</TooltipTrigger>
          <TooltipContent className="max-w-[300px]">{tooltip}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return circle
}
