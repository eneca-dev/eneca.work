# Бюджеты — план подготовки к релизу

> Создан: 2026-04-29  
> Обновлён: 2026-04-29  
> Статус: блоки 1-5 выполнены, следующий — блок 6 (оптимизация кода)  

---

## Итоговые решения

| Что | Решение |
|-----|---------|
| Части бюджета (premium, custom) | Убрать из UI и удалить тестовые данные из БД |
| Кнопки создания/удаления структур | Убрать из UI (страница только для редактирования бюджетов) |
| Синхронизация с Worksection | Убрать из UI |
| Колонки «План,ч», «С К,ч», «% род.», «BYN/ч» | Скрыть (код оставить, UI не показывать) |
| Вкладка Бюджеты не открывается | Исправить (BUG) |
| Триггер сбрасывает бюджет в 0 | Исправить (BUG) |

---

## Блок 1 — Баги (делать первыми, страница не работает)

### BUG-1 — Вкладка Бюджеты не рендерится

**Проблема:** `BudgetsViewInternal` удалён из `TasksView.tsx`, вкладка показывает пустой экран.

**Файл 1:** `modules/tasks/components/TasksView.tsx`
```
+ import { BudgetsViewInternal } from '@/modules/budgets-page'

+ {tabs.length > 0 && viewMode === 'budgets' && (
+   <BudgetsViewInternal queryParams={queryParams} />
+ )}
```

**Файл 2:** `modules/tasks/stores/tabs-store.ts`
```
+ В SYSTEM_TABS добавить:
  { id: 'budgets', name: 'Бюджеты', viewMode: 'budgets',
    filterString: '', isSystem: true, order: 5,
    createdAt: '2024-01-01T00:00:00.000Z' }

- version: 2  →  version: 3
- В migrate: убрать 'budgets' из hiddenSystemIds
```

---

### BUG-2 — Триггер сбрасывает total_amount бюджета в 0

**Проблема:** при добавлении части с `percentage` триггер пересчитывает `total_amount = SUM(fixed_amount)` = 0.

**Fix в БД:**
```sql
DROP TRIGGER IF EXISTS trg_recalculate_budget_total ON budget_parts;
DROP FUNCTION IF EXISTS recalculate_budget_total();
DROP TRIGGER IF EXISTS trg_validate_budget_parts_percentage ON budget_parts;
DROP FUNCTION IF EXISTS validate_budget_parts_percentage();
```

Оба триггера становятся ненужными после удаления premium/custom частей (следующий блок).

---

## Блок 2 — Удалить части бюджета (premium/custom)

### DB: удалить тестовые данные

```sql
-- Всего 10 записей, расходов нет ни по одной
DELETE FROM budget_parts WHERE part_type IN ('premium', 'custom');
```

### Код: удалить компоненты и actions

**Удалить файлы полностью:**
```
modules/budgets-page/components/BudgetPartsEditor.tsx
modules/budgets-page/components/SectionRateEdit.tsx       (тоже не нужен после скрытия BYN/ч)
```

**`modules/budgets-page/components/index.ts`** — убрать экспорты:
```
- export { BudgetPartsEditor } from './BudgetPartsEditor'
- export { SectionRateEdit } from './SectionRateEdit'
```

**`modules/budgets/actions/budget-actions.ts`** — удалить функции:
```
- addBudgetPart()
- updateBudgetPart()
- deleteBudgetPart()
```

**`modules/budgets/hooks/index.ts`** — удалить хуки:
```
- useAddBudgetPart
- useUpdateBudgetPart
- useDeleteBudgetPart
- useBudgetFull          (используется только в BudgetPartsEditor)
- useBudgetHistory       (не используется нигде в UI)
```

**`modules/budgets-page/components/BudgetInlineEdit.tsx`** — убрать:
```
- import { BudgetPartsEditor } from './BudgetPartsEditor'
- import { PieChart } from 'lucide-react'
- Весь блок <BudgetPartsEditor ...> с кнопкой PieChart (строки ~280-298)
```

**`modules/budgets-page/components/BudgetAmountEdit.tsx`** — убрать:
```
- import { BudgetPartsEditor } from './BudgetPartsEditor'
- import { PieChart } from 'lucide-react'
- Весь блок <BudgetPartsEditor ...> с кнопкой PieChart (строки ~303-320)
```

**`modules/budgets-page/types/index.ts`** — убрать из `BudgetInfo`:
```
- main_part_id: string | null
- main_amount: number | null
- main_spent: number
- premium_part_id: string | null
- premium_amount: number | null
- premium_spent: number
- type_id, type_name, type_color   (deprecated поля)
```

