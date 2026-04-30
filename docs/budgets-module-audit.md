# Аудит модуля «Бюджеты» (страница `/tasks` → таб «Бюджеты»)

> **Дата:** 2026-04-30
> **Ветка:** `feature/budgets`
> **Аудит:** что должно быть в production-ready модуле и насколько `modules/budgets` + `modules/budgets-page` соответствуют этому.
>
> Реально рендерится `BudgetsViewInternal → BudgetsHierarchy → BudgetRow → BudgetInlineEdit + BudgetRowExpander + BudgetRowBadges`. Всё остальное в `modules/budgets-page/components` — не используется.

---

## 0. TL;DR

| Категория | Оценка |
|-----------|--------|
| Архитектура (cache + Server Actions + TanStack Query) | 🟢 правильная |
| Optimistic updates | 🟡 работают для одного бюджета, но не пересчитывают `parent_planned_amount` у детей |
| Кэш (ключи, staleTime) | 🟡 в целом ОК, есть лишняя инвалидация `lists()` после каждого ввода |
| Запросы к БД (views, пагинация) | 🟢 view-based, параллельная пагинация |
| Realtime | 🔴 `budgets`/`budget_history`/`budget_parts` не подписаны → у других вкладок данные не синхронизируются |
| Permissions | 🔴 проверяется только `auth.getUser()`, ни одного `PermissionGuard`/`useHasPermission` |
| Чистота кода | 🔴 ~17 мёртвых компонентов, ~10 мёртвых хуков/actions, дубликаты, deprecated-поля |
| Размеры файлов | 🟢 кроме `budget-actions.ts` (772) и `use-budgets-hierarchy.ts` (352) — всё в норме |
| Типизация | 🟢 строгая, без `any`, есть Zod-схемы |

**Главное:** архитектура верная — но модуль рос итерациями (parts, expenses, history, sync, decomposition CRUD), все эти ветки умерли, а код остался. Сейчас в продакшен попадает ~25% кода и ~15% серверного API. Перед релизом надо удалить мёртвый код — иначе модуль выглядит больше, чем он есть, и любая правка ходит по минному полю.

---

## 1. Чек-лист «хороший модуль» в этом приложении

Из `CLAUDE.md`, `modules/cache/README.md` и сложившихся паттернов в репозитории:

### 1.1. Структура модуля
- [ ] Чёткое деление: `actions/`, `hooks/`, `components/`, `types/`, `utils/`, `index.ts`
- [ ] `index.ts` — единственный публичный API; внешние модули импортируют только из него
- [ ] Нет циклических зависимостей между модулями
- [ ] Нет «мёртвых» файлов-заглушек (`export {}`, `() => null`)
- [ ] Размер компонента ≤ 200–250 строк, файл actions/hooks ≤ 400 строк

### 1.2. Server Actions
- [ ] Файл начинается с `'use server'`
- [ ] Возвращают `ActionResult<T>` из `@/modules/cache`
- [ ] Auth-check (`supabase.auth.getUser()`) **в каждом** action
- [ ] Permission-check для write-операций (если есть permission в `module.meta.json`)
- [ ] Zod-валидация входа
- [ ] Запросы к view (`v_cache_*`), а не к таблицам с N+1
- [ ] Обработка ошибок: `console.error` + возврат `{ success: false, error }`
- [ ] Никаких `any` в payload и output

### 1.3. Hooks (TanStack Query)
- [ ] Используют фабрики из `@/modules/cache` (`createCacheQuery`, `createCacheMutation`, `createUpdateMutation`…)
- [ ] Query keys только из `queryKeys.*` фабрики (центральный реестр)
- [ ] `staleTime` подобран под характер данных (`static` для справочников, `medium` по умолчанию, `fast` для часто меняющегося)
- [ ] Mutation хуки имеют **optimistic update** для всех write-операций, на которые реагирует UI
- [ ] `invalidateKeys` минимально достаточны (не `*.all` если нужен только `*.lists()`)
- [ ] `enabled` флаги корректно отключают зависимые запросы

