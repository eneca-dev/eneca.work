# Бюджеты — разбор под капотом + план продакшен-подготовки

> **Дата анализа:** 2026-04-27
> **Источник:** реальная БД (gvrcbvifirhxxdnvrwlz) + код модулей `budgets` и `budgets-page`
> **Статус:** актуально, подтверждено через Supabase MCP

---

## ⚠️ ВАЖНО: устаревшая документация

`docs/budgets.md` и `docs/budgets-system-research.md` описывают **старую схему** (budget_versions, budget_tags), которой **уже нет в продакшен БД**. Этот файл — актуальный источник правды.

---

## 1. Таблицы в БД (реальное состояние)

```
┌─────────────────────────────────────────────────────────────┐
│               ТАБЛИЦЫ В ПРОДАКШЕН БД                        │
├──────────────────────────┬──────────┬─────────────────────  │
│ Таблица                  │ Записей  │ Назначение            │
├──────────────────────────┼──────────┼───────────────────────┤
│ budgets                  │  29 580  │ Все бюджеты           │
│ budget_parts             │   2 758  │ Части бюджета         │
│ budget_expenses          │  18 643  │ Расходы               │
│ budget_history           │   2 886  │ История изменений     │
│ work_logs                │  18 625  │ Логи работ (=расходы) │
│ decomposition_stages     │  12 774  │ Этапы декомпозиции    │
│ decomposition_items      │  12 192  │ Задачи декомпозиции   │
└──────────────────────────┴──────────┴───────────────────────┘
```

---

## 2. Схема таблиц

### `budgets` — основная таблица

```
budgets
├── budget_id           UUID PK
├── entity_type         ENUM (section | object | project |
│                             decomposition_stage | decomposition_item)
├── entity_id           UUID → ссылка на запись в нужной таблице
├── parent_budget_id    UUID → self-ref на родительский бюджет
├── total_amount        NUMERIC(15,2) ← ПЕРЕСЧИТЫВАЕТСЯ ТРИГГЕРОМ из budget_parts
├── name                VARCHAR(255) default 'Бюджет'
├── description         TEXT
├── is_active           BOOLEAN default true
├── created_by          UUID → auth.users
├── created_at          TIMESTAMPTZ
└── updated_at          TIMESTAMPTZ ← обновляет триггер trg_budgets_updated_at

UNIQUE (entity_type, entity_id)  — один бюджет на сущность
```

### `budget_parts` — части бюджета (main / premium / custom)

```
budget_parts
├── part_id             UUID PK
├── budget_id           UUID FK → budgets
├── part_type           ENUM (main | premium | custom) default 'main'
├── custom_name         VARCHAR — только для custom
├── percentage          NUMERIC(5,2)  ┐ либо одно, либо другое
├── fixed_amount        NUMERIC(15,2) ┘ не оба одновременно
├── calculated_amount   NUMERIC(15,2) — вычисляется через триггер
├── requires_approval   BOOLEAN default false
├── approval_threshold  NUMERIC — порог для авто-согласования
├── color               VARCHAR(7) HEX
├── created_at          TIMESTAMPTZ
└── updated_at          TIMESTAMPTZ

Триггеры:
  BEFORE INSERT/UPDATE → trg_validate_budget_parts_percentage
  AFTER  INSERT/UPDATE/DELETE → trg_recalculate_budget_total
```

### `budget_expenses` — расходы

```
budget_expenses
├── expense_id          UUID PK
├── budget_id           UUID FK → budgets
├── part_id             UUID FK → budget_parts (nullable)
├── amount              NUMERIC(15,2)
├── description         TEXT
├── expense_date        DATE default CURRENT_DATE
├── work_log_id         UUID FK → work_logs (nullable)
├── status              VARCHAR default 'approved'
│                       ('pending' | 'approved' | 'rejected')
├── approved_by         UUID → auth.users
├── approved_at         TIMESTAMPTZ
├── rejection_reason    TEXT
├── created_by          UUID → auth.users
└── created_at          TIMESTAMPTZ
```

### `budget_history` — история изменений

```
budget_history
├── history_id    UUID PK
├── budget_id     UUID FK → budgets
├── change_type   VARCHAR ('created' | 'amount_changed' | 'parts_changed' | 'status_changed')
├── previous_state JSONB
├── new_state      JSONB
├── comment        TEXT
├── changed_by     UUID → auth.users
└── changed_at     TIMESTAMPTZ
```

### `work_logs` — логи работ (главный источник фактических расходов)

```
work_logs
├── work_log_id           UUID PK
├── decomposition_item_id UUID FK → decomposition_items
├── budget_id             UUID FK → budgets (ОБЯЗАТЕЛЕН!)
├── work_log_hours        NUMERIC
├── work_log_hourly_rate  NUMERIC
├── work_log_amount       NUMERIC — hours × rate, считается в триггере
├── work_log_date         DATE
├── work_log_description  TEXT
├── work_log_created_by   UUID → auth.users
├── external_id           TEXT (ID из Worksection)
└── external_source       TEXT

Триггеры:
  BEFORE INSERT/UPDATE → trg_check_work_log_budget (валидация)
  AFTER  INSERT/UPDATE/DELETE → trg_manage_work_log_expense (создаёт/меняет/удаляет budget_expenses)
```

### `decomposition_stages` и `decomposition_items`

```
decomposition_stages
├── decomposition_stage_id        UUID PK
├── decomposition_stage_section_id UUID FK → sections
├── decomposition_stage_name      TEXT
├── decomposition_stage_start     DATE
├── decomposition_stage_finish    DATE
├── decomposition_stage_order     INTEGER
├── decomposition_stage_responsibles UUID[] — массив ответственных
├── external_id / external_source TEXT (Worksection)
└── created_at / updated_at       TIMESTAMPTZ

decomposition_items
├── decomposition_item_id           UUID PK
├── decomposition_item_section_id   UUID FK → sections
├── decomposition_item_stage_id     UUID FK → decomposition_stages
├── decomposition_item_description  TEXT
├── decomposition_item_planned_hours NUMERIC
├── decomposition_item_work_category_id UUID FK → work_categories
├── decomposition_item_difficulty_id UUID FK → decomposition_difficulty_levels
├── decomposition_item_order        INTEGER
├── external_id / external_source   TEXT (Worksection)
└── created_at / updated_at         TIMESTAMPTZ
```

---

## 3. Иерархия сущностей и бюджетов

```
projects
   │  ↳ budget (entity_type='project')       — 114 бюджетов, 32 000 BYN
   │
   └─── objects
            │  ↳ budget (entity_type='object')  — 539 бюджетов, 18 820 BYN
            │
            └─── sections ──── section_hourly_rate (BYN/час, nullable)
                     │  ↳ budget (entity_type='section') — 3 961 бюджет, 27 590 BYN
                     │
                     └─── decomposition_stages
                                │  ↳ budget (entity_type='decomposition_stage')
                                │             — 12 774 бюджета, 4 495 BYN
                                │
                                └─── decomposition_items
                                           │  ↳ budget (entity_type='decomposition_item')
                                           │             — 12 192 бюджета, 1 432 124 BYN ← основной объём
                                           │
                                           └─── work_logs
                                                    work_log_hours × work_log_hourly_rate
                                                    = work_log_amount
                                                    ↓
                                                    budget_expenses (статус auto='approved')
```

**Распределение бюджетов по типам (продакшен):**

| entity_type          | кол-во бюджетов | total_amount (BYN) | budget_parts |
|----------------------|----------------:|-------------------:|-------------:|
| decomposition_item   |          12 192 |      1 432 124     |            3 |
| decomposition_stage  |          12 774 |          4 495     |            4 |
| section              |           3 961 |         27 590     |        2 393 |
| object               |             539 |         18 820     |          281 |
| project              |             114 |         32 000     |           77 |

> **Вывод:** 84% всех бюджетов (decomposition_stage + decomposition_item) практически не имеют budget_parts. Вся логика частей (main/premium/custom) сосредоточена на уровне section/object/project.

---

## 4. Views — что делают и как считают

### `v_cache_budgets` — основной view (загружает страницу)

Используется в `getBudgets()` → `useBudgets()` → `useBudgetsHierarchy()`.

