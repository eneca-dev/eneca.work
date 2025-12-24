# Budget Management Module

Модуль управления бюджетами проектов. Предназначен для планирования трудозатрат, расчёта стоимости работ и контроля бюджета проектной документации.

## Статус

🎨 **Дизайн-макет готов** → 🚧 Требуется интеграция с БД

## Быстрый старт

```tsx
import { BudgetTable } from '@/modules/budget-management'

export default function BudgetPage() {
  return <BudgetTable />
}
```

## Компоненты

### BudgetTable

Основной компонент — иерархическая таблица декомпозиции бюджета.

**Функции:**
- ✅ Expandable tree structure (Section → Stage → Item)
- ✅ Dynamic work category columns
- ✅ Budget calculations with aggregation
- ✅ Progress tracking with ProgressCircle
- ✅ Sticky header & summary footer
- ⏳ Inline editing (planned)
- ⏳ Real data integration (planned)

**Визуальные элементы:**
- Dark theme (zinc-950 base)
- Glass-morphic backdrop blur on header/footer
- Solid color chips for categories
- Tabular numbers for data alignment
- Hover states on all interactive elements

## Структура данных

### Иерархия (из БД)

```
Project
└── Stage (stages)
    └── Object (objects)
        └── Section (sections) ← бюджет привязан сюда
            └── DecompositionStage (decomposition_stages)
                └── DecompositionItem (decomposition_items) ← трудозатраты
```

### Колонки таблицы

| Группа | Колонки | Источник данных |
|--------|---------|-----------------|
| **Структура** | Section, Stage, Item name | hierarchy |
| **Трудозатраты** | По категориям (УПР, М200, М300...), Всего | decomposition_items.planned_hours |
| **Бюджет** | %, План, Факт, Ставка | budgets, budget_versions, work_logs |
| **Планирование** | Специалисты, Старт, Дней, Финиш | decomposition_stages |
| **Прогресс** | %, Факт/План часов | decomposition_items.progress, work_logs |

### Категории работ (work_categories)

| Код | Название | Цвет |
|-----|----------|------|
| УПР | Управление | #8b5cf6 (violet) |
| М200 | Моделирование 200 | #3b82f6 (blue) |
| М300 | Моделирование 300 | #06b6d4 (cyan) |
| РСЧ | Расчёт | #22c55e (green) |
| ПРТ | Проектирование | #f59e0b (amber) |
| ОФМ | Оформление | #ef4444 (red) |

## Документация

- [Структура Excel-шаблона](./docs/excel-template-structure.md) — описание формата импорта
- [Дизайн-система](./docs/design-system.md) — визуальные стандарты модуля

## Планируемый функционал

### Фаза 1: Интеграция с БД ⏳
- [ ] Server Actions для получения данных
- [ ] Query hooks с кэшированием (cache module)
- [ ] Realtime subscriptions

### Фаза 2: Редактирование
- [ ] Inline editing для planned_hours
- [ ] Date pickers для сроков
- [ ] Drag-and-drop для переноса items

### Фаза 3: Расширенные функции
- [ ] Импорт из Excel
- [ ] Экспорт в Excel/PDF
- [ ] Фильтрация через InlineFilter
- [ ] Группировка по категориям

## Константы

```typescript
// Размеры
SIDEBAR_WIDTH = 400
ROW_HEIGHT_SECTION = 56
ROW_HEIGHT_STAGE = 44
ROW_HEIGHT_ITEM = 40

// Ширина колонок
COLUMN_WIDTHS = {
  workCategory: 60,
  total: 70,
  percentage: 60,
  budget: 90,
  rate: 70,
  specialists: 50,
  date: 70,
  duration: 60,
  progress: 50,
  hours: 80,
}
```

## Связанные модули

- `modules/resource-graph` — визуальный стиль, timeline компоненты
- `modules/planning` — загрузки сотрудников
- `modules/cache` — кэширование данных
- `modules/inline-filter` — фильтрация

## Структура модуля

```
modules/budget-management/
├── README.md
├── index.ts                           # Public API
├── components/
│   ├── index.ts
│   └── BudgetTable.tsx               # Главный компонент (MOCKUP)
├── docs/
│   ├── excel-template-structure.md   # Формат Excel
│   └── design-system.md              # Визуальные стандарты
├── types/                            # TypeScript типы (TODO)
├── hooks/                            # Query хуки (TODO)
├── actions/                          # Server Actions (TODO)
└── stores/                           # Zustand stores (TODO)
```
