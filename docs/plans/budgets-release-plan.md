# Бюджеты — план подготовки к релизу

> Создан: 2026-04-29  
> Обновлён: 2026-04-29  
> Статус: ✅ всё выполнено

---

## Итоговые решения

| Что | Решение |
|-----|---------|
| Части бюджета (premium, custom) | Удалены из UI и БД |
| Кнопки создания/удаления структур | Убраны из UI |
| Синхронизация с Worksection | Убрана из UI |
| Колонки «С К,ч», «% род.», «BYN/ч» | Убраны |
| Колонка «Израсходовано» | Убрана из UI (логика в коде сохранена) |
| Панель «План / Факт / % освоено» | Убрана из UI |
| Поле `%` у бюджета | Только чтение (было редактируемым → баг) |
| Вкладка Бюджеты не открывается | Исправлено |
| Триггер сбрасывает бюджет в 0 | Исправлено |

---

## Блок 1 — Баги

| # | Задача | Файл(ы) |
|---|--------|---------|
| ✅ **BUG-1** | Вернуть BudgetsViewInternal в TasksView + tabs-store (версия 3) | `TasksView.tsx`, `tabs-store.ts` |
| ✅ **BUG-2** | Удалить триггеры `recalculate_budget_total` и `validate_budget_parts_percentage` | БД |
| ✅ **BUG-3** | Bad Request: убрать `.in(sectionIds)` из useSectionCalcBudgets | `loading-money.ts`, `use-section-calc-budgets.ts` |
| ✅ **BUG-4** | Баг пагинации: двойной `.select()` ломал `count` → только первые 1000 строк | `budget-actions.ts` |
| ✅ **BUG-5** | Поле `%` было редактируемым и случайно сохраняло неожиданные суммы | `BudgetInlineEdit.tsx` |
| ✅ **BUG-6** | `parent_planned_amount` не обновлялся в кэше → `%` появлялся только после обновления страницы | `budgets/hooks/index.ts` |

---

## Блок 2 — Удалить систему частей бюджета (premium/custom)

| # | Задача | Файл(ы) |
|---|--------|---------|
| ✅ **2.1** | Удалить 10 premium/custom записей из `budget_parts` в БД | БД |
| ✅ **2.2** | Убрать `BudgetPartsEditor` и кнопку PieChart | `BudgetInlineEdit.tsx`, `BudgetAmountEdit.tsx` |
| ✅ **2.3** | Удалить `addBudgetPart`, `updateBudgetPart`, `deleteBudgetPart` | `budget-actions.ts`, `hooks/index.ts` |
| ✅ **2.4** | Убрать поля `main_*`, `premium_*`, `type_*` из `BudgetInfo` | `types/index.ts`, `use-budgets-hierarchy.ts`, `optimistic-updates.ts` |
| ✅ **2.5** | Убрать типы `BudgetFull`, `SectionBudgetSummary`, `BudgetPart`, `AggregatedBudgetsByType`, `BudgetsAnalyticsData` | `modules/budgets/types.ts`, `budgets-page/types/index.ts` |
| ✅ **2.6** | Удалить `getBudgetFull`, `getSectionBudgetSummary` и связанные хуки | `budget-actions.ts`, `hooks/index.ts` |
| ✅ **2.7** | Удалить Zod-схемы `CreateBudgetPartSchema`, `UpdateBudgetPartSchema` | `budget-actions.ts` |
| ✅ **2.8** | Удалить мёртвые компоненты `BudgetBars.tsx`, `BudgetCell.tsx`, `BudgetCreatePopover.tsx` | компоненты |
| ✅ **2.9** | Удалить view `v_budgets_full` и `v_cache_section_budget_summary` из БД | БД |

---

## Блок 3 — Скрыть лишнее из UI

| # | Задача | Файл(ы) |
|---|--------|---------|
| ✅ **3.1** | Убрать все кнопки создания/удаления: `BudgetRowActions` → `return null` | `BudgetRowActions.tsx` |
| ✅ **3.2** | Убрать 7 `useState` + модалки + inline-creates из `BudgetRow` | `BudgetRow.tsx` |
| ✅ **3.3** | Убрать заголовки Трудозатраты + Ставка из таблицы | `BudgetsHierarchy.tsx` |
| ✅ **3.4** | Убрать WS sync + `useWorkToWsSync` из `BudgetsHierarchy` | `BudgetsHierarchy.tsx` |
| ✅ **3.5** | Убрать колонки «С К,ч», «% род.», «BYN/ч», «SectionRateEdit» из строк | `BudgetRow.tsx` |
| ✅ **3.6** | Убрать колонку «Израсходовано» + `collectSpentFromAllDescendants` | `BudgetRow.tsx`, `BudgetsHierarchy.tsx` |
| ✅ **3.7** | Убрать панель аналитики «N проектов / План / Факт / %» | `BudgetsViewInternal.tsx` |
| ✅ **3.8** | Убрать `calculateAnalytics`, `aggregateBudgetsByType`, `aggregateBudgetsUpward` и связанные | `use-budgets-hierarchy.ts` |
| ✅ **3.9** | `onRefresh` — мёртвый проп, убран из `BudgetRow` и `BudgetsHierarchy` | `BudgetRow.tsx`, `BudgetsHierarchy.tsx` |

