# Employment Board — доска занятости отдела

Вкладка «Занятость» на странице `/tasks`. Начальник отдела видит все активные проекты отдела и всех сотрудников на одном экране и понимает, кто чем занят.

## Ключевые концепции

**Авто-размещение.** Сотрудник появляется под проектом автоматически, если у него есть активная сегодня загрузка (`view_departments_sections_loadings`, `employee_department_id = отдел`). Перетаскивать вручную для этого не нужно — доска актуальна каждый день сама.

**Ручные действия — исключение, а не основной путь:**
- закрепить проект, у которого пока нет активных загрузок (`department_pinned_projects`);
- поместить сотрудника на карточку проекта, когда формальной загрузки ещё нет (`department_board_placements`).

Ручное размещение — **лёгкая аннотация только для доски**: в `loadings` ничего не пишется, планирование её не видит. Снять можно только ручное размещение; авто-размещение снимается изменением самой загрузки в модуле планирования.

**Свободные сотрудники** — те, кто не попал ни на одну карточку. Подсвечены в правой панели: это и есть индикация незанятости.

## Схема данных

Источники на чтение (существующие):

| Источник | Назначение |
|---|---|
| `view_departments_sections_loadings` | активные загрузки сотрудников отдела → проекты и авто-размещения |
| `view_users` | все активные сотрудники отдела |
| `projects` | поиск проектов для ручного добавления |

Собственные таблицы (миграция `employment_board_tables`):

**`department_pinned_projects`** — вручную закреплённые проекты.

| Колонка | Назначение |
|---|---|
| `id` | PK |
| `department_id` → `departments` | отдел, на чьей доске закреплён проект |
| `project_id` → `projects` | закреплённый проект |
| `pinned_by` → `profiles` | кто закрепил (аудит) |
| `pinned_at` | когда закреплён |

`UNIQUE (department_id, project_id)`.

**`department_board_placements`** — ручные размещения сотрудника на проекте.

| Колонка | Назначение |
|---|---|
| `id` | PK |
| `department_id` → `departments` | контекст доски |
| `project_id` → `projects` | на каком проекте сотрудник |
| `employee_id` → `profiles` | кто размещён |
| `placed_by` → `profiles` | кто перетащил (аудит) |
| `placed_at` | когда размещён |

`UNIQUE (department_id, project_id, employee_id)`.

Все FK на существующие таблицы — `ON DELETE CASCADE`, чтобы не ломать действующие сценарии удаления (`safe_delete_project`, удаление отдела/сотрудника). Поля аудита — `ON DELETE SET NULL`.

Данные общие на отдел (`department_id`), не персональные: доску видят одинаково все, у кого есть доступ к отделу.

## RLS и права

| Permission | Что даёт | Роли |
|---|---|---|
| `employment_board.view` | видеть вкладку «Занятость» и данные доски | admin, department_head, subdivision_head, project_manager |
| `employment_board.edit` | закреплять проекты, размещать и снимать сотрудников | admin, department_head, subdivision_head, project_manager |

⚠️ Опираться на scope вместо этих разрешений **нельзя**: расширение области видимости до отдела даёт `tasks.tabs.view.department`, а оно выдано роли `user`, то есть всем сотрудникам. Доступ к доске определяет только собственное разрешение модуля.

RLS на таблицах включён; политики разрешают доступ `authenticated`. Реальная авторизация — в Server Actions:

- `resolveBoardDepartment(requiredPermission, filters)` проверяет разрешение (`view` на чтение, `edit` на все мутации), затем определяет отдел доски и право на этот отдел (`getFilterContextForTasksTabs` + `applyMandatoryFilters`);
- restricted-проекты скрываются от не-админов через `getRestrictedProjectIds()`;
- `placeEmployee` дополнительно проверяет, что сотрудник действительно состоит в этом отделе.

В интерфейсе вкладка «Занятость» не предлагается без `employment_board.view`, а без `employment_board.edit` скрываются поиск проектов, перетаскивание и кнопки снятия.

## Redis (Upstash)

Redis — **кэш-слой поверх Postgres, не источник истины**. Полная потеря Redis не теряет данные; при отсутствии `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` модуль работает напрямую с Postgres.

| Применение | Как |
|---|---|
| Cache-aside чтения доски | `GET employment-board:v1:{deptId}:{a\|u}:{scopeHash}:v{N}` → промах → сборка из Postgres → `SET ... EX 60`; при холодном кеше один запрос пересобирает снимок |
| Инвалидация | `INCR employment-board:ver:{deptId}` — одна O(1) команда |
| Distributed lock | `SET lock:placement:{deptId}:{employeeId} NX PX 3000` с уникальным token перед `placeEmployee` — защита от гонки при одновременном drag |
| Rate limit | не более 20 ручных действий за 10 секунд на пользователя; при сбое Redis action остаётся доступным |
| Presence | heartbeat раз в 10 секунд, TTL 20 секунд; в заголовке отображается число зрителей |

Версия в ключе — не украшение, а защита от гонки cache-aside: читатель, начавший сборку до чужой записи, допишет устаревший снимок под старой версией ключа, и его уже никто не прочитает. `DEL` эту гонку не закрывает — «медленный» читатель пишет уже после удаления.

`scopeHash` в ключе обязателен: видимость проектов зависит от прав. Признак админа пишется отдельно открытым текстом, чтобы коллизия 32-битного хэша не склеила админский и обычный кэш.

Rate limiting и presence реализованы как временные Redis-данные: их потеря не затрагивает Postgres и не ломает доску.

## API

```typescript
// Server Actions (actions/index.ts)
getDepartmentEmploymentBoard(filters?): ActionResult<EmploymentBoard>   // employment_board.view
searchBoardProjects(query: string): ActionResult<{ id, name }[]>        // employment_board.edit
pinProject({ departmentId, projectId }): ActionResult<null>             // employment_board.edit
unpinProject({ departmentId, projectId }): ActionResult<null>           // employment_board.edit
placeEmployee({ departmentId, projectId, employeeId }): ActionResult<null>    // employment_board.edit
removePlacement({ departmentId, projectId, employeeId }): ActionResult<null>  // employment_board.edit

// Хуки (hooks/useEmploymentBoard.ts)
useEmploymentBoard(queryParams)
useBoardProjectSearch(debouncedTerm, { enabled })
usePinProject() / useUnpinProject() / usePlaceEmployee() / useRemovePlacement()
```

Optimistic update не используется: ответ пересобирает всю доску целиком (авто + ручные размещения), воспроизводить эту сборку на клиенте — источник рассинхрона.

## UI

- Раскладка карточек — CSS multi-column masonry (`columns-*` + `break-inside-avoid`): карточки перетекают по колонкам без пересечений при любом количестве проектов и сотрудников. Число колонок адаптируется под ширину экрана.
- Drag & drop — нативный HTML5 API по паттерну `modules/kanban/hooks/useDragHandlers.ts`. `@dnd-kit` здесь не используется осознанно, см. `modules/kanban/drag-and-drop-implementation.md`.
- Карточка проекта принимает только сотрудников; фон доски — только проекты (закрепление).

## Файлы

```
modules/employment-board/
├── actions/index.ts                      # Server Actions
├── lib/redis.ts                          # Upstash: cache-aside + lock
├── hooks/useEmploymentBoard.ts           # TanStack Query
├── hooks/useBoardDnd.ts                  # нативный HTML5 DnD
├── components/EmploymentBoardInternal.tsx
├── components/ProjectCard.tsx
├── components/EmployeeChip.tsx
├── components/SidePanel.tsx
├── types/index.ts
└── index.ts
```
