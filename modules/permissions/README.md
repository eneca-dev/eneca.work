# 🔐 Модуль Permissions

Модуль permissions предоставляет комплексную систему управления правами доступа и автоматической преднастройки фильтров в приложении eneca.work.

## 🚀 Быстрый старт

### Базовое использование

```typescript
import { usePermissions, PermissionGuard, PERMISSIONS } from '@/modules/permissions'

function MyComponent() {
  const { hasPermission, loading } = usePermissions()
  
  if (loading) return <div>Загрузка прав...</div>
  
  return (
    <div>
      {hasPermission(PERMISSIONS.USERS.ADMIN_PANEL) && (
        <AdminButton />
      )}
      
      <PermissionGuard permission="users.edit.all">
        <EditAllUsersButton />
      </PermissionGuard>
    </div>
  )
}
```

### Работа с иерархическими статусами

```typescript
import { usePermissions, PERMISSIONS } from '@/modules/permissions'

function SmartFiltersComponent() {
  const { hasPermission } = usePermissions()
  
  // Автонастройка фильтров на основе hierarchy статуса
  useEffect(() => {
    if (hasPermission(PERMISSIONS.HIERARCHY.IS_DEPARTMENT_HEAD)) {
      setDepartmentFilter(userDepartment)
      setDepartmentLocked(true)  // Нельзя сменить
    }
    
    if (hasPermission(PERMISSIONS.HIERARCHY.IS_TEAM_LEAD)) {
      setTeamFilter(userTeam)
      setTeamLocked(true)
    }
  }, [hasPermission])
}
```

## 📚 API Reference

### 🎣 Хуки (Hooks)

#### `usePermissions()`
Основной хук для работы с разрешениями пользователя.

```typescript
const {
  permissions,           // string[] - список разрешений
  hasPermission,        // (permission: string) => boolean
  hasAnyPermission,     // (permissions: string[]) => boolean  
  hasAllPermissions,    // (permissions: string[]) => boolean
  getPermissionLevel,   // (permission: string) => 'none' | 'read' | 'write' | 'admin'
  loading,              // boolean - загружаются ли права
  error                 // string | null - ошибка загрузки
} = usePermissions()
```

#### `useHasPermission(permission: string)`
Быстрая проверка одного разрешения.

```typescript
const canEditUsers = useHasPermission('users.edit.all')
```

#### `useModulePermissions()` - Специализированные хуки
```typescript
// Для каждого модуля есть свой хук
const usersPerms = useUsersPermissions()     // users.*
const projectsPerms = useProjectsPermissions() // projects.*
const calendarPerms = useCalendarPermissions() // calendar.*
const planningPerms = usePlanningPermissions() // planning.*
const hierarchyPerms = useHierarchyPermissions() // hierarchy.*
```

**Пример:**
```typescript
const {
  canViewAdminPanel,    // users.admin_panel
  canEditAllUsers,      // users.edit.all
  canAssignRoles,       // users.assign_roles
  canCreateUsers        // users.create
} = useUsersPermissions()
```

#### `useDataConstraints()`
Хук для работы с ограничениями данных и умными фильтрами.

```typescript
const {
  dataScope,           // Объект с доступными данными пользователя
  lockedFilters,       // Заблокированные фильтры
  updateScope,         // Функция обновления scope
  isDataLocked         // Функция проверки блокировки данных
} = useDataConstraints()
```

### 🛡️ Guard компоненты

#### `<PermissionGuard>`
Условный рендер на основе разрешений.

```typescript
<PermissionGuard 
  permission="users.admin_panel"
  fallback={<div>Доступ запрещен</div>}
>
  <AdminPanel />
</PermissionGuard>

// Множественные разрешения
<PermissionGuard 
  permissions={['users.edit.all', 'users.create']}
  requireAll={true}  // Нужны ВСЕ разрешения (по умолчанию ANY)
>
  <UserManagement />
</PermissionGuard>
```

#### `<RoleGuard>`
Условный рендер на основе ролей.

