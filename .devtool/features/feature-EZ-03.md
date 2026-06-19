---
id: "feature-EZ-03"
status: "review"
priority: "medium"
assignee: "Екатерина Зорина"
epic: "feature"
dueDate: null
created: "2026-06-19T09:00:00.000Z"
modified: "2026-06-19T09:10:00.000Z"
completedAt: null
labels: ["v1.5.0"]
parent: "feature-EZ-02"
order: "a1"
---
# feature-EZ-03 Связи между этапами на диаграмме Ганта (зависимости + стрелки)

Дочерний тикет `feature-EZ-02`. Добавить визуальные связи (зависимости) между барами этапов на диаграмме Ганта: отрисовка стрелок на таймлайне и UI для установки/удаления связей.

---

## Контекст и проблема

В рамках диаграммы Ганта (feature-EZ-02) бары этапов пока отображаются независимо. На практике между этапами существуют зависимости (например, «Этап Б начинается после завершения Этапа А»). Нужно визуально отображать эти связи стрелками и дать пользователю инструмент для их установки и удаления.

---

## Типы связей (стандарт Ганта)

| Тип | Обозначение | Описание |
|-----|-------------|----------|
| Finish → Start | FS | Конец А → Начало Б (наиболее распространённый) |
| Start → Start | SS | Начало А → Начало Б |
| Finish → Finish | FF | Конец А → Конец Б |
| Start → Finish | SF | Начало А → Конец Б (редкий) |

В первой итерации реализуем только **FS (Finish → Start)** — самый распространённый вид зависимости.

---

## Структура данных

### Мок-данные (Фаза 1)

В `modules/project-diagram/mock-data.ts` добавить массив связей:

```ts
export interface MockLink {
  id: string
  fromStageId: string   // ID этапа-источника (откуда стрелка)
  toStageId: string     // ID этапа-цели (куда стрелка)
  type: 'FS'            // в будущем: 'SS' | 'FF' | 'SF'
}

export const MOCK_LINKS: MockLink[] = [
  { id: 'l1', fromStageId: 's1', toStageId: 's3', type: 'FS' },
  { id: 'l2', fromStageId: 's2', toStageId: 's4', type: 'FS' },
  // ...
]
```

### БД (Фаза 2)

Новая таблица `decomposition_stage_links`:

```sql
create table decomposition_stage_links (
  id          uuid primary key default gen_random_uuid(),
  from_stage_id uuid not null references decomposition_stages(id) on delete cascade,
  to_stage_id   uuid not null references decomposition_stages(id) on delete cascade,
  link_type     text not null default 'FS', -- 'FS' | 'SS' | 'FF' | 'SF'
  created_at    timestamptz default now(),
  unique (from_stage_id, to_stage_id)
);
```

---

## Что нужно реализовать

### 1. Отрисовка стрелок (`GanttLinks.tsx`)

Компонент рендерит SVG-оверлей поверх таймлайна (абсолютно позиционированный, `pointer-events: none`).

**Алгоритм рисования стрелки FS:**

```
from: правый край бара fromStage → (x1, y1)
to:   левый край бара toStage   → (x2, y2)

Путь (ломаная линия, SVG <path>):
  M x1 y1                    // начало — правый край бара-источника
  H (x1 + ARROW_INDENT)      // горизонтально вправо на отступ
  V y2                       // вертикально к строке цели
  H x2                       // горизонтально к левому краю бара-цели
  → наконечник стрелки (треугольник)
```

Расположение точек:
- `x1 = barLeft + barWidth`
- `y1 = barTop + BAR_H / 2` (середина бара по вертикали)
- `x2 = toBarLeft`
- `y2 = toBarTop + BAR_H / 2`

**Стиль:**
- Линия: `stroke: #6b7280` (серый), толщина 1.5px, `stroke-dasharray: none`
- При hover на стрелке: `stroke: #1e7260` (primary)
- Наконечник: маленький треугольник или `marker-end` SVG arrow
- `z-index` ниже баров, выше сетки

**Случаи, когда бар-источник или бар-цель не видны:**
- Если один из баров свёрнут (collapsed раздел/объект) — стрелку не рисуем
- Если бары находятся за пределами viewport по X — линия обрезается

### 2. Установка связи через UI

**Режим «рисования связи»:**

- Кнопка-иконка `<Link2>` в тулбаре (рядом с кнопками масштаба)
- При активации режима курсор меняется (`cursor-crosshair`)
- Клик по правому краю бара-источника начинает рисование (бар подсвечивается)
- Временная линия следует за курсором (пунктиром)
- Клик по бару-цели завершает создание связи
- Нажатие Escape или клик в пустое место — отменяет режим

**Либо — hover-хэндл на баре:**

- При наведении на бар справа появляется маленький кружок `●`
- Drag от кружка к другому бару создаёт связь (аналог Figma/miro)
- Реализуется через `@dnd-kit` (уже используется в проекте)

