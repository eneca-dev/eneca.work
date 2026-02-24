# План: Унификация системы Permissions (v2 — Упрощённый)

## Цель

Объединить два модуля (`permissions/` и `filter-permissions/`) в единую систему авторизации с минимальными изменениями.

## Текущие проблемы

1. **Двойной вызов RPC** — оба модуля вызывают `get_user_permissions`
2. **Дублирование кода** — `computePrimaryRole` vs `getPrimaryRole`
3. **Разделённые stores** — permissions и filterScope хранятся отдельно
4. **Security issue** — `applyMandatoryFilters()` разрешает всё при `scope === undefined`

## Решение

**Минимальный рефакторинг** вместо полной переписки:
- Использовать существующий `getFilterContext()` как единый источник данных
- Добавить `filterScope` в существующий `usePermissionsStore`
- Исправить security issues
- Постепенно мигрировать использования

---

## Шаг 1: Security Fixes (CRITICAL)

### 1.1. Исправить applyMandatoryFilters

**Файл:** `modules/filter-permissions/utils/mandatory-filters.ts`

**Проблема:** При `scope === undefined` функция возвращает фильтры as-is, что даёт полный доступ.

**Исправление:**

```typescript
const NON_EXISTENT_UUID = '00000000-0000-0000-0000-000000000000'

export function applyMandatoryFilters(
  userFilters: FilterQueryParams,
  filterContext: UserFilterContext | null
): FilterQueryParams {
  // CRITICAL: блокировать при отсутствии контекста
  if (!filterContext || !filterContext.scope) {
    console.error('[SECURITY] applyMandatoryFilters called without context — BLOCKING')
    return {
      ...userFilters,
      team_id: NON_EXISTENT_UUID, // Гарантированно ничего не вернёт
    }
  }

  const { scope } = filterContext

  // Admin scope — дополнительная проверка permission
  if (scope.level === 'all') {
    if (!filterContext.filterPermissions.includes('filters.scope.all')) {
      console.error('[SECURITY] Admin scope claimed without permission — BLOCKING')
      return {
        ...userFilters,
        team_id: NON_EXISTENT_UUID,
      }
    }
    return userFilters
  }

  // Остальная логика без изменений...
  const result = { ...userFilters }

  switch (scope.level) {
    case 'subdivision':
      if (scope.subdivisionIds?.length) {
        result.subdivision_id = scope.subdivisionIds[0]
      }
      break
    case 'department':
      if (scope.departmentIds?.length) {
        result.department_id = scope.departmentIds[0]
      }
      break
    case 'team':
      if (scope.teamIds?.length) {
        result.team_id = scope.teamIds[0]
      }
      break
    case 'projects':
      if (scope.projectIds?.length) {
        result.project_id = scope.projectIds
      }
      break
  }

  return result
}
```

### 1.2. Добавить RLS на user_permissions_cache

**Файл миграции:** `supabase/migrations/YYYYMMDD_user_permissions_cache_rls.sql`

```sql
-- Включаем RLS
ALTER TABLE user_permissions_cache ENABLE ROW LEVEL SECURITY;

-- Пользователь видит только свой кэш
CREATE POLICY "select_own_permissions_cache_only"
ON user_permissions_cache
FOR SELECT
USING (user_id = auth.uid());

-- Только триггер (service_role) может записывать
-- Обычные пользователи не могут модифицировать кэш
CREATE POLICY "service_role_manage_permissions_cache"
ON user_permissions_cache
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
```

### 1.3. Исправить SECURITY DEFINER функции

**Файл миграции:** `supabase/migrations/YYYYMMDD_fix_security_definer_search_path.sql`

```sql
-- Добавить SET search_path во все SECURITY DEFINER функции
-- Пример для can_access_loading:

CREATE OR REPLACE FUNCTION public.can_access_loading(p_user_id uuid, p_loading loadings)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public  -- Добавить эту строку
AS $function$
-- Существующая логика без изменений
$function$;

-- Аналогично для других функций:
-- - user_has_role
-- - user_has_permission
-- - has_budget_permission
-- - can_view_section_budget
-- - can_view_project_budget
-- - refresh_user_permissions_cache
```

---

