\set ON_ERROR_STOP on
-- Disposable loopback database only; parent fixture enforces host/name guard.
\ir employee_employment_operations.sql
ALTER TABLE public.profiles ADD COLUMN email text;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
CREATE TABLE public.employee_loading_access_grants (employee_id uuid, granted_to_department_id uuid);
\ir fixtures/employment_profile_triggers.sql
\ir ../migrations/20261124094116_employee_employment_department_transfer.sql

BEGIN;
DELETE FROM storage_test_results;
INSERT INTO public.subdivisions VALUES
 ('10000000-0000-0000-0000-000000000001'),('10000000-0000-0000-0000-000000000002');
INSERT INTO public.departments VALUES
 ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001'),
 ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001');
INSERT INTO public.teams VALUES
 ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001');
INSERT INTO auth.users VALUES
 ('40000000-0000-0000-0000-000000000001','actor@example.test'),
 ('40000000-0000-0000-0000-000000000002','employee@example.test');
INSERT INTO public.profiles(user_id,department_id,team_id,employment_rate) VALUES
 ('40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',1),
 ('40000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',0.5);

-- Before activation retain legacy propagation and don't create history implicitly.
UPDATE public.departments SET subdivision_id='10000000-0000-0000-0000-000000000002'
WHERE department_id='20000000-0000-0000-0000-000000000001';
SELECT pg_temp.check_true((SELECT bool_and(subdivision_id='10000000-0000-0000-0000-000000000002'::uuid) FROM public.profiles),'legacy propagation before activation');
SELECT pg_temp.check_true(NOT EXISTS(SELECT FROM public.employee_employment_periods),'legacy transfer creates no implicit history');
UPDATE public.departments SET subdivision_id='10000000-0000-0000-0000-000000000001'
WHERE department_id='20000000-0000-0000-0000-000000000001';
SELECT public.initialize_employee_employment_history((clock_timestamp() AT TIME ZONE 'Europe/Minsk')::date,'40000000-0000-0000-0000-000000000001');

DO $$ DECLARE
 actor uuid := '40000000-0000-0000-0000-000000000001';
 employee uuid := '40000000-0000-0000-0000-000000000002';
 move_sql text := 'UPDATE public.departments SET subdivision_id=''10000000-0000-0000-0000-000000000002'' WHERE department_id=''20000000-0000-0000-0000-000000000001''';
BEGIN
 PERFORM pg_temp.expect_error(move_sql,'42501','anonymous transfer rejected after activation');
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 PERFORM pg_temp.expect_error(move_sql,'42501','authenticated user without department permission rejected');
 INSERT INTO public.test_employment_permissions VALUES(actor,'users.edit.all');
 PERFORM pg_temp.expect_error(move_sql,'42501','employee edit permission does not imply department management');
 INSERT INTO public.test_employment_permissions VALUES(actor,'users.manage.departments'),(actor,'users.edit_salary.all'),(actor,'users.create'),(actor,'users.delete');
 PERFORM public.update_employee_employment(employee,'{"employment_rate":0.75}');
 EXECUTE move_sql;
 PERFORM pg_temp.check_true((SELECT count(*)=2 AND bool_and(subdivision_id='10000000-0000-0000-0000-000000000002'::uuid) FROM public.employee_employment_periods),'same-day transfer updates periods without duplication');
 PERFORM pg_temp.check_true((SELECT employment_rate=0.75 AND department_id='20000000-0000-0000-0000-000000000001'::uuid AND team_id='30000000-0000-0000-0000-000000000001'::uuid FROM public.profiles WHERE user_id=employee),'transfer keeps rate department and team');
 PERFORM pg_temp.check_true((SELECT bool_and(subdivision_id='10000000-0000-0000-0000-000000000001'::uuid) FROM public.employee_employment_baseline),'baseline subdivision unchanged');
 PERFORM pg_temp.check_true((SELECT employment_rate=0.5 FROM public.employee_employment_baseline WHERE employee_id=employee),'baseline rate unchanged');
 PERFORM pg_temp.check_true((SELECT bool_and(updated_by=actor) FROM public.employee_employment_periods),'actor recorded');
 PERFORM pg_temp.expect_error(format('UPDATE public.profiles SET employment_rate=2 WHERE user_id=%L',employee),'55000','direct profile guard remains enabled');
 DELETE FROM public.test_employment_permissions WHERE permission='users.manage.departments';
 UPDATE public.departments SET subdivision_id=subdivision_id;
 PERFORM pg_temp.check_true(true,'unchanged subdivision needs no history operation');
 INSERT INTO public.test_employment_permissions VALUES(actor,'users.manage.departments');
END $$;

-- Controlled local time fixture; no production baseline is ever rewritten.
ALTER TABLE public.employment_history_settings DISABLE TRIGGER employment_history_settings_immutable;
UPDATE public.employment_history_settings SET cutover_date=cutover_date-3;
ALTER TABLE public.employment_history_settings ENABLE TRIGGER employment_history_settings_immutable;
UPDATE public.employee_employment_periods SET valid_from=valid_from-2;
SELECT public.finish_employee_employment('40000000-0000-0000-0000-000000000002');

-- Include ended, service and not-yet-registered profiles in the structural move.
INSERT INTO auth.users VALUES
 ('40000000-0000-0000-0000-000000000003','ended@example.test'),
 ('40000000-0000-0000-0000-000000000004','service@example.test'),
 ('40000000-0000-0000-0000-000000000005','bootstrap@example.test');
