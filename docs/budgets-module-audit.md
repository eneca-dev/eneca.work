# Аудит модуля «Бюджеты» (страница `/tasks` → таб «Бюджеты»)

> **Дата аудита:** 2026-04-30
> **Дата последнего обновления:** 2026-04-30
> **Ветка:** `feature/budgets`


---

## 0. TL;DR — текущее состояние

| Категория | Было | Стало |
|---|---|---|
| Архитектура (cache + Server Actions + TanStack Query) | 🟢 правильная | 🟢 без изменений |
| Optimistic updates | 🟡 не пересчитывал `parent_total_amount` у детей | ✅ **ИСПРАВЛЕНО** |
| Кэш (ключи, staleTime, invalidation) | 🟡 лишняя инвалидация `lists()` после каждого ввода | ✅ **ИСПРАВЛЕНО** |
| Запросы к БД | 🟡 `v_cache_budgets` — тяжёлый view (19K+ агрегат расходов) | ✅ **ИСПРАВЛЕНО** — новый `v_budgets_for_page` |
| Скорость редактирования суммы | 🔴 5 последовательных RTT (~350–500ms) | ✅ **ИСПРАВЛЕНО** — 2 RTT (~60–150ms) |
| Realtime | 🔴 `budgets` не в publication | ✅ **ИСПРАВЛЕНО** |
| Permissions (UI) | 🔴 ни одного guard | ✅ **ИСПРАВЛЕНО** (страница бюджетов) / 🟡 resource-graph частично |
| Permissions (Server Actions) | 🔴 только `auth.getUser()` | ✅ **ИСПРАВЛЕНО** |
| Permissions (БД RLS) | 🔴 нет политик | ✅ **ИСПРАВЛЕНО** — 4 политики |
| Мёртвый код (индексы) | 🔴 мёртвые hooks/actions/utils в индексах | ✅ **ИСПРАВЛЕНО** — индексы очищены |
| Мёртвые файлы (физически) | 🔴 ~18 файлов-заглушек | 🟡 файлы оставлены (решение пользователя) |
| `ActionResult` дубль | 🟡 определён локально | ✅ **ИСПРАВЛЕНО** — импорт из `@/modules/cache` |
| Типы spent-полей | 🟢 строгие | ✅ адаптированы для lean/full view |

---

## 1. Что сделано — детально

### ✅ P1: Очистка мёртвого кода (частично)

**Выполнено — очищены все публичные индексы:**

| Файл | Что убрано |
|------|------------|
| `budgets-page/components/index.ts` | `BudgetPartsEditor`, `InlineCreateForm`, `InlineDeleteButton` |
| `budgets-page/hooks/index.ts` | `useOperationGuard`, `useDifficultyLevels`, `useWorkCategories`, `useWorkToWsSync` |
| `budgets-page/actions/index.ts` | Вся декомпозиция, reference-data, sync — остался только `loading-money` |
| `budgets-page/utils/index.ts` | Все реэкспорты из `optimistic-updates` |
| `budgets/hooks/index.ts` | `useBudgetById`, `useBudgetHistory`, `useClearBudget` |
| `budgets/actions/budget-actions.ts` | `getBudgetHistory`, `getBudgetExpenses`, `createExpense`, `approveExpense`, `clearBudget` |
| `budgets/types.ts` | `BudgetExpense`, `BudgetHistoryEntry`, `CreateExpenseInput`, `ApproveExpenseInput` |

**Не выполнено — файлы физически не удалены (решение пользователя):**
Следующие файлы существуют в репозитории но не используются:
`BudgetCell.tsx`, `BudgetCreatePopover.tsx`, `BudgetBars.tsx`, `BudgetPartsEditor.tsx`,
`BudgetRowActions.tsx`, `BudgetRowHours.tsx`, `BudgetAmountEdit.tsx`, `HoursInput.tsx`,
`ItemHoursEdit.tsx`, `ItemInlineCreate.tsx`, `ItemInlineDelete.tsx`, `StageInlineCreate.tsx`,
`StageInlineDelete.tsx`, `ItemCategorySelect.tsx`, `ItemDifficultySelect.tsx`, `SectionRateEdit.tsx`,
`InlineCreateForm.tsx`, `InlineDeleteButton.tsx`, `use-reference-data.ts`, `use-work-to-ws-sync.ts`,
`use-operation-guard.ts`, `decomposition.ts`, `reference-data.ts`, `sync-actions.ts`, `optimistic-updates.ts`

