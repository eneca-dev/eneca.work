# Модуль budgets-page

Отображает иерархию проектов с бюджетами в виде таблицы. Интегрирован в модуль tasks как вкладка "Бюджеты".

## Структура модуля

```
modules/budgets-page/
├── components/
│   ├── BudgetsViewInternal.tsx  # Главный компонент (экспортируется)
│   ├── BudgetsHierarchy.tsx     # Таблица иерархии с expand/collapse
│   ├── BudgetRow.tsx            # Строка узла иерархии
│   ├── BudgetBars.tsx           # Прогресс-бары по типам бюджетов
│   └── index.ts
├── hooks/
│   ├── use-budgets-hierarchy.ts # Хук объединения данных
│   └── index.ts
├── types/
│   └── index.ts                 # Типы модуля
└── index.ts                     # Публичный API
```

## Использование

```tsx
import { BudgetsViewInternal } from '@/modules/budgets-page'

// Внутри TasksView:
<BudgetsViewInternal
  filterString={filterString}
  queryParams={queryParams}
  filterConfig={TASKS_FILTER_CONFIG}
/>
```

## Источники данных

Модуль объединяет данные из двух существующих хуков:

1. **useResourceGraphData** - иерархия проектов (project → object → section → decomposition_stage)
2. **useBudgets** - все активные бюджеты

### Связь бюджетов с иерархией

Бюджеты привязываются к узлам через `entity_type` и `entity_id`:
- `project:uuid` → проект
- `object:uuid` → объект
- `section:uuid` → раздел

> **Note:** Стадия (stage) теперь является параметром проекта, а не отдельным уровнем иерархии.

## Типы

### HierarchyNode

```typescript
interface HierarchyNode {
  id: string
  name: string
  type: 'project' | 'object' | 'section' | 'decomposition_stage' | 'decomposition_item'
  budgets: BudgetInfo[]           // Собственные бюджеты узла
  aggregatedBudgets: AggregatedBudgetsByType[]  // Агрегированные (включая детей)
  plannedHours?: number
  children: HierarchyNode[]
  entityType: BudgetPageEntityType  // 'project' | 'object' | 'section' (без 'stage')
}
```

### AggregatedBudgetsByType

```typescript
interface AggregatedBudgetsByType {
  type_id: string
  type_name: string
  type_color: string
  total_planned: number
  total_spent: number
  percentage: number  // spent / planned * 100
}
```

## Агрегация бюджетов

Бюджеты агрегируются снизу вверх:
1. Каждый узел показывает **сумму своих бюджетов + всех дочерних**
2. Группировка по `type_id` (типу бюджета)
3. Прогресс-бары показывают процент освоения по каждому типу

## Аналитика

Панель аналитики внизу показывает:
- Количество проектов
- Количество бюджетов
- Общий план (BYN)
- Общий факт (BYN)
- Процент освоения

## Фильтрация

Модуль использует те же фильтры, что и Kanban/Timeline:
- `subdivision_id` - подразделение
- `department_id` - отдел
- `team_id` - команда
- `responsible_id` - ответственный
- `project_id` - проект
- `tag_id` - метки

## Зависимости

- `@/modules/resource-graph` - иерархия проектов
- `@/modules/budgets` - данные бюджетов
- `@/modules/inline-filter` - типы фильтров
