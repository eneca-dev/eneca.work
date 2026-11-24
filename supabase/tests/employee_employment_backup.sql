\set ON_ERROR_STOP on
-- Run ONLY after restoring a real backup into an isolated local cluster and
-- applying the four feature-VN-05 migrations. Never recreates public/Auth tables.
-- Every scenario, including activation, is rolled back.
DO $$ BEGIN
 IF inet_server_addr() IS DISTINCT FROM '127.0.0.1'::inet
   OR current_database() NOT LIKE 'enecawork_backup_%' THEN
  RAISE EXCEPTION 'Disposable local backup database required';
 END IF;
 IF EXISTS(SELECT FROM public.employment_history_settings) THEN
  RAISE EXCEPTION 'Expected restored backup before history activation';
 END IF;
 IF EXISTS(SELECT FROM pg_extension WHERE extname IN ('pg_net','http','pg_cron','dblink')) THEN
  RAISE EXCEPTION 'Network/background extensions must be absent';
 END IF;
END $$;
BEGIN;
SET LOCAL ROLE postgres;
CREATE TEMP TABLE backup_test_results(label text);
CREATE FUNCTION pg_temp.check_true(value boolean, label text) RETURNS void
LANGUAGE plpgsql AS $$ BEGIN
 IF value IS DISTINCT FROM true THEN RAISE EXCEPTION 'Assertion failed: %',label; END IF;
 INSERT INTO backup_test_results VALUES(label);
END $$;
CREATE FUNCTION pg_temp.expect_error(statement text, expected_state text, label text) RETURNS void
LANGUAGE plpgsql AS $$ BEGIN
 BEGIN EXECUTE statement;
 EXCEPTION WHEN OTHERS THEN
  IF SQLSTATE <> expected_state THEN RAISE; END IF;
  INSERT INTO backup_test_results VALUES(label); RETURN;
 END;
 RAISE EXCEPTION 'Expected error: %',label;
END $$;
GRANT INSERT ON backup_test_results TO authenticated,service_role,supabase_auth_admin;

-- Use real restored permissions; do not replace user_has_permission or auth.uid.
SELECT set_config('request.jwt.claim.sub',user_id::text,true) AS actor_context
FROM public.profiles p
WHERE public.user_has_permission(p.user_id,'users.edit.all')
 AND public.user_has_permission(p.user_id,'users.edit_salary.all')
 AND public.user_has_permission(p.user_id,'users.manage.departments')
 AND public.user_has_permission(p.user_id,'users.delete')
 AND p.is_service IS FALSE
ORDER BY user_id LIMIT 1 \gset
SELECT pg_temp.check_true(auth.uid() IS NOT NULL,'real privileged actor available');
SELECT public.initialize_employee_employment_history(
 (clock_timestamp() AT TIME ZONE 'Europe/Minsk')::date,auth.uid()) AS initial_count \gset
SELECT pg_temp.check_true(
 (SELECT count(*) FROM public.employee_employment_baseline)=
 (SELECT count(*) FROM public.profiles WHERE is_service IS NOT TRUE), 'baseline covers restored employees');
SELECT pg_temp.check_true(NOT EXISTS(
 SELECT FROM public.employee_employment_periods p JOIN public.employment_legacy_import_settings s
 ON p.department_id=s.archived_department_id),'archived employees excluded after cutover');
CREATE TEMP TABLE saved_baseline AS SELECT * FROM public.employee_employment_baseline;
CREATE TEMP TABLE saved_loadings AS SELECT * FROM public.loadings;
-- Production createUser supplies current reference IDs in metadata; old hardcoded
-- defaults inside Auth bootstrap may no longer exist in the restored directory.
SELECT jsonb_build_object('name','Local Backup Test','department_id',department_id,
 'team_id',team_id,'subdivision_id',subdivision_id,'position_id',position_id,'category_id',category_id)::text
 AS employee_metadata FROM public.profiles WHERE user_id=auth.uid() \gset

SET LOCAL ROLE supabase_auth_admin;
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
 ('70000000-0000-0000-0000-000000000001','backup-test-human@example.invalid',:'employee_metadata'),
 ('70000000-0000-0000-0000-000000000002','backup-test-import@example.invalid',:'employee_metadata');
SET LOCAL ROLE postgres;
SELECT pg_temp.check_true(NOT EXISTS(SELECT FROM public.employee_employment_periods
 WHERE employee_id IN ('70000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000002')),
 'real Auth bootstrap does not finalize history');
SET LOCAL ROLE authenticated;
SELECT public.register_employee_employment('70000000-0000-0000-0000-000000000001');
SELECT public.update_employee_employment('70000000-0000-0000-0000-000000000001','{"employment_rate":0.75}');
SET LOCAL ROLE postgres;
SELECT pg_temp.check_true((SELECT employment_rate=0.75 AND updated_by=auth.uid()
 FROM public.employee_employment_periods WHERE employee_id='70000000-0000-0000-0000-000000000001'),
 'authenticated create and rate update use real permissions');

