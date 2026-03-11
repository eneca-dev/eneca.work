"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/utils/supabase/client"
import { queryKeys, staleTimePresets } from "@/modules/cache"
import * as Sentry from "@sentry/nextjs"

// ============================================================================
// Types
// ============================================================================

export interface AdminSubdivision {
  subdivision_id: string
  subdivision_name: string
  subdivision_head_id: string | null
  head_name: string | null
  head_email: string | null
  head_avatar_url: string | null
  departments_count: number
  employees_count: number
}

export interface AdminTeam {
  team_id: string
  team_name: string
  department_id: string | null
  department_name: string | null
  team_lead_id: string | null
  team_lead_first_name: string | null
  team_lead_last_name: string | null
  team_lead_full_name: string | null
  team_lead_email: string | null
  team_lead_avatar_url: string | null
}

export interface AdminEntity {
  id: string
  name: string
}

export interface AdminRolesData {
  roles: Array<{ id: string; name: string; description: string | null }>
  permissions: Array<{ id: string; name: string; description: string | null }>
  rolePermissions: Array<{ role_id: string; permission_id: string }>
}

export interface AdminDepartment {
  department_id: string
  department_name: string
  subdivision_id: string | null
  subdivision_name?: string | null
  department_head_id: string | null
  head_first_name: string | null
  head_last_name: string | null
  head_full_name: string | null
  head_email: string | null
  head_avatar_url: string | null
}

// ============================================================================
// Query Functions
// ============================================================================

async function fetchAdminSubdivisions(): Promise<AdminSubdivision[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("view_subdivisions_with_heads")
    .select("*")
    .order("subdivision_name")
    .abortSignal(AbortSignal.timeout(10000))

  if (error) {
    Sentry.captureException(error, {
      tags: { module: 'users', component: 'useAdminSubdivisions', action: 'fetch', error_type: 'db_error' }
    })
    throw error
  }

  // View columns are nullable in TS, but subdivision_id/name are always present
  return (data || [])
    .filter(s => s.subdivision_id != null && s.subdivision_name != null)
    .map(s => ({
      ...s,
      subdivision_id: s.subdivision_id!,
      subdivision_name: s.subdivision_name!,
      departments_count: s.departments_count ?? 0,
      employees_count: s.employees_count ?? 0,
    }))
}

async function fetchAdminDepartments(): Promise<AdminDepartment[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("view_departments_with_heads")
    .select("*")
    .order("department_name")
    .abortSignal(AbortSignal.timeout(10000))

  if (error) {
    Sentry.captureException(error, {
      tags: { module: 'users', component: 'useAdminDepartments', action: 'fetch', error_type: 'db_error' }
    })
    throw error
  }

  // Дедупликация по department_id через Set — O(n)
  const seen = new Set<string>()
  return (data || [])
    .filter(dept => {
      if (dept.department_id == null) return false
      if (seen.has(dept.department_id)) return false
      seen.add(dept.department_id)
      return true
    })
    .map(dept => ({
      ...dept,
      department_id: dept.department_id!,
      department_name: dept.department_name ?? "",
    }))
}

// ============================================================================
// Hooks
// ============================================================================

/** Подразделения с руководителями. Дедупликация через TanStack Query. */
export function useAdminSubdivisions() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: queryKeys.admin.subdivisions(),
    queryFn: fetchAdminSubdivisions,
    staleTime: staleTimePresets.static,
  })

  const refetch = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.admin.subdivisions() })
  }

  return {
    subdivisions: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    refetch,
  }
}

/** Отделы с руководителями. Дедупликация через TanStack Query. */
export function useAdminDepartments() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: queryKeys.admin.departments(),
    queryFn: fetchAdminDepartments,
    staleTime: staleTimePresets.static,
  })

  // Инвалидируем ВСЕ зависимые ключи (как Realtime config), не только свой —
  // иначе при навигации /users → /tasks данные устареют (Realtime не успеет)
  const refetch = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.departments() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.departments.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.departmentsTimeline.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.sectionsPage.all }),
    ])
  }

  return {
    departments: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    refetch,
  }
}

