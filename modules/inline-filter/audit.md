# MODULE AUDIT: filter-permissions + inline-filter

**Дата:** 2025-12-27
**Версия:** 1.0

---

## Сводная таблица

| Агент | Статус | Issues |
|-------|--------|--------|
| Security Guardian | CRITICAL | 1 Critical, 2 High, 3 Medium |
| Cache Guardian | Warning | 4 warnings |
| TypeScript Guardian | Warning | 3 Critical assertions |
| Performance Guardian | CRITICAL | 1 N+1, 1 Dead query |
| Next.js Guardian | Warning | 1 Server/Client issue |
| Clean Code Guardian | Warning | Large functions, DRY issues |
| Dead Code Hunter | Warning | ~180 lines dead code |

**Критичные проблемы:** 4
**Общая оценка:** 5.5/10

---

## CRITICAL — Исправить немедленно

### 1. SQL Injection в `getScopeSqlCondition`
**Файл:** `filter-permissions/utils/mandatory-filters.ts:186-226`

Прямая конкатенация ID в SQL без параметризации:
```typescript
const ids = scope.subdivisionIds.map((id) => `'${id}'`).join(', ')
conditions.push(`${prefix}subdivision_id IN (${ids})`)
```

**Решение:** UUID валидация или параметризованные запросы

---

### 2. N+1 Queries в `getFilterContext`
**Файл:** `filter-permissions/server/get-filter-context.ts:27-245`

До 10 последовательных запросов к БД (100-500ms латенси)

**Решение:** `Promise.all()` или единый RPC

---

### 3. Небезопасные type assertions
**Файл:** `filter-permissions/server/get-filter-context.ts:73-74, 86, 123-125`

```typescript
(r.role as { name: string }).name  // без проверки
```

**Решение:** Добавить type guards

---

### 4. Dead query block
**Файл:** `filter-permissions/server/get-filter-context.ts:77-88`

`permissionsData` и `permError` объявлены но не используются

**Решение:** Удалить строки 77-88

---

## HIGH — Исправить до деплоя

| # | Проблема | Файл | Решение |
|---|----------|------|---------|
| 5 | Missing profile active check | `get-filter-context.ts` | Проверять `is_active`, `is_blocked` |
| 6 | Server Action из Client Component | `use-filter-context.ts` | API route или Server Component |
| 7 | Константы в 'use server' файле | `get-filter-context.ts` | Вынести в отдельный файл |
| 8 | Server Action не возвращает ActionResult | `get-filter-context.ts` | Обернуть в `{ success, data/error }` |

---

## MEDIUM — Улучшения

| # | Проблема | Файл |
|---|----------|------|
| 9 | InlineFilter 413 строк | `InlineFilter.tsx` |
| 10 | getFilterContext 218 строк | `get-filter-context.ts` |
| 11 | DRY: leadership detection дублируется 4 раза | `get-filter-context.ts` |
| 12 | Hardcoded Russian keys в switch | `use-filtered-options.ts` |
| 13 | Нет Realtime invalidation для user_roles | `cache/realtime/config.ts` |
| 14 | highlightedContent зависит от localValue лишне | `InlineFilter.tsx` |
| 15 | `'use client'` в FilterSuggestions не нужен | `FilterSuggestions.tsx` |

---

## Dead Code (180 строк)

| Что удалить | Файл | Строки |
|-------------|------|--------|
| Query block (permissionsData) | `get-filter-context.ts` | 77-88 |
| `getHighestPermission` | `scope-resolver.ts` | 158-168 |
| `canAccessScope` | `scope-resolver.ts` | 173-222 |
| `validateFilterForScope` | `mandatory-filters.ts` | 131-180 |
| `getScopeSqlCondition` | `mandatory-filters.ts` | 186-227 |
| `addOrUpdateToken` | `parser.ts` | 201-229 |
| `removeToken` | `parser.ts` | 234-251 |
| `getValuesForKey` | `parser.ts` | 264-271 |
| 2x `console.error` | `get-filter-context.ts` | 55, 70 |

---

## План исправлений

### Phase 1: CRITICAL (2-4 часа)
1. Удалить dead query block (строки 77-88)
2. UUID валидация в `getScopeSqlCondition` (или удалить функцию)
3. Распараллелить запросы через `Promise.all()`
4. Добавить type guards для Supabase результатов

### Phase 2: HIGH (2-3 часа)
5. Вынести константы из 'use server' файла
6. Создать API route для filterContext
7. ActionResult паттерн для Server Action
8. Проверка активности профиля

### Phase 3: Clean Code (3-4 часа)
9. Разбить `getFilterContext` на 5-7 функций
10. Извлечь хуки из InlineFilter
11. DRY для leadership detection
12. Удалить весь dead code

### Phase 4: Polish (1-2 часа)
13. Убрать `'use client'` из FilterSuggestions
14. Добавить Realtime invalidation
15. Заменить console.error на Sentry

---

## Verdict

**BLOCK DEPLOY** — Есть CRITICAL SQL injection уязвимость

**Рекомендация:** Исправить Phase 1 перед любым деплоем (особенно #2 SQL Injection)
