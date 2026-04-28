/**
 * DepartmentRateCell — inline-отображение и редактирование ставки отдела.
 * См. docs/production/budgets-calc-from-loadings.md (Этап 4)
 */

'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Edit2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  departmentRateSchema,
  type DepartmentRateFormValues,
} from '../schemas/department-rate.schema'
import {
  useDepartmentBudgetSettings,
  useUpdateDepartmentBudgetSetting,
} from '../hooks/use-department-budget-settings'

interface DepartmentRateCellProps {
  departmentId: string
  /** Если есть permission на редактирование — показываем кнопку Edit. */
  canEdit: boolean
}

const DEFAULT_RATE = 17.85
const DEFAULT_HOURS = 8

export function DepartmentRateCell({ departmentId, canEdit }: DepartmentRateCellProps) {
  const [open, setOpen] = useState(false)

  const { data: settings, isLoading: settingsLoading } = useDepartmentBudgetSettings()
  const setting = settings?.find((s) => s.department_id === departmentId)

  const updateMutation = useUpdateDepartmentBudgetSetting()

  const hourlyRate = setting?.hourly_rate ?? DEFAULT_RATE
  const workHoursPerDay = setting?.work_hours_per_day ?? DEFAULT_HOURS

  const form = useForm<DepartmentRateFormValues>({
    resolver: zodResolver(departmentRateSchema),
    defaultValues: {
      hourlyRate: Number(hourlyRate),
      workHoursPerDay: Number(workHoursPerDay),
    },
  })

  const handleOpenChange = (next: boolean) => {
    if (next) {
      form.reset({
        hourlyRate: Number(hourlyRate),
        workHoursPerDay: Number(workHoursPerDay),
      })
    }
    setOpen(next)
  }

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await updateMutation.mutateAsync({
        departmentId,
        hourlyRate: values.hourlyRate,
        workHoursPerDay: values.workHoursPerDay,
      })
      toast.success('Ставка обновлена')
      setOpen(false)
      form.reset(values)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось сохранить')
    }
  })

  const display = (
    <div className="text-sm tabular-nums">
      {settingsLoading ? (
        <span className="text-muted-foreground">…</span>
      ) : (
        <>
          <span className="font-medium">{Number(hourlyRate).toFixed(2)}</span>
          <span className="text-muted-foreground"> BYN/ч · {Number(workHoursPerDay)} ч/день</span>
        </>
      )}
    </div>
  )

  if (!canEdit) {
    return display
  }

  return (
    <div className="flex items-center gap-2">
      {display}
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            title="Изменить ставку"
            disabled={settingsLoading}
          >
            <Edit2 className="h-3.5 w-3.5" />
            <span className="sr-only">Изменить ставку</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72" align="end">
          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Ставка, BYN/час
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                {...form.register('hourlyRate')}
              />
              {form.formState.errors.hourlyRate && (
                <p className="mt-1 text-xs text-destructive">
                  {form.formState.errors.hourlyRate.message}
                </p>
              )}
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Часов в рабочем дне
              </label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                max="24"
                {...form.register('workHoursPerDay')}
              />
              {form.formState.errors.workHoursPerDay && (
                <p className="mt-1 text-xs text-destructive">
                  {form.formState.errors.workHoursPerDay.message}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
                disabled={updateMutation.isPending}
              >
                Отмена
              </Button>
              <Button type="submit" size="sm" disabled={updateMutation.isPending}>
                {updateMutation.isPending && (
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                )}
                Сохранить
              </Button>
            </div>
          </form>
        </PopoverContent>
      </Popover>
    </div>
  )
}