---

## Блок 4 — Удалить console.log

| # | Задача | Файл(ы) |
|---|--------|---------|
| ✅ **4.1** | Удалить все `console.log` (оставить `console.error`) | `decomposition.ts`, `reference-data.ts`, `BudgetsHierarchy.tsx`, `BudgetInlineEdit.tsx`, `BudgetAmountEdit.tsx` |

---

## Блок 5 — Оптимизация БД

| # | Задача | Файл(ы) |
|---|--------|---------|
| ✅ **5.1** | Добавить индекс `idx_budget_expenses_approved` (status='approved') | БД |
| ✅ **5.2** | Удалить дублирующие индексы: `idx_budgets_v2_entity`, `idx_work_logs_date2`, `idx_work_logs_item_id` | БД |
| ✅ **5.3** | Переписать `v_cache_budgets`: CTE вместо 3× scan `budget_expenses` | БД |
| ✅ **5.4** | Переписать `v_cache_loading_money`: JOIN вместо 3650 коррелированных подзапросов | БД |
| ✅ **5.5** | Добавить `project_id` в `v_cache_budgets` через JOIN по PK-индексам | БД |

---

## Блок 6 — Оптимизация кода

| # | Задача | Файл(ы) |
|---|--------|---------|
| ✅ **6.1** | Параллельная пагинация `getBudgets`: count + параллельные страницы вместо while-loop | `budget-actions.ts` |
| ✅ **6.2** | Optimistic update для `useUpdateBudgetAmount`: мгновенный отклик UI | `budgets/hooks/index.ts` |
| ✅ **6.3** | Убрать лишний `getBudgetById` в `updateBudgetAmount`, передавать `previous_amount` с клиента | `budget-actions.ts` |
| ✅ **6.4** | Убрать запрос к `budget_parts` из `createExpense` | `budget-actions.ts` |
| ✅ **6.5** | `keepPreviousData` в `useBudgets` — нет мигания при смене фильтров | `use-budgets-hierarchy.ts` |
| ✅ **6.6** | Серверная фильтрация по проектам: `project_id` в view + `project_ids` фильтр в `getBudgets` | БД, `budget-actions.ts`, `use-budgets-hierarchy.ts` |
| ✅ **6.7** | `invalidateKeys` для `updateBudgetAmount` включает `lists()` — `parent_planned_amount` у дочерних обновляется фоном | `budgets/hooks/index.ts` |

---

## Блок 7 — Типы и регенерация

| # | Задача | Файл(ы) |
|---|--------|---------|
| ✅ **7.1** | `types/db.ts` регенерирован через Supabase MCP (после удаления view и добавления `project_id`) | `types/db.ts` |
| ✅ **7.2** | Добавлен `project_id: string | null` в `BudgetCurrent` | `budgets/types.ts` |
| ✅ **7.3** | `modules/budgets-page/index.ts` — убраны экспорты удалённых типов | `index.ts` |

---

## Решения принятые по ходу работы

- `budget_parts` таблицу **не удаляем** — `DeleteObjectModal` в модуле `modals` зависит от неё; нужна координированная миграция с `npm run db:types`
- Materialized views **не создаём** — после OPT-3/4/5 производительность достаточна при текущих ~3.6K загрузок
- `decomposition_items` / `decomposition_stages` строки в дереве — **оставляем**
- `budget_history` — **оставляем** в БД, в UI не показываем
- `budget_expenses.total_spent` — продолжает приходить в SELECT *, но не отображается; убрать можно позже при удалении `budget_parts`
- OPT-1 (фильтр entity_type) — **не применяем**: decomp строки видимы в UI и их бюджеты нужны

---

## Бэкапы

- `docs/deprecated/budgets-dropped-views-2026-04-29.sql` — SQL удалённых view (`v_budgets_full`, `v_cache_section_budget_summary`)
- `docs/deprecated/budgets-planned-hours.md` — описание старой deprecated формулы часов, срок удаления ≈ 2026-06-15
