# Система бюджетов — Полное исследование

> **Дата:** 2025-01-06
> **Модули:** `modules/budgets`, `modules/budgets-page`

---

## 1. Общая архитектура

Система бюджетов состоит из двух модулей:

| Модуль | Назначение |
|--------|------------|
| `modules/budgets` | Ядро: типы, Server Actions, хуки для CRUD операций |
| `modules/budgets-page` | UI: отображение иерархии, inline редактирование |

### Ключевые принципы V2:
1. **Один бюджет на сущность** — unique constraint на `(entity_type, entity_id)`
2. **Части бюджета** (main, premium, custom) вместо отдельных бюджетов
3. **Иерархия родителей** через `parent_budget_id`
4. **Stage исключён** — стадия теперь параметр проекта, не уровень иерархии

---

## 2. Схема базы данных

### 2.1 Основные таблицы

#### `budgets` — Основная таблица бюджетов
```sql
budget_id           UUID PRIMARY KEY DEFAULT gen_random_uuid()
entity_type         budget_entity_type NOT NULL  -- 'section' | 'object' | 'project' | 'decomposition_stage' | 'decomposition_item'
entity_id           UUID NOT NULL
parent_budget_id    UUID REFERENCES budgets(budget_id) -- Самоссылка на родителя
total_amount        NUMERIC NOT NULL DEFAULT 0
name                VARCHAR NOT NULL DEFAULT 'Бюджет'
description         TEXT
is_active           BOOLEAN NOT NULL DEFAULT true
created_by          UUID REFERENCES profiles(user_id)
created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()

UNIQUE (entity_type, entity_id)  -- Один бюджет на сущность
```

#### `budget_parts` — Части бюджета
```sql
part_id             UUID PRIMARY KEY DEFAULT gen_random_uuid()
budget_id           UUID NOT NULL REFERENCES budgets(budget_id)
part_type           budget_part_type NOT NULL DEFAULT 'main'  -- 'main' | 'premium' | 'custom'
custom_name         VARCHAR  -- Для custom типа
percentage          NUMERIC  -- Процент от total_amount (либо percentage, либо fixed_amount)
fixed_amount        NUMERIC  -- Фиксированная сумма
calculated_amount   NUMERIC  -- Вычисленная сумма (через триггер)
requires_approval   BOOLEAN NOT NULL DEFAULT false  -- Требует согласования
approval_threshold  NUMERIC  -- Порог для согласования
color               VARCHAR  -- Цвет для отображения
created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()

CHECK (percentage IS NULL OR fixed_amount IS NULL)  -- Только одно значение
CHECK (percentage >= 0 AND percentage <= 100)
```

#### `budget_expenses` — Расходы бюджета
```sql
expense_id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
budget_id           UUID NOT NULL REFERENCES budgets(budget_id)
part_id             UUID REFERENCES budget_parts(part_id)  -- На какую часть
amount              NUMERIC NOT NULL
description         TEXT
expense_date        DATE NOT NULL DEFAULT CURRENT_DATE
work_log_id         UUID  -- Связь с work_logs
status              VARCHAR NOT NULL DEFAULT 'approved'  -- 'pending' | 'approved' | 'rejected'
approved_by         UUID REFERENCES profiles(user_id)
approved_at         TIMESTAMPTZ
rejection_reason    TEXT
created_by          UUID REFERENCES profiles(user_id)
created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
```

#### `budget_history` — История изменений
```sql
history_id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
budget_id           UUID NOT NULL REFERENCES budgets(budget_id)
change_type         VARCHAR NOT NULL  -- 'created' | 'amount_changed' | 'parts_changed' | 'status_changed'
previous_state      JSONB
new_state           JSONB
comment             TEXT
changed_by          UUID REFERENCES profiles(user_id)
changed_at          TIMESTAMPTZ NOT NULL DEFAULT now()
```

### 2.2 Enum типы

```sql
budget_entity_type: 'section' | 'object' | 'project' | 'decomposition_stage' | 'decomposition_item'
budget_part_type:   'main' | 'premium' | 'custom'
```

### 2.3 Триггеры

