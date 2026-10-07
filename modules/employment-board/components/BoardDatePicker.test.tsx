import { createElement } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BoardDatePicker } from './BoardDatePicker'

describe('BoardDatePicker', () => {
  it('shows the selected date and returns to today', () => {
    const onSelectToday = vi.fn()
    render(createElement(BoardDatePicker, {
      selectedDate: '2026-10-08',
      currentMinskDate: '2026-10-07',
      followsToday: false,
      onSelectDate: vi.fn(),
      onSelectToday,
    }))

    fireEvent.click(screen.getByRole('button', { name: /Выбрать дату занятости/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Сегодня' }))

    expect(onSelectToday).toHaveBeenCalledOnce()
  })

  it('returns a single selected calendar date', () => {
    const onSelectDate = vi.fn()
    render(createElement(BoardDatePicker, {
      selectedDate: '2026-10-08',
      currentMinskDate: '2026-10-07',
      followsToday: false,
      onSelectDate,
      onSelectToday: vi.fn(),
    }))

    fireEvent.click(screen.getByRole('button', { name: /Выбрать дату занятости/ }))
    fireEvent.click(screen.getByRole('button', { name: /^пятница, 9 октября 2026 г\.$/i }))

    expect(onSelectDate).toHaveBeenCalledWith('2026-10-09')
  })
})
