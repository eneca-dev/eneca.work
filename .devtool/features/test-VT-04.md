---
id: "test-VT-04"
status: "todo"
priority: "high"
assignee: "Вадим Тихомиров"
epic: "test"
dueDate: null
created: "2026-06-15T13:45:00.000Z"
modified: "2026-06-15T13:45:00.000Z"
completedAt: null
labels: ["v1.5.0"]
order: "a3"
---
# test-VT-04 Тест вкладки «Разделы» (/tasks): сетевые запросы и оптимизация

Родительская задача: **bug-VT-02**. Тестируем по правилам из `bug-VT-02` («Человек + Нейросеть»).

## Цель
Вкладка «Разделы» в модуле `tasks` работает медленно. Цель — разобрать **каждый сетевой запрос** на этой вкладке, найти лишние/дублирующиеся/тяжёлые запросы, дорогие in-memory трансформации и предложить оптимизации. Баги/находки оформляем отдельными тикетами `bug-...`.

## Контекст реализации (для проверяющего ИИ)
- Маршрут: `app/(dashboard)/tasks/page.tsx` → `TasksView` → при `viewMode === 'sections'` рендерит `SectionsPageInternal` (модуль `modules/sections-page`).
- Server Actions в Next.js App Router идут как **POST на текущий маршрут `/tasks` с заголовком `Next-Action`** — различаем их по этому заголовку и по телу ответа.
- **Условие загрузки:** таймлайн НЕ грузится, пока нет фильтров и не нажата кнопка «Загрузить всё» (`shouldFetchData = filtersApplied || loadAllEnabled`).
- Ожидаемые запросы при работе вкладки:
  - `getSectionsHierarchy(filters)` — основная тяжёлая выборка из view `view_departments_sections_loadings` (`select('*')`, плоские строки → иерархия Department → Project → ObjectSection → Loading). `staleTime: Infinity` (обновление только через Realtime/invalidation), queryKey `sectionsPage.list(filters)`.
  - `getFilterContextForTasksTabs()` + `getRestrictedProjectIds()` — контекст прав и restricted-проекты, идут **параллельно** до основного запроса.
  - **Доп. запрос к `view_users` (`select user_id, team_id`)** уже ПОСЛЕ основного — подтягивает `team_id` для уникальных `employee_id` (нужно для гейтинга в модалке). Кандидат на лишний водопад.
  - При фильтре `team_id`/`subdivision_id` — цепочка резолвов: `resolveMultiValueToUuids` (teams) → `view_employee_workloads` → `in('employee_id', ...)`. Потенциальный N+1.
  - `reloadPermissions()` — вызывается в `TasksView` на маунте (useEffect) → возможный источник лишних запросов/рефетча.
- Мутации и их инвалидация:
  - `updateLoadingDates` (drag-resize) → optimistic + invalidate `sectionsPage.all` + `resourceGraph.all` + `departmentsTimeline.all`.
  - `useLoadingMutations` (create/update/archive/delete/split) → глубокий optimistic в трёх кешах (`sectionsPage.all`, `departmentsTimeline.all`, `resourceGraph.all`) + invalidate `loadings.all` и тех же трёх ключей.
  - `upsertSectionCapacity` / `deleteSectionCapacityOverride` → invalidate **всех** `sectionsPage.lists()` (слишком широко, без fine-grained по `section_id`).
- Realtime-подписки модуля (см. `modules/cache/realtime/config.ts`): изменения в `loadings`, `sections`, `profiles`, `departments`, `decomposition_stages` инвалидируют `sectionsPage.all` (debounce 100ms).

## Среда
- `localhost:3000`, dev-режим, тестировщик авторизуется сам.
- Браузер открывает ИИ через Playwright MCP; тестировщик кликает в этом окне.
- ИИ читает console + network через Playwright, состояние БД — через Supabase MCP (только чтение).

## Сценарии (чек-лист)

