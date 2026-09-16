'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, Plus, Search, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { EmployeeChip } from './EmployeeChip'
import { useBoardProjectSearch } from '../hooks/useEmploymentBoard'
import type { BoardEmployee } from '../types'

interface SidePanelProps {
  employees: BoardEmployee[]
  unassignedIds: Set<string>
  canEdit: boolean
  onDragStartEmployee: (employeeId: string, e: React.DragEvent) => void
  onDragEnd: () => void
  onPinProject: (project: { id: string; name: string }) => void
}

export function SidePanel({
  employees,
  unassignedIds,
  canEdit,
  onDragStartEmployee,
  onDragEnd,
  onPinProject,
}: SidePanelProps) {
  const [term, setTerm] = useState('')
  const [debouncedTerm, setDebouncedTerm] = useState('')
  const [employeeTerm, setEmployeeTerm] = useState('')
  const [showAssigned, setShowAssigned] = useState(false)

  // Дебаунсим только ввод; сам запрос идёт через TanStack Query,
  // поэтому повторный поиск того же слова берётся из кэша.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedTerm(term.trim()), 300)
    return () => clearTimeout(timer)
  }, [term])

  const { data: results = [] } = useBoardProjectSearch(debouncedTerm, {
    enabled: canEdit && debouncedTerm.length >= 2,
  })

  const normalizedEmployeeTerm = employeeTerm.trim().toLocaleLowerCase('ru')
  const filteredEmployees = employees.filter((employee) => {
    if (!normalizedEmployeeTerm) return true
    return [employee.name, employee.positionName, employee.teamName]
      .filter(Boolean)
      .some((value) => value!.toLocaleLowerCase('ru').includes(normalizedEmployeeTerm))
  })
  const unassignedEmployees = filteredEmployees.filter((employee) => unassignedIds.has(employee.id))
  const assignedEmployees = filteredEmployees.filter((employee) => !unassignedIds.has(employee.id))

  return (
    <aside className="flex w-[19rem] shrink-0 flex-col overflow-y-auto border-r bg-card shadow-sm">
      {canEdit && (
        <section className="border-b px-4 py-4">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Добавить проект
          </h2>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Найти проект…"
              className="h-9 bg-background pl-8 text-xs"
            />
          </div>
          {results.length > 0 && (
            <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
              {results.map((project) => (
                <li key={project.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onPinProject(project)
                      setTerm('')
                    }}
                    className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-primary/10"
                  >
                    <Plus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    <span className="leading-snug">{project.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="flex min-h-0 flex-1 flex-col px-4 py-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Users className="h-3.5 w-3.5" /> Сотрудники
          </h2>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[0.7rem] tabular-nums text-muted-foreground">
            {employees.length}
          </span>
        </div>
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={employeeTerm}
            onChange={(e) => setEmployeeTerm(e.target.value)}
            placeholder="Поиск сотрудника…"
            className="h-9 bg-background pl-8 text-xs"
          />
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-medium text-primary">Свободны</h3>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[0.7rem] font-medium tabular-nums text-primary">
                {unassignedEmployees.length}
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              {unassignedEmployees.map((employee) => (
                <EmployeeChip
                  key={employee.id}
                  employee={employee}
                  draggable={canEdit}
                  onDragStart={canEdit ? (e) => onDragStartEmployee(employee.id, e) : undefined}
                  onDragEnd={canEdit ? onDragEnd : undefined}
                  className="w-full justify-start border-primary/30 bg-primary/10 text-foreground shadow-sm"
                />
              ))}
              {unassignedEmployees.length === 0 && (
                <p className="px-1 text-xs text-muted-foreground">Нет свободных сотрудников</p>
              )}
            </div>
          </div>

          <div className="border-t pt-3">
            <button
              type="button"
              onClick={() => setShowAssigned((current) => !current)}
              className="flex w-full items-center justify-between rounded-md px-1 py-1 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-expanded={showAssigned}
            >
              <span>Уже назначены</span>
              <span className="flex items-center gap-1.5 tabular-nums">
                {assignedEmployees.length}
                <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showAssigned && 'rotate-180')} />
              </span>
            </button>
            {showAssigned && (
              <div className="mt-2 flex flex-col gap-1.5">
                {assignedEmployees.map((employee) => (
                  <EmployeeChip
                    key={employee.id}
                    employee={employee}
                    draggable={canEdit}
                    onDragStart={canEdit ? (e) => onDragStartEmployee(employee.id, e) : undefined}
                    onDragEnd={canEdit ? onDragEnd : undefined}
                    className="w-full justify-start opacity-70"
                  />
                ))}
                {assignedEmployees.length === 0 && (
                  <p className="px-1 text-xs text-muted-foreground">Ничего не найдено</p>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    </aside>
  )
}
