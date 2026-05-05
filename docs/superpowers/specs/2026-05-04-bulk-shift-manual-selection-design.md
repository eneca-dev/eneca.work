# Bulk Shift — выборочное применение по загрузкам

**Модуль:** `modules/departments-timeline`
**Дата:** 2026-05-04
**Статус:** Draft (ожидает review)

## 1. Цель

Расширить функциональность `BulkShiftPopover` (иконка `MoveHorizontal` в шапке отдела). Сейчас операция применяется ко **всем** загрузкам отдела по выбранному проекту. Нужно дать пользователю возможность **выборочно отметить конкретные загрузки** на таймлайне и применить операцию только к ним.

Инвариант сохраняется: одна сессия выбора = `департамент × проект`. Все 4 существующих режима (`both`, `start`, `end`, `set`) применимы к выборочному режиму без изменений.

## 2. Не входит в scope

- Выбор загрузок из нескольких проектов одновременно.
- Выбор загрузок из нескольких отделов одновременно.
- Сохранение выбора между сессиями браузера.
- Изменение существующего auto-discovery режима (полная массовая операция остаётся работать как сейчас).

## 3. UX flow

1. Пользователь кликает по иконке `MoveHorizontal` в шапке отдела → открывается `BulkShiftPopover` (без изменений).
2. Выбирает проект из селекта (без изменений).
3. **Новое:** ставит чекбокс **«Выбрать вручную»** (по умолчанию выключен — старое поведение «все загрузки»).
4. **Новое:** на таймлайне:
   - Loading-bars выбранного проекта становятся **selectable** (cursor pointer, hover-outline).
   - Все остальные bars в этом отделе становятся **dimmed** (opacity 0.25, pointer-events none).
   - Bars в других отделах **не меняются**.
5. Пользователь кликает по bars для toggle-выбора. Каждый клик обновляет счётчик в попе: `Выбрано: N из M`.
6. В попе доступны кнопки `Все` / `Сбросить` рядом со счётчиком.
7. Пользователь выбирает режим операции (`both`/`start`/`end`/`set`) и параметры (дни или диапазон дат) — без изменений.
8. Кнопка `Применить` активна только если `selectedCount > 0` И валидны параметры.
9. После применения — поведение по результату (см. §6 «After Apply»).

## 4. Архитектура

### 4.1. Новый Zustand store

`modules/departments-timeline/stores/bulk-shift-selection-store.ts`

Глобальный store (один на приложение), потому что:
- Только **один отдел** может быть в режиме выбора одновременно (требование Q5.5).
- Состояние нужно читать в нескольких местах (`BulkShiftPopover`, `LoadingBarWithResize`, `EmployeeRow` sidebar).

```ts
interface BulkShiftSelectionState {
  // null = режим выбора неактивен
  activeDepartmentId: string | null
  activeProjectId: string | null
  // ID выбранных загрузок
  selectedLoadingIds: Set<string>

  // Actions
  enter: (departmentId: string, projectId: string) => void
  exit: () => void
  changeProject: (projectId: string) => void  // сбрасывает selectedLoadingIds
  toggle: (loadingId: string) => void
  selectAll: (ids: string[]) => void
  clear: () => void
}
```

Без `persist` — состояние эфемерное.

### 4.2. Изменения в server action `bulkShiftLoadings`

`modules/departments-timeline/actions/index.ts`

Добавить опциональный параметр `loadingIds?: string[]` в `BulkShiftLoadingsInput`:

```ts
export interface BulkShiftLoadingsInput {
  departmentId: string
  projectId: string
  shiftDays: number
  shiftMode: BulkShiftMode
  setStartDate?: string
  setEndDate?: string
  // НОВОЕ: если передано — auto-discovery пропускается, операция применяется только к этим IDs
  loadingIds?: string[]
}
```

Поведение:
- **Если `loadingIds` отсутствует или пустой** → текущая логика (auto-discovery через `view_employee_workloads`).
- **Если `loadingIds` передан** → пропустить шаг 1 (поиск всех подходящих), вместо этого:
  1. Загрузить эти `loading_id` из `view_employee_workloads`, отфильтровав по `final_department_id == departmentId` И `project_id == projectId` И `loading_status == 'active'`.
  2. **Defense-in-depth:** если какой-то `loading_id` не прошёл фильтр (другой отдел / другой проект / неактивен / restricted) — он молча отбрасывается, в `totalFound` не попадает.
  3. Дальнейшая обработка (батчи по 10, расчёт новых дат, skip при `start > finish`) — без изменений.

