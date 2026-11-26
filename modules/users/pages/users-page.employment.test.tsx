import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { queryKeys } from '@/modules/cache/keys/query-keys'

const mocks = vi.hoisted(() => ({
  getUsers: vi.fn(), roster: vi.fn(), rosterRefetch: vi.fn(), replace: vi.fn(), list: vi.fn(),
}))
vi.mock('@/services/org-data-service', () => ({ getUsers: mocks.getUsers }))
vi.mock('../hooks/use-finished-employees', () => ({ useFinishedEmployees: mocks.roster }))
vi.mock('@/modules/cache', async () => ({
  ...(await import('@/modules/cache/keys/query-keys')),
  staleTimePresets: { medium: 60_000 },
}))
vi.mock('@/stores/useUserStore', () => ({
  useUserStore: (selector: (state: { id: string }) => unknown) => selector({ id: 'finished' }),
}))
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(), useRouter: () => ({ replace: mocks.replace }),
}))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), addBreadcrumb: vi.fn() }))
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }))
vi.mock('../components/users-list', () => ({ default: (props: { users: { id: string; name: string }[] }) => {
  mocks.list(props)
  return <ul aria-label="Сотрудники">{props.users.map(user => <li key={user.id}>{user.name}</li>)}</ul>
} }))
vi.mock('../components/current-user-card', () => ({ default: ({ user }: { user: { name: string } }) => <div data-testid="current-user">{user.name}</div> }))
vi.mock('@/modules/users/admin', () => ({ AdminPanel: () => null }))
vi.mock('../components/admin-access-check', () => ({ AdminAccessCheck: ({ children }: { children: ReactNode }) => children }))
vi.mock('../components/add-user-form', () => ({ default: () => null }))
vi.mock('../components/user-analytics', () => ({ default: () => null }))
vi.mock('@/modules/permissions', () => ({ PermissionGuard: ({ children }: { children: ReactNode }) => children }))
vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children: ReactNode }) => <button>{children}</button>,
  TabsContent: ({ children, value }: { children: ReactNode; value: string }) => value === 'list' ? <div>{children}</div> : null,
}))

import UsersPage from './users-page'

const users = [
  { user_id: 'active', full_name: 'Действующий', email: 'active@example.test', employment_rate: '1' },
  { user_id: 'finished', full_name: 'Завершивший', email: 'finished@example.test', employment_rate: '1' },
  { user_id: 'unknown', full_name: 'Без кадровой истории', email: 'unknown@example.test', employment_rate: '1' },
]
const roster = { enabled: true, today: '2026-11-25', finishedEmployeeIds: ['finished'], finishedOnByEmployeeId: { finished: '2026-11-24' } }
const clients: QueryClient[] = []
function show() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  clients.push(client)
  render(<QueryClientProvider client={client}><UsersPage /></QueryClientProvider>)
  return client
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getUsers.mockResolvedValue(users)
  mocks.roster.mockReturnValue({ data: roster, isPending: false, isError: false, isFetching: false, refetch: mocks.rosterRefetch })
})
afterEach(() => { clients.splice(0).forEach(client => client.clear()) })

describe('users current roster visibility', () => {
  it('hides only known finished employees without modifying the full cache or current-user lookup', async () => {
    const client = show()
    await screen.findByRole('list', { name: 'Сотрудники' })
    expect(mocks.list.mock.lastCall![0].users.map((user: { id: string }) => user.id)).toEqual(['active', 'unknown'])
    expect(screen.getByTestId('current-user')).toHaveTextContent('Завершивший')
    expect(client.getQueryData(queryKeys.users.fullList())).toEqual(users)
    expect(mocks.roster).toHaveBeenLastCalledWith(true)
  })

  it('shows archived employees on explicit toggle and hides them again when cleared', async () => {
    const client = show()
    await screen.findByRole('list', { name: 'Сотрудники' })
    const checkbox = screen.getByRole('checkbox', { name: 'Показывать завершивших работу' })
    expect(checkbox).not.toBeChecked()
    fireEvent.click(checkbox)
    expect(mocks.list.mock.lastCall![0].users.map((user: { id: string }) => user.id)).toEqual(['active', 'finished', 'unknown'])
    expect(mocks.list.mock.lastCall![0].finishedOnByEmployeeId).toEqual({ finished: '2026-11-24' })
    fireEvent.click(checkbox)
    expect(mocks.list.mock.lastCall![0].users.map((user: { id: string }) => user.id)).toEqual(['active', 'unknown'])
    expect(client.getQueryData(queryKeys.users.fullList())).toEqual(users)
  })

  it('does not flash an unfiltered employee list while the roster is loading', async () => {
    mocks.roster.mockReturnValue({ data: undefined, isPending: true, isError: false, isFetching: true, refetch: mocks.rosterRefetch })
    show()
    expect(await screen.findByRole('status')).toHaveTextContent('Проверка текущего состава')
    expect(mocks.list).not.toHaveBeenCalled()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('blocks the list on refresh failure even if the previous roster is cached and allows retry', async () => {
    mocks.roster.mockReturnValue({ data: roster, isPending: false, isError: true, isFetching: false, refetch: mocks.rosterRefetch })
    show()
    expect(await screen.findByRole('alert')).toHaveTextContent('Список временно недоступен')
    expect(mocks.list).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Повторить проверку состава' }))
    expect(mocks.rosterRefetch).toHaveBeenCalledOnce()
  })

  it('keeps the original list when employment history is disabled', async () => {
    mocks.roster.mockReturnValue({ data: { ...roster, enabled: false, finishedEmployeeIds: [] }, isPending: false, isError: false, isFetching: false, refetch: mocks.rosterRefetch })
    show()
    await screen.findByRole('list', { name: 'Сотрудники' })
    expect(mocks.list.mock.lastCall![0].users).toHaveLength(3)
  })

  it('renders an empty list without waiting forever for a disabled roster query', async () => {
    mocks.getUsers.mockResolvedValue([])
    mocks.roster.mockReturnValue({ data: undefined, isPending: true, isError: false, isFetching: false, refetch: mocks.rosterRefetch })
    show()
    await screen.findByRole('list', { name: 'Сотрудники' })
    expect(mocks.list.mock.lastCall![0].users).toEqual([])
    await waitFor(() => expect(mocks.roster).toHaveBeenLastCalledWith(false))
  })
})
