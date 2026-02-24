# Checkpoints System - Complete Technical Specification

## Database Schema

### Database Tables

#### 1. `checkpoint_types`
Типы чекпоинтов (встроенные + кастомные)

| Столбец | Тип | Ограничения | Описание |
|---------|-----|-------------|----------|
| `type_id` | `uuid` | PK, DEFAULT gen_random_uuid() | ID типа |
| `type` | `text` | NOT NULL, UNIQUE | Код типа (напр. 'task_transfer', 'exam', 'custom') |
| `name` | `text` | NOT NULL | Название типа |
| `icon` | `text` | NULL | Lucide icon name (напр. 'calendar', 'check-circle') |
| `color` | `text` | NULL | Hex color (напр. '#3b82f6', '#10b981') |
| `is_custom` | `boolean` | NOT NULL, DEFAULT false | TRUE если создан пользователем |
| `created_by` | `uuid` | NULL, FK → profiles(user_id) ON DELETE SET NULL | Создатель (NULL для встроенных) |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT now() | Дата создания |

**Индексы:**
```sql
CREATE INDEX idx_checkpoint_types_custom ON checkpoint_types(is_custom);
```

---

#### 2. `section_checkpoints`
Чекпоинты привязанные к разделам

| Столбец | Тип | Ограничения | Описание |
|---------|-----|-------------|----------|
| `checkpoint_id` | `uuid` | PK, DEFAULT gen_random_uuid() | ID чекпоинта |
| `section_id` | `uuid` | NOT NULL, FK → sections(section_id) ON DELETE CASCADE | Раздел (основная привязка) |
| `type_id` | `uuid` | NOT NULL, FK → checkpoint_types(type_id) ON DELETE RESTRICT | Тип чекпоинта |
| `title` | `text` | NOT NULL | Название |
| `description` | `text` | NULL | Описание (rich text — HTML) |
| `checkpoint_date` | `date` | NOT NULL | Дата дедлайна |
| `custom_icon` | `text` | NULL | Кастомная иконка (перекрывает type.icon) |
| `custom_color` | `text` | NULL | Кастомный цвет (перекрывает type.color) |
| `completed_at` | `timestamptz` | NULL | Дата выполнения (NULL = не выполнено) |
| `completed_by` | `uuid` | NULL, FK → profiles(user_id) ON DELETE SET NULL | Кто отметил выполнение |
| `created_by` | `uuid` | NULL, FK → profiles(user_id) ON DELETE SET NULL | Создатель |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT now() | Дата создания |
| `updated_at` | `timestamptz` | NOT NULL, DEFAULT now() | Последнее изменение |

**Индексы:**
```sql
-- Фильтр незавершённых чекпоинтов по секции
CREATE INDEX idx_section_checkpoints_uncompleted
  ON section_checkpoints(section_id, checkpoint_date)
  WHERE completed_at IS NULL;

-- Выборка завершённых чекпоинтов
CREATE INDEX idx_section_checkpoints_completed
  ON section_checkpoints(completed_at)
  WHERE completed_at IS NOT NULL;

-- FK для быстрого поиска по выполнившему
CREATE INDEX idx_section_checkpoints_completed_by
  ON section_checkpoints(completed_by)
  WHERE completed_by IS NOT NULL;
```

---

#### 3. `checkpoint_section_links`
Junction table для связи чекпоинтов с другими разделами (M:N)

| Столбец | Тип | Ограничения | Описание |
|---------|-----|-------------|----------|
| `checkpoint_id` | `uuid` | NOT NULL, FK → section_checkpoints(checkpoint_id) ON DELETE CASCADE | Чекпоинт |
| `section_id` | `uuid` | NOT NULL, FK → sections(section_id) ON DELETE CASCADE | Связанный раздел |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT now() | Дата связи |

**Composite Primary Key:**
```sql
PRIMARY KEY (checkpoint_id, section_id)
```

**Индексы:**
```sql
CREATE INDEX idx_checkpoint_section_links_section_id
  ON checkpoint_section_links(section_id);
```

---

#### 4. `checkpoint_audit`
Event-based audit trail (макс. 50 записей на чекпоинт)

| Столбец | Тип | Ограничения | Описание |
|---------|-----|-------------|----------|
| `audit_id` | `uuid` | PK, DEFAULT gen_random_uuid() | ID записи |
| `checkpoint_id` | `uuid` | NOT NULL, FK → section_checkpoints(checkpoint_id) ON DELETE CASCADE | Чекпоинт |
| `changed_by` | `uuid` | NULL, FK → auth.users(id) ON DELETE SET NULL | Кто изменил |
| `changed_at` | `timestamptz` | NOT NULL, DEFAULT now() | Когда изменено |
| `operation_type` | `text` | NOT NULL, CHECK IN ('CREATE', 'UPDATE', 'DELETE', 'COMPLETE', 'UNCOMPLETE') | Тип операции |
| `field_name` | `text` | NOT NULL | Изменённое поле (title, description, checkpoint_date, linked_sections, completed_at, etc.) |
| `old_value` | `text` | NULL | Старое значение (text serialized) |
| `new_value` | `text` | NULL | Новое значение (text serialized) |

**Индексы:**
```sql
CREATE INDEX idx_checkpoint_audit_checkpoint_id
  ON checkpoint_audit(checkpoint_id);

CREATE INDEX idx_checkpoint_audit_changed_at
  ON checkpoint_audit(checkpoint_id, changed_at DESC);

CREATE INDEX idx_checkpoint_audit_changed_by
  ON checkpoint_audit(changed_by)
  WHERE changed_by IS NOT NULL;
```

**ВАЖНО:** Приложение поддерживает FIFO очередь (max 50 записей на checkpoint). Удаление старых записей при превышении лимита — ОБЯЗАННОСТЬ ПРИЛОЖЕНИЯ.

---

### View: `view_section_checkpoints`

Агрегированное представление со статусом, linked sections, permission context

