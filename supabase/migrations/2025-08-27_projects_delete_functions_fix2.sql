begin;

-- Удаляем предыдущие версии для чистоты
drop function if exists public.get_project_delete_stats(uuid);
drop function if exists public.safe_delete_project(uuid);

-- Универсальная функция статистики (учитывает разные имена колонок)
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
  v_tmp bigint;
  has_tasks boolean := to_regclass('public.tasks') is not null;
  has_loadings boolean := to_regclass('public.loadings') is not null;
  has_assignments boolean := to_regclass('public.assignments') is not null;
  has_contracts boolean := to_regclass('public.contracts') is not null;
  has_decomp_items boolean := to_regclass('public.decomposition_items') is not null;
  has_decompositions boolean := to_regclass('public.decompositions') is not null;
  has_objects boolean := to_regclass('public.objects') is not null;
  has_stages boolean := to_regclass('public.stages') is not null;
  has_sections boolean := to_regclass('public.sections') is not null;
  tasks_col_section_id boolean := exists (select 1 from information_schema.columns where table_schema='public' and table_name='tasks' and column_name='task_section_id');
  tasks_col_parent_section boolean := exists (select 1 from information_schema.columns where table_schema='public' and table_name='tasks' and column_name='task_parent_section');
  loadings_col_section_id boolean := exists (select 1 from information_schema.columns where table_schema='public' and table_name='loadings' and column_name='loading_section_id');
  loadings_col_section boolean := exists (select 1 from information_schema.columns where table_schema='public' and table_name='loadings' and column_name='loading_section');
  assignments_col_section_id boolean := exists (select 1 from information_schema.columns where table_schema='public' and table_name='assignments' and column_name='assignment_section_id');
  assignments_cols_from_to boolean := exists (select 1 from information_schema.columns where table_schema='public' and table_name='assignments' and column_name='from_section_id');
begin
  if not has_stages or not has_objects or not has_sections then
    return query select 0::bigint,0::bigint,0::bigint,0::bigint,0::bigint,0::bigint,0::bigint,0::bigint;
  end if;

  select coalesce(array_agg(s.stage_id), array[]::uuid[]) into v_stages_ids
  from public.stages s
  where s.stage_project_id = project_id_param;

  select coalesce(array_agg(sec.section_id), array[]::uuid[]) into v_sections_ids
  from public.sections sec
  where sec.section_project_id = project_id_param;

  -- stages
  select count(*) into stages_count from public.stages s where s.stage_project_id = project_id_param;

  -- objects: по проекту или по стадиям
  select count(*) into objects_count from public.objects o
   where (o.object_project_id = project_id_param)
      or (cardinality(v_stages_ids) > 0 and o.object_stage_id = any(v_stages_ids));

  -- sections
  select count(*) into sections_count from public.sections sec where sec.section_project_id = project_id_param;

  -- tasks
  tasks_count := 0;
  if has_tasks and cardinality(v_sections_ids) > 0 then
    if tasks_col_section_id then
      execute 'select count(*) from public.tasks where task_section_id = any($1)' into v_tmp using v_sections_ids;
      tasks_count := coalesce(v_tmp,0);
    elsif tasks_col_parent_section then
      execute 'select count(*) from public.tasks where task_parent_section = any($1)' into v_tmp using v_sections_ids;
      tasks_count := coalesce(v_tmp,0);
    end if;
  end if;

  -- loadings
  loadings_count := 0;
  if has_loadings and cardinality(v_sections_ids) > 0 then
    if loadings_col_section_id then
      execute 'select count(*) from public.loadings where loading_section_id = any($1)' into v_tmp using v_sections_ids;
      loadings_count := coalesce(v_tmp,0);
    elsif loadings_col_section then
      execute 'select count(*) from public.loadings where loading_section = any($1)' into v_tmp using v_sections_ids;
      loadings_count := coalesce(v_tmp,0);
    end if;
  end if;

  -- assignments
  assignments_count := 0;
  if has_assignments and cardinality(v_sections_ids) > 0 then
    if assignments_col_section_id then
      execute 'select count(*) from public.assignments where assignment_section_id = any($1)' into v_tmp using v_sections_ids;
      assignments_count := coalesce(v_tmp,0);
    elsif assignments_cols_from_to then
      execute 'select count(*) from public.assignments where from_section_id = any($1) or to_section_id = any($1)'
        into v_tmp using v_sections_ids;
      assignments_count := coalesce(v_tmp,0);
    end if;
  end if;

  -- contracts
  contracts_count := 0;
  if has_contracts then
    select count(*) into contracts_count from public.contracts c where c.project_id = project_id_param;
  end if;

  -- decomposition
  decompositions_count := 0;
  if has_decomp_items and cardinality(v_sections_ids) > 0 then
    select count(*) into decompositions_count from public.decomposition_items di where di.decomposition_item_section_id = any(v_sections_ids);
  elsif has_decompositions and cardinality(v_sections_ids) > 0 then
    select count(*) into decompositions_count from public.decompositions d where d.decomposition_section_id = any(v_sections_ids);
  end if;

  return next;
end;
$$;

grant execute on function public.get_project_delete_stats(uuid) to anon, authenticated, service_role;

