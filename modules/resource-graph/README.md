# Resource Graph Module

Модуль графика ресурсов — визуализация иерархии проектов с timeline, плановой и фактической готовностью.

---

## Принципы дизайна

Модуль следует принципам **минималистичного интерфейса** с двумя стилями компонентов, оптимизированными для тёмной темы.

### Два стиля компонентов

#### 1. Glass-Morphic стиль (для Work Logs, дат)

Прозрачные элементы с эффектом стекла:
- **Прозрачные фоны** с градиентами: `from-white/[0.08] to-white/[0.03]`
- **Тонкие границы** с низкой прозрачностью: `border-white/[0.12]`
- **Backdrop blur** для эффекта стекла: `backdrop-blur-sm`
- **Hover эффекты** — усиление прозрачности и мягкое свечение

#### 2. Solid Chip стиль (для Loadings, статусов)

Цветные чипы без эффектов стекла:
- **Заливка фона** с низкой прозрачностью: `${color}1A` (10%)
- **Цветная рамка**: `${color}40` (25%)
- **Цветной текст**: `color: ${color}`
- **Минимальные скругления**: `rounded` (4px), НЕ `rounded-full`
- **Простой hover**: `hover:brightness-110`

### Ключевые принципы

#### 1. Минимализм
- Показывать только **ключевую информацию**, детали — в tooltip
- **Агрегация данных** — группировать по дням вместо множества отдельных блоков
- **Компактные элементы** — пилюли 18-22px высотой
- Избегать visual clutter — один элемент на ячейку дня

#### 2. Цвета по сущностям
- **Сотрудники** — уникальный цвет из палитры на основе ID (один человек = один цвет везде)
- **Статусы** — цвет из базы данных
- **Периоды** — полупрозрачная заливка цветом статуса

#### 3. Цветовая палитра

```css
/* Палитра для сотрудников */
--employee-colors: [
  '#3b82f6', /* blue */
  '#8b5cf6', /* violet */
  '#06b6d4', /* cyan */
  '#22c55e', /* green */
  '#f59e0b', /* amber */
  '#ef4444', /* red */
  '#ec4899', /* pink */
  '#14b8a6', /* teal */
  '#f97316', /* orange */
  '#6366f1', /* indigo */
];

/* Текст */
--text-primary: rgba(255, 255, 255, 0.9);
--text-secondary: rgba(255, 255, 255, 0.6);
--text-muted: rgba(255, 255, 255, 0.4);

/* Tooltip */
--tooltip-bg: rgba(24, 24, 27, 0.95);
```

#### 4. Типографика

- **Основной текст**: 10-11px, `font-medium`
- **Числа**: `tabular-nums` для выравнивания
- **Ставки**: показывать как число (0.5, 1), не дроби
- **Вторичный текст**: `text-white/40` или `opacity-70`

#### 5. Динамическая высота строк

- Строка увеличивается если элементов много (загрузки, work logs)
- Базовая высота 40px, увеличивается на 21px за каждый элемент

### Примеры компонентов

#### Loading Chip (Solid стиль)
```tsx
<div
  className="
    flex items-center gap-1 px-1
    rounded                           /* НЕ rounded-full! */
    transition-colors duration-150
    hover:brightness-110
  "
  style={{
    backgroundColor: `${color}1A`,    // 10% opacity
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: `${color}40`,        // 25% opacity
  }}
>
  <div className="shrink-0 rounded" style={{ backgroundColor: `${color}30` }}>
    {/* Avatar или инициалы */}
  </div>
  <span style={{ color }}>{lastName}</span>
  <span style={{ color }} className="opacity-70">{rate}</span>
</div>
```

#### Glass Pill (Work Log Marker)
```tsx
<div className="
  h-[22px] rounded-md
  bg-gradient-to-b from-white/[0.08] to-white/[0.03]
  border border-white/[0.12]
  backdrop-blur-sm
  transition-all duration-200
  group-hover:from-white/[0.12] group-hover:to-white/[0.06]
  group-hover:border-white/[0.2]
  group-hover:shadow-[0_0_12px_rgba(255,255,255,0.08)]
">
  <span className="text-[10px] font-medium text-white/90 tabular-nums">
    {hours}
  </span>
</div>
```

#### Status Chip (Solid стиль)
```tsx
<span
  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium"
  style={{
    backgroundColor: `${color}1A`,  // 10% opacity
    borderColor: `${color}59`,      // 35% opacity
    color: color,
  }}
>
  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
  {statusName}
</span>
```

