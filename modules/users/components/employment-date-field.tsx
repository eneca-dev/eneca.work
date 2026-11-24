'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { EmploymentDatedForm } from '../hooks/use-employment-dated-form'

export function EmploymentDateField({ form, operation, disabled = false }: {
  form: EmploymentDatedForm
  operation: 'update' | 'finish'
  disabled?: boolean
}) {
  if (form.loading) return <p role="status" className="text-sm text-muted-foreground">Проверка кадрового периода…</p>
  if (form.error) return <p role="alert" className="text-sm text-destructive">{form.error} Закройте и снова откройте форму для обновления данных.</p>
  if (!form.context?.enabled) return null
  const id = `employment-date-${operation}`
  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <Label htmlFor={id}>{operation === 'finish' ? 'Последний рабочий день' : 'Действует с'}</Label>
      <Input id={id} type="date" value={form.date} min={form.context.minDate ?? undefined}
        max={form.context.today} required disabled={disabled} onChange={event => form.setDate(event.target.value)}
        aria-describedby={`${id}-hint`} aria-invalid={!form.ready} />
      <p id={`${id}-hint`} className="text-xs text-muted-foreground">
        {operation === 'finish'
          ? 'Выбранный день включается в период работы. Со следующего дня сотрудник не учитывается в доступной мощности отдела.'
          : 'Новые отдел, команда и занятость действуют с выбранной даты. Расчёт загрузки с этой даты изменится.'}
        {' '}Доступны даты с {form.context.minDate} по {form.context.today}. Более ранние кадровые периоды не изменяются.
      </p>
      {form.date < form.context.today && <p className="text-sm text-amber-600 dark:text-amber-400">
        {operation === 'finish'
          ? 'Завершение задним числом исправит расчёт после последнего рабочего дня. Прошлые загрузки сохранятся.'
          : 'Изменение задним числом пересчитает загрузку начиная с выбранной даты.'}
      </p>}
      {!form.ready && <p role="alert" className="text-sm text-destructive">Выберите дату в доступном диапазоне.</p>}
    </div>
  )
}
