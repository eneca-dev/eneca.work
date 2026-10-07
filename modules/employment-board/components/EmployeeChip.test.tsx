import { createElement } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EmployeeChip } from './EmployeeChip'
import type { BoardEmployee, BoardProjectEmployee } from '../types'

const calculationEmployee: BoardEmployee = {
  id: 'employee',
  name: 'Анна Иванова',
  avatarUrl: null,
  positionName: 'Инженер',
  teamName: 'Расчётная группа',
}

describe('EmployeeChip', () => {
  it('marks calculation group employees without replacing the free-state styles', () => {
    render(createElement(EmployeeChip, {
      employee: calculationEmployee,
      className: 'border-primary/30 bg-primary/10',
    }))

    const chip = screen.getByLabelText('Анна Иванова. Расчётная группа')
    expect(chip).toHaveAttribute('title', 'Расчётная группа · Инженер')
    expect(chip).toHaveClass('ring-violet-400/45', 'border-primary/30', 'bg-primary/10')
  })

  it('keeps the dashed manual-placement marker for calculation group employees', () => {
    const manualEmployee: BoardProjectEmployee = {
      ...calculationEmployee,
      source: 'manual',
      rate: null,
    }
    render(createElement(EmployeeChip, { employee: manualEmployee }))

    expect(screen.getByLabelText('Анна Иванова. Расчётная группа'))
      .toHaveClass('border-dashed', 'ring-violet-400/45')
  })

  it('does not infer calculation group membership from a position or name', () => {
    render(createElement(EmployeeChip, { employee: {
      ...calculationEmployee,
      name: 'Расчётная группа',
      positionName: 'Расчётная группа',
      teamName: 'Другая команда',
    } }))

    const chip = screen.getByText('Расчётная группа').parentElement
    expect(chip).not.toHaveAttribute('aria-label')
    expect(chip).not.toHaveClass('ring-violet-400/45')
  })
})
