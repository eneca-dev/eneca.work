"use client"

import { cn } from "@/lib/utils"

interface CircularProgressProps {
  progress: number
  size?: number
  strokeWidth?: number
  theme: string
}

export function CircularProgress({
  progress,
  size = 24,
  strokeWidth = 3,
  theme
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (progress / 100) * circumference

  const getProgressColor = () => {
    if (progress >= 100) return "stroke-green-500"
    if (progress >= 50) return "stroke-teal-500"
    if (progress > 0) return "stroke-blue-500"
    return theme === "dark" ? "stroke-slate-600" : "stroke-slate-300"
  }

  return (
    <svg
      width={size}
      height={size}
      className="transform -rotate-90 flex-shrink-0"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className={cn(theme === "dark" ? "text-slate-700" : "text-slate-200")}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className={cn(getProgressColor(), "transition-all duration-500")}
      />
    </svg>
  )
}
