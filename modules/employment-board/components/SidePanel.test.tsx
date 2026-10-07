import { createElement, type PropsWithChildren } from 'react'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { SidePanel } from './SidePanel'
import type { BoardEmployee } from '../types'

const employee: BoardEmployee = {
  id: 'employee',
  name: 'Сотрудник',
  avatarUrl: null,
  positionName: null,
  teamName: null,
}

function renderPanel(canManageProjects: boolean, canManagePlacements: boolean) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: PropsWithChildren) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
  return render(createElement(SidePanel, {
    employees: [employee],
    unassignedIds: new Set([employee.id]),
    canManageProjects,
    canManagePlacements,
    onDragStartEmployee: vi.fn(),
    onDragEnd: vi.fn(),
    onPinProject: vi.fn(),
  }), { wrapper })
}

describe('SidePanel capabilities', () => {
  it('keeps project controls but disables employee drag on a dated board', () => {
    renderPanel(true, false)

    expect(screen.getByPlaceholderText('Найти проект…')).toBeInTheDocument()
    expect(screen.getByText('Сотрудник').parentElement).toHaveProperty('draggable', false)
  })

  it('enables employee drag for today when placement management is allowed', () => {
    renderPanel(true, true)

    expect(screen.getByText('Сотрудник').parentElement).toHaveProperty('draggable', true)
  })
})
