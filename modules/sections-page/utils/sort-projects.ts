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

interface ProjectActuality {
  name: string
  hasActiveLoadingNow?: boolean
  nearestFutureLoadingStart?: string | null
  mostRecentPastLoadingFinish?: string | null
}

/**
 * Служебные "проекты"-корзины для непроектных активностей — не привязаны к
 * реальным работам и должны всегда лежать в самом низу активного списка
 * (но выше свёрнутой группы «Завершённые»), независимо от актуальности их
 * загрузок. Сравнение без учёта регистра и пробелов по краям — устойчиво
 * к мелкому дрейфу форматирования названия, но не "нечёткое": другое
 * название (например, «Потенциальные проекты») сюда не попадёт.
 */
const SPECIAL_PROJECT_NAMES = new Set(['отпуск', 'прочие работы', 'непроектные загрузки'])

function isSpecialProject(name: string): boolean {
  return SPECIAL_PROJECT_NAMES.has(name.trim().toLowerCase())
}

function actualityTier(p: ProjectActuality): 0 | 1 | 2 | 3 | 4 {
  if (isSpecialProject(p.name)) return 4
  if (p.hasActiveLoadingNow) return 0
  if (p.nearestFutureLoadingStart) return 1
  if (p.mostRecentPastLoadingFinish) return 2
  return 3
}

/**
 * Сортировка проектов по актуальности загрузок:
 * 0. Есть загрузка, идущая прямо сейчас — выше всех
 * 1. Нет текущей, но есть будущая — по возрастанию даты начала (скоро = выше)
 * 2. Нет текущей и будущей, но была прошедшая — по убыванию даты окончания (недавно = выше)
 * 3. Загрузок нет вообще
 * 4. Служебные "проекты" (Отпуск, Прочие работы, Непроектные загрузки) — всегда в самом низу
 * Внутри одного уровня — по ГУП-нумерации.
 */
export function compareProjectsByActuality(a: ProjectActuality, b: ProjectActuality): number {
  const tierA = actualityTier(a)
  const tierB = actualityTier(b)
  if (tierA !== tierB) return tierA - tierB

  if (tierA === 1) {
    return a.nearestFutureLoadingStart!.localeCompare(b.nearestFutureLoadingStart!)
  }
  if (tierA === 2) {
    return b.mostRecentPastLoadingFinish!.localeCompare(a.mostRecentPastLoadingFinish!)
  }
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
