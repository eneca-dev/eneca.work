# Система бюджетов

## Обзор

Система плановых бюджетов позволяет назначать и отслеживать бюджеты на разных уровнях иерархии проекта (раздел, объект, стадия, проект). Фактические расходы рассчитываются через view из work_logs, которые привязываются к конкретному бюджету.

**Валюта:** BYN (единая для всей системы)

## Ключевые концепции

### Теги бюджетов (budget_tags)
Гибкая система тегов для классификации и группировки бюджетов.
Примеры: "Основной", "Премиальный", "Дополнительный", "Госконтракт".
Связь M2M: один бюджет может иметь несколько тегов.

### Версионирование
Каждое изменение суммы бюджета создаёт новую версию. Полная история сохраняется.
Текущий бюджет = версия где `effective_to IS NULL`.

### Полиморфная привязка
Бюджет привязывается к любой сущности через пару `(entity_type, entity_id)`:
- `section` — раздел
- `object` — объект
- `stage` — стадия
- `project` — проект

### Привязка расходов к бюджетам
Каждый work_log привязывается к конкретному бюджету через поле `budget_id`.
Это позволяет точно отслеживать расход каждого бюджета отдельно.

## Схема БД

```
┌────────────────────┐
│    budget_tags     │
├────────────────────┤
│ tag_id PK          │
│ name               │
│ color              │
│ description        │
│ is_active          │
│ created_at         │
└────────────────────┘
          │
          │ M2M
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                           budgets                                │
├─────────────────────────────────────────────────────────────────┤
│ budget_id PK                                                     │
│ entity_type ENUM (section, object, stage, project)              │
│ entity_id UUID                                                   │
│ name VARCHAR — название бюджета                                  │
│ is_active BOOLEAN                                               │
│ created_by FK → auth.users                                      │
│ created_at TIMESTAMP                                            │
│ updated_at TIMESTAMP                                            │
└─────────────────────────────────────────────────────────────────┘
         │                      │                      │
         │                      │                      │
         ▼                      ▼                      ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐
│ budget_versions │  │ budget_tag_links│  │      work_logs          │
├─────────────────┤  ├─────────────────┤  ├─────────────────────────┤
│ version_id PK   │  │ budget_id FK    │  │ work_log_id PK          │
│ budget_id FK    │  │ tag_id FK       │  │ budget_id FK (nullable) │ ← NEW
│ planned_amount  │  │ assigned_at     │  │ ... existing fields     │
│ effective_from  │  └─────────────────┘  └─────────────────────────┘
│ effective_to    │
│ comment         │
│ created_by      │
│ created_at      │
└─────────────────┘
```

### Таблицы

#### budget_tags
```sql
CREATE TABLE budget_tags (
  tag_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color VARCHAR(7) NOT NULL DEFAULT '#6B7280',
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### budgets
```sql
CREATE TYPE budget_entity_type AS ENUM ('section', 'object', 'stage', 'project');

CREATE TABLE budgets (
  budget_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type budget_entity_type NOT NULL,
  entity_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(entity_type, entity_id, name)
);

