\set ON_ERROR_STOP on
-- Only a new disposable loopback database. Parent suites enforce the guard.
\ir employee_employment_department_transfer.sql
DO $$ BEGIN
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='supabase_auth_admin') THEN CREATE ROLE supabase_auth_admin; END IF;
END $$;
ALTER TABLE public.departments ADD COLUMN department_name text;
ALTER TABLE public.teams ADD COLUMN team_name text;
ALTER TABLE public.profiles
 ADD COLUMN first_name text NOT NULL DEFAULT '', ADD COLUMN last_name text NOT NULL DEFAULT '',
 ADD COLUMN position_id uuid, ADD COLUMN category_id uuid,
 ADD COLUMN salary numeric DEFAULT 0, ADD COLUMN is_hourly boolean DEFAULT true,
 ADD COLUMN created_at timestamptz DEFAULT now(),
 ADD CONSTRAINT profiles_auth_fixture_fk FOREIGN KEY(user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE auth.users ADD COLUMN raw_user_meta_data jsonb DEFAULT '{}';
ALTER TABLE public.user_roles
 ADD CONSTRAINT test_user_roles_profile_fk FOREIGN KEY(user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE,
 ADD CONSTRAINT test_user_roles_actor_fk FOREIGN KEY(assigned_by) REFERENCES public.profiles(user_id);
\ir fixtures/employment_auth_signup.sql
GRANT USAGE ON SCHEMA public,auth TO supabase_auth_admin,service_role,authenticated,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON auth.users TO supabase_auth_admin;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.profiles,public.user_roles TO service_role,authenticated,anon;
GRANT SELECT ON public.departments,public.teams TO service_role,authenticated,anon;
GRANT SELECT,DELETE ON public.employee_loading_access_grants TO service_role,authenticated,anon;

-- UUIDs for default reference entities mirror the live bootstrap function, not
-- employee data. Everything is created in this disposable local database.
INSERT INTO public.subdivisions VALUES('10000000-0000-0000-0000-000000000001');
INSERT INTO public.departments(department_id,subdivision_id,department_name) VALUES
 ('42c93225-0ac5-41fe-820a-5ecbe33b5e2d','10000000-0000-0000-0000-000000000001','Working'),
 ('20000000-0000-0000-0000-000000000099','10000000-0000-0000-0000-000000000001','Удалены');
INSERT INTO public.teams(team_id,department_id,team_name) VALUES
 ('983b9ae6-6bcf-472d-ba26-eee2e4673787','42c93225-0ac5-41fe-820a-5ecbe33b5e2d','Working - Общая'),
 ('30000000-0000-0000-0000-000000000099','20000000-0000-0000-0000-000000000099','Удалены - Общая');
INSERT INTO public.roles VALUES('3ac4f27e-c94c-4b0d-b750-9fb6366b85bc'),('60000000-0000-0000-0000-000000000002');
\ir ../migrations/20261124094128_employee_employment_legacy_import.sql

BEGIN;
DELETE FROM storage_test_results;
GRANT INSERT ON storage_test_results TO service_role,authenticated,anon;
-- Auth bootstrap uses a separate DB role, not the PostgREST service role.
SET LOCAL ROLE supabase_auth_admin;
INSERT INTO auth.users(id,email) VALUES('40000000-0000-0000-0000-000000000001','actor@example.test');
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES('40000000-0000-0000-0000-000000000007','archived@example.test',
 '{"department_id":"20000000-0000-0000-0000-000000000099","team_id":"30000000-0000-0000-0000-000000000099"}');
RESET ROLE;
SELECT pg_temp.check_true(NOT EXISTS(SELECT FROM public.employee_employment_periods),'no history before activation');
SELECT set_config('request.jwt.claim.sub','40000000-0000-0000-0000-000000000001',true);
INSERT INTO public.test_employment_permissions VALUES
 ('40000000-0000-0000-0000-000000000001','users.create'),
 ('40000000-0000-0000-0000-000000000001','users.edit_salary.all'),
 ('40000000-0000-0000-0000-000000000001','users.delete');
SELECT public.initialize_employee_employment_history((clock_timestamp() AT TIME ZONE 'Europe/Minsk')::date,'40000000-0000-0000-0000-000000000001');
SELECT pg_temp.check_true(EXISTS(SELECT FROM public.employee_employment_baseline WHERE employee_id='40000000-0000-0000-0000-000000000007'),'initial archive retains baseline for earlier dates');
SELECT pg_temp.check_true(NOT EXISTS(SELECT FROM public.employee_employment_periods WHERE employee_id='40000000-0000-0000-0000-000000000007'),'initial archive has no active or future employment');
SELECT pg_temp.expect_error('SELECT public.register_employee_employment(''40000000-0000-0000-0000-000000000007'')','55000','register does not rehire archived baseline employee');
SET LOCAL ROLE service_role;
SELECT pg_temp.expect_error('UPDATE public.profiles SET department_id=''42c93225-0ac5-41fe-820a-5ecbe33b5e2d'',team_id=''983b9ae6-6bcf-472d-ba26-eee2e4673787'' WHERE user_id=''40000000-0000-0000-0000-000000000007''','55000','baseline archive is not a mutable bootstrap profile');
INSERT INTO public.user_roles(user_id,role_id) VALUES('40000000-0000-0000-0000-000000000007','60000000-0000-0000-0000-000000000002');
RESET ROLE;
SELECT pg_temp.check_true(NOT EXISTS(SELECT FROM public.employee_employment_periods WHERE employee_id='40000000-0000-0000-0000-000000000007'),'role assignment does not rehire initial archive');

SET LOCAL ROLE supabase_auth_admin;
INSERT INTO auth.users(id,email) VALUES
 ('40000000-0000-0000-0000-000000000002','import@example.test'),
 ('40000000-0000-0000-0000-000000000003','failed@example.test'),
 ('40000000-0000-0000-0000-000000000004','normal@example.test'),
 ('40000000-0000-0000-0000-000000000005','invalid@example.test'),
 ('40000000-0000-0000-0000-000000000006','extra-role@example.test');
RESET ROLE;
SELECT pg_temp.check_true((SELECT count(*)=1 FROM public.employee_employment_periods),'Auth profiles and default roles do not finalize imports');
SELECT pg_temp.check_true((SELECT count(*)=7 FROM public.user_roles WHERE role_id='3ac4f27e-c94c-4b0d-b750-9fb6366b85bc'),'Auth assigns default roles before importer finalization');
SET LOCAL ROLE supabase_auth_admin;
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES('40000000-0000-0000-0000-000000000008','new-archive@example.test',
 '{"department_id":"20000000-0000-0000-0000-000000000099","team_id":"30000000-0000-0000-0000-000000000099"}');
RESET ROLE;
SELECT pg_temp.expect_error('SELECT public.register_employee_employment(''40000000-0000-0000-0000-000000000008'')','55000','register refuses new archived profile too');

SET LOCAL ROLE service_role;
-- Actual profile upsert path: BEFORE INSERT triggers then ON CONFLICT UPDATE.
INSERT INTO public.profiles(user_id,department_id,team_id,employment_rate,first_name,last_name,salary)
VALUES('40000000-0000-0000-0000-000000000002','42c93225-0ac5-41fe-820a-5ecbe33b5e2d','983b9ae6-6bcf-472d-ba26-eee2e4673787',0.75,'Test','Employee',25)
ON CONFLICT(user_id) DO UPDATE SET department_id=excluded.department_id,team_id=excluded.team_id,
 employment_rate=excluded.employment_rate,first_name=excluded.first_name,last_name=excluded.last_name,salary=excluded.salary;
RESET ROLE;
SELECT pg_temp.check_true(NOT EXISTS(SELECT FROM public.employee_employment_periods WHERE employee_id='40000000-0000-0000-0000-000000000002'),'profile upsert alone remains rollbackable');
SET LOCAL ROLE service_role;
INSERT INTO public.user_roles(user_id,role_id) VALUES('40000000-0000-0000-0000-000000000002','3ac4f27e-c94c-4b0d-b750-9fb6366b85bc');
RESET ROLE;
SELECT pg_temp.check_true((SELECT count(*)=1 AND bool_and(employment_rate=0.75 AND valid_from=(clock_timestamp() AT TIME ZONE 'Europe/Minsk')::date) FROM public.employee_employment_periods WHERE employee_id='40000000-0000-0000-0000-000000000002'),'duplicate final role creates one period with final profile rate');
SELECT pg_temp.check_true((SELECT count(*)=1 FROM public.user_roles WHERE user_id='40000000-0000-0000-0000-000000000002'),'no duplicate role');
SELECT pg_temp.check_true((SELECT created_by IS NULL AND updated_by IS NULL AND created_source='system' AND updated_source='system' FROM public.employee_employment_periods WHERE employee_id='40000000-0000-0000-0000-000000000002'),'import is attributed to system not a human');
SELECT pg_temp.check_true(NOT EXISTS(SELECT FROM public.employee_employment_baseline WHERE employee_id='40000000-0000-0000-0000-000000000002'),'new import does not change baseline');
SET LOCAL ROLE service_role;
SELECT pg_temp.expect_error('INSERT INTO public.user_roles(user_id,role_id) VALUES(''40000000-0000-0000-0000-000000000002'',''3ac4f27e-c94c-4b0d-b750-9fb6366b85bc'')','23505','later duplicate retains ordinary importer-success error');
INSERT INTO public.user_roles(user_id,role_id) VALUES('40000000-0000-0000-0000-000000000006','60000000-0000-0000-0000-000000000002');
RESET ROLE;
SELECT pg_temp.check_true((SELECT count(*)=1 FROM public.employee_employment_periods WHERE employee_id='40000000-0000-0000-0000-000000000002'),'repeat finalization does not duplicate period');
SELECT pg_temp.check_true((SELECT count(*)=2 FROM public.user_roles WHERE user_id='40000000-0000-0000-0000-000000000006'),'nonduplicate final role also succeeds');

-- Future events are unsupported: archive must not quietly erase their intent.
SAVEPOINT future_period;
UPDATE public.employee_employment_periods SET valid_to=(clock_timestamp() AT TIME ZONE 'Europe/Minsk')::date+1
WHERE employee_id='40000000-0000-0000-0000-000000000006';
INSERT INTO public.employee_employment_periods(employee_id,department_id,team_id,subdivision_id,employment_rate,valid_from)
SELECT employee_id,department_id,team_id,subdivision_id,employment_rate,valid_to
FROM public.employee_employment_periods WHERE employee_id='40000000-0000-0000-0000-000000000006';
SET LOCAL ROLE service_role;
SELECT pg_temp.expect_error('UPDATE public.profiles SET department_id=''20000000-0000-0000-0000-000000000099'',team_id=''30000000-0000-0000-0000-000000000099'' WHERE user_id=''40000000-0000-0000-0000-000000000006''','55000','future period prevents archive');
RESET ROLE;
ROLLBACK TO future_period;
SELECT pg_temp.check_true((SELECT valid_to IS NULL FROM public.employee_employment_periods WHERE employee_id='40000000-0000-0000-0000-000000000006'),'future-period fixture restores original active interval');

-- A real final INSERT failure rolls back the period created by BEFORE INSERT.
SET LOCAL ROLE service_role;
SELECT pg_temp.expect_error('INSERT INTO public.user_roles(user_id,role_id) VALUES(''40000000-0000-0000-0000-000000000003'',''60000000-0000-0000-0000-000000000099'')','23503','invalid role rolls back finalization');
UPDATE public.profiles SET employment_rate=0 WHERE user_id='40000000-0000-0000-0000-000000000005';
SELECT pg_temp.expect_error('INSERT INTO public.user_roles(user_id,role_id) VALUES(''40000000-0000-0000-0000-000000000005'',''3ac4f27e-c94c-4b0d-b750-9fb6366b85bc'')','23514','incomplete import is not finalized');
RESET ROLE;
SELECT pg_temp.check_true(NOT EXISTS(SELECT FROM public.employee_employment_periods WHERE employee_id IN ('40000000-0000-0000-0000-000000000003','40000000-0000-0000-0000-000000000005')),'failed imports leave no periods');
SET LOCAL ROLE supabase_auth_admin;
DELETE FROM auth.users WHERE id='40000000-0000-0000-0000-000000000003';
RESET ROLE;
SELECT pg_temp.check_true(NOT EXISTS(SELECT FROM public.profiles WHERE user_id='40000000-0000-0000-0000-000000000003'),'old Auth compensation before finalization still deletes draft profile');

-- Editable claims cannot impersonate the PostgREST database role.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role','service_role',true);
SELECT set_config('request.jwt.claims','{"role":"service_role","user_metadata":{"role":"service_role"}}',true);
INSERT INTO public.user_roles(user_id,role_id) VALUES('40000000-0000-0000-0000-000000000004','60000000-0000-0000-0000-000000000002');
RESET ROLE;
SELECT pg_temp.check_true(NOT EXISTS(SELECT FROM public.employee_employment_periods WHERE employee_id='40000000-0000-0000-0000-000000000004'),'ordinary role assignment does not obtain system registration');
SELECT public.register_employee_employment('40000000-0000-0000-0000-000000000004');
SELECT pg_temp.check_true((SELECT created_source='user' AND created_by='40000000-0000-0000-0000-000000000001'::uuid FROM public.employee_employment_periods WHERE employee_id='40000000-0000-0000-0000-000000000004'),'authenticated registration still records real actor');
SELECT public.update_employee_employment('40000000-0000-0000-0000-000000000002','{"employment_rate":0.5}');
SELECT pg_temp.check_true((SELECT created_source='system' AND updated_source='user' FROM public.employee_employment_periods WHERE employee_id='40000000-0000-0000-0000-000000000002'),'human edit of imported period updates attribution');

SET LOCAL ROLE service_role;
UPDATE public.profiles SET salary=30 WHERE user_id='40000000-0000-0000-0000-000000000002';
SELECT pg_temp.expect_error('UPDATE public.profiles SET employment_rate=3 WHERE user_id=''40000000-0000-0000-0000-000000000002''','55000','service does not get arbitrary rate bypass');
SELECT pg_temp.expect_error('UPDATE public.profiles SET is_service=true WHERE user_id=''40000000-0000-0000-0000-000000000002''','55000','service cannot remove an employee from history via service flag');
SELECT pg_temp.expect_error('UPDATE public.profiles SET department_id=''20000000-0000-0000-0000-000000000099'',team_id=''30000000-0000-0000-0000-000000000099'',salary=40 WHERE user_id=''40000000-0000-0000-0000-000000000002''','55000','archive exception accepts organization-only change');
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_error('UPDATE public.profiles SET department_id=''20000000-0000-0000-0000-000000000099'',team_id=''30000000-0000-0000-0000-000000000099'' WHERE user_id=''40000000-0000-0000-0000-000000000002''','55000','authenticated archive cannot impersonate service');
RESET ROLE;
-- Renaming references does not change destination recognition.
UPDATE public.departments SET department_name='Renamed archive' WHERE department_id='20000000-0000-0000-0000-000000000099';
UPDATE public.teams SET team_name='Renamed team' WHERE team_id='30000000-0000-0000-0000-000000000099';
SET LOCAL ROLE service_role;
UPDATE public.profiles SET department_id='20000000-0000-0000-0000-000000000099',team_id='30000000-0000-0000-0000-000000000099'
WHERE user_id='40000000-0000-0000-0000-000000000002';
RESET ROLE;
SELECT pg_temp.check_true((SELECT valid_to=(clock_timestamp() AT TIME ZONE 'Europe/Minsk')::date+1 AND department_id='42c93225-0ac5-41fe-820a-5ecbe33b5e2d'::uuid AND employment_rate=0.5 AND updated_source='system' FROM public.employee_employment_periods WHERE employee_id='40000000-0000-0000-0000-000000000002'),'system archive closes today inclusively in original department');
SELECT pg_temp.check_true((SELECT department_id='20000000-0000-0000-0000-000000000099'::uuid AND salary=30 FROM public.profiles WHERE user_id='40000000-0000-0000-0000-000000000002'),'technical profile moves to archive and salary sync is preserved');
SET LOCAL ROLE service_role;
UPDATE public.profiles SET department_id='20000000-0000-0000-0000-000000000099',team_id='30000000-0000-0000-0000-000000000099'
WHERE user_id='40000000-0000-0000-0000-000000000002';
INSERT INTO public.user_roles(user_id,role_id) VALUES('40000000-0000-0000-0000-000000000002','60000000-0000-0000-0000-000000000002');
RESET ROLE;
SELECT pg_temp.check_true((SELECT count(*)=1 AND bool_and(valid_to=(clock_timestamp() AT TIME ZONE 'Europe/Minsk')::date+1) FROM public.employee_employment_periods WHERE employee_id='40000000-0000-0000-0000-000000000002'),'repeat archive and role change do not reopen employment');

-- Preserve a previously ended interval; no rewriting old days on late sync.
ALTER TABLE public.employment_history_settings DISABLE TRIGGER employment_history_settings_immutable;
UPDATE public.employment_history_settings SET cutover_date=cutover_date-3;
ALTER TABLE public.employment_history_settings ENABLE TRIGGER employment_history_settings_immutable;
UPDATE public.employee_employment_periods SET valid_from=valid_from-2,valid_to=valid_from
WHERE employee_id='40000000-0000-0000-0000-000000000004';
SET LOCAL ROLE service_role;
UPDATE public.profiles SET department_id='20000000-0000-0000-0000-000000000099',team_id='30000000-0000-0000-0000-000000000099'
WHERE user_id='40000000-0000-0000-0000-000000000004';
SELECT pg_temp.expect_error('UPDATE public.profiles SET department_id=''42c93225-0ac5-41fe-820a-5ecbe33b5e2d'',team_id=''983b9ae6-6bcf-472d-ba26-eee2e4673787'' WHERE user_id=''40000000-0000-0000-0000-000000000004''','55000','restoring ended profile does not imply rehire');
RESET ROLE;
SELECT pg_temp.check_true((SELECT valid_to=(clock_timestamp() AT TIME ZONE 'Europe/Minsk')::date FROM public.employee_employment_periods WHERE employee_id='40000000-0000-0000-0000-000000000004'),'late archive preserves old end date');

-- Once finalization committed, compensating Auth delete must not erase history.
GRANT INSERT ON storage_test_results TO supabase_auth_admin;
SET LOCAL ROLE supabase_auth_admin;
SELECT pg_temp.expect_error('DELETE FROM auth.users WHERE id=''40000000-0000-0000-0000-000000000002''','23001','postfinalization Auth delete cannot erase history');
RESET ROLE;
SELECT pg_temp.check_true(EXISTS(SELECT FROM auth.users WHERE id='40000000-0000-0000-0000-000000000002'),'failed Auth delete is atomic');
SELECT pg_temp.check_true(NOT has_function_privilege('service_role','public.finalize_legacy_employee_import()','EXECUTE'),'adapter not exposed as service RPC');
SELECT pg_temp.check_true(NOT has_function_privilege('authenticated','public.is_legacy_employment_import()','EXECUTE'),'role helper not exposed as client RPC');
SELECT pg_temp.check_true(NOT has_table_privilege('service_role','public.employment_legacy_import_settings','SELECT,UPDATE'),'archive settings are operator-only');
SELECT pg_temp.check_true(NOT has_table_privilege('service_role','public.employee_employment_periods','INSERT,UPDATE,DELETE'),'service has no direct history mutation grant');
SELECT count(*) AS legacy_import_assertions_passed FROM storage_test_results;
ROLLBACK;
