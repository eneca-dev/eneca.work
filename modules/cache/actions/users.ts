'use server'

import { createClient } from '@/utils/supabase/server'
import type { ActionResult } from '../types'

// ============================================================================
// Types
// ============================================================================

export interface CachedUser {
  user_id: string
  first_name: string | null
  last_name: string | null
  email: string
  avatar_url: string | null
  full_name: string
  /** Почасовая ставка (из профиля) */
  salary: number | null
}

// ============================================================================
// Actions
// ============================================================================

/**
 * Получить список всех пользователей (из view_users)
 *
 * Используется для кеширования списка пользователей в модалках,
 * чтобы избежать загрузки при каждом открытии.
 *
 * @returns Список пользователей с базовой информацией
 */
export async function getUsers(): Promise<ActionResult<CachedUser[]>> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('view_users')
      .select('user_id, first_name, last_name, email, avatar_url')
      .order('first_name')

    if (error) {
      console.error('[getUsers] Supabase error:', error)
      return { success: false, error: error.message }
    }

    const users: CachedUser[] = (data || []).map(user => ({
      user_id: user.user_id,
      first_name: user.first_name || null,
      last_name: user.last_name || null,
      email: user.email,
      avatar_url: user.avatar_url || null,
      full_name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email,
    }))

    return { success: true, data: users }
  } catch (error) {
    console.error('[getUsers] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка загрузки пользователей',
    }
  }
}

/**
 * Получить текущего пользователя с его профилем
 *
 * @returns Данные текущего пользователя
 */
export async function getCurrentUser(): Promise<ActionResult<CachedUser | null>> {
  try {
    const supabase = await createClient()

    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData?.user?.id) {
      return { success: true, data: null }
    }

    const userId = authData.user.id

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, first_name, last_name, email, avatar_url, salary')
      .eq('user_id', userId)
      .single()

    if (profileError) {
      // Fallback to auth data
      return {
        success: true,
        data: {
          user_id: userId,
          first_name: null,
          last_name: null,
          email: authData.user.email || '',
          avatar_url: null,
          full_name: authData.user.email || '',
          salary: null,
        },
      }
    }

    return {
      success: true,
      data: {
        user_id: profileData.user_id,
        first_name: profileData.first_name || null,
        last_name: profileData.last_name || null,
        email: profileData.email || authData.user.email || '',
        avatar_url: profileData.avatar_url || null,
        full_name: `${profileData.first_name || ''} ${profileData.last_name || ''}`.trim() || profileData.email || '',
        salary: profileData.salary ?? null,
      },
    }
  } catch (error) {
    console.error('[getCurrentUser] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка загрузки текущего пользователя',
    }
  }
}