| Триггер | Таблица | Событие | Функция |
|---------|---------|---------|---------|
| `trg_budgets_updated_at` | budgets | BEFORE UPDATE | `update_budget_updated_at()` |
| `trg_budget_parts_updated_at` | budget_parts | BEFORE UPDATE | `update_budget_updated_at()` |
| `trg_recalculate_budget_total` | budget_parts | AFTER INSERT/UPDATE/DELETE | `recalculate_budget_total()` |
| `trg_validate_budget_parts_percentage` | budget_parts | BEFORE INSERT/UPDATE | `validate_budget_parts_percentage()` |

---

## 3. Views (Представления)

### 3.1 `v_cache_budgets` — Основной view для списков
Используется в хуках `useBudgets()`, `useBudgetById()`.

```sql
-- Возвращает:
budget_id, entity_type, entity_id, name, total_amount, is_active,
parent_budget_id, created_at, updated_at,
main_part_id, main_amount, main_spent,
premium_part_id, premium_amount, premium_spent,
total_spent, remaining_amount, spent_percentage,
parent_name, parent_total_amount

-- Логика:
-- LEFT JOIN на budget_parts для main и premium частей
-- Агрегация расходов из budget_expenses (только approved)
-- Расчёт remaining_amount = total_amount - total_spent
-- Расчёт spent_percentage = (total_spent / total_amount) * 100
```

### 3.2 `v_budgets_full` — Детальный view с частями
Используется в `useBudgetFull()`.

```sql
-- Возвращает всё из v_cache_budgets, плюс:
parts: JSONB[]  -- Массив частей с деталями (part_id, part_type, spent_amount, remaining_amount...)
pending_expenses_count: INTEGER
children_count: INTEGER
```

### 3.3 `v_budget_hierarchy` — Рекурсивная иерархия
```sql
-- CTE для построения дерева бюджетов:
level: INTEGER           -- Глубина вложенности
path: UUID[]            -- Путь от корня
distributed_amount      -- Сумма дочерних бюджетов
is_over_distributed     -- distributed_amount > total_amount
```

### 3.4 `v_cache_section_budget_summary` — Сводка по разделам
```sql
section_id, section_name, section_project_id, section_object_id,
budget_count, total_planned, total_spent, remaining, spent_percentage
```

### 3.5 `v_cache_budget_types` — Типы частей (справочник)
```sql
type_id: 'main' | 'premium' | 'custom'
name: 'Основной' | 'Премиальный' | 'Другой'
color: '#1E7260' | '#F59E0B' | '#6b7280'
usage_count: INTEGER
```

### 3.6 `v_pending_budget_approvals` — Ожидающие согласования
```sql
-- Расходы со status = 'pending'
-- С информацией о бюджете, части и создателе
```

---

## 4. Иерархия сущностей и бюджетов

### 4.1 Иерархия сущностей (Entity Hierarchy)
```
Project (projects.project_id)
  └── Object (objects.object_id)
        └── Section (sections.section_id)
              └── DecompositionStage (decomposition_stages.decomposition_stage_id)
                    └── DecompositionItem (decomposition_items.decomposition_item_id)
```

**Важно:** Stage (Стадия) — это параметр проекта (`projects.stage_id`), НЕ уровень иерархии.

### 4.2 Иерархия бюджетов (Parent Budget)
```
Project Budget (parent_budget_id = NULL)
  └── Object Budget (parent_budget_id → project budget)
        └── Section Budget (parent_budget_id → object budget)
              └── DecompositionStage Budget (parent_budget_id → section budget)
                    └── DecompositionItem Budget (parent_budget_id → stage budget)
```

### 4.3 Статистика связей (из продакшена)
| entity_type | Всего | С родителем | Тип родителя |
|-------------|-------|-------------|--------------|
| project | 78 | 0 | — |
| object | 283 | 2 | project |
| section | 2396 | 2392 | object |
| decomposition_stage | 719 | 719 | section |
| decomposition_item | 128 | 111 | decomposition_stage |

---

## 5. Data Flow (Поток данных)

### 5.1 Создание бюджета