```sql
CREATE VIEW public.view_section_checkpoints AS
SELECT
  sc.checkpoint_id,
  sc.section_id,
  sc.type_id,
  ct.type AS type_code,
  ct.name AS type_name,
  ct.is_custom,
  sc.title,
  sc.description,
  sc.checkpoint_date,

  -- Resolved icon/color (custom override OR type default)
  COALESCE(sc.custom_icon, ct.icon) AS icon,
  COALESCE(sc.custom_color, ct.color) AS color,

  -- Completion tracking
  sc.completed_at,
  sc.completed_by,

  -- Computed status based on completed_at and checkpoint_date
  CASE
    WHEN sc.completed_at IS NOT NULL AND sc.completed_at::date <= sc.checkpoint_date
      THEN 'completed'
    WHEN sc.completed_at IS NOT NULL AND sc.completed_at::date > sc.checkpoint_date
      THEN 'completed_late'
    WHEN sc.completed_at IS NULL AND CURRENT_DATE > sc.checkpoint_date
      THEN 'overdue'
    ELSE 'pending'
  END AS status,

  -- Status label in Russian
  CASE
    WHEN sc.completed_at IS NOT NULL AND sc.completed_at::date <= sc.checkpoint_date
      THEN 'Выполнено'
    WHEN sc.completed_at IS NOT NULL AND sc.completed_at::date > sc.checkpoint_date
      THEN 'Выполнено с опозданием'
    WHEN sc.completed_at IS NULL AND CURRENT_DATE > sc.checkpoint_date
      THEN 'Просрочено'
    ELSE 'Ожидается'
  END AS status_label,

  -- Audit timestamps
  sc.created_by,
  sc.created_at,
  sc.updated_at,

  -- Permission context: section responsible
  sec.section_responsible,

  -- Permission context: project manager (via section -> project)
  p.project_manager,

  -- Aggregate linked sections as JSON array
  COALESCE(
    (SELECT jsonb_agg(jsonb_build_object(
      'section_id', csl.section_id,
      'section_name', s.section_name
    ) ORDER BY s.section_name)
    FROM public.checkpoint_section_links csl
    JOIN public.sections s ON s.section_id = csl.section_id
    WHERE csl.checkpoint_id = sc.checkpoint_id),
    '[]'::jsonb
  ) AS linked_sections,

  -- Count of linked sections (useful for UI)
  (SELECT COUNT(*)::int
   FROM public.checkpoint_section_links csl
   WHERE csl.checkpoint_id = sc.checkpoint_id) AS linked_sections_count

FROM public.section_checkpoints sc
LEFT JOIN public.checkpoint_types ct ON ct.type_id = sc.type_id
LEFT JOIN public.sections sec ON sec.section_id = sc.section_id
LEFT JOIN public.projects p ON p.project_id = sec.section_project_id;
```

---

## Data Flow & Operations

### 1. CREATE Checkpoint

**User Action:** Create new checkpoint
**Permissions:**
- Section responsible (`section_responsible == auth.uid()`)
- Project manager (`project_manager == auth.uid()`)
- Admins (`role = 'admin'`)

**Server Action:**
```typescript
// modules/checkpoints/actions/checkpoints.ts
export async function createCheckpoint(input: {
  sectionId: string
  typeId: string
  title: string
  description?: string
  checkpointDate: string // ISO date
  customIcon?: string | null
  customColor?: string | null
  linkedSectionIds?: string[] // Optional linked sections
}): Promise<ActionResult<Checkpoint>>
```

**SQL Steps:**
```sql
-- 1. Insert checkpoint
INSERT INTO section_checkpoints (
  section_id, type_id, title, description, checkpoint_date,
  custom_icon, custom_color, created_by
) VALUES ($1, $2, $3, $4, $5, $6, $7, auth.uid())
RETURNING *;

-- 2. Insert linked sections (if any)
INSERT INTO checkpoint_section_links (checkpoint_id, section_id)
SELECT $checkpoint_id, unnest($linked_section_ids);

-- 3. Insert CREATE audit entry
INSERT INTO checkpoint_audit (
  checkpoint_id, changed_by, operation_type, field_name, new_value
) VALUES
  ($checkpoint_id, auth.uid(), 'CREATE', 'title', $title),
  ($checkpoint_id, auth.uid(), 'CREATE', 'checkpoint_date', $checkpoint_date),
  ...;
```

**Cache Invalidation:**
- `queryKeys.checkpoints.all`
- `queryKeys.sections.detail(sectionId)`
- `queryKeys.resourceGraph.all` (если чекпоинты видны на графике)

---

### 2. UPDATE Checkpoint

**User Action:** Update checkpoint fields
**Permissions:** Same as CREATE

**Server Action:**
```typescript
export async function updateCheckpoint(input: {
  checkpointId: string
  title?: string
  description?: string
  checkpointDate?: string
  customIcon?: string | null
  customColor?: string | null
  linkedSectionIds?: string[] // Replaces all links
}): Promise<ActionResult<Checkpoint>>
```

**SQL Steps:**
```sql
-- 1. Get old values for audit
SELECT title, description, checkpoint_date, custom_icon, custom_color
FROM section_checkpoints WHERE checkpoint_id = $checkpoint_id;

-- 2. Update checkpoint
UPDATE section_checkpoints SET
  title = COALESCE($title, title),
  description = COALESCE($description, description),
  checkpoint_date = COALESCE($checkpoint_date, checkpoint_date),
  custom_icon = COALESCE($custom_icon, custom_icon),
  custom_color = COALESCE($custom_color, custom_color),
  updated_at = now()
WHERE checkpoint_id = $checkpoint_id
RETURNING *;

-- 3. Update linked sections (replace all)
DELETE FROM checkpoint_section_links WHERE checkpoint_id = $checkpoint_id;
INSERT INTO checkpoint_section_links (checkpoint_id, section_id)
SELECT $checkpoint_id, unnest($linked_section_ids);

-- 4. Insert UPDATE audit entries (only changed fields)
INSERT INTO checkpoint_audit (checkpoint_id, changed_by, operation_type, field_name, old_value, new_value)
VALUES ($checkpoint_id, auth.uid(), 'UPDATE', 'title', $old_title, $new_title);
```

**Cache Invalidation:**
- `queryKeys.checkpoints.all`
- `queryKeys.checkpoints.detail(checkpointId)`

---

### 3. COMPLETE / UNCOMPLETE Checkpoint

**User Action:** Mark checkpoint as completed or revert completion
**Permissions:** Same as CREATE

