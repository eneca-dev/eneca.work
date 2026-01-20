-- Оптимизация функции get_projects_list
-- Проблема: LEFT JOIN с материализованным представлением и фильтрация по массиву медленные
-- Решение: Прямая фильтрация через EXISTS для режима 'my'

DROP FUNCTION IF EXISTS get_projects_list(TEXT, UUID);

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
  is_favorite BOOLEAN
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
  IF p_mode = 'my' THEN
    -- Режим "Мои проекты" - фильтруем через EXISTS (быстрее чем JOIN + массив)
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
      (ufp.user_id IS NOT NULL) as is_favorite
    FROM projects p
    LEFT JOIN profiles pm ON p.project_manager = pm.user_id
    LEFT JOIN user_favorite_projects ufp ON ufp.project_id = p.project_id AND ufp.user_id = p_user_id
    WHERE
      -- Менеджер проекта
      p.project_manager = p_user_id
      OR
      -- Ответственный за раздел
      EXISTS (
        SELECT 1
        FROM sections sec
        JOIN objects o ON sec.section_object_id = o.object_id
        JOIN stages s ON o.object_stage_id = s.stage_id
        WHERE s.stage_project_id = p.project_id
          AND sec.section_responsible = p_user_id
      )
      OR
      -- Пользователь с загрузками
      EXISTS (
        SELECT 1
        FROM loadings l
        JOIN sections sec ON l.loading_section = sec.section_id
        JOIN objects o ON sec.section_object_id = o.object_id
        JOIN stages s ON o.object_stage_id = s.stage_id
        WHERE s.stage_project_id = p.project_id
          AND l.loading_responsible = p_user_id
      )
    ORDER BY p.project_name;
  ELSE
    -- Режим "Все проекты"
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
      (ufp.user_id IS NOT NULL) as is_favorite
    FROM projects p
    LEFT JOIN profiles pm ON p.project_manager = pm.user_id
    LEFT JOIN user_favorite_projects ufp ON ufp.project_id = p.project_id AND ufp.user_id = p_user_id
    ORDER BY p.project_name;
  END IF;
END;
$$;

-- Даём права на выполнение функции
GRANT EXECUTE ON FUNCTION get_projects_list TO authenticated;
GRANT EXECUTE ON FUNCTION get_projects_list TO anon;

-- Создаём индексы для ускорения фильтрации
-- Индекс для поиска разделов по ответственному
CREATE INDEX IF NOT EXISTS idx_sections_responsible
ON sections(section_responsible)
WHERE section_responsible IS NOT NULL;

-- Индекс для поиска загрузок по ответственному
CREATE INDEX IF NOT EXISTS idx_loadings_responsible
ON loadings(loading_responsible)
WHERE loading_responsible IS NOT NULL;

-- Индекс для связи objects -> stages
CREATE INDEX IF NOT EXISTS idx_objects_stage_id
ON objects(object_stage_id);

-- Индекс для связи sections -> objects
CREATE INDEX IF NOT EXISTS idx_sections_object_id
ON sections(section_object_id);

-- Индекс для связи stages -> projects
CREATE INDEX IF NOT EXISTS idx_stages_project_id
ON stages(stage_project_id);