```
┌─────────────────────────────────────────────────────────────────┐
│                    UI: BudgetInlineEdit                         │
│   handleCreate() → createBudget({ entity_type, entity_id })    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                Hook: useCreateBudget()                          │
│   createCacheMutation → invalidates budget query keys           │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│            Server Action: createBudget()                        │
│   1. Zod validation                                             │
│   2. Auth check                                                 │
│   3. findParentBudget() — ищет родителя в иерархии             │
│   4. INSERT INTO budgets                                        │
│   5. INSERT INTO budget_parts (main, 100%)                     │
│   6. INSERT INTO budget_history (created)                      │
│   7. Return от v_cache_budgets                                 │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Database                                     │
│   budgets + budget_parts + budget_history                       │
│   Triggers: recalculate_budget_total, validate_parts           │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Обновление суммы бюджета

```
BudgetInlineEdit.handleSave()
       │
       ▼
useUpdateBudgetAmount().mutate({ budget_id, total_amount })
       │
       ▼
Server Action: updateBudgetAmount()
  1. Zod validation
  2. Auth check
  3. GET current budget from v_cache_budgets
  4. UPDATE budgets SET total_amount, updated_at
  5. INSERT INTO budget_history (amount_changed)
  6. Return updated budget

Note: Части бюджета пересчитываются автоматически через триггер
recalculate_budget_total() при изменении percentage или fixed_amount
```

### 5.3 Получение иерархии для отображения

```
┌─────────────────────────────────────────────────────────────────┐
│                    BudgetsViewInternal                          │
│            useBudgetsHierarchy(filters)                        │
└────────────────────────────┬────────────────────────────────────┘
                             │
           ┌─────────────────┴─────────────────┐
           │                                   │
           ▼                                   ▼
┌──────────────────────────┐     ┌────────────────────────────────┐
│  useResourceGraphData()  │     │       useBudgets()             │
│  (из resource-graph)     │     │    { is_active: true }         │
│                          │     │                                │
│  Возвращает:             │     │  Возвращает:                   │
│  - projects[]            │     │  - BudgetCurrent[]             │
│    - objects[]           │     │    из v_cache_budgets          │
│      - sections[]        │     │                                │
│        - stages[]        │     │                                │
│          - items[]       │     │                                │
└────────────┬─────────────┘     └─────────────┬──────────────────┘
             │                                  │
             └─────────────┬────────────────────┘
                           │
                           ▼
              ┌────────────────────────────────┐
              │    useMemo: budgetsMap         │
              │    Map<"entityType:entityId",  │
              │         BudgetInfo[]>          │
              └────────────────────────────────┘
                           │
                           ▼
              ┌────────────────────────────────┐
              │   transformProject(project,    │
              │                   budgetsMap)  │
              │                                │
              │   → HierarchyNode[]            │
              │     с бюджетами на каждом      │
              │     уровне иерархии            │
              └────────────────────────────────┘
                           │
                           ▼
              ┌────────────────────────────────┐
              │     BudgetsHierarchy           │
              │         ↓                      │
              │     BudgetRow (рекурсивно)     │
              │         ↓                      │
              │     BudgetInlineEdit           │
              └────────────────────────────────┘
