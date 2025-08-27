begin;

-- Пересоздать функцию статистики с security definer и гарантированным возвратом строки
drop function if exists public.get_project_delete_stats(uuid);

create or replace function public.get_project_delete_stats(project_id_param uuid)
returns table (
  stages_count bigint,
  objects_count bigint,
  sections_count bigint,
  tasks_count bigint,
  loadings_count bigint,
  assignments_count bigint,
  contracts_count bigint,
  decompositions_count bigint
) language plpgsql security definer set search_path = public as $$
declare
  v_sections_ids uuid[] := array[]::uuid[];
  v_stages_ids uuid[] := array[]::uuid[];
  v_stages bigint := 0;
  v_objects bigint := 0;
  v_sections bigint := 0;
  v_tasks bigint := 0;
  v_loadings bigint := 0;
  v_assignments bigint := 0;
  v_contracts bigint := 0;
  v_decomp bigint := 0;
  v_has_tasks boolean := to_regclass('public.tasks') is not null;
  v_has_loadings boolean := to_regclass('public.loadings') is not null;
  v_has_assign boolean := to_regclass('public.object_assignments') is not null;
  v_has_contracts boolean := to_regclass('public.contracts') is not null;
  v_has_decomp boolean := to_regclass('public.decomposition_items') is not null;
begin
  select coalesce(array_agg(s.stage_id), array[]::uuid[]) into v_stages_ids
  from public.stages s
  where s.stage_project_id = project_id_param;

  select coalesce(array_agg(sec.section_id), array[]::uuid[]) into v_sections_ids
  from public.sections sec
  where sec.section_project_id = project_id_param;

  select count(*) into v_stages from public.stages s where s.stage_project_id = project_id_param;

  select count(*) into v_objects
  from public.objects o
  where (o.object_project_id = project_id_param)
     or (cardinality(v_stages_ids) > 0 and o.object_stage_id = any(v_stages_ids));

  select count(*) into v_sections from public.sections sec where sec.section_project_id = project_id_param;

  if v_has_tasks and cardinality(v_sections_ids) > 0 then
    select count(*) into v_tasks from public.tasks t where t.task_section_id = any(v_sections_ids);
  end if;

  if v_has_loadings and cardinality(v_sections_ids) > 0 then
    select count(*) into v_loadings from public.loadings l where l.loading_section = any(v_sections_ids);
  end if;

  if v_has_assign then
    select count(*) into v_assignments
    from public.object_assignments oa
    where oa.assignment_object_id in (
      select o.object_id from public.objects o
      where (o.object_project_id = project_id_param)
         or (cardinality(v_stages_ids) > 0 and o.object_stage_id = any(v_stages_ids))
    );
  end if;

  if v_has_contracts then
    select count(*) into v_contracts from public.contracts c where c.project_id = project_id_param;
  end if;

  if v_has_decomp and cardinality(v_sections_ids) > 0 then
    select count(*) into v_decomp from public.decomposition_items di where di.decomposition_item_section_id = any(v_sections_ids);
  end if;

  return query select
    coalesce(v_stages, 0) as stages_count,
    coalesce(v_objects, 0) as objects_count,
    coalesce(v_sections, 0) as sections_count,
    coalesce(v_tasks, 0) as tasks_count,
    coalesce(v_loadings, 0) as loadings_count,
    coalesce(v_assignments, 0) as assignments_count,
    coalesce(v_contracts, 0) as contracts_count,
    coalesce(v_decomp, 0) as decompositions_count;
end;
$$;

grant execute on function public.get_project_delete_stats(uuid) to anon, authenticated, service_role;

commit;