```typescript
<RoleGuard role="admin">
  <SuperAdminFeatures />
</RoleGuard>

<RoleGuard roles={['admin', 'department_head']}>
  <ManagementFeatures />
</RoleGuard>
```

#### `<PermissionBoundary>`
Обработка состояний загрузки и ошибок разрешений.

```typescript
<PermissionBoundary 
  fallback={<Skeleton />}
  errorFallback={<ErrorMessage />}
>
  <MyComponent />
</PermissionBoundary>
```

#### `<DataScopeProvider>`
Провайдер для работы с ограничениями данных.

```typescript
<DataScopeProvider>
  <FilteredDataComponents />
</DataScopeProvider>
```

### 📝 Константы

#### `PERMISSIONS`
Все разрешения системы, организованные по модулям.

```typescript
import { PERMISSIONS } from '@/modules/permissions'

// Пользователи
PERMISSIONS.USERS.ADMIN_PANEL        // 'users.admin_panel'
PERMISSIONS.USERS.EDIT_ALL           // 'users.edit.all'
PERMISSIONS.USERS.ASSIGN_ROLES       // 'users.assign_roles'

// Проекты  
PERMISSIONS.PROJECTS.VIEW_ALL        // 'projects.view.all'
PERMISSIONS.PROJECTS.CREATE          // 'projects.create'
PERMISSIONS.PROJECTS.EDIT_ALL        // 'projects.edit.all'

// Иерархия
PERMISSIONS.HIERARCHY.IS_ADMIN           // 'hierarchy.is_admin'
PERMISSIONS.HIERARCHY.IS_DEPARTMENT_HEAD // 'hierarchy.is_department_head'
PERMISSIONS.HIERARCHY.IS_PROJECT_MANAGER // 'hierarchy.is_project_manager'
PERMISSIONS.HIERARCHY.IS_TEAM_LEAD       // 'hierarchy.is_team_lead'
PERMISSIONS.HIERARCHY.IS_USER           // 'hierarchy.is_user'

// И другие модули...
```

#### `ROLE_TEMPLATES`
Шаблоны ролей с их разрешениями.

```typescript
import { ROLE_TEMPLATES } from '@/modules/permissions'

const adminPermissions = ROLE_TEMPLATES.ADMIN.permissions
const managerPermissions = ROLE_TEMPLATES.PROJECT_MANAGER.permissions
```

### 🛠️ Утилиты

#### `checkPermission(userPermissions, requiredPermission)`
```typescript
import { checkPermission } from '@/modules/permissions'

const hasAccess = checkPermission(
  ['users.view.all', 'users.edit.all'], 
  'users.edit.all'
)  // true
```

#### `getPermissionLevel(permission)`
```typescript
import { getPermissionLevel } from '@/modules/permissions'

const level = getPermissionLevel('users.edit.all')  // 'write'
```

#### `groupPermissionsByModule(permissions)`
```typescript
import { groupPermissionsByModule } from '@/modules/permissions'

const grouped = groupPermissionsByModule([
  'users.edit.all', 
  'projects.view.all'
])
// { users: ['users.edit.all'], projects: ['projects.view.all'] }
```

## 🎯 Практические примеры

### 1. Компонент с условным рендером

```typescript
import { usePermissions, PermissionGuard, PERMISSIONS } from '@/modules/permissions'

function UserListComponent() {
  const { hasPermission } = usePermissions()
  
  return (
    <div>
      <h1>Пользователи</h1>
      
      {/* Кнопка создания только для тех, кто может */}
      <PermissionGuard permission={PERMISSIONS.USERS.CREATE}>
        <CreateUserButton />
      </PermissionGuard>
      
      {/* Список пользователей */}
      <UserList />
      
      {/* Админ панель только для админов */}
      {hasPermission(PERMISSIONS.USERS.ADMIN_PANEL) && (
        <AdminActions />
      )}
    </div>
  )
}
```

### 2. Умные фильтры с hierarchy статусами

