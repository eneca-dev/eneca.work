-- Создание/обновление функций: статистика и безопасное удаление проекта
-- Цель: корректные подсчёты (особенно объектов) и устранение ошибки
-- "column reference \"project_name\" is ambiguous" при удалении

begin;

-- На случай, если функции уже существуют с другим сигнатурным типом
drop function if exists public.get_project_delete_stats(uuid);
drop function if exists public.safe_delete_project(uuid);

-- Функция статистики для модалки удаления
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
) language plpgsql stable as $$
declare
  v_sections_ids uuid[];
  v_stages_ids uuid[];
  v_tasks_table_exists boolean := to_regclass('public.tasks') is not null;
  v_loadings_table_exists boolean := to_regclass('public.loadings') is not null;
  v_assign_table_exists boolean := to_regclass('public.object_assignments') is not null;
  v_contracts_table_exists boolean := to_regclass('public.contracts') is not null;
  v_decomp_items_table_exists boolean := to_regclass('public.decomposition_items') is not null;
begin
  -- Собираем ID стадий и разделов проекта
  select array_agg(s.stage_id) filter (where s.stage_id is not null)
  into v_stages_ids
  from public.stages s
  where s.stage_project_id = project_id_param;

  select array_agg(sec.section_id) filter (where sec.section_id is not null)
  into v_sections_ids
  from public.sections sec
  where sec.section_project_id = project_id_param;

  -- Стадии
  select count(*) into stages_count from public.stages s where s.stage_project_id = project_id_param;

  -- Объекты: возможна как прямая связь с проектом, так и через stage
  select count(*) into objects_count
  from public.objects o
  where (o.object_project_id = project_id_param)
     or (v_stages_ids is not null and o.object_stage_id = any(v_stages_ids));

  -- Разделы
  select count(*) into sections_count from public.sections sec where sec.section_project_id = project_id_param;

  -- Задачи (опционально)
  if v_tasks_table_exists then
    select count(*) into tasks_count
    from public.tasks t
    where t.task_section_id = any(coalesce(v_sections_ids, array[]::uuid[]));
  else
    tasks_count := 0;
  end if;

  -- Загрузки (опционально)
  if v_loadings_table_exists then
    select count(*) into loadings_count
    from public.loadings l
    where l.loading_section = any(coalesce(v_sections_ids, array[]::uuid[]));
  else
    loadings_count := 0;
  end if;

  -- Передачи/назначения (опционально)
  if v_assign_table_exists then
    select count(*) into assignments_count
    from public.object_assignments oa
    where oa.assignment_object_id in (
      select o.object_id from public.objects o
      where (o.object_project_id = project_id_param)
         or (v_stages_ids is not null and o.object_stage_id = any(v_stages_ids))
    );
  else
    assignments_count := 0;
  end if;

  -- Договоры (опционально)
  if v_contracts_table_exists then
    select count(*) into contracts_count
    from public.contracts c where c.project_id = project_id_param;
  else
    contracts_count := 0;
  end if;

  -- Элементы декомпозиции (опционально)
  if v_decomp_items_table_exists then
    select count(*) into decompositions_count
    from public.decomposition_items di
    where di.decomposition_item_section_id = any(coalesce(v_sections_ids, array[]::uuid[]));
  else
    decompositions_count := 0;
  end if;

  return next;
end;
$$;

-- Функция безопасного удаления проекта и связанных сущностей
create or replace function public.safe_delete_project(project_id_param uuid)
returns table (success boolean, message text, deleted_counts jsonb)
language plpgsql security definer as $$
declare
  v_stages_ids uuid[];
  v_objects_ids uuid[];
  v_sections_ids uuid[];
  v_deleted jsonb := '{}'::jsonb;
  v_cnt bigint;
  v_has_tasks boolean := to_regclass('public.tasks') is not null;
  v_has_loadings boolean := to_regclass('public.loadings') is not null;
  v_has_assign boolean := to_regclass('public.object_assignments') is not null;
  v_has_contracts boolean := to_regclass('public.contracts') is not null;
  v_has_decomp boolean := to_regclass('public.decomposition_items') is not null;
begin
  -- Явные ID
  select array_agg(s.stage_id) into v_stages_ids from public.stages s where s.stage_project_id = project_id_param;
  select array_agg(o.object_id) into v_objects_ids from public.objects o
   where (o.object_project_id = project_id_param)
      or (v_stages_ids is not null and o.object_stage_id = any(v_stages_ids));
  select array_agg(sec.section_id) into v_sections_ids from public.sections sec where sec.section_project_id = project_id_param;

  -- Удаляем зависимые сущности в правильном порядке
  if v_has_decomp and v_sections_ids is not null then
    delete from public.decomposition_items di where di.decomposition_item_section_id = any(v_sections_ids);
    get diagnostics v_cnt = row_count; v_deleted := v_deleted || jsonb_build_object('decomposition_items', v_cnt);
  end if;

  if v_has_loadings and v_sections_ids is not null then
    delete from public.loadings l where l.loading_section = any(v_sections_ids);
    get diagnostics v_cnt = row_count; v_deleted := v_deleted || jsonb_build_object('loadings', v_cnt);
  end if;

  if v_has_assign and v_objects_ids is not null then
    delete from public.object_assignments oa where oa.assignment_object_id = any(v_objects_ids);
    get diagnostics v_cnt = row_count; v_deleted := v_deleted || jsonb_build_object('object_assignments', v_cnt);
  end if;

  if v_has_tasks and v_sections_ids is not null then
    delete from public.tasks t where t.task_section_id = any(v_sections_ids);
    get diagnostics v_cnt = row_count; v_deleted := v_deleted || jsonb_build_object('tasks', v_cnt);
  end if;

  if v_has_contracts then
    delete from public.contracts c where c.project_id = project_id_param;
    get diagnostics v_cnt = row_count; v_deleted := v_deleted || jsonb_build_object('contracts', v_cnt);
  end if;

  if v_sections_ids is not null then
    delete from public.sections sec where sec.section_id = any(v_sections_ids);
    get diagnostics v_cnt = row_count; v_deleted := v_deleted || jsonb_build_object('sections', v_cnt);
  end if;

  if v_objects_ids is not null then
    delete from public.objects o where o.object_id = any(v_objects_ids);
    get diagnostics v_cnt = row_count; v_deleted := v_deleted || jsonb_build_object('objects', v_cnt);
  end if;

  if v_stages_ids is not null then
    delete from public.stages s where s.stage_id = any(v_stages_ids);
    get diagnostics v_cnt = row_count; v_deleted := v_deleted || jsonb_build_object('stages', v_cnt);
  end if;

  -- И наконец проект
  delete from public.projects p where p.project_id = project_id_param;
  get diagnostics v_cnt = row_count; v_deleted := v_deleted || jsonb_build_object('projects', v_cnt);

  return query select true as success,
    'Проект и связанные данные удалены'::text as message,
    coalesce(v_deleted, '{}'::jsonb) as deleted_counts;
exception when others then
  return query select false as success,
    ('Ошибка при удалении проекта: ' || sqlerrm)::text as message,
    coalesce(v_deleted, '{}'::jsonb) as deleted_counts;
end;
$$;

-- Привилегии на вызов из клиента
grant execute on function public.get_project_delete_stats(uuid) to anon, authenticated, service_role;
grant execute on function public.safe_delete_project(uuid) to anon, authenticated, service_role;

commit;


