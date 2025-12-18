# Checkpoints System - План реализации

## Цель

Реализовать систему Checkpoints — управление дедлайнами и ключевыми событиями разделов с визуализацией на Resource Graph Timeline, поддержкой кастомных типов чекпоинтов, связанными разделами (M:N), audit trail историей изменений и интеграцией с модулем Cache.

---

## Система разрешений (Permissions)

### Подход: Минимальные разрешения + динамическая проверка контекста

**Разрешения в БД (только для admin):**
- `checkpoints.manage.all` — управление всеми чекпоинтами в системе
- `checkpoints.types.manage` — управление справочником типов чекпоинтов

**Динамическая проверка контекста (для остальных ролей):**
Пользователь может управлять чекпоинтами раздела, если:
1. Он ответственный за раздел (`section.responsible_id === user.id`)
2. Он менеджер проекта (`project.manager_id === user.id`)
3. Ответственный из его отдела (`user.role === 'department_head'` && `responsible.department_id === user.department_id`)
4. Ответственный из его команды (`user.role === 'team_lead'` && `responsible.team_lead_id === user.id`)

**Матрица доступа:**
| Роль | Свои разделы | Разделы подчиненных | Разделы проекта | Все чекпоинты |
|------|--------------|---------------------|-----------------|---------------|
| admin | ✅ | ✅ | ✅ | ✅ |
| department_head | ✅ | ✅ (отдел) | ❌ | ❌ |
| project_manager | ✅ | ❌ | ✅ | ❌ |
| team_lead | ✅ | ✅ (команда) | ❌ | ❌ |
| user | ✅ | ❌ | ❌ | ❌ |

**Реализация:** Вся логика проверки находится в функции `canManageCheckpoint()` в Server Actions.

---

## Логика типов чекпоинтов (Checkpoint Types)

### Концепция

**В таблице `checkpoint_types` хранятся N предустановленных типов + 1 специальный тип `custom`:**

| Тип | Пример | `is_custom` | Описание |
|-----|--------|-------------|----------|
| Предустановленные | `exam`, `task_transfer`, `milestone` | `false` | Типы с фиксированными `name`, `icon`, `color` |
| Custom (шаблон) | `custom` | `true` | Пустой тип для произвольных чекпоинтов |

### Поведение при создании чекпоинта

**Поле `title` в `section_checkpoints`:**

1. **Для предустановленных типов** (`is_custom=false`):
   - Пользователь **может** ввести своё название
   - Если оставит пустым → берётся `checkpoint_types.name` (автоподстановка в Server Action)

2. **Для типа `custom`** (`is_custom=true`):
   - Пользователь **обязан** ввести название
   - Валидация на уровне UI + Server Action

### Права на управление типами

**Admin (`checkpoints.types.manage`):**
- Создавать новые типы (автоматически `is_custom=true`)
- Редактировать **любые** типы (встроенные и custom)
- Удалять **любые** типы (если FK constraint позволяет — тип не используется в чекпоинтах)

**Остальные роли:**
- **Только выбирают** тип из справочника при создании чекпоинта
- Видят все типы в SELECT dropdown (встроенные + custom)

---

## Критерии готовности (Definition of Done)

### 1. База данных
- [ ] Миграция создана: 4 таблицы (`checkpoint_types`, `section_checkpoints`, `checkpoint_section_links`, `checkpoint_audit`)
- [ ] VIEW `view_section_checkpoints` с computed status, linked sections, permission context
- [ ] Все индексы (uncompleted, completed, audit, custom types)
- [ ] Таблицы добавлены в Realtime publication (`ALTER PUBLICATION supabase_realtime ADD TABLE ...`)
- [ ] Permissions добавлены: `checkpoints.manage.all`, `checkpoints.types.manage` (только для admin)
- [ ] `npm run db:types` выполнен, типы обновлены

### 2. Server Actions (`modules/checkpoints/actions/`)
- [ ] `checkpoints.ts`: `getCheckpoints`, `getCheckpoint`, `createCheckpoint`, `updateCheckpoint`, `completeCheckpoint`, `deleteCheckpoint`, `getCheckpointAudit`, `canManageCheckpoint` helper
- [ ] `checkpoint-types.ts`: `getCheckpointTypes`, `createCheckpointType`, `updateCheckpointType`, `deleteCheckpointType`
- [ ] Audit trail: CREATE/UPDATE/DELETE/COMPLETE/UNCOMPLETE записи в `checkpoint_audit`
- [ ] FIFO audit cleanup (max 50 записей) в application layer
- [ ] Permission checks: `checkpoints.manage.all` (admin) ИЛИ динамическая проверка контекста (responsible_id, manager_id, department, team)

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
- `supabase/migrations/2025-12-17_section_checkpoints_integration.sql` (✅ уже есть)
- `supabase/migrations/2025-12-18_section_checkpoints_status_audit.sql` (✅ уже есть)
- `supabase/migrations/YYYYMMDDHHMMSS_checkpoints_additions.sql` (новый — доработки)
- `types/db.ts` (обновится после `npm run db:types`)

**Зависимости:**
Нет (независимый этап)

**Текущий статус:** ✅ ЗАВЕРШЁН

---

#### Шаг 1.1: Основные таблицы (✅ ГОТОВО)

Уже реализовано в существующих миграциях:
- ✅ `checkpoint_types` — таблица типов чекпоинтов
- ✅ `section_checkpoints` — основная таблица с `completed_at`, `completed_by`, `updated_at`
- ✅ `checkpoint_section_links` — M:N связь с разделами
- ✅ `checkpoint_audit` — audit trail таблица
- ✅ `view_section_checkpoints` — VIEW с computed status, permission context, linked sections
- ✅ Индексы: `idx_section_checkpoints_uncompleted`, `idx_section_checkpoints_completed`, `idx_checkpoint_audit_*`

---

#### Шаг 1.2: Добавить `created_by` в `checkpoint_types` (✅ ГОТОВО)

**Зачем:** Для отслеживания кто создал кастомный тип + permission checks.

**SQL миграция:**
```sql
-- Добавить колонку created_by в checkpoint_types
ALTER TABLE public.checkpoint_types
  ADD COLUMN IF NOT EXISTS created_by uuid;

ALTER TABLE public.checkpoint_types
  ADD CONSTRAINT checkpoint_types_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(user_id) ON DELETE SET NULL;

COMMENT ON COLUMN public.checkpoint_types.created_by IS 'User who created custom checkpoint type (NULL for built-in types)';

-- Индекс для FK lookup
CREATE INDEX IF NOT EXISTS idx_checkpoint_types_created_by
  ON public.checkpoint_types(created_by)
  WHERE created_by IS NOT NULL;
```

**Как тестировать:**
```sql
-- Проверить колонку добавлена
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'checkpoint_types' AND column_name = 'created_by';
-- Ожидаемый результат: created_by | uuid | YES
```

---

#### Шаг 1.3: Добавить таблицы в Realtime publication (✅ ГОТОВО)

**Зачем:** Чтобы cache module получал события об изменениях и инвалидировал query keys.

**SQL миграция:**
```sql
-- Добавить таблицы в Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.checkpoint_types;
ALTER PUBLICATION supabase_realtime ADD TABLE public.section_checkpoints;
ALTER PUBLICATION supabase_realtime ADD TABLE public.checkpoint_section_links;
ALTER PUBLICATION supabase_realtime ADD TABLE public.checkpoint_audit;
```

**Как тестировать:**
```sql
-- Проверить таблицы в publication
SELECT tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename IN ('checkpoint_types', 'section_checkpoints', 'checkpoint_section_links', 'checkpoint_audit');
-- Ожидаемый результат: 4 строки
```

---

#### Шаг 1.4: Обновить TypeScript типы (✅ ГОТОВО)

**Зачем:** Без актуальных типов в `types/db.ts` Server Actions и hooks не скомпилируются.

**Команда:**
```bash
npm run db:types
```

**Как тестировать:**
1. Открыть `types/db.ts`
2. Проверить наличие типов:
   - `checkpoint_types` в `Tables`
   - `section_checkpoints` в `Tables`
   - `checkpoint_section_links` в `Tables`
   - `checkpoint_audit` в `Tables`
   - `view_section_checkpoints` в `Views`
3. Проверить `npm run build` — нет ошибок TypeScript

---

**Визуальные изменения:**
❌ Нет визуальных изменений (backend only)

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

**Текущий статус:** ✅ ЗАВЕРШЁН

---

#### Шаг 2.1: Добавить CheckpointFilters interface

**Зачем:**
- Типизация параметров фильтрации для `useCheckpoints(filters)` hook
- Без этого интерфейса hooks не смогут принимать типизированные фильтры
- Позволяет фильтровать чекпоинты по: секции, проекту, статусу, диапазону дат
- Используется в `queryKeys.checkpoints.list(filters)` для создания уникальных cache keys

**Файл:** `modules/cache/keys/query-keys.ts`

**Что добавить (после `BudgetFilters`):**
```typescript
export interface CheckpointFilters extends BaseFilters {
  sectionId?: string    // Фильтр по разделу (родительский ИЛИ связанный)
  projectId?: string
  status?: 'pending' | 'completed' | 'completed_late' | 'overdue'
  dateFrom?: string
  dateTo?: string
}
```

**Важно о `sectionId`:**
При фильтрации по `sectionId` возвращаются чекпоинты, у которых:
1. Этот раздел является **родительским** (`section_checkpoints.section_id = sectionId`)
2. **ИЛИ** этот раздел является **связанным** (через `checkpoint_section_links`)

Это позволяет при выборе раздела видеть все релевантные чекпоинты.

**Как тестировать:**
```typescript
// В любом файле должен работать импорт
import type { CheckpointFilters } from '@/modules/cache/keys/query-keys'

const filters: CheckpointFilters = {
  sectionId: 'test',
  status: 'pending',
  dateFrom: '2025-01-01',
}
```

---

#### Шаг 2.2: Добавить Query Keys для Checkpoints

**Зачем:**
- Query keys — основа TanStack Query кеширования. Без них невозможно создать hooks
- `checkpoints.all` — базовый ключ для инвалидации всех checkpoint-кешей разом
- `checkpoints.list(filters)` — уникальный ключ для каждой комбинации фильтров (разные фильтры = разные кеши)
- `checkpoints.detail(id)` — кеш отдельного чекпоинта для `useCheckpoint(id)` hook
- `checkpoints.audit(id)` — отдельный кеш для audit history (может загружаться lazy)
- `checkpointTypes.*` — справочник типов, редко меняется, кешируется отдельно

**Файл:** `modules/cache/keys/query-keys.ts`

**Что добавить в `queryKeys` объект (после `budgetTags`):**
```typescript
// -------------------------------------------------------------------------
// Checkpoints (чекпоинты/дедлайны)
// -------------------------------------------------------------------------
checkpoints: {
  all: ['checkpoints'] as const,
  lists: () => [...queryKeys.checkpoints.all, 'list'] as const,
  list: (filters?: CheckpointFilters) => [...queryKeys.checkpoints.lists(), filters] as const,
  details: () => [...queryKeys.checkpoints.all, 'detail'] as const,
  detail: (id: string) => [...queryKeys.checkpoints.details(), id] as const,
  audit: (id: string) => [...queryKeys.checkpoints.all, 'audit', id] as const,
  bySection: (sectionId: string) => [...queryKeys.checkpoints.lists(), { sectionId }] as const,
  byProject: (projectId: string) => [...queryKeys.checkpoints.lists(), { projectId }] as const,
},

// -------------------------------------------------------------------------
// Checkpoint Types (типы чекпоинтов)
// -------------------------------------------------------------------------
checkpointTypes: {
  all: ['checkpoint-types'] as const,
  list: () => [...queryKeys.checkpointTypes.all, 'list'] as const,
  details: () => [...queryKeys.checkpointTypes.all, 'detail'] as const,
  detail: (id: string) => [...queryKeys.checkpointTypes.details(), id] as const,
},
```

**Как тестировать:**
```typescript
import { queryKeys } from '@/modules/cache/keys/query-keys'

// Все ключи должны быть типизированы
console.log(queryKeys.checkpoints.all)          // ['checkpoints']
console.log(queryKeys.checkpoints.list())       // ['checkpoints', 'list', undefined]
console.log(queryKeys.checkpoints.detail('x'))  // ['checkpoints', 'detail', 'x']
console.log(queryKeys.checkpoints.audit('x'))   // ['checkpoints', 'audit', 'x']
console.log(queryKeys.checkpointTypes.list())   // ['checkpoint-types', 'list']
```

---

#### Шаг 2.3: Добавить Realtime Subscriptions

**Зачем:**
- Автоматическая инвалидация кеша при изменениях в БД (без ручного refetch)
- Когда другой пользователь создаёт/редактирует чекпоинт — UI обновляется автоматически
- Без Realtime subscriptions данные будут stale до истечения staleTime или ручного refetch
- Критично для Resource Graph Timeline — чекпоинты должны появляться в реальном времени
- Связанные кеши (`sections.all`, `resourceGraph.all`) тоже инвалидируются, т.к. зависят от checkpoints

**Файл:** `modules/cache/realtime/config.ts`

**Что добавить в `realtimeSubscriptions` массив (после notifications):**
```typescript
// ============================================================================
// Checkpoints (чекпоинты/дедлайны разделов)
// ============================================================================
{
  table: 'section_checkpoints',
  invalidateKeys: [
    queryKeys.checkpoints.all,
    queryKeys.sections.all,        // Секции зависят от checkpoints
    queryKeys.resourceGraph.all,   // Timeline зависит от checkpoints
  ],
},
{
  table: 'checkpoint_section_links',
  invalidateKeys: [
    queryKeys.checkpoints.all,     // linked_sections меняется
  ],
},
{
  table: 'checkpoint_audit',
  events: ['INSERT'],              // Audit только создаётся, не редактируется
  invalidateKeys: [
    queryKeys.checkpoints.all,     // Audit history обновляется
  ],
},
{
  table: 'checkpoint_types',
  invalidateKeys: [
    queryKeys.checkpointTypes.all,
    queryKeys.checkpoints.all,     // Checkpoints зависят от types (icon, color в VIEW)
  ],
},
```

**Почему такая инвалидация:**
- `section_checkpoints` → инвалидирует `checkpoints.all` + `sections.all` + `resourceGraph.all` (чекпоинты отображаются на timeline и в секциях)
- `checkpoint_section_links` → инвалидирует только `checkpoints.all` (linked_sections — computed field в VIEW)
- `checkpoint_audit` → только INSERT, инвалидирует `checkpoints.all` (audit history)
- `checkpoint_types` → инвалидирует `checkpointTypes.all` + `checkpoints.all` (VIEW делает LEFT JOIN для resolved icon/color)

**Как тестировать:**
1. Запустить `npm run dev`
2. Открыть приложение в браузере
3. Открыть DevTools → Console
4. В Supabase Studio выполнить:
```sql
INSERT INTO checkpoint_types (type, name, icon, color, is_custom)
VALUES ('test_realtime', 'Test Realtime', 'star', '#ff0000', true);
```
5. В консоли браузера должен появиться лог о Realtime event
6. Удалить тестовую запись:
```sql
DELETE FROM checkpoint_types WHERE type = 'test_realtime';
```

---

#### Шаг 2.4: Экспортировать CheckpointFilters из cache module

**Зачем:**
- Единая точка импорта для типов из cache module: `import { CheckpointFilters } from '@/modules/cache'`
- Без экспорта придётся импортировать напрямую из `@/modules/cache/keys/query-keys` — нарушение инкапсуляции
- Соответствует паттерну других фильтров (`UserFilters`, `ProjectFilters` и т.д.)
- Используется в `modules/checkpoints/hooks/` при создании типизированных hooks

**Файл:** `modules/cache/index.ts`

**Что добавить (если не экспортируется автоматически):**
```typescript
export type { CheckpointFilters } from './keys/query-keys'
```

**Как тестировать:**
```typescript
import type { CheckpointFilters } from '@/modules/cache'

const filters: CheckpointFilters = { sectionId: 'test' }
```

---

**Итоговый чек-лист Этапа 2:**
- [x] `CheckpointFilters` interface добавлен
- [x] Query keys `checkpoints.*` добавлены
- [x] Query keys `checkpointTypes.*` добавлены
- [x] Realtime subscription для `section_checkpoints` добавлена
- [x] Realtime subscription для `checkpoint_section_links` добавлена
- [x] Realtime subscription для `checkpoint_audit` добавлена
- [x] Realtime subscription для `checkpoint_types` добавлена
- [x] `npm run build` проходит без ошибок

**Визуальные изменения:**
❌ Нет визуальных изменений (cache configuration only)

