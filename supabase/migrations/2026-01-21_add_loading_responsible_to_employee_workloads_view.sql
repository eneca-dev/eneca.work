-- Добавляем loading_responsible в view_employee_workloads
-- Проблема: employeeId в модалке редактирования не предзаполнялся,
-- потому что view не возвращал loading_responsible

-- Удаляем старый view
DROP VIEW IF EXISTS view_employee_workloads;

-- Создаем заново с loading_responsible
CREATE VIEW view_employee_workloads AS
SELECT
    p.user_id,
    p.first_name,
    p.last_name,
    CASE
        WHEN TRIM(p.first_name) = '' OR p.first_name IS NULL OR TRIM(p.last_name) = '' OR p.last_name IS NULL
        THEN SPLIT_PART(p.email, '@', 1)
        ELSE CONCAT(p.last_name, ' ', p.first_name)
    END AS full_name,
    p.email,
    p.avatar_url,
    p.work_format,
    p.employment_rate,
    pos.position_id,
    COALESCE(pos.position_name, 'Без должности') AS position_name,
    p.department_id AS original_department_id,
    COALESCE(d.department_name, 'Без отдела') AS original_department_name,
    p.team_id AS original_team_id,
    COALESCE(t.team_name, 'Без команды') AS original_team_name,
    COALESCE(p.department_id, '00000000-0000-0000-0000-000000000000'::uuid) AS final_department_id,
    COALESCE(d.department_name, 'Без отдела') AS final_department_name,
    COALESCE(p.team_id, '00000000-0000-0000-0000-000000000000'::uuid) AS final_team_id,
    COALESCE(t.team_name, 'Без команды') AS final_team_name,
    cat.category_id,
    COALESCE(cat.category_name, 'Без категории') AS category_name,
    NULL::uuid AS role_id,
    CASE
        WHEN EXISTS (
            SELECT 1 FROM user_roles ur2
            JOIN roles r2 ON r2.id = ur2.role_id
            WHERE ur2.user_id = p.user_id AND r2.name = 'admin'
        ) THEN 'admin'
        WHEN EXISTS (
            SELECT 1 FROM user_roles ur2
            JOIN roles r2 ON r2.id = ur2.role_id
            WHERE ur2.user_id = p.user_id AND r2.name = 'department_head'
        ) THEN 'department_head'
        WHEN EXISTS (
            SELECT 1 FROM user_roles ur2
            JOIN roles r2 ON r2.id = ur2.role_id
            WHERE ur2.user_id = p.user_id AND r2.name = 'team_lead'
        ) THEN 'team_lead'
        WHEN EXISTS (
            SELECT 1 FROM user_roles ur2
            JOIN roles r2 ON r2.id = ur2.role_id
            WHERE ur2.user_id = p.user_id AND r2.name = 'user'
        ) THEN 'user'
        ELSE NULL
    END AS role_name,
    l.loading_id,
    -- ДОБАВЛЕНО: loading_responsible для правильного маппинга employeeId
    l.loading_responsible,
    CASE
        WHEN l.loading_stage IS NOT NULL THEN ds.decomposition_stage_section_id
        ELSE l.loading_section
    END AS loading_section,
    l.loading_start,
    l.loading_finish,
    l.loading_rate,
    l.loading_status,
    s.section_id,
    s.section_name,
    pr.project_id,
    pr.project_name,
    pr.project_status,
    CASE
        WHEN l.loading_id IS NOT NULL THEN true
        ELSE false
    END AS has_loadings,
    COUNT(l.loading_id) OVER (PARTITION BY p.user_id) AS loadings_count,
    ds.decomposition_stage_id AS stage_id,
    ds.decomposition_stage_name AS stage_name,
    l.loading_comment,
    o.object_id,
    o.object_name
FROM profiles p
LEFT JOIN departments d ON p.department_id = d.department_id
LEFT JOIN teams t ON p.team_id = t.team_id
LEFT JOIN positions pos ON p.position_id = pos.position_id
LEFT JOIN categories cat ON p.category_id = cat.category_id
LEFT JOIN loadings l ON p.user_id = l.loading_responsible AND l.loading_status = 'active'::loading_status_type
LEFT JOIN decomposition_stages ds ON ds.decomposition_stage_id = l.loading_stage
LEFT JOIN sections s ON (l.loading_stage IS NOT NULL AND s.section_id = ds.decomposition_stage_section_id)
                     OR (l.loading_stage IS NULL AND s.section_id = l.loading_section)
LEFT JOIN projects pr ON pr.project_id = s.section_project_id
LEFT JOIN objects o ON o.object_id = s.section_object_id
ORDER BY d.department_name, t.team_name, p.last_name, p.first_name;
