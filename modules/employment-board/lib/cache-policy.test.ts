import { describe, expect, it } from 'vitest'
import { shouldUseEmploymentBoardRedis } from './cache-policy'

describe('employment board cache policy', () => {
  it('uses cache-aside by default and bypasses Redis for fresh requests', () => {
    expect(shouldUseEmploymentBoardRedis(undefined)).toBe(true)
    expect(shouldUseEmploymentBoardRedis('cache-aside')).toBe(true)
    expect(shouldUseEmploymentBoardRedis('fresh')).toBe(false)
  })
})
