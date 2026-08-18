/**
 * Проверка активности проекта за произвольный период (не "от сегодня", как isStale).
 *
 * Используется, когда в календаре задан конкретный диапазон дат — вместо группы
 * «Завершённые» (isStale) список делится на группу «Нет загрузок за период» по
 * этому критерию, см. flattenSections.
 */

import type { Project } from '../types'

export interface DateRange {
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
}

/**
 * true, если у проекта есть загрузка, пересекающая период, либо введённая
 * (не дефолтная) ёмкость на дату внутри периода — задача про "капасити" явно
 * требует учитывать именно capacityOverrides, не общий defaultCapacity.
 */
export function hasActivityInPeriod(project: Project, range: DateRange): boolean {
  for (const os of project.objectSections) {
    for (const loading of os.loadings) {
      if (loading.startDate <= range.endDate && loading.endDate >= range.startDate) {
        return true
      }
    }
    if (os.capacityOverrides) {
      for (const date of Object.keys(os.capacityOverrides)) {
        if (date >= range.startDate && date <= range.endDate) {
          return true
        }
      }
    }
  }
  return false
}
