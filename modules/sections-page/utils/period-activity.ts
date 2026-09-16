/**
 * Проверка активности проекта за произвольный период (не "от сегодня", как isStale).
 *
 * Используется, когда в календаре задан конкретный диапазон дат — вместо группы
 * «Завершённые» (isStale) список делится на группу «Нет загрузок за период» по
 * этому критерию, см. flattenSections.
 */

import type { Project, SectionLoading } from '../types'

export interface DateRange {
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
}

/**
 * true, если у проекта есть загрузка, пересекающая период, либо введённая
 * (не дефолтная) ёмкость > 0 на дату внутри периода — задача про "капасити" явно
 * требует учитывать именно capacityOverrides, не общий defaultCapacity.
 *
 * Важно: 0 в capacityOverrides — это ВАЛИДНОЕ явно сохранённое значение (см.
 * миграцию allow_zero_section_capacity_value), означающее "ёмкость не нужна",
 * а не "нет активности". Поэтому проверяем именно value > 0, а не сам факт
 * наличия ключа-даты — иначе после сброса капасити в 0 проект не возвращался
 * бы обратно в группу «Нет загрузок за период».
 */
export function hasActivityInPeriod(project: Project, range: DateRange): boolean {
  for (const os of project.objectSections) {
    for (const loading of os.loadings) {
      if (loading.startDate <= range.endDate && loading.endDate >= range.startDate) {
        return true
      }
    }
    if (os.capacityOverrides) {
      for (const [date, value] of Object.entries(os.capacityOverrides)) {
        if (value > 0 && date >= range.startDate && date <= range.endDate) {
          return true
        }
      }
    }
  }
  return false
}

/** true, если хотя бы одна загрузка сотрудника пересекает период. */
export function hasEmployeeLoadingInPeriod(loadings: SectionLoading[], range: DateRange): boolean {
  return loadings.some((l) => l.startDate <= range.endDate && l.endDate >= range.startDate)
}
