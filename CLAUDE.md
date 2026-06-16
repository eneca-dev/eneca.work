# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## 🚨 ОБЯЗАТЕЛЬНО: Kanban-пайплайн для задач

**Перед работой с задачами ВСЕГДА читай `.devtool/features/AI-RULES.md`** — там описаны правила работы с Kanban-доской: формат ID задач, статусы, команда и инициалы, шаблоны тикетов, правила для review.

Ключевые моменты из AI-RULES.md:
- Задачи хранятся как отдельные `.md` файлы в `.devtool/features/`
- Формат ID: `[тип]-[инициалы]-[номер]` (например, `feature-EZ-01.md`)
- Статусы: `backlog`, `todo`, `review`, `done` (нет `in-progress`)
- Версия из текущей Git-ветки обязательно попадает в `labels`
- Любое действие с кодом — только в рамках зафиксированной задачи

---

## 🚨 ОБЯЗАТЕЛЬНО: Работа по списку задач

**Claude работает ТОЛЬКО по задачам из `module.meta.json` файлов, если пользователь явно не просит иного.**

### Правила работы с задачами:

1. **Перед началом работы:**
   - Убедись что задача существует в `modules/[module]/module.meta.json`
   - Если задачи нет — сначала создай её в meta-файле
   - Измени статус задачи на `in-progress`

2. **После выполнения задачи:**
   - Измени статус на `done`
   - Добавь запись в `changelog` модуля (в module.meta.json)
   - Перенеси задачу в `tasks.archive.json` модуля

3. **Формат архивной записи:**
   ```json
   {
     "id": "RG-001",
     "title": "Название задачи",
     "category": "bug",
     "priority": "high",
     "status": "done",
     "createdAt": "2025-01-05",
     "completedAt": "2025-01-06",
     "changelogEntry": "Исправлен рендеринг вертикальных связей чекпоинтов",
     "relatedFiles": ["components/timeline/CheckpointLinks.tsx"]
   }
   ```

4. **Страница задач:** `/dashboard/dev/tasks` — выбери задачи и сгенерируй промпт

### Исключения:
- Мелкие фиксы по запросу пользователя (опечатки, стили)
- Срочные hotfix по явной просьбе
- Исследовательские задачи и вопросы

---

## 🚨 ОБЯЗАТЕЛЬНО: Пайплайн разработки

**При любой задаче по разработке функционала СТРОГО следуй пайплайну из `docs/main-pipeline.md`.**

### Выбор пайплайна:

| Масштаб | Триггер | Пайплайн |
|---------|---------|----------|
| **Мелкий** | Фикс бага, 1-2 файла, < 50 строк | Quick Pipeline |
| **Средний** | Новый компонент/хук, 3-5 файлов | Quick Pipeline |
| **Крупный** | Новый модуль, > 5 файлов, новые таблицы БД | Full Pipeline |

### Как это работает:

1. **Всегда объявляй текущий шаг** в начале ответа
2. **Запрашивай необходимые данные** от разработчика перед переходом к следующему шагу
3. **Не переходи к следующему шагу** без явного подтверждения разработчика
4. **Вызывай агентов** после написания кода для проверки

---

## Quick Pipeline (мелкие/средние задачи)

### Триггеры Quick Pipeline:
- Фикс бага (1-3 файла)
- Новый компонент в существующий модуль
- Новый хук/action в существующей структуре
- Рефакторинг без изменения архитектуры
- UI изменения (стили, layout)

### Шаблоны Quick Pipeline:

**Q1. Анализ:**
```
📍 QUICK PIPELINE: Анализ задачи

**Задача:** [краткое описание]
**Масштаб:** Мелкий / Средний
**Затрагиваемые файлы:** ~N файлов

Начинаю реализацию.
```

**Q2. Реализация + Агенты:**
```
📍 QUICK PIPELINE: Реализация

[Код...]

🤖 Агенты (выбираются автоматически по типу изменений):
- Server Action → Cache Guardian, Security Guardian
- Компонент > 50 строк → Clean Code Guardian, Next.js Guardian
- Форма → Forms Guardian
- Store → Zustand Guardian
- Миграция → DB Architect
- Модалка → Modal Architect

Пример:
- Cache Guardian: ✅ / ⚠️ [исправлено]
- Clean Code Guardian: ✅ / ⚠️ [исправлено]

Запусти `npm run build` для проверки.
```

