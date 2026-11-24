\set ON_ERROR_STOP on
-- Empty disposable loopback database only; parent suites enforce the host/name guard.
\ir employee_employment_legacy_import.sql
\ir ../migrations/20261124123208_employee_employment_effective_dates.sql

BEGIN;
DELETE FROM storage_test_results;
SET LOCAL ROLE supabase_auth_admin;
INSERT INTO auth.users(id,email) VALUES
 ('50000000-0000-0000-0000-000000000001','dated-actor@example.test'),
 ('50000000-0000-0000-0000-000000000002','dated-employee@example.test'),
 ('50000000-0000-0000-0000-000000000003','dated-other@example.test');
RESET ROLE;
INSERT INTO public.test_employment_permissions VALUES
 ('50000000-0000-0000-0000-000000000001','users.edit.all'),
 ('50000000-0000-0000-0000-000000000001','users.edit_salary.all'),
 ('50000000-0000-0000-0000-000000000001','users.delete');

DO $$ DECLARE
 actor uuid := '50000000-0000-0000-0000-000000000001';
 employee uuid := '50000000-0000-0000-0000-000000000002';
 today date := (clock_timestamp() AT TIME ZONE 'Europe/Minsk')::date;
 ctx jsonb;
BEGIN
 PERFORM pg_temp.expect_error(format('SELECT public.get_employee_employment_edit_context(%L,''update'')',employee),'42501','anonymous context denied');
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 ctx := public.get_employee_employment_edit_context(employee,'update');
 PERFORM pg_temp.check_true(ctx=jsonb_build_object('enabled',false,'cutoverDate',NULL,'today',today,'periodId',NULL,'periodUpdatedAt',NULL,'minDate',NULL),'disabled context contract');
 PERFORM public.update_employee_employment(employee,'{"employment_rate":0.75}');
 PERFORM pg_temp.check_true((SELECT employment_rate=0.75 FROM public.profiles WHERE user_id=employee),'legacy writer works before activation');
 PERFORM pg_temp.expect_error(format('SELECT public.update_employee_employment_dated(%L,''{"employment_rate":1}'',%L,NULL,NULL)',employee,today),'55000','dated writer requires activation');
 PERFORM public.update_employee_employment(employee,'{"employment_rate":1}');
END $$;

-- Synthetic historical fixture: no clock spoofing and no mutation of a live baseline.
INSERT INTO public.employee_employment_baseline(employee_id,department_id,team_id,subdivision_id,employment_rate)
SELECT user_id,department_id,team_id,subdivision_id,employment_rate FROM public.profiles;
INSERT INTO public.employment_history_settings(cutover_date,initialized_by)
VALUES((clock_timestamp() AT TIME ZONE 'Europe/Minsk')::date-10,'50000000-0000-0000-0000-000000000001');
INSERT INTO public.employee_employment_periods(employee_id,department_id,team_id,subdivision_id,employment_rate,valid_from,created_by,updated_by)
SELECT user_id,department_id,team_id,subdivision_id,employment_rate,
 (clock_timestamp() AT TIME ZONE 'Europe/Minsk')::date-10,
 '50000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001' FROM public.profiles;
CREATE TEMP TABLE expected_baseline AS TABLE public.employee_employment_baseline;

DO $$ DECLARE
 actor uuid := '50000000-0000-0000-0000-000000000001';
 employee uuid := '50000000-0000-0000-0000-000000000002';
 stranger uuid := '50000000-0000-0000-0000-000000000003';
 today date := (clock_timestamp() AT TIME ZONE 'Europe/Minsk')::date;
 ctx jsonb;
 fresh_ctx jsonb;
 id uuid;
 revision timestamptz;
 command text;
