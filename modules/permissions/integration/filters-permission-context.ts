import { usePermissionsStore } from '../store/usePermissionsStore'
import { useUserStore } from '@/stores/useUserStore'
import { getUserPermissions } from '../supabase/supabasePermissions'

export interface PermissionContext {
  permissions: string[]
  departmentId?: string | null
  teamId?: string | null
}

function needsTeam(permissions: string[] | undefined | null) {
  if (!permissions) return false
  return permissions.includes('hierarchy.is_team_lead') || permissions.includes('hierarchy.is_user')
}

// Нормализуем hierarchy.*: оставляем только наивысший уровень
function normalizeHierarchyPermissions(all: string[]): string[] {
  const set = new Set(all)
  const hasAdmin = set.has('hierarchy.is_admin')
  const hasDeptHead = set.has('hierarchy.is_department_head')
  const hasTeamLead = set.has('hierarchy.is_team_lead')
  const hasUser = set.has('hierarchy.is_user')

  if (hasAdmin) {
    // admin перекрывает остальные
    return all.filter(p => p !== 'hierarchy.is_department_head' && p !== 'hierarchy.is_team_lead' && p !== 'hierarchy.is_user')
  }
  if (hasDeptHead) {
    // оставляем department_head, убираем team_lead/user
    return all.filter(p => p !== 'hierarchy.is_team_lead' && p !== 'hierarchy.is_user')
  }
  if (hasTeamLead) {
    // оставляем team_lead, убираем user
    return all.filter(p => p !== 'hierarchy.is_user')
  }
  return all
}

export function getFiltersPermissionContext(): PermissionContext {
  let { permissions } = usePermissionsStore.getState()
  const { profile } = useUserStore.getState()

  const departmentId = profile?.departmentId ?? profile?.department_id ?? null
  const teamId = profile?.teamId ?? profile?.team_id ?? null

  // Требование заказчика: данные ДОЛЖНЫ быть в user store, без фолбека к БД
  if (!permissions || permissions.length === 0) {
    throw new Error('Permissions are not loaded in usePermissionsStore')
  }

  permissions = normalizeHierarchyPermissions(permissions)

  if (permissions.includes('hierarchy.is_department_head')) {
    if (!departmentId) throw new Error('Department ID is missing in user profile for department head')
  }

  if (needsTeam(permissions)) {
    if (!departmentId) throw new Error('Department ID is missing in user profile for team-bound roles')
    if (!teamId) throw new Error('Team ID is missing in user profile for team-bound roles')
  }

  return {
    permissions,
    departmentId,
    teamId,
  }
}

// Асинхронная версия: если разрешения не загружены, перезагружаем стор и ждём результат
export async function getFiltersPermissionContextAsync(): Promise<PermissionContext> {
  let { permissions } = usePermissionsStore.getState()
  const userState = useUserStore.getState()
  const userId = userState.id

  if (!userId) {
    throw new Error('User is not authenticated')
  }

  if (!permissions || permissions.length === 0) {
    // Принудительно загрузим разрешения через Supabase и сохраним в стор
    const result = await getUserPermissions(userId)
    if (result.error) {
      throw new Error(`Failed to load permissions: ${result.error}`)
    }
    if (!result.permissions || result.permissions.length === 0) {
      throw new Error('No permissions returned for user')
    }
    const normalized = normalizeHierarchyPermissions(result.permissions)
    usePermissionsStore.getState().setPermissions(normalized)
    permissions = normalized
  }

  const { profile } = useUserStore.getState()
  const departmentId = profile?.departmentId ?? profile?.department_id ?? null
  const teamId = profile?.teamId ?? profile?.team_id ?? null

  if (permissions.includes('hierarchy.is_department_head')) {
    if (!departmentId) throw new Error('Department ID is missing in user profile for department head')
  }
  if (permissions.includes('hierarchy.is_team_lead') || permissions.includes('hierarchy.is_user')) {
    if (!departmentId) throw new Error('Department ID is missing in user profile for team-bound roles')
    if (!teamId) throw new Error('Team ID is missing in user profile for team-bound roles')
  }

  return { permissions, departmentId, teamId }
}