## Шаг 2: Расширить usePermissionsStore

### 2.1. Добавить типы FilterScope

**Файл:** `modules/permissions/types/index.ts`

Добавить в конец файла:

```typescript
// === Filter Scope Types (перенесено из filter-permissions) ===

export const FILTER_SCOPE_LEVELS = [
  'all',
  'subdivision',
  'department',
  'team',
  'projects'
] as const

export type FilterScopeLevel = typeof FILTER_SCOPE_LEVELS[number]

export type FilterScopePermission =
  | 'filters.scope.all'
  | 'filters.scope.subdivision'
  | 'filters.scope.department'
  | 'filters.scope.team'
  | 'filters.scope.managed_projects'

export interface FilterScope {
  level: FilterScopeLevel
  teamIds?: string[]
  departmentIds?: string[]
  subdivisionIds?: string[]
  projectIds?: string[]
  isLocked: boolean
}

export interface OrgContext {
  ownTeamId: string | null
  ownDepartmentId: string | null
  ownSubdivisionId: string | null
  leadTeamId: string | null
  headDepartmentId: string | null
  headSubdivisionId: string | null
  managedProjectIds: string[]
}
```

### 2.2. Расширить store

**Файл:** `modules/permissions/store/usePermissionsStore.ts`

```typescript
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { FilterScope, OrgContext } from '../types'

interface PermissionsState {
  // === Existing ===
  isLoaded: boolean
  isLoading: boolean
  permissions: string[]
  primaryRole: string | null

  // === New: Filter Scope ===
  filterScope: FilterScope | null
  orgContext: OrgContext | null

  // === Existing Actions ===
  setPermissions: (permissions: string[]) => void
  setLoading: (loading: boolean) => void
  clear: () => void

  // === New Actions ===
  setFilterScope: (scope: FilterScope) => void
  setOrgContext: (context: OrgContext) => void

  // === Existing Selectors ===
  hasPermission: (name: string) => boolean
  hasAnyPermission: (names: string[]) => boolean
  hasAllPermissions: (names: string[]) => boolean
}

export const usePermissionsStore = create<PermissionsState>()(
  devtools(
    (set, get) => ({
      // Initial state
      isLoaded: false,
      isLoading: false,
      permissions: [],
      primaryRole: null,
      filterScope: null,
      orgContext: null,

      // Existing actions (без изменений)
      setPermissions: (permissions) => {
        // Существующая логика нормализации...
        const primaryRole = computePrimaryRole(permissions)
        set({ permissions, primaryRole, isLoaded: true, isLoading: false })
      },

      setLoading: (loading) => set({ isLoading: loading }),

      clear: () => set({
        isLoaded: false,
        isLoading: false,
        permissions: [],
        primaryRole: null,
        filterScope: null,
        orgContext: null,
      }),

      // New actions
      setFilterScope: (scope) => set({ filterScope: scope }),
      setOrgContext: (context) => set({ orgContext: context }),

      // Existing selectors (без изменений)
      hasPermission: (name) => {
        const { permissions, primaryRole } = get()
        if (primaryRole === 'admin') return true
        return permissions.includes(name)
      },

      hasAnyPermission: (names) => {
        return names.some(get().hasPermission)
      },

      hasAllPermissions: (names) => {
        return names.every(get().hasPermission)
      },
    }),
    { name: 'permissions-store' }
  )
)

// Helper function (существующая, перенести если её нет)
function computePrimaryRole(permissions: string[]): string | null {
  if (permissions.includes('hierarchy.is_admin')) return 'admin'
  if (permissions.includes('hierarchy.is_subdivision_head')) return 'subdivision_head'
  if (permissions.includes('hierarchy.is_department_head')) return 'department_head'
  if (permissions.includes('hierarchy.is_team_lead')) return 'team_lead'
  if (permissions.includes('hierarchy.is_project_manager')) return 'project_manager'
  return 'user'
}

// === Selectors ===
export const selectFilterScope = (s: PermissionsState) => s.filterScope
export const selectOrgContext = (s: PermissionsState) => s.orgContext
export const selectIsAdmin = (s: PermissionsState) => s.primaryRole === 'admin'
```

### 2.3. Добавить новые хуки

