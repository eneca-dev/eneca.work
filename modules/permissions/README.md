# Модуль разрешений

Простая и надёжная система управления разрешениями пользователей, полностью работающая с базой данных.

## 🔄 Архитектура

Система загружает разрешения динамически из БД:
```
profiles.role_id → roles.id → role_permissions → permissions.name
```

## 🚀 Основные компоненты

### 1. Загрузчик разрешений
```ts
import { usePermissionsLoader } from '@/modules/permissions'

const { permissions, isLoading, error, reloadPermissions } = usePermissionsLoader()
```

### 2. Проверка разрешений
```ts
import { useHasPermission } from '@/modules/permissions'

const hasAdminAccess = useHasPermission('users.admin_panel')
const canEditUsers = useHasPermission('users.edit.all')
```

### 3. Гварды компонентов
```tsx
import { PermissionGuard } from '@/modules/permissions'

<PermissionGuard permission="users.admin_panel">
  <AdminPanel />
</PermissionGuard>
```

### 4. Компонент ошибок
```tsx
import { PermissionsErrorBoundary } from '@/modules/permissions'

<PermissionsErrorBoundary 
  error="У пользователя не назначена роль"
  onRetry={reloadPermissions}
/>
```

## ✅ Преимущества

- **Динамическая загрузка** - добавляйте разрешения в БД без изменения кода
- **Автоматическая синхронизация** - права обновляются при смене пользователя  
- **Обработка ошибок** - красивый UI для ошибок загрузки
- **TypeScript** - полная типизация всех функций
- **Sentry интеграция** - трассировка всех операций

## 📊 Отладка

Добавьте отладочную панель на любую страницу:
```tsx
import { PermissionsDebugPanel } from '@/modules/permissions'

<PermissionsDebugPanel />
```

## 🔧 Примеры разрешений

Добавляйте в БД любые разрешения:
- `users.admin_panel` - доступ к админке
- `users.edit.all` - редактирование всех пользователей  
- `hierarchy.is_admin` - роль администратора
- `projects.view.all` - просмотр всех проектов
- `analytics.view.advanced` - расширенная аналитика

Система автоматически подхватит новые разрешения!

## 🔒 Filter Permissions (область видимости фильтров)

Система ограничения области видимости для inline-фильтров на основе ролей.

### Permissions (в БД)
- `filters.scope.all` - полный доступ (администратор)
- `filters.scope.subdivision` - доступ к подразделению
- `filters.scope.department` - доступ к отделу
- `filters.scope.team` - доступ к команде
- `filters.scope.managed_projects` - доступ к управляемым проектам

### Архитектура защиты (2 уровня)

1. **Client-side** - фильтрация опций автокомплита:
```tsx
const { data: filterContext } = useFilterContext()
const filteredOptions = useFilteredOptions(allOptions, filterContext)
const lockedFilters = getLockedFilters(filterContext)
```

2. **Server-side** - принудительные фильтры в Server Actions:
```ts
const safeFilters = applyMandatoryFilters(userFilters, filterContext)
```

### LockedFiltersBadge

Badge, показывающий заблокированные фильтры пользователя:

```tsx
import {
  useFilterContext,
  useFilteredOptions,
  getLockedFilters,
  LockedFiltersBadge
} from '@/modules/permissions'

function Filters() {
  const { data: filterContext } = useFilterContext()
  const filteredOptions = useFilteredOptions(allOptions, filterContext)
  const lockedFilters = getLockedFilters(filterContext)

  return (
    <div className="flex items-center gap-2">
      <LockedFiltersBadge
        filters={lockedFilters}
        scopeLevel={filterContext?.scope.level}
      />
      <InlineFilter options={filteredOptions} ... />
    </div>
  )
}
```

### Отображение по ролям

| Роль | Badge |
|------|-------|
| admin | Нет badge |
| subdivision_head | `Подразделение: ОВ и К` |
| department_head | `Отдел: Проектирование` |
| project_manager | `Проект: Солнечный` или `Проекты: 3` |
| team_lead / user | `Команда: Разработка` |

---

## 🔧 Loadings Permissions (для вкладок Разделы/Отделы на /tasks)

