---
id: "bug-SB-01"
status: "todo"
priority: "high"
assignee: "Саша Бирило"
epic: "bug"
dueDate: null
created: "2026-06-17T09:00:00.000Z"
modified: "2026-06-17T13:00:00.000Z"
completedAt: null
labels: ["v1.5.0"]
order: "a17"
---
# bug-SB-01 Таймаут `57014` на `v_resource_graph` — материализация view с дебаунс-рефрешем

## Проблема

Вкладка «Бюджеты» (`getResourceGraphData`) периодически падает с ошибкой в консоли:
```
[getResourceGraphData] Pagination error: { code: '57014', message: 'canceling statement due to statement timeout' }
```

`57014` = PostgreSQL сам отменяет запрос, т.к. он дольше `statement_timeout` роли `authenticated` (**8с**).

**Замеры (EXPLAIN ANALYZE):**
- `v_resource_graph` = **19 386 строк**, ширина строки 1562 байта, ~20 nested-loop джойнов + коррелированные подзапросы на каждую строку (`section_totals`, `section_readiness_snapshots`, бюджеты, progress_history).
- Полный прогон: ~1.6–2.0с в тёплом кэше, кратно больше на холодном.
- `ORDER BY` по 5 колонкам → внешняя сортировка на диске (~59 МБ).
- `count: 'exact'` + параллельная пагинация (`Promise.all`, 4×5000) → 4 одновременных тяжёлых прогона конкурируют за work_mem/IO → один выходит за 8с → `57014` → весь запрос падает, вкладка не грузится.
- Фильтр по `project_id` **не проталкивается** в view (проверено: чанк на 20 проектов = 1.47с) — обычными способами не оптимизируется.

Max rows Data API = **5000**, поэтому пагинация для 19k строк обязательна в любом случае.

## Решение

Материализовать view → `mat_resource_graph`. Чтение становится дешёвым seq scan (~100–300мс вместо 1.6–2с), таймаут уходит. На физической таблице работают индексы, push-down фильтров и проекция. Обновление — **дебаунс**: триггеры на базовых таблицах ставят флаг «грязно», лёгкая pg_cron-задача рефрешит MV не чаще раза в ~30с и только если были изменения.

В проекте уже есть паттерн MV (`mat_project_involved_users` + `refresh_project_involved_users`) — копируем его.

### Где используется view (важно — НИЧЕГО не удаляем)
`v_resource_graph` читают 4 модуля: `resource-graph` (Бюджеты), `kanban`, `modals/loadings`, `project-reports`. View **остаётся**. Мигрируем только Бюджеты; остальные потребители — позже и отдельно (модалки лучше оставить на живой view — им важна свежесть сразу после правки).

### Безопасность / RLS
View не использует `auth.uid()` — вся безопасность в server action (`applyMandatoryFilters`, restricted-проекты, isAdmin). MV это не меняет, НО при переходе на MV в action **сохранить все фильтры** + выдать `GRANT SELECT` роли `authenticated`.

## Как работает дебаунс + realtime

```
Правка загрузки/бюджета:
  → A видит изменение сразу (optimistic update, уже есть)
  → триггер ставит mv_refresh_state.is_dirty = true   (микросекунды, мутацию не тормозит)

pg_cron каждые ~30с:
  if is_dirty: REFRESH MATERIALIZED VIEW CONCURRENTLY mat_resource_graph  (2-4с, сбоку)
               is_dirty = false, last_refreshed = now()
  else: ничего (на простое нагрузки нет)

mv_refresh_state в realtime-публикации:
  → событие «MV обновилась» → клиенты инвалидируют resourceGraph.all → рефетч свежей MV
```
- 100 правок за 30с → один рефреш. Ноль правок → ноль рефрешей.
- Своя правка видна сразу (optimistic), чужая — через ~30с.
- Realtime переезжает с подписки на `loadings`/`budgets`/… на подписку на одну строку `mv_refresh_state` → инвалидация **после** рефреша (иначе рефетчим ещё не обновлённый снимок).
- Канбан/Разделы не трогаем — у них свой instant-realtime на живых view.

## План реализации (Definition of Done)
- [ ] **Сначала:** сузить широкие realtime-инвалидации (`*.all` на каждое изменение каждой таблицы) — предусловие, иначе firehose штормит рефетчами и выигрыш MV теряется.
- [ ] Материализовать `v_resource_graph` → `mat_resource_graph` (UNIQUE-индекс на грейн для `REFRESH CONCURRENTLY`, индексы `project_id`/`section_id`, `GRANT SELECT` роли `authenticated`).
- [ ] Дебаунс-рефреш: statement-триггеры-флаг на data-таблицах + таблица `mv_refresh_state` + pg_cron (рефреш только по флагу, ~30с) + ежедневная страховка (внутри view есть `CURRENT_DATE`).
- [ ] Переключить `getResourceGraphData` на MV — **сохранить все security-фильтры** (`applyMandatoryFilters`, restricted, isAdmin) — + realtime через `mv_refresh_state` (инвалидация ПОСЛЕ рефреша).
- [ ] Браузер-тест: Бюджеты без `57014`, чужая правка ≤30с, свои — мгновенно (optimistic); `npm run db:types` + `npm run build`.

## Связанные находки
- Каскад `resourceGraph.all` после мутаций (bug-VT-09) на MV тоже дешевеет.
- Побочно: Разделы (`view_departments_sections_loadings` = 7356 строк) грузятся одним `.select('*')` без пагинации → при «Загрузить всё» молча теряют ~2356 строк (Max rows = 5000). Отдельный тикет.
