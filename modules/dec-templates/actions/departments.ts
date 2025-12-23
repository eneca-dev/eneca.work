'use server'

import { createClient } from '@/utils/supabase/server'
import type { ActionResult } from '@/modules/cache'

// ============================================================================
// Types
// ============================================================================

export interface Department {
  id: string
  name: string
}

interface DepartmentRow {
  department_id: string
  department_name: string
}

// ============================================================================
// Server Actions
// RLS обеспечивает авторизацию через JWT в cookies.
// ============================================================================

/**
 * Получить список отделов для выбора
 * Auth: RLS (не нужен user.id)
 */
export async function getDepartmentsList(): Promise<ActionResult<Department[]>> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('departments')
      .select('department_id, department_name')
      .order('department_name')

    if (error) {
      console.error('[getDepartmentsList] Supabase error:', error)
      return { success: false, error: error.message }
    }

    const departments: Department[] = (data || []).map((d: DepartmentRow) => ({
      id: d.department_id,
      name: d.department_name,
    }))

    return { success: true, data: departments }
  } catch (error) {
    console.error('[getDepartmentsList] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка загрузки отделов',
    }
  }
}
