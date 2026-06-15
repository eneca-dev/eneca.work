# Bulk Shift Manual Selection — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Расширить `BulkShiftPopover` чекбоксом «Выбрать вручную», позволяющим пользователю отметить конкретные загрузки на таймлайне (в рамках одного отдела × одного проекта) и применить bulk-операцию только к ним.

**Architecture:** Новый Zustand store `useBulkShiftSelectionStore` хранит `activeDepartmentId / activeProjectId / selectedLoadingIds`. `BulkShiftPopover` управляет режимом и параметрами; `LoadingBarWithResize` подписывается на store, рендерит 3 визуальных состояния (selectable/selected/dimmed) и переключает выбор по клику. Server action `bulkShiftLoadings` расширяется опциональным `loadingIds` — при наличии применяется только к ним (с defense-in-depth фильтром по `departmentId × projectId`).

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript 5, Zustand, TanStack Query (через `modules/cache`), Radix UI Popover, Tailwind 3, Supabase, lucide-react.

**Spec:** [`docs/superpowers/specs/2026-05-04-bulk-shift-manual-selection-design.md`](../specs/2026-05-04-bulk-shift-manual-selection-design.md)

---

## Important conventions

- **No automated tests:** в проекте нет настроенного test runner'а (`package.json` не содержит test scripts). Каждая task завершается **manual verification scenarios** вместо unit-tests. Это явная адаптация TDD-цикла под реальность проекта.
- **No auto-commit:** разработчик коммитит сам. В каждой task есть готовый `git commit` шаблон, но запускать его должен пользователь.
- **No auto-build:** не запускайте `npm run build`/`npm run dev` без явной просьбы. Dev сервер уже запущен у пользователя; HMR обновит изменения автоматически.
- **TypeScript strict:** никаких `any`. Все props и store-state типизированы.
- **File paths:** все пути указаны от корня репозитория `d:/eneca.work/`.

---

## File structure

| Файл | Тип | Ответственность |
|------|-----|-----------------|
| `modules/departments-timeline/stores/bulk-shift-selection-store.ts` | **NEW** | Zustand store для эфемерного состояния выбора |
| `modules/departments-timeline/stores/index.ts` | MODIFY | Re-export нового store |
| `modules/departments-timeline/actions/index.ts` | MODIFY | `BulkShiftLoadingsInput.loadingIds`, фильтрация в `bulkShiftLoadings` |
| `modules/departments-timeline/components/timeline/BulkShiftPopover.tsx` | MODIFY | Чекбокс, счётчик, кнопки `Все`/`Сбросить`, ESC, передача `loadingIds` |
| `modules/departments-timeline/components/timeline/EmployeeRow.tsx` | MODIFY | Подписка на store, передача `selectionContext` в bars, визуальные состояния, badge у сотрудника |
| `modules/departments-timeline/module.meta.json` | MODIFY | Новая task DT-002 + changelog 1.3.0 |

---

## Task 1: Create selection store

**Files:**
- Create: `modules/departments-timeline/stores/bulk-shift-selection-store.ts`

- [ ] **Step 1: Создать файл со store**

```ts
/**
 * Bulk Shift Selection Store
 *
 * Эфемерное состояние режима выборочного применения bulk-shift:
 * - какой отдел сейчас в режиме выбора
 * - какой проект выбран (scope)
 * - какие loading_id отмечены пользователем
 *
 * Только один отдел может быть в режиме выбора одновременно.
 * Не персистится — состояние теряется при перезагрузке страницы (by design).
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface BulkShiftSelectionState {
  /** ID отдела в режиме выбора. null = режим неактивен */
  activeDepartmentId: string | null
  /** ID проекта-скоупа выбора. null если режим неактивен */
  activeProjectId: string | null
  /** Отмеченные loading_id */
  selectedLoadingIds: Set<string>

  // Actions
  /** Войти в режим выбора для конкретной пары отдел × проект */
  enter: (departmentId: string, projectId: string) => void
  /** Выйти из режима, очистить выбор */
  exit: () => void
  /** Сменить scope-проект (сбрасывает выбор) */
  changeProject: (projectId: string) => void
  /** Toggle одной загрузки */
  toggle: (loadingId: string) => void
  /** Заменить весь выбор переданным набором */
  selectAll: (ids: string[]) => void
  /** Снять весь выбор (но остаться в режиме) */
  clear: () => void
}

export const useBulkShiftSelectionStore = create<BulkShiftSelectionState>()(
  devtools(
    (set) => ({
      activeDepartmentId: null,
      activeProjectId: null,
      selectedLoadingIds: new Set(),

      enter: (departmentId, projectId) =>
        set({
          activeDepartmentId: departmentId,
          activeProjectId: projectId,
          selectedLoadingIds: new Set(),
        }),

      exit: () =>
        set({
          activeDepartmentId: null,
          activeProjectId: null,
          selectedLoadingIds: new Set(),
        }),

      changeProject: (projectId) =>
        set({
          activeProjectId: projectId,
          selectedLoadingIds: new Set(),
        }),

      toggle: (loadingId) =>
        set((state) => {
          const next = new Set(state.selectedLoadingIds)
          if (next.has(loadingId)) {
            next.delete(loadingId)
          } else {
            next.add(loadingId)
          }
          return { selectedLoadingIds: next }
        }),

      selectAll: (ids) =>
        set({ selectedLoadingIds: new Set(ids) }),

      clear: () =>
        set({ selectedLoadingIds: new Set() }),
    }),
    { name: 'BulkShiftSelection' }
  )
)
```

- [ ] **Step 2: Re-export из stores/index.ts**

В файле `modules/departments-timeline/stores/index.ts` в конец файла добавить:

```ts
// ============================================================================
// Bulk Shift Selection Store
// ============================================================================

export { useBulkShiftSelectionStore } from './bulk-shift-selection-store'
```

- [ ] **Step 3: Manual verification**

В DevTools:
1. Открыть страницу таймлайна.
2. Открыть Redux DevTools (Zustand интегрирован через `devtools`) → найти `BulkShiftSelection`.
3. В консоли: `useBulkShiftSelectionStore.getState()` → должно быть `{ activeDepartmentId: null, activeProjectId: null, selectedLoadingIds: Set(0) }`.
4. `useBulkShiftSelectionStore.getState().enter('d1', 'p1')` → DevTools покажет переход в `enter`.
5. `useBulkShiftSelectionStore.getState().toggle('l1')` → `selectedLoadingIds` содержит `'l1'`.

- [ ] **Step 4: Commit**

