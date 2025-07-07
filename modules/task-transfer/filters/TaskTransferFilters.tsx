import React, { useEffect } from 'react'
import { Filter, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTaskTransferFilterStore } from './store'
import { useTaskTransferStore } from '../store'
import { FilterSelect } from './FilterSelect'
import { taskTransferConfig } from './configs'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { useTheme } from 'next-themes'
import type { AssignmentDirection, AssignmentStatus } from '../types'

interface TaskTransferFiltersProps {
  direction: AssignmentDirection
  onFiltersChange: (filters: {
    direction: AssignmentDirection
    projectId: string | null
    stageId: string | null
    objectId: string | null
    departmentId: string | null
    teamId: string | null
    specialistId: string | null
    status: AssignmentStatus | null
  }) => void
}

export function TaskTransferFilters({
  direction,
  onFiltersChange
}: TaskTransferFiltersProps) {
  // Используем тему из useSettingsStore
  const { theme: storeTheme } = useSettingsStore()
  const { resolvedTheme } = useTheme()
  const currentTheme = (storeTheme === "system" ? resolvedTheme || "light" : storeTheme) as 'light' | 'dark'

  // Основной store с данными
  const { isLoading: isMainStoreLoading } = useTaskTransferStore()

  const {
    projects,
    stages,
    objects,
    departments,
    teams,
    specialists,
    selectedProjectId,
    selectedStageId,
    selectedObjectId,
    selectedDepartmentId,
    selectedTeamId,
    selectedSpecialistId,
    selectedStatus,
    isLoading,
    isLoadingStages,
    isLoadingObjects,
    initialize,
    setFilter,
    resetFilters,
    getFilteredStages,
    getFilteredObjects,
    getFilteredTeams,
    getFilteredSpecialists
  } = useTaskTransferFilterStore()

  // Инициализация фильтров после загрузки основных данных
  useEffect(() => {
    if (!isMainStoreLoading) {
      initialize(taskTransferConfig)
    }
  }, [initialize, isMainStoreLoading])

  // Уведомляем родительский компонент об изменениях фильтров
  useEffect(() => {
    onFiltersChange({
      direction,
      projectId: selectedProjectId,
      stageId: selectedStageId,
      objectId: selectedObjectId,
      departmentId: selectedDepartmentId,
      teamId: selectedTeamId,
      specialistId: selectedSpecialistId,
      status: selectedStatus
    })
  }, [
    direction,
    selectedProjectId,
    selectedStageId,
    selectedObjectId,
    selectedDepartmentId,
    selectedTeamId,
    selectedSpecialistId,
    selectedStatus,
    onFiltersChange
  ])

  const filteredStages = getFilteredStages()
  const filteredObjects = getFilteredObjects()
  const filteredTeams = getFilteredTeams()
  const filteredSpecialists = getFilteredSpecialists()

  const hasActiveFilters = !!(
    selectedProjectId || 
    selectedStageId || 
    selectedObjectId ||
    selectedDepartmentId || 
    selectedTeamId ||
    selectedSpecialistId ||
    selectedStatus
  )

  const isFilterLoading = isLoading || isMainStoreLoading

  // Опции для статусов
  const statusOptions = [
    { id: 'Создано', name: 'Создано' },
    { id: 'Передано', name: 'Передано' },
    { id: 'Принято', name: 'Принято' },
    { id: 'Выполнено', name: 'Выполнено' },
    { id: 'Согласовано', name: 'Согласовано' }
  ]

  return (
    <div className={cn(
      "rounded-lg border p-4 space-y-3",
      "bg-card border-border"
    )}>
      {/* Заголовок и сброс */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-primary" />
          <span className="text-sm font-medium text-foreground">
            Фильтры
          </span>
          {isFilterLoading && (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
          )}
        </div>
        
        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
          >
            <RotateCcw size={12} />
            Сбросить
          </button>
        )}
      </div>

      {/* Фильтры в две строки */}
      <div className="space-y-3">
        {/* Проектные фильтры и статус */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <FilterSelect
            id="project"
            label="Проект"
            value={selectedProjectId}
            onChange={(value) => setFilter('project', value)}
            disabled={isFilterLoading}
            options={projects}
            placeholder="Выберите проект"
            theme={currentTheme}
            loading={isFilterLoading}
          />

          <FilterSelect
            id="stage"
            label="Стадия"
            value={selectedStageId}
            onChange={(value) => setFilter('stage', value)}
            disabled={!selectedProjectId || isLoadingStages}
            options={filteredStages}
            placeholder="Выберите стадию"
            theme={currentTheme}
            loading={isLoadingStages}
          />

          <FilterSelect
            id="object"
            label="Объект"
            value={selectedObjectId}
            onChange={(value) => setFilter('object', value)}
            disabled={!selectedStageId || isLoadingObjects}
            options={filteredObjects}
            placeholder="Выберите объект"
            theme={currentTheme}
            loading={isLoadingObjects}
          />

          <FilterSelect
            id="status"
            label="Статус"
            value={selectedStatus}
            onChange={(value) => setFilter('status', value)}
            disabled={isFilterLoading}
            options={statusOptions}
            placeholder="Выберите статус"
            theme={currentTheme}
            loading={isFilterLoading}
          />
        </div>

        {/* Организационные фильтры */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <FilterSelect
            id="department"
            label="Отдел"
            value={selectedDepartmentId}
            onChange={(value) => setFilter('department', value)}
            disabled={isFilterLoading}
            options={departments}
            placeholder="Выберите отдел"
            theme={currentTheme}
            loading={isFilterLoading}
          />

          <FilterSelect
            id="team"
            label="Команда"
            value={selectedTeamId}
            onChange={(value) => setFilter('team', value)}
            disabled={isFilterLoading || !selectedDepartmentId}
            options={filteredTeams}
            placeholder="Выберите команду"
            theme={currentTheme}
            loading={isFilterLoading}
          />

          <FilterSelect
            id="specialist"
            label="Сотрудник"
            value={selectedSpecialistId}
            onChange={(value) => setFilter('specialist', value)}
            disabled={isFilterLoading || !selectedTeamId}
            options={filteredSpecialists}
            placeholder={!selectedTeamId ? "Сначала выберите команду" : "Выберите сотрудника"}
            theme={currentTheme}
            loading={isFilterLoading}
          />
        </div>
      </div>
    </div>
  )
} 