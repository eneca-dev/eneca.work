-- ============================================================================
-- Отчёт по задачам Worksection
-- Таблица наполняется отдельной синхронизацией (ws-to-work/task-report).
-- Ничего существующего не изменяется — только новые объекты.
-- См. docs/ws-task-report-plan.md
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Персональный доступ к отчёту
--    Право нужно конкретным людям, а не роли, поэтому список персональный.
-- ----------------------------------------------------------------------------
create table public.ws_task_report_access (
  user_id uuid primary key references public.profiles(user_id) on delete cascade
);

comment on table public.ws_task_report_access is
  'Персональный доступ к отчёту по задачам Worksection. Добавить человека = insert.';

alter table public.ws_task_report_access enable row level security;

-- Каждый видит ТОЛЬКО свою строку:
--  1) список тех, у кого есть доступ, не утекает наружу
--  2) подзапрос в политике ws_task_report работает без SECURITY DEFINER,
--     т.к. политика разрешает ровно ту строку, которую он ищет
create policy ws_task_report_access_select
  on public.ws_task_report_access
  for select to authenticated
  using (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 2. Данные отчёта (грейн = задача 3-го уровня Worksection)
-- ----------------------------------------------------------------------------
create table public.ws_task_report (
  ws_task_id        text primary key,
  ws_task_name      text not null,
  ws_object_id      text,
  ws_object_name    text,
  ws_section_id     text,
  ws_section_name   text,
  ws_project_id     text not null,
  ws_project_name   text,
  responsible_email text,
  responsible_name  text,
  department        text,
  ws_status         text not null,
  date_added        timestamptz,
  date_closed       timestamptz,
  total_hours       numeric(10,2) not null default 0,
  total_money       numeric(14,2) not null default 0,
  planned_budget    numeric(14,2),
  synced_at         timestamptz not null default now()
);

comment on table  public.ws_task_report is
  'Снимок задач 3-го уровня Worksection для отчёта. Пишет только синхронизация (service_role).';
comment on column public.ws_task_report.ws_task_id     is 'ID задачи 3-го уровня в Worksection';
comment on column public.ws_task_report.department     is 'Отдел из WS group по маппингу 16 отделов; null = группа не замаплена';
comment on column public.ws_task_report.ws_status      is 'Статус задачи в Worksection: active | done';
comment on column public.ws_task_report.date_added     is 'Дата открытия задачи (WS date_added)';
comment on column public.ws_task_report.date_closed    is 'Дата закрытия задачи (WS date_closed)';
comment on column public.ws_task_report.planned_budget is 'Плановый бюджет из WS max_money; null = не задан';
comment on column public.ws_task_report.total_money    is 'Сумма отчётов в BYN по ставке исполнителя (WS cost.money)';

create index ws_task_report_department_idx on public.ws_task_report (department);
create index ws_task_report_status_idx     on public.ws_task_report (ws_status);

-- Свежесть данных: страница берёт max(synced_at) отдельным запросом на каждую
-- смену фильтра. Без индекса это seq scan с сортировкой по всей таблице.
create index if not exists ws_task_report_synced_at_idx
  on public.ws_task_report (synced_at desc);

alter table public.ws_task_report enable row level security;

-- Чтение — только тем, кто есть в ws_task_report_access.
-- Политик на insert/update/delete нет: пишет синхронизация через service_role,
-- который RLS обходит.
create policy ws_task_report_select
  on public.ws_task_report
  for select to authenticated
  using (
    exists (
      select 1 from public.ws_task_report_access a
      where a.user_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- 3. Выдача доступа
-- ----------------------------------------------------------------------------
insert into public.ws_task_report_access (user_id)
values ('21e83443-be88-4653-87af-b5e4f2d4ed0b')  -- Дмитрий Голиков
on conflict (user_id) do nothing;
