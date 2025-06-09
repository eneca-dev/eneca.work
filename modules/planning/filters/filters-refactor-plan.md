# План рефакторинга системы фильтров для нейросети

## 🎯 ЦЕЛЬ
Полная замена старой системы фильтров на унифицированную с сохранением 100% функциональности.

## 📋 КРИТИЧЕСКИ ВАЖНАЯ ИНФОРМАЦИЯ

### Файлы для ПОЛНОГО УДАЛЕНИЯ (только в конце)
```
modules/planning/components/filters.tsx
modules/planning/components/timeline/filters-panel.tsx  
modules/planning/components/workload/workload-filters.tsx
modules/users/components/user-filters.tsx
modules/planning/stores/usePlanningFiltersStore.ts
```

### Файлы для ОБНОВЛЕНИЯ (не удалять!)
```
modules/planning/components/timeline-view.tsx
modules/planning/components/workload/workload-view.tsx
modules/planning/stores/usePlanningStore.ts
modules/users/pages/users-page.tsx
```

### API функции (уже существуют в lib/supabase-client.ts)
```typescript
fetchFilterOptions() // загружает проекты, отделы, команды, менеджеров, сотрудников
fetchManagerProjects(managerId: string) // проекты конкретного менеджера
fetchProjectStages(projectId: string) // этапы проекта из таблицы stages
fetchStageObjects(stageId: string) // объекты этапа из таблицы objects
```

### Таблицы БД (подтверждены)
```
departments (department_id, department_name)
teams (team_id, team_name, department_id)
profiles (user_id, full_name, department_id, team_id)
projects (project_id, project_name, project_manager)
stages (stage_id, stage_name, stage_project_id)
objects (object_id, object_name, object_stage_id)
```

### Система разрешений (из usePlanningFiltersStore.ts строки 650-752)
```typescript
'is_top_manager' // нет ограничений
'is_project_manager' // заблокирован manager = self
'is_head_of_department' // заблокирован department = self  
'is_teamlead' // заблокированы department = self, team = self
```

## 📁 СТРУКТУРА НОВЫХ ФАЙЛОВ

### ЭТАП 1: Создать структуру папок
```
modules/planning/filters/
├── types/
│   ├── index.ts
│   ├── filter-types.ts
│   ├── filter-config.ts
│   └── api-types.ts
├── hooks/
│   ├── index.ts
│   ├── useFilterStore.ts
│   ├── useFilterPermissions.ts
│   └── useFilterDependencies.ts
├── stores/
│   ├── index.ts
│   ├── filterStore.ts
│   └── filterCache.ts
├── components/
│   ├── index.ts
│   ├── FilterSelect/
│   │   ├── index.ts
│   │   ├── FilterSelect.tsx
│   │   └── FilterSelect.types.ts
│   ├── FilterGroup/
│   │   ├── index.ts
│   │   ├── FilterGroup.tsx
│   │   └── FilterGroup.types.ts
│   └── composite/
│       ├── index.ts
│       ├── PlanningFilters.tsx
│       ├── TimelineFilters.tsx
│       ├── WorkloadFilters.tsx
│       └── UserFilters.tsx
├── utils/
│   ├── index.ts
│   ├── filter-helpers.ts
│   └── permission-helpers.ts
├── api/
│   ├── index.ts
│   └── filter-api.ts
├── constants/
│   ├── index.ts
│   └── filter-constants.ts
└── configs/
    ├── index.ts
    ├── planning-config.ts
    ├── timeline-config.ts
    ├── workload-config.ts
    └── users-config.ts
```

## 🔧 ДЕТАЛЬНЫЕ ИНСТРУКЦИИ ПО ФАЙЛАМ

### 1. types/filter-types.ts
```typescript
export interface FilterOption {
  id: string
  name: string
  [key: string]: any
}

export interface FilterState {
  selectedProjectId: string | null
  selectedDepartmentId: string | null
  selectedTeamId: string | null
  selectedManagerId: string | null
  selectedEmployeeId: string | null
  selectedStageId: string | null
  selectedObjectId: string | null
}

export interface FilterOptions {
  projects: FilterOption[]
  departments: FilterOption[]
  teams: FilterOption[]
  managers: FilterOption[]
  employees: FilterOption[]
  stages: FilterOption[]
  objects: FilterOption[]
}

export interface LoadingState {
  isLoading: boolean
  isLoadingProjects: boolean
  isLoadingStages: boolean
  isLoadingObjects: boolean
}

export type FilterType = 'project' | 'department' | 'team' | 'manager' | 'employee' | 'stage' | 'object'
export type PermissionType = 'is_top_manager' | 'is_project_manager' | 'is_head_of_department' | 'is_teamlead'
```