/** Команды с руководителями. Дедупликация через TanStack Query. */
export function useAdminTeams() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: queryKeys.admin.teams(),
    queryFn: async (): Promise<AdminTeam[]> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("view_teams_with_leads")
        .select("team_id, team_name, department_id, department_name, team_lead_id, team_lead_first_name, team_lead_last_name, team_lead_full_name, team_lead_email, team_lead_avatar_url")
        .order("team_name")
        .abortSignal(AbortSignal.timeout(10000))

      if (error) {
        Sentry.captureException(error, {
          tags: { module: 'users', component: 'useAdminTeams', action: 'fetch', error_type: 'db_error' }
        })
        throw error
      }

      // Дедупликация по team_id через Set — O(n)
      const seen = new Set<string>()
      return (data || [])
        .filter(t => {
          if (t.team_id == null) return false
          if (seen.has(t.team_id)) return false
          seen.add(t.team_id)
          return true
        })
        .map(t => ({
          ...t,
          team_id: t.team_id!,
          team_name: t.team_name ?? "",
        }))
    },
    staleTime: staleTimePresets.static,
  })

  // Инвалидируем ВСЕ зависимые ключи (как Realtime config), не только свой —
  // иначе при навигации /users → /tasks данные устареют (Realtime не успеет)
  const refetch = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.teams() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.teams.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.departmentsTimeline.all }),
    ])
  }

  return {
    teams: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    refetch,
  }
}

/** Простые сущности (positions, categories). Динамический queryKey по таблице. */
export function useAdminEntity(tableName: string, idField: string, nameField: string) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: queryKeys.admin.entity(tableName),
    queryFn: async (): Promise<AdminEntity[]> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from(tableName as 'positions')
        .select("*")
        .abortSignal(AbortSignal.timeout(10000))

      if (error) {
        Sentry.captureException(error, {
          tags: { module: 'users', component: 'useAdminEntity', action: 'fetch', error_type: 'db_error', table: tableName }
        })
        throw error
      }

      return (data || []).map((item) => ({
        id: String((item as Record<string, unknown>)[idField] ?? ""),
        name: String((item as Record<string, unknown>)[nameField] ?? ""),
      }))
    },
    staleTime: staleTimePresets.static,
  })

  const refetch = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.admin.entity(tableName) })
  }

  return {
    entities: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    refetch,
  }
}

/** Роли, разрешения и связи. Три запроса параллельно через Promise.all. */
export function useAdminRoles() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: queryKeys.admin.roles(),
    queryFn: async (): Promise<AdminRolesData> => {
      const supabase = createClient()

      const [rolesRes, permsRes, rpRes] = await Promise.all([
        supabase.from("roles").select("id, name, description").order("name"),
        supabase.from("permissions").select("id, name, description").order("name"),
        supabase.from("role_permissions").select("role_id, permission_id"),
      ])

      if (rolesRes.error) {
        Sentry.captureException(rolesRes.error, { tags: { module: 'users', component: 'useAdminRoles', action: 'fetch_roles' } })
        throw rolesRes.error
      }
      if (permsRes.error) {
        Sentry.captureException(permsRes.error, { tags: { module: 'users', component: 'useAdminRoles', action: 'fetch_permissions' } })
        throw permsRes.error
      }
      if (rpRes.error) {
        Sentry.captureException(rpRes.error, { tags: { module: 'users', component: 'useAdminRoles', action: 'fetch_role_permissions' } })
        throw rpRes.error
      }

      return {
        roles: rolesRes.data || [],
        permissions: permsRes.data || [],
        rolePermissions: rpRes.data || [],
      }
    },
    staleTime: staleTimePresets.static,
  })

  const refetch = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.admin.roles() })
  }

  return {
    roles: query.data?.roles || [],
    permissions: query.data?.permissions || [],
    rolePermissions: query.data?.rolePermissions || [],
    isLoading: query.isLoading,
    error: query.error,
    refetch,
  }
}
