# Role-Based Loadings Permissions — Design Spec

**Date:** 2026-04-28
**Status:** Design approved, ready for implementation plan
**Scope:** Tabs `Разделы` (Sections) and `Отделы` (Departments) on `/tasks` page
**Audience:** developers implementing the feature, QA reviewing tests

---

## 1. Goal

On the **Sections** and **Departments** tabs of `/tasks`, expand visibility so that **the entire department** is visible to all roles. Edit rights are gated per role:

- `user` — sees the whole department, edits **only own loadings**
- `team_lead` — sees the whole department, edits **own team's loadings**
- `department_head` — sees the whole department, edits **all department's loadings**, can bulk-shift the department

Admin / subdivision_head / project_manager retain their existing scope behavior. Cross-department operations are forbidden for `user` / `team_lead` / `department_head`; admin / subdivision_head / project_manager preserve current behavior.

---

## 2. Constraints (decided during brainstorming)

| # | Decision | Rationale |
|---|---|---|
| 1 | Changes scoped only to the two tabs (Sections, Departments). Resource Graph and other pages unchanged. | Local change, easier rollback, no impact on planning module. |
| 2 | Admin / subdivision_head / project_manager keep current scope behavior. | The new role-aware policy targets the three department-level roles only. |
| 3 | "Loading ownership" determined by `loading_responsible.department_id` — i.e. by the executing employee's department, not the section's. | Matches existing aggregation in `view_employee_workloads` and natural mental model ("my employee, my loading"). |
| 4 | All operations (create, edit, delete, drag-resize, split) follow one rule. Bulk shift gated separately. Capacity unchanged. | Single rule = simple. Bulk shift is intrinsically a department-wide operation. |
| 5 | Cross-department operations forbidden for `user` / `team_lead` / `department_head`: cannot reassign a loading's responsible to a foreign-dept employee, cannot move a loading to a section in a foreign dept. | Hard guarantee that "everything stays inside own department." |
| 6 | UI behavior for unauthorized loadings: drag-handles hidden, click opens **read-only modal** with details. | Clear visual signal + still informative. |

---

## 3. Architecture

```
/tasks (TasksView)
  ├─ Kanban tab        — UNCHANGED
  ├─ Departments tab   — uses DepartmentsTimelineInternal
  └─ Sections tab      — uses SectionsPageInternal

Changes localized to the two tabs:

  1. View scope: team → department for user/team_lead via tasks.tabs.view.department permission
  2. Edit gating: per-loading checks via canEditLoading()
  3. UI: drag-handles, "Create loading" buttons, BulkShift button gated
  4. Read-only modal mode for loadings the user cannot edit
  5. Cross-dept reassignment / section move blocked for restricted roles
```

### Permission model

8 new permissions:

| Name | Granted to | Purpose |
|---|---|---|
| `loadings.edit.scope.all` | admin | Unrestricted loading edit. |
| `loadings.edit.scope.subdivision` | subdivision_head | Edit if loading's responsible belongs to my subdivision. |
| `loadings.edit.scope.department` | department_head | Edit if loading's responsible belongs to my department. |
| `loadings.edit.scope.team` | team_lead | Edit if loading's responsible belongs to my team. |
| `loadings.edit.scope.managed_projects` | project_manager | Edit if loading's project is one I manage. |
| `loadings.edit.scope.own` | all roles | Edit if I am the loading's responsible. |
| `loadings.bulk_shift.department` | admin, department_head | Run bulk shift on a department. |
| `tasks.tabs.view.department` | user, team_lead, department_head | Expand view scope from team to department on the two tabs. |

`canEditLoading(loading, ctx)` is a pure function returning true if **any** scope-permission matches. OR-logic across all permissions.

`isRestrictedToOwnDepartment(ctx)` returns true if the user has none of `loadings.edit.scope.{all|subdivision|managed_projects}` — i.e. their max scope is department/team/own. Cross-dept blocks apply only to those users.

`canBulkShiftDepartment(departmentId, ctx)` checks the bulk-shift permission and additionally restricts to `ownDepartmentId` for non-admins.

### Module touchpoints