```

---

## 6. Компоненты UI

### 6.1 Модуль `budgets-page/components/`

| Компонент | Назначение |
|-----------|------------|
| `BudgetsHierarchy` | Корневой компонент: таблица с sticky заголовками |
| `BudgetRow` | Строка иерархии: отображение + inline редактирование |
| `BudgetRowExpander` | Кнопка раскрытия/сворачивания |
| `BudgetRowBadges` | Бейджи типа узла и стадии |
| `BudgetRowHours` | Колонка трудозатрат (план, с К, % от родителя) |
| `BudgetRowActions` | Действия (создание, удаление, редактирование) |
| `BudgetInlineEdit` | Inline редактор суммы бюджета и % от родителя |
| `BudgetPartsEditor` | Popover для управления частями (main/premium/custom) |
| `BudgetAmountEdit` | Редактор суммы с синхронизацией процентов |
| `SectionRateEdit` | Редактор часовой ставки раздела |
| `ItemHoursEdit` | Редактор плановых часов задачи |
| `ItemCategorySelect` | Выбор категории работ |
| `ItemDifficultySelect` | Выбор сложности задачи |
| `StageInlineCreate` | Inline создание этапа декомпозиции |
| `ItemInlineCreate` | Inline создание задачи |

### 6.2 Структура колонок

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Наименование (400px) │ Кат. │ ТРУДОЗАТРАТЫ │ Ставка │ БЮДЖЕТЫ             │
│                      │(40px)│ План│С К│% род.│ BYN/ч  │Расчёт│Распр│Выделен│
├──────────────────────┼──────┼─────┼───┼──────┼────────┼──────┼─────┼───────┤
│ ▶ Проект             │      │     │   │      │        │      │     │       │
│   ▶ Объект           │      │     │   │      │        │      │     │       │
│     ▶ Раздел         │      │ 100 │120│  40% │   50   │ 6000 │5000 │ 5000  │
│       ▶ Этап         │      │  50 │ 60│  50% │        │ 3000 │2500 │ 2500  │
│         Задача       │  K1  │  25 │ 30│  50% │        │ 1500 │     │ 1500  │
└─────────────────────────────────────────────────────────────────────────────┘

Расчётный = Приведённые часы × Ставка
Распределено = Σ бюджетов прямых детей
Выделенный = total_amount бюджета (редактируемый)
```

---

## 7. Server Actions API

### 7.1 Read Actions

| Action | Параметры | Возвращает | Описание |
|--------|-----------|------------|----------|
| `getBudgets(filters?)` | `BudgetFilters` | `BudgetCurrent[]` | Список бюджетов из v_cache_budgets |
| `getBudgetsByEntity(entityType, entityId)` | string, string | `BudgetCurrent[]` | Бюджеты сущности |
| `getBudgetById(budgetId)` | string | `BudgetCurrent` | Бюджет по ID |
| `getBudgetFull(budgetId)` | string | `BudgetFull` | С частями и детальной инфо |
| `getBudgetHistory(budgetId)` | string | `BudgetHistoryEntry[]` | История изменений |
| `getBudgetExpenses(budgetId)` | string | `BudgetExpense[]` | Расходы бюджета |
| `getSectionBudgetSummary(projectId?)` | string? | `SectionBudgetSummary[]` | Сводка по разделам |
| `getEntityHierarchy(entityType, entityId)` | BudgetEntityType, string | `EntityHierarchy` | Иерархия сущности |
| `findParentBudget(entityType, entityId)` | BudgetEntityType, string | `BudgetCurrent \| null` | Поиск родительского бюджета |

### 7.2 Write Actions

| Action | Параметры | Возвращает | Описание |
|--------|-----------|------------|----------|
| `createBudget(input)` | `CreateBudgetInput` | `BudgetCurrent` | Создание бюджета + main part |
| `updateBudgetAmount(input)` | `UpdateBudgetAmountInput` | `BudgetCurrent` | Обновление суммы |
| `addBudgetPart(input)` | `CreateBudgetPartInput` | `BudgetFull` | Добавление premium/custom части |
| `updateBudgetPart(input)` | `UpdateBudgetPartInput` | `{ success: boolean }` | Обновление части |
| `deleteBudgetPart(partId)` | string | `{ success: boolean }` | Удаление части (не main) |
| `deactivateBudget(budgetId, options?)` | string, { force?: boolean } | `{ success, warning? }` | Soft delete |
| `clearBudget(budgetId, comment?)` | string, string? | `BudgetCurrent` | Обнуление вместо удаления |
| `createExpense(input)` | `CreateExpenseInput` | `BudgetExpense` | Создание расхода |
| `approveExpense(input)` | `ApproveExpenseInput` | `BudgetExpense` | Одобрение/отклонение |

### 7.3 Decomposition Actions (budgets-page)

| Action | Параметры | Описание |
|--------|-----------|----------|
| `createDecompositionStage(input)` | `{ sectionId, name }` | Создание этапа |
| `deleteDecompositionStage(input)` | `{ stageId }` | Удаление этапа |
| `createDecompositionItem(input)` | `{ stageId, sectionId, description }` | Создание задачи |
| `deleteDecompositionItem(input)` | `{ itemId }` | Удаление задачи |
| `updateItemPlannedHours(input)` | `{ itemId, plannedHours }` | Обновление часов |
| `updateItemCategory(input)` | `{ itemId, categoryId }` | Обновление категории |
| `updateItemDifficulty(input)` | `{ itemId, difficultyId }` | Обновление сложности |
| `updateSectionHourlyRate(input)` | `{ sectionId, hourlyRate }` | Обновление ставки раздела |