**Проверка 🤖 Pragmatic Architect:** ✅ Approved
- Query keys следуют существующим паттернам (`all/lists/list/details/detail`)
- Realtime subscriptions минимально необходимые (4 таблицы)
- Нет over-engineering, дублирования или лишней сложности

---

### Этап 3: Server Actions (Checkpoints CRUD)

**Описание:**
Реализовать Server Actions для CRUD операций с чекпоинтами: `getCheckpoints`, `getCheckpoint`, `createCheckpoint`, `updateCheckpoint`, `completeCheckpoint`, `deleteCheckpoint`, `getCheckpointAudit`, `canManageCheckpoint`.

**Затрагиваемые файлы:**
- `modules/checkpoints/actions/checkpoints.ts` (новый)
- `modules/checkpoints/actions/checkpoint-types.ts` (новый)
- `modules/checkpoints/actions/index.ts` (новый)
- `supabase/migrations/2025-12-18_checkpoints_permissions.sql` (новый)

**Зависимости:**
Этап 1 (база данных), Этап 2 (query keys для типов в ActionResult)

**Текущий статус:** ✅ ЗАВЕРШЕН

**Результаты:**
- ✅ `checkpoints.ts` - все CRUD операции для чекпоинтов
- ✅ `checkpoint-types.ts` - все CRUD операции для типов чекпоинтов
- ✅ Permission checks через `canManageCheckpoint` helper
- ✅ Audit trail для всех мутаций с FIFO cleanup (max 50 записей)
- ✅ Sentry spans для мониторинга производительности
- ✅ Импорт `ActionResult` из `@/modules/cache/types`
- ✅ Permissions миграция: `checkpoints.manage.all`, `checkpoints.types.manage`
- ✅ Cache Guardian: PASS (код одобрен)

**Дата завершения:** 2025-12-18

---

#### Шаг 3.1: Создать структуру файла и базовые типы

**Зачем:**
- Server Actions должны быть помечены директивой `'use server'` для работы в Next.js App Router
- `ActionResult<T>` — стандартный паттерн для type-safe возврата результатов (success/error)
- Input типы обеспечивают валидацию на уровне TypeScript при вызове actions
- Без правильной структуры файла actions не будут доступны из клиентских компонентов

**Файл:** `modules/checkpoints/actions/checkpoints.ts`

**Что добавить:**
```typescript
'use server'

import { createClient } from '@/utils/supabase/server'
import type { CheckpointFilters } from '@/modules/cache/keys/query-keys'

// ============================================================================
// Types
// ============================================================================

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }

/** Input для создания чекпоинта */
export interface CreateCheckpointInput {
  sectionId: string
  typeId: string
  title: string // Название чекпоинта. Логика:
                // - Для предустановленных типов: опционально (если пусто — берется checkpoint_types.name)
                // - Для типа 'custom': обязательно (UI должна валидировать)
  checkpointDate: string // ISO date 'YYYY-MM-DD'
  description?: string | null
  customIcon?: string | null
  customColor?: string | null
  linkedSectionIds?: string[] // Дополнительные связанные разделы
}

/** Input для обновления чекпоинта */
export interface UpdateCheckpointInput {
  checkpointId: string
  title?: string
  description?: string | null
  checkpointDate?: string
  customIcon?: string | null
  customColor?: string | null
  linkedSectionIds?: string[] // Полный список связанных разделов
}

/** Input для отметки выполнения */
export interface CompleteCheckpointInput {
  checkpointId: string
  completed: boolean // true = выполнено, false = снять отметку
}

/** Тип чекпоинта из VIEW */
export interface Checkpoint {
  checkpoint_id: string
  section_id: string
  type_id: string
  type_code: string
  type_name: string
  is_custom: boolean
  title: string
  description: string | null
  checkpoint_date: string
  icon: string
  color: string
  completed_at: string | null
  completed_by: string | null
  status: 'pending' | 'completed' | 'completed_late' | 'overdue'
  status_label: string
  created_by: string | null
  created_at: string
  updated_at: string
  section_responsible: string | null
  project_manager: string | null
  linked_sections: Array<{ section_id: string; section_name: string }>
  linked_sections_count: number
}

/** Запись audit trail */
export interface AuditEntry {
  audit_id: string
  checkpoint_id: string
  changed_by: string | null
  changed_at: string
  operation_type: 'CREATE' | 'UPDATE' | 'DELETE' | 'COMPLETE' | 'UNCOMPLETE'
  field_name: string
  old_value: string | null
  new_value: string | null
  // Joined fields from profiles
  user_firstname?: string | null
  user_lastname?: string | null
  user_avatar_url?: string | null
}
```

**Как тестировать:**
```bash
# 1. Проверить что файл создан
ls modules/checkpoints/actions/checkpoints.ts

# 2. Проверить TypeScript компиляцию
npx tsc --noEmit

# 3. Проверить что типы экспортируются
# В любом файле добавить:
import type { Checkpoint, CreateCheckpointInput } from '@/modules/checkpoints/actions/checkpoints'
```

---

#### Шаг 3.2: Миграция permissions для чекпоинтов

**Зачем:**
- Без permissions в БД невозможно использовать `PermissionGuard` и `useHasPermission`
- RLS **отключён** для таблиц чекпоинтов (публичный доступ), permissions нужны только для мутаций на уровне application

**Permissions:**
| Permission | Описание | Кому назначать |
|------------|----------|----------------|
| `checkpoints.manage.all` | CRUD чекпоинтов на **всех** проектах | admin |
| `checkpoints.types.manage` | Управление справочником типов чекпоинтов | admin |

**Логика проверки в `canManageCheckpoint` (динамическая проверка контекста):**
1. Если есть `checkpoints.manage.all` → разрешено (admin)
2. Иначе проверяем контекст раздела:
   - **Я ответственный за раздел** (`section.responsible_id === user.id`) → разрешено
   - **Я менеджер проекта** (`project.manager_id === user.id`) → разрешено
   - **Ответственный из моего отдела** (`user.role === 'department_head'` && `responsible.department_id === user.department_id`) → разрешено
   - **Ответственный из моей команды** (`user.role === 'team_lead'` && `responsible.team_lead_id === user.id`) → разрешено
3. Иначе → запрещено

**Матрица доступа по ролям:**
| Роль | Чекпоинты на своих разделах | Чекпоинты подчиненных | Чекпоинты проекта | Все чекпоинты |
|------|----------------------------|----------------------|-------------------|---------------|
| **admin** | ✅ | ✅ | ✅ | ✅ |
| **department_head** | ✅ | ✅ (если ответственный из его отдела) | ❌ | ❌ |
| **project_manager** | ✅ | ❌ | ✅ (если он менеджер проекта) | ❌ |
| **team_lead** | ✅ | ✅ (если ответственный из его команды) | ❌ | ❌ |
| **user** | ✅ | ❌ | ❌ | ❌ |

**Файл:** `supabase/migrations/2025-12-18_checkpoints_permissions.sql`

**SQL миграция:**
```sql
-- ============================================================================
-- Миграция: Добавление permissions для модуля Checkpoints
-- ============================================================================

-- 1. Добавить permissions для чекпоинтов
INSERT INTO public.permissions (name, description)
VALUES
  ('checkpoints.manage.all', 'CRUD чекпоинтов на всех проектах (только admin)'),
  ('checkpoints.types.manage', 'Управление справочником типов чекпоинтов (только admin)')
ON CONFLICT (name) DO NOTHING;

-- 2. Назначить permissions только роли admin
-- Остальные роли (department_head, project_manager, team_lead, user)
-- управляют чекпоинтами через динамическую проверку контекста в canManageCheckpoint()
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.role_name = 'admin'
  AND p.name IN ('checkpoints.manage.all', 'checkpoints.types.manage')
ON CONFLICT DO NOTHING;
```

**Как тестировать:**
```sql
-- 1. Проверить permissions добавлены
SELECT name, description FROM permissions WHERE name LIKE 'checkpoints.%';
-- Ожидаемый результат: 2 строки
-- checkpoints.manage.all | CRUD чекпоинтов на всех проектах (только admin)
-- checkpoints.types.manage | Управление справочником типов чекпоинтов (только admin)

-- 2. Проверить permissions назначены только роли admin
SELECT r.role_name, p.name
FROM role_permissions rp
JOIN roles r ON r.id = rp.role_id
JOIN permissions p ON p.id = rp.permission_id
WHERE p.name LIKE 'checkpoints.%'
ORDER BY r.role_name, p.name;
-- Ожидаемый результат:
-- admin | checkpoints.manage.all
-- admin | checkpoints.types.manage
```

**После применения миграции:**
```bash
# Обновить TypeScript типы (если permissions используются в типах)
npm run db:types
```

---

#### Шаг 3.3: Реализовать `canManageCheckpoint` helper

**Зачем:**
- Централизованная проверка прав доступа перед любой мутацией (create/update/delete/complete)
- Использует `getUserPermissions` из `@/modules/permissions/supabase/supabasePermissions` (консистентно с остальным приложением)
- Логика проверки:
  1. `checkpoints.manage.all` → разрешено (admin)
  2. Динамическая проверка контекста:
     - Я ответственный за раздел
     - Я менеджер проекта
     - Ответственный из моего отдела (department_head)
     - Ответственный из моей команды (team_lead)
  3. Иначе → запрещено
- Возвращает `{ canManage: boolean; userId: string }` для использования в audit trail

**Что добавить (после типов):**
```typescript
import { getUserPermissions } from '@/modules/permissions/supabase/supabasePermissions'

// ============================================================================
// Permission Helper
// ============================================================================

/**
 * Проверить, может ли текущий пользователь управлять чекпоинтом раздела
 *
 * Логика:
 * 1. checkpoints.manage.all → разрешено (admin)
 * 2. Динамическая проверка контекста:
 *    - Я ответственный за раздел
 *    - Я менеджер проекта
 *    - Ответственный из моего отдела (department_head)
 *    - Ответственный из моей команды (team_lead)
 * 3. Иначе → запрещено
 */
async function canManageCheckpoint(
  sectionId: string
): Promise<{ canManage: boolean; userId: string | null; error?: string }> {
  try {
    const supabase = await createClient()

    // 1. Получить текущего пользователя
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { canManage: false, userId: null, error: 'Пользователь не авторизован' }
    }

    // 2. Получить permissions через getUserPermissions (консистентно с остальным приложением)
    const { permissions } = await getUserPermissions(user.id)

    // 3. Проверить checkpoints.manage.all — полный доступ (admin)
    if (permissions.includes('checkpoints.manage.all')) {
      return { canManage: true, userId: user.id }
    }

    // 4. Динамическая проверка контекста раздела
    // Получаем информацию о разделе, проекте, ответственном
    const { data: section, error: sectionError } = await supabase
      .from('sections')
      .select(`
        responsible_id,
        project_id,
        responsible:profiles!responsible_id(
          id,
          department_id,
          team_lead_id
        ),
        project:projects!project_id(
          manager_id
        )
      `)
      .eq('id', sectionId)
      .single()

    if (sectionError || !section) {
      return { canManage: false, userId: user.id, error: 'Раздел не найден' }
    }

    // 5. Получаем профиль текущего пользователя для проверки роли
    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('role_id, department_id, roles!inner(name)')
      .eq('id', user.id)
      .single()

    if (profileError || !userProfile) {
      return { canManage: false, userId: user.id, error: 'Профиль пользователя не найден' }
    }

    const userRole = (userProfile.roles as unknown as { name: string }).name

    // 6. Проверяем контекст
    const responsibleData = section.responsible as unknown as {
      id: string
      department_id: string | null
      team_lead_id: string | null
    } | null
    const projectData = section.project as unknown as { manager_id: string | null } | null

    // Я ответственный за раздел
    if (section.responsible_id === user.id) {
      return { canManage: true, userId: user.id }
    }

    // Я менеджер проекта
    if (projectData?.manager_id === user.id) {
      return { canManage: true, userId: user.id }
    }

    // Ответственный из моего отдела (department_head)
    if (userRole === 'department_head' &&
        responsibleData?.department_id === userProfile.department_id) {
      return { canManage: true, userId: user.id }
    }

    // Ответственный из моей команды (team_lead)
    if (userRole === 'team_lead' &&
        responsibleData?.team_lead_id === user.id) {
      return { canManage: true, userId: user.id }
    }

    return { canManage: false, userId: user.id, error: 'Недостаточно прав для управления чекпоинтом' }
  } catch (error) {
    console.error('[canManageCheckpoint] Error:', error)
    return {
      canManage: false,
      userId: null,
      error: error instanceof Error ? error.message : 'Ошибка проверки прав',
    }
  }
}
```

**Как тестировать:**

| Роль | Я ответственный? | Я менеджер проекта? | Ответственный из моего отдела? | Ответственный из моей команды? | Результат |
|------|-----------------|---------------------|-------------------------------|-------------------------------|-----------|
| admin | — | — | — | — | ✅ canManage: true (manage.all) |
| department_head | ✅ да | — | — | — | ✅ canManage: true |
| department_head | ❌ нет | ❌ нет | ✅ да | — | ✅ canManage: true |
| department_head | ❌ нет | ❌ нет | ❌ нет | — | ❌ canManage: false |
| project_manager | ✅ да | — | — | — | ✅ canManage: true |
| project_manager | ❌ нет | ✅ да | — | — | ✅ canManage: true |
| project_manager | ❌ нет | ❌ нет | — | — | ❌ canManage: false |
| team_lead | ✅ да | — | — | — | ✅ canManage: true |
| team_lead | ❌ нет | — | — | ✅ да | ✅ canManage: true |
| team_lead | ❌ нет | — | — | ❌ нет | ❌ canManage: false |
| user | ✅ да | — | — | — | ✅ canManage: true |
| user | ❌ нет | — | — | — | ❌ canManage: false |
| не авторизован | — | — | — | — | ❌ error: 'Пользователь не авторизован' |

```typescript
// Примеры тестов через createCheckpoint:
// 1. Admin → создает чекпоинт на любом разделе ✅
// 2. Department_head на своем разделе ✅
// 3. Department_head на разделе сотрудника своего отдела ✅
// 4. Department_head на разделе сотрудника другого отдела ❌
// 5. Project_manager на разделе своего проекта ✅
// 6. Project_manager на разделе чужого проекта ❌
// 7. Team_lead на своем разделе ✅
// 8. Team_lead на разделе члена своей команды ✅
// 9. Team_lead на разделе чужого сотрудника ❌
// 10. User на своем разделе ✅
// 11. User на чужом разделе ❌
// 12. Не авторизован → error ❌
```

---

#### Шаг 3.4: Реализовать `cleanupOldAuditEntries` helper

**Зачем:**
- Audit trail ограничен 50 записями на checkpoint (FIFO — First In First Out)
- Без cleanup таблица будет расти бесконечно, ухудшая производительность
- Вызывается после каждой записи в audit для поддержания лимита
- Удаляет самые старые записи, сохраняя последние 50

**Что добавить:**
```typescript
// ============================================================================
// Audit Helpers
// ============================================================================

/**
 * FIFO cleanup: удалить старые audit entries если > 50 на checkpoint
 */
async function cleanupOldAuditEntries(
  supabase: Awaited<ReturnType<typeof createClient>>,
  checkpointId: string
): Promise<void> {
  try {
    // 1. Подсчитать текущее количество записей
    const { count } = await supabase
      .from('checkpoint_audit')
      .select('*', { count: 'exact', head: true })
      .eq('checkpoint_id', checkpointId)

    if (!count || count <= 50) {
      return // Не превышен лимит
    }

    // 2. Найти ID записей для удаления (все кроме последних 50)
    const { data: oldEntries } = await supabase
      .from('checkpoint_audit')
      .select('audit_id')
      .eq('checkpoint_id', checkpointId)
      .order('changed_at', { ascending: true })
      .limit(count - 50)

    if (!oldEntries || oldEntries.length === 0) {
      return
    }

    // 3. Удалить старые записи
    const idsToDelete = oldEntries.map(e => e.audit_id)
    await supabase
      .from('checkpoint_audit')
      .delete()
      .in('audit_id', idsToDelete)

    console.log(`[cleanupOldAuditEntries] Deleted ${idsToDelete.length} old entries for checkpoint ${checkpointId}`)
  } catch (error) {
    // Не критичная ошибка — логируем, но не прерываем основную операцию
    console.error('[cleanupOldAuditEntries] Error:', error)
  }
}

/**
 * Записать audit entry
 */
async function writeAuditEntry(
  supabase: Awaited<ReturnType<typeof createClient>>,
  entry: {
    checkpointId: string
    changedBy: string | null
    operationType: 'CREATE' | 'UPDATE' | 'DELETE' | 'COMPLETE' | 'UNCOMPLETE'
    fieldName: string
    oldValue?: string | null
    newValue?: string | null
  }
): Promise<void> {
  try {
    await supabase.from('checkpoint_audit').insert({
      checkpoint_id: entry.checkpointId,
      changed_by: entry.changedBy,
      operation_type: entry.operationType,
      field_name: entry.fieldName,
      old_value: entry.oldValue ?? null,
      new_value: entry.newValue ?? null,
    })

    // FIFO cleanup
    await cleanupOldAuditEntries(supabase, entry.checkpointId)
  } catch (error) {
    console.error('[writeAuditEntry] Error:', error)
    // Не критичная ошибка — основная операция уже выполнена
  }
}
```

