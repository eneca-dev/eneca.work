# Руководство по приложению для нейросети

## Технологии приложения

- **Frontend Framework**: Next.js 15.2.4 с React 19
- **Стилизация**: Tailwind CSS с утилитами clsx и tailwind-merge
- **UI компоненты**: Радикс UI (Radix UI) - полный набор компонентов с доступностью
- **Темизация**: next-themes для поддержки темной/светлой темы
- **Управление состоянием**: Zustand 5.0.3 с middleware devtools и persist
- **Формы**: react-hook-form с валидацией zod
- **База данных**: Supabase с аутентификацией и SSR интеграцией (@supabase/ssr)
- **Иконки**: Lucide React
- **Уведомления**: Sonner для тостов

## Структура приложения

1. **`app/`** - основные страницы Next.js App Router
   - `auth/` - страницы аутентификации (логин, регистрация, сброс пароля)
   - `dashboard/` - защищенные страницы приложения (основной функционал)

2. **`components/`** - переиспользуемые React компоненты
   - Включает компоненты UI на основе Radix

3. **`hooks/`** - пользовательские React хуки

4. **`lib/`** - служебные функции
   - `utils.ts` - утилиты для работы с классами

5. **`modules/`** - функциональные модули приложения

6. **`public/`** - статические файлы

7. **`stores/`** - хранилища состояния Zustand

8. **`styles/`** - глобальные стили

9. **`utils/`** - утилиты
   - `supabase/` - клиенты и утилиты для Supabase

## Интерфейс взаимодействия с базой данных (Supabase)

Приложение использует Supabase для хранения данных и аутентификации. Взаимодействие происходит через следующие клиенты:

- **Серверный клиент**: `utils/supabase/server.ts` - создает клиент на стороне сервера для серверных компонентов
- **Клиентский клиент**: `utils/supabase/client.ts` - создает клиент на стороне клиента для клиентских компонентов
- **Middleware**: `utils/supabase/middleware.ts` - обрабатывает сессии и перенаправления

Для доступа к базе данных необходимо использовать соответствующий клиент:

```typescript
// В серверном компоненте
import { createClient } from "@/utils/supabase/server"
const supabase = createClient()

// В клиентском компоненте
import { createClient } from "@/utils/supabase/client"
const supabase = createClient()
```

## Работа с Zustand в приложении

Zustand используется для управления глобальным состоянием. Основные хранилища:

1. **`useUserStore`** - хранение информации о пользователе и его профиле
2. **`useSettingsStore`** - хранение пользовательских настроек (например, тема)
3. **`useUiStore`** - хранение состояния UI (открытие/закрытие модалок и т.д.)

Все хранилища используют middleware:
- **persist** - для сохранения данных в localStorage

## Информация в хранилищах (stores)

### useUserStore
Хранит информацию о текущем пользователе:
- `id`, `email`, `name` - основная информация
- `profile` - расширенная информация профиля
- `isAuthenticated` - статус аутентификации
- `role` - роль пользователя
- `permissions` - разрешения пользователя

Методы:
- `setUser(userData)` - установка данных пользователя
- `clearUser()` - очистка данных пользователя
- `setRoleAndPermissions(role, permissions)` - установка роли и разрешений

### useSettingsStore
Хранит пользовательские настройки:
- `theme` - текущая тема ('light', 'dark', 'system')

Методы:
- `setTheme(theme)` - изменение темы

## Основные страницы

1. **Аутентификация** (`/auth/*`):
   - Вход (`/auth/login`)
   - Регистрация (`/auth/register`)
   - Восстановление пароля (`/auth/forgot-password`, `/auth/reset-password`)

2. **Дашборд** (`/dashboard/*`):
   - Главная страница дашборда (`/dashboard`)
   - Пользователи (`/dashboard/users`)
   - Задачи (`/dashboard/tasks`)
   - Прогресс (`/dashboard/progress`)
   - Планирование (`/dashboard/planning`)
   - Настройки (`/dashboard/settings`)

## Работа с темой

Тема управляется через `useSettingsStore` и `next-themes`. Для изменения темы:

```typescript
import { useSettingsStore } from "@/stores/useSettingsStore"

// Получить текущую тему
const { theme } = useSettingsStore()

// Изменить тему
const { setTheme } = useSettingsStore()
setTheme('dark') // или 'light', 'system'
```

## Получение состояния аутентификации

Состояние аутентификации доступно через `useUserStore`:

```typescript
import { useUserStore } from "@/stores/useUserStore"

// Проверка аутентификации
const { isAuthenticated, id, email, name, profile } = useUserStore()

// Текущая роль и разрешения
const { role, permissions } = useUserStore()
```