### 1.4. Components
- [ ] `'use client'` только там где это нужно (RSC по умолчанию)
- [ ] Все мутации читают `isPending`/`error` из хука и показывают это в UI
- [ ] `PermissionGuard` или `useHasPermission` для UI-элементов write-действий
- [ ] Inline-редактирование: optimistic update + откат + Esc-cancel + Enter-save
- [ ] `React.memo` для строк длинных списков
- [ ] Нет прямых вызовов `supabase` из клиента (только через хуки/actions)

### 1.5. Realtime / Cache invalidation
- [ ] Все таблицы, которые модифицируются модулем, добавлены в `realtimeSubscriptions`
- [ ] Их `invalidateKeys` — это именно ключи модуля, а не «всё подряд» (`.all` где нужно `.lists()`)
- [ ] Таблицы добавлены в `supabase_realtime` publication в БД
- [ ] Нет дублирования: одна таблица — одна запись в config

### 1.6. БД
- [ ] Чтение через view с готовой агрегацией (избегаем N+1 в action)
- [ ] Пагинация ≥ 1000 строк делается параллельно (`Promise.all`)
- [ ] Соответствующие индексы под фильтры в action (`entity_type`, `entity_id`, `is_active`, `project_id`)
- [ ] RLS политики на таблицах (если данные приватные)

### 1.7. Types
- [ ] `types/db.ts` (генерируемый) — источник правды для строк таблиц/view
- [ ] Domain-типы тонкие надстройки (без дублирования полей)
- [ ] Input-типы для Server Actions выводятся через `z.infer<typeof Schema>`

### 1.8. Чистота кода
- [ ] Нет `console.log` в продакшен-коде
- [ ] Нет TODO/FIXME без задачи в `module.meta.json`
- [ ] Нет deprecated-полей без даты удаления
- [ ] Нет дублирующих хуков/actions с другим именем (e.g. `getBudgetById` vs `getBudgetCurrent`)
- [ ] Module README актуален

---

## 2. Прохождение чек-листа по `modules/budgets` + `modules/budgets-page`

### 2.1. Структура

| Пункт | Статус | Комментарий |
|-------|--------|-------------|
| Деление на папки | 🟢 | `actions/`, `hooks/`, `components/`, `types/`, `utils/`, `config/` — всё на месте |
| Публичный API через `index.ts` | 🟡 | Из `budgets/index.ts` экспортируется ВСЁ через `export *`, внешние потребители импортируют избыточно. У `budgets-page` API минимальный — это хорошо. |
| Циклические зависимости | 🟢 | Не обнаружено |
| Мёртвые файлы-заглушки | 🔴 | **3 заглушки `export {}`**: `BudgetCell.tsx`, `BudgetCreatePopover.tsx`, `BudgetBars.tsx`. **2 заглушки `return null`**: `BudgetPartsEditor.tsx`, `BudgetRowActions.tsx`. |
| Размеры файлов | 🟡 | `budgets/actions/budget-actions.ts` — 772 строки (норм для actions, но смешаны read/write/expense/history). `use-budgets-hierarchy.ts` — 352 строки (приемлемо). Остальное < 250 строк ✅ |

### 2.2. Server Actions

| Файл | `'use server'` | Auth | Zod | View vs table | Оценка |
|------|---------------|------|-----|---------------|--------|
| `budgets/actions/budget-actions.ts` | ✅ | ✅ во всех write | ✅ почти везде (нет в `getBudgets`) | view `v_cache_budgets` ✅ | 🟢 |
| `budgets-page/actions/decomposition.ts` | ✅ | ✅ helper `requireAuth()` | ✅ | прямые таблицы (нет view-агрегата) | 🟢 структура / 🟡 не используется в UI |
| `budgets-page/actions/loading-money.ts` | ✅ | ✅ | n/a (read-only) | view ✅ | 🟢 |
| `budgets-page/actions/reference-data.ts` | ✅ | ✅ | n/a | таблицы (норма для справочников) | 🟢 |
| `budgets-page/actions/sync-actions.ts` | ✅ | ✅ | ✅ | n/a (внешний HTTP) | 🟢 структура / 🟡 не используется в UI |