```sql
SELECT
  b.budget_id, b.entity_type, b.entity_id, b.name,
  b.total_amount, b.is_active, b.parent_budget_id,
  b.created_at, b.updated_at,

  -- ЧАСТЬ main (left join по part_type='main'):
  main_part.part_id AS main_part_id,
  COALESCE(
    NULLIF(main_part.fixed_amount, 0),
    NULLIF(main_part.calculated_amount, 0),
    CASE WHEN main_part.percentage IS NOT NULL
         THEN ROUND((b.total_amount * main_part.percentage) / 100, 2)
    END
  ) AS main_amount,
  COALESCE(main_spent.amount, 0) AS main_spent,

  -- ЧАСТЬ premium (аналогично):
  premium_part.part_id AS premium_part_id,
  ... AS premium_amount,
  COALESCE(premium_spent.amount, 0) AS premium_spent,

  -- ИТОГО расходов (только approved):
  COALESCE(total_spent.amount, 0) AS total_spent,
  b.total_amount - COALESCE(total_spent.amount, 0) AS remaining_amount,
  CASE WHEN b.total_amount > 0
       THEN ROUND((total_spent / total_amount) * 100, 2)
       ELSE 0
  END AS spent_percentage,

  pb.name AS parent_name,
  pb.total_amount AS parent_total_amount

FROM budgets b
LEFT JOIN budgets pb ON pb.budget_id = b.parent_budget_id
-- Части:
LEFT JOIN budget_parts main_part    ON main_part.budget_id = b.budget_id AND main_part.part_type = 'main'
LEFT JOIN budget_parts premium_part ON premium_part.budget_id = b.budget_id AND premium_part.part_type = 'premium'
-- Три подзапроса к budget_expenses WHERE status='approved':
LEFT JOIN (SELECT budget_id, SUM(amount) FROM budget_expenses WHERE status='approved' GROUP BY budget_id) total_spent   ON ...
LEFT JOIN (SELECT part_id,   SUM(amount) FROM budget_expenses WHERE status='approved' GROUP BY part_id)   main_spent    ON ...
LEFT JOIN (SELECT part_id,   SUM(amount) FROM budget_expenses WHERE status='approved' GROUP BY part_id)   premium_spent ON ...
WHERE b.is_active = true
```

### `v_budgets_full` — детальный view с частями как JSONB

Используется при открытии детали бюджета.

```sql
-- Дополнительно к v_cache_budgets добавляет:
parts AS jsonb_agg([{
  part_id, part_type, percentage, fixed_amount, calculated_amount, color,
  requires_approval, approval_threshold,
  spent_amount      ← SUM(budget_expenses WHERE status='approved' AND part_id=X),
  remaining_amount  ← fixed_amount - spent_amount,
  spent_percentage  ← spent/fixed*100
}] ORDER BY main→premium→custom),

total_spent             ← SUM(budget_expenses WHERE status='approved'),
remaining_amount        ← total_amount - total_spent,
spent_percentage        ← total_spent/total_amount*100,
pending_expenses_count  ← COUNT(budget_expenses WHERE status='pending'),
children_count          ← COUNT(дочерних бюджетов WHERE is_active=true)
```

> ⚠️ В `v_budgets_full` расчёт `remaining_amount` по части считается как `fixed_amount - spent`, а не `calculated_amount - spent`. Если часть задана процентом — `remaining_amount` будет некорректным (0 - spent = отрицательный).

### `v_cache_section_budget_summary` — сводка по разделам

```sql
SELECT s.*,
  1 AS budget_count,  -- ← ЗАХАРДКОЖЕНО, всегда 1!
  COALESCE(b.total_amount, 0) AS total_planned,
  COALESCE(spent.amount, 0)   AS total_spent,
  total_planned - total_spent AS remaining,
  ROUND((spent / total_planned) * 100, 2) AS spent_percentage
FROM sections s
LEFT JOIN budgets b ON b.entity_id = s.section_id AND b.entity_type = 'section' AND b.is_active = true
LEFT JOIN (SELECT budget_id, SUM(amount) FROM budget_expenses WHERE status='approved' GROUP BY budget_id) spent
          ON spent.budget_id = b.budget_id
```

### Декомпозиционные views

| View | Что делает |
|------|------------|
| `view_decomposition_item_actuals` | Фактические часы и сумма по задаче: SUM(work_log_hours), SUM(work_log_amount) |
| `view_decomposition_item_totals` | То же, с округлением до 2 знаков |
| `view_decomposition_stage_agg` | Агрегат по этапу: план/факт часов, кол-во задач, даты |
| `view_section_decomposition_totals` | Агрегат по разделу: план/факт часов и сумм |
| `view_work_logs_enriched` | Полная информация о work_log с JOIN на items, stages, sections, objects, projects, profiles |

---

## 5. Триггеры — автоматическая логика в БД

### Цепочка при создании work_log

```
INSERT INTO work_logs (hours=8, hourly_rate=50, budget_id=X, decomposition_item_id=Y)
    │
    ▼  BEFORE INSERT
┌──────────────────────────────────────────────────┐
│  trg_check_work_log_budget                       │
│  Проверяет:                                      │
│  1. budgets.entity_type = 'decomposition_item'   │
│  2. budgets.entity_id = decomposition_item_id    │
│  3. budgets.total_amount > 0                     │
│  Иначе → RAISE EXCEPTION (транзакция откатится)  │
└──────────────────────────────────────────────────┘
    │
    ▼  AFTER INSERT
┌──────────────────────────────────────────────────┐
│  trg_manage_work_log_expense  (SECURITY DEFINER) │
│                                                  │
│  v_amount = 8 × 50 = 400 BYN                    │
│                                                  │
│  INSERT INTO budget_expenses:                    │
│    budget_id = X                                 │
│    amount = 400                                  │
│    status = 'approved'  ← автоматически!         │
│    approved_by = created_by                      │
│    work_log_id = <новый work_log_id>             │
└──────────────────────────────────────────────────┘

UPDATE work_logs → UPDATE budget_expenses (пересчёт amount)
DELETE work_logs → DELETE budget_expenses (каскад)
```

### Цепочка при изменении budget_parts

```
INSERT/UPDATE/DELETE INTO budget_parts
    │
    ▼  BEFORE (INSERT/UPDATE)
┌──────────────────────────────────────────────────────┐
│  trg_validate_budget_parts_percentage                │
│  Если NEW.percentage IS NOT NULL:                    │
│    SUM(% других частей этого бюджета) + NEW.% ≤ 100 │
│    Иначе → RAISE EXCEPTION                           │
│  Если NEW.percentage IS NULL → пропускаем            │
└──────────────────────────────────────────────────────┘
    │
    ▼  AFTER (INSERT/UPDATE/DELETE)
┌──────────────────────────────────────────────────────┐
│  trg_recalculate_budget_total                        │
│                                                      │
│  v_total = SUM(fixed_amount WHERE fixed_amount IS NOT NULL) │
│            по всем частям этого бюджета              │
│                                                      │
│  UPDATE budgets SET total_amount = v_total           │
│                                                      │
│  ⚠️  ТОЛЬКО fixed_amount! Если часть через %,        │
│     total_amount останется 0 (баг!)                  │
└──────────────────────────────────────────────────────┘
```

---

## 6. Как загружается страница (клиентский поток)

```
Страница /tasks?tab=budgets
    │
    ▼
BudgetsViewInternal
    │
    ├── useBudgetsHierarchy(filters)
    │       │
    │       ├── useResourceGraphData(filters)
    │       │    └── загружает projects → objects → sections → stages → items
    │       │        из resource-graph модуля (несколько запросов к БД)
    │       │
    │       └── useBudgets({ is_active: true })
    │            └── getBudgets() [Server Action]
    │                 └── SELECT * FROM v_cache_budgets
    │                     WHERE is_active = true
    │                     ORDER BY created_at DESC
    │                     LIMIT 1000 за раз (пагинация по 1000!)
    │
    └── [клиентская JS трансформация]
         Создаёт Map<"entity_type:entity_id" → BudgetInfo[]>
         Рекурсивно присоединяет бюджеты к узлам иерархии
         Считает агрегаты в JS:
           totalPlanned = SUM(top-level бюджеты без parent_budget_id)
           totalSpent   = SUM(все spent_amount)
           plannedHours = SUM(decomposition_item_planned_hours)
         Рендерит BudgetsHierarchy (рекурсивно)
```

---

## 7. Откуда берётся каждая цифра в UI

