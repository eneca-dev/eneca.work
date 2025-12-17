# Checkpoints System - План реализации

## Цель

Реализовать систему Checkpoints — управление дедлайнами и ключевыми событиями разделов с визуализацией на Resource Graph Timeline, поддержкой кастомных типов чекпоинтов, связанными разделами (M:N), audit trail историей изменений и интеграцией с модулем Cache.

---

## Критерии готовности (Definition of Done)

### 1. База данных
- [ ] Миграция создана: 4 таблицы (`checkpoint_types`, `section_checkpoints`, `checkpoint_section_links`, `checkpoint_audit`)
- [ ] VIEW `view_section_checkpoints` с computed status, linked sections, permission context
- [ ] Все индексы (uncompleted, completed, audit, custom types)
- [ ] Таблицы добавлены в Realtime publication (`ALTER PUBLICATION supabase_realtime ADD TABLE ...`)
- [ ] `npm run db:types` выполнен, типы обновлены

### 2. Server Actions (`modules/checkpoints/actions/`)
- [ ] `checkpoints.ts`: `getCheckpoints`, `getCheckpoint`, `createCheckpoint`, `updateCheckpoint`, `completeCheckpoint`, `deleteCheckpoint`, `getCheckpointAudit`, `canManageCheckpoint` helper
- [ ] `checkpoint-types.ts`: `getCheckpointTypes`, `createCheckpointType`, `updateCheckpointType`, `deleteCheckpointType`
- [ ] Audit trail: CREATE/UPDATE/DELETE/COMPLETE/UNCOMPLETE записи в `checkpoint_audit`
- [ ] FIFO audit cleanup (max 50 записей) в application layer
- [ ] Permission checks: section_responsible, project_manager, admin

### 3. Cache Module Integration
- [ ] Query keys добавлены в `modules/cache/keys/query-keys.ts` (`checkpoints.*`, `checkpointTypes.*`)
- [ ] `CheckpointFilters` interface экспортирован
- [ ] Realtime subscriptions добавлены в `modules/cache/realtime/config.ts` (4 таблицы)

### 4. Cache Hooks (`modules/checkpoints/hooks/`)
- [ ] `use-checkpoints.ts`: `useCheckpoints`, `useCheckpoint`, `useCheckpointAudit`, `useCreateCheckpoint`, `useUpdateCheckpoint`, `useCompleteCheckpoint`, `useDeleteCheckpoint`
- [ ] `use-checkpoint-types.ts`: `useCheckpointTypes`, `useCreateCheckpointType`, `useUpdateCheckpointType`, `useDeleteCheckpointType`
- [ ] Optimistic updates в `useUpdateCheckpoint`, `useCompleteCheckpoint`
- [ ] Cache invalidation: `sections.all`, `resourceGraph.all` при изменениях

### 5. UI Components (`modules/checkpoints/components/`)
- [ ] `CheckpointCard.tsx` — timeline marker с вертикальной полосой, tooltip, click handler
- [ ] `CheckpointDetailModal.tsx` — slide-in panel (420px) с tabs: General, Linked Sections, Audit History
- [ ] `CheckpointCreateModal.tsx` — center modal с формой создания
- [ ] `AuditTimeline.tsx` — audit history timeline (user avatar, operation, field, old→new, timestamp)
- [ ] `LinkedSectionsList.tsx` — список связанных разделов с multi-select dropdown
- [ ] `StatusBadge.tsx` — цветовой badge (pending/completed/completed_late/overdue)
- [ ] `CheckpointTypeManager.tsx` — admin panel (`/admin/checkpoints/types`) для управления типами
- [ ] Permission guards: readonly mode для пользователей без прав

### 6. Resource Graph Integration
- [ ] Чекпоинты отображаются на timeline как вертикальные маркеры (по `checkpoint_date`)
- [ ] Design language: Dark theme + amber accents (matches Resource Graph)
- [ ] Tooltip при hover: title, checkpoint_date, status badge
- [ ] Click → открытие `CheckpointDetailModal`

### 7. Section Detail Modal Integration
- [ ] Вкладка "Чекпоинты" в `SectionModal.tsx` (список чекпоинтов раздела)
- [ ] Кнопка "Создать чекпоинт" → открытие `CheckpointCreateModal` с pre-filled sectionId

### 8. TypeScript & Types
- [ ] `modules/checkpoints/types/index.ts` — экспорт всех типов (`Checkpoint`, `CheckpointType`, `AuditEntry`, `CheckpointFilters`)
- [ ] Public API: `modules/checkpoints/index.ts` экспортирует hooks, components, types

### 9. Testing & Build
- [ ] `npm run build` проходит без ошибок
- [ ] Ручное тестирование: создание, редактирование, завершение, удаление чекпоинта
- [ ] Ручное тестирование: linked sections (добавление, удаление связей)
- [ ] Ручное тестирование: audit history (корректные записи для всех операций)
- [ ] Ручное тестирование: permission guards (readonly для пользователей без прав)

### 10. Агенты (Проверки)
- [ ] 🤖 DB Architect: схема БД, индексы, VIEW, Realtime publication
- [ ] 🤖 Cache Guardian: Server Actions соответствуют паттерну, hooks через фабрики
- [ ] 🤖 Clean Code Guardian: структура модуля, naming, TypeScript strictness
- [ ] 🤖 Modal Architect: CheckpointDetailModal, CheckpointCreateModal соответствуют Resource Graph design language
- [ ] 🤖 Pragmatic Architect: нет over-engineering, используются существующие абстракции

---

## Этапы реализации

### Этап 1: Database Schema & Migration

**Описание:**
Создать миграцию с таблицами `checkpoint_types`, `section_checkpoints`, `checkpoint_section_links`, `checkpoint_audit`, VIEW `view_section_checkpoints`, индексами и Realtime publication.

**Затрагиваемые файлы:**
- `supabase/migrations/YYYYMMDDHHMMSS_create_checkpoints_system.sql` (новый)
- `types/db.ts` (обновится после `npm run db:types`)

**Зависимости:**
Нет (независимый этап)

**Детали:**
- 4 таблицы с FK constraints, ON DELETE CASCADE/RESTRICT/SET NULL
- Partial indexes для performance (uncompleted, completed, audit)
- VIEW агрегирует linked_sections (jsonb_agg), computed status (CASE), permission context
- Realtime publication для всех 4 таблиц

**Визуальные изменения:**
❌ Нет визуальных изменений (backend only)

