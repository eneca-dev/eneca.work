-- ============================================================================
-- Migration: Add RPC function for server-side notification filtering
-- Date: 2025-12-12
-- Description: Creates PostgreSQL RPC function for efficient server-side
--              filtering of notifications by type, read status, and archive status.
--              Includes covering index for optimal performance.
-- ============================================================================

-- Drop existing function if upgrading
DROP FUNCTION IF EXISTS get_user_notifications_filtered(UUID, INTEGER, INTEGER, BOOLEAN, BOOLEAN, TEXT[]);

-- ============================================================================
-- RPC Function: get_user_notifications_filtered
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_notifications_filtered(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0,
  p_only_unread BOOLEAN DEFAULT FALSE,
  p_include_archived BOOLEAN DEFAULT FALSE,
  p_types TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  -- user_notifications columns
  id UUID,
  notification_id UUID,
  user_id UUID,
  is_read BOOLEAN,
  is_archived BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,

  -- notifications columns (prefixed with n_)
  n_entity_type_id UUID,
  n_payload JSONB,
  n_rendered_text TEXT,
  n_created_at TIMESTAMPTZ,
  n_source_comment_id UUID,

  -- entity_types columns
  entity_type_name VARCHAR,

  -- Total count для UI (одним запросом!)
  total_count BIGINT
)
LANGUAGE plpgsql
STABLE  -- STABLE важно для кеширования в пределах транзакции
SECURITY DEFINER  -- Используем права владельца функции
SET search_path TO 'public'  -- Защита от schema search path атак
AS $$
BEGIN
  RETURN QUERY
  SELECT
    un.id,
    un.notification_id,
    un.user_id,
    un.is_read,
    un.is_archived,
    un.created_at,
    un.updated_at,

    n.entity_type_id AS n_entity_type_id,
    n.payload AS n_payload,
    n.rendered_text AS n_rendered_text,
    n.created_at AS n_created_at,
    n.source_comment_id AS n_source_comment_id,

    et.entity_name AS entity_type_name,

    -- Window function для count - эффективнее CTE!
    COUNT(*) OVER() AS total_count

  FROM user_notifications un
  INNER JOIN notifications n ON n.id = un.notification_id
  INNER JOIN entity_types et ON et.id = n.entity_type_id

  WHERE un.user_id = p_user_id
    -- Фильтр по прочитанности
    AND (NOT p_only_unread OR un.is_read = FALSE)

    -- Фильтр по архиву
    AND (p_include_archived OR un.is_archived = FALSE)

    -- Фильтр по типам (NULL = все типы)
    AND (p_types IS NULL OR et.entity_name = ANY(p_types))

  ORDER BY un.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Права доступа
GRANT EXECUTE ON FUNCTION get_user_notifications_filtered TO authenticated;

-- Комментарий для документации
COMMENT ON FUNCTION get_user_notifications_filtered IS
  'Fetches user notifications with server-side filtering by type, read status, and archive status.
   Returns paginated results with total count in a single query using window function.
   Optimized with composite indexes on user_notifications table.

   Parameters:
   - p_user_id: UUID of the user
   - p_limit: Number of records to return (default: 20)
   - p_offset: Number of records to skip (default: 0)
   - p_only_unread: Filter only unread notifications (default: false)
   - p_include_archived: Include archived notifications (default: false)
   - p_types: Array of entity type names to filter by (NULL = all types)

   Returns: Table with flattened notification data and total count';

-- ============================================================================
-- Additional Covering Index for Performance
-- ============================================================================

-- Covering index для запросов с фильтрацией по типам
-- INCLUDE добавляет notification_id в индекс для Index-Only Scan
CREATE INDEX IF NOT EXISTS idx_user_notif_user_arch_created_covering
  ON user_notifications(user_id, is_archived, created_at DESC)
  INCLUDE (notification_id);

-- Анализ таблиц после добавления индекса
ANALYZE user_notifications;
ANALYZE notifications;
ANALYZE entity_types;

-- ============================================================================
-- Migration Verification (автоматический тест)
-- ============================================================================

DO $$
DECLARE
  test_user_id UUID;
  result_count INT;
  test_result RECORD;
BEGIN
  -- Берем первого пользователя для теста
  SELECT user_id INTO test_user_id FROM user_notifications LIMIT 1;

  IF test_user_id IS NOT NULL THEN
    -- Тестируем базовый вызов
    SELECT COUNT(*) INTO result_count
    FROM get_user_notifications_filtered(
      p_user_id := test_user_id,
      p_limit := 10
    );

    RAISE NOTICE '✅ RPC function test: Retrieved % rows for user %', result_count, test_user_id;

    -- Тестируем фильтр по типам
    SELECT COUNT(*) INTO result_count
    FROM get_user_notifications_filtered(
      p_user_id := test_user_id,
      p_types := ARRAY['announcement']::TEXT[]
    );

    RAISE NOTICE '✅ Type filter test: Retrieved % announcement notifications', result_count;

    -- Тестируем total_count
    SELECT DISTINCT total_count INTO result_count
    FROM get_user_notifications_filtered(
      p_user_id := test_user_id,
      p_limit := 5
    );

    IF result_count IS NOT NULL THEN
      RAISE NOTICE '✅ Total count test: total_count = %', result_count;
    ELSE
      RAISE NOTICE '⚠️  Total count test: No results (user has no notifications)';
    END IF;

  ELSE
    RAISE NOTICE '⚠️  No test data available - skipping RPC test';
  END IF;
END $$;

-- ============================================================================
-- End of migration
-- ============================================================================