**`modules/budgets-page/hooks/use-budgets-hierarchy.ts`** — убрать из `toBudgetInfo()`:
```
- main_part_id, main_amount, main_spent
- premium_part_id, premium_amount, premium_spent
- type_id, type_name, type_color
```

**`modules/budgets-page/utils/optimistic-updates.ts`** — убрать из `createOptimisticBudget()`:
```
- main_part_id: null
- main_amount: 0
- main_spent: 0
- premium_part_id: null
- premium_amount: null
- premium_spent: 0
- type_id, type_name, type_color
```

---

## ✅ Исправлено — Bad Request при загрузке страницы

**Симптом:** «Ошибка загрузки данных / Bad Request» при открытии вкладки Бюджеты.

**Причина:** `useSectionCalcBudgets` передаёт все 3961 section_id в `.in('section_id', sectionIds)`.
PostgREST транслирует это в GET-параметр URL длиной ~140KB — сервер отклоняет с 400.

**Fix:** `modules/budgets-page/actions/loading-money.ts` — убрать `.in()`, загружать весь view целиком.
View содержит максимум 1162 строки (только разделы с загрузками), это быстро.
Фильтрация происходит на клиенте в `use-budgets-hierarchy.ts` через `calcMap`.

**Затрагивает файлы:**
- `modules/budgets-page/actions/loading-money.ts` — убрать параметр `sectionIds` и `.in()`
- `modules/budgets-page/hooks/use-section-calc-budgets.ts` — убрать `sectionIds` из параметров
- `modules/budgets-page/hooks/use-budgets-hierarchy.ts` — не передавать `sectionIds` в хук

---

## Блок 3 — Скрыть кнопки создания/удаления структур

### `modules/budgets-page/components/BudgetRowActions.tsx`

Убрать **все** блоки кроме нуля — файл можно упростить до пустого компонента или удалить:

```
Убрать блок isProject:  кнопка синхронизации WS, кнопка редактировать проект, кнопка + объект
Убрать блок isObject:   кнопка + раздел, кнопка удалить объект
Убрать блок isSection:  кнопка + этап, кнопка удалить раздел
Убрать блок isDecompStage: кнопка + задача, StageInlineDelete
Убрать блок isItem:     ItemCategorySelect, ItemInlineDelete
```

После этого `BudgetRowActions` возвращает `null` или `<></>` — можно удалить файл и убрать его из `BudgetRow`.

### `modules/budgets-page/components/BudgetRow.tsx`

Убрать **7 `useState`** для модальных окон:
```
- const [deleteModalOpen, setDeleteModalOpen] = useState(false)
- const [createModalOpen, setCreateModalOpen] = useState(false)
- const [sectionCreateModalOpen, setSectionCreateModalOpen] = useState(false)
- const [sectionDeleteModalOpen, setSectionDeleteModalOpen] = useState(false)
- const [stageCreateOpen, setStageCreateOpen] = useState(false)
- const [itemCreateOpen, setItemCreateOpen] = useState(false)
- const [projectEditOpen, setProjectEditOpen] = useState(false)
```

Убрать **импорты**:
```
- import { DeleteObjectModal, ObjectCreateModal, SectionCreateModal, DeleteSectionModal, ProjectQuickEditModal } from '@/modules/modals'
- import { StageInlineCreate } from './StageInlineCreate'
- import { ItemInlineCreate } from './ItemInlineCreate'
- import { BudgetRowActions } from './BudgetRowActions'
- import { SectionRateEdit } from './SectionRateEdit'
- import { BudgetRowHours } from './BudgetRowHours'   (если убираем трудозатраты)
- import { ItemDifficultySelect } from './ItemDifficultySelect'
```

Убрать **пропсы**:
```
- onExpandAll
- hourlyRate
- parentAdjustedHours
- parentAllocatedBudget
- parentDistributedBudget
- onAutoExpand
- currentSectionId
- onProjectSync
- syncStatus
- syncingProjectId
```

Убрать **вычисления** (deprecated):
```
- const plannedHours = ...
- const adjustedHours = plannedHours * HOURS_ADJUSTMENT_FACTOR
- const effectiveRate = ...
- const percentOfParentHours = ...
- import { MOCK_HOURLY_RATE, HOURS_ADJUSTMENT_FACTOR } from '../config/constants'
```

Убрать **JSX блоки**:
```
- Колонка КАТЕГОРИЯ (isItem && <ItemDifficultySelect>)
- Весь компонент <BudgetRowHours> с 3 колонками
- Колонка СТАВКА (<SectionRateEdit>)
- <BudgetRowActions>
- Все модальные окна внизу JSX
- Блок StageInlineCreate
- Блок ItemInlineCreate
```

