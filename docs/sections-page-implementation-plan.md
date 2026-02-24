# План реализации модуля "Разделы" (sections-page)

> **Дата:** 2026-02-11
> **Цель:** Создать новую страницу "Разделы" в tasks с реальными данными
> **Базовый модуль:** departments-timeline (прототип)
> **Новый модуль:** sections-page

---

## 📊 Сравнение иерархий

### Старая (departments-timeline)
```
Department (Отдел)
  └─ Team (Команда)
      └─ Employee (Сотрудник)
          └─ Loadings (Загрузки)
```

### Новая (sections-page)
```
Department (Отдел) - через section_responsible
  └─ Project (Проект)
      └─ Object/Section (Объект + Раздел merged)
          └─ Loadings (Загрузки сотрудников)
```

**Ключевые отличия:**
- ✅ Departments НЕ из org structure, а через section_responsible
- ✅ Projects вместо Teams
- ✅ Object/Section merged - один уровень вместо двух
- ✅ Loadings на уровне Section (не Employee)
- ✅ Capacity (плановая ёмкость) - новая фича
- ❌ Без freshness indicator (нет подтверждения актуальности)

---

## 🏗️ Структура модуля

```
modules/sections-page/
├── module.meta.json          # Метаданные модуля
├── index.ts                  # Public API
├── actions/
│   └── index.ts             # Server Actions
├── hooks/
│   └── index.ts             # React Query хуки
├── stores/
│   └── index.ts             # Zustand store для UI
├── types/
│   └── index.ts             # TypeScript типы
├── components/
│   ├── SectionsPageInternal.tsx        # Главный компонент
│   ├── hierarchy/
│   │   ├── DepartmentRow.tsx           # Строка отдела
│   │   ├── ProjectRow.tsx              # Строка проекта
│   │   ├── ObjectSectionRow.tsx        # Строка объект/раздел
│   │   ├── EmployeeRow.tsx             # Строка сотрудника (loading)
│   │   ├── AggregatedBarsOverlay.tsx   # X/Y бары
│   │   └── CreateLoadingModal.tsx      # Модалка создания загрузки
│   └── index.ts
├── constants/
│   └── index.ts             # Константы (размеры, range)
└── utils/
    └── index.ts             # Утилиты (aggregate capacity, etc.)
```

---

## 📝 Этап 1: Типы и константы (30 мин)

### 1.1 Генерация типов из БД
```bash
npm run db:types
```

### 1.2 Создать `types/index.ts`

**Базовые типы:**
```typescript
// Переиспользуем из resource-graph
export type { DayCell, CompanyCalendarEvent, TimelineRange } from '@/modules/resource-graph/types'

// Иерархия для sections-page
export interface SectionLoading {
  id: string
  employeeId: string
  employeeName: string
  employeePosition?: string
  employeeAvatarUrl?: string
  startDate: string
  endDate: string
  rate: number
  comment?: string
  stageId?: string
  stageName?: string
}

export interface ObjectSection {
  id: string
  objectId: string
  objectName: string
  sectionId: string
  sectionName: string
  sectionType?: string
  defaultCapacity: number
  responsibleId?: string
  responsibleName?: string
  responsibleAvatarUrl?: string
  loadings: SectionLoading[]
}

export interface Project {
  id: string
  name: string
  status: string
  objectSections: ObjectSection[]
}

export interface Department {
  id: string
  name: string
  projects: Project[]
}

// Capacity types
export interface CapacityOverride {
  sectionId: string
  date: string
  value: number
}

export type TreeNodeType = 'department' | 'project' | 'objectSection'
```

### 1.3 Создать `constants/index.ts`

