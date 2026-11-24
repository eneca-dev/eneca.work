import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode, SelectHTMLAttributes, ButtonHTMLAttributes } from 'react'

const mocks = vi.hoisted(() => ({
  update: vi.fn(), notify: vi.fn(), invalidate: vi.fn(), toast: vi.fn(), command: vi.fn(), ready: true,
  reference: { subdivisions: [], departments: [], teams: [], positions: [], categories: [], roles: [] },
}))
vi.mock('@/services/org-data-service', () => ({ updateUser: mocks.update }))
vi.mock('@/modules/cache/realtime', () => ({ notifyEmploymentBoardPersonnelChanged: mocks.notify }))
vi.mock('@/modules/cache', () => ({
  useAllReferenceData: () => mocks.reference,
  queryKeys: { users: { all: ['users'], permissions: () => ['permissions'] }, departmentsTimeline: { lists: () => ['timeline'] }, employmentBoard: { lists: () => ['board'] } },
  staleTimePresets: { medium: 1 },
}))
vi.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: { roles: [] } }), useQueryClient: () => ({ invalidateQueries: mocks.invalidate }) }))
vi.mock('@/hooks/use-toast', () => ({ toast: mocks.toast }))
vi.mock('@/stores/useUserStore', () => ({ useUserStore: (selector: (value: unknown) => unknown) => selector({ id: 'actor', profile: {}, setUser: vi.fn() }) }))
vi.mock('@/modules/users/admin/hooks/useAdminPermissions', () => ({ useAdminPermissions: () => ({}) }))
vi.mock('../hooks/useUserPermissions', () => ({ useUserPermissions: () => ({ isAdmin: true, canEditAllUsers: true, canEditSalaryAll: true }) }))
vi.mock('@/modules/permissions', () => ({ useUserPermissionsSync: () => ({ reloadPermissions: vi.fn() }) }))
vi.mock('@/modules/permissions/supabase/supabasePermissions', () => ({ assignRoleToUser: vi.fn(), revokeRoleFromUser: vi.fn(), getUserRoles: vi.fn() }))
vi.mock('@/utils/supabase/client', () => ({ createClient: () => ({}) }))
vi.mock('country-state-city', () => ({ Country: { getAllCountries: () => [] }, City: { getCitiesOfCountry: () => [] } }))
vi.mock('./employee-access-grants-section', () => ({ EmployeeAccessGrantsSection: () => null }))
vi.mock('../hooks/use-employment-dated-form', () => ({ useEmploymentDatedForm: () => ({
  ready: mocks.ready, loading: !mocks.ready, error: null, date: '2026-12-02',
  context: { enabled: true, minDate: '2026-11-24', today: '2026-12-05' }, setDate: vi.fn(), getCommand: mocks.command,
}) }))
vi.mock('@sentry/nextjs', () => ({
  startSpan: (_options: unknown, callback: () => unknown) => callback(), withProfiler: (component: unknown) => component,
}))
vi.mock('@/components/modals', () => {
  const Part = ({ children }: { children?: ReactNode }) => <div>{children}</div>
  const Modal = Object.assign(({ children, isOpen }: { children?: ReactNode; isOpen: boolean }) => isOpen ? <div>{children}</div> : null, { Header: Part, Body: Part, Footer: Part })
  return { Modal, ModalButton: ({ children, loading, icon, variant, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean; icon?: ReactNode; variant?: string }) => <button {...props}>{children}</button> }
})
vi.mock('@/components/ui/select', () => ({
  Select: ({ children, onValueChange, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { onValueChange: (value: string) => void }) => <select {...props} data-testid={`select-${props.value}`} onChange={event => onValueChange(event.target.value)}>{children}</select>,
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => <option value={value}>{children}</option>,
  SelectTrigger: () => null, SelectValue: () => null,
}))

import { UserDialog } from './user-dialog'
import { EmploymentPartialSuccessError } from '../lib/employment-dated'

const user = { id: 'employee', name: 'Тест Истории', email: 'test@example.test', position: '', subdivision: '', department: '', team: '', category: '', employmentRate: 1 }
const command = { effectiveDate: '2026-12-02', expectedPeriodId: 'period', expectedUpdatedAt: 'revision' }

describe('user dialog personnel date integration', () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.ready = true
    mocks.command.mockReturnValue(command)
    mocks.update.mockResolvedValue(undefined)
    mocks.invalidate.mockResolvedValue(undefined)
  })

  it('does not require personnel context for a cosmetic edit', async () => {
    mocks.ready = false
    render(<UserDialog open user={user} onOpenChange={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText('Имя'), { target: { value: 'Новое имя' } })
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    await waitFor(() => expect(mocks.update).toHaveBeenCalledOnce())
    const [, patch, dated] = mocks.update.mock.calls[0]
    expect(patch).not.toHaveProperty('employmentRate')
    expect(patch).not.toHaveProperty('department')
    expect(dated).toBeUndefined()
    expect(mocks.command).not.toHaveBeenCalled()
  })

  it('shows the date for a rate change and sends the captured command', async () => {
    render(<UserDialog open user={user} onOpenChange={vi.fn()} />)
    expect(screen.queryByLabelText('Действует с')).not.toBeInTheDocument()
    fireEvent.change(screen.getByTestId('select-1'), { target: { value: '0.5' } })
    expect(screen.getByLabelText('Действует с')).toHaveValue('2026-12-02')
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith('employee', expect.objectContaining({ employmentRate: 0.5 }), command))
    expect(mocks.notify).toHaveBeenCalledOnce()
    expect(mocks.invalidate).toHaveBeenCalledWith({ queryKey: ['users'] })
    expect(mocks.invalidate).toHaveBeenCalledWith({ queryKey: ['timeline'] })
  })

  it('blocks personnel submit while the context is unavailable', () => {
    mocks.ready = false
    render(<UserDialog open user={user} onOpenChange={vi.fn()} />)
    fireEvent.change(screen.getByTestId('select-1'), { target: { value: '0.5' } })
    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeDisabled()
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('refreshes caches and closes the stale form after committed HR but failed cosmetic fields', async () => {
    mocks.update.mockRejectedValue(new EmploymentPartialSuccessError())
    const onOpenChange = vi.fn()
    const onUserUpdated = vi.fn()
    render(<UserDialog open user={user} onOpenChange={onOpenChange} onUserUpdated={onUserUpdated} />)
    fireEvent.change(screen.getByTestId('select-1'), { target: { value: '0.5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(onUserUpdated).toHaveBeenCalledOnce()
    expect(mocks.notify).toHaveBeenCalledOnce()
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Кадровые изменения сохранены', description: expect.stringContaining('остальные поля профиля не обновлены') }))
  })
})
