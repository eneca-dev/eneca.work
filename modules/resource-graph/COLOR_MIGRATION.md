# Resource Graph - План миграции цветов

## Обзор

Модуль `resource-graph` содержит ~150 захардкоженных цветов, которые нужно перевести на CSS-переменные для поддержки единой дизайн-системы и будущих тем.

---

## Фаза 1: Определение CSS-переменных

### 1.1 Новые переменные в `globals.css`

```css
@layer base {
  :root {
    /* ============================================
       Семантические цвета статусов
       ============================================ */
    --success: 142 76% 36%;           /* #22c55e - emerald-500 */
    --success-foreground: 0 0% 100%;
    --warning: 38 92% 50%;            /* #f59e0b - amber-500 */
    --warning-foreground: 0 0% 0%;
    --error: 0 84% 60%;               /* #ef4444 - red-500 */
    --error-foreground: 0 0% 100%;
    --info: 217 91% 60%;              /* #3b82f6 - blue-500 */
    --info-foreground: 0 0% 100%;

    /* ============================================
       Цвета графиков (charts)
       ============================================ */
    --chart-1: 217 91% 60%;           /* blue-500 - фактическая готовность */
    --chart-2: 160 84% 39%;           /* emerald-500 - плановая готовность */
    --chart-3: 24 95% 53%;            /* orange-500 - бюджет */
    --chart-4: 0 84% 60%;             /* red-500 - перерасход */
    --chart-5: 271 91% 65%;           /* violet-500 - доп. серия */
    --chart-6: 189 94% 43%;           /* cyan-500 - доп. серия */
    --chart-7: 330 81% 60%;           /* pink-500 - доп. серия */
    --chart-8: 173 80% 40%;           /* teal-500 - доп. серия */
    --chart-9: 262 83% 58%;           /* indigo-500 - доп. серия */
    --chart-10: 142 76% 36%;          /* green-500 - доп. серия */

    /* ============================================
       Цвета прогресса (progress gradient)
       ============================================ */
    --progress-excellent: 142 76% 36%;  /* >= 80% - green */
    --progress-good: 38 92% 50%;        /* >= 50% - amber */
    --progress-warning: 24 95% 53%;     /* >= 20% - orange */
    --progress-critical: 0 84% 60%;     /* < 20% - red */

    /* ============================================
       Цвета ставок загрузки (loading rates)
       ============================================ */
    --rate-25: 217 91% 77%;           /* blue-200 */
    --rate-50: 217 91% 60%;           /* blue-400 */
    --rate-75: 217 91% 54%;           /* blue-500 */
    --rate-100: 217 91% 48%;          /* blue-600 */

    /* ============================================
       Цвета статусов загрузки
       ============================================ */
    --loading-planned: var(--muted-foreground);
    --loading-approved: 142 76% 36%;   /* green-500 */
    --loading-rejected: 0 84% 60%;     /* red-500 */

    /* ============================================
       Специальные дни календаря
       ============================================ */
    --day-special: 38 92% 50%;         /* amber - праздники/перенесённые */
    --day-weekend: var(--muted);
    --day-today: var(--primary);

    /* ============================================
       Нейтральный/неназначенный
       ============================================ */
    --unassigned: 220 9% 46%;          /* gray-500 #6b7280 */
  }

  .dark {
    /* Семантические - чуть ярче для dark mode */
    --success: 142 71% 45%;
    --warning: 38 92% 50%;
    --error: 0 91% 71%;
    --info: 217 91% 65%;

    /* Графики - те же или чуть ярче */
    --chart-1: 217 91% 65%;
    --chart-2: 160 84% 45%;
    --chart-3: 24 95% 58%;
    --chart-4: 0 91% 71%;

    /* Прогресс */
    --progress-excellent: 142 71% 45%;
    --progress-good: 38 92% 50%;
    --progress-warning: 24 95% 58%;
    --progress-critical: 0 91% 71%;

    /* Ставки - инвертированная яркость для dark */
    --rate-25: 217 91% 30%;
    --rate-50: 217 91% 40%;
    --rate-75: 217 91% 50%;
    --rate-100: 217 91% 60%;

    /* Специальные дни */
    --day-special: 38 92% 45%;
  }
}
```