```typescript
// Re-export from resource-graph
export { SIDEBAR_WIDTH } from '@/modules/resource-graph/constants'

// Sections-specific
export const DAY_CELL_WIDTH = 48 // Wider for X/Y display
export const DAYS_BEFORE_TODAY = 30
export const DAYS_AFTER_TODAY = 150
export const TOTAL_DAYS = DAYS_BEFORE_TODAY + DAYS_AFTER_TODAY

// Row heights
export const DEPARTMENT_ROW_HEIGHT = 48
export const PROJECT_ROW_HEIGHT = 44
export const OBJECT_SECTION_ROW_HEIGHT = 40
export const EMPLOYEE_ROW_HEIGHT = 44

// Bar dimensions
export const BAR_HEIGHT = 34
export const BAR_WIDTH = 24
```

---

## 📝 Этап 2: Server Actions (1-1.5 часа)

### 2.1 Создать `actions/index.ts`

**Actions для реализации:**

#### 1. `getSectionsHierarchy(filters?)`
```typescript
'use server'

import { createClient } from '@/utils/supabase/server'
import type { ActionResult } from '@/modules/cache'
import type { Department } from '../types'
import { getFilterContext } from '@/modules/permissions/server/get-filter-context'
import { applyMandatoryFilters } from '@/modules/permissions/utils/mandatory-filters'

export async function getSectionsHierarchy(
  filters?: FilterQueryParams
): Promise<ActionResult<Department[]>> {
  try {
    const supabase = await createClient()

    // 🔒 Apply permissions
    const filterContextResult = await getFilterContext()
    const filterContext = filterContextResult.success ? filterContextResult.data : null
    const secureFilters = applyMandatoryFilters(filters || {}, filterContext)

    // Fetch from view_departments_sections_loadings
    let query = supabase
      .from('view_departments_sections_loadings')
      .select('*')

    // Apply filters...

    const { data, error } = await query

    if (error) {
      return { success: false, error: error.message }
    }

    // Transform flat rows to hierarchy
    const hierarchy = transformToHierarchy(data)

    return { success: true, data: hierarchy }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

// Helper: Transform flat view rows to Department[] hierarchy
function transformToHierarchy(rows: any[]): Department[] {
  const deptMap = new Map<string, Department>()
  const projMap = new Map<string, Project>()
  const osMap = new Map<string, ObjectSection>()

  // Group by department → project → objectSection → loadings
  // ... implementation

  return Array.from(deptMap.values())
}
```

#### 2. `updateDefaultCapacity(sectionId, value)`
```typescript
export async function updateDefaultCapacity(
  sectionId: string,
  value: number
): Promise<ActionResult<{ sectionId: string; value: number }>> {
  try {
    const supabase = await createClient()

    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Не авторизован' }
    }

    // Upsert capacity (date = NULL for default)
    const { error } = await supabase
      .from('section_capacity')
      .upsert({
        section_id: sectionId,
        capacity_date: null,
        capacity_value: value,
        created_by: user.id,
      }, {
        onConflict: 'section_id,capacity_date'
      })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, data: { sectionId, value } }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}
```

#### 3. `updateCapacityOverride(sectionId, date, value)`
```typescript
export async function updateCapacityOverride(
  sectionId: string,
  date: string,
  value: number
): Promise<ActionResult<{ sectionId: string; date: string; value: number }>> {
  // Similar to updateDefaultCapacity but with date !== null
}
```

#### 4. `deleteCapacityOverride(sectionId, date)`
```typescript
export async function deleteCapacityOverride(
  sectionId: string,
  date: string
): Promise<ActionResult<{ sectionId: string; date: string }>> {
  // Delete capacity override for specific date
}
```

#### 5. `createLoading(input)` - ВАЖНО!
```typescript
interface CreateLoadingInput {
  sectionId: string
  employeeId: string
  stageId?: string | null
  startDate: string
  endDate: string
  rate: number
  comment?: string
}

export async function createLoading(
  input: CreateLoadingInput
): Promise<ActionResult<{ loadingId: string }>> {
  try {
    const supabase = await createClient()

    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Не авторизован' }
    }

    // 🔒 ВАЖНО: Валидация stage ∈ section
    if (input.stageId) {
      const { data: stage } = await supabase
        .from('decomposition_stages')
        .select('decomposition_stage_section_id')
        .eq('decomposition_stage_id', input.stageId)
        .single()

      if (!stage || stage.decomposition_stage_section_id !== input.sectionId) {
        return {
          success: false,
          error: 'Stage does not belong to selected section'
        }
      }
    }

    // Insert loading
    const { data, error } = await supabase
      .from('loadings')
      .insert({
        loading_section: input.sectionId, // PRIMARY field!
        loading_responsible: input.employeeId,
        loading_stage: input.stageId,
        loading_start: input.startDate,
        loading_finish: input.endDate,
        loading_rate: input.rate,
        loading_comment: input.comment,
        loading_status: 'active',
        is_shortage: false,
      })
      .select('loading_id')
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, data: { loadingId: data.loading_id } }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}
```