```bash
git add modules/departments-timeline/stores/bulk-shift-selection-store.ts modules/departments-timeline/stores/index.ts
git commit -m "feat(departments-timeline): add bulk shift selection store"
```

---

## Task 2: Extend `bulkShiftLoadings` server action with `loadingIds`

**Files:**
- Modify: `modules/departments-timeline/actions/index.ts`

- [ ] **Step 1: Расширить `BulkShiftLoadingsInput` типом**

В файле `modules/departments-timeline/actions/index.ts` найти интерфейс `BulkShiftLoadingsInput` (≈ строка 803) и добавить поле `loadingIds`:

```ts
export interface BulkShiftLoadingsInput {
  departmentId: string
  projectId: string
  shiftDays: number // положительное = вперёд, отрицательное = назад (для mode both/start/end)
  shiftMode: BulkShiftMode
  // Для mode 'set' — конкретные даты (YYYY-MM-DD)
  setStartDate?: string
  setEndDate?: string
  /**
   * Опционально: явный список loading_id для применения операции.
   * Если передан и не пуст — auto-discovery пропускается, и операция применяется только к этим IDs
   * (с defense-in-depth фильтром по departmentId × projectId × loading_status='active').
   * Если не передан или пуст — поведение как раньше (все загрузки отдела по проекту).
   */
  loadingIds?: string[]
}
```

- [ ] **Step 2: Модифицировать функцию `bulkShiftLoadings` — фильтрация при наличии `loadingIds`**

Найти участок кода с запросом `matchingLoadings` (≈ строка 900):

```ts
    // 1. Находим все подходящие загрузки через view_employee_workloads
    const { data: matchingLoadings, error: queryError } = await supabase
      .from('view_employee_workloads')
      .select('loading_id, loading_start, loading_finish')
      .eq('final_department_id', input.departmentId)
      .eq('project_id', input.projectId)
      .eq('loading_status', 'active')
      .not('loading_id', 'is', null)
```

Заменить на:

```ts
    // 1. Находим подходящие загрузки через view_employee_workloads
    // - Если передан явный loadingIds → фильтруем по нему (defense-in-depth: + dept × project × active)
    // - Иначе → все активные загрузки отдела по проекту (legacy auto-discovery)
    const explicitIds = input.loadingIds && input.loadingIds.length > 0
      ? input.loadingIds
      : null

    let baseQuery = supabase
      .from('view_employee_workloads')
      .select('loading_id, loading_start, loading_finish')
      .eq('final_department_id', input.departmentId)
      .eq('project_id', input.projectId)
      .eq('loading_status', 'active')
      .not('loading_id', 'is', null)

    if (explicitIds) {
      baseQuery = baseQuery.in('loading_id', explicitIds)
    }

    const { data: matchingLoadings, error: queryError } = await baseQuery
```

- [ ] **Step 3: Обновить Sentry-теги для трассировки нового параметра**

Найти `Sentry.startSpan({ name: 'bulkShiftLoadings', op: 'db.mutation', attributes: { ... } }` (≈ строка 836) и расширить `attributes`:

```ts
  return Sentry.startSpan(
    {
      name: 'bulkShiftLoadings',
      op: 'db.mutation',
      attributes: {
        'department.id': input.departmentId,
        'project.id': input.projectId,
        'shift.days': input.shiftDays,
        'shift.mode': input.shiftMode,
        'shift.explicit_ids_count': input.loadingIds?.length ?? 0,
      },
    },
    async () => {
```

- [ ] **Step 4: Проверка типов**

Запустить:

```bash
npx tsc --noEmit -p .
```

Ожидаемо: компиляция проходит без новых ошибок.

(Если tsc выдаёт уже существующие ошибки в других файлах — игнорируем, главное чтобы наши изменения не добавили новых.)

- [ ] **Step 5: Manual verification**

1. В DevTools Network → SQL логи: вызвать существующий bulk-shift (без `loadingIds`) → запрос должен идти по всем загрузкам отдела по проекту (как раньше).
2. В консоли вручную (предварительно импортировав хук и взяв из view_employee_workloads пару loading_id):
   ```ts
   // Через React Query DevTools запустить мутацию вручную, передав { loadingIds: ['<id1>', '<id2>'] }
   ```
   Запрос должен вернуть `totalFound === 2`, `shiftedCount === 2`.
3. Передать заведомо чужой `loading_id` (из другого отдела) → defense-in-depth должен его отбросить (не попадёт в `matchingLoadings`, `totalFound` соответственно меньше).

- [ ] **Step 6: Commit**

```bash
git add modules/departments-timeline/actions/index.ts
git commit -m "feat(departments-timeline): support explicit loadingIds in bulkShiftLoadings"
```

---

## Task 3: Add helper `extractProjectLoadingIds` in `BulkShiftPopover.tsx`

**Files:**
- Modify: `modules/departments-timeline/components/timeline/BulkShiftPopover.tsx`

- [ ] **Step 1: Добавить функцию рядом с `extractProjects`**

В файле `modules/departments-timeline/components/timeline/BulkShiftPopover.tsx` после функции `extractProjects` (≈ после строки 92) добавить:

```ts
/**
 * Возвращает все loading_id указанного проекта в данном отделе.
 * Используется для кнопки «Все» в режиме выборочного применения.
 */
function extractProjectLoadingIds(department: Department, projectId: string): string[] {
  const ids: string[] = []
  for (const team of department.teams) {
    for (const employee of team.employees) {
      for (const loading of employee.loadings ?? []) {
        if (loading.projectId === projectId) {
          ids.push(loading.id)
        }
      }
    }
  }
  return ids
}
```

- [ ] **Step 2: Manual verification**

Это helper без побочных эффектов. На этом этапе он не используется. Проверка типов:

```bash
npx tsc --noEmit -p .
```

Ожидаемо: компиляция проходит.

- [ ] **Step 3: Commit**

```bash
git add modules/departments-timeline/components/timeline/BulkShiftPopover.tsx
git commit -m "feat(departments-timeline): add extractProjectLoadingIds helper"
```

---

## Task 4: Add manual-selection UI to `BulkShiftPopover` (checkbox + counter + Все/Сбросить)

**Files:**
- Modify: `modules/departments-timeline/components/timeline/BulkShiftPopover.tsx`

- [ ] **Step 1: Добавить импорты**

В верх файла добавить импорт store, Checkbox UI и icon:

```ts
import { Checkbox } from '@/components/ui/checkbox'
import { useBulkShiftSelectionStore } from '../../stores'
```

(Если `Checkbox` уже не существует в `@/components/ui/checkbox` — проверить shadcn компонент: он стандартный shadcn/ui, см. соседние модули. Если отсутствует, спросить пользователя перед добавлением.)