**Server Action:**
```typescript
export async function completeCheckpoint(input: {
  checkpointId: string
  completed: boolean // true = mark complete, false = uncomplete
}): Promise<ActionResult<Checkpoint>>
```

**SQL Steps:**
```sql
-- 1. Get old completed_at value
SELECT completed_at FROM section_checkpoints WHERE checkpoint_id = $checkpoint_id;

-- 2. Update completion status
UPDATE section_checkpoints SET
  completed_at = CASE WHEN $completed THEN now() ELSE NULL END,
  completed_by = CASE WHEN $completed THEN auth.uid() ELSE NULL END,
  updated_at = now()
WHERE checkpoint_id = $checkpoint_id
RETURNING *;

-- 3. Insert COMPLETE/UNCOMPLETE audit entry
INSERT INTO checkpoint_audit (
  checkpoint_id, changed_by, operation_type, field_name, old_value, new_value
) VALUES (
  $checkpoint_id,
  auth.uid(),
  CASE WHEN $completed THEN 'COMPLETE' ELSE 'UNCOMPLETE' END,
  'completed_at',
  $old_completed_at::text,
  $new_completed_at::text
);
```

**Cache Invalidation:**
- `queryKeys.checkpoints.all`
- `queryKeys.checkpoints.detail(checkpointId)`

---

### 4. DELETE Checkpoint

**User Action:** Delete checkpoint
**Permissions:** Same as CREATE

**Server Action:**
```typescript
export async function deleteCheckpoint(input: {
  checkpointId: string
}): Promise<ActionResult<void>>
```

**SQL Steps:**
```sql
-- 1. Insert DELETE audit entry (BEFORE deletion due to CASCADE)
INSERT INTO checkpoint_audit (
  checkpoint_id, changed_by, operation_type, field_name, old_value
) VALUES ($checkpoint_id, auth.uid(), 'DELETE', 'checkpoint', $checkpoint_data_json);

-- 2. Delete checkpoint (CASCADE deletes linked sections and audit)
DELETE FROM section_checkpoints WHERE checkpoint_id = $checkpoint_id;
```

**Cache Invalidation:**
- `queryKeys.checkpoints.all`
- `queryKeys.sections.detail(sectionId)`

---

### 5. GET Checkpoints (List)

**Query:**
```typescript
export async function getCheckpoints(filters?: {
  sectionId?: string
  projectId?: string // via section -> project join
  status?: 'pending' | 'completed' | 'completed_late' | 'overdue' | 'all'
  dateFrom?: string // checkpoint_date >= dateFrom
  dateTo?: string // checkpoint_date <= dateTo
}): Promise<ActionResult<Checkpoint[]>>
```

**SQL (from VIEW):**
```sql
SELECT * FROM view_section_checkpoints
WHERE
  ($section_id IS NULL OR section_id = $section_id)
  AND ($project_id IS NULL OR section_id IN (
    SELECT section_id FROM sections WHERE section_project_id = $project_id
  ))
  AND ($status IS NULL OR $status = 'all' OR status = $status)
  AND ($date_from IS NULL OR checkpoint_date >= $date_from)
  AND ($date_to IS NULL OR checkpoint_date <= $date_to)
ORDER BY checkpoint_date ASC;
```

---

### 6. GET Checkpoint (Detail)

**Query:**
```typescript
export async function getCheckpoint(checkpointId: string): Promise<ActionResult<Checkpoint>>
```

**SQL:**
```sql
SELECT * FROM view_section_checkpoints WHERE checkpoint_id = $checkpoint_id;
```

---

### 7. GET Audit History

**Query:**
```typescript
export async function getCheckpointAudit(checkpointId: string): Promise<ActionResult<AuditEntry[]>>
```

**SQL:**
```sql
SELECT
  audit_id,
  changed_by,
  changed_at,
  operation_type,
  field_name,
  old_value,
  new_value,
  -- Join user profile for display
  p.user_firstname,
  p.user_lastname,
  p.user_avatar_url
FROM checkpoint_audit ca
LEFT JOIN profiles p ON p.user_id = ca.changed_by
WHERE ca.checkpoint_id = $checkpoint_id
ORDER BY changed_at DESC
LIMIT 50;
```

---

## Permission Logic

**Permission Check (Server Action):**
```typescript
// Permission helper
async function canManageCheckpoint(sectionId: string, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('view_section_checkpoints')
    .select('section_responsible, project_manager')
    .eq('section_id', sectionId)
    .single()

  if (!data) return false

  // Check: section responsible, project manager, or admin
  return (
    data.section_responsible === userId ||
    data.project_manager === userId ||
    await isAdmin(userId)
  )
}
```

**Доступ на чтение:** Все пользователи видят чекпоинты разделов, к которым имеют доступ
**Доступ на изменение:** Только section_responsible, project_manager, admins

---

## UI/UX Requirements

### 1. Checkpoint Card (Resource Graph Timeline)

**Компонент:** `CheckpointCard.tsx`
**Дизайн:** Маленькая карточка на timeline (как event marker)

**Визуал:**
- Иконка (Lucide): `icon` из VIEW (custom override или type default)
- Цвет: `color` из VIEW
- Позиция: `checkpoint_date` (вертикальная полоса на timeline)
- Статус badge: `status_label` с цветовой индикацией:
  - `pending` → серый
  - `completed` → зелёный
  - `completed_late` → жёлтый
  - `overdue` → красный

**Interaction:**
- Click → открыть `CheckpointDetailModal`
- Hover → tooltip с `title` и `checkpoint_date`

**Данные:**
- Источник: `view_section_checkpoints` (via cache)
- Поля: `checkpoint_id`, `title`, `checkpoint_date`, `icon`, `color`, `status`, `status_label`

---

### 2. Checkpoint Detail Modal

**Компонент:** `CheckpointDetailModal.tsx`
**Дизайн:** Slide-in panel справа (как `SectionModal.tsx`)

**Секции:**

#### Header
- **Title:** Inline edit (`title` field)
- **Type badge:** `type_name` + `icon` (readonly)
- **Status badge:** `status_label` с цветом
- **Close button:** X