CREATE INDEX idx_budgets_entity ON budgets(entity_type, entity_id);
CREATE INDEX idx_budgets_created_by ON budgets(created_by);
```

#### budget_versions
```sql
CREATE TABLE budget_versions (
  version_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID NOT NULL REFERENCES budgets(budget_id) ON DELETE CASCADE,
  planned_amount NUMERIC(15,2) NOT NULL CHECK (planned_amount >= 0),
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  comment TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE INDEX idx_budget_versions_budget ON budget_versions(budget_id);
CREATE INDEX idx_budget_versions_current ON budget_versions(budget_id) WHERE effective_to IS NULL;
```

#### budget_tag_links
```sql
CREATE TABLE budget_tag_links (
  budget_id UUID NOT NULL REFERENCES budgets(budget_id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES budget_tags(tag_id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (budget_id, tag_id)
);
```

#### Изменение work_logs
```sql
-- Добавляем поле budget_id в существующую таблицу work_logs
ALTER TABLE work_logs
ADD COLUMN budget_id UUID REFERENCES budgets(budget_id) ON DELETE SET NULL;

CREATE INDEX idx_work_logs_budget ON work_logs(budget_id);
```

**Примечание:** `budget_id` nullable — старые записи и записи без привязки к бюджету останутся с NULL.

## Views

### v_cache_budgets_current
Текущие активные бюджеты с актуальной суммой, тегами и расходом:
```sql
CREATE VIEW v_cache_budgets_current AS
WITH budget_spent AS (
  SELECT
    budget_id,
    COALESCE(SUM(work_log_amount), 0) as spent_amount
  FROM work_logs
  WHERE budget_id IS NOT NULL
  GROUP BY budget_id
)
SELECT
  b.budget_id,
  b.entity_type,
  b.entity_id,
  b.name,
  b.is_active,
  b.created_by,
  b.created_at,
  b.updated_at,
  bv.version_id,
  bv.planned_amount,
  bv.effective_from,
  bv.comment as version_comment,
  COALESCE(bs.spent_amount, 0) as spent_amount,
  bv.planned_amount - COALESCE(bs.spent_amount, 0) as remaining_amount,
  CASE
    WHEN bv.planned_amount = 0 THEN 0
    ELSE ROUND((COALESCE(bs.spent_amount, 0) / bv.planned_amount) * 100, 2)
  END as spent_percentage,
  COALESCE(
    array_agg(
      jsonb_build_object('tag_id', t.tag_id, 'name', t.name, 'color', t.color)
    ) FILTER (WHERE t.tag_id IS NOT NULL),
    '{}'
  ) as tags
FROM budgets b
JOIN budget_versions bv ON b.budget_id = bv.budget_id AND bv.effective_to IS NULL
LEFT JOIN budget_spent bs ON b.budget_id = bs.budget_id
LEFT JOIN budget_tag_links btl ON b.budget_id = btl.budget_id
LEFT JOIN budget_tags t ON btl.tag_id = t.tag_id AND t.is_active = true
WHERE b.is_active = true
GROUP BY b.budget_id, b.entity_type, b.entity_id, b.name, b.is_active,
         b.created_by, b.created_at, b.updated_at,
         bv.version_id, bv.planned_amount, bv.effective_from, bv.comment,
         bs.spent_amount;
```

### v_cache_section_budget_summary
Сводка бюджетов по разделам:
```sql
CREATE VIEW v_cache_section_budget_summary AS
WITH section_budgets AS (
  SELECT
    b.entity_id as section_id,
    COUNT(b.budget_id) as budget_count,
    COALESCE(SUM(bv.planned_amount), 0) as total_planned,
    COALESCE(SUM(
      (SELECT COALESCE(SUM(work_log_amount), 0) FROM work_logs WHERE budget_id = b.budget_id)
    ), 0) as total_spent
  FROM budgets b
  JOIN budget_versions bv ON b.budget_id = bv.budget_id AND bv.effective_to IS NULL
  WHERE b.entity_type = 'section' AND b.is_active = true
  GROUP BY b.entity_id
)
SELECT
  s.section_id,
  s.section_name,
  s.section_project_id,
  COALESCE(sb.budget_count, 0) as budget_count,
  COALESCE(sb.total_planned, 0) as total_planned,
  COALESCE(sb.total_spent, 0) as total_spent,
  COALESCE(sb.total_planned, 0) - COALESCE(sb.total_spent, 0) as remaining,
  CASE
    WHEN COALESCE(sb.total_planned, 0) = 0 THEN 0
    ELSE ROUND((COALESCE(sb.total_spent, 0) / sb.total_planned) * 100, 2)
  END as spent_percentage
FROM sections s
LEFT JOIN section_budgets sb ON sb.section_id = s.section_id;
```

### v_cache_budget_tags
Справочник тегов:
```sql
CREATE VIEW v_cache_budget_tags AS
SELECT
  tag_id,
  name,
  color,
  description,
  is_active,
  created_at,
  (SELECT COUNT(*) FROM budget_tag_links WHERE tag_id = budget_tags.tag_id) as usage_count
FROM budget_tags;
```

## RLS-политики (Row Level Security)

### Кто видит бюджеты:

| Роль | Доступ |
|------|--------|
| **Тимлид раздела** | Бюджеты разделов, где он `section_responsible` |
| **Начальник отдела** | Бюджеты разделов, где назначены сотрудники его отдела (через loadings) |
| **Менеджер проекта** | Бюджеты всех разделов проектов, где он `project_manager` |
| **Главный инженер проекта** | Бюджеты всех разделов проектов, где он `project_lead_engineer` |
| **Админ** | Все бюджеты (право `budgets.view.all`) |

### Политики для budgets
```sql
-- Включаем RLS
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

-- Политика просмотра
CREATE POLICY budgets_select_policy ON budgets
FOR SELECT USING (
  -- Админ с правом budgets.view.all
  EXISTS (
    SELECT 1 FROM profiles p
    JOIN role_permissions rp ON rp.role_id = p.role_id
    JOIN permissions perm ON perm.id = rp.permission_id
    WHERE p.user_id = auth.uid() AND perm.name = 'budgets.view.all'
  )
  OR (
    entity_type = 'section' AND (
      -- Ответственный за раздел
      EXISTS (
        SELECT 1 FROM sections s
        WHERE s.section_id = budgets.entity_id
        AND s.section_responsible = auth.uid()
      )
      -- Начальник отдела сотрудников на разделе
      OR EXISTS (
        SELECT 1 FROM loadings l
        JOIN profiles p ON l.loading_responsible = p.user_id
        JOIN departments d ON p.department_id = d.department_id
        WHERE l.loading_section = budgets.entity_id
        AND d.department_head_id = auth.uid()
      )
      -- Менеджер или ГИП проекта
      OR EXISTS (
        SELECT 1 FROM sections s
        JOIN projects pr ON pr.project_id = s.section_project_id
        WHERE s.section_id = budgets.entity_id
        AND (pr.project_manager = auth.uid() OR pr.project_lead_engineer = auth.uid())
      )
    )
  )
  OR (
    entity_type = 'project' AND EXISTS (
      SELECT 1 FROM projects pr
      WHERE pr.project_id = budgets.entity_id
      AND (pr.project_manager = auth.uid() OR pr.project_lead_engineer = auth.uid())
    )
  )
);

-- Политика создания
CREATE POLICY budgets_insert_policy ON budgets
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p
    JOIN role_permissions rp ON rp.role_id = p.role_id
    JOIN permissions perm ON perm.id = rp.permission_id
    WHERE p.user_id = auth.uid() AND perm.name = 'budgets.create'
  )
);

-- Политика обновления
CREATE POLICY budgets_update_policy ON budgets
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM profiles p
    JOIN role_permissions rp ON rp.role_id = p.role_id
    JOIN permissions perm ON perm.id = rp.permission_id
    WHERE p.user_id = auth.uid() AND perm.name = 'budgets.edit'
  )
);
```

### Политики для budget_versions
```sql
ALTER TABLE budget_versions ENABLE ROW LEVEL SECURITY;

