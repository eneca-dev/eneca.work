/**
 * Resource Graph Filters - Filter Options Hook
 *
 * Хуки загружают всю структуру один раз и фильтруют на клиенте
 */

'use client'

import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { getOrgStructure, getProjectStructure } from '../actions'

// ============================================================================
// Types
// ============================================================================

interface FilterOption {
  id: string
  name: string
}

interface OrgStructure {
  subdivisions: Array<{ id: string; name: string }>
  departments: Array<{ id: string; name: string; subdivisionId: string | null }>
  teams: Array<{ id: string; name: string; departmentId: string | null }>
  employees: Array<{ id: string; name: string; teamId: string | null }>
}

interface ProjectStructure {
  managers: Array<{ id: string; name: string }>
  projects: Array<{ id: string; name: string; managerId: string | null }>
  stages: Array<{ id: string; name: string; projectId: string | null }>
  objects: Array<{ id: string; name: string; stageId: string | null }>
  sections: Array<{ id: string; name: string; objectId: string | null }>
}

// ============================================================================
// Query Keys
// ============================================================================

const filterStructureKeys = {
  all: ['filter-structure'] as const,
  org: () => [...filterStructureKeys.all, 'org'] as const,
  project: () => [...filterStructureKeys.all, 'project'] as const,
}

// ============================================================================
// Base Structure Hooks (load once, cache long)
// ============================================================================

/**
 * Загрузить всю организационную структуру
 * Кешируется на 10 минут
 */
export function useOrgStructure() {
  return useQuery({
    queryKey: filterStructureKeys.org(),
    queryFn: async () => {
      const result = await getOrgStructure()
      if (!result.success) throw new Error(result.error)
      return result.data
    },
    staleTime: 10 * 60 * 1000, // 10 минут
    gcTime: 30 * 60 * 1000, // 30 минут в кеше
  })
}

/**
 * Загрузить всю проектную структуру
 * Кешируется на 5 минут
 */
export function useProjectStructure() {
  return useQuery({
    queryKey: filterStructureKeys.project(),
    queryFn: async () => {
      const result = await getProjectStructure()
      if (!result.success) throw new Error(result.error)
      return result.data
    },
    staleTime: 5 * 60 * 1000, // 5 минут
    gcTime: 15 * 60 * 1000, // 15 минут в кеше
  })
}

// ============================================================================
// Project Filter Hooks (client-side filtering)
// ============================================================================

/**
 * Хук для получения руководителей проектов
 */
export function useManagerOptions() {
  const { data: structure, isLoading, error } = useProjectStructure()

  const managers = useMemo(() => {
    return structure?.managers || []
  }, [structure?.managers])

  return { data: managers, isLoading, error }
}

/**
 * Хук для получения проектов (фильтруется по менеджеру на клиенте)
 */
export function useProjectOptions(managerId?: string | null) {
  const { data: structure, isLoading, error } = useProjectStructure()

  const projects = useMemo(() => {
    if (!structure?.projects) return []
    if (!managerId) return structure.projects
    return structure.projects.filter(p => p.managerId === managerId)
  }, [structure?.projects, managerId])

  return { data: projects, isLoading, error }
}

/**
 * Хук для получения стадий (фильтруется по проекту на клиенте)
 */
export function useStageOptions(projectId?: string | null) {
  const { data: structure, isLoading, error } = useProjectStructure()

  const stages = useMemo(() => {
    if (!structure?.stages) return []
    if (!projectId) return []
    return structure.stages.filter(s => s.projectId === projectId)
  }, [structure?.stages, projectId])

  return { data: stages, isLoading, error }
}

/**
 * Хук для получения объектов (фильтруется по стадии на клиенте)
 */
export function useObjectOptions(stageId?: string | null) {
  const { data: structure, isLoading, error } = useProjectStructure()

  const objects = useMemo(() => {
    if (!structure?.objects) return []
    if (!stageId) return []
    return structure.objects.filter(o => o.stageId === stageId)
  }, [structure?.objects, stageId])

  return { data: objects, isLoading, error }
}

/**
 * Хук для получения разделов (фильтруется по объекту на клиенте)
 */
export function useSectionOptions(objectId?: string | null) {
  const { data: structure, isLoading, error } = useProjectStructure()

  const sections = useMemo(() => {
    if (!structure?.sections) return []
    if (!objectId) return []
    return structure.sections.filter(s => s.objectId === objectId)
  }, [structure?.sections, objectId])

  return { data: sections, isLoading, error }
}

// ============================================================================
// Org Filter Hooks (client-side filtering)
// ============================================================================

/**
 * Хук для получения подразделений
 */
export function useSubdivisionOptions() {
  const { data: structure, isLoading, error } = useOrgStructure()

  const subdivisions = useMemo(() => {
    return structure?.subdivisions || []
  }, [structure?.subdivisions])

  return { data: subdivisions, isLoading, error }
}

/**
 * Хук для получения отделов (фильтруется по подразделению на клиенте)
 */
export function useDepartmentOptions(subdivisionId?: string | null) {
  const { data: structure, isLoading, error } = useOrgStructure()

  const departments = useMemo(() => {
    if (!structure?.departments) return []
    if (!subdivisionId) return structure.departments
    return structure.departments.filter(d => d.subdivisionId === subdivisionId)
  }, [structure?.departments, subdivisionId])

  return { data: departments, isLoading, error }
}

/**
 * Хук для получения команд (фильтруется по отделу на клиенте)
 */
export function useTeamOptions(departmentId?: string | null) {
  const { data: structure, isLoading, error } = useOrgStructure()

  const teams = useMemo(() => {
    if (!structure?.teams) return []
    if (!departmentId) return []
    return structure.teams.filter(t => t.departmentId === departmentId)
  }, [structure?.teams, departmentId])

  return { data: teams, isLoading, error }
}

/**
 * Хук для получения сотрудников (фильтруется по команде на клиенте)
 */
export function useEmployeeOptions(teamId?: string | null) {
  const { data: structure, isLoading, error } = useOrgStructure()

  const employees = useMemo(() => {
    if (!structure?.employees) return []
    if (!teamId) return []
    return structure.employees.filter(e => e.teamId === teamId)
  }, [structure?.employees, teamId])

  return { data: employees, isLoading, error }
}
