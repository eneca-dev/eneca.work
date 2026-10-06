import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useEmploymentBoardDate } from './useEmploymentBoardDate'

describe('useEmploymentBoardDate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-07T20:59:59.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts on the current Minsk date', () => {
    const { result } = renderHook(() => useEmploymentBoardDate())

    expect(result.current).toMatchObject({
      currentMinskDate: '2026-10-07',
      selectedDate: '2026-10-07',
      followsToday: true,
      mode: 'today',
    })
  })

  it('follows the new Minsk day at midnight', () => {
    const { result } = renderHook(() => useEmploymentBoardDate())

    act(() => {
      vi.advanceTimersByTime(1_050)
    })

    expect(result.current).toMatchObject({
      currentMinskDate: '2026-10-08',
      selectedDate: '2026-10-08',
      followsToday: true,
      mode: 'today',
    })
  })

  it('updates the current date but keeps a manually selected date at midnight', () => {
    const { result } = renderHook(() => useEmploymentBoardDate())

    act(() => result.current.selectDate('2026-10-20'))
    act(() => {
      vi.advanceTimersByTime(1_050)
    })

    expect(result.current).toMatchObject({
      currentMinskDate: '2026-10-08',
      selectedDate: '2026-10-20',
      followsToday: false,
      mode: 'dated',
    })
  })

  it('returns to today explicitly', () => {
    const { result } = renderHook(() => useEmploymentBoardDate())

    act(() => result.current.selectDate('2026-10-20'))
    act(() => result.current.selectToday())

    expect(result.current).toMatchObject({
      selectedDate: '2026-10-07',
      followsToday: true,
      mode: 'today',
    })
  })

  it.each([
    ['focus', () => window.dispatchEvent(new Event('focus'))],
    ['visibilitychange', () => document.dispatchEvent(new Event('visibilitychange'))],
  ])('refreshes the current date on %s without changing a manual date', (_event, dispatch) => {
    const { result } = renderHook(() => useEmploymentBoardDate())
    act(() => result.current.selectDate('2026-10-20'))
    vi.setSystemTime(new Date('2026-10-08T12:00:00.000Z'))

    act(dispatch)

    expect(result.current.currentMinskDate).toBe('2026-10-08')
    expect(result.current.selectedDate).toBe('2026-10-20')
    expect(result.current.followsToday).toBe(false)
  })

  it('resets to today when the keyed board is remounted', () => {
    const firstBoard = renderHook(() => useEmploymentBoardDate())
    const { result } = firstBoard
    act(() => result.current.selectDate('2026-10-20'))
    firstBoard.unmount()

    const secondBoard = renderHook(() => useEmploymentBoardDate())

    expect(secondBoard.result.current).toMatchObject({
      selectedDate: '2026-10-07',
      followsToday: true,
      mode: 'today',
    })
  })

  it('rejects a normalized but nonexistent calendar date', () => {
    const { result } = renderHook(() => useEmploymentBoardDate())

    expect(() => {
      act(() => result.current.selectDate('2026-02-30'))
    }).toThrow(RangeError)
  })
})