**Замечания:**
- `budget-actions.ts` (772 строки) можно разбить на `read.ts` / `write.ts` / `expenses.ts` / `history.ts` — последние две сейчас не используются вообще, лучше удалить.
- `getBudgets`: нет permission-check — любой залогиненный пользователь читает все бюджеты всех проектов. Если нужно ограничивать — нужен `viewer.allowed_projects` фильтр или RLS.
- `findParentBudget` делает 1 запрос к иерархии + до 2 запросов к `v_cache_budgets`. Для редкой операции допустимо, но в `createBudget` это +3 round-trip.
- В `createBudget` после insert idempotently создаётся `budget_parts(part_type='main', percentage=100)`. Проблема: если этот шаг упал, делается **rollback delete** руками. В Supabase нет транзакций между двумя запросами — рискованно. Решение: один RPC `create_budget_with_main_part` на стороне БД, либо триггер `AFTER INSERT ON budgets`. (Учитывая, что система частей упразднена — лучше просто убрать `budget_parts` из логики создания.)

### 2.3. Hooks / TanStack Query

**Файл `modules/budgets/hooks/index.ts` (165 строк):**

| Хук | Используется? | Замечания |
|-----|---------------|-----------|
| `useBudgets` | ✅ | `staleTime: fast` — оправдано |
| `useBudgetById` | 🔴 не используется | удалить |
| `useBudgetsByEntity` | ✅ через `resource-graph` (re-export `useSectionBudgets`) | оставить |
| `useBudgetHistory` | 🔴 не используется | удалить |
| `useFindParentBudgetQuery` | 🔴 не используется | удалить |
| `useFindParentBudget` | 🔴 не используется | удалить |
| `useCreateBudget` | ✅ | invalidateKeys включают `byEntity()` — избыточно (`lists()` уже захватит) |
| `useUpdateBudgetAmount` | ✅ | optimistic ОК. Замечание ниже. |
| `useDeactivateBudget` | ✅ через `resource-graph/timeline/BudgetsRow.tsx` | invalidateKeys: `budgets.all` — избыточно широко |
| `useClearBudget` | 🔴 не используется | удалить |

**Файл `modules/budgets-page/hooks/`:**

| Хук | Используется? | Замечания |
|-----|---------------|-----------|
| `useBudgetsHierarchy` | ✅ | главный хук страницы. Корректно ждёт projects → budgets с фильтром по project_ids |
| `useExpandedState` | ✅ | localStorage + debounce — хорошо |
| `useSectionCalcBudgets` | ✅ | `staleTime: medium`, `keepPreviousData` ✅ |
| `useDifficultyLevels` | 🔴 не используется (был для `ItemDifficultySelect` — мёртвый) | удалить |
| `useWorkCategories` | 🔴 не используется (был для `ItemCategorySelect`) | удалить |
| `useWorkToWsSync` | 🔴 не используется (sync-кнопка убрана) | удалить |
| `useOperationGuard` | 🔴 не используется | удалить |

**Optimistic update в `useUpdateBudgetAmount` — главная проблема:**

```ts
optimisticUpdate: {
  queryKey: queryKeys.budgets.lists(),
  updater: (oldData, input) =>
    (oldData ?? []).map(b => b.budget_id === input.budget_id
      ? { ...b, total_amount: newTotal, remaining_amount: ..., spent_percentage: ... }
      : b)
}
```

Optimistic меняет только сам бюджет, но `parent_total_amount` у его **детей** остаётся старым → процент `displayPercent = currentAmount / parentAmount` у детей рендерится с устаревшим знаменателем до завершения refetch (1–2 сек).

Комментарий в коде это признаёт:
> *"lists() инвалидируем чтобы parent_planned_amount обновился в дочерних бюджетах. Без этого поле "%" у дочерних строк не появляется пока не обновить страницу."*

**Решения:**
1. В optimistic updater пробежаться по `oldData` и поправить `parent_total_amount` у всех дочерних бюджетов, у которых `parent_budget_id === input.budget_id`.
2. Или вынести расчёт `parent_planned_amount` в `useMemo` иерархии (`use-budgets-hierarchy.ts` уже строит дерево — можно брать у предка вместо денормализованного поля). Это надёжнее и убирает зависимость от server-side denormalization.