- [ ] **Step 2: Внутри компонента подписаться на store через селекторы**

В начале функции `BulkShiftPopover` (после `const bulkShiftMutation = useBulkShiftLoadings()`):

```ts
  // Подписка на selection store через узкие селекторы — минимизируем re-renders
  const isSelectionActiveForThisDept = useBulkShiftSelectionStore(
    (s) => s.activeDepartmentId === department.id
  )
  const selectionStoreActiveProjectId = useBulkShiftSelectionStore((s) => s.activeProjectId)
  const selectedLoadingIds = useBulkShiftSelectionStore((s) => s.selectedLoadingIds)
  const enterSelection = useBulkShiftSelectionStore((s) => s.enter)
  const exitSelection = useBulkShiftSelectionStore((s) => s.exit)
  const changeSelectionProject = useBulkShiftSelectionStore((s) => s.changeProject)
  const selectAllSelection = useBulkShiftSelectionStore((s) => s.selectAll)
  const clearSelection = useBulkShiftSelectionStore((s) => s.clear)

  const isManualMode = isSelectionActiveForThisDept
  const selectedCount = isManualMode ? selectedLoadingIds.size : 0

  // Все loading_id выбранного проекта в отделе (для кнопки «Все»)
  const projectLoadingIds = useMemo(
    () => (selectedProjectId ? extractProjectLoadingIds(department, selectedProjectId) : []),
    [department, selectedProjectId]
  )
```

- [ ] **Step 3: Обновить логику смены проекта**

Найти `<Select value={selectedProjectId} onValueChange={setSelectedProjectId}>` (≈ строка 222) и заменить `onValueChange` на:

```tsx
            <Select
              value={selectedProjectId}
              onValueChange={(newProjectId) => {
                setSelectedProjectId(newProjectId)
                // Если режим выбора активен — переключить scope на новый проект (сбрасывает выбор)
                if (isSelectionActiveForThisDept && newProjectId !== selectionStoreActiveProjectId) {
                  changeSelectionProject(newProjectId)
                }
              }}
            >
```

- [ ] **Step 4: Добавить чекбокс «Выбрать вручную»**

После блока с `<Select>` для проекта (закрывающий `</div>` после строки ≈237) добавить новый блок:

```tsx
          {/* Чекбокс «Выбрать вручную» */}
          <div className="flex items-start gap-2">
            <Checkbox
              id={`bulk-shift-manual-${department.id}`}
              checked={isManualMode}
              disabled={!selectedProjectId}
              onCheckedChange={(checked) => {
                if (checked && selectedProjectId) {
                  enterSelection(department.id, selectedProjectId)
                } else {
                  exitSelection()
                }
              }}
              className="mt-0.5"
            />
            <div className="flex-1 space-y-1.5">
              <Label
                htmlFor={`bulk-shift-manual-${department.id}`}
                className={cn(
                  'text-xs cursor-pointer leading-tight',
                  !selectedProjectId && 'text-muted-foreground cursor-not-allowed'
                )}
              >
                Выбрать вручную
                {!selectedProjectId && (
                  <span className="block text-[10px] text-muted-foreground mt-0.5">
                    Сначала выберите проект
                  </span>
                )}
              </Label>

              {isManualMode && selectedProject && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-muted-foreground">
                    Выбрано: <span className="font-medium text-foreground tabular-nums">{selectedCount}</span>
                    {' из '}
                    <span className="tabular-nums">{selectedProject.loadingsCount}</span>
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => selectAllSelection(projectLoadingIds)}
                      className="text-[11px] text-primary hover:underline"
                    >
                      Все
                    </button>
                    <span className="text-[11px] text-muted-foreground">·</span>
                    <button
                      type="button"
                      onClick={() => clearSelection()}
                      className="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
                    >
                      Сбросить
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
```

- [ ] **Step 5: Обновить `isValid` для учёта режима выбора**

Найти строку `const isValid = selectedProjectId && (...)` (≈ строка 117) и заменить на:

```ts
  const isValid = selectedProjectId && (
    isSetMode
      ? setStartDate && setEndDate && setStartDate <= setEndDate
      : !isNaN(daysNum) && daysNum !== 0
  ) && (!isManualMode || selectedCount > 0)
```

- [ ] **Step 6: Обновить preview-блок** (показывать сколько именно выбрано)

Найти блок:
```tsx
          {selectedProject && (directionLabel || (isSetMode && setStartDate && setEndDate)) && (
            <div className="rounded-md bg-muted px-3 py-2 text-xs">
              <span className="font-medium">{selectedProject.loadingsCount}</span>{' '}
              {loadingsWord}
              ...
```

(≈ строка 285) — заменить `selectedProject.loadingsCount` и `loadingsWord` логику на динамическую:

```tsx
          {selectedProject && (directionLabel || (isSetMode && setStartDate && setEndDate)) && (() => {
            const effectiveCount = isManualMode ? selectedCount : selectedProject.loadingsCount
            const effectiveWord = effectiveCount === 1 ? 'загрузка' : effectiveCount < 5 ? 'загрузки' : 'загрузок'
            return (
              <div className="rounded-md bg-muted px-3 py-2 text-xs">
                <span className="font-medium tabular-nums">{effectiveCount}</span>{' '}
                {effectiveWord}
                {isManualMode && (
                  <span className="text-muted-foreground"> (из {selectedProject.loadingsCount})</span>
                )}
                {isSetMode ? (
                  <> — даты будут заменены на{' '}
                    <span className="font-medium">{setStartDate} — {setEndDate}</span>
                  </>
                ) : (
                  <>
                    {' — '}
                    {SHIFT_MODE_LABELS[shiftMode].toLowerCase()}{' '}
                    <span className="font-medium">{directionLabel}</span>
                  </>
                )}
              </div>
            )
          })()}
```

(Старые `const loadingsWord = ...` (≈ строка 174) можно оставить или удалить — он больше не используется в JSX. Удалить для чистоты.)

- [ ] **Step 7: Manual verification**

1. Открыть таймлайн отделов, нажать иконку bulk-shift в шапке любого отдела.
2. Чекбокс «Выбрать вручную» **disabled**, надпись «Сначала выберите проект».
3. Выбрать проект → чекбокс становится активным.
4. Поставить чекбокс → счётчик появляется: `Выбрано: 0 из N`. Кнопки `Все` / `Сбросить` видны.
5. Нажать `Все` → счётчик становится `N из N` (но визуально на таймлайне ещё ничего не меняется — это будет в Task 7).
6. Нажать `Сбросить` → счётчик `0 из N`.
7. Сменить проект в селекте → счётчик показывает уже `0 из M` (для нового проекта).
8. Снять чекбокс → блок счётчика исчезает.
9. Проверить что кнопка `Применить` disabled при `selectedCount === 0` в режиме manual.