**Как тестировать:**
1. Применить миграцию: `supabase migration up` или через Supabase Studio
2. Проверить создание таблиц: `SELECT * FROM checkpoint_types;` (должна быть пустая таблица)
3. Проверить VIEW: `SELECT * FROM view_section_checkpoints;` (должна быть пустая или с данными если есть sections)
4. Запустить `npm run db:types` — проверить, что `types/db.ts` обновился (появились типы `checkpoint_types`, `section_checkpoints`, `checkpoint_section_links`, `checkpoint_audit`, `view_section_checkpoints`)
5. Проверить Realtime publication: `SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';` (должны быть 4 новые таблицы)

**Проверка 🤖 DB Architect:**
После создания миграции — проверка схемы на оптимизацию индексов, FK cascades, VIEW performance.

---

### Этап 2: Cache Module Integration (Query Keys + Realtime)

**Описание:**
Добавить query keys для checkpoints и checkpointTypes в `modules/cache/keys/query-keys.ts`, настроить Realtime subscriptions в `modules/cache/realtime/config.ts`.

**Затрагиваемые файлы:**
- `modules/cache/keys/query-keys.ts` (изменение)
- `modules/cache/realtime/config.ts` (изменение)

**Зависимости:**
Этап 1 (база данных должна быть готова)

**Детали:**
- Query keys: `checkpoints.all`, `checkpoints.lists()`, `checkpoints.list(filters)`, `checkpoints.detail(id)`, `checkpoints.audit(id)`, `checkpoints.bySection(sectionId)`, `checkpoints.byProject(projectId)`
- Query keys: `checkpointTypes.all`, `checkpointTypes.list()`, `checkpointTypes.detail(id)`
- `CheckpointFilters` interface extends `BaseFilters` (sectionId, projectId, status, dateFrom, dateTo)
- Realtime: 4 subscriptions (section_checkpoints, checkpoint_section_links, checkpoint_audit, checkpoint_types) → invalidate соответствующие query keys

**Визуальные изменения:**
❌ Нет визуальных изменений (cache configuration only)

**Как тестировать:**
1. Проверить `npm run build` — нет ошибок TypeScript (query keys экспортируются корректно)
2. Открыть браузер DevTools → Console
3. Проверить, что Realtime subscriptions создаются (в консоли должны быть логи от Supabase Realtime при изменениях в таблицах)
4. Создать тестовую запись в `checkpoint_types` через Supabase Studio → проверить, что в консоли появился лог о Realtime event
5. Проверить TypeScript: импорт `queryKeys.checkpoints.all` в тестовом файле не выдаёт ошибок

**Проверка 🤖 Pragmatic Architect:**
Использование существующих паттернов query keys, нет дублирования.

---

### Этап 3: Server Actions (Checkpoints CRUD)

**Описание:**
Реализовать Server Actions для CRUD операций с чекпоинтами: `getCheckpoints`, `getCheckpoint`, `createCheckpoint`, `updateCheckpoint`, `completeCheckpoint`, `deleteCheckpoint`, `getCheckpointAudit`, `canManageCheckpoint`.

**Затрагиваемые файлы:**
- `modules/checkpoints/actions/checkpoints.ts` (новый)

**Зависимости:**
Этап 1 (база данных), Этап 2 (query keys для типов в ActionResult)

**Детали:**
- `getCheckpoints(filters)`: SELECT from VIEW, фильтрация по sectionId/projectId/status/dateFrom/dateTo, ORDER BY checkpoint_date ASC
- `getCheckpoint(id)`: SELECT from VIEW WHERE checkpoint_id
- `createCheckpoint`: INSERT → checkpoint_section_links → audit entries (CREATE) → SELECT from VIEW
- `updateCheckpoint`: SELECT old values → UPDATE → DELETE+INSERT links → audit entries (UPDATE, только измененные поля) → SELECT from VIEW
- `completeCheckpoint`: UPDATE completed_at/completed_by → audit entry (COMPLETE/UNCOMPLETE) → SELECT from VIEW
- `deleteCheckpoint`: audit entry (DELETE, before CASCADE) → DELETE checkpoint
- `getCheckpointAudit`: SELECT from checkpoint_audit JOIN profiles, ORDER BY changed_at DESC LIMIT 50
- `canManageCheckpoint(sectionId)`: проверка section_responsible, project_manager, admin role
- FIFO audit cleanup (max 50 записей): DELETE старые audit entries если > 50

**Визуальные изменения:**
❌ Нет визуальных изменений (Server Actions только)

**Как тестировать:**
1. Создать тестовый файл `test-checkpoints.ts` в `app/api/test/`:
```typescript
import { getCheckpoints, createCheckpoint } from '@/modules/checkpoints/actions/checkpoints'

export async function GET() {
  const result = await getCheckpoints()
  return Response.json(result)
}

export async function POST(req: Request) {
  const body = await req.json()
  const result = await createCheckpoint(body)
  return Response.json(result)
}
```
2. Запустить dev server: `npm run dev`
3. Проверить `GET /api/test` → должен вернуть `{ success: true, data: [] }` (если нет чекпоинтов)
4. Проверить `POST /api/test` с телом:
```json
{
  "sectionId": "existing-section-uuid",
  "typeId": "existing-type-uuid",
  "title": "Test Checkpoint",
  "checkpointDate": "2025-12-31"
}
```
5. Должен вернуть `{ success: true, data: { checkpoint_id: "...", ... } }`
6. Проверить в БД: `SELECT * FROM section_checkpoints;` — новая запись
7. Проверить audit: `SELECT * FROM checkpoint_audit;` — записи CREATE
8. Проверить permission check: выполнить запрос от пользователя без прав → должен вернуть `{ success: false, error: "Недостаточно прав" }`

**Проверка 🤖 Cache Guardian:**
Все actions возвращают `ActionResult<T>`, используют `createClient()` from `@/utils/supabase/server`, корректная обработка ошибок, permission checks.

---

### Этап 4: Server Actions (Checkpoint Types CRUD)

**Описание:**
Реализовать Server Actions для управления типами чекпоинтов: `getCheckpointTypes`, `createCheckpointType`, `updateCheckpointType`, `deleteCheckpointType`.

**Затрагиваемые файлы:**
- `modules/checkpoints/actions/checkpoint-types.ts` (новый)

**Зависимости:**
Этап 1 (база данных)

**Детали:**
- `getCheckpointTypes()`: SELECT all from checkpoint_types ORDER BY is_custom, name
- `createCheckpointType`: admin check → INSERT (type, name, icon, color, is_custom=true, created_by)
- `updateCheckpointType`: admin check → is_custom check → UPDATE (name, icon, color)
- `deleteCheckpointType`: admin check → is_custom check → check if used in section_checkpoints → DELETE

