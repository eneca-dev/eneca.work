const numberFormat = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 6 })

export function getCapacityExplanation(scope: 'команды' | 'отдела'): string {
  return `Доступная мощность ${scope} на сегодня. Сотрудники без назначенных загрузок тоже учитываются. Для прошлых дат используется исторический состав.`
}

/** Describe the values already used by the cell; do not calculate a second percentage. */
export function getDailyWorkloadExplanation(
  date: string,
  workload: number,
  capacity: number,
  displayedPercentage: number,
  isNonWorkingDay: boolean,
): string {
  const label = date.split('-').reverse().join('.')
  const work = numberFormat.format(workload)
  const available = numberFormat.format(capacity)
  const details = `Назначено работы: ${work}\nДоступная мощность: ${available}`

  if (isNonWorkingDay) return `${label}\nНерабочий день: процент загрузки не рассчитывается.\n${details}`
  if (!Number.isFinite(capacity) || capacity <= 0) return `${label}\nНет базы расчёта: доступная мощность отсутствует.\n${details}`
  return `${label}: ${displayedPercentage}%\n${details}\n${work} ÷ ${available} × 100% ≈ ${displayedPercentage}%`
}
