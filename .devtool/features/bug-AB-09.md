---
id: "bug-AB-09"
status: "review"
priority: "medium"
assignee: "Александра Бирило"
epic: "bug"
dueDate: null
created: "2026-08-24T15:05:00.000Z"
modified: "2026-08-25T10:25:00.000Z"
completedAt: null
labels: ["v1.5.0"]
order: "c10"
---
# bug-AB-09 Хвосты float в подписях баров загрузки

## Проблема
`feature-AB-05` округлила суммы ёмкости в источнике данных (`DepartmentRow.tsx`, `ProjectRow.tsx`), но не в местах отображения. `capacity` выводился без форматирования, в отличие от `rateSum`:

- `AggregatedBarsOverlay.tsx` — лейбл пустой ячейки, основной лейбл, два тултипа.
- `WeeklyAggregatedBarsOverlay.tsx` — тултип ёмкости; при этом соседний лейбл округлял до 1 знака, то есть день и неделя форматировали по-разному.

Чаще всего это незаметно, так как источники уже округлены после AB-05. Но любой новый источник (`objectSection.defaultCapacity` приходит с сервера как есть) или недельное усреднение (`capacity / divisor` в `computeWeeklyAggregation`) даёт длинный хвост, который уходит на экран без обработки.

## Решение
Одна точка форматирования для любого отображаемого числа — `formatBarNumber()` в `utils/aggregate-bars.ts` вместо локальных копий `formatRate()` в обоих overlay-компонентах.

## Реализация
- `utils/aggregate-bars.ts` — `formatBarNumber(value)` на `toFixed(2)`.
- Оба overlay-компонента — локальные `formatRate()` удалены, все лейблы и тултипы переведены на общую функцию. Неделя приведена к 2 знакам (было 1).

## На что обратить внимание
1. Ширина недельных ячеек (`WEEK_CELL_WIDTH = 110`px) — самое длинное значение теперь вида `12.34/56.78`.
2. `formatRate` в `modules/sections-page/components/` больше не встречается — обе копии удалены.
