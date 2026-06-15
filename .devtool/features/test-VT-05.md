---
id: "test-VT-05"
status: "todo"
priority: "high"
assignee: "Вадим Тихомиров"
epic: "test"
dueDate: null
created: "2026-06-15T13:46:00.000Z"
modified: "2026-06-15T13:46:00.000Z"
completedAt: null
labels: ["v1.5.0"]
order: "a4"
---
# test-VT-05 Тест вкладки «Бюджеты» (/tasks): сетевые запросы и оптимизация

Родительская задача: **bug-VT-02**. Тестируем по правилам из `bug-VT-02` («Человек + Нейросеть»).

## Цель
Вкладка «Бюджеты» в модуле `tasks` работает медленно. Цель — разобрать **каждый сетевой запрос** на этой вкладке, найти лишние/дублирующиеся/тяжёлые запросы, водопады и over-fetch, оценить тяжёлые агрегации (расчётный бюджет из загрузок) и предложить оптимизации. Баги/находки оформляем отдельными тикетами `bug-...`.

## Контекст реализации (для проверяющего ИИ)
- Маршрут: `app/(dashboard)/tasks/page.tsx` → `TasksView` → при `viewMode === 'budgets'` рендерит `BudgetsViewInternal` (модуль `modules/budgets-page`).
- Server Actions в Next.js App Router идут как **POST на текущий маршрут `/tasks` с заголовком `Next-Action`** — различаем их по этому заголовку и по телу ответа.
- **Права/условие загрузки:** требуется `budgets.view.all` (иначе Lock-экран). Данные грузятся только при наличии фильтров ИЛИ нажатой кнопке «Загрузить всё».
- Главный хук `useBudgetsHierarchy(queryParams)` композирует **три запроса** (строит иерархию Project → Object → Section → Stage → Item):
  1. `useResourceGraphData(filters)` → `getResourceGraphData` — иерархия проектов (структура), source `resourceGraph.list(filters)`, `staleTime: Infinity` (Realtime).
  2. `useBudgets({ project_ids, lean: true })` → `getBudgets` из lean-view `v_budgets_for_page` (без spent-сумм, быстрее), `staleTime: 2 мин` (fast). **Зависит** от `project_ids` из шага 1 → водопад при фильтрах.
  3. `useSectionCalcBudgets()` → `getSectionCalcBudgets` из `v_cache_section_calc_budget` (расчёт `loadings × ставка отдела`, грузит **весь** view ~1200 строк, фильтрация на клиенте через Map), `staleTime: 3 мин` (medium).
- Lazy при раскрытии Project-узла (блок «Человеческие ресурсы», `DepartmentBlock`):
  - `useProjectDepartmentBudgets()` → `getProjectDepartmentBudgets` из `v_cache_project_department_budget` (~1000–3000 строк, **весь** view без серверной фильтрации по проекту), `staleTime: 3 мин`.
- `reloadPermissions()` — вызывается в `TasksView` на маунте (useEffect) → возможный источник лишних запросов/рефетча.
- Мутации и их инвалидация (`modules/budgets/hooks`):
  - `updateBudgetAmount` (inline edit суммы) → **optimistic** (меняет `total_amount`/`remaining_amount`/`spent_percentage` у узла и детей), `invalidateKeys: []` — рассчитывает на Realtime.
  - `createBudget` → invalidate `budgets.lists()` + `budgets.byEntity(...)`.
  - `deactivateBudget` → invalidate `budgets.all`.
- Realtime-подписки (см. `modules/cache/realtime/config.ts`, debounce 100ms):
  - `budgets` → invalidate `budgets.all`.
  - `loadings` → invalidate `budgets.calc()`, `budgets.calcByDepartments()`, `resourceGraph.all` (пересчёт расчётного бюджета).
  - `department_budget_settings` → invalidate `budgets.calc()`, `budgets.calcByDepartments()` (пересчёт при смене ставки отдела).
  - `sections`/`objects`/`stages`/`decomposition_*` → invalidate `resourceGraph.all`.

## Среда
- `localhost:3000`, dev-режим, тестировщик авторизуется сам.
- Браузер открывает ИИ через Playwright MCP; тестировщик кликает в этом окне.
- ИИ читает console + network через Playwright, состояние БД — через Supabase MCP (только чтение).

## Сценарии (чек-лист)