**Файл:** `modules/permissions/hooks/useFilterScope.ts`

```typescript
import { usePermissionsStore, selectFilterScope } from '../store/usePermissionsStore'
import type { FilterScope } from '../types'

export function useFilterScope(): FilterScope | null {
  return usePermissionsStore(selectFilterScope)
}
```

**Файл:** `modules/permissions/hooks/useOrgContext.ts`

```typescript
import { usePermissionsStore, selectOrgContext } from '../store/usePermissionsStore'
import type { OrgContext } from '../types'

export function useOrgContext(): OrgContext | null {
  return usePermissionsStore(selectOrgContext)
}
```

**Обновить:** `modules/permissions/hooks/index.ts`

```typescript
export * from './usePermissions'
export * from './usePermissionsLoader'
export * from './useFilterScope'      // New
export * from './useOrgContext'       // New
```

---

## Шаг 3: Обновить загрузку permissions

### 3.1. Изменить usePermissionsLoader

**Файл:** `modules/permissions/hooks/usePermissionsLoader.ts`

Заменить вызов `getUserPermissions()` на `getFilterContext()`:

```typescript
import { useEffect, useRef } from 'react'
import { useUserStore } from '@/stores/useUserStore'
import { usePermissionsStore } from '../store/usePermissionsStore'
import { getFilterContext } from '@/modules/filter-permissions'

export function usePermissionsLoader() {
  const userId = useUserStore((s) => s.id)
  const isAuthenticated = useUserStore((s) => s.isAuthenticated)

  const setPermissions = usePermissionsStore((s) => s.setPermissions)
  const setFilterScope = usePermissionsStore((s) => s.setFilterScope)
  const setOrgContext = usePermissionsStore((s) => s.setOrgContext)
  const setLoading = usePermissionsStore((s) => s.setLoading)
  const clear = usePermissionsStore((s) => s.clear)

  const loadedUserIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated || !userId) {
      clear()
      loadedUserIdRef.current = null
      return
    }

    // Не перезагружаем если уже загружено
    if (loadedUserIdRef.current === userId) {
      return
    }

    const loadPermissions = async () => {
      setLoading(true)

      try {
        // ЕДИНЫЙ вызов вместо двух отдельных
        const result = await getFilterContext()

        if (result.success && result.data) {
          const { permissions, scope, ...orgData } = result.data

          // Устанавливаем всё в store
          setPermissions(permissions)
          setFilterScope(scope)
          setOrgContext({
            ownTeamId: orgData.ownTeamId,
            ownDepartmentId: orgData.ownDepartmentId,
            ownSubdivisionId: orgData.ownSubdivisionId,
            leadTeamId: orgData.leadTeamId,
            headDepartmentId: orgData.headDepartmentId,
            headSubdivisionId: orgData.headSubdivisionId,
            managedProjectIds: orgData.managedProjectIds,
          })

          loadedUserIdRef.current = userId
        }
      } catch (error) {
        console.error('[usePermissionsLoader] Error:', error)
      } finally {
        setLoading(false)
      }
    }

    loadPermissions()
  }, [isAuthenticated, userId, setPermissions, setFilterScope, setOrgContext, setLoading, clear])
}
```

### 3.2. Обновить getFilterContext для возврата permissions

**Файл:** `modules/filter-permissions/server/get-filter-context.ts`

Убедиться что функция возвращает `permissions` в результате (уже должно быть):

```typescript
return {
  success: true,
  data: {
    userId: user.id,
    roles,
    primaryRole,
    permissions,           // Все permissions пользователя
    filterPermissions,     // Только filters.scope.*
    scope,                 // Вычисленный FilterScope
    // ... org context fields
  }
}
```

---

## Шаг 4: Миграция использований

### 4.1. Маппинг API

| Было | Стало |
|------|-------|
| `useFilterContext()` | `useFilterScope()` + `useOrgContext()` |
| `filterContext.data?.scope` | `useFilterScope()` |
| `filterContext.data?.permissions` | `usePermissionsStore(s => s.permissions)` |

### 4.2. Пример миграции компонента