Permission check (`canBulkShiftDepartment`) и restricted-projects check (`bulkRestrictedIds.includes(projectId)`) применяются как сейчас — на уровне `departmentId × projectId`. Per-loading проверка не нужна, т.к. защита уже на уровне «может ли user bulk-shift этот отдел». Это согласуется с текущей архитектурой.

### 4.3. Изменения в `useBulkShiftLoadings` хуке

Тип `BulkShiftLoadingsInput` уже расширен — никаких изменений в хуке не требуется.

### 4.4. Изменения в `BulkShiftPopover`

`modules/departments-timeline/components/timeline/BulkShiftPopover.tsx`

- Подписка на `useBulkShiftSelectionStore` через селекторы (минимизировать re-renders).
- Новый чекбокс **«Выбрать вручную»** под селектом проекта.
  - Включение: `selectionStore.enter(department.id, selectedProjectId)`. Требует выбранный проект (если проект не выбран — чекбокс disabled с tooltip «Сначала выберите проект»).
  - Выключение: `selectionStore.exit()`.
- Когда режим выбора включён:
  - Под чекбоксом отображается счётчик: `Выбрано: {N} из {M}` (M = `selectedProject.loadingsCount`).
  - Рядом со счётчиком — две `text-button`: `Все` (вызывает `selectAll(allProjectLoadingIds)`) и `Сбросить` (вызывает `clear()`).
  - Кнопка `Применить` disabled если `selectedLoadingIds.size === 0`.
  - В preview-блоке текст меняется: `5 загрузок (из 40) — сдвинуть целиком вперёд на 7 дн.`
- При смене проекта в селекте — если режим выбора активен, вызвать `changeProject(newProjectId)` (сбрасывает `selectedLoadingIds`, меняет `activeProjectId`).
- При закрытии попа (open=false): **режим выбора НЕ сбрасывается** — пользователь может прокрутить таймлайн и снова открыть поп. Сброс только по ESC, по «Применить», по `exit()`.
- При unmount компонента (например, отдел исчез из данных): вызвать `exit()` если этот отдел был активен.
- В `handleShift` — если режим выбора активен, передать `loadingIds: Array.from(selectedLoadingIds)`. После успеха — `selectionStore.exit()`.

#### 4.4.1. Получение списка ID для «Выбрать все»

В попе нужен список **всех** loading IDs выбранного проекта в этом отделе. Источник — данные, по которым попе и так строит `extractProjects(department)`. Добавить функцию `extractProjectLoadingIds(department, projectId): string[]`, которая проходит по `department.teams[].employees[].loadings[]` и возвращает `loading.id` где `loading.projectId === projectId`. Memoize через `useMemo` (зависимости: `department`, `selectedProjectId`).

#### 4.4.2. Поведение Popover при кликах вне

Radix `Popover` по умолчанию закрывается при клике вне. Нужно: клики на loading-bars (которые тоже «вне» попа) **должны переключать выбор**, но не закрывать поп.

Решение — `onInteractOutside` handler в `PopoverContent`:
```tsx
<PopoverContent
  onInteractOutside={(e) => {
    const target = e.target as HTMLElement
    // data-bulk-selectable атрибут на selectable loading bars
    if (target.closest('[data-bulk-selectable="true"]')) {
      e.preventDefault()
    }
  }}
>
```

Loading bar в режиме выбора получает `data-bulk-selectable="true"`. Клик по нему — toggle выбора, поп остаётся открытым. Клик в пустое место таймлайна — поп закрывается, режим сохраняется.

### 4.5. Изменения в `EmployeeRow` / `LoadingBarWithResize`

`modules/departments-timeline/components/timeline/EmployeeRow.tsx`

- Передать новый prop `selectionContext` от `EmployeeRow` к каждому `LoadingBarWithResize`:
  ```ts
  interface SelectionContext {
    isActive: boolean              // режим активен в этом отделе
    activeProjectId: string | null
    isSelected: (loadingId: string) => boolean
    toggle: (loadingId: string) => void
  }
  ```