На серверной стороне используйте middleware для проверки сессии и перенаправления неаутентифицированных пользователей.

## Информация для разработки новых модулей

При разработке любого нового функционального модуля (например, "Задачи", "Проекты", "Отчеты" и т.д.), учитывайте следующие моменты:

### 1. Модель данных модуля (TypeScript Interface)

Перед началом разработки определите и согласуйте основной TypeScript интерфейс для сущности вашего модуля.

*Пример для модуля "Задачи":*
```typescript
interface Task {
  id: string; // UUID, Primary Key
  title: string; // Название задачи, обязательное
  description?: string | null; // Описание задачи, необязательное
  status: 'todo' | 'in_progress' | 'done' | 'canceled'; // Статус задачи, обязательное
  priority: 'low' | 'medium' | 'high'; // Приоритет, обязательное
  dueDate?: string | null; // Дата выполнения (ISO 8601), необязательное
  assigneeId?: string | null; // UUID пользователя-исполнителя (ссылка на users.id), необязательное
  projectId?: string | null; // UUID проекта (ссылка на projects.id), необязательное
  createdAt: string; // Дата создания (ISO 8601), управляется БД
  updatedAt: string; // Дата обновления (ISO 8601), управляется БД
  creatorId: string; // UUID пользователя-создателя (ссылка на users.id), обязательное
}
```
**Убедитесь, что интерфейс предоставлен или уточнен для конкретного разрабатываемого модуля.**

### 2. Схема базы данных Supabase

Структура таблиц базы данных, включая колонки, типы данных, ограничения, связи и политики Row Level Security (RLS), описана в отдельном файле: [`docs/database-schema.md`](docs/database-schema.md).

**Перед началом работы с базой данных обязательно изучите этот файл**, чтобы понять существующую структуру и определить, как ваш новый модуль будет интегрироваться (нужны ли новые таблицы, связи, политики RLS).

### 3. Система разрешений (Permissions)

В приложении используется гибкая система разрешений (permissions) для контроля доступа к данным и функционалу. все права пользователя определяются только массивом `permissions` в объекте пользователя.

#### Пример структуры пользователя с permissions

```json
{
  "id": "9fbe5adc-1a18-43ed-aa8b-66d101a6afa8",
  "email": "khutsishvili.gamedev@gmail.com",
  "name": "Дмитрий Хуцишвили",
  "profile": { /* ... */ },
  "isAuthenticated": true,
  "permissions": [
    "user.edit",
    "user.edit.self",
    "user.edit.department",
    "user.edit.team",
    "user.create",
    "user.delete",
    "user.deactivate",
    "structure.edit",
    "analytics.view",
    "analytics.export",
    "role.assign",
    "department.edit",
    "team.edit",
    "position.edit",
    "category.edit",
    "payments.view",
    "payments.edit"
  ]
}
```

#### Принципы работы с permissions

- **Каждое разрешение** — это строка в формате `module.action[.scope]`, например: `user.edit`, `user.edit.self`, `analytics.view`, `payments.edit`.
- **Права доступа** к любому действию или разделу определяются только наличием соответствующего permission у пользователя.
- **Проверка прав** в коде осуществляется через массив `permissions`:

  ```typescript
  import { useUserStore } from "@/stores/useUserStore"
  const { permissions } = useUserStore()

  // Проверка права на редактирование пользователя
  const canEditUser = permissions.includes("user.edit")
  ```

- **UI и бизнес-логика** должны опираться только на permissions, а не на роли.
- **Список permissions** может быть расширен для новых модулей и действий. Для новых сущностей рекомендуется использовать единый стиль: `<module>.<action>[.<scope>]`.
- **Примеры permissions**:
  - `user.create`, `user.edit`, `user.delete`, `user.edit.self`, `user.edit.department`
  - `structure.edit`, `analytics.view`, `analytics.export`
  - `payments.view`, `payments.edit`
  - `project.create`, `project.edit`, `project.delete`, `project.view`
  - `task.create`, `task.edit`, `task.delete`, `task.view`

#### Рекомендации по проектированию permissions

- Для каждого нового модуля заранее определяйте список необходимых permissions.
- В UI скрывайте или блокируйте действия, если у пользователя нет нужного permission.
- Валидация на сервере и в Supabase (через RLS) также должна опираться на permissions.
- Для сложных сценариев используйте scopes: например, `user.edit.self` (разрешено редактировать только себя), `user.edit.department` (разрешено редактировать пользователей своего департамента).

**Важно:**
- Все проверки доступа должны строиться только на permissions.
- Роли могут быть реализованы как наборы permissions, но в приложении и UI используются только permissions.

