import { Banknote, Award } from "lucide-react"
import type { BudgetType } from "../types"

export interface BudgetConfig {
  label: string
  icon: typeof Banknote
  colorClass: string
  bgClass: string
}

export const budgetConfig: Record<BudgetType, BudgetConfig> = {
  main: {
    label: "Основной",
    icon: Banknote,
    colorClass: "text-emerald-500",
    bgClass: "bg-emerald-500/20",
  },
  premium: {
    label: "Премиальный",
    icon: Award,
    colorClass: "text-amber-500",
    bgClass: "bg-amber-500/20",
  },
}
