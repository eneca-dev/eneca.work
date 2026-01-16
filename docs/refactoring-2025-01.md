# Рефакторинг модулей - Январь 2025

## Обзор

Проведена очистка кодовой базы от неиспользуемых и устаревших модулей.

---

## Удалённые модули и страницы

Все удалённые файлы перенесены в папку `/_deleted/` для возможного восстановления.

### Страницы (`_deleted/pages/`)

| Страница | Путь | Причина удаления |
|----------|------|------------------|
| `progress` | /dashboard/progress | Внешний iframe на project-dynamic.vercel.app |
| `settings` | /dashboard/settings | Пустая страница-заглушка |
| `task-transfer` | /dashboard/task-transfer | Функционал привязан к старому projects |
| `cache-test` | /dashboard/cache-test | Тестовая страница |
| `normokontrol` | /dashboard/normokontrol | Неиспользуемый функционал |
| `planning` | /dashboard/planning | Заменён на resource-graph |
| `projects` | /dashboard/projects | Заменён на resource-graph |

### Модули (`_deleted/modules/`)

| Модуль | Причина удаления |
|--------|------------------|
| `planning` | Устаревший, заменён на resource-graph |
| `personal-planning-graph` | Привязан к planning |
| `vacation-management` | Не используется |
| `normokontrol` | Не используется |
| `cache-test` | Тестовый модуль |
| `task-transfer` | Привязан к старым projects |
| `decomposition` | Заменён на decomposition2 |
| `decomposition-templates` | Заменён на dec-templates |
| `section-analytics` | Привязан к старым projects |
| `filter-permissions` | Только документация, нет кода |

### Компоненты projects (`_deleted/modules/projects-components/`)

Эти компоненты были удалены из модуля `projects`, так как зависели от `task-transfer`:

- `ProjectsPage.tsx`
- `ProjectsTree.tsx`
- `SectionDecompositionTab.tsx`
- `TaskTransferGuide.tsx`
- `CompactTaskSchedule.tsx`
- `SectionTasksPreview.tsx`
- `CreateObjectAssignmentModal.tsx`
- `SectionLoadingsTab.tsx`

---

## Сохранённый модуль `projects`

Модуль `modules/projects/` оставлен для бизнес-логики проектов.

### Сохранённые части:

```
modules/projects/
├── actions/          # Server Actions
├── api/              # API функции
├── components/       # Базовые компоненты (очищены от task-transfer)
├── constants/        # Константы (project-status.ts, project-tags.ts)
├── hooks/            # React хуки
├── stores/           # Zustand stores
├── types/            # TypeScript типы
├── utils/            # Утилиты (color.ts)
└── index.ts          # Публичный API
```

---

## Вынесенные общие компоненты

### 1. Типы Planning → `types/planning.ts`

Типы для планирования/таймлайнов вынесены из `modules/planning/types/` в общее место:

```typescript
// types/planning.ts
export interface Loading { ... }
export interface PlannedLoading { ... }
export interface Employee { ... }
export interface Team { ... }
export interface Department { ... }
export interface Section { ... }
export interface DecompositionStage { ... }
export type TimelineUnit = 'day' | 'week' | 'month'
// ... и другие типы
```

**Использование:**
```typescript
import type { Loading, TimelineUnit } from '@/types/planning'
```

### 2. FreshnessIndicator → `components/shared/timeline/`

Компонент индикатора свежести данных вынесен в общее место:

```
components/shared/timeline/
├── index.ts
├── FreshnessIndicator.tsx
└── loading-bars-utils.ts
```

**Использование:**
```typescript
import { FreshnessIndicator } from '@/components/shared/timeline'
import { loadingsToPeriods, calculateBarRenders } from '@/components/shared/timeline/loading-bars-utils'
```

### 3. DatePicker → `components/ui/date-picker/`

Компоненты выбора даты:

```
components/ui/date-picker/
├── index.ts
├── DatePicker.tsx
└── DateRangePicker.tsx
```

**Использование:**
```typescript
import { DatePicker, DateRangePicker, type DateRange } from '@/components/ui/date-picker'
```

### 4. Константы цветов → `lib/constants/`

```
lib/constants/
├── index.ts
├── project-status.ts    # STATUS_COLORS, STATUS_NAMES
└── color-utils.ts       # getStatusColor, getStatusName
```

**Использование:**
```typescript
import { STATUS_COLORS, getStatusColor } from '@/lib/constants'
```

---

## Обновлённые импорты

### `lib/supabase-client.ts`
```diff
- import type { Section, Loading, PlannedLoading, DecompositionStage } from "@/modules/planning/types"
+ import type { Section, Loading, PlannedLoading, DecompositionStage } from "@/types/planning"
```

### `modules/departments-timeline/components/timeline/*.tsx`
```diff
- import { FreshnessIndicator } from '@/modules/planning/components/timeline'
+ import { FreshnessIndicator } from '@/components/shared/timeline'
```

