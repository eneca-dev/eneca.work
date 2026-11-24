import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/types/db'
import { z } from 'zod'

// Local contract for the additive migration; do not replace generated production
// types/db.ts with the minimal database used by the storage tests.
type EmploymentDatabase = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Functions'> & {
    Functions: Database['public']['Functions'] & {
      employee_employment_status: { Args: Record<string, never>; Returns: Json }
      update_employee_employment: { Args: { p_employee_id: string; p_changes: Json }; Returns: undefined }
      register_employee_employment: { Args: { p_employee_id: string }; Returns: undefined }
      finish_employee_employment: { Args: { p_employee_id: string }; Returns: undefined }
    }
  }
}

const statusSchema = z.object({
  enabled: z.boolean(),
  cutoverDate: z.string().nullable(),
  today: z.string(),
})
export type EmploymentStatus = z.infer<typeof statusSchema>
type ProfilePatch = Database['public']['Tables']['profiles']['Update']
const employmentFields = ['department_id', 'team_id', 'subdivision_id', 'employment_rate'] as const

function client(supabase: SupabaseClient<Database>) {
  return supabase as unknown as SupabaseClient<EmploymentDatabase>
}

export async function getEmploymentStatus(supabase: SupabaseClient<Database>): Promise<EmploymentStatus | null> {
  const { data, error } = await client(supabase).rpc('employee_employment_status')
  // Before deployment of the additive migration, keep the existing application usable.
  if (error?.code === 'PGRST202') return null
  if (error) throw new Error(error.message)
  return statusSchema.parse(data)
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
) {
  if (!employmentFields.some((key) => key in updates)) {
    return supabase.from('profiles').update(updates).eq('user_id', employeeId)
  }
  const status = await getEmploymentStatus(supabase)
  if (!status?.enabled) return supabase.from('profiles').update(updates).eq('user_id', employeeId)

  const changes: Record<string, Json | undefined> = {}
  const remaining = { ...updates }
  for (const key of employmentFields) {
    if (key in updates) changes[key] = updates[key]
    delete remaining[key]
  }
  const result = await client(supabase).rpc('update_employee_employment', {
    p_employee_id: employeeId, p_changes: changes,
  })
  if (result.error || Object.keys(remaining).length === 0) return result
  const profileResult = await supabase.from('profiles').update(remaining).eq('user_id', employeeId)
  if (profileResult.error) {
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
  const { error } = await client(supabase).rpc('register_employee_employment', { p_employee_id: employeeId })
  if (error) throw new Error(`Не удалось оформить сотрудника: ${error.message}`)
}

export async function finishEmployment(supabase: SupabaseClient<Database>, employeeId: string) {
  const { error } = await client(supabase).rpc('finish_employee_employment', { p_employee_id: employeeId })
  if (error) throw new Error(error.message)
}