BEGIN
 ctx := public.get_employee_employment_edit_context(employee,'update');
 id := (ctx->>'periodId')::uuid;
 revision := (ctx->>'periodUpdatedAt')::timestamptz;
 PERFORM pg_temp.check_true((ctx->>'minDate')::date=today-10 AND (ctx->>'enabled')::boolean,'context exposes bounded date and exact revision');
 PERFORM pg_temp.check_true((SELECT count(*)=6 FROM jsonb_object_keys(ctx)),'context contains only six declared metadata fields');
 PERFORM pg_temp.expect_error(format('SELECT public.get_employee_employment_edit_context(%L,''invalid'')',employee),'22023','unknown operation denied');
 PERFORM set_config('request.jwt.claim.sub',stranger::text,true);
 PERFORM pg_temp.expect_error(format('SELECT public.get_employee_employment_edit_context(%L,''update'')',employee),'42501','unauthorized context denied');
 PERFORM pg_temp.expect_error(format('SELECT public.update_employee_employment_dated(%L,''{}'',%L,%L,%L)',employee,today,id,revision),'42501','no-op does not bypass authorization');
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 PERFORM pg_temp.expect_error(format('SELECT public.get_employee_employment_edit_context(%L,''finish'')',actor),'42501','self finish context denied');
 PERFORM pg_temp.expect_error(format('SELECT public.update_employee_employment_dated(%L,''{"employment_rate":0.5}'',NULL,%L,%L)',employee,id,revision),'22023','null date rejected');
 PERFORM pg_temp.expect_error(format('SELECT public.update_employee_employment_dated(%L,''{"employment_rate":0.5}'',''infinity'',%L,%L)',employee,id,revision),'22023','infinite date rejected');
 PERFORM pg_temp.expect_error(format('SELECT public.update_employee_employment_dated(%L,''{"employment_rate":0.5}'',%L,%L,%L)',employee,today+1,id,revision),'22023','future date rejected');
 PERFORM pg_temp.expect_error(format('SELECT public.update_employee_employment_dated(%L,''{"employment_rate":0.5}'',%L,%L,%L)',employee,today-11,id,revision),'22023','before cutover rejected');
 PERFORM pg_temp.expect_error(format('SELECT public.update_employee_employment_dated(%L,''{"employment_rate":0.5}'',%L,NULL,NULL)',employee,today),'40001','revision required');
 PERFORM pg_temp.expect_error(format('SELECT public.update_employee_employment_dated(%L,''{"employment_rate":0.5}'',%L,%L,%L)',employee,today,stranger,revision),'40001','wrong period rejected');
 PERFORM public.update_employee_employment_dated(employee,'{"employment_rate":0.5}',today-3,id,revision);
 PERFORM pg_temp.check_true((SELECT count(*)=2 FROM public.employee_employment_periods WHERE employee_id=employee),'retrospective rate splits one interval');
 PERFORM pg_temp.check_true((SELECT valid_from=today-10 AND valid_to=today-3 AND employment_rate=1 FROM public.employee_employment_periods WHERE employee_id=employee AND valid_to IS NOT NULL),'earlier capacity preserved');
 PERFORM pg_temp.check_true((SELECT employment_rate=0.5 FROM public.profiles WHERE user_id=employee),'profile matches new active state');
 fresh_ctx := public.get_employee_employment_edit_context(employee,'update');
 PERFORM pg_temp.check_true((fresh_ctx->>'minDate')::date=today-3,'new lower date bound is latest event');
 PERFORM pg_temp.expect_error(format('SELECT public.update_employee_employment_dated(%L,''{"employment_rate":0.75}'',%L,%L,%L)',employee,today,id,revision),'40001','stale pre-split form rejected');
 id := (fresh_ctx->>'periodId')::uuid;
 revision := (fresh_ctx->>'periodUpdatedAt')::timestamptz;
 PERFORM pg_temp.expect_error(format('SELECT public.update_employee_employment_dated(%L,''{"employment_rate":0.75}'',%L,%L,%L)',employee,today-4,id,revision),'55000','cannot cross later employment event');
 PERFORM public.update_employee_employment_dated(employee,'{"employment_rate":0.75}',today-3,id,revision);
 fresh_ctx := public.get_employee_employment_edit_context(employee,'update');
 PERFORM pg_temp.check_true((fresh_ctx->>'periodId')::uuid=id AND (fresh_ctx->>'periodUpdatedAt')::timestamptz>revision,'same-start update retains ID and advances revision');
 PERFORM pg_temp.expect_error(format('SELECT public.finish_employee_employment_dated(%L,%L,%L,%L)',employee,today,id,revision),'40001','finish rejects stale same-start revision');
 revision := (fresh_ctx->>'periodUpdatedAt')::timestamptz;
 PERFORM public.update_employee_employment_dated(employee,'{}',today,id,revision);
 PERFORM pg_temp.check_true(public.get_employee_employment_edit_context(employee,'update')=fresh_ctx,'no-op preserves revision');

 DELETE FROM public.test_employment_permissions WHERE user_id=actor AND permission='users.edit_salary.all';
 PERFORM pg_temp.expect_error(format('SELECT public.update_employee_employment_dated(%L,''{"employment_rate":1}'',%L,%L,%L)',employee,today,id,revision),'42501','organization edit does not grant salary edit');
 INSERT INTO public.test_employment_permissions VALUES(actor,'users.edit_salary.all');

 PERFORM pg_temp.expect_error(format('SELECT public.finish_employee_employment_dated(%L,%L,%L,%L)',employee,today-4,id,revision),'55000','finish cannot cross latest change');
 PERFORM pg_temp.expect_error(format('SELECT public.finish_employee_employment_dated(%L,%L,%L,%L)',employee,today+1,id,revision),'22023','future finish rejected');
 PERFORM public.finish_employee_employment_dated(employee,today-1,id,revision);
 PERFORM pg_temp.check_true((SELECT valid_to=today AND valid_from=today-3 FROM public.employee_employment_periods WHERE employee_id=employee AND valid_from=today-3),'last working day is inclusive');
 PERFORM pg_temp.check_true(EXISTS(SELECT FROM public.profiles WHERE user_id=employee),'finish retains profile');
 PERFORM pg_temp.expect_error(format('SELECT public.get_employee_employment_edit_context(%L,''update'')',employee),'55000','finished employee has no editable context');
 PERFORM pg_temp.expect_error(format('SELECT public.finish_employee_employment_dated(%L,%L,%L,%L)',employee,today,id,revision),'55000','closed period cannot be changed by dated finish');
 PERFORM public.finish_employee_employment(employee);
 PERFORM pg_temp.check_true((SELECT valid_to=today FROM public.employee_employment_periods WHERE employee_id=employee AND valid_from=today-3),'legacy repeat finish does not reopen history');
 PERFORM pg_temp.check_true(NOT EXISTS((TABLE public.employee_employment_baseline EXCEPT TABLE expected_baseline) UNION ALL (TABLE expected_baseline EXCEPT TABLE public.employee_employment_baseline)),'baseline unchanged');
 PERFORM pg_temp.check_true(NOT has_function_privilege('authenticated','public.update_employee_employment_internal(uuid,jsonb,date,uuid,timestamp with time zone,boolean)','EXECUTE'),'private update cannot bypass revision');
 PERFORM pg_temp.check_true(NOT has_function_privilege('authenticated','public.finish_employee_employment_internal(uuid,date,uuid,timestamp with time zone,boolean)','EXECUTE'),'private finish cannot bypass revision');
 PERFORM pg_temp.check_true(NOT has_function_privilege('anon','public.get_employee_employment_edit_context(uuid,text)','EXECUTE'),'anonymous context ACL denied');
 PERFORM pg_temp.check_true(NOT has_function_privilege('service_role','public.update_employee_employment_dated(uuid,jsonb,date,uuid,timestamp with time zone)','EXECUTE'),'service role has no explicit dated RPC');
