# Agents Map

Полная карта агентов для аудита и разработки кода.

---

## Обзор системы агентов

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         AUDIT AGENTS SYSTEM                              │
│                           15 специализированных агентов                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐   │
│  │   БЕЗОПАСНОСТЬ    │  │    ТИПИЗАЦИЯ      │  │   АРХИТЕКТУРА     │   │
│  ├───────────────────┤  ├───────────────────┤  ├───────────────────┤   │
│  │ security-guardian │  │ typescript-guard. │  │ pragmatic-arch.   │   │
│  │                   │  │                   │  │ clean-code-guard. │   │
│  │                   │  │                   │  │ nextjs-guardian   │   │
│  └───────────────────┘  └───────────────────┘  └───────────────────┘   │
│                                                                          │
│  ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐   │
│  │      ДАННЫЕ       │  │      STATE        │  │  ПРОИЗВОДИТЕЛЬН.  │   │
│  ├───────────────────┤  ├───────────────────┤  ├───────────────────┤   │
│  │ cache-guardian    │  │ zustand-guardian  │  │ performance-guard.│   │
│  │ db-architect      │  │ forms-guardian    │  │ dead-code-hunter  │   │
│  │ realtime-guardian │  │                   │  │                   │   │
│  └───────────────────┘  └───────────────────┘  └───────────────────┘   │
│                                                                          │
│  ┌───────────────────┐  ┌───────────────────┐                           │
│  │      UI/UX        │  │    МОНИТОРИНГ     │                           │
│  ├───────────────────┤  ├───────────────────┤                           │
│  │ modal-architect   │  │ sentry-guardian   │                           │
│  │ ui-ux-advisor     │  │                   │                           │
│  └───────────────────┘  └───────────────────┘                           │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Полный список агентов

| # | Агент | Файл | Фокус |
|---|-------|------|-------|
| 1 | **Security Guardian** | `security-guardian.md` | Auth bypass, XSS, SQL injection, RLS, env exposure |
| 2 | **TypeScript Guardian** | `typescript-guardian.md` | `any`, generics, type guards, strict types |
| 3 | **Pragmatic Architect** | `pragmatic-architect.md` | Over-engineering, YAGNI, complexity |
| 4 | **Clean Code Guardian** | `clean-code-guardian.md` | Structure, naming, DRY, component size |
| 5 | **Next.js Guardian** | `nextjs-guardian.md` | Server/Client components, metadata, routing |
| 6 | **Cache Guardian** | `cache-guardian.md` | TanStack Query, Server Actions, cache keys |
| 7 | **DB Architect** | `db-architect.md` | PostgreSQL, migrations, views, indexes |
| 8 | **Realtime Guardian** | `realtime-guardian.md` | Supabase Realtime, subscriptions, cleanup |
| 9 | **Zustand Guardian** | `zustand-guardian.md` | Store patterns, selectors, state scope |
| 10 | **Forms Guardian** | `forms-guardian.md` | React Hook Form, Zod, validation |
| 11 | **Performance Guardian** | `performance-guardian.md` | N+1, memo, useMemo, bundle size |
| 12 | **Dead Code Hunter** | `dead-code-hunter.md` | Unused exports, orphan files, console.log |
| 13 | **Modal Architect** | `modal-architect.md` | Modal design, Resource Graph style |
| 14 | **UI/UX Advisor** | `ui-ux-advisor.md` | Auto-save, skeletons, interaction flow |
| 15 | **Sentry Guardian** | `sentry-guardian.md` | Spans, error capture, tracing |

---

## Детальное описание по категориям

### 🔒 Безопасность

#### security-guardian
**Цель:** Аудит безопасности приложения

**Проверяет:**
- Auth check в Server Actions
- SQL injection в raw queries
- XSS через dangerouslySetInnerHTML
- Env variables в клиентском коде
- RLS policies coverage
- Input validation (Zod)