### 4. Специфичные UI/UX паттерны

Для обеспечения визуальной и функциональной консистентности приложения, придерживайтесь следующих паттернов и используйте существующие компоненты:

- **Списки/Таблицы:** Используйте `components/ui/table`.
- **Формы:** Используйте `react-hook-form`, `zod`, `components/ui/form`, `input`, `select`, `textarea`, etc.
- **Индикаторы (Статусы, Типы, Приоритеты):** Используйте `components/ui/badge` с согласованными цветами.
- **Модальные окна/Боковые панели:** Используйте `components/ui/dialog` или `components/ui/sheet`.
- **Уведомления/Обратная связь:** Используйте `components/ui/toaster` (`sonner`).

Если для вашего модуля требуются уникальные UI-элементы, обсудите их дизайн и необходимость создания новых компонентов.

## Список ключевых файлов для разработки новых модулей

При разработке нового функционала рекомендуется предоставить нейросети следующие ключевые файлы:

### Конфигурация приложения
- `package.json` - зависимости и скрипты
- `tailwind.config.ts` - настройки Tailwind CSS
- `tsconfig.json` - конфигурация TypeScript
- `next.config.mjs` - конфигурация Next.js

### Хранилища состояния
- `stores/index.ts` - экспорты хранилищ
- `stores/useUserStore.ts` - хранилище данных пользователя
- `stores/useSettingsStore.ts` - хранилище настроек
- `stores/useUiStore.ts` - хранилище состояния UI

### Стили и темы
- `styles/globals.css` - глобальные стили и переменные темы
- `components/theme-provider.tsx` - провайдер темы
- `components/theme-toggle.tsx` - переключатель темы

### Компоненты UI
- `components/ui/button.tsx` - кнопки
- `components/ui/form.tsx` - формы
- `components/ui/input.tsx` - поля ввода
- `components/ui/select.tsx` - селекты
- `components/ui/dialog.tsx` - диалоговые окна
- `components/ui/toast.tsx` и `components/ui/toaster.tsx` - уведомления

### Аутентификация
- `utils/supabase/client.ts` - клиент Supabase для браузера
- `utils/supabase/server.ts` - клиент Supabase для сервера
- `utils/supabase/middleware.ts` - middleware для сессий
- `app/auth/login/page.tsx` - пример страницы входа

### Разметка страниц
- `app/layout.tsx` - основной лейаут
- `app/dashboard/layout.tsx` - лейаут дашборда

### Утилиты
- `lib/utils.ts` - утилиты для работы с классами

## Разработка и интеграция модулей

### Что такое модуль

Модуль — это независимый функциональный блок (например, календарь, задачи, аналитика), который разрабатывается и тестируется отдельно, а затем интегрируется в основной проект.

### Структура папки модуля

```
modules/
└── example/
    ├── ExamplePage.tsx
    ├── ExampleMenu.tsx
    └── (опционально) store.ts
```

### Как добавить новый модуль

1. Создайте папку в `modules/` (например, `modules/calendar`).
2. Реализуйте страницу (например, `CalendarPage.tsx`) и меню (`CalendarMenu.tsx`).
3. Импортируйте компонент меню модуля в Sidebar.
4. Импортируйте страницу модуля в роутинг (например, в `app/dashboard` или `app/`).
5. (Опционально) Если модулю нужно глобальное состояние — добавьте zustand-хранилище в `store.ts` внутри модуля.
6. Проверьте, что модуль не нарушает архитектурные правила (см. `rules.md`).

### Интеграция модуля

- Меню модуля добавляется вручную в Sidebar.
- Страница модуля добавляется вручную в роутинг (например, в `app/dashboard` или `app/`).
- Если модулю нужно глобальное состояние — zustand-хранилище импортируется в `stores/index.ts`.

### Пример кода для модуля

```tsx
// modules/calendar/CalendarMenu.tsx
export function CalendarMenu() {
  return <MenuItem to="/dashboard/calendar">Календарь</MenuItem>
}

// modules/calendar/CalendarPage.tsx
export default function CalendarPage() {
  return <div>Здесь будет календарь компании</div>
}
```

### Рекомендации

- Соблюдайте структуру и стандарты именования.
- Документируйте особенности модуля, если они есть.
- Не дублируйте код — выносите общие части в core.

## Руководство по безопасным модификациям

1. При добавлении нового функционала следуйте структуре проекта:
   - UI компоненты размещайте в `components/`
   - Новые страницы в `app/` соответствующего раздела
   - Бизнес-логику в `modules/`

2. При работе с состоянием:
   - Используйте существующие хранилища или создавайте новые в `stores/`