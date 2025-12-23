-- Обновить view_section_checkpoints для добавления object_id в linked_sections
-- Это необходимо для отображения связей между чекпоинтами в разных объектах

CREATE OR REPLACE VIEW view_section_checkpoints AS
SELECT
  sc.checkpoint_id,
  sc.section_id,
  sc.type_id,
  ct.type AS type_code,
  ct.name AS type_name,
  ct.is_custom,
  sc.title,
  sc.description,
  sc.checkpoint_date,

  -- Resolved icon/color (custom override OR type default)
  COALESCE(sc.custom_icon, ct.icon) AS icon,
  COALESCE(sc.custom_color, ct.color) AS color,

  -- Completion tracking
  sc.completed_at,
  sc.completed_by,

  -- Computed status based on completed_at and checkpoint_date
  CASE
    WHEN sc.completed_at IS NOT NULL AND sc.completed_at::date <= sc.checkpoint_date
      THEN 'completed'
    WHEN sc.completed_at IS NOT NULL AND sc.completed_at::date > sc.checkpoint_date
      THEN 'completed_late'
    WHEN sc.completed_at IS NULL AND CURRENT_DATE > sc.checkpoint_date
      THEN 'overdue'
    ELSE 'pending'
  END AS status,

  -- Status label for display (Russian translation)
  CASE
    WHEN sc.completed_at IS NOT NULL AND sc.completed_at::date <= sc.checkpoint_date THEN 'Выполнено'
    WHEN sc.completed_at IS NOT NULL AND sc.completed_at::date > sc.checkpoint_date THEN 'Выполнено (просрочено)'
    WHEN CURRENT_DATE > sc.checkpoint_date THEN 'Просрочено'
    ELSE 'Ожидает выполнения'
  END AS status_label,

  sc.created_by,
  sc.created_at,
  sc.updated_at,

  -- Context fields from section
  sec.section_responsible,

  -- Project manager from project hierarchy
  proj.project_manager,

  -- Aggregate linked sections as JSON array (UPDATED: добавлен object_id)
  COALESCE(
    (SELECT jsonb_agg(jsonb_build_object(
      'section_id', csl.section_id,
      'section_name', s.section_name,
      'object_id', s.section_object_id
    ))
    FROM checkpoint_section_links csl
    JOIN sections s ON s.section_id = csl.section_id
    WHERE csl.checkpoint_id = sc.checkpoint_id),
    '[]'::jsonb
  ) AS linked_sections,

  -- Count of linked sections
  COALESCE(
    (SELECT COUNT(*)::int
    FROM checkpoint_section_links
    WHERE checkpoint_id = sc.checkpoint_id),
    0
  ) AS linked_sections_count

FROM section_checkpoints sc
JOIN checkpoint_types ct ON ct.type_id = sc.type_id
JOIN sections sec ON sec.section_id = sc.section_id
LEFT JOIN objects obj ON obj.object_id = sec.section_object_id
LEFT JOIN stages st ON st.stage_id = obj.object_stage_id
LEFT JOIN projects proj ON proj.project_id = st.stage_project_id;

COMMENT ON VIEW view_section_checkpoints IS
'Полная информация о чекпоинтах с разрешенными icon/color, статусом, контекстом раздела, и связанными разделами (включая object_id для cross-object связей)';
