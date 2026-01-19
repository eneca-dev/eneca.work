'use client'

/**
 * Loading Modal 2 - Селектор сотрудника
 *
 * Комбобокс с поиском для выбора сотрудника
 * Использует Command компонент из shadcn/ui
 */

import { useState, useMemo } from 'react'
import { Check, ChevronsUpDown, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { useUsers } from '@/modules/cache'

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

  // Загрузка списка пользователей
  const { data: users = [], isLoading } = useUsers()

  // Фильтрация по поисковому запросу
  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users

    const query = search.toLowerCase()
    return users.filter(
      (user) =>
        user.fullName?.toLowerCase().includes(query) ||
        user.email?.toLowerCase().includes(query)
    )
  }, [users, search])

  // Найти выбранного пользователя
  const selectedUser = users.find((u) => u.id === value)

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange('')
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
              'w-full justify-between',
              error && 'border-red-500',
              !value && 'text-muted-foreground'
            )}
          >
            <span className="truncate">
              {isLoading
                ? 'Загрузка...'
                : selectedUser
                  ? selectedUser.fullName || selectedUser.email
                  : placeholder}
            </span>
            <div className="flex items-center gap-1">
              {value && !disabled && (
                <X
                  className="h-4 w-4 shrink-0 opacity-50 hover:opacity-100"
                  onClick={handleClear}
                />
              )}
              <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Поиск сотрудника..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>Сотрудники не найдены</CommandEmpty>
              <CommandGroup>
                {filteredUsers.map((user) => (
                  <CommandItem
                    key={user.id}
                    value={user.id}
                    onSelect={() => {
                      onChange(user.id === value ? '' : user.id)
                      setOpen(false)
                      setSearch('')
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === user.id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <div className="flex flex-col">
                      <span className="font-medium">{user.fullName || 'Без имени'}</span>
                      {user.email && (
                        <span className="text-xs text-muted-foreground">{user.email}</span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  )
}