#### Glass Tooltip
```tsx
<TooltipContent className="
  bg-zinc-900/95 backdrop-blur-xl
  border border-white/10
  shadow-xl shadow-black/40
  rounded-lg px-3 py-2.5
">
  {/* Content */}
</TooltipContent>
```

#### ProgressCircle (SVG кольцо с процентом)
```tsx
interface ProgressCircleProps {
  progress: number      // 0-100
  size?: number         // default: 24
  strokeWidth?: number  // default: 2.5
  color?: string        // hex цвет (опционально)
}

function ProgressCircle({ progress, size = 24, strokeWidth = 2.5, color }: ProgressCircleProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (progress / 100) * circumference
  const progressColor = color || getProgressColor(progress)

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background ring */}
        <circle cx={size / 2} cy={size / 2} r={radius}
          fill="transparent" stroke="currentColor"
          strokeWidth={strokeWidth} className="text-white/10" />
        {/* Progress ring */}
        <circle cx={size / 2} cy={size / 2} r={radius}
          fill="transparent" stroke={progressColor}
          strokeWidth={strokeWidth} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} />
      </svg>
      {/* Percentage inside */}
      <span className="absolute inset-0 flex items-center justify-center text-[8px] font-medium"
        style={{ color: progressColor }}>
        {Math.round(progress)}
      </span>
    </div>
  )
}

// Цветовая градация по прогрессу
function getProgressColor(progress: number): string {
  if (progress >= 80) return '#22c55e'  // green
  if (progress >= 50) return '#f59e0b'  // amber
  if (progress >= 20) return '#f97316'  // orange
  return '#ef4444'                       // red
}
```

---

## К разработке

- [ ] **stage_readiness_snapshots** — таблица для хранения истории готовности этапов
  - Структура: `(id, stage_id, snapshot_date, readiness_value, created_at)`
  - Функция `calculate_stage_readiness(stage_id)` для расчёта
  - Функция `create_daily_stage_readiness_snapshots(date)` для pg_cron
- [ ] pg_cron для автоматического создания снэпшотов фактической готовности
- [ ] UI для ввода/редактирования плановой готовности (checkpoints)
- [ ] Drag-and-drop для изменения сроков
- [ ] Модальные окна редактирования раздела
- [ ] Экспорт данных (Excel, PDF)
- [ ] Группировка по ответственному / отделу
- [ ] Сравнение план/факт готовности

---

## Страница

```
/resource-graph
```

## Реализованный функционал

### Timeline

- **Временная шкала** — 180 дней (30 дней назад + 150 вперёд)
- **Ячейки дней** с подсветкой:
  - Серый фон — стандартные выходные (Сб/Вс)
  - Жёлтый фон — праздники и перенесённые выходные
  - Синий фон — сегодняшний день
- **Sticky header** — заголовок с датами фиксируется при скролле
- **Синхронизация скролла** между header и content

### Иерархия данных

```
Проект (Project)
  └─ Стадия (Stage)
      └─ Объект (Object)
          └─ Раздел (Section) ← двухстрочный layout
              └─ Этап декомпозиции (DecompositionStage)
                  └─ Элемент декомпозиции (DecompositionItem)
```

### Раздел (Section Row)

Двухстрочный layout:
- **Строка 1:** Chevron + Avatar ответственного + Название раздела
- **Строка 2:** Status chip (outlined style) + Даты (ДД.ММ — ДД.ММ)
- **Фоновая заливка** периода раздела (полупрозрачная)

### Объект (Object Row) — Агрегированные метрики

Объект отображает **агрегированные графики** из всех своих разделов:
- **Плановая готовность** — пунктирная зелёная линия
- **Фактическая готовность** — синяя область
- **Расходование бюджета** — оранжевая область

#### Поведение при развороте:
- **Свёрнут** → графики цветные (полная opacity)
- **Развёрнут** → графики серые и полупрозрачные (`opacity-30 saturate-50`)

#### Алгоритм агрегации плановой готовности

**Проблема:** Разные разделы имеют чекпоинты на разные даты. Простое взвешенное среднее по датам даёт скачки.

**Решение:** Интерполяция + монотонный рост.

```
Для каждой ключевой даты (все чекпоинты + начало/конец всех разделов):
  1. Для каждого раздела интерполируем план на эту дату:
     ├── До startDate раздела → 0%
     ├── После endDate раздела → 100%
     └── Внутри периода:
         ├── Между чекпоинтами → линейная интерполяция
         ├── До первого чекпоинта → от 0% к первому чекпоинту
         └── После последнего чекпоинта → от последнего к 100%

  2. Вычисляем взвешенное среднее:
     value = Σ(plan_раздела × плановые_часы_раздела) / Σ(плановые_часы)

  3. Гарантируем монотонный рост:
     if value[i] < value[i-1] → value[i] = value[i-1]
```