---

## 📝 Этап 3: Query Keys и Hooks (30-45 мин)

### 3.1 Добавить query keys в `modules/cache/keys/query-keys.ts`

```typescript
// В существующий файл добавить:
export const queryKeys = {
  // ... existing keys

  sectionsPage: {
    all: ['sectionsPage'] as const,
    lists: () => [...queryKeys.sectionsPage.all, 'list'] as const,
    list: (filters: FilterQueryParams) =>
      [...queryKeys.sectionsPage.lists(), filters] as const,
    capacityOverrides: (sectionId: string) =>
      [...queryKeys.sectionsPage.all, 'capacity', sectionId] as const,
  },
} as const
```

### 3.2 Создать `hooks/index.ts`

```typescript
'use client'

import { createCacheQuery, createCacheMutation, queryKeys } from '@/modules/cache'
import {
  getSectionsHierarchy,
  updateDefaultCapacity,
  updateCapacityOverride,
  deleteCapacityOverride,
  createLoading,
} from '../actions'
import type { Department, CreateLoadingInput } from '../types'
import type { FilterQueryParams } from '@/modules/inline-filter'

// Re-export calendar events
export { useCompanyCalendarEvents } from '@/modules/resource-graph/hooks'

// Query: Get sections hierarchy
export const useSectionsHierarchy = createCacheQuery<Department[], FilterQueryParams>({
  queryKey: (filters) => queryKeys.sectionsPage.list(filters),
  queryFn: getSectionsHierarchy,
  staleTime: Infinity, // Updated via Realtime
})

// Mutation: Update default capacity
export const useUpdateDefaultCapacity = createCacheMutation<
  { sectionId: string; value: number },
  { sectionId: string; value: number }
>({
  mutationFn: ({ sectionId, value }) => updateDefaultCapacity(sectionId, value),
  invalidateKeys: [queryKeys.sectionsPage.all],
  // TODO: Add optimistic update
})

// Mutation: Update capacity override
export const useUpdateCapacityOverride = createCacheMutation<
  { sectionId: string; date: string; value: number },
  { sectionId: string; date: string; value: number }
>({
  mutationFn: ({ sectionId, date, value }) =>
    updateCapacityOverride(sectionId, date, value),
  invalidateKeys: [queryKeys.sectionsPage.all],
})

// Mutation: Delete capacity override
export const useDeleteCapacityOverride = createCacheMutation<
  { sectionId: string; date: string },
  { sectionId: string; date: string }
>({
  mutationFn: ({ sectionId, date }) => deleteCapacityOverride(sectionId, date),
  invalidateKeys: [queryKeys.sectionsPage.all],
})

// Mutation: Create loading
export const useCreateLoading = createCacheMutation<
  CreateLoadingInput,
  { loadingId: string }
>({
  mutationFn: (input) => createLoading(input),
  invalidateKeys: [queryKeys.sectionsPage.all],
})
```

---

## 📝 Этап 4: Zustand Store (20 мин)

### 4.1 Создать `stores/index.ts`