**`useBudgets` пагинация:**
- 1000 строк × N страниц параллельно через `Promise.all` — отличная оптимизация.
- Но возвращается **полный список без виртуализации**. Если в БД >5000 активных бюджетов, страница начнёт лагать на рендере. Сейчас это не проблема (~150 проектов), но стоит учесть.

### 2.4. Components

**Что реально рендерится:**

| Компонент | LOC | Статус |
|-----------|-----|--------|
| `BudgetsViewInternal` | 101 | 🟢 |
| `BudgetsHierarchy` | 176 | 🟢 |
| `BudgetRow` (memo) | 245 | 🟢 |
| `BudgetInlineEdit` | 155 | 🟢 |
| `BudgetRowExpander` | 48 | 🟢 |
| `BudgetRowBadges` | 88 | 🟢 |

**Что лежит в репо, но никогда не рендерится:**

| Компонент | LOC | Причина |
|-----------|-----|---------|
| `BudgetCell.tsx` | 2 | `export {}` |
| `BudgetCreatePopover.tsx` | 2 | `export {}` |
| `BudgetBars.tsx` | 2 | `export {}` |
| `BudgetPartsEditor.tsx` | 9 | `return null` — система частей упразднена |
| `BudgetRowActions.tsx` | 11 | `return null` — кнопки CRUD скрыты |
| `BudgetRowHours.tsx` | 91 | не импортируется в `BudgetRow` |
| `BudgetAmountEdit.tsx` | **314** | дубль `BudgetInlineEdit`, не импортируется |
| `HoursInput.tsx` | 141 | используется только в мёртвом `BudgetRowHours` |
| `ItemHoursEdit.tsx` | 99 | используется только в мёртвом `BudgetRowHours` |
| `ItemInlineCreate.tsx` | 121 | не импортируется |
| `ItemInlineDelete.tsx` | 90 | не импортируется |
| `StageInlineCreate.tsx` | 120 | не импортируется |
| `StageInlineDelete.tsx` | 89 | не импортируется |
| `ItemCategorySelect.tsx` | 170 | не импортируется |
| `ItemDifficultySelect.tsx` | 176 | не импортируется |
| `SectionRateEdit.tsx` | 175 | не импортируется |
| `InlineCreateForm.tsx` | 177 | используется только мёртвыми Stage/Item Inline |
| `InlineDeleteButton.tsx` | 110 | используется только мёртвыми Stage/Item Inline |

**Итого мёртвый UI-код: ~1900 строк / 18 файлов.**

**Замечания по живым компонентам:**
- `BudgetInlineEdit`: дублирует поведение `BudgetAmountEdit` (314 строк). Один из них — лишний.
- `BudgetRow.tsx`: рекурсивный рендер дерева без виртуализации. На 100+ проектах с раскрытым деревом будет лаг — рассмотреть `react-window` или виртуализацию по глубине.
- `BudgetsHierarchy.tsx`: `findNodePath` рекурсивный — на больших деревьях O(N) на каждый рендер при `highlightSectionId`. Сейчас вызывается из `useEffect` с deps — OK, но `useCallback` не помогает (`nodes` меняется → callback пересоздаётся). Можно мемоизировать индекс `Map<id, parentIds>`.

### 2.5. Permissions

🔴 **Проверки разрешений отсутствуют в UI.**

В `module.meta.json` объявлены: `budgets.view`, `budgets.create`, `budgets.edit`, `budgets.delete`. В коде ни одного `<PermissionGuard>` или `useHasPermission()`.

Сейчас любой залогиненный пользователь может:
- Видеть все бюджеты всех проектов
- Создать бюджет
- Изменить сумму чужого бюджета

В Server Actions проверка только `getUser() != null`. Это норма для прототипа, не норма для продакшена.

**Что нужно:**
- В `BudgetInlineEdit`: обернуть инпут в `<PermissionGuard permission="budgets.edit">`, кнопку «Создать» в `permission="budgets.create"`.
- В `budget-actions.ts`: добавить проверку `await checkPermission(supabase, user.id, 'budgets.edit')` (или RLS на уровне БД).
- В `useBudgets`: фильтрация по `viewer.allowed_projects` через RLS, иначе утечка списка проектов.

### 2.6. Realtime / Cache invalidation

