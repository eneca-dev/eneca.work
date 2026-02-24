'use client'

import { getProgressColor } from '../../../utils'

// ============================================================================
// Progress Circle Component
// ============================================================================

interface ProgressCircleProps {
  /** Процент готовности (0-100) или перерасход (>100) */
  progress: number
  /** Размер круга в пикселях */
  size?: number
  /** Толщина линии */
  strokeWidth?: number
  /** Цвет прогресса (по умолчанию автоматический на основе значения) */
  color?: string
  /** Показывать галочку при 100% (для бюджетов) */
  showCheckmarkAt100?: boolean
}

/**
 * Круговой индикатор прогресса с процентом внутри
 * При 100% показывает зелёную галочку (если showCheckmarkAt100=true)
 * При >100% показывает красный круг с процентом (перерасход)
 */
export function ProgressCircle({
  progress,
  size = 24,
  strokeWidth = 2.5,
  color,
  showCheckmarkAt100 = false,
}: ProgressCircleProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const roundedProgress = Math.round(progress)

  // Точно 100% - зелёная галочка (только для бюджетов)
  const isExactly100 = roundedProgress === 100 && showCheckmarkAt100
  // Перерасход >100% - красный круг с процентом
  const isOverBudget = roundedProgress > 100

  // При перерасходе >100% показываем красный прогресс-круг с процентом
  if (isOverBudget) {
    const overBudgetColor = '#ef4444' // red-500
    // Увеличиваем размер для трёхзначных чисел
    const overBudgetSize = size * 1.5
    const overBudgetRadius = (overBudgetSize - strokeWidth) / 2
    const overBudgetCircumference = 2 * Math.PI * overBudgetRadius

    return (
      <div className="relative shrink-0" style={{ width: overBudgetSize, height: overBudgetSize }} title={`Перерасход: ${roundedProgress}%`}>
        <svg
          width={overBudgetSize}
          height={overBudgetSize}
          className="transform -rotate-90"
        >
          {/* Background circle */}
          <circle
            cx={overBudgetSize / 2}
            cy={overBudgetSize / 2}
            r={overBudgetRadius}
            fill="transparent"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-white/10"
          />
          {/* Full progress circle (красная обводка на 100%) */}
          <circle
            cx={overBudgetSize / 2}
            cy={overBudgetSize / 2}
            r={overBudgetRadius}
            fill="transparent"
            stroke={overBudgetColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={overBudgetCircumference}
            strokeDashoffset={0}
            className="transition-all duration-300"
          />
        </svg>
        {/* Percentage text */}
        <span
          className="absolute inset-0 flex items-center justify-center text-[10px] font-bold tabular-nums"
          style={{ color: overBudgetColor }}
        >
          {roundedProgress}
        </span>
      </div>
    )
  }

  // При точно 100% показываем зелёную галочку
  if (isExactly100) {
    return (
      <div
        className="relative shrink-0 flex items-center justify-center rounded-full opacity-60 hover:opacity-90 transition-opacity"
        style={{
          width: size,
          height: size,
          backgroundColor: '#22c55e40', // green-500 с 25% opacity
          border: '1px solid #22c55e60',
        }}
        title="Распределено 100%"
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

  // При <100% показываем обычный круг прогресса
  const progressColor = color || getProgressColor(progress)
  const strokeDashoffset = circumference - (Math.min(progress, 100) / 100) * circumference

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
        {roundedProgress}
      </span>
    </div>
  )
}
