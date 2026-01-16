# План реализации: Отчеты к стадиям (Project Reports)

**Дата:** 2025-12-18
**Модуль:** resource-graph
**Задача:** Добавить возможность создания отчетов руководителей проектов к стадиям

---

## Контекст

### Существующие паттерны в модуле
- **Work Logs** (`work_logs`) - отчеты по работам к элементам декомпозиции
- **Loadings** (`loadings`) - загрузки сотрудников на этапы
- **Stage Readiness** - готовность этапов декомпозиции

### Технологии
- Cache module: `createDetailCacheQuery`, `createCacheMutation`
- Server Actions: `ActionResult<T>`
- TanStack Query: lazy loading, optimistic updates
- Frontend-design плагин: glass-morphic UI

### БД (уже создано)
- ✅ Таблица `project_reports` (6 колонок)
- ✅ RLS policies (SELECT для всех, INSERT/UPDATE/DELETE для PM/admin)
- ✅ Permissions: `project_reports.create`, `project_reports.edit`
- ✅ Roles: admin, project_manager имеют оба разрешения

---

## Этап 1: TypeScript типы

### Файл: `modules/resource-graph/types/index.ts`

**Добавить интерфейс:**

```typescript
/**
 * Отчет руководителя проекта к стадии
 */
export interface ProjectReport {
  /** ID отчета */
  id: string
  /** ID стадии */
  stageId: string
  /** Комментарий руководителя проекта */
  comment: string
  /** Автор отчета */
  createdBy: {
    id: string
    firstName: string | null
    lastName: string | null
    name: string | null
    avatarUrl: string | null
  }
  /** Дата создания */
  createdAt: string
  /** Дата последнего обновления */
  updatedAt: string
}
```

**Расположение:** После `WorkLog`, перед `Loading`

**Аналог:** `WorkLog` interface (строки 118-145)

---

## Этап 2: Server Actions

### Файл: `modules/resource-graph/actions/index.ts`

### 2.1. `getStageReports(stageId: string)`

**Назначение:** Получить все отчеты для стадии

**Логика:**
```typescript
export async function getStageReports(
  stageId: string
): Promise<ActionResult<ProjectReport[]>> {
  try {
    const supabase = await createClient()

    // Query с JOIN profiles для автора
    const { data, error } = await supabase
      .from('project_reports')
      .select(`
        report_id,
        stage_id,
        comment,
        created_at,
        updated_at,
        profiles:created_by (
          user_id,
          first_name,
          last_name,
          avatar_url
        )
      `)
      .eq('stage_id', stageId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[getStageReports] Supabase error:', error)
      return { success: false, error: error.message }
    }

    // Transform в ProjectReport[]
    const reports: ProjectReport[] = (data || []).map(row => {
      const profile = row.profiles as ProfileType | null

      return {
        id: row.report_id,
        stageId: row.stage_id,
        comment: row.comment,
        createdBy: {
          id: profile?.user_id || '',
          firstName: profile?.first_name || null,
          lastName: profile?.last_name || null,
          name: profile
            ? `${profile.last_name || ''} ${profile.first_name || ''}`.trim() || null
            : null,
          avatarUrl: profile?.avatar_url || null,
        },
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }
    })

    return { success: true, data: reports }
  } catch (error) {
    console.error('[getStageReports] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка загрузки отчетов',
    }
  }
}
```

**Аналог:** `getWorkLogsForSection` (строки 501-580)

---

### 2.2. `upsertStageReport(input)`

**Назначение:** Создать или обновить отчет

**Input:**
```typescript
interface UpsertStageReportInput {
  reportId?: string    // Если есть - UPDATE, иначе - INSERT
  stageId: string
  comment: string
}
```