Гранулярная система прав на редактирование загрузок. Подробный дизайн: [docs/superpowers/specs/2026-04-28-role-based-loadings-permissions-design.md](../../docs/superpowers/specs/2026-04-28-role-based-loadings-permissions-design.md).

### Permissions

| Имя | Назначено ролям | Описание |
|---|---|---|
| `loadings.edit.scope.all` | admin | Редактирование любой загрузки |
| `loadings.edit.scope.subdivision` | subdivision_head | Редактирование если ответственный из своего подразделения |
| `loadings.edit.scope.department` | department_head | Редактирование если ответственный из своего отдела |
| `loadings.edit.scope.team` | team_lead | Редактирование если ответственный из своей команды |
| `loadings.edit.scope.managed_projects` | project_manager | Редактирование на своих проектах |
| `loadings.edit.scope.own` | все роли | Редактирование своих загрузок (где сам responsible) |
| `loadings.bulk_shift.department` | admin, department_head | Массовый сдвиг загрузок отдела по проекту |
| `tasks.tabs.view.department` | user, team_lead, department_head | Расширенный просмотр всего отдела на этих вкладках |

### Pure-функции (модуль utils)

```ts
import {
  canEditLoading,
  canBulkShiftDepartment,
  isRestrictedToOwnDepartment,
  type LoadingPermissionContext,
} from '@/modules/permissions'

// На сервере (Server Action)
const allowed = canEditLoading(loading, ctx)

// Применяется ли cross-dept ограничение к юзеру
const restricted = isRestrictedToOwnDepartment(ctx)
```

### Server helpers

```ts
import {
  getFilterContextForTasksTabs,
  assertCanEditLoading,
} from '@/modules/permissions'

// В getSectionsHierarchy / getDepartmentsData — расширяет scope team→department
const ctx = await getFilterContextForTasksTabs()

// В updateSectionLoading / deleteSectionLoading / updateLoadingDates
const result = await assertCanEditLoading(loadingId)
if (!result.success) return result
const { loading, ctx } = result.data
```

### React хуки (клиент)

```tsx
import {
  useCanEditLoading,
  useCanBulkShiftDepartment,
  useIsRestrictedToOwnDepartment,
  useHasAnyLoadingEditPermission,
} from '@/modules/permissions'

// В компонент строки сотрудника
const canEdit = useCanEditLoading({
  responsibleId: employee.id,
  teamId: employee.teamId ?? null,
  departmentId: employee.departmentId ?? null,
  subdivisionId: null,
  projectId: null, // varies per loading; PM check падёт на сервер
})

// На уровне отдела для BulkShift
const canBulkShift = useCanBulkShiftDepartment(department.id)

// Для модалки: ограничивать ли селектор сотрудников
const restricted = useIsRestrictedToOwnDepartment()
```

### Логика `canEditLoading`

OR-логика между всеми scope-permissions юзера:

```
canEditLoading(loading, ctx) returns true if:
  has('loadings.edit.scope.all') OR
  (has('...subdivision') && loading.subdivisionId === ctx.ownSubdivisionId) OR
  (has('...department')   && loading.departmentId   === ctx.ownDepartmentId) OR
  (has('...team')         && loading.teamId         === ctx.ownTeamId) OR
  (has('...managed_projects') && ctx.managedProjectIds.includes(loading.projectId)) OR
  (has('...own')          && loading.responsibleId  === ctx.userId)
```

**Stale-cache fallback:** если у юзера в `permissions` ни одного `loadings.edit.scope.*` (вошёл до миграции), возвращает `true` — RLS защищает.

### Cross-department блокировка

Применяется только к ролям с максимальным scope = department/team/own (т.е. `user`/`team_lead`/`department_head`).

В `updateSectionLoading` / `createSectionLoading`:
- Нельзя переназначить загрузку на сотрудника другого отдела
- Нельзя перенести в раздел чужого отдела

Проверяется через `isRestrictedToOwnDepartment(ctx)` + сравнение department_id до/после.

### Read-only modal

`LoadingModalNewContainer` вычисляет `isReadOnly = !canEditExisting` и пробрасывает в `LoadingModalNew`. В read-only:
- Заголовок "Просмотр загрузки" + подсказка
- Все инпуты `disabled`
- ProjectTree `disabled`
- Скрыты кнопки "Сохранить", "Удалить", "Копировать"
- Только "Закрыть"