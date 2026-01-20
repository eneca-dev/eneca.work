'use client'

/**
 * Loading Modal 2 - Селектор сотрудника
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
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { useUsers, type CachedUser } from '@/modules/cache'
import { Avatar } from '@/modules/projects/components/Avatar'

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
        user.full_name?.toLowerCase().includes(query) ||
        user.email?.toLowerCase().includes(query)
    )
  }, [users, search])

  // Найти выбранного пользователя
  const selectedUser = users.find((u) => u.user_id === value)

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
                {filteredUsers.map((user) => (
                  <CommandItem
                    key={user.user_id}
                    value={user.user_id}
                    onSelect={handleSelect}
                    className="px-2 py-2 cursor-pointer"
                  >
                    <div className="flex items-center gap-2 w-full min-w-0">
                      <Avatar
                        name={user.full_name}
                        avatarUrl={user.avatar_url}
                        size="sm"
                        className="shrink-0"
                      />
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="font-medium truncate">
                          {user.full_name || 'Без имени'}
                        </span>
                        {user.email && (
                          <span className="text-xs text-muted-foreground truncate">
                            {user.email}
                          </span>
                        )}
                      </div>
                      <Check
                        className={cn(
                          'h-4 w-4 shrink-0',
                          value === user.user_id ? 'opacity-100' : 'opacity-0'
                        )}
                      />
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