END $$;

SELECT count(*) AS effective_date_assertions FROM storage_test_results;
ROLLBACK;

-- Independent transaction: realistic scoped transfers, importer and atomic failures.
BEGIN;
DELETE FROM storage_test_results;
SET LOCAL ROLE supabase_auth_admin;
INSERT INTO auth.users(id,email) VALUES
 ('51000000-0000-0000-0000-000000000001','scoped-actor@example.test'),
 ('51000000-0000-0000-0000-000000000002','scoped-employee@example.test');
RESET ROLE;
INSERT INTO public.subdivisions VALUES('10000000-0000-0000-0000-000000000002');
INSERT INTO public.departments(department_id,subdivision_id) VALUES
 ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001'),
 ('20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002');
INSERT INTO public.teams(team_id,department_id) VALUES
 ('30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002');
INSERT INTO public.test_employment_permissions VALUES
 ('51000000-0000-0000-0000-000000000001','users.edit.subdivision'),
 ('51000000-0000-0000-0000-000000000001','users.edit_salary.subdivision'),
 ('51000000-0000-0000-0000-000000000001','users.delete');
INSERT INTO public.employee_employment_baseline(employee_id,department_id,team_id,subdivision_id,employment_rate)
SELECT user_id,department_id,team_id,subdivision_id,employment_rate FROM public.profiles;
INSERT INTO public.employment_history_settings(cutover_date,initialized_by)
VALUES((clock_timestamp() AT TIME ZONE 'Europe/Minsk')::date-10,'51000000-0000-0000-0000-000000000001');
INSERT INTO public.employee_employment_periods(employee_id,department_id,team_id,subdivision_id,employment_rate,valid_from,created_by,updated_by)
SELECT user_id,department_id,team_id,subdivision_id,employment_rate,
 (clock_timestamp() AT TIME ZONE 'Europe/Minsk')::date-10,
 '51000000-0000-0000-0000-000000000001','51000000-0000-0000-0000-000000000001' FROM public.profiles;
SELECT set_config('request.jwt.claim.sub','51000000-0000-0000-0000-000000000001',true);
CREATE FUNCTION pg_temp.reject_test_rate() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.employment_rate=0.99 THEN RAISE EXCEPTION 'Synthetic profile write failure' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER reject_test_rate BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION pg_temp.reject_test_rate();

