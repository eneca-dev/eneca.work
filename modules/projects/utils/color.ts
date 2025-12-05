/**
 * Вычисляет контрастный цвет текста (чёрный или белый) на основе яркости фона.
 * Использует формулу относительной яркости WCAG с пониженным порогом
 * для лучшей читаемости на насыщенных цветах (жёлтый, серый и т.д.).
 */
export function getContrastColor(hexColor: string): string {
  // Убираем # если есть
  let hex = hexColor.replace('#', '')

  // Поддержка сокращённого формата (#RGB -> #RRGGBB)
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
  }

  // Парсим RGB компоненты
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)

  // Вычисляем относительную яркость (формула WCAG)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255

  // Порог 0.75 — белый текст для большинства цветов,
  // чёрный только для очень светлых (пастельных) фонов
  return luminance > 0.75 ? '#000000' : '#ffffff'
}
