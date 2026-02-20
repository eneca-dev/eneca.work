# Pending Fixes — изменения для повторного применения

## Коммит 1: `c20acd3` — исправлен флекс анимации при resize загрузок выходящих за пределы календаря

### `modules/resource-graph/hooks/useTimelineResize.ts`

**Заменить в блоке `previewPosition`:**

```ts
// БЫЛО:
const dayFromStart = differenceInDays(start, range.start)
const duration = differenceInDays(end, start) + 1
```
```ts
// СТАЛО:
// Клипируем по видимому диапазону (как в calculateBarPosition)
const visibleStart = start < range.start ? range.start : start
const visibleEnd = end > range.end ? range.end : end

const dayFromStart = differenceInDays(visibleStart, range.start)
const duration = differenceInDays(visibleEnd, visibleStart) + 1
```

---

### `modules/sections-page/components/rows/EmployeeRow.tsx`

**1. className на main bar — убрать transition из статичного класса, сделать условным:**

```tsx
// БЫЛО:
'absolute transition-all duration-200 pointer-events-auto flex items-center',
```
```tsx
// СТАЛО:
'absolute pointer-events-auto flex items-center',
!isResizing && 'transition-all duration-200',
```

**2. Non-working days overlay — убрать IIFE-обёртку, исправить расчёт overlayLeft:**

```tsx
// БЫЛО:
{(() => {
  const HORIZONTAL_GAP = 6

  return nonWorkingSegments.map((segment, segmentIdx) => {
    const barStartLeft = timeUnits[bar.startIdx]?.left ?? 0
    const segmentStartLeft = timeUnits[segment.startIdx]?.left ?? 0
    const overlayLeft = segmentStartLeft - barStartLeft - HORIZONTAL_GAP / 2
    // ...остальной код рендера
  })
})()}
```
```tsx
// СТАЛО:
{nonWorkingSegments.map((segment, segmentIdx) => {
  const segmentStartLeft = timeUnits[segment.startIdx]?.left ?? 0
  // Позиция относительно текущего displayLeft, чтобы штриховка не съезжала во время resize
  const overlayLeft = segmentStartLeft - displayLeft
  // ...остальной код рендера (без изменений)
})}
```

---

### `modules/departments-timeline/components/timeline/EmployeeRow.tsx`

**Те же два изменения, что и в sections-page/EmployeeRow.tsx выше** (main bar className + non-working days overlay).

---

## Коммит 2: `28e9e22` — убрана задержка анимации комментария при resize загрузки

### `modules/sections-page/components/rows/EmployeeRow.tsx`

**Comment below bar — убрать transition во время resize:**

```tsx
// БЫЛО:
className="absolute pointer-events-none transition-all duration-200"
```
```tsx
// СТАЛО:
className={cn('absolute pointer-events-none', !isResizing && 'transition-all duration-200')}
```

---

### `modules/departments-timeline/components/timeline/EmployeeRow.tsx`

**То же самое изменение для Comment below bar.**