| Цифра в UI | Источник |
|---|---|
| **Плановая сумма бюджета** | `budgets.total_amount` (пересчитывается триггером из `budget_parts.fixed_amount`) |
| **Израсходовано** | `v_cache_budgets.total_spent` = `SUM(budget_expenses.amount WHERE status='approved')` |
| **Остаток** | `total_amount − total_spent` (считается в view) |
| **% освоения** | `ROUND(total_spent / total_amount × 100, 2)` (в view) |
| **Сумма части main** | `budget_parts.fixed_amount` ИЛИ `percentage/100 × total_amount` |
| **Расход по части** | `SUM(budget_expenses.amount WHERE part_id=X AND status='approved')` |
| **Плановые часы** | `SUM(decomposition_item_planned_hours)` — считается в JS на клиенте |
| **С коэффициентом** | `плановые_часы × 1.2` (HOURS_ADJUSTMENT_FACTOR, константа) |
| **Расчётный бюджет** | `плановые_часы × 1.2 × section_hourly_rate` (клиент) |
| **Фактические часы** | `SUM(work_log_hours)` через `view_decomposition_item_actuals` |
| **Стоимость факт. работ** | `work_log_hours × work_log_hourly_rate` → автоматически в `budget_expenses` через триггер |

---

## 8. Индексы на таблицах бюджетов

| Таблица | Индекс | Тип | Покрывает |
|---------|--------|-----|-----------|
| budgets | `budgets_v2_unique_entity` | UNIQUE BTREE | `(entity_type, entity_id)` |
| budgets | `idx_budgets_v2_entity` | BTREE | `(entity_type, entity_id)` — дублирует unique! |
| budgets | `idx_budgets_v2_active` | PARTIAL | `is_active = true` |
| budgets | `idx_budgets_v2_parent` | PARTIAL | `parent_budget_id IS NOT NULL` |
| budget_parts | `idx_budget_parts_budget` | BTREE | `budget_id` |
| budget_parts | `idx_budget_parts_type` | BTREE | `part_type` |
| budget_expenses | `idx_budget_expenses_budget` | BTREE | `budget_id` |
| budget_expenses | `idx_budget_expenses_status` | **PARTIAL** `status='pending'` | только pending! |
| budget_expenses | `idx_budget_expenses_part` | PARTIAL `part_id IS NOT NULL` | `part_id` |
| budget_expenses | `idx_budget_expenses_date` | BTREE | `expense_date` |
| work_logs | `idx_work_logs_item_id` + `idx_work_logs_decomposition_item_id` | BTREE | `decomposition_item_id` — **дублирует!** |
| work_logs | `idx_work_logs_date` + `idx_work_logs_date2` | BTREE | `work_log_date` — **дублирует!** |
| work_logs | `idx_work_logs_budget` | PARTIAL `NOT NULL` | `budget_id` |

---

## 9. Найденные проблемы

### 🔴 Критичные (влияют на данные / производительность)

**P1 — Нет индекса `status='approved'` на `budget_expenses`**
- Все три views делают `WHERE status='approved'` по 18 643 строкам
- Индекс есть только для `status='pending'` (это partial index!)
- При росте таблицы → seq scan на каждый запрос к view
- **Fix:** `CREATE INDEX idx_budget_expenses_approved ON budget_expenses(budget_id) WHERE status='approved';`

**P2 — Триггер `recalculate_budget_total` игнорирует `percentage`-части**
- Функция считает `SUM(fixed_amount WHERE fixed_amount IS NOT NULL)`
- Если добавить часть через `percentage`, `total_amount` останется 0
- Все бюджеты с percentage-частями будут показывать 0 BYN
- **Fix:** пересчитать `calculated_amount` на основе текущего `total_amount`, или хранить `total_amount` отдельно (независимо от частей)

**P3 — v_cache_budgets загружает ВСЕ 29 580 бюджетов за раз**
- Пагинация по 1000, без фильтрации по entity_type на уровне запроса
- При каждом открытии страницы — 30 запросов по 1000 строк
- **Fix:** добавить фильтрацию по entity_type или проектам, или использовать другой подход к загрузке

**P4 — `v_budgets_full`: `remaining_amount` по части считается некорректно для percentage-частей**
- `remaining_amount = COALESCE(fixed_amount, 0) - spent_amount`
- Если часть через `percentage` → `fixed_amount = NULL` → `0 - spent = отрицательное`
- **Fix:** `COALESCE(calculated_amount, 0) - spent_amount`

### 🟡 Важные (влияют на корректность данных)

**P5 — `budget_count = 1` захардкожен в `v_cache_section_budget_summary`**
- VIEW всегда возвращает `budget_count = 1`, независимо от реального числа
- Поле фактически бесполезно
- **Fix:** `COUNT(b.budget_id) AS budget_count` или убрать поле

**P6 — Дублирующий индекс на `budgets`**
- `budgets_v2_unique_entity` (UNIQUE) и `idx_budgets_v2_entity` (обычный) — одинаковые поля `(entity_type, entity_id)`
- Обычный индекс никогда не используется (UNIQUE покрывает всё)
- **Fix:** `DROP INDEX idx_budgets_v2_entity;`

**P7 — Два дублирующих индекса на `work_logs`**
- `idx_work_logs_date` и `idx_work_logs_date2` — оба на `work_log_date`
- `idx_work_logs_item_id` и `idx_work_logs_decomposition_item_id` — оба на `decomposition_item_id`
- **Fix:** удалить дубли

**P8 — Документация в репозитории описывает несуществующую схему**
- `modules/budgets/migrations/2025-12-09_*.sql` описывает старую схему: `budget_versions`, `budget_tags`, `budget_tag_links`
- Ни одной из этих таблиц нет в продакшен БД
- `docs/budgets.md` тоже устарел
- **Fix:** обновить/пометить как архив

### 🟠 Потенциальные проблемы

**P9 — 84% бюджетов без `budget_parts`**
- У decomposition_stage: 12 774 бюджета, только 4 части (0.03%)
- У decomposition_item: 12 192 бюджета, только 3 части (0.02%)
- View корректно отрабатывает (LEFT JOIN → NULL), но логика частей не работает для декомпозиции

**P10 — `MOCK_HOURLY_RATE = 15` в constants.ts**
- Если `section_hourly_rate = NULL` → расчётный бюджет считается по 15 BYN/ч
- Нет предупреждения пользователю что используется заглушка
- **Fix:** показывать явно что ставка не задана, или загружать из БД

**P11 — `v_cache_budgets` выполняет 3 подзапроса к `budget_expenses` для каждого бюджета**
- Для 29K бюджетов: total_spent, main_spent, premium_spent — три отдельных GROUP BY
- Потенциально тяжело при росте `budget_expenses`
- **Fix:** объединить в один CTE

**P12 — Нет Realtime-подписок**
- Изменения бюджетов другими пользователями не обновляют UI
- Нужен refetch или Supabase Realtime subscription

---

## 10. План продакшен-подготовки

### Приоритеты

```
🔴 P1-P4  — критично, делать первыми (влияют на данные и производительность)
🟡 P5-P8  — важно, делать во вторую очередь
🟠 P9-P12 — желательно, делать когда есть время
```

---

### Фаза 1 — Исправление БД (без риска потери данных)

**✅ 1.1 Добавить индекс на `budget_expenses (approved)`** — *выполнено 2026-04-28*
```sql
CREATE INDEX idx_budget_expenses_approved
ON budget_expenses(budget_id)
WHERE status = 'approved';
```
Миграция: `budgets_phase1_add_approved_expenses_index`

**✅ 1.2 Удалить дублирующие индексы** — *выполнено 2026-04-28*
```sql
DROP INDEX IF EXISTS idx_budgets_v2_entity;         -- дубль unique constraint
DROP INDEX IF EXISTS idx_work_logs_date2;            -- дубль idx_work_logs_date
DROP INDEX IF EXISTS idx_work_logs_item_id;          -- дубль idx_work_logs_decomposition_item_id
```
Миграция: `budgets_phase1_drop_duplicate_indexes`

**⏭️ 1.3 Исправить `v_cache_section_budget_summary`** — *пропущено, не нужно*
> Проверка данных показала: каждый раздел имеет ровно 1 бюджет (0 разделов без бюджета из 3945).
> UNIQUE constraint гарантирует max 1 бюджет на сущность. Хардкод `1` случайно корректен.
> Поле `budget_count` нигде не используется в коде — только объявлено в типах.

**1.4 Исправить `v_budgets_full` — remaining по percentage-частям** — *в процессе*
```sql
-- Заменить в parts JSONB:
-- было:   COALESCE(bp.fixed_amount, 0) - spent_amount AS remaining_amount
-- стало:  учитывать percentage * total_amount / 100 когда fixed_amount IS NULL
```

---

### Фаза 2 — Исправление логики (требует обсуждения)

