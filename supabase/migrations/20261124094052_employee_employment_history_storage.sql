-- feature-VN-05, storage only. Does NOT initialize history or modify profiles/loadings.
-- Keep the new objects inaccessible to API roles until dated operations and readers ship.
BEGIN;

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions, pg_catalog;

CREATE TABLE public.employment_history_settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  cutover_date date NOT NULL CHECK (isfinite(cutover_date)),
  initialized_at timestamptz NOT NULL DEFAULT now(),
  initialized_by uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE RESTRICT
);

CREATE TABLE public.employee_employment_baseline (
  employee_id uuid PRIMARY KEY REFERENCES public.profiles(user_id) ON DELETE RESTRICT,
  department_id uuid REFERENCES public.departments(department_id) ON DELETE RESTRICT,
  team_id uuid REFERENCES public.teams(team_id) ON DELETE RESTRICT,
  subdivision_id uuid REFERENCES public.subdivisions(subdivision_id) ON DELETE RESTRICT,
  employment_rate numeric NOT NULL
    CHECK (employment_rate > 0 AND employment_rate < 'Infinity'::numeric),
  -- The baseline is inserted BEFORE settings seals it, within the same transaction.
  singleton boolean NOT NULL DEFAULT true CHECK (singleton),
  FOREIGN KEY (singleton) REFERENCES public.employment_history_settings(singleton)
    ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  CHECK (team_id IS NULL OR department_id IS NOT NULL)
);

CREATE TABLE public.employee_employment_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE RESTRICT,
  department_id uuid REFERENCES public.departments(department_id) ON DELETE RESTRICT,
  team_id uuid REFERENCES public.teams(team_id) ON DELETE RESTRICT,
  subdivision_id uuid REFERENCES public.subdivisions(subdivision_id) ON DELETE RESTRICT,
  employment_rate numeric NOT NULL
    CHECK (employment_rate > 0 AND employment_rate < 'Infinity'::numeric),
  valid_from date NOT NULL CHECK (isfinite(valid_from)),
  valid_to date CHECK (valid_to IS NULL OR (isfinite(valid_to) AND valid_to > valid_from)),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE RESTRICT,
  CHECK (team_id IS NULL OR department_id IS NOT NULL),
  CONSTRAINT employee_employment_periods_no_overlap EXCLUDE USING gist (
    employee_id WITH =,
    daterange(valid_from, valid_to, '[)') WITH &&
  )
);

CREATE INDEX employee_employment_periods_department_start
  ON public.employee_employment_periods (department_id, valid_from);
CREATE INDEX employee_employment_periods_team_start
  ON public.employee_employment_periods (team_id, valid_from);

-- RLS without policies is deliberate: no application readers/writers in this stage.
ALTER TABLE public.employment_history_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_employment_baseline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_employment_periods ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.employment_history_settings,
  public.employee_employment_baseline, public.employee_employment_periods
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.guard_employment_history_snapshot()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' AND TG_TABLE_NAME = 'employee_employment_baseline' THEN
    IF NOT EXISTS (SELECT 1 FROM public.employment_history_settings) THEN
      RETURN NEW;
    END IF;
  END IF;
  RAISE EXCEPTION 'Employment history baseline and cutover are immutable'
    USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER employment_history_settings_immutable
BEFORE UPDATE OR DELETE OR TRUNCATE ON public.employment_history_settings
FOR EACH STATEMENT EXECUTE FUNCTION public.guard_employment_history_snapshot();

CREATE TRIGGER employee_employment_baseline_sealed_insert
BEFORE INSERT ON public.employee_employment_baseline
FOR EACH ROW EXECUTE FUNCTION public.guard_employment_history_snapshot();

CREATE TRIGGER employee_employment_baseline_immutable
BEFORE UPDATE OR DELETE OR TRUNCATE ON public.employee_employment_baseline
FOR EACH STATEMENT EXECUTE FUNCTION public.guard_employment_history_snapshot();

CREATE FUNCTION public.validate_employment_period_cutover()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  cutover date;
BEGIN
  SELECT cutover_date INTO cutover FROM public.employment_history_settings;
  IF cutover IS NULL OR NEW.valid_from < cutover THEN
    RAISE EXCEPTION 'Employment period must start on or after initialized cutover'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER employee_employment_periods_cutover
BEFORE INSERT OR UPDATE ON public.employee_employment_periods
FOR EACH ROW EXECUTE FUNCTION public.validate_employment_period_cutover();

-- Operator-only, SECURITY INVOKER. No client RPC privilege, no live activation here.
CREATE FUNCTION public.initialize_employee_employment_history(
  p_cutover_date date,
  p_initialized_by uuid
)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  employee_count integer;
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
  FROM public.employee_employment_baseline;

  RETURN employee_count;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_employment_history_snapshot(),
  public.validate_employment_period_cutover(),
  public.initialize_employee_employment_history(date, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON TABLE public.employee_employment_baseline IS
  'Frozen organization/rates at cutover for earlier dates; not reconstructed hiring history. No salary data.';
COMMENT ON TABLE public.employee_employment_periods IS
  'Employment state from cutover onward. Half-open intervals [valid_from, valid_to). NULL end is unbounded.';
COMMENT ON FUNCTION public.initialize_employee_employment_history(date, uuid) IS
  'Operator-only cutover. Do not execute until dated writers/readers and importer compatibility are deployed.';

COMMIT;