### 2. types/filter-config.ts
```typescript
import { FilterType, PermissionType } from './filter-types'

export interface FilterConfig {
  id: FilterType
  label: string
  placeholder: string
  dependencies?: FilterType[]
  permissions?: PermissionType[]
}

export interface PermissionConfig {
  [key: string]: {
    locked: FilterType[]
    defaultValues?: Partial<FilterState>
  }
}

export interface ModuleConfig {
  filters: FilterConfig[]
  permissions: PermissionConfig
}
```

### 3. stores/filterStore.ts
```typescript
import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { FilterState, FilterOptions, LoadingState } from '../types/filter-types'

interface FilterStore extends FilterState, FilterOptions, LoadingState {
  // Actions
  setFilter: (type: FilterType, value: string | null) => void
  resetFilters: () => void
  loadFilterOptions: () => Promise<void>
  loadManagerProjects: (managerId: string) => Promise<void>
  loadProjectStages: (projectId: string) => Promise<void>
  loadStageObjects: (stageId: string) => Promise<void>
  
  // Getters
  getFilteredOptions: (type: FilterType) => FilterOption[]
  isFilterLocked: (type: FilterType) => boolean
}

export const useFilterStore = create<FilterStore>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state - СКОПИРОВАТЬ из usePlanningFiltersStore.ts строки 90-112
        selectedProjectId: null,
        selectedDepartmentId: null,
        selectedTeamId: null,
        selectedManagerId: null,
        selectedEmployeeId: null,
        selectedStageId: null,
        selectedObjectId: null,
        
        projects: [],
        departments: [],
        teams: [],
        managers: [],
        employees: [],
        stages: [],
        objects: [],
        
        isLoading: false,
        isLoadingProjects: false,
        isLoadingStages: false,
        isLoadingObjects: false,
        
        // Actions - АДАПТИРОВАТЬ логику из usePlanningFiltersStore.ts
        setFilter: (type, value) => {
          // Логика из setSelectedProject, setSelectedDepartment и т.д.
        },
        
        resetFilters: () => {
          // Логика из resetFilters (строки 575-610)
        },
        
        loadFilterOptions: async () => {
          // Логика из fetchFilterOptions (строки 115-260)
        },
        
        // ... остальные методы
      }),
      { name: 'filter-store' }
    )
  )
)
```

### 4. components/FilterSelect/FilterSelect.tsx
```typescript
import React from 'react'
import { FilterOption } from '../../types/filter-types'

interface FilterSelectProps {
  id: string
  label: string
  value: string | null
  options: FilterOption[]
  onChange: (value: string | null) => void
  disabled?: boolean
  locked?: boolean
  placeholder?: string
  isLoading?: boolean
}

export const FilterSelect: React.FC<FilterSelectProps> = ({
  id,
  label,
  value,
  options,
  onChange,
  disabled = false,
  locked = false,
  placeholder,
  isLoading = false
}) => {
  // СКОПИРОВАТЬ логику из modules/planning/components/filters.tsx строки 15-80
  // Адаптировать под новые пропсы
  
  return (
    <div className="filter-select">
      {/* JSX из оригинального FilterSelect */}
    </div>
  )
}
```

