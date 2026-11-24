\set ON_ERROR_STOP on
-- Standalone: empty disposable loopback database only. Reuses storage fixture checks.
\ir employee_employment_history_storage.sql

CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
CREATE TABLE public.test_employment_permissions (user_id uuid, permission text, PRIMARY KEY(user_id,permission));
-- Keep test setup concise, but exercise the real permission JOIN implementation.
CREATE TABLE public.roles(id uuid PRIMARY KEY);
CREATE TABLE public.permissions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text UNIQUE NOT NULL);
CREATE TABLE public.role_permissions(role_id uuid REFERENCES public.roles(id),permission_id uuid REFERENCES public.permissions(id),PRIMARY KEY(role_id,permission_id));
CREATE TABLE public.user_roles(user_id uuid,role_id uuid REFERENCES public.roles(id),assigned_by uuid,PRIMARY KEY(user_id,role_id));
CREATE FUNCTION public.seed_test_employment_permission() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE permission_id_value uuid;
BEGIN
 IF TG_OP='DELETE' THEN
  DELETE FROM public.role_permissions rp USING public.permissions p
  WHERE rp.role_id=OLD.user_id AND rp.permission_id=p.id AND p.name=OLD.permission;
  RETURN OLD;
 END IF;
 INSERT INTO public.roles VALUES(NEW.user_id) ON CONFLICT DO NOTHING;
 INSERT INTO public.user_roles(user_id,role_id) VALUES(NEW.user_id,NEW.user_id) ON CONFLICT DO NOTHING;
 INSERT INTO public.permissions(name) VALUES(NEW.permission) ON CONFLICT DO NOTHING;
 SELECT id INTO permission_id_value FROM public.permissions WHERE name=NEW.permission;
 INSERT INTO public.role_permissions VALUES(NEW.user_id,permission_id_value) ON CONFLICT DO NOTHING;
 RETURN NEW;
END $$;
CREATE TRIGGER seed_test_employment_permission AFTER INSERT OR DELETE ON public.test_employment_permissions
FOR EACH ROW EXECUTE FUNCTION public.seed_test_employment_permission();
CREATE TABLE public.test_employment_roles (user_id uuid PRIMARY KEY,role_name text);
CREATE VIEW public.view_users AS SELECT p.user_id,r.role_name FROM public.profiles p
 LEFT JOIN public.test_employment_roles r ON r.user_id=p.user_id;
\ir ../migrations/20261124094101_employee_employment_operations.sql

BEGIN;
INSERT INTO public.subdivisions VALUES
 ('10000000-0000-0000-0000-000000000001'), ('10000000-0000-0000-0000-000000000002');
INSERT INTO public.departments VALUES
 ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001'),
 ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001'),
 ('20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002');
INSERT INTO public.teams VALUES
 ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001'),
 ('30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001'),
 ('30000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000003');
INSERT INTO public.profiles VALUES
 ('40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',NULL,'10000000-0000-0000-0000-000000000001',1,false),
 ('40000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',1,false);

DO $$
DECLARE
 actor uuid := '40000000-0000-0000-0000-000000000001';
 employee uuid := '40000000-0000-0000-0000-000000000002';
 new_employee uuid := '40000000-0000-0000-0000-000000000003';
 today date := (clock_timestamp() AT TIME ZONE 'Europe/Minsk')::date;
 command text;
 period_id uuid;