**Визуальные изменения:**
❌ Нет визуальных изменений (Server Actions только)

**Как тестировать:**
1. Создать тестовый API route `app/api/test/types/route.ts`:
```typescript
import { getCheckpointTypes, createCheckpointType } from '@/modules/checkpoints/actions/checkpoint-types'

export async function GET() {
  const result = await getCheckpointTypes()
  return Response.json(result)
}

export async function POST(req: Request) {
  const body = await req.json()
  const result = await createCheckpointType(body)
  return Response.json(result)
}
```
2. Проверить `GET /api/test/types` → должен вернуть список типов (пустой или seed data)
3. Проверить `POST /api/test/types` с телом (от admin пользователя):
```json
{
  "type": "custom_deadline",
  "name": "Кастомный дедлайн",
  "icon": "clock",
  "color": "#ff6b6b"
}
```
4. Должен вернуть `{ success: true, data: { type_id: "...", is_custom: true } }`
5. Проверить permission: запрос от не-admin → `{ success: false, error: "Недостаточно прав" }`
6. Проверить delete: создать type, привязать к checkpoint → попытка DELETE → должна вернуть ошибку (FK RESTRICT)

**Проверка 🤖 Cache Guardian:**
ActionResult wrapper, admin permission checks.

---

### Этап 5: Cache Hooks (Checkpoints)

**Описание:**
Создать хуки для работы с чекпоинтами: `useCheckpoints`, `useCheckpoint`, `useCheckpointAudit`, `useCreateCheckpoint`, `useUpdateCheckpoint`, `useCompleteCheckpoint`, `useDeleteCheckpoint`.

**Затрагиваемые файлы:**
- `modules/checkpoints/hooks/use-checkpoints.ts` (новый)

**Зависимости:**
Этап 2 (query keys), Этап 3 (Server Actions checkpoints)

**Детали:**
- `useCheckpoints`: `createCacheQuery` с `queryKeys.checkpoints.list(filters)`, staleTime=fast
- `useCheckpoint`: `createDetailCacheQuery` с `queryKeys.checkpoints.detail(id)`, staleTime=fast
- `useCheckpointAudit`: `createDetailCacheQuery` с `queryKeys.checkpoints.audit(id)`, staleTime=medium
- `useCreateCheckpoint`: `createCacheMutation`, invalidate `checkpoints.all`, `sections.all`, `resourceGraph.all`
- `useUpdateCheckpoint`: `createUpdateMutation` с optimistic update (merge title, description, checkpoint_date, custom_icon, custom_color)
- `useCompleteCheckpoint`: `createUpdateMutation` с optimistic update (completed_at, completed_by)
- `useDeleteCheckpoint`: `createDeleteMutation`, invalidate `checkpoints.all`, `sections.all`, `resourceGraph.all`

**Визуальные изменения:**
❌ Нет визуальных изменений (hooks только)

**Как тестировать:**
1. Создать тестовый компонент `app/test-checkpoints-hooks/page.tsx`:
```tsx
'use client'
import { useCheckpoints } from '@/modules/checkpoints/hooks/use-checkpoints'

export default function TestPage() {
  const { data, isLoading, error } = useCheckpoints({ sectionId: 'test-section-uuid' })

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>

  return (
    <div>
      <h1>Checkpoints: {data?.length || 0}</h1>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  )
}
```
2. Открыть `/test-checkpoints-hooks` → должны загрузиться данные
3. Проверить в React DevTools (Components) → TanStack Query Devtools → видны query keys `['checkpoints', 'list', ...]`
4. Тест optimistic update: добавить кнопку с `useUpdateCheckpoint().mutate(...)` → проверить, что UI обновляется мгновенно (до ответа сервера)
5. Тест cache invalidation: создать checkpoint через `useCreateCheckpoint` → проверить, что список обновился автоматически
6. Проверить `npm run build` — нет ошибок TypeScript

**Проверка 🤖 Cache Guardian:**
Использование фабрик из cache module, корректные query keys, optimistic updates, cache invalidation.

---

### Этап 6: Cache Hooks (Checkpoint Types)

**Описание:**
Создать хуки для работы с типами чекпоинтов: `useCheckpointTypes`, `useCreateCheckpointType`, `useUpdateCheckpointType`, `useDeleteCheckpointType`.

**Затрагиваемые файлы:**
- `modules/checkpoints/hooks/use-checkpoint-types.ts` (новый)

**Зависимости:**
Этап 2 (query keys), Этап 4 (Server Actions checkpoint-types)

**Детали:**
- `useCheckpointTypes`: `createCacheQuery` с `queryKeys.checkpointTypes.list()`, staleTime=slow (редко меняется)
- `useCreateCheckpointType`: `createCacheMutation`, invalidate `checkpointTypes.all`
- `useUpdateCheckpointType`: `createUpdateMutation`, invalidate `checkpointTypes.all`, `checkpoints.all` (если изменился type icon/color)
- `useDeleteCheckpointType`: `createDeleteMutation`, invalidate `checkpointTypes.all`

**Визуальные изменения:**
❌ Нет визуальных изменений (hooks только)

**Как тестировать:**
1. Создать тестовый компонент `app/test-checkpoint-types/page.tsx`:
```tsx
'use client'
import { useCheckpointTypes, useCreateCheckpointType } from '@/modules/checkpoints/hooks/use-checkpoint-types'

export default function TestPage() {
  const { data: types } = useCheckpointTypes()
  const createMutation = useCreateCheckpointType()

  return (
    <div>
      <h1>Types: {types?.length || 0}</h1>
      <button onClick={() => createMutation.mutate({
        type: 'test_type',
        name: 'Test Type',
        icon: 'star',
        color: '#ff0000'
      })}>
        Create Type
      </button>
      <pre>{JSON.stringify(types, null, 2)}</pre>
    </div>
  )
}
```
2. Открыть `/test-checkpoint-types` → загрузка типов
3. Кликнуть "Create Type" → проверить, что список обновился автоматически
4. Проверить TanStack Query Devtools → query key `['checkpoint-types', 'list']`
5. Проверить `npm run build` — нет ошибок

**Проверка 🤖 Cache Guardian:**
Фабрики, query keys, invalidation.

---

### Этап 7: TypeScript Types

**Описание:**
Создать TypeScript типы для модуля checkpoints: `Checkpoint`, `CheckpointType`, `AuditEntry`, `CheckpointFilters`.

**Затрагиваемые файлы:**
- `modules/checkpoints/types/index.ts` (новый)

