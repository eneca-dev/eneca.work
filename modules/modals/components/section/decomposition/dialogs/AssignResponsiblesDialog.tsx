'use client'

/**
 * AssignResponsiblesDialog - Диалог назначения ответственных на этап
 */

import { useState, useMemo } from 'react'
import { Search, Check } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Checkbox } from '@/components/ui/checkbox'
import type { Employee } from '../types'

// ============================================================================
// Types
// ============================================================================

interface AssignResponsiblesDialogProps {
  isOpen: boolean
  onClose: () => void
  employees: Employee[]
  currentResponsibles: string[]
  onAssign: (userIds: string[]) => void
}

// ============================================================================
// Component
// ============================================================================

export function AssignResponsiblesDialog({
  isOpen,
  onClose,
  employees,
  currentResponsibles,
  onAssign,
}: AssignResponsiblesDialogProps) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set(currentResponsibles))

  // Filter employees by search
  const filteredEmployees = useMemo(() => {
    if (!search.trim()) return employees
    const searchLower = search.toLowerCase()
    return employees.filter(
      (emp) =>
        emp.full_name?.toLowerCase().includes(searchLower) ||
        emp.email?.toLowerCase().includes(searchLower) ||
        emp.position_name?.toLowerCase().includes(searchLower) ||
        emp.team_name?.toLowerCase().includes(searchLower)
    )
  }, [employees, search])

  // Handle toggle
  const handleToggle = (userId: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) {
        next.delete(userId)
      } else {
        next.add(userId)
      }
      return next
    })
  }

  // Handle save
  const handleSave = () => {
    onAssign(Array.from(selected))
    onClose()
  }

  // Reset state when dialog opens
  const handleOpenChange = (open: boolean) => {
    if (open) {
      setSelected(new Set(currentResponsibles))
      setSearch('')
    } else {
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Назначить ответственных</DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по имени, email, должности..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Employee List */}
        <ScrollArea className="h-[300px] border rounded-md">
          {filteredEmployees.length === 0 ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              Сотрудники не найдены
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {filteredEmployees.map((emp) => (
                <label
                  key={emp.user_id}
                  className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                >
                  <Checkbox
                    checked={selected.has(emp.user_id)}
                    onCheckedChange={() => handleToggle(emp.user_id)}
                  />
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {emp.avatar_url ? (
                      <img
                        src={emp.avatar_url}
                        alt={emp.full_name}
                        className="h-8 w-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-primary/30 flex items-center justify-center text-xs font-semibold text-primary-foreground">
                        {emp.first_name?.[0]}
                        {emp.last_name?.[0]}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{emp.full_name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {emp.position_name || emp.email}
                        {emp.team_name && ` • ${emp.team_name}`}
                      </div>
                    </div>
                  </div>
                  {selected.has(emp.user_id) && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </label>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Selected count */}
        <div className="text-sm text-muted-foreground">
          Выбрано: {selected.size} сотрудников
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={handleSave}>Сохранить</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