BEGIN
 PERFORM pg_temp.expect_error('SELECT public.employee_employment_status()','42501','status requires authentication');
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 PERFORM pg_temp.check_true(public.employee_employment_status() = jsonb_build_object('enabled',false,'cutoverDate',NULL,'today',today),'disabled status contract');
 command := format('SELECT public.update_employee_employment(%L,%L::jsonb)',employee,'{"employment_rate":2}');
 PERFORM pg_temp.expect_error(command,'42501','rate cannot be changed without salary permission');
 INSERT INTO public.test_employment_permissions VALUES (actor,'users.edit.all');
 PERFORM pg_temp.expect_error(command,'42501','organization admin does not grant salary permission');
 INSERT INTO public.test_employment_permissions VALUES (actor,'users.edit_salary.all');
 PERFORM public.update_employee_employment(employee,'{"employment_rate":2}');
 PERFORM pg_temp.check_true((SELECT employment_rate=2 AND team_id='30000000-0000-0000-0000-000000000001'::uuid FROM public.profiles WHERE user_id=employee),'before activation patch preserves absent fields');
 PERFORM public.register_employee_employment(employee);
 PERFORM pg_temp.check_true(NOT EXISTS(SELECT FROM public.employee_employment_periods),'no periods before activation');
 PERFORM pg_temp.expect_error(format('SELECT public.update_employee_employment(%L,NULL)',employee),'22023','null patch rejected');
 PERFORM pg_temp.expect_error(format('SELECT public.update_employee_employment(%L,%L::jsonb)',employee,'[]'),'22023','array patch rejected');
 PERFORM pg_temp.expect_error(format('SELECT public.update_employee_employment(%L,%L::jsonb)',employee,'{"is_service":true}'),'22023','unknown field rejected');
 PERFORM pg_temp.expect_error(format('SELECT public.update_employee_employment(%L,%L::jsonb)',employee,'{"employment_rate":0}'),'22023','zero rate rejected');
 PERFORM pg_temp.expect_error(format('SELECT public.update_employee_employment(%L,%L::jsonb)',employee,'{"employment_rate":"NaN"}'),'22023','non numeric rate rejected');
 PERFORM pg_temp.expect_error(format('SELECT public.update_employee_employment(%L,%L::jsonb)',employee,'{"employment_rate":null}'),'22023','null rate rejected');
 PERFORM pg_temp.expect_error(format('SELECT public.update_employee_employment(%L,%L::jsonb)',employee,'{"team_id":"30000000-0000-0000-0000-000000000003"}'),'23514','mismatching team rejected');

 PERFORM public.initialize_employee_employment_history(today,actor);
 PERFORM pg_temp.check_true(public.employee_employment_status()->>'enabled'='true','activation visible');
 SELECT id INTO period_id FROM public.employee_employment_periods WHERE employee_id=employee;
 PERFORM public.update_employee_employment(employee,'{"employment_rate":1.5}');
 PERFORM pg_temp.check_true((SELECT count(*)=1 AND min(id::text)=period_id::text AND min(employment_rate)=1.5 FROM public.employee_employment_periods WHERE employee_id=employee),'same-day edit coalesces period');
 PERFORM pg_temp.check_true((SELECT employment_rate=2 FROM public.employee_employment_baseline WHERE employee_id=employee),'baseline remains frozen');
 PERFORM pg_temp.expect_error(format('UPDATE public.profiles SET employment_rate=4 WHERE user_id=%L',employee),'55000','direct rate update blocked');
 PERFORM pg_temp.expect_error(format('UPDATE public.profiles SET is_service=true WHERE user_id=%L',employee),'55000','service flag cannot bypass history');
 UPDATE public.profiles SET employment_rate=employment_rate WHERE user_id=employee;
 PERFORM pg_temp.check_true(true,'unchanged profile update permitted');
 DELETE FROM public.test_employment_permissions WHERE user_id=actor;
 INSERT INTO public.test_employment_permissions VALUES (actor,'users.edit.team');
 PERFORM public.update_employee_employment(employee,'{"team_id":"30000000-0000-0000-0000-000000000002"}');
 PERFORM pg_temp.check_true((SELECT team_id='30000000-0000-0000-0000-000000000002'::uuid FROM public.profiles WHERE user_id=employee),'team permission within own department');
 INSERT INTO public.test_employment_permissions VALUES (actor,'users.edit_salary.department');
 PERFORM pg_temp.expect_error(command,'42501','department salary permission also requires eligible target role');
 INSERT INTO public.test_employment_permissions VALUES (employee,'hierarchy.is_user'),(employee,'hierarchy.is_team_lead'),(employee,'hierarchy.is_admin');
 INSERT INTO public.test_employment_roles VALUES(employee,'admin');
 PERFORM pg_temp.expect_error(command,'42501','admin target with all hierarchy flags is not an eligible department salary target');
 UPDATE public.test_employment_roles SET role_name='user' WHERE user_id=employee;
 PERFORM public.update_employee_employment(employee,'{"employment_rate":1.75}');
 PERFORM pg_temp.check_true((SELECT employment_rate=1.75 FROM public.profiles WHERE user_id=employee),'department salary permission permits eligible colleague');
 PERFORM pg_temp.expect_error(format('SELECT public.update_employee_employment(%L,%L::jsonb)',employee,'{"department_id":"20000000-0000-0000-0000-000000000002","team_id":null}'),'42501','team editor cannot transfer department');
 INSERT INTO public.test_employment_permissions VALUES (actor,'users.edit.subdivision');
 PERFORM public.update_employee_employment(employee,'{"department_id":"20000000-0000-0000-0000-000000000002","team_id":null}');
 PERFORM pg_temp.expect_error(format('SELECT public.update_employee_employment(%L,%L::jsonb)',employee,'{"department_id":"20000000-0000-0000-0000-000000000003","subdivision_id":"10000000-0000-0000-0000-000000000002"}'),'42501','destination outside subdivision denied');
 PERFORM pg_temp.expect_error(command,'42501','rate editor cannot edit different department');
 INSERT INTO public.test_employment_permissions VALUES (actor,'users.edit_salary.subdivision');
 PERFORM public.update_employee_employment(employee,'{"employment_rate":2}');
 INSERT INTO public.test_employment_permissions VALUES (actor,'hierarchy.is_subdivision_head'),(actor,'users.edit_salary.all');
 PERFORM pg_temp.expect_error(format('SELECT public.update_employee_employment(%L,%L::jsonb)',actor,'{"employment_rate":2}'),'42501','subdivision head cannot edit own rate');

 INSERT INTO public.profiles(user_id,employment_rate) VALUES(new_employee,1);
 UPDATE public.profiles SET department_id='20000000-0000-0000-0000-000000000001',subdivision_id='10000000-0000-0000-0000-000000000001' WHERE user_id=new_employee;
 PERFORM pg_temp.check_true(NOT EXISTS(SELECT FROM public.employee_employment_periods WHERE employee_id=new_employee),'bootstrap profile has no implicit period');
 PERFORM pg_temp.expect_error(format('SELECT public.register_employee_employment(%L)',new_employee),'42501','registration requires create permission');
 INSERT INTO public.test_employment_permissions VALUES(actor,'users.create');
 PERFORM public.register_employee_employment(new_employee);
 PERFORM public.register_employee_employment(new_employee);
 PERFORM pg_temp.check_true((SELECT count(*)=1 AND min(valid_from)=today FROM public.employee_employment_periods WHERE employee_id=new_employee),'new hire begins today idempotently');
 PERFORM pg_temp.check_true(NOT EXISTS(SELECT FROM public.employee_employment_baseline WHERE employee_id=new_employee),'new hire absent from old baseline');
 PERFORM pg_temp.expect_error(format('SELECT public.finish_employee_employment(%L)',new_employee),'42501','finish requires delete permission');
 INSERT INTO public.test_employment_permissions VALUES(actor,'users.delete');
 PERFORM pg_temp.expect_error(format('SELECT public.finish_employee_employment(%L)',actor),'42501','self termination denied');
 PERFORM public.finish_employee_employment(new_employee);
 PERFORM public.finish_employee_employment(new_employee);
 PERFORM pg_temp.check_true((SELECT valid_to=today+1 FROM public.employee_employment_periods WHERE employee_id=new_employee),'finish today is inclusive and idempotent');
 PERFORM pg_temp.expect_error(format('SELECT public.update_employee_employment(%L,%L::jsonb)',new_employee,'{"employment_rate":1.5}'),'55000','last day cannot reopen through edit');
 PERFORM public.register_employee_employment(new_employee);
 PERFORM pg_temp.check_true((SELECT valid_to=today+1 FROM public.employee_employment_periods WHERE employee_id=new_employee),'register does not reopen finished employee');
 PERFORM pg_temp.check_true(EXISTS(SELECT FROM public.profiles WHERE user_id=new_employee),'finish preserves profile');
