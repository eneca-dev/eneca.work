"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { ChevronDown, ChevronUp, Filter, Building2, Home, Briefcase } from "lucide-react"
import { useEffect, useState } from "react"
import type { User } from "../lib/types"

// Обновим интерфейс UserFiltersProps, чтобы включить workLocations
interface UserFiltersProps {
  onFilterChange?: (filters: {
    departments: string[]
    teams: string[]
    categories: string[]
    positions: string[]
    workLocations: string[]
  }) => void
  users: User[] // Добавим пользователей для фильтрации
}

export function UserFilters({ onFilterChange, users }: UserFiltersProps) {
  const [openDepartments, setOpenDepartments] = useState(true)
  const [openTeams, setOpenTeams] = useState(true)
  const [openCategories, setOpenCategories] = useState(true)
  const [openPositions, setOpenPositions] = useState(true)
  const [openWorkLocations, setOpenWorkLocations] = useState(true) // Добавим состояние для расположения

  const [departments, setDepartments] = useState<string[]>([])
  const [teams, setTeams] = useState<string[]>([])
  const [positions, setPositions] = useState<string[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [workLocations, setWorkLocations] = useState<string[]>([]) // Добавим состояние для расположений
  const [isLoading, setIsLoading] = useState(true)

  // Состояние для выбранных фильтров
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([])
  const [selectedTeams, setSelectedTeams] = useState<string[]>([])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedPositions, setSelectedPositions] = useState<string[]>([])
  const [selectedWorkLocations, setSelectedWorkLocations] = useState<string[]>([]) // Добавим состояние для выбранных расположений

  // Загрузка данных при монтировании компонента
  useEffect(() => {
    if (users && users.length > 0) {
      setIsLoading(true)

      // Получаем уникальные значения из пользователей
      const uniqueDepartments = [...new Set(users.map((user) => user.department))].filter(Boolean).sort()
      const uniqueTeams = [...new Set(users.map((user) => user.team))].filter(Boolean).sort()
      const uniquePositions = [...new Set(users.map((user) => user.position))].filter(Boolean).sort()
      const uniqueCategories = [...new Set(users.map((user) => user.category))].filter(Boolean).sort()
      const uniqueWorkLocations = [...new Set(users.map((user) => user.workLocation))].filter(Boolean).sort()

      setDepartments(uniqueDepartments)
      setTeams(uniqueTeams)
      setPositions(uniquePositions)
      setCategories(uniqueCategories)
      setWorkLocations(uniqueWorkLocations as string[])

      setIsLoading(false)
    }
  }, [users])

  // Изменим обработчики фильтров, чтобы они сразу применялись при выборе

  // Обработчики изменения фильтров
  const handleDepartmentChange = (departmentName: string, checked: boolean) => {
    const newDepartments = checked
      ? [...selectedDepartments, departmentName]
      : selectedDepartments.filter((d) => d !== departmentName)

    setSelectedDepartments(newDepartments)

    // Сразу применяем фильтр
    if (onFilterChange) {
      onFilterChange({
        departments: newDepartments,
        teams: selectedTeams,
        categories: selectedCategories,
        positions: selectedPositions,
        workLocations: selectedWorkLocations,
      })
    }
  }

  const handleTeamChange = (teamName: string, checked: boolean) => {
    const newTeams = checked ? [...selectedTeams, teamName] : selectedTeams.filter((t) => t !== teamName)

    setSelectedTeams(newTeams)

    // Сразу применяем фильтр
    if (onFilterChange) {
      onFilterChange({
        departments: selectedDepartments,
        teams: newTeams,
        categories: selectedCategories,
        positions: selectedPositions,
        workLocations: selectedWorkLocations,
      })
    }
  }

  const handleCategoryChange = (categoryName: string, checked: boolean) => {
    const newCategories = checked
      ? [...selectedCategories, categoryName]
      : selectedCategories.filter((c) => c !== categoryName)

    setSelectedCategories(newCategories)

    // Сразу применяем фильтр
    if (onFilterChange) {
      onFilterChange({
        departments: selectedDepartments,
        teams: selectedTeams,
        categories: newCategories,
        positions: selectedPositions,
        workLocations: selectedWorkLocations,
      })
    }
  }

  const handlePositionChange = (positionName: string, checked: boolean) => {
    const newPositions = checked
      ? [...selectedPositions, positionName]
      : selectedPositions.filter((p) => p !== positionName)

    setSelectedPositions(newPositions)

    // Сразу применяем фильтр
    if (onFilterChange) {
      onFilterChange({
        departments: selectedDepartments,
        teams: selectedTeams,
        categories: selectedCategories,
        positions: newPositions,
        workLocations: selectedWorkLocations,
      })
    }
  }

  // Добавим обработчик изменения фильтра по расположению
  const handleWorkLocationChange = (locationName: string, checked: boolean) => {
    const newWorkLocations = checked
      ? [...selectedWorkLocations, locationName]
      : selectedWorkLocations.filter((l) => l !== locationName)

    setSelectedWorkLocations(newWorkLocations)

    // Сразу применяем фильтр
    if (onFilterChange) {
      onFilterChange({
        departments: selectedDepartments,
        teams: selectedTeams,
        categories: selectedCategories,
        positions: selectedPositions,
        workLocations: newWorkLocations,
      })
    }
  }

  // Обновим функцию сброса фильтров
  const resetFilters = () => {
    setSelectedDepartments([])
    setSelectedTeams([])
    setSelectedCategories([])
    setSelectedPositions([])
    setSelectedWorkLocations([])

    if (onFilterChange) {
      onFilterChange({
        departments: [],
        teams: [],
        categories: [],
        positions: [],
        workLocations: [],
      })
    }
  }

  // Функция для получения иконки и названия расположения
  const getWorkLocationInfo = (location: string) => {
    switch (location) {
      case "office":
        return { icon: <Building2 className="h-4 w-4 mr-2 text-blue-600 dark:text-blue-400" />, label: "В офисе" }
      case "remote":
        return { icon: <Home className="h-4 w-4 mr-2 text-green-600 dark:text-green-400" />, label: "Удаленно" }
      case "hybrid":
        return { icon: <Briefcase className="h-4 w-4 mr-2 text-purple-600 dark:text-purple-400" />, label: "Гибридный" }
      default:
        return { icon: null, label: location }
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center">
          <Filter className="mr-2 h-4 w-4" />
          Фильтры
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {isLoading ? (
          <div className="py-4 text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-500">Загрузка фильтров...</p>
          </div>
        ) : (
          <>
            <Collapsible open={openDepartments} onOpenChange={setOpenDepartments}>
              <CollapsibleTrigger className="flex w-full items-center justify-between py-1">
                <h4 className="text-sm font-medium">Отделы</h4>
                {openDepartments ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 pb-4">
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                  {departments.map((department) => (
                    <div key={department} className="flex items-center space-x-2">
                      <Checkbox
                        id={`department-${department}`}
                        checked={selectedDepartments.includes(department)}
                        onCheckedChange={(checked) => handleDepartmentChange(department, checked === true)}
                      />
                      <Label htmlFor={`department-${department}`} className="text-sm">
                        {department}
                      </Label>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            <Collapsible open={openTeams} onOpenChange={setOpenTeams}>
              <CollapsibleTrigger className="flex w-full items-center justify-between py-1">
                <h4 className="text-sm font-medium">Команды</h4>
                {openTeams ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 pb-4">
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                  {teams.map((team) => (
                    <div key={team} className="flex items-center space-x-2">
                      <Checkbox
                        id={`team-${team}`}
                        checked={selectedTeams.includes(team)}
                        onCheckedChange={(checked) => handleTeamChange(team, checked === true)}
                      />
                      <Label htmlFor={`team-${team}`} className="text-sm">
                        {team}
                      </Label>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            <Collapsible open={openPositions} onOpenChange={setOpenPositions}>
              <CollapsibleTrigger className="flex w-full items-center justify-between py-1">
                <h4 className="text-sm font-medium">Должности</h4>
                {openPositions ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 pb-4">
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                  {positions.map((position) => (
                    <div key={position} className="flex items-center space-x-2">
                      <Checkbox
                        id={`position-${position}`}
                        checked={selectedPositions.includes(position)}
                        onCheckedChange={(checked) => handlePositionChange(position, checked === true)}
                      />
                      <Label htmlFor={`position-${position}`} className="text-sm">
                        {position}
                      </Label>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            <Collapsible open={openCategories} onOpenChange={setOpenCategories}>
              <CollapsibleTrigger className="flex w-full items-center justify-between py-1">
                <h4 className="text-sm font-medium">Категории</h4>
                {openCategories ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 pb-4">
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                  {categories.map((category) => (
                    <div key={category} className="flex items-center space-x-2">
                      <Checkbox
                        id={`category-${category}`}
                        checked={selectedCategories.includes(category)}
                        onCheckedChange={(checked) => handleCategoryChange(category, checked === true)}
                      />
                      <Label htmlFor={`category-${category}`} className="text-sm">
                        {category}
                      </Label>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            {/* Добавим секцию фильтра по расположению */}
            <Collapsible open={openWorkLocations} onOpenChange={setOpenWorkLocations}>
              <CollapsibleTrigger className="flex w-full items-center justify-between py-1">
                <h4 className="text-sm font-medium">Расположение</h4>
                {openWorkLocations ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 pb-4">
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                  {workLocations.map((location) => {
                    const locationInfo = getWorkLocationInfo(location)
                    return (
                      <div key={location} className="flex items-center space-x-2">
                        <Checkbox
                          id={`location-${location}`}
                          checked={selectedWorkLocations.includes(location)}
                          onCheckedChange={(checked) => handleWorkLocationChange(location, checked === true)}
                        />
                        <Label htmlFor={`location-${location}`} className="text-sm flex items-center">
                          {locationInfo.icon}
                          {locationInfo.label}
                        </Label>
                      </div>
                    )
                  })}
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            <div className="flex flex-col gap-2 pt-2">
              <Button variant="outline" size="sm" className="w-full" onClick={resetFilters}>
                Сбросить все фильтры
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
