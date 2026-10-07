import { createElement } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ProjectCard } from './ProjectCard'
import type { BoardProject } from '../types'

const project: BoardProject = {
  id: 'project',
  name: 'Проект',
  isPinned: true,
  employees: [{
    id: 'employee',
    name: 'Сотрудник',
    avatarUrl: null,
    positionName: null,
    teamName: null,
    source: 'manual',
    rate: null,
  }],
}

function renderCard(canManageProjects: boolean, canManagePlacements: boolean) {
  const onUnpin = vi.fn()
  const onRemoveEmployee = vi.fn()
  render(createElement(ProjectCard, {
    project,
    canManageProjects,
    canManagePlacements,
    isDropTarget: false,
    onDragOver: vi.fn(),
    onDragLeave: vi.fn(),
    onDrop: vi.fn(),
    onUnpin,
    onRemoveEmployee,
  }))
  return { onUnpin, onRemoveEmployee }
}

describe('ProjectCard capabilities', () => {
  it('allows pin management while placement actions are disabled on a dated board', () => {
    const { onUnpin, onRemoveEmployee } = renderCard(true, false)

    fireEvent.click(screen.getByRole('button', { name: 'Открепить проект' }))
    expect(onUnpin).toHaveBeenCalledOnce()
    expect(screen.queryByRole('button', { name: /Убрать Сотрудник/ })).not.toBeInTheDocument()
    expect(onRemoveEmployee).not.toHaveBeenCalled()
  })

  it('shows the manual placement action only when placement management is enabled', () => {
    const { onRemoveEmployee } = renderCard(true, true)

    fireEvent.click(screen.getByRole('button', { name: /Убрать Сотрудник/ }))
    expect(onRemoveEmployee).toHaveBeenCalledWith('employee')
  })
})