### 5. components/composite/PlanningFilters.tsx
```typescript
import React, { useEffect } from 'react'
import { useFilterStore } from '../../hooks/useFilterStore'
import { useFilterPermissions } from '../../hooks/useFilterPermissions'
import { FilterSelect } from '../FilterSelect'
import { planningConfig } from '../../configs/planning-config'

export const PlanningFilters: React.FC = () => {
  const {
    // State
    selectedProjectId,
    selectedDepartmentId,
    selectedTeamId,
    selectedManagerId,
    selectedEmployeeId,
    selectedStageId,
    selectedObjectId,
    
    // Options
    projects,
    departments,
    teams,
    managers,
    employees,
    stages,
    objects,
    
    // Loading
    isLoading,
    isLoadingStages,
    isLoadingObjects,
    
    // Actions
    setFilter,
    resetFilters,
    loadFilterOptions,
    getFilteredOptions,
    isFilterLocked
  } = useFilterStore()
  
  const { applyPermissionFilters } = useFilterPermissions()
  
  useEffect(() => {
    loadFilterOptions()
    applyPermissionFilters()
  }, [])
  
  // СКОПИРОВАТЬ структуру JSX из modules/planning/components/filters.tsx строки 200-351
  // Заменить старые пропсы на новые из useFilterStore
  
  return (
    <div className="planning-filters">
      {/* Менеджеры */}
      <FilterSelect
        id="manager"
        label="Менеджер"
        value={selectedManagerId}
        options={managers}
        onChange={(value) => setFilter('manager', value)}
        locked={isFilterLocked('manager')}
        placeholder="Выберите менеджера"
      />
      
      {/* Проекты */}
      <FilterSelect
        id="project"
        label="Проект"
        value={selectedProjectId}
        options={getFilteredOptions('project')}
        onChange={(value) => setFilter('project', value)}
        locked={isFilterLocked('project')}
        placeholder="Выберите проект"
      />
      
      {/* Остальные фильтры по аналогии */}
      
      {/* Кнопка сброса */}
      <button onClick={resetFilters}>
        Сбросить фильтры
      </button>
    </div>
  )
}
```

### 6. configs/planning-config.ts
```typescript
import { ModuleConfig } from '../types/filter-config'

export const planningConfig: ModuleConfig = {
  filters: [
    {
      id: 'manager',
      label: 'Менеджер',
      placeholder: 'Выберите менеджера',
      dependencies: ['project'],
      permissions: ['is_top_manager', 'is_project_manager']
    },
    {
      id: 'project',
      label: 'Проект',
      placeholder: 'Выберите проект',
      dependencies: ['stage'],
      permissions: ['is_top_manager', 'is_project_manager']
    },
    {
      id: 'stage',
      label: 'Этап',
      placeholder: 'Выберите этап',
      dependencies: ['object'],
      permissions: ['is_top_manager', 'is_project_manager']
    },
    {
      id: 'object',
      label: 'Объект',
      placeholder: 'Выберите объект',
      permissions: ['is_top_manager', 'is_project_manager']
    },
    {
      id: 'department',
      label: 'Отдел',
      placeholder: 'Выберите отдел',
      dependencies: ['team', 'employee'],
      permissions: ['is_top_manager', 'is_head_of_department']
    },
    {
      id: 'team',
      label: 'Команда',
      placeholder: 'Выберите команду',
      dependencies: ['employee'],
      permissions: ['is_top_manager', 'is_head_of_department', 'is_teamlead']
    },
    {
      id: 'employee',
      label: 'Сотрудник',
      placeholder: 'Выберите сотрудника',
      permissions: ['is_top_manager', 'is_head_of_department', 'is_teamlead']
    }
  ],
  permissions: {
    'is_project_manager': {
      locked: ['manager'],
      defaultValues: { selectedManagerId: 'self' }
    },
    'is_head_of_department': {
      locked: ['department'],
      defaultValues: { selectedDepartmentId: 'self' }
    },
    'is_teamlead': {
      locked: ['department', 'team'],
      defaultValues: { selectedDepartmentId: 'self', selectedTeamId: 'self' }
    }
  }
}
```

## 🔄 ПОШАГОВЫЙ ПЛАН ВЫПОЛНЕНИЯ

### ДЕНЬ 1: Базовая инфраструктура
1. Создать все папки и файлы index.ts
2. Создать types/filter-types.ts (ТОЧНО как указано выше)
3. Создать types/filter-config.ts (ТОЧНО как указано выше)
4. Создать stores/filterStore.ts (АДАПТИРОВАТЬ из usePlanningFiltersStore.ts)