```typescript
'use client'

import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import type { TreeNodeType } from '../types'

interface UIState {
  expandedNodes: Record<TreeNodeType, Set<string>>
  selectedItemId: string | null

  // Check
  isExpanded: (type: TreeNodeType, id: string) => boolean

  // Toggle
  toggleNode: (type: TreeNodeType, id: string) => void
  expandNode: (type: TreeNodeType, id: string) => void
  collapseNode: (type: TreeNodeType, id: string) => void

  // Bulk
  expandAll: (nodesByType: Partial<Record<TreeNodeType, string[]>>) => void
  collapseAll: (type?: TreeNodeType) => void

  // Selection
  setSelectedItem: (id: string | null) => void
}

const createEmptyExpandedNodes = (): Record<TreeNodeType, Set<string>> => ({
  department: new Set(),
  project: new Set(),
  objectSection: new Set(),
})

// Serialization helpers для localStorage
// ... (copy from departments-timeline)

export const useSectionsPageUIStore = create<UIState>()(
  devtools(
    persist(
      (set, get): UIState => ({
        expandedNodes: createEmptyExpandedNodes(),
        selectedItemId: null,

        isExpanded: (type, id) => get().expandedNodes[type].has(id),

        toggleNode: (type, id) => {
          // ... implementation
        },

        // ... other methods
      }),
      {
        name: 'sections-page-ui-state',
        version: 1,
        // ... storage with serialization
      }
    ),
    { name: 'SectionsPageUI' }
  )
)

// Convenience hook
export function useRowExpanded(type: TreeNodeType, id: string) {
  const isExpanded = useSectionsPageUIStore(
    (state) => state.expandedNodes[type].has(id)
  )
  const toggleNode = useSectionsPageUIStore((state) => state.toggleNode)

  return { isExpanded, toggle: () => toggleNode(type, id) }
}
```

---

## 📝 Этап 5: Утилиты (30 мин)

### 5.1 Создать `utils/index.ts`

```typescript
// Re-export from resource-graph
export { buildCalendarMap, getDayInfo } from '@/modules/resource-graph/utils'

// Capacity aggregation
export interface DailyAggregation {
  rateSum: number
  capacity: number
}

export function computeDailyAggregation(
  loadings: SectionLoading[],
  defaultCapacity: number,
  capacityOverrides: Record<string, number>,
  dayCells: DayCell[]
): DailyAggregation[] {
  return dayCells.map((cell) => {
    const dateStr = formatMinskDate(cell.date)
    const capacity = capacityOverrides[dateStr] ?? defaultCapacity

    let rateSum = 0
    for (const loading of loadings) {
      if (isDateInRange(dateStr, loading.startDate, loading.endDate)) {
        rateSum += loading.rate
      }
    }

    return { rateSum, capacity }
  })
}

function isDateInRange(dateStr: string, start: string, end: string): boolean {
  return dateStr >= start && dateStr <= end
}

// Cell styling
export function getCellClassNames(cell: DayCell, additionalClasses?: string) {
  // ... (copy from departments-timeline)
}

// Bar colors (hash-based)
const BAR_COLORS = [
  { bg: 'rgba(147, 51, 234, 0.85)', stripe: 'rgba(147, 51, 234, 0.55)', text: '#fff' },  // purple
  // ... (copy from memory/departments-page-structure.md)
]

export function getBarColor(id: string) {
  const hash = hashString(id)
  return BAR_COLORS[hash % BAR_COLORS.length]
}

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}
```

---

## 📝 Этап 6: Components (3-4 часа)

### 6.1 Главный компонент `SectionsPageInternal.tsx`

**Паттерн из DepartmentsTimeline:**
- Sticky header с синхронизацией скролла
- Sidebar слева (400px)
- Timeline справа (scrollable X + Y)
- Кнопки: [+] Создать, [↕] Развернуть, [↓] Свернуть

