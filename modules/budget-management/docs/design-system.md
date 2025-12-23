# Budget Management — Design System

Визуальные стандарты модуля, согласованные с `resource-graph`.

---

## Философия дизайна

**Industrial Precision** — утилитарный интерфейс для работы с плотными финансовыми данными.

### Принципы

1. **Data Density** — максимум информации на экран
2. **Visual Hierarchy** — чёткое разделение уровней вложенности
3. **Scanability** — tabular nums, выравнивание, цветовое кодирование
4. **Minimal Chrome** — никаких декоративных элементов

---

## Цветовая палитра

### Фоны

```css
--bg-base: #09090b;           /* zinc-950 */
--bg-elevated: #18181b;       /* zinc-900 */
--bg-hover: rgba(255,255,255,0.02);
--bg-section: rgba(255,255,255,0.03);
```

### Границы

```css
--border-subtle: rgba(255,255,255,0.05);
--border-default: rgba(255,255,255,0.10);
--border-strong: rgba(255,255,255,0.15);
```

### Текст

```css
--text-primary: rgba(255,255,255,0.90);
--text-secondary: rgba(255,255,255,0.70);
--text-muted: rgba(255,255,255,0.50);
--text-disabled: rgba(255,255,255,0.20);
```

### Семантические цвета

```css
--color-success: #22c55e;     /* green-500 */
--color-warning: #f59e0b;     /* amber-500 */
--color-danger: #ef4444;      /* red-500 */
--color-info: #3b82f6;        /* blue-500 */
```

### Категории работ

| Категория | Цвет | HEX |
|-----------|------|-----|
| Управление | Violet | #8b5cf6 |
| Моделирование 200 | Blue | #3b82f6 |
| Моделирование 300 | Cyan | #06b6d4 |
| Расчёт | Green | #22c55e |
| Проектирование | Amber | #f59e0b |
| Оформление | Red | #ef4444 |

---

## Типографика

### Шрифты

- **Primary**: System font stack (SF Pro, -apple-system)
- **Monospace**: JetBrains Mono, Menlo (для кодов)

### Размеры

```css
--text-xs: 9px;    /* sub-headers, labels */
--text-sm: 10px;   /* chips, secondary data */
--text-base: 11px; /* table cells */
--text-md: 12px;   /* row labels */
--text-lg: 14px;   /* section headers */
```

### Стили

```css
/* Числовые данные */
.tabular-nums {
  font-variant-numeric: tabular-nums;
}

/* Заголовки групп */
.group-header {
  font-size: 9px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
}
```

---

## Компоненты

### ProgressCircle

SVG-кольцо с процентом внутри.

```tsx
<ProgressCircle
  progress={75}      // 0-100
  size={28}          // px
  strokeWidth={3}    // px
/>
```

**Цветовая градация:**
- `≥80%` → green (#22c55e)
- `≥50%` → amber (#f59e0b)
- `≥20%` → orange (#f97316)
- `<20%` → red (#ef4444)

### HoursDisplay

Отображение факт/план часов.

```tsx
<HoursDisplay actual={45} planned={80} />
// Рендерит: 45 / 80
// Если actual > planned — текст становится красным
```

### CategoryBadge

Цветной badge категории работ.

```tsx
<CategoryBadge category={{ abbr: 'М200', color: '#3b82f6' }} />
```

**Стиль:**
- `background: ${color}20` (12% opacity)
- `color: ${color}`
- `font-size: 10px`
- `padding: 2px 6px`
- `border-radius: 4px`

### StatusChip

Статус с точкой-индикатором.

```tsx
<StatusChip name="В работе" color="#3b82f6" />
```

**Стиль:**
- `background: ${color}1A` (10%)
- `border: 1px solid ${color}40` (25%)
- `color: ${color}`
- Точка 6x6px слева

---

## Layout

### Размеры строк

```typescript
const ROW_HEIGHTS = {
  section: 56,      // Раздел (level 0)
  stage: 44,        // Этап декомпозиции (level 1)
  item: 40,         // Элемент декомпозиции (level 2)
}
```

### Ширина колонок

```typescript
const COLUMN_WIDTHS = {
  workCategory: 60,  // Одна категория работ
  total: 70,         // Итого часов
  percentage: 60,    // Процент
  budget: 90,        // Бюджет (план/факт)
  rate: 70,          // Ставка
  specialists: 50,   // Кол-во специалистов
  date: 70,          // Дата
  duration: 60,      // Длительность
  progress: 50,      // Progress circle
  hours: 80,         // Факт/План часов
}
```

### Отступы для вложенности

```typescript
const INDENT_PER_LEVEL = 20  // px
const BASE_PADDING = 12      // px

// Итого: paddingLeft = BASE_PADDING + level * INDENT_PER_LEVEL
```

---

## Интерактивность

### Hover States

```css
/* Строка таблицы */
.row:hover {
  background: rgba(255,255,255,0.02);
}

/* Редактируемая ячейка */
.editable-cell:hover {
  background: rgba(255,255,255,0.05);
  cursor: pointer;
}

/* Кнопка expand/collapse */
.expand-button:hover {
  color: rgba(255,255,255,0.70);
}
```

### Focus States

```css
/* Input fields */
input:focus {
  outline: none;
  border-color: rgba(255,255,255,0.20);
  background: rgba(255,255,255,0.07);
}
```

### Transitions

```css
/* Стандартный transition */
.transition-default {
  transition: all 150ms ease;
}

/* Progress animation */
.progress-ring circle {
  transition: stroke-dashoffset 500ms ease;
}
```

---

## Sticky Elements

### Header

```css
header {
  position: sticky;
  top: 0;
  z-index: 30;
  background: rgba(24,24,27,0.80);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid rgba(255,255,255,0.10);
}
```

### Sidebar (Tree)

```css
.sidebar {
  position: sticky;
  left: 0;
  z-index: 10;
  background: #09090b;
  border-right: 1px solid rgba(255,255,255,0.10);
}
```

### Footer (Summary)

```css
footer {
  position: sticky;
  bottom: 0;
  z-index: 20;
  background: rgba(24,24,27,0.90);
  backdrop-filter: blur(8px);
  border-top: 1px solid rgba(255,255,255,0.10);
}
```

---

## Responsive Behavior

### Минимальная ширина

```typescript
const MIN_TABLE_WIDTH = SIDEBAR_WIDTH + dataColumnsWidth
// ≈ 400 + 860 = 1260px
```

### Горизонтальный скролл

- Sidebar остаётся sticky слева
- Колонки данных скроллятся горизонтально
- Header синхронизируется с контентом

---

## Accessibility

### Keyboard Navigation

- `Tab` — переход между интерактивными элементами
- `Enter/Space` — toggle expand/collapse
- `Escape` — закрыть редактирование

### Screen Readers

- Используем `aria-expanded` для tree nodes
- `role="grid"` для таблицы
- `role="row"`, `role="gridcell"` для строк/ячеек

### Color Contrast

- Все текстовые элементы имеют контраст ≥ 4.5:1
- Progress colors различимы для цветослепых (разная яркость)