**Результат:** План плавно растёт от 0% до 100%, без скачков вниз.

#### Веса для агрегации

Вес каждого раздела = сумма `plannedHours` всех его элементов декомпозиции:
```typescript
sectionWeight = Σ(item.plannedHours) для всех items во всех stages раздела
```

Если ни у одного раздела нет плановых часов — используются равные веса.

#### Агрегация фактической готовности и бюджета

Фактическая готовность и бюджет агрегируются проще — взвешенное среднее только по тем датам, где есть данные:
```
value = Σ(actual_раздела × вес_раздела) / Σ(весов_разделов_с_данными)
```

### Плановая готовность

- **Таблица:** `section_readiness_checkpoints`
- **Данные:** дата + процент готовности (0-100)
- **Визуализация:** линейный график (SVG) с точками
- **Цвет:** зелёный (#10b981)

### Фактическая готовность (Section)

- **Таблица:** `section_readiness_snapshots`
- **Расчёт:** взвешенное среднее по `planned_hours`
  - Items → Stages: `SUM(progress * planned_hours) / SUM(planned_hours)`
  - Stages → Section: аналогично
- **Функции PostgreSQL:**
  - `calculate_section_readiness(section_id)` — расчёт текущей готовности
  - `create_daily_readiness_snapshots(date)` — создание снэпшотов
- **Визуализация:** вертикальные столбики в каждой ячейке дня
- **Цветовая градация:**
  - Зелёный (80%+)
  - Жёлтый (50-79%)
  - Оранжевый (20-49%)
  - Красный (<20%)

### Готовность этапа декомпозиции (DecompositionStage)

- **Расчёт:** client-side, взвешенное среднее по элементам
  - Формула: `SUM(item.progress * item.plannedHours) / SUM(item.plannedHours)`
- **Визуализация:** `ProgressCircle` — круговой индикатор с процентом внутри
- **Цвет кольца:** берётся из статуса этапа (`stage.status.color`)
- **Отображение часов:** `{факт}/{план}` рядом с кольцом
- **Даты:** компактный формат `ДД.ММ — ДД.ММ`

### Элемент декомпозиции (DecompositionItem)

- **Визуализация:** `ProgressCircle` с процентом прогресса
- **Цвет кольца:** градация по значению прогресса
- **Отображение часов:** `{факт}/{план}` (факт считается из work logs)
- **Текст:** уменьшенный (`text-[11px]`) для длинных названий

### Фильтрация (InlineFilter)

GitHub Projects-style фильтр:
```
подразделение:"ОВ" проект:"Название" метка:"Важное"
```

Поддерживаемые фильтры:
- `подразделение` / `subdivision`
- `отдел` / `department`
- `проект` / `project`
- `метка` / `tag`

### Календарь компании

- **Праздники** — отмечаются жёлтым фоном
- **Переносы** — рабочие субботы / выходные будни
- **Кеширование** — 24 часа (staleTime: eternal)

---

## Структура модуля

```
modules/resource-graph/
├── index.ts                    # Public API
├── README.md                   # Документация
├── types/
│   └── index.ts               # Типы данных
├── actions/
│   └── index.ts               # Server Actions (6 actions)
├── hooks/
│   └── index.ts               # Query хуки (cache module)
├── filters/
│   ├── index.ts               # Экспорты
│   └── useFilterOptions.ts    # Хуки для автокомплита
├── stores/
│   └── index.ts               # Zustand stores + filter config
├── components/
│   ├── index.ts               # Экспорты
│   ├── ResourceGraph.tsx      # Главный компонент
│   └── timeline/
│       ├── index.ts
│       ├── ResourceGraphTimeline.tsx
│       ├── TimelineHeader.tsx
│       ├── TimelineRow.tsx    # Все row компоненты
│       ├── TimelineBar.tsx    # Бар периода
│       ├── ReadinessGraph.tsx # Линия плановой готовности
│       └── StageReadinessArea.tsx # Area chart готовности этапов
├── utils/
│   └── index.ts               # Утилиты трансформации
└── constants/
    └── index.ts               # UI константы
```

---

## Интеграция с Cache Module

### Server Actions

| Action | Описание |
|--------|----------|
| `getResourceGraphData(filters)` | Основные данные с фильтрацией |
| `getUserWorkload(userId)` | Загрузка пользователя |
| `getProjectTags()` | Теги проектов |
| `getOrgStructure()` | Орг. структура для фильтров |
| `getProjectStructure()` | Проектная структура для фильтров |
| `getCompanyCalendarEvents()` | Праздники и переносы |

### Query Hooks

```typescript
import {
  useResourceGraphData,
  useUserWorkload,
  useCompanyCalendarEvents
} from '@/modules/resource-graph'

// С фильтрами
const { data, isLoading } = useResourceGraphData({
  project_id: 'xxx'
})

// Загрузка пользователя
const { data } = useUserWorkload('user-id')

// Календарь (кеш 24ч)
const { data: events } = useCompanyCalendarEvents()
```

### Query Keys

```typescript
// modules/cache/keys/query-keys.ts
resourceGraph: {
  all: ['resource-graph'],
  lists: () => [...all, 'list'],
  list: (filters) => [...lists(), filters],
  user: (userId) => [...all, 'user', userId],
}
```

### Realtime Subscriptions

| Таблица | Инвалидирует |
|---------|--------------|
| `sections` | `resourceGraph.all` |
| `decomposition_stages` | `resourceGraph.all` |
| `decomposition_items` | `resourceGraph.all` |
| `section_readiness_checkpoints` | `resourceGraph.all` |
| `section_readiness_snapshots` | `resourceGraph.all` |

---

## Database

### Views

- **`v_resource_graph`** — полная иерархия с JSONB агрегацией готовности

### Tables

| Таблица | Описание |
|---------|----------|
| `section_readiness_checkpoints` | Плановая готовность (date, value) |
| `section_readiness_snapshots` | Фактическая готовность (date, value) |

### Functions

```sql
-- Расчёт текущей готовности раздела
SELECT calculate_section_readiness('section-uuid');
-- Returns: INTEGER (0-100)

-- Создание снэпшотов за дату
SELECT * FROM create_daily_readiness_snapshots('2024-01-15');
-- Returns: TABLE(section_id, readiness, action)
```

---

## Константы

```typescript
// constants/index.ts
ROW_HEIGHT = 40          // Обычная строка
OBJECT_ROW_HEIGHT = 56   // Строка объекта (с агрегированными графиками)
SECTION_ROW_HEIGHT = 56  // Двухстрочная строка раздела
STAGE_ROW_HEIGHT = 64    // Строка этапа декомпозиции
DAY_CELL_WIDTH = 36      // Ширина ячейки дня
SIDEBAR_WIDTH = 320      // Ширина боковой панели
```

---

## Использование

### Импорт компонента

```tsx
import { ResourceGraph } from '@/modules/resource-graph'

export default function Page() {
  return <ResourceGraph />
}
```

### Импорт хуков

```tsx
import {
  useResourceGraphData,
  useCompanyCalendarEvents
} from '@/modules/resource-graph'

function MyComponent() {
  const { data: projects, isLoading } = useResourceGraphData({
    subdivision_id: 'xxx'
  })

  const { data: calendarEvents } = useCompanyCalendarEvents()

  // ...
}
```

### Импорт stores

```tsx
import {
  useDisplaySettingsStore,
  useFiltersStore,
  RESOURCE_GRAPH_FILTER_CONFIG
} from '@/modules/resource-graph'

function Toolbar() {
  const { filterString, setFilterString } = useFiltersStore()
  const { settings } = useDisplaySettingsStore()

  // ...
}
```

---

## Типы

### Domain Types

```typescript
interface Project {
  id: string
  name: string
  status: ProjectStatusType | null
  manager: { id, firstName, lastName, name }
  stages: Stage[]
}

interface Section {
  id: string
  name: string
  startDate: string | null
  endDate: string | null
  responsible: { id, firstName, lastName, name, avatarUrl }
  status: { id, name, color }
  readinessCheckpoints: ReadinessPoint[]  // Плановая
  actualReadiness: ReadinessPoint[]       // Фактическая
  decompositionStages: DecompositionStage[]
}

interface ReadinessPoint {
  date: string   // 'YYYY-MM-DD'
  value: number  // 0-100
}
```

### Filter Types

```typescript
interface FilterQueryParams {
  subdivision_id?: string
  department_id?: string
  project_id?: string
  tag_id?: string | string[]
}
```

---

## Утилиты

```typescript
import {
  createTimelineRange,
  generateTimelineDates,
  transformRowsToHierarchy,
  buildCalendarMap,
  getDayInfo,
} from '@/modules/resource-graph'

// Трансформация плоских данных в иерархию
const projects = transformRowsToHierarchy(rows)

// Карта праздников/переносов
const calendarMap = buildCalendarMap(events)

// Информация о дне
const dayInfo = getDayInfo(new Date(), calendarMap)
// { isHoliday, holidayName, isWorkday, isTransferredWorkday, ... }
```
