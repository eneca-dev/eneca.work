-- Secure Employment Board tables and publish their changes for Supabase Realtime.
-- No business data is changed or deleted by this migration.

-- Centralize the same department-level access rule used by Employment Board
-- Server Actions. A SECURITY DEFINER helper avoids exposing role tables through
-- their own RLS policies and is callable only by authenticated requests.
create or replace function public.can_access_employment_board(
  p_department_id uuid,
  p_required_permission text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles self
    where self.user_id = (select auth.uid())
      and (
        -- Administrators may access every department.
        exists (
          select 1
          from public.user_roles ur
          join public.roles r on r.id = ur.role_id
          where ur.user_id = (select auth.uid())
            and r.name = 'admin'
        )
        or (
          exists (
            select 1
            from public.user_roles ur
            join public.role_permissions rp on rp.role_id = ur.role_id
            join public.permissions permission on permission.id = rp.permission_id
            where ur.user_id = (select auth.uid())
              and permission.name = p_required_permission
          )
          and (
            self.department_id = p_department_id
            or exists (
              select 1
              from public.departments d
              where d.department_id = p_department_id
                and d.department_head_id = (select auth.uid())
            )
          )
        )
      )
  );
$$;

revoke all on function public.can_access_employment_board(uuid, text) from public;
grant execute on function public.can_access_employment_board(uuid, text) to authenticated;

-- Replace permissive policies (USING/WITH CHECK true) with department-scoped
-- policies. Server Actions keep using the caller's session and therefore are
-- protected by exactly the same rule as direct Data API access.
drop policy if exists department_pinned_projects_select on public.department_pinned_projects;
drop policy if exists department_pinned_projects_insert on public.department_pinned_projects;
drop policy if exists department_pinned_projects_delete on public.department_pinned_projects;

create policy department_pinned_projects_select
on public.department_pinned_projects
for select to authenticated
using (public.can_access_employment_board(department_id, 'employment_board.view'));

create policy department_pinned_projects_insert
on public.department_pinned_projects
for insert to authenticated
with check (public.can_access_employment_board(department_id, 'employment_board.edit'));

create policy department_pinned_projects_delete
on public.department_pinned_projects
for delete to authenticated
using (public.can_access_employment_board(department_id, 'employment_board.edit'));

drop policy if exists department_board_placements_select on public.department_board_placements;
drop policy if exists department_board_placements_insert on public.department_board_placements;
drop policy if exists department_board_placements_delete on public.department_board_placements;

create policy department_board_placements_select
on public.department_board_placements
for select to authenticated
using (public.can_access_employment_board(department_id, 'employment_board.view'));

create policy department_board_placements_insert
on public.department_board_placements
for insert to authenticated
with check (public.can_access_employment_board(department_id, 'employment_board.edit'));

create policy department_board_placements_delete
on public.department_board_placements
for delete to authenticated
using (public.can_access_employment_board(department_id, 'employment_board.edit'));

-- Idempotently publish board mutations. RLS above is evaluated before events
-- are delivered to a Realtime subscriber.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'department_pinned_projects'
  ) then
    alter publication supabase_realtime add table public.department_pinned_projects;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'department_board_placements'
  ) then
    alter publication supabase_realtime add table public.department_board_placements;
  end if;
end;
$$;