```typescript
import { usePermissions, useDataConstraints, PERMISSIONS } from '@/modules/permissions'

function SmartFilters() {
  const { hasPermission } = usePermissions()
  const { lockedFilters, updateScope } = useDataConstraints()
  
  const [filters, setFilters] = useState({
    department: '',
    team: '',
    projects: []
  })
  
  // Автонастройка при изменении прав
  useEffect(() => {
    // Руководитель отдела - только свой отдел
    if (hasPermission(PERMISSIONS.HIERARCHY.IS_DEPARTMENT_HEAD)) {
      setFilters(prev => ({
        ...prev,
        department: userDepartment
      }))
      updateScope({ departmentLocked: true })
    }
    
    // Руководитель команды - только своя команда  
    if (hasPermission(PERMISSIONS.HIERARCHY.IS_TEAM_LEAD)) {
      setFilters(prev => ({
        ...prev,
        team: userTeam
      }))
      updateScope({ teamLocked: true })
    }
    
    // Админ - доступ ко всем данным
    if (hasPermission(PERMISSIONS.HIERARCHY.IS_ADMIN)) {
      updateScope({ 
        departmentLocked: false,
        teamLocked: false 
      })
    }
  }, [hasPermission])
  
  return (
    <div>
      <select 
        value={filters.department}
        disabled={lockedFilters.department}
        onChange={(e) => setFilters(prev => ({...prev, department: e.target.value}))}
      >
        {/* Опции отделов */}
      </select>
      
      <select 
        value={filters.team}
        disabled={lockedFilters.team}
        onChange={(e) => setFilters(prev => ({...prev, team: e.target.value}))}
      >
        {/* Опции команд */}
      </select>
    </div>
  )
}
```

### 3. Модальное окно с проверкой прав

```typescript
import { PermissionGuard, RoleGuard, PERMISSIONS } from '@/modules/permissions'

function UserEditModal({ user, onClose }) {
  return (
    <Modal isOpen onClose={onClose}>
      <Modal.Header>Редактирование пользователя</Modal.Header>
      <Modal.Body>
        {/* Основные поля может редактировать любой с правом edit */}
        <PermissionGuard permission={PERMISSIONS.USERS.EDIT_ALL}>
          <BasicUserFields user={user} />
        </PermissionGuard>
        
        {/* Роли только для тех, кто может назначать роли */}
        <PermissionGuard permission={PERMISSIONS.USERS.ASSIGN_ROLES}>
          <RoleSelector user={user} />
          
          {/* Роль админа только для админов */}
          <PermissionGuard permission={PERMISSIONS.USERS.ASSIGN_ADMIN_ROLE}>
            <AdminRoleOption />
          </PermissionGuard>
        </PermissionGuard>
        
        {/* Удаление только для админов */}
        <RoleGuard role="admin">
          <DeleteUserButton user={user} />
        </RoleGuard>
      </Modal.Body>
    </Modal>
  )
}
```

### 4. HOC для защиты страниц

```typescript
import { RoleGuard } from '@/modules/permissions'

function withAdminAccess<T extends object>(WrappedComponent: React.ComponentType<T>) {
  return function AdminProtectedComponent(props: T) {
    return (
      <RoleGuard 
        role="admin"
        fallback={
          <div className="text-center p-8">
            <h2>Доступ запрещен</h2>
            <p>Эта страница доступна только администраторам</p>
          </div>
        }
      >
        <WrappedComponent {...props} />
      </RoleGuard>
    )
  }
}

// Использование
const AdminOnlyPage = withAdminAccess(MyAdminPage)
```

## 🔧 Интеграция с Supabase

### Загрузка разрешений

```typescript
import { supabasePermissions } from '@/modules/permissions'

// Получение разрешений пользователя
const permissions = await supabasePermissions.getUserPermissions(userId)

// Проверка конкретного разрешения в БД
const hasPermission = await supabasePermissions.checkUserPermission(
  userId, 
  'users.admin_panel'
)

// Получение всех ролей
const roles = await supabasePermissions.getAllRoles()
```

### Управление ролями через API