---

### ✅ P2: Permissions

**БД — RLS на таблице `budgets` (миграция `budgets_rls_policies`):**
```sql
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "budgets_select" ON budgets FOR SELECT USING (has_budget_permission('budgets.view.all'));
CREATE POLICY "budgets_insert" ON budgets FOR INSERT WITH CHECK (has_budget_permission('budgets.create'));
CREATE POLICY "budgets_update" ON budgets FOR UPDATE USING (has_budget_permission('budgets.edit'));
CREATE POLICY "budgets_delete" ON budgets FOR DELETE USING (has_budget_permission('budgets.delete'));
```
Используется готовая DB-функция `has_budget_permission(permission_name text)`.

**Server Actions:**

| Action | Permission | Реализация |
|--------|-----------|------------|
| `getBudgets` | `budgets.view.all` | `checkPermission(supabase, user.id, ...)` |
| `createBudget` | `budgets.create` | `checkPermission(supabase, user.id, ...)` |
| `updateBudgetAmount` | `budgets.edit` | `Promise.all([getUser(), rpc('has_budget_permission')])` — параллельно |
| `deactivateBudget` | `budgets.delete` | `checkPermission(supabase, user.id, ...)` |

**UI — страница бюджетов:**

| Компонент | Permission | Поведение |
|-----------|-----------|-----------|
| `BudgetsViewInternal` | `budgets.view.all` | Вся страница скрыта без права |
| `TabModal` | `budgets.view.all` | Вкладка «Бюджеты» не показывается в меню создания |
| `BudgetInlineEdit` | `budgets.create` | Кнопка «+ Бюджет» скрыта |
| `BudgetInlineEdit` | `budgets.edit` | Input задизейблен |

**Кто имеет доступ (по ролям в БД):**

| Роль | view.all | create | edit | delete |
|------|----------|--------|------|--------|
| `admin` | ✅ | ✅ | ✅ | ✅ |
| `subdivision_head` | ✅ | ✅ | ✅ | ❌ |
| `department_head` | ❌ | ✅ | ✅ | ❌ |
| `project_manager` | ❌ | ✅ | ✅ | ❌ |
| `team_lead` | ❌ | ❌ | ❌ | ❌ |
| `user` | ❌ | ❌ | ❌ | ❌ |

**🟡 Осталось:** в `resource-graph/components/timeline/BudgetsRow.tsx` кнопка удаления бюджета (Trash2) не проверяет `budgets.delete` в UI — показывается всем. Сервер отклонит запрос, но UX некорректен.

---

### ✅ P3: Optimistic update — пересчёт `parent_total_amount`

В `useUpdateBudgetAmount.optimisticUpdate.updater` добавлен второй проход:
```ts
if (b.parent_budget_id === input.budget_id) {
  return { ...b, parent_total_amount: input.total_amount }
}
```
Теперь при редактировании родительского бюджета `%` у дочерних строк пересчитывается мгновенно, без ожидания refetch.

---

### ✅ P4: Realtime