| Module | Files changed | Reason |
|---|---|---|
| Database | (already applied) | New permissions + role_permissions assignments. |
| `modules/permissions` | `server/get-filter-context-tasks.ts` (new), `utils/can-edit-loading.ts` (new), `server/assert-can-edit-loading.ts` (new), `hooks/use-can-edit-loading.ts` (new), `index.ts` (exports), `usePermissions.ts` (extend `usePlanningPermissions`) | New permission helpers and hooks. |
| `modules/sections-page` | `actions/index.ts` (4 functions), `components/rows/EmployeeRow.tsx`, `components/rows/ObjectSectionRow.tsx` | Server gating + UI gating. |
| `modules/departments-timeline` | `actions/index.ts` (3 functions), `components/timeline/EmployeeRow.tsx`, `components/timeline/DepartmentRow.tsx` | Server gating + UI gating. |
| `modules/modals` | `LoadingModalNewContainer.tsx`, `LoadingModalNew.tsx`, `LoadingForm.tsx`, `ProjectTree.tsx`, employee selector, `actions/loadings.ts`, `types/index.ts`, `hooks/useLoadingModal.ts` | Read-only mode + cross-dept restriction in selectors. |
| `modules/tasks` | `components/TasksView.tsx` | `reloadPermissions()` on mount for stale-cache mitigation. |

---

## 4. Database changes (already applied)

Applied in production via SQL the user ran manually. State verified:

- 8 permissions inserted
- 14 role_permissions inserted (no duplicates created — used `WHERE NOT EXISTS` due to lack of UNIQUE constraint)

```
admin            → bulk_shift, edit.scope.all, edit.scope.own
department_head  → bulk_shift, edit.scope.department, edit.scope.own, tabs.view.department
project_manager  → edit.scope.managed_projects, edit.scope.own
subdivision_head → edit.scope.own, edit.scope.subdivision
team_lead        → edit.scope.own, edit.scope.team, tabs.view.department
user             → edit.scope.own, tabs.view.department
```

No schema migrations beyond the role_permissions inserts. No view changes (existing `view_employee_workloads`, `view_departments_sections_loadings` already expose the necessary `final_team_id`, `final_department_id`, `responsible_department_id` fields).

---

## 5. Server-side details

### 5.1. `getFilterContextForTasksTabs`

Wraps existing `getFilterContext()`. If user has `tasks.tabs.view.department` AND scope.level === 'team' AND ownDepartmentId is set, locally overrides scope to `{ level: 'department', departmentIds: [ownDepartmentId], teamIds: undefined }`. All other branches preserved.

Used in `getSectionsHierarchy` and `getDepartmentsData` instead of `getFilterContext` directly.

### 5.2. `canEditLoading(loading, ctx)` — pure function

```
return ctx.has('loadings.edit.scope.all')
    || (ctx.has('loadings.edit.scope.subdivision') && loading.subdivisionId === ctx.ownSubdivisionId)
    || (ctx.has('loadings.edit.scope.department')   && loading.departmentId   === ctx.ownDepartmentId)
    || (ctx.has('loadings.edit.scope.team')         && loading.teamId         === ctx.ownTeamId)
    || (ctx.has('loadings.edit.scope.managed_projects') && ctx.managedProjectIds.includes(loading.projectId))
    || (ctx.has('loadings.edit.scope.own')          && loading.responsibleId  === ctx.userId)
```

Identical implementation runs on server (in actions) and client (in `useCanEditLoading`).

### 5.3. `assertCanEditLoading(loadingId)` server helper

1. Parallel: `getFilterContext()` + select `(user_id, final_team_id, final_department_id, project_id)` from `view_employee_workloads` by `loading_id`
2. Resolve subdivision via `departments` table (small extra query)
3. Call `canEditLoading(loading, ctx)`. If false → return `{ success: false, error: 'Нет прав на редактирование загрузки' }`
4. On success returns `{ loading, ctx }` for downstream use without re-fetch

### 5.4. Cross-dept enforcement in `updateSectionLoading`

After `assertCanEditLoading`:
1. If `isRestrictedToOwnDepartment(ctx)`:
   - If input.employeeId provided AND differs from old responsible → fetch new employee's department_id, must equal `oldLoading.departmentId`
   - If input.stageId provided → resolve stage → section → section's `responsible_department_id`, must equal `oldLoading.departmentId`
2. Existing validations (dates, rate, stage→section linkage) unchanged
3. UPDATE proceeds