**Q3. Готово:**
```
📍 QUICK PIPELINE: Готово

Изменения готовы. Сделай коммит:
`git add . && git commit -m "тип(модуль): описание"`
```

---

## Full Pipeline (крупные фичи)

### Триггеры Full Pipeline:
- Новый модуль
- Более 5 файлов изменений
- Новые таблицы/миграции БД
- Слова: "разработать", "реализовать", "добавить функционал", "новая фича"

### Шаблон ответа при активации:

```
📍 ПАЙПЛАЙН: Фаза 0 — Подготовка

Вижу задачу на разработку. Активирую Full Pipeline.

**Мне нужно от тебя:**
1. Создана ли ветка для этой фичи? (если нет — создай: `git checkout -b feature/название`)
2. Опиши глобальную цель в 2-3 предложениях
3. Какие критерии готовности (Definition of Done)?

Жду ответа для перехода к Фазе 1.
```

### Шаблоны для каждой фазы:

**Фаза 1 — Декомпозиция + 🤖 Pragmatic Architect:**
```
📍 ПАЙПЛАЙН: Фаза 1 — Декомпозиция задачи

[Разбиваю задачу на этапы...]

**Согласуй план перед продолжением:**
- Этап 1: ...
- Этап 2: ...

🤖 Pragmatic Architect (ОБЯЗАТЕЛЬНО на этой фазе):
- Необходимость: ✅ — Эта фича действительно нужна?
- Простота: ✅ / ⚠️ — Нет ли over-engineering?
- Существующие решения: ✅ / ⚠️ — Можно переиспользовать что-то?

🤖 DB Architect (если планируются изменения БД):
- Схема: ✅ / ⚠️ — Нормализация, типы данных
- Индексы: ✅ / ⚠️ — Нужны ли дополнительные?

Подтверди план или внеси корректировки.
```

**Фаза 2.1 — Планирование этапа:**
```
📍 ПАЙПЛАЙН: Фаза 2.1 — Планирование этапа N

**План реализации:**
- Архитектура: ...
- Файлы: ...
- Риски: ...

🤖 Pragmatic Architect: ✅ Approved / ⚠️ Needs Simplification

Подтверди план этапа для начала реализации.
```

**Фаза 2.3 — Реализация + Агенты:**
```
📍 ПАЙПЛАЙН: Фаза 2.3 — Реализация этапа N

[Код...]

🤖 Обязательные агенты после реализации:

| Что написано | Агенты для вызова |
|--------------|-------------------|
| Server Action | Cache Guardian, Security Guardian, TypeScript Guardian |
| Компонент > 50 строк | Clean Code Guardian, Next.js Guardian |
| Форма | Forms Guardian |
| Store | Zustand Guardian |
| Миграция | DB Architect |
| Модалка | Modal Architect |
| Realtime подписка | Realtime Guardian |

Пример отчёта:
- Cache Guardian: ✅ ActionResult, правильные ключи
- Security Guardian: ✅ Auth check присутствует
- TypeScript Guardian: ⚠️ Исправлено: убран any в строке 42

Запусти `npm run build` и проверь.
```

**Фаза 2.4 — Тестирование:**
```
📍 ПАЙПЛАЙН: Фаза 2.4 — Ручное тестирование

**Чек-лист для проверки:**
- [ ] Сценарий 1
- [ ] Сценарий 2

Пройди чек-лист и сообщи результаты.
```

**Фаза 2.5 — Code Review:**
```
📍 ПАЙПЛАЙН: Фаза 2.5 — Code Review

**Результаты проверки:**
1. Архитектура: ✅/⚠️
2. Дублирование: ✅/⚠️
3. Безопасность: ✅/⚠️
4. Ошибки: ✅/⚠️
5. TypeScript: ✅/⚠️

[Замечания если есть]

Подтверди исправления или переходим к коммиту.
```

**Фаза 2.7 — Коммит:**
```
📍 ПАЙПЛАЙН: Фаза 2.7 — Коммит

Этап N завершён. Сделай коммит:
`git add . && git commit -m "feat(module): описание"`

После коммита переходим к этапу N+1.
```

