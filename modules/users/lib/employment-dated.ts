import { z } from 'zod'

// Date-only strings are never converted through the browser's timezone.
export const employmentDateSchema = z.string().date('Укажите существующую дату в формате ГГГГ-ММ-ДД')
  .refine((value) => value.slice(0, 4) !== '0000', 'Некорректный год')

export const employmentDatedCommandSchema = z.object({
  effectiveDate: employmentDateSchema,
  expectedPeriodId: z.string().uuid(),
  // Preserve PostgreSQL microseconds: converting this token to Date loses precision.
  expectedUpdatedAt: z.string().datetime({ offset: true }),
}).strict()

export type EmploymentDatedCommand = z.infer<typeof employmentDatedCommandSchema>

export const employmentEditContextSchema = z.object({
  enabled: z.boolean(),
  cutoverDate: employmentDateSchema.nullable(),
  today: employmentDateSchema,
  periodId: z.string().uuid().nullable(),
  periodUpdatedAt: z.string().datetime({ offset: true }).nullable(),
  minDate: employmentDateSchema.nullable(),
}).superRefine((context, ctx) => {
  if (context.enabled && (!context.cutoverDate || !context.periodId || !context.periodUpdatedAt || !context.minDate
    || context.minDate < context.cutoverDate || context.minDate > context.today)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Некорректный кадровый период' })
  }
})

export type EmploymentEditContext = z.infer<typeof employmentEditContextSchema>

export class EmploymentOperationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EmploymentOperationError'
  }
}

export class EmploymentPartialSuccessError extends EmploymentOperationError {
  constructor() {
    super('Кадровые изменения сохранены, но остальные поля профиля не обновлены. Откройте форму заново и повторите только оставшиеся изменения.')
    this.name = 'EmploymentPartialSuccessError'
  }
}

/** Only known categories cross the UI boundary; never expose raw SQL messages. */
export function employmentOperationError(error: { code?: string }): EmploymentOperationError {
  switch (error.code) {
    case '42501':
      return new EmploymentOperationError('Недостаточно прав для этого кадрового действия.')
    case '22023':
    case '22007':
    case '22008':
      return new EmploymentOperationError('Проверьте кадровые поля и дату: она должна быть в пределах последнего открытого периода и не позже сегодняшнего дня по Минску.')
    case '40001':
      return new EmploymentOperationError('Кадровые данные изменились. Закройте и снова откройте форму, проверьте изменения и повторите действие.')
    case '55000':
    case '23P01':
      return new EmploymentOperationError('Нет доступного открытого периода или выбранная дата затрагивает более позднее кадровое событие. Обновите данные и проверьте дату.')
    case 'PGRST202':
    case '42883':
      return new EmploymentOperationError('Выбор кадровой даты ещё не подключён к этой базе. Изменения не сохранены.')
    default:
      return new EmploymentOperationError('Не удалось выполнить кадровое действие. Обновите данные и повторите попытку.')
  }
}