### 1.2 Обновление `tailwind.config.ts`

```ts
// tailwind.config.ts
extend: {
  colors: {
    // Существующие...

    // Семантические
    success: {
      DEFAULT: "hsl(var(--success))",
      foreground: "hsl(var(--success-foreground))",
    },
    warning: {
      DEFAULT: "hsl(var(--warning))",
      foreground: "hsl(var(--warning-foreground))",
    },
    error: {
      DEFAULT: "hsl(var(--error))",
      foreground: "hsl(var(--error-foreground))",
    },
    info: {
      DEFAULT: "hsl(var(--info))",
      foreground: "hsl(var(--info-foreground))",
    },

    // Графики
    chart: {
      1: "hsl(var(--chart-1))",
      2: "hsl(var(--chart-2))",
      3: "hsl(var(--chart-3))",
      4: "hsl(var(--chart-4))",
      5: "hsl(var(--chart-5))",
      6: "hsl(var(--chart-6))",
      7: "hsl(var(--chart-7))",
      8: "hsl(var(--chart-8))",
      9: "hsl(var(--chart-9))",
      10: "hsl(var(--chart-10))",
    },

    // Прогресс
    progress: {
      excellent: "hsl(var(--progress-excellent))",
      good: "hsl(var(--progress-good))",
      warning: "hsl(var(--progress-warning))",
      critical: "hsl(var(--progress-critical))",
    },

    // Ставки
    rate: {
      25: "hsl(var(--rate-25))",
      50: "hsl(var(--rate-50))",
      75: "hsl(var(--rate-75))",
      100: "hsl(var(--rate-100))",
    },

    // Специальные
    unassigned: "hsl(var(--unassigned))",
    "day-special": "hsl(var(--day-special))",
  },
}
```

---

## Фаза 2: Утилиты для цветов

### 2.1 Создать `modules/resource-graph/utils/colors.ts`

