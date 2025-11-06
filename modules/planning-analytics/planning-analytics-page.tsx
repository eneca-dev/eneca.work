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

const STORAGE_KEY = "planning-analytics-selected-departments"

export function PlanningAnalyticsPage() {
  const {
    summary,
    departmentOptions,
    departmentStats,
    isLoading,
    error,
    refresh,
    getAggregatedProjects,
    getAggregatedStats
  } = usePlanningAnalytics()
  const router = useRouter()

  // Загружаем выбранные отделы из localStorage
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        try {
          return JSON.parse(saved)
        } catch {
          return ["all"]
        }
      }
    }
    return ["all"]
  })

  // Сохраняем выбор в localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedDepartments))
    }
  }, [selectedDepartments])

  // Получаем агрегированные данные для графика
  const chartProjects = useMemo(() => {
    return getAggregatedProjects(selectedDepartments)
  }, [selectedDepartments, getAggregatedProjects])

  // Получаем агрегированную статистику
  const aggregatedStats = useMemo(() => {
    return getAggregatedStats(selectedDepartments)
  }, [selectedDepartments, getAggregatedStats])

  // Заголовок графика - упрощенный вариант
  const chartTitle = "Распределение ресурсов по проектам (топ-10)"

  // Фильтрация пользователей без загрузки по выбранным отделам
  const usersWithoutLoadingData = useMemo(() => {
    // Если выбрано "Общее" - показываем все отделы
    if (selectedDepartments.includes("all") && selectedDepartments.length === 1) {
      return departmentStats
        .map(stat => ({
          department_name: stat.department_name,
          users: stat.users_without_loading || []
        }))
        .filter(dept => dept.users.length > 0)
    }

    // Фильтруем только выбранные отделы
    const departmentIds = selectedDepartments.filter(id => id !== "all")

    if (departmentIds.length === 0) {
      return []
    }

    return departmentStats
      .filter(stat => departmentIds.includes(stat.department_id))
      .map(stat => ({
        department_name: stat.department_name,
        users: stat.users_without_loading || []
      }))
      .filter(dept => dept.users.length > 0)
  }, [selectedDepartments, departmentStats])

  // Проверка загрузки в процессе (первая загрузка)
  if (isLoading && !summary) {
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
            onChange={setSelectedDepartments}
            onRefresh={refresh}
            isLoading={isLoading}
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
      />

      {/* Список пользователей без загрузки */}
      <UsersWithoutLoading
        data={usersWithoutLoadingData}
        isLoading={isLoading}
      />
    </div>
  )
}
