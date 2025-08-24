import type { Role } from '../types'
import { createClient } from "@/utils/supabase/client"

/**
 * Получает разрешения для роли из базы данных
 */
export const getRolePermissionsById = async (roleId: string): Promise<string[]> => {
  const supabase = createClient()
  
  try {
    const { data: rolePermissions, error } = await supabase
      .from('role_permissions')
      .select(`
        permissions!inner(name)
      `)
      .eq('role_id', roleId)

    if (error) {
      console.error('Ошибка получения разрешений роли:', error)
      return []
    }

    return rolePermissions ? rolePermissions.map(rp => rp.permissions.name) : []
  } catch (error) {
    console.error('Ошибка в getRolePermissionsById:', error)
    return []
  }
}

/**
 * Получает роли пользователя из базы данных
 */
export const getUserRoles = async (userId: string): Promise<Role[]> => {
  const supabase = createClient()
  
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select(`
        roles!inner(*)
      `)
      .eq('user_id', userId)
      .single()

    if (error || !profile?.roles) {
      console.error('Ошибка получения ролей пользователя:', error)
      return []
    }

    return [profile.roles]
  } catch (error) {
    console.error('Ошибка в getUserRoles:', error)
    return []
  }
}

/**
 * Получает человекочитаемое название роли
 */
export const getRoleDisplayName = (roleName: string): string => {
  const roleLabels: Record<string, string> = {
    admin: 'Администратор',
    project_manager: 'Руководитель проекта',
    department_head: 'Руководитель отдела',
    team_lead: 'Руководитель команды',
    specialist: 'Специалист',
    junior_specialist: 'Младший специалист',
    user: 'Пользователь'
  }
  
  return roleLabels[roleName] || roleName
}