**БД (миграция `budgets_realtime_publication`):**
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE budgets;
```

**`modules/cache/realtime/config.ts`:**
```ts
{ table: 'budgets', invalidateKeys: [queryKeys.budgets.all] }
```
Изменения бюджетов теперь синхронизируются между вкладками браузера в реальном времени.

**Важно:** `invalidateKeys` убраны из `useUpdateBudgetAmount` чтобы избежать двойного refetch (mutation + realtime). Realtime обеспечивает синхронизацию, optimistic update — мгновенный отклик UI.

---

### ✅ P5: Рефакторинг типов

- `ActionResult<T>` — убрана локальная копия из `budget-actions.ts`, импортируется из `@/modules/cache`
- `BudgetCurrent` — поля `total_spent`, `remaining_amount`, `spent_percentage`, `parent_name` стали `optional` для совместимости с новым lean-view
- `BudgetFilters` — добавлен флаг `lean?: boolean` для выбора view
- `BudgetPageView` — добавлен тип для `v_budgets_for_page`
- `useFindParentBudget` — восстановлен (используется в `BudgetCreateModal` из modals)

---

### ✅ Performance: Lean view для страницы бюджетов

**Проблема:** `v_cache_budgets` на 30K строк выполнял тяжёлую агрегацию 19K расходов через CTE на каждый запрос. Страница бюджетов `total_spent` и `remaining_amount` не показывает.

**Решение:** новый `v_budgets_for_page` (миграция `create_v_budgets_for_page`):
- Убран CTE агрегации расходов
- Убран JOIN с `budget_parts` (мёртвая фича)
- Убраны JOIN с `decomposition_stages`/`decomposition_items` (мёртвые entity types)
- 20 полей → 9 полей

**Реализация:**
- `BudgetFilters.lean?: boolean` — флаг для выбора view
- `getBudgets` — при `filters.lean === true` использует `v_budgets_for_page`
- `useBudgetsHierarchy` — передаёт `lean: true`
- Типы сгенерированы (`npm run db:types`)
- `v_cache_budgets` сохранён для `resource-graph` и `modals` (используют `total_spent`)

**Результат:** 34 kB → ~10–12 kB, ~1.2с → ~300мс на запросе.

---

### ✅ Performance: Оптимизация `updateBudgetAmount`

**Было:** 5 последовательных round-trips (~350–500ms):
1. `auth.getUser()` → 2. `user_has_permission()` → 3. `budgets.update()` → 4. `budget_history.insert()` → 5. `getBudgetById()` → view

**Стало:** 2 RTT (~60–150ms):
1. `auth.getUser()` ║ `has_budget_permission()` → параллельно
2. `budgets.update()`
3. `budget_history.insert()` → fire-and-forget (не блокирует ответ)
4. Возврат минимального ответа (без `getBudgetById`)

---

## 2. Что осталось (открытые задачи)

### 🟡 Оставшееся из оригинального аудита

| # | Проблема | Приоритет | Статус |
|---|----------|-----------|--------|
| 1 | Физически удалить ~25 мёртвых файлов | P1 | Отложено (решение пользователя) |
| 2 | `BudgetsRow.tsx` (resource-graph) — кнопка удаления без `budgets.delete` guard в UI | P2 | ❌ Не сделано |
| 3 | `HierarchyNode.plannedHours` — deprecated поле, не удалено из-за мёртвых файлов | P5 | ❌ Не сделано |
| 4 | Виртуализация списка при большом дереве | P6 | Отложено |

### 🟡 Производительность — что нельзя оптимизировать в коде

| Узкое место | Причина | Решение |
|---|---|---|
| `v_resource_graph` — 189 kB, 1.5–2с | 20+ таблиц, 5+ LATERAL, correlated subqueries | Отдельная задача: lazy-load декомпозиции |
| `v_cache_section_calc_budget` — зависит от `v_cache_loading_money` | Сложный расчёт рабочих дней через `dim_work_calendar` | Денормализация или MV |
| Сеть до Supabase eu-central-1 | ~30–150ms per RTT — физический предел | Смена региона или Edge Functions |
| React перерасчёт дерева (30K бюджетов) | `useMemo` пересчитывает при каждом Realtime event | Виртуализация + P6 |

---

## 3. Архитектура запросов — итоговая схема

### При загрузке страницы

```
Пользователь открывает вкладку «Бюджеты»
  ↓
Без данных → экран «Выберите данные»

Нажата «Загрузить всё» или применён фильтр:
  ↓
