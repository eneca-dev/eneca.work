"use client"

import { useState, useEffect } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Filter, X, Check } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { mockProjects } from "@/data/mock-data"
import { mockDepartments, mockTeams, mockProfiles, getFullName, getTeamName } from "@/data/mock-profiles"

export interface FilterState {
  projects: string[]
  departments: string[]
  teams: string[]
  employees: string[]
}

interface FilterPopoverProps {
  onFilterChange: (filters: FilterState) => void
  currentFilters: FilterState
  projects?: any[]
}

export function FilterPopover({ onFilterChange, currentFilters, projects = mockProjects }: FilterPopoverProps) {
  const [open, setOpen] = useState(false)
  const [filters, setFilters] = useState<FilterState>(currentFilters)
  const [searchTerm, setSearchTerm] = useState("")

  // Обновляем локальные фильтры при изменении внешних фильтров
  useEffect(() => {
    setFilters(currentFilters)
  }, [currentFilters])

  // Функция для обновления фильтров
  const updateFilter = (type: keyof FilterState, value: string) => {
    setFilters((prev) => {
      const newFilters = { ...prev }

      // Для проектов обеспечиваем, что всегда выбран хотя бы один проект
      if (type === "projects") {
        if (newFilters[type].includes(value)) {
          // Если пытаемся снять выбор с проекта
          if (newFilters[type].length > 1) {
            // Если выбрано больше одного проекта, можно снять выбор
            newFilters[type] = newFilters[type].filter((v) => v !== value)
          }
          // Иначе не даем снять выбор с последнего проекта
        } else {
          // Добавляем проект в выбранные
          newFilters[type] = [...newFilters[type], value]
        }
      } else {
        // Для остальных типов фильтров обычная логика
        if (newFilters[type].includes(value)) {
          newFilters[type] = newFilters[type].filter((v) => v !== value)
        } else {
          newFilters[type] = [...newFilters[type], value]
        }
      }

      return newFilters
    })
  }

  // Функция для очистки всех фильтров, кроме проектов
  const clearAllFilters = () => {
    setFilters((prev) => ({
      projects: prev.projects, // Сохраняем выбранные проекты
      departments: [],
      teams: [],
      employees: [],
    }))
  }

  // Функция для применения фильтров
  const applyFilters = () => {
    // Проверяем, что хотя бы один проект выбран
    if (filters.projects.length === 0 && projects.length > 0) {
      // Если нет выбранных проектов, выбираем первый
      const updatedFilters = {
        ...filters,
        projects: [projects[0].id],
      }
      onFilterChange(updatedFilters)
    } else {
      onFilterChange(filters)
    }
    setOpen(false)
  }

  // Функция для фильтрации элементов по поисковому запросу
  const filterBySearch = (items: any[], getName: (item: any) => string) => {
    if (!searchTerm) return items
    return items.filter((item) => getName(item).toLowerCase().includes(searchTerm.toLowerCase()))
  }

  // Получаем отфильтрованные списки
  const filteredProjects = filterBySearch(projects, (project) => project.name)
  const filteredDepartments = filterBySearch(mockDepartments, (dept) => dept.name)
  const filteredTeams = filterBySearch(mockTeams, (team) => team.name)
  const filteredEmployees = filterBySearch(mockProfiles, (profile) => getFullName(profile))

  // Подсчитываем общее количество активных фильтров
  const totalActiveFilters = filters.departments.length + filters.teams.length + filters.employees.length

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "relative p-1 rounded hover:bg-slate-100 text-slate-500 transition-colors",
            totalActiveFilters > 0 && "text-primary",
          )}
        >
          <Filter size={16} />
          {totalActiveFilters > 0 && (
            <div className="absolute top-0 -right-2 h-5 min-w-5 px-1 flex items-center justify-center bg-primary text-white rounded-full">
              <span className="text-[10px] font-medium leading-none pt-[1px]">{totalActiveFilters}</span>
            </div>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium">Фильтры</h3>
            {totalActiveFilters > 0 && (
              <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-slate-500" onClick={clearAllFilters}>
                <X size={12} className="mr-1" />
                Очистить все
              </Button>
            )}
          </div>
          <Input
            placeholder="Поиск..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-8 text-sm"
          />
        </div>

        <ScrollArea className="h-[400px]">
          <div className="p-4">
            {/* Проекты */}
            <div className="mb-4">
              <h4 className="text-sm font-medium mb-2">Проекты</h4>
              <div className="space-y-2">
                {filteredProjects.map((project) => (
                  <div key={project.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`project-${project.id}`}
                      checked={filters.projects.includes(project.id)}
                      onCheckedChange={() => updateFilter("projects", project.id)}
                      // Блокируем снятие выбора, если это единственный выбранный проект
                      disabled={filters.projects.includes(project.id) && filters.projects.length === 1}
                    />
                    <Label
                      htmlFor={`project-${project.id}`}
                      className={cn(
                        "text-sm cursor-pointer",
                        filters.projects.includes(project.id) && filters.projects.length === 1 ? "text-slate-400" : "",
                      )}
                    >
                      {project.name}
                    </Label>
                  </div>
                ))}
                {filteredProjects.length === 0 && <p className="text-sm text-slate-500">Нет результатов</p>}
              </div>
            </div>

            <Separator className="my-4" />

            {/* Отделы */}
            <div className="mb-4">
              <h4 className="text-sm font-medium mb-2">Отделы</h4>
              <div className="space-y-2">
                {filteredDepartments.map((department) => (
                  <div key={department.department_id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`dept-${department.department_id}`}
                      checked={filters.departments.includes(department.department_id)}
                      onCheckedChange={() => updateFilter("departments", department.department_id)}
                    />
                    <Label htmlFor={`dept-${department.department_id}`} className="text-sm cursor-pointer">
                      {department.name}
                    </Label>
                  </div>
                ))}
                {filteredDepartments.length === 0 && <p className="text-sm text-slate-500">Нет результатов</p>}
              </div>
            </div>

            <Separator className="my-4" />

            {/* Команды */}
            <div className="mb-4">
              <h4 className="text-sm font-medium mb-2">Команды</h4>
              <div className="space-y-2">
                {filteredTeams.map((team) => (
                  <div key={team.team_id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`team-${team.team_id}`}
                      checked={filters.teams.includes(team.team_id)}
                      onCheckedChange={() => updateFilter("teams", team.team_id)}
                    />
                    <Label htmlFor={`team-${team.team_id}`} className="text-sm cursor-pointer">
                      {team.name}
                    </Label>
                  </div>
                ))}
                {filteredTeams.length === 0 && <p className="text-sm text-slate-500">Нет результатов</p>}
              </div>
            </div>

            <Separator className="my-4" />

            {/* Сотрудники */}
            <div className="mb-4">
              <h4 className="text-sm font-medium mb-2">Сотрудники</h4>
              <div className="space-y-2">
                {filteredEmployees.map((employee) => (
                  <div key={employee.user_id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`emp-${employee.user_id}`}
                      checked={filters.employees.includes(employee.user_id)}
                      onCheckedChange={() => updateFilter("employees", employee.user_id)}
                    />
                    <Label htmlFor={`emp-${employee.user_id}`} className="text-sm cursor-pointer">
                      {getFullName(employee)}
                      <span className="text-xs text-slate-500 ml-1">({getTeamName(employee)})</span>
                    </Label>
                  </div>
                ))}
                {filteredEmployees.length === 0 && <p className="text-sm text-slate-500">Нет результатов</p>}
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="p-4 border-t flex justify-end">
          <Button variant="outline" size="sm" className="mr-2" onClick={() => setOpen(false)}>
            Отмена
          </Button>
          <Button size="sm" onClick={applyFilters} className="bg-primary hover:bg-primary/90">
            <Check size={14} className="mr-1" />
            Применить
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