Убрать **handleCreateSuccess** (теперь некуда вызывать):
```
- const handleCreateSuccess = () => { onAutoExpand?.(node.id); onRefresh?.() }
```

### `modules/budgets-page/components/BudgetsHierarchy.tsx`

Убрать:
```
- import { useWorkToWsSync } from '../hooks/use-work-to-ws-sync'
- const { sync, status: syncStatus, syncingProjectId } = useWorkToWsSync()
- Пропсы onProjectSync, syncStatus, syncingProjectId при вызове BudgetRow
- console.log из useEffect (4 вызова)
```

Убрать из **заголовков таблицы** (`BudgetsHierarchy.tsx` ~строки 140-245):
```
Группу ТРУДОЗАТРАТЫ:   <div> с "Трудозатраты" + subheaders "План, ч" / "С К, ч" / "% род."
Группу СТАВКА:         <div> с "Ставка" + subheader "BYN/ч"
```

---

## Блок 4 — Удалить console.log

Удалить все `console.log` (не `console.error`) из:

| Файл | Кол-во |
|------|--------|
| `actions/decomposition.ts` | 10 log, оставить только error |
| `actions/reference-data.ts` | 5 log, оставить только error |
| `components/BudgetsHierarchy.tsx` | 4 log — все удалить |
| `components/BudgetInlineEdit.tsx` | DEBUG режим — убрать или выключить |
| `components/BudgetAmountEdit.tsx` | DEBUG режим — убрать или выключить |

---

## Блок 5 — Оптимизация БД

### OPT-1: Фильтр entity_type в v_cache_budgets (главный выигрыш)

Добавить в `getBudgets()` фильтр по умолчанию для страницы бюджетов:

**Файл:** `modules/budgets/actions/budget-actions.ts`
```typescript
// В useBudgetsHierarchy передавать:
const { data: budgets } = useBudgets({
  is_active: true,
  entity_types: ['project', 'object', 'section'],  // ← добавить
})
```

**Файл:** `modules/budgets/actions/budget-actions.ts` — расширить `getBudgets`:
```typescript
if (filters?.entity_types?.length) {
  query = query.in('entity_type', filters.entity_types)
}
```

**Результат:** 29 580 → 4 614 строк (–84% трафика и JS-обработки)

---

### OPT-2: Убрать while-loop пагинацию

**Файл:** `modules/budgets/actions/budget-actions.ts:94-145`

```typescript
// Было: while-цикл с 30 последовательными запросами
// Стало: один запрос без пагинации (4.6K записей влезают в один ответ)
const { data, error } = await supabase
  .from('v_cache_budgets')
  .select('*')
  .in('entity_type', ['project', 'object', 'section'])  // после OPT-1
  .eq('is_active', true)
  .order('created_at', { ascending: false })
  // limit по умолчанию 1000 в PostgREST → нужно либо убрать, либо поставить 5000
```

> PostgREST по умолчанию возвращает 1000 строк. Нужно добавить `.limit(5000)` или настроить `max_rows` в Supabase.

---

### OPT-3: Оптимизировать v_cache_budgets (CTE вместо 3× scan)

**Применить миграцию в БД:**
```sql
CREATE OR REPLACE VIEW v_cache_budgets AS
WITH expenses_agg AS (
  -- Один проход по budget_expenses вместо трёх
  SELECT
    budget_id,
    SUM(amount) AS total_spent
  FROM budget_expenses
  WHERE status = 'approved'
  GROUP BY budget_id
)
SELECT
  b.budget_id, b.entity_type, b.entity_id, b.name,
  b.total_amount, b.is_active, b.parent_budget_id,
  b.created_at, b.updated_at,
  -- main part (упрощённо — теперь только main)
  main_part.part_id AS main_part_id,
  main_part.percentage AS main_percentage,
  -- totals
  COALESCE(ea.total_spent, 0) AS total_spent,
  b.total_amount - COALESCE(ea.total_spent, 0) AS remaining_amount,
  CASE WHEN b.total_amount > 0
       THEN ROUND((COALESCE(ea.total_spent, 0) / b.total_amount) * 100, 2)
       ELSE 0
  END AS spent_percentage,
  pb.name AS parent_name,
  pb.total_amount AS parent_total_amount
FROM budgets b
LEFT JOIN budgets pb ON pb.budget_id = b.parent_budget_id
LEFT JOIN budget_parts main_part
  ON main_part.budget_id = b.budget_id AND main_part.part_type = 'main'
LEFT JOIN expenses_agg ea ON ea.budget_id = b.budget_id
WHERE b.is_active = true;
```

