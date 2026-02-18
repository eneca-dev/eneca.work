# PR #279 — План исправлений

**Ветка:** `Fixes/sections-and-departments`
**Дата аудита:** 2026-02-18
**Аудиторы:** performance-guardian, typescript-guardian, clean-code-guardian, forms-guardian, nextjs-guardian, ui-ux-advisor, modal-architect

---

## 🔴 Блокеры — обязательно до мержа

### 1. Убрать `as any` в `departments-timeline/EmployeeRow.tsx`

**Агент:** typescript-guardian
**Файл:** [modules/departments-timeline/components/timeline/EmployeeRow.tsx](modules/departments-timeline/components/timeline/EmployeeRow.tsx)

**Проблема 1 — line 173:**
```tsx
// ❌ Сейчас:
onLoadingClick(bar.period as any)

// ✅ Исправление:
if (bar.period.type === 'loading') {
  onLoadingClick(bar.period as Loading)
}
```

**Проблема 2 — line 604-607:**
```tsx
// ❌ Сейчас:
return loadingsToPeriods(employee.loadings as any)

// ✅ Исправление: явный маппинг типов или правильная типизация employee.loadings
```

---

### 2. Удалить дублирование `PeriodBackground` из `TimelineRow.tsx`

**Агент:** clean-code-guardian
**Файл:** [modules/resource-graph/components/timeline/TimelineRow.tsx](modules/resource-graph/components/timeline/TimelineRow.tsx)

`PeriodBackground` и `ResizablePeriodBackground` объявлены дважды:
- `modules/resource-graph/components/timeline/shared/PeriodBackground.tsx` ← **правильное место**
- `modules/resource-graph/components/timeline/TimelineRow.tsx` lines 932–1073 ← **удалить**

Компонент `shared/PeriodBackground.tsx` уже импортируется в `TimelineRow.tsx` на line 4 через `{ PeriodBackground }`. Локальная копия — мёртвый код.

---

### 3. Вынести дублированные утилиты в общий модуль

**Агент:** clean-code-guardian
**Файлы:**
- [modules/departments-timeline/components/timeline/EmployeeRow.tsx](modules/departments-timeline/components/timeline/EmployeeRow.tsx) — lines 47–103
- [modules/sections-page/components/rows/EmployeeRow.tsx](modules/sections-page/components/rows/EmployeeRow.tsx) — lines 61–127

Три функции полностью дублируются:

| Функция | departments-timeline | sections-page |
|---------|---------------------|---------------|
| `dayCellsToTimelineUnits` | line 47 | line 61 |
| `hexToRgba` | line 78 | line 83 |
| `calculateTimelineRange` | line 93 | line 116 |

**Решение:** создать `modules/resource-graph/utils/timeline-cell-utils.ts` (или добавить в существующий utils-файл) и экспортировать оттуда. Импортировать в обоих `EmployeeRow.tsx`.

> **Примечание:** версия `hexToRgba` в `sections-page/EmployeeRow.tsx` немного отличается (обрабатывает `rgba` prefix) — использовать более полную версию.

---

## 🟡 Желательно — улучшения качества

### 4. Объединить 3 scroll-useEffect → 1 в обоих `EmployeeRow`

**Агент:** performance-guardian
**Файлы:**
- [modules/departments-timeline/components/timeline/EmployeeRow.tsx](modules/departments-timeline/components/timeline/EmployeeRow.tsx) — lines 187, 215, 246
- [modules/sections-page/components/rows/EmployeeRow.tsx](modules/sections-page/components/rows/EmployeeRow.tsx) — lines 198, 228, 256

Каждый `LoadingBar`/`LoadingBarWithResize` создаёт 3 отдельных scroll-листенера на один контейнер. При 20+ барах на экране = 60+ листенеров.

```tsx
// ✅ Один useEffect вместо трёх:
useEffect(() => {
  const container = textRef.current?.closest('.overflow-auto')
  if (!container) return

  const update = () => {
    const scrollLeft = (container as Element).scrollLeft
    const overlap = Math.max(0, scrollLeft - displayLeft)

    if (textRef.current) textRef.current.style.transform = `translateX(${overlap}px)`
    if (commentRef.current) commentRef.current.style.transform = `translateX(${overlap}px)`
    if (rateBadgeRef.current) {
      const clampedOffset = Math.min(overlap, Math.max(0, displayWidth - 48))
      rateBadgeRef.current.style.transform = `translateX(${clampedOffset}px)`
    }
  }

  update()
  container.addEventListener('scroll', update, { passive: true })
  return () => container.removeEventListener('scroll', update)
}, [displayLeft, displayWidth])
```

---

### 5. Добавить `useCallback` для resize-handlers в `TimelineRow.tsx`

