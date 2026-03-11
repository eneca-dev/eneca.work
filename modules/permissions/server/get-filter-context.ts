'use server'

/**
 * Server Action для получения контекста фильтрации пользователя
 *
 * Загружает permissions из БД и вычисляет scope на их основе.
 * Оптимизирован: независимые запросы выполняются параллельно через Promise.all().
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
 * Отделы, в которых тимлиды получают scope уровня department (видят весь отдел).
 * Обычные тимлиды видят только свою команду — здесь перечислены исключения.
 */
const ELEVATED_TEAM_LEAD_DEPARTMENTS = ['КР гражд']

/** UUID validation regex (hoisted out of function for performance) */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Извлекает filter scope permissions из полного списка */
const extractFilterPermissions = (perms: string[]): FilterScopePermission[] =>
  perms.filter(
    (name): name is FilterScopePermission =>
      FILTER_SCOPE_PERMISSIONS.includes(name as FilterScopePermission)
  )

/**
 * Получает контекст фильтрации для текущего пользователя.
 * Загружает permissions из БД и вычисляет scope на их основе.
 */
export async function getFilterContext(): Promise<ActionResult<UserFilterContext | null>> {
  return Sentry.startSpan(
    { name: 'getFilterContext', op: 'server.action' },
    async () => {
      try {
        const supabase = await createClient()

        // Phase 0: Валидация сессии (обязательно первой — нужен user.id для всех запросов)
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser()

        if (authError) {
          Sentry.captureMessage('getFilterContext: Auth error', {
            level: 'warning',
            extra: { error: authError.message },
          })
          return { success: false, error: 'Ошибка аутентификации' }
        }

        if (!user) {
          return { success: false, error: 'Пользователь не авторизован' }
        }

        if (!UUID_REGEX.test(user.id)) {
          Sentry.captureMessage('getFilterContext: Invalid user ID format', {
            level: 'error',
            extra: { userId: user.id },
          })
          return { success: false, error: 'Некорректный формат идентификатора пользователя' }
        }

        // Phase 1: Параллельная загрузка профиля, ролей и permissions
        // Эти 3 запроса независимы друг от друга — выполняем через Promise.all()
        const [profileResult, rolesResult, permissionsResult] = await Promise.all([
          // Профиль из view_users
          supabase
            .from('view_users')
            .select('user_id, team_id, team_name, department_id, department_name, subdivision_id, subdivision_name, is_active')
            .eq('user_id', user.id)
            .single(),

          // Роли пользователя (as any обходит TS2589 на nested select, returns<T> восстанавливает типизацию)
          supabase
            .from('user_roles')
            .select('role:roles(name)' as any) // eslint-disable-line @typescript-eslint/no-explicit-any
            .eq('user_id', user.id)
            .returns<{ role: { name: string } }[]>(),

          // Permissions через RPC
          supabase.rpc('get_user_permissions', { p_user_id: user.id }),
        ])

        // Обработка профиля
        if (profileResult.error || !profileResult.data) {
          if (profileResult.error) {
            Sentry.captureException(profileResult.error, {
              extra: { context: 'getFilterContext', step: 'loadProfile' },
            })
          } else {
            Sentry.captureMessage('getFilterContext: profile data is null', {
              level: 'error',
              extra: { context: 'getFilterContext', step: 'loadProfile' },
            })
          }
          return { success: false, error: 'Не удалось загрузить профиль пользователя' }
        }

        const profile = profileResult.data

        if (!profile.is_active) {
          return { success: false, error: 'Профиль пользователя неактивен' }
        }

        // Обработка ролей
        if (rolesResult.error) {
          Sentry.captureException(rolesResult.error, {
            extra: { context: 'getFilterContext', step: 'loadRoles' },
          })
        }

        const roles =
          rolesResult.data?.map((r) => (r.role as { name: string }).name) || ['user']

        // Обработка permissions
        if (permissionsResult.error) {
          Sentry.captureException(permissionsResult.error, {
            extra: { context: 'getFilterContext', step: 'loadPermissions' },
          })
        }

        let allPermissions: string[] = []
        let filterPermissions: FilterScopePermission[] = []

        if (permissionsResult.data?.length) {
          allPermissions = permissionsResult.data as string[]
          filterPermissions = extractFilterPermissions(allPermissions)
        }

        // Fallback: если RPC не вернул результатов, получаем permissions через join
        if (allPermissions.length === 0) {
          Sentry.addBreadcrumb({
            category: 'permissions',
            message: 'RPC get_user_permissions returned empty, falling back to join query',
            level: 'info',
          })

          const { data: directPerms } = await supabase
            .from('user_roles')
            .select(`
              roles!inner(
                role_permissions!inner(
                  permissions!inner(name)
                )
              )
            ` as any) // eslint-disable-line @typescript-eslint/no-explicit-any
            .eq('user_id', user.id)
            .returns<{ roles: { role_permissions: { permissions: { name: string } }[] } }[]>()

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
            allPermissions = Array.from(permNames)
            filterPermissions = extractFilterPermissions(allPermissions)
          }
        }

        // Phase 2: Параллельная загрузка руководящих позиций
        // Все запросы зависят от permissions/roles (Phase 1), но независимы друг от друга
        const shouldLoadTeam =
          filterPermissions.includes('filters.scope.team') && roles.includes('team_lead')
        const shouldLoadDepartment =
          filterPermissions.includes('filters.scope.department')
        const shouldLoadSubdivision =
          filterPermissions.includes('filters.scope.subdivision')
        const shouldLoadProjects =
          filterPermissions.includes('filters.scope.managed_projects')

        const [teamResult, deptResult, subResult, projectsResult] = await Promise.all([
          shouldLoadTeam
            ? supabase
                .from('teams')
                .select('team_id, team_name')
                .eq('team_lead_id', user.id)
                .single()
            : null,

          shouldLoadDepartment
            ? supabase
                .from('departments')
                .select('department_id, department_name')
                .eq('department_head_id', user.id)
                .single()
            : null,

          shouldLoadSubdivision
            ? supabase
                .from('subdivisions')
                .select('subdivision_id, subdivision_name')
                .eq('subdivision_head_id', user.id)
                .single()
            : null,

          shouldLoadProjects
            ? supabase
                .from('projects')
                .select('project_id, project_name')
                .or(`project_manager.eq.${user.id},project_lead_engineer.eq.${user.id}`)
            : null,
        ])

        // Извлекаем результаты руководящих позиций (null → undefined для совместимости с UserFilterContext)
        const leadTeamId = teamResult?.data?.team_id ?? undefined
        const leadTeamName = teamResult?.data?.team_name ?? undefined
        let headDepartmentId = deptResult?.data?.department_id ?? undefined
        let headDepartmentName = deptResult?.data?.department_name ?? undefined
        const headSubdivisionId = subResult?.data?.subdivision_id ?? undefined
        const headSubdivisionName = subResult?.data?.subdivision_name ?? undefined
        const projectsData = projectsResult?.data?.length ? projectsResult.data : undefined
        const managedProjectIds = projectsData?.map((p) => p.project_id)
        const managedProjectNames = projectsData?.map((p) => p.project_name)

        // Elevated team leads: тимлиды из определённых отделов получают department scope
        const isElevatedTeamLead =
          !headDepartmentId &&
          roles.includes('team_lead') &&
          profile.department_name &&
          ELEVATED_TEAM_LEAD_DEPARTMENTS.includes(profile.department_name)

        if (isElevatedTeamLead && profile.department_id) {
          headDepartmentId = profile.department_id
          headDepartmentName = profile.department_name ?? undefined
          if (!filterPermissions.includes('filters.scope.department')) {
            filterPermissions.push('filters.scope.department')
          }
        }

        // Phase 3: Вычисляем scope (синхронная операция)
        const scope = resolveFilterScope(filterPermissions, {
          ownTeamId: profile.team_id ?? undefined,
          ownDepartmentId: profile.department_id ?? undefined,
          ownSubdivisionId: profile.subdivision_id ?? undefined,
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
            permissions: allPermissions,
            filterPermissions,

            ownTeamId: profile.team_id ?? '',
            ownTeamName: profile.team_name || '',
            ownDepartmentId: profile.department_id ?? '',
            ownDepartmentName: profile.department_name || '',
            ownSubdivisionId: profile.subdivision_id ?? '',
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
  )
}
