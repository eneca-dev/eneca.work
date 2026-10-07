/**
 * Employment Board - Server Actions
 *
 * Доска занятости отдела. Источник истины — Postgres; Redis только кэширует
 * собранный ответ и держит короткий лок на запись размещения.
 */

'use server'

import { createHash } from 'node:crypto'
import { createClient } from '@/utils/supabase/server'
import * as Sentry from '@sentry/nextjs'
import type { ActionResult } from '@/modules/cache'
import type { FilterQueryParams } from '@/modules/inline-filter'
import {
  applyMandatoryFilters,
  getFilterContextForTasksTabs,
} from '@/modules/permissions'
import type { UserFilterContext } from '@/modules/permissions/types'
import {
  EMPLOYMENT_BOARD_EDIT,
  EMPLOYMENT_BOARD_VIEW,
  type EmploymentBoardPermission,
} from '../constants'
import {
  acquireLock,
  acquireBoardBuildLock,
  boardCacheKey,
  boardBuildLockKey,
  checkBoardWriteRateLimit,
  getBoardPresenceUserIds,
  getBoardVersion,
  invalidateBoardCache,
  placementLockKey,
  readBoardCache,
  releaseLock,
  touchBoardPresence,
  writeBoardCache,
} from '../lib/redis'
import {
  getCurrentMinskDate,
  getEmploymentBoardDateMode,
  isValidEmploymentBoardDate,
} from '../lib/board-date'
import { applyEmploymentBoardLoadingFilters } from '../lib/loading-query'
import { buildEmploymentBoard } from '../lib/build-board'
import { shouldUseEmploymentBoardRedis } from '../lib/cache-policy'
import type {
  BoardEmployee,
  EmploymentBoard,
  EmploymentBoardRequest,
  PinProjectInput,
  PlacementInput,
} from '../types'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFilterQueryParams(value: unknown): value is FilterQueryParams {
  return isRecord(value) && Object.values(value).every(
    (filterValue) => typeof filterValue === 'string'
      || (Array.isArray(filterValue) && filterValue.every((item) => typeof item === 'string')),
  )
}

function isEmploymentBoardRequest(value: unknown): value is EmploymentBoardRequest {
  if (!isRecord(value) || !isValidEmploymentBoardDate(value.selectedDate)) return false
  if (value.filters !== undefined && !isFilterQueryParams(value.filters)) return false
  return value.cachePolicy === undefined || value.cachePolicy === 'cache-aside' || value.cachePolicy === 'fresh'
}

function isPinProjectInput(value: unknown): value is PinProjectInput {
  return isRecord(value)
    && isUuid(value.departmentId)
    && isUuid(value.projectId)
    && (value.projectName === undefined || typeof value.projectName === 'string')
}

function isPlacementInput(value: unknown): value is PlacementInput {
  return isRecord(value)
    && isUuid(value.departmentId)
    && isUuid(value.projectId)
    && isUuid(value.employeeId)
    && isValidEmploymentBoardDate(value.selectedDate)
}

function databaseFailure<T>(
  action: string,
  userMessage: string,
  error: { message: string; code?: string },
): ActionResult<T> {
  Sentry.captureException(new Error(error.message), {
    tags: {
      module: 'employment-board',
      action,
      error_type: 'db_error',
      ...(error.code ? { error_code: error.code } : {}),
    },
  })
  return { success: false, error: userMessage }
}

/** Защита от команды устаревшего UI; проверка permission выполняется отдельно. */
function isValidTodayPlacementDate(selectedDate: unknown): selectedDate is string {
  return isValidEmploymentBoardDate(selectedDate) && selectedDate === getCurrentMinskDate()
}

const CACHE_WAIT_ATTEMPTS = 4
const CACHE_WAIT_MS = 75

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForBoardCache<T>(key: string): Promise<T | null> {
  for (let attempt = 0; attempt < CACHE_WAIT_ATTEMPTS; attempt++) {
    await wait(CACHE_WAIT_MS)
    const cached = await readBoardCache<T>(key)
    if (cached) return cached
  }
  return null
}

