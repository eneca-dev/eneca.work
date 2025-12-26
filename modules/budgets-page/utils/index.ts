/**
 * Budgets Page Utilities
 */

/**
 * Форматирует сумму в короткий формат
 * 1500000 → "1.5M"
 * 150000 → "150K"
 * 1500 → "1.5K"
 * 999 → "999"
 */
export function formatAmount(amount: number): string {
  if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(1).replace('.0', '')}M`
  }
  if (amount >= 1_000) {
    return `${(amount / 1_000).toFixed(1).replace('.0', '')}K`
  }
  return amount.toFixed(0)
}
