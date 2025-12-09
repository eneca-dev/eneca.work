/**
 * Парсит hex цвет в RGB компоненты
 */
function parseHex(hexColor: string): { r: number; g: number; b: number } {
  let hex = hexColor.replace('#', '')
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
  }
  return {
    r: parseInt(hex.substring(0, 2), 16),
    g: parseInt(hex.substring(2, 4), 16),
    b: parseInt(hex.substring(4, 6), 16),
  }
}

/**
 * Конвертирует RGB в hex
 */
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = Math.round(Math.max(0, Math.min(255, x))).toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }).join('')
}

/**
 * Вычисляет яркость цвета (0-1)
 */
function getLuminance(hexColor: string): number {
  const { r, g, b } = parseHex(hexColor)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

/**
 * Осветляет цвет для тёмной темы, чтобы обеспечить читаемость.
 * Тёмные цвета осветляются сильнее, светлые — меньше или не меняются.
 */
export function getAdaptiveTagColor(hexColor: string, isDark: boolean): string {
  if (!isDark) return hexColor

  const { r, g, b } = parseHex(hexColor)
  const luminance = getLuminance(hexColor)

  // Если цвет уже достаточно светлый, не меняем
  if (luminance > 0.5) return hexColor

  // Для тёмных цветов увеличиваем яркость
  // Чем темнее цвет, тем сильнее осветляем
  const factor = 1 + (0.5 - luminance) * 1.2

  return rgbToHex(
    r * factor + 60,
    g * factor + 60,
    b * factor + 60
  )
}

/**
 * Возвращает адаптивные стили для тега в зависимости от темы.
 * В тёмной теме тёмные цвета осветляются для читаемости.
 */
export function getTagStyles(color: string, isDark: boolean) {
  const adaptedColor = getAdaptiveTagColor(color, isDark)

  return {
    backgroundColor: `${adaptedColor}15`,
    borderColor: `${adaptedColor}40`,
    color: adaptedColor,
    stripeColor: adaptedColor,
  }
}

/**
 * Вычисляет контрастный цвет текста (чёрный или белый) на основе яркости фона.
 * Использует формулу относительной яркости WCAG с пониженным порогом
 * для лучшей читаемости на насыщенных цветах (жёлтый, серый и т.д.).
 */
export function getContrastColor(hexColor: string): string {
  const luminance = getLuminance(hexColor)
  // Порог 0.75 — белый текст для большинства цветов,
  // чёрный только для очень светлых (пастельных) фонов
  return luminance > 0.75 ? '#000000' : '#ffffff'
}
