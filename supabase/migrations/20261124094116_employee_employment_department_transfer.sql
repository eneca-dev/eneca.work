-- feature-VN-05: preserve the existing department transfer with dated membership.
-- Does not activate history, change RLS, or rewrite existing profiles/loadings.
BEGIN;

CREATE OR REPLACE FUNCTION public.sync_employee_subdivision()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  actor_id uuid := auth.uid();
  employee public.profiles%ROWTYPE;
  period public.employee_employment_periods%ROWTYPE;
  today date;
BEGIN
  IF TG_TABLE_SCHEMA <> 'public' OR TG_TABLE_NAME <> 'departments'
    OR TG_OP <> 'UPDATE' OR TG_WHEN <> 'AFTER' OR TG_LEVEL <> 'ROW' THEN
    RAISE EXCEPTION 'Department transfer trigger only' USING ERRCODE = '55000';
  END IF;
  IF NEW.subdivision_id IS NOT DISTINCT FROM OLD.subdivision_id THEN RETURN NEW; END IF;

  IF NOT EXISTS (SELECT FROM public.employment_history_settings) THEN
    -- Preserve existing propagation until the explicit history activation.
    UPDATE public.profiles SET subdivision_id = NEW.subdivision_id
    WHERE department_id = NEW.department_id;
    RETURN NEW;
  END IF;

  -- The deployed departments table has no RLS. Enforce the existing UI permission
  -- here before the definer gains access to the private employment history.
  IF actor_id IS NULL OR NOT coalesce(public.user_has_permission(actor_id, 'users.manage.departments'), false)
    OR NOT EXISTS (SELECT FROM public.profiles WHERE user_id = actor_id) THEN
    RAISE EXCEPTION 'No permission to transfer department' USING ERRCODE = '42501';
  END IF;
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'Transfer department in a READ COMMITTED transaction' USING ERRCODE = '25001';
  END IF;

  -- A structural move is rare: freeze membership, including new arrivals, rather
  -- than locking only the employees visible before a concurrent hire/transfer.
  -- Conflicts with profile writers and the FOR UPDATE locks of employment RPCs;
  -- ordinary SELECT remains available. Read membership/time AFTER the wait.
  LOCK TABLE public.profiles IN EXCLUSIVE MODE;
  today := (clock_timestamp() AT TIME ZONE 'Europe/Minsk')::date;

  FOR employee IN SELECT * FROM public.profiles
    WHERE department_id = NEW.department_id ORDER BY user_id
  LOOP
    SELECT * INTO period FROM public.employee_employment_periods
    WHERE employee_id = employee.user_id AND valid_from <= today
      AND (valid_to IS NULL OR valid_to > today)
    FOR UPDATE;

    IF NOT FOUND THEN
      IF EXISTS (SELECT FROM public.employee_employment_periods WHERE employee_id = employee.user_id) THEN
        -- Already ended employment is historical, not a current department member.
        CONTINUE;
      END IF;
      -- Service accounts and not-yet-registered Auth bootstrap profiles have no
      -- period to rewrite; keep the existing metadata propagation for them.
    ELSE
      IF employee.is_service IS TRUE OR
        ROW(employee.department_id, employee.team_id, employee.subdivision_id, employee.employment_rate)
        IS DISTINCT FROM ROW(period.department_id, period.team_id, period.subdivision_id, period.employment_rate) THEN
        RAISE EXCEPTION 'Employee profile and employment period disagree' USING ERRCODE = '55000';
      END IF;
      IF period.valid_from = today THEN
        UPDATE public.employee_employment_periods
        SET subdivision_id = NEW.subdivision_id, updated_at = clock_timestamp(), updated_by = actor_id
        WHERE id = period.id;
      ELSE
        UPDATE public.employee_employment_periods
        SET valid_to = today, updated_at = clock_timestamp(), updated_by = actor_id
        WHERE id = period.id;
        INSERT INTO public.employee_employment_periods
          (employee_id, department_id, team_id, subdivision_id, employment_rate,
           valid_from, valid_to, created_by, updated_by)
        VALUES (employee.user_id, period.department_id, period.team_id, NEW.subdivision_id,
          period.employment_rate, today, period.valid_to, actor_id, actor_id);
        -- Keep the original end, including a final working day of today.
      END IF;
    END IF;

    UPDATE public.profiles SET subdivision_id = NEW.subdivision_id
    WHERE user_id = employee.user_id;
  END LOOP;

  IF today <> (clock_timestamp() AT TIME ZONE 'Europe/Minsk')::date THEN
    RAISE EXCEPTION 'Minsk date changed; retry department transfer' USING ERRCODE = '40001';
  END IF;
  RETURN NEW;
END;
$$;

-- Existing trigger trigger_sync_employee_subdivision continues calling this
-- function. No second propagation trigger and no public history-writing RPC.
REVOKE ALL ON FUNCTION public.sync_employee_subdivision()
  FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