-- Наследуем доступ от родительского бюджета
CREATE POLICY budget_versions_select_policy ON budget_versions
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM budgets b
    WHERE b.budget_id = budget_versions.budget_id
  )
);

CREATE POLICY budget_versions_insert_policy ON budget_versions
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p
    JOIN role_permissions rp ON rp.role_id = p.role_id
    JOIN permissions perm ON perm.id = rp.permission_id
    WHERE p.user_id = auth.uid() AND perm.name = 'budgets.edit'
  )
);
```

### Политики для budget_tags
```sql
ALTER TABLE budget_tags ENABLE ROW LEVEL SECURITY;

-- Теги видят все авторизованные пользователи
CREATE POLICY budget_tags_select_policy ON budget_tags
FOR SELECT USING (auth.uid() IS NOT NULL);

-- Управление тегами только с правом
CREATE POLICY budget_tags_insert_policy ON budget_tags
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p
    JOIN role_permissions rp ON rp.role_id = p.role_id
    JOIN permissions perm ON perm.id = rp.permission_id
    WHERE p.user_id = auth.uid() AND perm.name = 'budgets.manage_tags'
  )
);

CREATE POLICY budget_tags_update_policy ON budget_tags
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM profiles p
    JOIN role_permissions rp ON rp.role_id = p.role_id
    JOIN permissions perm ON perm.id = rp.permission_id
    WHERE p.user_id = auth.uid() AND perm.name = 'budgets.manage_tags'
  )
);
```

## Права доступа (permissions)

| Permission | Описание |
|------------|----------|
| `budgets.view.all` | Просмотр всех бюджетов (обходит RLS) |
| `budgets.create` | Создание бюджетов |
| `budgets.edit` | Редактирование бюджетов (создание новой версии) |
| `budgets.delete` | Деактивация бюджетов |
| `budgets.manage_tags` | Управление справочником тегов |

## Server Actions и Cache

Все операции с БД выполняются через Server Actions и кэшируются через модуль cache.

### Query Keys
```typescript
// modules/cache/keys/query-keys.ts
export const queryKeys = {
  // ...existing keys
  budgets: {
    all: () => ['budgets'] as const,
    lists: () => [...queryKeys.budgets.all(), 'list'] as const,
    list: (filters: BudgetFilters) => [...queryKeys.budgets.lists(), filters] as const,
    details: () => [...queryKeys.budgets.all(), 'detail'] as const,
    detail: (id: string) => [...queryKeys.budgets.details(), id] as const,
    byEntity: (entityType: string, entityId: string) =>
      [...queryKeys.budgets.all(), 'entity', entityType, entityId] as const,
    versions: (budgetId: string) =>
      [...queryKeys.budgets.detail(budgetId), 'versions'] as const,
    summary: (entityType: string, entityId: string) =>
      [...queryKeys.budgets.all(), 'summary', entityType, entityId] as const,
  },
  budgetTags: {
    all: () => ['budget-tags'] as const,
    lists: () => [...queryKeys.budgetTags.all(), 'list'] as const,
  },
}
```

### Server Actions
```typescript
// modules/budgets/actions/budget-actions.ts
'use server'

