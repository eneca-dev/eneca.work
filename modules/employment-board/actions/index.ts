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
import { formatMinskDate } from '@/lib/timezone-utils'
import type { ActionResult } from '@/modules/cache'
import type { FilterQueryParams } from '@/modules/inline-filter'
import {
  applyMandatoryFilters,
  getFilterContextForTasksTabs,
} from '@/modules/permissions'
import type { UserFilterContext } from '@/modules/permissions/types'
import { compareProjectsByGup } from '@/modules/sections-page/utils/sort-projects'
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
import type {
  BoardEmployee,
  BoardProject,
  EmploymentBoard,
  PinProjectInput,
  PlacementInput,
} from '../types'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value)
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
  filters?: FilterQueryParams,
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
        const resolveStartedAt = Date.now()
        const resolved = await resolveBoardDepartment(EMPLOYMENT_BOARD_VIEW, filters)
        measure('access_ms', resolveStartedAt)
        if (!resolved.ok) return { success: false, error: resolved.error }
        const { departmentId, ctx, isAdmin } = resolved

        // Версию читаем ДО сборки: если параллельная запись сделает INCR, наш
        // ответ уйдёт в кэш под старой версией и никем прочитан не будет.
        const versionStartedAt = Date.now()
        const version = await getBoardVersion(departmentId)
        measure('redis_version_ms', versionStartedAt)
        const cacheKey = boardCacheKey(departmentId, isAdmin, scopeHash(ctx), version)
        const cacheReadStartedAt = Date.now()
        const cached = await readBoardCache<EmploymentBoard>(cacheKey)
        measure('redis_read_ms', cacheReadStartedAt)
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
        const lockStartedAt = Date.now()
        const acquiredBuildLock = await acquireBoardBuildLock(departmentId, version)
        measure('redis_lock_ms', lockStartedAt)
        if (acquiredBuildLock.acquired) {
          buildLock = {
            key: boardBuildLockKey(departmentId, version),
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

        Sentry.addBreadcrumb({
          category: 'employment-board.cache',
          message: 'Redis cache miss',
          level: 'info',
          data: { duration_ms: Date.now() - startedAt },
        })

        const databaseBuildStartedAt = Date.now()
        const supabase = await createClient()
        const today = formatMinskDate(new Date())

        const fail = (message: string): ActionResult<EmploymentBoard> => {
          Sentry.captureException(new Error(message), {
            tags: {
              module: 'employment-board',
              action: 'getDepartmentEmploymentBoard',
              error_type: 'db_error',
              user_facing: 'true',
            },
          })
          return { success: false, error: `Ошибка загрузки доски: ${message}` }
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
          supabase
            .from('department_board_placements')
            .select('project_id, employee_id')
            .eq('department_id', departmentId),
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
        const employeeById = new Map(employees.map((e) => [e.id, e]))
        const employeeIds = employees.map((e) => e.id)

        // ─── Шаг 2: активные загрузки сотрудников отдела на сегодня ───
        // Индексный доступ по (loading_responsible, даты) — см.
        // idx_loadings_responsible_status_composite.
        const loadingsResult = employeeIds.length
          ? await supabase
              .from('loadings')
              .select('loading_responsible, loading_rate, loading_section')
              .in('loading_responsible', employeeIds)
              .eq('loading_status', 'active')
              .eq('is_shortage', false)
              .lte('loading_start', today)
              .gte('loading_finish', today)
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
        const projectNameById = new Map<string, string>()
        for (const p of projectsResult.data ?? []) {
          if (!isAdmin && p.is_restricted) continue
          projectNameById.set(p.project_id as string, (p.project_name as string) ?? 'Без названия')
        }

        // ─── Сборка доски ───
        const projectsMap = new Map<string, BoardProject>()
        const employeeRateByProject = new Map<string, Map<string, number>>()

        const ensureProject = (projectId: string): BoardProject | null => {
          const existing = projectsMap.get(projectId)
          if (existing) return existing

          // Проекта нет в projectNameById → он restricted и скрыт от этого
          // пользователя (либо удалён между запросами). На доску не попадает.
          const name = projectNameById.get(projectId)
          if (!name) return null

          const project: BoardProject = { id: projectId, name, isPinned: false, employees: [] }
          projectsMap.set(projectId, project)
          return project
        }

        // Проекты и ставки из активных загрузок
        for (const row of loadingsResult.data ?? []) {
          const employeeId = row.loading_responsible as string | null
          const sectionId = row.loading_section as string | null
          if (!employeeId || !sectionId) continue

          const projectId = projectIdBySection.get(sectionId)
          if (!projectId || !ensureProject(projectId)) continue

          if (!employeeRateByProject.has(projectId)) {
            employeeRateByProject.set(projectId, new Map())
          }
          const rates = employeeRateByProject.get(projectId)!
          const rate = Number(row.loading_rate ?? 0)
          rates.set(employeeId, (rates.get(employeeId) ?? 0) + (isNaN(rate) ? 0 : rate))
        }

        for (const [projectId, rates] of employeeRateByProject) {
          const project = projectsMap.get(projectId)!
          for (const [employeeId, rate] of rates) {
            const employee = employeeById.get(employeeId)
            if (!employee) continue
            project.employees.push({ ...employee, source: 'loading', rate })
          }
        }

        // Вручную закреплённые проекты (могут быть без загрузок)
        for (const id of pinnedIdsRaw) {
          const project = ensureProject(id)
          if (project) project.isPinned = true
        }

        // Ручные размещения поверх авто-размещений
        for (const row of placementsResult.data ?? []) {
          const projectId = row.project_id as string
          const employeeId = row.employee_id as string
          const project = projectsMap.get(projectId)
          const employee = employeeById.get(employeeId)
          if (!project || !employee) continue
          if (project.employees.some((e) => e.id === employeeId)) continue
          project.employees.push({ ...employee, source: 'manual', rate: null })
        }

        const projects = Array.from(projectsMap.values()).sort(compareProjectsByGup)
        for (const project of projects) {
          project.employees.sort((a, b) => a.name.localeCompare(b.name, 'ru'))
        }

        const placedIds = new Set<string>()
        for (const project of projects) {
          for (const e of project.employees) placedIds.add(e.id)
        }

        const board: EmploymentBoard = {
          departmentId,
          departmentName: (deptResult.data?.department_name as string) ?? 'Отдел',
          projects,
          employees: employees.sort((a, b) => a.name.localeCompare(b.name, 'ru')),
          unassignedEmployeeIds: employees
            .filter((e) => !placedIds.has(e.id))
            .map((e) => e.id),
        }

        measure('database_build_ms', databaseBuildStartedAt)
        const cacheWriteStartedAt = Date.now()
        await writeBoardCache(cacheKey, board)
        measure('redis_write_ms', cacheWriteStartedAt)
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
          error: error instanceof Error ? error.message : 'Неизвестная ошибка',
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
      return { success: false, error: `Ошибка поиска проектов: ${error.message}` }
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
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
}

/** Закрепить проект на доске отдела */
export async function pinProject(input: PinProjectInput): Promise<ActionResult<null>> {
  const metrics = createMutationMetrics('pinProject')
  try {
    const permissionStartedAt = Date.now()
    const resolved = await resolveBoardDepartment(EMPLOYMENT_BOARD_EDIT, { department_id: input.departmentId })
    metrics.measure('permission_ms', permissionStartedAt)
    if (!resolved.ok) return { success: false, error: resolved.error }
    if (!isUuid(input.projectId)) {
      return { success: false, error: 'Некорректный проект' }
    }

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
      return { success: false, error: `Не удалось закрепить проект: ${error.message}` }
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
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  } finally {
    metrics.report()
  }
}

/** Убрать закреплённый проект с доски */
export async function unpinProject(input: PinProjectInput): Promise<ActionResult<null>> {
  const metrics = createMutationMetrics('unpinProject')
  try {
    const permissionStartedAt = Date.now()
    const resolved = await resolveBoardDepartment(EMPLOYMENT_BOARD_EDIT, { department_id: input.departmentId })
    metrics.measure('permission_ms', permissionStartedAt)
    if (!resolved.ok) return { success: false, error: resolved.error }
    if (!isUuid(input.projectId)) {
      return { success: false, error: 'Некорректный проект' }
    }

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
      return { success: false, error: `Не удалось открепить проект: ${error.message}` }
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
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
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
    const permissionStartedAt = Date.now()
    const resolved = await resolveBoardDepartment(EMPLOYMENT_BOARD_EDIT, { department_id: input.departmentId })
    metrics.measure('permission_ms', permissionStartedAt)
    if (!resolved.ok) return { success: false, error: resolved.error }
    if (!isUuid(input.projectId) || !isUuid(input.employeeId)) {
      return { success: false, error: 'Некорректные данные' }
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

    const insertStartedAt = Date.now()
    const { error } = await supabase.from('department_board_placements').insert({
      department_id: resolved.departmentId,
      project_id: input.projectId,
      employee_id: input.employeeId,
      placed_by: resolved.ctx.userId,
    })
    metrics.measure('insert_ms', insertStartedAt)

    if (error && error.code !== '23505') {
      return { success: false, error: `Не удалось разместить сотрудника: ${error.message}` }
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
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
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
    const permissionStartedAt = Date.now()
    const resolved = await resolveBoardDepartment(EMPLOYMENT_BOARD_EDIT, { department_id: input.departmentId })
    metrics.measure('permission_ms', permissionStartedAt)
    if (!resolved.ok) return { success: false, error: resolved.error }
    if (!isUuid(input.projectId) || !isUuid(input.employeeId)) {
      return { success: false, error: 'Некорректные данные' }
    }

    const supabase = await createClient()
    const rateLimitStartedAt = Date.now()
    const rateError = await checkWriteRate(resolved.ctx.userId)
    metrics.measure('rate_limit_ms', rateLimitStartedAt)
    if (rateError) return rateError
    const deleteStartedAt = Date.now()
    const { error } = await supabase
      .from('department_board_placements')
      .delete()
      .eq('department_id', resolved.departmentId)
      .eq('project_id', input.projectId)
      .eq('employee_id', input.employeeId)
    metrics.measure('delete_ms', deleteStartedAt)

    if (error) {
      return { success: false, error: `Не удалось убрать сотрудника: ${error.message}` }
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
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
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
