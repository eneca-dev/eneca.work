import type { EmploymentSegment, Loading } from '../types'

export interface EmploymentDisplayLoading extends Loading {
  /** Display fragments have independent render keys but always resolve to the original loading. */
  sourceLoadingId: string
}

function nextDay(date: string): string {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + 1)
  return value.toISOString().slice(0, 10)
}

/** Clip presentation only. Adjacent staffing periods are one visible loading interval. */
export function clipLoadingsToEmployment(
  loadings: Loading[],
  segments: EmploymentSegment[] | undefined,
): EmploymentDisplayLoading[] {
  if (segments === undefined) return loadings.map(loading => ({ ...loading, sourceLoadingId: loading.id }))

  const intervals: Array<{ startDate: string; endDate: string }> = []
  for (const segment of [...segments].sort((a, b) => a.startDate.localeCompare(b.startDate))) {
    const previous = intervals.at(-1)
    if (previous && segment.startDate <= nextDay(previous.endDate)) {
      if (segment.endDate > previous.endDate) previous.endDate = segment.endDate
    } else {
      intervals.push({ startDate: segment.startDate, endDate: segment.endDate })
    }
  }

  return loadings.flatMap(loading => intervals.flatMap(interval => {
    const startDate = loading.startDate.slice(0, 10) > interval.startDate ? loading.startDate.slice(0, 10) : interval.startDate
    const endDate = loading.endDate.slice(0, 10) < interval.endDate ? loading.endDate.slice(0, 10) : interval.endDate
    if (startDate > endDate) return []
    return [{
      ...loading,
      id: `${loading.id}:employment:${startDate}:${endDate}`,
      sourceLoadingId: loading.id,
      startDate,
      endDate,
    }]
  }))
}
