import { describe, expect, it } from 'vitest'
import {
  assertEmploymentBoardDate,
  formatEmploymentBoardDateLabel,
  getCurrentMinskDate,
  getEmploymentBoardDateMode,
  getMillisecondsUntilNextMinskDay,
  isValidEmploymentBoardDate,
} from './board-date'

describe('employment board date utilities', () => {
  it.each([
    '2026-10-08',
    '2024-02-29',
    '2000-02-29',
  ])('accepts an existing calendar date: %s', (date) => {
    expect(isValidEmploymentBoardDate(date)).toBe(true)
    expect(() => assertEmploymentBoardDate(date)).not.toThrow()
  })

  it.each([
    '2026-02-29',
    '1900-02-29',
    '2026-04-31',
    '2026-00-10',
    '2026-13-10',
    '2026-10-00',
    '0000-01-01',
    '2026-1-08',
    '08.10.2026',
    '',
  ])('rejects a nonexistent or malformed date: %s', (date) => {
    expect(isValidEmploymentBoardDate(date)).toBe(false)
    expect(() => assertEmploymentBoardDate(date)).toThrow(RangeError)
  })

  it('uses the Minsk date around UTC day boundaries', () => {
    expect(getCurrentMinskDate(new Date('2026-10-07T20:59:59.999Z'))).toBe('2026-10-07')
    expect(getCurrentMinskDate(new Date('2026-10-07T21:00:00.000Z'))).toBe('2026-10-08')
  })

  it('calculates milliseconds until Minsk midnight', () => {
    expect(getMillisecondsUntilNextMinskDay(new Date('2026-10-07T20:59:59.000Z'))).toBe(1_000)
    expect(getMillisecondsUntilNextMinskDay(new Date('2026-10-07T21:00:00.000Z'))).toBe(86_400_000)
  })

  it('distinguishes today and dated modes', () => {
    expect(getEmploymentBoardDateMode('2026-10-08', '2026-10-08')).toBe('today')
    expect(getEmploymentBoardDateMode('2026-10-07', '2026-10-08')).toBe('dated')
  })

  it('formats labels relative to the current Minsk year', () => {
    expect(formatEmploymentBoardDateLabel('2026-10-08', '2026-10-08')).toBe('Сегодня')
    expect(formatEmploymentBoardDateLabel('2026-10-02', '2026-10-08')).toBe('2 октября')
    expect(formatEmploymentBoardDateLabel('2027-10-08', '2026-10-08')).toBe('8 октября 2027')
  })
})
