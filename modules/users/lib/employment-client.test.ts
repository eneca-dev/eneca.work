import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/db'
import { assertCanCreateEmployee, finishEmployment, getEmploymentStatus, getEmploymentEditContext, registerEmployment, updateProfileWithEmployment } from './employment-client'
import { EmploymentPartialSuccessError } from './employment-dated'

const enabled = { enabled: true, cutoverDate: '2026-11-19', today: '2026-11-19' }
const dated = {
  effectiveDate: '2026-11-20',
  expectedPeriodId: '00000000-0000-4000-8000-000000000003',
  expectedUpdatedAt: '2026-11-19T12:00:00.123456+00:00',
}

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
  it('sends explicit dates and an unrounded period token without the legacy fallback', async () => {
    const { supabase, rpc, update } = setup()
    await updateProfileWithEmployment(supabase, 'employee', { employment_rate: 0.5, first_name: 'Иван' }, dated)
    expect(rpc).toHaveBeenCalledExactlyOnceWith('update_employee_employment_dated', {
      p_employee_id: 'employee', p_changes: { employment_rate: 0.5 },
      p_effective_date: dated.effectiveDate, p_expected_period_id: dated.expectedPeriodId,
      p_expected_updated_at: dated.expectedUpdatedAt,
    })
    expect(update).toHaveBeenCalledExactlyOnceWith({ first_name: 'Иван' })
  })

  it.each(['PGRST202', '55000', '40001', '42501'])('fails closed on dated RPC error %s', async (code) => {
    const { supabase, rpc, from } = setup()
    rpc.mockResolvedValue({ data: null, error: { code, message: 'private SQL text' } })
    const operation = updateProfileWithEmployment(supabase, 'employee', { employment_rate: 0.5, first_name: 'Иван' }, dated)
    await expect(operation).rejects.not.toThrow('private SQL text')
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(from).not.toHaveBeenCalled()
  })

  it('reads and validates authorized context without rounding the concurrency token', async () => {
    const { supabase, rpc } = setup()
    const context = { ...enabled, periodId: dated.expectedPeriodId, periodUpdatedAt: dated.expectedUpdatedAt, minDate: '2026-11-19' }
    rpc.mockResolvedValue({ data: context, error: null })
    expect(await getEmploymentEditContext(supabase, 'employee', 'update')).toEqual(context)
    expect(rpc).toHaveBeenCalledWith('get_employee_employment_edit_context', { p_employee_id: 'employee', p_operation: 'update' })
  })

  it('rejects incomplete active context and never falls back on a missing context RPC', async () => {
    const { supabase, rpc, from } = setup()
    rpc.mockResolvedValue({ data: { ...enabled, minDate: null, periodId: null, periodUpdatedAt: null }, error: null })
    await expect(getEmploymentEditContext(supabase, 'employee', 'finish')).rejects.toThrow()
    rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202' } })
    await expect(getEmploymentEditContext(supabase, 'employee', 'finish')).rejects.toThrow('ещё не подключён')
    expect(from).not.toHaveBeenCalled()
  })

  it('finishes on an explicit last working date and passes the period token', async () => {
    const { supabase, rpc } = setup()
    await finishEmployment(supabase, 'employee', dated)
    expect(rpc).toHaveBeenCalledExactlyOnceWith('finish_employee_employment_dated', {
      p_employee_id: 'employee', p_last_working_date: dated.effectiveDate,
      p_expected_period_id: dated.expectedPeriodId, p_expected_updated_at: dated.expectedUpdatedAt,
    })
  })

  it('rejects invalid explicit dates before any DB call', async () => {
    const { supabase, rpc, from } = setup()
    await expect(updateProfileWithEmployment(supabase, 'employee', { employment_rate: 0.5 }, { ...dated, effectiveDate: '2026-02-30' })).rejects.toThrow()
    await expect(finishEmployment(supabase, 'employee', { ...dated, effectiveDate: '2026-11-20T00:00:00Z' })).rejects.toThrow()
    expect(rpc).not.toHaveBeenCalled()
    expect(from).not.toHaveBeenCalled()
  })

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

  it('exposes structured partial success for dated writes without raw SQL text', async () => {
    const { supabase, eq, rpc } = setup()
    eq.mockResolvedValue({ data: null, error: { message: 'secret database details' } })
    const result = updateProfileWithEmployment(supabase, 'employee', { employment_rate: 0.5, first_name: 'Иван' }, dated)
    await expect(result).rejects.toBeInstanceOf(EmploymentPartialSuccessError)
    await expect(result).rejects.toThrow('Кадровые изменения сохранены')
    await expect(result).rejects.not.toThrow('secret database details')
    expect(rpc).toHaveBeenCalledTimes(1)
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
