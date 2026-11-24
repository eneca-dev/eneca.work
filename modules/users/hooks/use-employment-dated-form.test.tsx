import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ context: vi.fn() }))
vi.mock('@/utils/supabase/client', () => ({ createClient: () => ({}) }))
vi.mock('../lib/employment-client', () => ({ getEmploymentEditContext: mocks.context }))
import { useEmploymentDatedForm } from './use-employment-dated-form'

const context = { enabled: true, cutoverDate: '2026-11-24', today: '2026-12-05', minDate: '2026-11-27', periodId: 'period', periodUpdatedAt: 'revision-1' }

describe('employment dated form snapshot', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.context.mockResolvedValue(context) })

  it('captures today and the expected period; browser focus does not replace an edited date or token', async () => {
    const { result } = renderHook(() => useEmploymentDatedForm(true, 'employee', 'update'))
    await waitFor(() => expect(result.current.ready).toBe(true))
    act(() => { result.current.setDate('2026-12-02'); window.dispatchEvent(new Event('focus')) })
    expect(result.current.getCommand()).toEqual({ effectiveDate: '2026-12-02', expectedPeriodId: 'period', expectedUpdatedAt: 'revision-1' })
    expect(mocks.context).toHaveBeenCalledTimes(1)
  })

  it('fetches a new snapshot and resets the date on reopen', async () => {
    const { result, rerender } = renderHook(({ open }) => useEmploymentDatedForm(open, 'employee', 'update'), { initialProps: { open: true } })
    await waitFor(() => expect(result.current.ready).toBe(true))
    act(() => result.current.setDate('2026-12-02'))
    rerender({ open: false })
    mocks.context.mockResolvedValue({ ...context, today: '2026-12-06', periodUpdatedAt: 'revision-2' })
    rerender({ open: true })
    await waitFor(() => expect(result.current.date).toBe('2026-12-06'))
    expect(result.current.getCommand()?.expectedUpdatedAt).toBe('revision-2')
    expect(mocks.context).toHaveBeenCalledTimes(2)
  })

  it('ignores the late context of another employee', async () => {
    let resolveFirst!: (value: typeof context) => void
    mocks.context.mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve }))
    const { result, rerender } = renderHook(({ id }) => useEmploymentDatedForm(true, id, 'update'), { initialProps: { id: 'first' } })
    mocks.context.mockResolvedValue({ ...context, periodId: 'second-period' })
    rerender({ id: 'second' })
    await waitFor(() => expect(result.current.ready).toBe(true))
    await act(async () => resolveFirst(context))
    expect(result.current.getCommand()?.expectedPeriodId).toBe('second-period')
  })

  it('rejects invalid and out-of-range dates without substituting today', async () => {
    const { result } = renderHook(() => useEmploymentDatedForm(true, 'employee', 'update'))
    await waitFor(() => expect(result.current.ready).toBe(true))
    for (const date of ['', '2026-11-26', '2026-12-06', '2026-11-31']) {
      act(() => result.current.setDate(date))
      expect(result.current.ready).toBe(false)
      expect(() => result.current.getCommand()).toThrow()
    }
  })

  it('allows the undated legacy path only when history is explicitly disabled', async () => {
    mocks.context.mockResolvedValue({ ...context, enabled: false, periodId: null, periodUpdatedAt: null, minDate: null })
    const { result } = renderHook(() => useEmploymentDatedForm(true, 'employee', 'update'))
    await waitFor(() => expect(result.current.ready).toBe(true))
    expect(result.current.getCommand()).toBeUndefined()
  })
})