#### General Tab
- **Дата дедлайна:** Date picker (`checkpoint_date`)
- **Описание:** Rich text editor (`description` field, HTML)
- **Иконка:** Icon picker (Lucide) → saves to `custom_icon`
- **Цвет:** Color picker → saves to `custom_color`

#### Linked Sections Tab
- **Список связанных разделов:** (`linked_sections` array)
  - Section name
  - Button "Удалить связь"
- **Button "Добавить раздел":** Multi-select dropdown (sections from project)

#### Audit History Tab
- **Timeline audit entries:** (`checkpoint_audit` via `getCheckpointAudit()`)
  - User avatar + name
  - Operation type (CREATE, UPDATE, DELETE, COMPLETE, UNCOMPLETE)
  - Field changed
  - Old → New values
  - Timestamp

#### Footer Actions
- **Button "Отметить выполненным":** → `completeCheckpoint(id, true)` (if status != completed)
- **Button "Отменить выполнение":** → `completeCheckpoint(id, false)` (if status == completed or completed_late)
- **Button "Удалить чекпоинт":** → `deleteCheckpoint(id)` (with confirmation dialog)

**Данные:**
- Источник: `view_section_checkpoints.detail(id)` (cache query)
- Мутации: `updateCheckpoint`, `completeCheckpoint`, `deleteCheckpoint` (cache mutations)

**Permission Guard:**
```tsx
if (!canManageCheckpoint) {
  return <ReadOnlyView />
}
```

---

### 3. Create Checkpoint Modal

**Компонент:** `CheckpointCreateModal.tsx`
**Дизайн:** Center modal (не slide-in, т.к. это создание)

**Форма:**
- **Раздел:** Readonly (pre-filled from context)
- **Тип:** Dropdown (`checkpoint_types` — predefined + custom)
  - Button "Создать новый тип" → `TypeCreateModal`
- **Название:** Text input (required)
- **Дата дедлайна:** Date picker (required)
- **Описание:** Rich text editor (optional)
- **Иконка:** Icon picker (optional, overrides type icon)
- **Цвет:** Color picker (optional, overrides type color)
- **Связанные разделы:** Multi-select (optional)

**Кнопки:**
- **"Создать":** → `createCheckpoint(data)` → close modal → invalidate cache
- **"Отмена":** → close modal

**Данные:**
- Мутация: `createCheckpoint` (cache mutation)

---

### 4. Checkpoint Type Manager (Admin)

**Компонент:** `CheckpointTypeManager.tsx`
**Местоположение:** Admin panel (`/admin/checkpoints/types`)

**Функции:**
- Список всех типов (`checkpoint_types`)
- Create custom type
- Edit custom type (name, icon, color)
- Delete custom type (if no checkpoints use it)

**Данные:**
- Query: `getCheckpointTypes()` → `checkpoint_types` table
- Mutations: `createCheckpointType`, `updateCheckpointType`, `deleteCheckpointType`

---

## Cache Module Integration

### Query Keys

**Файл:** `modules/cache/keys/query-keys.ts`

```typescript
export const queryKeys = {
  // ... existing keys

  // -------------------------------------------------------------------------
  // Checkpoints
  // -------------------------------------------------------------------------
  checkpoints: {
    all: ['checkpoints'] as const,
    lists: () => [...queryKeys.checkpoints.all, 'list'] as const,
    list: (filters?: CheckpointFilters) => [...queryKeys.checkpoints.lists(), filters] as const,
    details: () => [...queryKeys.checkpoints.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.checkpoints.details(), id] as const,
    audit: (checkpointId: string) => [...queryKeys.checkpoints.detail(checkpointId), 'audit'] as const,
    bySection: (sectionId: string) => [...queryKeys.checkpoints.all, 'section', sectionId] as const,
    byProject: (projectId: string) => [...queryKeys.checkpoints.all, 'project', projectId] as const,
  },

  checkpointTypes: {
    all: ['checkpoint-types'] as const,
    list: () => [...queryKeys.checkpointTypes.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.checkpointTypes.all, 'detail', id] as const,
  },
}

export interface CheckpointFilters extends BaseFilters {
  sectionId?: string
  projectId?: string
  status?: 'pending' | 'completed' | 'completed_late' | 'overdue' | 'all'
  dateFrom?: string
  dateTo?: string
}
```

---

### Server Actions

**Файл:** `modules/checkpoints/actions/checkpoints.ts`