### 🔴 Приоритет 1 — базовый сетевой профиль
- [ ] **S1. Холодная загрузка с фильтрами** (отдел + проект). Открыть `/tasks`, переключиться на «Бюджеты», применить фильтр.
  - Зафиксировать: список всех запросов, по каждому — метод, статус, время ответа, размер.
  - Ожидание: `getResourceGraphData` (1) → затем `getBudgets` (зависит от project_ids) + `getSectionCalcBudgets` (параллельно).
  - Искать: глубину водопада (300–600 мс), дубли, лишний рефетч из-за `reloadPermissions`, можно ли распараллелить шаг 2.
- [ ] **S2. Холодная загрузка «Загрузить всё»** (без фильтров).
  - Ожидание: три запроса **параллельно**; `getBudgets` пагинируется (PAGE_SIZE=1000) через `Promise.all`.
  - Искать: суммарный размер payload (`v_budgets_for_page` может быть очень большим), время 1–2 сек, риск таймаута/перегруза памяти.
- [ ] **S3. Размер и время каждого из трёх запросов.**
  - Измерить размер ответа и время; в Supabase/Sentry — длительность `db.query` по `v_budgets_for_page`, `v_cache_section_calc_budget`.
  - Искать: over-fetch (полный `v_cache_section_calc_budget` ~1200 строк при любом фильтре), стоимость материализованных вьюх (`v_cache_loading_money`), стоимость рекурсивной агрегации `transformProject` в JS.

### 🟡 Приоритет 2 — реакция на действия пользователя
- [ ] **S4. Раскрытие Project → блок «Человеческие ресурсы».**
  - Ожидание: 1 lazy-запрос `getProjectDepartmentBudgets`.
  - Искать: **главный кандидат на оптимизацию** — грузится весь `v_cache_project_department_budget` (3000 строк) без серверной фильтрации по `project_id`; при раскрытии нескольких проектов — N × полный view (косвенный N+1).
- [ ] **S5. Изменение фильтра** (отдел/проект).
  - Ожидание: запрос на закоммиченный фильтр, дебаунс, плавный переход (keepPreviousData), нет запроса на каждый символ.
  - Искать: запрос-на-keystroke, дубли, гонки, повторный полный `getSectionCalcBudgets`.
- [ ] **S6. Inline-редактирование суммы бюджета** (`updateBudgetAmount`).
  - Ожидание: 1 мутация + optimistic (узел и дети обновляются мгновенно), затем подтверждение через Realtime (`invalidateKeys: []`).
  - Искать: рассинхрон optimistic ↔ Realtime, мигание значений, корректность `parent_total_amount` у детей, нет ли лишнего полного рефетча.
- [ ] **S7. Раскрытие/сворачивание узлов иерархии.**
  - Ожидание: **ноль** сетевых запросов (expanded state в localStorage / `use-expanded-state`), кроме первого раскрытия Project (S4).
  - Искать: любой лишний запрос при простом expand/collapse.

### 🟢 Приоритет 3 — фон и пересчёты
- [ ] **S8. Realtime: смена ставки отдела** (`department_budget_settings`).
  - Ожидание: инвалидация `budgets.calc()` + `budgets.calcByDepartments()` → пересчёт расчётного бюджета (с debounce 100ms).
  - Искать: шторм рефетчей, повторная полная загрузка тяжёлых вьюх, рассинхрон расчётных и распределённых сумм.
- [ ] **S9. Realtime: изменение `loadings`.**
  - Ожидание: пересчёт `budgets.calc()` / `calcByDepartments()` + `resourceGraph.all`.
  - Искать: каскад рефетчей, дублирование с подписками других вкладок.
- [ ] **S10. Переключение вкладок Бюджеты → Канбан → Бюджеты.**
  - Ожидание: кеш-хит по `resourceGraph` (Infinity) и `budgets`/`calc` в пределах staleTime (2–3 мин).
  - Искать: лишний рефетч при возврате, повторный `reloadPermissions`, повторная загрузка `getProjectDepartmentBudgets`.

## Найденные баги
_(ИИ дозаполняет по ходу; на каждый подтверждённый баг — отдельный тикет `bug-...` со ссылкой сюда)_
- …

## Результаты
_(ИИ заполняет в конце: сводка по запросам, подтверждённые проблемы, список заведённых багов, предложения по оптимизации)_
- …
