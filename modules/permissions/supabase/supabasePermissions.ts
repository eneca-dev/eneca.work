import { createClient } from "@/utils/supabase/client"
import * as Sentry from "@sentry/nextjs"
import type { Permission, Role } from '../types'

/** Тип для результата join-запроса role_permissions → permissions */
interface RolePermissionWithJoin {
  permissions: { name: string } | null
}

/**
 * Система загрузки разрешений пользователя из множественных ролей
 */
export async function getUserPermissions(userId: string): Promise<{
  permissions: string[]
  roles: string[]
  primaryRole: string | null
  error: string | null
}> {
  const supabase = createClient()
  
  try {
    // console.log('🔐 Загрузка разрешений для пользователя:', userId)

    // Используем оптимизированную функцию БД для получения разрешений
    const { data: permissions, error: permissionsError } = await supabase
      .rpc('get_user_permissions', { p_user_id: userId })

    if (permissionsError) {
      console.error('❌ Ошибка загрузки разрешений:', permissionsError)
      Sentry.captureException(permissionsError)
      return {
        permissions: [],
        roles: [],
        primaryRole: null,
        error: `Ошибка загрузки разрешений: ${permissionsError.message}`
      }
    }

    // Получаем роли пользователя из view_user_roles
    const { data: userRoles, error: rolesError } = await supabase
      .from('view_user_roles')
      .select('role_name')
      .eq('user_id', userId)

    if (rolesError) {
      console.error('❌ Ошибка загрузки ролей:', rolesError)
      Sentry.captureException(rolesError)
    }

    const roles = userRoles?.map(r => r.role_name) || []

    // Вычисляем основную роль по иерархии пермишенов и/или списку ролей
    const computePrimaryRole = (perms: string[], rs: string[]): string | null => {
      const set = new Set(perms)
      if (set.has('hierarchy.is_admin')) return 'admin'
      if (set.has('hierarchy.is_department_head')) return 'department_head'
      if (set.has('hierarchy.is_team_lead')) return 'team_lead'
      if (set.has('hierarchy.is_user')) return 'user'
      // fallback по именам ролей из view_user_roles
      if (rs.includes('admin')) return 'admin'
      if (rs.includes('department_head')) return 'department_head'
      if (rs.includes('team_lead')) return 'team_lead'
      if (rs.includes('user')) return 'user'
      return null
    }

    const primaryRole = computePrimaryRole(permissions || [], roles)

    // console.log('✅ Загружено разрешений в supabasePermissions:', permissions?.length || 0)
    // console.log('👤 Роли пользователя в supabasePermissions:', roles)
    // console.log('⭐ Основная роль в supabasePermissions:', primaryRole)
    
    return {
      permissions: permissions || [],
      roles,
      primaryRole,
      error: null
    }

  } catch (error) {
    console.error('💥 Критическая ошибка загрузки разрешений:', error)
    Sentry.captureException(error)
    
    return {
      permissions: [],
      roles: [],
      primaryRole: null,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка'
    }
  }
}

/**
 * Получает разрешения роли
 */
export async function getRolePermissions(roleId: string): Promise<string[]> {
  const supabase = createClient()
  
  try {
    const { data: rolePermissions, error } = await supabase
      .from('role_permissions')
      .select(`
        permissions(name)
      `)
      .eq('role_id', roleId)

    if (error) {
      console.error('Ошибка получения разрешений роли:', error)
      Sentry.captureException(error)
      return []
    }

    const results = rolePermissions as RolePermissionWithJoin[] | null
    return results ? results.map(rp => rp.permissions?.name).filter((name): name is string => Boolean(name)) : []
  } catch (error) {
    console.error('Ошибка получения разрешений роли:', error)
    Sentry.captureException(error)
    return []
  }
}

/**
 * Обновляет роль пользователя
 */
export async function updateUserRole(userId: string, roleId: string): Promise<boolean> {
  const supabase = createClient()
  try {
    // Назначаем (upsert) роль в user_roles: снимем прежние и добавим новую как единственную
    const { error: delErr } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId)
    if (delErr) {
      console.error('Ошибка очистки ролей пользователя:', delErr)
      return false
    }
    const { error } = await supabase
      .from('user_roles')
      .insert({ user_id: userId, role_id: roleId })
    if (error) {
      console.error('Ошибка назначения роли пользователю:', error)
      return false
    }
    return true
  } catch (error) {
    console.error('Ошибка в updateUserRole:', error)
    return false
  }
}

/**
 * Получает ограничения данных для пользователя
 */
// Упрощение Этап 2: constraints не используются

/**
 * Получает все роли
 */
export async function getAllRoles(): Promise<Role[]> {
  const supabase = createClient()
  
  try {
    const { data: roles, error } = await supabase
      .from('roles')
      .select('*')
      .order('name')
    
    if (error) {
      console.error('Ошибка получения ролей:', error)
      return []
    }
    
    return roles || []
  } catch (error) {
    console.error('Ошибка в getAllRoles:', error)
    return []
  }
}

/**
 * Получает все разрешения
 */
export async function getAllPermissions(): Promise<Permission[]> {
  const supabase = createClient()
  
  try {
    const { data: permissions, error } = await supabase
      .from('permissions')
      .select('*')
      .order('name')
    
    if (error) {
      console.error('Ошибка получения разрешений:', error)
      return []
    }
    
    return permissions || []
  } catch (error) {
    console.error('Ошибка в getAllPermissions:', error)
    return []
  }
}

/**
 * Создает новую роль
 */