**Фаза 3 — Финальная проверка:**
```
📍 ПАЙПЛАЙН: Фаза 3 — Финальная проверка

🤖 Финальный аудит (обязательные):
- Security Guardian: ✅ — Безопасность всей фичи
- Cache Guardian: ✅ — Правильность data flow
- Performance Guardian: ✅ — N+1, memo, bundle size
- TypeScript Guardian: ✅ — Строгая типизация

🤖 По необходимости:
- Sentry Guardian: ✅ — Если нужен мониторинг
- Dead Code Hunter: ✅ — Очистка от мусора

**Финальный чек-лист:**
- [ ] npm run build проходит без ошибок
- [ ] Все агенты дали ✅
- [ ] README модуля обновлён

Фича готова к PR.
```

---

## 🤖 Агенты (.claude/agents/)

### Полный список агентов

| Категория | Агент | Задача | Триггеры |
|-----------|-------|--------|----------|
| **Безопасность** | Security Guardian | Auth, XSS, SQL injection, RLS, env | Pre-deploy, Server Actions, auth фичи |
| **Типизация** | TypeScript Guardian | `any`, generics, type guards, strict | Новый модуль, после db:types, рефакторинг |
| **Архитектура** | Pragmatic Architect | Over-engineering, YAGNI, complexity | Фаза 1, Фаза 2.1, планирование фичи |
| **Архитектура** | Clean Code Guardian | Структура, naming, DRY, размер | Компоненты > 50 строк, новый модуль |
| **Архитектура** | Next.js Guardian | Server/Client, metadata, routing | Новая страница, компонент архитектура |
| **Данные** | Cache Guardian | TanStack Query, Server Actions, keys | Новые actions/hooks, "данные не обновляются" |
| **Данные** | DB Architect | PostgreSQL schema, migrations, views, indexes | Новые таблицы, миграции, performance |
| **Данные** | Realtime Guardian | Subscriptions, cleanup, memory leaks | Новые подписки, memory issues |
| **State** | Zustand Guardian | Store patterns, selectors, scope | Новый store, re-render issues |
| **State** | Forms Guardian | React Hook Form + Zod validation | Новая форма, form bugs |
| **Performance** | Performance Guardian | N+1, memo, useMemo, bundle size | Большие списки, "page is slow", pre-deploy |
| **Performance** | Dead Code Hunter | Unused exports, orphan files, logs | Sprint cleanup, перед рефакторингом |
| **UI/UX** | Modal Architect | Modal design, Resource Graph style | Новая модалка, дизайн модалок |
| **UI/UX** | UI/UX Advisor | Auto-save, skeletons, interaction | UI планирование, UX улучшения |
| **Мониторинг** | Sentry Guardian | Spans, error capture, tracing | "Add logging", Фаза 3, debugging |

### Автоматические триггеры для агентов

| Событие | Агенты для вызова |
|---------|-------------------|
| Новый Server Action | Cache Guardian, Security Guardian, TypeScript Guardian |
| Новый компонент > 50 строк | Clean Code Guardian, Next.js Guardian |
| Новая форма | Forms Guardian |
| Новый store | Zustand Guardian |
| Новая миграция | DB Architect |
| Новая модалка | Modal Architect |
| Pre-deploy | Security Guardian, Performance Guardian |
| Memory issues | Realtime Guardian, Performance Guardian |

### Приоритеты при конфликтах

```
Security Guardian > Cache Guardian > Performance Guardian > Clean Code Guardian
```
Если агенты дают противоречивые рекомендации, следуй приоритету выше.

### Важно:

- **НЕ пропускай шаги** — даже если кажется очевидным
- **НЕ начинай код** без согласованного плана
- **НЕ переходи дальше** без подтверждения разработчика
- **ВСЕГДА вызывай агентов** после написания кода
- **ВСЕГДА показывай** на каком шаге находишься

---

## Module Audit Pipeline (полная проверка модуля)

### Триггеры:
- Команда "Проведи полный аудит модуля"
- Pre-PR review
- После крупного рефакторинга
- Подозрение на проблемы в модуле

### Порядок вызова агентов:

```
┌─────────────────────────────────────────────────────────┐
│              MODULE AUDIT PIPELINE                       │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  1. 🔒 Security Guardian     ← Критично, первым делом   │
│     Auth, XSS, SQL injection, RLS, env exposure         │
│                                                          │
│  2. 📊 Cache Guardian        ← Архитектура данных       │
│     Server Actions, hooks, query keys                    │
│                                                          │
│  3. 📘 TypeScript Guardian   ← Типизация                │
│     any, generics, type guards                           │
│                                                          │
│  4. ⚡ Performance Guardian  ← N+1, memo, bundle        │
│     Оптимизация производительности                       │
│                                                          │
│  5. 🔷 Next.js Guardian      ← App Router patterns      │
│     Server/Client, metadata                              │
│                                                          │
│  6. 🧹 Clean Code Guardian   ← Структура, naming        │
│     DRY, размер компонентов                              │
│                                                          │
│  7. 🐻 Zustand Guardian      ← Если есть stores         │
│     State patterns, selectors                            │
│                                                          │
│  8. 📝 Forms Guardian        ← Если есть формы          │
│     RHF + Zod validation                                 │
│                                                          │
│  9. 📡 Realtime Guardian     ← Если есть подписки       │
│     Subscriptions, cleanup                               │
│                                                          │
│  10. 🗑️ Dead Code Hunter     ← Финальная очистка        │
│      Unused exports, orphan files                        │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Шаблон ответа:

**Начало аудита:**
```
📍 MODULE AUDIT: Начало проверки модуля

**Модуль:** modules/[name]/
**Файлов:** ~N
**Содержит:** actions / hooks / stores / forms / realtime

Начинаю полную проверку...
```

**Отчёт по каждому агенту:**
```
🤖 [Название агента]: ✅ Passed / ⚠️ N issues

[Если issues:]
1. `file.ts:42` — описание проблемы
2. `file.ts:88` — описание проблемы

[Рекомендации по исправлению]
```

**Финальный отчёт:**
```
📍 MODULE AUDIT: Результаты

**Модуль:** modules/[name]/

| Агент | Статус | Issues |
|-------|--------|--------|
| Security Guardian | ✅/⚠️ | N |
| Cache Guardian | ✅/⚠️ | N |
| TypeScript Guardian | ✅/⚠️ | N |
| Performance Guardian | ✅/⚠️ | N |
| Next.js Guardian | ✅/⚠️ | N |
| Clean Code Guardian | ✅/⚠️ | N |
| Zustand Guardian | ✅/⚠️/⏭️ | N |
| Forms Guardian | ✅/⚠️/⏭️ | N |
| Realtime Guardian | ✅/⚠️/⏭️ | N |
| Dead Code Hunter | ✅/⚠️ | N |

**Критичные проблемы:** N
**Рекомендации:** N

