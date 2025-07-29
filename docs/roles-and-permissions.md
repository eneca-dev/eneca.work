# 🔐 Система ролей и разрешений

## 📋 Обзор

Система контроля доступа включает два уровня безопасности:
- **Функциональные разрешения** — что пользователь может делать
- **Ограничения данных** — какие данные пользователь может видеть

## 🗄️ Архитектура базы данных

### Основные таблицы
- `roles` — роли пользователей (admin, user, project_manager)
- `permissions` — конкретные разрешения (user_admin_panel_can_view)
- `role_permissions` — связка многие-ко-многим между ролями и разрешениями
- `profiles` — профили пользователей с полем `role_id`

### Связи
```
User (auth.users) → Profile → Role → Role_Permissions → Permissions
```

## 🎭 Текущие роли

### Admin (Администратор)
- Доступ к админ-панели управления ролями
- Редактирование всех пользователей
- Создание объявлений
- Управление глобальными событиями календаря
- Присваивание любых ролей

### User (Обычный пользователь)
- Базовые права просмотра
- Редактирование собственного профиля

## 🛡️ Текущие разрешения

| Разрешение | Описание |
|------------|----------|
| `user_admin_panel_can_view` | Доступ к панели администратора |
| `users_can_edit_all` | Редактирование всех пользователей |
| `roles_can_add` | Присваивание ролей (кроме admin) |
| `admin_role_can_add` | Присваивание роли администратора |
| `announcements_can_create_and_edit` | Управление объявлениями |
| `calendar_can_create_and_edit_global_events` | Глобальные события календаря |

## 🔄 Процесс загрузки разрешений

1. **DashboardLayout** блокирует интерфейс до загрузки прав
2. **getUserRoleAndPermissions()** получает роль из `profiles` и разрешения через связки
3. **useUserStore** сохраняет разрешения в памяти (не в localStorage)
4. Retry логика с 3 попытками и exponential backoff
5. Fallback timeout 5 секунд

## 🎯 Использование в компонентах

### Проверка разрешений
```typescript
// Прямая проверка
const canEdit = permissions.includes("users_can_edit_all")

// Через метод store
const canCreate = userStore.hasPermission("announcements_can_create_and_edit")

// Через специализированный хук
const { canViewAdminPanel } = useAdminPermissions()
```

### Компоненты-гарды
- `AdminAccessCheck` — защита админ-панели
- `PaymentAccessCheck` — защита финансовой информации

## 🚀 Планируемые улучшения

### 1. Расширенная система разрешений

**Модульная структура:**
- `projects.*` — разрешения для проектов
- `users.*` — разрешения для пользователей  
- `planning.*` — разрешения для планирования
- `calendar.*` — разрешения для календаря

**Иерархия действий:**
- `.view.all` / `.view.department` / `.view.team`
- `.edit.all` / `.edit.managed` / `.edit.own`
- `.create` / `.delete` / `.admin`

### 2. Ограничения данных (Data Constraints)

**Концепция:** контроль не только ЧТО можно делать, но и С КАКИМИ ДАННЫМИ

**Типы ограничений:**
- `projects.scope.all` — все проекты
- `projects.scope.managed` — только управляемые проекты
- `departments.scope.own` — только свой отдел
- `users.scope.team` — только сотрудники команды

### 3. Умные фильтры

**Поведение в зависимости от роли:**
- **Руководитель отдела:** отдел заблокирован на своем, может выбирать команды и сотрудников
- **Руководитель проекта:** доступны только управляемые проекты
- **Администратор:** доступны все фильтры

**UX особенности:**
- Заблокированные фильтры помечены иконкой замка
- Автоматическое заполнение единственно доступных значений
- Каскадное обновление связанных фильтров

### 4. Компоненты условного рендера

**PermissionGuard** — показ/скрытие элементов с fallback
**PermissionBoundary** — неблокирующая загрузка с скелетонами

## 👥 Планируемые роли

### Project Manager (Руководитель проекта)
- Просмотр и редактирование управляемых проектов
- Назначение ответственных
- Управление загрузками команды
- Ограничение: только свои проекты

### Department Head (Руководитель отдела)
- Управление сотрудниками отдела
- Просмотр всех проектов
- Создание глобальных событий
- Ограничение: только свой отдел

### Team Lead (Руководитель команды)
- Управление сотрудниками команды
- Просмотр проектов с участием команды
- Планирование загрузок команды
- Ограничение: только своя команда

## 🔧 Техническая реализация

### Хранение состояния
- **Zustand store** с persist middleware (кроме разрешений)
- **Разрешения только в памяти** для безопасности
- **Автоматическая перезагрузка** при смене роли

### Производительность
- Мемоизация проверок разрешений
- Кэширование доступных данных
- Lazy loading ограничений

### Безопасность
- Защита системных ролей от удаления
- Race condition protection
- Валидация на уровне API

## 📊 Метрики и мониторинг

- Время загрузки разрешений
- Частота ошибок доступа
- Использование различных разрешений
- Производительность фильтрации

## 🎯 Преимущества системы

1. **Гранулярность** — точный контроль доступа
2. **Модульность** — легкое расширение
3. **Безопасность** — многоуровневая защита
4. **UX** — предсказуемое поведение
5. **Производительность** — эффективное кэширование
6. **Масштабируемость** — готовность к росту функционала

## 🧩 Компоненты системы