**Зависимости:**
Этап 1 (`types/db.ts` обновлен после миграции)

**Детали:**
- `Checkpoint`: интерфейс из VIEW `view_section_checkpoints` (все поля + computed status/status_label/linked_sections)
- `CheckpointType`: интерфейс из таблицы `checkpoint_types`
- `AuditEntry`: интерфейс из `checkpoint_audit` + JOIN profiles (user_firstname, user_lastname, user_avatar_url)
- `CheckpointFilters`: extends BaseFilters (уже в query-keys.ts, переместить в types/index.ts)

**Визуальные изменения:**
❌ Нет визуальных изменений (types только)

**Как тестировать:**
1. Создать тестовый файл `test-types.ts`:
```typescript
import type { Checkpoint, CheckpointType, AuditEntry } from '@/modules/checkpoints/types'

const checkpoint: Checkpoint = {
  checkpoint_id: 'test',
  section_id: 'test',
  type_id: 'test',
  type_code: 'exam',
  type_name: 'Экспертиза',
  is_custom: false,
  title: 'Test',
  description: null,
  checkpoint_date: '2025-12-31',
  icon: 'check-circle',
  color: '#10b981',
  completed_at: null,
  completed_by: null,
  status: 'pending',
  status_label: 'Ожидается',
  created_by: null,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
  section_responsible: null,
  project_manager: null,
  linked_sections: [],
  linked_sections_count: 0,
}
```
2. Проверить `npm run build` — нет ошибок TypeScript
3. Проверить autocomplete в VSCode: при вводе `checkpoint.` должны появиться все поля
4. Проверить enum types: `status: 'pending' | 'completed' | 'completed_late' | 'overdue'` (не `string`)

**Проверка 🤖 Clean Code Guardian:**
Naming conventions, strict TypeScript types.

---

### Этап 8: UI Components - StatusBadge

**Описание:**
Создать компонент `StatusBadge.tsx` для отображения статуса чекпоинта (pending/completed/completed_late/overdue) с цветовой индикацией.

**Затрагиваемые файлы:**
- `modules/checkpoints/components/StatusBadge.tsx` (новый)

**Зависимости:**
Этап 7 (types)

**Детали:**
- Props: `status: Checkpoint['status']`, `label: string`
- Цвета: pending=gray, completed=green, completed_late=amber, overdue=red
- Tailwind classes: `bg-{color}-500/10 text-{color}-500 border-{color}-500/20`
- Badge размер: text-xs, px-2, py-0.5, rounded-md

**Визуальные изменения:**
✅ **ДА** — badge компонент с цветовой индикацией статуса

**Ожидаемый вид:**
- Pending: серый badge "Ожидается"
- Completed: зелёный badge "Выполнено"
- Completed Late: жёлтый badge "Выполнено с опозданием"
- Overdue: красный badge "Просрочено"

**Как тестировать:**
1. Создать тестовую страницу `app/test-status-badge/page.tsx`:
```tsx
import { StatusBadge } from '@/modules/checkpoints/components/StatusBadge'

export default function TestPage() {
  return (
    <div className="p-8 space-y-4">
      <StatusBadge status="pending" label="Ожидается" />
      <StatusBadge status="completed" label="Выполнено" />
      <StatusBadge status="completed_late" label="Выполнено с опозданием" />
      <StatusBadge status="overdue" label="Просрочено" />
    </div>
  )
}
```
2. Открыть `/test-status-badge`
3. Проверить цвета:
   - Pending: серый текст + светло-серый фон
   - Completed: зелёный текст + светло-зелёный фон
   - Completed Late: жёлтый/amber текст + светло-жёлтый фон
   - Overdue: красный текст + светло-красный фон
4. Проверить размеры: text-xs, padding соответствует дизайну Resource Graph
5. Проверить responsive: badge корректно отображается на разных разрешениях

**Проверка 🤖 Modal Architect:**
Соответствие Resource Graph design language (цвета, spacing, typography).

---

### Этап 9: UI Components - CheckpointCard (Timeline Marker)

**Описание:**
Создать компонент `CheckpointCard.tsx` для отображения чекпоинта на Resource Graph Timeline как вертикальной полосы с tooltip.

**Затрагиваемые файлы:**
- `modules/checkpoints/components/CheckpointCard.tsx` (новый)

**Зависимости:**
Этап 7 (types), Этап 8 (StatusBadge)

**Детали:**
- Props: `checkpoint: Checkpoint`, `position: { left: number }`, `onClickOpen: (id: string) => void`
- Вертикальная полоса (w-0.5, hover:w-1) с цветом из `checkpoint.color || statusColor`
- Dot marker (w-4 h-4, rounded-full, border-2) с иконкой внутри (Lucide icon, w-2 h-2)
- Tooltip: title, checkpoint_date (format dd.MM.yyyy), StatusBadge
- Hover effects: scale dot, expand line width

**Визуальные изменения:**
✅ **ДА** — вертикальная полоса на timeline с dot marker и tooltip

**Ожидаемый вид:**
- Вертикальная тонкая линия (0.5px → 1px на hover)
- Dot вверху линии с иконкой внутри
- Tooltip при hover: название чекпоинта, дата, status badge
- Цвет линии и dot зависит от status или custom color

**Как тестировать:**
1. Создать тестовую страницу `app/test-checkpoint-card/page.tsx`:
```tsx
'use client'
import { CheckpointCard } from '@/modules/checkpoints/components/CheckpointCard'
import type { Checkpoint } from '@/modules/checkpoints/types'
import { useState } from 'react'

export default function TestPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const testCheckpoint: Checkpoint = {
    checkpoint_id: 'test-1',
    title: 'Экспертиза раздела АР',
    checkpoint_date: '2025-12-31',
    status: 'pending',
    status_label: 'Ожидается',
    icon: 'check-circle',
    color: '#10b981',
    // ... остальные поля
  }

  return (
    <div className="relative h-screen w-full bg-background">
      <CheckpointCard
        checkpoint={testCheckpoint}
        position={{ left: 200 }}
        onClickOpen={(id) => setSelectedId(id)}
      />
      {selectedId && <div className="p-4">Clicked: {selectedId}</div>}
    </div>
  )
}
```
2. Открыть `/test-checkpoint-card`
3. Проверить:
   - Вертикальная линия отображается на позиции left: 200px
   - Dot marker вверху линии с иконкой
   - Hover на линию → tooltip появляется
   - Hover на линию → линия расширяется до 1px
   - Hover на dot → dot увеличивается (scale-125)
   - Click → console.log срабатывает с checkpoint_id