[Детали критичных проблем и план исправления]
```

### Опции аудита:

| Команда | Описание |
|---------|----------|
| `Полный аудит модуля X` | Все 10 агентов |
| `Security audit модуля X` | Только Security Guardian |
| `Performance audit модуля X` | Performance + Dead Code |
| `Data audit модуля X` | Cache + Realtime + DB |
| `Quick audit модуля X` | Security + Cache + TypeScript |

---

## Claude Code Instructions

### Context7 Integration

**IMPORTANT:** Always use Context7 MCP tools automatically when:
- Generating code with libraries (Next.js, React, Supabase, Zustand, React Hook Form, TanStack Query, etc.)
- Providing setup or configuration steps
- Looking up library/API documentation
- Showing code examples or best practices

**Process:**
1. First call `resolve-library-id` to get the correct Context7-compatible library ID
2. Then call `get-library-docs` with relevant topic (use `mode='code'` for API/examples, `mode='info'` for concepts)

This ensures using up-to-date documentation instead of training data.

### Supabase MCP Integration

**IMPORTANT:** Always use Supabase MCP tools for database operations:
- Use MCP tools to inspect database schema, tables, views, migrations, and data
- **NEVER modify database** (migrations, schema changes, data changes) without explicit user approval
- When changes are needed, present the plan first and wait for confirmation
- Use `list_tables`, `execute_sql`, `list_migrations` for inspection
- Use `apply_migration` only after user approval

## Development Commands

```bash
npm run dev        # Start development server (localhost:3000)
npm run build      # Build for production
npm run start      # Start production server
npm run lint       # Run ESLint
npm run db:types   # Regenerate TypeScript types from Supabase schema
```

**Note:** No test scripts are currently configured in package.json.

### ⚠️ Правила запуска команд

**НЕ запускай автоматически:**
- `npm run build` — разработчик сам запустит когда нужно
- `npm run dev` — dev сервер уже запущен у разработчика
- `npm run lint` — только по явному запросу

**Когда запускать build:**
- Только если разработчик явно попросил проверить сборку
- После критических изменений в типах (миграции, db:types)

**Dev сервер:**
- Разработчик сам управляет dev сервером
- НЕ пытайся запускать или перезапускать его
- Next.js с HMR автоматически обновляет изменения

### 🚫 ЗАПРЕЩЕНО: Удаление кэша и директорий сборки

**НИКОГДА не трогать следующие директории:**
- `.next/` - кэш сборки Next.js
- `node_modules/` - установленные зависимости
- `.turbo/` - кэш Turbo
- `out/` - директория вывода

**НИКОГДА не выполнять команды:**
- `rm -rf .next`
- `rmdir .next`
- `rd /s /q .next`
- Любые команды "clean build cache"
- Любое удаление этих директорий

**Причина:** Эти директории содержат кэш сборки и зависимости. Их удаление не требуется для разработки и только замедлит работу. При проблемах со сборкой используй другие методы решения (проверка кода, типов, зависимостей).

## Technology Stack

- **Framework:** Next.js 15.2.4 (App Router architecture)
- **Frontend:** React 19, TypeScript 5, Tailwind CSS 3.4
- **UI Components:** Radix UI primitives + Shadcn/ui component library
- **Backend:** Supabase (PostgreSQL database, authentication, realtime subscriptions, edge functions)
- **State Management:** Zustand (NOT Redux - despite what some old docs may say)
- **Forms:** React Hook Form + Zod validation
- **Rich Text:** TipTap editor
- **Monitoring:** Sentry for error tracking and performance monitoring
- **AI Integration:** Python AI agent for chat

## Architecture Overview

### Module-Based Architecture

The application follows a strict **module-first architecture**. Each major feature is a self-contained module in `/modules/`:

```
modules/
├── cache/                # Centralized caching with TanStack Query + Server Actions
├── planning/              # Resource planning & timeline (Gantt chart)
├── permissions/          # Dynamic permission system
├── notifications/        # Real-time notification system
├── chat/                 # AI chatbot integration
├── calendar/            # Event calendar
├── projects/            # Project management
├── dashboard/           # Dashboard cards and metrics
├── [25+ other modules]
```

**Module Structure Pattern:**
Each module typically contains:
- `components/` - React components
- `hooks/` - Custom React hooks
- `api/` - API client functions
- `types/` - TypeScript interfaces
- `stores/` - Zustand stores (if needed)
- `index.ts` - Public API exports

### Database-First Approach

The application heavily relies on PostgreSQL views for data aggregation and business logic:

- **Key Views:** `view_section_hierarchy`, `view_sections_with_loadings`, `view_users`, `view_employee_workload`
- **Access Pattern:**
  - Client-side: `createClient()` from `@/utils/supabase/client`
  - Server-side: Use SSR utilities from `@/utils/supabase/*`
  - Centralized queries in `lib/supabase-client.ts`
- **Schema Documentation:** See `supabase-db.sql` and `supabase-views.md`

**Data Hierarchy Structure:**

The planning module follows this hierarchical structure:
```
Проект (Project) ← stage_id — параметр проекта, НЕ отдельная таблица в иерархии
  └─ Объект (Object)
      └─ Раздел (Section)
          └─ Этап декомпозиции (Decomposition Stage)
              └─ Декомпозиция (Decomposition - not used in modals)
```

- **Stage (Стадия)** — это **параметр проекта** (`projects.stage_id`), а не уровень иерархии
- **Loadings** (загрузки) are assigned at the **Decomposition Stage** level
- Each loading connects: Employee + Decomposition Stage + Date Range + Rate
- The decomposition layer exists in the data model but is not exposed in UI modals

> **🚫 ЗАПРЕЩЕНО:** Создавать новые фичи, где Stage (Стадия) используется как отдельный уровень иерархии или отдельная таблица. Stage — это всегда атрибут проекта (`projects.stage_id`), фильтр или группировка, но НЕ родительская сущность для Object/Section.

### Database Types (`types/db.ts`)

TypeScript types are auto-generated from Supabase schema and used throughout the application.

**Regenerating types after schema changes:**
```bash
npm run db:types
```

**IMPORTANT:** Always run `npm run db:types` after:
- Creating or modifying migrations
- Adding new tables or views
- Changing column types or adding columns
- Creating new enums

**Using types in code:**
```typescript
import type { Database } from '@/types/db'

// Or use helper types from cache module:
import { TableRow, ViewRow, DbEnum } from '@/modules/cache'

type Project = TableRow<'projects'>           // Table row type
type CacheProject = ViewRow<'v_cache_projects'>  // View row type
type Status = DbEnum<'project_status_enum'>   // Enum type
```

### Permission System

Dynamic, database-driven permission system:

```
profiles.role_id → roles.id → role_permissions → permissions.name
```

**Usage:**
```typescript
// Component guard
<PermissionGuard permission="users.admin_panel">
  <AdminPanel />
</PermissionGuard>

// Programmatic check
const canEdit = useHasPermission('users.edit.all')
```

- Permissions loaded at runtime from database
- No hardcoded permission checks
- Uses `usePermissionsLoader()` hook
- Integrated with Sentry for access tracing

## State Management

**Zustand Stores** (NOT Redux):

```typescript
// Core stores in /stores/
useUserStore           // Authentication and user profile
useNotificationsStore  // Real-time notifications
useCalendarStore       // Calendar state
useUiStore            // UI state (sidebar, theme, filters)
useSettingsStore      // Application settings

// Module-specific stores in modules/*/stores/
usePlanningStore      // Planning module state
// ... 20+ other module stores
```

**Server State:**
- TanStack Query (`@tanstack/react-query`) for server state caching
- **Cache Module** (`modules/cache/`) - centralized caching system (see `modules/cache/README.md`)
- Supabase Realtime for live updates with automatic cache invalidation
- Custom hooks wrap query logic

**Form State:**
- React Hook Form for all forms
- Zod schemas for validation
- Type-safe with TypeScript

## Key Patterns

### 1. Real-Time Updates

```typescript
// Subscribe to database changes
supabase
  .channel('notifications')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'notifications'
  }, handler)
  .subscribe()
