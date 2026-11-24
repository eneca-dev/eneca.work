-- Live Auth bootstrap definition read on 2026-11-23; local synthetic fixture only.
CREATE OR REPLACE FUNCTION public.create_profile_on_signup()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  default_department uuid := '42c93225-0ac5-41fe-820a-5ecbe33b5e2d';
  default_team       uuid := '983b9ae6-6bcf-472d-ba26-eee2e4673787';
  default_position   uuid := '90ecd7f2-b969-4a0d-bba7-226cf0cb8e7b';
  default_category   uuid := '7b20a482-b5e0-40b4-9cb8-bf5e3f1a0e3f';
  default_role       uuid := '3ac4f27e-c94c-4b0d-b750-9fb6366b85bc';

  -- Переменные для данных из формы
  form_subdivision_id uuid;
  form_department_id  uuid;
  form_team_id        uuid;
  form_position_id    uuid;
  form_category_id    uuid;

  user_name         text := '';
  first_name_value  text := '';
  last_name_value   text := '';
  name_parts        text[];
begin
  -- Читаем данные из user_metadata (если они есть)
  if new.raw_user_meta_data ? 'subdivision_id' then
    form_subdivision_id := (new.raw_user_meta_data->>'subdivision_id')::uuid;
  end if;
  
  if new.raw_user_meta_data ? 'department_id' then
    form_department_id := (new.raw_user_meta_data->>'department_id')::uuid;
  end if;
  
  if new.raw_user_meta_data ? 'team_id' then
    form_team_id := (new.raw_user_meta_data->>'team_id')::uuid;
  end if;
  
  if new.raw_user_meta_data ? 'position_id' then
    form_position_id := (new.raw_user_meta_data->>'position_id')::uuid;
  end if;
  
  if new.raw_user_meta_data ? 'category_id' then
    form_category_id := (new.raw_user_meta_data->>'category_id')::uuid;
  end if;

  -- Обработка имени из raw_user_meta_data
  if new.raw_user_meta_data ? 'name' then
    user_name := new.raw_user_meta_data->>'name';
    if user_name is not null and user_name <> '' then
      name_parts := string_to_array(trim(user_name), ' ');
      if array_length(name_parts, 1) >= 1 then
        first_name_value := name_parts[1];
        if array_length(name_parts, 1) >= 2 then
          last_name_value := array_to_string(name_parts[2:], ' ');
        end if;
      end if;
    end if;
  end if;

  -- Создаём профиль с данными из формы (если есть) или дефолтными
  insert into public.profiles (
    user_id, first_name, last_name, subdivision_id, department_id, team_id,
    position_id, email, created_at, category_id, employment_rate, salary, is_hourly
  ) values (
    new.id,
    first_name_value,
    last_name_value,
    coalesce(form_subdivision_id, null),  -- Используем данные из формы или NULL
    coalesce(form_department_id, default_department),
    coalesce(form_team_id, default_team),
    coalesce(form_position_id, default_position),
    new.email,
    timezone('utc', now()),
    coalesce(form_category_id, default_category),
    1, 0, true
  );

  -- Назначаем роль
  if exists (select 1 from public.roles r where r.id = default_role) then
    insert into public.user_roles (user_id, role_id, assigned_by)
    values (new.id, default_role, null)
    on conflict (user_id, role_id) do nothing;
  end if;

  return new;
end;
$function$
;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION create_profile_on_signup();
