-- Канонический email хранится в auth.users. Обеспечиваем консистентность с public.profiles.

-- 1) Функция и триггер на profiles: перед вставкой/обновлением проставлять email из auth.users
create or replace function public.sync_profile_email_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Если у пользователя есть запись в auth.users, принудительно берем email оттуда
  select u.email into new.email
  from auth.users u
  where u.id = new.user_id;

  return new;
end;
$$;

drop trigger if exists set_profile_email_from_auth on public.profiles;
create trigger set_profile_email_from_auth
before insert or update on public.profiles
for each row execute function public.sync_profile_email_from_auth();


-- 2) Функция и триггер на auth.users: при изменении email обновлять profiles.email
create or replace function public.propagate_auth_email_to_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Обновляем email в профиле соответствующего пользователя
  update public.profiles
  set email = new.email
  where user_id = new.id;

  return null; -- AFTER ROW trigger может возвращать null
end;
$$;

drop trigger if exists propagate_auth_email on auth.users;
create trigger propagate_auth_email
after update of email on auth.users
for each row execute function public.propagate_auth_email_to_profile();

-- Примечание: функции SECURITY DEFINER и явный search_path для безопасности и прав доступа.







