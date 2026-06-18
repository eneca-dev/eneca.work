---
id: "bug-SB-01"
status: "review"
priority: "high"
assignee: "Саша Бирило"
epic: "bug"
dueDate: null
created: "2026-06-17T09:00:00.000Z"
modified: "2026-06-18T08:54:37.345Z"
completedAt: null
labels: ["v1.5.0"]
order: "Zz"
---
# bug-SB-01 Вкладка «Бюджеты» грузится 7–12с и падает с таймаутом `57014`

## Проблема

Вкладка «Бюджеты» грузилась 7–12с и периодически падала с ошибкой в консоли:

```
[getResourceGraphData] Pagination error: { code: '57014', message: 'canceling statement due to statement timeout' }
```

`57014` = PostgreSQL сам отменяет запрос, т.к. он дольше `statement_timeout` роли `authenticated` (8с).

**Разбор причины (не та, что казалась изначально).** Узким местом было НЕ построение дерева на клиенте (сборка дерева в JS \~94мс) и не вычисление сумм. Медленным было **количество и объём данных**:

- Бюджеты читали `v_resource_graph` — тяжёлую view с грейном **по задаче**: **\~19 445 строк × \~67 колонок** (+ тяжёлые JSONB), \~20 nested-loop джойнов и коррелированные подзапросы на строку.
- В БД полный прогон \~1.6–2с (на холодном кэше кратно больше), `count: 'exact'` + параллельная пагинация 4×5000 → конкуренция за work_mem/IO → один прогон выходил за 8с → `57014`, вкладка не грузилась.
- По сети \~22 МБ; сериализация/парс 19k широких строк добавляли ещё несколько секунд.
- **Главное:** на экране изначально показаны только свёрнутые Проект→Объект→Раздел (\~4.3к разделов), а тянулись все \~19k задач — 90% данных скрыты и сразу выкидывались в суммы.

## Решение

> Сначала пробовали материализовать `v_resource_graph` → `mat_resource_graph` с дебаунс-рефрешем (триггеры + pg_cron). **Откатили:** «выделенный» правят inline → MV даёт устаревание тому, что редактируют; крон+триггеры засоряют БД; и главное — MV ускоряла пересчёт view, но строки всё равно качались все (19k), т.е. лечила не ту причину. Подробности отката — `docs/sb-01-mat-view-rollback.md`.

Реализован **Вариант 1 — лёгкая live-вью + ленивая подгрузка** (без MV):

1. **Новая обычная live-вью** `v_budget_hierarchy` (section-grain, \~4 367 строк, \~290мс):

   - структура `projects + objects + sections` (мелкие таблицы, без взрыва до задач);
   - фильтр-колонки 1:1 с `v_resource_graph` (project/status, department/subdivision/responsible через ответственного раздела) + `WHERE project_status = 'active'`;
   - **расчётный** влит из `v_cache_section_calc_budget`;
   - **«Распределено» посчитано в БД** (Σ выделенного этапов раздела);
   - флаг `section_has_stages` (показывать раскрывалку до ленивой загрузки);
   - `GRANT SELECT` роли `authenticated`. Аддитивно: `v_resource_graph` и базовые таблицы не тронуты.

2. `getBudgetHierarchy(filters)` — читает `v_budget_hierarchy`, фильтры/безопасность 1:1 с `getResourceGraphData` (restricted-проекты, `applyMandatoryFilters`, isAdmin), один запрос без пагинации (4.3к &lt; Max rows 5000).

3. **Дерево строится до раздела и сразу показывается.** Числа разделов — из строки вьюхи; объект/проект — лёгкий роллап на клиенте. Дерево собирается ОДИН раз (стабильные узлы) → `React.memo` строк не ломается.

4. **Этапы и задачи — лениво при раскрытии раздела** (`getSectionBudgetItems(section_id)`): читает напрямую базовые `decomposition_stages` + `decomposition_items` по одному разделу (десятки строк). Бюджеты этапов/задач берутся из уже загруженного `getBudgets`. Ленивые дети рендерятся через `SectionLazyChildren` + контекст `budgetsMap` (база дерева остаётся стабильной).

5. **Инвалидация** «Распределено» при правке — через существующую realtime-подписку на `budgets` (`queryKeys.budgets.all` префиксом накрывает `budgets.hierarchy`/`budgets.sectionItems`); мгновенный «Выделенный» — через optimistic update списка бюджетов.

**Сохранены полезные правки** (не зависят от MV): O(n)-сборка дерева `transformRowsToHierarchy` (Map вместо `.find()`), `PAGE_SIZE 5000` в `getBudgets`.

**Результат:** `57014` ушёл (Бюджеты больше не используют `v_resource_graph`); загрузка **7–12с → 3–4с**.

## Затронутые файлы

- БД: `v_budget_hierarchy` (миграция `sb_01_v2_create_v_budget_hierarchy` + добавления колонок).
- `modules/budgets-page/actions/budget-hierarchy.ts` (новый), `actions/index.ts`.
- `modules/budgets-page/hooks/use-budget-hierarchy.ts` (новый), `hooks/use-budgets-hierarchy.ts` (переписан), `hooks/index.ts`.
- `modules/budgets-page/context/budgets-data-context.tsx` (новый).
- `modules/budgets-page/components/BudgetRow.tsx`, `BudgetsViewInternal.tsx`.
- `modules/budgets-page/types/index.ts`, `modules/cache/keys/query-keys.ts`.
- `modules/budgets/actions/budget-actions.ts` (PAGE_SIZE), `modules/resource-graph/utils/index.ts` (O(n)).