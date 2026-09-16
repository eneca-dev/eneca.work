-- Allow a subdivision head with Employment Board permission to access every
-- department belonging to that subdivision. No business rows are changed.

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
            or exists (
              select 1
              from public.departments d
              join public.subdivisions s on s.subdivision_id = d.subdivision_id
              where d.department_id = p_department_id
                and s.subdivision_head_id = (select auth.uid())
            )
          )
        )
      )
  );
$$;