**Логика:**
```typescript
export async function upsertStageReport(
  input: UpsertStageReportInput
): Promise<ActionResult<ProjectReport>> {
  try {
    const supabase = await createClient()

    // Проверка авторизации
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Не авторизован' }
    }

    // RLS автоматически проверит разрешение project_reports.create/edit

    if (input.reportId) {
      // UPDATE
      const { data, error } = await supabase
        .from('project_reports')
        .update({
          comment: input.comment,
          updated_at: new Date().toISOString(),
        })
        .eq('report_id', input.reportId)
        .select(`
          report_id,
          stage_id,
          comment,
          created_at,
          updated_at,
          profiles:created_by (
            user_id,
            first_name,
            last_name,
            avatar_url
          )
        `)
        .single()

      if (error) {
        console.error('[upsertStageReport] Update error:', error)
        return { success: false, error: error.message }
      }

      // Transform и return
      return { success: true, data: transformToProjectReport(data) }
    } else {
      // INSERT
      const { data, error } = await supabase
        .from('project_reports')
        .insert({
          stage_id: input.stageId,
          comment: input.comment,
          created_by: user.id,
        })
        .select(`
          report_id,
          stage_id,
          comment,
          created_at,
          updated_at,
          profiles:created_by (
            user_id,
            first_name,
            last_name,
            avatar_url
          )
        `)
        .single()

      if (error) {
        console.error('[upsertStageReport] Insert error:', error)
        return { success: false, error: error.message }
      }

      return { success: true, data: transformToProjectReport(data) }
    }
  } catch (error) {
    console.error('[upsertStageReport] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка сохранения отчета',
    }
  }
}
```

**Проверка разрешений:** НЕТ (делает RLS через policy)

---

### 2.3. `deleteStageReport(reportId, stageId)`

**Назначение:** Удалить отчет

**Input:**
```typescript
interface DeleteStageReportInput {
  reportId: string
  stageId: string  // Нужен для инвалидации кеша
}
```

**Логика:**
```typescript
export async function deleteStageReport(
  input: DeleteStageReportInput
): Promise<ActionResult<void>> {
  try {
    const supabase = await createClient()

    // RLS автоматически проверит разрешение project_reports.edit

    const { error } = await supabase
      .from('project_reports')
      .delete()
      .eq('report_id', input.reportId)

    if (error) {
      console.error('[deleteStageReport] Error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data: undefined }
  } catch (error) {
    console.error('[deleteStageReport] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка удаления отчета',
    }
  }
}
```

**Примечание:** `stageId` в input нужен для хуков (инвалидация кеша)

---

## Этап 3: Query Keys

### Файл: `modules/cache/keys/query-keys.ts`

**Добавить в секцию `resourceGraph`:**

```typescript
export const queryKeys = {
  // ... existing keys
  resourceGraph: {
    all: ['resource-graph'] as const,
    list: (filters?: FilterQueryParams) => [...queryKeys.resourceGraph.all, 'list', filters] as const,
    workLogs: (sectionId: string) => [...queryKeys.resourceGraph.all, 'work-logs', sectionId] as const,
    loadings: (sectionId: string) => [...queryKeys.resourceGraph.all, 'loadings', sectionId] as const,
    stageReadiness: (sectionId: string) => [...queryKeys.resourceGraph.all, 'stage-readiness', sectionId] as const,

    // 👇 НОВОЕ
    stageReports: (stageId: string) => [...queryKeys.resourceGraph.all, 'stage-reports', stageId] as const,
  },
  // ...
}
```

**Аналог:** `workLogs`, `loadings`, `stageReadiness`

---

## Этап 4: Hooks

### Файл: `modules/resource-graph/hooks/index.ts`

### 4.1. `useStageReports` (query hook)

```typescript
/**
 * Хук для получения отчетов к стадии
 *
 * Загружается лениво при развороте стадии (enabled: true).
 * Данные кешируются навечно, обновляются только через Realtime.
 *
 * @param stageId - ID стадии
 * @param options - { enabled: boolean } - включить загрузку
 *
 * @example
 * const { data: reports, isLoading } = useStageReports(stageId, { enabled: isExpanded })
 */
export const useStageReports = createDetailCacheQuery<ProjectReport[]>({
  queryKey: (stageId) => queryKeys.resourceGraph.stageReports(stageId),
  queryFn: getStageReports,
  staleTime: Infinity, // Данные не устаревают, обновляются через Realtime
})
```

