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