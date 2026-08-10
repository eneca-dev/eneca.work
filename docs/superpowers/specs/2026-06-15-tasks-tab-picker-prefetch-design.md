# bug-DH-01 — `/tasks`: пикер вкладок + фоновый префетч

- **Тикет:** `.devtool/features/bug-DH-01.md`
- **Дата:** 2026-06-15
- **Масштаб:** средний (Quick Pipeline, ~4–5 файлов, без изменений БД)
- **Ветка / версия:** v1.5.0-DH → label `v1.5.0`

## Проблема

При заходе на `/tasks` страница рендерит контент по **persisted `activeTabId`** из zustand-стора `tasks-tabs`. Поэтому последняя активная вкладка (например «Бюджеты») монтируется сразу и, если у неё есть фильтры или включён режим «Загрузить всё», немедленно запускает тяжёлую загрузку — даже если пользователю нужна совсем другая вкладка.

## Цель

1. Не автозагружать содержимое вкладки при входе на страницу.
2. Показывать **пикер** — выбор из всех доступных пользователю вкладок.
3. Пока пользователь смотрит на пикер — **сбалансированно префетчить** данные в фоне, чтобы клик открывал вкладку быстрее (в идеале мгновенно из кэша), не «съедая» лишний трафик.
4. Не ломать deep-link.

## Решения (зафиксированы с пользователем)

- **Источник истины рендера — URL (`?tab=<id>`)**, а не persisted `activeTabId`.
- **Сбалансированный префетч:** дешёвые общие запросы греем сразу; тяжёлые, зависящие от фильтров — только по hover/намерению + один раз для последней активной вкладки.
- **Простые карточки** в пикере, без индикаторов прогрева кэша.

---

## 1. Поведение при входе на `/tasks`

Меняем `TasksView` так, чтобы рендер определялся URL:

- **Нет `?tab` в URL** → рендерим `TabPicker` (центрированная сетка карточек по числу вкладок). Тяжёлые view-компоненты (`KanbanBoardInternal` / `DepartmentsTimelineInternal` / `SectionsPageInternal` / `BudgetsViewInternal`) **не монтируются**. Строка инлайн-фильтра скрыта (нет активной вкладки).
- **Есть `?tab=<id>`** и `id` соответствует существующей вкладке → рендерим контент этой вкладки, как сейчас.
- **Есть `?tab=<id>`, но вкладки нет** (удалена/невалидна) → показываем пикер (мягкий fallback, без ошибки).

Верхняя панель вкладок (`TasksTabs`) остаётся видимой и на экране пикера — это тот же выбор в компактном виде; клик там навигирует на `?tab=id`.

**Карточка пикера:** иконка `viewMode` (тот же `VIEW_MODE_ICON_MAP`) + название вкладки. Дополнительно — карточка «+ Новая вкладка», открывающая существующий `TabModal`. Никаких статусов/спиннеров готовности.

## 2. Навигация / URL

- Клик по карточке пикера **или** по вкладке в верхней панели → `router.push` с `?tab=<id>` (через `useRouter` + `usePathname`/`useSearchParams`, App Router). Refresh остаётся на вкладке; «назад» возвращает к пикеру; ссылку можно расшарить.
- `activeTabId` в сторе сохраняем, но он **больше не управляет рендером**. Роль: «последняя активная вкладка» (для приоритетного префетча) и fallback для легаси-ссылок. При навигации по `?tab` синхронизируем `activeTabId` со стором (чтобы прочая логика стора и фильтры работали корректно).
- **Deep-link не ломаем.** Если в URL присутствуют легаси-параметры таргетинга контента (`projectId` / `sectionId` / `highlight`), которые страница уже читает, — пикер не показываем, открываем контент сразу.
  - ⚠️ **Verify во время плана:** как именно эти параметры выбирают вкладку сегодня (по коду в `TasksView` / kanban / sections). Безопасный дефолт: при наличии легаси-параметров без `?tab` открывать последнюю активную (`activeTabId`) вкладку и применять highlight, как сейчас.

## 3. Стратегия префетча

Запросы разделены по стоимости и переиспользуемости. Все префетчи под guard `getQueryData` (дедуп) + встроенный in-flight dedup TanStack; `prefetchQuery`/`prefetchInfiniteQuery` уважают `staleTime` (свежее не перезапрашивают).

### A. Дешёвое / общее / без параметров — греем сразу

При монтировании пикера, в `requestIdleCallback` (fallback `setTimeout`), последовательно с небольшим интервалом (по образцу `ReferencePrefetch`):

- `companyCalendar.events()` — общий для Отделов, Разделов (и resource-graph).
- `departmentsTimeline.freshness()` — крошечный.
- `budgets.calc()` (`useSectionCalcBudgets`) — стабильный, без параметров.
- *(опционально, рекомендуется)* структуры инлайн-фильтра (`filterStructure.*`, `projectTags`) — нужны строке фильтра на любой вкладке.

