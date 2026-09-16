---
id: "feature-AB-03"
status: "review"
priority: "medium"
assignee: "Александра Бирило"
epic: "feature"
dueDate: null
created: "2026-08-12T13:00:00.000Z"
modified: "2026-08-13T11:30:00.000Z"
completedAt: null
labels: ["v1.5.0"]
order: "c04"
---
# feature-AB-03 Ёмкость (плановая загрузка = число нужных сотрудников) на строке проекта, с реальным сохранением на сервер

## Подтверждённая трактовка
«Плановая загрузка на проекте» = ёмкость (`capacity`) — число сотрудников, которое нужно на проект. Редактируется на строке проекта, одним значением на дату/диапазон дат, которое **раздаётся одинаково на все разделы проекта**.

## Где хранится (важно: НЕ новая сущность)
Та же таблица `section_capacity`, что уже используется для ёмкости на уровне раздела (`section_id` + `capacity_date` + `capacity_value`). Ввод значения на проекте = запись **нескольких строк** (по одной на каждый `objectSection.sectionId` проекта) с одинаковым значением на выбранные даты. Отдельной сущности «ёмкость проекта» в БД нет и не будет.

**Миграция БД не нужна.** Таблица и её структура уже в проде (проверено: `information_schema.tables` — существует; на момент проверки 0 строк).

## Решение по хранению (принято по итогам обсуждения)
Раньше ёмкость на разделе редактировалась, но сохранялась **только в localStorage браузера** (Zustand-стор `useSectionsPageUIStore`) — Server Actions `upsertSectionCapacity`/`deleteSectionCapacityOverride` существовали, но нигде не вызывались, то есть значение не было общим для команды. Решено: **подключить реальное сохранение на сервер** — и для нового редактора на проекте, и заодно для уже существующего редактора на разделе (нет смысла держать два разных механизма персистентности на одной странице).

## 🔴 Обязательно закрыть перед вводом в реальное использование: дыра в безопасности
Проверено на живой БД:
- `section_capacity`: `relrowsecurity = false`, `pg_policies` — пусто (RLS вообще не настроен).
- `upsertSectionCapacity`/`deleteSectionCapacityOverride` (`actions/index.ts:578-711`) проверяют только `supabase.auth.getUser()` (залогинен ли пользователь) — **никакой проверки permission/scope нет**.

Сейчас это безопасно только потому, что функции никем не вызываются (мёртвый код). Как только их подключим к реальному UI — Server Action остаётся публично вызываемым endpoint'ом независимо от клиентских permission-гейтов, и без серверной проверки любой залогиненный пользователь сможет менять ёмкость любого раздела в системе.

**Нужно добавить в Server Action серверную проверку** permission `sections.capacity.edit` (+ по аналогии с `createSectionLoading`/`canEditLoading`, возможно scope-проверку по отделу/проекту раздела через `getFilterContext()`), прежде чем делать upsert/delete. Это часть объёма задачи, не отдельный тикет — Security Guardian обязателен при ревью (см. CLAUDE.md: «Новый Server Action → Cache Guardian, Security Guardian, TypeScript Guardian»).

## Технический план

### Сервер
1. `modules/sections-page/actions/index.ts` — добавить batch-версию апсерта (эффективнее, чем N отдельных вызовов при записи на весь проект = много разделов × диапазон дат одним действием):
   ```ts
   export async function upsertSectionCapacityBatch(
     inputs: CapacityInput[]
   ): Promise<ActionResult<SectionCapacity[]>>
   ```
   Внутри: та же валидация (`capacityValue` 0.1–99), auth-check, **+ новая проверка permission/scope**, один `.upsert([...], { onConflict: 'section_id,capacity_date' })` на весь батч.
2. Добавить проверку прав в `upsertSectionCapacityBatch` и в существующие `upsertSectionCapacity`/`deleteSectionCapacityOverride` (раз уж чиним — чинить везде, не только в новом коде).

### Хуки / кэш (по паттерну cache-модуля проекта, см. `modules/cache/README.md`)
3. `modules/sections-page/hooks/index.ts` — мутация над `upsertSectionCapacityBatch` с инвалидацией/оптимистичным апдейтом query key иерархии разделов (тот же, что использует `getSectionsHierarchy`).

### Клиент
4. `modules/sections-page/components/AggregatedBarsOverlay.tsx` — `handleSave` вызывает новую мутацию вместо (или в дополнение как оптимистичный слой к) `setCapacity`/`setCapacityRange` из Zustand.
5. Источник `dateCapacityOverrides` — переключить с Zustand-хуков (`useDateCapacityOverrides`/`useMultipleSectionsCapacityOverrides`) на реальные серверные данные — `objectSection.capacityOverrides`, которые `getSectionsHierarchy` **уже возвращает** (`actions/index.ts:493-494`), просто сейчас никем не читаются. Дополнительных запросов не требуется.
6. `modules/sections-page/components/rows/ProjectRow.tsx` — включить `editable` на `AggregatedBarsOverlay` (сейчас `editable={false}`, `capacityHint="Ёмкость задаётся на строке раздела"` — строки 133-134), гейт `useHasPermission('sections.capacity.edit')`. При сохранении — вызов batch-мутации со списком `sectionId` всех `project.objectSections` и общим диапазоном дат/значением.
7. `modules/sections-page/stores/useSectionsPageUIStore.ts` — роль Zustand-стора для capacity сокращается до необязательного оптимистичного слоя (или убирается совсем, если хватит стандартного оптимистичного обновления через React Query/cache-модуль) — решить на этапе реализации, не меняя паттерн остального стора.

