import { describe, expect, it, vi } from 'vitest'
import { applyEmploymentBoardLoadingFilters } from './loading-query'

describe('applyEmploymentBoardLoadingFilters', () => {
  it('applies active, non-shortage and inclusive date boundaries', () => {
    const calls: Array<[string, string, string | boolean]> = []
    const query = {
      eq: vi.fn((column: string, value: string | boolean) => {
        calls.push(['eq', column, value])
        return query
      }),
      lte: vi.fn((column: string, value: string) => {
        calls.push(['lte', column, value])
        return query
      }),
      gte: vi.fn((column: string, value: string) => {
        calls.push(['gte', column, value])
        return query
      }),
    }

    expect(applyEmploymentBoardLoadingFilters(query, '2026-10-08')).toBe(query)
    expect(calls).toEqual([
      ['eq', 'loading_status', 'active'],
      ['eq', 'is_shortage', false],
      ['lte', 'loading_start', '2026-10-08'],
      ['gte', 'loading_finish', '2026-10-08'],
    ])
  })

  it('rejects a nonexistent date before building the query', () => {
    const query = { eq: vi.fn(), lte: vi.fn(), gte: vi.fn() }
    expect(() => applyEmploymentBoardLoadingFilters(query as never, '2026-02-30')).toThrow(RangeError)
    expect(query.eq).not.toHaveBeenCalled()
  })
})
