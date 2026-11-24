\set ON_ERROR_STOP on
-- Run ONLY against a new, disposable local database. No application data is used.
DO $$ BEGIN
  IF current_database() NOT LIKE 'enecawork_hr_storage_test_%'
    OR inet_server_addr() IS DISTINCT FROM '127.0.0.1'::inet THEN
    RAISE EXCEPTION 'A disposable loopback enecawork_hr_storage_test_* database is required';
  END IF;
END $$;

-- Minimal dependency schema; deliberately not a copy of production data/RLS.
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role; END IF;
END $$;
CREATE TABLE public.subdivisions (subdivision_id uuid PRIMARY KEY);
CREATE TABLE public.departments (
  department_id uuid PRIMARY KEY,
  subdivision_id uuid REFERENCES public.subdivisions
);
CREATE TABLE public.teams (
  team_id uuid PRIMARY KEY,
  department_id uuid REFERENCES public.departments
);
CREATE TABLE public.profiles (
  user_id uuid PRIMARY KEY,
  department_id uuid REFERENCES public.departments,
  team_id uuid REFERENCES public.teams,
  subdivision_id uuid REFERENCES public.subdivisions,
  employment_rate numeric,
  is_service boolean NOT NULL DEFAULT false
);

\ir ../migrations/20261124094052_employee_employment_history_storage.sql

CREATE TEMP TABLE storage_test_results (name text NOT NULL);
CREATE FUNCTION pg_temp.check_true(condition boolean, label text)
RETURNS void LANGUAGE plpgsql AS $$ BEGIN
  IF condition IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAILED: %', label; END IF;
  INSERT INTO storage_test_results VALUES (label);
