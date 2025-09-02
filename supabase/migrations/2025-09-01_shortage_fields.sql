-- Добавление поддержки дефицита ресурсов в таблицу loadings
-- "Дефицит" хранится как отдельная запись загрузки без ответственного сотрудника

-- Колонка-признак дефицита
ALTER TABLE public.loadings
  ADD COLUMN IF NOT EXISTS is_shortage boolean NOT NULL DEFAULT false;

-- Привязка дефицита к отделу/команде
ALTER TABLE public.loadings
  ADD COLUMN IF NOT EXISTS shortage_department_id uuid NULL REFERENCES public.departments(department_id) ON DELETE SET NULL;

ALTER TABLE public.loadings
  ADD COLUMN IF NOT EXISTS shortage_team_id uuid NULL REFERENCES public.teams(team_id) ON DELETE SET NULL;

-- Описание дефицита (опционально)
ALTER TABLE public.loadings
  ADD COLUMN IF NOT EXISTS shortage_description text NULL;

-- Ограничение: если is_shortage = true, то ответственный сотрудник отсутствует
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_shortage_without_responsible'
  ) THEN
    ALTER TABLE public.loadings
      ADD CONSTRAINT chk_shortage_without_responsible
      CHECK (NOT is_shortage OR loading_responsible IS NULL);
  END IF;
END $$;

-- Индексы для ускорения выборок по дефициту
CREATE INDEX IF NOT EXISTS idx_loadings_shortage_flags
  ON public.loadings (is_shortage, loading_status);

CREATE INDEX IF NOT EXISTS idx_loadings_shortage_team_period
  ON public.loadings (shortage_team_id, loading_start, loading_finish)
  WHERE is_shortage = true;

CREATE INDEX IF NOT EXISTS idx_loadings_shortage_department_period
  ON public.loadings (shortage_department_id, loading_start, loading_finish)
  WHERE is_shortage = true;


