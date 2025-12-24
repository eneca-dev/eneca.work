-- ============================================================================
-- ROLLBACK Migration: Remove actual hours from v_resource_graph
-- Date: 2025-12-20
-- Description: Reverts v_resource_graph to version WITHOUT actual hours
-- Usage: Apply this migration if you need to rollback the changes
-- ============================================================================

DROP VIEW IF EXISTS public.v_resource_graph;

CREATE VIEW public.v_resource_graph AS
 SELECT p.project_id,
    p.project_name,
    p.project_status,
    p.project_manager AS manager_id,
    pm.first_name AS manager_first_name,
    pm.last_name AS manager_last_name,
    concat(pm.last_name, ' ', pm.first_name) AS manager_name,
    st.stage_id,
    st.stage_name,
    o.object_id,
    o.object_name,
    sec.section_id,
    sec.section_name,
    sec.section_responsible AS section_responsible_id,
    sr.first_name AS section_responsible_first_name,
    sr.last_name AS section_responsible_last_name,
    concat(sr.last_name, ' ', sr.first_name) AS section_responsible_name,
    sr.avatar_url AS section_responsible_avatar,
    sec.section_start_date,
    sec.section_end_date,
    sec.section_status_id,
    ss.name AS section_status_name,
    ss.color AS section_status_color,
    sr.department_id AS section_department_id,
    dept.department_name AS section_department_name,
    dept.subdivision_id AS section_subdivision_id,
    sub.subdivision_name AS section_subdivision_name,
    rc.readiness_checkpoints AS section_readiness_checkpoints,
    COALESCE(( SELECT jsonb_agg(combined.snapshot ORDER BY (combined.snapshot ->> 'date'::text)) AS jsonb_agg
           FROM ( SELECT jsonb_build_object('date', srs.snapshot_date, 'value', srs.actual_readiness) AS snapshot
                   FROM section_readiness_snapshots srs
                  WHERE srs.section_id = sec.section_id AND srs.snapshot_date < CURRENT_DATE
                UNION ALL
                 SELECT jsonb_build_object('date', CURRENT_DATE, 'value', COALESCE(round(sum(di2.decomposition_item_progress::numeric * di2.decomposition_item_planned_hours) / NULLIF(sum(di2.decomposition_item_planned_hours), 0::numeric)), 0::numeric)::integer) AS snapshot
                   FROM decomposition_stages ds2
                     JOIN decomposition_items di2 ON di2.decomposition_item_stage_id = ds2.decomposition_stage_id
                  WHERE ds2.decomposition_stage_section_id = sec.section_id AND di2.decomposition_item_planned_hours > 0::numeric
                 HAVING sum(di2.decomposition_item_planned_hours) > 0::numeric) combined), '[]'::jsonb) AS section_actual_readiness,
    bs.budget_spending AS section_budget_spending,
    ds.decomposition_stage_id,
    ds.decomposition_stage_name,
    ds.decomposition_stage_start,
    ds.decomposition_stage_finish,
    ds.decomposition_stage_order,
    ds.stage_status_id AS decomposition_stage_status_id,
    dss.name AS decomposition_stage_status_name,
    dss.color::character varying AS decomposition_stage_status_color,
    di.decomposition_item_id,
    di.decomposition_item_description,
    di.decomposition_item_planned_hours,
    di.decomposition_item_planned_due_date,
    di.decomposition_item_progress,
    di.decomposition_item_order,
    di.decomposition_item_responsible AS item_responsible_id,
    ir.first_name AS item_responsible_first_name,
    ir.last_name AS item_responsible_last_name,
    concat(ir.last_name, ' ', ir.first_name) AS item_responsible_name,
    di.decomposition_item_status_id,
    dis.name AS item_status_name,
    dis.color AS item_status_color,
    di.decomposition_item_difficulty_id,
    dif.difficulty_abbr AS item_difficulty_abbr,
    dif.difficulty_definition AS item_difficulty_name,
    di.decomposition_item_work_category_id,
    wc.work_category_name,
    sec.section_description
   FROM projects p
     LEFT JOIN profiles pm ON pm.user_id = p.project_manager
     LEFT JOIN stages st ON st.stage_project_id = p.project_id
     LEFT JOIN objects o ON o.object_stage_id = st.stage_id
     LEFT JOIN sections sec ON sec.section_object_id = o.object_id
     LEFT JOIN profiles sr ON sr.user_id = sec.section_responsible
     LEFT JOIN departments dept ON dept.department_id = sr.department_id
     LEFT JOIN subdivisions sub ON sub.subdivision_id = dept.subdivision_id
     LEFT JOIN section_statuses ss ON ss.id = sec.section_status_id
     LEFT JOIN LATERAL ( SELECT jsonb_agg(jsonb_build_object('date', src.checkpoint_date, 'value', src.planned_readiness) ORDER BY src.checkpoint_date) AS readiness_checkpoints
           FROM section_readiness_checkpoints src
          WHERE src.section_id = sec.section_id) rc ON true
     LEFT JOIN LATERAL ( SELECT
                CASE
                    WHEN main_budget.planned_amount IS NULL OR main_budget.planned_amount = 0::numeric THEN NULL::jsonb
                    ELSE ( SELECT jsonb_agg(jsonb_build_object('date', daily.log_date, 'spent', daily.cumulative_spent, 'percentage', round(daily.cumulative_spent / main_budget.planned_amount * 100::numeric, 1)) ORDER BY daily.log_date) AS jsonb_agg
                       FROM ( SELECT wl.work_log_date AS log_date,
                                sum(wl.work_log_amount) OVER (ORDER BY wl.work_log_date) AS cumulative_spent
                               FROM work_logs wl
                              WHERE wl.budget_id = main_budget.budget_id
                              GROUP BY wl.work_log_date, wl.work_log_amount) daily)
                END AS budget_spending
           FROM ( SELECT b.budget_id,
                    bv.planned_amount
                   FROM budgets b
                     JOIN budget_types bt ON bt.type_id = b.budget_type_id
                     LEFT JOIN budget_versions bv ON bv.budget_id = b.budget_id AND bv.effective_to IS NULL
                  WHERE b.entity_type = 'section'::budget_entity_type AND b.entity_id = sec.section_id AND b.is_active = true AND bt.name = 'Основной'::text
                 LIMIT 1) main_budget) bs ON true
     LEFT JOIN decomposition_stages ds ON ds.decomposition_stage_section_id = sec.section_id
     LEFT JOIN stage_statuses dss ON dss.id = ds.stage_status_id
     LEFT JOIN decomposition_items di ON di.decomposition_item_stage_id = ds.decomposition_stage_id
     LEFT JOIN profiles ir ON ir.user_id = di.decomposition_item_responsible
     LEFT JOIN section_statuses dis ON dis.id = di.decomposition_item_status_id
     LEFT JOIN decomposition_difficulty_levels dif ON dif.difficulty_id = di.decomposition_item_difficulty_id
     LEFT JOIN work_categories wc ON wc.work_category_id = di.decomposition_item_work_category_id
  WHERE p.project_status = 'active'::project_status_enum;
