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

Система автоматически подхватит новые разрешения! 🎉