/**
 * Resource Graph Filters - Main Filters Component
 *
 * Компонент фильтрации для графика ресурсов
 */

'use client'

import { X, Search, Tag, Loader2 } from 'lucide-react'
import { useFiltersStore } from '../stores'
import { useTagOptions } from '../hooks'
import { FilterSelect } from './FilterSelect'
import {
  useManagerOptions,
  useProjectOptions,
  useStageOptions,
  useObjectOptions,
  useSectionOptions,
  useSubdivisionOptions,
  useDepartmentOptions,
  useTeamOptions,
  useEmployeeOptions,
} from './useFilterOptions'
import { cn } from '@/lib/utils'
import { useState, useCallback, useRef, useEffect } from 'react'

// ============================================================================
// Component
// ============================================================================

export function ResourceGraphFilters() {
  const {
    filters,
    setManagerId,
    setProjectId,
    setStageId,
    setObjectId,
    setSectionId,
    setSubdivisionId,
    setDepartmentId,
    setTeamId,
    setEmployeeId,
    setTagIds,
    setSearch,
    clearFilters,
    clearProjectFilters,
    clearOrgFilters,
  } = useFiltersStore()

  // Load tags
  const { data: tags = [], isLoading: loadingTags } = useTagOptions()

  // Local state for search input
  const [searchValue, setSearchValue] = useState(filters.search || '')
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchValue(value)

    // Debounce the search update
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    debounceTimerRef.current = setTimeout(() => {
      setSearch(value)
    }, 300)
  }, [setSearch])

  // Toggle tag selection
  const handleTagToggle = useCallback((tagId: string) => {
    const currentTags = filters.tagIds || []
    const isSelected = currentTags.includes(tagId)

    if (isSelected) {
      setTagIds(currentTags.filter(id => id !== tagId))
    } else {
      setTagIds([...currentTags, tagId])
    }
  }, [filters.tagIds, setTagIds])

  // Load filter options
  const { data: managers = [], isLoading: loadingManagers } = useManagerOptions()
  const { data: projects = [], isLoading: loadingProjects } = useProjectOptions(filters.managerId)
  const { data: stages = [], isLoading: loadingStages } = useStageOptions(filters.projectId)
  const { data: objects = [], isLoading: loadingObjects } = useObjectOptions(filters.stageId)
  const { data: sections = [], isLoading: loadingSections } = useSectionOptions(filters.objectId)

  const { data: subdivisions = [], isLoading: loadingSubdivisions } = useSubdivisionOptions()
  const { data: departments = [], isLoading: loadingDepartments } = useDepartmentOptions(filters.subdivisionId)
  const { data: teams = [], isLoading: loadingTeams } = useTeamOptions(filters.departmentId)
  const { data: employees = [], isLoading: loadingEmployees } = useEmployeeOptions(filters.teamId)

  // Check if any filters are active
  const hasActiveFilters = Object.values(filters).some(v => v !== undefined && v !== '')

  return (
    <div className="bg-card border-b">
      {/* Search */}
      <div className="p-4 border-b">
        <div className="relative max-w-md">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="text"
            placeholder="Поиск по названию..."
            value={searchValue}
            onChange={handleSearchChange}
            className={cn(
              'w-full pl-9 pr-4 py-2 text-sm rounded-md border',
              'bg-background border-input text-foreground',
              'placeholder:text-muted-foreground',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'
            )}
          />
        </div>
      </div>

      {/* Tags Section */}
      <div className="px-4 py-3 border-b flex items-center gap-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Tag size={14} />
          <span className="text-xs font-medium uppercase tracking-wider">Теги:</span>
        </div>
        {loadingTags ? (
          <Loader2 size={14} className="animate-spin text-muted-foreground" />
        ) : tags.length === 0 ? (
          <span className="text-xs text-muted-foreground">Нет тегов</span>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => {
              const isSelected = filters.tagIds?.includes(tag.id)
              return (
                <button
                  key={tag.id}
                  onClick={() => handleTagToggle(tag.id)}
                  className={cn(
                    'px-2.5 py-1 text-xs font-medium rounded-full transition-all duration-200',
                    'border',
                    isSelected
                      ? 'border-transparent text-white shadow-sm'
                      : 'border-border bg-background text-foreground hover:bg-muted'
                  )}
                  style={isSelected && tag.color ? {
                    backgroundColor: tag.color,
                    borderColor: tag.color,
                  } : undefined}
                >
                  {tag.name}
                </button>
              )
            })}
            {(filters.tagIds?.length ?? 0) > 0 && (
              <button
                onClick={() => setTagIds([])}
                className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <X size={12} />
                Сбросить
              </button>
            )}
          </div>
        )}
      </div>

      {/* Filter Groups */}
      <div className="p-4 flex flex-col gap-4">
        {/* Project Hierarchy Filters */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Проектная структура
            </h3>
            {(filters.managerId || filters.projectId || filters.stageId || filters.objectId || filters.sectionId || (filters.tagIds && filters.tagIds.length > 0)) && (
              <button
                onClick={clearProjectFilters}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <X size={12} />
                Сбросить
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            <FilterSelect
              id="manager-filter"
              label="Руководитель"
              value={filters.managerId ?? null}
              onChange={setManagerId}
              options={managers}
              placeholder="Все руководители"
              loading={loadingManagers}
            />
            <FilterSelect
              id="project-filter"
              label="Проект"
              value={filters.projectId ?? null}
              onChange={setProjectId}
              options={projects}
              placeholder="Все проекты"
              loading={loadingProjects}
            />
            <FilterSelect
              id="stage-filter"
              label="Стадия"
              value={filters.stageId ?? null}
              onChange={setStageId}
              options={stages}
              placeholder="Все стадии"
              loading={loadingStages}
              disabled={!filters.projectId}
            />
            <FilterSelect
              id="object-filter"
              label="Объект"
              value={filters.objectId ?? null}
              onChange={setObjectId}
              options={objects}
              placeholder="Все объекты"
              loading={loadingObjects}
              disabled={!filters.stageId}
            />
            <FilterSelect
              id="section-filter"
              label="Раздел"
              value={filters.sectionId ?? null}
              onChange={setSectionId}
              options={sections}
              placeholder="Все разделы"
              loading={loadingSections}
              disabled={!filters.objectId}
            />
          </div>
        </div>

        {/* Org Structure Filters */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Организационная структура
            </h3>
            {(filters.subdivisionId || filters.departmentId || filters.teamId || filters.employeeId) && (
              <button
                onClick={clearOrgFilters}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <X size={12} />
                Сбросить
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            <FilterSelect
              id="subdivision-filter"
              label="Подразделение"
              value={filters.subdivisionId ?? null}
              onChange={setSubdivisionId}
              options={subdivisions}
              placeholder="Все подразделения"
              loading={loadingSubdivisions}
            />
            <FilterSelect
              id="department-filter"
              label="Отдел"
              value={filters.departmentId ?? null}
              onChange={setDepartmentId}
              options={departments}
              placeholder="Все отделы"
              loading={loadingDepartments}
            />
            <FilterSelect
              id="team-filter"
              label="Команда"
              value={filters.teamId ?? null}
              onChange={setTeamId}
              options={teams}
              placeholder="Все команды"
              loading={loadingTeams}
              disabled={!filters.departmentId}
            />
            <FilterSelect
              id="employee-filter"
              label="Сотрудник"
              value={filters.employeeId ?? null}
              onChange={setEmployeeId}
              options={employees}
              placeholder="Все сотрудники"
              loading={loadingEmployees}
              disabled={!filters.teamId}
            />
          </div>
        </div>
      </div>

      {/* Clear All */}
      {hasActiveFilters && (
        <div className="px-4 pb-4">
          <button
            onClick={clearFilters}
            className={cn(
              'px-4 py-2 text-sm rounded-md',
              'text-destructive hover:bg-destructive/10',
              'transition-colors duration-200'
            )}
          >
            Сбросить все фильтры
          </button>
        </div>
      )}
    </div>
  )
}
