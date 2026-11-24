import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DeleteUserConfirm } from './DeleteUserConfirm'

const user = { id: 'employee', name: 'Иван Иванов', email: 'ivan@example.test' }

describe('employment finish confirmation', () => {
  it('explains preserved history and separate access control before confirming', async () => {
    const onConfirm = vi.fn().mockResolvedValue(true)
    const onOpenChange = vi.fn()
    render(<DeleteUserConfirm open user={user} mode="finish" onConfirm={onConfirm} onOpenChange={onOpenChange} />)
    expect(screen.getByText(/последним рабочим днём/)).toHaveTextContent('Профиль, история и загрузки сохранятся')
    await userEvent.click(screen.getByRole('button', { name: 'Завершить работу' }))
    expect(screen.getByText(/Доступ к приложению автоматически не отключается/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Подтвердить завершение' }))
    await waitFor(() => expect(onConfirm).toHaveBeenCalledOnce())
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('keeps the confirmation open after an unsuccessful action', async () => {
    const onOpenChange = vi.fn()
    const onConfirm = vi.fn().mockResolvedValue(false)
    render(<DeleteUserConfirm open user={user} mode="finish" onConfirm={onConfirm} onOpenChange={onOpenChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Завершить работу' }))
    await userEvent.click(screen.getByRole('button', { name: 'Подтвердить завершение' }))
    await waitFor(() => expect(onConfirm).toHaveBeenCalledOnce())
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('blocks confirmation while the mode is unknown', () => {
    render(<DeleteUserConfirm open user={user} disabled onConfirm={vi.fn()} onOpenChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Удалить пользователя' })).toBeDisabled()
  })
})