```typescript
'use server'

import { createClient } from '@/utils/supabase/server'
import type { ActionResult } from '@/modules/cache'

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
  icon: string | null
  color: string | null
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

// GET list
export async function getCheckpoints(filters?: CheckpointFilters): Promise<ActionResult<Checkpoint[]>> {
  try {
    const supabase = await createClient()
    let query = supabase.from('view_section_checkpoints').select('*')

    if (filters?.sectionId) {
      query = query.eq('section_id', filters.sectionId)
    }
    if (filters?.projectId) {
      // Need to join via sections table
      const { data: sections } = await supabase
        .from('sections')
        .select('section_id')
        .eq('section_project_id', filters.projectId)
      const sectionIds = sections?.map(s => s.section_id) || []
      query = query.in('section_id', sectionIds)
    }
    if (filters?.status && filters.status !== 'all') {
      query = query.eq('status', filters.status)
    }
    if (filters?.dateFrom) {
      query = query.gte('checkpoint_date', filters.dateFrom)
    }
    if (filters?.dateTo) {
      query = query.lte('checkpoint_date', filters.dateTo)
    }

    query = query.order('checkpoint_date', { ascending: true })

    const { data, error } = await query
    if (error) return { success: false, error: error.message }
    return { success: true, data }
  } catch (error) {
    return { success: false, error: 'Ошибка загрузки чекпоинтов' }
  }
}

// GET detail
export async function getCheckpoint(checkpointId: string): Promise<ActionResult<Checkpoint>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('view_section_checkpoints')
      .select('*')
      .eq('checkpoint_id', checkpointId)
      .single()

    if (error) return { success: false, error: error.message }
    return { success: true, data }
  } catch (error) {
    return { success: false, error: 'Ошибка загрузки чекпоинта' }
  }
}

// CREATE
export async function createCheckpoint(input: {
  sectionId: string
  typeId: string
  title: string
  description?: string
  checkpointDate: string
  customIcon?: string | null
  customColor?: string | null
  linkedSectionIds?: string[]
}): Promise<ActionResult<Checkpoint>> {
  try {
    const supabase = await createClient()

    // 1. Permission check
    const canManage = await canManageCheckpoint(input.sectionId)
    if (!canManage) {
      return { success: false, error: 'Недостаточно прав' }
    }

    // 2. Insert checkpoint
    const { data: checkpoint, error: insertError } = await supabase
      .from('section_checkpoints')
      .insert({
        section_id: input.sectionId,
        type_id: input.typeId,
        title: input.title,
        description: input.description || null,
        checkpoint_date: input.checkpointDate,
        custom_icon: input.customIcon || null,
        custom_color: input.customColor || null,
      })
      .select()
      .single()

    if (insertError) return { success: false, error: insertError.message }

    // 3. Insert linked sections
    if (input.linkedSectionIds && input.linkedSectionIds.length > 0) {
      const links = input.linkedSectionIds.map(sectionId => ({
        checkpoint_id: checkpoint.checkpoint_id,
        section_id: sectionId,
      }))
      await supabase.from('checkpoint_section_links').insert(links)
    }

    // 4. Insert CREATE audit entries
    const auditEntries = [
      {
        checkpoint_id: checkpoint.checkpoint_id,
        operation_type: 'CREATE',
        field_name: 'title',
        new_value: input.title,
      },
      {
        checkpoint_id: checkpoint.checkpoint_id,
        operation_type: 'CREATE',
        field_name: 'checkpoint_date',
        new_value: input.checkpointDate,
      },
    ]
    await supabase.from('checkpoint_audit').insert(auditEntries)

    // 5. Fetch full checkpoint from VIEW
    const { data: fullCheckpoint } = await supabase
      .from('view_section_checkpoints')
      .select('*')
      .eq('checkpoint_id', checkpoint.checkpoint_id)
      .single()

    return { success: true, data: fullCheckpoint }
  } catch (error) {
    return { success: false, error: 'Ошибка создания чекпоинта' }
  }
}

// UPDATE
export async function updateCheckpoint(input: {
  checkpointId: string
  title?: string
  description?: string
  checkpointDate?: string
  customIcon?: string | null
  customColor?: string | null
  linkedSectionIds?: string[]
}): Promise<ActionResult<Checkpoint>> {
  try {
    const supabase = await createClient()

    // 1. Get current checkpoint for permission check and audit
    const { data: current } = await supabase
      .from('section_checkpoints')
      .select('section_id, title, description, checkpoint_date, custom_icon, custom_color')
      .eq('checkpoint_id', input.checkpointId)
      .single()

    if (!current) return { success: false, error: 'Чекпоинт не найден' }

    const canManage = await canManageCheckpoint(current.section_id)
    if (!canManage) return { success: false, error: 'Недостаточно прав' }

    // 2. Update checkpoint
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (input.title !== undefined) updates.title = input.title
    if (input.description !== undefined) updates.description = input.description
    if (input.checkpointDate !== undefined) updates.checkpoint_date = input.checkpointDate
    if (input.customIcon !== undefined) updates.custom_icon = input.customIcon
    if (input.customColor !== undefined) updates.custom_color = input.customColor

    const { error: updateError } = await supabase
      .from('section_checkpoints')
      .update(updates)
      .eq('checkpoint_id', input.checkpointId)

    if (updateError) return { success: false, error: updateError.message }

    // 3. Update linked sections (replace all)
    if (input.linkedSectionIds !== undefined) {
      await supabase
        .from('checkpoint_section_links')
        .delete()
        .eq('checkpoint_id', input.checkpointId)

      if (input.linkedSectionIds.length > 0) {
        const links = input.linkedSectionIds.map(sectionId => ({
          checkpoint_id: input.checkpointId,
          section_id: sectionId,
        }))
        await supabase.from('checkpoint_section_links').insert(links)
      }
    }

    // 4. Insert UPDATE audit entries (only changed fields)
    const auditEntries = []
    if (input.title && input.title !== current.title) {
      auditEntries.push({
        checkpoint_id: input.checkpointId,
        operation_type: 'UPDATE',
        field_name: 'title',
        old_value: current.title,
        new_value: input.title,
      })
    }
    // ... similar for other fields

    if (auditEntries.length > 0) {
      await supabase.from('checkpoint_audit').insert(auditEntries)
    }

    // 5. Fetch updated checkpoint from VIEW
    const { data: updated } = await supabase
      .from('view_section_checkpoints')
      .select('*')
      .eq('checkpoint_id', input.checkpointId)
      .single()

    return { success: true, data: updated }
  } catch (error) {
    return { success: false, error: 'Ошибка обновления чекпоинта' }
  }
}

// COMPLETE / UNCOMPLETE
export async function completeCheckpoint(input: {
  checkpointId: string
  completed: boolean
}): Promise<ActionResult<Checkpoint>> {
  try {
    const supabase = await createClient()

    // Permission check
    const { data: current } = await supabase
      .from('section_checkpoints')
      .select('section_id, completed_at')
      .eq('checkpoint_id', input.checkpointId)
      .single()

    if (!current) return { success: false, error: 'Чекпоинт не найден' }

    const canManage = await canManageCheckpoint(current.section_id)
    if (!canManage) return { success: false, error: 'Недостаточно прав' }

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Не авторизован' }

    // Update completion status
    const updates = {
      completed_at: input.completed ? new Date().toISOString() : null,
      completed_by: input.completed ? user.id : null,
      updated_at: new Date().toISOString(),
    }

    const { error: updateError } = await supabase
      .from('section_checkpoints')
      .update(updates)
      .eq('checkpoint_id', input.checkpointId)

    if (updateError) return { success: false, error: updateError.message }

    // Insert audit entry
    await supabase.from('checkpoint_audit').insert({
      checkpoint_id: input.checkpointId,
      operation_type: input.completed ? 'COMPLETE' : 'UNCOMPLETE',
      field_name: 'completed_at',
      old_value: current.completed_at,
      new_value: updates.completed_at,
    })

    // Fetch updated checkpoint
    const { data: updated } = await supabase
      .from('view_section_checkpoints')
      .select('*')
      .eq('checkpoint_id', input.checkpointId)
      .single()

    return { success: true, data: updated }
  } catch (error) {
    return { success: false, error: 'Ошибка изменения статуса' }
  }
}

// DELETE
export async function deleteCheckpoint(input: {
  checkpointId: string
}): Promise<ActionResult<void>> {
  try {
    const supabase = await createClient()

    // Permission check
    const { data: current } = await supabase
      .from('section_checkpoints')
      .select('section_id, title, checkpoint_date')
      .eq('checkpoint_id', input.checkpointId)
      .single()

    if (!current) return { success: false, error: 'Чекпоинт не найден' }

    const canManage = await canManageCheckpoint(current.section_id)
    if (!canManage) return { success: false, error: 'Недостаточно прав' }

    // Insert DELETE audit entry (before CASCADE deletion)
    await supabase.from('checkpoint_audit').insert({
      checkpoint_id: input.checkpointId,
      operation_type: 'DELETE',
      field_name: 'checkpoint',
      old_value: JSON.stringify(current),
    })

    // Delete checkpoint (CASCADE will delete links and audit)
    const { error: deleteError } = await supabase
      .from('section_checkpoints')
      .delete()
      .eq('checkpoint_id', input.checkpointId)

    if (deleteError) return { success: false, error: deleteError.message }

    return { success: true, data: undefined }
  } catch (error) {
    return { success: false, error: 'Ошибка удаления чекпоинта' }
  }
}

// GET audit history
export async function getCheckpointAudit(checkpointId: string): Promise<ActionResult<AuditEntry[]>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('checkpoint_audit')
      .select(`
        audit_id,
        changed_by,
        changed_at,
        operation_type,
        field_name,
        old_value,
        new_value,
        profiles:changed_by (
          user_firstname,
          user_lastname,
          user_avatar_url
        )
      `)
      .eq('checkpoint_id', checkpointId)
      .order('changed_at', { ascending: false })
      .limit(50)

    if (error) return { success: false, error: error.message }
    return { success: true, data }
  } catch (error) {
    return { success: false, error: 'Ошибка загрузки истории' }
  }
}

// Permission helper
async function canManageCheckpoint(sectionId: string): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { data } = await supabase
    .from('view_section_checkpoints')
    .select('section_responsible, project_manager')
    .eq('section_id', sectionId)
    .single()

  if (!data) return false

  // Check: section responsible, project manager, or admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  return (
    data.section_responsible === user.id ||
    data.project_manager === user.id ||
    profile?.role === 'admin'
  )
}
```

