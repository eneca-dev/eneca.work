-- Project managers use the regular task views and must not access Employment Board.
-- This changes only the two role-permission links. The existing AFTER DELETE
-- trigger on role_permissions refreshes user_permissions_cache synchronously.

delete from public.role_permissions as rp
using public.roles as r, public.permissions as p
where rp.role_id = r.id
  and rp.permission_id = p.id
  and r.name = 'project_manager'
  and p.name in ('employment_board.view', 'employment_board.edit');