END $$;

-- Controlled clock fixture: move cutover back only in this disposable transaction.
ALTER TABLE public.employment_history_settings DISABLE TRIGGER employment_history_settings_immutable;
UPDATE public.employment_history_settings SET cutover_date=cutover_date-2;
ALTER TABLE public.employment_history_settings ENABLE TRIGGER employment_history_settings_immutable;
UPDATE public.employee_employment_periods SET valid_from=valid_from-1 WHERE employee_id='40000000-0000-0000-0000-000000000002';
SELECT public.update_employee_employment('40000000-0000-0000-0000-000000000002','{"employment_rate":1.25}');
SELECT pg_temp.check_true((SELECT count(*)=2 AND count(*) FILTER(WHERE valid_to=(clock_timestamp() AT TIME ZONE 'Europe/Minsk')::date)=1
 FROM public.employee_employment_periods WHERE employee_id='40000000-0000-0000-0000-000000000002'),'next-day update preserves previous interval');
UPDATE public.employee_employment_periods SET valid_from=valid_from-1, valid_to=(clock_timestamp() AT TIME ZONE 'Europe/Minsk')::date
 WHERE employee_id='40000000-0000-0000-0000-000000000003';
SELECT pg_temp.expect_error('SELECT public.update_employee_employment(''40000000-0000-0000-0000-000000000003'',''{"employment_rate":2}'')','55000','ended employee not implicitly reactivated');
SELECT pg_temp.expect_error('UPDATE public.profiles SET employment_rate=2 WHERE user_id=''40000000-0000-0000-0000-000000000003''','55000','direct update of inactive historical employee denied');

SELECT pg_temp.check_true(NOT has_table_privilege('authenticated','public.employee_employment_periods','SELECT'),'history remains closed to authenticated');
SELECT pg_temp.check_true(has_table_privilege('service_role','public.employee_employment_periods','SELECT'),'server reader can select history');
SELECT pg_temp.check_true(NOT has_table_privilege('service_role','public.employee_employment_periods','UPDATE'),'server reader cannot mutate history directly');
SELECT pg_temp.check_true(NOT has_function_privilege('anon','public.update_employee_employment(uuid,jsonb)','EXECUTE'),'anon cannot execute mutation');
SELECT pg_temp.check_true(has_function_privilege('authenticated','public.update_employee_employment(uuid,jsonb)','EXECUTE'),'authenticated can execute protected RPC');
SELECT pg_temp.check_true(NOT has_function_privilege('authenticated','public.guard_employee_employment_profile()','EXECUTE'),'guard not exposed as RPC');
SET LOCAL ROLE authenticated;
SELECT public.employee_employment_status();
SELECT public.update_employee_employment('40000000-0000-0000-0000-000000000002','{"employment_rate":1.4}');
RESET ROLE;
SELECT pg_temp.check_true((SELECT employment_rate=1.4 FROM public.profiles WHERE user_id='40000000-0000-0000-0000-000000000002'),'authenticated RPC works without direct table privileges');
SELECT count(*) AS assertions_passed FROM storage_test_results;
ROLLBACK;
