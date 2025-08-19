import { createClient } from "@/utils/supabase/client"
import type { Permission, Role, RolePermission, UserRole, DataConstraint } from '../types'

/**
 * Получает разрешения пользователя
 */
export async function getUserPermissions(userId: string): Promise<string[]> {
  const supabase = createClient()
  
  try {
    // Получаем роль пользователя из профиля
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role_id')
      .eq('user_id', userId)
      .single()
    
    if (profileError || !profile?.role_id) {
      console.error('Ошибка получения профиля:', profileError)
      return []
    }
    
    // Получаем разрешения роли
    const { data: rolePermissions, error: permissionsError } = await supabase
      .from('role_permissions')
      .select(`
        permissions(name)
      `)
      .eq('role_id', profile.role_id)
    
    if (permissionsError) {
      console.error('Ошибка получения разрешений:', permissionsError)
      return []
    }
    
    // Извлекаем названия разрешений
    const permissions = rolePermissions
      ?.map((rp: any) => rp.permissions?.name)
      .filter(Boolean) || []
    
    return permissions
  } catch (error) {
    console.error('Ошибка в getUserPermissions:', error)
    return []
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
      return []
    }
    
    const permissions = rolePermissions
      ?.map((rp: any) => rp.permissions?.name)
      .filter(Boolean) || []
    
    return permissions
  } catch (error) {
    console.error('Ошибка в getRolePermissions:', error)
    return []
  }
}

/**
 * Обновляет роль пользователя
 */
export async function updateUserRole(userId: string, roleId: string): Promise<boolean> {
  const supabase = createClient()
  
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ role_id: roleId })
      .eq('user_id', userId)
    
    if (error) {
      console.error('Ошибка обновления роли пользователя:', error)
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
export async function getDataConstraints(userId: string): Promise<DataConstraint[]> {
  // TODO: Реализовать после создания таблицы data_constraints
  // Пока возвращаем пустой массив
  return []
}

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
  const permissions = await getUserPermissions(userId)
  return permissions.includes(permission)
} 