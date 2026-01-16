# Актуализация команд и отделов - Техническая документация

## База данных

**Таблица `teams_activity`:**
```sql
team_id: UUID
confirmed_by: UUID
activity_type: TEXT ('data_confirmed')
confirmed_at: TIMESTAMPTZ
```

**View `view_planning_team_freshness`:**
```sql
team_id: UUID
team_name: TEXT
department_id: UUID
department_name: TEXT
last_update: TIMESTAMPTZ
days_since_update: INTEGER
```

---

## Server Action

**Файл:** `modules/planning/actions/team-activity.ts`

**Функция:** `confirmTeamActivityAction(teamId: string)`

**Логика выполнения:**
1. Валидация `teamId` (не пустая строка)
2. Получение пользователя через `supabase.auth.getUser()`
3. Получение прав через `getUserPermissions(user.id)`
4. Определение наивысшего права из иерархии
5. Проверка доступа в зависимости от права:

**Приоритет прав (от высшего к низшему):**
```typescript
hierarchy.is_admin                  // полный доступ
hierarchy.is_project_manager        // полный доступ
hierarchy.is_subdivision_head       // проверка subdivision_id
hierarchy.is_department_head        // проверка department_id
hierarchy.is_team_lead             // проверка team_id
hierarchy.is_user                  // отказ
```

6. INSERT в `teams_activity`:
   ```sql
   INSERT INTO teams_activity (team_id, confirmed_by, activity_type, confirmed_at)
   VALUES (?, ?, 'data_confirmed', NOW())
   ```

**Возвращает:**
```typescript
{ success: boolean, error?: string }
```

---

## Client API

**Файл:** `modules/planning/api/teamActivity.ts`

**Функции:**

1. `fetchTeamFreshness()`:
   - SELECT из `view_planning_team_freshness`
   - Преобразование snake_case → camelCase
   - Возвращает `TeamFreshness[]`

2. `confirmTeamActivity(teamId)`:
   - Вызывает `confirmTeamActivityAction(teamId)`
   - Обработка ошибок
   - Возвращает `{ success, error? }`

3. `confirmMultipleTeamsActivity(teamIds[])`:
   - `Promise.all()` для параллельных вызовов
   - Вызывает `confirmTeamActivity()` для каждого teamId
   - Проверяет что все успешны
   - Возвращает `{ success, error? }`

---

## Store

**Файл:** `modules/planning/stores/usePlanningStore.ts`

**State:**
```typescript
freshnessCache: {
  data: Record<teamId, TeamFreshness>
  lastFetched: Date | null
  isLoading: boolean
}
```

**Методы:**

1. `loadFreshness(forceReload?: boolean)`:
   ```typescript
   if (!forceReload && cache не устарел) return
   const data = await fetchTeamFreshness()
   // Сохранение в freshnessCache.data как Map по team_id
   ```

2. `confirmTeamActivity(teamId)`:
   ```typescript
   const result = await confirmTeamActivityAPI(teamId)
   if (result.success) {
     await loadFreshness(true)  // Force reload
   }
   return result
   ```

3. `confirmMultipleTeamsActivity(teamIds[])`:
   ```typescript
   const result = await confirmMultipleTeamsActivityAPI(teamIds)
   if (result.success) {
     await loadFreshness(true)
   }
   return result
   ```

---

## UI Components

### FreshnessIndicator

**Файл:** `modules/planning/components/timeline/FreshnessIndicator.tsx`

**Логика цвета:**
```typescript
if (daysSinceUpdate === undefined) return 'gray'
if (daysSinceUpdate < 3) return 'green'
if (daysSinceUpdate <= 5) return 'yellow'
return 'red'
```

**Тултип текст:**
```typescript
if (daysSinceUpdate > 200) {
  return 'Не обновлялось\n[Действие]'
}
return 'Обновлено X дней назад\nДата: DD.MM.YYYY, HH:mm\n[Действие]'
// [Действие] = 'Нажмите для актуализации' или 'Нет прав'
```

### DepartmentRow

**Файл:** `modules/planning/components/timeline/department-row.tsx`

**Логика freshness для отдела:**
```typescript
const departmentFreshness = useMemo(() => {
  const teamFreshness = department.teams
    .map(team => freshnessCache[team.id])
    .filter(f => f !== undefined && f.daysSinceUpdate !== undefined)

  if (teamFreshness.length === 0) return undefined

  // Максимум = самые старые данные
  return teamFreshness.reduce((max, current) =>
    current.daysSinceUpdate > max.daysSinceUpdate ? current : max
  )
}, [department.teams, freshnessCache])
```

**Props для FreshnessIndicator:**
```typescript
teamId={department.teams[0]?.id || department.id}
teamIds={department.teams.map(t => t.id)}
onConfirmMultiple={confirmMultipleActivity}
tooltipSide={departmentIndex === 0 ? 'left' : 'top'}
```

---

## Поток данных

**Актуализация команды:**
```
User click → FreshnessIndicator.handleClick
  → setShowConfirmModal(true)
  → User confirm → handleConfirm(e)
    → e.stopPropagation()
    → onConfirm(teamId) [from store]
      → confirmTeamActivityAPI(teamId) [client API]
        → confirmTeamActivityAction(teamId) [server action]
          → auth check → permissions check → hierarchy check
            → INSERT teams_activity
              → return { success: true }
        → return result
      → if success: loadFreshness(true)
        → fetchTeamFreshness()
          → SELECT view_planning_team_freshness
            → store.freshnessCache.data = Map by team_id
      → return result
    → if success: onClose()
  → UI update (new color)
```

**Загрузка freshness:**
```
Timeline mount → useEffect
  → loadFreshness()
    → check cache validity
    → fetchTeamFreshness()
      → SELECT view_planning_team_freshness
      → transform snake_case → camelCase
      → return TeamFreshness[]
    → save to store.freshnessCache.data
  → Components read from cache
    → FreshnessIndicator computes color
```
---

## Проверки и валидации

**Server Action:**
- `teamId` не пустая строка
- Пользователь авторизован
- Есть хотя бы одно иерархическое право
- Доступ к команде согласно иерархии

**Client:**
- `teamIds.length > 0` для множественной актуализации
- Disabled если `!canActualizeDepartment()` или `!canActualizeTeam()`

**Store:**
- Cache invalidation при `forceReload=true`
- Проверка `result.success` перед reload

---
