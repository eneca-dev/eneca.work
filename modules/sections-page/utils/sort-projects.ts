/**
 * Утилиты сортировки проектов по нумерации ГУП
 *
 * Формат имени проекта: "<номер_ГУП>-<префикс>-<...>"
 * Примеры: "1-П-47/25-ОВ ...", "9-PUZ-04/25-РП ...", "12-П-66/24-С ..."
 *
 * Не-проектные сущности ("Отпуск", "Прочие работы", "Потенциальные проекты"
 * и т.п.) не имеют ГУП-префикса и сортируются после проектов с ГУП.
 */

const GUP_PREFIX_REGEX = /^(\d+)-/

function getGupNumber(name: string): number | null {
  const match = name.match(GUP_PREFIX_REGEX)
  return match ? parseInt(match[1], 10) : null
}

/**
 * Сортировка проектов:
 * 1. Сначала проекты с ГУП-префиксом, по возрастанию номера ГУП
 * 2. Внутри одного ГУП — по алфавиту (русская локаль)
 * 3. Проекты без ГУП-префикса — в конце, по алфавиту
 */
export function compareProjectsByGup(
  a: { name: string },
  b: { name: string }
): number {
  const gupA = getGupNumber(a.name)
  const gupB = getGupNumber(b.name)

  if (gupA !== null && gupB !== null) {
    if (gupA !== gupB) return gupA - gupB
    return a.name.localeCompare(b.name, 'ru')
  }

  if (gupA !== null) return -1
  if (gupB !== null) return 1

  return a.name.localeCompare(b.name, 'ru')
}

/**
 * Сортировка проектов: сначала проекты с загрузками, затем без — внутри
 * каждой группы сохраняется обычный порядок по ГУП-нумерации.
 */
export function compareProjectsByLoadingsThenGup(
  a: { name: string; totalLoadings?: number },
  b: { name: string; totalLoadings?: number }
): number {
  const aHas = (a.totalLoadings ?? 0) > 0
  const bHas = (b.totalLoadings ?? 0) > 0
  if (aHas !== bHas) return aHas ? -1 : 1
  return compareProjectsByGup(a, b)
}

/**
 * Сортировка разделов внутри проекта: сначала разделы с загрузками,
 * затем без — внутри каждой группы по алфавиту (русская локаль).
 */
export function compareSectionsByLoadings(
  a: { name: string; totalLoadings?: number },
  b: { name: string; totalLoadings?: number }
): number {
  const aHas = (a.totalLoadings ?? 0) > 0
  const bHas = (b.totalLoadings ?? 0) > 0
  if (aHas !== bHas) return aHas ? -1 : 1
  return a.name.localeCompare(b.name, 'ru')
}