async function checkWriteRate(userId: string): Promise<ActionResult<null> | null> {
  const allowed = await checkBoardWriteRateLimit(userId)
  if (allowed) return null

  Sentry.addBreadcrumb({
    category: 'employment-board.rate-limit',
    message: 'Board write rate limit exceeded',
    level: 'warning',
  })
  return { success: false, error: 'Слишком много действий. Попробуйте через несколько секунд' }
}

/** Метрики серверных действий без ID, имён и других пользовательских данных. */
function createMutationMetrics(action: string) {
  const startedAt = Date.now()
  const timings: Record<string, number> = {}

  return {
    measure(name: string, started: number) {
      timings[name] = Date.now() - started
    },
    report() {
      Sentry.addBreadcrumb({
        category: 'employment-board.mutation-performance',
        message: `Board mutation: ${action}`,
        level: 'info',
        data: { ...timings, total_ms: Date.now() - startedAt },
      })
    },
  }
}

/**
 * Стабильный отпечаток видимости пользователя.
 * Входит в ключ кэша: пользователи с разными правами не должны делить кэш.
 */
function scopeHash(ctx: UserFilterContext): string {
  const parts = [
    ctx.scope?.level ?? 'none',
    (ctx.scope?.departmentIds ?? []).slice().sort().join(','),
    (ctx.scope?.projectIds ?? []).slice().sort().join(','),
    ctx.permissions.includes('hierarchy.is_admin') ? 'admin' : '',
  ].join('|')

  // Нельзя использовать короткий 32-битный hash: редкая коллизия склеит
  // Redis-снимки пользователей с разной областью видимости. SHA-256 делает
  // такую коллизию практически невозможной.
  return createHash('sha256').update(parts).digest('hex')
}

/**
 * Проверяет разрешение модуля, не требуя отдела.
 *
 * Опираться на scope нельзя: расширение до отдела даёт
 * `tasks.tabs.view.department`, которое выдано роли `user`, то есть всем
 * сотрудникам. Доступ к доске определяет только собственное разрешение.
 */
async function requireBoardPermission(
  requiredPermission: EmploymentBoardPermission,
): Promise<
  { ok: true; ctx: UserFilterContext; isAdmin: boolean } | { ok: false; error: string }
> {
  const ctxResult = await getFilterContextForTasksTabs()
  if (!ctxResult.success || !ctxResult.data) {
    return { ok: false, error: 'Unauthorized' }
  }
  const ctx = ctxResult.data
  // Должно в точности совпадать с `can_access_employment_board` в RLS.
  // Иначе Server Action мог бы разрешить действие, которое затем тихо
  // отфильтруется политикой базы (или наоборот).
  const isAdmin = ctx.roles.includes('admin')

  if (!isAdmin && !ctx.permissions.includes(requiredPermission)) {
    return { ok: false, error: 'Нет доступа к доске занятости' }
  }

  return { ok: true, ctx, isAdmin }
}

/**
 * Проверяет разрешение и определяет отдел доски.
 */
async function resolveBoardDepartment(
  requiredPermission: EmploymentBoardPermission,
  filters?: FilterQueryParams,
): Promise<
  | { ok: true; departmentId: string; ctx: UserFilterContext; isAdmin: boolean }
  | { ok: false; error: string }
