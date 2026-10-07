import { describe, expect, it } from 'vitest'
import { boardBuildLockKey, boardCacheKey } from './redis'

describe('employment board Redis keys', () => {
  it('separates snapshots by selected date and server mode', () => {
    const today = boardCacheKey('department', '2026-10-08', 'today', false, 'scope', 3)
    const dated = boardCacheKey('department', '2026-10-08', 'dated', false, 'scope', 3)
    const anotherDate = boardCacheKey('department', '2026-10-09', 'dated', false, 'scope', 3)

    expect(new Set([today, dated, anotherDate])).toHaveLength(3)
    expect(today).toContain('employment-board:v2:')
  })

  it('separates build locks by selected date and mode', () => {
    expect(boardBuildLockKey('department', '2026-10-08', 'today', 3)).not.toBe(
      boardBuildLockKey('department', '2026-10-08', 'dated', 3),
    )
    expect(boardBuildLockKey('department', '2026-10-08', 'dated', 3)).not.toBe(
      boardBuildLockKey('department', '2026-10-09', 'dated', 3),
    )
  })
})
