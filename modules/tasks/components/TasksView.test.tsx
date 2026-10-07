import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TasksView } from './TasksView'

const state = vi.hoisted(() => ({
  activeTabId: 'employment-a',
  nextBoardInstance: 0,
  mountedBoardInstances: [] as number[],
  unmountedBoardInstances: [] as number[],
  tabs: [
    {
      id: 'employment-a',
      name: 'Занятость A',
      viewMode: 'employment' as const,
      filterString: '',
      isSystem: false,
      order: 0,
      createdAt: '2026-10-07T00:00:00.000Z',
    },
    {
      id: 'employment-b',
      name: 'Занятость B',
      viewMode: 'employment' as const,
      filterString: '',
      isSystem: false,
      order: 1,
      createdAt: '2026-10-07T00:00:00.000Z',
    },
  ],
}))

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: (key: string) => key === 'tab' ? state.activeTabId : null,
  }),
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => '/tasks',
}))

vi.mock('../stores', () => {
  const store = {
    tabs: state.tabs,
    activeTabId: 'employment-a',
    setActiveTab: vi.fn(),
    updateActiveTabFilters: vi.fn(),
    setActiveTabLoadAll: vi.fn(),
  }
  return {
    TASKS_FILTER_CONFIG: {},
    useTasksTabsStore: (selector: (value: typeof store) => unknown) => selector(store),
  }
})

vi.mock('../hooks', () => ({
  useTasksFilterOptions: () => ({
    options: [],
    allOptions: [],
    filterContext: null,
    lockedFilters: [],
  }),
}))

vi.mock('@/modules/permissions', () => ({
  useHasPermission: () => true,
  usePermissions: () => ({ isLoading: false }),
  usePermissionsLoader: vi.fn(),
}))

vi.mock('@/modules/inline-filter', () => ({
  InlineFilter: () => <div data-testid="inline-filter" />,
  parseFilterString: () => ({ tokens: [] }),
  tokensToQueryParams: () => ({}),
}))

vi.mock('@/modules/employment-board', async () => {
  const React = await import('react')
  return {
    EMPLOYMENT_BOARD_FILTER_CONFIG: {},
    EMPLOYMENT_BOARD_VIEW: 'employment_board.view',
    EmploymentBoardInternal: () => {
      const [instanceId] = React.useState(() => ++state.nextBoardInstance)
      React.useEffect(() => {
        state.mountedBoardInstances.push(instanceId)
        return () => {
          state.unmountedBoardInstances.push(instanceId)
        }
      }, [instanceId])
      return <div data-testid="employment-board-instance">{instanceId}</div>
    },
  }
})

vi.mock('@/modules/kanban/components/KanbanBoard', () => ({ KanbanBoardInternal: () => null }))
vi.mock('@/modules/departments-timeline', () => ({ DepartmentsTimelineInternal: () => null }))
vi.mock('@/modules/sections-page', () => ({ SectionsPageInternal: () => null }))
vi.mock('@/modules/budgets-page', () => ({ BudgetsViewInternal: () => null }))
vi.mock('./TasksTabs', () => ({ TasksTabs: () => null }))
vi.mock('./TabPicker', () => ({ TabPicker: () => null }))
vi.mock('./PermissionsDebugPanel', () => ({ PermissionsDebugPanel: () => null }))

describe('TasksView employment tabs', () => {
  it('remounts EmploymentBoardInternal when another employment tab becomes active', () => {
    const view = render(<TasksView />)
    const firstInstance = screen.getByTestId('employment-board-instance').textContent

    state.activeTabId = 'employment-b'
    view.rerender(<TasksView />)

    const secondInstance = screen.getByTestId('employment-board-instance').textContent
    expect(secondInstance).not.toBe(firstInstance)
    expect(state.mountedBoardInstances).toEqual([1, 2])
    expect(state.unmountedBoardInstances).toContain(1)
  })
})