**Как тестировать:**
```sql
-- В Supabase Studio:

-- 1. Создать 55 audit записей для одного checkpoint
INSERT INTO checkpoint_audit (checkpoint_id, changed_by, operation_type, field_name, new_value)
SELECT
  'existing-checkpoint-uuid',
  NULL,
  'UPDATE',
  'test_field',
  'value_' || generate_series
FROM generate_series(1, 55);

-- 2. Проверить количество
SELECT COUNT(*) FROM checkpoint_audit WHERE checkpoint_id = 'existing-checkpoint-uuid';
-- Ожидаемо: 55

-- 3. Выполнить updateCheckpoint (который вызовет cleanup)
-- После этого:
SELECT COUNT(*) FROM checkpoint_audit WHERE checkpoint_id = 'existing-checkpoint-uuid';
-- Ожидаемо: 50 (или 51 если добавилась новая запись)

-- 4. Проверить что удалены самые старые
SELECT changed_at FROM checkpoint_audit
WHERE checkpoint_id = 'existing-checkpoint-uuid'
ORDER BY changed_at ASC
LIMIT 5;
-- Самые ранние записи должны быть удалены
```

---

#### Шаг 3.5: Реализовать `getCheckpoints` (Read — список)

**Зачем:**
- Основной action для получения списка чекпоинтов с фильтрацией
- Используется в `useCheckpoints(filters)` hook для загрузки данных
- Поддерживает фильтры: sectionId, projectId, status, dateFrom, dateTo
- Возвращает данные из VIEW с computed status и linked_sections

**Важно о фильтре `sectionId`:**
При фильтрации по разделу возвращаются чекпоинты, у которых:
1. Этот раздел является **родительским** (`section_checkpoints.section_id = sectionId`)
2. **ИЛИ** этот раздел является **связанным** (через `checkpoint_section_links`)

**Что добавить:**
```typescript
// ============================================================================
// Read Actions
// ============================================================================

/**
 * Получить список чекпоинтов с фильтрами
 *
 * Фильтр sectionId: возвращает чекпоинты где раздел является
 * родительским ИЛИ связанным (через checkpoint_section_links)
 */
export async function getCheckpoints(
  filters?: CheckpointFilters
): Promise<ActionResult<Checkpoint[]>> {
  try {
    const supabase = await createClient()

    // Базовый запрос к VIEW
    let query = supabase.from('view_section_checkpoints').select('*')

    // Фильтр по sectionId: родительский ИЛИ связанный раздел
    if (filters?.sectionId) {
      // 1. Найти checkpoint_id где sectionId — связанный раздел
      const { data: linkedCheckpoints } = await supabase
        .from('checkpoint_section_links')
        .select('checkpoint_id')
        .eq('section_id', filters.sectionId)

      const linkedIds = linkedCheckpoints?.map(c => c.checkpoint_id) || []

      // 2. Фильтровать: section_id = sectionId ИЛИ checkpoint_id в linkedIds
      if (linkedIds.length > 0) {
        // Supabase не поддерживает OR напрямую, используем or() filter
        query = query.or(`section_id.eq.${filters.sectionId},checkpoint_id.in.(${linkedIds.join(',')})`)
      } else {
        // Нет связанных — фильтруем только по родительскому
        query = query.eq('section_id', filters.sectionId)
      }
    }

    // Фильтр по projectId
    if (filters?.projectId) {
      // Получить все section_id проекта
      const { data: sectionIds } = await supabase
        .from('sections')
        .select('section_id')
        .eq('section_project_id', filters.projectId)

      if (sectionIds && sectionIds.length > 0) {
        const ids = sectionIds.map(s => s.section_id)

        // Также найти чекпоинты, связанные с разделами проекта
        const { data: linkedCheckpoints } = await supabase
          .from('checkpoint_section_links')
          .select('checkpoint_id')
          .in('section_id', ids)

        const linkedIds = linkedCheckpoints?.map(c => c.checkpoint_id) || []

        if (linkedIds.length > 0) {
          query = query.or(`section_id.in.(${ids.join(',')}),checkpoint_id.in.(${linkedIds.join(',')})`)
        } else {
          query = query.in('section_id', ids)
        }
      } else {
        // Нет разделов в проекте — вернуть пустой массив
        return { success: true, data: [] }
      }
    }

    if (filters?.status) {
      query = query.eq('status', filters.status)
    }

    if (filters?.dateFrom) {
      query = query.gte('checkpoint_date', filters.dateFrom)
    }

    if (filters?.dateTo) {
      query = query.lte('checkpoint_date', filters.dateTo)
    }

    const { data, error } = await query.order('checkpoint_date', { ascending: true })

    if (error) {
      console.error('[getCheckpoints] Supabase error:', error)
      return { success: false, error: error.message }
    }

    // Убрать дубликаты (чекпоинт может попасть и как родительский, и как связанный)
    const uniqueCheckpoints = Array.from(
      new Map((data || []).map(c => [c.checkpoint_id, c])).values()
    )

    return { success: true, data: uniqueCheckpoints as Checkpoint[] }
  } catch (error) {
    console.error('[getCheckpoints] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
}
```

**Как тестировать:**
```typescript
// 1. Создать тестовый API route app/api/test/checkpoints/route.ts
import { getCheckpoints } from '@/modules/checkpoints/actions/checkpoints'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)

  const filters = {
    sectionId: searchParams.get('sectionId') || undefined,
    projectId: searchParams.get('projectId') || undefined,
    status: searchParams.get('status') as 'pending' | 'completed' | 'completed_late' | 'overdue' | undefined,
    dateFrom: searchParams.get('dateFrom') || undefined,
    dateTo: searchParams.get('dateTo') || undefined,
  }

  const result = await getCheckpoints(filters)
  return Response.json(result)
}
```

```bash
# 2. Тесты в браузере или curl:

# Все чекпоинты
curl http://localhost:3000/api/test/checkpoints

# По разделу (родительский ИЛИ связанный)
curl "http://localhost:3000/api/test/checkpoints?sectionId=xxx"

# По статусу
curl "http://localhost:3000/api/test/checkpoints?status=pending"

# По диапазону дат
curl "http://localhost:3000/api/test/checkpoints?dateFrom=2025-01-01&dateTo=2025-12-31"

# Комбинация
curl "http://localhost:3000/api/test/checkpoints?sectionId=xxx&status=overdue"
```

```sql
-- 3. Тест: создать чекпоинт с родительским разделом A и связанным разделом B
-- Затем проверить что фильтр по sectionId=A и sectionId=B оба возвращают этот чекпоинт

-- Чекпоинт с section_id = 'section-A'
INSERT INTO section_checkpoints (section_id, type_id, title, checkpoint_date, created_by)
VALUES ('section-A', 'type-id', 'Test Checkpoint', '2025-01-15', 'user-id')
RETURNING checkpoint_id;

-- Связать с section-B
INSERT INTO checkpoint_section_links (checkpoint_id, section_id)
VALUES ('returned-checkpoint-id', 'section-B');

-- Проверить фильтрацию
-- sectionId=section-A → должен вернуть чекпоинт (родительский)
-- sectionId=section-B → должен вернуть чекпоинт (связанный)
```

---

**📊 Производительность и мониторинг (важно):**

**Текущий подход:**
- `sectionId` фильтр: 2 последовательных запроса
- `projectId` фильтр: 3 последовательных запроса

**Почему это OK для MVP:**
- Для < 10k чекпоинтов это занимает единицы миллисекунд
- Чекпоинты не запрашиваются в hot loop (не критичный путь)
- TypeScript-only логика проще поддерживать и модифицировать

**Sentry мониторинг:**
Добавить Sentry spans для отслеживания производительности:

```typescript
import * as Sentry from '@sentry/nextjs'

export async function getCheckpoints(
  filters?: CheckpointFilters
): Promise<ActionResult<Checkpoint[]>> {
  // Sentry transaction для мониторинга производительности
  return await Sentry.startSpan(
    {
      name: 'getCheckpoints',
      op: 'db.query',
      attributes: {
        'checkpoint.filter.sectionId': filters?.sectionId ?? null,
        'checkpoint.filter.projectId': filters?.projectId ?? null,
        'checkpoint.filter.status': filters?.status ?? null,
      },
    },
    async () => {
      try {
        const supabase = await createClient()
        let query = supabase.from('view_section_checkpoints').select('*')

        // Фильтр по sectionId
        if (filters?.sectionId) {
          const linkedSpan = Sentry.startInactiveSpan({
            name: 'getCheckpoints.linkedSections',
            op: 'db.query',
          })

          const { data: linkedCheckpoints } = await supabase
            .from('checkpoint_section_links')
            .select('checkpoint_id')
            .eq('section_id', filters.sectionId)

          linkedSpan?.end()

          const linkedIds = linkedCheckpoints?.map(c => c.checkpoint_id) || []

          if (linkedIds.length > 0) {
            query = query.or(`section_id.eq.${filters.sectionId},checkpoint_id.in.(${linkedIds.join(',')})`)
          } else {
            query = query.eq('section_id', filters.sectionId)
          }
        }

        // ... остальные фильтры ...

        const mainQuerySpan = Sentry.startInactiveSpan({
          name: 'getCheckpoints.mainQuery',
          op: 'db.query',
        })

        const { data, error } = await query.order('checkpoint_date', { ascending: true })

        mainQuerySpan?.end()

        if (error) {
          Sentry.captureException(error, {
            tags: { module: 'checkpoints' },
            contexts: { filters },
          })
          return { success: false, error: error.message }
        }

        const uniqueCheckpoints = Array.from(
          new Map((data || []).map(c => [c.checkpoint_id, c])).values()
        )

        // Логировать если результат большой (потенциальная проблема производительности)
        if (uniqueCheckpoints.length > 1000) {
          Sentry.captureMessage('Large checkpoint query result', {
            level: 'warning',
            tags: { module: 'checkpoints' },
            extra: { resultCount: uniqueCheckpoints.length, filters },
          })
        }

        return { success: true, data: uniqueCheckpoints as Checkpoint[] }
      } catch (error) {
        Sentry.captureException(error, {
          tags: { module: 'checkpoints', action: 'getCheckpoints' },
          contexts: { filters },
        })
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        }
      }
    }
  )
}
```

**Триггеры для оптимизации:**

| Метрика | Порог | Действие |
|---------|-------|----------|
| Количество чекпоинтов | > 50,000 | Переоценить подход |
| API response time (p95) | > 500ms | Профилировать запросы |
| Sentry alerts | Частые timeout | Добавить индексы |
| User complaints | "Медленно загружается" | Рассмотреть RPC функции |

**Опции будущей оптимизации (если потребуется):**
1. **Параллельные запросы** — `Promise.all()` для независимых запросов
2. **Дополнительные индексы** — composite index `(section_id, checkpoint_date)`
3. **RPC функции** — `get_checkpoints_by_section()` для 1 запроса вместо 2-3
4. **Денормализация** — добавить `linked_section_ids[]` в VIEW

**Правило:** Оптимизируем когда **измерили** проблему, а не когда **предполагаем** её.

---

#### Шаг 3.6: Реализовать `getCheckpoint` (Read — один)

**Зачем:**
- Получение полных данных одного чекпоинта по ID
- Используется в `useCheckpoint(id)` hook для загрузки деталей
- Нужен для CheckpointDetailModal при открытии

**Что добавить:**
```typescript
/**
 * Получить чекпоинт по ID
 */
export async function getCheckpoint(
  checkpointId: string
): Promise<ActionResult<Checkpoint>> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('view_section_checkpoints')
      .select('*')
      .eq('checkpoint_id', checkpointId)
      .maybeSingle()

    if (error) {
      console.error('[getCheckpoint] Supabase error:', error)
      return { success: false, error: error.message }
    }

    if (!data) {
      return { success: false, error: 'Чекпоинт не найден' }
    }

    return { success: true, data: data as Checkpoint }
  } catch (error) {
    console.error('[getCheckpoint] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
}
```

**Как тестировать:**
```typescript
// Добавить в app/api/test/checkpoints/[id]/route.ts
import { getCheckpoint } from '@/modules/checkpoints/actions/checkpoints'

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const result = await getCheckpoint(params.id)
  return Response.json(result)
}
```

```bash
# Тест:
curl http://localhost:3000/api/test/checkpoints/existing-checkpoint-uuid
# Ожидаемо: { success: true, data: { checkpoint_id: "...", title: "...", status: "pending", ... } }

curl http://localhost:3000/api/test/checkpoints/non-existent-uuid
# Ожидаемо: { success: false, error: "Чекпоинт не найден" }
```

---

#### Шаг 3.7: Реализовать `getCheckpointAudit` (Read — история)

**Зачем:**
- Получение audit trail для чекпоинта (история изменений)
- Используется в `useCheckpointAudit(id)` hook для вкладки "История" в modal
- JOIN с profiles для отображения имени и аватара пользователя
- Сортировка DESC — сначала последние изменения

**Что добавить:**
```typescript
/**
 * Получить audit trail чекпоинта
 */
export async function getCheckpointAudit(
  checkpointId: string
): Promise<ActionResult<AuditEntry[]>> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('checkpoint_audit')
      .select(`
        audit_id,
        checkpoint_id,
        changed_by,
        changed_at,
        operation_type,
        field_name,
        old_value,
        new_value,
        profiles:changed_by (
          firstname,
          lastname,
          avatar_url
        )
      `)
      .eq('checkpoint_id', checkpointId)
      .order('changed_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('[getCheckpointAudit] Supabase error:', error)
      return { success: false, error: error.message }
    }

    // Transform data to flatten profile fields
    const entries: AuditEntry[] = (data || []).map((row: Record<string, unknown>) => {
      const profiles = row.profiles as { firstname?: string; lastname?: string; avatar_url?: string } | null
      return {
        audit_id: row.audit_id as string,
        checkpoint_id: row.checkpoint_id as string,
        changed_by: row.changed_by as string | null,
        changed_at: row.changed_at as string,
        operation_type: row.operation_type as AuditEntry['operation_type'],
        field_name: row.field_name as string,
        old_value: row.old_value as string | null,
        new_value: row.new_value as string | null,
        user_firstname: profiles?.firstname ?? null,
        user_lastname: profiles?.lastname ?? null,
        user_avatar_url: profiles?.avatar_url ?? null,
      }
    })

    return { success: true, data: entries }
  } catch (error) {
    console.error('[getCheckpointAudit] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
}
```

**Как тестировать:**
```typescript
// Добавить в app/api/test/checkpoints/[id]/audit/route.ts
import { getCheckpointAudit } from '@/modules/checkpoints/actions/checkpoints'

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const result = await getCheckpointAudit(params.id)
  return Response.json(result)
}
```

```bash
# Тест:
curl http://localhost:3000/api/test/checkpoints/existing-checkpoint-uuid/audit

# Ожидаемо:
# {
#   "success": true,
#   "data": [
#     {
#       "audit_id": "...",
#       "operation_type": "CREATE",
#       "field_name": "checkpoint",
#       "new_value": "Test Checkpoint",
#       "user_firstname": "Иван",
#       "user_lastname": "Петров",
#       "changed_at": "2025-12-18T10:00:00Z"
#     },
#     ...
#   ]
# }
```

---

#### Шаг 3.8: Реализовать `createCheckpoint` (Create)

**Зачем:**
- Создание нового чекпоинта с привязкой к разделу и типу
- Автоматическая подстановка `checkpoint_types.name` в `title`, если пользователь оставил поле пустым (кроме типа `custom`)
- Валидация: для типа `custom` (is_custom=true) title обязателен
- Автоматическое создание записей в checkpoint_section_links (M:N связь)
- Автоматическая запись в audit trail (operation_type: CREATE)
- Проверка прав доступа через `canManageCheckpoint`