**Аналог:** `useWorkLogs` (строки 125-129)

---

### 4.2. `useSaveStageReport` (mutation hook)

```typescript
/**
 * Хук для создания/обновления отчета к стадии
 *
 * Автоматически инвалидирует кеш отчетов стадии.
 *
 * @example
 * const saveMutation = useSaveStageReport()
 * saveMutation.mutate({ stageId: 'xxx', comment: 'Текст' })
 */
export const useSaveStageReport = createCacheMutation({
  mutationFn: upsertStageReport,
  invalidateKeys: (input) => [
    queryKeys.resourceGraph.stageReports(input.stageId),
  ],
})
```

**Инвалидация:** Только `stageReports(stageId)` (не весь resourceGraph.all)

---

### 4.3. `useDeleteStageReport` (mutation hook)

```typescript
/**
 * Хук для удаления отчета к стадии
 *
 * Автоматически инвалидирует кеш отчетов стадии.
 *
 * @example
 * const deleteMutation = useDeleteStageReport()
 * deleteMutation.mutate({ reportId: 'xxx', stageId: 'yyy' })
 */
export const useDeleteStageReport = createCacheMutation({
  mutationFn: deleteStageReport,
  invalidateKeys: (input) => [
    queryKeys.resourceGraph.stageReports(input.stageId),
  ],
})
```

**Примечание:** `stageId` передается в input специально для инвалидации

---

## Этап 5: UI Компонент (frontend-design)

### Файл: `modules/resource-graph/components/reports/StageReportMarkers.tsx`

### Требования к дизайну

1. **Glass-morphic карточки:**
   - Полупрозрачный фон с blur
   - Тонкая border с gradient
   - Subtle shadow

2. **Layout:**
   - Отображение под строкой стадии в timeline
   - Карточки выстроены горизонтально
   - Кнопка "+" для создания (только PM/admin)

3. **Карточка отчета:**
   - Avatar автора (слева)
   - Комментарий (truncated, max 2 строки)
   - Дата создания (относительная: "2 дня назад")
   - Кнопки edit/delete (только для PM/admin)

4. **Интерактивность:**
   - Hover: увеличение, изменение opacity
   - Click: модальное окно с полным текстом
   - Edit inline или в модалке

### Структура компонента

```tsx
interface StageReportMarkersProps {
  stageId: string
  range: TimelineRange
  timelineWidth: number
}

export function StageReportMarkers({ stageId, range, timelineWidth }: StageReportMarkersProps) {
  const { data: reports = [], isLoading } = useStageReports(stageId, { enabled: true })
  const saveMutation = useSaveStageReport()
  const deleteMutation = useDeleteStageReport()
  const { hasPermission } = usePermissions()

  const canCreate = hasPermission('project_reports.create')
  const canEdit = hasPermission('project_reports.edit')

  // Модалка для создания/редактирования
  const [editingReport, setEditingReport] = useState<ProjectReport | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  const handleSave = (comment: string) => {
    saveMutation.mutate({
      reportId: editingReport?.id,
      stageId,
      comment,
    })
  }

  const handleDelete = (reportId: string) => {
    if (confirm('Удалить отчет?')) {
      deleteMutation.mutate({ reportId, stageId })
    }
  }

  return (
    <div className="stage-reports-container">
      {/* Карточки отчетов */}
      {reports.map(report => (
        <ReportCard
          key={report.id}
          report={report}
          canEdit={canEdit}
          onEdit={() => setEditingReport(report)}
          onDelete={() => handleDelete(report.id)}
        />
      ))}

      {/* Кнопка создания */}
      {canCreate && (
        <CreateButton onClick={() => setIsCreating(true)} />
      )}

      {/* Модалка */}
      {(isCreating || editingReport) && (
        <ReportModal
          report={editingReport}
          onSave={handleSave}
          onClose={() => {
            setIsCreating(false)
            setEditingReport(null)
          }}
        />
      )}
    </div>
  )
}
```