> Примечание: `premium_*` колонки убраны — они больше не нужны после удаления частей.

---

### OPT-4: Оптимизировать v_cache_loading_money (JOIN вместо subquery)

```sql
CREATE OR REPLACE VIEW v_cache_loading_money AS
WITH work_days_per_loading AS (
  -- Один GROUP BY вместо N коррелированных подзапросов
  SELECT
    l.loading_id,
    COUNT(wc.calendar_date)::integer AS work_days
  FROM loadings l
  JOIN dim_work_calendar wc
    ON wc.calendar_date BETWEEN l.loading_start AND l.loading_finish
   AND wc.is_working_day = true
  GROUP BY l.loading_id
)
SELECT
  l.loading_id,
  l.loading_section,
  l.loading_responsible,
  l.loading_rate,
  l.loading_start,
  l.loading_finish,
  p.department_id,
  dbs.hourly_rate,
  dbs.work_hours_per_day,
  COALESCE(wd.work_days, 0) AS work_days,
  CASE
    WHEN l.loading_responsible IS NULL THEN 0
    WHEN p.department_id IS NULL THEN 0
    WHEN dbs.hourly_rate IS NULL THEN 0
    ELSE COALESCE(l.loading_rate, 0) * dbs.work_hours_per_day * COALESCE(wd.work_days, 0)
  END AS hours,
  CASE
    WHEN l.loading_responsible IS NULL THEN 0
    WHEN p.department_id IS NULL THEN 0
    WHEN dbs.hourly_rate IS NULL THEN 0
    ELSE COALESCE(l.loading_rate, 0) * dbs.work_hours_per_day * COALESCE(wd.work_days, 0) * dbs.hourly_rate
  END AS money,
  CASE
    WHEN l.loading_responsible IS NULL THEN 'no_responsible'
    WHEN p.department_id IS NULL THEN 'no_department'
    WHEN dbs.hourly_rate IS NULL THEN 'no_rate'
    ELSE NULL
  END AS error_flag
FROM loadings l
LEFT JOIN profiles p ON p.user_id = l.loading_responsible
LEFT JOIN department_budget_settings dbs ON dbs.department_id = p.department_id
LEFT JOIN work_days_per_loading wd ON wd.loading_id = l.loading_id;
```

---

## Блок 6 — Оптимизация кода

### OPT-5: Optimistic update для updateBudgetAmount

**Файл:** `modules/budgets/hooks/index.ts`

```typescript
// Было: createCacheMutation без optimisticUpdate
// Стало:
export const useUpdateBudgetAmount = createCacheMutation<UpdateBudgetAmountInput, BudgetCurrent>({
  mutationFn: updateBudgetAmount,
  optimisticUpdate: {
    queryKey: queryKeys.budgets.lists(),
    updater: (oldData, input) =>
      (oldData ?? []).map(b =>
        b.budget_id === input.budget_id
          ? { ...b,
              total_amount: input.total_amount,
              remaining_amount: input.total_amount - (b.total_spent ?? 0) }
          : b
      ),
  },
  invalidateKeys: (input) => [
    queryKeys.budgets.detail(input.budget_id),
    // lists() не инвалидируем — optimistic update уже обновил
  ],
})
```

---

### OPT-6: Серверная фильтрация по проектам из InlineFilter

**Файл:** `modules/budgets-page/hooks/use-budgets-hierarchy.ts`

```typescript
// Извлечь projectId из filters и передать в useBudgets
const projectId = filters?.projectId

const { data: budgets } = useBudgets({
  is_active: true,
  entity_types: ['project', 'object', 'section'],
  project_id: projectId,   // если задан фильтр — только этот проект
}, { enabled })
```

Расширить `getBudgets` для фильтра `project_id` (через JOIN на sections/objects).

---

## Итоговая таблица задач

