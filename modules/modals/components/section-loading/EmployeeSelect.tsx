/**
 * EmployeeSelect - Селектор сотрудника
 *
 * Источник данных: useUsers() из cache
 * Формат: "Имя Фамилия"
 * Сортировка по алфавиту
 * Поиск по имени
 */

'use client'

import { useMemo, useState, useRef, useEffect } from 'react'
import { Label } from '@/components/ui/label'
import { useUsers } from '@/modules/cache'
import { cn } from '@/lib/utils'
import { Search, Check, ChevronDown } from 'lucide-react'

interface EmployeeSelectProps {
  value: string
  onChange: (value: string) => void
  error?: string
  disabled?: boolean
  'aria-invalid'?: boolean
}

export function EmployeeSelect({ value, onChange, error, disabled, 'aria-invalid': ariaInvalid }: EmployeeSelectProps) {
  // Загружаем список всех пользователей
  const { data: users, isLoading } = useUsers()

  // State для поиска и открытия dropdown
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Форматируем для отображения: "Имя Фамилия"
  const employeeOptions = useMemo(() => {
    if (!users) return []

    return users
      .filter((user) => user.user_id && user.first_name) // Фильтруем пользователей без имени
      .map((user) => {
        const fullName = [user.first_name, user.last_name]
          .filter(Boolean)
          .join(' ')

        return {
          id: user.user_id,
          displayName: fullName,
          fullName,
        }
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName))
  }, [users])

  // Фильтруем по поиску
  const filteredOptions = useMemo(() => {
    if (!search.trim()) return employeeOptions

    const searchLower = search.toLowerCase()
    return employeeOptions.filter((employee) =>
      employee.fullName.toLowerCase().includes(searchLower)
    )
  }, [employeeOptions, search])

  // Выбранный сотрудник для отображения
  const selectedEmployee = useMemo(() => {
    return employeeOptions.find((e) => e.id === value)
  }, [employeeOptions, value])

  // Handle outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Focus search input when opened
  useEffect(() => {
    if (open && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [open])

  // Handle select
  const handleSelect = (employeeId: string) => {
    onChange(employeeId)
    setOpen(false)
    setSearch('')
  }

  return (
    <div className="space-y-2">
      <Label>Сотрудник *</Label>

      <div className="relative" ref={wrapperRef}>
        {/* Trigger button */}
        <button
          type="button"
          onClick={() => !disabled && !isLoading && setOpen(!open)}
          disabled={disabled || isLoading}
          aria-invalid={ariaInvalid}
          className={cn(
            'w-full px-3 py-2 border rounded-md bg-background text-left flex items-center justify-between',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'text-sm',
            error && 'border-destructive focus:ring-destructive'
          )}
        >
          <span className={cn(selectedEmployee ? 'text-foreground' : 'text-muted-foreground')}>
            {isLoading ? 'Загрузка...' : selectedEmployee?.displayName || 'Выберите сотрудника'}
          </span>
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </button>

        {/* Dropdown */}
        {open && (
          <div className="absolute left-0 top-full mt-1 z-50 w-full bg-background border border-border rounded-md shadow-lg max-h-[300px] flex flex-col">
            {/* Search input */}
            <div className="p-2 border-b border-border">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Поиск по имени..."
                  className="w-full pl-8 pr-3 py-1.5 text-sm border border-border rounded bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>

            {/* Options list */}
            <div className="overflow-y-auto flex-1">
              {filteredOptions.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground text-center">
                  {search ? 'Ничего не найдено' : 'Нет доступных сотрудников'}
                </div>
              ) : (
                filteredOptions.map((employee) => {
                  const isSelected = employee.id === value
                  return (
                    <button
                      key={employee.id}
                      type="button"
                      onClick={() => handleSelect(employee.id)}
                      className={cn(
                        'w-full px-3 py-2 text-left text-sm flex items-center justify-between hover:bg-accent transition-colors',
                        isSelected && 'bg-accent/50'
                      )}
                    >
                      <span>{employee.displayName}</span>
                      {isSelected && <Check className="w-4 h-4 text-primary" />}
                    </button>
                  )
                })
              )}
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  )
}