export async function createRole(name: string, description?: string): Promise<Role | null> {
  const supabase = createClient()
  
  try {
    const { data: role, error } = await supabase
      .from('roles')
      .insert({ name, description })
      .select()
      .single()
    
    if (error) {
      console.error('Ошибка создания роли:', error)
      return null
    }
    
    return role
  } catch (error) {
    console.error('Ошибка в createRole:', error)
    return null
  }
}

/**
 * Обновляет роль
 */
export async function updateRole(roleId: string, updates: Partial<Pick<Role, 'name' | 'description'>>): Promise<boolean> {
  const supabase = createClient()
  
  try {
    const { error } = await supabase
      .from('roles')
      .update(updates)
      .eq('id', roleId)
    
    if (error) {
      console.error('Ошибка обновления роли:', error)
      return false
    }
    
    return true
  } catch (error) {
    console.error('Ошибка в updateRole:', error)
    return false
  }
}

/**
 * Удаляет роль
 */
export async function deleteRole(roleId: string): Promise<boolean> {
  const supabase = createClient()
  
  try {
    // Сначала удаляем связи с разрешениями
    await supabase
      .from('role_permissions')
      .delete()
      .eq('role_id', roleId)
    
    // Затем удаляем роль
    const { error } = await supabase
      .from('roles')
      .delete()
      .eq('id', roleId)
    
    if (error) {
      console.error('Ошибка удаления роли:', error)
      return false
    }
    
    return true
  } catch (error) {
    console.error('Ошибка в deleteRole:', error)
    return false
  }
}

/**
 * Назначает разрешение роли
 */
export async function assignPermissionToRole(roleId: string, permissionId: string): Promise<boolean> {
  const supabase = createClient()
  
  try {
    const { error } = await supabase
      .from('role_permissions')
      .insert({ role_id: roleId, permission_id: permissionId })
    
    if (error) {
      console.error('Ошибка назначения разрешения роли:', error)
      return false
    }
    
    return true
  } catch (error) {
    console.error('Ошибка в assignPermissionToRole:', error)
    return false
  }
}

/**
 * Отзывает разрешение у роли
 */
export async function revokePermissionFromRole(roleId: string, permissionId: string): Promise<boolean> {
  const supabase = createClient()
  
  try {
    const { error } = await supabase
      .from('role_permissions')
      .delete()
      .eq('role_id', roleId)
      .eq('permission_id', permissionId)
    
    if (error) {
      console.error('Ошибка отзыва разрешения у роли:', error)
      return false
    }
    
    return true
  } catch (error) {
    console.error('Ошибка в revokePermissionFromRole:', error)
    return false
  }
}

/**
 * Проверяет наличие разрешения у пользователя
 */
export async function checkUserPermission(userId: string, permission: string): Promise<boolean> {
  const supabase = createClient()
  
  try {
    const { data, error } = await supabase
      .rpc('user_has_permission', { 
        p_user_id: userId, 
        p_permission_name: permission 
      })
    
    if (error) {
      console.error('Ошибка проверки разрешения:', error)
      return false
    }
    
    return data || false
  } catch (error) {
    console.error('Ошибка в checkUserPermission:', error)
    return false
  }
}

/**
 * Назначает роль пользователю
 */
export async function assignRoleToUser(
  userId: string, 
  roleId: string, 
  assignedBy?: string
): Promise<boolean> {
  const supabase = createClient()
  
  try {
    const { data: newUserRole, error: insertError } = await supabase
      .from('user_roles')
      .insert({
        user_id: userId,
        role_id: roleId,
        assigned_by: assignedBy,
        assigned_at: new Date().toISOString()
      })
      .select()
      .single()
    
    if (insertError) {
      console.error('Ошибка назначения роли пользователю:', insertError)
      return false
    }
    
    return true
  } catch (error) {
    console.error('Ошибка в assignRoleToUser:', error)
    return false
  }
}

/**
 * Убирает роль у пользователя
 */
export async function revokeRoleFromUser(userId: string, roleId: string): Promise<boolean> {
  const supabase = createClient()
  
  try {
    const { error } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId)
      .eq('role_id', roleId)
    
    if (error) {
      console.error('Ошибка удаления роли у пользователя:', error)
      return false
    }
    
    return true
  } catch (error) {
    console.error('Ошибка в revokeRoleFromUser:', error)
    return false
  }
}

/**
 * Получает все роли пользователя
 */
export async function getUserRoles(userId: string): Promise<{
  roles: Array<{
    roleId: string
    roleName: string
    assignedAt: string
    assignedByName?: string
  }>
  error: string | null
}> {
  const supabase = createClient()
  
  try {
    const { data: userRoles, error } = await supabase
      .from('view_user_roles')
      .select(`
        role_id,
        role_name,
        assigned_at,
        assigned_by_name
      `)
      .eq('user_id', userId)
      .order('assigned_at', { ascending: true })

    if (error) {
      console.error('Ошибка получения ролей пользователя:', error)
      Sentry.captureException(error)
      return {
        roles: [],
        error: error.message
      }
    }

    const roles = userRoles?.map(ur => ({
      roleId: ur.role_id,
      roleName: ur.role_name,
      assignedAt: ur.assigned_at,
      assignedByName: ur.assigned_by_name
    })) || []
    
    return {
      roles,
      error: null
    }
  } catch (error) {
    console.error('Ошибка в getUserRoles:', error)
    return {
      roles: [],
      error: error instanceof Error ? error.message : 'Неизвестная ошибка'
    }
  }
} 