`createSectionLoading`:
1. Build future LoadingPermissionContext (responsible's profile + section's project/responsible_dept)
2. `canEditLoading(future, ctx)` must return true
3. If `isRestrictedToOwnDepartment(ctx)` → section's responsible_department_id must equal future loading's department_id
4. Existing validations + INSERT

`deleteSectionLoading`, `updateLoadingDates`, `splitSectionLoading`: just add `assertCanEditLoading(loadingId)` at the start.

`bulkShiftLoadings`: gate via `canBulkShiftDepartment(input.departmentId, ctx)`.

### 5.5. Stale-cache fallback

If `ctx.permissions` contains none of the 6 `loadings.edit.scope.*` keys, `canEditLoading` returns `true` with a Sentry breadcrumb. Defense: RLS still applies. Lifespan: only until users reload after deploy.

---

## 6. Client-side details

### 6.1. New hooks

`modules/permissions/hooks/use-can-edit-loading.ts` exports:
- `useCanEditLoading(loading | null) → boolean`
- `useCanBulkShiftDepartment(departmentId | null) → boolean`
- `useIsRestrictedToOwnDepartment() → boolean`

All three read from `useFilterContext()` (already cached, 10min staleTime). Zero new requests.

### 6.2. UI gating points

| Component | Element | Gating |
|---|---|---|
| `sections-page/components/rows/EmployeeRow.tsx` | "Создать загрузку" button | `useCanEditLoading({ responsibleId: employee.id, teamId, departmentId, ... })` |
| `sections-page/components/rows/ObjectSectionRow.tsx` | "Добавить загрузку" button | hidden if no `loadings.edit.scope.*` at all |
| `departments-timeline/components/timeline/EmployeeRow.tsx` | drag-handles, scissors, "Создать" | per-loading `useCanEditLoading` |
| `departments-timeline/components/timeline/DepartmentRow.tsx` | BulkShift popover | `useCanBulkShiftDepartment(department.id)` |
| Loading bar onClick | always opens modal | modal switches to read-only mode if `!canEdit` |

### 6.3. Subdivision shortcut

On the client, Loading metadata typically lacks `subdivisionId` (not in `Employee` type). For users with `loadings.edit.scope.subdivision`, `useCanEditLoading` returns `true` optimistically when `loading.subdivisionId` is `null`. Server check enforces correctness on mutation.

Optional future improvement: extend `view_employee_workloads` with `final_subdivision_id`. Out of scope.

### 6.4. Stale-cache mitigation

`TasksView` calls `reloadPermissions()` on mount. Refreshes the Zustand permissions cache with new keys after deploy.

### 6.5. Read-only modal mode

`LoadingModalNewContainer` computes `isReadOnly = (mode === 'edit') ? !canEditExisting : false` and passes to `LoadingModalNew`. The modal:
- Title: "Просмотр загрузки" with hint "У вас нет прав на изменение этой загрузки"
- All form inputs `disabled`
- ProjectTree section selection disabled
- Footer: only "Закрыть" button — no save, no delete

For create mode: if user lacks edit rights for chosen employee, save button disabled.

### 6.6. Cross-dept restriction in modal selectors

For `isRestrictedToOwnDepartment(ctx) === true`:
- Employee selector → filter `useUsers({ departmentId: ownDepartmentId })`
- Section / Project tree → mandatory `department_id = ownDepartmentId` filter in the data action that powers `ProjectTree`

Server check is the final gate; client filtering is purely UX.

---

## 7. Edge cases & monitoring

### 7.1. Edge cases handled

| Case | Handling |
|---|---|
| User without department | `getFilterContextForTasksTabs` does NOT expand scope (checks `hasOwnDept`). User sees nothing. |
| User with multiple roles | Permissions are unioned. `canEditLoading` OR-logic covers any combination. |
| Loading without team/dept (legacy) | Restricted-role checks fail (null match); `own` check by responsibleId still works. |
| Concurrent reassignment during edit | `assertCanEditLoading` reads fresh state at mutation time → blocks if no longer authorized. |
| Stale permissions cache after deploy | Server fallback allows mutation (RLS protects); client refresh on `/tasks` mount within seconds. |
| Subdivision_head with `subdivisionId=null` on client | Optimistic UI; server gate enforces. |