---

## 8. React Hooks

### 8.1 Query Hooks

```typescript
// Список бюджетов с фильтрами
const { data, isLoading } = useBudgets({ entity_type: 'section', is_active: true })

// Бюджет по ID
const { data: budget } = useBudgetById('budget-id')

// Бюджеты сущности
const { data: budgets } = useBudgetsByEntity('section', sectionId)

// Полная информация с частями
const { data: fullBudget } = useBudgetFull('budget-id')

// История изменений
const { data: history } = useBudgetHistory('budget-id')

// Сводка по разделам
const { data: summary } = useSectionBudgetSummary(projectId)

// Поиск родительского бюджета
const { data: parent } = useFindParentBudget('section', sectionId)
```

### 8.2 Mutation Hooks

```typescript
// Создание бюджета
const { mutate: create } = useCreateBudget()
create({ entity_type: 'section', entity_id: sectionId, total_amount: 10000 })

// Обновление суммы
const { mutate: update } = useUpdateBudgetAmount()
update({ budget_id: id, total_amount: 15000, comment: 'Корректировка' })

// Управление частями
const { mutate: addPart } = useAddBudgetPart()
const { mutate: updatePart } = useUpdateBudgetPart()
const { mutate: deletePart } = useDeleteBudgetPart()

// Деактивация/очистка
const { mutate: deactivate } = useDeactivateBudget()
const { mutate: clear } = useClearBudget()
```

### 8.3 Hierarchy Hook

```typescript
// Получение полной иерархии с бюджетами
const { nodes, analytics, isLoading, refetch } = useBudgetsHierarchy(filters)

// nodes: HierarchyNode[] — дерево проектов с бюджетами
// analytics: BudgetsAnalyticsData — агрегированная статистика
```

---

## 9. Типы TypeScript

### 9.1 Database Types (из types/db.ts)
```typescript
type BudgetsV2Row = Database['public']['Tables']['budgets']['Row']
type BudgetPartsRow = Database['public']['Tables']['budget_parts']['Row']
type BudgetExpensesRow = Database['public']['Tables']['budget_expenses']['Row']
type BudgetHistoryRow = Database['public']['Tables']['budget_history']['Row']
type BudgetEntityType = Database['public']['Enums']['budget_entity_type']
type BudgetPartType = Database['public']['Enums']['budget_part_type']
```

### 9.2 Domain Types
```typescript
interface BudgetCurrent {
  budget_id: string
  entity_type: BudgetEntityType
  entity_id: string
  name: string
  total_amount: number
  is_active: boolean
  parent_budget_id: string | null
  // Parts
  main_part_id: string | null
  main_amount: number | null
  main_spent: number
  premium_part_id: string | null
  premium_amount: number | null
  premium_spent: number
  // Totals
  total_spent: number
  remaining_amount: number
  spent_percentage: number
  // Parent info
  parent_name: string | null
  parent_total_amount: number | null
}

interface BudgetFull extends BudgetCurrent {
  parts: BudgetPart[]
  pending_expenses_count: number
  children_count: number
}

interface HierarchyNode {
  id: string
  name: string
  type: 'project' | 'object' | 'section' | 'decomposition_stage' | 'decomposition_item'
  budgets: BudgetInfo[]
  aggregatedBudgets: AggregatedBudgetsByType[]
  plannedHours?: number
  children: HierarchyNode[]
  entityType: BudgetEntityType
  hourlyRate?: number | null
  // ... и другие поля для конкретных типов
}
```

---

## 10. Формулы расчётов

### 10.1 Расчётный бюджет
```
Расчётный = Плановые часы × К × Ставка

где:
- Плановые часы = Σ decomposition_item_planned_hours
- К = 1.2 (коэффициент, HOURS_ADJUSTMENT_FACTOR)
- Ставка = section_hourly_rate или MOCK_HOURLY_RATE (50 BYN/ч)
```