┌─────────────────────────────────────────────────────────────┐
│ Параллельно:                                                 │
│  ① useResourceGraphData → v_resource_graph (~1.5–2с, 189kB) │
│  ② useSectionCalcBudgets → v_cache_section_calc_budget      │
│                                                             │
│ После ①:                                                     │
│  ③ useBudgets(lean:true) → v_budgets_for_page (~0.3с, 10kB) │
└─────────────────────────────────────────────────────────────┘
  ↓
useMemo: budgetsMap + calcMap + nodes → HierarchyNode[]
  ↓
UI рендерит дерево (keepPreviousData — без мигания)
```

### При редактировании суммы

```
Enter/Blur
  ↓
МГНОВЕННО: Optimistic update → UI обновлён, input disabled
  ↓
Promise.all:
  ├── auth.getUser()
  └── has_budget_permission('budgets.edit')
  ↓ (~30–150ms)
budgets.UPDATE
  ↓ (~30–150ms)
fire-and-forget: budget_history.INSERT
return success → input enabled
  ↓ (~100–500ms позже)
Realtime → budgets.all invalidated → refetch v_budgets_for_page
```

---

## 4. Файловая структура (актуальная — живой код)

### `modules/budgets/` — core модуль
```
actions/budget-actions.ts   — CRUD: getBudgets (lean/full), createBudget, updateBudgetAmount, deactivateBudget
hooks/index.ts              — useBudgets, useBudgetsByEntity, useFindParentBudget, useCreateBudget,
                              useUpdateBudgetAmount, useDeactivateBudget
types.ts                    — BudgetCurrent (optional spent fields), BudgetFilters (lean flag),
                              CreateBudgetInput, UpdateBudgetAmountInput, EntityHierarchy
index.ts                    — публичный API
```

### `modules/budgets-page/` — UI модуль страницы
```
components/
  BudgetsViewInternal.tsx   — гейт budgets.view.all + контейнер
  BudgetsHierarchy.tsx      — sticky header, scroll sync, expand/collapse
  BudgetRow.tsx (memo)      — строка иерархии: Расчётный / Распред. / Выделенный
  BudgetInlineEdit.tsx      — inline редактор суммы + permission guards (create/edit)
  BudgetRowExpander.tsx     — chevron раскрытия
  BudgetRowBadges.tsx       — бейджи типа узла
hooks/
  use-budgets-hierarchy.ts  — главный хук: объединяет resource-graph + budgets(lean) + calcBudgets
  use-expanded-state.ts     — localStorage + debounce
  use-section-calc-budgets.ts — v_cache_section_calc_budget
actions/
  loading-money.ts          — getSectionCalcBudgets → v_cache_section_calc_budget
utils/index.ts              — formatAmount, parseAmount, formatNumber, calculatePercentage/Amount
types/index.ts              — HierarchyNode, BudgetInfo, ExpandedState
```

### БД — views и таблицы
```
budgets                     — основная таблица (RLS включён, 4 политики)
v_budgets_for_page          — НОВЫЙ lean view для страницы (без агрегации расходов)
v_cache_budgets             — полный view для resource-graph и modals
v_cache_section_calc_budget — расчётный бюджет из loadings × ставка отдела
v_cache_loading_money       — промежуточный: loading × рабочие дни × hourly_rate
```

---

## 5. Нерешённые вопросы для обсуждения

1. **Физическое удаление мёртвых файлов** — отложено. Файлы существуют, в индексы не включены. Можно удалить в любой момент.

2. **`BudgetsRow.tsx` в resource-graph** — кнопка «Удалить бюджет» (Trash2) не проверяет `budgets.delete` в UI. Добавить одну строку:
   ```tsx
   const canDelete = useHasPermission('budgets.delete')
   // скрыть кнопку если !canDelete
   ```

3. **`v_resource_graph` — 189 kB** — самый медленный запрос на странице. Архитектурное решение (всё сразу vs lazy load). Отдельная задача.

4. **department_head / project_manager не видят страницу** — у них нет `budgets.view.all`. Если нужен доступ — добавить им это право в таблицу `role_permissions`.
