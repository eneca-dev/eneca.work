# Система разрешений Resource Graph

## Обзор

Система разрешений Resource Graph определяет **какие разделы видит пользователь** на графике ресурсов. Фильтрация происходит на уровне раздела (section), при этом учитываются все assignees раздела — как ответственные за раздел, так и назначенные на этапы декомпозиции.

---

## Открытые вопросы

> **Требуют решения перед реализацией**

### 1. Перевод руководителя в другое подразделение

**Ситуация:** Начальник отдела временно переведён в другой отдел.

**Вопрос:** Должен ли он сохранить доступ к данным старого отдела?

**Варианты:**
- A) Нет — доступ определяется текущей структурой профиля
- B) Да — нужно отдельное поле "управляемые подразделения"

### 2. Конфиденциальность данных для Project Manager

**Ситуация:** PM видит все разделы своего проекта, включая разделы с сотрудниками из других подразделений.

**Вопрос:** Нужно ли скрывать от PM чувствительные данные (ставки, зарплаты) в разделах где работают не его люди?

**Варианты:**
- A) Нет — PM видит всё по своим проектам
- B) Да — скрывать ставки/зарплаты для "чужих" сотрудников

### 3. Кнопка "Загрузить всё"

**Вопрос:** Кому доступна кнопка "Загрузить всё" (без фильтров)?

**Варианты:**
- A) Только admin (у кого `view.all`)
- B) admin + subdivision_head
- C) Всем, но загружает только в рамках своего scope

---

## Архитектура

### Принцип: Scope-based visibility

```
Раздел виден пользователю если:

  user_id ∈ section_assignees (через v_section_assignees)
  ИЛИ
  project_id ∈ user_managed_projects (для Project Manager)
  ИЛИ
  user имеет разрешение view.all
```

### Уровни защиты

```
┌─────────────────────────────────────────────────────────────────┐
│                    УРОВЕНЬ 1: UI                                 │
│  • Скрываем недоступные опции фильтров                          │
│  • Визуально ограничиваем scope                                  │
├─────────────────────────────────────────────────────────────────┤
│                    УРОВЕНЬ 2: Server Actions (ОСНОВНОЙ)          │
│  • Проверка разрешений перед запросом                           │
│  • Фильтрация section_ids по allowedIds                         │
│  • Логирование подозрительных запросов                          │
├─────────────────────────────────────────────────────────────────┤
│                    УРОВЕНЬ 3: RLS (FALLBACK)                     │
│  • Простая политика: только authenticated users                 │
│  • Защита от прямых SQL-запросов                                │
└─────────────────────────────────────────────────────────────────┘
```

### View: v_section_assignees

Ключевая view для фильтрации. Агрегирует всех причастных к разделу:

```
Раздел (section)
  └─ section_responsible_id        → assignee
  └─ Этап декомпозиции
      └─ Loading (loading_responsible) → assignee
```

**Поля view:**
- `section_id` — ID раздела
- `assignee_id` — ID пользователя (ответственный или назначенный)
- `assignee_team_id` — команда assignee
- `assignee_department_id` — отдел assignee
- `assignee_subdivision_id` — подразделение assignee

---

## Список разрешений

| # | Разрешение | Описание |
|---|------------|----------|
| 1 | `resource_graph.view.all` | Просмотр всех разделов без ограничений |
| 2 | `resource_graph.view.by_subdivision` | Разделы где assignees из моего подразделения |
| 3 | `resource_graph.view.by_department` | Разделы где assignees из моего отдела |
| 4 | `resource_graph.view.by_team` | Разделы где assignees из моей команды |
| 5 | `resource_graph.view.by_self` | Разделы где я лично assignee |
| 6 | `resource_graph.view.by_managed_projects` | Все разделы моих проектов (где я PM) |
| 7 | `resource_graph.filter.full` | Доступ ко всем опциям фильтров |

**Логика фильтров:**
- Если есть `filter.full` → показываем все опции
- Если нет → фильтруем опции по scope пользователя

---

## Матрица ролей