4. Проверить на тёмной теме (Resource Graph background)

**Проверка 🤖 Modal Architect:**
Resource Graph design language, tooltip styling, transition effects.

---

### Этап 10: UI Components - AuditTimeline

**Описание:**
Создать компонент `AuditTimeline.tsx` для отображения истории изменений чекпоинта.

**Затрагиваемые файлы:**
- `modules/checkpoints/components/AuditTimeline.tsx` (новый)

**Зависимости:**
Этап 5 (useCheckpointAudit hook), Этап 7 (types)

**Детали:**
- Props: `checkpointId: string`
- Использует `useCheckpointAudit(checkpointId)`
- Timeline: вертикальная линия (border-l), entries с offset
- Entry: user avatar + name, operation_type badge (CREATE/UPDATE/DELETE/COMPLETE/UNCOMPLETE), field_name, old_value → new_value, timestamp (relative, напр. "2 часа назад")
- Empty state: "Нет истории изменений"

**Визуальные изменения:**
✅ **ДА** — timeline с историей изменений

**Ожидаемый вид:**
- Вертикальная линия слева
- Entries: аватар пользователя, имя, operation badge, "поле: старое → новое", timestamp
- Empty state: серый текст "Нет истории изменений"

**Как тестировать:**
1. Создать тестовый checkpoint через Supabase Studio с несколькими audit entries
2. Создать страницу `app/test-audit-timeline/page.tsx`:
```tsx
'use client'
import { AuditTimeline } from '@/modules/checkpoints/components/AuditTimeline'

export default function TestPage() {
  return (
    <div className="p-8 bg-background">
      <AuditTimeline checkpointId="existing-checkpoint-uuid" />
    </div>
  )
}
```
3. Открыть `/test-audit-timeline`
4. Проверить:
   - Timeline отображается с вертикальной линией
   - Entries показывают аватар, имя пользователя, operation type
   - field_name корректный (title, description, checkpoint_date, etc.)
   - old_value → new_value отображаются (если есть)
   - Timestamp показывает относительное время ("2 часа назад", "вчера")
   - Empty state если нет audit entries
5. Проверить на разных operation_type: CREATE, UPDATE, DELETE, COMPLETE, UNCOMPLETE

**Проверка 🤖 Clean Code Guardian:**
Компонент структура, naming, TypeScript props.

---

### Этап 11: UI Components - LinkedSectionsList

**Описание:**
Создать компонент `LinkedSectionsList.tsx` для отображения и управления связанными разделами чекпоинта.

**Затрагиваемые файлы:**
- `modules/checkpoints/components/LinkedSectionsList.tsx` (новый)

**Зависимости:**
Этап 5 (useUpdateCheckpoint hook), Этап 7 (types)

**Детали:**
- Props: `checkpointId: string`, `linkedSections: Checkpoint['linked_sections']`, `sectionId: string` (current section для фильтрации)
- Список связанных разделов: section_name, кнопка "Удалить связь" (X icon)
- Multi-select dropdown "Добавить раздел": загрузка sections from project (via useSections hook с фильтром по projectId)
- Mutation: `updateMutation.mutate({ checkpointId, linkedSectionIds: [...] })`

**Визуальные изменения:**
✅ **ДА** — список связанных разделов + multi-select dropdown

**Ожидаемый вид:**
- Список: карточки с section_name и кнопка X справа
- Multi-select dropdown: "Добавить раздел" → выпадающий список sections
- Empty state: "Нет связанных разделов"

**Как тестировать:**
1. Создать checkpoint с linked sections через Supabase Studio
2. Создать страницу `app/test-linked-sections/page.tsx`:
```tsx
'use client'
import { LinkedSectionsList } from '@/modules/checkpoints/components/LinkedSectionsList'

export default function TestPage() {
  const linkedSections = [
    { section_id: 'sec-1', section_name: 'Раздел АР' },
    { section_id: 'sec-2', section_name: 'Раздел КР' },
  ]

  return (
    <div className="p-8 bg-background">
      <LinkedSectionsList
        checkpointId="test-checkpoint-id"
        linkedSections={linkedSections}
        sectionId="current-section-id"
      />
    </div>
  )
}
```
3. Открыть `/test-linked-sections`
4. Проверить:
   - Список из 2 разделов отображается
   - Кнопка X рядом с каждым разделом
   - Click X → optimistic update (раздел исчезает сразу)
   - Multi-select dropdown "Добавить раздел" отображается
   - Dropdown загружает sections из проекта (исключая уже связанные)
   - Выбор раздела → optimistic update (раздел добавляется сразу)
   - Empty state если linkedSections пустой

**Проверка 🤖 Clean Code Guardian:**
Component structure, mutation logic.

---

### Этап 12: UI Components - CheckpointDetailModal

**Описание:**
Создать компонент `CheckpointDetailModal.tsx` — slide-in panel для просмотра и редактирования чекпоинта.

**Затрагиваемые файлы:**
- `modules/checkpoints/components/CheckpointDetailModal.tsx` (новый)

**Зависимости:**
Этап 5 (hooks), Этап 7 (types), Этап 8-11 (sub-components)

**Детали:**
- Props: `isOpen: boolean`, `onClose: () => void`, `checkpointId: string`
- Layout: slide-in panel RIGHT (420px width), overlay с backdrop-blur
- Header: inline edit title, type badge (readonly), status badge, close button (X)
- Tabs: General (checkpoint_date DatePicker, description RichTextEditor, custom_icon IconPicker, custom_color ColorPicker), Linked Sections (LinkedSectionsList), Audit History (AuditTimeline)
- Footer sticky: "Отметить выполненным" (green button) / "Отменить выполнение" (outline button), "Удалить чекпоинт" (red ghost button с confirm dialog)
- Permission guard: readonly mode если `!canManageCheckpoint`

**Визуальные изменения:**
✅ **ДА** — slide-in modal справа (420px)

**Ожидаемый вид:**
- Overlay затемнённый с blur
- Panel справа (420px) с header, tabs, footer
- Header: title (inline edit), type badge, status badge, X button
- 3 tabs: General, Linked Sections, Audit History
- Footer: кнопки Complete/Uncomplete, Delete
- Readonly mode: все поля disabled, кнопки скрыты