**Frontend-design:** Использовать плагин для генерации стилей карточек

---

## Этап 6: Интеграция в TimelineRow

### Файл: `modules/resource-graph/components/timeline/TimelineRow.tsx`

**Найти:** `StageRow` компонент

**Добавить после рендера children стадии:**

```tsx
// В StageRow
{isExpanded && (
  <>
    {/* Existing: Objects, Sections, etc. */}

    {/* 👇 НОВОЕ: Отчеты к стадии */}
    <StageReportMarkers
      stageId={stage.id}
      range={range}
      timelineWidth={timelineWidth}
    />
  </>
)}
```

**Lazy loading:** Компонент сам включит запрос при рендере

---

## Потенциальные проблемы и решения

### 1. Проблема: `useDeleteStageReport` не знает `stageId`

**Решение:** Передавать `stageId` в input:
```typescript
deleteMutation.mutate({ reportId, stageId })
```

### 2. Проблема: Optimistic updates

**Решение (опционально):** Добавить optimistic update в `useSaveStageReport`:
```typescript
optimisticUpdate: {
  queryKey: (input) => queryKeys.resourceGraph.stageReports(input.stageId),
  updater: (oldData, input) => {
    if (input.reportId) {
      // Update existing
      return oldData.map(r => r.id === input.reportId ? { ...r, comment: input.comment } : r)
    } else {
      // Add new (temporary)
      return [{ id: 'temp-' + Date.now(), ...input, createdAt: new Date().toISOString() }, ...oldData]
    }
  },
}
```

**Но:** Для MVP можно без optimistic updates (как у work_logs)

### 3. Проблема: Realtime обновления

**Решение:** Добавить в `modules/cache/realtime/config.ts`:
```typescript
{
  table: 'project_reports',
  event: '*',
  invalidate: () => [queryKeys.resourceGraph.all],
}
```

---

## Файлы для изменения

| Файл | Действие | Примерный размер |
|------|----------|------------------|
| `modules/resource-graph/types/index.ts` | Добавить `ProjectReport` | +25 строк |
| `modules/resource-graph/actions/index.ts` | 3 actions (get, upsert, delete) | +180 строк |
| `modules/cache/keys/query-keys.ts` | Добавить `stageReports` key | +1 строка |
| `modules/resource-graph/hooks/index.ts` | 3 hooks | +40 строк |
| `modules/resource-graph/components/reports/StageReportMarkers.tsx` | Новый компонент (frontend-design) | +250 строк |
| `modules/resource-graph/components/timeline/TimelineRow.tsx` | Интеграция | +10 строк |
| `modules/cache/realtime/config.ts` | Realtime subscription | +5 строк |

**Итого:** ~7 файлов, ~511 строк кода

---

## Проверка агентами

### Cache Guardian
- ✅ Server Actions возвращают `ActionResult<T>`
- ✅ Hooks используют фабрики из cache module
- ✅ Query keys через `queryKeys.resourceGraph.*`
- ✅ Инвалидация кеша при мутациях

### Clean Code Guardian
- ✅ TypeScript strict mode
- ✅ JSDoc комментарии
- ✅ Именование: camelCase для переменных/функций
- ✅ Интерфейсы: PascalCase
- ✅ Структура: типы → actions → hooks → UI

### Pragmatic Architect
- ✅ Использует существующие паттерны (work_logs)
- ✅ Не создает новых абстракций
- ✅ Минимальная сложность для требований
- ⚠️ Frontend-design может добавить сложности (но это требование)

---

## Вопросы для согласования

1. **Optimistic updates:** Добавлять или нет? (Work logs не используют)
2. **Realtime:** Подписка на `project_reports` нужна?
3. **UI расположение:** Строго под стадией или можно в отдельной секции?
4. **Frontend-design:** Какой стиль предпочесть? (glass-morphic, minimal, card-based)

---

## Следующий шаг

После согласования плана и проверки агентами → **Фаза 2.3 - Реализация**