**Когда вызывать:**
- Pre-deploy review
- Новые auth-related фичи
- Изменения в Server Actions

---

### 📘 Типизация

#### typescript-guardian
**Цель:** Строгая типизация кода

**Проверяет:**
- Использование `any`, `unknown`, `Function`
- Type assertions без валидации
- Missing return types
- Generics без constraints
- Database types integration

**Когда вызывать:**
- Новый модуль
- После `npm run db:types`
- Рефакторинг

---

### 🏗️ Архитектура

#### pragmatic-architect
**Цель:** Предотвращение over-engineering

**Проверяет:**
- Избыточная абстракция
- Premature optimization
- YAGNI violations
- Excessive state management

**Когда вызывать:**
- Планирование фичи
- "Should I use X library?"
- Рефакторинг

#### clean-code-guardian
**Цель:** Структура и качество кода

**Проверяет:**
- Module structure (`modules/[feature]/`)
- File naming (kebab-case)
- Component naming (PascalCase)
- Boolean naming (is*, has*, can*)
- Component size (< 150 lines)
- DRY, early returns

**Когда вызывать:**
- Новый компонент (> 50 lines)
- Новый модуль
- Code review

#### nextjs-guardian
**Цель:** App Router паттерны

**Проверяет:**
- 'use client' placement
- Server vs Client components
- Metadata exports
- Data fetching patterns
- Link vs anchor
- Loading/Error files

**Когда вызывать:**
- Новая страница
- Компонент архитектура
- SEO review

---

### 📊 Данные и кэш

#### cache-guardian
**Цель:** Архитектура кэширования

**Проверяет:**
- Direct useQuery/useMutation (forbidden)
- ActionResult<T> wrapper
- Query keys in `query-keys.ts`
- No data fetching in components
- Realtime config integration

**Когда вызывать:**
- Новые Server Actions
- Новые hooks
- "Данные не обновляются?"

#### db-architect
**Цель:** Дизайн базы данных

**Проверяет:**
- Schema design
- Indexes (especially FK)
- RLS policies
- Migration safety
- Views optimization
- Data types

**Когда вызывать:**
- Новые таблицы
- Migration planning
- Performance issues

#### realtime-guardian
**Цель:** Supabase Realtime подписки

**Проверяет:**
- Subscription cleanup (memory leaks)
- Duplicate subscriptions
- Cache invalidation integration
- Event filtering
- Channel naming

**Когда вызывать:**
- Новые подписки
- Memory leak reports
- Cache sync issues

---

### 🐻 State Management

#### zustand-guardian
**Цель:** Правильное использование Zustand

**Проверяет:**
- State scope (global vs local)
- Server state in store (forbidden)
- Selectors usage
- Persist middleware
- Store structure

**Когда вызывать:**
- Новый store
- Re-render issues
- State architecture

#### forms-guardian
**Цель:** React Hook Form + Zod

**Проверяет:**
- Zod schema presence
- Error display
- Reset on success/close
- Validation mode
- Controller for custom components
- Loading states

**Когда вызывать:**
- Новая форма
- Form bugs
- UX issues

---

### ⚡ Производительность

#### performance-guardian
**Цель:** Runtime оптимизация

**Проверяет:**
- N+1 queries
- Missing useMemo/useCallback
- Inline objects in props
- Missing React.memo
- List virtualization
- Bundle size (dynamic imports)

**Когда вызывать:**
- Large lists (> 50 items)
- "Page is slow"
- Pre-deploy audit

#### dead-code-hunter
**Цель:** Очистка кодовой базы

**Проверяет:**
- Unused exports
- Orphan files
- Commented code blocks
- console.log statements
- TODO without issue links
- Unused dependencies

**Когда вызывать:**
- Sprint cleanup
- Before refactor
- Bundle size concerns

---

### 🎨 UI/UX

#### modal-architect
**Цель:** Дизайн модальных окон