**2.1 Пересмотреть `recalculate_budget_total`**

Текущая логика: `total_amount = SUM(fixed_amount)` — игнорирует percentage-части.

Варианты:
- **Вариант А:** `total_amount` задаётся вручную, части — только для разбивки (не меняют total). Тогда триггер на `budget_parts` вообще не должен обновлять `total_amount`.
- **Вариант Б:** `total_amount` = SUM(fixed_amount + percentage-based amounts). Но тогда нужен базовый total для расчёта percentage.

> Нужно уточнить бизнес-логику: total_amount — это независимое значение или производное от частей?

**2.2 Исправить константу `MOCK_HOURLY_RATE`**
- Убрать fallback на 15 или сделать его явным в UI (серый текст "ставка не задана")

---

### Фаза 3 — Оптимизация загрузки

**3.1 Оптимизировать `v_cache_budgets`** — объединить три подзапроса к `budget_expenses` в один CTE

```sql
-- Было: три LEFT JOIN с SELECT...GROUP BY
-- Стало:
WITH expenses_agg AS (
  SELECT
    budget_id,
    part_id,
    SUM(amount) FILTER (WHERE TRUE) AS spent_budget,
    SUM(amount) FILTER (WHERE part_id = main_part.part_id) AS spent_main,
    SUM(amount) FILTER (WHERE part_id = premium_part.part_id) AS spent_premium
  FROM budget_expenses
  WHERE status = 'approved'
  GROUP BY budget_id, part_id
)
```

**3.2 Добавить фильтрацию при загрузке**
- Загружать бюджеты только для нужных проектов/объектов (не всё 29K)
- Или добавить серверную агрегацию вместо клиентской

**3.3 Realtime подписки**
- Добавить Supabase Realtime на `budgets` и `budget_expenses`
- Инвалидировать кэш при изменениях

---

### Фаза 4 — Документация

- [ ] Обновить `modules/budgets/README.md` (устарел)
- [ ] Пометить `docs/budgets.md` как архив
- [ ] Пометить миграции в `modules/budgets/migrations/` как устаревшие (старая схема)
- [ ] Этот файл (`docs/budgets-under-the-hood.md`) — актуальный источник правды

---

## 11. Быстрые ответы на типичные вопросы

**Откуда берётся сумма расходов?**
> `work_log_hours × work_log_hourly_rate` → триггер `trg_manage_work_log_expense` автоматически создаёт `budget_expenses` со статусом `approved`. Вручную расходы не добавляются.

**Почему у задачи (decomposition_item) бюджет в 1.4M BYN а у проекта всего 32K?**
> Бюджеты несвязаны иерархически в большинстве случаев — у 84% бюджетов `parent_budget_id = NULL`. Агрегация считается в JS, не в БД.

**Что такое "расчётный" бюджет в UI?**
> Это прогноз: `SUM(planned_hours) × 1.2 × section_hourly_rate`. Не хранится в БД, считается в клиентском коде.

**Может ли бюджет уйти в минус?**
> Да: нет ни constraint, ни проверки что `total_spent ≤ total_amount`. Остаток может стать отрицательным.

**Что происходит при удалении work_log?**
> Триггер `trg_manage_work_log_expense` автоматически удаляет связанную запись из `budget_expenses`. Spent сумма уменьшается.

---

## 12. Связи с другими модулями

| Модуль | Как связан |
|--------|------------|
| `resource-graph` | Источник иерархии проектов для страницы бюджетов |
| `cache` | Фабрики хуков, queryKeys, инвалидация |
| `modules/tasks` | Вкладка Бюджеты находится внутри страницы задач (/tasks?tab=budgets) |
| Worksection (внешний) | Синхронизация work_logs через VPS сервис work-to-ws.eneca.work |
| `sections` | `section_hourly_rate` — ставка для расчётного бюджета |

---

## 13. Анализ кода — проблемы производительности и архитектуры

> Анализ проведён путём чтения всех файлов `modules/budgets/`, `modules/budgets-page/` и сравнения с паттернами `modules/cache/`, `modules/sections-page/`.

### Как работает cache-модуль (эталон)

Прежде чем разбирать проблемы — важно понять что cache-модуль уже предоставляет:

| Фабрика | Что делает |
|---------|------------|
| `createCacheMutation({ optimisticUpdate })` | onMutate → cancelQueries → snapshot → setQueriesData; onError → restore snapshot; onSuccess → invalidateKeys |
| `createUpdateMutation` | optimistic update для update: сохраняет list + detail snapshot, применяет merge, откатывает при ошибке |
| `createCreateMutation` | optimistic update для create: добавляет элемент в список |
| `createDeleteMutation` | optimistic update для delete: убирает элемент из списка |
| `staleTimePresets` | fast=2мин, medium=3мин, slow=5мин, static=10мин |
| `refetchOnWindowFocus: false` | не рефетчит при переключении вкладок (Realtime берёт на себя) |

Для сравнения: `sections-page/hooks/useSectionLoadingMutations.ts` корректно использует `createCacheMutation` с `optimisticUpdate`, который мгновенно обновляет иерархию в кэше и откатывает при ошибке.

---

### Критические проблемы кода

---

#### 🔴 KOD-1 — Загрузка ВСЕХ 29 580 бюджетов при открытии страницы

**Файл:** `modules/budgets/actions/budget-actions.ts:94–145`
**Файл:** `modules/budgets/hooks/index.ts:64–72`

```typescript
// Текущий код: while-цикл, грузит всё
const { data: budgets } = useBudgets({ is_active: true }, { enabled })
// → getBudgets({ is_active: true })
// → while (hasMore) { query.range(page*1000, ...) }
// → 30 ПОСЛЕДОВАТЕЛЬНЫХ запросов к БД (29 580 / 1000 = ~30 страниц)
```

**Последствия:**
- При открытии вкладки Бюджеты: ~30 последовательных HTTP-запросов к Supabase
- Каждый запрос к `v_cache_budgets` — тяжёлый (5 JOIN + 3 subquery на 29K строк)
- Пользователь видит загрузку 3–10 секунд
- Все 29K бюджетов грузятся независимо от текущих фильтров

**Причина:** `getBudgets` не использует фильтры из InlineFilter. Фильтрация применяется только после получения всех данных — на клиенте в JS.

**Fix:** Передавать фильтры проектов/разделов в запрос. Если пользователь выбрал "подразделение:ОВ", загружать только бюджеты проектов этого подразделения.

---

#### 🔴 KOD-2 — Нет оптимистичных обновлений на ключевых мутациях

**Файл:** `modules/budgets/hooks/index.ts:184–193, 168–175`

```typescript
// Текущий код — createCacheMutation БЕЗ optimisticUpdate
export const useUpdateBudgetAmount = createCacheMutation<UpdateBudgetAmountInput, BudgetCurrent>({
  mutationFn: updateBudgetAmount,
  invalidateKeys: (input) => [
    queryKeys.budgets.lists(),   // ← инвалидирует ВСЕ 29K записей
    queryKeys.budgets.detail(input.budget_id),
    queryKeys.budgets.full(input.budget_id),
    queryKeys.budgets.history(input.budget_id),
    queryKeys.budgets.sectionSummary(),
  ],
})
```

**Последствия:**
- Пользователь меняет сумму бюджета → ждёт round-trip до сервера (~500мс)
- После ответа инвалидируется `lists()` → перезагружаются ВСЕ 29K бюджетов снова
- UI "прыгает": значение пропадает → появляется после рефетча
- Cache module поддерживает optimistic updates (`createUpdateMutation`) — просто не используется

**Сравнение с `sections-page`:**
```typescript
// sections-page ПРАВИЛЬНО:
export const useUpdateLoadingDates = createCacheMutation({
  mutationFn: updateSectionLoading,
  optimisticUpdate: {             // ← мгновенное обновление кэша
    queryKey: queryKeys.sectionsPage.all,
    updater: (oldData, input) => updateLoadingDatesInCache(oldData, input),
  },
  invalidateKeys: [queryKeys.sectionsPage.all, queryKeys.resourceGraph.all],
})
```

---

#### 🔴 KOD-3 — `onRefresh` как механизм обновления (полный рефетч при каждом действии)

**Файл:** `modules/budgets-page/components/BudgetRow.tsx:130–133`
**Файл:** `modules/budgets-page/components/BudgetsHierarchy.tsx:265–270`

```typescript
// Текущий код в BudgetRow
const handleCreateSuccess = () => {
  onAutoExpand?.(node.id)
  onRefresh?.()          // ← вызывает refetch() из useBudgetsHierarchy
}
```