> {
  const permission = await requireBoardPermission(requiredPermission)
  if (!permission.ok) return permission
  const { ctx, isAdmin } = permission

  const secureFilters = applyMandatoryFilters(filters ?? {}, ctx)
  const raw = secureFilters.department_id
  const requested = Array.isArray(raw) ? raw[0] : raw

  let departmentId = isUuid(requested)
    ? requested
    : undefined

  // Общий InlineFilter сохраняет отображаемое имя, а не UUID. Разрешаем это
  // только как удобство UI: найденный отдел всё равно проходит строгую
  // проверку области ниже, поэтому название нельзя использовать для обхода RLS.
  if (!departmentId && typeof requested === 'string' && requested.trim()) {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('departments')
      .select('department_id')
      .eq('department_name', requested.trim())
      .limit(2)

    if (error) return { ok: false, error: 'Не удалось определить отдел' }
    if (data?.length === 1) departmentId = data[0].department_id
  }

  departmentId ??= ctx.headDepartmentId ?? ctx.ownDepartmentId

  if (!isUuid(departmentId)) {
    return { ok: false, error: 'Не удалось определить отдел' }
  }

  let allowed =
    isAdmin ||
    ctx.scope?.level === 'all' ||
    departmentId === ctx.ownDepartmentId ||
    departmentId === ctx.headDepartmentId ||
    (ctx.scope?.departmentIds ?? []).includes(departmentId)

  // Руководитель подразделения может открыть доску каждого отдела своего
  // подразделения. Это нельзя выразить одним FilterQueryParams: board
  // возвращает одну доску отдела, поэтому проверяем выбранный departmentId.
  if (!allowed && ctx.headSubdivisionId) {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('departments')
      .select('subdivision_id')
      .eq('department_id', departmentId)
      .maybeSingle()

    if (error) return { ok: false, error: 'Не удалось проверить доступ к подразделению' }
    allowed = data?.subdivision_id === ctx.headSubdivisionId
  }

  if (!allowed) {
    return { ok: false, error: 'Нет доступа к этому отделу' }
  }

  return { ok: true, departmentId, ctx, isAdmin }
}

/**
 * Данные доски занятости отдела.
 *
 * Cache-aside: сначала Redis, при промахе — сборка из Postgres и запись в кэш.
 */