**Проверяет:**
- Resource Graph design language
- Dark/Amber color scheme
- File location (`modules/modals/`)
- RHF + mutation integration
- Reset on close

**Когда вызывать:**
- Новая модалка
- "Fix modal styles"
- Design consistency

#### ui-ux-advisor
**Цель:** UX паттерны

**Проверяет:**
- Auto-save opportunities
- Skeleton states (CLS)
- Click count reduction
- Optimistic updates
- Layout stability

**Когда вызывать:**
- UI planning
- "How should this look?"
- UX improvements

---

### 📡 Мониторинг

#### sentry-guardian
**Цель:** Observability

**Проверяет:**
- Sentry.startSpan in actions
- Error capture patterns
- Tags and attributes
- Module tagging

**Когда вызывать:**
- "Add logging"
- Pipeline Phase 3
- Debugging

---

## Порядок вызова для полного аудита

```
┌─────────────────────────────────────────────────────────┐
│                    AUDIT PIPELINE                        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  1. 🔒 security-guardian      ← Критично, первым делом  │
│                                                          │
│  2. 📊 cache-guardian         ← Архитектура данных      │
│                                                          │
│  3. 📘 typescript-guardian    ← Типизация               │
│                                                          │
│  4. ⚡ performance-guardian   ← N+1, memo               │
│                                                          │
│  5. 🔷 nextjs-guardian        ← App Router patterns     │
│                                                          │
│  6. 🧹 clean-code-guardian    ← Структура, naming       │
│                                                          │
│  7. 🐻 zustand-guardian       ← Если есть stores        │
│                                                          │
│  8. 📝 forms-guardian         ← Если есть формы         │
│                                                          │
│  9. 📡 realtime-guardian      ← Если есть подписки      │
│                                                          │
│  10. 🗑️ dead-code-hunter      ← Финальная очистка       │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## Приоритеты при конфликтах

Если агенты дают противоречивые рекомендации:

```
Security Guardian > Cache Guardian > Performance Guardian > Clean Code Guardian
```

1. **Безопасность** всегда приоритетнее производительности
2. **Архитектура кэша** важнее чистоты кода
3. **Производительность** может потребовать нарушения DRY

---

## Границы ответственности

| Аспект | Ответственный | НЕ ответственный |
|--------|---------------|------------------|
| TypeScript strict | typescript-guardian | clean-code-guardian |
| 'use client' | nextjs-guardian | clean-code-guardian |
| RLS design | db-architect | security-guardian |
| RLS presence check | security-guardian | db-architect |
| N+1 queries | performance-guardian | cache-guardian |
| Query architecture | cache-guardian | performance-guardian |

---

## Quick Reference

### Триггеры для автоматического вызова

| Событие | Агенты |
|---------|--------|
| Новый Server Action | cache-guardian, security-guardian, typescript-guardian |
| Новый компонент > 50 lines | clean-code-guardian, nextjs-guardian |
| Новая форма | forms-guardian |
| Новый store | zustand-guardian |
| Новая миграция | db-architect |
| Pre-deploy | security-guardian, performance-guardian |
| Memory issues | realtime-guardian, performance-guardian |

### Команды для аудита

```bash
# Полный аудит модуля
"Проведи полный аудит модуля modules/[name]/"

# Аудит по аспекту
"Проведи security audit всех Server Actions"
"Проведи performance audit компонентов с большими списками"

# Быстрая проверка
"Проверь этот код на безопасность"
"Проверь типизацию в этом файле"
```

---

## История изменений

| Дата | Изменение |
|------|-----------|
| 2024-12-25 | Созданы 8 новых агентов: security, typescript, performance, nextjs, zustand, forms, realtime, dead-code |
| 2024-12-25 | Обновлён clean-code-guardian (убраны пересечения с typescript и nextjs) |
| 2024-12-25 | Создана карта агентов (этот файл) |
