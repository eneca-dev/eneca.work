'use client'

/**
 * Секция в карточке сотрудника: управление cross-department loading access grants.
 *
 * Показывает список отделов, которым выдан доступ к управлению загрузками
 * сотрудника. Позволяет НО/ТЛ владеющего отдела выдавать и отзывать гранты.
 * Для НО/ТЛ отдела-получателя — read-only список.
 *
 * См. спеку: docs/superpowers/specs/2026-05-19-cross-department-loading-grants-design.md
 */

import { useMemo, useState } from 'react'
import { Building2, Plus, Trash2, ArrowLeftRight, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'
import { useCachedDepartments } from '@/modules/cache'
import {
  useLoadingAccessGrants,
  useCreateLoadingAccessGrant,
  useRevokeLoadingAccessGrant,
} from '../hooks/use-loading-access-grants'
import { useCanGrantLoadingAccess } from '../hooks/use-can-grant-loading-access'

interface EmployeeAccessGrantsSectionProps {
  employeeId: string
  employeeDepartmentId: string | null | undefined
  employeeTeamId: string | null | undefined
}

export function EmployeeAccessGrantsSection({
  employeeId,
  employeeDepartmentId,
  employeeTeamId,
}: EmployeeAccessGrantsSectionProps) {
  const canManage = useCanGrantLoadingAccess({
    employeeDepartmentId,
    employeeTeamId,
  })

  const { data: grants = [], isLoading: isGrantsLoading } =
    useLoadingAccessGrants(employeeId)
  const { data: departments = [] } = useCachedDepartments()

  const createMut = useCreateLoadingAccessGrant()
  const revokeMut = useRevokeLoadingAccessGrant()

  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('')

  // Доступные для выдачи отделы: все, кроме отдела самого сотрудника
  // и тех, которым грант уже выдан
  const availableDepartments = useMemo(() => {
    const taken = new Set(grants.map((g) => g.granted_to_department_id))
    return departments.filter(
      (d) => d.id !== employeeDepartmentId && !taken.has(d.id)
    )
  }, [departments, grants, employeeDepartmentId])

  // Если ни НО/ТЛ владеющего отдела, ни нет грантов — секцию не показываем
  if (!canManage && grants.length === 0) return null

  const handleCreate = async () => {
    if (!selectedDepartmentId) return
    try {
      await createMut.mutateAsync({
        employee_id: employeeId,
        granted_to_department_id: selectedDepartmentId,
      })
      toast({
        title: 'Доступ выдан',
        description: 'Отдел теперь может управлять загрузками этого сотрудника.',
      })
      setSelectedDepartmentId('')
    } catch (err) {
      toast({
        title: 'Не удалось выдать доступ',
        description: err instanceof Error ? err.message : 'Неизвестная ошибка',
        variant: 'destructive',
      })
    }
  }

  const handleRevoke = async (grantId: string, departmentName: string | null) => {
    try {
      await revokeMut.mutateAsync({ grant_id: grantId })
      toast({
        title: 'Доступ отозван',
        description: departmentName
          ? `Отдел «${departmentName}» больше не может управлять загрузками.`
          : 'Грант успешно удалён.',
      })
    } catch (err) {
      toast({
        title: 'Не удалось отозвать доступ',
        description: err instanceof Error ? err.message : 'Неизвестная ошибка',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="w-full max-w-full min-w-0 space-y-3 pt-4 mt-4 border-t overflow-hidden">
      <div className="flex items-center gap-2 min-w-0">
        <ArrowLeftRight className="h-4 w-4 text-amber-600 shrink-0" />
        <h3 className="text-sm font-semibold text-foreground truncate">
          Доступ для других отделов
        </h3>
      </div>

      <p className="text-xs text-muted-foreground flex items-start gap-1.5 min-w-0">
        <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
        <span className="min-w-0">
          Перечисленные отделы получают право создавать и редактировать загрузки
          этого сотрудника. Сотрудник остаётся в своём основном отделе.
        </span>
      </p>

      {/* Список существующих грантов */}
      {isGrantsLoading ? (
        <div className="text-xs text-muted-foreground">Загрузка…</div>
      ) : grants.length === 0 ? (
        <div className="text-xs text-muted-foreground italic">
          Нет открытых доступов
        </div>
      ) : (
        <ul className="space-y-1.5">
          {grants.map((g) => (
            <li
              key={g.grant_id}
              className={cn(
                'flex items-center justify-between gap-3 rounded-md border bg-amber-50/40 dark:bg-amber-950/20 px-3 py-2'
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Building2 className="h-3.5 w-3.5 text-amber-700" />
                  <span className="truncate">
                    {g.granted_to_department_name ?? '— отдел удалён —'}
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                  Выдал: {g.granted_by_name ?? '—'} ·{' '}
                  {new Date(g.created_at).toLocaleDateString('ru-RU')}
                </div>
              </div>

              {canManage && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive shrink-0"
                  onClick={() =>
                    handleRevoke(g.grant_id, g.granted_to_department_name)
                  }
                  disabled={revokeMut.isPending}
                  aria-label={`Отозвать доступ для отдела ${g.granted_to_department_name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Форма выдачи нового гранта — только для НО/ТЛ владеющего отдела.
          Select и кнопка на ОТДЕЛЬНЫХ строках — это гарантирует что они не
          конфликтуют по ширине. Кнопка выровнена вправо. */}
      {canManage && (
        <div className="space-y-2 pt-1">
          <Select
            value={selectedDepartmentId}
            onValueChange={setSelectedDepartmentId}
            disabled={availableDepartments.length === 0 || createMut.isPending}
          >
            <SelectTrigger className="w-full h-9 text-sm">
              <SelectValue
                placeholder={
                  availableDepartments.length === 0
                    ? 'Все отделы уже имеют доступ'
                    : 'Выберите отдел'
                }
              />
            </SelectTrigger>
            <SelectContent>
              {availableDepartments.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              variant="default"
              onClick={handleCreate}
              disabled={!selectedDepartmentId || createMut.isPending}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Выдать доступ
            </Button>
          </div>
        </div>
      )}

      {/* Read-only баннер для НО/ТЛ-получателей */}
      {!canManage && grants.length > 0 && (
        <Badge variant="outline" className="text-[11px] font-normal">
          Вы видите это как руководитель отдела-получателя
        </Badge>
      )}
    </div>
  )
}