**Было:**
```typescript
import { useFilterContext } from '@/modules/filter-permissions'

function MyComponent() {
  const { data: filterContext } = useFilterContext()
  const scope = filterContext?.scope
  // ...
}
```

**Стало:**
```typescript
import { useFilterScope } from '@/modules/permissions'

function MyComponent() {
  const filterScope = useFilterScope()
  // ...
}
```

### 4.3. Файлы для миграции

Найти через grep и обновить:

```bash
grep -r "useFilterContext" modules/ --include="*.tsx" --include="*.ts"
```

Ожидаемые файлы:
- `modules/resource-graph/components/...`
- `modules/planning/components/...`
- `modules/inline-filters/...`

---

## Шаг 5: Очистка (после полной миграции)

### 5.1. Удалить дублирующий код

После того как все использования `useFilterContext()` заменены:

1. Удалить `modules/filter-permissions/hooks/use-filter-context.ts`
2. Удалить `modules/permissions/supabase/supabasePermissions.ts` → `getUserPermissions()`
3. Удалить `modules/permissions/integration/filters-permission-context.ts`

### 5.2. Переместить utils

Переместить в `modules/permissions/utils/`:
- `applyMandatoryFilters.ts`
- `resolveFilterScope.ts` (scope-resolver.ts)

### 5.3. Обновить public API

**Файл:** `modules/permissions/index.ts`

```typescript
// Types
export * from './types'

// Store
export { usePermissionsStore } from './store/usePermissionsStore'

// Hooks
export { useHasPermission, useHasAnyPermission } from './hooks/usePermissions'
export { useFilterScope } from './hooks/useFilterScope'
export { useOrgContext } from './hooks/useOrgContext'
export { useFilteredOptions } from './hooks/useFilteredOptions'

// Components
export { PermissionGuard } from './components/PermissionGuard'
export { RoleGuard } from './components/RoleGuard'

// Utils
export { applyMandatoryFilters } from './utils/applyMandatoryFilters'
export { resolveFilterScope } from './utils/resolveFilterScope'

// Server
export { getFilterContext } from './server/getFilterContext'
```

---

## Чек-лист

### Шаг 1: Security Fixes
- [ ] `applyMandatoryFilters()` блокирует при undefined scope
- [ ] RLS на `user_permissions_cache`
- [ ] `SET search_path` в SECURITY DEFINER функциях

### Шаг 2: Store
- [ ] Типы `FilterScope`, `OrgContext` добавлены
- [ ] `usePermissionsStore` расширен
- [ ] Хуки `useFilterScope()`, `useOrgContext()` созданы

### Шаг 3: Загрузка
- [ ] `usePermissionsLoader` использует `getFilterContext()`
- [ ] Один RPC вызов вместо двух

### Шаг 4: Миграция
- [ ] Все `useFilterContext()` заменены на `useFilterScope()`
- [ ] Компоненты работают корректно

### Шаг 5: Очистка
- [ ] Удалён дублирующий код
- [ ] Utils перемещены
- [ ] Public API обновлён

---

## Тестирование

### Ручное тестирование по ролям

- [ ] **Admin** — видит все данные, фильтры не заблокированы
- [ ] **Subdivision Head** — видит только своё подразделение
- [ ] **Department Head** — видит только свой отдел
- [ ] **Team Lead** — видит только свою команду
- [ ] **Project Manager** — видит только свои проекты
- [ ] **User** — видит только свои данные

### Security тесты

- [ ] Попытка доступа к чужим данным через API → заблокировано
- [ ] `applyMandatoryFilters(filters, null)` → возвращает blocking filter
- [ ] Realtime подписка на чужой `user_permissions_cache` → denied

---

## Риски и митигация

| Риск | Митигация |
|------|-----------|
| Breaking changes в хуках | Оба API работают параллельно на этапе миграции |
| Регрессии permissions | Тестирование всех ролей перед удалением старого кода |
| Store не обновляется | Realtime подписка остаётся без изменений |

---

## Результат

**Было:**
- 2 модуля с дублированием
- 2 вызова RPC при инициализации
- Security issue в mandatory filters

**Стало:**
- 1 модуль `permissions/` с полным функционалом
- 1 вызов RPC при инициализации
- Security fixes применены
- ~100 строк изменений вместо ~2000
