'use client'

/**
 * Loading Modal New - Селектор сотрудника
 *
 * Комбобокс с поиском для выбора сотрудника
 * Использует Command компонент из shadcn/ui
 */

import { useState, useMemo } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { useUsers, useCachedDepartments } from '@/modules/cache'
import { Avatar } from '@/modules/projects/components/Avatar'
import { useEmployeeSearch } from './useEmployeeSearch'
import { EmployeeCommandItem } from './EmployeeCommandItem'
import { useFilterContext, canAssignLoadingToUser } from '@/modules/permissions'
import { useAllLoadingAccessGrantsIndex } from '@/modules/users/hooks/use-loading-access-grants'

export interface EmployeeSelectorProps {
  /** Выбранный ID сотрудника */
  value: string
  /** Callback при изменении */
  onChange: (employeeId: string) => void
  /** Показывать ошибку */
  error?: string
  /** Disabled состояние */
  disabled?: boolean
  /** Placeholder */
  placeholder?: string
}

export function EmployeeSelector({
  value,
  onChange,
  error,
  disabled = false,
  placeholder = 'Выберите сотрудника',
}: EmployeeSelectorProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  // Загрузка списка пользователей и cross-department грантов
  const { data: allUsers = [], isLoading } = useUsers()
  const { data: grantsIndex = {} } = useAllLoadingAccessGrantsIndex()
  const { data: departments = [] } = useCachedDepartments()

  const departmentNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const d of departments) map.set(d.id, d.name)
    return map
  }, [departments])

  // Фильтр по scope с учётом cross-department grants.
  // user → только сам, team_lead → своя команда + гости, department_head → свой отдел + гости,
  // admin/subdivision_head/PM → все (server-side гейтит).
  const { data: filterCtx } = useFilterContext()
  const users = useMemo(() => {
    if (!filterCtx) return allUsers
    return allUsers.filter((u) =>
      canAssignLoadingToUser(
        {
          user_id: u.user_id,
          team_id: u.team_id,
          department_id: u.department_id,
          granted_to_department_ids: grantsIndex[u.user_id],
        },
        filterCtx
      )
    )
  }, [allUsers, filterCtx, grantsIndex])

  // Помечаем "гостевых": сотрудник принадлежит чужому отделу, но виден через грант.
  // Бейдж показывает название его реального отдела (departmentNameById).
  const isGuestEmployee = useMemo(() => {
    return (userId: string, userDeptId: string | null | undefined): boolean => {
      if (!filterCtx || !userDeptId) return false
      const own = filterCtx.ownDepartmentId
      const head = filterCtx.headDepartmentId
      const isOwn = userDeptId === own || userDeptId === head
      if (isOwn) return false
      return (grantsIndex[userId]?.length ?? 0) > 0
    }
  }, [filterCtx, grantsIndex])

  const filteredUsers = useEmployeeSearch(users, search)

  // Найти выбранного пользователя (ищем по полному списку, чтобы edit-mode видел старого исполнителя)
  const selectedUser = allUsers.find((u) => u.user_id === value)

  // Обработка выбора пользователя
  const handleSelect = (currentValue: string) => {
    // Если кликнули по уже выбранному - снимаем выбор
    if (currentValue === value) {
      onChange('')
    } else {
      onChange(currentValue)
    }
    setOpen(false)
    setSearch('')
  }

  return (
    <div className="space-y-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled || isLoading}
            className={cn(
              'w-full justify-between h-auto min-h-[40px]',
              error && 'border-red-500',
              !value && 'text-muted-foreground'
            )}
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {selectedUser && (
                <Avatar
                  name={selectedUser.full_name}
                  avatarUrl={selectedUser.avatar_url}
                  size="sm"
                  className="shrink-0"
                />
              )}
              <span className="truncate">
                {isLoading
                  ? 'Загрузка...'
                  : selectedUser
                    ? selectedUser.full_name || selectedUser.email
                    : placeholder}
              </span>
            </div>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50 ml-2" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0 data-[state=open]:animate-none data-[state=closed]:animate-none"
          align="start"
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Поиск сотрудника..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>Сотрудники не найдены</CommandEmpty>
              <CommandGroup>
                {filteredUsers.map((user) => {
                  const isGuest = isGuestEmployee(user.user_id, user.department_id)
                  const guestBadgeLabel = isGuest && user.department_id
                    ? departmentNameById.get(user.department_id) ?? null
                    : null
                  return (
                    <EmployeeCommandItem
                      key={user.user_id}
                      user={user}
                      onSelect={handleSelect}
                      guestBadgeLabel={guestBadgeLabel}
                      indicator={
                        <Check
                          className={cn(
                            'h-4 w-4 shrink-0',
                            value === user.user_id ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                      }
                    />
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  )
}
