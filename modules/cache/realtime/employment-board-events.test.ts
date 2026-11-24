import { QueryClient, QueryObserver } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import {
  getEmploymentBoardPersonnelRevision,
  notifyEmploymentBoardPersonnelChanged,
  subscribeEmploymentBoardPersonnelChanges,
} from './employment-board-events'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))

describe('employment board personnel changes', () => {
  it('removes only inactive snapshots without refetching and keeps clients isolated', () => {
    const client = new QueryClient()
    const other = new QueryClient()
    const inactiveKey = ['employment-board', 'list', 'department', '2026-11-23', 'dated']
    const activeKey = ['employment-board', 'list', 'department', '2026-11-24', 'today']
    const presenceKey = ['employment-board', 'presence', 'department']
    const searchKey = ['employment-board', 'search', 'project']
    const queryFn = vi.fn()
    client.setQueryData(inactiveKey, { old: true })
    client.setQueryData(activeKey, { active: true })
    client.setQueryData(presenceKey, ['user'])
    client.setQueryData(searchKey, ['project'])
    const observer = new QueryObserver(client, { queryKey: activeKey, queryFn, staleTime: Infinity })
    const unsubscribe = observer.subscribe(() => undefined)
    try {
      notifyEmploymentBoardPersonnelChanged(client)
      expect(client.getQueryData(inactiveKey)).toBeUndefined()
      expect(client.getQueryData(activeKey)).toEqual({ active: true })
      expect(client.getQueryData(presenceKey)).toEqual(['user'])
      expect(client.getQueryData(searchKey)).toEqual(['project'])
      expect(queryFn).not.toHaveBeenCalled()
      expect(getEmploymentBoardPersonnelRevision(client)).toBe(1)
      expect(getEmploymentBoardPersonnelRevision(other)).toBe(0)
    } finally {
      unsubscribe()
      client.clear()
      other.clear()
    }
  })

  it('notifies remaining consumers when one listener throws and supports unsubscribe', () => {
    const client = new QueryClient()
    const broken = subscribeEmploymentBoardPersonnelChanges(client, () => { throw new Error('consumer failed') })
    const listener = vi.fn()
    const unsubscribe = subscribeEmploymentBoardPersonnelChanges(client, listener)
    try {
      expect(() => notifyEmploymentBoardPersonnelChanged(client)).not.toThrow()
      expect(listener).toHaveBeenCalledOnce()
      unsubscribe()
      notifyEmploymentBoardPersonnelChanged(client)
      expect(listener).toHaveBeenCalledOnce()
      expect(getEmploymentBoardPersonnelRevision(client)).toBe(2)
    } finally {
      broken()
      unsubscribe()
      client.clear()
    }
  })
})