Не дублировать то, что уже греет глобальный `ReferencePrefetch` (departments/teams/positions/categories/subdivisions/roles/users/workCategories/difficultyLevels/stageStatuses/checkpointTypes). Набор A — комплементарный.

### B. Тяжёлое / зависит от фильтров — по hover/намерению + последняя вкладка

Тяжёлые первичные запросы view-компонентов:

| viewMode | ключ | queryFn | приём |
|---|---|---|---|
| kanban | `kanban.infinite(filters)` | `getKanbanSectionsPaginated` (page 1, pageSize 15) | `prefetchInfiniteQuery`, `initialPageParam: 1` |
| departments | `departmentsTimeline.list(filters)` | `getDepartmentsData` | `prefetchQuery` |
| sections | `sectionsPage.list(filters)` | `getSectionsHierarchy` | `prefetchQuery` |
| budgets | `resourceGraph.list(filters)` | `getResourceGraphData` | `prefetchQuery` (бюджетный список waterfall-ит после) |

Правила:
- Греем **по hover/фокусу карточки** вкладки (`prefetchTab(id)`), **плюс один раз eager** для последней активной вкладки (`activeTabId`) — самый вероятный клик.
- Перед префетчем: парсим `filterString` вкладки в `queryParams` (тот же `parseFilterString` + `tokensToQueryParams` с `TASKS_FILTER_CONFIG`, что и в `TasksView`) и проверяем `shouldFetch = filtersApplied || loadAllEnabled`. Если вкладка **без фильтров и без «Загрузить всё»** — грузить нечего (live-компонент тоже не грузит), **пропускаем**.
- Бюджеты: префетчим только `resourceGraph.list(filters)` (тяжёлая первая) — `useBudgets` зависит от `projectIds`, выведенных из уже загруженных проектов (waterfall), и догрузится сам после открытия вкладки.

### Аккуратность

- **Дедуп:** guard `if (queryClient.getQueryData(key)) return` + in-flight dedup.
- **staleTime:** соблюдается автоматически (`prefetchQuery` no-op для свежих данных).
- **Отмена:** при уходе со страницы / размонтировании пикера — `queryClient.cancelQueries` по запущенным ключам; idle-callback очищается в cleanup.
- **Подписки:** префетч только наполняет кэш, Realtime-подписок не создаёт (они в view-компонентах). Утечек нет; на пикере монтируется меньше компонентов, чем раньше.

## 4. Файлы

**Новые:**
- `modules/tasks/components/TabPicker.tsx` — сетка карточек + карточка «+ Новая вкладка» (через `TabModal`); hover/focus триггерит `prefetchTab`.
- `modules/tasks/hooks/useTasksPrefetch.ts` — eager-shared (A) + `prefetchTab(id)` (B) + eager last-active + cancel. По образцу `modules/cache/providers/reference-prefetch.tsx` и `modules/resource-graph/hooks/usePrefetchSectionsBatch.ts`. Импортирует Server Actions + `queryKeys` из соответствующих модулей.

**Изменяемые:**
- `modules/tasks/components/TasksView.tsx` — рендер по `?tab`; показ `TabPicker` при отсутствии `tab`/легаси-параметров; скрытие строки фильтра на пикере; синхронизация `activeTabId` с URL.
- `modules/tasks/components/TasksTabs.tsx` — клик навигирует на `?tab=id`; активная вкладка по URL.
- `modules/tasks/hooks/index.ts`, `modules/tasks/components/index.ts` — экспорты нового хука/компонента.
- README модуля tasks (если есть) — обновить раздел поведения страницы/префетча.

## 5. Агенты (Quick Pipeline)

- **Cache Guardian** — корректность ключей префетча, дедуп, staleTime, отмена.
- **Clean Code Guardian** + **Next.js Guardian** — `TabPicker` (>50 строк), App Router навигация (`useRouter`/`useSearchParams`).
- **Performance Guardian** — что не префетчим лишнего, idle-планирование.
- **Realtime Guardian** — подтвердить отсутствие новых подписок/утечек.

## 6. Definition of Done (маппинг)

- [ ] Вход на `/tasks` без `?tab` → пикер, тяжёлый контент не монтируется.
- [ ] Фоновый префетч: idle shared (A) + hover/last-active heavy (B), без дублей (guard + staleTime), видно в network.
- [ ] Клик по вкладке открывает её ощутимо быстрее за счёт прогретого кэша.
- [ ] Deep-link (`?tab=<id>` и легаси-параметры `projectId`/`sectionId`/`highlight`) продолжает работать.
- [ ] Нет лишних/дублирующихся запросов и утечек подписок.

## Открытые вопросы (решить на этапе плана)

1. Точный маппинг легаси-параметров (`projectId`/`sectionId`/`highlight`) → вкладка в текущем коде.
2. Включать ли структуры инлайн-фильтра в набор A (рекомендуется «да», но проверить стоимость запросов).
3. `router.push` vs `router.replace` для `?tab` (push даёт «назад → пикер»; это и хотим).
