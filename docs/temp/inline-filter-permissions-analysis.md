# Анализ модулей: inline-filter + permissions

> **Временная документация для интеграции системы разрешений в inline-filter**

---

## 1. Модуль inline-filter

### 1.1 Назначение
GitHub Projects-style инлайн-фильтр с автокомплитом. Общий модуль для всего приложения - все модули (kanban, planning, resource-graph) обязаны использовать его.

### 1.2 Структура файлов
```
modules/inline-filter/
├── index.ts                    # Public API exports
├── types.ts                    # TypeScript типы
├── parser.ts                   # Парсер строки фильтров (с лимитами безопасности)
├── components/
│   ├── InlineFilter.tsx        # Основной компонент фильтра
│   └── FilterSuggestions.tsx   # Dropdown подсказок
└── hooks/
    └── useFilterContext.ts     # Хук определения контекста ввода
```

### 1.3 Ключевые типы

```typescript
// Конфигурация одного ключа фильтра
interface FilterKeyConfig {
  field: string        // Поле в БД (subdivision_id, project_id)
  label?: string       // Отображаемое имя
  multiple?: boolean   // Множественные значения
  icon?: LucideIcon    // Иконка
  color?: FilterKeyColor  // Цвет: 'violet' | 'blue' | 'amber' | ...
}

// Конфигурация фильтра
interface FilterConfig {
  keys: Record<string, FilterKeyConfig>  // Маппинг ключей
  placeholder?: string
}

// Опция автокомплита
interface FilterOption {
  id: string          // ID записи
  name: string        // Отображаемое имя
  key: string         // К какому ключу относится
  parentId?: string   // ID родителя (для иерархии)
}

// Результат парсинга
interface ParsedToken {
  key: string         // 'подразделение'
  value: string       // 'ОВ'
  raw: string         // 'подразделение:"ОВ"'
}

// Параметры запроса к БД
type FilterQueryParams = Record<string, string | string[]>
```

### 1.4 Основные функции парсера

| Функция | Описание |
|---------|----------|
| `parseFilterString(input, config)` | Парсит строку в токены |
| `serializeFilter(tokens)` | Токены обратно в строку |
| `tokensToQueryParams(tokens, config)` | Токены в DB query params |
| `addOrUpdateToken(filter, key, value, config)` | Добавить/обновить токен |
| `removeToken(filter, key, value, config)` | Удалить токен |
| `hasActiveFilters(input, config)` | Есть ли активные фильтры |
| `getValuesForKey(input, key, config)` | Значения для ключа |

### 1.5 Лимиты безопасности (parser.ts)

```typescript
MAX_TOKENS = 20                    // Макс. токенов
MAX_VALUE_LENGTH = 500             // Макс. длина значения
MAX_FILTER_STRING_LENGTH = 2000    // Макс. длина строки
```

### 1.6 Компонент InlineFilter

**Props:**
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `config` | `FilterConfig` | Yes | Конфигурация ключей |
| `value` | `string` | Yes | Текущая строка фильтра |
| `onChange` | `(value: string) => void` | Yes | Callback изменения |
| `options` | `FilterOption[]` | No | Опции автокомплита |
| `placeholder` | `string` | No | Placeholder |
| `debounceMs` | `number` | No | Задержка (default: 300) |

**Особенности:**
- Debounced onChange для производительности
- Цветная подсветка ключей (COLOR_MAP)
- Keyboard navigation (ArrowUp/Down, Enter/Tab, Escape)
- ARIA accessibility support

---

## 2. Модуль permissions

### 2.1 Назначение
Система управления разрешениями пользователей. Работает полностью с БД:
```
profiles.role_id → roles.id → role_permissions → permissions.name
```

### 2.2 Структура файлов
```
modules/permissions/
├── index.ts                          # Public API
├── types/
│   ├── index.ts                      # Основные типы
│   └── filter-scope.ts               # Типы filter scope
├── store/
│   └── usePermissionsStore.ts        # Zustand store
├── hooks/
│   ├── usePermissions.ts             # Хуки проверки разрешений
│   ├── usePermissionsLoader.ts       # Загрузчик разрешений
│   ├── use-filter-context.ts         # Контекст фильтрации
│   └── use-filtered-options.ts       # Фильтрация опций
├── server/
│   └── get-filter-context.ts         # Server Action
├── utils/
│   ├── permissionUtils.ts            # Утилиты разрешений
│   ├── roleUtils.ts                  # Утилиты ролей
│   ├── scope-resolver.ts             # Вычисление scope
│   └── mandatory-filters.ts          # Принудительные фильтры
├── components/
│   ├── PermissionGuard.tsx           # Guard компонент
│   ├── RoleGuard.tsx                 # Guard по роли
│   └── PermissionsErrorBoundary.tsx  # Error boundary
└── integration/
    ├── userStoreSync.ts              # Синхронизация с user store
    └── filters-permission-context.ts # Контекст для фильтров
```

