/**
 * Zod-схема для формы редактирования ставки отдела.
 * См. docs/production/budgets-calc-from-loadings.md (Этап 4)
 */

import { z } from 'zod'

export const departmentRateSchema = z.object({
  hourlyRate: z.coerce
    .number({ invalid_type_error: 'Укажите число' })
    .min(0, 'Ставка не может быть отрицательной')
    .max(9999.99, 'Слишком большая ставка'),
  workHoursPerDay: z.coerce
    .number({ invalid_type_error: 'Укажите число' })
    .min(0.01, 'Должно быть больше 0')
    .max(24, 'Не более 24 часов в дне'),
})

export type DepartmentRateFormValues = z.infer<typeof departmentRateSchema>
