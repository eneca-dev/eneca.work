-- Create view for projects with department information
-- This view is used in LoadingModal to efficiently filter projects by user's department

CREATE OR REPLACE VIEW view_projects_with_department_info AS
SELECT
  p.project_id,
  p.project_name,
  p.project_description,
  p.project_status,
  p.project_created,
  p.project_updated,
  -- Array of unique department_ids from all sections in the project
  -- Used for filtering projects in "My Projects" mode
  ARRAY_AGG(DISTINCT sh.responsible_department_id)
    FILTER (WHERE sh.responsible_department_id IS NOT NULL)
    AS department_ids,
  -- Count of sections in the project
  COUNT(DISTINCT sh.section_id) AS sections_count
FROM projects p
LEFT JOIN view_section_hierarchy sh ON sh.project_id = p.project_id
WHERE p.project_status = 'active'
GROUP BY
  p.project_id,
  p.project_name,
  p.project_description,
  p.project_status,
  p.project_created,
  p.project_updated
ORDER BY p.project_name;

-- Grant access to authenticated users
GRANT SELECT ON view_projects_with_department_info TO authenticated;

-- Add comment for documentation
COMMENT ON VIEW view_projects_with_department_info IS
'Provides a list of active projects with aggregated department information.
Used in LoadingModal to filter projects by user department without loading full project tree.
department_ids: Array of unique department IDs from all section responsible persons in the project.
sections_count: Total number of sections in the project.';