export async function getDepartmentEmploymentBoard(
  request: EmploymentBoardRequest,
): Promise<ActionResult<EmploymentBoard>> {
  return Sentry.startSpan(
    { name: 'getDepartmentEmploymentBoard', op: 'server.action' },
    async () => {
      let buildLock: { key: string; token: string | null } | null = null
      const startedAt = Date.now()
      const timings: Record<string, number> = {}
      const measure = (name: string, started: number) => {
        timings[name] = Date.now() - started
      }
      const reportTimings = (outcome: 'hit' | 'peer-hit' | 'rebuilt') => {
        Sentry.addBreadcrumb({
          category: 'employment-board.performance',
          message: `Board ${outcome}`,
          level: 'info',
          data: { ...timings, total_ms: Date.now() - startedAt },
        })
      }
      try {
        if (!isEmploymentBoardRequest(request)) {
          return { success: false, error: 'Некорректный запрос доски' }
        }
        const { filters, selectedDate } = request
        const dateMode = getEmploymentBoardDateMode(selectedDate, getCurrentMinskDate())
        const useRedis = shouldUseEmploymentBoardRedis(request.cachePolicy)
        const resolveStartedAt = Date.now()
        const resolved = await resolveBoardDepartment(EMPLOYMENT_BOARD_VIEW, filters)
        measure('access_ms', resolveStartedAt)
        if (!resolved.ok) return { success: false, error: resolved.error }
        const { departmentId, ctx, isAdmin } = resolved

        // Версию читаем ДО сборки: если параллельная запись сделает INCR, наш
        // ответ уйдёт в кэш под старой версией и никем прочитан не будет.
        const versionStartedAt = Date.now()
        const version = useRedis ? await getBoardVersion(departmentId) : 0
        if (useRedis) measure('redis_version_ms', versionStartedAt)
        const cacheKey = useRedis
          ? boardCacheKey(departmentId, selectedDate, dateMode, isAdmin, scopeHash(ctx), version)
          : null
        const cacheReadStartedAt = Date.now()
        const cached = cacheKey ? await readBoardCache<EmploymentBoard>(cacheKey) : null
        if (useRedis) measure('redis_read_ms', cacheReadStartedAt)
        if (cached) {
          Sentry.addBreadcrumb({
            category: 'employment-board.cache',
            message: 'Redis cache hit',
            level: 'info',
            data: { duration_ms: Date.now() - startedAt },
          })
          reportTimings('hit')
          return { success: true, data: cached }
        }

        // Один запрос строит холодный снимок; остальные коротко ждут и
        // перечитывают Redis. Если первый запрос упал, ожидатели сами
        // продолжат сборку — доступность важнее идеальной дедупликации.
        if (cacheKey) {
          const lockStartedAt = Date.now()
          const acquiredBuildLock = await acquireBoardBuildLock(
            departmentId,
            selectedDate,
            dateMode,
            version,
          )
          measure('redis_lock_ms', lockStartedAt)
          if (acquiredBuildLock.acquired) {
            buildLock = {
              key: boardBuildLockKey(departmentId, selectedDate, dateMode, version),
              token: acquiredBuildLock.token,
            }
          } else {
            const peerWaitStartedAt = Date.now()
            const filledByPeer = await waitForBoardCache<EmploymentBoard>(cacheKey)
            measure('peer_wait_ms', peerWaitStartedAt)
            if (filledByPeer) {
              reportTimings('peer-hit')
              return { success: true, data: filledByPeer }
            }
          }
        }

        Sentry.addBreadcrumb({
          category: 'employment-board.cache',
          message: 'Redis cache miss',
          level: 'info',
          data: { duration_ms: Date.now() - startedAt },
        })

        const databaseBuildStartedAt = Date.now()
        const supabase = await createClient()
        const fail = (message: string): ActionResult<EmploymentBoard> => {
          Sentry.captureException(new Error(message), {
            tags: {
              module: 'employment-board',
              action: 'getDepartmentEmploymentBoard',
              error_type: 'db_error',
              user_facing: 'true',
            },
          })
          return { success: false, error: 'Не удалось загрузить доску' }
        }

        // ─── Шаг 1: состав отдела и ручные данные доски (параллельно) ───
        // Намеренно НЕ используем view_departments_sections_loadings: она
        // разворачивает все ~5000 разделов со всеми объектами и проектами,
        // чтобы вернуть единицы строк (замер: 135 мс против 0.4 мс у прямых
        // запросов по индексам).
        const [employeesResult, pinnedResult, placementsResult, deptResult] = await Promise.all([
          supabase
            .from('view_users')
            .select('user_id, first_name, last_name, avatar_url, position_name, team_name')
            .eq('department_id', departmentId)
            .eq('is_active', true),
          supabase
            .from('department_pinned_projects')
            .select('project_id')
            .eq('department_id', departmentId),
          dateMode === 'today'
            ? supabase
                .from('department_board_placements')
                .select('project_id, employee_id')
                .eq('department_id', departmentId)
            : Promise.resolve({ data: [], error: null }),
          supabase
            .from('departments')
            .select('department_name')
            .eq('department_id', departmentId)
            .single(),
        ])

        const step1Error =
          employeesResult.error || pinnedResult.error || placementsResult.error || deptResult.error
        if (step1Error) return fail(step1Error.message)

        const employees: BoardEmployee[] = (employeesResult.data ?? []).map((u) => ({
          id: u.user_id as string,
          name: [u.first_name, u.last_name].filter(Boolean).join(' ') || 'Без имени',
          avatarUrl: (u.avatar_url as string | null) ?? null,
          positionName: (u.position_name as string | null) ?? null,
          teamName: (u.team_name as string | null) ?? null,
        }))
        const employeeIds = employees.map((e) => e.id)

        // ─── Шаг 2: активные загрузки сотрудников отдела на сегодня ───
        // Индексный доступ по (loading_responsible, даты) — см.
        // idx_loadings_responsible_status_composite.
        const loadingsResult = employeeIds.length
          ? await applyEmploymentBoardLoadingFilters(
              supabase
                .from('loadings')
                .select('loading_responsible, loading_rate, loading_section')
                .in('loading_responsible', employeeIds),
              selectedDate,
            )
          : { data: [], error: null }

        if (loadingsResult.error) return fail(loadingsResult.error.message)

        // ─── Шаг 3: разделы загрузок → проекты ───
        const sectionIds = Array.from(
          new Set(
            (loadingsResult.data ?? [])
              .map((l) => l.loading_section as string | null)
              .filter((id): id is string => !!id),
          ),
        )

        const sectionsResult = sectionIds.length
          ? await supabase
              .from('sections')
              .select('section_id, section_project_id')
              .in('section_id', sectionIds)
          : { data: [], error: null }

        if (sectionsResult.error) return fail(sectionsResult.error.message)

        const projectIdBySection = new Map<string, string>()
        for (const s of sectionsResult.data ?? []) {
          const projectId = s.section_project_id as string | null
          if (projectId) projectIdBySection.set(s.section_id as string, projectId)
        }

        // ─── Шаг 4: названия проектов (загрузки + закреплённые) ───
        const pinnedIdsRaw = (pinnedResult.data ?? []).map((p) => p.project_id as string)
        const neededProjectIds = Array.from(
          new Set([...projectIdBySection.values(), ...pinnedIdsRaw]),
        )

        const projectsResult = neededProjectIds.length
          ? await supabase
              .from('projects')
              .select('project_id, project_name, is_restricted')
              .in('project_id', neededProjectIds)
          : { data: [], error: null }

        if (projectsResult.error) return fail(projectsResult.error.message)

        // Restricted-проекты отсекаем прямо здесь: признак пришёл вместе с
        // названием, отдельный запрос не нужен, и при сбое запроса мы уже
        // вышли с ошибкой — «тихого» открытия доступа быть не может.
        const board = buildEmploymentBoard({
          selectedDate,
          dateMode,
          departmentId,
          departmentName: deptResult.data?.department_name ?? null,
          isAdmin,
          employees,
          loadings: (loadingsResult.data ?? []).map((row) => ({
            employeeId: row.loading_responsible,
            rate: row.loading_rate,
            sectionId: row.loading_section,
          })),
          projectIdBySection,
          projects: (projectsResult.data ?? []).map((project) => ({
            id: project.project_id,
            name: project.project_name,
            isRestricted: project.is_restricted,
          })),
          pinnedProjectIds: pinnedIdsRaw,
          placements: (placementsResult.data ?? []).map((placement) => ({
            projectId: placement.project_id,
            employeeId: placement.employee_id,
          })),
        })

        measure('database_build_ms', databaseBuildStartedAt)
        const cacheWriteStartedAt = Date.now()
        if (cacheKey) {
          await writeBoardCache(cacheKey, board)
          measure('redis_write_ms', cacheWriteStartedAt)
        }
        Sentry.addBreadcrumb({
          category: 'employment-board.cache',
          message: 'Board cache rebuilt',
          level: 'info',
          data: { duration_ms: Date.now() - startedAt },
        })
        reportTimings('rebuilt')
        return { success: true, data: board }
      } catch (error) {
        Sentry.captureException(error, {
          tags: {
            module: 'employment-board',
            action: 'getDepartmentEmploymentBoard',
            error_type: 'unexpected_error',
            user_facing: 'true',
          },
        })
        return {
          success: false,
          error: 'Не удалось загрузить доску',
        }
      } finally {
        if (buildLock) await releaseLock(buildLock.key, buildLock.token)
      }
    },
  )
}

