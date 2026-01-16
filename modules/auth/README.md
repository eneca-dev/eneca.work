# Auth Module

Централизованный модуль авторизации для eneca.work.

## Архитектура

```
modules/auth/
├── components/
│   └── AuthProvider.tsx    # Провайдер с onAuthStateChange
├── hooks/
│   └── useAuth.ts          # Хуки для доступа к данным авторизации
├── types/
│   └── index.ts            # TypeScript типы
└── index.ts                # Public API
```

## Функции модуля

### AuthProvider

Централизованный провайдер, который:
- Слушает **ВСЕ** события Supabase Auth через `onAuthStateChange`
- Синхронизирует `useUserStore` при входе/выходе
- Очищает кэш TanStack Query при logout
- Очищает permissions при logout
- Устанавливает/очищает контекст Sentry

### Обрабатываемые события

| Событие | Действие |
|---------|----------|
| `INITIAL_SESSION` | Загрузка профиля при старте приложения |
| `SIGNED_IN` | Загрузка профиля при входе |
| `SIGNED_OUT` | Полная очистка состояния + редирект |
| `TOKEN_REFRESHED` | Логирование (сессия продолжается) |
| `USER_UPDATED` | Перезагрузка профиля |
| `PASSWORD_RECOVERY` | Редирект на страницу сброса пароля |

## Использование

### Подключение провайдера

```tsx
// app/ClientProviders.tsx
import { AuthProvider } from "@/modules/auth"

export default function ClientProviders({ children }) {
  return (
    <QueryProvider>
      <AuthProvider>
        {/* AuthProvider должен быть первым после QueryProvider */}
        <UserPermissionsSyncProvider>
          {children}
        </UserPermissionsSyncProvider>
      </AuthProvider>
    </QueryProvider>
  )
}
```

### Использование хуков

```tsx
import { useAuth, useIsAuthenticated, useUserId } from "@/modules/auth"

// Полный доступ к данным авторизации
function MyComponent() {
  const { user, isAuthenticated, isLoading, signOut } = useAuth()

  if (isLoading) return <Spinner />
  if (!isAuthenticated) return <LoginPrompt />

  return (
    <div>
      <p>Привет, {user.name}!</p>
      <button onClick={signOut}>Выйти</button>
    </div>
  )
}

// Простая проверка авторизации
function ProtectedFeature() {
  const isAuthenticated = useIsAuthenticated()
  if (!isAuthenticated) return null
  return <Feature />
}

// Получение ID пользователя
function UserActions() {
  const userId = useUserId()
  // ...
}
```

### Выход из системы

```tsx
import { useAuthContext } from "@/modules/auth"

function LogoutButton() {
  const { signOut } = useAuthContext()

  return <button onClick={signOut}>Выйти</button>
}
```

## Доступные хуки

| Хук | Описание |
|-----|----------|
| `useAuth()` | Полные данные авторизации + signOut |
| `useAuthContext()` | Контекст провайдера (isInitialized, isLoading, signOut) |
| `useCurrentUser()` | Данные пользователя (throws если не авторизован) |
| `useIsAuthenticated()` | Булево значение авторизации |
| `useUserId()` | ID пользователя или null |
| `useUserProfile()` | Профиль пользователя или null |
| `useUserAvatar()` | URL аватара или null |
| `useUserName()` | Имя пользователя |
| `useUserEmail()` | Email пользователя или null |

## Типы

```typescript
import type { UserProfile, UserData, Session, User } from "@/modules/auth"
```

## Порядок провайдеров

**Важно:** AuthProvider должен быть подключен в правильном порядке:

1. `QueryProvider` — базовый кеш для всех данных
2. `AuthProvider` — централизованная авторизация
3. `RealtimeSync` — подписка на изменения БД
4. `UserPermissionsSyncProvider` — загрузка permissions

## Что делает AuthProvider при logout

1. Очищает `useUserStore` (данные пользователя)
2. Очищает `usePermissionsStore` (permissions)
3. Сбрасывает TanStack Query cache (`resetQueryClient()`)
4. Очищает Sentry user context
5. Удаляет legacy ключи из localStorage
6. Редиректит на `/auth/login`

## Интеграция с другими модулями

- **permissions** — загружается после авторизации через `UserPermissionsSyncProvider`
- **cache** — очищается при logout через `resetQueryClient()`
- **Sentry** — устанавливает/очищает user context

---

## Как получать данные пользователя в других модулях

### 1. Получение данных авторизованного пользователя

```tsx
// Вариант 1: Хук useAuth (рекомендуется для компонентов)
import { useAuth } from "@/modules/auth"

function MyComponent() {
  const { user, isAuthenticated, isLoading } = useAuth()

  if (isLoading) return <Skeleton />
  if (!isAuthenticated) return null

  return <div>Привет, {user.name}!</div>
}
```

```tsx
// Вариант 2: Отдельные хуки (меньше ререндеров)
import { useUserId, useUserName, useUserProfile } from "@/modules/auth"

function UserCard() {
  const userId = useUserId()        // string | null
  const userName = useUserName()    // string
  const profile = useUserProfile()  // UserProfile | null

  return (
    <div>
      <p>ID: {userId}</p>
      <p>Имя: {userName}</p>
      <p>Должность: {profile?.position_id}</p>
    </div>
  )
}
```

```tsx
// Вариант 3: Напрямую из store (для server actions, утилит)
import { useUserStore } from "@/stores/useUserStore"

// В компоненте
const userId = useUserStore((state) => state.id)
const profile = useUserStore((state) => state.profile)

// Вне React (в функциях, actions)
const { id, email, profile } = useUserStore.getState()
```

