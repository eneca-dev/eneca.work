# Расчётный бюджет из загрузок (loadings)

**Статус:** В разработке
**Создано:** 2026-04-28
**Ветка:** `feature/restore-budgets-tab` (или новая — уточнить)
**Модуль:** `modules/budgets-page/`

---

## Цель

Заменить текущий расчёт «расчётного бюджета» на странице бюджетов с формулы на основе ручного ввода часов в декомпозиции на **расчёт из назначенных загрузок (`loadings`)** с учётом ставки отдела исполнителя.

## Текущее состояние (DEPRECATED)

**Формула:** `plannedHours × HOURS_ADJUSTMENT_FACTOR × MOCK_HOURLY_RATE`

- `plannedHours` — сумма `decomposition_items.planned_hours` (ручной ввод)
- `HOURS_ADJUSTMENT_FACTOR = 1.2` (захардкожено)
- `MOCK_HOURLY_RATE = 15 BYN/час` (захардкожено)

**Расположение:** `modules/budgets-page/components/BudgetRow.tsx:145-156`, `config/constants.ts`.

**Минусы:**
- Захардкоженная ставка
- Ручной ввод часов в декомпозиции, не отражает реальную нагрузку
- Не использует фактически назначенные ресурсы

## Целевое состояние

### Формула (per loading)

```
loading.money = loading.rate × dept.work_hours_per_day × work_days(start..finish) × dept.hourly_rate
```

где:
- `loading.rate` — доля FTE из `loadings.loading_rate`
- `dept` — отдел исполнителя: `profiles[loading.responsible].department_id`
- `dept.hourly_rate`, `dept.work_hours_per_day` — из `department_budget_settings`
- `work_days(start..finish)` — количество рабочих дней в диапазоне (учитывает выходные, праздники РБ, переносы)

### Агрегация по иерархии

```
section.calc_budget  = Σ loading.money по всем loadings раздела
object.calc_budget   = Σ section.calc_budget по children
project.calc_budget  = Σ object.calc_budget по children
```

**Важно:** на уровне `decomposition_stage` и `decomposition_item` расчёт не показываем — суммируем только по разделу целиком (по решению заказчика).

### Источники данных

| Сущность | Таблица / View | Назначение |
|----------|----------------|------------|
| Загрузка | `loadings` | Источник истины: rate, диапазон, исполнитель, раздел |
| Исполнитель → отдел | `profiles.department_id` | Связка loading → отдел для ставки |
| Ставка отдела | `department_budget_settings` (новая) | hourly_rate, work_hours_per_day |
| Календарь рабочих дней | `dim_work_calendar` (новая) | Кэш рабочих дней с учётом праздников/переносов |
| Глобальный календарь | `calendar_events` (тип `Праздник`/`Перенос`, `is_global=true`) | Источник для `dim_work_calendar` |

---

## Архитектура БД

### Новая таблица: `department_budget_settings`

```sql
CREATE TABLE department_budget_settings (
  department_id      UUID PRIMARY KEY REFERENCES departments(department_id) ON DELETE CASCADE,
  hourly_rate        NUMERIC(10,2) NOT NULL,
  work_hours_per_day NUMERIC(4,2)  NOT NULL DEFAULT 8,
  updated_at         TIMESTAMPTZ DEFAULT now(),
  updated_by         UUID REFERENCES profiles(user_id)
);
```
- Одна строка на отдел, без версионирования (можно добавить позже при необходимости)
- Сидер: для существующих отделов проставить дефолтные значения

### Новая таблица: `dim_work_calendar`

Справочник рабочих дней. Решает проблему производительности — без него `generate_series` пришлось бы выполнять для каждой загрузки.

```sql
CREATE TABLE dim_work_calendar (
  calendar_date  DATE PRIMARY KEY,
  is_working_day BOOLEAN NOT NULL,
  is_holiday     BOOLEAN NOT NULL DEFAULT false,
  is_swap        BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX idx_dim_work_calendar_working ON dim_work_calendar(calendar_date) WHERE is_working_day = true;
```

**Заполнение:** функция `refresh_work_calendar(start_date, end_date)`:
1. Генерирует даты через `generate_series`
2. Помечает Сб/Вс как нерабочие
3. Накладывает `calendar_events` с типом `Праздник` (`is_global=true`) → `is_working_day=false`
4. Накладывает `calendar_events` с типом `Перенос` → инвертирует `is_working_day`

