# Filter Permissions Module

Система разрешений для inline-фильтров на основе permissions из БД.

## Обзор

Модуль обеспечивает контроль доступа к данным через фильтры используя **стандартную систему permissions**:

```
permissions → role_permissions → roles → user_roles → users
```

---

## Permissions (в таблице `permissions`)

| Permission | Описание | Scope Level |
|------------|----------|-------------|
| `filters.scope.all` | Полный доступ ко всем данным | `all` |
| `filters.scope.subdivision` | Доступ к данным своего подразделения | `subdivision` |
| `filters.scope.department` | Доступ к данным своего отдела | `department` |
| `filters.scope.team` | Доступ к данным своей команды | `team` |
| `filters.scope.managed_projects` | Доступ к данным управляемых проектов | `projects` |

---

## Назначения по умолчанию

| Роль | Permissions |
|------|-------------|
| `admin` | `filters.scope.all` |
| `subdivision_head` | `filters.scope.subdivision` |
| `department_head` | `filters.scope.department` |
| `team_lead` | `filters.scope.team` |
| `project_manager` | `filters.scope.managed_projects` |
| `user` | `filters.scope.team` |

**Permissions комбинируются!** Если пользователь имеет `filters.scope.team` + `filters.scope.managed_projects`, он видит и свою команду, и свои проекты.

---

## Гибкость системы

Теперь можно:

### 1. Дать пользователю доступ к любому scope

```sql
-- Дать обычному user доступ к отделу
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'user'
  AND p.name = 'filters.scope.department';
```

### 2. Создать кастомную роль

```sql
-- Создать роль "региональный менеджер"
INSERT INTO roles (name, description)
VALUES ('regional_manager', 'Региональный менеджер');

-- Дать ей доступ к подразделению
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'regional_manager'
  AND p.name = 'filters.scope.subdivision';
```

### 3. Комбинировать permissions

```sql
-- Дать department_head также доступ к проектам
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'department_head'
  AND p.name = 'filters.scope.managed_projects';
```

---

## Архитектура защиты

```
┌─────────────────────────────────────────────────────────────────┐
│                     4 УРОВНЯ ЗАЩИТЫ                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. UI OPTIONS FILTERING                                        │
│     └─ useFilteredOptions() скрывает недоступные опции          │
│                           ↓                                     │
│  2. PARSER VALIDATION (опционально)                             │
│     └─ Проверка токенов при парсинге строки фильтра             │
│                           ↓                                     │
│  3. SERVER ACTIONS                                              │
│     └─ applyMandatoryFilters() принудительно добавляет scope    │
│                           ↓                                     │
│  4. RLS (Row Level Security)                                    │
│     └─ can_access_loading() - финальная проверка в PostgreSQL   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Как это работает

### 1. Загрузка permissions

```typescript
// get-filter-context.ts
const { data: directPerms } = await supabase
  .from('user_roles')
  .select(`
    roles!inner(
      role_permissions!inner(
        permissions!inner(name)
      )
    )
  `)
  .eq('user_id', user.id)

// Фильтруем только filter scope permissions
filterPermissions = permNames.filter(name =>
  name.startsWith('filters.scope.')
)
```

### 2. Вычисление scope

```typescript
// scope-resolver.ts
export function resolveFilterScope(
  permissions: FilterScopePermission[],
  context: ScopeContext
): FilterScope {
  // filters.scope.all = полный доступ
  if (permissions.includes('filters.scope.all')) {
    return { level: 'all', isLocked: false }
  }

  // Проверяем каждый permission и собираем scope
  if (permissions.includes('filters.scope.subdivision')) {
    subdivisionIds.add(context.headSubdivisionId)
  }
  // ...
}
```

---

## Использование

### В компонентах

```tsx
import {
  useFilterContext,
  useFilteredOptions,
  getLockedFilters
} from '@/modules/filter-permissions'