/**
 * Поиск проектов для ручного добавления на доску.
 * Ищет по названию, скрывая restricted-проекты от не-админов.
 *
 * Отдел здесь намеренно не резолвится: поиск идёт по всем проектам, и
 * привязка к отделу лишь ломала бы поиск тем, у кого отдел не определён
 * (например, администратору без отдела).
 */
export async function searchBoardProjects(
  query: string,
): Promise<ActionResult<Array<{ id: string; name: string }>>> {
  try {
    const permission = await requireBoardPermission(EMPLOYMENT_BOARD_EDIT)
    if (!permission.ok) return { success: false, error: permission.error }

    const term = query.trim()
    if (term.length < 2) return { success: true, data: [] }

    const supabase = await createClient()
    let projectsQuery = supabase
      .from('projects')
      .select('project_id, project_name')
      // Экранируем спецсимволы ilike, чтобы ввод не менял семантику поиска.
      // `*` тоже: PostgREST мапит его в `%` до передачи в Postgres.
      .ilike('project_name', `%${term.replace(/[%_*\\]/g, '\\$&')}%`)
      .limit(20)

    if (!permission.isAdmin) {
      projectsQuery = projectsQuery.eq('is_restricted', false)
    }

    const { data, error } = await projectsQuery
    if (error) {
      return databaseFailure('searchBoardProjects', 'Не удалось выполнить поиск проектов', error)
    }

    return {
      success: true,
      data: (data ?? []).map((p) => ({
        id: p.project_id as string,
        name: (p.project_name as string) ?? 'Без названия',
      })),
    }
  } catch (error) {
    Sentry.captureException(error, {
      tags: { module: 'employment-board', action: 'searchBoardProjects', error_type: 'unexpected_error' },
    })
    return {
      success: false,
      error: 'Не удалось выполнить поиск проектов',
    }
  }
}

