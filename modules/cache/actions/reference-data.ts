'use server'

import { createClient } from '@/utils/supabase/server'
import type { ActionResult } from '../types'

// ============================================================================
// Types
// ============================================================================

export interface CachedDepartment {
  id: string
  name: string
  subdivisionId: string | null
}

export interface CachedTeam {
  id: string
  name: string
  departmentId: string | null
}

export interface CachedPosition {
  id: string
  name: string
}

export interface CachedCategory {
  id: string
  name: string
}

export interface CachedSubdivision {
  id: string
  name: string
}

export interface CachedRole {
  id: string
  name: string
  description: string | null
}

// ============================================================================
// Actions
// ============================================================================

/**
 * Получить список всех отделов
 */
export async function getDepartments(): Promise<ActionResult<CachedDepartment[]>> {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Не авторизован' }
    }

    const { data, error } = await supabase
      .from('departments')
      .select('department_id, department_name, subdivision_id')
      .order('department_name')

    if (error) {
      return { success: false, error: error.message }
    }

    return {
      success: true,
      data: (data || []).map(d => ({
        id: d.department_id,
        name: d.department_name ?? "",
        subdivisionId: d.subdivision_id,
      })),
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка загрузки отделов',
    }
  }
}

/**
 * Получить список всех команд
 */
export async function getTeams(): Promise<ActionResult<CachedTeam[]>> {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Не авторизован' }
    }

    const { data, error } = await supabase
      .from('teams')
      .select('team_id, team_name, department_id')
      .order('team_name')

    if (error) {
      return { success: false, error: error.message }
    }

    return {
      success: true,
      data: (data || []).map(t => ({
        id: t.team_id,
        name: t.team_name ?? "",
        departmentId: t.department_id,
      })),
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка загрузки команд',
    }
  }
}

/**
 * Получить список всех должностей
 */
export async function getPositions(): Promise<ActionResult<CachedPosition[]>> {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Не авторизован' }
    }

    const { data, error } = await supabase
      .from('positions')
      .select('position_id, position_name')
      .order('position_name')

    if (error) {
      return { success: false, error: error.message }
    }

    return {
      success: true,
      data: (data || []).map(p => ({
        id: p.position_id,
        name: p.position_name ?? "",
      })),
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка загрузки должностей',
    }
  }
}

/**
 * Получить список всех категорий
 */
export async function getCategories(): Promise<ActionResult<CachedCategory[]>> {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Не авторизован' }
    }

    const { data, error } = await supabase
      .from('categories')
      .select('category_id, category_name')
      .order('category_name')

    if (error) {
      return { success: false, error: error.message }
    }

    return {
      success: true,
      data: (data || []).map(c => ({
        id: c.category_id,
        name: c.category_name ?? "",
      })),
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка загрузки категорий',
    }
  }
}

/**
 * Получить список всех подразделений
 */
export async function getSubdivisions(): Promise<ActionResult<CachedSubdivision[]>> {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Не авторизован' }
    }

    const { data, error } = await supabase
      .from('subdivisions')
      .select('subdivision_id, subdivision_name')
      .order('subdivision_name')

    if (error) {
      return { success: false, error: error.message }
    }

    return {
      success: true,
      data: (data || []).map(s => ({
        id: s.subdivision_id,
        name: s.subdivision_name ?? "",
      })),
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка загрузки подразделений',
    }
  }
}

/**
 * Получить список всех ролей
 */
export async function getRoles(): Promise<ActionResult<CachedRole[]>> {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Не авторизован' }
    }

    const { data, error } = await supabase
      .from('roles')
      .select('id, name, description')
      .order('name')

    if (error) {
      return { success: false, error: error.message }
    }

    return {
      success: true,
      data: (data || []).map(r => ({
        id: r.id,
        name: r.name,
        description: r.description,
      })),
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка загрузки ролей',
    }
  }
}

// ============================================================================
// Batch Action — все справочники одним запросом
// ============================================================================

export interface AllReferenceData {
  departments: CachedDepartment[]
  teams: CachedTeam[]
  positions: CachedPosition[]
  categories: CachedCategory[]
  subdivisions: CachedSubdivision[]
  roles: CachedRole[]
}

/**
 * Получить все справочники одним запросом (1 auth-проверка, параллельные DB-запросы)
 */
export async function getAllReferenceData(): Promise<ActionResult<AllReferenceData>> {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Не авторизован' }
    }

    // Параллельные запросы к БД
    const [depsRes, teamsRes, posRes, catRes, subRes, rolesRes] = await Promise.all([
      supabase.from('departments').select('department_id, department_name, subdivision_id').order('department_name'),
      supabase.from('teams').select('team_id, team_name, department_id').order('team_name'),
      supabase.from('positions').select('position_id, position_name').order('position_name'),
      supabase.from('categories').select('category_id, category_name').order('category_name'),
      supabase.from('subdivisions').select('subdivision_id, subdivision_name').order('subdivision_name'),
      supabase.from('roles').select('id, name, description').order('name'),
    ])

    // Проверяем ошибки
    const firstError = [depsRes, teamsRes, posRes, catRes, subRes, rolesRes].find(r => r.error)
    if (firstError?.error) {
      return { success: false, error: firstError.error.message }
    }

    return {
      success: true,
      data: {
        departments: (depsRes.data || []).map(d => ({
          id: d.department_id,
          name: d.department_name ?? "",
          subdivisionId: d.subdivision_id,
        })),
        teams: (teamsRes.data || []).map(t => ({
          id: t.team_id,
          name: t.team_name ?? "",
          departmentId: t.department_id,
        })),
        positions: (posRes.data || []).map(p => ({
          id: p.position_id,
          name: p.position_name ?? "",
        })),
        categories: (catRes.data || []).map(c => ({
          id: c.category_id,
          name: c.category_name ?? "",
        })),
        subdivisions: (subRes.data || []).map(s => ({
          id: s.subdivision_id,
          name: s.subdivision_name ?? "",
        })),
        roles: (rolesRes.data || []).map(r => ({
          id: r.id,
          name: r.name,
          description: r.description,
        })),
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка загрузки справочников',
    }
  }
}
