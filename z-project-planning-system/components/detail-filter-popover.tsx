"use client"

import { useState, useEffect, useMemo } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Filter, X, Check, Building2, Users, User } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { mockDepartments, mockTeams, mockProfiles, getFullName, getTeamName } from "@/data/mock-profiles"
import type { Project } from "@/types/project-types"

export interface DetailFilterState {
  departments: string[]
  teams: string[]
  employees: string[]
}

interface DetailFilterPopoverProps {
  onFilterChange: (filters: DetailFilterState) => void
  currentFilters: DetailFilterState
  selectedProjects: Project[]
}

export function DetailFilterPopover({
  onFilterChange,
  currentFilters,
  selectedProjects = [],
}: DetailFilterPopoverProps) {
  const [open, setOpen] = useState(false)
  const [filters, setFilters] = useState<DetailFilterState>(currentFilters)
  const [searchTerm, setSearchTerm] = useState("")
  const [activeTab, setActiveTab] = useState("departments")

  // Обновляем локальные фильтры при изменении внешних фильтров
  useEffect(() => {
    setFilters(currentFilters)
  }, [currentFilters])

  // Получаем все уникальные ID отделов, команд и сотрудников из выбранных проектов
  const { projectDepartmentIds, projectTeamIds, projectEmployeeIds } = useMemo(() => {
    const departmentIds = new Set<string>()
    const teamIds = new Set<string>()
    const employeeIds = new Set<string>()

    // Проходим по всем выбранным проектам
    if (selectedProjects && selectedProjects.length > 0) {
      selectedProjects.forEach((project) => {
        // Проходим по всем разделам проекта
        if (project.sections) {
          project.sections.forEach((section) => {
            // Добавляем ответственного за раздел
            if (section.responsible) {
              employeeIds.add(section.responsible.id)

              // Находим профиль ответственного, чтобы получить его отдел и команду
              const profile = mockProfiles.find((p) => p.user_id === section.responsible?.id)
              if (profile) {
                departmentIds.add(profile.department_id)
                teamIds.add(profile.team_id)
              }
            }

            // Проходим по всем задачам и загрузкам
            if (section.tasks) {
              section.tasks.forEach((task) => {
                if (task.loadings) {
                  task.loadings.forEach((loading) => {
                    // Используем executorId вместо поиска по имени
                    const profile = mockProfiles.find((p) => p.user_id === loading.user_id)

                    if (profile) {
                      employeeIds.add(profile.user_id)
                      departmentIds.add(profile.department_id)
                      teamIds.add(profile.team_id)
                    }
                  })
                }
              })
            }
          })
        }
      })
    }

    return {
      projectDepartmentIds: Array.from(departmentIds),
      projectTeamIds: Array.from(teamIds),
      projectEmployeeIds: Array.from(employeeIds),
    }
  }, [selectedProjects])

  // Функция для обновления фильтров
  const updateFilter = (type: keyof DetailFilterState, value: string) => {
    setFilters((prev) => {
      const newFilters = { ...prev }
      if (newFilters[type].includes(value)) {
        newFilters[type] = newFilters[type].filter((v) => v !== value)
      } else {
        newFilters[type] = [...newFilters[type], value]
      }
      return newFilters
    })
  }

  // Функция для очистки всех фильтров
  const clearAllFilters = () => {
    setFilters({
      departments: [],
      teams: [],
      employees: [],
    })
  }

  // Функция для применения фильтров
  const applyFilters = () => {
    onFilterChange(filters)
    setOpen(false)
  }

  // Функция для фильтрации элементов по поисковому запросу
  const filterBySearch = (items: any[], getName: (item: any) => string) => {
    if (!searchTerm) return items
    return items.filter((item) => getName(item).toLowerCase().includes(searchTerm.toLowerCase()))
  }

  // Получаем отфильтрованные списки, только те элементы, которые есть в выбранных проектах
  const filteredDepartments = filterBySearch(
    mockDepartments.filter((dept) => projectDepartmentIds.includes(dept.department_id)),
    (dept) => dept.department_name,
  )

  const filteredTeams = filterBySearch(
    mockTeams.filter((team) => projectTeamIds.includes(team.team_id)),
    (team) => team.name,
  )

  const filteredEmployees = filterBySearch(
    mockProfiles.filter((profile) => projectEmployeeIds.includes(profile.user_id)),
    (profile) => getFullName(profile),
  )

  // Подсчитываем общее количество активных фильтров
  const totalActiveFilters = filters.departments.length + filters.teams.length + filters.employees.length

  // Получаем количество активных фильтров по категориям
  const activeDepartments = filters.departments.length
  const activeTeams = filters.teams.length
  const activeEmployees = filters.employees.length

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative mt-1">
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-7 w-7 p-0 flex items-center justify-center rounded-full border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700",
              totalActiveFilters > 0 && "text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-600",
            )}
          >
            <Filter
              size={14}
              className={cn("text-slate-500 dark:text-slate-400", totalActiveFilters > 0 && "text-primary")}
            />
            {totalActiveFilters > 0 && (
              <div className="absolute top-0 -right-2 h-4 min-w-4 px-1 flex items-center justify-center bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-full">
                <span className="text-[10px] font-medium leading-none">{totalActiveFilters}</span>
              </div>
            )}
          </Button>
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-0 shadow-lg border-slate-200 dark:border-slate-700 dark:bg-slate-800"
        align="start"
      >
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium text-slate-800 dark:text-slate-200">Детальные фильтры</h3>
            {totalActiveFilters > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                onClick={clearAllFilters}
              >
                <X size={12} className="mr-1" />
                Очистить все
              </Button>
            )}
          </div>
          <div className="relative">
            <Input
              placeholder="Поиск..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 text-sm pl-8 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 dark:text-slate-300"
            />
            <Filter size={14} className="absolute left-2.5 top-2 text-slate-400 dark:text-slate-500" />
          </div>
        </div>

        <Tabs defaultValue="departments" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-3 bg-slate-100 dark:bg-slate-800/80">
            <TabsTrigger
              value="departments"
              className={cn(
                "text-xs data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-none relative",
                activeDepartments > 0 && "font-medium",
              )}
            >
              <Building2 size={14} className="mr-1" />
              <span className="dark:text-slate-300">Отделы</span>
              {activeDepartments > 0 && (
                <Badge className="ml-1 h-4 min-w-4 text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                  {activeDepartments}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="teams"
              className={cn(
                "text-xs data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-none",
                activeTeams > 0 && "font-medium",
              )}
            >
              <Users size={14} className="mr-1" />
              <span className="dark:text-slate-300">Команды</span>
              {activeTeams > 0 && (
                <Badge className="ml-1 h-4 min-w-4 text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                  {activeTeams}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="employees"
              className={cn(
                "text-xs data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-none",
                activeEmployees > 0 && "font-medium",
              )}
            >
              <User size={14} className="mr-1" />
              <span className="dark:text-slate-300">Сотрудники</span>
              {activeEmployees > 0 && (
                <Badge className="ml-1 h-4 min-w-4 text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                  {activeEmployees}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[300px]">
            <TabsContent value="departments" className="mt-0 p-4">
              <div className="space-y-2">
                {filteredDepartments.map((department) => (
                  <div key={department.department_id} className="flex items-center space-x-2 py-1">
                    <Checkbox
                      id={`dept-${department.department_id}`}
                      checked={filters.departments.includes(department.department_id)}
                      onCheckedChange={() => updateFilter("departments", department.department_id)}
                      className="data-[state=checked]:bg-slate-700 data-[state=checked]:border-slate-700 dark:data-[state=checked]:bg-slate-500 dark:data-[state=checked]:border-slate-500"
                    />
                    <Label
                      htmlFor={`dept-${department.department_id}`}
                      className={cn(
                        "text-sm cursor-pointer",
                        filters.departments.includes(department.department_id)
                          ? "font-medium text-slate-800 dark:text-slate-200"
                          : "text-slate-600 dark:text-slate-400",
                      )}
                    >
                      {department.department_name}
                    </Label>
                  </div>
                ))}
                {filteredDepartments.length === 0 && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 py-2">Нет результатов</p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="teams" className="mt-0 p-4">
              <div className="space-y-2">
                {filteredTeams.map((team) => (
                  <div key={team.team_id} className="flex items-center space-x-2 py-1">
                    <Checkbox
                      id={`team-${team.team_id}`}
                      checked={filters.teams.includes(team.team_id)}
                      onCheckedChange={() => updateFilter("teams", team.team_id)}
                      className="data-[state=checked]:bg-slate-700 data-[state=checked]:border-slate-700 dark:data-[state=checked]:bg-slate-500 dark:data-[state=checked]:border-slate-500"
                    />
                    <Label
                      htmlFor={`team-${team.team_id}`}
                      className={cn(
                        "text-sm cursor-pointer",
                        filters.teams.includes(team.team_id)
                          ? "font-medium text-slate-800 dark:text-slate-200"
                          : "text-slate-600 dark:text-slate-400",
                      )}
                    >
                      {team.name}
                    </Label>
                  </div>
                ))}
                {filteredTeams.length === 0 && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 py-2">Нет результатов</p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="employees" className="mt-0 p-4">
              <div className="space-y-2">
                {filteredEmployees.map((employee) => (
                  <div key={employee.user_id} className="flex items-center space-x-2 py-1">
                    <Checkbox
                      id={`emp-${employee.user_id}`}
                      checked={filters.employees.includes(employee.user_id)}
                      onCheckedChange={() => updateFilter("employees", employee.user_id)}
                      className="data-[state=checked]:bg-slate-700 data-[state=checked]:border-slate-700 dark:data-[state=checked]:bg-slate-500 dark:data-[state=checked]:border-slate-500"
                    />
                    <Label
                      htmlFor={`emp-${employee.user_id}`}
                      className={cn(
                        "text-sm cursor-pointer",
                        filters.employees.includes(employee.user_id)
                          ? "font-medium text-slate-800 dark:text-slate-200"
                          : "text-slate-600 dark:text-slate-400",
                      )}
                    >
                      <div className="flex flex-col">
                        <span className="dark:text-slate-300">{getFullName(employee)}</span>
                        <span className="text-xs text-slate-500 dark:text-slate-500">{getTeamName(employee)}</span>
                      </div>
                    </Label>
                  </div>
                ))}
                {filteredEmployees.length === 0 && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 py-2">Нет результатов</p>
                )}
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <div className="p-3 border-t border-slate-100 dark:border-slate-700 flex justify-end bg-slate-50 dark:bg-slate-800/50">
          <Button
            variant="outline"
            size="sm"
            className="mr-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
            onClick={() => setOpen(false)}
          >
            Отмена
          </Button>
          <Button
            size="sm"
            onClick={applyFilters}
            className="bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white"
          >
            <Check size={14} className="mr-1" />
            Применить
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

