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
import type { DepartmentOption } from "../services/planningAnalyticsService"

interface DepartmentSelectorProps {
  options: DepartmentOption[]
  selectedIds: string[]
  onChange: (selectedIds: string[]) => void
  onRefresh: () => void
  isLoading?: boolean
}

export function DepartmentSelector({
  options,
  selectedIds,
  onChange,
  onRefresh,
  isLoading = false
}: DepartmentSelectorProps) {
  const [open, setOpen] = useState(false)

  // Обработчик изменения выбора
  const handleToggle = (id: string) => {
    let newSelected: string[]

    // Если кликнули на "Общее"
    if (id === "all") {
      if (selectedIds.includes("all")) {
        // Снимаем "Общее" - ничего не делаем или оставляем "Общее"
        newSelected = ["all"]
      } else {
        // Включаем "Общее" - сбрасываем все остальные
        newSelected = ["all"]
      }
    } else {
      // Кликнули на отдел
      if (selectedIds.includes(id)) {
        // Снимаем выбор с отдела
        newSelected = selectedIds.filter(sid => sid !== id)

        // Если ничего не осталось, выбираем "Общее"
        if (newSelected.length === 0 || newSelected.every(sid => sid === "all")) {
          newSelected = ["all"]
        }
      } else {
        // Добавляем отдел и убираем "Общее"
        newSelected = selectedIds.filter(sid => sid !== "all")
        newSelected.push(id)
      }
    }

    onChange(newSelected)
  }


  // Подсчёт выбранных
  const selectedCount = selectedIds.length

  const getButtonLabel = () => {
    if (isLoading) return "Загрузка..."
    if (selectedIds.includes("all") && selectedIds.length === 1) return "Общее"
    if (selectedIds.length === 0) return "Выберите отделы"
    if (selectedIds.length === 1) {
      const option = options.find(opt => opt.id === selectedIds[0])
      return option?.name || "Отдел"
    }
    return `Выбрано: ${selectedCount}`
  }

  // Обработчик переключения на "Все отделы"
  const handleSelectAll = () => {
    onChange(["all"])
  }

  // Обработчик выбора всех отделов планирования (все отделы с загрузками)
  const handleSelectPlanningDepartments = () => {
    const allDepartmentIds = filteredOptions.map(opt => opt.id)
    onChange(allDepartmentIds)
  }

  // Фильтруем опции - убираем "Общее" из списка
  const filteredOptions = options.filter(opt => opt.type !== "all")

  // Проверяем, активна ли кнопка "Все отделы"
  const isAllActive = selectedIds.includes("all") && selectedIds.length === 1

  // Проверяем, выбраны ли все отделы планирования
  const allDepartmentIds = filteredOptions.map(opt => opt.id)
  const isPlanningDepartmentsActive = allDepartmentIds.length > 0 &&
    allDepartmentIds.every(id => selectedIds.includes(id)) &&
    selectedIds.length === allDepartmentIds.length

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
        <div className="flex flex-col gap-2 px-2 py-2">
          <div className="flex items-center gap-2">
            <Button
              onClick={(e) => {
                e.stopPropagation()
                handleSelectAll()
              }}
              variant={isAllActive ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs px-3 gap-1.5 flex-1"
            >
              <BarChart3 className="h-3.5 w-3.5" />
              Общая аналитика
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
          <Button
            onClick={(e) => {
              e.stopPropagation()
              handleSelectPlanningDepartments()
            }}
            variant={isPlanningDepartmentsActive ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs px-3 gap-1.5 w-full"
            disabled={filteredOptions.length === 0}
          >
            <Building2 className="h-3.5 w-3.5" />
            Все отделы (с загрузками)
          </Button>
        </div>

        <DropdownMenuSeparator />

        {/* Список опций с квадратными чекбоксами (без "Общее") */}
        <div className="max-h-[300px] overflow-y-auto p-2">
          {filteredOptions.map((option) => {
            const isChecked = selectedIds.includes(option.id)

            return (
              <div
                key={option.id}
                className="flex items-center space-x-2 py-1 px-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded cursor-pointer"
                onClick={(e) => {
                  e.preventDefault()
                  handleToggle(option.id)
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
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