**Как тестировать:**
1. Создать страницу `app/test-checkpoint-modal/page.tsx`:
```tsx
'use client'
import { CheckpointDetailModal } from '@/modules/checkpoints/components/CheckpointDetailModal'
import { useState } from 'react'

export default function TestPage() {
  const [isOpen, setIsOpen] = useState(true)

  return (
    <div className="p-8">
      <button onClick={() => setIsOpen(true)}>Open Modal</button>
      <CheckpointDetailModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        checkpointId="existing-checkpoint-uuid"
      />
    </div>
  )
}
```
2. Открыть `/test-checkpoint-modal`
3. Проверить:
   - Modal slide-in анимация справа
   - Overlay затемнён с blur
   - Header: title editable (inline), type badge readonly, status badge, X button
   - Tabs переключаются (General, Linked Sections, Audit History)
   - General tab: DatePicker, RichTextEditor, IconPicker, ColorPicker
   - Linked Sections tab: LinkedSectionsList компонент
   - Audit History tab: AuditTimeline компонент
   - Footer: кнопки Complete (green), Delete (red ghost)
   - Click Complete → optimistic update (completed_at заполняется)
   - Click Delete → confirm dialog → checkpoint удаляется → modal закрывается
   - Click overlay → modal закрывается
   - Readonly mode: все поля disabled (проверить с пользователем без прав)
4. Проверить на тёмной теме (Resource Graph style)

**Проверка 🤖 Modal Architect:**
Matches SectionModal.tsx layout, Resource Graph design language, permission guards.

---

### Этап 13: UI Components - CheckpointCreateModal

**Описание:**
Создать компонент `CheckpointCreateModal.tsx` — center modal для создания нового чекпоинта.

**Затрагиваемые файлы:**
- `modules/checkpoints/components/CheckpointCreateModal.tsx` (новый)

**Зависимости:**
Этап 5 (useCreateCheckpoint), Этап 6 (useCheckpointTypes), Этап 7 (types)

**Детали:**
- Props: `isOpen: boolean`, `onClose: () => void`, `sectionId: string` (pre-filled)
- Form: React Hook Form + Zod schema
- Fields: Раздел (readonly, display section_name), Тип (dropdown checkpoint_types с кнопкой "Создать новый тип"), Название (required), Дата дедлайна (DatePicker, required), Описание (RichTextEditor, optional), Иконка (IconPicker, optional), Цвет (ColorPicker, optional), Связанные разделы (multi-select, optional)
- Buttons: "Создать" (primary) → `createMutation.mutate()` → close modal, "Отмена" (outline) → close modal
- Validation: title required, checkpointDate required, typeId required

**Визуальные изменения:**
✅ **ДА** — center modal с формой создания чекпоинта

**Ожидаемый вид:**
- Center modal (max-width 600px)
- Overlay затемнённый
- Form: 8 полей (Раздел readonly, Тип dropdown, Название input, Дата DatePicker, Описание RichText, Иконка IconPicker, Цвет ColorPicker, Связанные разделы multi-select)
- Buttons: "Создать" (primary green), "Отмена" (outline gray)
- Validation errors под полями (красный текст)

**Как тестировать:**
1. Создать страницу `app/test-create-checkpoint/page.tsx`:
```tsx
'use client'
import { CheckpointCreateModal } from '@/modules/checkpoints/components/CheckpointCreateModal'
import { useState } from 'react'

export default function TestPage() {
  const [isOpen, setIsOpen] = useState(true)

  return (
    <div className="p-8">
      <button onClick={() => setIsOpen(true)}>Create Checkpoint</button>
      <CheckpointCreateModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        sectionId="existing-section-uuid"
      />
    </div>
  )
}
```
2. Открыть `/test-create-checkpoint`
3. Проверить:
   - Center modal отображается
   - Overlay затемнён
   - Поле "Раздел" readonly, показывает section_name
   - Dropdown "Тип" загружает checkpoint_types
   - Кнопка "Создать новый тип" (проверить только для admin)
   - Input "Название" required (validation error если пустой)
   - DatePicker "Дата дедлайна" required
   - RichTextEditor "Описание" optional
   - IconPicker "Иконка" optional
   - ColorPicker "Цвет" optional
   - Multi-select "Связанные разделы" optional
   - Click "Создать" с пустыми required полями → validation errors
   - Click "Создать" с заполненными полями → checkpoint создаётся → modal закрывается → cache invalidation
   - Click "Отмена" → modal закрывается без создания
   - Click overlay → modal закрывается
4. Проверить на тёмной теме

**Проверка 🤖 Modal Architect:**
Form validation, Resource Graph styling, center modal layout.

---

### Этап 14: UI Components - CheckpointTypeManager (Admin)

**Описание:**
Создать компонент `CheckpointTypeManager.tsx` для админ-панели управления типами чекпоинтов.

**Затрагиваемые файлы:**
- `modules/checkpoints/components/CheckpointTypeManager.tsx` (новый)
- `app/admin/checkpoints/types/page.tsx` (новый, admin route)

**Зависимости:**
Этап 6 (useCheckpointTypes hooks), Этап 7 (types)

**Детали:**
- Admin permission guard: `useHasPermission('checkpoints.types.manage')` или role='admin'
- Table: type_code, name, icon preview, color preview, is_custom badge, actions (Edit, Delete)
- Create form: type (code), name, icon (IconPicker), color (ColorPicker)
- Edit modal: name, icon, color (только для is_custom=true)
- Delete: confirm dialog, проверка на использование в section_checkpoints
- Built-in types (is_custom=false): readonly, нельзя удалить/изменить

**Визуальные изменения:**
✅ **ДА** — admin page `/admin/checkpoints/types` с таблицей типов

**Ожидаемый вид:**
- Admin page layout
- Table: columns (type_code, name, icon preview, color preview, is_custom badge, actions)
- Button "Создать тип" (top-right)
- Row actions: Edit (только custom), Delete (только custom)
- Edit modal: center modal с формой
- Empty state: "Нет типов. Создайте первый тип."

**Как тестировать:**
1. Открыть `/admin/checkpoints/types` (как admin пользователь)
2. Проверить:
   - Permission guard: не-admin видит "Недостаточно прав"
   - Table загружает все типы
   - Built-in types (is_custom=false): badge "Встроенный", нет кнопок Edit/Delete
   - Custom types (is_custom=true): badge "Кастомный", кнопки Edit/Delete
   - Click "Создать тип" → modal с формой (type, name, icon, color)
   - Validation: type required (уникальный код), name required
   - Click "Создать" → type создаётся → таблица обновляется
   - Click Edit на custom type → modal с формой (name, icon, color editable)
   - Click Delete на custom type → confirm dialog
   - Если type используется в checkpoints → DELETE error → toast "Тип используется в чекпоинтах"
   - Если type не используется → DELETE success → таблица обновляется
