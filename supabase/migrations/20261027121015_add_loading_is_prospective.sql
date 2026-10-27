-- feature-VN-04: визуальная отметка; ставки, статусы и расчёты не меняются.
BEGIN;

-- Не ждём блокировку бесконечно: при активной долгой транзакции безопаснее
-- откатить миграцию и повторить её позже.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- Не пересоздаём view из старого дампа: сохраняем действующее определение,
-- порядок столбцов, grants, owner и security options. Новый столбец — в конце.
-- LEFT JOIN по PK не меняет количество строк, включая сотрудников без загрузок.
DO $migration$
DECLARE
  definition text;
  column_existed_before boolean;
  loadings_before bigint;
  loadings_after bigint;
  view_rows_before bigint;
  view_rows_after bigint;
  owner_before oid;
  owner_after oid;
  acl_before aclitem[];
  acl_after aclitem[];
  reloptions_before text[];
  reloptions_after text[];
BEGIN
  -- Фиксируем стабильный снимок и сразу получаем те же блокировки, которые
  -- понадобятся ALTER TABLE / CREATE OR REPLACE VIEW.
  LOCK TABLE public.loadings, public.view_employee_workloads
    IN ACCESS EXCLUSIVE MODE;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'loadings'
      AND column_name = 'is_prospective'
  ) INTO column_existed_before;

  SELECT count(*) INTO loadings_before FROM public.loadings;
  SELECT count(*) INTO view_rows_before FROM public.view_employee_workloads;

  SELECT relowner, relacl, reloptions
    INTO owner_before, acl_before, reloptions_before
  FROM pg_class
  WHERE oid = 'public.view_employee_workloads'::regclass;

  ALTER TABLE public.loadings
    ADD COLUMN IF NOT EXISTS is_prospective boolean NOT NULL DEFAULT false;

  COMMENT ON COLUMN public.loadings.is_prospective IS
    'Перспективная работа: только визуальная отметка, учитывается в загрузке как обычно.';

  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.view_employee_workloads'::regclass
      AND attname = 'is_prospective' AND NOT attisdropped
  ) THEN
    definition := rtrim(pg_get_viewdef('public.view_employee_workloads'::regclass, true), E'; \n\r');
    EXECUTE format(
      'CREATE OR REPLACE VIEW public.view_employee_workloads AS
       SELECT existing.*, COALESCE(loading.is_prospective, false) AS is_prospective
       FROM (%s) AS existing
       LEFT JOIN public.loadings AS loading ON loading.loading_id = existing.loading_id',
      definition
    );
  END IF;

  SELECT count(*) INTO loadings_after FROM public.loadings;
  SELECT count(*) INTO view_rows_after FROM public.view_employee_workloads;

  SELECT relowner, relacl, reloptions
    INTO owner_after, acl_after, reloptions_after
  FROM pg_class
  WHERE oid = 'public.view_employee_workloads'::regclass;

  IF loadings_after <> loadings_before THEN
    RAISE EXCEPTION
      'Safety check failed: loadings row count changed from % to %',
      loadings_before,
      loadings_after;
  END IF;

  IF view_rows_after <> view_rows_before THEN
    RAISE EXCEPTION
      'Safety check failed: view_employee_workloads row count changed from % to %',
      view_rows_before,
      view_rows_after;
  END IF;

  IF owner_after IS DISTINCT FROM owner_before
    OR acl_after IS DISTINCT FROM acl_before
    OR reloptions_after IS DISTINCT FROM reloptions_before THEN
    RAISE EXCEPTION
      'Safety check failed: view_employee_workloads metadata changed';
  END IF;

  IF NOT column_existed_before AND EXISTS (
    SELECT 1 FROM public.loadings WHERE is_prospective IS DISTINCT FROM false
  ) THEN
    RAISE EXCEPTION
      'Safety check failed: an existing loading is not initialized with false';
  END IF;
END
$migration$;

COMMIT;
