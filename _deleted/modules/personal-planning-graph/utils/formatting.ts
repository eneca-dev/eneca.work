import { format, parseISO } from "date-fns"
import { ru } from "date-fns/locale"

// Format date for display
export function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—"
  return format(parseISO(dateStr), "d MMM", { locale: ru })
}

// Format budget amount (e.g., 185000 -> "185 000 ₽")
export function formatBudget(amount: number): string {
  return amount.toLocaleString("ru-RU") + " ₽"
}
