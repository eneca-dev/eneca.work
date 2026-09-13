---
id: "feature-SB-07"
status: "todo"
priority: "medium"
assignee: "Саша Бирило"
epic: "feature"
dueDate: null
created: "2026-09-03T09:00:00.000Z"
modified: "2026-09-03T09:00:00.000Z"
completedAt: null
labels: ["v1.5.0"]
order: "a23"
---
# feature-SB-07 Доска занятости отдела: вкладка «Занятость» на /tasks + Redis

Новая вкладка на странице «Задачи», где начальник отдела на одном экране видит активные проекты отдела и всех сотрудников отдела, и наглядно понимает, кто чем занят.

Полный план: `docs/employment-board-implementation-plan.md`.

---

## Что делаем

- Карточки активных проектов отдела (есть текущая загрузка сотрудника отдела) в основной области, раскладка CSS multi-column.
- Правая панель: список проектов (с поиском) + все сотрудники отдела.
- Сотрудники с активной загрузкой размещаются под проектами **автоматически**, из `view_departments_sections_loadings`.
- Ручные действия перетаскиванием: закрепить проект без загрузок, поместить сотрудника на карточку проекта.
- Redis (Upstash) как кэш-слой поверх Postgres — cache-aside + distributed lock на запись.

## Решения, принятые до старта

- Ручное размещение сотрудника — **лёгкая аннотация**, отдельная таблица; в `loadings` не пишет и планированием не используется.
- Закрепления и размещения — **общие на отдел** (`department_id`), не персональные.
- Redis — осознанное решение освоить технологию; не источник истины, потеря Redis не теряет данные.
- Rate limiting и presence на Redis — отложены на вторую итерацию (по ревью Pragmatic Architect).

## БД

Миграция `employment_board_tables` применена (только новые таблицы, существующие не изменялись):

- `department_pinned_projects` — вручную закреплённые проекты отдела.
- `department_board_placements` — ручные размещения сотрудника на карточке проекта.

Все FK — `ON DELETE CASCADE` (чтобы не сломать `safe_delete_project` и удаление отделов/сотрудников), поля аудита — `ON DELETE SET NULL`. RLS включён, ограничение по отделу — в Server Actions.

## Этапы

- \[x\] Миграция БД
- \[ \] Redis-клиент (Upstash) + cache-aside обёртка
- \[ \] Server Actions (обязательно через `getRestrictedProjectIds` / `applyMandatoryFilters`)
- \[ \] Типы + слияние авто/ручных размещений
- \[ \] UI: доска, карточки проектов, правая панель
- \[ \] Drag & drop по паттерну `modules/kanban/hooks/useDragHandlers.ts`
- \[ \] Интеграция вкладки в `/tasks` (`TasksViewMode`, `TabModal`, `TasksView`)
- \[ \] Permission на доступ к вкладке
- \[ \] Проверка агентами + браузером, README модуля

## Связанные файлы

- `docs/employment-board-implementation-plan.md` — полный план
- `modules/sections-page/actions/index.ts` — образец чтения той же view + restricted-фильтр
- `modules/departments-timeline/actions/index.ts` — образец сборки иерархии отдел→проект→сотрудник
- `modules/kanban/hooks/useDragHandlers.ts` — образец нативного HTML5 drag & drop
- `modules/sections-page/utils/bar-color.ts` — расцветка занятости
