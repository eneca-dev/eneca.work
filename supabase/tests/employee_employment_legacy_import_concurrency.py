"""Two-session legacy import tests after employee_employment_legacy_import.sql.

Synthetic loopback database only; no .env, Docker or external importer execution.
"""
import argparse
import time
from concurrent.futures import ThreadPoolExecutor

from employee_employment_history_concurrency import Session


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--psql', required=True)
    parser.add_argument('--port', type=int, required=True)
    parser.add_argument('--user', required=True)
    parser.add_argument('--database', required=True)
    args = parser.parse_args()
    if not args.database.startswith('enecawork_hr_storage_test_'):
        parser.error('only disposable enecawork_hr_storage_test_* databases are allowed')
    command = [args.psql, '-X', '-w', '-qAt', '-h', '127.0.0.1', '-p', str(args.port),
               '-U', args.user, '-d', args.database, '-v', 'VERBOSITY=verbose']
    first, second = Session(command), Session(command)
    actor = '50000000-0000-0000-0000-000000000001'
    employee = '50000000-0000-0000-0000-000000000002'
    incoming = '50000000-0000-0000-0000-000000000003'
    role = '3ac4f27e-c94c-4b0d-b750-9fb6366b85bc'
    department = '42c93225-0ac5-41fe-820a-5ecbe33b5e2d'
    subdivision = '10000000-0000-0000-0000-000000000002'
    today = "(clock_timestamp() AT TIME ZONE 'Europe/Minsk')::date"
    checks = 0

    def finalize(person):
        return f"INSERT INTO public.user_roles(user_id,role_id) VALUES('{person}','{role}');"

    def archive(person):
        return ("UPDATE public.profiles SET department_id='20000000-0000-0000-0000-000000000099',"
                "team_id='30000000-0000-0000-0000-000000000099' "
                f"WHERE user_id='{person}';")

    def check(sql, expected='t'):
        nonlocal checks
        result = second.sql(sql).strip()
        assert result == expected, result
        checks += 1

    def blocked(sql):
        nonlocal checks
        second.sql(sql, '55P03')
        checks += 1

    try:
        for session in (first, second):
            session.sql("SET statement_timeout='5s'; SET lock_timeout='200ms'; "
                        f"SELECT set_config('request.jwt.claim.sub','{actor}',false);")
        first.sql("DO $$ BEGIN IF inet_server_addr() IS DISTINCT FROM '127.0.0.1'::inet "
                  "OR EXISTS(SELECT FROM public.profiles) OR EXISTS(SELECT FROM public.employment_history_settings) "
                  "THEN RAISE EXCEPTION 'empty disposable loopback fixture required'; END IF; END $$;")
        first.sql(f"SET ROLE supabase_auth_admin; INSERT INTO auth.users(id,email) VALUES('{actor}','actor@example.test'); RESET ROLE; "
                  "INSERT INTO public.test_employment_permissions VALUES "
                  f"('{actor}','users.manage.departments'),('{actor}','users.edit.all'),"
                  f"('{actor}','users.edit_salary.all'),('{actor}','users.delete'); "
                  f"SELECT public.initialize_employee_employment_history({today},'{actor}'); "
                  "SET ROLE supabase_auth_admin; INSERT INTO auth.users(id,email) VALUES "
                  f"('{employee}','employee@example.test'),('{incoming}','incoming@example.test'); RESET ROLE;")

        # Duplicate finalizers serialize on the profile. The second sees the
        # committed period; its ordinary duplicate error cannot roll that back.
        first.sql('BEGIN; SET LOCAL ROLE service_role; ' + finalize(employee))
        second.sql('SET ROLE service_role;')
        blocked(finalize(employee))
        first.sql('COMMIT;')
        second.sql(finalize(employee), '23505')
        checks += 1
        second.sql('RESET ROLE;')
        check(f"SELECT count(*)=1 FROM public.employee_employment_periods WHERE employee_id='{employee}';")
        check(f"SELECT count(*)=1 FROM public.user_roles WHERE user_id='{employee}';")

        # Archive waits for the human rate update and preserves its committed rate.
        first.sql(f"BEGIN; SELECT public.update_employee_employment('{employee}','{{\"employment_rate\":0.75}}');")
        second.sql('SET ROLE service_role;')
        blocked(archive(employee))
        first.sql('COMMIT;')
        second.sql(archive(employee))
        second.sql('RESET ROLE;')
        check(f"SELECT employment_rate=0.75 AND valid_to={today}+1 AND updated_source='system' "
              f"FROM public.employee_employment_periods WHERE employee_id='{employee}';")
        check(f"SELECT department_id='{department}'::uuid FROM public.employee_employment_periods WHERE employee_id='{employee}';")

        # An archive owning the profile lock blocks a concurrent human command.
        # Roll back this synthetic archive to retain an active incoming employee.
        first.sql('SET ROLE service_role; ' + finalize(incoming) + ' RESET ROLE;')
        first.sql('BEGIN; SET LOCAL ROLE service_role; ' + archive(incoming))
        blocked(f"SELECT public.finish_employee_employment('{incoming}');")
        first.sql('ROLLBACK;')
        check(f"SELECT valid_to IS NULL FROM public.employee_employment_periods WHERE employee_id='{incoming}';")

        # Finalization and whole-department transfer share the profile lock.
        # Observe the actual waiting lock and commit, instead of guessing timing.
        waiting = '50000000-0000-0000-0000-000000000004'
        first.sql(f"INSERT INTO public.subdivisions VALUES('{subdivision}'); "
                  "SET ROLE supabase_auth_admin; INSERT INTO auth.users(id,email) "
                  f"VALUES('{waiting}','waiting@example.test'); RESET ROLE;")
        first.sql('BEGIN; SET LOCAL ROLE service_role; ' + finalize(waiting))
        second.sql("SET lock_timeout='4s';")
        second_pid = int(second.sql('SELECT pg_backend_pid();').strip())
        with ThreadPoolExecutor(max_workers=1) as executor:
            pending = executor.submit(second.sql, "UPDATE public.departments "
                                      f"SET subdivision_id='{subdivision}' WHERE department_id='{department}';")
            try:
                deadline = time.monotonic() + 3
                while True:
                    state = first.sql("SELECT EXISTS(SELECT FROM pg_locks WHERE "
                                      f"pid={second_pid} AND relation='public.profiles'::regclass "
                                      "AND mode='ExclusiveLock' AND NOT granted);").strip()
                    if state == 't':
                        checks += 1
                        break
                    assert not pending.done(), 'transfer finished before import commit'
                    assert time.monotonic() < deadline, 'transfer did not reach expected lock'
                    time.sleep(0.02)
                first.sql('COMMIT;')
                pending.result(timeout=5)
            finally:
                if not pending.done():
                    first.sql('ROLLBACK;')
        check(f"SELECT p.subdivision_id=e.subdivision_id AND e.subdivision_id='{subdivision}'::uuid "
              "FROM public.profiles p JOIN public.employee_employment_periods e ON e.employee_id=p.user_id "
              f"WHERE p.user_id='{waiting}';")
        check("SELECT bool_and(subdivision_id='10000000-0000-0000-0000-000000000001'::uuid) "
              "FROM public.employee_employment_baseline;")
        print(f'{checks} legacy import concurrency checks passed.')
    finally:
        first.close()
        second.close()


if __name__ == '__main__':
    main()