`onRefresh` → `refetch()` в `useBudgetsHierarchy` → одновременно рефетчит:
1. `useResourceGraphData` (вся иерархия проектов)
2. `useBudgets` (все 29K бюджетов)

**Последствия:**
- Изменение часов у задачи → перезагружается ВСЯ страница
- Изменение сложности у item → перезагружается ВСЯ страница
- Изменение ставки раздела → перезагружается ВСЯ страница
- Нет точечной инвалидации — только "снести и перегрузить всё"

**Fix:** Использовать `queryClient.invalidateQueries` с точными ключами в каждой мутации (как делает секции-page). `onRefresh` — аварийный fallback, не основной механизм.

---

#### 🔴 KOD-4 — Декомпозиционные мутации вообще не используют cache-модуль

**Файл:** `modules/budgets-page/components/StageInlineCreate.tsx`
**Файл:** `modules/budgets-page/components/ItemInlineCreate.tsx`
**Файл:** `modules/budgets-page/hooks/index.ts`

Мутации создания этапов/задач:
- Вызывают server action напрямую
- После успеха вызывают `onSuccess()` → `onRefresh()` → полный рефетч
- Не используют `createCacheMutation`, нет optimistic updates
- Нет rollback при ошибке (пользователь видит "создалось" но item исчез)

Утилиты в `optimistic-updates.ts` (`createOptimisticStage`, `createOptimisticItem`) **написаны, но нигде не используются**.

---

#### 🟡 KOD-5 — O(n²) вычисления при построении дерева

**Файл:** `modules/budgets-page/hooks/use-budgets-hierarchy.ts:104–116`

```typescript
function aggregateBudgetsUpward(node: HierarchyNode): AggregatedBudgetsByType[] {
  const allBudgets = [...node.budgets]
  for (const child of node.children) {
    const childBudgets = collectAllBudgets(child)  // ← рекурсивный обход
    allBudgets.push(...childBudgets)
  }
  return aggregateBudgetsByType(allBudgets)
}
```

Вызывается для **каждого** узла при трансформации. Для раздела с 10 этапами и 50 задачами — обход 60 узлов. Для проекта с 10 разделами — 600+ обходов. Со всеми 29K узлами — миллионы итераций в одном `useMemo`.

Дополнительно `calculateAnalytics` вызывает `collectAllBudgetsFromNode` ещё раз для каждого проекта — двойной обход.

**Fix:** Вычислять агрегаты снизу вверх за один проход (bottom-up), а не рекурсивно сверху.

---

#### 🟡 KOD-6 — 7 `useState` в каждом `BudgetRow` (модальные окна)

**Файл:** `modules/budgets-page/components/BudgetRow.tsx:122–128`

```typescript
const [deleteModalOpen, setDeleteModalOpen] = useState(false)
const [createModalOpen, setCreateModalOpen] = useState(false)
const [sectionCreateModalOpen, setSectionCreateModalOpen] = useState(false)
const [sectionDeleteModalOpen, setSectionDeleteModalOpen] = useState(false)
const [stageCreateOpen, setStageCreateOpen] = useState(false)
const [itemCreateOpen, setItemCreateOpen] = useState(false)
const [projectEditOpen, setProjectEditOpen] = useState(false)
```

При дереве с 1000 видимых узлов → 7000 состояний. Модальные окна рендерятся для **каждого** узла, даже если закрыты (хоть и не в DOM из-за conditional rendering, state всё равно занимает память).

**Fix:** Вынести активное модальное окно в один внешний state (какой modal открыт + для какого nodeId).

---

#### 🟡 KOD-7 — `collectSpentFromAllDescendants` вызывается на каждый рендер

**Файл:** `modules/budgets-page/components/BudgetRow.tsx:87–96, 172–174`

```typescript
const spentBudgetChildren = node.children.length > 0
  ? collectSpentFromAllDescendants(node)   // ← O(n) рекурсия на каждый рендер
  : node.budgets.reduce((sum, b) => sum + b.spent_amount, 0)
```

`BudgetRow` обёрнут в `React.memo`, но `collectSpentFromAllDescendants` не мемоизирована. При любом ре-рендере родителя (например, toggle expand) все строки пересчитывают спент рекурсивно.

---

#### 🟡 KOD-8 — Множество `console.log` в продакшен-коде

**Файл:** `modules/budgets-page/actions/decomposition.ts:116,127,130,137,153,168,169`
**Файл:** `modules/budgets-page/components/BudgetsHierarchy.tsx:87,98,102,108`

```typescript
// decomposition.ts:116
console.log('[createDecompositionStage] Starting with input:', JSON.stringify(input))
// ... ещё 6 console.log в одной функции
```

```typescript
// BudgetsHierarchy.tsx:87
console.log('[BudgetsHierarchy] Effect triggered:', { highlightSectionId, hasAutoExpanded, nodesLength })
```

В продакшене это засоряет консоль пользователя и незначительно замедляет выполнение.

---

#### 🟡 KOD-9 — `updateBudgetAmount` делает 4 последовательных DB-вызова

**Файл:** `modules/budgets/actions/budget-actions.ts:559–594`

```
1. getBudgetById()        ← лишний запрос, только для previousAmount в историю
2. UPDATE budgets
3. INSERT budget_history
4. getBudgetById()        ← возврат нового состояния
```

Вызов 1 избыточен: `previous_state` можно получить из клиентского кэша или передать как параметр. Итого: 3 последовательных запроса вместо 4.

---

#### 🟡 KOD-10 — `createBudget` не атомарен — риск "зависшего" бюджета

**Файл:** `modules/budgets/actions/budget-actions.ts:476–511`

```typescript
// Шаг 1: INSERT budgets → OK
// Шаг 2: INSERT budget_parts → FAIL
// → "Откатываем": supabase.from('budgets').delete()...
// Но если DELETE тоже упадёт → бюджет без части навсегда
```

Нет транзакции. Ручной rollback через DELETE ненадёжен. Правильно: использовать SQL-транзакцию через RPC-функцию.

---

#### 🟠 KOD-11 — `useBudgetFull` не используется в основном флоу иерархии

**Файл:** `modules/budgets/hooks/index.ts:248–252`

Хук создан, но `BudgetsHierarchy` использует `useBudgetsHierarchy` → `useBudgets` (v_cache_budgets). `v_budgets_full` с JSONB-частями загружается отдельно только в `BudgetPartsEditor` (по клику). Это правильный подход — данные грузятся по требованию.

---

#### 🟠 KOD-12 — Нет виртуализации списка

При раскрытии большого проекта с 400+ разделами и сотнями этапов — рендерится 2000+ DOM-узлов. `BudgetRow` обёрнут в `React.memo`, но сам DOM тяжёлый (каждая строка 6+ div-элементов).

**Fix:** `@tanstack/react-virtual` для виртуализации видимой области. Применимо только после решения KOD-1 (чтобы данные вообще были).

---

#### 🟠 KOD-13 — `invalidateKeys` инвалидирует `lists()` = все 29K снова

**Файл:** `modules/budgets/hooks/index.ts:186`

```typescript
invalidateKeys: (input) => [
  queryKeys.budgets.lists(),   // ← это ['budgets', 'list'] — инвалидирует ВСЕ списки
  ...
]
```

`queryKeys.budgets.lists()` как partial key захватывает весь список бюджетов. После каждой мутации — перезагрузка 29K записей. Нужна точечная инвалидация по entity (только проект/раздел который изменился).

---

### Сравнение с другими вкладками

| Параметр | sections-page | kanban | budgets-page |
|---|---|---|---|
| Optimistic updates | ✅ createCacheMutation + optimisticUpdate | ✅ используются | ❌ нет |
| Rollback при ошибке | ✅ автоматический | ✅ автоматический | ❌ нет |
| Точечная инвалидация | ✅ по entity ID | ✅ по entity ID | ❌ инвалидирует всё |
| Server-side фильтрация | ✅ фильтры в запросе | ✅ фильтры в запросе | ❌ всё на клиенте |
| console.log в prod | ❌ нет | ❌ нет | 🔴 есть |
| Виртуализация | зависит | нет (Kanban колонки) | ❌ нет |
| Рекурсивные вычисления | нет | нет | 🟡 O(n²) |

---

## 14. Обновлённый план продакшен-подготовки (с кодом)

Приоритеты расставлены по формуле: **влияние на пользователя × сложность исправления**.

---