| # | Блок | Задача | Файл(ы) | Оценка |
|---|------|--------|---------|--------|
| ✅ **1** | Баги | BUG-1: добавить BudgetsViewInternal в TasksView | `TasksView.tsx`, `tabs-store.ts` | выполнено |
| ✅ **2** | Баги | BUG-2: удалить триггеры recalculate + validate | БД | выполнено |
| ✅ **3** | Части | Удалить 10 premium/custom из БД | БД | выполнено |
| ✅ **4** | Части | Убрать BudgetPartsEditor и кнопку PieChart | `BudgetInlineEdit.tsx`, `BudgetAmountEdit.tsx` | выполнено |
| ✅ **5** | Части | Удалить addBudgetPart/updateBudgetPart/deleteBudgetPart | `budget-actions.ts`, `hooks/index.ts` | выполнено |
| ✅ **6** | Части | Убрать поля main_*/premium_*/type_* из BudgetInfo | `types/index.ts`, `use-budgets-hierarchy.ts`, `optimistic-updates.ts` | выполнено |
| ✅ **7** | Скрыть | Убрать все кнопки из BudgetRowActions → файл → null | `BudgetRowActions.tsx` | выполнено |
| ✅ **8** | Скрыть | Убрать 7 useState + модалки + inline-creates из BudgetRow | `BudgetRow.tsx` | выполнено |
| ✅ **9** | Скрыть | Убрать Трудозатраты + Ставка из BudgetsHierarchy (заголовки) | `BudgetsHierarchy.tsx` | выполнено |
| ✅ **10** | Скрыть | Убрать WS sync из BudgetsHierarchy | `BudgetsHierarchy.tsx` | выполнено |
| ✅ **11** | Скрыть | Убрать колонки Трудозатраты + Ставка из BudgetRow (JSX) | `BudgetRow.tsx` | выполнено |
| ✅ **12** | Логи | Удалить console.log (оставить только error) | `decomposition.ts`, `reference-data.ts`, `BudgetsHierarchy.tsx`, `BudgetInlineEdit.tsx`, `BudgetAmountEdit.tsx` | выполнено |
| ⏭️ **13** | Опт. БД | OPT-1: фильтр entity_type — **пропущен** | — | нельзя: decomp строки нужны |
| ✅ **14** | Опт. код | OPT-2: параллельная пагинация вместо while-loop | `budget-actions.ts` | выполнено |
| ✅ **15** | Опт. БД | OPT-3: переписать v_cache_budgets (CTE) | БД | выполнено |
| ✅ **16** | Опт. БД | OPT-4: переписать v_cache_loading_money (JOIN) | БД | выполнено |
| **F1** | Опт. код | Optimistic update для updateBudgetAmount | `budgets/hooks/index.ts` | ~30 мин |
| **F2** | Опт. код | Убрать лишний getBudgetById в updateBudgetAmount | `budget-actions.ts` | ~20 мин |
| **F3** | Опт. код | Optimistic insert для useCreateBudget | `budgets/hooks/index.ts` | ~40 мин |
| **F4** | Опт. код | Убрать budget_parts запрос из createExpense | `budget-actions.ts` | ~15 мин |
| **F5** | Опт. код | Добавить placeholderData в useBudgets | `budgets/hooks/index.ts` | ~5 мин |
| **F6** | Чистка | Убрать мёртвый onRefresh из BudgetRow | `BudgetRow.tsx` | ~5 мин |
| **OPT-6** | Опт. код | Серверная фильтрация по проектам из InlineFilter | `budget-actions.ts`, `use-budgets-hierarchy.ts` | 1-2 дня |

---

## Дополнительно выполнено (не было в исходном плане)

| Задача | Статус |
|--------|--------|
| ✅ Bad Request fix: useSectionCalcBudgets → убран .in() с 3K+ ID | выполнено |
| ✅ Исправлен баг параллельной пагинации (двойной .select() → count=null) | выполнено |
| ✅ Удалены view: v_budgets_full, v_cache_section_budget_summary | БД |
| ✅ Удалён мёртвый код: getBudgetFull, getSectionBudgetSummary, useBudgetFull, useSectionBudgetSummary | код |
| ✅ Очищены типы: BudgetFull, SectionBudgetSummary, BudgetPart, CreateBudgetPartInput и др. | код |
| ✅ Zod-схемы CreateBudgetPartSchema, UpdateBudgetPartSchema удалены | код |
| ✅ BudgetPartsEditor.tsx очищен до пустого компонента | код |
| ✅ types/db.ts регенерирован через Supabase MCP | код |
| ✅ Бэкап удалённых view: docs/deprecated/budgets-dropped-views-2026-04-29.sql | документация |

---

## Решения принятые по ходу работы

- `budget_parts` таблицу **не удаляем** — `DeleteObjectModal` в модуле `modals` зависит от неё, нужна координированная миграция вместе с `npm run db:types`
- Materialized views **не создаём** — после OPT-3/4 производительность достаточная при текущих ~3.6K загрузок
- `decomposition_items` / `decomposition_stages` строки в дереве — **оставляем**
- `budget_history` — **оставляем**, не показываем в UI
- OPT-1 (фильтр entity_type) — **пропускаем**: нельзя фильтровать decomp-бюджеты пока соответствующие строки отображаются в дереве