```ts
/**
 * Resource Graph - Color Utilities
 *
 * Централизованные функции для получения цветов.
 * Все цвета берутся из CSS-переменных.
 */

// ============================================================================
// CSS Variable Getters
// ============================================================================

/**
 * Получить значение CSS-переменной как HSL строку
 */
export function getCssVar(name: string): string {
  if (typeof window === 'undefined') {
    // SSR fallback - вернуть дефолт
    return 'hsl(0 0% 50%)'
  }
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(`--${name}`)
    .trim()
  return value ? `hsl(${value})` : 'hsl(0 0% 50%)'
}

// ============================================================================
// Progress Colors
// ============================================================================

export type ProgressLevel = 'excellent' | 'good' | 'warning' | 'critical'

/**
 * Уровень прогресса на основе значения (0-100)
 */
export function getProgressLevel(progress: number): ProgressLevel {
  if (progress >= 80) return 'excellent'
  if (progress >= 50) return 'good'
  if (progress >= 20) return 'warning'
  return 'critical'
}

/**
 * Цвет прогресса как CSS переменная
 *
 * @example
 * getProgressColor(85) // "hsl(var(--progress-excellent))"
 */
export function getProgressColor(progress: number): string {
  const level = getProgressLevel(progress)
  return `hsl(var(--progress-${level}))`
}

/**
 * Tailwind класс для цвета прогресса
 *
 * @example
 * getProgressClass(85, 'text') // "text-progress-excellent"
 * getProgressClass(30, 'bg') // "bg-progress-warning"
 */
export function getProgressClass(progress: number, prefix: 'text' | 'bg' | 'border' = 'text'): string {
  const level = getProgressLevel(progress)
  return `${prefix}-progress-${level}`
}

// ============================================================================
// Chart Colors
// ============================================================================

/**
 * Цвет графика по индексу (1-10)
 */
export function getChartColor(index: number): string {
  const safeIndex = ((index - 1) % 10) + 1
  return `hsl(var(--chart-${safeIndex}))`
}

/**
 * Tailwind класс для цвета графика
 */
export function getChartClass(index: number, prefix: 'text' | 'bg' | 'border' | 'stroke' | 'fill' = 'bg'): string {
  const safeIndex = ((index - 1) % 10) + 1
  return `${prefix}-chart-${safeIndex}`
}

// ============================================================================
// Employee Colors (используют chart palette)
// ============================================================================

/**
 * Цвет сотрудника на основе его ID
 * Использует палитру графиков для консистентности
 */
export function getEmployeeColor(employeeId: string | null): string {
  if (!employeeId) return 'hsl(var(--unassigned))'

  // Простой хеш для получения индекса
  let hash = 0
  for (let i = 0; i < employeeId.length; i++) {
    hash = ((hash << 5) - hash) + employeeId.charCodeAt(i)
    hash = hash & hash
  }

  const index = (Math.abs(hash) % 10) + 1
  return `hsl(var(--chart-${index}))`
}

/**
 * Tailwind класс для цвета сотрудника
 */
export function getEmployeeClass(employeeId: string | null, prefix: 'text' | 'bg' | 'border' = 'bg'): string {
  if (!employeeId) return `${prefix}-unassigned`

  let hash = 0
  for (let i = 0; i < employeeId.length; i++) {
    hash = ((hash << 5) - hash) + employeeId.charCodeAt(i)
    hash = hash & hash
  }

  const index = (Math.abs(hash) % 10) + 1
  return `${prefix}-chart-${index}`
}

// ============================================================================
// Semantic Colors
// ============================================================================

export type SemanticType = 'success' | 'warning' | 'error' | 'info'

/**
 * Семантический цвет
 */
export function getSemanticColor(type: SemanticType): string {
  return `hsl(var(--${type}))`
}

/**
 * Tailwind класс для семантического цвета
 */
export function getSemanticClass(type: SemanticType, prefix: 'text' | 'bg' | 'border' = 'text'): string {
  return `${prefix}-${type}`
}

// ============================================================================
// Rate Colors
// ============================================================================

export type RateLevel = 25 | 50 | 75 | 100

/**
 * Цвет ставки загрузки
 */
export function getRateColor(rate: number): string {
  if (rate <= 0.25) return 'hsl(var(--rate-25))'
  if (rate <= 0.5) return 'hsl(var(--rate-50))'
  if (rate <= 0.75) return 'hsl(var(--rate-75))'
  return 'hsl(var(--rate-100))'
}

/**
 * Tailwind класс для ставки
 */
export function getRateClass(rate: number, prefix: 'bg' | 'text' | 'border' = 'bg'): string {
  if (rate <= 0.25) return `${prefix}-rate-25`
  if (rate <= 0.5) return `${prefix}-rate-50`
  if (rate <= 0.75) return `${prefix}-rate-75`
  return `${prefix}-rate-100`
}

// ============================================================================
// Budget Colors
// ============================================================================

/**
 * Цвет бюджета на основе процента использования
 */
export function getBudgetColor(percentage: number): string {
  if (percentage >= 100) return 'hsl(var(--error))'      // перерасход
  if (percentage >= 90) return 'hsl(var(--error))'       // критично
  if (percentage >= 70) return 'hsl(var(--warning))'     // внимание
  return 'hsl(var(--success))'                            // норма
}

/**
 * Tailwind класс для бюджета
 */
export function getBudgetClass(percentage: number, prefix: 'text' | 'bg' = 'text'): string {
  if (percentage >= 90) return `${prefix}-error`
  if (percentage >= 70) return `${prefix}-warning`
  return `${prefix}-success`
}
```

---

## Фаза 3: Обновление констант

### 3.1 Обновить `modules/resource-graph/constants/index.ts`

```ts
// БЫЛО:
export const RATE_COLORS = {
  0.25: 'bg-blue-200 dark:bg-blue-900',
  0.5: 'bg-blue-400 dark:bg-blue-700',
  0.75: 'bg-blue-500 dark:bg-blue-600',
  1: 'bg-blue-600 dark:bg-blue-500',
} as const

// СТАЛО:
export const RATE_COLORS = {
  0.25: 'bg-rate-25',
  0.5: 'bg-rate-50',
  0.75: 'bg-rate-75',
  1: 'bg-rate-100',
} as const

// БЫЛО:
export const LOADING_STATUS_COLORS = {
  planned: 'bg-muted-foreground/30 dark:bg-muted-foreground/40',
  approved: 'bg-green-500 dark:bg-green-600',
  rejected: 'bg-red-500 dark:bg-red-600',
} as const

// СТАЛО:
export const LOADING_STATUS_COLORS = {
  planned: 'bg-muted-foreground/30',
  approved: 'bg-success',
  rejected: 'bg-error',
} as const
```