/** Закрепить проект на доске отдела */
export async function pinProject(input: PinProjectInput): Promise<ActionResult<null>> {
  const metrics = createMutationMetrics('pinProject')
  try {
    if (!isPinProjectInput(input)) {
      return { success: false, error: 'Некорректные данные' }
    }
    const permissionStartedAt = Date.now()
    const resolved = await resolveBoardDepartment(EMPLOYMENT_BOARD_EDIT, { department_id: input.departmentId })
    metrics.measure('permission_ms', permissionStartedAt)
    if (!resolved.ok) return { success: false, error: resolved.error }
    const supabase = await createClient()
    // resolveBoardDepartment уже проверил сессию через getFilterContext.
    // Не делаем второй сетевой auth.getUser() за тем же userId.
    const userId = resolved.ctx.userId
    const rateLimitStartedAt = Date.now()
    const rateError = await checkWriteRate(userId)
    metrics.measure('rate_limit_ms', rateLimitStartedAt)
    if (rateError) return rateError

    const insertStartedAt = Date.now()
    const { error } = await supabase.from('department_pinned_projects').insert({
      department_id: resolved.departmentId,
      project_id: input.projectId,
      pinned_by: userId,
    })
    metrics.measure('insert_ms', insertStartedAt)

    // 23505 — проект уже закреплён, это не ошибка для пользователя
    if (error && error.code !== '23505') {
      return databaseFailure('pinProject', 'Не удалось закрепить проект', error)
    }

    const redisInvalidateStartedAt = Date.now()
    await invalidateBoardCache(resolved.departmentId)
    metrics.measure('redis_invalidate_ms', redisInvalidateStartedAt)
    return { success: true, data: null }
  } catch (error) {
    Sentry.captureException(error, {
      tags: { module: 'employment-board', action: 'pinProject', error_type: 'unexpected_error' },
    })
    return {
      success: false,
      error: 'Не удалось закрепить проект',
    }
  } finally {
    metrics.report()
  }
}

/** Убрать закреплённый проект с доски */
export async function unpinProject(input: PinProjectInput): Promise<ActionResult<null>> {
  const metrics = createMutationMetrics('unpinProject')
  try {
    if (!isPinProjectInput(input)) {
      return { success: false, error: 'Некорректные данные' }
    }
    const permissionStartedAt = Date.now()
    const resolved = await resolveBoardDepartment(EMPLOYMENT_BOARD_EDIT, { department_id: input.departmentId })
    metrics.measure('permission_ms', permissionStartedAt)
    if (!resolved.ok) return { success: false, error: resolved.error }
    const supabase = await createClient()
    const rateLimitStartedAt = Date.now()
    const rateError = await checkWriteRate(resolved.ctx.userId)
    metrics.measure('rate_limit_ms', rateLimitStartedAt)
    if (rateError) return rateError
    const deleteStartedAt = Date.now()
    const { error } = await supabase
      .from('department_pinned_projects')
      .delete()
      .eq('department_id', resolved.departmentId)
      .eq('project_id', input.projectId)
    metrics.measure('delete_ms', deleteStartedAt)

    if (error) {
      return databaseFailure('unpinProject', 'Не удалось открепить проект', error)
    }

    const redisInvalidateStartedAt = Date.now()
    await invalidateBoardCache(resolved.departmentId)
    metrics.measure('redis_invalidate_ms', redisInvalidateStartedAt)
    return { success: true, data: null }
  } catch (error) {
    Sentry.captureException(error, {
      tags: { module: 'employment-board', action: 'unpinProject', error_type: 'unexpected_error' },
    })
    return {
      success: false,
      error: 'Не удалось открепить проект',
    }
  } finally {
    metrics.report()
  }
}

