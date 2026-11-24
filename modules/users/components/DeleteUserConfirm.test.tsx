import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mocks = vi.hoisted(() => ({ context: vi.fn() }))
vi.mock('@/utils/supabase/client', () => ({ createClient: () => ({}) }))
vi.mock('../lib/employment-client', () => ({ getEmploymentEditContext: mocks.context }))
import { DeleteUserConfirm } from './DeleteUserConfirm'

const user = { id: 'employee', name: 'Иван Иванов', email: 'ivan@example.test' }
const context = { enabled: true, cutoverDate: '2026-11-24', today: '2026-12-05', minDate: '2026-11-24', periodId: 'period', periodUpdatedAt: '2026-11-24T10:00:00Z' }

describe('employment finish confirmation', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.context.mockResolvedValue(context) })

  it('explains preserved history and separate access control before confirming', async () => {
    const onConfirm = vi.fn().mockResolvedValue(true)
    const onOpenChange = vi.fn()
    render(<DeleteUserConfirm open user={user} mode="finish" onConfirm={onConfirm} onOpenChange={onOpenChange} />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Завершить работу' })).toBeEnabled())
    expect(screen.getByText(/последним рабочим днём/)).toHaveTextContent('Профиль, история и загрузки сохранятся')
    await userEvent.click(screen.getByRole('button', { name: 'Завершить работу' }))
    expect(screen.getByText(/Доступ к приложению автоматически не отключается/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Подтвердить завершение' }))
    await waitFor(() => expect(onConfirm).toHaveBeenCalledOnce())
    expect(onConfirm).toHaveBeenCalledWith({ effectiveDate: '2026-12-05', expectedPeriodId: 'period', expectedUpdatedAt: context.periodUpdatedAt })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('keeps the confirmation open after an unsuccessful action', async () => {
    const onOpenChange = vi.fn()
    const onConfirm = vi.fn().mockResolvedValue(false)
    render(<DeleteUserConfirm open user={user} mode="finish" onConfirm={onConfirm} onOpenChange={onOpenChange} />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Завершить работу' })).toBeEnabled())
    await userEvent.click(screen.getByRole('button', { name: 'Завершить работу' }))
    await userEvent.click(screen.getByRole('button', { name: 'Подтвердить завершение' }))
    await waitFor(() => expect(onConfirm).toHaveBeenCalledOnce())
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('blocks confirmation while the mode is unknown', () => {
    render(<DeleteUserConfirm open user={user} disabled onConfirm={vi.fn()} onOpenChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Удалить пользователя' })).toBeDisabled()
  })

  it('confirms the selected last working day and freezes its period token', async () => {
    const onConfirm = vi.fn().mockResolvedValue(true)
    render(<DeleteUserConfirm open user={user} mode="finish" onConfirm={onConfirm} onOpenChange={vi.fn()} />)
    const input = await screen.findByLabelText('Последний рабочий день')
    expect(input).toHaveAttribute('min', '2026-11-24')
    expect(input).toHaveAttribute('max', '2026-12-05')
    fireEvent.change(input, { target: { value: '2026-12-02' } })
    expect(screen.getByText(/Завершение задним числом/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Завершить работу' }))
    expect(screen.getByText(/Подтвердите завершение работы:/)).toHaveTextContent('2026-12-02')
    await userEvent.click(screen.getByRole('button', { name: 'Подтвердить завершение' }))
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith({ effectiveDate: '2026-12-02', expectedPeriodId: 'period', expectedUpdatedAt: context.periodUpdatedAt }))
    expect(mocks.context).toHaveBeenCalledTimes(1)
  })

  it('blocks unavailable dates and does not fall back to today', async () => {
    const onConfirm = vi.fn()
    render(<DeleteUserConfirm open user={user} mode="finish" onConfirm={onConfirm} onOpenChange={vi.fn()} />)
    const input = await screen.findByLabelText('Последний рабочий день')
    for (const value of ['2026-11-23', '2026-12-06', '']) {
      fireEvent.change(input, { target: { value } })
      expect(screen.getByRole('button', { name: 'Завершить работу' })).toBeDisabled()
    }
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('fails closed when the period cannot be loaded', async () => {
    mocks.context.mockRejectedValue(new Error('Кадровый период изменён'))
    render(<DeleteUserConfirm open user={user} mode="finish" onConfirm={vi.fn()} onOpenChange={vi.fn()} />)
    expect(await screen.findByText(/Кадровый период изменён.*Закройте и снова откройте форму/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Завершить работу' })).toBeDisabled()
  })

  it('leaves legacy deletion independent of personnel context', async () => {
    const onConfirm = vi.fn().mockResolvedValue(true)
    render(<DeleteUserConfirm open user={user} mode="delete" onConfirm={onConfirm} onOpenChange={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Удалить пользователя' }))
    await userEvent.click(screen.getByRole('button', { name: 'Подтвердить удаление' }))
    expect(onConfirm).toHaveBeenCalledWith(undefined)
    expect(mocks.context).not.toHaveBeenCalled()
  })
})