```typescript
'use client'

import { useState, useMemo, useCallback, useRef } from 'react'
import { ChevronsUpDown, ChevronsDownUp, Plus } from 'lucide-react'
import { addDays } from 'date-fns'
import { getTodayMinsk } from '@/lib/timezone-utils'
import { useCompanyCalendarEvents, useSectionsHierarchy } from '../hooks'
import { useSectionsPageUIStore } from '../stores'
import { TimelineHeader, generateDayCells } from '@/modules/resource-graph/components/timeline'
import { SIDEBAR_WIDTH, DAY_CELL_WIDTH, DAYS_BEFORE_TODAY, DAYS_AFTER_TODAY, TOTAL_DAYS } from '../constants'
import type { FilterQueryParams } from '@/modules/inline-filter'
import { DepartmentRow } from './hierarchy/DepartmentRow'
import { CreateLoadingModal } from './hierarchy/CreateLoadingModal'

interface SectionsPageInternalProps {
  queryParams: FilterQueryParams
}

export function SectionsPageInternal({ queryParams }: SectionsPageInternalProps) {
  // Refs for scroll sync
  const headerScrollRef = useRef<HTMLDivElement>(null)
  const contentScrollRef = useRef<HTMLDivElement>(null)
  const isScrollingSyncRef = useRef(false)

  // Data
  const { data: departments = [], isLoading } = useSectionsHierarchy(queryParams)
  const { data: calendarEvents = [] } = useCompanyCalendarEvents()

  // UI state
  const { expandAll, collapseAll } = useSectionsPageUIStore()
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [targetSectionId, setTargetSectionId] = useState<string | null>(null)

  // Timeline setup
  const range = useMemo(() => {
    const today = getTodayMinsk()
    return {
      start: addDays(today, -DAYS_BEFORE_TODAY),
      end: addDays(today, DAYS_AFTER_TODAY - 1),
      totalDays: TOTAL_DAYS,
    }
  }, [])

  const dayCells = useMemo(
    () => generateDayCells(range, calendarEvents),
    [range, calendarEvents]
  )

  // ... scroll sync handlers (copy from DepartmentsTimeline)

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header with dates */}
      <header className="sticky top-0 z-20 bg-card border-b shadow-sm">
        {/* ... header layout */}
      </header>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <div ref={contentScrollRef} className="overflow-auto h-full">
          {isLoading ? (
            <div>Загрузка...</div>
          ) : (
            departments.map((dept) => (
              <DepartmentRow
                key={dept.id}
                department={dept}
                dayCells={dayCells}
              />
            ))
          )}
        </div>
      </div>

      {/* Create loading modal */}
      <CreateLoadingModal
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        initialSectionId={targetSectionId}
      />
    </div>
  )
}
```

### 6.2 Компоненты иерархии

**Копировать из departments-timeline и адаптировать:**

#### `DepartmentRow.tsx`
- Collapsible
- Показывает агрегацию X/Y когда свёрнут
- Иконка: Building2 (emerald-500)

#### `ProjectRow.tsx`
- Collapsible
- Показывает агрегацию X/Y когда свёрнут
- Иконка: FolderKanban (amber-600)
- Отступ: pl-5

#### `ObjectSectionRow.tsx`
- Expandable
- **ВСЕГДА** показывает агрегацию X/Y
- Capacity редактируется через клик по ячейке
- Кнопка [+] для создания загрузки (visible on hover)
- Иконка: Box (cyan-600)
- Отступ: pl-[40px]

#### `EmployeeRow.tsx` (Loading)
- Цветной бар с полосками
- Строка 1: `[rate] 📁 Project Name`
- Строка 2: `🏢 Object · Stage Name`
- Отступ: pl-14 (56px)
- Avatar + name + position

#### `AggregatedBarsOverlay.tsx`
- Вертикальные мини-бары X/Y
- Цвета: green → yellow → orange → red
- Overload (>100%): red + cutoff line + glow
- Inline editing для capacity (если editable=true)

#### `CreateLoadingModal.tsx`
- Левая панель: дерево Projects → ObjectSections
- Правая панель: форма
  - Employee (select)
  - Stage (select, optional)
  - Rate (quick buttons + custom input)
  - Date range
  - Comment (optional)
- Валидация на клиенте
- Breadcrumbs: Project > Object/Section

---

## 📝 Этап 7: Integration (30 мин)

### 7.1 Обновить `modules/tasks/stores/tasks-tabs-store.ts`

Добавить viewMode 'sections':