INSERT INTO public.profiles(user_id,department_id,team_id,employment_rate,is_service) VALUES
 ('40000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',1,false),
 ('40000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',1,true),
 ('40000000-0000-0000-0000-000000000005','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',1,false);
SELECT public.register_employee_employment('40000000-0000-0000-0000-000000000003');
UPDATE public.employee_employment_periods SET valid_from=valid_from-2,valid_to=valid_from
WHERE employee_id='40000000-0000-0000-0000-000000000003';

UPDATE public.departments SET subdivision_id='10000000-0000-0000-0000-000000000001'
WHERE department_id='20000000-0000-0000-0000-000000000001';
SELECT pg_temp.check_true((SELECT count(*)=4 FROM public.employee_employment_periods WHERE employee_id IN ('40000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000002')),'later-day transfer splits each active period');
SELECT pg_temp.check_true((SELECT count(*)=2 AND bool_and(subdivision_id='10000000-0000-0000-0000-000000000002'::uuid) FROM public.employee_employment_periods WHERE employee_id IN ('40000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000002') AND valid_to=(clock_timestamp() AT TIME ZONE 'Europe/Minsk')::date),'earlier intervals preserve old subdivision');
SELECT pg_temp.check_true((SELECT valid_to=(clock_timestamp() AT TIME ZONE 'Europe/Minsk')::date+1 FROM public.employee_employment_periods WHERE employee_id='40000000-0000-0000-0000-000000000002' AND valid_from=(clock_timestamp() AT TIME ZONE 'Europe/Minsk')::date),'last-day employee is not reopened by transfer');
SELECT pg_temp.check_true((SELECT subdivision_id='10000000-0000-0000-0000-000000000002'::uuid FROM public.profiles WHERE user_id='40000000-0000-0000-0000-000000000003'),'ended profile remains historical');
SELECT pg_temp.check_true((SELECT count(*)=1 AND bool_and(valid_to=(clock_timestamp() AT TIME ZONE 'Europe/Minsk')::date) FROM public.employee_employment_periods WHERE employee_id='40000000-0000-0000-0000-000000000003'),'ended interval unchanged');
SELECT pg_temp.check_true((SELECT bool_and(subdivision_id='10000000-0000-0000-0000-000000000001'::uuid) FROM public.profiles WHERE user_id IN ('40000000-0000-0000-0000-000000000004','40000000-0000-0000-0000-000000000005')),'service and bootstrap metadata follow department');
SELECT pg_temp.check_true(NOT EXISTS(SELECT FROM public.employee_employment_periods WHERE employee_id IN ('40000000-0000-0000-0000-000000000004','40000000-0000-0000-0000-000000000005')),'metadata propagation does not implicitly register employees');
SELECT public.register_employee_employment('40000000-0000-0000-0000-000000000005');
SELECT pg_temp.check_true((SELECT subdivision_id='10000000-0000-0000-0000-000000000001'::uuid FROM public.employee_employment_periods WHERE employee_id='40000000-0000-0000-0000-000000000005'),'subsequent registration uses transferred department');

-- Corrupt one fixture period to prove all-or-nothing even after earlier rows changed.
UPDATE public.employee_employment_periods SET employment_rate=3
WHERE employee_id='40000000-0000-0000-0000-000000000005';
SELECT pg_temp.expect_error('UPDATE public.departments SET subdivision_id=''10000000-0000-0000-0000-000000000002'' WHERE department_id=''20000000-0000-0000-0000-000000000001''','55000','inconsistent member aborts whole department move');
SELECT pg_temp.check_true((SELECT subdivision_id='10000000-0000-0000-0000-000000000001'::uuid FROM public.departments WHERE department_id='20000000-0000-0000-0000-000000000001'),'failed move rolls back department');
SELECT pg_temp.check_true((SELECT subdivision_id='10000000-0000-0000-0000-000000000001'::uuid FROM public.employee_employment_periods WHERE employee_id='40000000-0000-0000-0000-000000000001' AND valid_to IS NULL),'failed move rolls back earlier employee history');
UPDATE public.employee_employment_periods SET employment_rate=1 WHERE employee_id='40000000-0000-0000-0000-000000000005';

-- Real authenticated role can use the ordinary department UPDATE, without any
-- history-table privileges or permission to invoke the trigger as an RPC.
GRANT SELECT, UPDATE ON public.departments TO authenticated;
SET LOCAL ROLE authenticated;
UPDATE public.departments SET subdivision_id='10000000-0000-0000-0000-000000000002'
WHERE department_id='20000000-0000-0000-0000-000000000001';
RESET ROLE;
SELECT pg_temp.check_true((SELECT subdivision_id='10000000-0000-0000-0000-000000000002'::uuid FROM public.employee_employment_periods WHERE employee_id='40000000-0000-0000-0000-000000000001' AND valid_to IS NULL),'authenticated department update maintains private history');
SELECT pg_temp.check_true(NOT has_function_privilege('authenticated','public.sync_employee_subdivision()','EXECUTE'),'trigger not exposed as authenticated RPC');
SELECT pg_temp.check_true(NOT has_function_privilege('anon','public.sync_employee_subdivision()','EXECUTE'),'trigger not exposed as anonymous RPC');
SELECT pg_temp.check_true(NOT has_table_privilege('authenticated','public.employee_employment_periods','SELECT,UPDATE'),'private history stays inaccessible');
SELECT count(*) AS department_transfer_assertions_passed FROM storage_test_results;
ROLLBACK;