**Покрытие:** инициализация на 5 лет вперёд, расширение по необходимости.

**Триггер обновления:** `AFTER INSERT/UPDATE/DELETE ON calendar_events WHERE is_global=true AND type IN ('Праздник','Перенос') → refresh_work_calendar(...)`.

### Новый view: `v_cache_loading_money`

Один money-расчёт на загрузку.

```sql
CREATE VIEW v_cache_loading_money AS
SELECT
  l.loading_id,
  l.loading_section,
  l.loading_responsible,
  l.loading_rate,
  p.department_id,
  dbs.hourly_rate,
  dbs.work_hours_per_day,
  (
    SELECT COUNT(*)
    FROM dim_work_calendar wc
    WHERE wc.calendar_date BETWEEN l.loading_start AND l.loading_finish
      AND wc.is_working_day
  ) AS work_days,
  (...) * l.loading_rate * dbs.work_hours_per_day                    AS hours,
  (...) * l.loading_rate * dbs.work_hours_per_day * dbs.hourly_rate  AS money
FROM loadings l
LEFT JOIN profiles p             ON p.user_id        = l.loading_responsible
LEFT JOIN department_budget_settings dbs ON dbs.department_id = p.department_id;
```

### Новый view: `v_cache_section_calc_budget`

Агрегация на уровень раздела.

```sql
CREATE VIEW v_cache_section_calc_budget AS
SELECT
  loading_section AS section_id,
  SUM(money)      AS calc_budget,
  SUM(hours)      AS total_hours,
  COUNT(*)        AS loading_count
FROM v_cache_loading_money
WHERE money IS NOT NULL
GROUP BY loading_section;
```

**Учитываем все loadings раздела** независимо от `loading_status` и `loading_stage`.

### Запасной план по производительности

Если `v_cache_loading_money` упрётся в latency:
1. Сделать `MATERIALIZED VIEW` с `REFRESH CONCURRENTLY` по триггеру изменения `loadings`
2. Либо денормализовать `loading_hours`/`loading_money` как столбцы в `loadings` через `BEFORE INSERT/UPDATE` триггер

---

## Изменения в коде

### `modules/budgets-page/types/index.ts`

```ts
interface HierarchyNode {
  /** @deprecated since 2026-04-28 — оставлено для исторических данных, см. docs/deprecated/budgets-planned-hours.md */
  plannedHours?: number

  // Новые поля
  calcBudgetFromLoadings?: number
  loadingHours?: number
  loadingCount?: number
}
```

### `modules/budgets-page/hooks/use-budgets-hierarchy.ts`

- Загружать `v_cache_section_calc_budget` для всех section_id в иерархии
- Подмешивать `calcBudgetFromLoadings`, `loadingHours`, `loadingCount` в section-узлы
- Агрегировать на object/project через `reduce(children)`

### `modules/budgets-page/components/BudgetRow.tsx:145-156`

```ts
// === DEPRECATED, см. docs/deprecated/budgets-planned-hours.md ===
// const adjustedHours = plannedHours * HOURS_ADJUSTMENT_FACTOR
// const calcBudget = adjustedHours > 0 ? adjustedHours * effectiveRate : null
// === END DEPRECATED ===

const calcBudget = node.calcBudgetFromLoadings ?? null
const hoursDisplay = node.loadingHours ?? null
```

### `modules/budgets-page/config/constants.ts`

```ts
/** @deprecated since 2026-04-28 — заменено на ставку из department_budget_settings */
export const MOCK_HOURLY_RATE = 15

/** @deprecated since 2026-04-28 — расчёт теперь идёт через loadings */
export const HOURS_ADJUSTMENT_FACTOR = 1.2
```

### Новые actions

**`modules/budgets-page/actions/loading-money.ts`**
- `getSectionCalcBudgets(sectionIds: string[])` → `Map<sectionId, { calcBudget, totalHours, loadingCount }>`

**`modules/admin/actions/department-rates.ts`** (или `modules/departments/`)
- `getDepartmentBudgetSettings()`
- `updateDepartmentBudgetSetting({ departmentId, hourlyRate, workHoursPerDay })`

### Новые hooks (через cache module)

- `useSectionCalcBudgets(sectionIds: string[])`
- `useDepartmentBudgetSettings()` — для админ-UI

### Realtime подписки