### 7.2. Sentry monitoring

`assertCanEditLoading` adds breadcrumb on denial with `userId`, `loadingId`, dept IDs, and the user's `loadings.*` permissions. Used to detect false negatives or bypass attempts.

---

## 8. Testing plan

### 8.1. Manual test matrix

For each of the 6 roles, run on both tabs:

| # | Scenario | user | team_lead | dept_head | sub_head | admin | PM |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|
| V1 | Sees whole own department on Sections | ✅ | ✅ | ✅ | ✅ | ✅ | (project scope) |
| V2 | Sees whole own department on Departments | ✅ | ✅ | ✅ | ✅ | ✅ | (project scope) |
| E1 | Edits own loading | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| E2 | Edits same-team colleague's loading | ❌ | ✅ | ✅ | ✅ | ✅ | — |
| E3 | Edits same-dept different-team loading | ❌ | ❌ | ✅ | ✅ | ✅ | — |
| E4 | Edits foreign-dept loading | ❌ | ❌ | ❌ | ✅ | ✅ | (if PM) |
| C1 | Creates own loading | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| C2 | Creates loading for teammate | ❌ | ✅ | ✅ | ✅ | ✅ | — |
| C3 | Cannot move loading to foreign-dept employee | ✅ blocked | ✅ blocked | ✅ blocked | (no check) | (no check) | (no check) |
| C4 | Cannot move loading to foreign-dept section | ✅ blocked | ✅ blocked | ✅ blocked | (no check) | (no check) | (no check) |
| B1 | Sees BulkShift button on department | ❌ | ❌ | ✅ (own) | ❌ | ✅ (any) | ❌ |
| R1 | Foreign loading click → read-only modal | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| R2 | Read-only modal: no save/delete buttons | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

### 8.2. Regression checks

- Resource Graph (`/planning`) unchanged
- Kanban tab on `/tasks` unchanged
- `/dashboard/dev/tasks` modals unchanged
- RLS on `loadings` table unchanged
- BulkShift for admin works on any department
- Restricted projects still hidden from non-admins
- Capacity edit (`sections.capacity.edit`) unchanged

### 8.3. Smoke test (pre-deploy)

```
1. Login as user → /tasks → Sections
   - [ ] Sees whole own department, multiple teams visible
   - [ ] Drag-handles only on own loadings
   - [ ] Click on foreign loading → read-only modal
   - [ ] "Create" button only on own row

2. Login as team_lead → /tasks → Departments
   - [ ] Drag-handles on own team's loadings
   - [ ] No drag-handles on other teams in same dept
   - [ ] No BulkShift button

3. Login as department_head → /tasks → Departments
   - [ ] Drag-handles on all loadings in own dept
   - [ ] BulkShift button visible, works
   - [ ] No drag-handles on foreign depts

4. Login as admin → existing functionality intact
```

### 8.4. Documentation deliverables

- `docs/testing/role-based-loadings-permissions.md` — full QA checklist (8.1+8.2+8.3)
- `modules/permissions/README.md` — add a section documenting `loadings.edit.scope.*`, `loadings.bulk_shift.department`, `tasks.tabs.view.department` and the role matrix
- `modules/sections-page/module.meta.json` and `modules/departments-timeline/module.meta.json` — add new permissions to `permissions[]`
- README updates for `sections-page` and `departments-timeline` modules

---

## 9. Open questions / assumptions

- **Old `LoadingModalContainer` (loading-edit / loading-create types)**: legacy modal still in code. Out of scope. If still used somewhere, server-side gate prevents data damage; UI may stay in old behavior. Cleanup is a separate ticket.
- **Realtime auto-refresh of permissions on role change**: not implemented. User must reload (or wait for `/tasks` mount-refresh) to pick up new permissions. Acceptable for current scope.
- **`final_subdivision_id` in `view_employee_workloads`**: not added; client uses optimistic UI for subdivision_head. Optional future improvement.

---

## 10. Rollout

1. **DB migration** — already applied
2. **Code deploy** — backwards compatible: old code on prod ignores new permission keys; new code falls back to allow-on-stale-cache
3. **Smoke test on staging** before merge to main
4. **Post-deploy validation** — run smoke tests on production, monitor Sentry for `canEditLoading: denied` breadcrumbs