- В `EmployeeRow` подписаться на store через селектор: `isActive = activeDepartmentId === employee.departmentId`. Это вычисление дешёвое; subscribe только на 2 поля (`activeDepartmentId`, `activeProjectId`). Per-loading подписка делается внутри bar через хелпер.
- В `LoadingBarWithResize`:
  - Вычислить три состояния: `selectable | selected | dimmed | normal`:
    - `normal` — `!isActive` (режим выбора не активен) — текущее поведение.
    - `selectable` — `isActive && bar.period.projectId === activeProjectId && !isSelected`.
    - `selected` — `isActive && bar.period.projectId === activeProjectId && isSelected`.
    - `dimmed` — `isActive && bar.period.projectId !== activeProjectId`.
  - В режиме `selectable`/`selected`:
    - Заменить `onClick` на `(e) => { e.stopPropagation(); toggle(bar.period.id) }`. Не открывать модалку.
    - Отключить scissors mode для этого bar (`isScissorsActive = false`).
    - Отключить resize handles (`canResize = false`).
    - Добавить `data-bulk-selectable="true"`.
    - Для `selected`: `aria-pressed="true"`, для `selectable`: `aria-pressed="false"`. `role="button"`.
  - В режиме `dimmed`:
    - `pointer-events: none` (через CSS).
    - `opacity: 0.25`.
    - Не отображать resize handles, scissors не работает.

### 4.6. Визуальные стили (см. Q4)

Реализуются через Tailwind classes / inline styles:

- **Selectable** (idle):
  - Без визуальных изменений по сравнению с normal.
  - Hover: `outline: 2px dashed var(--primary); outline-offset: 1px`.
- **Selected**:
  - `outline: 2.5px solid var(--primary); outline-offset: 1px`.
  - `filter: brightness(1.2)`.
  - В правом верхнем углу — checkmark icon (lucide `Check`, 12px, в белом круге 16px). Позиционирован абсолютно `top: -6px; right: -6px`. `z-index: 25` (выше resize handles).
- **Dimmed**:
  - `opacity: 0.25`.
  - `pointer-events: none`.
- **Transitions**:
  - `transition: opacity 150ms ease-out, outline-color 100ms ease-out`.

`outline` (а не `border`) — чтобы не сдвигать контент бара. `outline-offset: 1px` визуально отделяет рамку от тела бара.

### 4.7. Sidebar badge сотрудника

`EmployeeRow` sidebar (где аватар + имя): когда режим выбора активен **в этом отделе**, отображать рядом с именем сотрудника маленький badge со счётчиком выбранных загрузок этого сотрудника:

```tsx
{selectionContext.isActive && employeeSelectedCount > 0 && (
  <span className="ml-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold text-primary-foreground">
    {employeeSelectedCount}
  </span>
)}
```

Подсчёт: `employee.loadings?.filter(l => l.projectId === activeProjectId && selectedIds.has(l.id)).length`.

### 4.8. ESC handler

В `BulkShiftPopover` добавить `useEffect` с `keydown` listener на `window` (только когда `selectionStore.activeDepartmentId === department.id`): по ESC вызвать `exit()`. Cleanup в return.

Также Radix Popover сам обрабатывает ESC (закрывает поп). После закрытия попа наш handler ловит ESC снова и сбрасывает режим. Это OK: первое нажатие ESC закроет поп, второе сбросит режим. Альтернативно — сбрасывать режим при том же нажатии ESC, что закрывает поп, через `onEscapeKeyDown` Radix-callback. Возьмём этот вариант — проще и интуитивнее.

```tsx
<PopoverContent
  onEscapeKeyDown={() => {
    if (selectionStore.activeDepartmentId === department.id) {
      selectionStore.exit()
    }
  }}
>
```

### 4.9. Permission gating

Иконка `MoveHorizontal` в `DepartmentRow` уже скрывается через `useCanBulkShiftDepartment(department.id)` — изменений не требуется. Чекбокс «Выбрать вручную» доступен всем, кому доступна эта кнопка (т.е. с `canBulkShiftDepartment`).

## 5. Data flow

```
┌─────────────────────────────────────────────────────────────────┐
│  DepartmentRow                                                   │
│  ├── <BulkShiftPopover department={dept}>                       │
│  │     ├── reads: selectionStore (activeDepartmentId, ids)      │
│  │     ├── writes: enter/exit/toggle/clear/changeProject        │
│  │     └── on Apply: useBulkShiftLoadings.mutate({ ..., loadingIds }) │
│  │                                                               │
│  └── <TeamRow>                                                  │
│       └── <EmployeeRow employee={emp}>                          │
│            ├── reads: selectionStore (subscribed selector)       │
│            └── <LoadingBarWithResize bar={bar} selectionContext>│
│                  ├── reads: isSelected(bar.period.id)           │
│                  └── on click: toggle(bar.period.id)            │
└─────────────────────────────────────────────────────────────────┘

Store updates → subscribed components re-render (only the ones reading changed slices)
```

