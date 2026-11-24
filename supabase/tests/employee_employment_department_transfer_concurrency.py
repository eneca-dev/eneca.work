"""Two-session department transfer tests after the local department-transfer SQL suite.

Uses synthetic data only; no .env, Docker or remote database connection.
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
    resident = '50000000-0000-0000-0000-000000000002'
    incoming = '50000000-0000-0000-0000-000000000003'
    hire = '50000000-0000-0000-0000-000000000004'
    subdivision_a = '10000000-0000-0000-0000-000000000001'
    subdivision_b = '10000000-0000-0000-0000-000000000002'
    department_a = '20000000-0000-0000-0000-000000000001'
    department_b = '20000000-0000-0000-0000-000000000002'
    today = "(clock_timestamp() AT TIME ZONE 'Europe/Minsk')::date"
    checks = 0

    def check(sql, expected):
        nonlocal checks
        result = second.sql(sql).strip()
        assert result == expected, result
        checks += 1

    def blocked(sql):
        nonlocal checks
        second.sql(sql, '55P03')
        checks += 1

    def move(subdivision):
        return (f"UPDATE public.departments SET subdivision_id='{subdivision}' "
                f"WHERE department_id='{department_a}';")

    def assert_current(employee, subdivision):
        check(f"SELECT p.subdivision_id=e.subdivision_id AND e.subdivision_id='{subdivision}'::uuid "
              "FROM public.profiles p JOIN public.employee_employment_periods e ON e.employee_id=p.user_id "
              f"WHERE p.user_id='{employee}' AND e.valid_from<={today} "
              f"AND (e.valid_to IS NULL OR e.valid_to>{today});", 't')

    try:
        for session in (first, second):
            session.sql("SET statement_timeout='5s'; SET lock_timeout='200ms'; "
                        f"SELECT set_config('request.jwt.claim.sub','{actor}',false);")
        first.sql("DO $$ BEGIN IF inet_server_addr() IS DISTINCT FROM '127.0.0.1'::inet "
                  "OR EXISTS(SELECT FROM public.profiles) OR EXISTS(SELECT FROM public.employment_history_settings) "
                  "THEN RAISE EXCEPTION 'empty disposable loopback fixture required'; END IF; END $$;")
        first.sql(f"INSERT INTO public.subdivisions VALUES ('{subdivision_a}'),('{subdivision_b}'); "
                  f"INSERT INTO public.departments VALUES ('{department_a}','{subdivision_a}'),('{department_b}','{subdivision_a}'); "
                  f"INSERT INTO auth.users VALUES ('{actor}','actor@example.test'),('{resident}','resident@example.test'),('{incoming}','incoming@example.test'); "
                  "INSERT INTO public.profiles(user_id,department_id,employment_rate) VALUES "
                  f"('{actor}','{department_b}',1),('{resident}','{department_a}',1),('{incoming}','{department_b}',1); "
                  "INSERT INTO public.test_employment_permissions VALUES "
                  f"('{actor}','users.manage.departments'),('{actor}','users.edit.all'),('{actor}','users.edit_salary.all'),"
                  f"('{actor}','users.create'),('{actor}','users.delete'); "
                  f"SELECT public.initialize_employee_employment_history({today},'{actor}');")

        # A personnel writer owns the profile first. Move waits, then uses its result.
        first.sql(f"BEGIN; SELECT public.update_employee_employment('{resident}','{{\"employment_rate\":0.75}}');")
        blocked(move(subdivision_b))
        check(f"SELECT subdivision_id FROM public.departments WHERE department_id='{department_a}';", subdivision_a)
        first.sql('COMMIT;')
        second.sql(move(subdivision_b))
        assert_current(resident, subdivision_b)
        check(f"SELECT employment_rate FROM public.employee_employment_periods WHERE employee_id='{resident}';", '0.75')

        # Move owns the membership lock first: all personnel RPCs and incoming
        # bootstrap INSERTs wait, including those not in its original row set.
        first.sql('BEGIN; ' + move(subdivision_a))
        blocked(f"SELECT public.update_employee_employment('{resident}','{{\"employment_rate\":0.5}}');")
        blocked(f"SELECT public.register_employee_employment('{incoming}');")
        blocked(f"SELECT public.finish_employee_employment('{resident}');")
        blocked(f"INSERT INTO public.profiles(user_id,department_id,employment_rate) VALUES ('{hire}','{department_a}',1);")
        first.sql('COMMIT;')
        assert_current(resident, subdivision_a)

        # Incoming transfer committed after a blocked attempt is included on retry.
        first.sql(f"BEGIN; SELECT public.update_employee_employment('{incoming}',"
                  f"'{{\"department_id\":\"{department_a}\",\"subdivision_id\":\"{subdivision_a}\"}}');")
        blocked(move(subdivision_b))
        first.sql('COMMIT;')
        second.sql(move(subdivision_b))
        assert_current(incoming, subdivision_b)

        # New hire committed while the move is waiting is not omitted.
        first.sql(f"BEGIN; INSERT INTO auth.users VALUES ('{hire}','hire@example.test'); "
                  f"INSERT INTO public.profiles(user_id,department_id,employment_rate) VALUES ('{hire}','{department_a}',1); "
                  f"SELECT public.register_employee_employment('{hire}');")
        blocked(move(subdivision_a))
        first.sql('COMMIT;')
        second.sql(move(subdivision_a))
        assert_current(hire, subdivision_a)

        # Finishing concurrently must not get lost/reopened by the later move.
        first.sql(f"BEGIN; SELECT public.finish_employee_employment('{resident}');")
        blocked(move(subdivision_b))
        first.sql('COMMIT;')
        second.sql(move(subdivision_b))
        assert_current(resident, subdivision_b)
        check(f"SELECT valid_to={today}+1 FROM public.employee_employment_periods WHERE employee_id='{resident}';", 't')
        check("SELECT bool_and(subdivision_id='" + subdivision_a + "'::uuid) FROM public.employee_employment_baseline;", 't')

        # A snapshot taken before waiting cannot silently miss incoming employees.
        second.sql('BEGIN ISOLATION LEVEL REPEATABLE READ;')
        second.sql(move(subdivision_a), '25001')
        second.sql('ROLLBACK;')
        checks += 1
        check(f"SELECT subdivision_id FROM public.departments WHERE department_id='{department_a}';", subdivision_b)

        # Actual wait -> peer COMMIT -> continue within the SAME transfer request.
        # Observe the database lock state, not a sleep guessed to match query timing.
        waiting_hire = '50000000-0000-0000-0000-000000000005'
        second.sql("SET lock_timeout='4s';")
        second_pid = int(second.sql('SELECT pg_backend_pid();').strip())
        first.sql(f"BEGIN; INSERT INTO auth.users VALUES ('{waiting_hire}','waiting@example.test'); "
                  f"INSERT INTO public.profiles(user_id,department_id,employment_rate) VALUES ('{waiting_hire}','{department_a}',1); "
                  f"SELECT public.register_employee_employment('{waiting_hire}');")
        with ThreadPoolExecutor(max_workers=1) as executor:
            pending_move = executor.submit(second.sql, move(subdivision_a))
            try:
                deadline = time.monotonic() + 3
                while True:
                    waiting = first.sql("SELECT EXISTS(SELECT FROM pg_locks WHERE "
                                        f"pid={second_pid} AND relation='public.profiles'::regclass "
                                        "AND mode='ExclusiveLock' AND NOT granted);").strip()
                    if waiting == 't':
                        checks += 1
                        break
                    assert not pending_move.done(), 'move completed before uncommitted hire was released'
                    assert time.monotonic() < deadline, 'transfer did not reach expected membership lock'
                    time.sleep(0.02)
                first.sql('COMMIT;')
                pending_move.result(timeout=5)
            finally:
                # Release the peer even if an assertion failed while it was waiting.
                if not pending_move.done():
                    first.sql('ROLLBACK;')
        assert_current(waiting_hire, subdivision_a)
        print(f'{checks} department transfer concurrency checks passed.')
    finally:
        first.close()
        second.close()


if __name__ == '__main__':
    main()
