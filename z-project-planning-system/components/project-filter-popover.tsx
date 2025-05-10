"use client"

import { useState, useEffect, useMemo } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Check, FolderKanban, Search, ChevronDown, ChevronRight } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface ProjectFilterPopoverProps {
  projects: any[]
  selectedProjects: string[]
  onProjectsChange: (projectIds: string[]) => void
}

export function ProjectFilterPopover({ projects, selectedProjects, onProjectsChange }: ProjectFilterPopoverProps) {
  const [open, setOpen] = useState(false)
  const [localSelectedProjects, setLocalSelectedProjects] = useState<string[]>(selectedProjects)
  const [searchTerm, setSearchTerm] = useState("")
  const [expandedManagers, setExpandedManagers] = useState<Record<string, boolean>>({})

  // Группируем проекты по менеджерам
  const projectsByManager = useMemo(() => {
    const groupedProjects: Record<string, any[]> = {}

    projects.forEach((project) => {
      const managerName = project.user_to?.name || "Не назначен"
      const managerId = project.user_to?.id || "unassigned"

      if (!groupedProjects[managerId]) {
        groupedProjects[managerId] = {
          manager: {
            id: managerId,
            name: managerName,
          },
          projects: [],
        }
      }

      groupedProjects[managerId].projects.push(project)
    })

    return Object.values(groupedProjects)
  }, [projects])

  // Получаем информацию о выбранных менеджерах
  const selectedManagersInfo = useMemo(() => {
    const managersMap: Record<string, { name: string; count: number; total: number }> = {}

    projectsByManager.forEach((group) => {
      const selectedCount = group.projects.filter((project) => selectedProjects.includes(project.id)).length

      if (selectedCount > 0) {
        managersMap[group.manager.id] = {
          name: group.manager.name,
          count: selectedCount,
          total: group.projects.length,
        }
      }
    })

    return Object.values(managersMap)
  }, [projectsByManager, selectedProjects])

  // Инициализируем состояние развернутых менеджеров
  useEffect(() => {
    const expanded: Record<string, boolean> = {}
    projectsByManager.forEach((group) => {
      expanded[group.manager.id] = true
    })
    setExpandedManagers(expanded)
  }, [projectsByManager])

  // Обновляем локальные выбранные проекты при изменении внешних
  useEffect(() => {
    setLocalSelectedProjects(selectedProjects)
  }, [selectedProjects])

  // Функция для обновления выбранных проектов
  const toggleProject = (projectId: string) => {
    setLocalSelectedProjects((prev) => {
      // Если проект уже выбран
      if (prev.includes(projectId)) {
        // Если это единственный выбранный проект, не даем снять выбор
        if (prev.length === 1) return prev
        // Иначе удаляем проект из выбранных
        return prev.filter((id) => id !== projectId)
      } else {
        // Добавляем проект в выбранные
        return [...prev, projectId]
      }
    })
  }

  // Функция для выбора/снятия выбора со всех проектов менеджера
  const toggleManagerProjects = (managerId: string, managerProjects: any[]) => {
    const projectIds = managerProjects.map((project) => project.id)

    // Проверяем, все ли проекты менеджера выбраны
    const allSelected = projectIds.every((id) => localSelectedProjects.includes(id))

    if (allSelected) {
      // Если все проекты выбраны, снимаем выбор со всех, кроме случая когда это единственные выбранные проекты
      if (localSelectedProjects.length === projectIds.length) {
        // Не даем снять выбор с последнего проекта
        return
      }

      setLocalSelectedProjects((prev) => prev.filter((id) => !projectIds.includes(id)))
    } else {
      // Если не все проекты выбраны, выбираем все
      setLocalSelectedProjects((prev) => {
        const newSelection = [...prev]
        projectIds.forEach((id) => {
          if (!newSelection.includes(id)) {
            newSelection.push(id)
          }
        })
        return newSelection
      })
    }
  }

  // Функция для выбора всех проектов
  const selectAllProjects = () => {
    const allProjectIds = projects.map((project) => project.id)
    setLocalSelectedProjects(allProjectIds)
  }

  // Функция для переключения развернутости группы менеджера
  const toggleManagerExpanded = (managerId: string) => {
    setExpandedManagers((prev) => ({
      ...prev,
      [managerId]: !prev[managerId],
    }))
  }

  // Функция для применения фильтра
  const applyFilter = () => {
    // Проверяем, что хотя бы один проект выбран
    if (localSelectedProjects.length === 0 && projects.length > 0) {
      // Если нет выбранных проектов, выбираем первый
      onProjectsChange([projects[0].id])
    } else {
      onProjectsChange(localSelectedProjects)
    }
    setOpen(false)
  }

  // Фильтрация групп проектов по поисковому запросу
  const filteredProjectGroups = useMemo(() => {
    if (!searchTerm) return projectsByManager

    return projectsByManager
      .map((group) => {
        // Проверяем, содержит ли имя менеджера поисковый запрос
        const managerMatches = group.manager.name.toLowerCase().includes(searchTerm.toLowerCase())

        // Фильтруем проекты, которые соответствуют поисковому запросу
        const filteredProjects = group.projects.filter((project) =>
          project.name.toLowerCase().includes(searchTerm.toLowerCase()),
        )

        // Если имя менеджера соответствует или есть соответствующие проекты, включаем группу
        if (managerMatches || filteredProjects.length > 0) {
          return {
            ...group,
            projects: managerMatches ? group.projects : filteredProjects,
          }
        }

        return null
      })
      .filter(Boolean)
  }, [projectsByManager, searchTerm])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative mt-1">
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-7 w-7 p-0 flex items-center justify-center rounded-full border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700",
              selectedProjects.length > 0 &&
                "text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-600",
            )}
          >
            <FolderKanban size={14} className="text-slate-500 dark:text-slate-400" />
            {selectedProjects.length > 0 && (
              <div className="absolute top-0 -right-2 h-4 min-w-4 px-1 flex items-center justify-center bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-full">
                <span className="text-[10px] font-medium leading-none">{selectedProjects.length}</span>
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
          <h3 className="font-medium text-slate-800 dark:text-slate-200 mb-2">Выберите проекты</h3>
          <div className="relative">
            <Input
              placeholder="Поиск проектов или менеджеров..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 text-sm pl-8 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 dark:text-slate-300"
            />
            <Search size={14} className="absolute left-2.5 top-2 text-slate-400 dark:text-slate-500" />
          </div>
        </div>

        <ScrollArea className="h-[350px]">
          <div className="p-2">
            {filteredProjectGroups.length > 0 ? (
              filteredProjectGroups.map((group) => (
                <div key={group.manager.id} className="mb-2">
                  {/* Заголовок группы с чекбоксом для выбора всех проектов менеджера */}
                  <div
                    className="flex items-center p-2 bg-slate-50 dark:bg-slate-800/70 rounded-md cursor-pointer"
                    onClick={() => toggleManagerExpanded(group.manager.id)}
                  >
                    <div className="mr-2">
                      {expandedManagers[group.manager.id] ? (
                        <ChevronDown size={16} className="text-slate-500" />
                      ) : (
                        <ChevronRight size={16} className="text-slate-500" />
                      )}
                    </div>

                    <div className="flex items-center flex-1" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        id={`manager-${group.manager.id}`}
                        checked={group.projects.every((project) => localSelectedProjects.includes(project.id))}
                        onCheckedChange={() => toggleManagerProjects(group.manager.id, group.projects)}
                        className="data-[state=checked]:bg-slate-700 data-[state=checked]:border-slate-700 dark:data-[state=checked]:bg-slate-500 dark:data-[state=checked]:border-slate-500 mr-2"
                      />
                      <Label
                        htmlFor={`manager-${group.manager.id}`}
                        className="font-medium text-slate-800 dark:text-slate-200 cursor-pointer flex-1"
                      >
                        {group.manager.name}
                      </Label>
                      <Badge className="ml-auto bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                        {group.projects.length}
                      </Badge>
                    </div>
                  </div>

                  {/* Список проектов менеджера */}
                  {expandedManagers[group.manager.id] && (
                    <div className="ml-6 mt-1 space-y-1">
                      {group.projects.map((project) => (
                        <div key={project.id} className="flex items-center py-1 px-2">
                          <Checkbox
                            id={`project-${project.id}`}
                            checked={localSelectedProjects.includes(project.id)}
                            onCheckedChange={() => toggleProject(project.id)}
                            disabled={localSelectedProjects.includes(project.id) && localSelectedProjects.length === 1}
                            className="data-[state=checked]:bg-slate-700 data-[state=checked]:border-slate-700 dark:data-[state=checked]:bg-slate-500 dark:data-[state=checked]:border-slate-500 mr-2"
                          />
                          <Label
                            htmlFor={`project-${project.id}`}
                            className={cn(
                              "text-sm cursor-pointer",
                              localSelectedProjects.includes(project.id)
                                ? "font-medium text-slate-800 dark:text-slate-200"
                                : "text-slate-600 dark:text-slate-400",
                              localSelectedProjects.includes(project.id) && localSelectedProjects.length === 1
                                ? "text-slate-400 dark:text-slate-500"
                                : "",
                            )}
                          >
                            {project.name}
                          </Label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400 p-4 text-center">Нет результатов</p>
            )}
          </div>
        </ScrollArea>

        <div className="p-3 border-t border-slate-100 dark:border-slate-700 flex flex-wrap gap-2 bg-slate-50 dark:bg-slate-800/50">
          <Button
            variant="outline"
            size="sm"
            className="border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
            onClick={selectAllProjects}
          >
            Выбрать все
          </Button>
          <div className="flex gap-2 ml-auto">
            <Button
              variant="outline"
              size="sm"
              className="border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
              onClick={() => setOpen(false)}
            >
              Отмена
            </Button>
            <Button
              size="sm"
              onClick={applyFilter}
              className="bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white"
            >
              <Check size={14} className="mr-1" />
              Применить
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

