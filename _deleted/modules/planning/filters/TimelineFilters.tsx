import React, { useEffect, useState } from 'react'
import { X, ChevronDown, ChevronRight, Filter, RotateCcw, HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useFilterStore } from './store'
import { FilterSelect } from './FilterSelect'
import { timelineConfig } from './configs'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { useTheme } from 'next-themes'
import { usePlanningStore } from '../stores/usePlanningStore'
import { NavigationControls } from '../components/timeline/navigation-controls'
import { Pagination } from '../components/pagination'

interface TimelineFiltersProps {
  onProjectChange: (projectId: string | null) => void
  onDepartmentChange: (departmentId: string | null) => void
  onTeamChange: (teamId: string | null) => void
  onEmployeeChange: (employeeId: string | null) => void
  onManagerChange: (managerId: string | null) => void
  onStageChange?: (stageId: string | null) => void
  onObjectChange?: (objectId: string | null) => void
  onResetFilters: () => void
  // Добавляем пропсы для элементов управления
  currentPage?: number
  totalPages?: number
  onPageChange?: (page: number) => void
  onScrollBackward?: () => void
  onScrollForward?: () => void
  startDate?: Date | string
  daysToShow?: number
  onTodayClick?: () => void
  onShowGuide?: () => void // Добавляем обработчик для показа руководства
}

