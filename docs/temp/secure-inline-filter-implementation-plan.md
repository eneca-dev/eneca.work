# План реализации: Система разрешений для inline-filter

> **Версия:** 2.0 (упрощённая после review агентов)
> **Статус:** На согласовании

---

## 1. Изменения после review

### Что убрали (over-engineering)

| Компонент | Причина отказа |
|-----------|----------------|
| `SecureInlineFilter` | Дублирует 5 строк существующего кода |
| `useSecureFilter` | Комбинация существующих хуков достаточна |
| Fade-in анимации | Функциональность > украшательства |
| Lock icon | Слишком "restrictive", заменяем на Info |

### Что оставили

| Компонент | Причина |
|-----------|---------|
| `LockedFiltersBadge` | Единственная новая UI функциональность |
| Security fixes | Критические уязвимости в `applyMandatoryFilters` |
| Realtime invalidation | Cache может показывать stale permissions |

---

## 2. Архитектура (упрощённая)

### Что уже есть и работает

```
modules/permissions/
├── hooks/
│   ├── use-filter-context.ts      ✅ Загрузка контекста (TanStack Query)
│   └── use-filtered-options.ts    ✅ Фильтрация опций + getLockedFilters()
├── utils/
│   ├── mandatory-filters.ts       ⚠️ Нужны security fixes
│   └── scope-resolver.ts          ✅ Вычисление scope
└── server/
    └── get-filter-context.ts      ✅ Server Action
```

### Что добавляем

```
modules/permissions/
├── components/
│   └── LockedFiltersBadge.tsx     🆕 ~50 строк
└── index.ts                        📝 +2 экспорта

modules/cache/
└── realtime/
    └── config.ts                   📝 +2 подписки
```

---

## 3. Паттерн использования

### Для разработчика (5 строк интеграции)

```typescript
// modules/resource-graph/components/Filters.tsx
import {
  useFilterContext,
  useFilteredOptions,
  getLockedFilters,
  LockedFiltersBadge
} from '@/modules/permissions'
import { InlineFilter } from '@/modules/inline-filter'

function ResourceGraphFilters() {
  const [filterString, setFilterString] = useState('')
  const { allOptions } = useAllFilterOptions()

  // 3 строки для permissions
  const { data: filterContext } = useFilterContext()
  const filteredOptions = useFilteredOptions(allOptions, filterContext)
  const lockedFilters = getLockedFilters(filterContext)

  return (
    <div className="flex items-center gap-2">
      {/* Badge inline слева от input */}
      <LockedFiltersBadge
        filters={lockedFilters}
        scopeLevel={filterContext?.scope.level}
      />

      {/* Стандартный фильтр с отфильтрованными опциями */}
      <InlineFilter
        config={CONFIG}
        value={filterString}
        onChange={setFilterString}
        options={filteredOptions}
        className="flex-1"
      />
    </div>
  )
}
```

### В Server Actions (без изменений)

```typescript
// modules/resource-graph/actions/getData.ts
'use server'

import { getFilterContext, applyMandatoryFilters } from '@/modules/permissions'

export async function getResourceGraphData(filterString: string) {
  const contextResult = await getFilterContext()
  if (!contextResult.success) {
    return { success: false, error: contextResult.error }
  }

  const userFilters = tokensToQueryParams(parsed.tokens, CONFIG)
  const safeFilters = applyMandatoryFilters(userFilters, contextResult.data)

  // Query с безопасными фильтрами
  const { data } = await supabase.from('v_resource_graph').select('*').match(safeFilters)
  return { success: true, data }
}
```

---

## 4. UI компонент: LockedFiltersBadge

### Визуальный дизайн

```
┌──────────────────────────────────────────────────────────┐
│ [ℹ️ Команда: Разработка]  🔍 проект:"Солнечный"    ✕ 2  │
└──────────────────────────────────────────────────────────┘
  ↑                         ↑
  Badge (inline)            InlineFilter
```

### Состояния по ролям

| Роль | Badge | Tooltip |
|------|-------|---------|
| `admin` | Нет badge | — |
| `subdivision_head` | `ℹ️ Подразделение: ОВ и К` | Роль: Начальник подразделения |
| `department_head` | `ℹ️ Отдел: Проектирование` | Роль: Начальник отдела |
| `project_manager` | `ℹ️ Проекты: 2` или `ℹ️ Проект: Солнечный` | Роль: Руководитель проекта |
| `team_lead` | `ℹ️ Команда: Разработка` | Роль: Тимлид |
| `user` | `ℹ️ Команда: Разработка` | Роль: Сотрудник |

### Спецификация компонента

```typescript
interface LockedFiltersBadgeProps {
  /** Заблокированные фильтры */
  filters: Array<{ key: string; displayName: string }>
  /** Уровень scope для tooltip */
  scopeLevel?: 'all' | 'subdivision' | 'department' | 'team' | 'projects' | null
  /** Название роли для tooltip */
  roleName?: string
  /** CSS классы */
  className?: string
}
```

### Accessibility

- `role="status"` — screen reader объявляет как статус
- `aria-label` — полное описание для screen reader
- `tabIndex={0}` — keyboard focusable
- Tooltip открывается на focus (не только hover)

---

## 5. Security fixes (CRITICAL)

### 5.1 Верификация permissions для всех scope levels

**Файл:** `modules/permissions/utils/mandatory-filters.ts`

**Проблема:** Проверка permission есть только для `scope.level === 'all'`, остальные уровни не проверяются.

