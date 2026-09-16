/**
 * Sections Page Module - Server Actions
 *
 * Server Actions для работы с иерархией разделов и загрузками
 */

'use server'

import { createClient } from '@/utils/supabase/server'
import * as Sentry from '@sentry/nextjs'
import { formatMinskDate } from '@/lib/timezone-utils'
import type { ActionResult } from '@/modules/cache'
import { type FilterQueryParams, getNegatedParams } from '@/modules/inline-filter'
import {
  applyMandatoryFilters,
  assertCanEditLoading,
  canEditLoading,
  getFilterContext,
  getFilterContextForTasksTabs,
  isRestrictedToOwnDepartment,
  type LoadingPermissionContext,
} from '@/modules/permissions'
import { getRestrictedProjectIds } from '@/modules/permissions/server/restricted-projects'
import type {
  Department,
  Project,
  ObjectSection,
  SectionLoading,
  CreateLoadingInput,
  UpdateLoadingInput,
  CapacityInput,
  SectionCapacity,
} from '../types'
import { compareProjectsByActuality, compareSectionsByLoadings, isNonProjectBucket } from '../utils/sort-projects'

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Проверяет, является ли строка UUID
 */
function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

/**
 * Нормализует capacity_overrides из вью (jsonb `{"YYYY-MM-DD": число}`) в
 * `Record<string, number>`. Значение приходит из numeric-колонки, поэтому
 * приводим к числу явно — на случай, если драйвер отдаст его строкой.
 */
function parseCapacityOverrides(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object') return {}

  const result: Record<string, number> = {}
  for (const [date, raw] of Object.entries(value as Record<string, unknown>)) {
    const parsed = parseFloat(String(raw))
    if (!isNaN(parsed)) result[date] = parsed
  }
  return result
}

/**
 * Экранирует значение для безопасной вставки в PostgREST .or() filter string.
 * Оборачивает в "..." и удваивает embedded двойные кавычки — защищает от
 * injection через имена, содержащие `,`, `(`, `)`, `:` или `"`.
 *
 * Wildcards `%` для ilike внутри кавычек продолжают работать как pattern.
 */