3. Проверить icon preview: иконка отображается в таблице
4. Проверить color preview: цветной квадрат в таблице

**Проверка 🤖 Clean Code Guardian:**
Admin component structure, permission checks.

---

### Этап 15: Resource Graph Integration

**Описание:**
Интегрировать чекпоинты в Resource Graph Timeline — отображение CheckpointCard на timeline по checkpoint_date.

**Затрагиваемые файлы:**
- `modules/resource-graph/components/Timeline.tsx` (изменение, добавить слой checkpoints)
- `modules/resource-graph/hooks/use-timeline-data.ts` (изменение, загрузка checkpoints)

**Зависимости:**
Этап 5 (useCheckpoints hook), Этап 9 (CheckpointCard), Этап 12 (CheckpointDetailModal)

**Детали:**
- Загрузка чекпоинтов: `useCheckpoints({ projectId, dateFrom, dateTo })` (фильтр по видимому диапазону timeline)
- Рендер CheckpointCard поверх timeline rows (absolute positioning)
- Расчет position.left из checkpoint_date (mapping на px координаты timeline)
- Click handler: открытие CheckpointDetailModal
- Z-index: checkpoints выше timeline rows, ниже modals

**Визуальные изменения:**
✅ **ДА** — вертикальные маркеры чекпоинтов на Resource Graph Timeline

**Ожидаемый вид:**
- Вертикальные линии на timeline поверх sections rows
- Линии позиционированы по checkpoint_date
- Tooltip при hover
- Click → открывается CheckpointDetailModal

**Как тестировать:**
1. Создать checkpoint через Supabase Studio с checkpoint_date в диапазоне timeline
2. Открыть Resource Graph `/resource-graph` (или route где используется Timeline)
3. Проверить:
   - CheckpointCard отображается на timeline
   - Позиция left соответствует checkpoint_date (выравнивание с grid)
   - Hover → tooltip с title, date, status
   - Click → CheckpointDetailModal открывается
   - Z-index: checkpoint выше timeline rows, ниже modals
   - Множественные checkpoints на разных датах отображаются корректно
   - Scroll timeline → checkpoints позиционированы корректно (absolute positioning)
4. Проверить фильтрацию: изменить dateFrom/dateTo → checkpoints вне диапазона не загружаются
5. Проверить Realtime: создать checkpoint в БД → checkpoint появляется на timeline автоматически (cache invalidation)

**Проверка 🤖 Pragmatic Architect:**
Не усложняет Resource Graph, использует существующие timeline utilities (date-to-px mapping).

---

### Этап 16: Section Detail Modal Integration

**Описание:**
Добавить вкладку "Чекпоинты" в SectionModal.tsx для отображения списка чекпоинтов раздела.

**Затрагиваемые файлы:**
- `modules/modals/components/SectionModal.tsx` (изменение, добавить tab)
- `modules/checkpoints/components/CheckpointList.tsx` (новый, список чекпоинтов в Section modal)

**Зависимости:**
Этап 5 (useCheckpoints hook), Этап 8 (StatusBadge), Этап 12 (CheckpointDetailModal), Этап 13 (CheckpointCreateModal)

**Детали:**
- Tab "Чекпоинты" в SectionModal (после существующих tabs)
- CheckpointList: `useCheckpoints({ sectionId })` → список чекпоинтов
- Item: title, checkpoint_date, StatusBadge, click → открыть CheckpointDetailModal
- Button "Создать чекпоинт" → открыть CheckpointCreateModal с pre-filled sectionId
- Empty state: "Нет чекпоинтов. Создайте первый чекпоинт."

**Визуальные изменения:**
✅ **ДА** — новая вкладка "Чекпоинты" в SectionModal

**Ожидаемый вид:**
- Tab "Чекпоинты" после существующих tabs (Основное, Загрузки, и т.д.)
- Список чекпоинтов: title, checkpoint_date, StatusBadge, click → modal
- Button "Создать чекпоинт" (top-right в tab)
- Empty state: серый текст + кнопка "Создать первый чекпоинт"

**Как тестировать:**
1. Открыть SectionModal (клик на раздел в Resource Graph или другом месте)
2. Проверить:
   - Tab "Чекпоинты" отображается
   - Click tab → переключается на CheckpointList
   - Список загружает checkpoints для текущего sectionId
   - Item: title, checkpoint_date (format dd.MM.yyyy), StatusBadge
   - Click item → CheckpointDetailModal открывается с checkpointId
   - Button "Создать чекпоинт" → CheckpointCreateModal с pre-filled sectionId
   - Empty state: "Нет чекпоинтов. Создайте первый чекпоинт." + кнопка
   - Permission guard: кнопка "Создать" видна только с правами
   - Realtime: создать checkpoint в другой вкладке → список обновляется автоматически
3. Проверить интеграцию с другими tabs (переключение корректно)
4. Проверить на разных sections (с checkpoints и без)

**Проверка 🤖 Modal Architect:**
Tab layout соответствует SectionModal design, кнопка создания доступна только с правами.

---

### Этап 17: Module Public API

**Описание:**
Создать публичный API модуля checkpoints через `index.ts` (экспорт hooks, components, types).

**Затрагиваемые файлы:**
- `modules/checkpoints/index.ts` (новый)

**Зависимости:**
Все предыдущие этапы (hooks, components, types готовы)

**Детали:**
- Export hooks: `useCheckpoints`, `useCheckpoint`, `useCheckpointAudit`, `useCreateCheckpoint`, `useUpdateCheckpoint`, `useCompleteCheckpoint`, `useDeleteCheckpoint`, `useCheckpointTypes`, `useCreateCheckpointType`, `useUpdateCheckpointType`, `useDeleteCheckpointType`
- Export components: `CheckpointCard`, `CheckpointDetailModal`, `CheckpointCreateModal`, `CheckpointList`, `AuditTimeline`, `LinkedSectionsList`, `StatusBadge`, `CheckpointTypeManager`
- Export types: `Checkpoint`, `CheckpointType`, `AuditEntry`, `CheckpointFilters`

**Визуальные изменения:**
❌ Нет визуальных изменений (public API only)

