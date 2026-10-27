import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useLoadingModal, type Loading } from './useLoadingModal'

const loading: Loading = {
  id: 'loading-1',
  employee_id: 'employee-1',
  start_date: '2026-10-27',
  end_date: '2026-10-30',
  rate: 0.5,
  comment: 'Предварительная работа',
  section_id: 'section-1',
}

describe('useLoadingModal: prospective work', () => {
  it('creates an ordinary loading by default', () => {
    const { result } = renderHook(() => useLoadingModal({ mode: 'create' }))
    expect(result.current.formData.isProspective).toBe(false)
  })

  it('treats an existing loading without the flag as ordinary and unchanged', () => {
    const { result } = renderHook(() => useLoadingModal({
      mode: 'edit', initialSectionId: loading.section_id, initialLoading: loading,
    }))
    expect(result.current.formData.isProspective).toBe(false)
    expect(result.current.hasChanges).toBe(false)
  })

  it.each([false, true])('initializes an edit with isProspective=%s', (isProspective) => {
    const { result } = renderHook(() => useLoadingModal({
      mode: 'edit', initialSectionId: loading.section_id,
      initialLoading: { ...loading, isProspective },
    }))
    expect(result.current.formData.isProspective).toBe(isProspective)
    expect(result.current.hasChanges).toBe(false)

    const previousForm = result.current.formData
    act(() => result.current.setFormField('isProspective', !isProspective))
    expect(result.current.hasChanges).toBe(true)
    // A visual annotation must not alter rate, dates, assignee or comment.
    expect(result.current.formData).toEqual({ ...previousForm, isProspective: !isProspective })

    act(() => result.current.setFormField('isProspective', isProspective))
    expect(result.current.hasChanges).toBe(false)
  })

  it('preserves the annotation when pre-filling a copy', () => {
    const { result } = renderHook(() => useLoadingModal({
      mode: 'create', initialEmployeeId: loading.employee_id,
      initialFormValues: {
        isProspective: true, rate: loading.rate, comment: loading.comment!,
        startDate: loading.start_date, endDate: loading.end_date,
      },
    }))
    expect(result.current.formData).toMatchObject({
      isProspective: true, rate: 0.5, comment: loading.comment,
      startDate: loading.start_date, endDate: loading.end_date,
      employeeIds: [loading.employee_id],
    })
  })

  it('resets the annotation for the next newly created loading', () => {
    const { result } = renderHook(() => useLoadingModal({ mode: 'create' }))
    act(() => result.current.setFormField('isProspective', true))
    act(() => result.current.resetForm())
    expect(result.current.formData.isProspective).toBe(false)
  })

  it('preserves the annotation when the section is changed', () => {
    const { result } = renderHook(() => useLoadingModal({
      mode: 'edit', initialSectionId: loading.section_id,
      initialLoading: { ...loading, isProspective: true },
    }))
    act(() => result.current.startChangingStage())
    act(() => result.current.selectSection('section-2'))
    expect(result.current.formData.isProspective).toBe(true)
    expect(result.current.selectedSectionId).toBe('section-2')
  })
})