---

## Фаза 4: Миграция компонентов

### 4.1 Приоритет файлов (от наиболее критичных)

| # | Файл | Хардкодов | Категории |
|---|------|-----------|-----------|
| 1 | `TimelineRow.tsx` | ~20 | progress, semantic, chart |
| 2 | `SectionRow.tsx` | ~15 | progress, semantic, budget |
| 3 | `DecompositionStageRow.tsx` | ~10 | progress, semantic |
| 4 | `BudgetSpendingArea.tsx` | ~5 | budget, chart |
| 5 | `ActualReadinessArea.tsx` | ~5 | chart (SVG) |
| 6 | `PlannedReadinessArea.tsx` | ~4 | chart (SVG) |
| 7 | `StageReadinessArea.tsx` | ~6 | progress, chart |
| 8 | `SectionTooltipOverlay.tsx` | ~8 | chart, budget |
| 9 | `WorkLogMarkers.tsx` | ~3 | employee |
| 10 | `TimelineHeader.tsx` | ~4 | day-special |
| 11 | `LoadingBadges.tsx` | ~5 | rate, semantic |
| 12 | `BudgetsRow.tsx` | ~8 | budget, semantic |
| 13 | `DecompositionItemRow.tsx` | ~6 | progress, semantic |
| 14 | `ProgressCircle.tsx` | ~3 | progress |
| 15 | `PeriodBackground.tsx` | ~2 | chart |
| 16 | `TimelineGrid.tsx` | ~2 | day-special |
| 17 | `ReadinessGraph.tsx` | ~5 | chart (SVG) |
| 18 | `SectionPeriodFrame.tsx` | ~4 | chart, neutral |
| 19 | `TimelineBar.tsx` | ~2 | chart |
| 20 | `ProjectStatusTags.tsx` | ~1 | dynamic |
| 21 | `ProgressHistoryMarkers.tsx` | ~2 | semantic |

### 4.2 Паттерны замены

#### Tailwind классы (текст/фон)

```tsx
// БЫЛО:
className="text-emerald-500"
className="text-red-400"
className="text-amber-500"
className="text-blue-500"
className="bg-amber-500/10"

// СТАЛО:
className="text-success"
className="text-error"
className="text-warning"
className="text-info"
className="bg-warning/10"
```

#### Inline styles с HEX

```tsx
// БЫЛО:
style={{ color: '#22c55e' }}
style={{ backgroundColor: '#ef4444' }}

// СТАЛО:
style={{ color: 'hsl(var(--success))' }}
style={{ backgroundColor: 'hsl(var(--error))' }}

// Или с утилитой:
import { getSemanticColor } from '../utils/colors'
style={{ color: getSemanticColor('success') }}
```

#### SVG элементы

```tsx
// БЫЛО:
<stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
<path stroke="#3b82f6" />

// СТАЛО (с CSS переменными напрямую):
<stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
<path stroke="hsl(var(--chart-1))" className="stroke-chart-1" />

// Или определить градиенты через CSS:
<defs>
  <linearGradient id="actual-gradient">
    <stop offset="0%" className="[stop-color:hsl(var(--chart-1))]" stopOpacity={0.3} />
    <stop offset="100%" className="[stop-color:hsl(var(--chart-1))]" stopOpacity={0.08} />
  </linearGradient>
</defs>
```

#### Условные цвета прогресса

```tsx
// БЫЛО:
const getProgressColor = (progress: number) => {
  if (progress >= 80) return '#22c55e'
  if (progress >= 50) return '#f59e0b'
  if (progress >= 20) return '#f97316'
  return '#ef4444'
}

// СТАЛО:
import { getProgressColor, getProgressClass } from '../utils/colors'

// Для inline style:
style={{ color: getProgressColor(progress) }}

// Для className:
className={getProgressClass(progress, 'text')}
```

#### Цвета сотрудников

