-- feature-VN-05: compatibility with the unchanged legacy system importer.
-- Auth bootstrap -> profiles upsert -> explicit user_roles INSERT (possibly a
-- duplicate). Neither Auth bootstrap nor profile upsert alone finalizes a hire.
BEGIN;

-- A system write has no human actor. Generated source columns keep attribution
-- consistent when later human RPCs update an imported period.
ALTER TABLE public.employee_employment_periods
  ALTER COLUMN created_by DROP NOT NULL,
  ALTER COLUMN updated_by DROP NOT NULL,
  ADD COLUMN created_source text GENERATED ALWAYS AS
    (CASE WHEN created_by IS NULL THEN 'system'::text ELSE 'user'::text END) STORED,
  ADD COLUMN updated_source text GENERATED ALWAYS AS
    (CASE WHEN updated_by IS NULL THEN 'system'::text ELSE 'user'::text END) STORED;

CREATE TABLE public.employment_legacy_import_settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  archived_department_id uuid NOT NULL REFERENCES public.departments(department_id) ON DELETE RESTRICT,
  archived_team_id uuid NOT NULL REFERENCES public.teams(team_id) ON DELETE RESTRICT
);
ALTER TABLE public.employment_legacy_import_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.employment_legacy_import_settings FROM PUBLIC, anon, authenticated, service_role;

-- Resolve the existing importer's destination once; runtime uses IDs, never a
-- name heuristic. Fail deployment rather than silently choose an ambiguous pair.
DO $$
DECLARE destination_count integer;
BEGIN
  SELECT count(*) INTO destination_count
  FROM public.departments d JOIN public.teams t ON t.department_id = d.department_id
  WHERE d.department_name = 'Удалены' AND t.team_name = 'Удалены - Общая';
  IF destination_count <> 1 THEN
    RAISE EXCEPTION 'Exactly one legacy archive department/team pair is required' USING ERRCODE = '23514';
  END IF;
  INSERT INTO public.employment_legacy_import_settings(archived_department_id, archived_team_id)
  SELECT d.department_id, t.team_id
  FROM public.departments d JOIN public.teams t ON t.department_id = d.department_id
  WHERE d.department_name = 'Удалены' AND t.team_name = 'Удалены - Общая';
END;
$$;

-- Preserve the pre-cutover baseline, but never activate already archived staff.
-- Replaces the pending storage initializer; source locks and operator-only access remain.
CREATE OR REPLACE FUNCTION public.initialize_employee_employment_history(
  p_cutover_date date,
  p_initialized_by uuid
)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  employee_count integer;
  archived_department uuid;
