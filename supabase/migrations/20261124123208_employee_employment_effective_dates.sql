-- feature-VN-06: bounded retrospective personnel changes. No backfill or loading writes.
BEGIN;

-- Context grants no employee values. Mutation checks still validate every changed field.
CREATE FUNCTION public.assert_employee_employment_edit_access(p_employee_id uuid, p_operation text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  actor_id uuid := auth.uid();
  actor public.profiles%ROWTYPE;
  employee public.profiles%ROWTYPE;
  same_subdivision boolean;
  same_department boolean;
  can_edit boolean;
BEGIN
  IF actor_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF p_employee_id IS NULL OR p_operation IS NULL OR p_operation NOT IN ('update','finish') THEN
    RAISE EXCEPTION 'Employee and operation are required' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO actor FROM public.profiles WHERE user_id = actor_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Actor profile required' USING ERRCODE = '42501'; END IF;
  SELECT * INTO employee FROM public.profiles WHERE user_id = p_employee_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Employee unavailable' USING ERRCODE = '42501'; END IF;
  IF p_operation = 'finish' THEN
    can_edit := actor_id <> p_employee_id AND (
      coalesce(public.user_has_permission(actor_id,'users.delete'),false)
      OR coalesce(public.user_has_permission(actor_id,'hierarchy.is_admin'),false));
  ELSE
    same_subdivision := actor.subdivision_id IS NOT NULL AND actor.subdivision_id = employee.subdivision_id;
    same_department := actor.department_id IS NOT NULL AND actor.department_id = employee.department_id;
    can_edit := coalesce(public.user_has_permission(actor_id,'users.edit.all'),false)
      OR coalesce(public.user_has_permission(actor_id,'hierarchy.is_admin'),false)
      OR (coalesce(same_subdivision,false) AND coalesce(public.user_has_permission(actor_id,'users.edit.subdivision'),false))
      OR (coalesce(same_department,false) AND (
        coalesce(public.user_has_permission(actor_id,'users.edit.department'),false)
        OR coalesce(public.user_has_permission(actor_id,'users.edit.team'),false)))
      OR (NOT (actor_id = p_employee_id AND coalesce(public.user_has_permission(actor_id,'hierarchy.is_subdivision_head'),false)) AND (
        coalesce(public.user_has_permission(actor_id,'users.edit_salary.all'),false)
        OR (coalesce(same_subdivision,false) AND coalesce(public.user_has_permission(actor_id,'users.edit_salary.subdivision'),false))
        OR (coalesce(same_department,false) AND coalesce(public.user_has_permission(actor_id,'users.edit_salary.department'),false)
          AND EXISTS(SELECT FROM public.view_users u WHERE u.user_id=p_employee_id AND lower(u.role_name) IN ('team_lead','user')))));
  END IF;
  IF can_edit IS NOT TRUE THEN RAISE EXCEPTION 'No permission for employment operation' USING ERRCODE = '42501'; END IF;
END;
$$;

CREATE FUNCTION public.get_employee_employment_edit_context(p_employee_id uuid, p_operation text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  cutover date;
  today date;
  period public.employee_employment_periods%ROWTYPE;
BEGIN
  PERFORM public.assert_employee_employment_edit_access(p_employee_id,p_operation);
  -- Serialize the context read with all application/import writers of this employee.
  PERFORM 1 FROM public.profiles WHERE user_id=p_employee_id FOR SHARE;
  PERFORM public.assert_employee_employment_edit_access(p_employee_id,p_operation);
  today := (clock_timestamp() AT TIME ZONE 'Europe/Minsk')::date;
  SELECT cutover_date INTO cutover FROM public.employment_history_settings;
  IF cutover IS NULL THEN
    RETURN jsonb_build_object('enabled',false,'cutoverDate',NULL,'today',today,
      'periodId',NULL,'periodUpdatedAt',NULL,'minDate',NULL);
  END IF;
  SELECT * INTO period FROM public.employee_employment_periods
  WHERE employee_id=p_employee_id ORDER BY valid_from DESC LIMIT 1;
  IF NOT FOUND OR period.valid_to IS NOT NULL OR period.valid_from > today THEN
    RAISE EXCEPTION 'Employee must have a last open employment period' USING ERRCODE = '55000';
  END IF;
  RETURN jsonb_build_object('enabled',true,'cutoverDate',cutover,'today',today,
    'periodId',period.id,'periodUpdatedAt',period.updated_at,'minDate',greatest(cutover,period.valid_from));
END;
$$;

CREATE FUNCTION public.update_employee_employment_internal(p_employee_id uuid, p_changes jsonb,
  p_effective_date date, p_expected_period_id uuid, p_expected_updated_at timestamptz,
  p_use_current_date boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  actor_id uuid := auth.uid();
  actor public.profiles%ROWTYPE;
  employee public.profiles%ROWTYPE;
  destination public.profiles%ROWTYPE;
  period public.employee_employment_periods%ROWTYPE;
  today date;
  effective_date date;
  cutover date;
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
  PERFORM public.assert_employee_employment_edit_access(p_employee_id, 'update');
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
  SELECT cutover_date INTO cutover FROM public.employment_history_settings;
  enabled := cutover IS NOT NULL;
  effective_date := CASE WHEN p_use_current_date THEN today ELSE p_effective_date END;
  IF NOT p_use_current_date THEN
    IF NOT enabled THEN RAISE EXCEPTION 'Employment history is not initialized' USING ERRCODE = '55000'; END IF;
    IF effective_date IS NULL OR NOT isfinite(effective_date) OR effective_date < cutover OR effective_date > today THEN
      RAISE EXCEPTION 'Effective date must be within recorded history and not in the future' USING ERRCODE = '22023';
    END IF;
    IF p_expected_period_id IS NULL OR p_expected_updated_at IS NULL THEN
      RAISE EXCEPTION 'Employment revision is required' USING ERRCODE = '40001';
    END IF;
  END IF;
  IF enabled THEN
    IF employee.is_service IS TRUE THEN RAISE EXCEPTION 'Service profile has no employment history' USING ERRCODE = '55000'; END IF;
    SELECT * INTO period FROM public.employee_employment_periods
    WHERE employee_id = p_employee_id ORDER BY valid_from DESC LIMIT 1 FOR UPDATE;
    IF NOT FOUND OR period.valid_to IS NOT NULL OR period.valid_from > today THEN
      RAISE EXCEPTION 'Employee must have a last open employment period' USING ERRCODE = '55000';
    END IF;
    IF NOT p_use_current_date AND
      (period.id IS DISTINCT FROM p_expected_period_id OR period.updated_at IS DISTINCT FROM p_expected_updated_at) THEN
      RAISE EXCEPTION 'Employment changed; refresh the form' USING ERRCODE = '40001';
    END IF;
    IF effective_date < period.valid_from THEN
      RAISE EXCEPTION 'Effective date crosses a later employment change' USING ERRCODE = '55000';
    END IF;
    IF ROW(employee.department_id,employee.team_id,employee.subdivision_id,employee.employment_rate)
      IS DISTINCT FROM ROW(period.department_id,period.team_id,period.subdivision_id,period.employment_rate) THEN
      RAISE EXCEPTION 'Employee profile and employment period disagree' USING ERRCODE = '55000';
    END IF;
  END IF;
  IF ROW(employee.department_id,employee.team_id,employee.subdivision_id,employee.employment_rate)
    IS NOT DISTINCT FROM ROW(destination.department_id,destination.team_id,destination.subdivision_id,destination.employment_rate) THEN RETURN; END IF;
  IF today <> (clock_timestamp() AT TIME ZONE 'Europe/Minsk')::date THEN
    RAISE EXCEPTION 'Minsk date changed; retry operation' USING ERRCODE = '40001';
  END IF;
  IF enabled THEN
    IF period.valid_from = effective_date THEN
      UPDATE public.employee_employment_periods SET department_id = destination.department_id,
        team_id = destination.team_id, subdivision_id = destination.subdivision_id,
        employment_rate = destination.employment_rate, updated_at = greatest(clock_timestamp(), period.updated_at + interval '1 microsecond'), updated_by = actor_id
      WHERE id = period.id;
    ELSE
      UPDATE public.employee_employment_periods SET valid_to = effective_date,
        updated_at = greatest(clock_timestamp(), period.updated_at + interval '1 microsecond'), updated_by = actor_id WHERE id = period.id;
      INSERT INTO public.employee_employment_periods
        (employee_id,department_id,team_id,subdivision_id,employment_rate,valid_from,created_by,updated_by)
      VALUES (p_employee_id,destination.department_id,destination.team_id,destination.subdivision_id,
        destination.employment_rate,effective_date,actor_id,actor_id);
    END IF;
  END IF;
  UPDATE public.profiles SET department_id = destination.department_id, team_id = destination.team_id,
    subdivision_id = destination.subdivision_id, employment_rate = destination.employment_rate
  WHERE user_id = p_employee_id;
END;
$$;


CREATE FUNCTION public.finish_employee_employment_internal(
  p_employee_id uuid, p_last_working_date date, p_expected_period_id uuid,
  p_expected_updated_at timestamptz, p_use_current_date boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  actor_id uuid := auth.uid();
  today date;
  last_date date;
  cutover date;
  period public.employee_employment_periods%ROWTYPE;
BEGIN
  PERFORM public.assert_employee_employment_edit_access(p_employee_id,'finish');
  PERFORM 1 FROM public.profiles WHERE user_id=p_employee_id FOR UPDATE;
  PERFORM public.assert_employee_employment_edit_access(p_employee_id,'finish');
  today := (clock_timestamp() AT TIME ZONE 'Europe/Minsk')::date;
  last_date := CASE WHEN p_use_current_date THEN today ELSE p_last_working_date END;
  SELECT cutover_date INTO cutover FROM public.employment_history_settings;
  IF cutover IS NULL THEN RAISE EXCEPTION 'Employment history is not initialized' USING ERRCODE = '55000'; END IF;
  IF last_date IS NULL OR NOT isfinite(last_date) OR last_date < cutover OR last_date > today THEN
    RAISE EXCEPTION 'Last working date must be within recorded history and not in the future' USING ERRCODE = '22023';
  END IF;
  IF NOT p_use_current_date AND (p_expected_period_id IS NULL OR p_expected_updated_at IS NULL) THEN
    RAISE EXCEPTION 'Employment revision is required' USING ERRCODE = '40001';
  END IF;
  SELECT * INTO period FROM public.employee_employment_periods
  WHERE employee_id=p_employee_id ORDER BY valid_from DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Employee is not registered' USING ERRCODE = '55000'; END IF;
  -- Legacy calls were idempotent for an already finished employee.
  IF p_use_current_date AND period.valid_to IS NOT NULL THEN RETURN; END IF;
  IF period.valid_to IS NOT NULL OR period.valid_from > today THEN
    RAISE EXCEPTION 'Employee must have a last open employment period' USING ERRCODE = '55000';
  END IF;
  IF NOT p_use_current_date AND
    (period.id IS DISTINCT FROM p_expected_period_id OR period.updated_at IS DISTINCT FROM p_expected_updated_at) THEN
    RAISE EXCEPTION 'Employment changed; refresh the form' USING ERRCODE = '40001';
  END IF;
  IF last_date < period.valid_from THEN
    RAISE EXCEPTION 'Last working date crosses a later employment change' USING ERRCODE = '55000';
  END IF;
  IF today <> (clock_timestamp() AT TIME ZONE 'Europe/Minsk')::date THEN
    RAISE EXCEPTION 'Minsk date changed; retry operation' USING ERRCODE = '40001';
  END IF;
  UPDATE public.employee_employment_periods SET valid_to=last_date+1,
    updated_at=greatest(clock_timestamp(),period.updated_at+interval '1 microsecond'),updated_by=actor_id
  WHERE id=period.id;
END;
$$;

-- Public explicit-date entry points cannot opt out of the revision check.
CREATE FUNCTION public.update_employee_employment_dated(
  p_employee_id uuid, p_changes jsonb, p_effective_date date,
  p_expected_period_id uuid, p_expected_updated_at timestamptz)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.update_employee_employment_internal(
    p_employee_id,p_changes,p_effective_date,p_expected_period_id,p_expected_updated_at,false)
$$;
CREATE FUNCTION public.finish_employee_employment_dated(
  p_employee_id uuid, p_last_working_date date,
  p_expected_period_id uuid, p_expected_updated_at timestamptz)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.finish_employee_employment_internal(
    p_employee_id,p_last_working_date,p_expected_period_id,p_expected_updated_at,false)
$$;

-- Retain API signatures and pre-activation behavior for existing clients/importers.
CREATE OR REPLACE FUNCTION public.update_employee_employment(p_employee_id uuid,p_changes jsonb)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.update_employee_employment_internal(p_employee_id,p_changes,NULL,NULL,NULL,true)
$$;
CREATE OR REPLACE FUNCTION public.finish_employee_employment(p_employee_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.finish_employee_employment_internal(p_employee_id,NULL,NULL,NULL,true)
$$;

REVOKE ALL ON FUNCTION public.assert_employee_employment_edit_access(uuid,text),
  public.update_employee_employment_internal(uuid,jsonb,date,uuid,timestamptz,boolean),
  public.finish_employee_employment_internal(uuid,date,uuid,timestamptz,boolean)
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.get_employee_employment_edit_context(uuid,text),
  public.update_employee_employment_dated(uuid,jsonb,date,uuid,timestamptz),
  public.finish_employee_employment_dated(uuid,date,uuid,timestamptz),
  public.update_employee_employment(uuid,jsonb),public.finish_employee_employment(uuid)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_employee_employment_edit_context(uuid,text),
  public.update_employee_employment_dated(uuid,jsonb,date,uuid,timestamptz),
  public.finish_employee_employment_dated(uuid,date,uuid,timestamptz),
  public.update_employee_employment(uuid,jsonb),public.finish_employee_employment(uuid)
  TO authenticated;

COMMIT;