```tsx
// БЫЛО:
import { getEmployeeColor } from '../utils'
style={{ backgroundColor: getEmployeeColor(employeeId) }}

// СТАЛО:
import { getEmployeeColor, getEmployeeClass } from '../utils/colors'

// Для inline (SVG и подобное):
style={{ fill: getEmployeeColor(employeeId) }}

// Для className:
className={getEmployeeClass(employeeId, 'bg')}
```

---

## Фаза 5: Удаление старого кода

### 5.1 Удалить из `utils/format.ts`

```ts
// УДАЛИТЬ функцию getProgressColor (перенесена в utils/colors.ts)
```

### 5.2 Удалить из `utils/index.ts`

```ts
// УДАЛИТЬ:
export const EMPLOYEE_COLORS = [...]
export function getEmployeeColor(...) {...}
// (перенесены в utils/colors.ts)
```

### 5.3 Обновить экспорты `utils/index.ts`

```ts
// ДОБАВИТЬ:
export * from './colors'
```

---

## Фаза 6: Тестирование

### 6.1 Визуальное тестирование

1. Открыть `/design-test` - проверить новые цвета
2. Открыть Resource Graph в light mode
3. Открыть Resource Graph в dark mode
4. Проверить все компоненты:
   - [ ] Timeline строки
   - [ ] Графики готовности
   - [ ] Бюджетные области
   - [ ] Бейджи загрузки
   - [ ] Тултипы
   - [ ] Work log маркеры
   - [ ] Чекпоинты

### 6.2 Функциональное тестирование

- [ ] Прогресс корректно меняет цвет
- [ ] Ставки загрузки визуально различимы
- [ ] Сотрудники получают консистентные цвета
- [ ] Бюджеты показывают правильные статусы

---

## Чек-лист выполнения

### Подготовка
- [ ] Добавить CSS переменные в `globals.css`
- [ ] Обновить `tailwind.config.ts`
- [ ] Создать `utils/colors.ts`

### Миграция констант
- [ ] Обновить `constants/index.ts`

### Миграция компонентов (по приоритету)
- [ ] TimelineRow.tsx
- [ ] SectionRow.tsx
- [ ] DecompositionStageRow.tsx
- [ ] BudgetSpendingArea.tsx
- [ ] ActualReadinessArea.tsx
- [ ] PlannedReadinessArea.tsx
- [ ] StageReadinessArea.tsx
- [ ] SectionTooltipOverlay.tsx
- [ ] WorkLogMarkers.tsx
- [ ] TimelineHeader.tsx
- [ ] LoadingBadges.tsx
- [ ] BudgetsRow.tsx
- [ ] DecompositionItemRow.tsx
- [ ] ProgressCircle.tsx
- [ ] PeriodBackground.tsx
- [ ] TimelineGrid.tsx
- [ ] ReadinessGraph.tsx
- [ ] SectionPeriodFrame.tsx
- [ ] TimelineBar.tsx
- [ ] ProjectStatusTags.tsx
- [ ] ProgressHistoryMarkers.tsx

### Утилиты
- [ ] Удалить старый `getProgressColor` из `format.ts`
- [ ] Удалить `EMPLOYEE_COLORS` и `getEmployeeColor` из `utils/index.ts`
- [ ] Добавить экспорт `colors.ts` в `utils/index.ts`

### Тестирование
- [ ] Light mode
- [ ] Dark mode
- [ ] Все компоненты визуально корректны
- [ ] `npm run build` проходит

---

## Оценка трудозатрат

| Фаза | Файлов | Оценка |
|------|--------|--------|
| Фаза 1-2 (Переменные + Утилиты) | 3 | ~30 мин |
| Фаза 3 (Константы) | 1 | ~10 мин |
| Фаза 4 (Компоненты) | 21 | ~3-4 часа |
| Фаза 5 (Очистка) | 2 | ~10 мин |
| Фаза 6 (Тестирование) | - | ~30 мин |
| **Итого** | **27** | **~5 часов** |

---

## Примечания

1. **SVG градиенты** - самая сложная часть, т.к. CSS переменные в SVG требуют особого синтаксиса
2. **Backward compatibility** - после миграции старые хардкоды перестанут работать
3. **TypeScript** - все новые утилиты типизированы
4. **Тестирование темы** - после миграции можно легко создавать новые темы изменением CSS переменных
