"""Two-session storage checks against the empty LOCAL fixture DB left by the SQL test.

No dependencies besides Python and psql; never reads .env or connects to Supabase.
"""
import argparse
import queue
import subprocess
import threading


class Session:
    def __init__(self, command):
        self.process = subprocess.Popen(
            command, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT, text=True, encoding="utf-8",
        )
        self.lines = queue.Queue()
        threading.Thread(target=self._read, daemon=True).start()

    def _read(self):
        for line in self.process.stdout:
            self.lines.put(line)
        self.lines.put(None)

    def sql(self, query, error=None):
        self.process.stdin.write(query + "\n\\echo __DONE__\n")
        self.process.stdin.flush()
        output = []
        while True:
            line = self.lines.get(timeout=10)
            if line is None:
                raise AssertionError("psql exited: " + "".join(output))
            if line.strip() == "__DONE__":
                break
            output.append(line)
        result = "".join(output)
        if error:
            assert "ERROR:  " + error in result, result
        else:
            assert "ERROR:" not in result and "FATAL:" not in result, result
        return result

    def close(self):
        if self.process.poll() is None:
            self.process.stdin.write("ROLLBACK;\n\\q\n")
            self.process.stdin.flush()
            self.process.wait(timeout=10)
        self.process.stdin.close()
        self.process.stdout.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--psql", required=True)
    parser.add_argument("--port", type=int, required=True)
    parser.add_argument("--user", required=True)
    parser.add_argument("--database", required=True)
    args = parser.parse_args()
    if not args.database.startswith("enecawork_hr_storage_test_"):
        parser.error("only disposable enecawork_hr_storage_test_* databases are allowed")
    command = [args.psql, "-X", "-w", "-qAt", "-h", "127.0.0.1", "-p", str(args.port),
               "-U", args.user, "-d", args.database, "-v", "VERBOSITY=verbose"]
    actor = "50000000-0000-0000-0000-000000000001"
    today = "(clock_timestamp() AT TIME ZONE 'Europe/Minsk')::date"
    initialize = f"SELECT public.initialize_employee_employment_history({today},'{actor}');"
    first, second = Session(command), Session(command)
    try:
        first.sql("SET statement_timeout='5s';")
        second.sql("SET statement_timeout='5s'; SET lock_timeout='200ms';")
        first.sql("DO $$ BEGIN IF EXISTS (SELECT FROM public.employment_history_settings) "
                  "OR EXISTS (SELECT FROM public.profiles) THEN "
                  "RAISE EXCEPTION 'run SQL test first in an empty database'; END IF; END $$;")
        first.sql(f"INSERT INTO public.profiles(user_id,employment_rate) VALUES ('{actor}',1);")
        first.sql("BEGIN; " + initialize)
        # First session has explicitly acquired initialization locks, no timing sleeps.
        second.sql(f"UPDATE public.profiles SET employment_rate=0.5 WHERE user_id='{actor}';", "55P03")
        second.sql("INSERT INTO public.profiles(user_id,employment_rate) "
                   "VALUES ('50000000-0000-0000-0000-000000000002',1);", "55P03")
        second.sql("INSERT INTO public.departments(department_id) "
                   "VALUES ('50000000-0000-0000-0000-000000000003');", "55P03")
        second.sql(initialize, "55P03")
        first.sql("ROLLBACK;")
        result = second.sql("SELECT (SELECT count(*) FROM public.employment_history_settings),"
                            "(SELECT count(*) FROM public.employee_employment_baseline),"
                            "(SELECT count(*) FROM public.employee_employment_periods);")
        assert result.strip() == "0|0|0", result
        first.sql(initialize)
        second.sql(initialize, "55000")
        first.sql(f"UPDATE public.employee_employment_periods SET valid_to={today}+1;")
        insert = ("INSERT INTO public.employee_employment_periods"
                  "(employee_id,employment_rate,valid_from,created_by,updated_by) "
                  f"VALUES ('{actor}',0.5,{today}+1,'{actor}','{actor}');")
        first.sql("BEGIN; " + insert)
        second.sql(insert, "55P03")
        first.sql("COMMIT;")
        second.sql(insert, "23P01")
        print("8 concurrency checks passed: capture locks, atomic rollback, repeat, overlap.")
    finally:
        first.close()
        second.close()


if __name__ == "__main__":
    main()