- [ ] **Step 8: Commit**

```bash
git add modules/departments-timeline/components/timeline/BulkShiftPopover.tsx
git commit -m "feat(departments-timeline): add manual selection UI to BulkShiftPopover"
```

---

## Task 5: Wire `BulkShiftPopover` Apply with `loadingIds`, ESC, outside-click handling

**Files:**
- Modify: `modules/departments-timeline/components/timeline/BulkShiftPopover.tsx`

- [ ] **Step 1: Передавать `loadingIds` в `mutateAsync`**

Найти вызов `bulkShiftMutation.mutateAsync({ ... })` в `handleShift` (≈ строка 136) и обновить:

```ts
      const result = await bulkShiftMutation.mutateAsync({
        departmentId: department.id,
        projectId: selectedProjectId,
        shiftDays: isSetMode ? 0 : daysNum,
        shiftMode,
        ...(isSetMode && { setStartDate, setEndDate }),
        ...(isManualMode && { loadingIds: Array.from(selectedLoadingIds) }),
      })
```

- [ ] **Step 2: Сбрасывать режим выбора после успешного apply**

В том же `handleShift` найти блок `else { resetForm(); setOpen(false) }` (≈ строка 156) и заменить на:

```ts
      if (result.skippedCount > 0 || result.shiftedCount < result.totalFound) {
        // Частичный успех — оставляем поп открытым с warning, но режим выбора сбрасываем
        const parts: string[] = []
        if (result.skippedCount > 0) {
          parts.push(`${result.skippedCount} пропущено (начало оказалось позже конца)`)
        }
        const failedCount = result.totalFound - result.shiftedCount - result.skippedCount
        if (failedCount > 0) {
          parts.push(`${failedCount} не удалось обновить`)
        }
        setPartialWarning(
          `Обновлено ${result.shiftedCount} из ${result.totalFound}. ${parts.join(', ')}.`
        )
        if (isManualMode) {
          exitSelection()
        }
      } else {
        // Полный успех
        if (isManualMode) {
          exitSelection()
        }
        resetForm()
        setOpen(false)
      }
```

- [ ] **Step 3: Cleanup при unmount компонента**

Перед `return` компонента (после `if (projects.length === 0) return null`) добавить useEffect:

```ts
  // Cleanup: если этот отдел был в режиме выбора и компонент unmount'ится — сбросить режим
  // (например, отдел исчез из-за фильтра)
  useEffect(() => {
    return () => {
      // Берём актуальное значение через .getState() (а не из замыкания), чтобы избежать stale state
      const current = useBulkShiftSelectionStore.getState()
      if (current.activeDepartmentId === department.id) {
        current.exit()
      }
    }
  }, [department.id])
```

(Не забыть импорт `useEffect` из `'react'`. Скорее всего уже импортирован.)

- [ ] **Step 4: Обработка ESC и outside-click в Popover**

Найти `<PopoverContent ...>` (≈ строка 206) и добавить два callback'а:

```tsx
      <PopoverContent
        className="w-80"
        align="start"
        side="bottom"
        onClick={(e) => e.stopPropagation()}
        onEscapeKeyDown={() => {
          // ESC закрывает поп (default Radix), и одновременно сбрасывает режим выбора
          if (isSelectionActiveForThisDept) {
            exitSelection()
          }
        }}
        onInteractOutside={(e) => {
          // В режиме выбора: клик по selectable bar НЕ должен закрывать поп
          const target = e.target as HTMLElement | null
          if (isSelectionActiveForThisDept && target?.closest('[data-bulk-selectable="true"]')) {
            e.preventDefault()
          }
        }}
      >
```

- [ ] **Step 5: Manual verification**

1. Включить режим выбора, выбрать вручную несколько `loading_id` через DevTools (поскольку UI bars ещё не реагируют — Task 7):
   ```ts
   useBulkShiftSelectionStore.getState().selectAll(['<id1>', '<id2>'])
   ```
2. Заполнить параметры, нажать `Применить` → bulk-shift применяется только к этим двум.
3. После успеха: режим выбора сброшен (`activeDepartmentId === null`), поп закрыт.
4. Открыть поп заново, включить режим выбора, нажать `Esc` → поп закрылся И режим сброшен.
5. Открыть поп, включить режим, нажать вне попа на пустую область → поп закрылся, но `useBulkShiftSelectionStore.getState().activeDepartmentId === department.id` (режим сохранён). _Замечание_: пока нет `data-bulk-selectable` на bars, любой клик вне будет закрывать; это OK на этом этапе.
6. Зайти на страницу из другой вкладки или сменить фильтр так, чтобы отдел исчез → режим должен сброситься (`activeDepartmentId === null`).

- [ ] **Step 6: Commit**

```bash
git add modules/departments-timeline/components/timeline/BulkShiftPopover.tsx
git commit -m "feat(departments-timeline): wire bulk shift Apply with loadingIds and selection lifecycle"
```

---

## Task 6: Pass `selectionContext` from `EmployeeRow` to `LoadingBarWithResize`

**Files:**
- Modify: `modules/departments-timeline/components/timeline/EmployeeRow.tsx`

- [ ] **Step 1: Добавить импорт store**

В верх файла добавить:

```ts
import { useBulkShiftSelectionStore } from '../../stores'
```

- [ ] **Step 2: Определить тип `SelectionContext`**

После импортов и перед `interface EmployeeRowProps` добавить:

```ts
/**
 * Контекст режима выборочного bulk-shift, передаётся в loading bars.
 * isActive=true означает что для этого отдела пользователь активировал режим выбора;
 * bars должны рендерить selectable / selected / dimmed состояния и переключать выбор по клику.
 */
interface SelectionContext {
  isActive: boolean
  activeProjectId: string | null
  isSelected: (loadingId: string) => boolean
  toggle: (loadingId: string) => void
}
```

- [ ] **Step 3: В `EmployeeRow` подписаться на store и собрать `selectionContext`**

Внутри функции `EmployeeRow` (после хуков `useCanEditLoading`, `useUpdateLoadingDates`, `useLoadingMutations`):