**Что добавить:**
```typescript
// ============================================================================
// Write Actions
// ============================================================================

/**
 * Создать новый чекпоинт
 */
export async function createCheckpoint(
  input: CreateCheckpointInput
): Promise<ActionResult<Checkpoint>> {
  try {
    const supabase = await createClient()

    // 1. Проверка прав
    const permission = await canManageCheckpoint(input.sectionId)
    if (!permission.canManage) {
      return { success: false, error: permission.error || 'Недостаточно прав' }
    }

    // 2. Если title пустой — получить name из checkpoint_types
    let finalTitle = input.title?.trim()
    if (!finalTitle) {
      const { data: typeData } = await supabase
        .from('checkpoint_types')
        .select('name, is_custom')
        .eq('type_id', input.typeId)
        .single()

      if (typeData) {
        // Для custom типа title обязателен (UI должна была валидировать)
        if (typeData.is_custom) {
          return { success: false, error: 'Для произвольного типа необходимо указать название' }
        }
        finalTitle = typeData.name
      } else {
        return { success: false, error: 'Тип чекпоинта не найден' }
      }
    }

    // 3. Создать checkpoint
    const { data: checkpoint, error: insertError } = await supabase
      .from('section_checkpoints')
      .insert({
        section_id: input.sectionId,
        type_id: input.typeId,
        title: finalTitle,
        checkpoint_date: input.checkpointDate,
        description: input.description ?? null,
        custom_icon: input.customIcon ?? null,
        custom_color: input.customColor ?? null,
        created_by: permission.userId,
      })
      .select('checkpoint_id')
      .single()

    if (insertError || !checkpoint) {
      console.error('[createCheckpoint] Insert error:', insertError)
      return { success: false, error: insertError?.message || 'Ошибка создания чекпоинта' }
    }

    // 4. Создать связи с дополнительными разделами (если есть)
    if (input.linkedSectionIds && input.linkedSectionIds.length > 0) {
      const links = input.linkedSectionIds.map(sectionId => ({
        checkpoint_id: checkpoint.checkpoint_id,
        section_id: sectionId,
      }))

      const { error: linksError } = await supabase
        .from('checkpoint_section_links')
        .insert(links)

      if (linksError) {
        console.error('[createCheckpoint] Links error:', linksError)
        // Не критично — продолжаем
      }
    }

    // 5. Записать в audit trail
    await writeAuditEntry(supabase, {
      checkpointId: checkpoint.checkpoint_id,
      changedBy: permission.userId,
      operationType: 'CREATE',
      fieldName: 'checkpoint',
      newValue: finalTitle,
    })

    // 6. Вернуть созданный checkpoint из VIEW
    return getCheckpoint(checkpoint.checkpoint_id)
  } catch (error) {
    console.error('[createCheckpoint] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
}
```

**Как тестировать:**
```typescript
// app/api/test/checkpoints/route.ts — добавить POST
export async function POST(req: Request) {
  const body = await req.json()
  const result = await createCheckpoint(body)
  return Response.json(result)
}
```

```bash
# 1. Создать чекпоинт (авторизован как ответственный за раздел)
curl -X POST http://localhost:3000/api/test/checkpoints \
  -H "Content-Type: application/json" \
  -d '{
    "sectionId": "existing-section-uuid",
    "typeId": "existing-type-uuid",
    "title": "Экспертиза раздела АР",
    "checkpointDate": "2025-12-31",
    "description": "Провести экспертизу архитектурного раздела"
  }'

# Ожидаемо: { success: true, data: { checkpoint_id: "...", status: "pending", ... } }
```

```sql
-- 2. Проверить в БД
SELECT * FROM section_checkpoints ORDER BY created_at DESC LIMIT 1;
SELECT * FROM checkpoint_audit ORDER BY changed_at DESC LIMIT 1;
-- operation_type должен быть 'CREATE'
```

```bash
# 3. Тест без прав (авторизоваться как другой пользователь)
# Ожидаемо: { success: false, error: "Недостаточно прав для управления чекпоинтом" }

# 4. Тест с linked sections
curl -X POST http://localhost:3000/api/test/checkpoints \
  -H "Content-Type: application/json" \
  -d '{
    "sectionId": "section-1-uuid",
    "typeId": "type-uuid",
    "title": "Общий дедлайн",
    "checkpointDate": "2025-12-31",
    "linkedSectionIds": ["section-2-uuid", "section-3-uuid"]
  }'
```

```sql
-- Проверить связи
SELECT * FROM checkpoint_section_links WHERE checkpoint_id = 'new-checkpoint-uuid';
-- Должно быть 2 записи
```

---

#### Шаг 3.9: Реализовать `updateCheckpoint` (Update)

**Зачем:**
- Обновление данных чекпоинта (title, description, checkpoint_date, custom_icon, custom_color)
- Обновление связанных разделов (полная замена списка)
- Audit trail для каждого изменённого поля (operation_type: UPDATE)
- Проверка прав через `canManageCheckpoint`

**Что добавить:**
```typescript
/**
 * Обновить чекпоинт
 */
export async function updateCheckpoint(
  input: UpdateCheckpointInput
): Promise<ActionResult<Checkpoint>> {
  try {
    const supabase = await createClient()

    // 1. Получить текущие данные чекпоинта
    const existingResult = await getCheckpoint(input.checkpointId)
    if (!existingResult.success) {
      return existingResult
    }
    const existing = existingResult.data

    // 2. Проверка прав
    const permission = await canManageCheckpoint(existing.section_id)
    if (!permission.canManage) {
      return { success: false, error: permission.error || 'Недостаточно прав' }
    }

    // 3. Подготовить объект обновления (только изменённые поля)
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    // Track changed fields for audit
    const changedFields: Array<{ field: string; oldValue: string | null; newValue: string | null }> = []

    if (input.title !== undefined && input.title !== existing.title) {
      updates.title = input.title
      changedFields.push({ field: 'title', oldValue: existing.title, newValue: input.title })
    }

    if (input.description !== undefined && input.description !== existing.description) {
      updates.description = input.description
      changedFields.push({ field: 'description', oldValue: existing.description, newValue: input.description })
    }

    if (input.checkpointDate !== undefined && input.checkpointDate !== existing.checkpoint_date) {
      updates.checkpoint_date = input.checkpointDate
      changedFields.push({ field: 'checkpoint_date', oldValue: existing.checkpoint_date, newValue: input.checkpointDate })
    }

    if (input.customIcon !== undefined && input.customIcon !== existing.icon) {
      updates.custom_icon = input.customIcon
      changedFields.push({ field: 'custom_icon', oldValue: existing.icon, newValue: input.customIcon })
    }

    if (input.customColor !== undefined && input.customColor !== existing.color) {
      updates.custom_color = input.customColor
      changedFields.push({ field: 'custom_color', oldValue: existing.color, newValue: input.customColor })
    }

    // 4. Выполнить UPDATE
    if (Object.keys(updates).length > 1) { // > 1 потому что updated_at всегда есть
      const { error: updateError } = await supabase
        .from('section_checkpoints')
        .update(updates)
        .eq('checkpoint_id', input.checkpointId)

      if (updateError) {
        console.error('[updateCheckpoint] Update error:', updateError)
        return { success: false, error: updateError.message }
      }
    }

    // 5. Обновить linked sections (если передан массив)
    if (input.linkedSectionIds !== undefined) {
      // Получить текущие linked section IDs
      const currentLinkedIds = existing.linked_sections.map(s => s.section_id)
      const newLinkedIds = input.linkedSectionIds

      // Сравнить
      const addedIds = newLinkedIds.filter(id => !currentLinkedIds.includes(id))
      const removedIds = currentLinkedIds.filter(id => !newLinkedIds.includes(id))

      // Удалить старые связи
      if (removedIds.length > 0) {
        await supabase
          .from('checkpoint_section_links')
          .delete()
          .eq('checkpoint_id', input.checkpointId)
          .in('section_id', removedIds)
      }

      // Добавить новые связи
      if (addedIds.length > 0) {
        await supabase
          .from('checkpoint_section_links')
          .insert(addedIds.map(sectionId => ({
            checkpoint_id: input.checkpointId,
            section_id: sectionId,
          })))
      }

      // Audit для linked_sections
      if (addedIds.length > 0 || removedIds.length > 0) {
        changedFields.push({
          field: 'linked_sections',
          oldValue: JSON.stringify(currentLinkedIds),
          newValue: JSON.stringify(newLinkedIds),
        })
      }
    }

    // 6. Записать audit entries для каждого изменённого поля
    for (const change of changedFields) {
      await writeAuditEntry(supabase, {
        checkpointId: input.checkpointId,
        changedBy: permission.userId,
        operationType: 'UPDATE',
        fieldName: change.field,
        oldValue: change.oldValue,
        newValue: change.newValue,
      })
    }

    // 7. Вернуть обновлённый checkpoint
    return getCheckpoint(input.checkpointId)
  } catch (error) {
    console.error('[updateCheckpoint] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
}
```

**Как тестировать:**
```typescript
// app/api/test/checkpoints/[id]/route.ts — добавить PATCH
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const body = await req.json()
  const result = await updateCheckpoint({ checkpointId: params.id, ...body })
  return Response.json(result)
}
```

```bash
# 1. Обновить title
curl -X PATCH http://localhost:3000/api/test/checkpoints/existing-uuid \
  -H "Content-Type: application/json" \
  -d '{ "title": "Новое название" }'

# 2. Обновить несколько полей
curl -X PATCH http://localhost:3000/api/test/checkpoints/existing-uuid \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Обновлённое название",
    "checkpointDate": "2025-12-25",
    "description": "Новое описание"
  }'

# 3. Обновить linked sections
curl -X PATCH http://localhost:3000/api/test/checkpoints/existing-uuid \
  -H "Content-Type: application/json" \
  -d '{ "linkedSectionIds": ["section-1", "section-2"] }'
```

```sql
-- Проверить audit trail
SELECT operation_type, field_name, old_value, new_value, changed_at
FROM checkpoint_audit
WHERE checkpoint_id = 'existing-uuid'
ORDER BY changed_at DESC
LIMIT 10;
-- Должны быть записи UPDATE для каждого изменённого поля
```

---

#### Шаг 3.10: Реализовать `completeCheckpoint` (Complete/Uncomplete)

**Зачем:**
- Отметка чекпоинта как выполненного (completed_at = now, completed_by = user)
- Снятие отметки выполнения (completed_at = null, completed_by = null)
- Audit trail с operation_type: COMPLETE или UNCOMPLETE
- Status в VIEW пересчитывается автоматически (pending → completed/completed_late)

**Что добавить:**
```typescript
/**
 * Отметить чекпоинт выполненным / снять отметку
 */
export async function completeCheckpoint(
  input: CompleteCheckpointInput
): Promise<ActionResult<Checkpoint>> {
  try {
    const supabase = await createClient()

    // 1. Получить текущие данные
    const existingResult = await getCheckpoint(input.checkpointId)
    if (!existingResult.success) {
      return existingResult
    }
    const existing = existingResult.data

    // 2. Проверка прав
    const permission = await canManageCheckpoint(existing.section_id)
    if (!permission.canManage) {
      return { success: false, error: permission.error || 'Недостаточно прав' }
    }

    // 3. Определить новые значения
    const now = new Date().toISOString()
    const isCurrentlyCompleted = existing.completed_at !== null

    // Проверить что состояние действительно меняется
    if (input.completed === isCurrentlyCompleted) {
      // Состояние не меняется — просто вернуть текущие данные
      return { success: true, data: existing }
    }

    // 4. Выполнить UPDATE
    const { error: updateError } = await supabase
      .from('section_checkpoints')
      .update({
        completed_at: input.completed ? now : null,
        completed_by: input.completed ? permission.userId : null,
        updated_at: now,
      })
      .eq('checkpoint_id', input.checkpointId)

    if (updateError) {
      console.error('[completeCheckpoint] Update error:', updateError)
      return { success: false, error: updateError.message }
    }

    // 5. Записать audit entry
    await writeAuditEntry(supabase, {
      checkpointId: input.checkpointId,
      changedBy: permission.userId,
      operationType: input.completed ? 'COMPLETE' : 'UNCOMPLETE',
      fieldName: 'completed_at',
      oldValue: existing.completed_at,
      newValue: input.completed ? now : null,
    })

    // 6. Вернуть обновлённый checkpoint
    return getCheckpoint(input.checkpointId)
  } catch (error) {
    console.error('[completeCheckpoint] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
}
```

**Как тестировать:**
```typescript
// app/api/test/checkpoints/[id]/complete/route.ts
import { completeCheckpoint } from '@/modules/checkpoints/actions/checkpoints'

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const body = await req.json()
  const result = await completeCheckpoint({
    checkpointId: params.id,
    completed: body.completed ?? true,
  })
  return Response.json(result)
}
```

```bash
# 1. Отметить выполненным
curl -X POST http://localhost:3000/api/test/checkpoints/existing-uuid/complete \
  -H "Content-Type: application/json" \
  -d '{ "completed": true }'

# Ожидаемо: status изменится на "completed" или "completed_late" (если дедлайн прошёл)
```

```sql
-- Проверить в БД
SELECT checkpoint_id, title, completed_at, completed_by, status, status_label
FROM view_section_checkpoints
WHERE checkpoint_id = 'existing-uuid';
```

```bash
# 2. Снять отметку
curl -X POST http://localhost:3000/api/test/checkpoints/existing-uuid/complete \
  -H "Content-Type: application/json" \
  -d '{ "completed": false }'

# Ожидаемо: status вернётся к "pending" или "overdue"
```

```sql
-- Проверить audit
SELECT operation_type, field_name, old_value, new_value
FROM checkpoint_audit
WHERE checkpoint_id = 'existing-uuid'
ORDER BY changed_at DESC
LIMIT 2;
-- Должны быть COMPLETE и UNCOMPLETE записи
```

---

#### Шаг 3.11: Реализовать `deleteCheckpoint` (Delete)

**Зачем:**
- Удаление чекпоинта (CASCADE удалит связи и audit)
- Audit entry создаётся ДО удаления (чтобы сохранить историю)
- Проверка прав через `canManageCheckpoint`

**Что добавить:**
```typescript
/**
 * Удалить чекпоинт
 */
export async function deleteCheckpoint(
  checkpointId: string
): Promise<ActionResult<{ deleted: boolean }>> {
  try {
    const supabase = await createClient()

    // 1. Получить текущие данные (для audit и проверки прав)
    const existingResult = await getCheckpoint(checkpointId)
    if (!existingResult.success) {
      return { success: false, error: existingResult.error }
    }
    const existing = existingResult.data

    // 2. Проверка прав
    const permission = await canManageCheckpoint(existing.section_id)
    if (!permission.canManage) {
      return { success: false, error: permission.error || 'Недостаточно прав' }
    }

    // 3. Записать audit entry ПЕРЕД удалением
    // (audit записи удалятся CASCADE, но мы хотя бы логируем)
    await writeAuditEntry(supabase, {
      checkpointId,
      changedBy: permission.userId,
      operationType: 'DELETE',
      fieldName: 'checkpoint',
      oldValue: existing.title,
      newValue: null,
    })

    // 4. Удалить checkpoint (CASCADE удалит links и audit)
    const { error: deleteError } = await supabase
      .from('section_checkpoints')
      .delete()
      .eq('checkpoint_id', checkpointId)

    if (deleteError) {
      console.error('[deleteCheckpoint] Delete error:', deleteError)
      return { success: false, error: deleteError.message }
    }

    return { success: true, data: { deleted: true } }
  } catch (error) {
    console.error('[deleteCheckpoint] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
}
```

**Как тестировать:**
```typescript
// app/api/test/checkpoints/[id]/route.ts — добавить DELETE
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const result = await deleteCheckpoint(params.id)
  return Response.json(result)
}
```

```bash
# 1. Удалить checkpoint
curl -X DELETE http://localhost:3000/api/test/checkpoints/existing-uuid

# Ожидаемо: { success: true, data: { deleted: true } }

# 2. Попытка удалить несуществующий
curl -X DELETE http://localhost:3000/api/test/checkpoints/non-existent-uuid

# Ожидаемо: { success: false, error: "Чекпоинт не найден" }

# 3. Попытка удалить без прав
# Ожидаемо: { success: false, error: "Недостаточно прав для управления чекпоинтом" }
```

```sql
-- Проверить что checkpoint удалён
SELECT * FROM section_checkpoints WHERE checkpoint_id = 'deleted-uuid';
-- Должен быть пустой результат

-- Проверить что links удалены (CASCADE)
SELECT * FROM checkpoint_section_links WHERE checkpoint_id = 'deleted-uuid';
-- Должен быть пустой результат

-- Проверить что audit удалён (CASCADE)
SELECT * FROM checkpoint_audit WHERE checkpoint_id = 'deleted-uuid';
-- Должен быть пустой результат
```

