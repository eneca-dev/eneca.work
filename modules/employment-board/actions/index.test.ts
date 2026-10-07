import { beforeEach, describe, expect, it, vi } from 'vitest'

const TODAY = '2026-10-07'
const TOMORROW = '2026-10-08'
const DEPARTMENT_ID = '11111111-1111-4111-8111-111111111111'
const PROJECT_ID = '22222222-2222-4222-8222-222222222222'
const EMPLOYEE_ID = '33333333-3333-4333-8333-333333333333'
const USER_ID = '44444444-4444-4444-8444-444444444444'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  applyMandatoryFilters: vi.fn((filters: unknown) => filters),
  getFilterContextForTasksTabs: vi.fn(),
  getCurrentMinskDate: vi.fn(),
  acquireLock: vi.fn(),
  acquireBoardBuildLock: vi.fn(),
  boardCacheKey: vi.fn(() => 'board-cache-key'),
  boardBuildLockKey: vi.fn(() => 'board-build-lock-key'),
  checkBoardWriteRateLimit: vi.fn(),
  getBoardPresenceUserIds: vi.fn(),
  getBoardVersion: vi.fn(),
  invalidateBoardCache: vi.fn(),
  placementLockKey: vi.fn(() => 'placement-lock-key'),
  readBoardCache: vi.fn(),
  releaseLock: vi.fn(),
  touchBoardPresence: vi.fn(),
  writeBoardCache: vi.fn(),
}))

vi.mock('@/utils/supabase/server', () => ({
  createClient: mocks.createClient,
}))

vi.mock('@/modules/permissions', () => ({
  applyMandatoryFilters: mocks.applyMandatoryFilters,
  getFilterContextForTasksTabs: mocks.getFilterContextForTasksTabs,
}))

vi.mock('@sentry/nextjs', () => ({
  addBreadcrumb: vi.fn(),
  captureException: vi.fn(),
  startSpan: vi.fn((_options: unknown, callback: () => unknown) => callback()),
}))

vi.mock('../lib/board-date', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/board-date')>()
  return { ...actual, getCurrentMinskDate: mocks.getCurrentMinskDate }
})

vi.mock('../lib/redis', () => ({
  acquireLock: mocks.acquireLock,
  acquireBoardBuildLock: mocks.acquireBoardBuildLock,
  boardCacheKey: mocks.boardCacheKey,
  boardBuildLockKey: mocks.boardBuildLockKey,
  checkBoardWriteRateLimit: mocks.checkBoardWriteRateLimit,
  getBoardPresenceUserIds: mocks.getBoardPresenceUserIds,
  getBoardVersion: mocks.getBoardVersion,
  invalidateBoardCache: mocks.invalidateBoardCache,
  placementLockKey: mocks.placementLockKey,
  readBoardCache: mocks.readBoardCache,
  releaseLock: mocks.releaseLock,
  touchBoardPresence: mocks.touchBoardPresence,
  writeBoardCache: mocks.writeBoardCache,
}))

import {
  getDepartmentEmploymentBoard,
  pinProject,
  placeEmployee,
  removePlacement,
  unpinProject,
} from './index'
import type { EmploymentBoardRequest, PinProjectInput, PlacementInput } from '../types'

interface QueryResult {
  data: unknown
  error: null | { code?: string; message: string }
}

type QuerySource = QueryResult | Promise<QueryResult>

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((promiseResolve) => { resolve = promiseResolve })
  return { promise, resolve }
}

function createQuery(source: QuerySource) {
  const result = Promise.resolve(source)
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    lte: vi.fn(),
    gte: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
    single: vi.fn(() => result),
    maybeSingle: vi.fn(() => result),
    limit: vi.fn(),
    ilike: vi.fn(),
    then: (resolve: (value: QueryResult) => unknown, reject: (reason: unknown) => unknown) =>
      result.then(resolve, reject),
  }

  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.in.mockReturnValue(query)
  query.lte.mockReturnValue(query)
  query.gte.mockReturnValue(query)
  query.insert.mockReturnValue(query)
  query.delete.mockReturnValue(query)
  query.limit.mockReturnValue(query)
  query.ilike.mockReturnValue(query)
  return query
}