**Агент:** performance-guardian
**Файл:** [modules/resource-graph/components/timeline/TimelineRow.tsx](modules/resource-graph/components/timeline/TimelineRow.tsx) — lines 656, 666

```tsx
// ❌ Сейчас — новая функция на каждый рендер:
const handleLoadingResize = (loadingId: string, startDate: string, finishDate: string) => {
  updateLoadingDates.mutate(...)
}

// ✅ Исправление:
const handleLoadingResize = useCallback((loadingId: string, startDate: string, finishDate: string) => {
  updateLoadingDates.mutate({ loadingId, sectionId, startDate, finishDate })
}, [updateLoadingDates, sectionId])

const handleStageResize = useCallback((newStartDate: string, newFinishDate: string) => {
  updateStageDates.mutate({ stageId: stage.id, startDate: newStartDate, finishDate: newFinishDate })
}, [updateStageDates, stage.id])
```

---

### 6. Исправить цвет кнопок в `RateInput.tsx` — teal → amber

**Агент:** modal-architect
**Файл:** [modules/modals/components/loading-modal-new/RateInput.tsx](modules/modals/components/loading-modal-new/RateInput.tsx) — line 97-99

```tsx
// ❌ Сейчас — teal (не соответствует Resource Graph design language):
'bg-teal-500 text-white hover:bg-teal-600 dark:bg-teal-600 dark:hover:bg-teal-700'

// ✅ Resource Graph standard:
'bg-amber-500 hover:bg-amber-400 text-slate-900'
```

---

### 7. Удалить закомментированный код в `RateInput.tsx`

**Агент:** clean-code-guardian, forms-guardian
**Файл:** [modules/modals/components/loading-modal-new/RateInput.tsx](modules/modals/components/loading-modal-new/RateInput.tsx) — lines 126-130

```tsx
// ❌ Удалить этот блок:
{/* {!error && !isInvalidRange && (
  <p className="text-xs text-muted-foreground">
    Введите значение от 0.01 до 2.0
  </p>
)} */}
```

---

### 8. Исправить отображение ставки в `sections-page/EmployeeRow.tsx`

**Агент:** ui-ux-advisor
**Файл:** [modules/sections-page/components/rows/EmployeeRow.tsx](modules/sections-page/components/rows/EmployeeRow.tsx) — lines 617-624

```tsx
// ❌ Сейчас — показывает максимальную ставку, а не сумму:
const maxRate = Math.max(...employee.loadings.map(l => l.rate))
return maxRate

// ✅ Показывать суммарную нагрузку:
const totalRate = employee.loadings.reduce((sum, l) => sum + l.rate, 0)
return Math.round(totalRate * 100) / 100
```

Пользователь должен видеть реальную суммарную нагрузку, а не максимальную ставку одной загрузки.

---

### 9. Переименовать boolean `hoveredAvatar` в `isHoveredAvatar`

**Агент:** clean-code-guardian
**Файлы:**
- [modules/departments-timeline/components/timeline/EmployeeRow.tsx](modules/departments-timeline/components/timeline/EmployeeRow.tsx) — line 506
- [modules/sections-page/components/rows/EmployeeRow.tsx](modules/sections-page/components/rows/EmployeeRow.tsx) — line 527

```tsx
// ❌ Сейчас:
const [hoveredAvatar, setHoveredAvatar] = useState(false)

// ✅ По конвенции is* для булевых:
const [isHoveredAvatar, setIsHoveredAvatar] = useState(false)
```

---

### 10. Вынести `formatDate` из `onChange` callback в `LoadingForm.tsx`

**Агент:** forms-guardian
**Файл:** [modules/modals/components/loading-modal-new/LoadingForm.tsx](modules/modals/components/loading-modal-new/LoadingForm.tsx) — lines 167-173

```tsx
// ❌ Сейчас — объявляется внутри JSX callback при каждом рендере:
onChange={(range) => {
  const formatDate = (date: Date | null) => { ... }
  ...
}}

// ✅ Module-level или вне компонента:
function formatLocalDate(date: Date | null): string {
  if (!date) return ''
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
```

---

### 11. Заменить IIFE в render `LoadingForm.tsx` на переменные

**Агент:** forms-guardian
**Файл:** [modules/modals/components/loading-modal-new/LoadingForm.tsx](modules/modals/components/loading-modal-new/LoadingForm.tsx) — lines 185-200

