# Employment Board — доска занятости отдела

Вкладка «Занятость» на странице `/tasks`. Начальник отдела видит все активные проекты отдела и всех сотрудников на одном экране и понимает, кто чем занят.

## Ключевые концепции

**Авто-размещение.** Сотрудник появляется под проектом автоматически, если у него есть активная на выбранную дату загрузка. Сначала `view_users` возвращает активных сотрудников отдела, затем `loadings` читается напрямую по их `user_id`; представление `view_departments_sections_loadings` в этой цепочке не используется. Перетаскивать вручную для этого не нужно.

**Ручные действия — исключение, а не основной путь:**
- закрепить проект, у которого пока нет активных загрузок (`department_pinned_projects`);
- поместить сотрудника на карточку проекта, когда формальной загрузки ещё нет (`department_board_placements`).

Ручное размещение — **лёгкая аннотация только для доски**: в `loadings` ничего не пишется, планирование её не видит. Снять можно только ручное размещение; авто-размещение снимается изменением самой загрузки в модуле планирования.

**Свободные сотрудники** — те, кто не попал ни на одну карточку. Подсвечены в боковой панели: это и есть индикация незанятости.

## Схема данных

Источники на чтение (существующие):

| Источник | Назначение |
|---|---|
| `view_users` | все активные сотрудники отдела |
| `loadings` | прямой запрос загрузок по `loading_responsible IN (employeeIds)`, `loading_status = 'active'`, `is_shortage = false` и включительным границам выбранной даты |
| `sections` | соответствие `loading_section` → `section_project_id` |
| `projects` | названия, restricted-признак и поиск проектов для ручного добавления |

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
- restricted-проекты скрываются от не-админов при чистой сборке доски по `projects.is_restricted`;
- `placeEmployee` дополнительно проверяет, что сотрудник действительно состоит в этом отделе.

В интерфейсе вкладка «Занятость» не предлагается без `employment_board.view`. Разрешение `employment_board.edit` позволяет управлять закреплёнными проектами на любой дате; ручное размещение и снятие сотрудников дополнительно доступны только в режиме `today`.

## Redis (Upstash)

Redis — **кэш-слой поверх Postgres, не источник истины**. Полная потеря Redis не теряет данные; при отсутствии `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` модуль работает напрямую с Postgres.

| Применение | Как |
|---|---|
| Cache-aside чтения доски | `GET employment-board:v2:{deptId}:{selectedDate}:{today\|dated}:{a\|u}:{scopeHash}:v{N}` → промах → сборка из Postgres → `SET ... EX 60`; при холодном кеше один запрос пересобирает снимок |
| Инвалидация | `INCR employment-board:ver:{deptId}` — одна O(1) команда |
| Distributed lock | `SET lock:placement:{deptId}:{employeeId} NX PX 3000` с уникальным token перед `placeEmployee` — защита от гонки при одновременном drag |
| Rate limit | не более 20 ручных действий за 10 секунд на пользователя; при сбое Redis action остаётся доступным |
| Presence | heartbeat раз в 10 секунд, TTL 20 секунд; в заголовке отображается число зрителей |

Версия в ключе — не украшение, а защита от гонки cache-aside: читатель, начавший сборку до чужой записи, допишет устаревший снимок под старой версией ключа, и его уже никто не прочитает. `DEL` эту гонку не закрывает — «медленный» читатель пишет уже после удаления.

`scopeHash` в ключе обязателен: видимость проектов зависит от прав. Признак админа пишется отдельно открытым текстом, чтобы коллизия 32-битного хэша не склеила админский и обычный кэш.

Rate limiting и presence реализованы как временные Redis-данные: их потеря не затрагивает Postgres и не ломает доску.

### Дата и свежесть доски

Доска по умолчанию показывает текущий день по Минску. Автоматические загрузки выбираются включительно по `loading_start <= selectedDate <= loading_finish`; режим `today | dated` и дата входят в клиентский и Redis-кэш. Закреплённые проекты доступны на любой дате, ручные размещения — только сегодня.

Redis-снимок имеет TTL 60 секунд **от момента записи снимка**. Это ограничивает срок жизни конкретного снимка, но не гарантирует свежесть в течение 60 секунд от изменения `loadings`: параллельная сборка, начатая до события, может записать снимок позже. Поэтому новый посетитель может получить такой снимок до истечения его TTL.