**Fix:**
```typescript
// После проверки admin, добавить проверку для остальных levels
switch (scope.level) {
  case 'subdivision':
    if (!filterContext.filterPermissions?.includes('filters.scope.subdivision')) {
      console.error('[SECURITY] Subdivision scope without permission — BLOCKING')
      Sentry.captureMessage('[SECURITY] Subdivision scope bypass attempt', { level: 'error' })
      return { ...userFilters, team_id: BLOCKING_UUID }
    }
    break

  case 'department':
    if (!filterContext.filterPermissions?.includes('filters.scope.department')) {
      console.error('[SECURITY] Department scope without permission — BLOCKING')
      Sentry.captureMessage('[SECURITY] Department scope bypass attempt', { level: 'error' })
      return { ...userFilters, team_id: BLOCKING_UUID }
    }
    break

  case 'team':
    if (!filterContext.filterPermissions?.includes('filters.scope.team')) {
      console.error('[SECURITY] Team scope without permission — BLOCKING')
      Sentry.captureMessage('[SECURITY] Team scope bypass attempt', { level: 'error' })
      return { ...userFilters, team_id: BLOCKING_UUID }
    }
    break

  case 'projects':
    if (!filterContext.filterPermissions?.includes('filters.scope.managed_projects')) {
      console.error('[SECURITY] Projects scope without permission — BLOCKING')
      Sentry.captureMessage('[SECURITY] Projects scope bypass attempt', { level: 'error' })
      return { ...userFilters, team_id: BLOCKING_UUID }
    }
    break
}
```

### 5.2 Валидация UUID массивов

**Файл:** `modules/permissions/utils/mandatory-filters.ts`

**Fix:**
```typescript
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function validateUUIDs(ids: string[] | undefined): boolean {
  if (!ids) return true
  return ids.every(id => UUID_REGEX.test(id))
}

// В начале applyMandatoryFilters
if (!validateUUIDs(scope.teamIds) ||
    !validateUUIDs(scope.departmentIds) ||
    !validateUUIDs(scope.subdivisionIds) ||
    !validateUUIDs(scope.projectIds)) {
  Sentry.captureMessage('[SECURITY] Invalid UUIDs in scope — BLOCKING', { level: 'error' })
  return { ...userFilters, team_id: BLOCKING_UUID }
}
```

### 5.3 DB constraint для BLOCKING_UUID

**Миграция:**
```sql
-- Prevent BLOCKING_UUID from existing in production
ALTER TABLE teams ADD CONSTRAINT chk_team_id_not_blocking
  CHECK (team_id != '00000000-0000-0000-0000-000000000000');

ALTER TABLE departments ADD CONSTRAINT chk_department_id_not_blocking
  CHECK (department_id != '00000000-0000-0000-0000-000000000000');

ALTER TABLE subdivisions ADD CONSTRAINT chk_subdivision_id_not_blocking
  CHECK (subdivision_id != '00000000-0000-0000-0000-000000000000');

ALTER TABLE projects ADD CONSTRAINT chk_project_id_not_blocking
  CHECK (project_id != '00000000-0000-0000-0000-000000000000');
```

---

## 6. Cache invalidation

### Realtime подписки

**Файл:** `modules/cache/realtime/config.ts`

```typescript
// Добавить подписки на таблицы ролей
{
  table: 'user_roles',
  invalidateKeys: [
    queryKeys.filterPermissions.all,
  ],
},
{
  table: 'role_permissions',
  invalidateKeys: [
    queryKeys.filterPermissions.all,
  ],
},
```

### SQL publication

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE user_roles;
ALTER PUBLICATION supabase_realtime ADD TABLE role_permissions;
```

---

## 7. Этапы реализации

| # | Этап | Файлы | LOC | Приоритет |
|---|------|-------|-----|-----------|
| 1 | Security fixes | `mandatory-filters.ts` | ~40 | 🔴 CRITICAL |
| 2 | DB constraints | migration | ~10 | 🔴 CRITICAL |
| 3 | LockedFiltersBadge | `components/LockedFiltersBadge.tsx` | ~50 | 🟢 FEATURE |
| 4 | Realtime invalidation | `config.ts` + SQL | ~10 | 🟡 MEDIUM |
| 5 | Экспорты + docs | `index.ts`, `README.md` | ~30 | 🟢 LOW |

**Итого: ~140 строк**

---

## 8. Чек-лист готовности

### Security (MUST)
- [ ] Permission verification для всех scope levels
- [ ] UUID validation в scope arrays
- [ ] DB constraints для BLOCKING_UUID
- [ ] Sentry logging для security events

### Functionality
- [ ] LockedFiltersBadge рендерится для non-admin
- [ ] Tooltip показывает роль и область видимости
- [ ] Badge inline слева от InlineFilter

### Cache
- [ ] Realtime invalidation для user_roles
- [ ] Realtime invalidation для role_permissions

### Accessibility
- [ ] `role="status"` на badge
- [ ] `aria-label` с полным описанием
- [ ] Keyboard focusable (tabIndex)
- [ ] Tooltip на focus

### Documentation
- [ ] Паттерн использования в README
- [ ] JSDoc для LockedFiltersBadge

---

## 9. Что НЕ входит в scope

- ❌ SecureInlineFilter wrapper (over-engineering)
- ❌ useSecureFilter хук (дублирование)
- ❌ Fade-in анимации (не нужны)
- ❌ Rate limiting (отложено, low priority)
- ❌ Миграция существующих модулей (опционально позже)

---

## 10. Критерии успеха

1. **Security Score:** 6.5/10 → 8.5/10
2. **New code:** ~140 строк (вместо 300+)
3. **Breaking changes:** 0
4. **Backward compatible:** Да

---

*Версия: 2.0*
*Обновлено: 2026-01-16*
*Статус: На согласовании с Pragmatic Architect*