**Как тестировать:**
1. Создать тестовый файл `test-public-api.ts`:
```typescript
// Проверка экспорта hooks
import {
  useCheckpoints,
  useCheckpoint,
  useCheckpointAudit,
  useCreateCheckpoint,
  useUpdateCheckpoint,
  useCompleteCheckpoint,
  useDeleteCheckpoint,
  useCheckpointTypes,
  useCreateCheckpointType,
  useUpdateCheckpointType,
  useDeleteCheckpointType,
} from '@/modules/checkpoints'

// Проверка экспорта components
import {
  CheckpointCard,
  CheckpointDetailModal,
  CheckpointCreateModal,
  CheckpointList,
  AuditTimeline,
  LinkedSectionsList,
  StatusBadge,
  CheckpointTypeManager,
} from '@/modules/checkpoints'

// Проверка экспорта types
import type {
  Checkpoint,
  CheckpointType,
  AuditEntry,
  CheckpointFilters,
} from '@/modules/checkpoints'
```
2. Проверить `npm run build` — нет ошибок TypeScript
3. Проверить autocomplete: `import { useCheck... }` → должны появиться все hooks
4. Проверить, что все экспорты корректны (нет `undefined`)

**Проверка 🤖 Clean Code Guardian:**
Чистый public API, re-exports.

---

### Этап 18: Seed Data (Built-in Checkpoint Types)

**Описание:**
Добавить встроенные типы чекпоинтов в миграцию или seed script (task_transfer, exam, submission, review, approval).

**Затрагиваемые файлы:**
- `supabase/migrations/YYYYMMDDHHMMSS_create_checkpoints_system.sql` (изменение, добавить INSERT в конец)

**Зависимости:**
Этап 1 (миграция создана)

**Детали:**
- INSERT INTO checkpoint_types:
  - `{ type: 'task_transfer', name: 'Передача задачи', icon: 'arrow-right-left', color: '#3b82f6', is_custom: false }`
  - `{ type: 'exam', name: 'Экспертиза', icon: 'check-circle', color: '#10b981', is_custom: false }`
  - `{ type: 'submission', name: 'Сдача', icon: 'upload', color: '#f59e0b', is_custom: false }`
  - `{ type: 'review', name: 'Проверка', icon: 'eye', color: '#8b5cf6', is_custom: false }`
  - `{ type: 'approval', name: 'Утверждение', icon: 'check-square', color: '#06b6d4', is_custom: false }`

**Визуальные изменения:**
✅ **ДА** — встроенные типы отображаются в dropdown при создании checkpoint

**Ожидаемый вид:**
- Dropdown "Тип" в CheckpointCreateModal показывает 5 встроенных типов
- Admin page `/admin/checkpoints/types` показывает 5 встроенных типов с badge "Встроенный"

**Как тестировать:**
1. Применить миграцию (если ещё не применена): `supabase migration up`
2. Проверить в БД: `SELECT * FROM checkpoint_types;` → должно быть 5 записей
3. Открыть CheckpointCreateModal
4. Проверить:
   - Dropdown "Тип" загружает 5 встроенных типов
   - Каждый тип имеет: name, icon preview, color preview
   - is_custom = false для всех
5. Открыть `/admin/checkpoints/types`
6. Проверить:
   - Таблица показывает 5 встроенных типов
   - Badge "Встроенный" у всех
   - Нет кнопок Edit/Delete у встроенных типов
7. Создать checkpoint с типом "Экспертиза" → проверить, что icon и color применяются из типа

**Проверка 🤖 DB Architect:**
Seed data в миграции корректен.

---

## Зависимости между этапами

```
Этап 1 (DB)
  ↓
Этап 2 (Cache Keys + Realtime)
  ↓
Этап 3 (Server Actions: Checkpoints) ← зависит от Этап 1, Этап 2
Этап 4 (Server Actions: Types) ← зависит от Этап 1
  ↓
Этап 5 (Hooks: Checkpoints) ← зависит от Этап 2, Этап 3
Этап 6 (Hooks: Types) ← зависит от Этап 2, Этап 4
  ↓
Этап 7 (TypeScript Types) ← зависит от Этап 1
  ↓
Этап 8 (StatusBadge) ← зависит от Этап 7
Этап 9 (CheckpointCard) ← зависит от Этап 7, Этап 8
Этап 10 (AuditTimeline) ← зависит от Этап 5, Этап 7
Этап 11 (LinkedSectionsList) ← зависит от Этап 5, Этап 7
  ↓
Этап 12 (CheckpointDetailModal) ← зависит от Этап 5, Этап 7, Этапы 8-11
Этап 13 (CheckpointCreateModal) ← зависит от Этап 5, Этап 6, Этап 7
Этап 14 (CheckpointTypeManager) ← зависит от Этап 6, Этап 7
  ↓
Этап 15 (Resource Graph Integration) ← зависит от Этап 5, Этап 9, Этап 12
Этап 16 (Section Modal Integration) ← зависит от Этап 5, Этап 8, Этап 12, Этап 13
  ↓
Этап 17 (Public API) ← зависит от все предыдущие этапы
Этап 18 (Seed Data) ← зависит от Этап 1
```

---

## Риски и edge-cases

1. **FIFO Audit Cleanup:** Приложение должно удалять старые audit entries (> 50 на checkpoint). Реализовать в `createCheckpoint`, `updateCheckpoint`, `completeCheckpoint` после INSERT audit.

2. **Permission Context в VIEW:** `view_section_checkpoints` использует LEFT JOIN на sections → projects для получения section_responsible, project_manager. Проверить, что VIEW корректно работает при отсутствии section/project (хотя FK RESTRICT это предотвращает).

3. **Linked Sections M:N:** При удалении section CASCADE удаляет записи из checkpoint_section_links. Убедиться, что UI корректно обрабатывает пустой linked_sections array.

4. **Realtime Invalidation:** При изменении checkpoint_types (name, icon, color) нужно инвалидировать `checkpoints.all`, т.к. VIEW использует LEFT JOIN на checkpoint_types для resolved icon/color.

5. **Optimistic Updates:** `useCompleteCheckpoint` оптимистично обновляет `completed_at`, но `status` computed в VIEW. После refetch статус может измениться (напр. completed → completed_late если дедлайн прошел). UI должен корректно отображать loading state.

6. **Timeline Position Calculation:** CheckpointCard position.left зависит от date-to-px mapping в Resource Graph. Убедиться, что чекпоинты корректно выравниваются с timeline grid.

7. **Admin Type Management:** При удалении custom type проверять, что ни один checkpoint не использует этот type (FK RESTRICT предотвращает DELETE, но UI должен показать понятную ошибку).

8. **Rich Text XSS:** `description` field — HTML. Убедиться, что RichTextEditor санитизирует HTML (TipTap по умолчанию безопасен, но проверить конфигурацию).

---

**План готов к реализации. Переходим к Фазе 2.1 (планирование первого этапа)?**
