import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/db'
import { assertCanCreateEmployee, finishEmployment, getEmploymentStatus, registerEmployment, updateProfileWithEmployment } from './employment-client'

const enabled = { enabled: true, cutoverDate: '2026-11-19', today: '2026-11-19' }

function setup(status: unknown = enabled) {
  const eq = vi.fn().mockResolvedValue({ data: null, error: null })
  const update = vi.fn(() => ({ eq }))
  const from = vi.fn(() => ({ update }))
  const rpc = vi.fn().mockImplementation(async (name: string) => ({
    data: name === 'employee_employment_status' ? status : null, error: null,
  }))
  const supabase = { from, rpc } as unknown as SupabaseClient<Database>
  return { supabase, rpc, from, update, eq }
}

describe('employment client contract', () => {
  it('keeps cosmetic edits on profiles without an unnecessary status request', async () => {
    const { supabase, rpc, update, eq } = setup()
    await updateProfileWithEmployment(supabase, 'employee', { first_name: 'Иван' })
    expect(rpc).not.toHaveBeenCalled()
    expect(update).toHaveBeenCalledWith({ first_name: 'Иван' })
    expect(eq).toHaveBeenCalledWith('user_id', 'employee')
  })

  it('sends personnel fields only to the atomic RPC, preserving explicit nulls', async () => {
    const { supabase, rpc, update } = setup()
    // Runtime RPC permits clearing the team even though generated legacy types do not.
    const patch = { team_id: null, employment_rate: 0.5, first_name: 'Иван' } as unknown as Database['public']['Tables']['profiles']['Update']
    await updateProfileWithEmployment(supabase, 'employee', patch)
    expect(rpc).toHaveBeenCalledWith('update_employee_employment', {
      p_employee_id: 'employee', p_changes: { team_id: null, employment_rate: 0.5 },
    })
    expect(update).toHaveBeenCalledExactlyOnceWith({ first_name: 'Иван' })
  })

  it('does not send a cosmetic update after a rejected personnel operation', async () => {
    const { supabase, rpc, from } = setup()
    rpc.mockResolvedValueOnce({ data: enabled, error: null })
      .mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'denied' } })
    const result = await updateProfileWithEmployment(supabase, 'employee', { employment_rate: 0.5, first_name: 'Иван' })
    expect(result.error?.message).toBe('denied')
    expect(from).not.toHaveBeenCalled()
  })

  it('reports partial success instead of pretending the HR transaction rolled back', async () => {
    const { supabase, eq } = setup()
    eq.mockResolvedValue({ data: null, error: { message: 'profile denied' } })
    const result = await updateProfileWithEmployment(supabase, 'employee', { team_id: 'team', first_name: 'Иван' })
    expect(result.error?.message).toContain('Кадровые изменения сохранены')
    expect(result.error?.message).toContain('profile denied')
  })

  it('uses the old profile path until initialization', async () => {
    const { supabase, rpc, update } = setup({ ...enabled, enabled: false })
    await updateProfileWithEmployment(supabase, 'employee', { team_id: 'team' })
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledWith({ team_id: 'team' })
  })

  it('permits the old path only when the migration RPC is missing, not on other errors', async () => {
    const { supabase, rpc, update } = setup()
    rpc.mockResolvedValueOnce({ data: null, error: { code: 'PGRST202', message: 'missing' } })
    await updateProfileWithEmployment(supabase, 'employee', { team_id: 'team' })
    expect(update).toHaveBeenCalledTimes(1)
    rpc.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'denied' } })
    await expect(updateProfileWithEmployment(supabase, 'employee', { team_id: 'other' })).rejects.toThrow('denied')
    expect(update).toHaveBeenCalledTimes(1)
  })

  it('fails closed on malformed status', async () => {
    const { supabase } = setup({ enabled: 'true' })
    await expect(getEmploymentStatus(supabase)).rejects.toThrow()
  })

  it('registers only after initialization and surfaces registration failure', async () => {
    const { supabase, rpc } = setup({ ...enabled, enabled: false })
    await registerEmployment(supabase, 'employee')
    expect(rpc).toHaveBeenCalledTimes(1)
    rpc.mockResolvedValueOnce({ data: enabled, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'rate invalid' } })
    await expect(registerEmployment(supabase, 'employee')).rejects.toThrow('rate invalid')
    expect(rpc).toHaveBeenLastCalledWith('register_employee_employment', { p_employee_id: 'employee' })
  })

  it('does not hide dismissal errors', async () => {
    const { supabase, rpc } = setup()
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'self dismissal denied' } })
    await expect(finishEmployment(supabase, 'employee')).rejects.toThrow('self dismissal denied')
  })

  it('requires one of the dynamic create permissions and fails closed on permission errors', async () => {
    const { supabase, rpc } = setup()
    rpc.mockResolvedValue({ data: false, error: null })
    await expect(assertCanCreateEmployee(supabase, 'actor')).rejects.toThrow('Недостаточно прав')
    rpc.mockResolvedValueOnce({ data: false, error: null }).mockResolvedValueOnce({ data: true, error: null })
    await expect(assertCanCreateEmployee(supabase, 'actor')).resolves.toBeUndefined()
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'offline' } })
    await expect(assertCanCreateEmployee(supabase, 'actor')).rejects.toThrow('Не удалось проверить')
  })
})