🔴 **`budgets`, `budget_history`, `budget_parts`, `budget_expenses` НЕ подписаны** в `modules/cache/realtime/config.ts`.

Комментарий в коде:
> *"budgets, budget_versions, budget_parts — не добавлены в supabase_realtime publication и слабо используются на фронте. Убраны чтобы не вызывать CHANNEL_ERROR."*

**Последствия:**
- Если два пользователя одновременно открыли страницу — изменения одного **не видны** другому до ручного refetch.
- Если бюджет изменён через `resource-graph` (через `useDeactivateBudget`) — список на странице бюджетов **не обновится** (хотя useResourceGraphData инвалидируется через таблицу `loadings`).

**Что нужно:**
1. SQL: `ALTER PUBLICATION supabase_realtime ADD TABLE budgets, budget_history, budget_expenses;`
2. В `realtimeSubscriptions` добавить:
   ```ts
   { table: 'budgets', invalidateKeys: [queryKeys.budgets.all] }
   { table: 'budget_history', invalidateKeys: [queryKeys.budgets.history(/* ... */)] }
   ```
3. Если `CHANNEL_ERROR` — это отдельная проблема (вероятно RLS блокирует replication identity); фиксится в БД, а не отключением подписки.

**Связанные косвенные подписки (работают, но избыточно широкие):**
- `loadings` → `queryKeys.budgets.calc()` ✅ корректно
- `department_budget_settings` → `queryKeys.budgets.calc()` + `queryKeys.budgets.departmentSettings()` ✅

### 2.7. БД

| Пункт | Оценка |
|-------|--------|
| View `v_cache_budgets` для чтения | 🟢 |
| View `v_cache_section_calc_budget` для расчёта по loadings | 🟢 |
| Параллельная пагинация в `getBudgets` | 🟢 |
| Индексы (entity_type, entity_id, is_active) | ❓ нужно проверить через `mcp__supabase__list_tables` |
| RLS | ❓ зависит от настройки в БД, в коде не видно фильтров |

### 2.8. Types

| Пункт | Оценка |
|-------|--------|
| `types/db.ts` используется (`Database['public']['Tables']['budgets']['Row']`) | 🟢 |
| Domain-типы тонкие | 🟢 |
| Zod-схемы → input-типы через `z.infer` | 🟢 (в `decomposition.ts`, `sync-actions.ts`); 🟡 в `budget-actions.ts` типы заданы вручную, не через `z.infer` (риск рассинхрона) |
| Дубли | 🟡 `BudgetInfo` (budgets-page) почти повторяет `BudgetCurrent` (budgets) — выделить общий тип |
| Deprecated-поля | 🟡 `HierarchyNode.plannedHours` помечено `@deprecated since 2026-04-28` — пора удалить |
| `ActionResult` определён локально в `budget-actions.ts` | 🟡 импортировать из `@/modules/cache` (как в остальных файлах) |

### 2.9. Чистота кода

- 🔴 **Дублирующие компоненты:** `BudgetInlineEdit` (live) vs `BudgetAmountEdit` (dead) — оба про inline-редактирование суммы.
- 🔴 **Mock/dead utilities:** `optimistic-updates.ts` (175 строк) — `saveOptimisticSnapshot`, `rollbackOptimisticUpdate`, `updateHierarchyNode`, `removeHierarchyNode`, `addChildToParent`, `createOptimisticBudget`, `createOptimisticStage`, `createOptimisticItem`, `invalidateHierarchyCache` — **ни одна функция не вызывается** (была инфраструктура для CRUD декомпозиции, который умер).
- 🔴 Неиспользуемый `useOperationGuard` (63 строки + globalOperationCounter в global scope — потенциальная утечка между страницами).
- 🟡 Console.error разбросаны по всем actions — для production нужен Sentry-обёрткой (`Sentry.captureException`).
- 🟡 В `index.ts` модуля `budgets`: `export *` — безопаснее именованные реэкспорты.
- 🟡 `module.meta.json` помечает многие компоненты как существующие (см. строки 383–392), но они мертвы — сорсы и meta рассинхронизированы.

---

## 3. План доведения до production

### Приоритет 1: Удалить мёртвый код (быстрая победа, ~1 час)