```

### 2. API Routes (App Router)

```
app/api/
├── auth/              # Authentication endpoints
├── chat/python/       # Python AI agent proxy
├── users/             # User operations
├── admin/             # Admin operations
└── [other endpoints]
```

- Rate limiting implemented on sensitive routes
- JWT authentication for API calls
- Middleware in `middleware.ts` handles session management

### 3. Component Architecture

- **Base Components:** All UI components in `/components/ui/` (Shadcn pattern)
- **Shared Components:** `/components/` for cross-module components
- **Module Components:** Module-specific in `modules/*/components/`
- **Pattern:** Extensive use of `forwardRef` and composition

### 4. Chat System

- Chat button integrated in dashboard layout
- Proxies requests to Python AI agent (https://ai-bot.eneca.work)
- Stores chat history in localStorage (max 10 messages per user)
- Simple request/response flow with typing indicator
- Supports markdown rendering in messages

### 5. Error Handling

- Sentry integration throughout application
- Custom error boundaries per module
- `PermissionsErrorBoundary` for permission errors
- Structured error responses from API routes

### 6. Cache Module (`modules/cache/`)

**IMPORTANT:** Read `modules/cache/README.md` before implementing data fetching in new modules.

The cache module provides:
- **Server Actions** - Type-safe data fetching from Supabase
- **Hook Factories** - Create typed query/mutation hooks with one line
- **Optimistic Updates** - Instant UI feedback
- **Realtime Sync** - Automatic cache invalidation on DB changes

**Quick example:**
```typescript
import { createCacheQuery, createUpdateMutation, queryKeys } from '@/modules/cache'

// Create a query hook
export const useProjects = createCacheQuery({
  queryKey: () => queryKeys.projects.lists(),
  queryFn: getProjects,
})

// Create a mutation hook with optimistic updates
export const useUpdateProject = createUpdateMutation({
  mutationFn: updateProject,
  listQueryKey: queryKeys.projects.lists(),
  getId: (input) => input.project_id,
  getItemId: (item) => item.project_id,
  merge: (item, input) => ({ ...item, ...input }),
})
```

When migrating modules to use cache:
1. Create Server Actions in `modules/[module]/actions/`
2. Add query keys to `modules/cache/keys/query-keys.ts`
3. Create hooks using factories from cache module
4. Add Realtime subscription if needed (see `modules/cache/realtime/config.ts`)

## Important Conventions

### Naming Conventions
- **Database:** `snake_case` (e.g., `user_id`, `created_at`)
- **TypeScript:** `camelCase` (e.g., `userId`, `createdAt`)
- **Components:** `PascalCase` (e.g., `UserProfile`)
- **Files:** `kebab-case` for components, `camelCase` for utilities

### Language
- **All UI text in Russian** (монолingual application)
- No i18n library used
- Date formatting with `date-fns`

### Currency
- **Single currency: BYN** (Belarusian ruble)
- Format: `1.2M BYN`, `123K BYN`, `999 BYN`
- Never use ₽ (Russian ruble) or other currency symbols

### Timezone & Dates
- **Часовой пояс: Europe/Minsk (UTC+3)**
- Утилиты: `lib/timezone-utils.ts`
- Для `timestamp with time zone` из БД: `formatMinskDate(new Date(isoString))`
- Для строки "YYYY-MM-DD": `parseMinskDate(dateString)`
- Для добавления дней: `addDays()` из date-fns (НЕ `setDate()`)
- Модуль `calendar`: использует локальный timezone (date-fns создаёт даты локально)

### Theme System
- Next-themes for dark/light mode
- Custom primary color: `#1e7260` (teal/green)
- CSS variables in `globals.css`
- `ThemeProvider` + `ThemeSync` pattern

## Critical Information

1. **State Management:** Application uses **Zustand**, NOT Redux (some old docs incorrectly mention Redux)

2. **Module Boundaries:** Modules should remain self-contained with clear public APIs through `index.ts`

3. **Permission Checks:** Always use database-driven permission checks, never hardcode permissions

4. **Database Access:** Prefer using existing views over direct table queries to avoid N+1 problems

5. **Type Safety:** Extensive TypeScript usage - maintain type safety across database types (`types/db.ts`). **Run `npm run db:types` after any schema changes.**

6. **Realtime:** Many features require Supabase Realtime subscriptions - remember to unsubscribe in cleanup

7. **Sentry:** Integrate Sentry tracing for new features (see `.cursorrules/rules.md` for examples)

8. **App Router:** Uses Next.js 15 App Router (NOT Pages Router) - server components by default

9. **Cache Module:** For new data fetching, use the cache module (`modules/cache/`). Read `modules/cache/README.md` first.

## Module Documentation

For detailed module-specific documentation, refer to individual module READMEs:
- **`modules/cache/README.md`** - **Caching system (READ FIRST for new data fetching)**
- `modules/permissions/README.md` - Permission system details
- `modules/chat/README.md` - Chat system architecture
- `modules/notifications/README.md` - Notification system
- `modules/planning/README.md` - Planning module (resource allocation, Gantt chart)
- `modules/budgets/README.md` - Budget system (parent hierarchy, versioning)

### 📝 Обязательное обновление README

**ВАЖНО:** При внесении изменений в модуль **ВСЕГДА** обновляй соответствующий `README.md`:

- Добавление новых хуков/actions → документируй API и примеры использования
- Изменение схемы БД → обнови раздел "Схема данных"
- Новая функциональность → добавь в "Ключевые концепции"
- Изменение permissions → обнови таблицу RLS/Permissions

Это обеспечивает актуальность документации для всей команды.

## Additional Resources

- `docs/roles-and-permissions.md` - Detailed permission system documentation
- `docs/modules.md` - Module architecture overview
- `supabase-db.sql` - Complete database schema
- `supabase-views.md` - Database views documentation
- `chat-system-prompts.md` - Chat AI prompts and behavior