| Таблица | Условие | Эффект |
|---------|---------|--------|
| `loadings` | любые мутации | invalidate `useSectionCalcBudgets` |
| `department_budget_settings` | любые мутации | invalidate `useSectionCalcBudgets`, `useDepartmentBudgetSettings` |
| `calendar_events` | `is_global=true AND type IN (Праздник, Перенос)` | invalidate `useSectionCalcBudgets` (после refresh таблицы) |

---

## UI

### Страница бюджетов (`modules/budgets-page/`)

- Колонка «Часы» на section/object/project — read-only из `loadingHours`
- Колонка «Расчётный» — `calcBudgetFromLoadings`
- Tooltip: `{loadingHours} ч / {loadingCount} загрузок`
- Если loadings нет → `—`
- На decomposition_stage / decomposition_item — `—` (по решению, расчёт только на section и выше)

### Админ-UI настройки ставки отдела

**Расположение:** `app/(dashboard)/admin/departments/page.tsx` или вкладка в существующей странице отделов.

**Форма** (RHF + Zod):
- Список всех отделов
- На каждом: `hourly_rate` (BYN/час), `work_hours_per_day` (default 8)
- Inline-edit или модалка
- Permission: `budgets.settings.edit` (новый) — **ТРЕБУЕТ УТОЧНЕНИЯ**

---

## Зафиксированные решения по edge-кейсам

| # | Кейс | Решение |
|---|------|---------|
| A | У `loading_responsible` нет `department_id` | `money = 0`, флаг ошибки в tooltip («исполнитель без отдела») |
| B | Нет `department_budget_settings` для отдела | `money = 0`, флаг «не настроена ставка отдела» |
| C | `loading_responsible IS NULL` | Skip из агрегации, в tooltip — «без исполнителя — не учитывается» |
| D | `is_shortage = true` или любой `loading_status` | Учитываем все |
| E | Permission на редактирование ставки отдела | Новый `budgets.settings.edit` |

---

## Зафиксированные решения

| Решение | Значение |
|---------|----------|
| Формула | Через часы (вариант A): `rate × hours/day × work_days × BYN/h` |
| Источник истории старого расчёта | Сохраняем (deprecated, закомментировано) |
| Уровень настройки ставки | Глобально на уровне отдела |
| Уровень агрегации | Section и выше (object, project) |
| Учёт статусов loadings | Все статусы |
| Календарь | Из существующего `calendar_events`, с учётом праздников и переносов |
| Отдел для loading | По исполнителю: `profiles[loading_responsible].department_id` |
| Расчёт money | Per-loading, агрегация в section |
| Стратегия performance | `dim_work_calendar` + триггер обновления |
| Ветка | `feature/restore-budgets-tab` |
| Расположение админ-UI | Вкладка «Отделы» — `modules/users/admin/components/DepartmentsTab.tsx` |
| Стандартная ставка-сидер | **17.85 BYN/час**, 8 часов/день |
| Проверка прав в RLS | EXISTS-паттерн как в `2025-12-09_budgets_rls.sql` (через `user_roles`/`role_permissions`/`permissions`) |

---

## Этапы реализации

| # | Этап | Файлы | Агенты | Статус |
|---|------|-------|--------|--------|
| 0 | Performance design (`dim_work_calendar`) | `supabase/migrations/2026-04-28_dim_work_calendar.sql` | DB Architect | ✅ Done 2026-04-28 |
| 1 | DB схема (settings, views) | миграции, db:types | DB Architect, Migration Guardian | ✅ Done 2026-04-28 |
| 2 | Backend actions + hooks | `actions/`, `hooks/` | Cache, Security, TypeScript Guardians | ✅ Done 2026-04-28 |
| 3 | Расчёт и UI бюджетов | `BudgetRow.tsx`, `use-budgets-hierarchy.ts`, `types/`, `config/` | Clean Code, Next.js, Performance | ✅ Done 2026-04-28 |
| 4 | Админ-UI настройки ставки отдела | `modules/users/admin/components/DepartmentsTab.tsx` | Forms, Security | ✅ Done 2026-04-28 |
| 5 | Архивация старого расчёта | `docs/deprecated/budgets-planned-hours.md`, JSDoc-метки | Dead Code Hunter | ✅ Done 2026-04-28 |

**Статус фичи:** ✅ Все 5 этапов завершены 2026-04-28. Готова к мониторингу 2 спринта (≈ до 2026-06-15).

### Этап 0 — выполнен 2026-04-28