---

### Cache Hooks

**Файл:** `modules/checkpoints/hooks/use-checkpoints.ts`

```typescript
'use client'

import {
  createCacheQuery,
  createDetailCacheQuery,
  createCacheMutation,
  createUpdateMutation,
  createDeleteMutation,
  queryKeys,
  staleTimePresets,
} from '@/modules/cache'
import {
  getCheckpoints,
  getCheckpoint,
  createCheckpoint,
  updateCheckpoint,
  completeCheckpoint,
  deleteCheckpoint,
  getCheckpointAudit,
  type Checkpoint,
  type CheckpointFilters,
} from '../actions/checkpoints'

// ============================================================================
// Queries
// ============================================================================

/**
 * Список чекпоинтов с фильтрами
 */
export const useCheckpoints = createCacheQuery<Checkpoint[], CheckpointFilters>({
  queryKey: (filters) => queryKeys.checkpoints.list(filters),
  queryFn: (filters) => getCheckpoints(filters),
  staleTime: staleTimePresets.fast, // 2 min
})

/**
 * Детальная информация о чекпоинте
 */
export const useCheckpoint = createDetailCacheQuery<Checkpoint>({
  queryKey: (id) => queryKeys.checkpoints.detail(id),
  queryFn: (id) => getCheckpoint(id),
  staleTime: staleTimePresets.fast,
})

/**
 * Audit history для чекпоинта
 */
export const useCheckpointAudit = createDetailCacheQuery({
  queryKey: (checkpointId) => queryKeys.checkpoints.audit(checkpointId),
  queryFn: (checkpointId) => getCheckpointAudit(checkpointId),
  staleTime: staleTimePresets.medium, // 3 min
})

// ============================================================================
// Mutations
// ============================================================================

/**
 * Создание чекпоинта
 */
export const useCreateCheckpoint = createCacheMutation({
  mutationFn: createCheckpoint,
  invalidateKeys: [
    queryKeys.checkpoints.all,
    queryKeys.sections.all, // Section detail may show checkpoints
    queryKeys.resourceGraph.all, // Resource graph may show checkpoints
  ],
})

/**
 * Обновление чекпоинта с optimistic update
 */
export const useUpdateCheckpoint = createUpdateMutation({
  mutationFn: updateCheckpoint,
  listQueryKey: queryKeys.checkpoints.lists(),
  getId: (input) => input.checkpointId,
  getItemId: (item) => item.checkpoint_id,
  merge: (item, input) => ({
    ...item,
    title: input.title ?? item.title,
    description: input.description ?? item.description,
    checkpoint_date: input.checkpointDate ?? item.checkpoint_date,
    custom_icon: input.customIcon ?? item.custom_icon,
    custom_color: input.customColor ?? item.custom_color,
  }),
  invalidateKeys: [queryKeys.checkpoints.all],
})

/**
 * Отметка выполнения/отмена выполнения
 */
export const useCompleteCheckpoint = createUpdateMutation({
  mutationFn: completeCheckpoint,
  listQueryKey: queryKeys.checkpoints.lists(),
  getId: (input) => input.checkpointId,
  getItemId: (item) => item.checkpoint_id,
  merge: (item, input) => ({
    ...item,
    completed_at: input.completed ? new Date().toISOString() : null,
    completed_by: input.completed ? item.completed_by : null,
    // Status will be recomputed on refetch from VIEW
  }),
  invalidateKeys: [queryKeys.checkpoints.all],
})

/**
 * Удаление чекпоинта
 */
export const useDeleteCheckpoint = createDeleteMutation({
  mutationFn: deleteCheckpoint,
  listQueryKey: queryKeys.checkpoints.lists(),
  getId: (input) => input.checkpointId,
  getItemId: (item) => item.checkpoint_id,
  invalidateKeys: [
    queryKeys.checkpoints.all,
    queryKeys.sections.all,
    queryKeys.resourceGraph.all,
  ],
})
```