### 10.2 Распределённый бюджет
```
Распределено = Σ total_amount прямых детей

Например для раздела:
Распределено = Σ (бюджеты всех этапов декомпозиции)
```

### 10.3 Процент освоения
```
spent_percentage = (total_spent / total_amount) × 100

где total_spent = Σ amount from budget_expenses WHERE status = 'approved'
```

### 10.4 Процент от родителя (в UI)
```
% от родителя = (текущий total_amount / parent_total_amount) × 100
```

---

## 11. Связи с другими модулями

| Модуль | Связь |
|--------|-------|
| `resource-graph` | Источник иерархии проектов (useResourceGraphData) |
| `cache` | Фабрики хуков (createCacheQuery, createCacheMutation), query keys |
| `modals` | Модальные окна создания/удаления (ObjectCreateModal, SectionCreateModal...) |
| `inline-filter` | Фильтрация данных в UI |

---

## 12. Файловая структура

```
modules/
├── budgets/
│   ├── actions/
│   │   └── budget-actions.ts      # Все Server Actions
│   ├── components/
│   │   └── index.ts               # Экспорт компонентов (пока пусто)
│   ├── hooks/
│   │   └── index.ts               # Query/Mutation хуки
│   ├── types.ts                   # TypeScript типы
│   ├── index.ts                   # Публичный API модуля
│   └── README.md                  # Документация (устаревшая)
│
└── budgets-page/
    ├── actions/
    │   ├── decomposition.ts       # CRUD для декомпозиции
    │   ├── reference-data.ts      # Справочники (сложности, категории)
    │   └── index.ts
    ├── components/
    │   ├── BudgetsHierarchy.tsx   # Корневой компонент
    │   ├── BudgetRow.tsx          # Строка иерархии
    │   ├── BudgetInlineEdit.tsx   # Inline редактор
    │   ├── BudgetPartsEditor.tsx  # Редактор частей
    │   └── ... (15+ компонентов)
    ├── hooks/
    │   ├── use-budgets-hierarchy.ts
    │   ├── use-reference-data.ts
    │   ├── use-expanded-state.ts
    │   └── use-operation-guard.ts
    ├── config/
    │   └── constants.ts           # MOCK_HOURLY_RATE, HOURS_ADJUSTMENT_FACTOR...
    ├── utils/
    │   ├── index.ts               # formatNumber, parseAmount, calculatePercentage...
    │   └── optimistic-updates.ts
    ├── types/
    │   └── index.ts               # HierarchyNode, BudgetInfo, etc.
    └── index.ts                   # Публичный API
```

---

## 13. Возможные улучшения

1. **Обновить README.md** модуля budgets — содержит устаревшую информацию о budget_types и budget_versions

2. **RLS-политики** — в текущих таблицах RLS отключён (rls_enabled: false), нужно добавить

3. **Индексы** — проверить наличие индексов для частых запросов:
   - `budgets(entity_type, entity_id)` — уже есть unique constraint
   - `budget_expenses(budget_id, status)`
   - `budget_parts(budget_id, part_type)`

4. **Realtime подписки** — добавить автоматическую инвалидацию кэша при изменениях в БД

5. **Согласование расходов** — UI для v_pending_budget_approvals пока не реализован

---

## 14. Заключение

Система бюджетов V2 реализует:
- ✅ Один бюджет на сущность с unique constraint
- ✅ Части бюджета (main/premium/custom) с автопересчётом
- ✅ Иерархию родителей (project → object → section → stage → item)
- ✅ Расходы с workflow согласования
- ✅ Историю изменений
- ✅ Inline редактирование в табличном UI
- ✅ Интеграцию с resource-graph для получения иерархии
- ✅ Server Actions с Zod валидацией
- ✅ TanStack Query для кэширования

Основные паттерны:
- Полиморфная привязка через entity_type + entity_id
- Самоссылка parent_budget_id для иерархии
- Views для агрегации и расчётов
- Триггеры для автоматического пересчёта
- Фабрики хуков из cache модуля