export async function getBudgets(filters: BudgetFilters) { ... }
export async function getBudgetById(budgetId: string) { ... }
export async function getBudgetsByEntity(entityType: string, entityId: string) { ... }
export async function getBudgetVersions(budgetId: string) { ... }
export async function createBudget(data: CreateBudgetInput) { ... }
export async function updateBudgetAmount(budgetId: string, data: UpdateBudgetAmountInput) { ... }
export async function deactivateBudget(budgetId: string) { ... }

// modules/budgets/actions/budget-tag-actions.ts
export async function getBudgetTags() { ... }
export async function createBudgetTag(data: CreateTagInput) { ... }
export async function updateBudgetTag(tagId: string, data: UpdateTagInput) { ... }
```

### Hooks
```typescript
// modules/budgets/hooks/use-budgets.ts
export const useBudgetsByEntity = (entityType: string, entityId: string) =>
  createCacheQuery({
    queryKey: () => queryKeys.budgets.byEntity(entityType, entityId),
    queryFn: () => getBudgetsByEntity(entityType, entityId),
  })

export const useCreateBudget = createInsertMutation({
  mutationFn: createBudget,
  listQueryKey: queryKeys.budgets.lists(),
})

export const useUpdateBudgetAmount = createUpdateMutation({
  mutationFn: ({ budgetId, ...data }) => updateBudgetAmount(budgetId, data),
  listQueryKey: queryKeys.budgets.lists(),
  getId: (input) => input.budgetId,
  getItemId: (item) => item.budget_id,
  merge: (item, input) => ({ ...item, planned_amount: input.planned_amount }),
})
```

## План реализации

### Этап 1: Миграция БД — таблицы
- [ ] ENUM `budget_entity_type`
- [ ] Таблица `budget_tags`
- [ ] Таблица `budgets`
- [ ] Таблица `budget_versions`
- [ ] Таблица `budget_tag_links`
- [ ] ALTER TABLE `work_logs` ADD COLUMN `budget_id`
- [ ] Индексы
- [ ] Начальные теги (Основной, Премиальный, Дополнительный)

### Этап 2: Миграция БД — Views
- [ ] `v_cache_budgets_current`
- [ ] `v_cache_section_budget_summary`
- [ ] `v_cache_budget_tags`

### Этап 3: Миграция БД — RLS
- [ ] Политики для `budgets`
- [ ] Политики для `budget_versions`
- [ ] Политики для `budget_tag_links`
- [ ] Политики для `budget_tags`

### Этап 4: Permissions
- [ ] Добавить права в таблицу `permissions`
- [ ] Назначить права ролям

### Этап 5: Server Actions и Cache
- [ ] Query keys
- [ ] Server actions
- [ ] Hooks с TanStack Query
- [ ] Типы TypeScript (`npm run db:types`)

### Этап 6: UI (отдельная задача)
- [ ] Компонент списка бюджетов
- [ ] Форма создания/редактирования
- [ ] Выбор бюджета при создании work_log
- [ ] Отображение в карточке раздела

## Будущие расширения

1. **Автоматический выбор бюджета** — связь тегов бюджетов с категориями работ для auto-select
2. **Лимиты и уведомления** — алерты при превышении % бюджета
3. **Наследование** — бюджет проекта распределяется на разделы
4. **Мультивалютность** — добавление таблицы currencies и курсов
5. **Утверждение бюджетов** — workflow согласования
6. **Materialized view** — для оптимизации при большом объёме данных
