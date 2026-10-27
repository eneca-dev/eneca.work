import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LoadingForm } from './LoadingForm'
import type { LoadingFormData } from '../../hooks/useLoadingModal'

vi.mock('./EmployeeSelector', () => ({ EmployeeSelector: () => null }))
vi.mock('./MultiEmployeeSelector', () => ({ MultiEmployeeSelector: () => null }))
vi.mock('./RateInput', () => ({ RateInput: () => null }))
vi.mock('./DateRangePicker', () => ({ DateRangePicker: () => null }))
vi.mock('./DecompositionStageSelector', () => ({ DecompositionStageSelector: () => null }))

const formData: LoadingFormData = {
  employeeId: 'employee-1', employeeIds: ['employee-1'],
  startDate: '2026-10-27', endDate: '2026-10-30',
  rate: 0.5, comment: 'Работа', isProspective: false, decompositionStageId: '',
}

describe('LoadingForm: prospective work', () => {
  it('exposes an accessible switch and sends only the changed flag', async () => {
    const user = userEvent.setup()
    const onFieldChange = vi.fn()
    render(<LoadingForm formData={formData} onFieldChange={onFieldChange} errors={{}} />)
    const toggle = screen.getByRole('switch', { name: 'Перспективная работа' })
    expect(toggle).not.toBeChecked()
    expect(toggle).toHaveAccessibleDescription('Предварительное планирование. Работа пока не подтверждена.')
    await user.click(toggle)
    expect(onFieldChange).toHaveBeenCalledExactlyOnceWith('isProspective', true)
  })

  it('lets the editor clear an existing annotation using its label', async () => {
    const user = userEvent.setup()
    const onFieldChange = vi.fn()
    render(<LoadingForm mode="edit" formData={{ ...formData, isProspective: true }} onFieldChange={onFieldChange} errors={{}} />)
    expect(screen.getByRole('switch', { name: 'Перспективная работа' })).toBeChecked()
    await user.click(screen.getByText('Перспективная работа'))
    expect(onFieldChange).toHaveBeenCalledExactlyOnceWith('isProspective', false)
  })

  it('does not allow a read-only or saving form to change the annotation', async () => {
    const user = userEvent.setup()
    const onFieldChange = vi.fn()
    render(<LoadingForm mode="edit" disabled formData={{ ...formData, isProspective: true }} onFieldChange={onFieldChange} errors={{}} />)
    const toggle = screen.getByRole('switch', { name: 'Перспективная работа' })
    expect(toggle).toBeDisabled()
    await user.click(toggle)
    expect(onFieldChange).not.toHaveBeenCalled()
  })
})