```tsx
// ❌ Сейчас — IIFE в JSX:
{(() => {
  const start = ...
  const end = ...
  return businessDays > 0 ? <div>...</div> : null
})()}

// ✅ Переменные до return:
const start = formData.startDate ? new Date(formData.startDate) : undefined
const end = formData.endDate ? new Date(formData.endDate) : undefined
const businessDays = start && end && !isNaN(start.getTime()) && !isNaN(end.getTime())
  ? differenceInBusinessDays(end, start) + 1
  : 0
const totalHours = businessDays > 0 ? Math.round(businessDays * 8 * formData.rate) : 0

// В JSX:
{businessDays > 0 && (
  <div className="text-xs text-muted-foreground space-y-1">
    <p>Количество рабочих дней: {businessDays}</p>
    <p>Количество рабочих часов с учётом ставки: {totalHours} ч</p>
  </div>
)}
```

---

## 🔵 Технический долг — при наличии времени

### 12. Добавить именованные константы в `AggregatedBarsOverlay.tsx`

**Агент:** clean-code-guardian
**Файл:** [modules/sections-page/components/AggregatedBarsOverlay.tsx](modules/sections-page/components/AggregatedBarsOverlay.tsx) — lines 41-78

```tsx
// ❌ Magic numbers:
if (percentage > 100) ...
if (percentage >= 95) ...
if (percentage >= 70) ...

// ✅ Named constants:
const OVERLOAD_THRESHOLD = 100
const IDEAL_LOAD_MIN = 95
const HIGH_LOAD_MIN = 70
const MEDIUM_LOAD_MIN = 40
```

---

### 13. Обернуть `LoadingBar`/`LoadingBarWithResize` в `React.memo`

**Агент:** performance-guardian
**Файлы:**
- `departments-timeline/components/timeline/EmployeeRow.tsx` — `LoadingBarWithResize` (line 118)
- `sections-page/components/rows/EmployeeRow.tsx` — `LoadingBar` (line 141)

```tsx
const LoadingBar = memo(function LoadingBar({ ... }: LoadingBarProps) {
  // ...
})
```

---

### 14. Разбить `TimelineRow.tsx` на отдельные файлы

**Агент:** clean-code-guardian
**Файл:** [modules/resource-graph/components/timeline/TimelineRow.tsx](modules/resource-graph/components/timeline/TimelineRow.tsx) — 1637 строк

Предлагаемая структура:
```
modules/resource-graph/components/timeline/
├── rows/
│   ├── ProjectRow.tsx
│   ├── ObjectRow.tsx
│   ├── SectionRow.tsx
│   ├── DecompositionStageRow.tsx
│   └── DecompositionItemRow.tsx
├── shared/
│   ├── PeriodBackground.tsx  ← уже существует ✅
│   ├── ProgressCircle.tsx    ← уже существует ✅
│   ├── TimelineGrid.tsx      ← уже существует ✅
│   └── BaseRow.tsx           ← вынести из TimelineRow.tsx
└── TimelineRow.tsx           ← только export точка входа
```

---

### 15. Привести labels в `LoadingForm.tsx` к дизайн-стандарту

**Агент:** modal-architect
**Файл:** [modules/modals/components/loading-modal-new/LoadingForm.tsx](modules/modals/components/loading-modal-new/LoadingForm.tsx)

```tsx
// ❌ Сейчас:
<label className="block text-sm font-medium mb-2">Сотрудник</label>

// ✅ Resource Graph standard:
<label className="block text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-2">
  СОТРУДНИК
</label>
```

---

## Чеклист

### 🔴 Блокеры
- [ ] Убрать `as any` × 2 в `departments-timeline/EmployeeRow.tsx`
- [ ] Удалить дублированный `PeriodBackground` из `TimelineRow.tsx` (lines 932–1073)
- [ ] Вынести `dayCellsToTimelineUnits`, `hexToRgba`, `calculateTimelineRange` в общий модуль

### 🟡 Желательно
- [ ] Объединить 3 scroll-useEffect → 1 в обоих `EmployeeRow`
- [ ] Добавить `useCallback` для resize-handlers в `TimelineRow.tsx`
- [ ] Исправить цвет кнопок в `RateInput.tsx` — teal → amber
- [ ] Удалить закомментированный код в `RateInput.tsx`
- [ ] Исправить `employmentRate` max → sum в `sections-page/EmployeeRow.tsx`
- [ ] Переименовать `hoveredAvatar` → `isHoveredAvatar`
- [ ] Вынести `formatDate` из `onChange` callback в `LoadingForm.tsx`
- [ ] Заменить IIFE в render `LoadingForm.tsx` на переменные

### 🔵 Технический долг
- [ ] Добавить константы для thresholds в `AggregatedBarsOverlay.tsx`
- [ ] `React.memo` для `LoadingBar` / `LoadingBarWithResize`
- [ ] Разбить `TimelineRow.tsx` (1637 строк) на отдельные файлы
- [ ] Привести labels в `LoadingForm.tsx` к дизайн-стандарту