---

#### Шаг 3.12: Экспортировать public API

**Зачем:**
- Единая точка импорта для всех actions и типов
- Скрытие внутренних helpers (canManageCheckpoint, writeAuditEntry, cleanupOldAuditEntries)
- Соответствие паттерну других модулей

**Файл:** `modules/checkpoints/actions/index.ts`

**Что добавить:**
```typescript
// Re-export all checkpoint actions
export {
  // Types
  type ActionResult,
  type CreateCheckpointInput,
  type UpdateCheckpointInput,
  type CompleteCheckpointInput,
  type Checkpoint,
  type AuditEntry,
  // Read actions
  getCheckpoints,
  getCheckpoint,
  getCheckpointAudit,
  // Write actions
  createCheckpoint,
  updateCheckpoint,
  completeCheckpoint,
  deleteCheckpoint,
} from './checkpoints'
```

**Как тестировать:**
```typescript
// Проверить что импорты работают
import {
  getCheckpoints,
  getCheckpoint,
  createCheckpoint,
  updateCheckpoint,
  completeCheckpoint,
  deleteCheckpoint,
  getCheckpointAudit,
  type Checkpoint,
  type CreateCheckpointInput,
} from '@/modules/checkpoints/actions'

// npm run build должен пройти без ошибок
```

---

**Итоговый чек-лист Этапа 3:**
- [ ] Шаг 3.1: Структура файла и базовые типы
- [ ] Шаг 3.2: Миграция permissions (`checkpoints.manage.all`, `checkpoints.types.manage` только для admin)
- [ ] Шаг 3.3: `canManageCheckpoint` helper с динамической проверкой контекста (responsible_id, manager_id, department, team)
- [ ] Шаг 3.4: `cleanupOldAuditEntries` helper
- [ ] Шаг 3.5: `getCheckpoints` (Read — список)
- [ ] Шаг 3.6: `getCheckpoint` (Read — один)
- [ ] Шаг 3.7: `getCheckpointAudit` (Read — история)
- [ ] Шаг 3.8: `createCheckpoint` (Create)
- [ ] Шаг 3.9: `updateCheckpoint` (Update)
- [ ] Шаг 3.10: `completeCheckpoint` (Complete/Uncomplete)
- [ ] Шаг 3.11: `deleteCheckpoint` (Delete)
- [ ] Шаг 3.12: Экспортировать public API
- [ ] `npm run build` проходит без ошибок

**Визуальные изменения:**
❌ Нет визуальных изменений (Server Actions только)

**Проверка 🤖 Cache Guardian:**
После реализации — проверить:
- Все actions возвращают `ActionResult<T>`
- Используется `createClient()` from `@/utils/supabase/server`
- Корректная обработка ошибок (try/catch + error logging)
- Permission checks во всех write actions
- Audit trail записывается для всех мутаций
- FIFO cleanup вызывается после каждой audit записи

---

### Этап 4: Server Actions (Checkpoint Types CRUD)

**Описание:**
Реализовать Server Actions для управления справочником типов чекпоинтов (admin-only): `getCheckpointTypes` (публичный read), `createCheckpointType`, `updateCheckpointType`, `deleteCheckpointType`. Типы используются в SELECT dropdown при создании чекпоинтов всеми пользователями.

**Затрагиваемые файлы:**
- `modules/checkpoints/actions/checkpoint-types.ts` (новый)

**Зависимости:**
Этап 1 (база данных)

**Текущий статус:** ⏳ В ОЖИДАНИИ

---

#### Шаг 4.1: Создать структуру файла и типы

**Зачем:**
- Типы чекпоинтов — справочник (exam, task_transfer, milestone, custom и т.д.)
- Создавать/редактировать/удалять типы может ТОЛЬКО admin (разрешение `checkpoints.types.manage`)
- Тип `custom` (is_custom=true) — это template для произвольных чекпоинтов (без предустановленного названия)
- При создании чекпоинта:
  - Предустановленные типы: можно ввести свой title, иначе используется `checkpoint_types.name`
  - Тип `custom`: обязательно нужно ввести title вручную
- Типы используются в SELECT dropdown при создании чекпоинта (публичный read)

**Файл:** `modules/checkpoints/actions/checkpoint-types.ts`

**Что добавить:**
```typescript
'use server'

import { createClient } from '@/utils/supabase/server'

// ============================================================================
// Types
// ============================================================================

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }

/** Тип чекпоинта из таблицы */
export interface CheckpointType {
  type_id: string
  type: string // unique slug: 'exam', 'task_transfer', 'milestone', etc.
  name: string // display name: 'Экспертиза', 'Передача задания', etc.
  icon: string // lucide icon name
  color: string // hex color
  is_custom: boolean
  created_by: string | null
  created_at: string
}

/** Input для создания типа */
export interface CreateCheckpointTypeInput {
  type: string // unique slug
  name: string
  icon: string
  color: string
}

/** Input для обновления типа */
export interface UpdateCheckpointTypeInput {
  typeId: string
  name?: string
  icon?: string
  color?: string
}
```

**Как тестировать:**
```bash
# 1. Проверить что файл создан
ls modules/checkpoints/actions/checkpoint-types.ts

# 2. Проверить TypeScript компиляцию
npx tsc --noEmit
```

---

#### Шаг 4.2: Реализовать `isAdmin` helper

**Зачем:**
- Только админы могут создавать/редактировать/удалять типы чекпоинтов
- Централизованная проверка роли пользователя
- Возвращает userId для записи в created_by

**Что добавить:**
```typescript
// ============================================================================
// Permission Helper
// ============================================================================

/**
 * Проверить, является ли текущий пользователь админом
 */
async function isAdmin(): Promise<{ isAdmin: boolean; userId: string | null; error?: string }> {
  try {
    const supabase = await createClient()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { isAdmin: false, userId: null, error: 'Пользователь не авторизован' }
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role_id')
      .eq('user_id', user.id)
      .single()

    if (!profile?.role_id) {
      return { isAdmin: false, userId: user.id, error: 'Роль не назначена' }
    }

    const { data: role } = await supabase
      .from('roles')
      .select('role_name')
      .eq('id', profile.role_id)
      .single()

    if (role?.role_name === 'admin') {
      return { isAdmin: true, userId: user.id }
    }

    return { isAdmin: false, userId: user.id, error: 'Недостаточно прав (требуется роль admin)' }
  } catch (error) {
    console.error('[isAdmin] Error:', error)
    return {
      isAdmin: false,
      userId: null,
      error: error instanceof Error ? error.message : 'Ошибка проверки прав',
    }
  }
}
```

**Как тестировать:**
```typescript
// Тест через createCheckpointType:
// 1. Авторизоваться как admin → успех
// 2. Авторизоваться как обычный пользователь → ошибка "Недостаточно прав"
// 3. Не авторизован → ошибка "Пользователь не авторизован"
```

---

#### Шаг 4.3: Реализовать `getCheckpointTypes` (Read)

**Зачем:**
- Загрузка списка всех типов чекпоинтов для SELECT dropdown
- Сортировка: сначала встроенные (is_custom=false), потом кастомные, по имени
- Не требует авторизации — типы публичные

**Что добавить:**
```typescript
// ============================================================================
// Read Actions
// ============================================================================

/**
 * Получить все типы чекпоинтов
 */
export async function getCheckpointTypes(): Promise<ActionResult<CheckpointType[]>> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('checkpoint_types')
      .select('*')
      .order('is_custom', { ascending: true }) // Сначала встроенные
      .order('name', { ascending: true })

    if (error) {
      console.error('[getCheckpointTypes] Supabase error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data: data as CheckpointType[] }
  } catch (error) {
    console.error('[getCheckpointTypes] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
}
```

**Как тестировать:**
```typescript
// app/api/test/checkpoint-types/route.ts
import { getCheckpointTypes } from '@/modules/checkpoints/actions/checkpoint-types'

export async function GET() {
  const result = await getCheckpointTypes()
  return Response.json(result)
}
```

```bash
curl http://localhost:3000/api/test/checkpoint-types

# Ожидаемо (если есть seed data):
# {
#   "success": true,
#   "data": [
#     { "type_id": "...", "type": "exam", "name": "Экспертиза", "is_custom": false, ... },
#     { "type_id": "...", "type": "task_transfer", "name": "Передача задания", "is_custom": false, ... },
#     ...
#   ]
# }
```

---

#### Шаг 4.4: Реализовать `createCheckpointType` (Create)

**Зачем:**
- Админы могут создавать новые типы чекпоинтов
- Автоматически ставится is_custom=false (с возможностью поменять. нужно задать юзеру вопрос "Вы создаете шаблонный тип "custom"?" по умолчанию ответ нет) и Автоматически ставится created_by=currentUser
- Уникальность type slug проверяется на уровне БД (UNIQUE constraint)

**Что добавить:**
```typescript
// ============================================================================
// Write Actions
// ============================================================================

/**
 * Создать кастомный тип чекпоинта (только admin)
 */
export async function createCheckpointType(
  input: CreateCheckpointTypeInput
): Promise<ActionResult<CheckpointType>> {
  try {
    const supabase = await createClient()

    // 1. Проверка прав админа
    const adminCheck = await isAdmin()
    if (!adminCheck.isAdmin) {
      return { success: false, error: adminCheck.error || 'Недостаточно прав' }
    }

    // 2. Валидация type slug (только латиница, цифры, underscore)
    if (!/^[a-z][a-z0-9_]*$/.test(input.type)) {
      return {
        success: false,
        error: 'Код типа должен начинаться с буквы и содержать только латиницу, цифры и _',
      }
    }

    // 3. Создать тип
    const { data, error } = await supabase
      .from('checkpoint_types')
      .insert({
        type: input.type,
        name: input.name,
        icon: input.icon,
        color: input.color,
        is_custom: true,
        created_by: adminCheck.userId,
      })
      .select()
      .single()

    if (error) {
      console.error('[createCheckpointType] Insert error:', error)
      // Проверка на duplicate key
      if (error.code === '23505') {
        return { success: false, error: `Тип с кодом "${input.type}" уже существует` }
      }
      return { success: false, error: error.message }
    }

    return { success: true, data: data as CheckpointType }
  } catch (error) {
    console.error('[createCheckpointType] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
}
```

**Как тестировать:**
```typescript
// app/api/test/checkpoint-types/route.ts — добавить POST
export async function POST(req: Request) {
  const body = await req.json()
  const result = await createCheckpointType(body)
  return Response.json(result)
}
```

```bash
# 1. Создать тип (как admin)
curl -X POST http://localhost:3000/api/test/checkpoint-types \
  -H "Content-Type: application/json" \
  -d '{
    "type": "custom_deadline",
    "name": "Кастомный дедлайн",
    "icon": "clock",
    "color": "#ff6b6b"
  }'

# Ожидаемо: { success: true, data: { type_id: "...", is_custom: true, ... } }

# 2. Попытка создать дубликат
# Ожидаемо: { success: false, error: "Тип с кодом \"custom_deadline\" уже существует" }

# 3. Некорректный type slug
curl -X POST http://localhost:3000/api/test/checkpoint-types \
  -H "Content-Type: application/json" \
  -d '{ "type": "123invalid", "name": "Test", "icon": "star", "color": "#000" }'

# Ожидаемо: { success: false, error: "Код типа должен начинаться с буквы..." }

# 4. Без прав админа
# Ожидаемо: { success: false, error: "Недостаточно прав (требуется роль admin)" }
```

---

#### Шаг 4.5: Реализовать `updateCheckpointType` (Update)

**Зачем:**
- Редактирование name, icon, color типов чекпоинтов (admin может редактировать все типы)
- type slug нельзя менять (используется в логике, UNIQUE constraint)

**Что добавить:**
```typescript
/**
 * Обновить тип чекпоинта (только admin, все типы редактируемы)
 */
export async function updateCheckpointType(
  input: UpdateCheckpointTypeInput
): Promise<ActionResult<CheckpointType>> {
  try {
    const supabase = await createClient()

    // 1. Проверка прав админа
    const adminCheck = await isAdmin()
    if (!adminCheck.isAdmin) {
      return { success: false, error: adminCheck.error || 'Недостаточно прав' }
    }

    // 2. Получить текущий тип
    const { data: existing, error: fetchError } = await supabase
      .from('checkpoint_types')
      .select('*')
      .eq('type_id', input.typeId)
      .single()

    if (fetchError || !existing) {
      return { success: false, error: 'Тип не найден' }
    }

    // 3. Подготовить обновление (admin может редактировать все типы)
    const updates: Record<string, unknown> = {}
    if (input.name !== undefined) updates.name = input.name
    if (input.icon !== undefined) updates.icon = input.icon
    if (input.color !== undefined) updates.color = input.color

    if (Object.keys(updates).length === 0) {
      return { success: true, data: existing as CheckpointType }
    }

    // 4. Выполнить UPDATE
    const { data, error: updateError } = await supabase
      .from('checkpoint_types')
      .update(updates)
      .eq('type_id', input.typeId)
      .select()
      .single()

    if (updateError) {
      console.error('[updateCheckpointType] Update error:', updateError)
      return { success: false, error: updateError.message }
    }

    return { success: true, data: data as CheckpointType }
  } catch (error) {
    console.error('[updateCheckpointType] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
}
```

**Как тестировать:**
```typescript
// app/api/test/checkpoint-types/[id]/route.ts
import { updateCheckpointType } from '@/modules/checkpoints/actions/checkpoint-types'

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const body = await req.json()
  const result = await updateCheckpointType({ typeId: params.id, ...body })
  return Response.json(result)
}
```

```bash
# 1. Обновить кастомный тип
curl -X PATCH http://localhost:3000/api/test/checkpoint-types/custom-type-uuid \
  -H "Content-Type: application/json" \
  -d '{ "name": "Новое имя", "color": "#00ff00" }'

# Ожидаемо: { success: true, data: { ..., name: "Новое имя", color: "#00ff00" } }

# 2. Попытка обновить встроенный тип
curl -X PATCH http://localhost:3000/api/test/checkpoint-types/builtin-type-uuid \
  -H "Content-Type: application/json" \
  -d '{ "name": "Обновлённое название" }'

# Ожидаемо (от админа): { success: true, data: { type_id, name: "Обновлённое название", ... } }
# Ожидаемо (от не-админа): { success: false, error: "Недостаточно прав" }
```

---

#### Шаг 4.6: Реализовать `deleteCheckpointType` (Delete)

**Зачем:**
- Удаление типов чекпоинтов (admin может удалять любые типы)
- Проверка: если тип используется в чекпоинтах — нельзя удалять (FK RESTRICT защита на уровне БД)
- Возврат понятной ошибки пользователю, если тип используется

**Что добавить:**
```typescript
/**
 * Удалить тип чекпоинта (только admin, все типы могут быть удалены если не используются)
 */
export async function deleteCheckpointType(
  typeId: string
): Promise<ActionResult<{ deleted: boolean }>> {
  try {
    const supabase = await createClient()

    // 1. Проверка прав админа
    const adminCheck = await isAdmin()
    if (!adminCheck.isAdmin) {
      return { success: false, error: adminCheck.error || 'Недостаточно прав' }
    }

    // 2. Проверить что тип не используется в чекпоинтах
    const { count, error: countError } = await supabase
      .from('section_checkpoints')
      .select('*', { count: 'exact', head: true })
      .eq('type_id', typeId)

    if (countError) {
      console.error('[deleteCheckpointType] Count error:', countError)
      return { success: false, error: 'Ошибка проверки использования типа' }
    }

    if (count && count > 0) {
      return {
        success: false,
        error: `Тип используется в ${count} чекпоинт(ах). Сначала измените тип в этих чекпоинтах.`,
      }
    }

    // 3. Удалить тип
    const { error: deleteError } = await supabase
      .from('checkpoint_types')
      .delete()
      .eq('type_id', typeId)

    if (deleteError) {
      console.error('[deleteCheckpointType] Delete error:', deleteError)
      return { success: false, error: deleteError.message }
    }

    return { success: true, data: { deleted: true } }
  } catch (error) {
    console.error('[deleteCheckpointType] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
}
```

**Как тестировать:**
```typescript
// app/api/test/checkpoint-types/[id]/route.ts — добавить DELETE
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const result = await deleteCheckpointType(params.id)
  return Response.json(result)
}
```

