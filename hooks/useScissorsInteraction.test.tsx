import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { MouseEvent } from 'react'
import { useScissorsInteraction } from './useScissorsInteraction'

function pointer(clientX: number) {
  return { clientX, currentTarget: { getBoundingClientRect: () => ({ left: 100 }) },
    stopPropagation: vi.fn(), preventDefault: vi.fn() } as unknown as MouseEvent
}

describe('scissors click position', () => {
  const base = { loadingId: 'loading', startDate: '2026-11-16', endDate: '2026-11-20', dayCellWidth: 50, isActive: true }

  it('cuts at the clicked date without requiring an earlier mousemove', () => {
    const onSplit = vi.fn()
    const { result } = renderHook(() => useScissorsInteraction({ ...base, onSplit }))
    act(() => result.current.handlers.onClick(pointer(151)))
    expect(onSplit).toHaveBeenCalledWith('loading', '2026-11-17')
  })

  it('uses click coordinates instead of stale hover coordinates', () => {
    const onSplit = vi.fn()
    const { result } = renderHook(() => useScissorsInteraction({ ...base, onSplit }))
    act(() => result.current.handlers.onMouseMove(pointer(151)))
    act(() => result.current.handlers.onClick(pointer(251)))
    expect(onSplit).toHaveBeenCalledWith('loading', '2026-11-19')
  })

  it('uses the updated loading context after rerender without another mousemove', () => {
    const onSplit = vi.fn()
    const { result, rerender } = renderHook(({ loadingId, startDate }) => useScissorsInteraction({ ...base, loadingId, startDate, onSplit }),
      { initialProps: { loadingId: 'original', startDate: '2026-11-16' } })
    act(() => result.current.handlers.onMouseMove(pointer(151)))
    rerender({ loadingId: 'second-half', startDate: '2026-11-18' })
    act(() => result.current.handlers.onClick(pointer(151)))
    expect(onSplit).toHaveBeenCalledWith('second-half', '2026-11-19')
  })

  it('does not cut outside the interval or while inactive', () => {
    const onSplit = vi.fn()
    const { result, rerender } = renderHook(({ isActive }) => useScissorsInteraction({ ...base, isActive, onSplit }), { initialProps: { isActive: true } })
    for (const x of [99, 100, 149, 350]) act(() => result.current.handlers.onClick(pointer(x)))
    expect(onSplit).not.toHaveBeenCalled()
    rerender({ isActive: false })
    act(() => result.current.handlers.onClick(pointer(151)))
    expect(onSplit).not.toHaveBeenCalled()
  })
})
