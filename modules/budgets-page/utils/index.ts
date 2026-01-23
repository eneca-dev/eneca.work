/**
 * Budgets Page Utilities
 */

// Optimistic Updates
export {
  saveOptimisticSnapshot,
  rollbackOptimisticUpdate,
  updateHierarchyNode,
  removeHierarchyNode,
  addChildToParent,
  createOptimisticBudget,
  createOptimisticStage,
  createOptimisticItem,
  invalidateHierarchyCache,
} from './optimistic-updates'

export type { OptimisticSnapshot } from './optimistic-updates'

// Format Helpers

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

/**
 * Парсит введённую строку в число (поддержка пробелов, запятых)
 */
export function parseAmount(value: string): number {
  const cleaned = value.replace(/\s/g, '').replace(',', '.')
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}

/**
 * Форматирует число с разделителями тысяч
 * По умолчанию 2 знака после запятой для денежных сумм
 */
export function formatNumber(value: number, decimals: number = 2): string {
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

/**
 * Рассчитывает процент от родителя (с одним знаком после запятой)
 */
export function calculatePercentage(amount: number, parentAmount: number): number {
  if (parentAmount <= 0) return 0
  return Math.round((amount / parentAmount) * 100 * 10) / 10
}

/**
 * Рассчитывает сумму от процента (с округлением до 2 знаков)
 */
export function calculateAmount(percentage: number, parentAmount: number): number {
  if (parentAmount <= 0) return 0
  return Math.round((percentage / 100) * parentAmount * 100) / 100
}
