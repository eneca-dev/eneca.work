-- feature-VN-05. Installs dated writers; activation remains an explicit operator step.
BEGIN;

-- Existing permission helper is also called from functions with an empty
-- search_path. Preserve its dynamic-role semantics and invoker permissions,
-- while making relation lookup independent of the caller's search_path.
CREATE OR REPLACE FUNCTION public.user_has_permission(p_user_id uuid, p_permission_name text)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.role_permissions rp ON ur.role_id = rp.role_id
    JOIN public.permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = p_user_id AND p.name = p_permission_name
  );
END;
$$;

GRANT SELECT ON public.employment_history_settings, public.employee_employment_baseline,
  public.employee_employment_periods TO service_role;

CREATE FUNCTION public.employee_employment_status()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE cutover date;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  SELECT cutover_date INTO cutover FROM public.employment_history_settings;
  RETURN jsonb_build_object('enabled', cutover IS NOT NULL, 'cutoverDate', cutover,
    'today', (clock_timestamp() AT TIME ZONE 'Europe/Minsk')::date);
END;
$$;

-- Last BEFORE trigger: compare the final profile after existing assignment triggers.
CREATE FUNCTION public.guard_employee_employment_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE period public.employee_employment_periods%ROWTYPE;
BEGIN
  IF ROW(NEW.department_id, NEW.team_id, NEW.subdivision_id, NEW.employment_rate, NEW.is_service)
    IS NOT DISTINCT FROM ROW(OLD.department_id, OLD.team_id, OLD.subdivision_id, OLD.employment_rate, OLD.is_service)
    OR NOT EXISTS (SELECT FROM public.employment_history_settings) THEN RETURN NEW; END IF;
  -- Auth bootstrap and subsequent profile upsert happen before explicit registration.
  IF NOT EXISTS (SELECT FROM public.employee_employment_periods WHERE employee_id = OLD.user_id) THEN
    RETURN NEW;
  END IF;
  SELECT * INTO period FROM public.employee_employment_periods
  WHERE employee_id = OLD.user_id
    AND valid_from <= (clock_timestamp() AT TIME ZONE 'Europe/Minsk')::date
    AND (valid_to IS NULL OR valid_to > (clock_timestamp() AT TIME ZONE 'Europe/Minsk')::date);
  IF NOT FOUND OR NEW.is_service IS DISTINCT FROM OLD.is_service
    OR ROW(NEW.department_id, NEW.team_id, NEW.subdivision_id, NEW.employment_rate)
      IS DISTINCT FROM ROW(period.department_id, period.team_id, period.subdivision_id, period.employment_rate) THEN
    RAISE EXCEPTION 'Use employment operations to change employee organization or rate' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER zz_employee_employment_profile_guard
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_employee_employment_profile();