function escapePostgRESTValue(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

/**
 * Резолвит массив значений (UUID и/или имена) в массив UUID.
 * Имена подтягиваются через name lookup в указанной таблице одним запросом.
 *
 * Используется когда нужно применить дальнейшую логику с UUID (фильтр по in,
 * иерархия по Set.has() и т.п.) — без этого helper'а множественные имена
 * молча сводились бы к [0] и второй фильтр игнорировался.
 */
async function resolveMultiValueToUuids(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  rawValue: string | string[],
  table: string,
  uuidField: string,
  nameField: string,
): Promise<string[]> {
  const values = Array.isArray(rawValue) ? rawValue : [rawValue]
  if (values.length === 0) return []

  const uuids = values.filter(isUuid)
  const names = values.filter((v) => !isUuid(v))

  if (names.length > 0) {
    // Экранируем имена — PostgREST .or() парсит `,`/`(`/`)`/`:` как операторы,
    // без quoting вредоносное имя могло бы расширить условия.
    const orClause = names
      .map((n) => `${nameField}.ilike.${escapePostgRESTValue(n)}`)
      .join(',')
    const { data } = await supabase.from(table).select(uuidField).or(orClause)
    if (data) {
      for (const row of data) {
        const id = row[uuidField]
        if (id) uuids.push(id)
      }
    }
  }
  return [...new Set(uuids)]
}

// ============================================================================
// Get Hierarchy Data
// ============================================================================

/**
 * Получить иерархию отделов → проекты → разделы → загрузки
 */
export async function getSectionsHierarchy(
  filters?: FilterQueryParams
): Promise<ActionResult<Department[]>> {
  return Sentry.startSpan(
    { name: 'getSectionsHierarchy', op: 'db.query' },
    async () => {
  try {
    const supabase = await createClient()

    // Auth check
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Получаем filter context для permissions.
    // Используем getFilterContextForTasksTabs — для user/team_lead с
    // tasks.tabs.view.department это расширит scope team → department.
    // Параллельно: контекст + список restricted — экономит round-trip.
    const [filterContextResult, restrictedIds] = await Promise.all([
      getFilterContextForTasksTabs(),
      getRestrictedProjectIds(),
    ])
    const filterContext = filterContextResult.success ? filterContextResult.data : null
    const secureFilters = applyMandatoryFilters(filters || {}, filterContext)
    const isAdmin = filterContext?.permissions.includes('hierarchy.is_admin') ?? false

    // Для project_manager (scope.level === 'projects') убираем обязательный project_id фильтр,
    // чтобы менеджер видел все разделы — как на вкладке "Отделы" (там project_id не обрабатывается).
    // Ручной фильтр пользователя (если выбрал проект в UI) при этом сохраняется.
    const isProjectManagerScope = filterContext?.scope?.level === 'projects'
    const effectiveFilters = isProjectManagerScope
      ? { ...secureFilters, project_id: filters?.project_id }
      : secureFilters

    // Запрос к view
    let query = supabase.from('view_departments_sections_loadings').select('*')

    // 🔒 Скрываем restricted-проекты от не-админов (view не проксирует is_restricted).
    // Автоматически исключает загрузки по этим проектам из агрегации ниже.
    if (!isAdmin && restrictedIds.length > 0) {
      query = query.not('project_id', 'in', `(${restrictedIds.join(',')})`)
    }

    // Применяем фильтры из inline-filter (поддерживаем UUID и названия,
    // несколько значений одного поля).
    // Переменные для хранения разрешённых UUID (для трансформации иерархии ниже).
    // Set, а не одиночный UUID — чтобы поддержать `отдел:"А" отдел:"Б"`.
    let resolvedDeptUuids: Set<string> | null = null
    let resolvedSubdivisionUuids: Set<string> | null = null

    // Фильтр по команде (через employee_id, т.к. view не содержит team_id)
    if (effectiveFilters?.team_id) {
      const teamUuids = await resolveMultiValueToUuids(
        supabase,
        effectiveFilters.team_id,
        'teams',
        'team_id',
        'team_name',
      )
      if (teamUuids.length === 0) {
        return { success: true, data: [] }
      }

      // Получаем сотрудников всех указанных команд одним запросом
      const { data: teamEmployees } = await supabase
        .from('view_employee_workloads')
        .select('user_id')
        .in('final_team_id', teamUuids)

      const employeeIds = teamEmployees?.map((e) => e.user_id) || []
      if (employeeIds.length > 0) {
        const uniqueEmployeeIds = Array.from(new Set(employeeIds))
        query = query.in('employee_id', uniqueEmployeeIds)
      } else {
        return { success: true, data: [] }
      }
    }

    // Фильтр по подразделению — match по ответственному ИЛИ по сотруднику с загрузкой.
    // Дуальный OR через `in.(...)` поддерживает несколько значений.
    if (effectiveFilters?.subdivision_id) {
      const subUuids = await resolveMultiValueToUuids(
        supabase,
        effectiveFilters.subdivision_id,
        'subdivisions',
        'subdivision_id',
        'subdivision_name',
      )
      if (subUuids.length === 0) {
        return { success: true, data: [] }
      }
      resolvedSubdivisionUuids = new Set(subUuids)
      const uuidList = subUuids.join(',')
      query = query.or(
        `subdivision_id.in.(${uuidList}),employee_subdivision_id.in.(${uuidList})`,
      )
    }

    // Фильтр по отделу — match если:
    // 1) Ответственный раздела из этого отдела ИЛИ
    // 2) Есть загрузка сотрудника из этого отдела
    if (effectiveFilters?.department_id) {
      const deptUuids = await resolveMultiValueToUuids(
        supabase,
        effectiveFilters.department_id,
        'departments',
        'department_id',
        'department_name',
      )
      if (deptUuids.length === 0) {
        return { success: true, data: [] }
      }
      resolvedDeptUuids = new Set(deptUuids)
      const uuidList = deptUuids.join(',')
      query = query.or(
        `department_id.in.(${uuidList}),employee_department_id.in.(${uuidList})`,
      )
    }

    // Фильтр по проекту (поддержка нескольких значений UUID + имён)
    if (effectiveFilters?.project_id) {
      const values = Array.isArray(effectiveFilters.project_id)
        ? effectiveFilters.project_id
        : [effectiveFilters.project_id]

      const uuids = values.filter(isUuid)
      const names = values.filter((v) => !isUuid(v))

      if (uuids.length > 0 && names.length === 0) {
        query = query.in('project_id', uuids)
      } else if (names.length > 0 && uuids.length === 0) {
        const orClause = names
          .map((n) => `project_name.ilike.${escapePostgRESTValue(n)}`)
          .join(',')
        query = query.or(orClause)
      } else if (uuids.length > 0 && names.length > 0) {
        // UUIDs валидированы isUuid — безопасны; имена — экранируем.
        const parts: string[] = uuids.map((id) => `project_id.eq.${id}`)
        names.forEach((n) =>
          parts.push(`project_name.ilike.${escapePostgRESTValue(n)}`),
        )
        query = query.or(parts.join(','))
      }
    }

    // Исключающие фильтры (-проект, -отдел, -команда)
    for (const val of getNegatedParams(effectiveFilters, 'project_id')) {
      if (isUuid(val)) {
        query = query.neq('project_id', val)
      } else {
        query = query.not('project_name', 'ilike', val)
      }
    }

    for (const val of getNegatedParams(effectiveFilters, 'department_id')) {
      if (isUuid(val)) {
        query = query.neq('department_id', val).neq('employee_department_id', val)
      } else {
        query = query.not('department_name', 'ilike', val).not('employee_department_name', 'ilike', val)
      }
    }

    for (const val of getNegatedParams(effectiveFilters, 'subdivision_id')) {
      if (isUuid(val)) {
        query = query.neq('subdivision_id', val).neq('employee_subdivision_id', val)
      } else {
        query = query.not('subdivision_name', 'ilike', val).not('employee_subdivision_name', 'ilike', val)
      }
    }

    // Детерминированный порядок — обязателен при постраничном чтении (bug-AB-12).
    // Без ORDER BY Postgres не гарантирует одинаковую сортировку между отдельными
    // запросами страниц: соседние .range() могут перекрыться (одна строка приходит
    // дважды) и одновременно пропустить другие. Дубли доезжали до UI — одна и та же
    // загрузка попадала в objectSection.loadings два раза (в недельном/месячном
    // режиме это ловил React как «two children with the same key», в дневном тихо
    // задваивало полоску и сумму X на мини-барах).
    // (section_id, loading_id) в этой вью уникальна — проверено на всех 9102 строках.
    query = query
      .order('section_id', { ascending: true })
      .order('loading_id', { ascending: true, nullsFirst: true })

    // Пагинация: без .range() PostgREST молча режет select('*') на db-max-rows
    // проекта (в этом проекте — 5000) и возвращает частичный результат БЕЗ
    // ошибки (206 Partial Content) — при >5000 подходящих строк часть данных
    // (например, только что созданный раздел) тихо пропадала из ответа.
    // Дочитываем страницами, пока страница не вернёт меньше PAGE_SIZE.
    // PAGE_SIZE = db-max-rows проекта: на текущих ~9k строк это 2-3 запроса
    // вместо 10, и во столько же раз уже окно, в котором конкурентная вставка
    // может сдвинуть постраничную выборку (см. bug-AB-12).
    const PAGE_SIZE = 5000
    const MAX_PAGES = 40 // защита от бесконечного цикла — 200k строк с запасом
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let rows: any[] = []
    let from = 0
    let pageCount = 0

    while (true) {
      const { data: page, error } = await query.range(from, from + PAGE_SIZE - 1)

      if (error) {
        console.error('Error fetching sections hierarchy:', error)
        Sentry.captureException(new Error(error.message), {
          tags: { module: 'sections-page', action: 'getSectionsHierarchy', error_type: 'db_error', user_facing: 'true' },
          extra: { appliedFilters: Object.keys(secureFilters || {}) },
        })
        return {
          success: false,
          error: `Ошибка загрузки данных: ${error.message}`,
        }
      }

      if (!page || page.length === 0) break
      rows.push(...page)
      pageCount++

      if (page.length < PAGE_SIZE) break

      if (pageCount >= MAX_PAGES) {
        Sentry.captureMessage('getSectionsHierarchy: MAX_PAGES reached, data may be truncated', {
          level: 'warning',
          tags: { module: 'sections-page', action: 'getSectionsHierarchy' },
          extra: { rowsFetched: rows.length },
        })
        break
      }

      from += PAGE_SIZE
    }

    if (!rows || rows.length === 0) {
      return { success: true, data: [] }
    }

    // Страховка поверх сортировки (bug-AB-12): режем дубли строк по ключу
    // (section_id, loading_id) — уникальному в этой вью. Если порядок всё же
    // «поедет» (изменится план запроса, конкурентная запись между страницами),
    // задвоенная строка не дойдёт ни до loadings, ни до счётчиков и агрегаций.
    const seenRowKeys = new Set<string>()
    const uniqueRows = rows.filter((r) => {
      const key = `${r.section_id}|${r.loading_id ?? ''}`
      if (seenRowKeys.has(key)) return false
      seenRowKeys.add(key)
      return true
    })
    if (uniqueRows.length !== rows.length) {
      Sentry.captureMessage('getSectionsHierarchy: duplicate rows across pages', {
        level: 'warning',
        tags: { module: 'sections-page', action: 'getSectionsHierarchy' },
        extra: { fetched: rows.length, unique: uniqueRows.length },
      })
    }
    // Переприсваиваем, а не мутируем через push(...uniqueRows): потолок цикла —
    // MAX_PAGES × PAGE_SIZE = 200k строк, а спред такого размера в аргументы
    // функции роняет движок с RangeError.
    rows = uniqueRows

    // Уникальные исполнители загрузок — team_id для UI gating (view_departments_sections_loadings
    // его не отдаёт, нужен для определения "это команда team_lead'а" на клиенте).
    const uniqueEmployeeIds = Array.from(
      new Set(
        rows
          .filter((r) => r.loading_id && r.employee_id)
          .map((r) => r.employee_id as string)
      )
    )

    // feature-AB-06: штат отдела (view_organizational_structure.department_employee_count —
    // все профили с department_id = этот отдел, независимо от загрузок). deptIds собираем
    // из СЫРЫХ строк (не из уже построенной иерархии) — надмножество ответственный ∪
    // сотрудник безвредно, зато запрос уходит параллельно с employeeTeamMap ниже, а не
    // отдельным round-trip'ом после всей остальной обработки.
    const headcountDeptIds = Array.from(
      new Set(
        rows
          .flatMap((r) => [r.department_id, r.employee_department_id])
          .filter((id): id is string => !!id)
      )
    )

    const [usersResult, orgResult] = await Promise.all([
      uniqueEmployeeIds.length > 0
        ? supabase.from('view_users').select('user_id, team_id').in('user_id', uniqueEmployeeIds)
        : Promise.resolve({ data: null, error: null }),
      headcountDeptIds.length > 0
        ? supabase
            .from('view_organizational_structure')
            .select('department_id, department_employee_count')
            .in('department_id', headcountDeptIds)
        : Promise.resolve({ data: null, error: null }),
    ])

    const employeeTeamMap = new Map<string, string | null>()
    for (const u of usersResult.data ?? []) {
      if (u.user_id) employeeTeamMap.set(u.user_id, u.team_id ?? null)
    }

    const deptHeadcountMap = new Map<string, number>()
    if (orgResult.error) {
      console.error('Error fetching department headcount:', orgResult.error)
      Sentry.captureException(new Error(orgResult.error.message), {
        tags: { module: 'sections-page', action: 'getSectionsHierarchy', error_type: 'db_error', user_facing: 'false' },
        extra: { step: 'department_headcount' },
      })
    } else {
      for (const row of orgResult.data ?? []) {
        if (row.department_id) {
          deptHeadcountMap.set(row.department_id, row.department_employee_count || 0)
        }
      }
    }

    // X (busyTodayCount) уже сужен фильтром team_id/project_id, если он активен, тогда
    // как Y (штат) — всегда весь отдел целиком. Показывать оба вместе в этом случае
    // вводит в заблуждение ("занято 2 из 57" при фильтре по одной команде) — скрываем
    // знаменатель (departmentHeadcount = null), когда штат недоступен или сужен фильтром.
    const headcountUnavailable = !!orgResult.error || !!effectiveFilters?.team_id || !!effectiveFilters?.project_id

    // Трансформация плоских строк в иерархию
    // Логика размещения раздела по отделам зависит от scope пользователя:
    // - team scope (user/team_lead): только отдел сотрудника с загрузкой
    // - dept scope (нач. отдела): только свой отдел (через ответственного или сотрудника)
    // - admin/subdivision scope: полное дублирование (отдел ответственного + отдел сотрудника)
    const departmentsMap = new Map<string, Department>()
    // feature-AB-06: "занято X из Y (Z на непроектных)" на строке отдела.
    // busyTodayEmployeeIds — у кого есть загрузка, активная именно сегодня.
    // employeeHasOtherWorkToday — подмножество busyTodayEmployeeIds, у кого хотя бы
    // одна из сегодняшних загрузок лежит ВНЕ корзины «Непроектные загрузки» (т.е.
    // на реальном проекте, либо на «Отпуск»/«Прочие работы»). Кто в него не попал —
    // занят исключительно непроектными загрузками и идёт в busyOnNonProjectCount.
    // Отпуск и Прочие работы в «непроектные» намеренно НЕ входят — см.
    // isNonProjectBucket в utils/sort-projects.ts.
    const deptBusyTodayEmployeeIds = new Map<string, Set<string>>()
    const deptEmployeeHasOtherWorkToday = new Map<string, Set<string>>()
    // Трекер активности проекта — для isStale (maxDate/hasFuture) и для сортировки
    // по актуальности загрузок (hasActiveNow/nearestFutureStart/mostRecentPastFinish,
    // считается только по loading_start/loading_finish — см. compareProjectsByActuality).
    // project_status в БД не актуален — не используем нигде.
    // Ключ — `${deptId}:${projectId}`, чтобы не путать один и тот же projectId,
    // легитимно встречающийся в двух разных отделах (ответственного и сотрудника).
    const projectActivity = new Map<string, {
      maxDate: string | null
      hasFuture: boolean
      hasActiveLoadingNow: boolean
      nearestFutureLoadingStart: string | null
      mostRecentPastLoadingFinish: string | null
    }>()
    // formatMinskDate, а не toISOString().slice(0, 10) — проект работает в Europe/Minsk
    // (UTC+3), сырой UTC-срез даёт "вчера" вместо "сегодня" с полуночи до 3:00 по Минску.
    const now = new Date()
    const todayStr = formatMinskDate(now)
    const staleCutoffDate = new Date(now)
    staleCutoffDate.setMonth(staleCutoffDate.getMonth() - 3)
    const staleCutoffStr = formatMinskDate(staleCutoffDate)

    // Определяем scope по наличию mandatory-фильтров (устанавливаются applyMandatoryFilters)
    const isTeamScoped = !!secureFilters?.team_id
    // Используем разрешённые UUID отделов (resolvedDeptUuids), а не сырое значение из фильтров,
    // т.к. inline-filter передаёт НАЗВАНИЕ ("Отдел развития"), а не UUID.
    // Set вместо одиночного значения — чтобы корректно работал dept-scope при нескольких отделах
    // (например, mandatory department_id у dept_head всегда 1, но admin может выбрать N).
    const scopedDeptIds = resolvedDeptUuids
    const hasScopedDept = scopedDeptIds !== null && scopedDeptIds.size > 0

    for (const row of rows) {
      const responsibleDeptId = row.department_id
      const projectId = row.project_id
      const sectionId = row.section_id
      const loadingId = row.loading_id
      const employeeDeptId = row.employee_department_id

      // Определяем в каких отделах должен появиться раздел
      const departmentIds: Array<{ id: string; name: string; subdivisionId: string; subdivisionName: string }> = []

      if (isTeamScoped) {
        // Team scope (user/team_lead): только отдел сотрудника с загрузкой.
        // Отдел ответственного может быть чужим — не дублируем туда,
        // чтобы не было фантомных отделов с 0 загрузок.
        if (loadingId && employeeDeptId) {
          departmentIds.push({
            id: employeeDeptId,
            name: row.employee_department_name || 'Без отдела',
            subdivisionId: row.employee_subdivision_id || '00000000-0000-0000-0000-000000000000',
            subdivisionName: row.employee_subdivision_name || 'Без подразделения',
          })
        }
      } else if (hasScopedDept) {
        // Dept scope (нач. отдела ИЛИ admin с фильтром по отделам): раздел попадает
        // только в отделы из scope. OR-фильтр в запросе возвращает строки через два пути:
        // 1) department_id ∈ scope → ответственный из этого отдела
        // 2) employee_department_id ∈ scope → сотрудник этого отдела грузится на чужом разделе
        // В обоих случаях дублировать в чужой (вне scope) отдел не нужно.
        if (scopedDeptIds!.has(responsibleDeptId)) {
          departmentIds.push({
            id: responsibleDeptId,
            name: row.department_name,
            subdivisionId: row.subdivision_id,
            subdivisionName: row.subdivision_name,
          })
        } else if (loadingId && employeeDeptId && scopedDeptIds!.has(employeeDeptId)) {
          departmentIds.push({
            id: employeeDeptId,
            name: row.employee_department_name || 'Без отдела',
            subdivisionId: row.employee_subdivision_id || '00000000-0000-0000-0000-000000000000',
            subdivisionName: row.employee_subdivision_name || 'Без подразделения',
          })
        }
      } else {
        // Admin / subdivision scope: полное дублирование —
        // Если активен фильтр по подразделению, добавляем отдел только если
        // он принадлежит одному из отфильтрованных подразделений.

        // 1) Отдел ответственного — только если подразделение в scope (или фильтр не задан)
        if (!resolvedSubdivisionUuids || resolvedSubdivisionUuids.has(row.subdivision_id)) {
          departmentIds.push({
            id: responsibleDeptId,
            name: row.department_name,
            subdivisionId: row.subdivision_id,
            subdivisionName: row.subdivision_name,
          })
        }

        // 2) Отдел сотрудника (если другой) — только если подразделение в scope
        if (loadingId && employeeDeptId && employeeDeptId !== responsibleDeptId) {
          if (!resolvedSubdivisionUuids || resolvedSubdivisionUuids.has(row.employee_subdivision_id)) {
            departmentIds.push({
              id: employeeDeptId,
              name: row.employee_department_name || 'Без отдела',
              subdivisionId: row.employee_subdivision_id || '00000000-0000-0000-0000-000000000000',
              subdivisionName: row.employee_subdivision_name || 'Без подразделения',
            })
          }
        }
      }

      // Обрабатываем раздел для КАЖДОГО отдела
      for (const deptInfo of departmentIds) {
        const deptId = deptInfo.id

        // Получаем или создаём отдел (+ Set для уникальных сотрудников)
        let department = departmentsMap.get(deptId)
        if (!department) {
          department = {
            id: deptId,
            name: deptInfo.name,
            subdivisionId: deptInfo.subdivisionId,
            subdivisionName: deptInfo.subdivisionName,
            // Данные о руководителе берём только для отдела ответственного
            departmentHeadId: deptId === responsibleDeptId ? row.department_head_id : null,
            departmentHeadName: deptId === responsibleDeptId ? row.department_head_name : null,
            departmentHeadEmail: deptId === responsibleDeptId ? row.department_head_email : null,
            departmentHeadAvatarUrl: deptId === responsibleDeptId ? row.department_head_avatar_url : null,
            totalLoadings: 0,
            departmentHeadcount: 0, // заполняется ниже отдельным запросом к view_organizational_structure
            busyTodayCount: 0,
            busyOnNonProjectCount: 0,
            dailyWorkloads: {},
            projects: [],
          }
          departmentsMap.set(deptId, department)
          deptBusyTodayEmployeeIds.set(deptId, new Set())
          deptEmployeeHasOtherWorkToday.set(deptId, new Set())
        }

        // Получаем или создаём проект
        let project = department.projects.find((p) => p.id === projectId)
        if (!project) {
          project = {
            id: projectId,
            name: row.project_name,
            status: row.project_status,
            managerId: null,
            managerName: null,
            leadEngineerId: null,
            leadEngineerName: null,
            departmentId: deptId,
            departmentName: deptInfo.name,
            stageType: null,
            totalLoadings: 0,
            dailyWorkloads: {},
            isStale: false, // финализируется ниже, в цикле после обработки всех строк
            hasActiveLoadingNow: false,
            nearestFutureLoadingStart: null,
            mostRecentPastLoadingFinish: null,
            objectSections: [],
          }
          department.projects.push(project)
          projectActivity.set(`${deptId}:${project.id}`, {
            maxDate: null,
            hasFuture: false,
            hasActiveLoadingNow: false,
            nearestFutureLoadingStart: null,
            mostRecentPastLoadingFinish: null,
          })
        }

        // Получаем или создаём объект/раздел
        let objectSection = project.objectSections.find((os) => os.id === sectionId)
        if (!objectSection) {
          const responsibleName = row.responsible_first_name && row.responsible_last_name
            ? `${row.responsible_first_name} ${row.responsible_last_name}`
            : row.responsible_first_name || row.responsible_last_name || null

          objectSection = {
            id: sectionId,
            name: `${row.object_name} / ${row.section_name}`,
            objectId: row.object_id,
            objectName: row.object_name,
            sectionId: sectionId,
            sectionName: row.section_name,
            sectionType: row.section_type,
            sectionResponsibleId: row.responsible_id,
            sectionResponsibleName: responsibleName,
            projectId: projectId,
            projectName: row.project_name,
            departmentId: deptId,
            departmentName: deptInfo.name,
            startDate: row.section_start_date,
            endDate: row.section_end_date,
            defaultCapacity: row.default_capacity != null ? parseFloat(String(row.default_capacity)) : null,
            capacityOverrides: parseCapacityOverrides(row.capacity_overrides),
dailyWorkloads: {},
            loadings: [],
            totalLoadings: 0,
          }
          project.objectSections.push(objectSection)

          // Учитываем срок и дату создания раздела в активности проекта (для isStale)
          const activity = projectActivity.get(`${deptId}:${project.id}`)
          if (activity) {
            if (row.section_end_date) {
              if (!activity.maxDate || row.section_end_date > activity.maxDate) activity.maxDate = row.section_end_date
              if (row.section_end_date >= todayStr) activity.hasFuture = true
            }
            if (row.section_created && (!activity.maxDate || row.section_created > activity.maxDate)) {
              activity.maxDate = row.section_created
            }
          }
        }

        // Добавляем загрузку только в отдел сотрудника
        if (loadingId && employeeDeptId === deptId) {
          const employeeName = row.employee_first_name && row.employee_last_name
            ? `${row.employee_first_name} ${row.employee_last_name}`
            : row.employee_first_name || row.employee_last_name || 'Без имени'

          const loading: SectionLoading = {
            id: loadingId,
            sectionId: sectionId,
            sectionName: row.section_name,
            projectId: projectId,
            projectName: row.project_name,
            objectId: row.object_id,
            objectName: row.object_name,
            stageId: row.loading_stage,
            stageName: row.stage_name,
            employeeId: row.employee_id,
            employeeName: employeeName,
            employeeFirstName: row.employee_first_name,
            employeeLastName: row.employee_last_name,
            employeeEmail: null,
            employeeAvatarUrl: row.employee_avatar_url,
            employeeCategory: row.employee_category,
            employeePosition: row.employee_position,
            employeeEmploymentRate: row.employee_employment_rate ?? null,
            employeeTeamId: row.employee_id ? (employeeTeamMap.get(row.employee_id) ?? null) : null,
            employeeDepartmentId: employeeDeptId || deptId,
            employeeDepartmentName: row.employee_department_name || row.department_name,
            startDate: row.loading_start,
            endDate: row.loading_finish,
            rate: row.loading_rate,
            status: 'active',
            comment: row.loading_comment,
            createdAt: null,
            updatedAt: null,
          }
          objectSection.loadings.push(loading)
          objectSection.totalLoadings = objectSection.loadings.length
          project.totalLoadings++
          department.totalLoadings++

          // Учитываем окончание загрузки в активности проекта (для isStale)
          const activity = projectActivity.get(`${deptId}:${project.id}`)
          if (activity && row.loading_finish) {
            if (!activity.maxDate || row.loading_finish > activity.maxDate) activity.maxDate = row.loading_finish
            if (row.loading_finish >= todayStr) activity.hasFuture = true
          }

          // Актуальность загрузки (для сортировки — см. compareProjectsByActuality)
          if (activity && row.loading_start && row.loading_finish) {
            if (row.loading_start <= todayStr && row.loading_finish >= todayStr) {
              activity.hasActiveLoadingNow = true
            } else if (row.loading_start > todayStr) {
              if (!activity.nearestFutureLoadingStart || row.loading_start < activity.nearestFutureLoadingStart) {
                activity.nearestFutureLoadingStart = row.loading_start
              }
            } else if (row.loading_finish < todayStr) {
              if (!activity.mostRecentPastLoadingFinish || row.loading_finish > activity.mostRecentPastLoadingFinish) {
                activity.mostRecentPastLoadingFinish = row.loading_finish
              }
            }
          }

          // feature-AB-06: занятость сегодня + непроектные
          if (row.loading_start <= todayStr && row.loading_finish >= todayStr) {
            deptBusyTodayEmployeeIds.get(deptId)!.add(row.employee_id)
            if (!isNonProjectBucket(row.project_name)) {
              deptEmployeeHasOtherWorkToday.get(deptId)!.add(row.employee_id)
            }
          }
        }
      }
    }

    // Присваиваем isStale и актуальность из трекера, сортируем:
    // сначала по актуальности загрузок (см. compareProjectsByActuality)
    for (const dept of departmentsMap.values()) {
      // null — штат недоступен (запрос упал) ИЛИ активен фильтр team_id/project_id:
      // тогда busyTodayCount уже сужен фильтром, а штат отдела — всегда весь отдел
      // целиком, показывать оба числа вместе ("занято 2 из 57" при фильтре по одной
      // команде) вводит в заблуждение — UI прячет знаменатель при null.
      dept.departmentHeadcount = headcountUnavailable
        ? null
        : (deptHeadcountMap.get(dept.id) ?? 0)
      dept.busyTodayCount = deptBusyTodayEmployeeIds.get(dept.id)?.size ?? 0
      {
        const busyToday = deptBusyTodayEmployeeIds.get(dept.id) ?? new Set<string>()
        const hasOtherWork = deptEmployeeHasOtherWorkToday.get(dept.id) ?? new Set<string>()
        let onlyNonProject = 0
        for (const empId of busyToday) {
          if (!hasOtherWork.has(empId)) onlyNonProject++
        }
        dept.busyOnNonProjectCount = onlyNonProject
      }
      for (const project of dept.projects) {
        project.objectSections.sort(compareSectionsByLoadings)

        const activity = projectActivity.get(`${dept.id}:${project.id}`)
        project.isStale = !!activity && !activity.hasFuture && activity.maxDate !== null && activity.maxDate < staleCutoffStr
        project.hasActiveLoadingNow = activity?.hasActiveLoadingNow ?? false
        project.nearestFutureLoadingStart = activity?.nearestFutureLoadingStart ?? null
        project.mostRecentPastLoadingFinish = activity?.mostRecentPastLoadingFinish ?? null
      }
      dept.projects.sort(compareProjectsByActuality)
    }

    // Преобразуем Map в массив
    const departments = Array.from(departmentsMap.values())

    return { success: true, data: departments }
  } catch (error) {
    console.error('Unexpected error in getSectionsHierarchy:', error)
    Sentry.captureException(error, {
      tags: { module: 'sections-page', action: 'getSectionsHierarchy', error_type: 'unexpected_error', user_facing: 'true' },
    })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
  }) // end Sentry.startSpan
}

// ============================================================================
// Capacity CRUD
// ============================================================================

/**
 * Установить/обновить ёмкость раздела
 */
export async function upsertSectionCapacity(
  input: CapacityInput
): Promise<ActionResult<SectionCapacity>> {
  return Sentry.startSpan(
    { name: 'upsertSectionCapacity', op: 'db.mutation', attributes: { 'section.id': input.sectionId } },
    async () => {
  try {
    const supabase = await createClient()

    // Валидация. 0 — валидное значение (явно "ёмкость не нужна на эту дату",
    // отображается как пустая ячейка — см. getWeekCellClassNames/getCellClassNames).
    if (input.capacityValue < 0 || input.capacityValue > 99) {
      return {
        success: false,
        error: 'Ёмкость должна быть от 0 до 99',
      }
    }

    // Auth + permission check
    const ctxResult = await getFilterContext()
    if (!ctxResult.success || !ctxResult.data) {
      return { success: false, error: 'Unauthorized' }
    }
    if (!ctxResult.data.permissions.includes('sections.capacity.edit')) {
      return { success: false, error: 'Нет прав на редактирование ёмкости' }
    }

    // Upsert capacity
    const { data, error } = await supabase
      .from('section_capacity')
      .upsert(
        {
          section_id: input.sectionId,
          capacity_date: input.capacityDate,
          capacity_value: input.capacityValue,
          created_by: ctxResult.data.userId,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'section_id,capacity_date',
        }
      )
      .select()
      .single()

    if (error) {
      console.error('Error upserting section capacity:', error)
      Sentry.captureException(new Error(error.message), {
        tags: { module: 'sections-page', action: 'upsertSectionCapacity', error_type: 'db_error', user_facing: 'true' },
        extra: { sectionId: input.sectionId, capacityDate: input.capacityDate },
      })
      return {
        success: false,
        error: `Ошибка сохранения ёмкости: ${error.message}`,
      }
    }

    return {
      success: true,
      data: {
        capacityId: data.capacity_id,
        sectionId: data.section_id,
        capacityDate: data.capacity_date,
        capacityValue: data.capacity_value,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        createdBy: data.created_by,
      },
    }
  } catch (error) {
    console.error('Unexpected error in upsertSectionCapacity:', error)
    Sentry.captureException(error, {
      tags: { module: 'sections-page', action: 'upsertSectionCapacity', error_type: 'unexpected_error', user_facing: 'true' },
      extra: { sectionId: input.sectionId },
    })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
  }) // end Sentry.startSpan
}

/**
 * Установить/обновить ёмкость сразу для нескольких разделов/дат одним запросом.
 * Используется для массового редактирования (например, ввод ёмкости на строке
 * проекта раздаёт одно значение на все разделы проекта за выбранные даты).
 */
export async function upsertSectionCapacityBatch(
  inputs: CapacityInput[]
): Promise<ActionResult<SectionCapacity[]>> {
  return Sentry.startSpan(
    { name: 'upsertSectionCapacityBatch', op: 'db.mutation', attributes: { count: inputs.length } },
    async () => {
  try {
    if (inputs.length === 0) {
      return { success: true, data: [] }
    }

    for (const input of inputs) {
      if (input.capacityValue < 0 || input.capacityValue > 99) {
        return { success: false, error: 'Ёмкость должна быть от 0 до 99' }
      }
    }

    const supabase = await createClient()

    const ctxResult = await getFilterContext()
    if (!ctxResult.success || !ctxResult.data) {
      return { success: false, error: 'Unauthorized' }
    }
    const ctx = ctxResult.data
    if (!ctx.permissions.includes('sections.capacity.edit')) {
      return { success: false, error: 'Нет прав на редактирование ёмкости' }
    }

    // Без .select(): единственный потребитель — useUpsertSectionCapacityBatch,
    // а он строит оптимистичное обновление из входных данных и записанные строки
    // не читает. Возврат до 1000 строк на чанк удваивал трафик жеста впустую
    // (месячный drag пишет тысячи записей — см. feature-AB-11).
    const updatedAt = new Date().toISOString()
    const { error } = await supabase
      .from('section_capacity')
      .upsert(
        inputs.map((input) => ({
          section_id: input.sectionId,
          capacity_date: input.capacityDate,
          capacity_value: input.capacityValue,
          created_by: ctx.userId,
          updated_at: updatedAt,
        })),
        { onConflict: 'section_id,capacity_date' }
      )

    if (error) {
      console.error('Error upserting section capacity batch:', error)
      Sentry.captureException(new Error(error.message), {
        tags: { module: 'sections-page', action: 'upsertSectionCapacityBatch', error_type: 'db_error', user_facing: 'true' },
        extra: { count: inputs.length },
      })
      return {
        success: false,
        error: `Ошибка сохранения ёмкости: ${error.message}`,
      }
    }

    // Записанные строки не возвращаем (см. комментарий у .upsert выше) —
    // актуальное состояние приезжает рефетчем иерархии в onSettled мутации.
    return { success: true, data: [] }
  } catch (error) {
    console.error('Unexpected error in upsertSectionCapacityBatch:', error)
    Sentry.captureException(error, {
      tags: { module: 'sections-page', action: 'upsertSectionCapacityBatch', error_type: 'unexpected_error', user_facing: 'true' },
      extra: { count: inputs.length },
    })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
  }) // end Sentry.startSpan
}

/**
 * Удалить capacity override для конкретной даты (вернёт к default)
 */
export async function deleteSectionCapacityOverride(
  sectionId: string,
  date: string
): Promise<ActionResult<void>> {
  return Sentry.startSpan(
    { name: 'deleteSectionCapacityOverride', op: 'db.mutation', attributes: { 'section.id': sectionId } },
    async () => {
  try {
    const supabase = await createClient()

    // Auth + permission check
    const ctxResult = await getFilterContext()
    if (!ctxResult.success || !ctxResult.data) {
      return { success: false, error: 'Unauthorized' }
    }
    if (!ctxResult.data.permissions.includes('sections.capacity.edit')) {
      return { success: false, error: 'Нет прав на редактирование ёмкости' }
    }

    const { error } = await supabase
      .from('section_capacity')
      .delete()
      .eq('section_id', sectionId)
      .eq('capacity_date', date)

    if (error) {
      console.error('Error deleting capacity override:', error)
      Sentry.captureException(new Error(error.message), {
        tags: { module: 'sections-page', action: 'deleteSectionCapacityOverride', error_type: 'db_error', user_facing: 'true' },
        extra: { sectionId, date },
      })
      return {
        success: false,
        error: `Ошибка удаления: ${error.message}`,
      }
    }

    return { success: true, data: undefined }
  } catch (error) {
    console.error('Unexpected error in deleteSectionCapacityOverride:', error)
    Sentry.captureException(error, {
      tags: { module: 'sections-page', action: 'deleteSectionCapacityOverride', error_type: 'unexpected_error', user_facing: 'true' },
      extra: { sectionId },
    })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
  }) // end Sentry.startSpan
}

// ============================================================================
// Loading CRUD
// ============================================================================

/**
 * Создать загрузку с валидацией stage → section
 */
export async function createSectionLoading(
  input: CreateLoadingInput
): Promise<ActionResult<{ loading_id: string }>> {
  return Sentry.startSpan(
    { name: 'createSectionLoading', op: 'db.mutation', attributes: { 'section.id': input.sectionId, 'employee.id': input.employeeId } },
    async () => {
  try {
    const supabase = await createClient()

    // Auth + permission check
    const ctxResult = await getFilterContext()
    if (!ctxResult.success || !ctxResult.data) {
      return { success: false, error: 'Unauthorized' }
    }
    const ctx = ctxResult.data

    // Получаем метаданные исполнителя, раздела и cross-department grants параллельно
    const [employeeRow, sectionRow, grantsResult] = await Promise.all([
      supabase
        .from('view_users')
        .select('team_id, department_id, subdivision_id')
        .eq('user_id', input.employeeId)
        .single(),
      supabase
        .from('view_section_hierarchy')
        .select('project_id, responsible_department_id')
        .eq('section_id', input.sectionId)
        .single(),
      supabase
        .from('employee_loading_access_grants')
        .select('granted_to_department_id')
        .eq('employee_id', input.employeeId),
    ])

    if (employeeRow.error || !employeeRow.data) {
      return { success: false, error: 'Сотрудник не найден' }
    }
    if (sectionRow.error || !sectionRow.data) {
      return { success: false, error: 'Раздел не найден' }
    }

    const grantedToDepartmentIds =
      grantsResult.data?.map((g) => g.granted_to_department_id) ?? []

    // Future loading metadata для проверки прав
    const futureLoading: LoadingPermissionContext = {
      responsibleId: input.employeeId,
      teamId: employeeRow.data.team_id ?? null,
      departmentId: employeeRow.data.department_id ?? null,
      subdivisionId: employeeRow.data.subdivision_id ?? null,
      projectId: sectionRow.data.project_id ?? null,
      grantedToDepartmentIds,
    }

    if (!canEditLoading(futureLoading, ctx)) {
      return { success: false, error: 'Нет прав на создание загрузки для этого сотрудника' }
    }

    // Cross-dept: для restricted ролей раздел и сотрудник должны быть в одном отделе.
    // Исключение: если есть пересечение grantedToDepartmentIds с grantedAccessDepartmentIds —
    // юзер получил доступ через грант, проверка соответствия отделов не применяется.
    const accessViaGrant =
      grantedToDepartmentIds.length > 0 &&
      ctx.grantedAccessDepartmentIds.some((d) =>
        grantedToDepartmentIds.includes(d)
      )

    if (
      !accessViaGrant &&
      isRestrictedToOwnDepartment(ctx) &&
      sectionRow.data.responsible_department_id !== futureLoading.departmentId
    ) {
      return {
        success: false,
        error: 'Раздел и сотрудник должны быть из одного отдела',
      }
    }

    // Валидация: если stageId указан, проверяем что он принадлежит sectionId
    if (input.stageId) {
      const { data: stage, error: stageError } = await supabase
        .from('decomposition_stages')
        .select('decomposition_stage_section_id')
        .eq('decomposition_stage_id', input.stageId)
        .single()

      if (stageError || !stage) {
        return {
          success: false,
          error: 'Этап декомпозиции не найден',
        }
      }

      if (stage.decomposition_stage_section_id !== input.sectionId) {
        return {
          success: false,
          error: 'Выбранный этап не принадлежит указанному разделу',
        }
      }
    }

    // Валидация дат
    if (new Date(input.startDate) > new Date(input.endDate)) {
      return {
        success: false,
        error: 'Дата начала не может быть позже даты окончания',
      }
    }

    // Валидация ставки
    if (input.rate <= 0 || input.rate > 1) {
      return {
        success: false,
        error: 'Ставка должна быть от 0 до 1',
      }
    }

    // Создание загрузки
    const { data, error } = await supabase
      .from('loadings')
      .insert({
        loading_section: input.sectionId,
        loading_stage: input.stageId,
        loading_responsible: input.employeeId,
        loading_start: input.startDate,
        loading_finish: input.endDate,
        loading_rate: input.rate,
        loading_comment: input.comment,
        loading_status: 'active',
        is_shortage: false,
      })
      .select('loading_id')
      .single()

    if (error) {
      console.error('Error creating loading:', error)
      Sentry.captureException(new Error(error.message), {
        tags: { module: 'sections-page', action: 'createSectionLoading', error_type: 'db_error', user_facing: 'true' },
        extra: { sectionId: input.sectionId, employeeId: input.employeeId },
      })
      return {
        success: false,
        error: `Ошибка создания загрузки: ${error.message}`,
      }
    }

    return { success: true, data: { loading_id: data.loading_id } }
  } catch (error) {
    console.error('Unexpected error in createSectionLoading:', error)
    Sentry.captureException(error, {
      tags: { module: 'sections-page', action: 'createSectionLoading', error_type: 'unexpected_error', user_facing: 'true' },
      extra: { sectionId: input.sectionId, employeeId: input.employeeId },
    })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
  }) // end Sentry.startSpan
}

/**
 * Обновить загрузку
 */
export async function updateSectionLoading(
  input: UpdateLoadingInput
): Promise<ActionResult<void>> {
  return Sentry.startSpan(
    { name: 'updateSectionLoading', op: 'db.mutation', attributes: { 'loading.id': input.loadingId } },
    async () => {
  try {
    const supabase = await createClient()

    // Auth + permission + cross-dept enforcement (см. spec §5.4)
    const assertResult = await assertCanEditLoading(input.loadingId)
    if (!assertResult.success) return assertResult
    const { loading: oldLoading, ctx } = assertResult.data

    // Cross-dept проверки — только для user/team_lead/department_head
    if (isRestrictedToOwnDepartment(ctx)) {
      const oldDeptId = oldLoading.departmentId

      // Запрет смены исполнителя на сотрудника другого отдела
      if (input.employeeId && input.employeeId !== oldLoading.responsibleId) {
        const { data: newProfile } = await supabase
          .from('view_users')
          .select('department_id')
          .eq('user_id', input.employeeId)
          .single()
        if (!newProfile || newProfile.department_id !== oldDeptId) {
          return {
            success: false,
            error: 'Нельзя переназначить загрузку на сотрудника другого отдела',
          }
        }
      }
    }

    // Валидация: если stageId указан, проверяем что он принадлежит section
    if (input.stageId !== undefined && input.stageId !== null) {
      // Сначала получаем section_id текущей загрузки
      const { data: loading, error: loadingError } = await supabase
        .from('loadings')
        .select('loading_section')
        .eq('loading_id', input.loadingId)
        .single()

      if (loadingError || !loading) {
        return {
          success: false,
          error: 'Загрузка не найдена',
        }
      }

      // Проверяем что stage принадлежит section
      const { data: stage, error: stageError } = await supabase
        .from('decomposition_stages')
        .select('decomposition_stage_section_id')
        .eq('decomposition_stage_id', input.stageId)
        .single()

      if (stageError || !stage) {
        return {
          success: false,
          error: 'Этап декомпозиции не найден',
        }
      }

      if (stage.decomposition_stage_section_id !== loading.loading_section) {
        return {
          success: false,
          error: 'Выбранный этап не принадлежит разделу загрузки',
        }
      }

      // Cross-dept: запрет переноса в раздел другого отдела (для restricted ролей)
      if (isRestrictedToOwnDepartment(ctx) && oldLoading.departmentId) {
        const { data: sectionRow } = await supabase
          .from('view_section_hierarchy')
          .select('responsible_department_id')
          .eq('section_id', stage.decomposition_stage_section_id)
          .single()

        if (
          sectionRow?.responsible_department_id &&
          sectionRow.responsible_department_id !== oldLoading.departmentId
        ) {
          return {
            success: false,
            error: 'Нельзя перенести загрузку в раздел другого отдела',
          }
        }
      }
    }

    // Валидация дат если обе указаны
    if (input.startDate && input.endDate) {
      if (new Date(input.startDate) > new Date(input.endDate)) {
        return {
          success: false,
          error: 'Дата начала не может быть позже даты окончания',
        }
      }
    }

    // Валидация ставки
    if (input.rate !== undefined && (input.rate <= 0 || input.rate > 1)) {
      return {
        success: false,
        error: 'Ставка должна быть от 0 до 1',
      }
    }

    // Формируем объект обновления
    const updateData: Record<string, unknown> = {}

    if (input.employeeId !== undefined) updateData.loading_responsible = input.employeeId
    if (input.startDate !== undefined) updateData.loading_start = input.startDate
    if (input.endDate !== undefined) updateData.loading_finish = input.endDate
    if (input.rate !== undefined) updateData.loading_rate = input.rate
    if (input.comment !== undefined) updateData.loading_comment = input.comment
    if (input.stageId !== undefined) updateData.loading_stage = input.stageId

    // Проверяем что есть что обновлять
    if (Object.keys(updateData).length === 0) {
      return { success: true, data: undefined }
    }

    const { error } = await supabase
      .from('loadings')
      .update(updateData)
      .eq('loading_id', input.loadingId)

    if (error) {
      console.error('Error updating loading:', error)
      Sentry.captureException(new Error(error.message), {
        tags: { module: 'sections-page', action: 'updateSectionLoading', error_type: 'db_error', user_facing: 'true' },
        extra: { loadingId: input.loadingId },
      })
      return {
        success: false,
        error: `Ошибка обновления загрузки: ${error.message}`,
      }
    }

    return { success: true, data: undefined }
  } catch (error) {
    console.error('Unexpected error in updateSectionLoading:', error)
    Sentry.captureException(error, {
      tags: { module: 'sections-page', action: 'updateSectionLoading', error_type: 'unexpected_error', user_facing: 'true' },
      extra: { loadingId: input.loadingId },
    })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
  }) // end Sentry.startSpan
}

/**
 * Удалить загрузку (архивировать)
 */
export async function deleteSectionLoading(
  loadingId: string
): Promise<ActionResult<void>> {
  return Sentry.startSpan(
    { name: 'deleteSectionLoading', op: 'db.mutation', attributes: { 'loading.id': loadingId } },
    async () => {
  try {
    const supabase = await createClient()

    // Auth + permission check
    const assertResult = await assertCanEditLoading(loadingId)
    if (!assertResult.success) return assertResult

    // Архивируем вместо удаления
    const { error } = await supabase
      .from('loadings')
      .update({
        loading_status: 'archived',
        loading_updated: new Date().toISOString(),
      })
      .eq('loading_id', loadingId)

    if (error) {
      console.error('Error deleting loading:', error)
      Sentry.captureException(new Error(error.message), {
        tags: { module: 'sections-page', action: 'deleteSectionLoading', error_type: 'db_error', user_facing: 'true' },
        extra: { loadingId },
      })
      return {
        success: false,
        error: `Ошибка удаления загрузки: ${error.message}`,
      }
    }

    return { success: true, data: undefined }
  } catch (error) {
    console.error('Unexpected error in deleteSectionLoading:', error)
    Sentry.captureException(error, {
      tags: { module: 'sections-page', action: 'deleteSectionLoading', error_type: 'unexpected_error', user_facing: 'true' },
      extra: { loadingId },
    })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
  }) // end Sentry.startSpan
}