```typescript
export type TasksViewMode = 'kanban' | 'timeline' | 'departments' | 'sections' | 'budgets'
```

### 7.2 Обновить `modules/tasks/components/TasksView.tsx`

```typescript
{tabs.length > 0 && viewMode === 'sections' && (
  <SectionsPageInternal
    queryParams={queryParams}
  />
)}
```

### 7.3 Обновить `modules/tasks/components/TasksTabs.tsx`

Добавить вкладку "Разделы":

```typescript
const VIEW_MODE_OPTIONS = [
  { value: 'kanban' as const, label: 'Канбан', icon: Kanban },
  { value: 'timeline' as const, label: 'График', icon: Gantt },
  { value: 'departments' as const, label: 'Отделы', icon: Building2 },
  { value: 'sections' as const, label: 'Разделы', icon: Box }, // NEW
  { value: 'budgets' as const, label: 'Бюджеты', icon: DollarSign },
]
```

---

## 📝 Этап 8: module.meta.json (15 мин)

Создать `modules/sections-page/module.meta.json` по образцу departments-timeline:

```json
{
  "$schema": "../../schemas/module-meta/module.schema.json",

  "meta": {
    "name": "sections-page",
    "displayName": "Sections Page",
    "description": "Страница разделов с иерархией отделов → проектов → объектов → загрузок и capacity management",
    "version": "1.0.0",
    "status": "stable",
    "route": "/dashboard/tasks (вкладка Разделы)",
    "tags": ["feature", "ui", "data-layer"]
  },

  "architecture": {
    "structure": {
      "actions/": "Server Actions для данных разделов и capacity",
      "components/": "React компоненты (DepartmentRow, ProjectRow, etc.)",
      "components/hierarchy/": "Иерархические компоненты",
      "constants/": "Константы (размеры, range)",
      "hooks/": "React Query хуки",
      "stores/": "Zustand store для UI состояния",
      "types/": "TypeScript типы",
      "utils/": "Утилиты (capacity aggregation)"
    },
    "entryPoint": "index.ts",
    "publicApi": [
      "SectionsPageInternal",
      "useSectionsHierarchy",
      "useUpdateDefaultCapacity",
      "useUpdateCapacityOverride",
      "useCreateLoading"
    ]
  },

  "dependencies": {
    "modules": ["cache", "inline-filter", "resource-graph", "permissions"],
    "database": {
      "tables": ["sections", "section_capacity", "loadings"],
      "views": ["view_departments_sections_loadings"],
      "enums": [],
      "functions": []
    }
  },

  "technologies": ["@tanstack/react-query", "zustand", "date-fns", "tailwindcss"],

  "cache": {
    "queryKeys": ["sectionsPage.list", "sectionsPage.capacityOverrides"],
    "realtimeChannels": ["loadings", "section_capacity"],
    "invalidationRules": []
  },

  "permissions": ["sections.view", "sections.create_loading", "sections.edit_capacity"]
}
```

---

## 🎯 Чек-лист реализации

### Подготовка
- [x] ✅ Миграция БД: section_capacity таблица
- [x] ✅ Миграция БД: view_departments_sections_loadings
- [ ] Генерация типов: `npm run db:types`

### Этап 1: Foundation
- [ ] Создать структуру директорий модуля
- [ ] types/index.ts
- [ ] constants/index.ts
- [ ] module.meta.json

### Этап 2: Data Layer
- [ ] actions/index.ts - все Server Actions
- [ ] Добавить query keys в cache module
- [ ] hooks/index.ts - все хуки
- [ ] stores/index.ts - Zustand store

### Этап 3: Utils
- [ ] utils/index.ts - aggregation, colors, helpers

### Этап 4: Components
- [ ] SectionsPageInternal.tsx
- [ ] hierarchy/DepartmentRow.tsx
- [ ] hierarchy/ProjectRow.tsx
- [ ] hierarchy/ObjectSectionRow.tsx
- [ ] hierarchy/EmployeeRow.tsx
- [ ] hierarchy/AggregatedBarsOverlay.tsx
- [ ] hierarchy/CreateLoadingModal.tsx
- [ ] components/index.ts

