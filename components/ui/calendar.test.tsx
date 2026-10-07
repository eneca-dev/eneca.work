import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Calendar } from './calendar'

describe('Calendar', () => {
  it('uses the react-day-picker v9 slots for a compact seven-column grid', () => {
    const { container } = render(
      <Calendar mode="single" defaultMonth={new Date(2026, 9, 1)} />,
    )

    expect(screen.getByRole('grid')).toHaveClass('w-full', 'border-collapse')

    const columnHeaders = container.querySelectorAll('th')
    expect(columnHeaders).toHaveLength(7)
    columnHeaders.forEach((header) => expect(header).toHaveClass('w-9', 'text-center'))

    const nav = container.querySelector('nav')
    expect(nav).toHaveClass('absolute', 'inset-x-3', 'justify-between')

    const dayButtons = container.querySelectorAll('td button')
    expect(dayButtons.length).toBeGreaterThan(0)
    expect(dayButtons[0]).toHaveClass('h-9', 'w-9')
  })
})
