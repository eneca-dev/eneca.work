---
id: "bug-VT-06"
status: "review"
priority: "high"
assignee: "Вадим Тихомиров"
epic: "bug"
dueDate: null
created: "2026-06-15T13:28:39.000Z"
modified: "2026-06-16T09:12:52.083Z"
completedAt: null
labels: ["v1.5.0"]
order: "a0"
---
# bug-VT-06 Множественные POST-запросы к Server Actions при монтировании вкладки Отделы

При холодной загрузке вкладки «Отделы» (маршрут `/tasks`) наблюдается аномалия сети: вместо ожидаемых ~3-х запросов летит более 14 одинаковых `POST`-запросов на адрес `/tasks` (которые соответствуют вызовам Server Actions в Next.js App Router).

### Ожидаемое поведение (согласно test-VT-03, S1)
При маунте должно быть:
- `getDepartmentsData` (1 раз)
- `getTeamsFreshness` (1 раз)
- Загрузка событий календаря (1 раз)

### Фактическое поведение
Идет шквал `POST`-запросов к `/tasks`. Это может быть вызвано:
1. Циклическим `useEffect` (например, `reloadPermissions()` вызывается слишком часто).
2. Проблемой N+1 на клиенте, когда каждый отрендеренный компонент (отдел/команда) маунтится и независимо дёргает Server Action.

### Как воспроизвести
1. Открыть маршрут `/tasks` в dev-режиме.
2. Переключиться на «Отделы».
3. Открыть Network DevTools и отфильтровать по `Fetch/XHR` -> `POST /tasks`.

### Связанные тикеты
- Обнаружено в рамках [test-VT-03](./test-VT-03.md) (Сценарий S1).

---

## Разбор причины

«14 POST» — это в основном **разные** Server Actions, а не дубли: в Next.js любой Server Action идёт `POST`-ом на URL текущей страницы (`/tasks`), они различаются заголовком `Next-Action`. Гипотезы тикета (циклический `useEffect`, per-row N+1) **не подтвердились**: строки получают данные через props, шторма дублей нет.

Запросы делятся на 3 группы:
- **A (~6)** — глобальный prefetch справочников `<ReferencePrefetch />` (1 раз за сессию через `requestIdleCallback`, кэш `Infinity`, к «Отделам» отношения не имеет).
- **B (3)** — данные вкладки: `getDepartmentsData`, `getTeamsFreshness`, `getCompanyCalendarEvents` («ожидаемые 3»).
- **C (~5)** — опции фильтра + права: `getFilterContext`, `getOrgStructure`, `getProjectStructure`, `getProjectTags`.

Один **настоящий дубль** в потоке всё же был: `getFilterContext` уходил ДВАЖДЫ на холодном маунте — из Zustand-лоадера `usePermissionsLoader` и из TanStack-хука `useFilterContext`. Они не дедуплицировались (разные пути, `getFilterContext` не обёрнут в `React.cache`).

## Что сделано

Убран дубль `getFilterContext`: в `modules/permissions/hooks/usePermissionsLoader.ts` прямой вызов `getFilterContext()` заменён на `queryClient.fetchQuery({ queryKey: queryKeys.filterPermissions.context(), ... })` — с тем же ключом и тем же `queryFn`, что у `useFilterContext`. Теперь обе ветки идут через один `queryClient`, и TanStack схлопывает одновременные запросы в **один** сетевой вызов независимо от порядка монтирования. Стор Zustand и хук `useFilterContext` снаружи не изменились; `reloadPermissions` сохраняет принудительный рефетч через `staleTime: 0`.

Эффект: −1 `getFilterContext` на холодном маунте (и на каждом заходе, где активны обе ветки). Ранее также был убран форсированный `reloadPermissions()` с маунта `TasksView`, что устранило повторный `getFilterContext` при возврате на `/tasks`.