**Components (`modules/budgets-page/components/`):**
```
BudgetCell.tsx
BudgetCreatePopover.tsx
BudgetBars.tsx
BudgetPartsEditor.tsx
BudgetRowActions.tsx
BudgetRowHours.tsx
BudgetAmountEdit.tsx
HoursInput.tsx
ItemHoursEdit.tsx
ItemInlineCreate.tsx
ItemInlineDelete.tsx
StageInlineCreate.tsx
StageInlineDelete.tsx
ItemCategorySelect.tsx
ItemDifficultySelect.tsx
SectionRateEdit.tsx
InlineCreateForm.tsx
InlineDeleteButton.tsx
```

**Hooks (`modules/budgets-page/hooks/`):**
```
use-reference-data.ts
use-work-to-ws-sync.ts
use-operation-guard.ts
```

**Actions (`modules/budgets-page/actions/`):**
```
decomposition.ts        (478 строк — CRUD декомпозиции, фронт удалён)
reference-data.ts
sync-actions.ts
```

**Utils (`modules/budgets-page/utils/`):**
```
optimistic-updates.ts   (175 строк — ни одна функция не используется)
```

**В `modules/budgets/hooks/index.ts` — удалить:**
```
useBudgetById, useBudgetHistory, useFindParentBudgetQuery, useFindParentBudget, useClearBudget
```

**В `modules/budgets/actions/budget-actions.ts` — удалить:**
```
getBudgetExpenses, createExpense, approveExpense, getBudgetHistory,
getEntityHierarchy (если не нужен в createBudget), findParentBudget (если не нужен), clearBudget
```

После удаления: `BudgetEntityType` enum в БД может схлопнуться до `'project' | 'object' | 'section'` (stage уже исключён), `change_type` в `budget_history` не нужен если таблица не используется. Но это **миграция БД** — не делать без обсуждения.

**Обновить `module.meta.json`:** убрать упоминания удалённых файлов.

**Ожидаемый эффект:** −18 файлов, −2000 LOC, перестают сбивать с толку при поиске.

### Приоритет 2: Permissions (день работы)

1. В `BudgetInlineEdit`:
   ```tsx
   const canEdit = useHasPermission('budgets.edit')
   const canCreate = useHasPermission('budgets.create')
   // disable input если !canEdit, скрыть кнопку если !canCreate
   ```
2. В `budget-actions.ts:updateBudgetAmount` и `:createBudget`:
   ```ts
   const hasPermission = await checkUserPermission(user.id, 'budgets.edit')
   if (!hasPermission) return { success: false, error: 'Нет прав' }
   ```
3. RLS на `budgets`: фильтр по `project_id IN (allowed_projects(user_id))`.

### Приоритет 3: Optimistic update parent_planned_amount (1–2 часа)

В `useUpdateBudgetAmount.optimisticUpdate.updater` дописать:
```ts
return (oldData ?? []).map(b => {
  if (b.budget_id === input.budget_id) return { ...b, total_amount: newTotal, ... }
  if (b.parent_budget_id === input.budget_id) return { ...b, parent_total_amount: newTotal }
  return b
})
```
И **убрать** `invalidateKeys: [queryKeys.budgets.lists()]` — после оптимистичного апдейта она не нужна, только дёргает сервер.

### Приоритет 4: Realtime (1–2 часа)

1. SQL-миграция: `ALTER PUBLICATION supabase_realtime ADD TABLE budgets, budget_history;`
2. Добавить в `modules/cache/realtime/config.ts`:
   ```ts
   { table: 'budgets', invalidateKeys: [queryKeys.budgets.all] }
   ```
3. Если CHANNEL_ERROR — проверить `REPLICA IDENTITY` и RLS на таблицах.

### Приоритет 5: Унифицировать типы и API (полдня)

- `BudgetInfo` (budgets-page) → расширить из `BudgetCurrent` (budgets) или удалить, использовать `BudgetCurrent` напрямую.
- В `budget-actions.ts`: типы инпутов вывести через `z.infer<typeof Schema>` (как в `decomposition.ts`).
- `ActionResult` — импорт из `@/modules/cache`, не дублировать локально.
- Удалить `HierarchyNode.plannedHours` (deprecated).
- Заменить `export *` в `modules/budgets/index.ts` на именованные реэкспорты — видно публичный API.

