-- Project Charters schema (uставы проектов)
-- Safe to run multiple times (uses IF NOT EXISTS where possible)

-- Extensions
create extension if not exists pgcrypto;

-- Timestamp trigger to maintain updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =====================================================================
-- Main table: project_charters (шапка устава)
-- =====================================================================
create table if not exists public.project_charters (
  id uuid primary key default gen_random_uuid(),

  project_id uuid not null references public.projects(id) on delete cascade,
  direction_id uuid references public.directions(id), -- optional, if directions table exists
  manager_profile_id uuid references public.profiles(id),
  gip_profile_id uuid references public.profiles(id),

  project_code text not null,
  project_name text not null,

  customer_country_iso2 char(2),
  executor_country_iso2 char(2),
  contract_currency_code char(3) not null,

  contract_amount_gross numeric(14,2) not null check (contract_amount_gross >= 0),
  vat_rate_default numeric(5,2) check (vat_rate_default >= 0 and vat_rate_default <= 100),

  contractors_deduction_amount numeric(14,2) not null default 0 check (contractors_deduction_amount >= 0),
  direction_deduction_amount   numeric(14,2) not null default 0 check (direction_deduction_amount >= 0),
  software_deduction_amount    numeric(14,2) not null default 0 check (software_deduction_amount >= 0),

  management_reward_amount     numeric(14,2) not null default 0 check (management_reward_amount >= 0),
  development_reward_amount    numeric(14,2) not null default 0 check (development_reward_amount >= 0),
  bim_reward_amount            numeric(14,2) not null default 0 check (bim_reward_amount >= 0),

  payment_delay_days integer not null default 0 check (payment_delay_days >= 0),

  extra jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_project_charters_project_id on public.project_charters(project_id);
create index if not exists idx_project_charters_direction_id on public.project_charters(direction_id);
create index if not exists idx_project_charters_manager_id on public.project_charters(manager_profile_id);
create index if not exists idx_project_charters_gip_id on public.project_charters(gip_profile_id);

drop trigger if exists trg_project_charters_set_updated_at on public.project_charters;
create trigger trg_project_charters_set_updated_at
before update on public.project_charters
for each row execute function public.set_updated_at();

-- =====================================================================
-- Addenda: project_charter_addenda (доп. соглашения)
-- =====================================================================
create table if not exists public.project_charter_addenda (
  id uuid primary key default gen_random_uuid(),
  charter_id uuid not null references public.project_charters(id) on delete cascade,
  signed_at date not null,
  amount_delta_gross numeric(14,2) not null,
  currency_code char(3) not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_charter_addenda_charter_id on public.project_charter_addenda(charter_id);

drop trigger if exists trg_project_charter_addenda_set_updated_at on public.project_charter_addenda;
create trigger trg_project_charter_addenda_set_updated_at
before update on public.project_charter_addenda
for each row execute function public.set_updated_at();

-- =====================================================================
-- VAT splits: project_charter_vat_splits (разбиение НДС)
-- =====================================================================
create table if not exists public.project_charter_vat_splits (
  id uuid primary key default gen_random_uuid(),
  charter_id uuid not null references public.project_charters(id) on delete cascade,
  label text not null,
  share_percent numeric(6,3) not null check (share_percent >= 0 and share_percent <= 100),
  vat_rate numeric(5,2) not null check (vat_rate >= 0 and vat_rate <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_charter_vat_splits_charter_id on public.project_charter_vat_splits(charter_id);

drop trigger if exists trg_project_charter_vat_splits_set_updated_at on public.project_charter_vat_splits;
create trigger trg_project_charter_vat_splits_set_updated_at
before update on public.project_charter_vat_splits
for each row execute function public.set_updated_at();

-- =====================================================================
-- Schedule items: project_charter_schedule_items (календарный план)
-- =====================================================================
create table if not exists public.project_charter_schedule_items (
  id uuid primary key default gen_random_uuid(),
  charter_id uuid not null references public.project_charters(id) on delete cascade,
  seq int not null,
  title text not null,
  due_date date,
  share_percent numeric(6,3) not null check (share_percent >= 0 and share_percent <= 100),
  payment_delay_days int check (payment_delay_days is null or payment_delay_days >= 0),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_charter_schedule_seq unique (charter_id, seq)
);

create index if not exists idx_charter_schedule_charter_id on public.project_charter_schedule_items(charter_id);

drop trigger if exists trg_project_charter_schedule_items_set_updated_at on public.project_charter_schedule_items;
create trigger trg_project_charter_schedule_items_set_updated_at
before update on public.project_charter_schedule_items
for each row execute function public.set_updated_at();

-- =====================================================================
-- Optional: allocations table for flexible categories (вычеты/вознаграждения)
-- =====================================================================
create table if not exists public.project_charter_allocations (
  id uuid primary key default gen_random_uuid(),
  charter_id uuid not null references public.project_charters(id) on delete cascade,
  category text not null,
  amount numeric(14,2) not null default 0 check (amount >= 0),
  percent numeric(6,3) check (percent is null or (percent >= 0 and percent <= 100)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_charter_allocations_charter_id on public.project_charter_allocations(charter_id);
create index if not exists idx_charter_allocations_category on public.project_charter_allocations(category);

drop trigger if exists trg_project_charter_allocations_set_updated_at on public.project_charter_allocations;
create trigger trg_project_charter_allocations_set_updated_at
before update on public.project_charter_allocations
for each row execute function public.set_updated_at();

-- =====================================================================
-- Views
-- =====================================================================
create or replace view public.view_charter_totals as
select
  c.id as charter_id,
  c.project_id,
  c.contract_currency_code,
  (c.contract_amount_gross + coalesce(sum(a.amount_delta_gross), 0))::numeric(14,2) as total_amount_gross_dynamic
from public.project_charters c
left join public.project_charter_addenda a on a.charter_id = c.id
group by c.id, c.project_id, c.contract_currency_code, c.contract_amount_gross;

-- Optional helper view: amounts per schedule item based on dynamic total
create or replace view public.view_charter_schedule_amounts as
select
  s.id as schedule_item_id,
  s.charter_id,
  s.seq,
  s.title,
  s.due_date,
  s.share_percent,
  t.total_amount_gross_dynamic,
  round((s.share_percent / 100.0) * t.total_amount_gross_dynamic, 2) as amount_gross
from public.project_charter_schedule_items s
join public.view_charter_totals t on t.charter_id = s.charter_id;

-- =====================================================================
-- Notes:
-- 1) Сумма долей в project_charter_vat_splits и в project_charter_schedule_items намеренно
--    не принудительно ограничена триггерами до 100% в этой миграции, чтобы избежать ошибок из-за
--    округлений и частичных заполнений. Если потребуется жёсткая проверка — можно добавить отдельные
--    триггеры-валидации.
-- 2) Поле direction_id предполагает наличие public.directions(id). Если такого справочника нет,
--    удалите ссылку или замените на ваш справочник направлений.