### ДЕНЬ 2: API и хуки
1. Создать api/filter-api.ts (ИСПОЛЬЗОВАТЬ существующие функции из lib/supabase-client.ts)
2. Создать hooks/useFilterStore.ts (обертка над stores/filterStore.ts)
3. Создать hooks/useFilterPermissions.ts (АДАПТИРОВАТЬ логику разрешений)
4. Создать utils/filter-helpers.ts и permission-helpers.ts

### ДЕНЬ 3: Базовые компоненты
1. Создать components/FilterSelect/FilterSelect.tsx (СКОПИРОВАТЬ из filters.tsx строки 15-80)
2. Создать components/FilterGroup/FilterGroup.tsx
3. Создать constants/filter-constants.ts

### ДЕНЬ 4: Конфигурации
1. Создать configs/planning-config.ts (ТОЧНО как указано выше)
2. Создать configs/timeline-config.ts (аналогично planning-config.ts)
3. Создать configs/workload-config.ts (аналогично planning-config.ts)
4. Создать configs/users-config.ts (аналогично planning-config.ts)

### ДЕНЬ 5: Композитные компоненты
1. Создать composite/PlanningFilters.tsx (ЗАМЕНЯЕТ filters.tsx)
2. Создать composite/TimelineFilters.tsx (ЗАМЕНЯЕТ timeline/filters-panel.tsx)
3. Создать composite/WorkloadFilters.tsx (ЗАМЕНЯЕТ workload/workload-filters.tsx)
4. Создать composite/UserFilters.tsx (ЗАМЕНЯЕТ users/components/user-filters.tsx)

### ДЕНЬ 6: Интеграция с timeline-view.tsx
1. ЗАМЕНИТЬ импорт: `import { PlanningFilters } from '@/modules/planning/filters'`
2. ЗАМЕНИТЬ компонент в JSX
3. ПРОТЕСТИРОВАТЬ функциональность

### ДЕНЬ 7: Интеграция с workload-view.tsx и usePlanningStore.ts
1. Обновить workload-view.tsx аналогично timeline-view.tsx
2. Обновить usePlanningStore.ts для работы с новой системой фильтров
3. Обновить users-page.tsx

### ДЕНЬ 8: Финальная замена
1. УДАЛИТЬ старые файлы (ТОЛЬКО после полного тестирования)
2. Обновить все импорты
3. Финальное тестирование

## ⚠️ КРИТИЧЕСКИ ВАЖНЫЕ ПРАВИЛА

### ДЛЯ НЕЙРОСЕТИ:
1. **НЕ УДАЛЯТЬ** старые файлы до создания новых
2. **ТОЧНО КОПИРОВАТЬ** логику из указанных строк файлов
3. **СОХРАНИТЬ** все существующие функции и поведение
4. **ИСПОЛЬЗОВАТЬ** точные пути файлов из плана
5. **АДАПТИРОВАТЬ** код, а не переписывать с нуля
6. **ТЕСТИРОВАТЬ** каждый этап перед переходом к следующему

### ИСТОЧНИКИ КОДА ДЛЯ КОПИРОВАНИЯ:
- `modules/planning/stores/usePlanningFiltersStore.ts` строки 115-260 (fetchFilterOptions)
- `modules/planning/stores/usePlanningFiltersStore.ts` строки 575-610 (resetFilters)  
- `modules/planning/stores/usePlanningFiltersStore.ts` строки 650-752 (система разрешений)
- `modules/planning/components/filters.tsx` строки 15-80 (FilterSelect)
- `modules/planning/components/filters.tsx` строки 200-351 (структура JSX)

### ИНТЕГРАЦИИ:
- `lib/supabase-client.ts` - использовать существующие API функции
- `modules/users/stores/useUserStore.ts` - для получения разрешений пользователя
- `modules/planning/stores/usePlanningStore.ts` - для синхронизации фильтров

## ✅ КОНТРОЛЬНЫЕ ТОЧКИ

После каждого дня:
1. Все файлы созданы без ошибок TypeScript
2. Импорты работают корректно
3. Нет конфликтов с существующим кодом
4. Функциональность соответствует оригиналу

**НАЧИНАТЬ ТОЛЬКО ПОСЛЕ ПОДТВЕРЖДЕНИЯ ПОНИМАНИЯ ПЛАНА!**
