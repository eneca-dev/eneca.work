'use client'

/**
 * Loading Modal New - Мультиселектор сотрудников
 *
 * Компонент для выбора нескольких сотрудников при создании загрузки.
 * Используется только в CREATE mode. В EDIT mode используется одиночный EmployeeSelector.
 */

import { useState, useMemo, useCallback } from 'react'
import { Check, ChevronsUpDown, X } from 'lucide-react'
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
import { useUsers, type CachedUser } from '@/modules/cache'
import { pluralizeEmployees } from '@/lib/pluralize'
import { Avatar } from '@/modules/projects/components/Avatar'
import { useEmployeeSearch } from './useEmployeeSearch'
import { EmployeeCommandItem } from './EmployeeCommandItem'
import { useFilterContext, canAssignLoadingToUser } from '@/modules/permissions'

export interface MultiEmployeeSelectorProps {
  /** Массив выбранных ID сотрудников */
  value: string[]
  /** Callback при изменении */
  onChange: (employeeIds: string[]) => void
  /** Показывать ошибку */
  error?: string
  /** Disabled состояние */
  disabled?: boolean
  /** Placeholder */
  placeholder?: string
}

export function MultiEmployeeSelector({
  value,
  onChange,
  error,
  disabled = false,
  placeholder = 'Выберите сотрудников',
}: MultiEmployeeSelectorProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const { data: allUsers = [], isLoading } = useUsers()

  // Фильтр по scope: user → только сам, team_lead → своя команда,
  // department_head → свой отдел, admin/subdivision_head/PM → все (server-side гейтит).
  const { data: filterCtx } = useFilterContext()
  const users = useMemo(() => {
    if (!filterCtx) return allUsers
    return allUsers.filter((u) =>
      canAssignLoadingToUser(
        {
          user_id: u.user_id,
          team_id: u.team_id,
          department_id: u.department_id,
        },
        filterCtx
      )
    )
  }, [allUsers, filterCtx])

  const filteredUsers = useEmployeeSearch(users, search)

  // Map для быстрого доступа к выбранным пользователям
  const selectedUsersMap = useMemo(() => {
    const map = new Map<string, CachedUser>()
    for (const user of users) {
      if (value.includes(user.user_id)) {
        map.set(user.user_id, user)
      }
    }
    return map
  }, [users, value])

  // Сортировка: выбранные сверху
  const sortedUsers = useMemo(() => {
    const selectedSet = new Set(value)
    return [...filteredUsers].sort((a, b) => {
      const aSelected = selectedSet.has(a.user_id) ? 0 : 1
      const bSelected = selectedSet.has(b.user_id) ? 0 : 1
      return aSelected - bSelected
    })
  }, [filteredUsers, value])

  const handleSelect = useCallback((userId: string) => {
    if (value.includes(userId)) {
      onChange(value.filter((id) => id !== userId))
    } else {
      onChange([...value, userId])
    }
    // Не закрываем popover — пользователь может выбрать ещё
    setSearch('')
  }, [value, onChange])

  const handleRemove = useCallback((userId: string) => {
    onChange(value.filter((id) => id !== userId))
  }, [value, onChange])

  const selectedCount = value.length

  return (
    <div className="space-y-2">
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
              !selectedCount && 'text-muted-foreground'
            )}
          >
            <span className="truncate">
              {isLoading
                ? 'Загрузка…'
                : selectedCount > 0
                  ? `Выбрано: ${selectedCount} ${pluralizeEmployees(selectedCount)}`
                  : placeholder}
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50 ml-2" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0 data-[state=open]:animate-none data-[state=closed]:animate-none"
          align="start"
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Поиск сотрудника…"
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>Сотрудники не найдены</CommandEmpty>
              <CommandGroup>
                {sortedUsers.map((user) => {
                  const isSelected = value.includes(user.user_id)
                  return (
                    <EmployeeCommandItem
                      key={user.user_id}
                      user={user}
                      onSelect={handleSelect}
                      indicator={
                        <div
                          className={cn(
                            'flex items-center justify-center h-4 w-4 shrink-0 rounded-sm border',
                            isSelected
                              ? 'bg-primary border-primary text-primary-foreground'
                              : 'border-muted-foreground/40'
                          )}
                        >
                          {isSelected && <Check className="h-3 w-3" />}
                        </div>
                      }
                    />
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Бейджи выбранных сотрудников */}
      {selectedCount > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((userId) => {
            const user = selectedUsersMap.get(userId)
            if (!user) return null
            return (
              <div
                key={userId}
                className="flex items-center gap-1 pl-1 pr-0.5 py-0.5 rounded-md bg-muted text-sm"
              >
                <Avatar
                  name={user.full_name}
                  avatarUrl={user.avatar_url}
                  size="xs"
                  className="shrink-0"
                />
                <span className="truncate max-w-[140px] text-xs">
                  {user.full_name || user.email}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemove(userId)}
                  disabled={disabled}
                  className="p-0.5 rounded-sm hover:bg-foreground/10 transition-colors"
                  aria-label={`Убрать ${user.full_name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {error ? <p className="text-sm text-red-500">{error}</p> : null}
    </div>
  )
}