### Спринт 1 — Быстрые wins (1–2 дня, без риска)

**S1.1 — Удалить все `console.log`**
- `modules/budgets-page/actions/decomposition.ts` — 7+ вызовов
- `modules/budgets-page/components/BudgetsHierarchy.tsx` — 4 вызова
- `modules/budgets-page/components/BudgetInlineEdit.tsx` — DEBUG режим (оставить флаг, убрать из prod)

**S1.2 — Индексы в БД (без даунтайма)**
```sql
CREATE INDEX CONCURRENTLY idx_budget_expenses_approved
ON budget_expenses(budget_id)
WHERE status = 'approved';

DROP INDEX IF EXISTS idx_budgets_v2_entity;         -- дубль unique
DROP INDEX IF EXISTS idx_work_logs_date2;            -- дубль
DROP INDEX IF EXISTS idx_work_logs_item_id;          -- дубль
```

**S1.3 — Исправить `v_cache_section_budget_summary`**
```sql
-- Заменить "1 AS budget_count" на COUNT(b.budget_id)
```

**S1.4 — Исправить `v_budgets_full` remaining для percentage-частей**
```sql
-- COALESCE(bp.calculated_amount, 0) - spent_amount AS remaining_amount
```

---

### Спринт 2 — Оптимистичные обновления (2–3 дня)

**S2.1 — Добавить optimistic update в `useUpdateBudgetAmount`**

```typescript
// modules/budgets/hooks/index.ts
export const useUpdateBudgetAmount = createCacheMutation<UpdateBudgetAmountInput, BudgetCurrent>({
  mutationFn: updateBudgetAmount,
  optimisticUpdate: {
    queryKey: queryKeys.budgets.lists(),
    updater: (oldData, input) =>
      (oldData ?? []).map(b =>
        b.budget_id === input.budget_id
          ? { ...b, total_amount: input.total_amount,
              remaining_amount: input.total_amount - b.total_spent }
          : b
      ),
  },
  invalidateKeys: (input) => [
    queryKeys.budgets.detail(input.budget_id),
    queryKeys.budgets.full(input.budget_id),
    // НЕ инвалидируем lists() — оптимистичный апдейт уже обновил
  ],
})
```

**S2.2 — Использовать `createOptimisticStage` и `createOptimisticItem` (они уже написаны!)**

В `StageInlineCreate` и `ItemInlineCreate`: вместо `onSuccess → onRefresh` использовать `queryClient.setQueriesData` с `addChildToParent` из `optimistic-updates.ts`. При ошибке — `rollbackOptimisticUpdate`.

**S2.3 — Заменить `onRefresh` на точечную инвалидацию**

```typescript
// Вместо:
onSuccess={onRefresh}  // перегружает всё

// Делать в каждой мутации:
await queryClient.invalidateQueries({ queryKey: queryKeys.resourceGraph.all })
// только то что реально изменилось
```

---

### Спринт 3 — Загрузка данных (3–5 дней, требует обсуждения архитектуры)

**S3.1 — Серверная фильтрация в getBudgets**

Текущий флоу: фильтры из InlineFilter → `queryParams` → `useBudgetsHierarchy(queryParams)` → но `useBudgets({ is_active: true })` игнорирует queryParams.

Решение:
```typescript
// modules/budgets-page/hooks/use-budgets-hierarchy.ts
const { data: budgets } = useBudgets(
  {
    is_active: true,
    // Передаём project_ids из filters если они есть:
    project_ids: filters?.projectId ? [filters.projectId] : undefined,
  },
  { enabled }
)
```

Для этого нужно расширить `getBudgets` на поддержку фильтра по project_ids (через JOIN или subquery).

**S3.2 — Убрать while-loop пагинацию в getBudgets**

Вместо 30 последовательных запросов: один запрос с `limit` и серверной агрегацией. Или: использовать `useInfiniteQuery` для подгрузки по мере скролла.

**S3.3 — Оптимизировать `v_cache_budgets` — один CTE вместо трёх subquery**

```sql
CREATE OR REPLACE VIEW v_cache_budgets AS
WITH expenses_agg AS (
  SELECT
    budget_id,
    SUM(amount) AS total_spent,
    SUM(amount) FILTER (WHERE part_id IN (
      SELECT part_id FROM budget_parts WHERE part_type = 'main'
    )) AS main_spent,
    SUM(amount) FILTER (WHERE part_id IN (
      SELECT part_id FROM budget_parts WHERE part_type = 'premium'
    )) AS premium_spent
  FROM budget_expenses
  WHERE status = 'approved'
  GROUP BY budget_id
)
SELECT ... FROM budgets b
LEFT JOIN expenses_agg ea ON ea.budget_id = b.budget_id
...
```

---

### Спринт 4 — Вычисления и DOM (по необходимости)

**S4.1 — Bottom-up агрегация вместо O(n²)**

```typescript
// Новый подход: один проход снизу вверх
function buildHierarchyBottomUp(projects, budgetsMap) {
  // Сначала transform items → stages → sections → objects → projects
  // На каждом уровне агрегируем накопленные данные с детей
  // Результат: O(n) вместо O(n²)
}
```

**S4.2 — Вынести modal state из BudgetRow**

```typescript
// Вместо 7 useState в каждой строке:
// Один Context/store на уровне BudgetsHierarchy:
const [activeModal, setActiveModal] = useState<{
  type: 'deleteObject' | 'createSection' | 'deleteSection' | ...
  nodeId: string
} | null>(null)
```

**S4.3 — Виртуализация с @tanstack/react-virtual**

Применимо после S3 — когда данных не 29K, а отфильтрованное подмножество.

---

### Спринт 5 — Надёжность (параллельно со спринтами выше)

**S5.1 — Атомарное создание бюджета через RPC**

```sql
CREATE OR REPLACE FUNCTION create_budget_with_main_part(
  p_entity_type budget_entity_type,
  p_entity_id UUID,
  p_name TEXT,
  p_total_amount NUMERIC,
  p_user_id UUID
) RETURNS UUID AS $$
DECLARE v_budget_id UUID;
BEGIN
  INSERT INTO budgets (...) VALUES (...) RETURNING budget_id INTO v_budget_id;
  INSERT INTO budget_parts (budget_id, part_type, ...) VALUES (v_budget_id, 'main', ...);
  INSERT INTO budget_history (...) VALUES (...);
  RETURN v_budget_id;
END;
$$ LANGUAGE plpgsql;
```

**S5.2 — Убрать лишний getBudgetById в updateBudgetAmount**

Передавать `previousAmount` из клиента (он уже есть в кэше), не делать лишний SELECT.

**S5.3 — Realtime подписка на budgets**

```typescript
// modules/budgets/realtime.ts
supabase
  .channel('budgets-changes')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'budgets' }, () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.budgets.all })
  })
  .subscribe()
```

---

### Итоговая таблица задач

| # | Задача | Спринт | Сложность | Влияние |
|---|--------|--------|-----------|---------|
| S1.1 | Удалить console.log | 1 | 🟢 низкая | 🟡 средний |
| S1.2 | Индексы в БД | 1 | 🟢 низкая | 🔴 высокий |
| S1.3 | Фикс budget_count в view | 1 | 🟢 низкая | 🟡 средний |
| S1.4 | Фикс remaining в v_budgets_full | 1 | 🟢 низкая | 🟡 средний |
| S2.1 | Optimistic update updateBudgetAmount | 2 | 🟡 средняя | 🔴 высокий |
| S2.2 | Optimistic create stage/item | 2 | 🟡 средняя | 🔴 высокий |
| S2.3 | Заменить onRefresh на invalidate | 2 | 🟡 средняя | 🔴 высокий |
| S3.1 | Server-side фильтрация | 3 | 🔴 высокая | 🔴 высокий |
| S3.2 | Убрать while-loop пагинацию | 3 | 🟡 средняя | 🔴 высокий |
| S3.3 | Оптимизировать v_cache_budgets | 3 | 🟡 средняя | 🟡 средний |
| S4.1 | Bottom-up агрегация | 4 | 🔴 высокая | 🟡 средний |
| S4.2 | Modal state из BudgetRow | 4 | 🟡 средняя | 🟢 низкий |
| S4.3 | Виртуализация | 4 | 🔴 высокая | 🟡 средний |
| S5.1 | Атомарный createBudget через RPC | 5 | 🟡 средняя | 🟡 средний |
| S5.2 | Убрать лишний SELECT в update | 5 | 🟢 низкая | 🟢 низкий |
| S5.3 | Realtime подписка | 5 | 🟡 средняя | 🟡 средний |