```bash
# 1. Удалить неиспользуемый кастомный тип
curl -X DELETE http://localhost:3000/api/test/checkpoint-types/unused-custom-type-uuid

# Ожидаемо: { success: true, data: { deleted: true } }

# 2. Попытка удалить используемый тип
curl -X DELETE http://localhost:3000/api/test/checkpoint-types/used-type-uuid

# Ожидаемо: { success: false, error: "Тип используется в 5 чекпоинт(ах)..." }
```

---

#### Шаг 4.7: Экспортировать public API

**Зачем:**
- Единая точка импорта для actions и типов
- Скрытие внутреннего isAdmin helper

**Файл:** `modules/checkpoints/actions/index.ts`

**Что добавить:**
```typescript
// ... existing exports from checkpoints.ts

// Re-export checkpoint types actions
export {
  type CheckpointType,
  type CreateCheckpointTypeInput,
  type UpdateCheckpointTypeInput,
  getCheckpointTypes,
  createCheckpointType,
  updateCheckpointType,
  deleteCheckpointType,
} from './checkpoint-types'
```

**Как тестировать:**
```typescript
import {
  getCheckpointTypes,
  createCheckpointType,
  updateCheckpointType,
  deleteCheckpointType,
  type CheckpointType,
} from '@/modules/checkpoints/actions'

// npm run build должен пройти без ошибок
```

---

**Итоговый чек-лист Этапа 4:**
- [ ] Шаг 4.1: Структура файла и типы
- [ ] Шаг 4.2: `isAdmin` helper
- [ ] Шаг 4.3: `getCheckpointTypes` (Read)
- [ ] Шаг 4.4: `createCheckpointType` (Create)
- [ ] Шаг 4.5: `updateCheckpointType` (Update)
- [ ] Шаг 4.6: `deleteCheckpointType` (Delete)
- [ ] Шаг 4.7: Экспортировать public API
- [ ] `npm run build` проходит без ошибок

**Визуальные изменения:**
❌ Нет визуальных изменений (Server Actions только)

**Проверка 🤖 Cache Guardian:**
После реализации — проверить:
- Все actions возвращают `ActionResult<T>`
- Admin check во всех write actions
- is_custom check перед редактированием/удалением
- Проверка использования перед удалением

---

### Этап 5: Cache Hooks (Checkpoints)

**Зачем нужен этот этап:**
Создание React-хуков для работы с чекпоинтами — это мост между Server Actions (Этап 3) и UI-компонентами. Хуки инкапсулируют логику кеширования, загрузки данных, optimistic updates и автоматической инвалидации кеша. Без этого этапа компонентам придется вручную управлять состоянием загрузки, ошибками и рефетчем данных, что приведет к дублированию кода и багам.

**Описание:**
Создать 7 хуков для работы с чекпоинтами, используя фабрики из `modules/cache/`:
- **Query hooks** (чтение): `useCheckpoints`, `useCheckpoint`, `useCheckpointAudit`
- **Mutation hooks** (запись): `useCreateCheckpoint`, `useUpdateCheckpoint`, `useCompleteCheckpoint`, `useDeleteCheckpoint`

**Затрагиваемые файлы:**
- `modules/checkpoints/hooks/use-checkpoints.ts` (новый)

**Зависимости:**
- Этап 2 (query keys в `modules/cache/keys/query-keys.ts`)
- Этап 3 (Server Actions в `modules/checkpoints/actions/checkpoints.ts`)

---

#### Шаг 5.1: Создать файл и импорты

**Зачем:**
Настроить структуру файла и подключить необходимые зависимости из cache module и Server Actions.

**Код:**
```typescript
// modules/checkpoints/hooks/use-checkpoints.ts
'use client'

import {
  createCacheQuery,
  createDetailCacheQuery,
  createCacheMutation,
  createUpdateMutation,
  createDeleteMutation,
  queryKeys,
} from '@/modules/cache'

import {
  getCheckpoints,
  getCheckpointById,
  getCheckpointAudit,
  createCheckpoint,
  updateCheckpoint,
  completeCheckpoint,
  deleteCheckpoint,
  type Checkpoint,
  type CreateCheckpointInput,
  type UpdateCheckpointInput,
  type CompleteCheckpointInput,
  type CheckpointFilters,
  type AuditEntry,
} from '@/modules/checkpoints/actions'
```

**Как проверить:**
- `npm run build` — нет ошибок импорта
- VSCode показывает автокомплит для всех импортов

---

#### Шаг 5.2: `useCheckpoints` — query hook для списка чекпоинтов

**Зачем:**
Позволяет компонентам загружать список чекпоинтов с фильтрацией по секциям, проектам, типам. Кеширует данные, автоматически обновляется при изменениях. Используется в списках, таблицах, карточках секций.

**Код:**
```typescript
export const useCheckpoints = createCacheQuery({
  queryKey: (filters?: CheckpointFilters) => queryKeys.checkpoints.list(filters),
  queryFn: getCheckpoints,
  staleTime: 'fast', // 30 секунд (данные меняются часто)
})
```

**Как проверить:**
```tsx
// app/test-checkpoints-hooks/page.tsx
'use client'
import { useCheckpoints } from '@/modules/checkpoints/hooks/use-checkpoints'

export default function TestPage() {
  const { data, isLoading, error } = useCheckpoints({ sectionId: 'test-uuid' })

  if (isLoading) return <div>Загрузка...</div>
  if (error) return <div>Ошибка: {error.message}</div>

  return (
    <div className="p-4">
      <h1>Чекпоинты: {data?.length || 0}</h1>
      <pre className="text-xs">{JSON.stringify(data, null, 2)}</pre>
    </div>
  )
}
```

**Проверки:**
1. Открыть `/test-checkpoints-hooks` — видны данные из БД
2. React DevTools → TanStack Query Devtools → query key `['checkpoints', 'list', { sectionId: '...' }]` в состоянии `success`
3. Обновить данные в БД (через Supabase Admin) → через 30 сек рефетч должен подхватить изменения
4. Проверить `isLoading: true` при первой загрузке

---

#### Шаг 5.3: `useCheckpoint` — query hook для одного чекпоинта

**Зачем:**
Загружает детальную информацию о чекпоинте по ID. Используется в модальных окнах, детальных просмотрах, для отображения связанных секций и статуса.

**Код:**
```typescript
export const useCheckpoint = createDetailCacheQuery({
  queryKey: (id: string) => queryKeys.checkpoints.detail(id),
  queryFn: getCheckpointById,
  staleTime: 'fast',
})
```

**Как проверить:**
```tsx
// Добавить в test-checkpoints-hooks/page.tsx
import { useCheckpoint } from '@/modules/checkpoints/hooks/use-checkpoints'

function CheckpointDetail({ id }: { id: string }) {
  const { data, isLoading } = useCheckpoint(id)

  if (isLoading) return <div>Загрузка...</div>
  if (!data) return <div>Чекпоинт не найден</div>

  return (
    <div className="border p-4 rounded">
      <h2>{data.title}</h2>
      <p>Дата: {data.checkpoint_date}</p>
      <p>Статус: {data.status_label}</p>
      <p>Связанных секций: {data.linked_sections_count}</p>
    </div>
  )
}
```

**Проверки:**
1. Взять реальный `checkpoint_id` из БД (SELECT checkpoint_id FROM checkpoints LIMIT 1)
2. Передать в `<CheckpointDetail id="..." />`
3. Должны загрузиться данные конкретного чекпоинта
4. TanStack Devtools → query key `['checkpoints', 'detail', 'checkpoint-id']`

---

#### Шаг 5.4: `useCheckpointAudit` — query hook для истории изменений

**Зачем:**
Отображает audit trail (кто, когда, что изменил) для чекпоинта. Используется в модальных окнах "История изменений". Кеш живет дольше (medium), т.к. история не меняется часто.

**Код:**
```typescript
export const useCheckpointAudit = createDetailCacheQuery({
  queryKey: (id: string) => queryKeys.checkpoints.audit(id),
  queryFn: getCheckpointAudit,
  staleTime: 'medium', // 5 минут (история редко меняется)
})
```

**Как проверить:**
```tsx
function AuditLog({ checkpointId }: { checkpointId: string }) {
  const { data: audit, isLoading } = useCheckpointAudit(checkpointId)

  if (isLoading) return <div>Загрузка истории...</div>

  return (
    <div>
      <h3>История изменений ({audit?.length || 0})</h3>
      {audit?.map((entry) => (
        <div key={entry.audit_id} className="text-sm border-b pb-2">
          <div>{entry.action_type} — {entry.action_timestamp}</div>
          <div>Пользователь: {entry.user_firstname} {entry.user_lastname}</div>
          <pre className="text-xs">{JSON.stringify(entry.changes, null, 2)}</pre>
        </div>
      ))}
    </div>
  )
}
```

**Проверки:**
1. Создать/обновить чекпоинт через UI (чтобы появились записи в `checkpoint_audit`)
2. Передать `checkpointId` в `<AuditLog />`
3. Должен отобразиться список изменений с именами пользователей
4. TanStack Devtools → query key `['checkpoints', 'audit', 'checkpoint-id']` со staleTime=300000ms

---

#### Шаг 5.5: `useCreateCheckpoint` — mutation hook для создания

**Зачем:**
Создает новый чекпоинт и автоматически обновляет кеш списков (чекпоинты, секции, resource graph). Без инвалидации пришлось бы вручную рефетчить все зависимые запросы.

**Код:**
```typescript
export const useCreateCheckpoint = createCacheMutation({
  mutationFn: createCheckpoint,
  invalidateKeys: [
    queryKeys.checkpoints.all,    // Все списки чекпоинтов
    queryKeys.sections.all,         // Секции (т.к. у них есть счетчики чекпоинтов)
    queryKeys.resourceGraph.all,    // Resource Graph (timeline с чекпоинтами)
  ],
})
```

**Как проверить:**
```tsx
import { useCreateCheckpoint } from '@/modules/checkpoints/hooks/use-checkpoints'

function CreateCheckpointButton({ sectionId }: { sectionId: string }) {
  const createMutation = useCreateCheckpoint()

  const handleCreate = () => {
    createMutation.mutate({
      section_id: sectionId,
      type_id: 'exam-type-uuid', // Взять из БД (SELECT type_id FROM checkpoint_types LIMIT 1)
      title: 'Тестовый чекпоинт',
      checkpoint_date: '2025-12-31',
    }, {
      onSuccess: (result) => {
        if (result.success) {
          alert(`Создан чекпоинт: ${result.data.checkpoint_id}`)
        } else {
          alert(`Ошибка: ${result.error}`)
        }
      }
    })
  }

  return (
    <button onClick={handleCreate} disabled={createMutation.isPending}>
      {createMutation.isPending ? 'Создание...' : 'Создать чекпоинт'}
    </button>
  )
}
```

**Проверки:**
1. Нажать "Создать чекпоинт" → должен появиться в списке автоматически (без ручного рефетча)
2. TanStack Devtools → после мутации должны инвалидироваться ключи `['checkpoints']`, `['sections']`, `['resource-graph']`
3. Проверить в БД: новая запись в `checkpoints` таблице
4. Проверить обработку ошибок: передать невалидные данные (например, несуществующий `section_id`) → `result.success === false`

---

#### Шаг 5.6: `useUpdateCheckpoint` — mutation hook с optimistic update

**Зачем:**
Обновляет чекпоинт (название, дату, описание, кастомные иконку/цвет) с мгновенным отображением в UI (optimistic update). Пользователь видит изменения до ответа сервера, что создает ощущение мгновенной реакции.

**Код:**
```typescript
export const useUpdateCheckpoint = createUpdateMutation({
  mutationFn: updateCheckpoint,
  listQueryKey: queryKeys.checkpoints.all,
  getId: (input: UpdateCheckpointInput) => input.checkpoint_id,
  getItemId: (item: Checkpoint) => item.checkpoint_id,
  merge: (item: Checkpoint, input: UpdateCheckpointInput) => ({
    ...item,
    title: input.title ?? item.title,
    description: input.description ?? item.description,
    checkpoint_date: input.checkpoint_date ?? item.checkpoint_date,
    icon: input.custom_icon ?? item.icon,
    color: input.custom_color ?? item.color,
  }),
})
```

**Как проверить:**
```tsx
function EditCheckpoint({ checkpointId }: { checkpointId: string }) {
  const { data: checkpoint } = useCheckpoint(checkpointId)
  const updateMutation = useUpdateCheckpoint()
  const [title, setTitle] = useState('')

  useEffect(() => {
    if (checkpoint) setTitle(checkpoint.title)
  }, [checkpoint])

  const handleUpdate = () => {
    updateMutation.mutate({
      checkpoint_id: checkpointId,
      title,
    })
  }

  return (
    <div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="border px-2 py-1"
      />
      <button onClick={handleUpdate}>Сохранить</button>
    </div>
  )
}
```

**Проверки:**
1. Изменить название → UI обновится мгновенно (до ответа сервера)
2. Открыть Network tab в DevTools → увидеть запрос к Server Action
3. Если запрос упадет (например, нет прав) → UI откатится к старому значению
4. Проверить, что изменения применились в БД (SELECT title FROM checkpoints WHERE checkpoint_id='...')
5. TanStack Devtools → видеть optimistic update в query data (временное изменение до ответа)

---

#### Шаг 5.7: `useCompleteCheckpoint` — mutation для завершения чекпоинта

**Зачем:**
Отмечает чекпоинт как выполненный (заполняет `completed_at` и `completed_by`). Используется кнопкой "Отметить выполненным" в UI. Также с optimistic update для мгновенной реакции.

**Код:**
```typescript
export const useCompleteCheckpoint = createUpdateMutation({
  mutationFn: completeCheckpoint,
  listQueryKey: queryKeys.checkpoints.all,
  getId: (input: CompleteCheckpointInput) => input.checkpoint_id,
  getItemId: (item: Checkpoint) => item.checkpoint_id,
  merge: (item: Checkpoint, input: CompleteCheckpointInput) => ({
    ...item,
    completed_at: new Date().toISOString(),
    completed_by: input.user_id, // Берется из Server Action (текущий пользователь)
    status: 'completed', // Optimistic status (сервер пересчитает правильно)
  }),
})
```

**Как проверить:**
```tsx
function CompleteButton({ checkpointId, userId }: { checkpointId: string; userId: string }) {
  const { data: checkpoint } = useCheckpoint(checkpointId)
  const completeMutation = useCompleteCheckpoint()

  if (checkpoint?.completed_at) {
    return <div className="text-green-500">✓ Выполнено</div>
  }

  return (
    <button
      onClick={() => completeMutation.mutate({ checkpoint_id: checkpointId, user_id: userId })}
      disabled={completeMutation.isPending}
      className="bg-green-500 text-white px-3 py-1 rounded"
    >
      {completeMutation.isPending ? 'Сохранение...' : 'Отметить выполненным'}
    </button>
  )
}
```

**Проверки:**
1. Нажать "Отметить выполненным" → UI обновится мгновенно (зеленая галочка)
2. Проверить в БД: `completed_at` и `completed_by` заполнены
3. Проверить, что `status` пересчитался корректно (VIEW `view_section_checkpoints` содержит логику `CASE WHEN completed_at IS NOT NULL THEN 'completed' ...`)
4. TanStack Devtools → optimistic update → rollback, если ошибка
5. Проверить запись в `checkpoint_audit` (должна появиться с `action_type='completed'`)

---

#### Шаг 5.8: `useDeleteCheckpoint` — mutation для удаления

**Зачем:**
Удаляет чекпоинт и инвалидирует все зависимые кеши (списки чекпоинтов, секции, resource graph). Используется в модальных окнах удаления.

**Код:**
```typescript
export const useDeleteCheckpoint = createDeleteMutation({
  mutationFn: deleteCheckpoint,
  invalidateKeys: [
    queryKeys.checkpoints.all,
    queryKeys.sections.all,
    queryKeys.resourceGraph.all,
  ],
})
```

**Как проверить:**
```tsx
function DeleteButton({ checkpointId }: { checkpointId: string }) {
  const deleteMutation = useDeleteCheckpoint()

  const handleDelete = () => {
    if (!confirm('Удалить чекпоинт?')) return

    deleteMutation.mutate(checkpointId, {
      onSuccess: (result) => {
        if (result.success) {
          alert('Чекпоинт удален')
        } else {
          alert(`Ошибка: ${result.error}`)
        }
      }
    })
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleteMutation.isPending}
      className="bg-red-500 text-white px-3 py-1 rounded"
    >
      {deleteMutation.isPending ? 'Удаление...' : 'Удалить'}
    </button>
  )
}
```

**Проверки:**
1. Нажать "Удалить" → чекпоинт исчезнет из списка автоматически
2. Проверить в БД: запись удалена из таблицы `checkpoints`
3. Проверить, что audit записи тоже удалены (CASCADE в миграции)
4. TanStack Devtools → после мутации инвалидируются ключи `['checkpoints']`, `['sections']`, `['resource-graph']`
5. Попытка удалить несуществующий ID → `result.success === false`, ошибка в `result.error`

