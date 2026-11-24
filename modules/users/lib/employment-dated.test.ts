import { describe, expect, it } from 'vitest'
import { employmentDateSchema, employmentDatedCommandSchema, employmentOperationError } from './employment-dated'

describe('employment effective date input', () => {
  it.each(['2026-11-24', '2028-02-29'])('accepts real date %s', (value) => {
    expect(employmentDateSchema.safeParse(value).success).toBe(true)
  })
  it.each(['2026-02-29', '2026-02-30', '2026-00-20', '2026-11-00', '0000-01-01', '2026-11-24T00:00:00Z', 'infinity', ''])('rejects %s', (value) => {
    expect(employmentDateSchema.safeParse(value).success).toBe(false)
  })
  it('requires a complete token and refuses extra mutation fields', () => {
    expect(employmentDatedCommandSchema.safeParse({ effectiveDate: '2026-11-24' }).success).toBe(false)
    expect(employmentDatedCommandSchema.safeParse({
      effectiveDate: '2026-11-24', expectedPeriodId: '00000000-0000-4000-8000-000000000001',
      expectedUpdatedAt: '2026-11-24T00:00:00Z', skipChecks: true,
    }).success).toBe(false)
  })
  it('does not expose internal SQL on unexpected error codes', () => {
    expect(employmentOperationError({ code: 'XX000' }).message).toBe('Не удалось выполнить кадровое действие. Обновите данные и повторите попытку.')
  })
})