---

## 15. Обновлённый анализ после коммита df9195e (2026-04-28)

> Коммит: `feat(budgets): расчёт бюджета из loadings × ставка отдела`

### Что изменилось архитектурно

До коммита `useBudgetsHierarchy` делал **2 параллельных запроса:**
```
useResourceGraphData  → projects/objects/sections/stages/items
useBudgets            → все 29 580 бюджетов (v_cache_budgets)
```

После коммита — **3 параллельных запроса:**
```
useResourceGraphData    → projects/objects/sections/stages/items
useBudgets              → все 29 580 бюджетов (v_cache_budgets)
useSectionCalcBudgets   → расчётный бюджет по разделам (v_cache_section_calc_budget)
                          передаётся массив section_id из текущей иерархии
                          запрос: .in('section_id', sectionIds)  ← точечный ✅
```

`useSectionCalcBudgets` реализован корректно: загружает только нужные разделы (`.in()`), `placeholderData: keepPreviousData` исключает моргание при пересчёте, `staleTime: medium`.

---

### Новые объекты в БД (все применены)

| Объект | Данные | Назначение |
|--------|--------|------------|
| `dim_work_calendar` | 2557 дней, 2024–2030 | Справочник рабочих дней РБ с учётом праздников и переносов |
| `department_budget_settings` | 41 отдел, 17.85 BYN/ч | Часовая ставка и часов/день по каждому отделу |
| `v_cache_loading_money` | VIEW | Расчёт money и hours для каждой загрузки |
| `v_cache_section_calc_budget` | VIEW | Агрегация по разделу: Σ money, Σ hours, count загрузок |

---

### BUG-1 — Добавление premium-части сбрасывает total_amount в 0

**Воспроизведение:** назначить бюджет → добавить premium часть с percentage=20% → total_amount обнуляется.

**Причина:** триггер `recalculate_budget_total` пересчитывает `total_amount = SUM(fixed_amount WHERE NOT NULL)`. Если у части задан `percentage` (а не `fixed_amount`), она даёт 0. Итог: total обнуляется.

**Принятое решение:** premium часть *выделяется из* `total_amount`, не добавляется поверх. `total_amount` — независимое поле, которое пользователь задаёт вручную через `updateBudgetAmount`. Триггер не должен его перезаписывать.

**Fix:** удалить триггер `trg_recalculate_budget_total` и функцию `recalculate_budget_total()`.
```sql
DROP TRIGGER IF EXISTS trg_recalculate_budget_total ON budget_parts;
DROP FUNCTION IF EXISTS recalculate_budget_total();
```

---

### BUG-2 — Вкладка Бюджеты не рендерится

**Файл:** `modules/tasks/components/TasksView.tsx`

В `TasksView.tsx` отсутствует блок рендера для `viewMode === 'budgets'` — присутствуют kanban, departments, sections, но budgets удалён. В миграции store (v1→v2) `budgets` также явно исключён из системных вкладок.

**Результат:** при переходе на вкладку Бюджеты пользователь видит пустой экран — компонент не рендерится вообще, запросы к БД не выполняются.

**Fix:**
```typescript
// TasksView.tsx — добавить import:
import { BudgetsViewInternal } from '@/modules/budgets-page'

// TasksView.tsx — добавить блок рендера:
{tabs.length > 0 && viewMode === 'budgets' && (
  <BudgetsViewInternal queryParams={queryParams} />
)}
```

```typescript
// tabs-store.ts — вернуть в SYSTEM_TABS:
{
  id: 'budgets', name: 'Бюджеты', viewMode: 'budgets',
  filterString: '', isSystem: true, order: 5,
  createdAt: '2024-01-01T00:00:00.000Z',
}
// Поднять version: 2 → 3, убрать 'budgets' из hiddenSystemIds в миграции
```

---

## 16. Что означают колонки страницы Бюджеты

```
┌──────────────────┬────┬─────────────────────────┬────────┬──────────────────────────────────────┐
│ Наименование     │Кат.│      ТРУДОЗАТРАТЫ        │ Ставка │            БЮДЖЕТЫ                   │
│                  │    │ План,ч │ С К,ч │ % род.  │ BYN/ч  │ Расчётн. │ Распред. │ Израсх.│Выдел.│
└──────────────────┴────┴─────────────────────────┴────────┴──────────────────────────────────────┘
```

### Кат.

Уровень сложности задачи (только для строк `decomposition_item`).
Источник: `decomposition_items.decomposition_item_difficulty_id → decomposition_difficulty_levels`.
Редактируемая. Не влияет на расчёт бюджета.

---

### ТРУДОЗАТРАТЫ

#### Plan, ч
```
section.plannedHours = Σ decomposition_item.planned_hours всех потомков
```
Ручной ввод в декомпозиции. На уровне item — редактируемое поле.
Агрегируется снизу вверх: item → stage → section → object → project.
Реальность: **502 из 3945 разделов** имеют заполненную декомпозицию (12.7%) — колонка пустая для 87%.

#### С К, ч
```
С К = Plan,ч × 1.2  (HOURS_ADJUSTMENT_FACTOR)
```
Идея: фактическая трудоёмкость на 20% больше плановой. Коэффициент захардкожен в `config/constants.ts`.
**Статус `@deprecated` с 2026-04-28.** Раньше использовалась для расчёта колонки «Расчётн.», теперь не участвует ни в каких вычислениях. Показывается в UI, но смысла не несёт.

#### % род.
```
% род. = (С К этого узла / С К родителя) × 100
```
Доля приведённых часов от родительского узла.
**Статус:** информационная, основана на deprecated `adjustedHours`. После удаления «С К» — теряет смысл.

---

### СТАВКА — BYN/ч

Поле `sections.section_hourly_rate`. Раньше входило в формулу: `Расчётн. = С К × BYN/ч`.
После коммита ставки управляются в `department_budget_settings` по отделу исполнителя.
`section_hourly_rate` остаётся как fallback — поле в БД не удаляется, только редактирование на этой странице становится избыточным.

---

### БЮДЖЕТЫ

#### Расчётн.
**До коммита:**
```
Расчётн. = Plan,ч × 1.2 × section_hourly_rate
```
**После коммита (актуально):**
```
Расчётн. = Σ по всем loadings раздела:
           loading.rate × dept.work_hours_per_day × work_days × dept.hourly_rate
```
Источник: `v_cache_section_calc_budget` → `useSectionCalcBudgets`.
На уровне section — из view. На object/project — агрегация по children в JS.
На decomposition_stage/item — не отображается (расчёт ведётся только на уровне раздела).
Tooltip при наведении: `{hours} ч / {count} загрузок / ⚠ {N} без ставки`.

#### Распред.
```
Распред. = Σ total_amount прямых детей
```
Сколько суммарно выделено на дочерние узлы.
Считается в JS при рендере: `children.reduce((s, c) => s + c.budgets.total_amount, 0)`.
Красный если `Распред. > Выделенный` — выделено больше чем есть.

#### Израсх.
```
Израсх. = Σ spent_amount всех потомков рекурсивно
```
Сколько фактически потрачено по всему поддереву.
Источник: `budget_expenses.amount WHERE status='approved'` (через `v_cache_budgets.total_spent`).
Считается в JS: `collectSpentFromAllDescendants(node)`.
Красный если `Израсх. > Распред.`.

#### Выделенный
`budgets.total_amount` — сумма назначенная пользователем вручную.
Единственное редактируемое поле в группе БЮДЖЕТЫ.
Inline edit: поле суммы + поле % от родителя (пересчитываются синхронно).
Кнопка PieChart → открывает `BudgetPartsEditor` с детализацией по частям.

---

## 17. Что убрать — анализ и безопасность

### Убрать немедленно (нет риска)

#### Кнопки создания и удаления сущностей (`BudgetRowActions.tsx`)

Страница Бюджеты предназначена только для работы с суммами. Создание и удаление объектов/разделов/этапов/задач — функциональность других вкладок (Канбан, Разделы).

Убрать из `BudgetRowActions.tsx`:
- Project: кнопка `+` объект, кнопка синхронизации с Worksection (`RefreshCw`)
- Object: кнопка `+` раздел, кнопка удаления объекта
- Section: кнопка `+` этап, кнопка удаления раздела
- Stage: кнопка `+` задача, кнопка удаления этапа
- Item: кнопка удаления задачи

Что остаётся: только `ItemCategorySelect` (читаемое поле категории) и редактирование бюджета.

