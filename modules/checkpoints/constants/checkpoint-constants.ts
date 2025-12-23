/**
 * Константы для отображения чекпоинтов на графике
 */

/** Радиус маркера чекпоинта (увеличен для размещения иконок) */
export const MARKER_RADIUS = 8

/** Смещение по X для чекпоинтов на одну и ту же дату */
export const OVERLAP_OFFSET_X = 6

/**
 * Вычислить смещение по X для чекпоинта с учётом overlap
 * @param overlapIndex - Индекс чекпоинта среди overlap (0-based)
 * @param overlapTotal - Общее количество чекпоинтов на эту дату
 * @returns Смещение по X в пикселях
 */
export function calculateOverlapOffset(overlapIndex: number, overlapTotal: number): number {
  if (overlapTotal <= 1) return 0
  const offsetMultiplier = overlapIndex - (overlapTotal - 1) / 2
  return offsetMultiplier * OVERLAP_OFFSET_X
}
