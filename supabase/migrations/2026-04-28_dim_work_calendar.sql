-- ============================================================================
-- Migration: dim_work_calendar — справочник рабочих дней
-- Description:
--   Кэшированная таблица рабочих дней с учётом выходных, праздников РБ и
--   переносов из глобальных calendar_events. Используется для быстрого
--   COUNT(*) в расчёте часов по диапазонам loadings.
-- Date: 2026-04-28
-- Связано с: docs/production/budgets-calc-from-loadings.md
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. Таблица dim_work_calendar
-- ============================================================================

CREATE TABLE IF NOT EXISTS dim_work_calendar (
  calendar_date  DATE PRIMARY KEY,
  is_working_day BOOLEAN NOT NULL,
  is_holiday     BOOLEAN NOT NULL DEFAULT false,
  is_swap        BOOLEAN NOT NULL DEFAULT false,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dim_work_calendar_working
  ON dim_work_calendar(calendar_date)
  WHERE is_working_day = true;

COMMENT ON TABLE dim_work_calendar IS
  'Справочник рабочих дней. Источник: weekday + calendar_events (Праздник/Перенос, is_global). Обновляется триггером trg_calendar_events_refresh_dim.';

-- RLS — read-only для всех авторизованных
ALTER TABLE dim_work_calendar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dim_work_calendar_select ON dim_work_calendar;
CREATE POLICY dim_work_calendar_select ON dim_work_calendar
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- ============================================================================
-- 2. Функция refresh_work_calendar(p_start, p_end)
-- ============================================================================
-- Перезаписывает рабочие дни в указанном диапазоне:
--   1. Базовое значение: weekdays = рабочие, weekend = нет
--   2. Праздники (тип 'Праздник', is_global) → нерабочий
--   3. Переносы (тип 'Перенос', is_global) → инвертирует is_working_day
--      или явно использует calendar_event_is_weekday если задан
-- ============================================================================

CREATE OR REPLACE FUNCTION refresh_work_calendar(p_start DATE, p_end DATE)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- 1. Базовое заполнение: Пн-Пт = рабочие, Сб-Вс = нет
  INSERT INTO dim_work_calendar (calendar_date, is_working_day, is_holiday, is_swap)
  SELECT
    d::date,
    EXTRACT(ISODOW FROM d) BETWEEN 1 AND 5,  -- ISO: 1=Пн ... 7=Вс
    false,
    false
  FROM generate_series(p_start, p_end, '1 day'::interval) d
  ON CONFLICT (calendar_date) DO UPDATE SET
    is_working_day = EXCLUDED.is_working_day,
    is_holiday     = false,
    is_swap        = false,
    updated_at     = now();

  -- 2. Накладываем праздники → нерабочий
  UPDATE dim_work_calendar wc SET
    is_holiday     = true,
    is_working_day = false,
    updated_at     = now()
  FROM calendar_events ce
  WHERE ce.calendar_event_is_global
    AND ce.calendar_event_type = 'Праздник'
    AND wc.calendar_date BETWEEN p_start AND p_end
    AND wc.calendar_date BETWEEN ce.calendar_event_date_start::date
                             AND COALESCE(ce.calendar_event_date_end::date,
                                          ce.calendar_event_date_start::date);

  -- 3. Накладываем переносы — приоритет calendar_event_is_weekday если задан
  --    Праздники имеют приоритет над переносами: пропускаем wc.is_holiday=true
  UPDATE dim_work_calendar wc SET
    is_swap        = true,
    is_working_day = COALESCE(ce.calendar_event_is_weekday, NOT wc.is_working_day),
    updated_at     = now()
  FROM calendar_events ce
  WHERE ce.calendar_event_is_global
    AND ce.calendar_event_type = 'Перенос'
    AND wc.is_holiday = false
    AND wc.calendar_date BETWEEN p_start AND p_end
    AND wc.calendar_date BETWEEN ce.calendar_event_date_start::date
                             AND COALESCE(ce.calendar_event_date_end::date,
                                          ce.calendar_event_date_start::date);
END;
$$;

COMMENT ON FUNCTION refresh_work_calendar IS
  'Перезаписывает рабочие дни в диапазоне [p_start..p_end] на основе calendar_events';

-- ============================================================================
-- 3. Триггер на calendar_events
-- ============================================================================
-- Срабатывает только на is_global = true И тип IN ('Праздник', 'Перенос').
-- Обычные события (Отпуск, Больничный, Отгул) — не затрагиваются.
-- ============================================================================

CREATE OR REPLACE FUNCTION trg_calendar_events_refresh_dim()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_start DATE;
  v_end   DATE;
  v_should_refresh BOOLEAN := false;
BEGIN
  -- Проверяем NEW (для INSERT/UPDATE)
  IF TG_OP IN ('INSERT', 'UPDATE')
     AND NEW.calendar_event_is_global
     AND NEW.calendar_event_type IN ('Праздник', 'Перенос') THEN
    v_should_refresh := true;
    v_start := NEW.calendar_event_date_start::date;
    v_end   := COALESCE(NEW.calendar_event_date_end::date,
                        NEW.calendar_event_date_start::date);
  END IF;

  -- Проверяем OLD (для UPDATE/DELETE) — расширяем диапазон
  IF TG_OP IN ('UPDATE', 'DELETE')
     AND OLD.calendar_event_is_global
     AND OLD.calendar_event_type IN ('Праздник', 'Перенос') THEN
    v_should_refresh := true;
    v_start := LEAST(
      COALESCE(v_start, OLD.calendar_event_date_start::date),
      OLD.calendar_event_date_start::date
    );
    v_end := GREATEST(
      COALESCE(v_end, OLD.calendar_event_date_start::date),
      COALESCE(OLD.calendar_event_date_end::date,
               OLD.calendar_event_date_start::date)
    );
  END IF;

  IF v_should_refresh THEN
    PERFORM refresh_work_calendar(v_start, v_end);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_calendar_events_refresh_dim ON calendar_events;
CREATE TRIGGER trg_calendar_events_refresh_dim
  AFTER INSERT OR UPDATE OR DELETE ON calendar_events
  FOR EACH ROW EXECUTE FUNCTION trg_calendar_events_refresh_dim();

COMMENT ON FUNCTION trg_calendar_events_refresh_dim IS
  'Триггер обновления dim_work_calendar при изменении глобальных праздников/переносов';

-- ============================================================================
-- 4. Инициализация — заполняем 7 лет (2024-01-01..2030-12-31)
-- ============================================================================

SELECT refresh_work_calendar('2024-01-01'::date, '2030-12-31'::date);

COMMIT;
