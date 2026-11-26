import { describe, expect, it } from 'vitest'
import { getCapacityExplanation, getDailyWorkloadExplanation } from './workload-explanation'

describe('daily workload explanation', () => {
  it.each([
    [7.75, 13, '7,75'],
    [6.75, 15, '6,75'],
  ])('explains the dated capacity %s without using the current roster', (capacity, percentage, formatted) => {
    expect(getDailyWorkloadExplanation('2026-11-24', 1, capacity, percentage, false)).toBe(
      `24.11.2026: ${percentage}%\nНазначено работы: 1\nДоступная мощность: ${formatted}\n1 ÷ ${formatted} × 100% ≈ ${percentage}%`,
    )
  })

  it('uses the already computed percentage and Russian decimals without recomputing it', () => {
    const text = getDailyWorkloadExplanation('2026-11-25', 0.75, 2.5, 31, false)
    expect(text).toContain('Назначено работы: 0,75')
    expect(text).toContain('0,75 ÷ 2,5 × 100% ≈ 31%')
  })

  it('explains a working day with no assigned work', () => {
    expect(getDailyWorkloadExplanation('2026-11-25', 0, 6.75, 0, false)).toContain('0 ÷ 6,75 × 100% ≈ 0%')
  })

  it.each([0, -1])('does not show a fabricated zero percent when capacity is %s', capacity => {
    const text = getDailyWorkloadExplanation('2026-11-25', 1, capacity, 0, false)
    expect(text).toContain('Нет базы расчёта')
    expect(text).not.toContain('÷')
    expect(text).not.toContain('0%')
  })

  it('explains non-working days without a percentage or division formula', () => {
    const text = getDailyWorkloadExplanation('2026-11-28', 1, 6.75, 0, true)
    expect(text).toContain('Нерабочий день')
    expect(text).toContain('Доступная мощность: 6,75')
    expect(text).not.toContain('÷')
    expect(text).not.toContain('0%')
  })

  it('explains that unassigned employees still contribute capacity', () => {
    for (const scope of ['команды', 'отдела'] as const) {
      const text = getCapacityExplanation(scope)
      expect(text).toContain(`мощность ${scope} на сегодня`)
      expect(text).toContain('без назначенных загрузок тоже учитываются')
      expect(text).toContain('Для прошлых дат используется исторический состав')
    }
  })
})