export function TimelineFilters({
  onProjectChange,
  onDepartmentChange,
  onTeamChange,
  onEmployeeChange,
  onManagerChange,
  onStageChange,
  onObjectChange,
  onResetFilters,
  currentPage,
  totalPages,
  onPageChange,
  onScrollBackward,
  onScrollForward,
  startDate,
  daysToShow,
  onTodayClick,
  onShowGuide
}: TimelineFiltersProps) {
  const { theme: systemTheme } = useTheme()
  const { theme: settingsTheme } = useSettingsStore()
  const theme = (settingsTheme === 'system' ? systemTheme : settingsTheme) as 'light' | 'dark'
  
  // Состояние для сворачивания фильтров
  const [isCollapsed, setIsCollapsed] = useState(false)

  // Состояние видимости разделов и отделов (не используется в данном компоненте)
  // const { showSections, showDepartments } = usePlanningStore()

  const {
    managers,
    projects,
    stages,
    objects,
    departments,
    teams,
    employees,
    selectedManagerId,
    selectedProjectId,
    selectedStageId,
    selectedObjectId,
    selectedDepartmentId,
    selectedTeamId,
    selectedEmployeeId,
    isLoading,
    isLoadingProjects,
    isLoadingStages,
    isLoadingObjects,
    initialize,
    setFilter,
    resetFilters,
    isFilterLocked,
    getFilteredProjects,
    getFilteredStages,
    getFilteredObjects,
    getFilteredEmployees
  } = useFilterStore()

  useEffect(() => {
    initialize(timelineConfig)
  }, [initialize])

  useEffect(() => {
    onProjectChange(selectedProjectId)
  }, [selectedProjectId, onProjectChange])

  useEffect(() => {
    onDepartmentChange(selectedDepartmentId)
  }, [selectedDepartmentId, onDepartmentChange])

  useEffect(() => {
    onTeamChange(selectedTeamId)
  }, [selectedTeamId, onTeamChange])

  useEffect(() => {
    onEmployeeChange(selectedEmployeeId)
  }, [selectedEmployeeId, onEmployeeChange])

  useEffect(() => {
    onManagerChange(selectedManagerId)
  }, [selectedManagerId, onManagerChange])

  useEffect(() => {
    if (onStageChange) {
      onStageChange(selectedStageId)
    }
  }, [selectedStageId, onStageChange])

  useEffect(() => {
    if (onObjectChange) {
      onObjectChange(selectedObjectId)
    }
  }, [selectedObjectId, onObjectChange])

  const handleReset = () => {
    resetFilters()
    onResetFilters()
  }

  const filteredProjects = getFilteredProjects()
  const filteredStages = getFilteredStages()
  const filteredObjects = getFilteredObjects()
  const filteredTeams = teams.filter(team => 
    !selectedDepartmentId || team.departmentId === selectedDepartmentId
  )
  const filteredEmployees = getFilteredEmployees()

  const hasActiveFilters = !!(
    selectedManagerId || 
    selectedProjectId || 
    selectedStageId || 
    selectedObjectId ||
    selectedDepartmentId || 
    selectedTeamId ||
    selectedEmployeeId
  )

  // Подсчёт количества активных фильтров
  const activeFiltersCount = [
    selectedManagerId,
    selectedProjectId,
    selectedStageId,
    selectedObjectId,
    selectedDepartmentId,
    selectedTeamId,
    selectedEmployeeId
  ].filter(Boolean).length

  return (
    <div className={cn(
      "rounded-lg border p-4 space-y-3",
      theme === 'dark' 
        ? "bg-slate-800/50 border-slate-700" 
        : "bg-white border-slate-200"
    )}>
      {/* Заголовок и кнопки */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={cn(
              "flex items-center gap-2 p-1 rounded-md transition-colors",
              theme === 'dark' 
                ? "hover:bg-slate-700 text-slate-300" 
                : "hover:bg-slate-100 text-slate-700"
            )}
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
            <Filter size={16} className={theme === 'dark' ? "text-teal-400" : "text-teal-600"} />
            <span className={cn(
              "text-sm font-medium",
              theme === 'dark' ? "text-white" : "text-slate-900"
            )}>
              Фильтры
            </span>
            {/* Индикатор активных фильтров в свёрнутом состоянии */}
            {isCollapsed && hasActiveFilters && (
              <div className={cn(
                "flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-xs font-medium ml-2",
                theme === 'dark' 
                  ? "bg-teal-500 text-white" 
                  : "bg-teal-500 text-white"
              )}>
                {activeFiltersCount}
              </div>
            )}
          </button>
        </div>
        
        {/* Элементы управления и кнопка сброса */}
        <div className="flex items-center gap-4">
          {/* Пагинация */}
          {totalPages && totalPages > 1 && onPageChange && currentPage && (
            <Pagination 
              currentPage={currentPage} 
              totalPages={totalPages} 
              onPageChange={onPageChange} 
              theme={theme} 
            />
          )}

          {/* Кнопка руководства */}
          {onShowGuide && (
            <button
              onClick={onShowGuide}
              className={cn(
                "flex items-center gap-2 px-3 py-2 text-sm rounded-md border transition-colors",
                theme === 'dark' 
                  ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-slate-200" 
                  : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50 hover:text-slate-900"
              )}
              title="Открыть руководство по планированию"
            >
              <HelpCircle className="h-4 w-4" />
              Руководство
            </button>
          )}

          {/* Элементы управления навигацией */}
          {onScrollBackward && onScrollForward && startDate && daysToShow && onTodayClick && (
            <NavigationControls
              theme={theme}
              onScrollBackward={onScrollBackward}
              onScrollForward={onScrollForward}
              startDate={startDate}
              daysToShow={daysToShow}
              onTodayClick={onTodayClick}
            />
          )}

          {/* Кнопка сброса фильтров */}
          {hasActiveFilters && (
            <button
              onClick={handleReset}
              className={cn(
                "flex items-center gap-1 px-2 py-1 text-xs rounded-md",
                theme === 'dark'
                  ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              )}
            >
              <RotateCcw size={12} />
              Сбросить
            </button>
          )}
        </div>
      </div>

      {/* Фильтры в две строки */}
      {!isCollapsed && (
        <div className="space-y-3">
        {/* Проектные фильтры */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <FilterSelect
            id="manager"
            label="Руководитель проекта"
            value={selectedManagerId}
            onChange={(value) => setFilter('manager', value)}
            disabled={isLoading}
            locked={false}
            options={managers}
            placeholder="Выберите руководителя проекта"
            theme={theme}
            loading={isLoading}
          />

          <FilterSelect
            id="project"
            label="Проект"
            value={selectedProjectId}
            onChange={(value) => setFilter('project', value)}
            disabled={isLoading || isLoadingProjects}
            locked={false}
            options={filteredProjects}
            placeholder="Выберите проект"
            theme={theme}
            loading={isLoadingProjects}
          />

          <FilterSelect
            id="stage"
            label="Стадия"
            value={selectedStageId}
            onChange={(value) => setFilter('stage', value)}
            disabled={!selectedProjectId || isLoadingStages}
            locked={false}
            options={filteredStages}
            placeholder="Выберите стадию"
            theme={theme}
            loading={isLoadingStages}
          />

          <FilterSelect
            id="object"
            label="Объект"
            value={selectedObjectId}
            onChange={(value) => setFilter('object', value)}
            disabled={!selectedProjectId || isLoadingObjects}
            locked={isFilterLocked('object')}
            options={filteredObjects}
            placeholder="Выберите объект"
            theme={theme}
            loading={isLoadingObjects}
          />
        </div>

        {/* Организационные фильтры */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <FilterSelect
            id="department"
            label="Отдел"
            value={selectedDepartmentId}
            onChange={(value) => setFilter('department', value)}
            disabled={isLoading}
            locked={false}
            options={departments}
            placeholder="Выберите отдел"
            theme={theme}
            loading={isLoading}
          />

          <FilterSelect
            id="team"
            label="Команда"
            value={selectedTeamId}
            onChange={(value) => setFilter('team', value)}
            disabled={isLoading || !selectedDepartmentId}
            locked={false}
            options={filteredTeams}
            placeholder="Выберите команду"
            theme={theme}
            loading={isLoading}
          />

          <FilterSelect
            id="employee"
            label="Сотрудник"
            value={selectedEmployeeId}
            onChange={(value) => setFilter('employee', value)}
            disabled={isLoading || !selectedTeamId}
            locked={false}
            options={filteredEmployees}
            placeholder={!selectedTeamId ? "Сначала выберите команду" : "Выберите сотрудника"}
            theme={theme}
            loading={isLoading}
          />
        </div>


        </div>
      )}
    </div>
  )
} 