function createSupabase(results: Record<string, QuerySource>) {
  const queries = new Map<string, ReturnType<typeof createQuery>>()
  const from = vi.fn((table: string) => {
    const query = createQuery(results[table] ?? { data: [], error: null })
    queries.set(table, query)
    return query
  })
  return { client: { from }, from, queries }
}

const permissionContext = {
  userId: USER_ID,
  roles: ['admin'],
  permissions: [],
  scope: { level: 'all', departmentIds: [], projectIds: [] },
  ownDepartmentId: null,
  headDepartmentId: null,
  headSubdivisionId: null,
}

const placement: PlacementInput = {
  departmentId: DEPARTMENT_ID,
  projectId: PROJECT_ID,
  employeeId: EMPLOYEE_ID,
  selectedDate: TODAY,
}

describe('employment board server action contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getFilterContextForTasksTabs.mockResolvedValue({ success: true, data: permissionContext })
    mocks.getCurrentMinskDate.mockReturnValue(TODAY)
    mocks.acquireLock.mockResolvedValue({ acquired: true, token: 'token' })
    mocks.acquireBoardBuildLock.mockResolvedValue({ acquired: true, token: 'build-token' })
    mocks.checkBoardWriteRateLimit.mockResolvedValue(true)
    mocks.getBoardVersion.mockResolvedValue(5)
    mocks.readBoardCache.mockResolvedValue(null)
  })

  it('rejects malformed top-level inputs with stable safe errors', async () => {
    await expect(
      getDepartmentEmploymentBoard(null as unknown as EmploymentBoardRequest),
    ).resolves.toEqual({ success: false, error: 'Некорректный запрос доски' })
    await expect(
      placeEmployee(null as unknown as PlacementInput),
    ).resolves.toEqual({ success: false, error: 'Некорректные данные' })
    await expect(
      removePlacement({ ...placement, employeeId: 'not-a-uuid' }),
    ).resolves.toEqual({ success: false, error: 'Некорректные данные' })
    await expect(
      pinProject(null as unknown as PinProjectInput),
    ).resolves.toEqual({ success: false, error: 'Некорректные данные' })
    await expect(
      unpinProject({ projectId: PROJECT_ID } as PinProjectInput),
    ).resolves.toEqual({ success: false, error: 'Некорректные данные' })
    await expect(
      getDepartmentEmploymentBoard({
        selectedDate: TODAY,
        filters: { department_id: {} } as unknown as EmploymentBoardRequest['filters'],
      }),
    ).resolves.toEqual({ success: false, error: 'Некорректный запрос доски' })

    expect(mocks.getFilterContextForTasksTabs).not.toHaveBeenCalled()
    expect(mocks.createClient).not.toHaveBeenCalled()
  })

  it('does not touch Redis version, snapshot, build lock or write on a fresh read', async () => {
    const supabase = createSupabase({
      view_users: { data: [], error: null },
      department_pinned_projects: { data: [], error: null },
      departments: { data: { department_name: 'Отдел' }, error: null },
    })
    mocks.createClient.mockResolvedValue(supabase.client)

    const result = await getDepartmentEmploymentBoard({
      filters: { department_id: DEPARTMENT_ID },
      selectedDate: TOMORROW,
      cachePolicy: 'fresh',
    })

    expect(result).toMatchObject({
      success: true,
      data: { selectedDate: TOMORROW, dateMode: 'dated', departmentId: DEPARTMENT_ID },
    })
    expect(mocks.getBoardVersion).not.toHaveBeenCalled()
    expect(mocks.readBoardCache).not.toHaveBeenCalled()
    expect(mocks.acquireBoardBuildLock).not.toHaveBeenCalled()
    expect(mocks.writeBoardCache).not.toHaveBeenCalled()
  })

  it('keeps database details out of client-facing errors', async () => {
    const boardSupabase = createSupabase({
      view_users: { data: null, error: { message: 'relation secret_table does not exist' } },
      department_pinned_projects: { data: [], error: null },
      departments: { data: { department_name: 'Отдел' }, error: null },
    })
    const pinSupabase = createSupabase({
      department_pinned_projects: {
        data: null,
        error: { code: '42501', message: 'row violates secret_rls_policy' },
      },
    })
    mocks.createClient
      .mockResolvedValueOnce(boardSupabase.client)
      .mockResolvedValueOnce(pinSupabase.client)

    await expect(getDepartmentEmploymentBoard({
      filters: { department_id: DEPARTMENT_ID },
      selectedDate: TODAY,
      cachePolicy: 'fresh',
    })).resolves.toEqual({ success: false, error: 'Не удалось загрузить доску' })
    await expect(pinProject({
      departmentId: DEPARTMENT_ID,
      projectId: PROJECT_ID,
    })).resolves.toEqual({ success: false, error: 'Не удалось закрепить проект' })
  })

  it('keeps a late old-version build outside the key read by a newer visitor', async () => {
    const delayedEmployees = deferred<QueryResult>()
    const oldBuild = createSupabase({
      view_users: delayedEmployees.promise,
      department_pinned_projects: { data: [], error: null },
      departments: { data: { department_name: 'Старый снимок' }, error: null },
    })
    const currentBuild = createSupabase({
      view_users: { data: [], error: null },
      department_pinned_projects: { data: [], error: null },
      departments: { data: { department_name: 'Текущий снимок' }, error: null },
    })
    mocks.createClient
      .mockResolvedValueOnce(oldBuild.client)
      .mockResolvedValueOnce(currentBuild.client)
    mocks.getBoardVersion.mockResolvedValueOnce(3).mockResolvedValueOnce(4)
    mocks.boardCacheKey
      .mockImplementationOnce((...args: unknown[]) => `board:${String(args[5])}`)
      .mockImplementationOnce((...args: unknown[]) => `board:${String(args[5])}`)

    const request = {
      filters: { department_id: DEPARTMENT_ID },
      selectedDate: TOMORROW,
      cachePolicy: 'cache-aside' as const,
    }
    const lateOldRequest = getDepartmentEmploymentBoard(request)
    await vi.waitFor(() => expect(mocks.createClient).toHaveBeenCalledTimes(1))

    await expect(getDepartmentEmploymentBoard(request)).resolves.toMatchObject({
      success: true,
      data: { departmentName: 'Текущий снимок' },
    })
    delayedEmployees.resolve({ data: [], error: null })
    await expect(lateOldRequest).resolves.toMatchObject({
      success: true,
      data: { departmentName: 'Старый снимок' },
    })

    expect(mocks.writeBoardCache.mock.calls.map(([key]) => key)).toEqual([
      'board:4',
      'board:3',
    ])
    expect(mocks.readBoardCache.mock.calls.map(([key]) => key)).toEqual([
      'board:3',
      'board:4',
    ])
  })

  it('rechecks today immediately before placement insert', async () => {
    const supabase = createSupabase({
      view_users: { data: { department_id: DEPARTMENT_ID }, error: null },
    })
    mocks.createClient.mockResolvedValue(supabase.client)
    mocks.getCurrentMinskDate.mockReturnValueOnce(TODAY).mockReturnValue(TOMORROW)

    await expect(placeEmployee(placement)).resolves.toEqual({
      success: false,
      error: 'Доска устарела. Обновите страницу и повторите действие',
    })

    expect(supabase.from).not.toHaveBeenCalledWith('department_board_placements')
    expect(mocks.releaseLock).toHaveBeenCalledWith('placement-lock-key', 'token')
  })

  it('rechecks today immediately before placement delete', async () => {
    const supabase = createSupabase({})
    mocks.createClient.mockResolvedValue(supabase.client)
    mocks.getCurrentMinskDate.mockReturnValueOnce(TODAY).mockReturnValue(TOMORROW)

    await expect(removePlacement(placement)).resolves.toEqual({
      success: false,
      error: 'Доска устарела. Обновите страницу и повторите действие',
    })

    expect(supabase.from).not.toHaveBeenCalledWith('department_board_placements')
  })
})
