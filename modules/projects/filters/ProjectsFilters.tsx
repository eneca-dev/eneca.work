import React, { useEffect } from 'react'
import { X, ChevronDown, ChevronRight, Filter, RotateCcw, Eye, EyeOff, Expand, Minimize } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useFilterStore } from './store'
import { FilterSelect } from './FilterSelect'
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
  showDepartments: boolean
  toggleShowDepartments: () => void
  expandAllDepartments: () => void
  collapseAllDepartments: () => void
}

export function ProjectsFilters({
  onProjectChange,
  onDepartmentChange,
  onTeamChange,
  onEmployeeChange,
  onManagerChange,
  onStageChange,
  onObjectChange,
  onResetFilters,
  showDepartments,
  toggleShowDepartments,
  expandAllDepartments,
  collapseAllDepartments
}: ProjectsFiltersProps) {
  const { theme: systemTheme } = useTheme()
  const { theme: settingsTheme } = useSettingsStore()
  const theme = (settingsTheme === 'system' ? systemTheme : settingsTheme) as 'light' | 'dark'

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
          <Filter size={16} className={theme === 'dark' ? "text-teal-400" : "text-teal-600"} />
          <span className={cn(
            "text-sm font-medium",
            theme === 'dark' ? "text-white" : "text-slate-900"
          )}>
            Фильтры
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Кнопка синхронизации с Worksection */}
          <SyncButton 
            size="md"
            theme={theme}
            showText={true}
          />

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
      <div className="space-y-3">
        {/* Проектные фильтры */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <FilterSelect
            id="manager"
            label="Менеджер"
            value={selectedManagerId}
            onChange={(value) => setFilter('manager', value)}
            disabled={isLoading}
            locked={isFilterLocked('manager')}
            options={managers}
            placeholder="Выберите менеджера"
            theme={theme}
            loading={isLoading}
          />

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

        {/* Организационные фильтры с кнопками управления */}
        <div className="flex gap-3 items-end">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 flex-1">
            <FilterSelect
              id="department"
              label="Отдел"
              value={selectedDepartmentId}
              onChange={(value) => setFilter('department', value)}
              disabled={isLoading}
              locked={isFilterLocked('department')}
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
              locked={isFilterLocked('team')}
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
              locked={isFilterLocked('employee')}
              options={filteredEmployees}
              placeholder={!selectedTeamId ? "Сначала выберите команду" : "Выберите сотрудника"}
              theme={theme}
              loading={isLoading}
            />
          </div>

          <div className="flex gap-1">
            <button
              onClick={toggleShowDepartments}
              title={showDepartments ? 'Скрыть отделы' : 'Показать отделы'}
              className={cn(
                "flex items-center justify-center p-2 rounded-md h-[38px] w-[38px]",
                theme === 'dark'
                  ? "bg-slate-700/50 text-slate-300 hover:bg-slate-700"
                  : "bg-slate-50 text-slate-700 hover:bg-slate-100"
              )}
            >
              {showDepartments ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>

            <button
              onClick={expandAllDepartments}
              title="Развернуть все отделы"
              className={cn(
                "flex items-center justify-center p-2 rounded-md h-[38px] w-[38px]",
                theme === 'dark'
                  ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                  : "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
              )}
            >
              <Expand size={16} />
            </button>

            <button
              onClick={collapseAllDepartments}
              title="Свернуть все отделы"
              className={cn(
                "flex items-center justify-center p-2 rounded-md h-[38px] w-[38px]",
                theme === 'dark'
                  ? "bg-orange-500/20 text-orange-400 hover:bg-orange-500/30"
                  : "bg-orange-500/10 text-orange-600 hover:bg-orange-500/20"
              )}
            >
              <Minimize size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
} 