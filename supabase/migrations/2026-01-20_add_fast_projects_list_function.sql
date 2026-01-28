-- Создаём оптимизированную функцию для быстрой загрузки списка проектов
-- Обходим PostgREST View и делаем прямой SQL запрос

CREATE OR REPLACE FUNCTION get_projects_list(
  p_mode TEXT DEFAULT 'all',
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  project_id UUID,
  node_name TEXT,
  stage_type TEXT,
  project_status project_status_enum,
  manager_id UUID,
  manager_name TEXT,
  manager_avatar TEXT,
  is_favorite BOOLEAN,
  involved_users UUID[]
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  -- Получаем текущего пользователя если не передан
  IF p_user_id IS NULL THEN
    p_user_id := auth.uid();
  END IF;

  -- Возвращаем список проектов
  RETURN QUERY
  SELECT
    p.project_id,
    p.project_name as node_name,
    p.stage_type,
    p.project_status,
    p.project_manager as manager_id,
    CASE
      WHEN p.project_manager IS NOT NULL THEN
        COALESCE(
          NULLIF(TRIM(BOTH FROM pm.first_name || ' ' || pm.last_name), ''),
          SPLIT_PART(pm.email, '@', 1)
        )
      ELSE NULL
    END as manager_name,
    pm.avatar_url as manager_avatar,
    (ufp.user_id IS NOT NULL) as is_favorite,
    pu.involved_users
  FROM projects p
  LEFT JOIN profiles pm ON p.project_manager = pm.user_id
  LEFT JOIN user_favorite_projects ufp ON ufp.project_id = p.project_id AND ufp.user_id = p_user_id
  LEFT JOIN mat_project_involved_users pu ON pu.project_id = p.project_id
  WHERE
    CASE
      WHEN p_mode = 'my' THEN pu.involved_users @> ARRAY[p_user_id]
      ELSE TRUE
    END
  ORDER BY p.project_name;
END;
$$;

-- Даём права на выполнение функции
GRANT EXECUTE ON FUNCTION get_projects_list TO authenticated;
GRANT EXECUTE ON FUNCTION get_projects_list TO anon;
