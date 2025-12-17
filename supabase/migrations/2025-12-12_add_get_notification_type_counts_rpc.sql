-- RPC функция для подсчета уведомлений по типам
-- Избегает проблем с вложенными JOIN алиасами в PostgREST

CREATE OR REPLACE FUNCTION get_notification_type_counts(
  p_user_id UUID,
  p_include_archived BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  type_name TEXT,
  count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    et.name AS type_name,
    COUNT(*)::BIGINT AS count
  FROM user_notifications un
  INNER JOIN notifications n ON n.id = un.notification_id
  INNER JOIN entity_types et ON et.id = n.entity_type_id
  WHERE
    un.user_id = p_user_id
    AND (p_include_archived = TRUE OR un.is_archived = FALSE)
  GROUP BY et.name
  ORDER BY et.name;
END;
$$;

-- Комментарий для документации
COMMENT ON FUNCTION get_notification_type_counts IS
'Возвращает количество уведомлений пользователя, сгруппированных по типам.
Позволяет опционально включить архивированные уведомления.';