```ts
  // Selection mode context (для bulk-shift с выбором)
  const isSelectionActive = useBulkShiftSelectionStore(
    (s) => s.activeDepartmentId === employee.departmentId && employee.departmentId !== undefined
  )
  const selectionActiveProjectId = useBulkShiftSelectionStore((s) => s.activeProjectId)
  const selectionToggle = useBulkShiftSelectionStore((s) => s.toggle)
  // Set читаем напрямую — для isSelected() callback. Re-render произойдёт при изменении Set,
  // т.к. store создаёт новый Set в toggle/clear/selectAll/changeProject.
  const selectedIds = useBulkShiftSelectionStore((s) => s.selectedLoadingIds)

  const selectionContext = useMemo<SelectionContext>(
    () => ({
      isActive: isSelectionActive,
      activeProjectId: selectionActiveProjectId,
      isSelected: (loadingId: string) => selectedIds.has(loadingId),
      toggle: selectionToggle,
    }),
    [isSelectionActive, selectionActiveProjectId, selectedIds, selectionToggle]
  )
```

- [ ] **Step 4: Расширить `LoadingBarWithResizeProps`**

Найти `interface LoadingBarWithResizeProps` (≈ строка 61) и добавить поле:

```ts
interface LoadingBarWithResizeProps {
  bar: ReturnType<typeof calculateBarRenders>[0]
  barRenders: ReturnType<typeof calculateBarRenders>
  timeUnits: TimelineUnit[]
  timelineRange: TimelineRange
  onLoadingClick: (loading: Loading) => void
  onLoadingResize: (loadingId: string, startDate: string, finishDate: string) => void
  onSplitLoading: (loadingId: string, splitDate: string) => void
  /** Может ли юзер редактировать загрузки этого сотрудника (drag/scissors) */
  canEdit: boolean
  /** Контекст режима выбора bulk-shift (если активен в этом отделе) */
  selectionContext: SelectionContext
}
```

И в сигнатуре функции `LoadingBarWithResize` добавить деструктуризацию:

```ts
function LoadingBarWithResize({
  bar,
  barRenders,
  timeUnits,
  timelineRange,
  onLoadingClick,
  onLoadingResize,
  onSplitLoading,
  canEdit,
  selectionContext,
}: LoadingBarWithResizeProps) {
```

- [ ] **Step 5: Передавать `selectionContext` в каждый bar**

В `EmployeeRow` найти `<LoadingBarWithResize ... />` (≈ строка 743) и добавить prop:

```tsx
                {barRenders.map((bar, idx) => (
                  <LoadingBarWithResize
                    key={`${bar.period.id}-${idx}`}
                    bar={bar}
                    barRenders={barRenders}
                    timeUnits={timeUnits}
                    timelineRange={timelineRange}
                    onLoadingClick={handleLoadingClick}
                    onLoadingResize={handleLoadingResize}
                    onSplitLoading={handleSplitLoading}
                    canEdit={canEdit}
                    selectionContext={selectionContext}
                  />
                ))}
```

- [ ] **Step 6: Manual verification**

1. Запустить страницу.
2. Включить режим выбора в отделе через DevTools:
   ```ts
   useBulkShiftSelectionStore.getState().enter('<departmentId>', '<projectId>')
   ```
3. Открыть React DevTools → найти `EmployeeRow` для сотрудника этого отдела → props должны содержать обновлённый `selectionContext.isActive === true`.
4. Сменить отдел в store → `isActive` стал `false`.

(Визуальные изменения bars — следующая task.)

- [ ] **Step 7: Commit**

```bash
git add modules/departments-timeline/components/timeline/EmployeeRow.tsx
git commit -m "feat(departments-timeline): pass selection context to loading bars"
```

---

## Task 7: Implement selectable / selected / dimmed visual states in `LoadingBarWithResize`

**Files:**
- Modify: `modules/departments-timeline/components/timeline/EmployeeRow.tsx`

- [ ] **Step 1: Импортировать `Check` icon**

В строке импорта `lucide-react` (≈ строка 11) добавить `Check`:

```ts
import { FolderKanban, Building2, MessageSquare, UserPlus, Check } from 'lucide-react'
```

- [ ] **Step 2: Вычислить state в `LoadingBarWithResize`**

В начале функции `LoadingBarWithResize` (после `const textRef = useRef...` блоков, ≈ перед `const canResize = ...`):

```ts
  // Bulk-shift selection state для этого bar
  const isLoadingType = bar.period.type === 'loading'
  const barProjectId = isLoadingType ? bar.period.projectId : undefined

  type SelectionState = 'normal' | 'selectable' | 'selected' | 'dimmed'
  const selectionState: SelectionState = !selectionContext.isActive
    ? 'normal'
    : !isLoadingType
      ? 'dimmed' // не-loading периоды (placeholder/leave/etc) тоже приглушаем
      : barProjectId === selectionContext.activeProjectId
        ? selectionContext.isSelected(bar.period.id) ? 'selected' : 'selectable'
        : 'dimmed'

  const isInSelectionMode = selectionState === 'selectable' || selectionState === 'selected'
  const isDimmed = selectionState === 'dimmed'
```

- [ ] **Step 3: Отключить resize и scissors в режиме выбора**

Найти строку `const canResize = bar.period.type === 'loading' && canEdit` (≈ строка 90) и обновить:

```ts
  // Resize доступен только для loading (не для других типов периодов)
  // И только если у юзера есть права на редактирование
  // И НЕ в режиме выбора (выбор имеет приоритет над редактированием)
  const canResize = bar.period.type === 'loading' && canEdit && !selectionContext.isActive
```

Найти `const isScissorsActive = useScissorsModeStore((s) => s.isActive) && canEdit` (≈ строка 121) и обновить:

```ts
  // Scissors mode — активен только если у юзера есть права на редактирование
  // И НЕ в режиме выбора bulk-shift
  const isScissorsActive = useScissorsModeStore((s) => s.isActive) && canEdit && !selectionContext.isActive
```

- [ ] **Step 4: Подменить click handler в режиме выбора**

Найти `handleClick` callback (≈ строка 136). Создать рядом второй handler для selection и развести вызовы. Заменить весь блок:

```ts
  // Обработчик клика с проверкой wasRecentlyDragging
  const handleClick = useCallback(() => {
    if (bar.period.type !== 'loading') return
    if (isScissorsActive) return // Scissors mode — не открываем модалку

    // Не открываем модалку если только что закончили drag
    if (wasRecentlyDragging()) return

    // BarPeriod содержит все необходимые поля Loading; startDate/endDate - Date объекты,
    // модал (useLoadingModal) обрабатывает оба варианта (string и Date)
    onLoadingClick(bar.period as unknown as Loading)
  }, [bar.period, onLoadingClick, wasRecentlyDragging, isScissorsActive])
```

на:

```ts
  // Обработчик клика — в режиме выбора toggle, иначе открытие модалки
  const handleClick = useCallback(() => {
    if (bar.period.type !== 'loading') return

    // В режиме выбора bulk-shift: клик переключает выбор (если bar selectable/selected)
    if (isInSelectionMode) {
      selectionContext.toggle(bar.period.id)
      return
    }

    if (isScissorsActive) return // Scissors mode — не открываем модалку
    if (wasRecentlyDragging()) return

    onLoadingClick(bar.period as unknown as Loading)
  }, [bar.period, onLoadingClick, wasRecentlyDragging, isScissorsActive, isInSelectionMode, selectionContext])
```

- [ ] **Step 5: Применить визуальные стили к main bar div**

Найти главный `<div ...>` bar'а (≈ строка 183) с `className={cn('absolute pointer-events-auto flex items-center', ...)`. Заменить блок className/style:

```tsx
      <div
        className={cn(
          'absolute pointer-events-auto flex items-center',
          !isResizing && 'transition-all duration-200',
          // Cursor / hover поведение в зависимости от состояния
          bar.period.type === 'loading' && !isScissorsActive && !isDimmed && 'cursor-pointer hover:brightness-110',
          isScissorsActive && bar.period.type === 'loading' && 'cursor-col-resize',
          isResizing && 'ring-2 ring-primary/50 z-50',
          // Selection mode стили
          selectionState === 'selectable' && 'hover:outline hover:outline-2 hover:outline-dashed hover:outline-primary hover:outline-offset-1',
          selectionState === 'selected' && 'outline outline-[2.5px] outline-solid outline-primary outline-offset-1',
          selectionState === 'dimmed' && 'pointer-events-none',
        )}
        style={{
          left: displayLeft,
          width: displayWidth,
          height: BASE_BAR_HEIGHT,
          top,
          backgroundColor: bar.color,
          opacity: isDimmed ? 0.25 : selectionState === 'selected' ? 0.9 : 0.8,
          border: `2px solid ${bar.color}`,
          paddingLeft: 6,
          paddingRight: 6,
          overflow: 'hidden',
          filter: selectionState === 'selected' ? 'brightness(1.2)' : 'brightness(1.1)',
          borderTopLeftRadius: 4,
          borderTopRightRadius: 4,
          borderBottomLeftRadius: bar.period.comment ? 0 : 4,
          borderBottomRightRadius: bar.period.comment ? 0 : 4,
          // В selection mode переопределяем transition только для opacity/outline,
          // чтобы не интерферировать с анимациями resize/positioning.
          // Вне selection mode полагаемся на className `transition-all duration-200`.
          ...(selectionContext.isActive && {
            transition: 'opacity 150ms ease-out, outline-color 100ms ease-out',
          }),
        }}
        title={formatBarTooltip(bar.period)}
        data-bulk-selectable={isInSelectionMode ? 'true' : undefined}
        role={isInSelectionMode ? 'button' : undefined}
        aria-pressed={selectionState === 'selected' ? true : selectionState === 'selectable' ? false : undefined}
        tabIndex={isInSelectionMode ? 0 : undefined}
        onKeyDown={isInSelectionMode ? (e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault()
            selectionContext.toggle(bar.period.id)
          }
        } : undefined}
        onClick={isScissorsActive ? scissors.handlers.onClick : handleClick}
        onMouseMove={scissors.handlers.onMouseMove}
        onMouseLeave={scissors.handlers.onMouseLeave}
      >
```

- [ ] **Step 6: Добавить checkmark indicator для selected**

Внутри главного bar div, **после** блока с `{/* Scissors cut line */}` и до `{/* Resize handles ... */}` (≈ строка 227), добавить:

```tsx
        {/* Bulk-shift selected checkmark indicator */}
        {selectionState === 'selected' && (
          <div
            className="absolute -top-[6px] -right-[6px] flex h-4 w-4 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-primary"
            style={{ zIndex: 25 }}
          >
            <Check size={11} className="text-primary" strokeWidth={3} />
          </div>
        )}
```

- [ ] **Step 7: Manual verification**

1. Открыть страницу таймлайна, развернуть отдел до сотрудников.
2. Открыть BulkShiftPopover в отделе, выбрать проект, поставить «Выбрать вручную».
3. **Bars выбранного проекта** в этом отделе:
   - Курсор `pointer`, при hover видна dashed outline primary-цвета.
   - Клик → bar выделен solid primary outline + checkmark в правом верхнем углу. Счётчик в попе вырос.
   - Повторный клик → выделение снято.
4. **Bars других проектов** в этом отделе:
   - Полупрозрачные (opacity 0.25), не реагируют на клик / hover.
5. **Bars в других отделах** (не активных в режиме выбора): выглядят и ведут себя как обычно.
6. Resize handles НЕ показываются на bars выбранного проекта в режиме выбора.
7. Включить scissors mode (ножницы) → в отделе с активным режимом выбора ножницы НЕ работают на bars.
8. Нажать `Все` в попе → все bars выбранного проекта получили selected outline + checkmark.
9. Проверить dark mode — outline и checkmark видны, контрастны.
10. Tab по странице — bars в режиме выбора фокусируются (видна focus-ring), Space/Enter переключает выбор.
11. Clip on edges (bars обрезанные timeline range) — outline и checkmark позиционированы корректно (могут чуть выходить за viewport — это OK).

- [ ] **Step 8: Commit**

```bash
git add modules/departments-timeline/components/timeline/EmployeeRow.tsx
git commit -m "feat(departments-timeline): add selectable/selected/dimmed states to loading bars"
```

---

## Task 8: Add per-employee selection count badge in sidebar

**Files:**
- Modify: `modules/departments-timeline/components/timeline/EmployeeRow.tsx`

- [ ] **Step 1: Вычислить `employeeSelectedCount`**

В функции `EmployeeRow` после блока с `selectionContext` (Task 6, Step 3) добавить:

```ts
  // Сколько загрузок этого сотрудника выбрано в текущем режиме bulk-shift
  const employeeSelectedCount = useMemo(() => {
    if (!isSelectionActive || !selectionActiveProjectId) return 0
    let count = 0
    for (const loading of employee.loadings ?? []) {
      if (loading.projectId === selectionActiveProjectId && selectedIds.has(loading.id)) {
        count++
      }
    }
    return count
  }, [isSelectionActive, selectionActiveProjectId, selectedIds, employee.loadings])
```

- [ ] **Step 2: Отрендерить badge в сайдбаре сотрудника**

Найти блок имени сотрудника (≈ строка 675):