---

### Realtime Sync Configuration

**Файл:** `modules/cache/realtime/config.ts`

```typescript
export const realtimeSubscriptions: TableSubscription[] = [
  // ... existing subscriptions

  // ============================================================================
  // Checkpoints
  // ============================================================================
  {
    table: 'section_checkpoints',
    invalidateKeys: [
      queryKeys.checkpoints.all,
      queryKeys.sections.all, // Sections may show checkpoint counts
      queryKeys.resourceGraph.all, // Resource graph shows checkpoints
    ],
  },
  {
    table: 'checkpoint_section_links',
    invalidateKeys: [
      queryKeys.checkpoints.all, // Linked sections changed
    ],
  },
  {
    table: 'checkpoint_audit',
    invalidateKeys: [
      // Invalidate audit queries when new audit entries added
      [...queryKeys.checkpoints.all, 'audit'],
    ],
  },
  {
    table: 'checkpoint_types',
    invalidateKeys: [
      queryKeys.checkpointTypes.all,
      queryKeys.checkpoints.all, // Type names/icons may change
    ],
  },
]
```

**SQL (добавить таблицы в Realtime publication):**
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE section_checkpoints;
ALTER PUBLICATION supabase_realtime ADD TABLE checkpoint_section_links;
ALTER PUBLICATION supabase_realtime ADD TABLE checkpoint_audit;
ALTER PUBLICATION supabase_realtime ADD TABLE checkpoint_types;
```

---

## Resource Graph Visual Style Integration

### Design Language

**Все компоненты чекпоинтов должны следовать дизайну модуля Resource Graph:**

#### Color Palette
```typescript
// Primary colors (from Resource Graph theme)
const colors = {
  // Dark backgrounds
  background: 'hsl(var(--background))',        // Dark charcoal
  backgroundHover: 'hsl(var(--accent))',       // Lighter on hover

  // Amber accents (primary)
  amber: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    400: '#fbbf24',  // Primary amber
    500: '#f59e0b',
    600: '#d97706',
  },

  // Status colors
  status: {
    pending: '#6b7280',      // Gray
    completed: '#10b981',    // Green
    completedLate: '#f59e0b', // Amber/Yellow
    overdue: '#ef4444',      // Red
  },

  // Neutral grays
  border: 'hsl(var(--border))',
  muted: 'hsl(var(--muted))',
  mutedForeground: 'hsl(var(--muted-foreground))',
}
```

#### Typography
```typescript
// Headings
const headingClasses = 'font-semibold text-foreground'

// Body text
const textClasses = 'text-sm text-muted-foreground'

// Labels
const labelClasses = 'text-xs font-medium text-muted-foreground uppercase tracking-wide'
```

#### Spacing & Layout
```typescript
// Card padding
const cardPadding = 'p-4'

// Section spacing
const sectionSpacing = 'space-y-4'

// Grid gaps
const gridGap = 'gap-3'
```

#### Borders & Shadows
```typescript
// Border radius
const borderRadius = 'rounded-lg'

// Border styles
const borderStyle = 'border border-border/50'

// Shadows
const shadow = 'shadow-sm hover:shadow-md transition-shadow'
```

---

### Modal Components Design

#### CheckpointDetailModal.tsx

**Layout Pattern (matches SectionModal.tsx):**

```tsx
'use client'

import { X, Calendar, CheckCircle2, Edit3, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCheckpoint, useUpdateCheckpoint, useCompleteCheckpoint, useDeleteCheckpoint } from '../hooks'

export function CheckpointDetailModal({
  isOpen,
  onClose,
  checkpointId
}: CheckpointDetailModalProps) {
  const { data: checkpoint, isLoading } = useCheckpoint(checkpointId)
  const updateMutation = useUpdateCheckpoint()
  const completeMutation = useCompleteCheckpoint()
  const deleteMutation = useDeleteCheckpoint()

  if (!isOpen) return null

  return (
    <>
      {/* Overlay - matches Resource Graph style */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Slide-in Panel - RIGHT side (like SectionModal) */}
      <div
        className={cn(
          'fixed inset-y-0 right-0 z-50 w-[420px]',
          'bg-background border-l border-border/50',
          'shadow-2xl',
          'overflow-y-auto',
          'animate-in slide-in-from-right duration-300',
        )}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/50 p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              {/* Inline edit title */}
              <h2 className="text-xl font-semibold text-foreground">
                {checkpoint?.title}
              </h2>

              {/* Type badge */}
              <div className="mt-2 flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  <Icon name={checkpoint?.icon} className="w-3 h-3 mr-1" />
                  {checkpoint?.type_name}
                </Badge>

                {/* Status badge - colored */}
                <StatusBadge status={checkpoint?.status} label={checkpoint?.status_label} />
              </div>
            </div>

            {/* Close button */}
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* General Section */}
          <Section title="Основная информация">
            {/* Checkpoint Date */}
            <Field label="Дата дедлайна" icon={Calendar}>
              <DatePicker value={checkpoint?.checkpoint_date} />
            </Field>

            {/* Description - Rich Text */}
            <Field label="Описание">
              <RichTextEditor value={checkpoint?.description} />
            </Field>

            {/* Icon & Color Override */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Иконка">
                <IconPicker value={checkpoint?.custom_icon} />
              </Field>
              <Field label="Цвет">
                <ColorPicker value={checkpoint?.custom_color} />
              </Field>
            </div>
          </Section>

          {/* Linked Sections */}
          <Section title="Связанные разделы">
            <LinkedSectionsList sections={checkpoint?.linked_sections} />
          </Section>

          {/* Audit History */}
          <Section title="История изменений">
            <AuditTimeline checkpointId={checkpointId} />
          </Section>
        </div>

        {/* Footer Actions - STICKY bottom */}
        <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm border-t border-border/50 p-4 space-y-2">
          {/* Complete/Uncomplete Button */}
          {checkpoint?.status !== 'completed' && checkpoint?.status !== 'completed_late' ? (
            <Button
              onClick={() => completeMutation.mutate({ checkpointId, completed: true })}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Отметить выполненным
            </Button>
          ) : (
            <Button
              onClick={() => completeMutation.mutate({ checkpointId, completed: false })}
              variant="outline"
              className="w-full"
            >
              Отменить выполнение
            </Button>
          )}

          {/* Delete Button */}
          <Button
            onClick={() => {
              if (confirm('Удалить чекпоинт?')) {
                deleteMutation.mutate({ checkpointId })
                onClose()
              }
            }}
            variant="ghost"
            className="w-full text-red-500 hover:text-red-600 hover:bg-red-500/10"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Удалить чекпоинт
          </Button>
        </div>
      </div>
    </>
  )
}