Побочный эффект: из `BudgetRow.tsx` уходят **7 `useState`** для модальных окон и импорты 5 модалок + 4 inline-компонентов (StageInlineCreate/Delete, ItemInlineCreate/Delete).

---

#### Колонки «С К, ч» и «% род.»

Обе основаны на `adjustedHours` (`Plan × 1.2`) — deprecated-вычислении.
Не участвуют в расчёте бюджета. Убрать из `BudgetRowHours.tsx`.
Из `BudgetRow.tsx` убрать расчёт `adjustedHours`, `percentOfParentHours`, `effectiveRate`.
Из пропсов `BudgetRow` убрать `parentAdjustedHours`, `hourlyRate`.

---

#### Колонка «BYN/ч» (`SectionRateEdit`)

Ставка отдела управляется в AdminPanel → `department_budget_settings`. Редактирование ставки раздела на этой странице избыточно.
Убрать `SectionRateEdit` и всю группу «Ставка» из `BudgetRow.tsx`.
Поле `section_hourly_rate` в БД не трогать — оно используется как fallback.

> ⚠️ Проверить: `SectionRateEdit` используется только в `BudgetRow.tsx`? Да — grep по репозиторию показывает единственное использование.

---

### Обсудить (требует решения)

#### Скрыть строки decomposition_stage и decomposition_item

Расчётный бюджет не показывается на уровне stage/item — по архитектурному решению.
Если скрыть эти строки целиком:

```
Сейчас:                          После:
Проект                           Проект
  └── Объект                       └── Объект
        └── Раздел                       └── Раздел ← конечный уровень
              └── Этап
                    └── Задача
```

Плюсы: 12K+ этапов и 12K+ задач не рендерятся → DOM уменьшается в 5–10 раз → страница значительно быстрее. Уходят `ItemDifficultySelect`, `ItemHoursEdit`, `ItemCategorySelect`.

Минусы: пользователь теряет контекст декомпозиции. Колонка «Plan,ч» на section становится менее информативной (только 12.7% разделов заполнены).

Варианты реализации:
1. Раздел — конечный уровень, декомпозиция не раскрывается вообще
2. Раздел раскрывается, но показывает только этапы (без задач)
3. Переключатель «показать декомпозицию» (скрыто по умолчанию)

---

## 18. Materialized Views — нужны ли?

Обычный `VIEW` выполняет SQL при каждом запросе. `MATERIALIZED VIEW` сохраняет результат на диск и обновляет его по команде `REFRESH CONCURRENTLY` (без блокировки читателей). Результат: чтение мгновенное, данные с небольшой задержкой до следующего обновления.

---

### `v_cache_loading_money` — материализовать

```sql
-- На каждую загрузку выполняется коррелированный подзапрос:
(SELECT COUNT(*) FROM dim_work_calendar
 WHERE calendar_date BETWEEN loading_start AND loading_finish
   AND is_working_day)
```

При N загрузках — N подзапросов к `dim_work_calendar`. В системе тысячи загрузок → тысячи скрытых запросов при каждом открытии страницы.

```sql
CREATE MATERIALIZED VIEW mv_loading_money AS
  SELECT * FROM v_cache_loading_money;

CREATE UNIQUE INDEX ON mv_loading_money(loading_id);  -- нужен для CONCURRENTLY
```

Стратегия обновления — триггерная функция после:
- `INSERT/UPDATE/DELETE` на `loadings`
- `INSERT/UPDATE/DELETE` на `department_budget_settings`
- изменений в `dim_work_calendar` (через `calendar_events`)

```sql
CREATE OR REPLACE FUNCTION refresh_mv_loading_money()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_loading_money;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
```

---

### `v_cache_section_calc_budget` — материализовать вместе

```sql
SELECT loading_section, SUM(money), SUM(hours), COUNT(*) ...
FROM v_cache_loading_money  -- зависит от loading_money
```

Если `v_cache_loading_money` материализован — этот view становится быстрым сам по себе. Можно:
- Оставить как VIEW поверх MV (простота)
- Или тоже материализовать (если нужна максимальная скорость)

Обновлять после обновления `mv_loading_money`.

---

### `v_cache_budgets` — отложить

29K строк, 3 подзапроса к `budget_expenses` на каждую.
После добавленного индекса `idx_budget_expenses_approved` стало лучше.
`budget_expenses` меняется при каждом `work_log` (18K+ записей) — refresh нужен слишком часто.

Сначала применить CTE-оптимизацию (задача S3.3). Если не хватит — материализовать.

---

### `v_budgets_full` — не нужно

Используется только при открытии `BudgetPartsEditor` (редкий клик). Материализация не даст пользы.

---

### `v_cache_section_budget_summary` — не нужно

Простой view, поле `budget_count` не используется в коде.

---

### Итог

| View | Решение | Причина |
|------|---------|---------|
| `v_cache_loading_money` | ✅ материализовать | N коррелированных подзапросов per строку |
| `v_cache_section_calc_budget` | ✅ материализовать или VIEW поверх MV | зависит от loading_money |
| `v_cache_budgets` | ⏳ после CTE-оптимизации | частое обновление, сначала попробовать CTE |
| `v_budgets_full` | ❌ | редко используется |
| `v_cache_section_budget_summary` | ❌ | простой, мало используется |

---

## 19. Полный план задач

### Блокеры — сделать первыми

| # | Задача | Где | Время |
|---|--------|-----|-------|
| **BUG-2** | Вернуть BudgetsViewInternal в TasksView + tabs-store | `TasksView.tsx`, `tabs-store.ts` | 30 мин |
| **BUG-1** | Удалить триггер `recalculate_budget_total` | БД | 15 мин |

### Быстрые wins — до 2 дней

| # | Задача | Где | Время |
|---|--------|-----|-------|
| **UI-1** | Убрать кнопки создания/удаления сущностей | `BudgetRowActions.tsx` | 1 час |
| **UI-2** | Убрать кнопку синхронизации с WS | `BudgetRowActions.tsx` | 15 мин |
| **UI-3** | Убрать колонки «С К,ч» и «% род.» | `BudgetRow.tsx`, `BudgetRowHours.tsx` | 1 час |
| **UI-4** | Убрать колонку «BYN/ч» (SectionRateEdit) | `BudgetRow.tsx` | 30 мин |
| **S1.1** | Удалить console.log | `decomposition.ts`, `BudgetsHierarchy.tsx` | 30 мин |
| ✅ **S1.2** | Индексы в БД | БД | выполнено |

### Выполнено (2026-04-29)

Полный детальный план: `docs/plans/budgets-release-plan.md`

| Задача | Статус |
|--------|--------|
| ✅ Индексы: `idx_budget_expenses_approved` добавлен, дубли удалены | БД |
| ✅ Триггеры `recalculate_budget_total` и `validate_budget_parts_percentage` удалены | БД |
| ✅ `v_cache_budgets` переписан через CTE (1 скан `budget_expenses` вместо 3) | БД |
| ✅ `v_cache_loading_money` переписан через JOIN (1 проход вместо 3650 подзапросов) | БД |
| ✅ `project_id` добавлен в `v_cache_budgets` через JOIN по PK-индексам | БД |
| ✅ `v_budgets_full` и `v_cache_section_budget_summary` удалены из БД | БД |
| ✅ Параллельная пагинация `getBudgets` (count + параллельные страницы) | код |
| ✅ Optimistic update для `useUpdateBudgetAmount` + `lists()` в invalidateKeys | код |
| ✅ Убран лишний `getBudgetById` в `updateBudgetAmount`, `previous_amount` с клиента | код |
| ✅ Убран запрос к `budget_parts` из `createExpense` | код |
| ✅ `keepPreviousData` в `useBudgets`, `onRefresh` удалён | код |
| ✅ Серверная фильтрация по проектам: `project_ids` фильтр через `project_id` в view | код + БД |
| ✅ Система частей (premium/custom) полностью удалена из UI, кода и БД | код + БД |
| ✅ Убраны: панель аналитики, колонка «Израсходовано», кнопки структур, WS sync | UI |
| ✅ Поле `%` изменено с редактируемого на read-only | UI + баг |
| ✅ `types/db.ts` регенерирован, мёртвые компоненты и типы удалены | код |
| ✅ Bad Request и баг пагинации исправлены | баги |

### Отложено

- `budget_parts` — не удаляем до координации с `DeleteObjectModal` + `npm run db:types`
- Materialized views — не нужны при текущем объёме (~3.6K загрузок)

---

*Обновлено 2026-04-29.*