```tsx
              <div className="flex items-center gap-1">
                <span className="text-xs font-medium truncate">
                  {employee.fullName || employee.name || 'Не указан'}
                </span>
                {isTeamLead && (
                  <span className="inline-flex items-center justify-center rounded-sm text-[10px] px-1 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300">
                    ★
                  </span>
                )}
              </div>
```

После `{isTeamLead && ...}` добавить badge:

```tsx
              <div className="flex items-center gap-1">
                <span className="text-xs font-medium truncate">
                  {employee.fullName || employee.name || 'Не указан'}
                </span>
                {isTeamLead && (
                  <span className="inline-flex items-center justify-center rounded-sm text-[10px] px-1 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300">
                    ★
                  </span>
                )}
                {employeeSelectedCount > 0 && (
                  <span
                    className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold text-primary-foreground tabular-nums"
                    title={`Выбрано загрузок: ${employeeSelectedCount}`}
                  >
                    {employeeSelectedCount}
                  </span>
                )}
              </div>
```

- [ ] **Step 3: Manual verification**

1. Включить режим выбора в отделе, выбрать проект.
2. Кликнуть несколько bars одного сотрудника → рядом с его именем появился синий badge с числом.
3. Снять выбор → badge исчез.
4. Нажать `Все` → у всех сотрудников этого проекта badges с правильными числами.
5. У сотрудников из других отделов badges не должно быть.
6. Title (hover) показывает «Выбрано загрузок: N».

- [ ] **Step 4: Commit**

```bash
git add modules/departments-timeline/components/timeline/EmployeeRow.tsx
git commit -m "feat(departments-timeline): add employee selection count badge in sidebar"
```

---

## Task 9: End-to-end manual testing pass + edge cases

**Files:** _нет правок кода — только верификация_

- [ ] **Step 1: Полный happy-path сценарий**

1. Залогиниться пользователем с правом `loadings.bulk_shift.department` (admin или department_head своего отдела).
2. Открыть таймлайн отделов.
3. В шапке своего отдела нажать `MoveHorizontal`.
4. Выбрать проект из селекта.
5. Поставить «Выбрать вручную». Проверить чекбокс активный, счётчик `0 из N`.
6. Кликнуть 3 произвольных bars выбранного проекта → счётчик `3 из N`, у соответствующих сотрудников badges с числами.
7. Выбрать режим «Сдвинуть целиком», ввести `7` дней.
8. Preview-блок: «3 загрузки (из N) — сдвинуть целиком вперёд на 7 дн.»
9. Нажать `Применить` → mutation проходит. Bars сдвинуты в БД (можно проверить SQL: `select * from loadings where loading_id in ('id1','id2','id3')`).
10. После apply: режим выбора выключен, поп закрыт, bars вернулись к нормальному виду уже на новых датах (благодаря invalidation кэша).

- [ ] **Step 2: Edge — partial success**

1. Подобрать конфигурацию, где сдвиг приведёт к `start > finish` для одной из выбранных загрузок (например, режим `start` со сдвигом `+1000` дней так, чтобы новое начало превысило конец).
2. Применить → должен показаться `partialWarning`.
3. Проверить: режим выбора выключен (`activeDepartmentId === null`), но поп остался открытым.

- [ ] **Step 3: Edge — Realtime удалил выбранную загрузку**

1. Включить режим, выбрать 3 bars.
2. В другом окне браузера / в Supabase Studio удалить или деактивировать одну из выбранных загрузок (`update loadings set loading_status='inactive' where loading_id='<id1>'`).
3. Дождаться Realtime invalidation в первом окне → bar исчез.
4. Применить операцию → defense-in-depth фильтр пропустит удалённую загрузку, обновятся только 2 оставшиеся. `totalFound === 2`. Никаких ошибок.

- [ ] **Step 4: Edge — переключение между отделами**

1. Активировать режим в отделе А, выбрать 2 bars.
2. Открыть BulkShiftPopover в отделе Б, выбрать проект, поставить чекбокс «Выбрать вручную».
3. Проверить: в отделе А режим выключен (bars вернулись к нормальному виду, badges исчезли). В отделе Б режим активен.
4. `useBulkShiftSelectionStore.getState().activeDepartmentId === '<dept-B-id>'`.

- [ ] **Step 5: Edge — смена проекта в попе**

1. Активировать режим, выбрать 3 bars проекта X.
2. В селекте сменить проект на Y → счётчик стал `0 из M (для Y)`. Bars проекта X больше не selected (вернулись к dimmed/normal). Bars проекта Y теперь selectable.

- [ ] **Step 6: Edge — permissions**

1. Залогиниться обычным пользователем без `loadings.bulk_shift.department`.
2. Иконка `MoveHorizontal` в шапке отдела не видна.
3. Через DevTools попробовать вручную дёрнуть `bulkShiftLoadings` мутацию с `loadingIds` → server action возвращает `Нет прав на массовый сдвиг отдела`.

- [ ] **Step 7: Edge — restricted projects (для не-админа)**

1. Залогиниться не-админом, у которого есть `bulk_shift.department`, но проект Z находится в restricted-list.
2. Проект Z в селекте быть не должен (BulkShiftPopover читает данные из department, которые уже отфильтрованы по restricted на server-side в `getDepartmentsData`).
3. Если как-то удалось передать `projectId === Z` через DevTools → server action возвращает `Проект не найден`.

- [ ] **Step 8: Dark mode**

Переключить тему в dark mode и пройти Step 1 ещё раз. Outline, checkmark, badges, dimmed bars — всё видно и контрастно.

- [ ] **Step 9: Сборка**

Запустить:

```bash
npm run build
```

Ожидаемо: build проходит без ошибок типизации/линтинга.

- [ ] **Step 10: Если что-то поломалось** — вернуться к соответствующей task и поправить. Если всё ОК — переходим к Task 10.

---

## Task 10: Update `module.meta.json` (task entry, changelog, hooks/actions)

**Files:**
- Modify: `modules/departments-timeline/module.meta.json`

- [ ] **Step 1: Добавить новую запись в `tasks`**

В массив `tasks` (≈ строка 159, после существующего `DT-AUDIT`) добавить:

```json
    {
      "id": "DT-002",
      "title": "Bulk Shift: выборочное применение по загрузкам",
      "description": "Расширение BulkShiftPopover чекбоксом «Выбрать вручную». Пользователь может отметить конкретные загрузки одного проекта в отделе и применить bulk-shift только к ним. Spec: docs/superpowers/specs/2026-05-04-bulk-shift-manual-selection-design.md",
      "category": "feature",
      "priority": "medium",
      "status": "in-progress",
      "assignee": null,
      "createdAt": "2026-05-04",
      "updatedAt": "2026-05-04",
      "blockedBy": [],
      "blocks": [],
      "estimatedHours": 6
    }
```