### Этап 5: Integration
- [ ] Обновить tasks-tabs-store.ts
- [ ] Обновить TasksView.tsx
- [ ] Обновить TasksTabs.tsx
- [ ] index.ts - public API

### Этап 6: Testing
- [ ] Проверить загрузку данных
- [ ] Проверить expand/collapse
- [ ] Проверить capacity editing
- [ ] Проверить создание загрузки
- [ ] Проверить валидацию stage ∈ section
- [ ] Проверить Realtime updates

---

## ⚠️ Важные моменты

### 1. Валидация stage → section
**КРИТИЧНО:** Всегда проверять что stage принадлежит section!

```typescript
// В createLoading action:
if (input.stageId) {
  const { data: stage } = await supabase
    .from('decomposition_stages')
    .select('decomposition_stage_section_id')
    .eq('decomposition_stage_id', input.stageId)
    .single()

  if (!stage || stage.decomposition_stage_section_id !== input.sectionId) {
    return { success: false, error: 'Stage does not belong to section' }
  }
}
```

### 2. Триггер БД
Старый триггер `trg_loadings_sync_section` пока **НЕ трогаем**!
Он перезапишет `loading_section`, но наша валидация всё равно сработает.

### 3. Capacity Overrides
- `capacity_date IS NULL` = default capacity
- `capacity_date NOT NULL` = override для конкретной даты
- UNIQUE constraint: (section_id, capacity_date)

### 4. Performance
- staleTime: Infinity для главного запроса (обновляется через Realtime)
- Indexed queries: section_id, capacity_date
- Optimistic updates для мутаций

### 5. Permissions
Используем pattern из departments-timeline:
```typescript
const filterContextResult = await getFilterContext()
const secureFilters = applyMandatoryFilters(filters || {}, filterContext)
```

---

## 🚀 Порядок реализации (рекомендуемый)

### День 1: Foundation + Data Layer
1. Генерация типов (`npm run db:types`)
2. Создать структуру модуля
3. types/ + constants/
4. actions/ - все Server Actions
5. Тестировать actions через API routes или console

### День 2: State + Utils + Main Component
6. Query keys в cache module
7. hooks/ - все хуки
8. stores/ - Zustand store
9. utils/ - утилиты
10. SectionsPageInternal.tsx (без детальных компонентов - заглушки)

### День 3: Hierarchy Components
11. DepartmentRow
12. ProjectRow
13. ObjectSectionRow
14. EmployeeRow
15. AggregatedBarsOverlay

### День 4: Modal + Integration + Testing
16. CreateLoadingModal
17. Integration в TasksView
18. Тестирование + баг фиксы
19. module.meta.json
20. Documentation

---

## 📚 Референсы

**Код для копирования:**
- `modules/departments-timeline/` - структура, паттерны
- `memory/departments-page-structure.md` - визуал, константы
- `modules/resource-graph/` - timeline утилиты

**Агенты для проверки:**
- Cache Guardian - после actions/hooks
- Clean Code Guardian - после components
- Security Guardian - перед деплоем
- Performance Guardian - после интеграции

**Документы:**
- `docs/sections-page-analysis.md` - анализ БД
- `docs/sections-page-migration-plan.md` - миграции

---

## ✅ Definition of Done

Модуль считается готовым когда:
- ✅ Все компоненты реализованы и типобезопасны
- ✅ Страница работает в /dashboard/tasks
- ✅ Данные загружаются из БД через view
- ✅ Capacity редактируется (default + overrides)
- ✅ Создание загрузки работает с валидацией
- ✅ Realtime обновления работают
- ✅ Expand/collapse сохраняется в localStorage
- ✅ Прошли проверку агентами (Security, Cache, Clean Code)
- ✅ Нет TypeScript errors
- ✅ `npm run build` проходит без ошибок
- ✅ module.meta.json заполнен
- ✅ Public API экспортирован через index.ts

---

**Готов к реализации!** 🚀