| Разрешение | admin | subdiv_head | dept_head | team_lead | project_mgr | user |
|------------|:-----:|:-----------:|:---------:|:---------:|:-----------:|:----:|
| `view.all` | ✅ | | | | | |
| `view.by_subdivision` | | ✅ | | | | |
| `view.by_department` | | | ✅ | | | |
| `view.by_team` | | | | ✅ | | |
| `view.by_managed_projects` | | | | | ✅ | |
| `view.by_self` | | ✅ | ✅ | ✅ | ✅ | ✅ |
| `filter.full` | ✅ | | | | | |

**Примечание:** Все роли кроме admin имеют `view.by_self` — чтобы видеть разделы где они лично назначены, даже если это вне их org-scope.

---

## Комбинирование разрешений

Если пользователь имеет несколько view-разрешений, scope **объединяется через OR**:

```typescript
// Пример: руководитель отдела
const permissions = [
  'resource_graph.view.by_department',  // Все где assignees из отдела
  'resource_graph.view.by_self'         // + где я лично назначен
]

// Видит:
// - Все разделы где есть сотрудники его отдела
// - ПЛЮС разделы где он сам assignee (даже в другом отделе)
```

---

## Визуализация по ролям

```
┌─────────────────────────────────────────────────────────────────┐
│                        ADMIN                                     │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ ВСЕ РАЗДЕЛЫ компании                                      │  │
│  └───────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│                   SUBDIVISION HEAD                               │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Разделы где assignee из подразделения + свои личные       │  │
│  └───────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│                   DEPARTMENT HEAD                                │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Разделы где assignee из отдела + свои личные              │  │
│  └───────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│                     TEAM LEAD                                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Разделы где assignee из команды + свои личные             │  │
│  └───────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│                  PROJECT MANAGER                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ ВСЕ разделы своих проектов + свои личные                  │  │
│  └───────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│                       USER                                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Только разделы где я лично assignee                       │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## SQL: View v_section_assignees

```sql
CREATE OR REPLACE VIEW v_section_assignees AS
WITH section_responsibles AS (
  SELECT
    s.section_id,
    s.section_responsible_id AS user_id
  FROM sections s
  WHERE s.section_responsible_id IS NOT NULL
),
stage_assignees AS (
  SELECT DISTINCT
    ds.decomposition_stage_section_id AS section_id,
    l.loading_responsible AS user_id
  FROM decomposition_stages ds
  JOIN loadings l ON l.loading_stage = ds.decomposition_stage_id
  WHERE l.loading_responsible IS NOT NULL
),
all_assignees AS (
  SELECT * FROM section_responsibles
  UNION
  SELECT * FROM stage_assignees
)
SELECT DISTINCT
  aa.section_id,
  aa.user_id AS assignee_id,
  p.team_id AS assignee_team_id,
  t.department_id AS assignee_department_id,
  d.subdivision_id AS assignee_subdivision_id
FROM all_assignees aa
JOIN profiles p ON p.user_id = aa.user_id
LEFT JOIN teams t ON t.team_id = p.team_id
LEFT JOIN departments d ON d.department_id = t.department_id;

COMMENT ON VIEW v_section_assignees IS
'Связь разделов с assignees для системы разрешений resource_graph';
```

---

## SQL: Миграция разрешений

```sql
-- 1. Создаём разрешения
INSERT INTO permissions (name, description) VALUES
('resource_graph.view.all', 'Просмотр всех разделов без ограничений'),
('resource_graph.view.by_subdivision', 'Просмотр разделов где assignees из моего подразделения'),
('resource_graph.view.by_department', 'Просмотр разделов где assignees из моего отдела'),
('resource_graph.view.by_team', 'Просмотр разделов где assignees из моей команды'),
('resource_graph.view.by_self', 'Просмотр разделов где я лично assignee'),
('resource_graph.view.by_managed_projects', 'Просмотр всех разделов моих проектов'),
('resource_graph.filter.full', 'Доступ ко всем опциям фильтров');

