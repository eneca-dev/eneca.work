'use server'

/**
 * Server Action для получения контекста фильтрации пользователя
 *
 * Загружает permissions из БД и вычисляет scope на их основе.
 */

import * as Sentry from '@sentry/nextjs'
import { createClient } from '@/utils/supabase/server'
import { resolveFilterScope } from '../utils/scope-resolver'
import type { UserFilterContext, FilterScopePermission } from '../types'
import { getPrimaryRole } from '../types'
import type { ActionResult } from '@/modules/cache'

/** Все filter scope permissions */
const FILTER_SCOPE_PERMISSIONS: FilterScopePermission[] = [
  'filters.scope.all',
  'filters.scope.subdivision',
  'filters.scope.department',
  'filters.scope.team',
  'filters.scope.managed_projects',
]

/**
 * Получает контекст фильтрации для текущего пользователя.
 * Загружает permissions из БД и вычисляет scope на их основе.
 */
export async function getFilterContext(): Promise<ActionResult<UserFilterContext | null>> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: true, data: null }
    }

    // 1. Получаем данные пользователя из view_users
    const { data: profile, error: profileError } = await supabase
      .from('view_users')
      .select(
        `
        user_id,
        team_id,
        team_name,
        department_id,
        department_name,
        subdivision_id,
        subdivision_name,
        is_active
      `
      )
      .eq('user_id', user.id)
      .single()

    if (profileError || !profile) {
      Sentry.captureException(profileError, {
        extra: { context: 'getFilterContext', step: 'loadProfile' },
      })
      return { success: false, error: 'Не удалось загрузить профиль пользователя' }
    }

    // Проверяем что профиль активен
    if (!profile.is_active) {
      return { success: false, error: 'Профиль пользователя неактивен' }
    }

    // 2. Получаем роли пользователя
    const { data: userRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select(
        `
        role:roles(name)
      `
      )
      .eq('user_id', user.id)

    if (rolesError) {
      Sentry.captureException(rolesError, {
        extra: { context: 'getFilterContext', step: 'loadRoles' },
      })
    }

  const roles =
    userRoles?.map((r) => (r.role as { name: string }).name) || ['user']

  // 3. Получаем filter permissions пользователя
  const { data: userPermissions } = await supabase.rpc('get_user_permissions', {
    p_user_id: user.id,
  })

  // Фильтруем только filter scope permissions
  let filterPermissions: FilterScopePermission[] = []

  if (userPermissions?.length) {
    filterPermissions = userPermissions
      .map((p: { permission_name: string }) => p.permission_name)
      .filter((name: string): name is FilterScopePermission =>
        FILTER_SCOPE_PERMISSIONS.includes(name as FilterScopePermission)
      )
  }

  // Fallback: если RPC не работает, получаем permissions напрямую
  if (filterPermissions.length === 0) {
    const { data: directPerms } = await supabase
      .from('user_roles')
      .select(
        `
        roles!inner(
          role_permissions!inner(
            permissions!inner(name)
          )
        )
      `
      )
      .eq('user_id', user.id)

    if (directPerms) {
      const permNames = new Set<string>()
      for (const ur of directPerms) {
        const roleData = ur.roles as {
          role_permissions: { permissions: { name: string } }[]
        }
        if (roleData?.role_permissions) {
          for (const rp of roleData.role_permissions) {
            if (rp.permissions?.name) {
              permNames.add(rp.permissions.name)
            }
          }
        }
      }
      filterPermissions = Array.from(permNames).filter(
        (name): name is FilterScopePermission =>
          FILTER_SCOPE_PERMISSIONS.includes(name as FilterScopePermission)
      )
    }
  }

  // 4. Определяем руководящие позиции на основе permissions

  let leadTeamId: string | undefined
  let leadTeamName: string | undefined
  let headDepartmentId: string | undefined
  let headDepartmentName: string | undefined
  let headSubdivisionId: string | undefined
  let headSubdivisionName: string | undefined
  let managedProjectIds: string[] | undefined
  let managedProjectNames: string[] | undefined

  // Тимлид - если есть permission filters.scope.team и роль team_lead
  if (
    filterPermissions.includes('filters.scope.team') &&
    roles.includes('team_lead')
  ) {
    const { data: team } = await supabase
      .from('teams')
      .select('team_id, team_name')
      .eq('team_lead_id', user.id)
      .single()

    if (team) {
      leadTeamId = team.team_id
      leadTeamName = team.team_name
    }
  }

  // Начальник отдела - если есть permission filters.scope.department
  if (filterPermissions.includes('filters.scope.department')) {
    const { data: dept } = await supabase
      .from('departments')
      .select('department_id, department_name')
      .eq('department_head_id', user.id)
      .single()

    if (dept) {
      headDepartmentId = dept.department_id
      headDepartmentName = dept.department_name
    }
  }

  // Начальник подразделения - если есть permission filters.scope.subdivision
  if (filterPermissions.includes('filters.scope.subdivision')) {
    const { data: sub } = await supabase
      .from('subdivisions')
      .select('subdivision_id, subdivision_name')
      .eq('subdivision_head_id', user.id)
      .single()

    if (sub) {
      headSubdivisionId = sub.subdivision_id
      headSubdivisionName = sub.subdivision_name
    }
  }

  // Руководитель проекта - если есть permission filters.scope.managed_projects
  if (filterPermissions.includes('filters.scope.managed_projects')) {
    const { data: projects } = await supabase
      .from('projects')
      .select('project_id, project_name')
      .or(`project_manager.eq.${user.id},project_lead_engineer.eq.${user.id}`)

    if (projects?.length) {
      managedProjectIds = projects.map((p) => p.project_id)
      managedProjectNames = projects.map((p) => p.project_name)
    }
  }

  // 5. Вычисляем scope на основе permissions
  const scope = resolveFilterScope(filterPermissions, {
    ownTeamId: profile.team_id,
    ownDepartmentId: profile.department_id,
    ownSubdivisionId: profile.subdivision_id,
    leadTeamId,
    headDepartmentId,
    headSubdivisionId,
    managedProjectIds,
  })

    return {
      success: true,
      data: {
        userId: user.id,
        roles,
        primaryRole: getPrimaryRole(roles),
        filterPermissions,

        ownTeamId: profile.team_id,
        ownTeamName: profile.team_name || '',
        ownDepartmentId: profile.department_id,
        ownDepartmentName: profile.department_name || '',
        ownSubdivisionId: profile.subdivision_id,
        ownSubdivisionName: profile.subdivision_name || '',

        leadTeamId,
        leadTeamName,
        headDepartmentId,
        headDepartmentName,
        headSubdivisionId,
        headSubdivisionName,
        managedProjectIds,
        managedProjectNames,

        scope,
      },
    }
  } catch (error) {
    Sentry.captureException(error, {
      extra: { context: 'getFilterContext' },
    })
    return { success: false, error: 'Ошибка загрузки контекста фильтрации' }
  }
}
