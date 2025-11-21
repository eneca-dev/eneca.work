"use client"

import { useState } from "react"
import { ChevronDown, RefreshCw, BarChart3, Building2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Checkbox } from "@/components/ui/checkbox"
import type { DepartmentOption, DepartmentProjectData } from "../services/planningAnalyticsService"

interface DepartmentSelectorProps {
  options: DepartmentOption[]
  selectedIds: string[]
  selectedSubdivisionId: string | null
  onChange: (selectedIds: string[]) => void
  onSubdivisionChange: (subdivisionId: string | null) => void
  onRefresh: () => void
  isLoading?: boolean
  departmentProjects: DepartmentProjectData[]
}

export function DepartmentSelector({
  options,
  selectedIds,
  selectedSubdivisionId,
  onChange,
  onSubdivisionChange,
  onRefresh,
  isLoading = false,
  departmentProjects
}: DepartmentSelectorProps) {
  const [open, setOpen] = useState(false)

  // Обработчик изменения выбора
  const handleToggle = (id: string, type: "subdivision" | "department") => {
    if (type === "subdivision") {
      if (selectedSubdivisionId === id) {
        // Снимаем выделение подразделения
        onSubdivisionChange(null)
        // НЕ очищаем отделы - они валидны в режиме "все отделы"
      } else {
        // Выбираем НОВОЕ подразделение
        onSubdivisionChange(id)
        // Очищаем выбранные отделы, т.к. они могут быть из другого подразделения
        onChange([])
      }
    } else {
      // Клик на отдел → переключаем его выбор
      if (selectedIds.includes(id)) {
        onChange(selectedIds.filter(sid => sid !== id))
      } else {
        onChange([...selectedIds, id])
      }
    }
  }

  // Разделяем опции по типам
  const subdivisionOptions = options.filter(opt => opt.type === "subdivision")

  // Фильтруем отделы по выбранному подразделению
  const departmentOptions = options.filter(opt => {
    if (opt.type !== "department") return false

    // Если подразделение не выбрано, показываем все отделы
    if (!selectedSubdivisionId) return true

    // Если подразделение выбрано, показываем только его отделы
    const departmentData = departmentProjects.find(dp => dp.department_id === opt.id)
    return departmentData?.subdivision_id === selectedSubdivisionId
  })

  const getButtonLabel = () => {
    if (isLoading) return "Загрузка..."

    // Если выбрано подразделение
    if (selectedSubdivisionId) {
      const subdivisionOption = options.find(opt => opt.id === selectedSubdivisionId && opt.type === "subdivision")
      const selectedCount = selectedIds.length

      if (selectedCount === 0) {
        return subdivisionOption?.name || "Подразделение"
      } else if (selectedCount === 1) {
        const departmentOption = options.find(opt => opt.id === selectedIds[0] && opt.type === "department")
        return `${subdivisionOption?.name} / ${departmentOption?.name}`
      } else {
        return `${subdivisionOption?.name} (${selectedCount})`
      }
    }

    // Если ничего не выбрано
    if (selectedIds.length === 0) {
      return "Все отделы"
    }

    // Если выбран один отдел
    if (selectedIds.length === 1) {
      const option = options.find(opt => opt.id === selectedIds[0])
      return option?.name || "Отдел"
    }

    return `Выбрано: ${selectedIds.length}`
  }

  // Обработчик сброса фильтра
  const handleResetFilter = () => {
    onSubdivisionChange(null)
    onChange([])
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="w-[280px] justify-between bg-white dark:bg-[rgb(15_23_42)] border-gray-200 dark:border-slate-600"
          disabled={isLoading}
        >
          <span className="truncate">{getButtonLabel()}</span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[280px] bg-white dark:bg-[rgb(15_23_42)]">
        {/* Кнопки управления */}
        <div className="flex items-center gap-2 px-2 py-2">
          <Button
            onClick={(e) => {
              e.stopPropagation()
              handleResetFilter()
            }}
            variant="outline"
            size="sm"
            className="h-7 text-xs px-3 gap-1.5 flex-1"
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Сбросить фильтр
          </Button>
          <Button
            onClick={(e) => {
              e.stopPropagation()
              onRefresh()
            }}
            variant="outline"
            size="sm"
            disabled={isLoading}
            className="h-7 w-7 p-0"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <DropdownMenuSeparator />

        {/* Список опций с квадратными чекбоксами */}
        <div className="max-h-[300px] overflow-y-auto p-2">
          {/* Секция подразделений */}
          {subdivisionOptions.length > 0 && (
            <>
              <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase">
                Подразделения
              </div>
              {subdivisionOptions.map((option) => {
                const isChecked = selectedSubdivisionId === option.id

                return (
                  <div
                    key={option.id}
                    className="flex items-center space-x-2 py-1 px-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded cursor-pointer"
                    onClick={(e) => {
                      e.preventDefault()
                      handleToggle(option.id, "subdivision")
                    }}
                  >
                    <Checkbox
                      id={option.id}
                      checked={isChecked}
                      className="h-4 w-4 pointer-events-none"
                    />
                    <label
                      htmlFor={option.id}
                      className="flex-1 cursor-pointer text-sm"
                    >
                      <span className="truncate">{option.name}</span>
                    </label>
                  </div>
                )
              })}
              <DropdownMenuSeparator className="my-2" />
            </>
          )}

          {/* Секция отделов */}
          {departmentOptions.length > 0 && (
            <>
              <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase">
                Отделы
              </div>
              {departmentOptions.map((option) => {
                const isChecked = selectedIds.includes(option.id)

                return (
                  <div
                    key={option.id}
                    className="flex items-center space-x-2 py-1 px-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded cursor-pointer"
                    onClick={(e) => {
                      e.preventDefault()
                      handleToggle(option.id, "department")
                    }}
                  >
                    <Checkbox
                      id={option.id}
                      checked={isChecked}
                      className="h-4 w-4 pointer-events-none"
                    />
                    <label
                      htmlFor={option.id}
                      className="flex-1 cursor-pointer text-sm"
                    >
                      <span className="truncate">{option.name}</span>
                    </label>
                  </div>
                )
              })}
            </>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