CREATE FUNCTION public.update_employee_employment(p_employee_id uuid, p_changes jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  actor_id uuid := auth.uid();
  actor public.profiles%ROWTYPE;
  employee public.profiles%ROWTYPE;
  destination public.profiles%ROWTYPE;
  period public.employee_employment_periods%ROWTYPE;
  today date;
  key_name text;
  enabled boolean;
  org_global boolean;
  subdivision_scope boolean;
  department_scope boolean;
BEGIN
  IF actor_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF p_employee_id IS NULL OR p_changes IS NULL OR jsonb_typeof(p_changes) <> 'object' THEN
    RAISE EXCEPTION 'Employee and changes object are required' USING ERRCODE = '22023';
  END IF;
  FOR key_name IN SELECT jsonb_object_keys(p_changes) LOOP
    IF key_name NOT IN ('department_id', 'team_id', 'subdivision_id', 'employment_rate') THEN
      RAISE EXCEPTION 'Unsupported employment field' USING ERRCODE = '22023';
    END IF;
    IF key_name <> 'employment_rate' AND jsonb_typeof(p_changes -> key_name) NOT IN ('string','null') THEN
      RAISE EXCEPTION 'Organization identifiers must be UUID strings or null' USING ERRCODE = '22023';
    END IF;
  END LOOP;
  SELECT * INTO employee FROM public.profiles WHERE user_id = p_employee_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Employee not found' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO actor FROM public.profiles WHERE user_id = actor_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Actor profile required' USING ERRCODE = '42501'; END IF;
  today := (clock_timestamp() AT TIME ZONE 'Europe/Minsk')::date;
  destination := employee;
  IF p_changes ? 'department_id' THEN destination.department_id := (p_changes->>'department_id')::uuid; END IF;
  IF p_changes ? 'team_id' THEN destination.team_id := (p_changes->>'team_id')::uuid; END IF;
  IF p_changes ? 'subdivision_id' THEN destination.subdivision_id := (p_changes->>'subdivision_id')::uuid; END IF;
  IF p_changes ? 'employment_rate' THEN
    IF jsonb_typeof(p_changes->'employment_rate') <> 'number' THEN
      RAISE EXCEPTION 'Employment rate must be a positive finite number' USING ERRCODE = '22023';
    END IF;
    destination.employment_rate := (p_changes->>'employment_rate')::numeric;
    IF NOT (destination.employment_rate > 0 AND destination.employment_rate < 'Infinity'::numeric) THEN
      RAISE EXCEPTION 'Employment rate must be a positive finite number' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF destination.department_id IS NOT NULL AND NOT EXISTS (
    SELECT FROM public.departments d WHERE d.department_id = destination.department_id
      AND d.subdivision_id IS NOT DISTINCT FROM destination.subdivision_id
  ) THEN RAISE EXCEPTION 'Department and subdivision must match' USING ERRCODE = '23514'; END IF;
  IF destination.team_id IS NOT NULL AND NOT EXISTS (
    SELECT FROM public.teams t WHERE t.team_id = destination.team_id AND t.department_id = destination.department_id
  ) THEN RAISE EXCEPTION 'Team and department must match' USING ERRCODE = '23514'; END IF;

  org_global := coalesce(public.user_has_permission(actor_id,'users.edit.all'),false)
    OR coalesce(public.user_has_permission(actor_id,'hierarchy.is_admin'),false);
  subdivision_scope := actor.subdivision_id IS NOT NULL
    AND actor.subdivision_id = employee.subdivision_id AND actor.subdivision_id = destination.subdivision_id;
  department_scope := actor.department_id IS NOT NULL
    AND actor.department_id = employee.department_id AND actor.department_id = destination.department_id;
  IF ROW(employee.department_id,employee.subdivision_id) IS DISTINCT FROM
     ROW(destination.department_id,destination.subdivision_id) AND NOT (
    org_global OR (coalesce(public.user_has_permission(actor_id,'users.edit.subdivision'),false) AND coalesce(subdivision_scope,false))
  ) THEN RAISE EXCEPTION 'No permission to transfer employee' USING ERRCODE = '42501'; END IF;
  IF employee.team_id IS DISTINCT FROM destination.team_id AND NOT (
    org_global OR (coalesce(public.user_has_permission(actor_id,'users.edit.subdivision'),false) AND coalesce(subdivision_scope,false))
    OR (coalesce(department_scope,false) AND (
      coalesce(public.user_has_permission(actor_id,'users.edit.department'),false)
      OR coalesce(public.user_has_permission(actor_id,'users.edit.team'),false)))
  ) THEN RAISE EXCEPTION 'No permission to change employee team' USING ERRCODE = '42501'; END IF;
  IF employee.employment_rate IS DISTINCT FROM destination.employment_rate THEN
    IF actor_id = p_employee_id AND coalesce(public.user_has_permission(actor_id,'hierarchy.is_subdivision_head'),false) THEN
      RAISE EXCEPTION 'Subdivision head cannot change own rate' USING ERRCODE = '42501';
    END IF;
    IF NOT (
      coalesce(public.user_has_permission(actor_id,'users.edit_salary.all'),false)
      OR (coalesce(public.user_has_permission(actor_id,'users.edit_salary.subdivision'),false) AND coalesce(subdivision_scope,false))
      OR (coalesce(public.user_has_permission(actor_id,'users.edit_salary.department'),false) AND coalesce(department_scope,false)
        AND EXISTS (SELECT FROM public.view_users target_user WHERE target_user.user_id = p_employee_id
          AND lower(target_user.role_name) IN ('team_lead','user')))
    ) THEN RAISE EXCEPTION 'No permission to change employment rate' USING ERRCODE = '42501'; END IF;
  END IF;
  SELECT EXISTS(SELECT FROM public.employment_history_settings) INTO enabled;
  IF enabled THEN
    IF employee.is_service IS TRUE THEN RAISE EXCEPTION 'Service profile has no employment history' USING ERRCODE = '55000'; END IF;
    SELECT * INTO period FROM public.employee_employment_periods
    WHERE employee_id = p_employee_id AND valid_from <= today AND (valid_to IS NULL OR valid_to > today)
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Employee must have an active registered employment period' USING ERRCODE = '55000'; END IF;
    IF period.valid_to IS NOT NULL THEN
      RAISE EXCEPTION 'Employment already has a final working day' USING ERRCODE = '55000';
    END IF;
  END IF;
  IF ROW(employee.department_id,employee.team_id,employee.subdivision_id,employee.employment_rate)
    IS NOT DISTINCT FROM ROW(destination.department_id,destination.team_id,destination.subdivision_id,destination.employment_rate) THEN RETURN; END IF;
  IF today <> (clock_timestamp() AT TIME ZONE 'Europe/Minsk')::date THEN
    RAISE EXCEPTION 'Minsk date changed; retry operation' USING ERRCODE = '40001';
  END IF;
  IF enabled THEN
    IF period.valid_from = today THEN
      UPDATE public.employee_employment_periods SET department_id = destination.department_id,
        team_id = destination.team_id, subdivision_id = destination.subdivision_id,
        employment_rate = destination.employment_rate, updated_at = clock_timestamp(), updated_by = actor_id
      WHERE id = period.id;
    ELSE
      UPDATE public.employee_employment_periods SET valid_to = today,
        updated_at = clock_timestamp(), updated_by = actor_id WHERE id = period.id;
      INSERT INTO public.employee_employment_periods
        (employee_id,department_id,team_id,subdivision_id,employment_rate,valid_from,created_by,updated_by)
      VALUES (p_employee_id,destination.department_id,destination.team_id,destination.subdivision_id,
        destination.employment_rate,today,actor_id,actor_id);
    END IF;
  END IF;
  UPDATE public.profiles SET department_id = destination.department_id, team_id = destination.team_id,
    subdivision_id = destination.subdivision_id, employment_rate = destination.employment_rate
  WHERE user_id = p_employee_id;
END;
$$;

CREATE FUNCTION public.register_employee_employment(p_employee_id uuid)
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

CREATE FUNCTION public.finish_employee_employment(p_employee_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor_id uuid := auth.uid(); today date;
BEGIN
  IF actor_id IS NULL OR actor_id = p_employee_id OR NOT (
    coalesce(public.user_has_permission(actor_id,'users.delete'),false)
    OR coalesce(public.user_has_permission(actor_id,'hierarchy.is_admin'),false)) THEN
    RAISE EXCEPTION 'No permission to finish employment' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.profiles WHERE user_id = p_employee_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Employee not found' USING ERRCODE = 'P0002'; END IF;
  IF NOT EXISTS (SELECT FROM public.employment_history_settings) THEN
    RAISE EXCEPTION 'Employment history is not initialized' USING ERRCODE = '55000';
  END IF;
  today := (clock_timestamp() AT TIME ZONE 'Europe/Minsk')::date;
  IF NOT EXISTS (SELECT FROM public.employee_employment_periods WHERE employee_id = p_employee_id) THEN
    RAISE EXCEPTION 'Employee is not registered' USING ERRCODE = '55000';
  END IF;
  UPDATE public.employee_employment_periods SET valid_to = today + 1,
    updated_at = clock_timestamp(), updated_by = actor_id
  WHERE employee_id = p_employee_id AND valid_from <= today AND valid_to IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_employee_employment_profile(),
  public.employee_employment_status(), public.update_employee_employment(uuid,jsonb),
  public.register_employee_employment(uuid), public.finish_employee_employment(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.employee_employment_status(),
  public.update_employee_employment(uuid,jsonb), public.register_employee_employment(uuid),
  public.finish_employee_employment(uuid) TO authenticated;

COMMIT;