---

#### Итоговый чек-лист Этапа 5:

- [ ] Шаг 5.1: Файл `use-checkpoints.ts` создан, импорты настроены
- [ ] Шаг 5.2: `useCheckpoints` — загрузка списка с фильтрами
- [ ] Шаг 5.3: `useCheckpoint` — загрузка одного чекпоинта
- [ ] Шаг 5.4: `useCheckpointAudit` — история изменений
- [ ] Шаг 5.5: `useCreateCheckpoint` — создание с инвалидацией кеша
- [ ] Шаг 5.6: `useUpdateCheckpoint` — обновление с optimistic update
- [ ] Шаг 5.7: `useCompleteCheckpoint` — завершение с optimistic update
- [ ] Шаг 5.8: `useDeleteCheckpoint` — удаление с инвалидацией
- [ ] `npm run build` проходит без ошибок
- [ ] Протестированы все хуки в `app/test-checkpoints-hooks/page.tsx`
- [ ] TanStack Query Devtools показывает корректные query keys

**Визуальные изменения:**
❌ Нет визуальных изменений (hooks только, UI появится на этапах 8-12)

**Проверка 🤖 Cache Guardian:**
После реализации — проверить:
- Использование фабрик `createCacheQuery`, `createCacheMutation`, `createUpdateMutation`, `createDeleteMutation`
- Корректные query keys из `queryKeys.checkpoints.*`
- Optimistic updates в `useUpdateCheckpoint` и `useCompleteCheckpoint`
- Cache invalidation в мутациях (инвалидация `checkpoints.all`, `sections.all`, `resourceGraph.all`)
- staleTime настроен корректно (fast/medium по требованиям)

---

---

### Этап 6: Cache Hooks (Checkpoint Types)

**Описание:**
Создать хуки для работы с типами чекпоинтов, которые используются в админ-панели управления типами и в формах создания чекпоинтов (dropdown выбора типа).

**Зачем этот этап нужен:**
Типы чекпоинтов (`checkpoint_types`) — это справочник (exam, task_transfer, milestone, custom и т.д.), который используется для категоризации чекпоинтов. Без hooks невозможно:
- Отобразить список типов в SELECT dropdown при создании чекпоинта
- Реализовать админ-панель управления типами (`/admin/checkpoints/types`)
- Получать автоматическое обновление UI при изменении типов другими пользователями (через Realtime)

Hooks обеспечивают:
- **Кеширование** — список типов загружается один раз и переиспользуется во всех компонентах
- **Автоматическую инвалидацию** — при создании/редактировании типа все SELECT dropdown обновляются автоматически
- **Optimistic updates** — изменения отображаются мгновенно, до ответа сервера
- **Type safety** — все операции типизированы через TypeScript

**Затрагиваемые файлы:**
- `modules/checkpoints/hooks/use-checkpoint-types.ts` (новый)

**Зависимости:**
- Этап 2 (query keys `checkpointTypes.*` уже добавлены)
- Этап 4 (Server Actions `getCheckpointTypes`, `createCheckpointType`, `updateCheckpointType`, `deleteCheckpointType`)

**Визуальные изменения:**
❌ Нет визуальных изменений (hooks — это инфраструктура, UI появится в Этапах 13-14)

---

#### Шаг 6.1: Создать файл и импорты

**Зачем:**
Настроить структуру файла и подключить необходимые зависимости из cache module и Server Actions для типов чекпоинтов.

**Код:**
```typescript
// modules/checkpoints/hooks/use-checkpoint-types.ts
'use client'

import {
  createCacheQuery,
  createCacheMutation,
  createDeleteMutation,
  createUpdateMutation,
  queryKeys,
  STALE_TIMES,
  type TableRow,
} from '@/modules/cache'
import {
  getCheckpointTypes,
  createCheckpointType,
  updateCheckpointType,
  deleteCheckpointType,
  type CreateCheckpointTypeInput,
  type UpdateCheckpointTypeInput,
} from '../actions/checkpoint-types'

// Helper type для типов из БД
type CheckpointType = TableRow<'checkpoint_types'>
```

**Как проверить:**
```bash
# Файл создан, импорты корректны
npm run build
# Ожидаем: нет ошибок импорта
```

---

#### Шаг 6.2: `useCheckpointTypes` — query hook для списка типов

**Зачем:**
Загружает список всех типов чекпоинтов для использования в:
- SELECT dropdown при создании чекпоинта (пользователь выбирает тип: экспертиза, сдача задания, веха и т.д.)
- Админ-панели управления типами (`/admin/checkpoints/types` — таблица всех типов)
- Фильтрах и отчётах (группировка чекпоинтов по типам)

**Особенности:**
- `staleTime: STALE_TIMES.slow` — типы меняются редко (только админы), можно кешировать надолго (60 минут)
- Сортировка: сначала встроенные типы (is_custom=false), потом кастомные, по алфавиту
- Realtime подписка (из Этапа 2) автоматически инвалидирует кеш при изменениях

**Код:**
```typescript
/**
 * Загрузка списка всех типов чекпоинтов.
 * Используется в SELECT dropdown и админ-панели.
 */
export const useCheckpointTypes = createCacheQuery({
  queryKey: () => queryKeys.checkpointTypes.list(),
  queryFn: getCheckpointTypes,
  staleTime: STALE_TIMES.slow, // Типы меняются редко
})
```

**Как проверить:**
1. Создать тестовый компонент `app/test-checkpoint-types/page.tsx`:
```tsx
'use client'
import { useCheckpointTypes } from '@/modules/checkpoints/hooks/use-checkpoint-types'

export default function TestPage() {
  const { data: types, isLoading, error } = useCheckpointTypes()

  if (isLoading) return <div>Загрузка типов...</div>
  if (error) return <div>Ошибка: {error.message}</div>

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">
        Типов чекпоинтов: {types?.length || 0}
      </h1>
      <pre className="bg-gray-100 p-4 rounded">
        {JSON.stringify(types, null, 2)}
      </pre>
    </div>
  )
}
```

2. Открыть `/test-checkpoint-types`
3. Проверить:
   - Типы загрузились (exam, task_transfer, milestone, custom)
   - Loading state отображается корректно
   - В TanStack Query Devtools видна query с ключом `['checkpoint-types', 'list']`
   - staleTime = 3600000 (60 минут)

---

#### Шаг 6.3: `useCreateCheckpointType` — mutation для создания типа

**Зачем:**
Позволяет администраторам создавать новые типы чекпоинтов в админ-панели. Например, компания хочет добавить специфичный тип "Согласование с заказчиком" или "Передача в архив".

**Особенности:**
- Доступно ТОЛЬКО для админов (разрешение `checkpoints.types.manage`)
- Автоматически is_custom=false для новых типов с возможностью изменения на true
- После создания инвалидирует `checkpointTypes.all` → все SELECT dropdown обновляются автоматически

**Код:**
```typescript
/**
 * Создание нового типа чекпоинта (только для админов).
 * Инвалидирует список типов.
 */
export const useCreateCheckpointType = createCacheMutation({
  mutationFn: createCheckpointType,
  invalidateKeys: [queryKeys.checkpointTypes.all],
})
```

**Как проверить:**
1. Добавить в тестовый компонент `app/test-checkpoint-types/page.tsx`:
```tsx
'use client'
import { useCheckpointTypes, useCreateCheckpointType } from '@/modules/checkpoints/hooks/use-checkpoint-types'

export default function TestPage() {
  const { data: types } = useCheckpointTypes()
  const createMutation = useCreateCheckpointType()

  const handleCreate = () => {
    createMutation.mutate({
      type: 'test_approval',
      name: 'Тестовое согласование',
      icon: 'check-circle',
      color: '#3b82f6',
    })
  }

  return (
    <div className="p-8">
      <h1>Типов: {types?.length || 0}</h1>
      <button
        onClick={handleCreate}
        disabled={createMutation.isPending}
        className="bg-blue-500 text-white px-4 py-2 rounded"
      >
        {createMutation.isPending ? 'Создание...' : 'Создать тип'}
      </button>
      {createMutation.isError && (
        <div className="text-red-500 mt-2">
          Ошибка: {createMutation.error.message}
        </div>
      )}
      <pre>{JSON.stringify(types, null, 2)}</pre>
    </div>
  )
}
```

2. Проверить:
   - Кликнуть "Создать тип"
   - Список автоматически обновился (новый тип появился в конце)
   - Если НЕ админ → ошибка "Недостаточно прав"
   - В Devtools видна инвалидация query `['checkpoint-types', 'list']`

---

#### Шаг 6.4: `useUpdateCheckpointType` — mutation для редактирования типа

**Зачем:**
Позволяет администраторам редактировать **любые** типы (встроенные и кастомные):
- Изменить название: "Экспертиза" → "Проверка экспертизы"
- Сменить иконку: `check-circle` → `file-check`
- Изменить цвет: `#10b981` → `#3b82f6`

**Критичная особенность:**
При изменении `icon` или `color` типа нужно инвалидировать **не только `checkpointTypes.all`**, но и **`checkpoints.all`**!

Почему? VIEW `view_section_checkpoints` использует LEFT JOIN на `checkpoint_types`:
```sql
-- Если у чекпоинта нет кастомной иконки — берётся из типа
COALESCE(sc.custom_icon, ct.icon) AS icon,
COALESCE(sc.custom_color, ct.color) AS color
```

Значит, если админ изменит `checkpoint_types.icon` или `checkpoint_types.color`, это повлияет на отображение всех чекпоинтов этого типа!

**Код:**
```typescript
/**
 * Редактирование типа чекпоинта (только для админов).
 * Инвалидирует типы И чекпоинты (т.к. icon/color из типа используются в VIEW).
 */
export const useUpdateCheckpointType = createUpdateMutation({
  mutationFn: updateCheckpointType,
  listQueryKey: queryKeys.checkpointTypes.list(),
  getId: (input) => input.type_id,
  getItemId: (item) => item.type_id,
  merge: (item, input) => ({
    ...item,
    name: input.name ?? item.name,
    icon: input.icon ?? item.icon,
    color: input.color ?? item.color,
  }),
  // КРИТИЧНО: инвалидировать checkpoints.all, т.к. icon/color меняются
  invalidateKeys: [queryKeys.checkpointTypes.all, queryKeys.checkpoints.all],
})
```

**Как проверить:**
1. Добавить в тестовый компонент:
```tsx
const types = useCheckpointTypes()
const updateMutation = useUpdateCheckpointType()

const handleUpdate = (typeId: string) => {
  updateMutation.mutate({
    type_id: typeId,
    name: 'Обновлённое название',
    icon: 'star',
    color: '#ef4444',
  })
}
```

2. Проверить:
   - Кликнуть "Редактировать" на любом типе
   - Список обновился мгновенно (optimistic update)
   - После ответа сервера данные корректны
   - В Devtools видна инвалидация `['checkpoint-types', 'all']` И `['checkpoints', 'all']`

---

#### Шаг 6.5: `useDeleteCheckpointType` — mutation для удаления типа

**Зачем:**
Позволяет администраторам удалять неиспользуемые типы чекпоинтов.

**Критичная особенность:**
Нельзя удалить тип, если он используется в чекпоинтах! БД защищена FK CONSTRAINT:
```sql
FOREIGN KEY (type_id) REFERENCES checkpoint_types(type_id) ON DELETE RESTRICT
```

Server Action `deleteCheckpointType` вернёт ошибку → UI покажет toast "Тип используется в чекпоинтах, удаление невозможно".

**Код:**
```typescript
/**
 * Удаление типа чекпоинта (только для админов).
 * Проверка: тип не должен использоваться в чекпоинтах (FK RESTRICT).
 */
export const useDeleteCheckpointType = createDeleteMutation({
  mutationFn: deleteCheckpointType,
  listQueryKey: queryKeys.checkpointTypes.list(),
  getItemId: (item) => item.type_id,
  invalidateKeys: [queryKeys.checkpointTypes.all],
})
```

**Как проверить:**
1. Добавить в тестовый компонент:
```tsx
const deleteMutation = useDeleteCheckpointType()

const handleDelete = (typeId: string) => {
  if (confirm('Удалить тип?')) {
    deleteMutation.mutate({ type_id: typeId })
  }
}
```

2. Проверить:
   - Попытаться удалить встроенный тип (exam) → ошибка "Тип используется"
   - Создать новый тип → удалить его → успех, список обновился
   - В Devtools видна инвалидация `['checkpoint-types', 'all']`

---

#### Шаг 6.6: Экспортировать hooks из модуля

**Зачем:**
Единая точка импорта для других модулей и компонентов. Вместо:
```typescript
import { useCheckpointTypes } from '@/modules/checkpoints/hooks/use-checkpoint-types'
```

Можно будет писать:
```typescript
import { useCheckpointTypes } from '@/modules/checkpoints'
```

**Код:**
```typescript
// modules/checkpoints/hooks/index.ts
export * from './use-checkpoint-types'
export * from './use-checkpoints' // из Этапа 5
```

**Как проверить:**
```typescript
// Проверить импорт из модуля
import { useCheckpointTypes } from '@/modules/checkpoints/hooks'

// Работает корректно
npm run build
```

---

**Как тестировать Этап 6 целиком:**

1. **Создать тестовую страницу** `app/test-checkpoint-types/page.tsx` с полным функционалом:
```tsx
'use client'
import {
  useCheckpointTypes,
  useCreateCheckpointType,
  useUpdateCheckpointType,
  useDeleteCheckpointType,
} from '@/modules/checkpoints/hooks/use-checkpoint-types'

export default function TestPage() {
  const { data: types, isLoading } = useCheckpointTypes()
  const createMutation = useCreateCheckpointType()
  const updateMutation = useUpdateCheckpointType()
  const deleteMutation = useDeleteCheckpointType()

  if (isLoading) return <div>Загрузка...</div>

  return (
    <div className="p-8">
      <h1 className="text-2xl mb-4">Типов: {types?.length || 0}</h1>

      {/* Создание */}
      <button
        onClick={() =>
          createMutation.mutate({
            type: 'test_' + Date.now(),
            name: 'Тестовый тип',
            icon: 'star',
            color: '#3b82f6',
          })
        }
        className="bg-green-500 text-white px-4 py-2 rounded mr-2"
      >
        Создать
      </button>

      {/* Список типов */}
      <div className="mt-4 space-y-2">
        {types?.map((type) => (
          <div key={type.type_id} className="flex gap-2 items-center border p-2">
            <span style={{ color: type.color }}>{type.icon}</span>
            <span>{type.name}</span>
            <span className="text-xs text-gray-500">
              {type.is_custom ? 'Кастомный' : 'Встроенный'}
            </span>
            <button
              onClick={() =>
                updateMutation.mutate({
                  type_id: type.type_id,
                  name: type.name + ' (обновлён)',
                })
              }
              className="bg-blue-500 text-white px-2 py-1 rounded text-xs"
            >
              Редактировать
            </button>
            <button
              onClick={() =>
                deleteMutation.mutate({ type_id: type.type_id })
              }
              className="bg-red-500 text-white px-2 py-1 rounded text-xs"
            >
              Удалить
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
```

2. **Проверить сценарии:**
   - ✅ Загрузка списка типов (exam, task_transfer, milestone, custom)
   - ✅ Создание нового типа → список обновился автоматически
   - ✅ Редактирование типа → optimistic update → refetch
   - ✅ Удаление неиспользуемого типа → успех
   - ✅ Попытка удалить используемый тип → ошибка "Тип используется"
   - ✅ Попытка операций НЕ админом → ошибка "Недостаточно прав"

3. **TanStack Query Devtools:**
   - Query `['checkpoint-types', 'list']` в состоянии `success`
   - staleTime = 3600000ms (60 минут)
   - При мутациях видна инвалидация query
   - Optimistic updates работают

4. **Build:**
```bash
npm run build
# Ожидаем: нет TypeScript ошибок
```

**Проверка 🤖 Cache Guardian:**
После завершения этапа вызвать Cache Guardian для валидации:
- ✅ Hooks используют фабрики из cache module (`createCacheQuery`, `createCacheMutation`, etc.)
- ✅ Query keys берутся из `queryKeys.checkpointTypes.*`
- ✅ Server Actions импортированы корректно
- ✅ Invalidation keys указаны правильно (`checkpointTypes.all`, `checkpoints.all`)
- ✅ staleTime соответствует требованиям (slow для типов)
- ✅ Optimistic update в `useUpdateCheckpointType` через `createUpdateMutation`

