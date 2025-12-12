# Resource Graph Module

Модуль графика ресурсов — визуализация иерархии проектов с timeline, плановой и фактической готовностью.

## К разработке

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

### Плановая готовность

- **Таблица:** `section_readiness_checkpoints`
- **Данные:** дата + процент готовности (0-100)
- **Визуализация:** линейный график (SVG) с точками
- **Цвет:** зелёный (#10b981)

### Фактическая готовность

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
│       └── ActualReadinessBars.tsx # Столбики фактической
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
SECTION_ROW_HEIGHT = 56  // Двухстрочная строка раздела
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