function TasksView() {
  const { data: filterContext } = useFilterContext()

  // filterContext.filterPermissions содержит permissions из БД
  console.log(filterContext?.filterPermissions)
  // ['filters.scope.team', 'filters.scope.managed_projects']

  const filteredOptions = useFilteredOptions(allOptions, filterContext)
  const lockedFilters = getLockedFilters(filterContext)

  return (
    <>
      {lockedFilters.map(lock => (
        <Badge key={lock.key}>
          <Lock /> {lock.key}: {lock.displayName}
        </Badge>
      ))}
      <InlineFilter options={filteredOptions} ... />
    </>
  )
}
```

### В Server Actions

```typescript
import { getFilterContext } from '@/modules/filter-permissions/server'
import { applyMandatoryFilters } from '@/modules/filter-permissions/utils'

export async function getResourceGraphData(filters?: FilterQueryParams) {
  const filterContextResult = await getFilterContext()
  const filterContext = filterContextResult.success ? filterContextResult.data : null
  const secureFilters = filterContext
    ? applyMandatoryFilters(filters || {}, filterContext)
    : filters || {}

  // использовать secureFilters
}
```

---

## Структура модуля

```
modules/filter-permissions/
├── types.ts                    # FilterScopePermission, FilterScope, UserFilterContext
├── hooks/
│   ├── use-filter-context.ts   # Hook для загрузки контекста (permissions из БД)
│   └── use-filtered-options.ts # Фильтрация опций + getLockedFilters
├── utils/
│   ├── scope-resolver.ts       # resolveFilterScope(permissions, context)
│   └── mandatory-filters.ts    # applyMandatoryFilters()
├── server/
│   └── get-filter-context.ts   # Server Action - загружает permissions через role_permissions
└── index.ts                    # Публичный API
```

---

## Типы

```typescript
// Permission для filter scope
type FilterScopePermission =
  | 'filters.scope.all'
  | 'filters.scope.subdivision'
  | 'filters.scope.department'
  | 'filters.scope.team'
  | 'filters.scope.managed_projects'

// Контекст пользователя
interface UserFilterContext {
  userId: string
  roles: string[]
  primaryRole: string
  filterPermissions: FilterScopePermission[]  // ← permissions из БД

  // Орг. структура
  ownTeamId: string
  ownDepartmentId: string
  ownSubdivisionId: string

  // Руководящие позиции (заполняются если есть соотв. permission)
  leadTeamId?: string
  headDepartmentId?: string
  headSubdivisionId?: string
  managedProjectIds?: string[]

  // Итоговый scope
  scope: FilterScope
}
```

---

## FAQ

### Как дать пользователю доступ к нескольким командам?

Сейчас scope привязан к одной сущности (команда, которой руководишь или своя команда). Для доступа к нескольким нужно:

1. Создать таблицу `filter_scope_overrides` для кастомных назначений
2. Или использовать более высокий scope (department/subdivision)

### Что если permission назначен, но нет руководящей позиции?

Например, у пользователя есть `filters.scope.department`, но он не является `department_head_id` ни одного отдела.

В этом случае:
- `headDepartmentId` будет `undefined`
- `scope.departmentIds` будет пустым
- Пользователь увидит только свою команду (fallback)

### Как проверить permissions в RLS?

RLS функции (`can_access_loading`) пока проверяют роли через `user_has_role()`. Для полной интеграции с permissions нужно создать аналогичную функцию `user_has_permission()`.

---

## Миграции

### `add_filter_scope_permissions` (новая)

```sql
-- Создаёт permissions
INSERT INTO permissions (name, description) VALUES
  ('filters.scope.all', 'Видит все данные'),
  ('filters.scope.subdivision', 'Видит данные подразделения'),
  ('filters.scope.department', 'Видит данные отдела'),
  ('filters.scope.team', 'Видит данные команды'),
  ('filters.scope.managed_projects', 'Видит данные проектов');

-- Назначает ролям
INSERT INTO role_permissions ...
```

### `add_filter_permissions_rls` (ранее)

Создаёт RLS политики и функции для проверки доступа к `loadings`.