- [ ] **Step 2: Добавить changelog запись 1.3.0**

В массив `changelog` (≈ строка 225) добавить новую запись (в конец массива):

```json
    {
      "version": "1.3.0",
      "date": "2026-05-04",
      "changes": [
        "Bulk Shift: выборочное применение по загрузкам через чекбокс «Выбрать вручную» в BulkShiftPopover",
        "Новый Zustand store useBulkShiftSelectionStore для эфемерного состояния выбора",
        "Server action bulkShiftLoadings расширен опциональным loadingIds (defense-in-depth по dept × project × active)",
        "Loading bars отображают 3 состояния в режиме выбора: selectable/selected/dimmed",
        "Badge со счётчиком выбранных загрузок у каждого сотрудника"
      ]
    }
```

- [ ] **Step 3: Обновить блок `stores`**

Найти блок `"stores": [...]` (≈ строка 72) и **добавить** в массив второй store:

```json
    {
      "name": "useBulkShiftSelectionStore",
      "description": "Эфемерное состояние выборочного применения bulk-shift (отдел × проект × выбранные loadingIds)",
      "file": "stores/bulk-shift-selection-store.ts",
      "persistence": null,
      "state": ["activeDepartmentId", "activeProjectId", "selectedLoadingIds"],
      "actions": ["enter", "exit", "changeProject", "toggle", "selectAll", "clear"]
    }
```

- [ ] **Step 4: Обновить публичный API**

В `architecture.publicApi` (≈ строка 26) **добавить** `useBulkShiftSelectionStore`:

```json
    "publicApi": [
      "DepartmentsTimelineInternal",
      "DepartmentRow",
      "TeamRow",
      "EmployeeRow",
      "useDepartmentsData",
      "useTeamsFreshness",
      "useDepartmentsTimelineUIStore",
      "useBulkShiftSelectionStore"
    ]
```

- [ ] **Step 5: Обновить input action `bulkShiftLoadings`**

В блоке `actions` (≈ строка 62) обновить `input` существующей записи `bulkShiftLoadings`:

```json
    {
      "name": "bulkShiftLoadings",
      "description": "Массовый сдвиг дат загрузок отдела по проекту. Поддерживает auto-discovery (по dept × project) и явный список loadingIds для выборочного применения.",
      "file": "actions/index.ts",
      "input": "BulkShiftLoadingsInput { departmentId, projectId, shiftDays, shiftMode, setStartDate?, setEndDate?, loadingIds? }",
      "returns": "ActionResult<BulkShiftLoadingsResult>"
    }
```

- [ ] **Step 6: После завершения работы — статус и архив**

Когда вся фича принята пользователем, изменить статус task `DT-002` на `done`, добавить `completedAt: "<YYYY-MM-DD>"` и перенести в `tasks.archive.json` модуля (см. правила в CLAUDE.md). Это последний шаг — выполняется в конце.

- [ ] **Step 7: Manual verification**

1. Открыть JSON в редакторе → не должно быть синтаксических ошибок (запятые, скобки).
2. Запустить (если есть schema validation):
   ```bash
   npx ajv validate -s schemas/module-meta/module.schema.json -d modules/departments-timeline/module.meta.json
   ```
   (Если `ajv` не установлен — пропустить, проверить визуально.)
3. Открыть `/dashboard/dev/tasks` (если есть страница задач) — task `DT-002` должна отображаться.

- [ ] **Step 8: Commit**

```bash
git add modules/departments-timeline/module.meta.json
git commit -m "docs(departments-timeline): document bulk shift manual selection in module meta"
```

---

## Task 11: Update module README (if exists)

**Files:**
- Modify: `modules/departments-timeline/README.md` (если существует)

- [ ] **Step 1: Проверить существование README**

```bash
ls modules/departments-timeline/README.md
```

Если файла нет — пропустить эту task.

Если есть — добавить раздел про режим выборочного bulk-shift:

- [ ] **Step 2: Добавить раздел про новый store и UX**

В README добавить (после существующего раздела про BulkShiftPopover, или в конец):

```markdown
## Bulk Shift: выборочное применение

Чекбокс «Выбрать вручную» в `BulkShiftPopover` позволяет применять bulk-операцию только к отмеченным загрузкам (в рамках одного отдела × одного проекта).

**Состояние:** эфемерный Zustand store `useBulkShiftSelectionStore`:
- `activeDepartmentId / activeProjectId` — scope режима выбора
- `selectedLoadingIds: Set<string>` — отмеченные загрузки

**Visual states** (в `LoadingBarWithResize`):
- `selectable` — bar выбранного проекта, hover показывает dashed outline
- `selected` — solid primary outline + checkmark
- `dimmed` — opacity 0.25, pointer-events none

**Server action:** `bulkShiftLoadings({ ..., loadingIds: ['id1', 'id2'] })` — defense-in-depth фильтр по `departmentId × projectId × active`.

**Permission:** требуется `loadings.bulk_shift.department` (то же, что для авто-режима).
```

- [ ] **Step 3: Commit**

```bash
git add modules/departments-timeline/README.md
git commit -m "docs(departments-timeline): document manual bulk-shift selection mode in README"
```

---

## Final checklist

После выполнения всех task'ов:

- [ ] Все 11 tasks завершены и закоммичены.
- [ ] `npm run build` проходит без ошибок (Task 9 Step 9).
- [ ] Полный happy-path и все edge cases пройдены вручную (Task 9).
- [ ] `module.meta.json` обновлён, `DT-002` существует.
- [ ] README обновлён (если есть).
- [ ] Пользователь подтвердил приёмку.
- [ ] Только после подтверждения — статус `DT-002` → `done`, перенос в `tasks.archive.json`.

---

## Notes for the implementer

- **Сохраняй существующее поведение auto-discovery без изменений.** Чекбокс выключен по умолчанию = текущее поведение для всех пользователей.
- **Не добавляй per-loading permission check в `bulkShiftLoadings`** — текущая модель «может ли user bulk-shift отдел» — единственная необходимая проверка. Defense-in-depth фильтр в SQL-запросе прикрывает попытки передать чужие IDs.
- **Не пытайся персистить состояние выбора** между перезагрузками — это by design, чтобы пользователь не запутался в «забытом» режиме.
- **Если возникает регрессия в drag-resize или scissors после Task 7** — это значит ты не учёл флаг `selectionContext.isActive` в одном из условий. Перепроверь Task 7 Step 3.