### 2. Проверка разрешений пользователя

```tsx
// Вариант 1: Компонент-обёртка (рекомендуется)
import { PermissionGuard } from "@/modules/permissions"

function AdminPanel() {
  return (
    <PermissionGuard permission="users.admin_panel">
      <AdminContent />
    </PermissionGuard>
  )
}

// С fallback
<PermissionGuard
  permission="projects.edit"
  fallback={<p>Нет доступа</p>}
>
  <EditButton />
</PermissionGuard>
```

```tsx
// Вариант 2: Хук useHasPermission
import { useHasPermission } from "@/modules/permissions"

function ProjectActions() {
  const canEdit = useHasPermission("projects.edit")
  const canDelete = useHasPermission("projects.delete")

  return (
    <div>
      {canEdit && <EditButton />}
      {canDelete && <DeleteButton />}
    </div>
  )
}
```

```tsx
// Вариант 3: Проверка нескольких разрешений
import { useHasAnyPermission, useHasAllPermissions } from "@/modules/permissions"

function ManagerTools() {
  // Любое из разрешений
  const canManage = useHasAnyPermission(["users.edit", "users.delete"])

  // Все разрешения
  const isFullAdmin = useHasAllPermissions(["users.edit", "users.delete", "users.create"])

  if (!canManage) return null
  return <ManagerPanel isFullAdmin={isFullAdmin} />
}
```

```tsx
// Вариант 4: Напрямую из store
import { usePermissionsStore } from "@/modules/permissions"

// В компоненте
const permissions = usePermissionsStore((state) => state.permissions)
const hasPermission = permissions.includes("projects.edit")

// Вне React
const { permissions } = usePermissionsStore.getState()
```

### 3. Доступные поля профиля (UserProfile)

```typescript
interface UserProfile {
  first_name?: string | null
  last_name?: string | null
  avatar_url?: string | null
  department_id?: string | null
  team_id?: string | null
  position_id?: string | null
  category_id?: string | null
  subdivision_id?: string | null
  work_format?: string | null      // "В офисе" | "Удаленно" | "Гибридный"
  salary?: number | null
  is_hourly?: boolean | null
  employment_rate?: number | null  // 0.5, 1.0 и т.д.
  city?: string | null
  country?: string | null
  role_id?: string | null
}
```

### 4. Примеры использования в модулях

#### В Server Action:
```typescript
// modules/projects/actions/create-project.ts
"use server"

import { createClient } from "@/utils/supabase/server"

export async function createProject(data: CreateProjectInput) {
  const supabase = await createClient()

  // Получаем пользователя из сессии на сервере
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Не авторизован")
  }

  return supabase
    .from("projects")
    .insert({ ...data, created_by: user.id })
}
```

#### В хуке с React Query:
```typescript
// modules/tasks/hooks/useTasks.ts
import { useUserId } from "@/modules/auth"
import { useQuery } from "@tanstack/react-query"

export function useMyTasks() {
  const userId = useUserId()

  return useQuery({
    queryKey: ["tasks", "my", userId],
    queryFn: () => fetchTasksByUser(userId!),
    enabled: !!userId, // Запрос только если есть userId
  })
}
```

#### Условный рендеринг по роли:
```tsx
import { useUserProfile } from "@/modules/auth"

function TeamSection() {
  const profile = useUserProfile()

  // Показываем только если пользователь в команде
  if (!profile?.team_id) {
    return <p>Вы не состоите в команде</p>
  }

  return <TeamDashboard teamId={profile.team_id} />
}
```

### 5. Типичные паттерны

#### Защита страницы:
```tsx
// app/dashboard/admin/page.tsx
"use client"

import { useAuth } from "@/modules/auth"
import { useHasPermission } from "@/modules/permissions"
import { redirect } from "next/navigation"

export default function AdminPage() {
  const { isAuthenticated, isLoading } = useAuth()
  const isAdmin = useHasPermission("admin.access")

  if (isLoading) return <Skeleton />
  if (!isAuthenticated) redirect("/auth/login")
  if (!isAdmin) redirect("/dashboard")

  return <AdminDashboard />
}
```

#### Получение данных для формы:
```tsx
import { useUserProfile, useUserName, useUserEmail } from "@/modules/auth"

function ProfileForm() {
  const profile = useUserProfile()
  const name = useUserName()
  const email = useUserEmail()

  const defaultValues = {
    name,
    email,
    department_id: profile?.department_id ?? "",
    work_format: profile?.work_format ?? "В офисе",
  }

  return <Form defaultValues={defaultValues} />
}
```

---

## Частые вопросы

### Когда использовать `useAuth()` vs отдельные хуки?

- `useAuth()` — когда нужно несколько полей сразу (user + isLoading + signOut)
- `useUserId()`, `useUserName()` и т.д. — когда нужно одно поле (меньше ререндеров)

### Как получить данные вне React-компонента?

```typescript
import { useUserStore } from "@/stores/useUserStore"
import { usePermissionsStore } from "@/modules/permissions"

// Данные пользователя
const { id, email, name, profile } = useUserStore.getState()

// Разрешения
const { permissions } = usePermissionsStore.getState()
const hasAccess = permissions.includes("some.permission")
```

### Почему поля профиля в snake_case?

Поля профиля соответствуют колонкам таблицы `profiles` в Supabase. Это избавляет от лишних преобразований camelCase ↔ snake_case.