## Затронутые файлы
- `modules/sections-page/actions/index.ts` (новый batch-экшен + permission-проверка в существующих)
- `modules/sections-page/hooks/index.ts` (новая мутация)
- `modules/sections-page/components/AggregatedBarsOverlay.tsx`
- `modules/sections-page/components/rows/ObjectSectionRow.tsx` (переключить источник `dateCapacityOverrides`)
- `modules/sections-page/components/rows/ProjectRow.tsx`
- `modules/sections-page/stores/useSectionsPageUIStore.ts` (сократить/адаптировать)

## Масштаб
Средний, ~6 файлов. Миграция БД не требуется (таблица и колонки уже в проде). Основной риск — не в схеме, а в правильности серверной проверки прав (см. раздел про безопасность выше) и в корректной инвалидации кэша, чтобы после сохранения все зависимые строки (проект + все его разделы) обновились согласованно.

## Проверка после реализации
- Ввод ёмкости на проекте → у всех разделов проекта на выбранные даты появляется то же значение, значение видно после **перезагрузки страницы** (не только у текущего пользователя/браузера — проверить с другого аккаунта/устройства).
- Пользователь без `sections.capacity.edit` не может вызвать batch-экшен напрямую (проверить не только UI, но и прямой вызов Server Action — например, через инструменты разработчика).
- Существующее редактирование на разделе продолжает работать, теперь тоже сохраняясь на сервер.

---

## Как решено (итог реализации)

### Найденная первопричина
Ёмкость **сохранялась в БД корректно, но не читалась обратно**. Вью `view_departments_sections_loadings` отдавала `capacity_date`/`capacity_value` как захардкоженные `NULL::date` / `NULL::numeric` — подневная ёмкость физически не могла дойти до фронта. Второй путь (базовая ёмкость через строку с `capacity_date IS NULL`) вью читала корректно, но в него никогда ничего не писалось — 0 таких строк в БД. Обе половины механизма были сломаны взаимодополняющим образом ещё с исходного коммита `9f62da1`.

### Миграция БД (применена)
`supabase/migrations/2026-08-13_view_dsl_capacity_overrides.sql` — в вью добавлена колонка `capacity_overrides jsonb` (`{"YYYY-MM-DD": число}` на раздел). Собирается отдельным CTE с `GROUP BY section_id` и подключается `LEFT JOIN` 1:1 — строки не размножаются, агрегат считается один раз на раздел. Все существующие колонки сохранены в том же порядке и с теми же типами, новая добавлена строго в конец.

**Контроль до/после миграции совпал в точности:** 8815 строк / 4956 разделов / 5308 загрузок. Зависимых вью нет (проверено через `pg_depend`).

### Сервер
- `upsertSectionCapacity` / `deleteSectionCapacityOverride` — добавлена проверка permission `sections.capacity.edit` через `getFilterContext()` (раньше проверялся только факт логина, а RLS у таблицы нет вообще — Server Action был единственным барьером).
- Новый `upsertSectionCapacityBatch(inputs)` — один upsert на весь батч, с той же проверкой прав.
- `getSectionsHierarchy` — читает `row.capacity_overrides` через новый хелпер `parseCapacityOverrides()`.

### Клиент
- `AggregatedBarsOverlay` — вместо прямого доступа к Zustand проп-колбэк `onSaveCapacity(startDate, endDate, value)`.
- `ObjectSectionRow` — читает ёмкость из `objectSection.capacityOverrides` (приходит с сервера в составе иерархии, доп. запроса нет), пишет через `useUpsertSectionCapacityBatch`.
- `ProjectRow` — `editable` по реальному permission (было жёстко `false`); ввод раздаёт значение на все разделы проекта одним батчем. Блок ёмкости показывается **независимо от expand state** (раньше только у свёрнутого проекта — поэтому по клетке нельзя было попасть) и **даже если у проекта ещё нет загрузок** (иначе нельзя спланировать заранее).
- `DepartmentRow` — агрегация тоже переведена на серверные данные, иначе отдел показывал бы цифры, рассинхронизированные с проектом/разделом.
- `useSectionsPageUIStore` — блок Capacity Overrides удалён целиком (проверено grep'ом — использований вне заменённых файлов не было).

### Новые файлы
- `modules/sections-page/utils/capacity.ts` — `expandDateRange()`.

### Типы
`types/db.ts` — `capacity_overrides: Json | null` дописана **вручную**, `npm run db:types` запускать нельзя (см. «вне объёма»).

## На что обратить внимание ревьюеру
1. **Главное вручную:** ввод ёмкости на строке проекта → значение проставляется всем разделам проекта на выбранные даты и **переживает перезагрузку** (и видно с другого аккаунта — раньше это был localStorage).
2. Пользователь без `sections.capacity.edit` не должен сохранить ёмкость **прямым вызовом Server Action**, не только через UI — RLS у `section_capacity` нет, серверная проверка единственная.
3. Числа X/Y на отделе, проекте и разделе должны быть согласованы — все три уровня теперь читают один источник.
4. Миграция вью: контрольные числа строк совпали, зависимых объектов нет, но стоит бегло проверить страницы-потребители вью.