```typescript
// Создание новой роли
await supabasePermissions.createRole({
  name: 'custom_manager',
  description: 'Кастомная роль менеджера'
})

// Назначение разрешения роли
await supabasePermissions.assignPermissionToRole(
  roleId, 
  permissionId
)

// Обновление роли пользователя
await supabasePermissions.updateUserRole(userId, newRoleId)
```

## 🎨 Лучшие практики

### ✅ Что делать

1. **Используйте константы разрешений**
   ```typescript
   // ✅ Хорошо
   hasPermission(PERMISSIONS.USERS.ADMIN_PANEL)
   
   // ❌ Плохо
   hasPermission('users.admin_panel')
   ```

2. **Проверяйте права на уровне компонентов**
   ```typescript
   // ✅ Хорошо - проверяем права там, где нужны
   function UserCard({ user }) {
     const canEdit = useHasPermission(PERMISSIONS.USERS.EDIT_ALL)
     
     return (
       <Card>
         <UserInfo user={user} />
         {canEdit && <EditButton />}
       </Card>
     )
   }
   ```

3. **Используйте hierarchy для фильтров**
   ```typescript
   // ✅ Хорошо - автоматическая настройка
   if (hasPermission(PERMISSIONS.HIERARCHY.IS_TEAM_LEAD)) {
     setTeamFilter(userTeam)
     setTeamLocked(true)
   }
   ```

4. **Обрабатывайте состояния загрузки**
   ```typescript
   // ✅ Хорошо
   const { hasPermission, loading } = usePermissions()
   
   if (loading) return <Skeleton />
   
   return hasPermission('...') ? <Feature /> : null
   ```

### ❌ Чего избегать

1. **Не хардкодьте строки разрешений**
2. **Не дублируйте проверки прав**
3. **Не забывайте про состояния загрузки**
4. **Не смешивайте логику прав с бизнес-логикой**

## 🐛 Troubleshooting

### Права не загружаются
```typescript
// Проверьте, что пользователь аутентифицирован
const { isAuthenticated } = useUserStore()
if (!isAuthenticated) {
  // Права загружаются только для аутентифицированных пользователей
}

// Проверьте состояние загрузки
const { loading, error } = usePermissions()
if (error) {
  console.error('Ошибка загрузки прав:', error)
}
```

### Компонент не перерендеривается при смене прав
```typescript
// Убедитесь, что используете правильные зависимости
const { hasPermission } = usePermissions()

useEffect(() => {
  // Реакция на изменение прав
}, [hasPermission]) // ✅ Правильная зависимость
```

### Фильтры не блокируются автоматически
```typescript
// Убедитесь, что используете useDataConstraints
const { lockedFilters } = useDataConstraints()

// И применяете блокировку в UI
<select disabled={lockedFilters.department}>
```

## 🔄 Обновления модуля

### Добавление нового разрешения

1. **Добавить в БД:**
   ```sql
   INSERT INTO permissions (name, description) 
   VALUES ('module.action.target', 'Описание разрешения');
   ```

2. **Обновить константы:**
   ```typescript
   // modules/permissions/constants/permissions.ts
   export const PERMISSIONS = {
     MODULE: {
       NEW_PERMISSION: 'module.action.target'
     }
   } as const
   ```

3. **Добавить в хук модуля:**
   ```typescript
   // modules/permissions/hooks/useModulePermissions.ts
   export const useModulePermissions = () => {
     return {
       canDoNewAction: useHasPermission(PERMISSIONS.MODULE.NEW_PERMISSION)
     }
   }
   ```

### Добавление нового модуля

1. Создать константы в `constants/permissions.ts`
2. Добавить в `constants/roles.ts` 
3. Создать специализированный хук в `hooks/useModulePermissions.ts`
4. Обновить типы в `types/index.ts`

---

## 📞 Поддержка

При возникновении вопросов или проблем:
1. Проверьте эту документацию
2. Посмотрите примеры в других модулях
3. Проверьте состояние разрешений в DevTools
4. Обратитесь к команде разработки

**Модуль permissions готов к использованию!** 🚀 