### 🔴 Приоритет 1 — базовый сетевой профиль
- [ ] **S1. Холодная загрузка вкладки.** Открыть `/tasks`, переключиться на «Разделы», применить фильтр (или нажать «Загрузить всё»).
  - Зафиксировать: список всех запросов, по каждому — метод, статус, время ответа, размер.
  - Ожидание: `getFilterContextForTasksTabs` + `getRestrictedProjectIds` — параллельно; затем `getSectionsHierarchy` — 1 раз; затем `view_users` (team_id) — 1 раз.
  - Искать: дубли, лишний `getSectionsHierarchy` из-за `reloadPermissions` на маунте, водопад вместо параллели, можно ли убрать пост-запрос `view_users` (вынести team_id во вью).
- [ ] **S2. Переключение вкладок Разделы → Канбан → Разделы.**
  - Ожидание: при возврате `getSectionsHierarchy` НЕ перезапрашивается (`staleTime: Infinity`, кеш-хит по тому же набору фильтров).
  - Искать: лишний рефетч при возврате, повторный `reloadPermissions`, повторный `view_users`.
- [ ] **S3. Размер и время `getSectionsHierarchy`.**
  - Измерить размер ответа и время; в Supabase/Sentry — длительность `db.query` к `view_departments_sections_loadings`.
  - Искать: over-fetch (`select('*')` на вьюхе — лишние поля avatar_url, stage_name, position и т.п.), непропорционально большой payload, стоимость in-memory трансформации плоских строк в иерархию (дублирование разделов по отделам, потенциально O(n²)).

### 🟡 Приоритет 2 — реакция на действия пользователя
- [ ] **S4. Изменение фильтра** (например `отдел:"..."`, `проект:"..."`).
  - Ожидание: запрос уходит на закоммиченный фильтр, есть дебаунс, нет запроса на каждый символ; смена фильтра = новый queryKey, плавный переход (keepPreviousData).
  - Искать: запрос-на-keystroke, дубли при одном изменении, гонки, повторные резолвы teams/subdivisions на каждый ввод.
- [ ] **S5. Фильтр по команде/подразделению** (`команда:"..."`).
  - Ожидание: один проход выборки.
  - Искать: цепочку `resolveMultiValueToUuids → view_employee_workloads → основная выборка → view_users` — сколько последовательных запросов, можно ли свести через JOIN/вью.
- [ ] **S6. Раскрытие/сворачивание отдела/проекта/раздела.**
  - Ожидание: **ноль** сетевых запросов (чистый клиент, UI-store `useSectionsPageUIStore`).
  - Искать: любой запрос здесь = баг/лишняя нагрузка.
- [ ] **S7. Drag-to-resize загрузки** (`updateLoadingDates`).
  - Ожидание: 1 экшен на сохранение + optimistic UI; затем инвалидация трёх ключей.
  - Искать: тяжёлый полный рефетч `getSectionsHierarchy` после каждого ресайза (главный кандидат на оптимизацию), повторные запросы, каскад из инвалидации `resourceGraph`/`departmentsTimeline`.
- [ ] **S8. Редактирование ёмкости раздела (capacity).**
  - Ожидание: точечное обновление.
  - Искать: инвалидацию **всех** `sectionsPage.lists()` (рефетч всей иерархии ради одного раздела) — кандидат на fine-grained invalidation по `section_id`.

### 🟢 Приоритет 3 — фон и массовые операции
- [ ] **S9. Realtime-подписки.** Сколько каналов поднимается; вызывает ли внешнее изменение в `loadings`/`sections`/`profiles` шторм рефетчей всей иерархии (с учётом debounce 100ms).
- [ ] **S10. Создание/перемещение/split загрузки через модалку** (`useLoadingMutations`): корректность optimistic в трёх кешах, число инвалидаций на onSuccess, нет ли тройного полного рефетча.

## Найденные баги
_(ИИ дозаполняет по ходу; на каждый подтверждённый баг — отдельный тикет `bug-...` со ссылкой сюда)_
- …

## Результаты
_(ИИ заполняет в конце: сводка по запросам, подтверждённые проблемы, список заведённых багов, предложения по оптимизации)_
- …