Открытая доска после релевантного события `loadings` сразу переключается на fresh-чтение до размонтирования, ещё до debounce запроса. `cachePolicy: 'fresh'` обходит весь путь снимка Redis: не читает version и snapshot, не получает build-lock и не пишет собранную доску. Rate limit, placement-lock и presence — отдельные механизмы и этой политикой не управляются. После доказуемо нерелевантного `INSERT` текущая дата не перечитывается; ранее просмотренные TanStack-снимки удаляются, а следующая смена даты выполняет fresh-чтение. Для локальных таблиц filtered `INSERT`/`UPDATE` и консервативный unfiltered `DELETE` входят в тот же fresh-контроллер, поскольку Postgres Changes не фильтрует DELETE без полного old row. Локальное событие удаляет только неактивные снимки доски; смена даты отменяет debounce прежнего ключа, а новый ключ загружается обычным query с уже включённым fresh-bypass.

Ошибки Redis в cache-aside режиме гасятся: чтение продолжается из Postgres, неудачная запись снимка не меняет успешный результат. Детали ошибок Postgres отправляются в Sentry, а клиент получает стабильный безопасный текст. После двух неудачных fresh-попыток доска сохраняет последний доступный снимок и показывает ручной повтор; если первого снимка ещё нет, повтор доступен в состоянии ошибки загрузки. Верхний request доски проверяется до permission/SQL/Redis и при неверной форме, дате, фильтрах или `cachePolicy` возвращает безопасное `Некорректный запрос доски`. Входы pin/unpin и placement также проверяются до побочных действий и возвращают `Некорректные данные`.

Для placement дата должна совпадать с текущей датой Минска. Она проверяется при входе в action и повторно непосредственно перед `INSERT`/`DELETE`, чтобы сузить окно перехода через полночь. Между последней проверкой и SQL-командой нет транзакционной атомарности, поэтому это дополнительная защита устаревшего UI, а не абсолютная гарантия.

## API

```typescript
// Server Actions (actions/index.ts)
getDepartmentEmploymentBoard({ filters, selectedDate, cachePolicy }): ActionResult<EmploymentBoard>
searchBoardProjects(query: string): ActionResult<{ id, name }[]>        // employment_board.edit
pinProject({ departmentId, projectId }): ActionResult<null>             // employment_board.edit
unpinProject({ departmentId, projectId }): ActionResult<null>           // employment_board.edit
placeEmployee({ departmentId, projectId, employeeId, selectedDate }): ActionResult<null>
removePlacement({ departmentId, projectId, employeeId, selectedDate }): ActionResult<null>

// Хуки (hooks/useEmploymentBoard.ts)
useEmploymentBoard({ filters, selectedDate, expectedDateMode, cachePolicy, onDateBoundary })
useBoardProjectSearch(debouncedTerm, { enabled })
usePinProject() / useUnpinProject() / usePlaceEmployee() / useRemovePlacement()
```

Ручные действия сразу отражаются в подходящих TanStack-снимках, а затем подтверждаются одним fresh-чтением. Rollback сравнивает текущий снимок с объектом, фактически сохранённым TanStack после structural sharing, восстанавливает только соответствующую optimistic-версию и не может затереть более свежий Realtime-ответ.

## UI

- В шапке находится календарь одной даты с действием «Сегодня». Выбор живёт только до размонтирования пользовательской вкладки.
- Раскладка карточек — CSS multi-column masonry (`columns-*` + `break-inside-avoid`): одна колонка на узком экране, две на широком и три на очень широком.
- На ширине меньше `md` боковая панель переносится наверх, ограничивается `min(40dvh, 20rem)` и прокручивается независимо от карточек. На широком экране её ширина — `16rem`.
- Drag & drop — нативный HTML5 API по паттерну `modules/kanban/hooks/useDragHandlers.ts`. `@dnd-kit` здесь не используется осознанно, см. `modules/kanban/drag-and-drop-implementation.md`.
- Карточка проекта принимает только сотрудников; фон доски — только проекты (закрепление).
- `teamName === 'Расчётная группа'` выделяется спокойным фиолетовым кольцом и пояснением; признаки свободного сотрудника и ручного размещения сохраняются.

## Файлы

```
modules/employment-board/
├── actions/index.ts                      # Server Actions
├── lib/redis.ts                          # Upstash: cache-aside + lock
├── hooks/useEmploymentBoard.ts           # TanStack Query
├── hooks/useBoardDnd.ts                  # нативный HTML5 DnD
├── components/BoardDatePicker.tsx
├── components/EmploymentBoardInternal.tsx
├── components/ProjectCard.tsx
├── components/EmployeeChip.tsx
├── components/SidePanel.tsx
├── types/index.ts
└── index.ts
```