-- 2. admin
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'admin' AND p.name IN (
  'resource_graph.view.all',
  'resource_graph.filter.full'
);

-- 3. subdivision_head
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'subdivision_head' AND p.name IN (
  'resource_graph.view.by_subdivision',
  'resource_graph.view.by_self'
);

-- 4. department_head
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'department_head' AND p.name IN (
  'resource_graph.view.by_department',
  'resource_graph.view.by_self'
);

-- 5. team_lead
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'team_lead' AND p.name IN (
  'resource_graph.view.by_team',
  'resource_graph.view.by_self'
);

-- 6. project_manager
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'project_manager' AND p.name IN (
  'resource_graph.view.by_managed_projects',
  'resource_graph.view.by_self'
);

-- 7. user
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'user' AND p.name IN (
  'resource_graph.view.by_self'
);
```

---

## Реализация в коде

### Server Action: getVisibleSectionIds

```typescript
interface VisibilityScope {
  sectionIds: string[] | null  // null = все разделы (для admin)
  isUnlimited: boolean
}

export async function getVisibleSectionIds(
  supabase: SupabaseClient,
  userId: string,
  permissions: string[]
): Promise<VisibilityScope> {

  // Admin видит всё
  if (permissions.includes('resource_graph.view.all')) {
    return { sectionIds: null, isUnlimited: true }
  }

  // Собираем scope из всех разрешений (OR логика)
  const sectionIdSets: Set<string>[] = []

  // Получаем профиль
  const { data: profile } = await supabase
    .from('profiles')
    .select('user_id, team_id')
    .eq('user_id', userId)
    .single()

  // Получаем org-структуру профиля
  const { data: orgInfo } = await supabase
    .from('v_org_structure')
    .select('team_id, department_id, subdivision_id')
    .eq('employee_id', userId)
    .single()

  // view.by_subdivision
  if (permissions.includes('resource_graph.view.by_subdivision') && orgInfo?.subdivision_id) {
    const { data } = await supabase
      .from('v_section_assignees')
      .select('section_id')
      .eq('assignee_subdivision_id', orgInfo.subdivision_id)
    sectionIdSets.push(new Set(data?.map(r => r.section_id) || []))
  }

  // view.by_department
  if (permissions.includes('resource_graph.view.by_department') && orgInfo?.department_id) {
    const { data } = await supabase
      .from('v_section_assignees')
      .select('section_id')
      .eq('assignee_department_id', orgInfo.department_id)
    sectionIdSets.push(new Set(data?.map(r => r.section_id) || []))
  }

  // view.by_team
  if (permissions.includes('resource_graph.view.by_team') && orgInfo?.team_id) {
    const { data } = await supabase
      .from('v_section_assignees')
      .select('section_id')
      .eq('assignee_team_id', orgInfo.team_id)
    sectionIdSets.push(new Set(data?.map(r => r.section_id) || []))
  }

  // view.by_self
  if (permissions.includes('resource_graph.view.by_self')) {
    const { data } = await supabase
      .from('v_section_assignees')
      .select('section_id')
      .eq('assignee_id', userId)
    sectionIdSets.push(new Set(data?.map(r => r.section_id) || []))
  }

  // view.by_managed_projects
  if (permissions.includes('resource_graph.view.by_managed_projects')) {
    const { data } = await supabase
      .from('v_resource_graph')
      .select('section_id')
      .eq('project_manager_id', userId)
    sectionIdSets.push(new Set(data?.map(r => r.section_id) || []))
  }

  // Объединяем все sets (OR)
  const combinedIds = new Set<string>()
  for (const set of sectionIdSets) {
    for (const id of set) {
      combinedIds.add(id)
    }
  }

  return {
    sectionIds: Array.from(combinedIds),
    isUnlimited: false
  }
}
```

### Server Action: getResourceGraphData

```typescript
export async function getResourceGraphData(filters?: FilterQueryParams) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // 1. Получаем разрешения
  const permissions = await getUserPermissions(user.id)

  // 2. Определяем видимые section_id
  const { sectionIds, isUnlimited } = await getVisibleSectionIds(
    supabase,
    user.id,
    permissions
  )

  // 3. Строим запрос
  let query = supabase.from('v_resource_graph').select('*')

  // 4. Применяем scope-ограничение
  if (!isUnlimited) {
    if (!sectionIds || sectionIds.length === 0) {
      return { success: true, data: [] }
    }
    query = query.in('section_id', sectionIds)
  }

  // 5. Применяем пользовательские фильтры
  // ... существующая логика фильтров ...
}
```

### Hook: useFilterOptions

```typescript
export function useFilterOptions() {
  const { permissions } = usePermissionsStore()
  const { profile } = useUserStore()
  const { data: allOptions } = useAllFilterOptions()

  const options = useMemo(() => {
    // Полный доступ — все опции
    if (permissions.includes('resource_graph.filter.full')) {
      return allOptions
    }

    // Ограниченный доступ — фильтруем по scope
    return allOptions.filter(option => {
      if (option.key === 'подразделение') {
        return option.id === profile.subdivisionId
      }
      if (option.key === 'отдел') {
        return option.subdivisionId === profile.subdivisionId
      }
      // Проекты и метки — показываем все (фильтрация на сервере)
      return true
    })
  }, [permissions, profile, allOptions])

  return { options }
}
```

---

## Безопасность

### Основные принципы

1. **Server Actions — основной уровень защиты**
   - Никогда не доверяем входным `section_id` от клиента
   - Всегда вычисляем `allowedIds` на сервере
   - Клиентские фильтры — только для UX

2. **RLS — простой fallback**
   - Только проверка authenticated
   - Защита от прямых SQL-запросов

3. **Кеш разрешений**
   - TTL: 1 минута
   - Инвалидация при изменении профиля через Realtime

### Server-side валидация

```typescript
export async function getResourceGraphData(filters?: FilterQueryParams) {
  // 1. Вычисляем разрешённые section_id
  const { sectionIds: allowedIds, isUnlimited } = await getVisibleSectionIds(...)

  // 2. Если клиент передал section_ids — валидируем
  if (filters?.section_ids && !isUnlimited) {
    const requestedIds = filters.section_ids
    const validIds = requestedIds.filter(id => allowedIds?.includes(id))

    // Логируем попытки доступа к неразрешённым разделам
    if (validIds.length !== requestedIds.length) {
      console.warn(`[SECURITY] User ${userId} requested unauthorized sections`)
      // Можно добавить Sentry.captureMessage(...)
    }

    query = query.in('section_id', validIds)
  }
}
```

### Realtime инвалидация кеша

```typescript
// При изменении профиля пользователя
supabase
  .channel('profile-changes')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'profiles',
    filter: `user_id=eq.${userId}`
  }, () => {
    queryClient.invalidateQueries({ queryKey: ['permissions', userId] })
    queryClient.invalidateQueries({ queryKey: ['visible-sections', userId] })
  })
  .subscribe()
```

### При смене роли

При изменении роли пользователя рекомендуется:
- Принудительный refresh страницы
- Или logout + повторный login

Это проще и надёжнее, чем realtime-подписка на `role_permissions`.

---

## Чек-лист реализации

- [ ] Создать view `v_section_assignees`
- [ ] Добавить разрешения в БД (миграция)
- [ ] Назначить разрешения ролям
- [ ] Реализовать `getVisibleSectionIds()`
- [ ] Обновить `getResourceGraphData()` с проверкой scope
- [ ] Обновить `useFilterOptions()` с фильтрацией опций
- [ ] Добавить Realtime инвалидацию кеша
- [ ] Протестировать все роли

---

## Будущие улучшения

1. **Materialized view** — для больших объёмов данных v_section_assignees может быть медленной
2. **Rate limiting** — защита от перебора section_id
3. **Аудит таблица** — полная история доступа (userId, action, sectionIds, timestamp)
4. **Anomaly detection** — выявление подозрительных паттернов доступа
5. **Гранулярные права на данные** — скрытие ставок/зарплат для PM