DO $$ DECLARE
 employee uuid := '51000000-0000-0000-0000-000000000002';
 actor uuid := '51000000-0000-0000-0000-000000000001';
 today date := (clock_timestamp() AT TIME ZONE 'Europe/Minsk')::date;
 ctx jsonb;
 changes jsonb;
 snapshot jsonb;
BEGIN
 ctx := public.get_employee_employment_edit_context(employee,'update');
 SELECT jsonb_agg(to_jsonb(p) ORDER BY p.valid_from) INTO snapshot FROM public.employee_employment_periods p WHERE employee_id=employee;
 PERFORM pg_temp.expect_error(format('SELECT public.update_employee_employment_dated(%L,''{"employment_rate":0.99}'',%L,%L,%L)',employee,today-5,ctx->>'periodId',ctx->>'periodUpdatedAt'),'23514','late profile failure rejects operation');
 PERFORM pg_temp.check_true((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.valid_from)=snapshot FROM public.employee_employment_periods p WHERE employee_id=employee),'late failure rolls back all period writes');
 PERFORM pg_temp.check_true((SELECT employment_rate=1 FROM public.profiles WHERE user_id=employee),'late failure preserves profile');
 changes := '{"department_id":"20000000-0000-0000-0000-000000000003","team_id":null,"subdivision_id":"10000000-0000-0000-0000-000000000002"}';
 PERFORM pg_temp.expect_error(format('SELECT public.update_employee_employment_dated(%L,%L,%L,%L,%L)',employee,changes,today-5,ctx->>'periodId',ctx->>'periodUpdatedAt'),'42501','subdivision actor cannot move outside permitted scope');
 changes := '{"department_id":"20000000-0000-0000-0000-000000000002","team_id":"30000000-0000-0000-0000-000000000002","subdivision_id":"10000000-0000-0000-0000-000000000001"}';
 PERFORM public.update_employee_employment_dated(employee,changes,today-5,(ctx->>'periodId')::uuid,(ctx->>'periodUpdatedAt')::timestamptz);
 PERFORM pg_temp.check_true((SELECT department_id='42c93225-0ac5-41fe-820a-5ecbe33b5e2d'::uuid AND valid_to=today-5 FROM public.employee_employment_periods WHERE employee_id=employee AND valid_to IS NOT NULL),'transfer preserves old department through preceding day');
 PERFORM pg_temp.check_true((SELECT department_id='20000000-0000-0000-0000-000000000002'::uuid FROM public.profiles WHERE user_id=employee),'transfer updates current profile');
 ctx := public.get_employee_employment_edit_context(employee,'finish');
 PERFORM public.finish_employee_employment_dated(employee,today-5,(ctx->>'periodId')::uuid,(ctx->>'periodUpdatedAt')::timestamptz);
 PERFORM pg_temp.check_true((SELECT valid_to=valid_from+1 FROM public.employee_employment_periods WHERE employee_id=employee AND valid_from=today-5),'finish on first day retains one inclusive working day');
 SELECT jsonb_agg(to_jsonb(p) ORDER BY p.valid_from) INTO snapshot FROM public.employee_employment_periods p WHERE employee_id=employee;
 PERFORM set_config('role','service_role',true);
 UPDATE public.profiles SET department_id='20000000-0000-0000-0000-000000000099',team_id='30000000-0000-0000-0000-000000000099' WHERE user_id=employee;
 PERFORM set_config('role','none',true);
 PERFORM pg_temp.check_true((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.valid_from)=snapshot FROM public.employee_employment_periods p WHERE employee_id=employee),'legacy archive does not reopen retrospective finish');
END $$;

-- Run through actual authenticated ACL as well as auth.uid checks.
SET LOCAL ROLE authenticated;
SELECT public.get_employee_employment_edit_context('51000000-0000-0000-0000-000000000001','update');
SELECT public.update_employee_employment_dated('51000000-0000-0000-0000-000000000001','{"employment_rate":0.5}',
 (clock_timestamp() AT TIME ZONE 'Europe/Minsk')::date,
 (public.get_employee_employment_edit_context('51000000-0000-0000-0000-000000000001','update')->>'periodId')::uuid,
 (public.get_employee_employment_edit_context('51000000-0000-0000-0000-000000000001','update')->>'periodUpdatedAt')::timestamptz);
RESET ROLE;
SELECT pg_temp.check_true((SELECT employment_rate=0.5 FROM public.profiles WHERE user_id='51000000-0000-0000-0000-000000000001'),'authenticated entry point executes with checked permissions');
SELECT count(*) AS effective_date_integration_assertions FROM storage_test_results;
ROLLBACK;
