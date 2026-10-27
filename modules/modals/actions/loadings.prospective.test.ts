import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createLoading, createLoadingBatch, getLoadingById, splitLoading, updateLoading } from './loadings'

const db = vi.hoisted(() => ({
  rows: new Map<string, Record<string, unknown>>(),
  writes: [] as Array<{ operation: string; data: Record<string, unknown> }>,
  denied: false,
}))

vi.mock('@/utils/supabase/server', () => ({
  createClient: async () => ({
    from: (table: string) => {
      let id = 'loading-1'
      let operation = 'read'
      let payload: Record<string, unknown> | Record<string, unknown>[] = {}
      const execute = () => {
        if (table !== 'loadings') return { data: { project_id: 'project-1' }, error: null }
        if (db.denied) return { data: null, error: { message: 'row-level security policy' } }
        if (operation === 'read') return { data: db.rows.get(id), error: null }
        const inputs = Array.isArray(payload) ? payload : [payload]
        const results = inputs.map(data => {
          const key = operation === 'insert' ? `loading-${db.rows.size + 1}` : id
          const row = { ...(db.rows.get(key) ?? {}), ...data, loading_id: key }
          db.rows.set(key, row)
          db.writes.push({ operation, data })
          return row
        })
        return { data: results[0], error: null }
      }
      const query = {
        select: () => query,
        eq: (column: string, value: string) => { if (column === 'loading_id') id = value; return query },
        limit: () => query,
        single: async () => execute(),
        maybeSingle: async () => execute(),
        insert: (data: typeof payload) => { operation = 'insert'; payload = data; return query },
        update: (data: typeof payload) => { operation = 'update'; payload = data; return query },
        then: (resolve: (value: ReturnType<typeof execute>) => unknown) => Promise.resolve(execute()).then(resolve),
      }
      return query
    },
  }),
}))
vi.mock('@/modules/permissions/server/get-filter-context', () => ({
  getFilterContext: async () => ({ success: true, data: { permissions: [] } }),
}))
vi.mock('@/modules/permissions/server/restricted-projects', () => ({ getRestrictedProjectIds: async () => [] }))

const input = {
  stageId: 'stage-1', sectionId: 'section-1', employeeId: 'employee-1',
  startDate: '2026-10-01', endDate: '2026-10-31', rate: 0.5, comment: 'Работа',
}

beforeEach(() => {
  db.rows.clear()
  db.writes = []
  db.denied = false
  db.rows.set('loading-1', {
    loading_id: 'loading-1', loading_stage: input.stageId, loading_section: input.sectionId,
    loading_responsible: input.employeeId, loading_start: input.startDate,
    loading_finish: input.endDate, loading_rate: input.rate, loading_comment: input.comment,
    loading_status: 'active', is_shortage: false, is_prospective: true,
  })
})

describe('prospective loading persistence', () => {
  it.each([true, false, undefined])('creates with flag %s and preserves normal loading fields', async isProspective => {
    const result = await createLoading({ ...input, isProspective })
    expect(result).toMatchObject({ success: true, data: { isProspective: isProspective ?? false, rate: 0.5 } })
    expect(db.writes[0].data).toMatchObject({ is_prospective: isProspective ?? false, loading_status: 'active', loading_rate: 0.5 })
    if (result.success) {
      expect(await getLoadingById(result.data.id)).toMatchObject({ success: true, data: { isProspective: isProspective ?? false } })
    }
  })

  it('persists the flag for every employee in a batch', async () => {
    expect(await createLoadingBatch({ ...input, employeeIds: ['a', 'b'], isProspective: true })).toMatchObject({ success: true })
    expect(db.writes).toHaveLength(2)
    expect(db.writes.map(write => write.data.is_prospective)).toEqual([true, true])
  })

  it('can remove only the flag without changing dates, employee, comment or rate', async () => {
    const before = { ...db.rows.get('loading-1') }
    expect(await updateLoading({ loadingId: 'loading-1', isProspective: false })).toMatchObject({ success: true, data: { isProspective: false } })
    expect(db.rows.get('loading-1')).toEqual({ ...before, is_prospective: false, loading_updated: expect.any(String) })
    expect(await getLoadingById('loading-1')).toMatchObject({ success: true, data: { isProspective: false } })
  })

  it('does not clear the flag in partial date updates', async () => {
    await updateLoading({ loadingId: 'loading-1', endDate: '2026-11-01' })
    expect(db.writes[0].data).not.toHaveProperty('is_prospective')
    expect(db.rows.get('loading-1')?.is_prospective).toBe(true)
  })

  it('keeps independent flags on two loadings in the same section', async () => {
    await createLoading({ ...input, isProspective: false })
    await updateLoading({ loadingId: 'loading-2', isProspective: true })
    await updateLoading({ loadingId: 'loading-1', isProspective: false })
    expect(db.rows.get('loading-1')?.is_prospective).toBe(false)
    expect(db.rows.get('loading-2')?.is_prospective).toBe(true)
  })

  it('preserves the flag on both halves after splitting', async () => {
    const result = await splitLoading({ loadingId: 'loading-1', splitDate: '2026-10-15' })
    expect(result).toMatchObject({ success: true, data: { original: { isProspective: true }, created: { isProspective: true } } })
    expect(db.rows.get('loading-1')?.loading_finish).toBe('2026-10-14')
    expect(db.rows.get('loading-2')?.loading_start).toBe('2026-10-15')
  })

  it('reports existing database permission denial and does not save', async () => {
    db.denied = true
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await updateLoading({ loadingId: 'loading-1', isProspective: false })).toMatchObject({ success: false })
    expect(db.writes).toHaveLength(0)
    log.mockRestore()
  })

  it('rejects a non-boolean flag without writing', async () => {
    const invalid = 'true' as unknown as boolean
    expect(await createLoading({ ...input, isProspective: invalid })).toMatchObject({ success: false })
    expect(await createLoadingBatch({ ...input, employeeIds: ['a'], isProspective: invalid })).toMatchObject({ success: false })
    expect(await updateLoading({ loadingId: 'loading-1', isProspective: invalid })).toMatchObject({ success: false })
    expect(db.writes).toHaveLength(0)
  })
})
