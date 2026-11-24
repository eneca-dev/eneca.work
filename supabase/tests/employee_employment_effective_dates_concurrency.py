"""Dated writers: two-session conflicts on an empty disposable loopback fixture.

Run after employee_employment_effective_dates.sql. No .env or live connections.
"""
import argparse
import json

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
    actor = '52000000-0000-0000-0000-000000000001'
    employee = '52000000-0000-0000-0000-000000000002'
    today = "(clock_timestamp() AT TIME ZONE 'Europe/Minsk')::date"
    checks = 0

    def context():
        return json.loads(second.sql(f"SELECT public.get_employee_employment_edit_context('{employee}','update');").strip())

    def update(ctx, rate, days):
        return (f"SELECT public.update_employee_employment_dated('{employee}',"
                f"'{{\"employment_rate\":{rate}}}',{today}-{days},"
                f"'{ctx['periodId']}','{ctx['periodUpdatedAt']}');")

    def finish(ctx):
        return (f"SELECT public.finish_employee_employment_dated('{employee}',{today},"
                f"'{ctx['periodId']}','{ctx['periodUpdatedAt']}');")

    try:
        for session in (first, second):
            session.sql("SET statement_timeout='5s'; SET lock_timeout='200ms'; "
                        f"SELECT set_config('request.jwt.claim.sub','{actor}',false);")
        first.sql("DO $$ BEGIN IF inet_server_addr() IS DISTINCT FROM '127.0.0.1'::inet "
                  "OR EXISTS(SELECT FROM public.profiles) OR EXISTS(SELECT FROM public.employment_history_settings) "
                  "THEN RAISE EXCEPTION 'empty disposable loopback fixture required'; END IF; END $$;")
        first.sql("BEGIN; SET LOCAL ROLE supabase_auth_admin; INSERT INTO auth.users(id,email) VALUES "
                  f"('{actor}','dated-race-actor@example.test'),('{employee}','dated-race-employee@example.test'); RESET ROLE; "
                  f"INSERT INTO public.test_employment_permissions VALUES('{actor}','users.edit_salary.all'),('{actor}','users.delete'); "
                  "INSERT INTO public.employee_employment_baseline(employee_id,department_id,team_id,subdivision_id,employment_rate) "
                  "SELECT user_id,department_id,team_id,subdivision_id,employment_rate FROM public.profiles; "
                  f"INSERT INTO public.employment_history_settings(cutover_date,initialized_by) VALUES({today}-10,'{actor}'); "
                  "INSERT INTO public.employee_employment_periods(employee_id,department_id,team_id,subdivision_id,employment_rate,valid_from,created_by,updated_by) "
                  f"SELECT user_id,department_id,team_id,subdivision_id,employment_rate,{today}-10,'{actor}','{actor}' FROM public.profiles; COMMIT;")

        old = context()
        first.sql('BEGIN; ' + update(old, 0.5, 3))
        second.sql(update(old, 0.75, 2), '55P03')
        checks += 1
        first.sql('COMMIT;')
        second.sql(update(old, 0.75, 2), '40001')
        checks += 1
        assert second.sql(f"SELECT employment_rate FROM public.profiles WHERE user_id='{employee}';").strip() == '0.5'
        checks += 1

        # Same period ID is preserved, but its timestamp invalidates concurrent forms.
        old = context()
        first.sql('BEGIN; ' + update(old, 0.75, 3))
        second.sql(finish(old), '55P03')
        checks += 1
        first.sql('COMMIT;')
        second.sql(finish(old), '40001')
        checks += 1
        new = context()
        assert new['periodId'] == old['periodId'] and new['periodUpdatedAt'] != old['periodUpdatedAt']
        checks += 1

        # Legacy today's writer shares the same lock and revision path.
        first.sql(f"BEGIN; SELECT public.update_employee_employment('{employee}','{{\"employment_rate\":1}}');")
        second.sql(update(new, 0.5, 0), '55P03')
        checks += 1
        first.sql('COMMIT;')
        second.sql(update(new, 0.5, 0), '40001')
        checks += 1

        new = context()
        first.sql('BEGIN; ' + finish(new))
        second.sql(update(new, 0.5, 0), '55P03')
        checks += 1
        first.sql('COMMIT;')
        second.sql(update(new, 0.5, 0), '55000')
        checks += 1
        assert second.sql(f"SELECT count(*) FROM public.employee_employment_periods WHERE employee_id='{employee}' AND valid_to IS NULL;").strip() == '0'
        checks += 1
        print(f'{checks} dated employment concurrency assertions passed')
    finally:
        first.close()
        second.close()


if __name__ == '__main__':
    main()