### Приоритет 6: Производительность при больших деревьях (по необходимости)

- Виртуализация `BudgetsHierarchy` (`@tanstack/react-virtual` или `react-window`).
- Мемоизация индекса `nodeId → parentIds` для `findNodePath`.

---

## 4. Что уже хорошо и не трогать

- Архитектура `cache + Server Actions + TanStack Query` — собрана как рекомендует README.
- Параллельная пагинация в `getBudgets` — отличный приём, оставить.
- View-based чтение (`v_cache_budgets`, `v_cache_section_calc_budget`) — правильно, агрегация на стороне БД.
- `useExpandedState` с localStorage и debounce — аккуратно сделан.
- `keepPreviousData` в `useBudgets` и `useSectionCalcBudgets` — устраняет «прыжки» при фильтрации.
- `BudgetRow` обёрнут в `React.memo` — корректно для списка.
- Auto-expand + scroll к `highlightSectionId` через `useEffect` — UX-фича, работает.
- `useBudgetsHierarchy` корректно ждёт `projects → budgets` (waterfall), когда есть фильтры — экономит трафик.

---

## 5. Сводная таблица претензий

| # | Проблема | Файл/место | Приоритет |
|---|----------|------------|-----------|
| 1 | 18 мёртвых компонентов (~1900 LOC) | `modules/budgets-page/components/` | P1 |
| 2 | 3 мёртвых хука | `modules/budgets-page/hooks/` | P1 |
| 3 | 3 мёртвых actions-файла (~640 LOC) | `modules/budgets-page/actions/` | P1 |
| 4 | `optimistic-updates.ts` — 175 LOC, ни одна функция не зовётся | `modules/budgets-page/utils/` | P1 |
| 5 | 5 неиспользуемых хуков в `budgets/hooks/index.ts` | `modules/budgets/hooks/` | P1 |
| 6 | Permissions в UI и Server Actions не проверяются | везде | P2 |
| 7 | Optimistic update не пересчитывает `parent_total_amount` у детей | `modules/budgets/hooks/index.ts:122-148` | P3 |
| 8 | `budgets`, `budget_history` не подписаны на realtime | `modules/cache/realtime/config.ts` | P4 |
| 9 | Дубль компонентов: `BudgetInlineEdit` vs `BudgetAmountEdit` | `modules/budgets-page/components/` | P1 (входит в P1) |
| 10 | `BudgetInfo` дублирует `BudgetCurrent` | `modules/budgets-page/types/index.ts` | P5 |
| 11 | `ActionResult` дублирован в `budget-actions.ts` | `modules/budgets/actions/budget-actions.ts:22-25` | P5 |
| 12 | Deprecated-поле `plannedHours` в `HierarchyNode` | `modules/budgets-page/types/index.ts:50` | P5 |
| 13 | `export *` в публичном API модуля | `modules/budgets/index.ts` | P5 |
| 14 | Нет виртуализации списка | `modules/budgets-page/components/BudgetsHierarchy.tsx` | P6 |
| 15 | `console.error` без Sentry-интеграции | везде в actions | P5 |
| 16 | `module.meta.json` ссылается на мёртвые файлы | `modules/budgets-page/module.meta.json` | P1 (входит в P1) |
| 17 | `findParentBudget` делает 3 round-trip в `createBudget` | `modules/budgets/actions/budget-actions.ts:392-397` | P5 |
| 18 | Нет permission-фильтра по проектам в `getBudgets` (data leak) | `modules/budgets/actions/budget-actions.ts:74-132` | P2 (часть Permissions) |

---

## 6. Грубая оценка трудозатрат до релиза

| Этап | Время |
|------|-------|
| P1 — удалить мёртвый код + обновить meta.json | 1–2 ч |
| P2 — Permissions (UI + Server + RLS) | 1 день |
| P3 — fix optimistic update | 1–2 ч |
| P4 — realtime подписки | 1–2 ч |
| P5 — рефакторинг типов и API | 0.5 дня |
| **Итого до production-ready** | **2–3 дня** |

P6 (виртуализация) — отдельная задача, делать когда станет реально лагать.
