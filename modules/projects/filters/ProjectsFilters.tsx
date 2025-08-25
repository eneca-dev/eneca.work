import React, { useEffect } from 'react'
import { X, ChevronDown, ChevronRight, Filter, RotateCcw, Eye, EyeOff, Expand, Minimize } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useFilterStore } from './store'
import { FilterSelect } from './FilterSelect'
import { OrganizationFilters } from './OrganizationFilters'
import { projectsConfig } from './configs'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { useTheme } from 'next-themes'
import { SyncButton } from '@/components/ui/sync-button'

interface ProjectsFiltersProps {
  onProjectChange: (projectId: string | null) => void
  onDepartmentChange: (departmentId: string | null) => void
  onTeamChange: (teamId: string | null) => void
  onEmployeeChange: (employeeId: string | null) => void
  onManagerChange: (managerId: string | null) => void
  onStageChange?: (stageId: string | null) => void
  onObjectChange?: (objectId: string | null) => void
  onResetFilters: () => void
}

export function ProjectsFilters({
  onProjectChange,
  onDepartmentChange,
  onTeamChange,
  onEmployeeChange,
  onManagerChange,
  onStageChange,
  onObjectChange,
  onResetFilters
}: ProjectsFiltersProps) {
  const { theme: systemTheme } = useTheme()
  const { theme: settingsTheme } = useSettingsStore()
  const theme = (settingsTheme === 'system' ? systemTheme : settingsTheme) as 'light' | 'dark'
  
  // Состояние свернутости фильтров
  const [isCollapsed, setIsCollapsed] = React.useState(false)

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
    console.log('🎯 Инициализация ProjectsFilters...')
    initialize(projectsConfig)
  }, [initialize])

  // Логируем состояние менеджеров
  useEffect(() => {
    console.log('👥 Менеджеры в компоненте:', managers)
  }, [managers])

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
          
          {/* Информация о правах доступа */}
          {!isCollapsed && (
            <div className={cn(
              "text-xs px-2 py-1 rounded-md",
              theme === 'dark' 
                ? "bg-slate-700/50 text-slate-400 border border-slate-600/50" 
                : "bg-slate-100 text-slate-600 border border-slate-200"
            )}>
              🔒 Фильтры автоматически настраиваются на основе ваших прав доступа
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
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
            <div className="space-y-2">
              <FilterSelect
                id="manager"
                label="Руководитель проекта"
                value={selectedManagerId}
                onChange={(value) => setFilter('manager', value)}
                disabled={isLoading}
                locked={isFilterLocked('manager')}
                options={managers}
                placeholder="Выберите руководителя проекта"
                theme={theme}
                loading={isLoading}
              />
              {isFilterLocked('manager') && (
                <p className={cn(
                  "text-xs px-2 py-1 rounded",
                  theme === 'dark' 
                    ? "bg-amber-900/20 text-amber-300 border border-amber-700/30" 
                    : "bg-amber-50 text-amber-700 border border-amber-200"
                )}>
                  🔒 Заблокировано: вы можете видеть только свои проекты
                </p>
              )}
            </div>

            <div className="space-y-2">
              <FilterSelect
                id="project"
                label="Проект"
                value={selectedProjectId}
                onChange={(value) => setFilter('project', value)}
                disabled={isLoading || isLoadingProjects}
                locked={isFilterLocked('project')}
                options={filteredProjects}
                placeholder="Выберите проект"
                theme={theme}
                loading={isLoadingProjects}
              />
              {isFilterLocked('project') && (
                <p className={cn(
                  "text-xs px-2 py-1 rounded",
                  theme === 'dark' 
                    ? "bg-amber-900/20 text-amber-300 border border-amber-700/30" 
                    : "bg-amber-50 text-amber-700 border border-amber-200"
                )}>
                  🔒 Заблокировано: проект предустановлен на основе ваших прав
                </p>
              )}
            </div>

            <div className="space-y-2">
              <FilterSelect
                id="stage"
                label="Стадия"
                value={selectedStageId}
                onChange={(value) => setFilter('stage', value)}
                disabled={!selectedProjectId || isLoadingStages}
                locked={isFilterLocked('stage')}
                options={filteredStages}
                placeholder="Выберите стадию"
                theme={theme}
                loading={isLoadingStages}
              />
              {isFilterLocked('stage') && (
                <p className={cn(
                  "text-xs px-2 py-1 rounded",
                  theme === 'dark' 
                    ? "bg-amber-900/20 text-amber-300 border border-amber-700/30" 
                    : "bg-amber-50 text-amber-700 border border-amber-200"
                )}>
                  🔒 Заблокировано: стадия предустановлена на основе выбранного проекта
                </p>
              )}
            </div>

            <div className="space-y-2">
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
              {isFilterLocked('object') && (
                <p className={cn(
                  "text-xs px-2 py-1 rounded",
                  theme === 'dark' 
                    ? "bg-amber-900/20 text-amber-300 border border-amber-700/30" 
                    : "bg-amber-50 text-amber-700 border border-amber-200"
                )}>
                  🔒 Заблокировано: объект предустановлен на основе выбранной стадии
                </p>
              )}
            </div>
          </div>

          {/* Организационные фильтры */}
          <OrganizationFilters
            departments={departments}
            teams={teams}
            employees={employees}
            selectedDepartmentId={selectedDepartmentId}
            selectedTeamId={selectedTeamId}
            selectedEmployeeId={selectedEmployeeId}
            isLoading={isLoading}
            setFilter={setFilter}
            isFilterLocked={isFilterLocked}
            theme={theme}
          />
        </div>
      )}
    </div>
  )
} 