### 2.3 Ключевые типы Filter Scope

```typescript
// Permission для filter scope (хранится в БД)
type FilterScopePermission =
  | 'filters.scope.all'              // Полный доступ
  | 'filters.scope.subdivision'       // Подразделение
  | 'filters.scope.department'        // Отдел
  | 'filters.scope.team'              // Команда
  | 'filters.scope.managed_projects'  // Управляемые проекты

// Уровень области видимости
type FilterScopeLevel =
  | 'all'          // Администратор
  | 'subdivision'  // Начальник подразделения
  | 'department'   // Начальник отдела
  | 'team'         // Тимлид/сотрудник
  | 'projects'     // Руководитель проекта

// Область видимости пользователя
interface FilterScope {
  level: FilterScopeLevel
  subdivisionIds?: string[]
  departmentIds?: string[]
  teamIds?: string[]
  projectIds?: string[]
  isLocked: boolean  // Нельзя изменить через UI
}

// Полный контекст фильтрации
interface UserFilterContext {
  userId: string
  roles: string[]
  primaryRole: string
  permissions: string[]
  filterPermissions: FilterScopePermission[]

  // Орг. структура пользователя
  ownTeamId: string
  ownTeamName: string
  ownDepartmentId: string
  ownDepartmentName: string
  ownSubdivisionId: string
  ownSubdivisionName: string

  // Руководящие позиции
  leadTeamId?: string
  leadTeamName?: string
  headDepartmentId?: string
  headDepartmentName?: string
  headSubdivisionId?: string
  headSubdivisionName?: string
  managedProjectIds?: string[]
  managedProjectNames?: string[]

  // Итоговый scope
  scope: FilterScope
}

// Ключи фильтров которые могут быть заблокированы
type LockableFilterKey = 'подразделение' | 'отдел' | 'команда' | 'проект'
```

### 2.4 Приоритеты

**Permissions:**
```typescript
PERMISSION_PRIORITY = {
  'filters.scope.all': 1,           // Высший
  'filters.scope.subdivision': 2,
  'filters.scope.department': 3,
  'filters.scope.managed_projects': 4,
  'filters.scope.team': 5,          // Низший
}
```

**Roles:**
```typescript
ROLE_PRIORITY = {
  admin: 1,
  subdivision_head: 2,
  department_head: 3,
  project_manager: 4,
  team_lead: 5,
  user: 6,
}
```

### 2.5 Zustand Store (usePermissionsStore)

```typescript
interface PermissionsState {
  permissions: string[]
  isLoading: boolean
  error: string | null
  lastUpdated: Date | null
  filterScope: FilterScope | null
  orgContext: OrgContext | null

  // Методы
  setPermissions: (permissions: string[]) => void
  setFilterScope: (scope: FilterScope | null) => void
  setOrgContext: (context: OrgContext | null) => void
  hasPermission: (permission: string) => boolean
  hasAnyPermission: (permissions: string[]) => boolean
  hasAllPermissions: (permissions: string[]) => boolean
}
```

**Селекторы:**
```typescript
usePermissions()           // string[]
usePermissionsLoading()    // boolean
usePermissionsError()      // string | null
useHasPermission(perm)     // boolean
useFilterScope()           // FilterScope | null
useOrgContext()            // OrgContext | null
useIsAdmin()               // boolean
```

---

## 3. Интеграция permissions + inline-filter

### 3.1 Архитектура защиты (2 уровня)

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT SIDE                           │
│                                                              │
│  1. useFilteredOptions()                                     │
│     - Фильтрует опции автокомплита                          │
│     - Пользователь НЕ ВИДИТ недоступные опции               │
│                                                              │
│  2. getLockedFilters()                                       │
│     - Показывает заблокированные фильтры в UI               │
│     - Визуальная индикация ограничений                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        SERVER SIDE                           │
│                                                              │
│  3. applyMandatoryFilters()                                  │
│     - Принудительно добавляет ограничения                   │
│     - SECURITY: При отсутствии контекста → BLOCKING_UUID    │
│     - Работает в Server Actions                             │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 useFilteredOptions (хук)

Фильтрует опции автокомплита на основе scope:

```typescript
function useFilteredOptions(
  allOptions: FilterOption[],
  filterContext: UserFilterContext | null,
  hierarchy?: HierarchyContext
): FilterOption[]
```

**Логика фильтрации по ключам:**

| Ключ | all | subdivision | department | team | projects |
|------|-----|-------------|------------|------|----------|
| подразделение | ✅ все | ✅ только своё | ❌ | ❌ | ❌ |
| отдел | ✅ все | ✅ из подразд. | ✅ только свой | ❌ | ❌ |
| команда | ✅ все | ✅ из подразд. | ✅ из отдела | ✅ только своя | ❌ |
| проект | ✅ все | ✅ все | ✅ все | ✅ все | ✅ только управл. |
| ответственный | ✅ все | ✅ из подразд. | ✅ из отдела | ✅ из команды | ✅ все |