END $$;
CREATE FUNCTION pg_temp.expect_error(command text, expected_state text, label text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE actual_state text;
BEGIN
  BEGIN
    EXECUTE command;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS actual_state = RETURNED_SQLSTATE;
  END;
  PERFORM pg_temp.check_true(actual_state = expected_state,
    label || ' (expected ' || expected_state || ', got ' || coalesce(actual_state, 'success') || ')');
END $$;

BEGIN ISOLATION LEVEL REPEATABLE READ;
SELECT pg_temp.expect_error(
  'SELECT public.initialize_employee_employment_history((clock_timestamp() AT TIME ZONE ''Europe/Minsk'')::date,''40000000-0000-0000-0000-000000000001'')',
  '25001','reject stale repeatable-read snapshot');
COMMIT;
BEGIN ISOLATION LEVEL SERIALIZABLE;
SELECT pg_temp.expect_error(
  'SELECT public.initialize_employee_employment_history((clock_timestamp() AT TIME ZONE ''Europe/Minsk'')::date,''40000000-0000-0000-0000-000000000001'')',
  '25001','require read-committed activation');
COMMIT;

BEGIN;
INSERT INTO public.subdivisions VALUES ('10000000-0000-0000-0000-000000000001');
INSERT INTO public.departments VALUES
  ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001');
INSERT INTO public.teams VALUES
  ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002');
INSERT INTO public.profiles VALUES
  ('40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',
   '30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',1,false),
  ('40000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001',
   NULL,'10000000-0000-0000-0000-000000000001',1.5,false),
  ('40000000-0000-0000-0000-000000000003',NULL,NULL,NULL,NULL,true);

DO $$
DECLARE
  today date := (statement_timestamp() AT TIME ZONE 'Europe/Minsk')::date;
  actor uuid := '40000000-0000-0000-0000-000000000001';
  init_sql text;
  overlap_sql text;
  rate text;
  api_role text;
  relation_name text;
BEGIN
  init_sql := format('SELECT public.initialize_employee_employment_history(%L::date,%L::uuid)', today, actor);
  PERFORM pg_temp.check_true(NOT EXISTS (SELECT FROM public.employment_history_settings), 'migration does not activate history');
  PERFORM pg_temp.expect_error(format('SELECT public.initialize_employee_employment_history(%L,%L)',today-1,actor),'22023','reject backdated activation');
  PERFORM pg_temp.expect_error(format('SELECT public.initialize_employee_employment_history(%L,%L)',today+1,actor),'22023','reject future activation');
  PERFORM pg_temp.expect_error(format('SELECT public.initialize_employee_employment_history(NULL,%L)',actor),'22023','require cutover');
  PERFORM pg_temp.expect_error(format('SELECT public.initialize_employee_employment_history(%L,NULL)',today),'22023','require operator');

  FOREACH rate IN ARRAY ARRAY['NULL','0','-1','''NaN''','''Infinity''','''-Infinity'''] LOOP
    EXECUTE 'UPDATE public.profiles SET employment_rate = ' || rate || ' WHERE user_id = ' || quote_literal(actor);
    PERFORM pg_temp.expect_error(init_sql,'23514','reject invalid rate ' || rate);
    PERFORM pg_temp.check_true(NOT EXISTS (SELECT FROM public.employee_employment_baseline), 'failed validation leaves no baseline ' || rate);
  END LOOP;
  UPDATE public.profiles SET employment_rate=1 WHERE user_id=actor;
  UPDATE public.profiles SET team_id='30000000-0000-0000-0000-000000000002' WHERE user_id=actor;
  PERFORM pg_temp.expect_error(init_sql,'23514','reject team from another department');
  UPDATE public.profiles SET team_id='30000000-0000-0000-0000-000000000001' WHERE user_id=actor;

  -- Failure AFTER copying the baseline must roll back the copy too.
  PERFORM pg_temp.expect_error(format('SELECT public.initialize_employee_employment_history(%L,%L)',today,'40000000-0000-0000-0000-000000000099'),'23503','unknown operator rolls back initialization');
  PERFORM pg_temp.check_true(NOT EXISTS (SELECT FROM public.employee_employment_baseline)
    AND NOT EXISTS (SELECT FROM public.employment_history_settings)
    AND NOT EXISTS (SELECT FROM public.employee_employment_periods), 'late failure is atomic');

  PERFORM pg_temp.check_true(public.initialize_employee_employment_history(today,actor)=2,'initialize exactly two real employees');
  SET CONSTRAINTS ALL IMMEDIATE;
  PERFORM pg_temp.check_true((SELECT count(*)=2 FROM public.employee_employment_baseline),'service account excluded');
  PERFORM pg_temp.check_true((SELECT sum(employment_rate)=2.5 FROM public.employee_employment_baseline),'fractional and above-one rates preserved');
  PERFORM pg_temp.check_true((SELECT count(*)=2 FROM public.employee_employment_periods WHERE valid_from=today AND valid_to IS NULL),'initial open periods created');
  PERFORM pg_temp.check_true((SELECT count(*)=1 FROM public.employee_employment_baseline WHERE team_id IS NULL),'employee without team retained');
  PERFORM pg_temp.expect_error(init_sql,'55000','repeated initialization rejected');
  PERFORM pg_temp.expect_error('UPDATE public.employment_history_settings SET cutover_date=cutover_date+1','55000','cutover immutable');
  PERFORM pg_temp.expect_error('DELETE FROM public.employment_history_settings','55000','settings delete blocked');
  PERFORM pg_temp.expect_error('TRUNCATE public.employment_history_settings CASCADE','55000','settings truncate blocked');
  PERFORM pg_temp.expect_error('UPDATE public.employee_employment_baseline SET employment_rate=0.5','55000','baseline update blocked');
  PERFORM pg_temp.expect_error('DELETE FROM public.employee_employment_baseline','55000','baseline delete blocked');
  PERFORM pg_temp.expect_error('TRUNCATE public.employee_employment_baseline','55000','baseline truncate blocked');

  INSERT INTO public.profiles VALUES ('40000000-0000-0000-0000-000000000004',NULL,NULL,NULL,1,false);
  PERFORM pg_temp.expect_error('INSERT INTO public.employee_employment_baseline(employee_id,employment_rate) VALUES (''40000000-0000-0000-0000-000000000004'',1)','55000','new hire cannot enter baseline');

  UPDATE public.profiles SET department_id='20000000-0000-0000-0000-000000000002',
    team_id='30000000-0000-0000-0000-000000000002',employment_rate=0.5,is_service=true WHERE user_id=actor;
  PERFORM pg_temp.check_true((SELECT department_id='20000000-0000-0000-0000-000000000001'
    AND team_id='30000000-0000-0000-0000-000000000001' AND employment_rate=1
    FROM public.employee_employment_baseline WHERE employee_id=actor),'current profile changes cannot alter historical base');

  overlap_sql := format('INSERT INTO public.employee_employment_periods(employee_id,employment_rate,valid_from,created_by,updated_by) VALUES (%L,1,%L,%L,%L)',actor,today,actor,actor);
  PERFORM pg_temp.expect_error(overlap_sql,'23P01','overlap rejected by database');
  PERFORM pg_temp.expect_error(format('UPDATE public.employee_employment_periods SET valid_from=%L WHERE employee_id=%L',today-1,actor),'23514','period cannot start before cutover');
  PERFORM pg_temp.expect_error('UPDATE public.employee_employment_periods SET valid_to=valid_from','23514','empty periods rejected');
  PERFORM pg_temp.expect_error('UPDATE public.employee_employment_periods SET employment_rate=''NaN''','23514','period NaN rejected');

  UPDATE public.employee_employment_periods SET valid_to=today+5 WHERE employee_id=actor;
  INSERT INTO public.employee_employment_periods(employee_id,employment_rate,valid_from,created_by,updated_by)
    VALUES (actor,0.5,today+5,actor,actor);
  PERFORM pg_temp.check_true((SELECT count(*)=1 FROM public.employee_employment_periods
    WHERE employee_id=actor AND daterange(valid_from,valid_to,'[)') @> (today+5)), 'adjacent periods share no day');
  UPDATE public.employee_employment_periods SET employment_rate=0.75 WHERE employee_id=actor AND valid_from=today+5;
  PERFORM pg_temp.check_true((SELECT count(*)=2 FROM public.employee_employment_periods WHERE employee_id=actor),'same-day correction needs no empty period');
  UPDATE public.employee_employment_periods SET valid_to=today+8 WHERE employee_id=actor AND valid_from=today+5;
  PERFORM pg_temp.check_true(NOT EXISTS (SELECT FROM public.employee_employment_periods
    WHERE employee_id=actor AND daterange(valid_from,valid_to,'[)') @> (today+8)), 'closed employment has no capacity after end');
  PERFORM pg_temp.expect_error(format('DELETE FROM public.profiles WHERE user_id=%L',actor),'23001','profile deletion cannot erase history');
  PERFORM pg_temp.expect_error('DELETE FROM public.teams WHERE team_id=''30000000-0000-0000-0000-000000000001''','23001','baseline prevents removal of historical team');

  FOREACH api_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    FOREACH relation_name IN ARRAY ARRAY['employment_history_settings','employee_employment_baseline','employee_employment_periods'] LOOP
      PERFORM pg_temp.check_true(NOT has_table_privilege(api_role,'public.' || relation_name,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE'),api_role || ' has no access to ' || relation_name);
    END LOOP;
    PERFORM pg_temp.check_true(NOT has_function_privilege(api_role,'public.initialize_employee_employment_history(date,uuid)','EXECUTE'),api_role || ' cannot activate history');
  END LOOP;
  PERFORM pg_temp.check_true((SELECT bool_and(relrowsecurity) FROM pg_class WHERE oid IN (
    'public.employment_history_settings'::regclass,'public.employee_employment_baseline'::regclass,
    'public.employee_employment_periods'::regclass)), 'RLS enabled for all storage tables');
END $$;

SELECT count(*) AS passed_storage_assertions FROM storage_test_results;
TABLE storage_test_results;
ROLLBACK;
