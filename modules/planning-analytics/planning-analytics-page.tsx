"use client"

import { useState, useMemo, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AlertCircle, X } from "lucide-react"
import { AnalyticsStats } from "./components/AnalyticsStats"
import { ProjectsLoadingChart } from "./components/ProjectsLoadingChart"
import { DepartmentSelector } from "./components/DepartmentSelector"
import { UsersWithoutLoading } from "./components/UsersWithoutLoading"
import { usePlanningAnalytics } from "./hooks/usePlanningAnalytics"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useRouter } from "next/navigation"

const STORAGE_KEY_DEPARTMENTS = "planning-analytics-selected-departments"
const STORAGE_KEY_SUBDIVISION = "planning-analytics-selected-subdivision"

export function PlanningAnalyticsPage() {
  const {
    departmentOptions,
    departmentStats,
    departmentProjects,
    isLoading,
    error,
    refresh,
    getAggregatedProjects,
    getAggregatedStats
  } = usePlanningAnalytics()
  const router = useRouter()

  // Загружаем выбранное подразделение из localStorage
  const [selectedSubdivision, setSelectedSubdivision] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY_SUBDIVISION)
      if (saved) {
        try {
          return JSON.parse(saved)
        } catch {
          return null
        }
      }
    }
    return null
  })

  // Загружаем выбранные отделы из localStorage
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY_DEPARTMENTS)
      if (saved) {
        try {
          return JSON.parse(saved)
        } catch {
          return []
        }
      }
    }
    return []
  })

  // Сохраняем выбор в localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_DEPARTMENTS, JSON.stringify(selectedDepartments))
    }
  }, [selectedDepartments])

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_SUBDIVISION, JSON.stringify(selectedSubdivision))
    }
  }, [selectedSubdivision])

  // Получаем агрегированные данные для графика
  const chartProjects = useMemo(() => {
    return getAggregatedProjects(selectedDepartments, selectedSubdivision)
  }, [selectedDepartments, selectedSubdivision, getAggregatedProjects])

  // Получаем агрегированную статистику
  const aggregatedStats = useMemo(() => {
    return getAggregatedStats(selectedDepartments, selectedSubdivision)
  }, [selectedDepartments, selectedSubdivision, getAggregatedStats])

  // Заголовок графика - упрощенный вариант
  const chartTitle = "Распределение ресурсов по проектам (топ-10)"

  // Фильтрация пользователей без загрузки по выбранным отделам
  const usersWithoutLoadingData = useMemo(() => {
    // Определяем, какие отделы нужно включить
    let departmentIdsToInclude: string[] = []

    // Если выбрано подразделение, но нет выбранных отделов → показываем все отделы подразделения
    if (selectedSubdivision && selectedDepartments.length === 0) {
      departmentStats.forEach(ds => {
        if (ds.subdivision_id === selectedSubdivision && !departmentIdsToInclude.includes(ds.department_id)) {
          departmentIdsToInclude.push(ds.department_id)
        }
      })
    }
    // Если есть выбранные отделы → показываем только их
    else if (selectedDepartments.length > 0) {
      departmentIdsToInclude = selectedDepartments
    }
    // Если ничего не выбрано → показываем все отделы
    else {
      return departmentStats
        .map(stat => ({
          department_name: stat.department_name,
          users: stat.users_without_loading || []
        }))
        .filter(dept => dept.users.length > 0)
    }

    return departmentStats
      .filter(stat => departmentIdsToInclude.includes(stat.department_id))
      .map(stat => ({
        department_name: stat.department_name,
        users: stat.users_without_loading || []
      }))
      .filter(dept => dept.users.length > 0)
  }, [selectedDepartments, selectedSubdivision, departmentStats])

  // Проверка загрузки в процессе (первая загрузка)
  if (isLoading && departmentProjects.length === 0) {
    return (
      <div className="min-h-screen dark:bg-[rgb(17_24_39)] bg-white flex justify-center pt-32">
        <div className="animate-spin rounded-full h-7 w-7 border-[3px] border-[rgb(20_182_166)] border-t-transparent"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6 px-6 pb-6 pt-4 min-h-screen dark:bg-[rgb(17_24_39)] relative">
      {/* Заголовок с селектором отделов и кнопками */}
      <div className="flex items-center gap-6">
        <h1 className="text-3xl font-bold text-foreground dark:text-white whitespace-nowrap">
          Аналитика планирования
        </h1>

        {/* Селектор отделов справа */}
        <div className="flex items-center gap-2 ml-auto">
          <DepartmentSelector
            options={departmentOptions}
            selectedIds={selectedDepartments}
            selectedSubdivisionId={selectedSubdivision}
            onChange={setSelectedDepartments}
            onSubdivisionChange={setSelectedSubdivision}
            onRefresh={refresh}
            isLoading={isLoading}
            departmentProjects={departmentProjects}
          />
          <Button
            onClick={() => router.back()}
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700"
            aria-label="Закрыть"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Подзаголовок */}
      <p className="text-sm text-muted-foreground -mt-5">
        Статистика по загрузкам и распределению ресурсов на сегодня
      </p>

      {/* Ошибка */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Ошибка загрузки данных</AlertTitle>
          <AlertDescription>
            {error.message}
          </AlertDescription>
        </Alert>
      )}

      {/* Статистика - 4 карточки (показываем всегда) */}
      <AnalyticsStats
        stats={aggregatedStats}
        isLoading={isLoading}
      />

      {/* Единый график */}
      <ProjectsLoadingChart
        projects={chartProjects}
        isLoading={isLoading}
        title={chartTitle}
        chartHeight={425}
        selectedDepartmentIds={selectedDepartments}
        departmentOptions={departmentOptions}
        selectedSubdivisionId={selectedSubdivision}
      />

      {/* Список пользователей без загрузки */}
      <UsersWithoutLoading
        data={usersWithoutLoadingData}
        isLoading={isLoading}
      />
    </div>
  )
}