> Рекомендация: **hover-хэндл** (второй вариант) — менее навязчивый UX, не требует отдельного режима.

### 3. Удаление связи

- Клик по стрелке выделяет её (стрелка становится primary-цвета)
- Появляется кнопка `×` рядом с серединой стрелки
- Клик на `×` или нажатие `Delete` удаляет связь
- Подтверждение не требуется (действие отменяемо через Ctrl+Z в будущем)

### 4. Tooltip на стрелке

При наведении на стрелку:
```
Зависимость: FS
«Название этапа А» → «Название этапа Б»
```

---

## Архитектура компонентов

```
ProjectDiagram.tsx
  ├─ GanttHeader           — шапка с масштабом (уже есть)
  ├─ GanttSidebar          — иерархия (уже есть)
  ├─ GanttRows             — строки с барами (уже есть)
  └─ GanttLinks            — SVG-оверлей со стрелками (NEW)
       ├─ GanttLinkArrow   — одна стрелка (path + наконечник)
       └─ GanttLinkDraft   — временная линия при рисовании (NEW)
```

**Позиционирование SVG:**
```tsx
<div style={{ position: 'relative' }}>
  <GanttRows ... />
  <svg
    style={{
      position: 'absolute',
      top: 0, left: 0,
      width: timelineWidth,
      height: totalHeight,
      pointerEvents: 'none',   // клики проходят сквозь SVG
    }}
  >
    {links.map(link => <GanttLinkArrow key={link.id} ... />)}
    {draftLink && <GanttLinkDraft ... />}
  </svg>
</div>
```

**Регистр позиций баров:**

`ProjectDiagram` накапливает `Map<stageId, { x, y, width, height }>` — позиции всех видимых баров. Передаёт в `GanttLinks` для вычисления координат стрелок.

```ts
const barPositions = useRef(new Map<string, BarRect>())

// Бар при монтировании регистрирует себя:
onMount(id, rect) { barPositions.current.set(id, rect) }
onUnmount(id)     { barPositions.current.delete(id) }
```

---

## Состояние

```ts
// В ProjectDiagram.tsx
const [links, setLinks] = useState<MockLink[]>(MOCK_LINKS)
const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null)
const [draftLink, setDraftLink] = useState<{ fromId: string; mouseX: number; mouseY: number } | null>(null)
```

---

## Подзадачи

- [ ] Расширить `mock-data.ts`: добавить `MockLink[]`, несколько тестовых связей
- [ ] Компонент `GanttLinkArrow` — одна стрелка SVG с hover + выделением
- [ ] Компонент `GanttLinkDraft` — временная линия при рисовании
- [ ] Регистр позиций баров (`barPositions` ref + `onMount`/`onUnmount` callbacks)
- [ ] Hover-хэндл на баре (кружок справа при наведении, drag для создания связи)
- [ ] Удаление связи (клик на стрелку → кнопка `×`)
- [ ] Tooltip на стрелке (название этапов, тип связи)
- [ ] (Фаза 2) Таблица `decomposition_stage_links` + Server Action `createStageLink` / `deleteStageLink`
- [ ] (Фаза 2) Интеграция с TanStack Query

---

## Важные ограничения

- В Фазе 1 (мок) — только тип `FS`, данные в памяти, без сохранения
- SVG-оверлей не блокирует клики на барах (`pointer-events: none` на SVG, `auto` на интерактивных элементах)
- Стрелки не рисуются для свёрнутых строк
- Производительность: при большом числе баров пересчёт позиций делается лениво (только при изменении масштаба или скролле)

---

## Review

### Как решена задача

Добавлен компонент `GanttLinks.tsx` — SVG-оверлей с абсолютным позиционированием поверх таймлайна (`pointer-events: none`). Стрелки FS рисуются ломаной линией (M → H → V → H + наконечник). Регистр позиций баров реализован через `useRef(new Map())` в `ProjectDiagram.tsx`; бары регистрируют себя при монтировании. Hover-хэндл (кружок справа) при наведении запускает создание связи через @dnd-kit. Клик по стрелке выделяет её, появляется кнопка `×` для удаления. Мок-данные `MOCK_LINKS` добавлены в `mock-data.ts`.

### Что проверить ревьюеру

- SVG-оверлей не перехватывает клики по барам и pills (`pointer-events: none` на `<svg>`, `auto` на интерактивных элементах внутри)
- Стрелки не рисуются для свёрнутых строк (бар отсутствует в `barPositions`)
- Корректность координат: `x1/y1` = правый край источника по центру высоты, `x2/y2` = левый край цели
- Hover-состояние стрелки: цвет меняется на `#1e7260`
- Удаление связи: кнопка `×` появляется при клике на стрелку и удаляет её из `links`