// Helper components
function Section({ title, children }) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {title}
      </h3>
      <div className="space-y-3">
        {children}
      </div>
    </div>
  )
}

function Field({ label, icon: Icon, children }) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        {Icon && <Icon className="w-3.5 h-3.5" />}
        {label}
      </label>
      {children}
    </div>
  )
}

function StatusBadge({ status, label }) {
  const colorClass = {
    pending: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
    completed: 'bg-green-500/10 text-green-500 border-green-500/20',
    completed_late: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    overdue: 'bg-red-500/10 text-red-500 border-red-500/20',
  }[status] || ''

  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border',
      colorClass
    )}>
      {label}
    </span>
  )
}
```

---

#### CheckpointCard.tsx (Timeline Component)

**Design Pattern (matches TimelineRow components):**

```tsx
'use client'

import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Icon } from '@/components/ui/icon'
import { format, parseISO } from 'date-fns'

interface CheckpointCardProps {
  checkpoint: Checkpoint
  position: { left: number } // Calculated from checkpoint_date
  onClickOpen: (checkpointId: string) => void
}

export function CheckpointCard({ checkpoint, position, onClickOpen }: CheckpointCardProps) {
  const statusColor = {
    pending: '#6b7280',
    completed: '#10b981',
    completed_late: '#f59e0b',
    overdue: '#ef4444',
  }[checkpoint.status]

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={() => onClickOpen(checkpoint.checkpoint_id)}
          className={cn(
            'absolute top-0 h-full w-0.5 group',
            'hover:w-1 transition-all duration-150',
            'cursor-pointer'
          )}
          style={{
            left: `${position.left}px`,
            backgroundColor: checkpoint.color || statusColor,
          }}
        >
          {/* Checkpoint marker (dot at top) */}
          <div
            className={cn(
              'absolute -top-1 -left-1.5',
              'w-4 h-4 rounded-full',
              'border-2 border-background',
              'group-hover:scale-125 transition-transform',
              'shadow-lg'
            )}
            style={{ backgroundColor: checkpoint.color || statusColor }}
          >
            {/* Icon inside dot */}
            <Icon
              name={checkpoint.icon || 'calendar'}
              className="w-2 h-2 text-white absolute inset-0 m-auto"
            />
          </div>
        </button>
      </TooltipTrigger>

      <TooltipContent side="top" className="bg-popover border-border/50">
        <div className="space-y-1">
          <p className="font-medium text-sm">{checkpoint.title}</p>
          <p className="text-xs text-muted-foreground">
            {format(parseISO(checkpoint.checkpoint_date), 'dd.MM.yyyy')}
          </p>
          <StatusBadge status={checkpoint.status} label={checkpoint.status_label} />
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
```

---

### Component Structure

**Файловая структура модуля checkpoints:**

```
modules/checkpoints/
├── actions/
│   ├── checkpoints.ts          # Server Actions (CRUD)
│   └── checkpoint-types.ts     # Server Actions (types)
├── hooks/
│   ├── use-checkpoints.ts      # Cache hooks (queries + mutations)
│   └── use-checkpoint-types.ts # Cache hooks (types)
├── components/
│   ├── CheckpointCard.tsx           # Timeline marker (Resource Graph)
│   ├── CheckpointDetailModal.tsx    # Slide-in detail modal
│   ├── CheckpointCreateModal.tsx    # Create checkpoint modal
│   ├── CheckpointList.tsx           # List view (admin panel?)
│   ├── AuditTimeline.tsx            # Audit history component
│   ├── LinkedSectionsList.tsx       # Linked sections component
│   ├── StatusBadge.tsx              # Status badge component
│   └── CheckpointTypeManager.tsx    # Admin: manage types
├── types/
│   └── index.ts                # TypeScript types
└── index.ts                    # Public API exports
```

---

## Summary

### Cache Architecture
- **Query Keys:** `queryKeys.checkpoints.*` (lists, detail, audit, bySection, byProject)
- **Server Actions:** `getCheckpoints`, `createCheckpoint`, `updateCheckpoint`, `completeCheckpoint`, `deleteCheckpoint`, `getCheckpointAudit`
- **Cache Hooks:** `useCheckpoints`, `useCheckpoint`, `useCreateCheckpoint`, `useUpdateCheckpoint`, `useCompleteCheckpoint`, `useDeleteCheckpoint`, `useCheckpointAudit`
- **Optimistic Updates:** `useUpdateCheckpoint`, `useCompleteCheckpoint` используют `createUpdateMutation` factory
- **Realtime Sync:** Автоматическая инвалидация при изменениях в `section_checkpoints`, `checkpoint_section_links`, `checkpoint_audit`, `checkpoint_types`

### Resource Graph Visual Integration
- **Design Language:** Dark theme + amber accents (matches Resource Graph module)
- **Modal Pattern:** Right slide-in panel (420px width) как в `SectionModal.tsx`
- **Timeline Component:** Vertical marker + tooltip (как events на Resource Graph)
- **Status Badges:** Цветовая индикация (pending=gray, completed=green, completed_late=amber, overdue=red)
- **Typography & Spacing:** Соответствует Resource Graph conventions (см. выше color palette, spacing patterns)

### Integration Points
- **Resource Graph Timeline:** Показывает чекпоинты как вертикальные маркеры на timeline (по `checkpoint_date`)
- **Section Detail Modal:** Вкладка "Чекпоинты" показывает список чекпоинтов раздела
- **Cache Invalidation:** При изменении чекпоинтов инвалидируются `sections.all` и `resourceGraph.all` для актуализации UI

---

**Документ готов к реализации по Full Pipeline.**
