/**
 * Склонение слова "раздел" в зависимости от числа
 * @param count - количество разделов
 * @returns правильная форма слова ("раздел", "раздела" или "разделов")
 *
 * Примеры:
 * - 1, 21, 31, 41... → "раздел"
 * - 2-4, 22-24, 32-34... → "раздела"
 * - 5-20, 25-30, 35-40... → "разделов"
 * - 11-14 → "разделов" (исключение)
 */
export function pluralizeSections(count: number): string {
  const lastDigit = count % 10
  const lastTwoDigits = count % 100

  // Исключения для 11-14 (всегда "разделов")
  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return 'разделов'
  }

  // 1, 21, 31, 41... → "раздел"
  if (lastDigit === 1) {
    return 'раздел'
  }

  // 2-4, 22-24, 32-34... → "раздела"
  if (lastDigit >= 2 && lastDigit <= 4) {
    return 'раздела'
  }

  // 5-20, 25-30, 35-40... → "разделов"
  return 'разделов'
}

/**
 * Склонение слова "этап" в зависимости от числа
 * @param count - количество этапов
 * @returns правильная форма слова ("этап", "этапа" или "этапов")
 *
 * Примеры:
 * - 1, 21, 31, 41... → "этап"
 * - 2-4, 22-24, 32-34... → "этапа"
 * - 5-20, 25-30, 35-40... → "этапов"
 * - 11-14 → "этапов" (исключение)
 */
export function pluralizeStages(count: number): string {
  const lastDigit = count % 10
  const lastTwoDigits = count % 100

  // Исключения для 11-14 (всегда "этапов")
  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return 'этапов'
  }

  // 1, 21, 31, 41... → "этап"
  if (lastDigit === 1) {
    return 'этап'
  }

  // 2-4, 22-24, 32-34... → "этапа"
  if (lastDigit >= 2 && lastDigit <= 4) {
    return 'этапа'
  }

  // 5-20, 25-30, 35-40... → "этапов"
  return 'этапов'
}

/**
 * Склонение слова "задача" в винительном падеже в зависимости от числа
 * @param count - количество задач
 * @returns правильная форма слова ("задачу", "задачи" или "задач")
 *
 * Примеры:
 * - 1, 21, 31, 41... → "задачу"
 * - 2-4, 22-24, 32-34... → "задачи"
 * - 5-20, 25-30, 35-40... → "задач"
 * - 11-14 → "задач" (исключение)
 */
export function pluralizeTasks(count: number): string {
  const lastDigit = count % 10
  const lastTwoDigits = count % 100

  // Исключения для 11-14 (всегда "задач")
  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return 'задач'
  }

  // 1, 21, 31, 41... → "задачу"
  if (lastDigit === 1) {
    return 'задачу'
  }

  // 2-4, 22-24, 32-34... → "задачи"
  if (lastDigit >= 2 && lastDigit <= 4) {
    return 'задачи'
  }

  // 5-20, 25-30, 35-40... → "задач"
  return 'задач'
}

/**
 * Склонение слова "час" в зависимости от числа
 * @param count - количество часов
 * @returns правильная форма слова ("час", "часа" или "часов")
 *
 * Примеры:
 * - 1, 21, 31, 41... → "час"
 * - 2-4, 22-24, 32-34... → "часа"
 * - 5-20, 25-30, 35-40... → "часов"
 * - 11-14 → "часов" (исключение)
 */
export function pluralizeHours(count: number): string {
  const lastDigit = Math.floor(Math.abs(count)) % 10
  const lastTwoDigits = Math.floor(Math.abs(count)) % 100

  // Исключения для 11-14 (всегда "часов")
  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return 'часов'
  }

  // 1, 21, 31, 41... → "час"
  if (lastDigit === 1) {
    return 'час'
  }

  // 2-4, 22-24, 32-34... → "часа"
  if (lastDigit >= 2 && lastDigit <= 4) {
    return 'часа'
  }

  // 5-20, 25-30, 35-40... → "часов"
  return 'часов'
}

/**
 * Склонение слова "отчёт" в зависимости от числа
 * @param count - количество отчётов
 * @returns правильная форма слова ("отчёт", "отчёта" или "отчётов")
 *
 * Примеры:
 * - 1, 21, 31, 41... → "отчёт"
 * - 2-4, 22-24, 32-34... → "отчёта"
 * - 5-20, 25-30, 35-40... → "отчётов"
 * - 11-14 → "отчётов" (исключение)
 */
export function pluralizeReports(count: number): string {
  const lastDigit = count % 10
  const lastTwoDigits = count % 100

  // Исключения для 11-14 (всегда "отчётов")
  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return 'отчётов'
  }

  // 1, 21, 31, 41... → "отчёт"
  if (lastDigit === 1) {
    return 'отчёт'
  }

  // 2-4, 22-24, 32-34... → "отчёта"
  if (lastDigit >= 2 && lastDigit <= 4) {
    return 'отчёта'
  }

  // 5-20, 25-30, 35-40... → "отчётов"
  return 'отчётов'
}
