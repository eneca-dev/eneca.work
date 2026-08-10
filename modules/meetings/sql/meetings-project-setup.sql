-- ============================================================================
-- ВЫПОЛНИТЬ В MEETINGS Supabase-проекте (отдельном, где лежит meeting_reports).
-- НЕ в основном проекте eneca.work.
-- ============================================================================

-- 1) Email пригласившего бота — заполняет Teams-бот. По нему сопоставляем владельца
--    с пользователем eneca.work (profiles.email).
ALTER TABLE meeting_reports ADD COLUMN IF NOT EXISTS invited_by_email text;

-- (опционально для скорости фильтра «свои созвоны»)
CREATE INDEX IF NOT EXISTS idx_meeting_reports_invited_email
  ON meeting_reports (lower(invited_by_email));

-- 2) Шеры: кому владелец открыл доступ к созвону.
--    shared_with_user_id / shared_by_user_id — это profiles.user_id из eneca.work
--    (без внешнего ключа — другая база).
CREATE TABLE IF NOT EXISTS meeting_report_shares (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id           uuid NOT NULL REFERENCES meeting_reports(id) ON DELETE CASCADE,
  shared_with_user_id uuid NOT NULL,
  shared_by_user_id   uuid,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (report_id, shared_with_user_id)
);

CREATE INDEX IF NOT EXISTS idx_mrs_user   ON meeting_report_shares (shared_with_user_id);
CREATE INDEX IF NOT EXISTS idx_mrs_report ON meeting_report_shares (report_id);

-- Доступ к таблице — только из приложения под service-role (RLS обходится).
-- Включаем RLS без политик: для anon/authenticated доступа не будет.
ALTER TABLE meeting_report_shares ENABLE ROW LEVEL SECURITY;
