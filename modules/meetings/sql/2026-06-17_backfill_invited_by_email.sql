-- ============================================================================
-- ВЫПОЛНИТЬ В MEETINGS Supabase-проекте (где лежит meeting_reports). НЕ в основном.
-- Одноразовый бэкфилл: проставляет invited_by_email старым строкам по имени
-- пригласившего, чтобы существующие созвоны стали видны владельцам в eneca.work.
-- Новые созвоны бот заполняет сам — скрипт нужен только для старого бэклога.
-- Идемпотентен: трогает только строки, где invited_by_email ещё NULL.
-- ============================================================================

-- ВАЖНО: сверь точное написание имени со значениями в таблице:
--   select invited_by_name, invited_by_email, count(*)
--   from meeting_reports group by 1, 2 order by 3 desc;

BEGIN;

-- Владимир Нестерович (в данных имя с двойным пробелом — матчим через ilike).
-- Email — vladzimir (белорусская транслитерация), ровно как пишет бот.
UPDATE meeting_reports
SET invited_by_email = 'vladzimir.nesterovich@enecagroup.com'
WHERE invited_by_email IS NULL
  AND invited_by_name ILIKE '%нестерович%';

-- Шаблон для остальных пользователей (раскомментируй и заполни по выводу проверки):
-- UPDATE meeting_reports
-- SET invited_by_email = 'ivan.ivanov@enecagroup.com'
-- WHERE invited_by_email IS NULL
--   AND invited_by_name ILIKE '%иванов%';

COMMIT;

-- Проверка результата:
--   select invited_by_name, invited_by_email, count(*)
--   from meeting_reports group by 1, 2 order by 3 desc;
