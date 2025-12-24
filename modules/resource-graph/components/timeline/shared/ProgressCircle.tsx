'use client'

import { getProgressColor } from '../../../utils'

// ============================================================================
// Progress Circle Component
// ============================================================================

interface ProgressCircleProps {
  /** Процент готовности (0-100) */
  progress: number
  /** Размер круга в пикселях */
  size?: number
  /** Толщина линии */
  strokeWidth?: number
  /** Цвет прогресса (по умолчанию автоматический на основе значения) */
  color?: string
}

/**
 * Круговой индикатор прогресса с процентом внутри
 * При 100% показывает зелёный круг с галочкой
 */
export function ProgressCircle({
  progress,
  size = 24,
  strokeWidth = 2.5,
  color,
}: ProgressCircleProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (progress / 100) * circumference

  // Цвет на основе прогресса
  const progressColor = color || getProgressColor(progress)
  const isComplete = Math.round(progress) >= 100

  // При 100% показываем галочку того же размера что и круг прогресса
  if (isComplete) {
    return (
      <div
        className="relative shrink-0 flex items-center justify-center rounded-full opacity-60 hover:opacity-90 transition-opacity"
        style={{
          width: size,
          height: size,
          backgroundColor: '#22c55e40', // green-500 с 25% opacity
          border: '1px solid #22c55e60',
        }}
      >
        <svg
          width={size * 0.5}
          height={size * 0.5}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#22c55e"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
    )
  }

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-white/10"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke={progressColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-300"
        />
      </svg>
      {/* Percentage text */}
      <span
        className="absolute inset-0 flex items-center justify-center text-[8px] font-medium tabular-nums"
        style={{ color: progressColor }}
      >
        {Math.round(progress)}
      </span>
    </div>
  )
}