/**
 * Поместить сотрудника на карточку проекта (ручная аннотация доски).
 * НЕ создаёт загрузку и не участвует в планировании.
 */
export async function placeEmployee(input: PlacementInput): Promise<ActionResult<null>> {
  // Резолв отдела и взятие лока — тоже под try: исключение отсюда иначе
  // вылетело бы наружу, минуя контракт ActionResult.
  let lock: { key: string; token: string | null } | null = null
  const metrics = createMutationMetrics('placeEmployee')
  try {
    if (!isPlacementInput(input)) {
      return { success: false, error: 'Некорректные данные' }
    }
    const permissionStartedAt = Date.now()
    const resolved = await resolveBoardDepartment(EMPLOYMENT_BOARD_EDIT, { department_id: input.departmentId })
    metrics.measure('permission_ms', permissionStartedAt)
    if (!resolved.ok) return { success: false, error: resolved.error }
    if (!isValidTodayPlacementDate(input.selectedDate)) {
      return { success: false, error: 'Доска устарела. Обновите страницу и повторите действие' }
    }
    const lockKey = placementLockKey(resolved.departmentId, input.employeeId)
    const lockStartedAt = Date.now()
    const acquiredLock = await acquireLock(lockKey)
    metrics.measure('redis_lock_ms', lockStartedAt)
    if (!acquiredLock.acquired) {
      return { success: false, error: 'Сотрудника уже перемещают, попробуйте ещё раз' }
    }
    lock = { key: lockKey, token: acquiredLock.token }

    const supabase = await createClient()
    // После лока эти независимые проверки идут параллельно, а не двумя
    // последовательными сетевыми запросами.
    const rateLimitStartedAt = Date.now()
    const employeeCheckStartedAt = Date.now()
    const rateLimitPromise = checkWriteRate(resolved.ctx.userId).then((result) => {
      metrics.measure('rate_limit_ms', rateLimitStartedAt)
      return result
    })
    const employeeCheckPromise = supabase
      .from('view_users')
      .select('department_id')
      .eq('user_id', input.employeeId)
      .single()
      .then((result) => {
        metrics.measure('employee_check_ms', employeeCheckStartedAt)
        return result
      })
    const [rateError, employeeResult] = await Promise.all([rateLimitPromise, employeeCheckPromise])
    if (rateError) return rateError
    const { data: employee } = employeeResult

    if (!employee || employee.department_id !== resolved.departmentId) {
      return { success: false, error: 'Сотрудник не состоит в этом отделе' }
    }

    // Повторно сужаем окно перехода через минскую полночь непосредственно
    // перед записью. Это дополнительная защита устаревшего UI, не обещание
    // атомарности с INSERT.
    if (!isValidTodayPlacementDate(input.selectedDate)) {
      return { success: false, error: 'Доска устарела. Обновите страницу и повторите действие' }
    }
    const insertStartedAt = Date.now()
    const { error } = await supabase.from('department_board_placements').insert({
      department_id: resolved.departmentId,
      project_id: input.projectId,
      employee_id: input.employeeId,
      placed_by: resolved.ctx.userId,
    })
    metrics.measure('insert_ms', insertStartedAt)

    if (error && error.code !== '23505') {
      return databaseFailure('placeEmployee', 'Не удалось разместить сотрудника', error)
    }

    const redisInvalidateStartedAt = Date.now()
    await invalidateBoardCache(resolved.departmentId)
    metrics.measure('redis_invalidate_ms', redisInvalidateStartedAt)
    return { success: true, data: null }
  } catch (error) {
    Sentry.captureException(error, {
      tags: { module: 'employment-board', action: 'placeEmployee', error_type: 'unexpected_error' },
    })
    return {
      success: false,
      error: 'Не удалось разместить сотрудника',
    }
  } finally {
    if (lock) {
      const releaseLockStartedAt = Date.now()
      await releaseLock(lock.key, lock.token)
      metrics.measure('redis_lock_release_ms', releaseLockStartedAt)
    }
    metrics.report()
  }
}