BEGIN
  -- A pre-existing REPEATABLE READ snapshot could outlive the source locks.
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'Initialize employment history in a READ COMMITTED transaction'
      USING ERRCODE = '25001';
  END IF;
  IF p_cutover_date IS NULL
    OR p_cutover_date <> (clock_timestamp() AT TIME ZONE 'Europe/Minsk')::date THEN
    RAISE EXCEPTION 'Cutover must be the current Minsk date'
      USING ERRCODE = '22023';
  END IF;
  IF p_initialized_by IS NULL THEN
    RAISE EXCEPTION 'Initialization operator is required' USING ERRCODE = '22023';
  END IF;

  -- SHARE blocks INSERT/UPDATE/DELETE as well as structure changes during capture.
  -- Never call Auth/network services while holding these locks.
  LOCK TABLE public.subdivisions, public.departments, public.teams, public.profiles
    IN SHARE MODE;
  LOCK TABLE public.employment_history_settings, public.employee_employment_baseline,
    public.employee_employment_periods IN EXCLUSIVE MODE;

  -- Waiting for a writer must not activate yesterday after Minsk midnight.
  IF p_cutover_date <> (clock_timestamp() AT TIME ZONE 'Europe/Minsk')::date THEN
    RAISE EXCEPTION 'Minsk date changed while waiting; retry initialization'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (SELECT 1 FROM public.employment_history_settings) THEN
    RAISE EXCEPTION 'Employment history is already initialized' USING ERRCODE = '55000';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.is_service IS NOT TRUE AND
      (p.employment_rate IS NULL OR NOT (p.employment_rate > 0 AND p.employment_rate < 'Infinity'::numeric))
  ) THEN
    RAISE EXCEPTION 'Resolve missing or invalid employee rates before initialization'
      USING ERRCODE = '23514';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.profiles p
    LEFT JOIN public.teams t ON t.team_id = p.team_id
    LEFT JOIN public.departments d ON d.department_id = p.department_id
    WHERE p.is_service IS NOT TRUE AND (
      (p.team_id IS NOT NULL AND (p.department_id IS NULL OR t.department_id IS DISTINCT FROM p.department_id))
      OR (p.department_id IS NOT NULL AND d.subdivision_id IS DISTINCT FROM p.subdivision_id)
    )
  ) THEN
    RAISE EXCEPTION 'Resolve employee organization inconsistencies before initialization'
      USING ERRCODE = '23514';
  END IF;

  SELECT archived_department_id INTO STRICT archived_department
  FROM public.employment_legacy_import_settings FOR SHARE;

  INSERT INTO public.employee_employment_baseline
    (employee_id, department_id, team_id, subdivision_id, employment_rate)
  SELECT user_id, department_id, team_id, subdivision_id, employment_rate
  FROM public.profiles WHERE is_service IS NOT TRUE;
  GET DIAGNOSTICS employee_count = ROW_COUNT;

  INSERT INTO public.employment_history_settings (cutover_date, initialized_by)
  VALUES (p_cutover_date, p_initialized_by);

  INSERT INTO public.employee_employment_periods
    (employee_id, department_id, team_id, subdivision_id, employment_rate,
     valid_from, created_by, updated_by)
  SELECT employee_id, department_id, team_id, subdivision_id, employment_rate,
    p_cutover_date, p_initialized_by, p_initialized_by
  FROM public.employee_employment_baseline
  WHERE department_id IS DISTINCT FROM archived_department;

  RETURN employee_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.register_employee_employment(p_employee_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor_id uuid := auth.uid(); employee public.profiles%ROWTYPE; today date;
BEGIN
  IF actor_id IS NULL OR NOT (coalesce(public.user_has_permission(actor_id,'users.create'),false)
    OR coalesce(public.user_has_permission(actor_id,'users.edit.all'),false)
    OR coalesce(public.user_has_permission(actor_id,'hierarchy.is_admin'),false)) THEN
    RAISE EXCEPTION 'No permission to register employment' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO employee FROM public.profiles WHERE user_id = p_employee_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Employee not found' USING ERRCODE = 'P0002'; END IF;
  IF NOT EXISTS (SELECT FROM public.employment_history_settings) THEN RETURN; END IF;
  IF employee.is_service IS TRUE THEN RAISE EXCEPTION 'Cannot register service profile' USING ERRCODE = '55000'; END IF;
  -- Retrying registration never changes or reopens previously recorded employment.
  IF EXISTS (SELECT FROM public.employee_employment_periods WHERE employee_id = p_employee_id) THEN RETURN; END IF;
  IF EXISTS (SELECT FROM public.employee_employment_baseline WHERE employee_id = p_employee_id) THEN
    RAISE EXCEPTION 'Baseline employee without active history cannot be registered as a new hire' USING ERRCODE = '55000';
  END IF;
  IF EXISTS (SELECT FROM public.employment_legacy_import_settings WHERE archived_department_id = employee.department_id) THEN
    RAISE EXCEPTION 'Cannot register archived employee without a rehire operation' USING ERRCODE = '55000';
  END IF;
  IF employee.employment_rate IS NULL OR NOT (employee.employment_rate > 0 AND employee.employment_rate < 'Infinity'::numeric)
    OR (employee.department_id IS NOT NULL AND NOT EXISTS (SELECT FROM public.departments d
      WHERE d.department_id = employee.department_id AND d.subdivision_id IS NOT DISTINCT FROM employee.subdivision_id))
    OR (employee.team_id IS NOT NULL AND NOT EXISTS (SELECT FROM public.teams t
      WHERE t.team_id = employee.team_id AND t.department_id = employee.department_id)) THEN
    RAISE EXCEPTION 'Complete valid employee organization and rate before registration' USING ERRCODE = '23514';
  END IF;
  today := (clock_timestamp() AT TIME ZONE 'Europe/Minsk')::date;
  INSERT INTO public.employee_employment_periods
    (employee_id,department_id,team_id,subdivision_id,employment_rate,valid_from,created_by,updated_by)
  VALUES (p_employee_id,employee.department_id,employee.team_id,employee.subdivision_id,
    employee.employment_rate,today,actor_id,actor_id);
END;
$$;

CREATE FUNCTION public.is_legacy_employment_import()
RETURNS boolean LANGUAGE sql STABLE SET search_path = '' AS $$
  -- PostgREST's actual SET ROLE, not an editable JWT/user_metadata field and not
  -- current_user (which is the function owner inside SECURITY DEFINER).
  SELECT coalesce(current_setting('role', true) = 'service_role', false)
$$;
REVOKE ALL ON FUNCTION public.is_legacy_employment_import() FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.finalize_legacy_employee_import()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  employee public.profiles%ROWTYPE;
  archived_department uuid;
  today date;
BEGIN
  IF TG_TABLE_SCHEMA <> 'public' OR TG_TABLE_NAME <> 'user_roles'
    OR TG_OP <> 'INSERT' OR TG_WHEN <> 'BEFORE' OR TG_LEVEL <> 'ROW' THEN
    RAISE EXCEPTION 'Legacy role finalization trigger only' USING ERRCODE = '55000';
  END IF;
  IF NOT public.is_legacy_employment_import()
    OR NOT EXISTS(SELECT FROM public.employment_history_settings) THEN RETURN NEW; END IF;

  SELECT * INTO employee FROM public.profiles WHERE user_id = NEW.user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NEW; END IF; -- Let the existing role FK reject it.
  IF employee.is_service IS TRUE
    OR EXISTS(SELECT FROM public.employee_employment_periods WHERE employee_id = NEW.user_id) THEN RETURN NEW; END IF;
  SELECT archived_department_id INTO STRICT archived_department FROM public.employment_legacy_import_settings;
  IF employee.department_id = archived_department THEN RETURN NEW; END IF;
  IF EXISTS(SELECT FROM public.employee_employment_baseline WHERE employee_id = NEW.user_id) THEN
    RAISE EXCEPTION 'Baseline employee is missing employment history' USING ERRCODE = '55000';
  END IF;

  -- This adapter handles completed legacy imports with a concrete team/department.
  -- The authenticated application RPC remains the path for other supported hires.
  IF employee.department_id IS NULL OR employee.team_id IS NULL
    OR employee.employment_rate IS NULL
    OR NOT (employee.employment_rate > 0 AND employee.employment_rate < 'Infinity'::numeric)
    OR NOT EXISTS(SELECT FROM public.departments d WHERE d.department_id = employee.department_id
      AND d.subdivision_id IS NOT DISTINCT FROM employee.subdivision_id)
    OR NOT EXISTS(SELECT FROM public.teams t WHERE t.team_id = employee.team_id
      AND t.department_id = employee.department_id) THEN
    RAISE EXCEPTION 'Complete valid employee organization and rate before import finalization' USING ERRCODE = '23514';
  END IF;
  today := (clock_timestamp() AT TIME ZONE 'Europe/Minsk')::date;
  INSERT INTO public.employee_employment_periods
    (employee_id, department_id, team_id, subdivision_id, employment_rate,
     valid_from, created_by, updated_by)
  VALUES (employee.user_id, employee.department_id, employee.team_id, employee.subdivision_id,
    employee.employment_rate, today, NULL, NULL);

  -- Auth already assigns the default role. The old importer treats its exact
  -- duplicate as success and does not require a returned row. Preserve that
  -- successful outcome without rolling the new period back on unique_violation.
  PERFORM 1 FROM public.user_roles
  WHERE user_id = NEW.user_id AND role_id = NEW.role_id FOR KEY SHARE;
  IF FOUND THEN RETURN NULL; END IF;
  RETURN NEW; -- Any real role INSERT failure rolls back this period too.
END;
$$;
CREATE TRIGGER finalize_legacy_employee_import
BEFORE INSERT ON public.user_roles FOR EACH ROW
EXECUTE FUNCTION public.finalize_legacy_employee_import();
REVOKE ALL ON FUNCTION public.finalize_legacy_employee_import() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.guard_employee_employment_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  period public.employee_employment_periods%ROWTYPE;
  archive public.employment_legacy_import_settings%ROWTYPE;
  today date;
BEGIN
  IF ROW(NEW.department_id, NEW.team_id, NEW.subdivision_id, NEW.employment_rate, NEW.is_service)
    IS NOT DISTINCT FROM ROW(OLD.department_id, OLD.team_id, OLD.subdivision_id, OLD.employment_rate, OLD.is_service)
    OR NOT EXISTS (SELECT FROM public.employment_history_settings) THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT FROM public.employee_employment_periods WHERE employee_id = OLD.user_id) THEN
    IF EXISTS (SELECT FROM public.employee_employment_baseline WHERE employee_id = OLD.user_id) THEN
      RAISE EXCEPTION 'Cannot change archived baseline employment without a rehire operation' USING ERRCODE = '55000';
    END IF;
    RETURN NEW; -- Keep Auth bootstrap/upsert rollback possible until finalization.
  END IF;
  today := (clock_timestamp() AT TIME ZONE 'Europe/Minsk')::date;
  SELECT * INTO period FROM public.employee_employment_periods
  WHERE employee_id = OLD.user_id AND valid_from <= today AND (valid_to IS NULL OR valid_to > today)
  FOR UPDATE;

  IF public.is_legacy_employment_import() AND OLD.is_service IS FALSE
    AND (to_jsonb(NEW) - ARRAY['department_id','team_id','subdivision_id'])
      IS NOT DISTINCT FROM (to_jsonb(OLD) - ARRAY['department_id','team_id','subdivision_id']) THEN
    SELECT * INTO STRICT archive FROM public.employment_legacy_import_settings;
    IF NEW.department_id = archive.archived_department_id AND NEW.team_id = archive.archived_team_id
      AND EXISTS(SELECT FROM public.teams t WHERE t.team_id = NEW.team_id AND t.department_id = NEW.department_id)
      AND EXISTS(SELECT FROM public.departments d WHERE d.department_id = NEW.department_id
        AND d.subdivision_id IS NOT DISTINCT FROM NEW.subdivision_id) THEN
      IF EXISTS(SELECT FROM public.employee_employment_periods
        WHERE employee_id = OLD.user_id AND valid_from > today) THEN
        RAISE EXCEPTION 'Cannot archive employment with a future period' USING ERRCODE = '55000';
      END IF;
      IF period.id IS NOT NULL THEN
        IF ROW(OLD.department_id, OLD.team_id, OLD.subdivision_id, OLD.employment_rate)
          IS DISTINCT FROM ROW(period.department_id, period.team_id, period.subdivision_id, period.employment_rate) THEN
          RAISE EXCEPTION 'Employee profile and employment period disagree' USING ERRCODE = '55000';
        END IF;
        IF period.valid_to IS NULL OR period.valid_to > today + 1 THEN
          UPDATE public.employee_employment_periods SET valid_to = today + 1,
            updated_at = clock_timestamp(), updated_by = NULL WHERE id = period.id;
        END IF;
      END IF;
      -- No active period means the employee has already finished: move only the
      -- technical profile, without rewriting/reopening the historical interval.
      IF today <> (clock_timestamp() AT TIME ZONE 'Europe/Minsk')::date THEN
        RAISE EXCEPTION 'Minsk date changed; retry archive operation' USING ERRCODE = '40001';
      END IF;
      RETURN NEW;
    END IF;
  END IF;

  IF period.id IS NULL OR NEW.is_service IS DISTINCT FROM OLD.is_service
    OR ROW(NEW.department_id, NEW.team_id, NEW.subdivision_id, NEW.employment_rate)
      IS DISTINCT FROM ROW(period.department_id, period.team_id, period.subdivision_id, period.employment_rate) THEN
    RAISE EXCEPTION 'Use employment operations to change employee organization or rate' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_employee_employment_profile() FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
