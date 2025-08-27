-- Универсальные функции для безопасного каскадного удаления проекта и подсчёта статистики
-- Требования:
-- - Не использовать/добавлять RLS. Функции выполняются как security definer.
-- - Учитывать реальные названия колонок и таблиц из текущей схемы:
--   projects.project_id
--   stages.stage_project_id
--   objects.object_project_id | objects.object_stage_id
--   sections.section_project_id | sections.section_object_id
--   tasks.task_parent_section
--   loadings.loading_section
--   assignments.project_id | assignments.from_section_id | assignments.to_section_id
--   contracts.contract_project_id
--   section_comments.section_id
--   decomposition_items.decomposition_item_section_id
--   work_logs.decomposition_item_id

begin;

-- Чистим предыдущие версии
drop function if exists public.get_project_delete_stats(uuid);
drop function if exists public.safe_delete_project(uuid);

-- =====================================================================
-- Функция статистики для модалки удаления
-- =====================================================================
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
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_stages_ids   uuid[] := array[]::uuid[];
  v_sections_ids uuid[] := array[]::uuid[];
  v_tmp bigint;
begin
  -- stages
  select coalesce(array_agg(s.stage_id), array[]::uuid[])
  into v_stages_ids
  from public.stages s
  where s.stage_project_id = project_id_param;

  -- sections
  select coalesce(array_agg(sec.section_id), array[]::uuid[])
  into v_sections_ids
  from public.sections sec
  where sec.section_project_id = project_id_param;

  -- counts
  select count(*) into stages_count from public.stages s where s.stage_project_id = project_id_param;

  select count(*) into objects_count
  from public.objects o
  where (o.object_project_id = project_id_param)
     or (cardinality(v_stages_ids) > 0 and o.object_stage_id = any(v_stages_ids));

  select count(*) into sections_count from public.sections sec where sec.section_project_id = project_id_param;

  -- tasks
  tasks_count := 0;
  if cardinality(v_sections_ids) > 0 and to_regclass('public.tasks') is not null then
    execute 'select count(*) from public.tasks where task_parent_section = any($1)'
      into v_tmp using v_sections_ids;
    tasks_count := coalesce(v_tmp, 0);
  end if;

  -- loadings
  loadings_count := 0;
  if cardinality(v_sections_ids) > 0 and to_regclass('public.loadings') is not null then
    execute 'select count(*) from public.loadings where loading_section = any($1)'
      into v_tmp using v_sections_ids;
    loadings_count := coalesce(v_tmp, 0);
  end if;

  -- assignments (по проекту или по секциям from/to)
  assignments_count := 0;
  if to_regclass('public.assignments') is not null then
    select count(*) into assignments_count
    from public.assignments a
    where a.project_id = project_id_param
       or (cardinality(v_sections_ids) > 0 and (a.from_section_id = any(v_sections_ids) or a.to_section_id = any(v_sections_ids)));
  end if;

  -- contracts
  contracts_count := 0;
  if to_regclass('public.contracts') is not null then
    select count(*) into contracts_count from public.contracts c where c.contract_project_id = project_id_param;
  end if;

  -- decomposition_items
  decompositions_count := 0;
  if cardinality(v_sections_ids) > 0 and to_regclass('public.decomposition_items') is not null then
    select count(*) into decompositions_count from public.decomposition_items di where di.decomposition_item_section_id = any(v_sections_ids);
  end if;

  return next;
end;
$$;

grant execute on function public.get_project_delete_stats(uuid) to anon, authenticated, service_role;

-- =====================================================================
-- Функция безопасного каскадного удаления проекта
-- =====================================================================
create or replace function public.safe_delete_project(project_id_param uuid)
returns table (success boolean, message text, deleted_counts jsonb)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_deleted jsonb := '{}'::jsonb;
  v_cnt bigint := 0;

  v_stages_ids      uuid[] := array[]::uuid[];
  v_objects_ids     uuid[] := array[]::uuid[];
  v_sections_ids    uuid[] := array[]::uuid[];
  v_decomp_ids      uuid[] := array[]::uuid[];
  v_assignment_ids  uuid[] := array[]::uuid[];