SET LOCAL ROLE service_role;
UPDATE public.profiles SET employment_rate=0.5 WHERE user_id='70000000-0000-0000-0000-000000000002';
INSERT INTO public.user_roles(user_id,role_id) VALUES
 ('70000000-0000-0000-0000-000000000002','3ac4f27e-c94c-4b0d-b750-9fb6366b85bc');
SET LOCAL ROLE postgres;
SELECT pg_temp.check_true((SELECT employment_rate=0.5 AND created_source='system'
 FROM public.employee_employment_periods WHERE employee_id='70000000-0000-0000-0000-000000000002'),
 'real duplicate role import finalizes with final rate');

-- Local synthetic department avoids editing real employees even in this copy.
INSERT INTO public.subdivisions(subdivision_id,subdivision_name)
VALUES('71000000-0000-0000-0000-000000000001','Local backup test A'),
 ('71000000-0000-0000-0000-000000000002','Local backup test B');
INSERT INTO public.departments(department_id,department_name,subdivision_id)
VALUES('72000000-0000-0000-0000-000000000001','Local backup test', '71000000-0000-0000-0000-000000000001');
-- Existing department INSERT trigger creates its default team.
SELECT team_id::text AS local_team FROM public.teams
WHERE department_id='72000000-0000-0000-0000-000000000001' ORDER BY team_id LIMIT 1 \gset
SET LOCAL ROLE authenticated;
SELECT public.update_employee_employment('70000000-0000-0000-0000-000000000001',
 jsonb_build_object('department_id','72000000-0000-0000-0000-000000000001',
 'subdivision_id','71000000-0000-0000-0000-000000000001','team_id',:'local_team'));
UPDATE public.departments SET subdivision_id='71000000-0000-0000-0000-000000000002'
WHERE department_id='72000000-0000-0000-0000-000000000001';
SET LOCAL ROLE postgres;
SELECT pg_temp.check_true((SELECT p.subdivision_id=e.subdivision_id AND
 e.subdivision_id='71000000-0000-0000-0000-000000000002'::uuid
 FROM public.profiles p JOIN public.employee_employment_periods e ON p.user_id=e.employee_id
 WHERE p.user_id='70000000-0000-0000-0000-000000000001'),'department transfer retains matching period');

SET LOCAL ROLE authenticated;
SELECT public.finish_employee_employment('70000000-0000-0000-0000-000000000001');
SET LOCAL ROLE postgres;
SELECT pg_temp.check_true((SELECT valid_to=(clock_timestamp() AT TIME ZONE 'Europe/Minsk')::date+1
 FROM public.employee_employment_periods WHERE employee_id='70000000-0000-0000-0000-000000000001'),
 'human final day inclusive');
SELECT archived_department_id::text AS archive_department,archived_team_id::text AS archive_team
FROM public.employment_legacy_import_settings \gset
SET LOCAL ROLE service_role;
UPDATE public.profiles SET department_id=:'archive_department',team_id=:'archive_team'
WHERE user_id='70000000-0000-0000-0000-000000000002';
SET LOCAL ROLE postgres;
SELECT pg_temp.check_true((SELECT valid_to=(clock_timestamp() AT TIME ZONE 'Europe/Minsk')::date+1
 AND department_id IS DISTINCT FROM :'archive_department'::uuid AND updated_source='system'
 FROM public.employee_employment_periods WHERE employee_id='70000000-0000-0000-0000-000000000002'),
 'system archive retains former department and inclusive last day');

SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_error('UPDATE public.profiles SET employment_rate=4 WHERE user_id=''70000000-0000-0000-0000-000000000001''',
 '55000','direct edit cannot bypass history');
-- Real ordinary user, no fabricated permission implementation.
SELECT set_config('request.jwt.claim.sub','70000000-0000-0000-0000-000000000002',true) AS ordinary_context \gset
SELECT pg_temp.expect_error('SELECT public.finish_employee_employment(''70000000-0000-0000-0000-000000000001'')',
 '42501','ordinary account denied privileged finish');
SELECT pg_temp.expect_error('SELECT * FROM public.employee_employment_periods','42501','history not exposed to browser role');
SET LOCAL ROLE postgres;
SELECT pg_temp.check_true(NOT EXISTS((SELECT * FROM saved_baseline EXCEPT SELECT * FROM public.employee_employment_baseline)
 UNION ALL (SELECT * FROM public.employee_employment_baseline EXCEPT SELECT * FROM saved_baseline)), 'baseline unchanged');
SELECT pg_temp.check_true(NOT EXISTS((SELECT * FROM saved_loadings EXCEPT SELECT * FROM public.loadings)
 UNION ALL (SELECT * FROM public.loadings EXCEPT SELECT * FROM saved_loadings)), 'all real loadings unchanged');
SELECT count(*) AS backup_assertions_passed FROM backup_test_results;
ROLLBACK;
