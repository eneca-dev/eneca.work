import type { EmploymentBoardCachePolicy } from '../types'

export function shouldUseEmploymentBoardRedis(
  cachePolicy: EmploymentBoardCachePolicy | undefined,
): boolean {
  return cachePolicy !== 'fresh'
}