---

### Этап 7: TypeScript Types

**ЗАЧЕМ НУЖЕН:**
Этот этап — фундамент type safety для всего модуля checkpoints. Без строгих типов:
- Разработчики будут ошибаться в названиях полей (`checkpointDate` vs `checkpoint_date`)
- Нет autocomplete в IDE — медленная разработка
- Ошибки всплывут только в runtime, а не на этапе компиляции
- Невозможно гарантировать соответствие между БД и UI
- Cache hooks не смогут вывести правильные типы

**Описание:**
Создать централизованную систему TypeScript типов для модуля checkpoints с четким разделением:
1. **Domain Types** — бизнес-сущности из базы данных
2. **Computed Types** — расчетные поля (status, label, counts)
3. **Filter Types** — фильтрация и пагинация
4. **Form Types** — входные данные для форм

---

#### Шаг 7.1: Создание файла типов

**Затрагиваемые файлы:**
- `modules/checkpoints/types/index.ts` (новый)

**Зависимости:**
- Этап 1 (`types/db.ts` обновлен после миграции)
- `modules/cache/types.ts` (для BaseFilters)

**ЗАЧЕМ:**
Централизовать все типы в одном месте для:
- Упрощения импортов (`import { Checkpoint } from '@/modules/checkpoints/types'`)
- Единого источника правды (single source of truth)
- Упрощения рефакторинга (изменения в одном месте)

**Что делать:**
```typescript
// modules/checkpoints/types/index.ts

import type { Database } from '@/types/db'
import type { BaseFilters } from '@/modules/cache/types'

// ============================================================================
// 1. BASE TYPES (из таблиц БД)
// ============================================================================

/** Тип чекпоинта из справочника */
export type CheckpointType = Database['public']['Tables']['checkpoint_types']['Row']

/** Чекпоинт (base, без computed fields) */
export type CheckpointBase = Database['public']['Tables']['section_checkpoints']['Row']

/** Связь чекпоинта с разделами */
export type CheckpointSectionLink = Database['public']['Tables']['checkpoint_section_links']['Row']

/** Запись аудита */
export type CheckpointAuditBase = Database['public']['Tables']['checkpoint_audit']['Row']

// ============================================================================
// 2. COMPUTED TYPES (из VIEW view_section_checkpoints)
// ============================================================================

/** Статус чекпоинта (computed) */
export type CheckpointStatus = 'pending' | 'completed' | 'completed_late' | 'overdue'

/** Полный чекпоинт с computed полями и JOIN данными */
export interface Checkpoint extends CheckpointBase {
  // Поля типа (JOIN checkpoint_types)
  type_code: string
  type_name: string
  is_custom: boolean
  icon: string
  color: string

  // Computed поля
  status: CheckpointStatus
  status_label: string

  // Контекст разрешений (JOIN sections/projects/profiles)
  section_responsible: string | null        // responsible.id
  project_manager: string | null            // manager.id

  // Связанные разделы (aggregated)
  linked_sections: Array<{
    section_id: string
    section_code: string
    section_name: string
  }>
  linked_sections_count: number
}

/** Запись аудита с данными пользователя */
export interface AuditEntry extends CheckpointAuditBase {
  // JOIN profiles
  user_firstname: string | null
  user_lastname: string | null
  user_avatar_url: string | null
}

// ============================================================================
// 3. FILTER TYPES
// ============================================================================

export interface CheckpointFilters extends BaseFilters {
  section_id?: string                        // Фильтр по разделу
  type_id?: string                           // Фильтр по типу
  status?: CheckpointStatus | CheckpointStatus[]  // Фильтр по статусу
  date_from?: string                         // Фильтр "с даты" (ISO)
  date_to?: string                           // Фильтр "по дату" (ISO)
  is_custom?: boolean                        // Только custom типы?
  has_linked_sections?: boolean              // Только с связанными разделами?
}

// ============================================================================
// 4. FORM INPUT TYPES
// ============================================================================

/** Данные для создания чекпоинта */
export interface CreateCheckpointInput {
  section_id: string
  type_id: string
  title?: string                             // Optional для предустановленных типов
  description?: string
  checkpoint_date: string                    // ISO date string
  linked_section_ids?: string[]              // M:N связи
}

/** Данные для обновления чекпоинта */
export interface UpdateCheckpointInput {
  checkpoint_id: string
  title?: string
  description?: string
  checkpoint_date?: string
  type_id?: string
  linked_section_ids?: string[]
}

/** Данные для завершения чекпоинта */
export interface CompleteCheckpointInput {
  checkpoint_id: string
  completed_at?: string                      // Default = NOW()
}

/** Данные для создания типа чекпоинта */
export interface CreateCheckpointTypeInput {
  code: string
  name: string
  icon: string
  color: string
  is_custom?: boolean                        // Default = true (admin-created)
}

/** Данные для обновления типа чекпоинта */
export interface UpdateCheckpointTypeInput {
  type_id: string
  name?: string
  icon?: string
  color?: string
}
```

**Как проверить:**
1. Создать файл `modules/checkpoints/types/index.ts` с кодом выше
2. Запустить `npm run build` — не должно быть ошибок TypeScript
3. Открыть файл в VSCode — при наведении на `Checkpoint` должна быть подсказка со всеми полями

---

#### Шаг 7.2: Тестирование типов

**ЗАЧЕМ:**
Убедиться, что:
1. Типы корректно экспортируются
2. Autocomplete работает
3. TypeScript выводит ошибки при неправильном использовании
4. Enum types строгие (не просто `string`)

**Что делать:**
Создать тестовый файл `modules/checkpoints/types/test-types.ts`:

```typescript
import type {
  Checkpoint,
  CheckpointType,
  AuditEntry,
  CheckpointFilters,
  CreateCheckpointInput,
  CheckpointStatus
} from './index'

// ============================================================================
// TEST 1: Checkpoint type
// ============================================================================

const checkpoint: Checkpoint = {
  checkpoint_id: 'test-id',
  section_id: 'section-1',
  type_id: 'type-1',
  type_code: 'exam',
  type_name: 'Экспертиза',
  is_custom: false,
  title: 'Тестовый чекпоинт',
  description: null,
  checkpoint_date: '2025-12-31',
  icon: 'check-circle',
  color: '#10b981',
  completed_at: null,
  completed_by: null,
  status: 'pending',                         // Should be strict enum
  status_label: 'Ожидается',
  created_by: null,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
  section_responsible: 'user-1',
  project_manager: 'user-2',
  linked_sections: [],
  linked_sections_count: 0,
}

// ✅ Should autocomplete all fields when typing `checkpoint.`
const checkpointDate = checkpoint.checkpoint_date
const status = checkpoint.status

// ❌ Should show TypeScript error (wrong status value)
// const wrongCheckpoint: Checkpoint = { ...checkpoint, status: 'invalid' }

// ============================================================================
// TEST 2: CheckpointType
// ============================================================================

const checkpointType: CheckpointType = {
  type_id: 'type-1',
  code: 'exam',
  name: 'Экспертиза',
  icon: 'check-circle',
  color: '#10b981',
  is_custom: false,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
}

// ============================================================================
// TEST 3: AuditEntry
// ============================================================================

const auditEntry: AuditEntry = {
  audit_id: 'audit-1',
  checkpoint_id: 'test-id',
  action: 'CREATE',
  changed_by: 'user-1',
  changed_at: '2025-01-01T00:00:00Z',
  old_data: null,
  new_data: { title: 'Новый чекпоинт' },
  user_firstname: 'Иван',
  user_lastname: 'Иванов',
  user_avatar_url: 'https://example.com/avatar.jpg',
}

// ============================================================================
// TEST 4: Filter types
// ============================================================================

const filters: CheckpointFilters = {
  section_id: 'section-1',
  type_id: 'type-1',
  status: ['pending', 'overdue'],            // Should accept array
  date_from: '2025-01-01',
  date_to: '2025-12-31',
  limit: 50,
  offset: 0,
  sort_by: 'checkpoint_date',
  sort_order: 'asc',
}

// ============================================================================
// TEST 5: Input types
// ============================================================================

const createInput: CreateCheckpointInput = {
  section_id: 'section-1',
  type_id: 'type-1',
  title: 'Новый чекпоинт',
  checkpoint_date: '2025-12-31',
  linked_section_ids: ['section-2', 'section-3'],
}

// ============================================================================
// TEST 6: Strict enum type checking
// ============================================================================

// ✅ Should accept valid status
const validStatus: CheckpointStatus = 'pending'

// ❌ Should show TypeScript error
// const invalidStatus: CheckpointStatus = 'wrong_status'

// ✅ Type guard should work
function isOverdue(status: CheckpointStatus): boolean {
  return status === 'overdue'
}

console.log('✅ All type tests passed!')
```

**Как проверить:**
1. Создать файл `modules/checkpoints/types/test-types.ts`
2. Запустить `npm run build` — не должно быть ошибок
3. Раскомментировать строки с ❌ — должны появиться ошибки TypeScript
4. В VSCode набрать `checkpoint.` — должен появиться autocomplete со всеми полями
5. Навести на `status: 'pending'` — VSCode должен показать `'pending' | 'completed' | 'completed_late' | 'overdue'`, а не просто `string`

---

#### Шаг 7.3: Экспорт через index.ts модуля

**ЗАЧЕМ:**
Упростить импорты в других частях приложения:
```typescript
// ❌ Было:
import { Checkpoint } from '@/modules/checkpoints/types/index'

// ✅ Стало:
import { Checkpoint } from '@/modules/checkpoints'
```

**Что делать:**
Создать/обновить `modules/checkpoints/index.ts`:

```typescript
// modules/checkpoints/index.ts

export * from './types'
```

**Как проверить:**
1. В любом файле написать: `import { Checkpoint } from '@/modules/checkpoints'`
2. Autocomplete должен сработать
3. `npm run build` — нет ошибок

---

#### Шаг 7.4: Финальная проверка интеграции с Cache Module

**ЗАЧЕМ:**
Убедиться, что типы корректно используются в Cache Module:
- Query keys имеют правильную типизацию
- Hooks возвращают правильные типы
- Filters работают с autocomplete

**Что делать:**
Создать тестовый файл `modules/checkpoints/types/test-cache-integration.ts`:

```typescript
import type { Checkpoint, CheckpointFilters } from '@/modules/checkpoints'
import { queryKeys } from '@/modules/cache/keys/query-keys'

// ============================================================================
// TEST: Query keys должны иметь правильную типизацию
// ============================================================================

const checkpointListKey = queryKeys.checkpoints.lists()
const checkpointDetailKey = queryKeys.checkpoints.detail('checkpoint-1')
const filteredKey = queryKeys.checkpoints.list({ section_id: 'section-1' })

// ✅ Should infer correct type for filters
const filters: CheckpointFilters = {
  section_id: 'section-1',
  status: 'pending',
  date_from: '2025-01-01',
}

const keyWithFilters = queryKeys.checkpoints.list(filters)

// ============================================================================
// TEST: Simulate hook return type
// ============================================================================

// Simulate what useCheckpoints hook would return
type UseCheckpointsReturn = {
  data: Checkpoint[] | undefined
  isLoading: boolean
  error: Error | null
}

const mockHookResult: UseCheckpointsReturn = {
  data: undefined,
  isLoading: true,
  error: null,
}

// ✅ Should have autocomplete for checkpoint fields
if (mockHookResult.data) {
  mockHookResult.data.forEach(checkpoint => {
    console.log(checkpoint.checkpoint_id)      // ✅ Should autocomplete
    console.log(checkpoint.status)             // ✅ Should autocomplete
    console.log(checkpoint.linked_sections)    // ✅ Should autocomplete
  })
}

console.log('✅ Cache integration types work correctly!')
```

**Как проверить:**
1. Создать файл выше
2. Запустить `npm run build` — нет ошибок
3. Проверить autocomplete при вводе `checkpoint.`
4. Проверить, что `filters` object имеет autocomplete для всех полей из `CheckpointFilters`

---

**Проверка 🤖 Clean Code Guardian:**
После завершения всех шагов вызвать агента для проверки:
- ✅ Naming conventions: `PascalCase` для типов, `camelCase` для полей
- ✅ Strict TypeScript: нет `any`, все типы явно определены
- ✅ Документация: каждый тип имеет JSDoc комментарий
- ✅ Exports: все типы экспортированы через `index.ts`
- ✅ Enum safety: `status` — строгий union type, не `string`

**Критерии готовности этапа:**
- [ ] Файл `modules/checkpoints/types/index.ts` создан
- [ ] Все 4 группы типов определены (Base, Computed, Filter, Input)
- [ ] Тестовый файл `test-types.ts` проходит проверку TypeScript
- [ ] Autocomplete работает во всех случаях
- [ ] `npm run build` выполнен без ошибок
- [ ] Clean Code Guardian вернул ✅ (или исправлены замечания)
- [ ] Удалены тестовые файлы (`test-types.ts`, `test-cache-integration.ts`)

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
- Fields:
  - Раздел (readonly, display section_name)
  - Тип (dropdown checkpoint_types с кнопкой "Создать новый тип")
  - Название (text input):
    - Для предустановленных типов: опционально (placeholder: "По умолчанию — название типа")
    - Для типа `custom`: обязательно (required, validation error если пустой)
  - Дата дедлайна (DatePicker, required)
  - Описание (RichTextEditor, optional)
  - Иконка (IconPicker, optional)
  - Цвет (ColorPicker, optional)
  - Связанные разделы (multi-select, optional)
- Buttons: "Создать" (primary) → `createMutation.mutate()` → close modal, "Отмена" (outline) → close modal
- Validation:
  - `typeId` required
  - `checkpointDate` required
  - `title` required ТОЛЬКО для типа `custom` (динамическая валидация на основе выбранного типа)

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
   - Input "Название":
     - При выборе предустановленного типа → placeholder "По умолчанию — название типа" (optional)
     - При выборе типа "Произвольный" (custom) → required (validation error если пустой)
   - DatePicker "Дата дедлайна" required
   - RichTextEditor "Описание" optional
   - IconPicker "Иконка" optional
   - ColorPicker "Цвет" optional
   - Multi-select "Связанные разделы" optional
   - Click "Создать" с типом "custom" и пустым title → validation error
   - Click "Создать" с предустановленным типом и пустым title → checkpoint создаётся с дефолтным названием типа
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
- Create form: type (code), name, icon (IconPicker), color (ColorPicker), автоматически is_custom=true для новых типов
- Edit modal: name, icon, color (доступно для ВСЕХ типов — админ может редактировать встроенные типы)
- Delete: confirm dialog, проверка на использование в section_checkpoints, нельзя удалить если FK constraint (есть чекпоинты с этим типом)

**Визуальные изменения:**
✅ **ДА** — admin page `/admin/checkpoints/types` с таблицей типов

**Ожидаемый вид:**
- Admin page layout
- Table: columns (type_code, name, icon preview, color preview, is_custom badge, actions)
- Button "Создать тип" (top-right)
- Row actions: Edit (все типы), Delete (все типы, но с проверкой FK constraint)
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

2. **Permission Context в VIEW:** `view_section_checkpoints` использует LEFT JOIN на sections → projects для получения данных о разделе и проекте (responsible_id, manager_id, department_id, team_lead_id). Проверить, что VIEW корректно работает при отсутствии данных (хотя FK RESTRICT это предотвращает).

3. **Linked Sections M:N:** При удалении section CASCADE удаляет записи из checkpoint_section_links. Убедиться, что UI корректно обрабатывает пустой linked_sections array.

4. **Realtime Invalidation:** При изменении checkpoint_types (name, icon, color) нужно инвалидировать `checkpoints.all`, т.к. VIEW использует LEFT JOIN на checkpoint_types для resolved icon/color.

5. **Optimistic Updates:** `useCompleteCheckpoint` оптимистично обновляет `completed_at`, но `status` computed в VIEW. После refetch статус может измениться (напр. completed → completed_late если дедлайн прошел). UI должен корректно отображать loading state.

6. **Timeline Position Calculation:** CheckpointCard position.left зависит от date-to-px mapping в Resource Graph. Убедиться, что чекпоинты корректно выравниваются с timeline grid.

7. **Admin Type Management:** При удалении custom type проверять, что ни один checkpoint не использует этот type (FK RESTRICT предотвращает DELETE, но UI должен показать понятную ошибку).

8. **Rich Text XSS:** `description` field — HTML. Убедиться, что RichTextEditor санитизирует HTML (TipTap по умолчанию безопасен, но проверить конфигурацию).

---

**План готов к реализации. Переходим к Фазе 2.1 (планирование первого этапа)?**
