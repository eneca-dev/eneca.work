import type { LucideIcon } from 'lucide-react'
import * as LucideIcons from 'lucide-react'

/**
 * Получить компонент иконки по имени
 * @param iconName - Название иконки из Lucide (например, 'Flag', 'Calendar')
 * @returns Компонент иконки или undefined
 */
export function getIconComponent(iconName: string): LucideIcon | undefined {
  return (LucideIcons as unknown as Record<string, LucideIcon>)[iconName]
}

/**
 * Проверить, существует ли иконка с таким названием
 * @param iconName - Название иконки
 * @returns true если иконка существует
 */
export function isValidIcon(iconName: string): boolean {
  return !!getIconComponent(iconName)
}

/**
 * Получить иконку с fallback
 * @param iconName - Название иконки
 * @param fallbackName - Fallback иконка (по умолчанию 'Flag')
 * @returns Компонент иконки (гарантированно не undefined)
 */
export function getIconWithFallback(
  iconName: string | null | undefined,
  fallbackName: string = 'Flag'
): LucideIcon {
  const icon = iconName ? getIconComponent(iconName) : undefined
  if (icon) return icon

  const fallback = getIconComponent(fallbackName)
  if (fallback) return fallback

  // Последний fallback - Flag
  return (LucideIcons as unknown as Record<string, LucideIcon>)['Flag']
}