/** Убрать ручное размещение сотрудника с карточки проекта */
export async function removePlacement(input: PlacementInput): Promise<ActionResult<null>> {
  const metrics = createMutationMetrics('removePlacement')
  try {
    if (!isPlacementInput(input)) {
      return { success: false, error: 'Некорректные данные' }
    }
    const permissionStartedAt = Date.now()
    const resolved = await resolveBoardDepartment(EMPLOYMENT_BOARD_EDIT, { department_id: input.departmentId })
    metrics.measure('permission_ms', permissionStartedAt)
    if (!resolved.ok) return { success: false, error: resolved.error }
    if (!isValidTodayPlacementDate(input.selectedDate)) {
      return { success: false, error: 'Доска устарела. Обновите страницу и повторите действие' }
    }
    const supabase = await createClient()
    const rateLimitStartedAt = Date.now()
    const rateError = await checkWriteRate(resolved.ctx.userId)
    metrics.measure('rate_limit_ms', rateLimitStartedAt)
    if (rateError) return rateError
    // Как и для INSERT, повторная проверка лишь уменьшает окно гонки с
    // минской полночью; транзакционной гарантии между проверкой и DELETE нет.
    if (!isValidTodayPlacementDate(input.selectedDate)) {
      return { success: false, error: 'Доска устарела. Обновите страницу и повторите действие' }
    }
    const deleteStartedAt = Date.now()
    const { error } = await supabase
      .from('department_board_placements')
      .delete()
      .eq('department_id', resolved.departmentId)
      .eq('project_id', input.projectId)
      .eq('employee_id', input.employeeId)
    metrics.measure('delete_ms', deleteStartedAt)

    if (error) {
      return databaseFailure('removePlacement', 'Не удалось убрать сотрудника', error)
    }

    const redisInvalidateStartedAt = Date.now()
    await invalidateBoardCache(resolved.departmentId)
    metrics.measure('redis_invalidate_ms', redisInvalidateStartedAt)
    return { success: true, data: null }
  } catch (error) {
    Sentry.captureException(error, {
      tags: { module: 'employment-board', action: 'removePlacement', error_type: 'unexpected_error' },
    })
    return {
      success: false,
      error: 'Не удалось убрать сотрудника',
    }
  } finally {
    metrics.report()
  }
}

/** Heartbeat открытой доски и список коллег, которые смотрят её сейчас. */
export async function reportBoardPresence(
  departmentId: string,
): Promise<ActionResult<string[]>> {
  try {
    if (!isUuid(departmentId)) return { success: false, error: 'Некорректный отдел' }
    const resolved = await resolveBoardDepartment(EMPLOYMENT_BOARD_VIEW, { department_id: departmentId })
    if (!resolved.ok) return { success: false, error: resolved.error }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Unauthorized' }

    await touchBoardPresence(resolved.departmentId, user.id)
    return { success: true, data: await getBoardPresenceUserIds(resolved.departmentId) }
  } catch (error) {
    Sentry.captureException(error, {
      tags: { module: 'employment-board', action: 'reportBoardPresence', error_type: 'unexpected_error' },
    })
    return { success: false, error: 'Не удалось обновить presence' }
  }
}