### 3.3 applyMandatoryFilters (server-side)

Принудительно применяет ограничения к фильтрам:

```typescript
function applyMandatoryFilters(
  userFilters: FilterQueryParams,
  filterContext: UserFilterContext | null
): FilterQueryParams
```

**Логика:**
1. Если `filterContext === null` → return `{ team_id: BLOCKING_UUID }` (блокировка)
2. Если `scope.level === 'all'` → return userFilters без изменений
3. Иначе → добавляет принудительные фильтры:
   - `subdivision` → добавляет `subdivision_id`
   - `department` → добавляет `department_id`, удаляет `subdivision_id`
   - `team` → добавляет `team_id`, удаляет выше
   - `projects` → ограничивает `project_id` списком управляемых

### 3.4 Scope Resolver

Вычисляет scope на основе permissions:

```typescript
function resolveFilterScope(
  permissions: FilterScopePermission[],
  context: ScopeContext
): FilterScope
```

**Правила:**
1. `filters.scope.all` → `{ level: 'all', isLocked: false }`
2. Permissions комбинируются (subdivision + projects = видит подразделение + проекты)
3. Fallback: если нет permissions → своя команда (locked)

---

## 4. Server Action: getFilterContext

Загружает полный контекст фильтрации из БД:

```typescript
async function getFilterContext(): Promise<ActionResult<UserFilterContext | null>>
```

**Шаги:**
1. Получает текущего user из auth
2. Загружает профиль из `view_users`
3. Загружает роли из `user_roles → roles`
4. Загружает permissions через `get_user_permissions` RPC
5. Определяет руководящие позиции:
   - `teams.team_lead_id` → leadTeamId
   - `departments.department_head_id` → headDepartmentId
   - `subdivisions.subdivision_head_id` → headSubdivisionId
   - `projects.project_manager/project_lead_engineer` → managedProjectIds
6. Вычисляет scope через `resolveFilterScope`

**Кэширование:**
- `staleTime: 10 минут`
- `gcTime: 30 минут`
- `refetchOnWindowFocus: false`

---

## 5. Текущие проблемы и ограничения

### 5.1 В модуле inline-filter

1. **Нет поддержки locked фильтров** - компонент не знает о заблокированных фильтрах
2. **Нет визуализации scope** - нет индикации ограничений пользователя
3. **options не фильтруются автоматически** - модуль не знает о permissions

### 5.2 В интеграции

1. **Разрозненность** - логика разрешений в permissions, а использование в каждом модуле отдельно
2. **Дублирование** - каждый модуль (resource-graph, budgets) реализует свой useFilterOptions
3. **Нет централизованного применения** - mandatory filters вызываются вручную

---

## 6. Требования к интеграции

### 6.1 Цели

1. **Автоматическая фильтрация опций** - InlineFilter сам фильтрует options на основе scope
2. **Визуализация locked фильтров** - показывать заблокированные значения в UI
3. **Централизация** - единый источник правды для filter permissions
4. **Безопасность** - невозможность обхода ограничений через UI

### 6.2 Предлагаемые изменения

**В inline-filter:**
```typescript
interface InlineFilterProps {
  // ... существующие props

  // Новые props для permissions
  filterContext?: UserFilterContext | null
  showLockedFilters?: boolean
}
```

**Новый хук для интеграции:**
```typescript
// modules/inline-filter/hooks/usePermissionAwareFilter.ts
function usePermissionAwareFilter(
  allOptions: FilterOption[],
  config: FilterConfig
): {
  filteredOptions: FilterOption[]
  lockedFilters: LockedFilter[]
  filterContext: UserFilterContext | null
  isLoading: boolean
}
```

---

## 7. Примеры использования

### 7.1 Текущее использование (без permissions)

```typescript
// В компоненте
const { options } = useFilterOptions() // загружает ВСЕ опции
<InlineFilter
  config={FILTER_CONFIG}
  value={filterString}
  onChange={setFilterString}
  options={options}
/>
```

### 7.2 С permissions (цель)

```typescript
// В компоненте
const { filteredOptions, lockedFilters, isLoading } = usePermissionAwareFilter(
  allOptions,
  FILTER_CONFIG
)

<InlineFilter
  config={FILTER_CONFIG}
  value={filterString}
  onChange={setFilterString}
  options={filteredOptions}
  lockedFilters={lockedFilters}
  showLockedBadge
/>
```

---

## 8. Следующие шаги

1. [ ] Определить API интеграции (props, хуки)
2. [ ] Добавить поддержку locked фильтров в InlineFilter
3. [ ] Создать централизованный хук usePermissionAwareFilter
4. [ ] Мигрировать модули (resource-graph, budgets) на новый API
5. [ ] Добавить тесты для edge cases

---

*Документация создана: 2026-01-16*
*Для задачи: Интеграция системы разрешений в inline-filter*