### `modules/departments-timeline/utils/index.ts`
```diff
- } from '@/modules/planning/utils/loading-bars-utils'
+ } from '@/components/shared/timeline/loading-bars-utils'
```

### `components/modals/SectionPanel.tsx`

Удалены вкладки "Задания" и "Загрузки", так как они зависели от удалённых компонентов:
- Удалён импорт `SectionLoadingsTab`
- Удалён импорт `SectionTasksPreview`
- Обновлён импорт `DateRangePicker` на новый путь

```diff
- import SectionLoadingsTab from '@/modules/projects/components/SectionLoadingsTab'
- import SectionTasksPreview from '@/modules/projects/components/SectionTasksPreview'
- import { DateRangePicker, type DateRange } from '@/modules/projects/components/DateRangePicker'
+ import { DateRangePicker, type DateRange } from '@/components/ui/date-picker'
```

**Оставшиеся вкладки:**
- Общее (overview)
- Задачи (decomposition2)
- Комментарии (comments)
- Отчёты (reports)

---

## Необходимые действия (TODO)

### 1. Обновить sidebar.tsx

Удалить ссылки на удалённые страницы:
- `/dashboard/projects`
- `/dashboard/planning`

### 2. Проверить statuses-tags

После удаления `planning` и `projects` проверить, используется ли `statuses-tags` в других модулях. Если нет — удалить.

### 3. Рефакторинг модулей [REFACTOR]

Следующие модули помечены на рефакторинг:
- `reports` — требует обновления
- `calendar` — требует обновления
- `planning-analytics` — возможно требует обновления после удаления planning

### 4. Восстановление при необходимости

Если понадобятся удалённые файлы, они находятся в `_deleted/`:
```bash
# Восстановить модуль
mv _deleted/modules/MODULE_NAME modules/

# Восстановить страницу
mv _deleted/pages/PAGE_NAME app/dashboard/
```

---

## Структура `_deleted/`

```
_deleted/
├── modules/
│   ├── cache-test/
│   ├── decomposition/
│   ├── decomposition-templates/
│   ├── filter-permissions/
│   ├── normokontrol/
│   ├── personal-planning-graph/
│   ├── planning/
│   ├── projects-components/      # Удалённые из projects
│   ├── section-analytics/
│   ├── task-transfer/
│   └── vacation-management/
└── pages/
    ├── cache-test/
    ├── normokontrol/
    ├── planning/
    ├── progress/
    ├── projects/
    ├── settings/
    └── task-transfer/
```

---

## Миграция маршрутов

Все страницы перенесены из `/dashboard/*` в корневые маршруты с использованием route group `(dashboard)`.

### Новая структура маршрутов

| Старый маршрут | Новый маршрут | Описание |
|----------------|---------------|----------|
| `/dashboard` | `/` | Главная страница |
| `/dashboard/kanban` | `/kanban` | Канбан-доска |
| `/dashboard/notions` | `/notions` | Заметки |
| `/dashboard/reports` | `/reports` | Отчёты |
| `/dashboard/feedback-analytics` | `/analytics` | Аналитика |
| `/dashboard/user-docs` | `/docs` | Документация |
| `/dashboard/report` | `/feedback` | Сообщить о проблеме |
| `/dashboard/users` | `/users` | Пользователи |
| `/dashboard/calendar` | `/calendar` | Календарь |
| `/dashboard/dev/tasks` | `/dev/tasks` | Dev Tasks |
| — | `/resource-graph` | Resource Graph |
| — | `/tasks` | Задачи |
| — | `/budget` | Бюджеты |

### Удалённые маршруты

- `/dashboard/projects` — удалён (заменён на resource-graph)
- `/dashboard/planning` — удалён (заменён на resource-graph)

### Структура app/

```
app/
├── (dashboard)/           # Route group (не влияет на URL)
│   ├── layout.tsx         # Dashboard layout с sidebar
│   ├── page.tsx           # / - главная
│   ├── analytics/         # /analytics
│   ├── budget/            # /budget
│   ├── calendar/          # /calendar
│   ├── dev/tasks/         # /dev/tasks
│   ├── docs/              # /docs
│   ├── feedback/          # /feedback
│   ├── kanban/            # /kanban
│   ├── notions/           # /notions
│   ├── reports/           # /reports
│   ├── resource-graph/    # /resource-graph
│   ├── tasks/             # /tasks
│   └── users/             # /users
├── api/                   # API routes
├── auth/                  # Auth pages
└── layout.tsx             # Root layout
```

### Обновлённый sidebar

Меню в `components/sidebar.tsx`:
- Главная → `/`
- Задачи → `/tasks`
- Заметки → `/notions`
- Отчёты → `/reports`
- Аналитика → `/analytics` (по доступу)
- Документация → `/docs`
- Сообщить о проблеме → `/feedback`
- Пользователи → `/users`

---

## Дата: 2025-01-06
