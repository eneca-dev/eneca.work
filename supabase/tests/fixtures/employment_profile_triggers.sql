-- Definitions read from the live schema on 2026-11-23; no employee data.
-- Local regression fixture only: original triggers before history-aware transfer.
CREATE OR REPLACE FUNCTION public.check_profiles_integrity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  conflict_count integer;
begin
  -- 1) команда указана, отдела нет — запрещаем
  if new.team_id is not null and new.department_id is null then
    raise exception 'Пользователь не может быть в команде без отдела. team_id: %, department_id: NULL',
      new.team_id;
  end if;

  -- 2) оба указаны — проверяем соответствие
  if new.team_id is not null and new.department_id is not null then
    select count(*) into conflict_count
    from public.teams t
    where t.team_id = new.team_id
      and t.department_id is not null
      and t.department_id <> new.department_id;

    if conflict_count > 0 then
      raise exception 'Сотрудник не может состоять в команде другого отдела. team_id: %, department_id: %',
        new.team_id, new.department_id;
    end if;
  end if;

  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.fn_cleanup_grants_on_dept_change()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.department_id IS DISTINCT FROM OLD.department_id AND NEW.department_id IS NOT NULL THEN
    DELETE FROM public.employee_loading_access_grants
    WHERE employee_id = NEW.user_id
      AND granted_to_department_id = NEW.department_id;
  END IF;
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.sync_employee_subdivision()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF (TG_OP = 'UPDATE' AND OLD.subdivision_id IS DISTINCT FROM NEW.subdivision_id) THEN
        UPDATE public.profiles
        SET subdivision_id = NEW.subdivision_id
        WHERE department_id = NEW.department_id;
    END IF;
    
    RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.sync_employee_subdivision_on_assignment()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF (NEW.department_id IS NOT NULL) THEN
        SELECT subdivision_id INTO NEW.subdivision_id
        FROM public.departments
        WHERE department_id = NEW.department_id;
    ELSE
        NEW.subdivision_id = NULL;
    END IF;
    
    RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.sync_profile_email_from_auth()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  -- Если у пользователя есть запись в auth.users, принудительно берем email оттуда
  select u.email into new.email
  from auth.users u
  where u.id = new.user_id;

  return new;
end;
$function$
;
CREATE TRIGGER trigger_sync_employee_subdivision AFTER UPDATE OF subdivision_id ON public.departments FOR EACH ROW EXECUTE FUNCTION sync_employee_subdivision();
CREATE TRIGGER set_profile_email_from_auth BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION sync_profile_email_from_auth();
CREATE TRIGGER trg_cleanup_grants_on_dept_change AFTER UPDATE OF department_id ON public.profiles FOR EACH ROW EXECUTE FUNCTION fn_cleanup_grants_on_dept_change();
CREATE TRIGGER trigger_check_profiles_integrity BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION check_profiles_integrity();
CREATE TRIGGER trigger_employee_subdivision_on_assignment BEFORE INSERT OR UPDATE OF department_id ON public.profiles FOR EACH ROW EXECUTE FUNCTION sync_employee_subdivision_on_assignment();