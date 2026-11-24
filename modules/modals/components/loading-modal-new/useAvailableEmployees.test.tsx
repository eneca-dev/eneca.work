import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

const getUsers = vi.hoisted(() => vi.fn())
vi.mock('@/modules/cache', () => ({ getUsers, queryKeys: { users: { lists: () => ['users', 'list'] } } }))
import { useAvailableEmployees } from './useAvailableEmployees'

describe('dated employee candidates', () => {
  it('keeps dates separate and does not display the previous candidates during the next request', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const oldUser = { user_id: 'old' }
    const newUser = { user_id: 'new' }
    let resolveNext!: (value: { success: true; data: { user_id: string }[] }) => void
    getUsers.mockResolvedValueOnce({ success: true, data: [oldUser] })
      .mockImplementationOnce(() => new Promise(resolve => { resolveNext = resolve }))
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
    const { result, rerender, unmount } = renderHook(({ date }) => useAvailableEmployees(date, date), {
      initialProps: { date: '2026-11-19' }, wrapper,
    })
    await waitFor(() => expect(result.current.data).toEqual([oldUser]))
    rerender({ date: '2026-11-20' })
    expect(result.current.data).toBeUndefined()
    await act(async () => resolveNext({ success: true, data: [newUser] }))
    await waitFor(() => expect(result.current.data).toEqual([newUser]))
    expect(client.getQueryData(['users', 'list', 'employment', '2026-11-19', '2026-11-19'])).toEqual([oldUser])
    expect(getUsers).toHaveBeenLastCalledWith({ startDate: '2026-11-20', endDate: '2026-11-20' })
    unmount()
    client.clear()
  })
})