**Применено:**
- Таблица `dim_work_calendar` (2557 строк, 2024-01-01 → 2030-12-31)
- Функция `refresh_work_calendar(p_start, p_end)` с `SECURITY DEFINER + SET search_path = public, pg_temp`
- Триггер `trg_calendar_events_refresh_dim` на `calendar_events` (фильтр: `is_global` + `Праздник`/`Перенос`)
- Initial seed: 7 праздников + 6 переносов из существующих `calendar_events`

**Правки после DB Architect review:**
- `IF NOT EXISTS` / `DROP IF EXISTS` — idempotency
- `SET search_path = public, pg_temp` на обеих SECURITY DEFINER функциях
- `AND wc.is_holiday = false` в Step 3 функции refresh — праздник побеждает перенос при коллизии

**Замечание:**
В `calendar_events` отсутствуют праздники РБ для 2026+ (1 мая, 9 мая, 3 июля и т.д.) — их нужно добавить через админку календаря, триггер автоматически пересчитает `dim_work_calendar`.

### Этап 1 — выполнен 2026-04-28

**Применено:**
- Таблица `department_budget_settings` (41 строка, по числу отделов)
- Сидер: `17.85 BYN/час`, `8 ч/день` для всех существующих отделов
- Permission `budgets.settings.edit` зарегистрирован
- RLS-политики (SELECT для всех, write через permission, паттерн как в `2025-12-09_budgets_rls.sql`)
- View `v_cache_loading_money` — 3613 загрузок, money/hours per loading
- View `v_cache_section_calc_budget` — 1158 разделов, агрегация
- `npm run db:types` выполнен, типы добавлены в `types/db.ts`

**Sanity check:**
- Общий расчётный бюджет всех загрузок: ~9.23M BYN
- Общие часы: ~517k ч
- Ошибок (no_department / no_rate): **0** — все исполнители имеют отдел и ставку

**Правки после DB Architect review:**
- Удалена несуществующая колонка `category` из `INSERT INTO permissions`
- `DROP VIEW IF EXISTS ... CASCADE` заменён на `CREATE OR REPLACE VIEW` (безопаснее при повторных запусках)
- Добавлен `valid_loading_count` в `v_cache_section_calc_budget` (для UI tooltip)

### Этап 2 — выполнен 2026-04-28

**Создано:**
- `modules/budgets-page/actions/loading-money.ts` — `getSectionCalcBudgets`
- `modules/budgets-page/hooks/use-section-calc-budgets.ts` — query hook с `placeholderData: keepPreviousData`
- `modules/users/admin/actions/department-rates.ts` — `getDepartmentBudgetSettings`, `updateDepartmentBudgetSetting` (auth → permission → validation)
- `modules/users/admin/hooks/use-department-budget-settings.ts` — query + `createUpdateMutation` с invalidate `budgets.calc()`
- Миграция `2026-04-28_publication_department_budget_settings.sql` (добавлена в `supabase_realtime` publication)

**Изменено:**
- `modules/cache/keys/query-keys.ts` — добавлены ключи `budgets.calc()`, `calcBySections(ids)`, `departmentSettings()`
- `modules/cache/realtime/config.ts` — расширена подписка `loadings` (+ `budgets.calc()`), новая подписка `department_budget_settings`
- Реэкспорты в `budgets-page/actions/index.ts`, `budgets-page/hooks/index.ts`, `users/admin/index.ts`

**Правки после агентов:**
- 🤖 Cache Guardian → `useUpdateDepartmentBudgetSetting` рефакторен на `createUpdateMutation` factory; добавлен `placeholderData: keepPreviousData`; миграция publication для realtime
- 🤖 Security Guardian → порядок проверок: auth → permission → input validation (правильный security pattern); типизация permission-обхода без `any`
- 🤖 TypeScript Guardian → `SectionCalcBudget` → `ViewRow<'v_cache_section_calc_budget'>`, `DepartmentBudgetSetting` → `TableRow<'department_budget_settings'>`, убраны лишние касты

### Этап 3 — выполнен 2026-04-28

