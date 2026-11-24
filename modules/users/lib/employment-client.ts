import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/types/db'
import { z } from 'zod'
import {
  employmentDatedCommandSchema, employmentEditContextSchema, employmentOperationError, EmploymentPartialSuccessError,
  type EmploymentDatedCommand, type EmploymentEditContext,
} from './employment-dated'
export type { EmploymentDatedCommand, EmploymentEditContext } from './employment-dated'

const statusSchema = z.object({
  enabled: z.boolean(),
  cutoverDate: z.string().nullable(),
  today: z.string(),
})
export type EmploymentStatus = z.infer<typeof statusSchema>
type ProfilePatch = Database['public']['Tables']['profiles']['Update']
const employmentFields = ['department_id', 'team_id', 'subdivision_id', 'employment_rate'] as const

export async function getEmploymentStatus(supabase: SupabaseClient<Database>): Promise<EmploymentStatus | null> {
  const { data, error } = await supabase.rpc('employee_employment_status')
  // Before deployment of the additive migration, keep the existing application usable.
  if (error?.code === 'PGRST202') return null
  if (error) throw new Error(error.message)
  return statusSchema.parse(data)
}

export async function getEmploymentEditContext(
  supabase: SupabaseClient<Database>, employeeId: string, operation: 'update' | 'finish',
): Promise<EmploymentEditContext> {
  const { data, error } = await supabase.rpc('get_employee_employment_edit_context', {
    p_employee_id: employeeId, p_operation: operation,
  })
  if (error) throw employmentOperationError(error)
  const parsed = employmentEditContextSchema.safeParse(data)
  if (!parsed.success) throw employmentOperationError({})
  return parsed.data
}

export async function assertCanCreateEmployee(supabase: SupabaseClient<Database>, actorId: string) {
  const permissions = ['users.create', 'users.edit.all', 'hierarchy.is_admin']
  for (const permission of permissions) {
    const { data, error } = await supabase.rpc('user_has_permission', {
      p_user_id: actorId, p_permission_name: permission,
    })
    if (error) throw new Error('Не удалось проверить право создания сотрудника')
    if (data === true) return
  }
  throw new Error('Недостаточно прав для создания сотрудника')
}

export async function updateProfileWithEmployment(
  supabase: SupabaseClient<Database>, employeeId: string, updates: ProfilePatch,
  datedCommand?: EmploymentDatedCommand,
) {
  const dated = datedCommand === undefined ? undefined : employmentDatedCommandSchema.parse(datedCommand)
  if (dated && !employmentFields.some((key) => key in updates)) {
    throw employmentOperationError({ code: '22023' })
  }
  if (!employmentFields.some((key) => key in updates)) {
    return supabase.from('profiles').update(updates).eq('user_id', employeeId)
  }
  // Explicit dated commands never fall back to an undated/direct profile write.
  if (!dated) {
    const status = await getEmploymentStatus(supabase)
    if (!status?.enabled) return supabase.from('profiles').update(updates).eq('user_id', employeeId)
  }

  const changes: Record<string, Json | undefined> = {}
  const remaining = { ...updates }
  for (const key of employmentFields) {
    if (key in updates) changes[key] = updates[key]
    delete remaining[key]
  }
  const result = dated ? await supabase.rpc('update_employee_employment_dated', {
    p_employee_id: employeeId, p_changes: changes, p_effective_date: dated.effectiveDate,
    p_expected_period_id: dated.expectedPeriodId, p_expected_updated_at: dated.expectedUpdatedAt,
  }) : await supabase.rpc('update_employee_employment', {
    p_employee_id: employeeId, p_changes: changes,
  })
  if (dated && result.error) throw employmentOperationError(result.error)
  if (result.error || Object.keys(remaining).length === 0) return result
  const profileResult = await supabase.from('profiles').update(remaining).eq('user_id', employeeId)
  if (profileResult.error) {
    if (dated) throw new EmploymentPartialSuccessError()
    return {
      ...profileResult,
      error: {
        ...profileResult.error,
        message: `Кадровые изменения сохранены, но остальные поля профиля не обновлены: ${profileResult.error.message}`,
      },
    }
  }
  return profileResult
}

export async function registerEmployment(supabase: SupabaseClient<Database>, employeeId: string) {
  if (!(await getEmploymentStatus(supabase))?.enabled) return
  const { error } = await supabase.rpc('register_employee_employment', { p_employee_id: employeeId })
  if (error) throw new Error(`Не удалось оформить сотрудника: ${error.message}`)
}

export async function finishEmployment(
  supabase: SupabaseClient<Database>, employeeId: string, datedCommand?: EmploymentDatedCommand,
) {
  const dated = datedCommand === undefined ? undefined : employmentDatedCommandSchema.parse(datedCommand)
  const { error } = dated ? await supabase.rpc('finish_employee_employment_dated', {
    p_employee_id: employeeId, p_last_working_date: dated.effectiveDate,
    p_expected_period_id: dated.expectedPeriodId, p_expected_updated_at: dated.expectedUpdatedAt,
  }) : await supabase.rpc('finish_employee_employment', { p_employee_id: employeeId })
  if (error) throw dated ? employmentOperationError(error) : new Error(error.message)
}
