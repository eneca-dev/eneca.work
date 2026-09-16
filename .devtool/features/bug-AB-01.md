---
id: "bug-AB-01"
status: "review"
priority: "high"
assignee: "Александра Бирило"
epic: "bug"
dueDate: null
created: "2026-08-12T12:00:00.000Z"
modified: "2026-08-12T12:30:00.000Z"
completedAt: null
labels: ["v1.5.0"]
order: "c01"
---
# bug-AB-01 Фильтр «проект» на страницах Tasks игнорирует department/team-scope при наличии managed_projects

## Проблема

У пользователя (Дмитрий Голиков) с ролью `department_head` (отдел «КР гражд») фильтр по проекту на вкладках `/tasks` (например «Разделы») не находит проекты, которые точно принадлежат его отделу и видны на самой странице (например «Ленинградское шоссе»). При этом сама страница «Разделы» корректно показывает разделы по всему отделу.

Воспроизводится у пользователей, которые одновременно имеют орг. роль (`department_head`/`team_lead`, permission `filters.scope.department`/`filters.scope.team`) **и** роль `project_manager` (permission `filters.scope.managed_projects`) — то есть ведут несколько своих проектов как PM в дополнение к руководству отделом.

## Причина

Два независимых, несогласованных источника видимости:

1. Сама страница «Разделы» (`modules/sections-page/actions/index.ts`, `getSectionsHierarchy()`) фильтруется через `applyMandatoryFilters` (`modules/permissions/utils/mandatory-filters.ts:139-156`) по `department_id` из scope — корректно показывает весь отдел.
2. Список проектов для автокомплита фильтра берётся из `getFilterProjects()` (`modules/resource-graph/actions/index.ts:680-716`) — все проекты минус `is_restricted`, без учёта отдела. Но в `modules/permissions/hooks/use-filtered-options.ts:164-170` опция `'проект'` фильтруется так:
   ```ts
   case 'проект':
     if (scope.projectIds?.length) {
       return scope.projectIds.includes(option.id)   // только managed-проекты
     }
     return true
   ```
   `scope.projectIds` заполняется в `scope-resolver.ts:91-99` из permission `filters.scope.managed_projects` **независимо** от орг-scope (комментарий в коде: «ортогонально орг. структуре»). Из-за этого, как только у пользователя появляется вторая роль `project_manager`, `scope.projectIds` становится непустым — и опция «проект» полностью игнорирует его department/team-scope, показывая только те несколько проектов, где он лично PM.

Подтверждено на боевой БД: у Дмитрия Голикова роли `department_head` + `project_manager` + `team_lead` одновременно; `scope.projectIds` = 3 его PM-проекта (не включают «Ленинградское шоссе», которое relates только к отделу).

**Важно:** в этом же файле функция `getLockedFilters()` (строка 228) уже реализует правильную логику — блокирует/сужает фильтр «проект» только когда `scope.level === 'projects'` (то есть у пользователя НЕТ орг-уровня выше). `isOptionAllowed()` (строка 164) этому правилу не следует — расхождение внутри одного файла.

## План исправления

В `modules/permissions/hooks/use-filtered-options.ts`, case `'проект'` — добавить проверку `scope.level === 'projects'`, по аналогии с уже существующей проверкой для `'ответственный'` (строка 154) и с `getLockedFilters()`:

```ts
case 'проект':
  // Сужаем список только для "чистых" project manager без орг-scope.
  // Если есть орг-уровень (department/team/subdivision/all) - показываем все проекты,
  // т.к. getFilterProjects() и так не фильтрует по отделу/команде.
  if (scope.level === 'projects' && scope.projectIds?.length) {
    return scope.projectIds.includes(option.id)
  }
  return true
```

Однострочная точечная правка, один файл, без миграций и изменений схемы БД.

## Затронутые файлы
- `modules/permissions/hooks/use-filtered-options.ts` (~строка 164-170)

## Проверка после фикса
- Дмитрий Голиков (department_head «КР гражд» + PM 3 проектов): в фильтре «проект» на `/tasks` → «Разделы» должны находиться ВСЕ проекты (как раньше, до появления PM-роли), включая «Ленинградское шоссе».
- Пользователь, который ТОЛЬКО project_manager (без department/team scope) — поведение не должно измениться: видит в фильтре только свои управляемые проекты.

## Как решено
В `modules/permissions/hooks/use-filtered-options.ts`, case `'проект'` добавлена проверка `scope.level === 'projects'` перед сужением списка до `scope.projectIds`. Раньше сужение срабатывало всегда, когда `scope.projectIds` непустой — а он заполняется из permission `filters.scope.managed_projects` независимо от орг-уровня (department/team), из-за чего у пользователей с двумя ролями сразу (напр. department_head + project_manager) фильтр «проект» ошибочно схлопывался до нескольких PM-проектов вместо всего отдела. Теперь сужение применяется только когда `scope.level === 'projects'`, то есть когда у пользователя нет орг-уровня выше (department/team/subdivision/all) — по аналогии с уже существующей логикой для ключа `'ответственный'` (та же функция, строка ~154) и с `getLockedFilters()` в этом же файле, которая уже блокирует «проект» только при `scope.level === 'projects'`.

## На что обратить внимание ревьюеру
1. Проверить сценарий пользователя с несколькими ролями (напр. department_head + project_manager, как у Дмитрия Голикова): фильтр «проект» на `/tasks` должен показывать все проекты отдела, а не только управляемые PM-проекты.
2. Проверить, что для "чистого" project_manager (без department/team/subdivision scope) поведение не изменилось — он по-прежнему видит в фильтре только свои управляемые проекты.
3. Проверить admin (`scope.level === 'all'`) — не затронут, там `isOptionAllowed` вообще не вызывается / всегда true.
4. Изменение однострочное и локальное — миграций, изменений схемы БД и правок в других файлах не было.
