### План: Ограничение фильтров по уровню доступа (hierarchy)

Цель: реализовать блокировку части фильтров в верхнем меню в зависимости от прав из набора `hierarchy` таблицы `permissions`.

#### Роли и правила
- **is_admin**: доступны все фильтры (ничего не блокируем).
- **is_department_head**: заблокировать фильтр отдела; автоматически выбрать текущий отдел пользователя.
- **is_team_lead** и **is_user**: заблокировать фильтры отдела и команды; автоматически выбрать текущие отдел и команду пользователя.

Примечание: права читаем как строковые литералы permissions из набора `hierarchy` (например, `hierarchy.is_admin`, `hierarchy.is_department_head`, `hierarchy.is_team_lead`).

---

### Источники данных
- Права доступа: `usePermissionsStore` (модуль `@/modules/permissions`), массив `permissions`.
- Контекст пользователя (его отдел/команда):
  - приоритетно — `useUserStore` (если уже содержит `departmentId`, `teamId`);
  - fallback — запрос к БД (Supabase) во view с маппингом пользователя на отдел/команду. В проекте уже используется `view_employee_workloads` (см. загрузку сотрудников в `modules/planning/filters/store.ts`), откуда берём `final_department_id` и `final_team_id` по текущему `auth.user.id`.

---

### Изменения по слоям

#### 1) Стор фильтров (Zustand)
Файл: `modules/planning/filters/store.ts`

Добавить легковесную инициализацию ограничений и дефолтов на старте:
- поле состояния `lockedFilters: Set<FilterType>`;
- метод `applyPermissionDefaults(ctx: { departmentId?: string | null; teamId?: string | null; permissions: string[] })`:
  - вычисляет набор блокировок на основе permissions;
  - если требуется, устанавливает `selectedDepartmentId` и/или `selectedTeamId` в соответствии с контекстом пользователя;
  - записывает `lockedFilters` в стор;
- метод `isFilterLocked(type: FilterType): boolean` (локальный, без внешних импортов) — читает из `lockedFilters`.

Вызов: внутри `initialize()` после загрузки базовых данных вызвать `applyPermissionDefaults()` с полученным контекстом пользователя.

Минимальные сигнатуры:
```ts
type FilterType = 'manager' | 'project' | 'stage' | 'object' | 'department' | 'team' | 'employee'

interface PermissionContext {
  departmentId?: string | null
  teamId?: string | null
  permissions: string[]
}

function deriveLocks(p: string[]): Set<FilterType> {
  if (p.includes('hierarchy.is_admin')) return new Set()
  if (p.includes('hierarchy.is_department_head')) return new Set(['department'])
  if (p.includes('hierarchy.is_team_lead') || p.includes('hierarchy.is_user')) return new Set(['department', 'team'])
  return new Set()
}
```

Поведение при сбросе фильтров (`resetFilters`):
- не стирать зафиксированные по ролям значения (department/team) — сбрасывать всё остальное;
- можно реализовать `resetFiltersRespectingLocks()` или адаптировать текущий `resetFilters` так, чтобы он не трогал заблокированные поля.

#### 2) Провайдер контекста прав и орг.привязок
Цель: собрать `PermissionContext` для стора фильтров.

Файл(ы):
- `modules/permissions/integration/filters-permission-context.ts` — утилита, возвращающая объект `{ permissions, departmentId, teamId }`:
  - читает `permissions` из `usePermissionsStore.getState()`;
  - читает `departmentId`, `teamId` из `useUserStore.getState()`;
  - если нет данных — делает один лёгкий запрос в Supabase к `view_employee_workloads` по текущему пользователю.

```ts
export async function getFiltersPermissionContext(): Promise<PermissionContext> {
  const { permissions } = usePermissionsStore.getState()
  const { profile } = useUserStore.getState()
  let departmentId = profile?.departmentId ?? null
  let teamId = profile?.teamId ?? null
  if (!departmentId || (!teamId && needsTeam(permissions))) {
    // fallback к БД (view_employee_workloads)
    // выбрать final_department_id/final_team_id по текущему user_id
  }
  return { permissions: permissions ?? [], departmentId, teamId }
}
```

#### 3) Инициализация на страницах/модулях
В местах, где страница/модуль первый раз инициализирует фильтры (например, `ProjectsPage`, `TimelineView`):
1) дождаться загрузки прав (в проекте уже есть логика ранней загрузки прав);
2) получить `PermissionContext` из утилиты выше;
3) вызвать `useFilterStore.getState().applyPermissionDefaults(ctx)` перед/после `initialize()` (в зависимости от того, где удобнее выставить выбранные значения);
4) в UI-компонентах селектов учитывать `isFilterLocked('department'|'team')` и проставлять `disabled`.

#### 4) UI
- Селекты отдела и команды: `disabled` если заблокированы;
- Кнопка «Сбросить»: не сбрасывает заблокированные значения;
- Визуально можно показать индикатор «замка» (необязательно на первом этапе).

---

### Файлы к созданию/изменению
- [новый] `modules/permissions/integration/filters-permission-context.ts` — сбор контекста из сторов/БД;
- [изменить] `modules/planning/filters/store.ts` — добавить `lockedFilters`, методы `applyPermissionDefaults`, `isFilterLocked`, адаптировать `resetFilters`;
- [изменить] страницы, где используются фильтры (например, `modules/projects/ProjectsPage.tsx`, `modules/planning/components/timeline-view.tsx`) — прокинуть `disabled` для заблокированных селектов.

---

### Поток данных
1) Приложение грузит права (`usePermissionsStore`) до рендера модулей.
2) Модуль вызывает `getFiltersPermissionContext()`.
3) Стор фильтров вызывает `applyPermissionDefaults(ctx)` → проставляет выбранные значения и `lockedFilters`.
4) UI рендерит селекты, учитывая `isFilterLocked`.
5) `resetFilters` сохраняет значения заблокированных фильтров.

---

### Тест-кейсы (минимум)
- Admin: все селекты активны, `reset` сбрасывает всё.
- Department head: отдел заблокирован и выбран как у пользователя; остальное активно; `reset` не трогает отдел.
- Team lead / User: отдел и команда заблокированы и соответствуют пользователю; `reset` не трогает их.
- Отсутствуют данные профиля: подтягиваем из `view_employee_workloads`.

---

### Риски/примечания
- Важно гарантировать, что права загружены до применения ограничений (страховка: повторное применение при изменении permissions/profile).
- Не привязывать значения к env-константам — использовать фактические id из БД.
- Избежать лишних запросов: делать fallback-запрос к БД только при отсутствии данных в `useUserStore`.


