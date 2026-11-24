// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(), createAdminClient: vi.fn(), status: vi.fn(), canCreate: vi.fn(), register: vi.fn(),
}))
vi.mock('@/utils/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/utils/supabase/admin', () => ({ createAdminClient: mocks.createAdminClient }))
vi.mock('@/modules/users/lib/employment-client', () => ({
  getEmploymentStatus: mocks.status, assertCanCreateEmployee: mocks.canCreate, registerEmployment: mocks.register,
}))
vi.mock('@sentry/nextjs', () => ({
  startSpan: (_options: unknown, callback: (span: { setAttribute: ReturnType<typeof vi.fn> }) => unknown) => callback({ setAttribute: vi.fn() }),
  captureException: vi.fn(),
}))
import { DELETE } from '@/app/api/admin/delete-user/route'
import { POST } from '@/app/api/users/create/route'

describe('employment writer route boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'actor' } }, error: null }) },
    })
    mocks.status.mockResolvedValue({ enabled: true })
    mocks.canCreate.mockResolvedValue(undefined)
  })

  it('blocks destructive deletion before constructing an admin client when history is enabled', async () => {
    const response = await DELETE(new NextRequest('http://localhost/api/admin/delete-user?userId=actor', { method: 'DELETE' }))
    expect(response.status).toBe(409)
    expect((await response.json()).error).toContain('завершение работы')
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })

  it('does not delete when employment status cannot be checked', async () => {
    mocks.status.mockRejectedValue(new Error('unavailable'))
    const response = await DELETE(new NextRequest('http://localhost/api/admin/delete-user?userId=actor', { method: 'DELETE' }))
    expect(response.status).toBe(500)
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })

  it('checks create permission before any admin Auth operation', async () => {
    mocks.canCreate.mockRejectedValue(new Error('Недостаточно прав'))
    const response = await POST(new NextRequest('http://localhost/api/users/create', {
      method: 'POST', body: JSON.stringify({ email: 'test@example.test', password: 'not-logged' }),
    }))
    expect(response.status).toBe(403)
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
    expect(mocks.register).not.toHaveBeenCalled()
  })

  it('fails before Auth creation when history status is unavailable', async () => {
    mocks.status.mockRejectedValue(new Error('unavailable'))
    const response = await POST(new NextRequest('http://localhost/api/users/create', {
      method: 'POST', body: JSON.stringify({ email: 'test@example.test' }),
    }))
    expect(response.status).toBe(500)
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })
})