**Изменено:**
- `modules/budgets-page/types/index.ts` — добавлены поля `loadingHours`, `calcBudgetFromLoadings`, `loadingCount`, `loadingErrorsCount`; `plannedHours` помечен `@deprecated`
- `modules/budgets-page/config/constants.ts` — `MOCK_HOURLY_RATE`, `HOURS_ADJUSTMENT_FACTOR` помечены `@deprecated`
- `modules/budgets-page/hooks/use-budgets-hierarchy.ts` — добавлен запрос `useSectionCalcBudgets`, `calcMap` собирает `section_id → SectionCalcSummary`, `transformSection`/`transformObject`/`transformProject` подмешивают и агрегируют новые поля
- `modules/budgets-page/components/BudgetRow.tsx` — старая формула `plannedHours × 1.2 × 15` помечена комментарием как DEPRECATED, расчётный бюджет теперь `node.calcBudgetFromLoadings`, добавлен Radix Tooltip с часами/loadings/errors

**UI поведение:**
- Колонка «Расчётный» — суммы из loadings × ставка отдела
- Tooltip при наведении: `{часы} ч / {N} загрузок`
- При наличии ошибок (нет отдела/ставки) — амбер underline + warning в tooltip
- На section и выше — отображается; на decomposition_stage/decomposition_item — `—`

**Правки после агентов:**
- 🤖 Clean Code Guardian → native HTML `title` заменён на Radix `<Tooltip>` (UX, touch, дизайн-система); уточнён комментарий DEPRECATED-блока; добавлен TODO-комментарий к импорту deprecated констант

### Группа 1 (улучшения после code review) — выполнено 2026-04-28

- ✅ Permission check переведён с ручного JOIN на RPC `user_has_permission(p_user_id, p_permission_name)` — минус 50 строк кода, минус 4 typed interface
- ✅ Loading/error из `useSectionCalcBudgets` поднимается в `use-budgets-hierarchy.ts` — silent failures устранены
- ✅ Loadings без `loading_responsible` теперь учитываются как `error_flag='no_responsible'` (22 шт. в текущей БД) вместо скрытия

### Этап 4 — выполнен 2026-04-28

**Создано:**
- `modules/users/admin/schemas/department-rate.schema.ts` — Zod-схема с `z.coerce.number()`
- `modules/users/admin/components/DepartmentRateCell.tsx` — inline-display + popover с RHF + zodResolver

**Изменено:**
- `modules/users/admin/types/admin.ts` — добавлен `canEditBudgetSettings`
- `modules/users/admin/hooks/useAdminPermissions.ts` — `hasPermission('budgets.settings.edit')`
- `modules/users/admin/components/DepartmentsTab.tsx` — новая колонка «Ставка для бюджета»

**UI поведение:**
- Колонка показывает `{rate} BYN/ч · {hours} ч/день` (default 17.85 / 8)
- При наличии permission `budgets.settings.edit` — кнопка-карандашик открывает popover с формой
- Optimistic update + invalidate `budgets.calc()` (после смены ставки расчётный бюджет на странице бюджетов сразу пересчитывается)
- Realtime подписка на `department_budget_settings` синхронизирует изменения между сессиями

**Правки после агентов:**
- 🤖 Forms Guardian (8/10) → `disabled={settingsLoading}` на кнопке, `form.reset(values)` после успешного submit, `title` для tooltip
- 🤖 Security Guardian (9/10) → 3 уровня защиты подтверждены: UI (`canEdit` проп) → Server Action (`user_has_permission` RPC) → RLS на таблице
- ⚠️ Знаное (нефикс): `hourlyRate=0` остаётся допустимым (R&D отделы без биллинга). При операторской ошибке может занулить расчёт отдела — стоит добавить confirm на ввод 0 в будущем

---

## Definition of Done

- [ ] `dim_work_calendar` заполнен на 5 лет вперёд, триггер на `calendar_events` работает
- [ ] `department_budget_settings` создана, есть миграция-сидер
- [ ] `v_cache_loading_money`, `v_cache_section_calc_budget` отдают корректные суммы
- [ ] Тест-кейсы: обычная неделя, неделя с праздником, неделя с переносом
- [ ] BudgetRow показывает новый расчёт; старый закомментирован
- [ ] Realtime: меняем ставку отдела → пересчёт в UI
- [ ] Админ-UI редактирования ставок с permission guard
- [ ] `docs/deprecated/budgets-planned-hours.md` создан
- [ ] `npm run build` без ошибок
- [ ] Все агенты дали ✅
- [ ] README модуля обновлён

---

## Связанные документы

- `modules/budgets/README.md` — общая система бюджетов
- `docs/budgets-system-research.md` — исследование текущей системы
- `docs/main-pipeline.md` — пайплайн разработки
- `modules/cache/README.md` — паттерны кэширования
- `modules/calendar/utils.ts` — существующая логика календаря (`isWorkingDay`)