## 6. After Apply (детально)

После успешного `mutateAsync`:

| Сценарий | Действие |
|----------|---------|
| Все загрузки обновлены (`shiftedCount === totalFound`) | Toast `Сдвинуто N загрузок`. `selectionStore.exit()`. `resetForm()`. `setOpen(false)`. |
| Частичный успех (skipped/failed) | Текущий `partialWarning` блок отображается. `selectionStore.exit()` (выбранные ID уже обработаны). Поп остаётся открытым с warning. `resetForm()` НЕ вызывается. |
| Mutation error (network/auth) | `selectionStore` НЕ сбрасывается. Поп остаётся, ошибка отображается. Пользователь может попробовать снова. |

## 7. Граничные случаи

- **Пользователь выбрал bars, потом отдел исчез из данных** (фильтр / Realtime удалил отдел): в `BulkShiftPopover` `useEffect` cleanup при unmount → `if (activeDepartmentId === department.id) exit()`.
- **Realtime удалил выбранную загрузку**: `selectedLoadingIds` всё ещё содержит этот ID. На сервере он не пройдёт фильтр в §4.2.2 → молчаливо отбрасывается. Корректно.
- **Пользователь сменил проект**: `changeProject(newId)` сбрасывает `selectedLoadingIds`, меняет `activeProjectId`. Bars нового проекта сразу становятся selectable.
- **Пользователь активировал режим выбора в отделе Б, пока активен отдел А**: `enter(deptB, projectId)` перезаписывает `activeDepartmentId` и сбрасывает `selectedLoadingIds`. В отделе А режим автоматически выключается (`isActive = activeDepartmentId === department.id` становится `false`).
- **`selectedProject.loadingsCount === 0`** (проект есть, но все загрузки скрыты по фильтрам): чекбокс «Выбрать вручную» активен, но «Все» ничего не выберет. Это OK, текущий код тоже не отфильтровывает такие проекты из селекта.

## 8. Тестирование (manual checklist)

- [ ] Включение/выключение режима выбора (чекбокс).
- [ ] Чекбокс disabled, если проект не выбран.
- [ ] Клик по бару выбранного проекта → выбран (outline + checkmark).
- [ ] Повторный клик → снят с выбора.
- [ ] Bars других проектов dimmed, не реагируют на клик.
- [ ] Клик по dimmed-бару не открывает модалку.
- [ ] Resize handles скрыты в режиме выбора.
- [ ] Scissors mode не работает в режиме выбора.
- [ ] Кнопки `Все` / `Сбросить` работают.
- [ ] Счётчик в попе обновляется в реальном времени.
- [ ] Badge у сотрудника показывает корректное число.
- [ ] Смена проекта в селекте сбрасывает выбор.
- [ ] ESC закрывает поп И сбрасывает режим.
- [ ] Клик в пустое место таймлайна закрывает поп, режим сохраняется.
- [ ] Активация режима в другом отделе сбрасывает текущий.
- [ ] `Применить` disabled при пустом выборе.
- [ ] Successful apply → toast, режим выключен, поп закрыт.
- [ ] Partial apply → warning, режим выключен.
- [ ] Permissions: пользователь без `canBulkShiftDepartment` не видит иконку.
- [ ] Dark mode: outline и checkmark видны корректно.
- [ ] Accessibility: Tab фокусирует bars, Space/Enter переключает выбор.

## 9. Файлы, которые меняются

| Файл | Тип изменения |
|------|---------------|
| `modules/departments-timeline/stores/bulk-shift-selection-store.ts` | **новый** |
| `modules/departments-timeline/stores/index.ts` | re-export нового store |
| `modules/departments-timeline/actions/index.ts` | расширить `BulkShiftLoadingsInput`, обновить `bulkShiftLoadings` |
| `modules/departments-timeline/components/timeline/BulkShiftPopover.tsx` | основная логика UI |
| `modules/departments-timeline/components/timeline/EmployeeRow.tsx` | подписка на store, передача `selectionContext`, визуальные стили bars, badge у сотрудника |
| `modules/departments-timeline/module.meta.json` | добавить task RG-XXX, обновить changelog |

## 10. Будущие расширения (out of scope, но учтено в архитектуре)

- **Cross-project selection**: store уже может хранить выбор; нужно убрать ограничение `activeProjectId` и обновить server action.
- **Drag-to-select**: можно добавить рамку (как в Figma) — store не нужно менять.
- **Persist selection in URL**: можно добавить через `nuqs` без изменений в store.
