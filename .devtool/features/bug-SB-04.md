---
id: "bug-SB-04"
status: "review"
priority: "medium"
assignee: "Саша Бирило"
epic: "bug"
dueDate: null
created: "2026-06-18T12:00:00.000Z"
modified: "2026-06-18T12:00:00.000Z"
completedAt: null
labels: ["v1.5.0"]
order: "a20"
---
# bug-SB-04 Ускорение загрузки фильтра Задач — лёгкий список проектов

## Проблема

`useTasksFilterOptions` (фильтр на всех вкладках `/tasks`) грузил `getProjectStructure` → `v_project_structure` — вью с грейном **до раздела**: **~4 397 строк × ~1.6 МБ**. А фильтр Задач использует из неё **только список проектов (~132)** — `managers/stages/objects/sections` в опции не идут (в фильтре нет ключей «менеджер/объект/раздел»).

То есть качали ~4.4к денормализованных строк ради 132 проектов. Плюс латентный риск: вью уже 4397 строк, при росте за 5000 (Max rows) фильтр начнёт **молча терять проекты** (запрос без пагинации).

### Отдельно проверено: `getFilterContext` (13с в одном замере) — НЕ та проблема
В Network был замечен `getFilterContext` на 13с. Разобрали по данным (Sentry, 35 250 вызовов за 7д): **медиана 136мс, p95 760мс**; запросы внутри (RPC permissions = 7мс, `view_users` = 1мс) — миллисекунды. 13-32с — **редкий хвост (3 из 35 250)** от сатурации пула соединений / `auth.getUser` под нагрузкой (в трейсе `view_users` и RPC стояли по 30с одновременно, БД отвечала мгновенно). Это **инфраструктура, не код фильтра**, и `getFilterContext` уже дедуплицируется (bug-VT-06). Правок здесь не делали — низкий ROI, лечится пулингом/уменьшением параллельных вызовов.

## Решение / Что сделано

- Новый лёгкий экшен **`getFilterProjects()`** (`modules/resource-graph/actions/index.ts`): читает таблицу `projects` (`project_id, project_name`) + тот же restricted-фильтр, что `getProjectStructure` (getFilterContext + restrictedIds + isAdmin). ~132 строки.
- Ключ кэша `queryKeys.filterStructure.projectsLight()`.
- `useTasksFilterOptions`: локальный `useProjectStructure` заменён на `useFilterProjects` (фильтру нужны только проекты). Опции проектов берутся из него.
- `getProjectStructure` / `v_project_structure` **не тронуты** — остаются для других потребителей; фильтр Задач просто перестал их звать.

**Заодно** (в `getBudgets`): убраны шумные `console.error('[getBudgets] Page/Supabase error', …)` — они печатали в консоль целую HTML-страницу ошибки шлюза (Cloudflare) под нагрузкой. Sentry-трекинг (`captureBudgetError`) оставлен — ошибки не теряются. *(Сам HTML-ответ вместо JSON — следствие той же сатурации под нагрузкой, что и хвост `getFilterContext`.)*

## Результат
- Источник проектов фильтра Задач: **4 397 строк (~1.6 МБ) → ~132 строки**.
- Убран риск тихого обрезания на Max rows.
- Чистая консоль (нет HTML-спама от gateway-ошибок).

## Затронутые файлы
- `modules/resource-graph/actions/index.ts` (новый `getFilterProjects`).
- `modules/cache/keys/query-keys.ts` (`filterStructure.projectsLight`).
- `modules/tasks/hooks/useTasksFilterOptions.ts` (флип на `useFilterProjects`).
- `modules/budgets/actions/budget-actions.ts` (убраны 2 `console.error`).

## На что смотреть ревьюеру
1. В фильтре `/tasks` (`проект:`) список проектов **тот же**, что раньше (набор: все проекты минус restricted; `v_project_structure` через LEFT JOIN даёт все 132, `projects` напрямую — те же 132).
2. В Network для фильтра больше **нет** запроса к `v_project_structure`; вместо него лёгкий к `projects`.
3. `getProjectStructure` по-прежнему работает у других потребителей (resource-graph и т.д.) — экшен не менялся.

## Связанные / возможные доработки
- Хвост `getFilterContext`/`getBudgets` (13-32с, HTML вместо JSON) — **инфраструктура** (пул соединений / `auth.getUser`), не баг фильтра. Отдельная задача, если станет частым: transaction-пулинг (pgBouncer) + меньше параллельных Supabase-вызовов на запрос (или локальная валидация JWT `getClaims` вместо сетевого `auth.getUser`).
- Персист кэшей фильтра в localStorage → мгновенный фильтр после перезагрузки (отдельно).
