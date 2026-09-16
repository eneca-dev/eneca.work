---
id: "feature-AB-02"
status: "todo"
priority: "medium"
assignee: "Александра Бирило"
epic: "feature"
dueDate: null
created: "2026-08-12T13:00:00.000Z"
modified: "2026-08-12T14:00:00.000Z"
completedAt: null
labels: ["v1.5.0"]
order: "c03"
---
# feature-AB-02 Сортировка проектов и разделов на странице «Разделы»: с загрузками сверху, без загрузок снизу

## Решение (согласовано с постановщиком, с оговоркой)
Сортировка нужна на двух уровнях: проекты внутри отдела **и** разделы внутри проекта. Постановщик не был полностью уверен («скорее по всему, но точно не уверен») — оба уровня добавляются как отдельные независимые `.sort()`-вызовы, при желании любой из них легко отключить одной строкой.

**Уровень «сотрудники» — сортировка технически невозможна/бессмысленна.** Сотрудники в этой иерархии не самостоятельная сущность — они получаются группировкой `objectSection.loadings` по `employeeId` на клиенте (`modules/sections-page/components/flatten-sections.ts:46-62`). Сотрудник без загрузки в разделе физически не может появиться как строка — то есть все показанные сотрудники всегда «с загрузками». Сортировать нечего.

## Где сейчас сортировка (проекты)
`modules/sections-page/actions/index.ts:546-552` — после сборки иерархии:
```ts
for (const dept of departmentsMap.values()) {
  ...
  dept.projects.sort(compareProjectsByGup)   // строка 551
}
```
Компаратор — `modules/sections-page/utils/sort-projects.ts:24-40`.

## Готовые данные
- `project.totalLoadings` (`modules/sections-page/types/index.ts:94`) — инкрементируется на `actions/index.ts:535`, доступен до сортировки.
- `objectSection.totalLoadings` (`actions/index.ts:534`, `objectSection.totalLoadings = objectSection.loadings.length`) — то же самое для разделов, тоже уже посчитано на момент, когда нужно сортировать `project.objectSections`.

Дополнительных запросов к БД не требуется ни для одного из двух уровней.

## План реализации
1. `modules/sections-page/utils/sort-projects.ts` — добавить:
   ```ts
   export function compareProjectsByLoadingsThenGup(a: Project, b: Project): number {
     const aHas = a.totalLoadings > 0
     const bHas = b.totalLoadings > 0
     if (aHas !== bHas) return aHas ? -1 : 1
     return compareProjectsByGup(a, b)
   }
   ```
2. Там же (или в новом файле `sort-sections.ts`, если так чище) — аналогичный компаратор для разделов:
   ```ts
   export function compareSectionsByLoadings(a: ObjectSection, b: ObjectSection): number {
     const aHas = a.totalLoadings > 0
     const bHas = b.totalLoadings > 0
     if (aHas !== bHas) return aHas ? -1 : 1
     return a.name.localeCompare(b.name, 'ru')   // вторичный ключ — по названию (объект/раздел), т.к. у разделов нет ГУП-нумерации
   }
   ```
3. `modules/sections-page/actions/index.ts:551` — заменить `dept.projects.sort(compareProjectsByGup)` на `dept.projects.sort(compareProjectsByLoadingsThenGup)`, и в том же цикле добавить `project.objectSections.sort(compareSectionsByLoadings)` для каждого проекта (сейчас разделы вообще не сортируются — порядок = порядок первого появления в строках view).

## Затронутые файлы
- `modules/sections-page/utils/sort-projects.ts` (или новый `sort-sections.ts`)
- `modules/sections-page/actions/index.ts` (2 точки в одном цикле, строки ~546-552)

## Масштаб
Мелкий, 2 файла, без миграций БД.

## Открытый момент
Вторичный ключ сортировки разделов — по названию (объект/раздел). Если нужен другой порядок (например, по дате начала раздела) — сообщите, поменять компаратор — тривиально.