### 📂 Структура модулей

```
permissions/
├── hooks/              # Хуки для работы с разрешениями
├── components/         # Компоненты защиты и условного рендера
├── utils/              # Утилиты и хелперы
├── types/              # TypeScript типы
├── constants/          # Константы разрешений
├── store/              # Zustand store расширения
└── supabase/           # Интеграция с Supabase
```

### 🎣 Хуки (Hooks)

**`usePermissions()`** — основной хук для проверки разрешений
- `hasPermission(permission)` — проверка конкретного разрешения
- `hasAnyPermission(permissions[])` — проверка любого из списка
- `hasAllPermissions(permissions[])` — проверка всех из списка
- `getPermissionLevel(module)` — получение уровня доступа к модулю

**`useDataConstraints()`** — управление ограничениями данных
- `getAvailableProjects()` — доступные проекты для пользователя
- `getAvailableDepartments()` — доступные отделы
- `getAvailableTeams()` — доступные команды
- `isDataLocked(dataType)` — проверка блокировки данных

**`useModulePermissions(moduleName)`** — разрешения для конкретных модулей
- `useProjectsPermissions()` → `{ canView, canEdit, canCreate, canDelete }`
- `useUsersPermissions()` → `{ canViewAll, canEditAll, canManage }`
- `usePlanningPermissions()` → `{ canViewLoadings, canEditPlan }`

### 🛡️ Компоненты защиты

**`<PermissionGuard>`** — условный рендер на основе разрешений
- `permission: string` — требуемое разрешение
- `fallback?: ReactNode` — что показать при отсутствии прав
- `children: ReactNode` — защищаемый контент

**`<PermissionBoundary>`** — обертка с неблокирующей загрузкой
- `children: ReactNode` — контент
- `loading?: ReactNode` — компонент загрузки (скелетон)

**`<RoleGuard>`** — защита на уровне ролей
- `allowedRoles: string[]` — разрешенные роли
- `redirectTo?: string` — куда перенаправить при отказе

**`<DataScopeProvider>`** — контекст для ограничений данных
- `scope: DataScope` — текущая область данных
- `children: ReactNode`

### 🔧 Утилиты

**`permissionUtils.ts`** — вспомогательные функции
- `checkPermission(user, permission)` — проверка разрешения
- `getUserDataScope(user)` — получение области данных пользователя
- `mergePermissions(permissions[])` — объединение разрешений
- `validatePermissionStructure(permission)` — валидация структуры

**`roleUtils.ts`** — работа с ролями
- `getRolePermissions(roleId)` — разрешения роли
- `getUserRoles(userId)` — роли пользователя
- `isSystemRole(roleName)` — системная ли роль
- `canAssignRole(currentUser, targetRole)` — может ли назначить роль

### 📊 Типы и константы

**`types/permissions.ts`** — основные типы
```typescript
interface Permission {
  id: string
  name: string
  module: string
  action: string
  scope?: string
}

interface DataConstraint {
  type: 'scope' | 'filter' | 'access'
  target: string
  restriction: string
}
```

**`constants/permissions.ts`** — константы разрешений
```typescript
export const PERMISSIONS = {
  PROJECTS: {
    VIEW_ALL: 'projects.view.all',
    EDIT_MANAGED: 'projects.edit.managed'
  },
  USERS: {
    VIEW_ALL: 'users.view.all',
    EDIT_ALL: 'users.edit.all'
  }
}
```

**`constants/roles.ts`** — роли и их наборы разрешений
```typescript
export const ROLE_TEMPLATES = {
  ADMIN: [...],
  PROJECT_MANAGER: [...],
  DEPARTMENT_HEAD: [...]
}
```

### 💾 Хранилище состояния

**`usePermissionsStore.ts`** — основное хранилище разрешений
- `permissions: string[]` — разрешения пользователя
- `constraints: DataConstraint[]` — ограничения данных
- `isLoading: boolean` — статус загрузки
- `loadPermissions(userId)` — загрузка разрешений
- `hasPermission(permission)` — проверка разрешения

**`useDataScopeStore.ts`** — управление областями данных
- `availableProjects: Project[]`
- `availableDepartments: Department[]`
- `availableTeams: Team[]`
- `lockedFilters: string[]`

### 🗄️ Интеграция с Supabase

**`supabasePermissions.ts`** — работа с разрешениями через Supabase
- `getUserPermissions(userId)` — получение разрешений пользователя
- `getRolePermissions(roleId)` — разрешения роли
- `updateUserRole(userId, roleId)` — смена роли пользователя
- `getDataConstraints(userId)` — ограничения данных

**`supabaseQueries.ts`** — SQL запросы и RPC функции
- `getUserRoleAndPermissions()` — комплексный запрос роли и прав
- `checkUserPermission()` — RPC для проверки разрешения
- `getConstrainedData()` — данные с учетом ограничений

**`supabaseSync.ts`** — синхронизация состояния
- `syncPermissionsFromSupabase()` — синхронизация разрешений
- `subscribeToPermissionChanges()` — real-time обновления
- `handlePermissionUpdate()` — обработка изменений разрешений

### 🔄 Взаимодействие компонентов

```
usePermissionsStore → usePermissions → PermissionGuard → UI Components
                   ↓
useDataConstraints → DataScopeProvider → Feature Modules
                   ↓
supabasePermissions → supabaseSync → Real-time Updates
```