-- Универсальная функция безопасного удаления
create or replace function public.safe_delete_project(project_id_param uuid)
returns table (success boolean, message text, deleted_counts jsonb)
language plpgsql security definer set search_path = public as $$
declare
  v_stages_ids uuid[] := array[]::uuid[];
  v_objects_ids uuid[] := array[]::uuid[];
  v_sections_ids uuid[] := array[]::uuid[];
  v_deleted jsonb := '{}'::jsonb;
  v_cnt bigint := 0;
  has_tasks boolean := to_regclass('public.tasks') is not null;
  has_loadings boolean := to_regclass('public.loadings') is not null;
  has_assignments boolean := to_regclass('public.assignments') is not null;
  has_contracts boolean := to_regclass('public.contracts') is not null;
  has_decomp_items boolean := to_regclass('public.decomposition_items') is not null;
  has_decompositions boolean := to_regclass('public.decompositions') is not null;
  tasks_col_section_id boolean := exists (select 1 from information_schema.columns where table_schema='public' and table_name='tasks' and column_name='task_section_id');
  tasks_col_parent_section boolean := exists (select 1 from information_schema.columns where table_schema='public' and table_name='tasks' and column_name='task_parent_section');
  loadings_col_section_id boolean := exists (select 1 from information_schema.columns where table_schema='public' and table_name='loadings' and column_name='loading_section_id');
  loadings_col_section boolean := exists (select 1 from information_schema.columns where table_schema='public' and table_name='loadings' and column_name='loading_section');
  assignments_col_section_id boolean := exists (select 1 from information_schema.columns where table_schema='public' and table_name='assignments' and column_name='assignment_section_id');
  assignments_cols_from_to boolean := exists (select 1 from information_schema.columns where table_schema='public' and table_name='assignments' and column_name='from_section_id');
begin
  select coalesce(array_agg(s.stage_id), array[]::uuid[]) into v_stages_ids from public.stages s where s.stage_project_id = project_id_param;
  select coalesce(array_agg(o.object_id), array[]::uuid[]) into v_objects_ids from public.objects o
    where (o.object_project_id = project_id_param) or (cardinality(v_stages_ids) > 0 and o.object_stage_id = any(v_stages_ids));
  select coalesce(array_agg(sec.section_id), array[]::uuid[]) into v_sections_ids from public.sections sec where sec.section_project_id = project_id_param;

  -- decomposition
  if has_decomp_items and cardinality(v_sections_ids) > 0 then
    delete from public.decomposition_items di where di.decomposition_item_section_id = any(v_sections_ids);
    get diagnostics v_cnt = row_count; v_deleted := v_deleted || jsonb_build_object('decomposition_items', v_cnt);
  elsif has_decompositions and cardinality(v_sections_ids) > 0 then
    delete from public.decompositions d where d.decomposition_section_id = any(v_sections_ids);
    get diagnostics v_cnt = row_count; v_deleted := v_deleted || jsonb_build_object('decompositions', v_cnt);
  end if;

  -- loadings
  if has_loadings and cardinality(v_sections_ids) > 0 then
    if loadings_col_section_id then
      execute 'delete from public.loadings where loading_section_id = any($1)' using v_sections_ids;
    elsif loadings_col_section then
      execute 'delete from public.loadings where loading_section = any($1)' using v_sections_ids;
    end if;
    get diagnostics v_cnt = row_count; v_deleted := v_deleted || jsonb_build_object('loadings', coalesce(v_cnt,0));
  end if;

  -- assignments
  if has_assignments then
    if assignments_col_section_id and cardinality(v_sections_ids) > 0 then
      execute 'delete from public.assignments where assignment_section_id = any($1)' using v_sections_ids;
      get diagnostics v_cnt = row_count; v_deleted := v_deleted || jsonb_build_object('assignments', coalesce(v_cnt,0));
    elsif assignments_cols_from_to and cardinality(v_sections_ids) > 0 then
      execute 'delete from public.assignments where from_section_id = any($1) or to_section_id = any($1)' using v_sections_ids;
      get diagnostics v_cnt = row_count; v_deleted := v_deleted || jsonb_build_object('assignments', coalesce(v_cnt,0));
    end if;
  end if;

  -- tasks
  if has_tasks and cardinality(v_sections_ids) > 0 then
    if tasks_col_section_id then
      execute 'delete from public.tasks where task_section_id = any($1)' using v_sections_ids;
    elsif tasks_col_parent_section then
      execute 'delete from public.tasks where task_parent_section = any($1)' using v_sections_ids;
    end if;
    get diagnostics v_cnt = row_count; v_deleted := v_deleted || jsonb_build_object('tasks', coalesce(v_cnt,0));
  end if;

  -- sections
  if cardinality(v_sections_ids) > 0 then
    delete from public.sections sec where sec.section_id = any(v_sections_ids);
    get diagnostics v_cnt = row_count; v_deleted := v_deleted || jsonb_build_object('sections', coalesce(v_cnt,0));
  end if;

  -- objects
  if cardinality(v_objects_ids) > 0 then
    delete from public.objects o where o.object_id = any(v_objects_ids);
    get diagnostics v_cnt = row_count; v_deleted := v_deleted || jsonb_build_object('objects', coalesce(v_cnt,0));
  end if;

  -- stages
  if cardinality(v_stages_ids) > 0 then
    delete from public.stages s where s.stage_id = any(v_stages_ids);
    get diagnostics v_cnt = row_count; v_deleted := v_deleted || jsonb_build_object('stages', coalesce(v_cnt,0));
  end if;

  -- contracts
  if has_contracts then
    delete from public.contracts c where c.project_id = project_id_param;
    get diagnostics v_cnt = row_count; v_deleted := v_deleted || jsonb_build_object('contracts', coalesce(v_cnt,0));
  end if;

  -- project
  delete from public.projects p where p.project_id = project_id_param;
  get diagnostics v_cnt = row_count; v_deleted := v_deleted || jsonb_build_object('projects', coalesce(v_cnt,0));

  return query select true, 'Проект и связанные данные удалены'::text, v_deleted;
exception when others then
  return query select false, ('Ошибка при удалении проекта: ' || sqlerrm)::text, v_deleted;
end;
$$;

grant execute on function public.safe_delete_project(uuid) to anon, authenticated, service_role;

commit;


