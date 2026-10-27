import { describe, expect, it } from 'vitest'
import { calculateLayers, type BarPeriod } from './loading-bars-utils'

function period(id: string, isProspective = false): BarPeriod {
  return {
    id,
    type: 'loading',
    startDate: new Date('2026-10-01T00:00:00.000Z'),
    endDate: new Date('2026-10-31T00:00:00.000Z'),
    rate: 1,
    stageId: `stage-${id}`,
    isProspective,
  }
}

function layersById(periods: BarPeriod[]): Record<string, number> {
  const layers = calculateLayers(periods)
  return Object.fromEntries(periods.map((item, index) => [item.id, layers[index]]))
}

describe('calculateLayers', () => {
  it('keeps overlapping bars on stable layers after refetch reorders rows', () => {
    const initial = [period('loading-c'), period('loading-a'), period('loading-b')]
    const refreshed = [period('loading-b'), period('loading-c'), period('loading-a', true)]

    expect(layersById(refreshed)).toEqual(layersById(initial))
  })
})