begin
  -- Собираем ID верхнего уровня
  select coalesce(array_agg(s.stage_id), array[]::uuid[])
  into v_stages_ids
  from public.stages s
  where s.stage_project_id = project_id_param;

  select coalesce(array_agg(o.object_id), array[]::uuid[])
  into v_objects_ids
  from public.objects o
  where (o.object_project_id = project_id_param)
     or (cardinality(v_stages_ids) > 0 and o.object_stage_id = any(v_stages_ids));

  select coalesce(array_agg(sec.section_id), array[]::uuid[])
  into v_sections_ids
  from public.sections sec
  where sec.section_project_id = project_id_param;

  -- Комментарии к разделам
  if to_regclass('public.section_comments') is not null and cardinality(v_sections_ids) > 0 then
    delete from public.section_comments sc where sc.section_id = any(v_sections_ids);
    get diagnostics v_cnt = row_count; v_deleted := v_deleted || jsonb_build_object('section_comments', coalesce(v_cnt,0));
  end if;

  -- Плановые загрузки
  if to_regclass('public.plan_loadings') is not null and cardinality(v_sections_ids) > 0 then
    delete from public.plan_loadings pl where pl.plan_loading_section = any(v_sections_ids);
    get diagnostics v_cnt = row_count; v_deleted := v_deleted || jsonb_build_object('plan_loadings', coalesce(v_cnt,0));
  end if;

  -- Фактические загрузки
  if to_regclass('public.loadings') is not null and cardinality(v_sections_ids) > 0 then
    delete from public.loadings l where l.loading_section = any(v_sections_ids);
    get diagnostics v_cnt = row_count; v_deleted := v_deleted || jsonb_build_object('loadings', coalesce(v_cnt,0));
  end if;

  -- Assignments (аудит -> сами назначения). Берём все назначения по проекту или секциям
  if to_regclass('public.assignments') is not null then
    select coalesce(array_agg(a.assignment_id), array[]::uuid[])
    into v_assignment_ids
    from public.assignments a
    where a.project_id = project_id_param
       or (cardinality(v_sections_ids) > 0 and (a.from_section_id = any(v_sections_ids) or a.to_section_id = any(v_sections_ids)));

    if to_regclass('public.assignment_audit') is not null and cardinality(v_assignment_ids) > 0 then
      delete from public.assignment_audit aa where aa.assignment_id = any(v_assignment_ids);
      get diagnostics v_cnt = row_count; v_deleted := v_deleted || jsonb_build_object('assignment_audit', coalesce(v_cnt,0));
    end if;

    if cardinality(v_assignment_ids) > 0 then
      delete from public.assignments a where a.assignment_id = any(v_assignment_ids);
      get diagnostics v_cnt = row_count; v_deleted := v_deleted || jsonb_build_object('assignments', coalesce(v_cnt,0));
    end if;
  end if;

  -- Задачи (по секциям)
  if to_regclass('public.tasks') is not null and cardinality(v_sections_ids) > 0 then
    delete from public.tasks t where t.task_parent_section = any(v_sections_ids);
    get diagnostics v_cnt = row_count; v_deleted := v_deleted || jsonb_build_object('tasks', coalesce(v_cnt,0));
  end if;

  -- Work logs -> Decomposition items (сначала логи, затем сами элементы)
  if to_regclass('public.decomposition_items') is not null and cardinality(v_sections_ids) > 0 then
    select coalesce(array_agg(di.decomposition_item_id), array[]::uuid[])
    into v_decomp_ids
    from public.decomposition_items di
    where di.decomposition_item_section_id = any(v_sections_ids);

    if to_regclass('public.work_logs') is not null and cardinality(v_decomp_ids) > 0 then
      delete from public.work_logs wl where wl.decomposition_item_id = any(v_decomp_ids);
      get diagnostics v_cnt = row_count; v_deleted := v_deleted || jsonb_build_object('work_logs', coalesce(v_cnt,0));
    end if;

    if cardinality(v_decomp_ids) > 0 then
      delete from public.decomposition_items di where di.decomposition_item_id = any(v_decomp_ids);
      get diagnostics v_cnt = row_count; v_deleted := v_deleted || jsonb_build_object('decomposition_items', coalesce(v_cnt,0));
    end if;
  end if;

  -- Sections
  if cardinality(v_sections_ids) > 0 then
    delete from public.sections sec where sec.section_id = any(v_sections_ids);
    get diagnostics v_cnt = row_count; v_deleted := v_deleted || jsonb_build_object('sections', coalesce(v_cnt,0));
  end if;

  -- Objects
  if cardinality(v_objects_ids) > 0 then
    delete from public.objects o where o.object_id = any(v_objects_ids);
    get diagnostics v_cnt = row_count; v_deleted := v_deleted || jsonb_build_object('objects', coalesce(v_cnt,0));
  end if;

  -- Stages
  if cardinality(v_stages_ids) > 0 then
    delete from public.stages s where s.stage_id = any(v_stages_ids);
    get diagnostics v_cnt = row_count; v_deleted := v_deleted || jsonb_build_object('stages', coalesce(v_cnt,0));
  end if;

  -- Contracts
  if to_regclass('public.contracts') is not null then
    delete from public.contracts c where c.contract_project_id = project_id_param;
    get diagnostics v_cnt = row_count; v_deleted := v_deleted || jsonb_build_object('contracts', coalesce(v_cnt,0));
  end if;

  -- Наконец сам проект
  delete from public.projects p where p.project_id = project_id_param;
  get diagnostics v_cnt = row_count; v_deleted := v_deleted || jsonb_build_object('projects', coalesce(v_cnt,0));

  return query select true, 'Проект и все связанные данные удалены'::text, v_deleted;
exception when others then
  return query select false, ('Ошибка при удалении проекта: ' || sqlerrm)::text, v_deleted;
end;
$$;

grant execute on function public.safe_delete_project(uuid) to anon, authenticated, service_role;

commit;


