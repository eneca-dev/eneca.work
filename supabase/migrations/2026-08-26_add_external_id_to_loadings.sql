-- ============================================================================
-- loadings: добавление external_id / external_source
--
-- Проблема: у loadings, в отличие от projects/objects/sections/stages, нет
-- ключа внешнего источника — нечем идемпотентно апсертить строки, созданные
-- автосинком (например, отпуска из Worksection в проект "Отпуск"), не
-- задваивая их при повторных прогонах.
--
-- Решение: добавляем те же две nullable-колонки, что уже есть на
-- projects/objects/sections/stages (external_id text, external_source text),
-- и такой же по форме индекс уникальности, что у sections/stages —
-- UNIQUE(<родитель>, external_id, external_source), где родитель для
-- loadings — loading_section. NULL-значения не участвуют в конфликте
-- уникального индекса (стандартное поведение Postgres), поэтому все
-- существующие ручные загрузки (external_id IS NULL) не затрагиваются.
--
-- Совместимость: чисто аддитивная миграция (ADD COLUMN без DEFAULT, только
-- метаданные — не требует переписывания таблицы даже на большой loadings).
-- Ни один существующий триггер (fn_loadings_sync_section_from_stage,
-- fn_track_loading_changes, fn_track_loading_deletion,
-- trigger_refresh_project_users_on_loading, update_loadings_loading_updated)
-- не обращается к loadings через SELECT * / фиксированное число колонок —
-- проверено по определению функций. Realtime-публикация supabase_realtime
-- включает loadings без списка колонок (prattrs IS NULL) — новые поля
-- реплицируются автоматически, ничего чинить не нужно.
--
-- Контроль до миграции: loadings 5721 строка, PostgreSQL 15.8.
-- ============================================================================

ALTER TABLE public.loadings
  ADD COLUMN external_id text,
  ADD COLUMN external_source text;

CREATE INDEX idx_loadings_external
  ON public.loadings USING btree (external_id, external_source);

CREATE UNIQUE INDEX loadings_section_external_unique
  ON public.loadings USING btree (loading_section, external_id, external_source);

CREATE INDEX idx_loadings_external_lookup
  ON public.loadings USING btree (loading_section, external_id, external_source)
  WHERE (external_id IS NOT NULL);
