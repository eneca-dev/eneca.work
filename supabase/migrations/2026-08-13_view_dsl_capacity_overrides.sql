-- ============================================================================
-- view_departments_sections_loadings: добавление колонки capacity_overrides
--
-- Проблема: вью отдавала capacity_date/capacity_value как захардкоженный NULL,
-- поэтому подневная ёмкость (section_capacity с capacity_date IS NOT NULL)
-- сохранялась в БД, но не читалась обратно — на странице «Разделы» введённая
-- ёмкость не отображалась.
--
-- Решение: новая колонка capacity_overrides jsonb — {"YYYY-MM-DD": значение}
-- на каждый раздел. Собирается в отдельном CTE (GROUP BY section_id) и
-- подключается LEFT JOIN 1:1 к разделу — строки НЕ размножаются, агрегат
-- считается один раз на раздел, а не на каждую строку загрузки.
--
-- Совместимость: все существующие колонки сохранены в том же порядке и с теми
-- же типами; новая добавлена строго в конец (требование CREATE OR REPLACE VIEW).
-- Мёртвые capacity_date/capacity_value оставлены как есть — их нельзя удалить
-- через CREATE OR REPLACE, и на них никто не опирается.
--
-- Откат: scratchpad/ROLLBACK_view_departments_sections_loadings.sql
-- Контроль до миграции: 8815 строк / 4956 разделов / 5308 загрузок.
-- ============================================================================

CREATE OR REPLACE VIEW view_departments_sections_loadings AS
 WITH section_defaults AS (
         SELECT section_capacity.section_id,
            section_capacity.capacity_value AS default_capacity
           FROM section_capacity
          WHERE section_capacity.capacity_date IS NULL
        ), section_overrides AS (
         SELECT section_capacity.section_id,
            jsonb_object_agg(
              to_char(section_capacity.capacity_date, 'YYYY-MM-DD'),
              section_capacity.capacity_value
            ) AS capacity_overrides
           FROM section_capacity
          WHERE section_capacity.capacity_date IS NOT NULL
          GROUP BY section_capacity.section_id
        ), sections_with_info AS (
         SELECT s.section_id,
            s.section_name,
            s.section_description,
            s.section_type,
            s.section_start_date,
            s.section_end_date,
            s.section_object_id,
            s.section_project_id,
            s.section_responsible,
            COALESCE(sd.default_capacity, 0::numeric) AS default_capacity,
            so.capacity_overrides,
            resp.user_id AS responsible_id,
            resp.first_name AS responsible_first_name,
            resp.last_name AS responsible_last_name,
            resp.avatar_url AS responsible_avatar_url,
            COALESCE(subd.subdivision_id, '00000000-0000-0000-0000-000000000000'::uuid) AS subdivision_id,
            COALESCE(subd.subdivision_name, 'Без подразделения'::text) AS subdivision_name,
            COALESCE(dept.department_id, '00000000-0000-0000-0000-000000000000'::uuid) AS department_id,
            COALESCE(dept.department_name, 'Без отдела'::text) AS department_name,
            head.user_id AS department_head_id,
            (head.first_name || ' '::text) || head.last_name AS department_head_name,
            head.email AS department_head_email,
            head.avatar_url AS department_head_avatar_url,
            o.object_id,
            o.object_name,
            p.project_id,
            p.project_name,
            p.project_status
           FROM sections s
             LEFT JOIN section_defaults sd ON s.section_id = sd.section_id
             LEFT JOIN section_overrides so ON s.section_id = so.section_id
             LEFT JOIN profiles resp ON s.section_responsible = resp.user_id
             LEFT JOIN departments dept ON resp.department_id = dept.department_id
             LEFT JOIN subdivisions subd ON dept.subdivision_id = subd.subdivision_id
             LEFT JOIN profiles head ON dept.department_head_id = head.user_id
             JOIN objects o ON s.section_object_id = o.object_id
             JOIN projects p ON o.object_project_id = p.project_id
        ), loadings_enriched AS (
         SELECT l.loading_id,
            l.loading_section,
            l.loading_responsible,
            l.loading_stage,
            l.loading_start,
            l.loading_finish,
            l.loading_rate,
            l.loading_comment,
            l.loading_status,
            emp.user_id AS employee_id,
            emp.first_name AS employee_first_name,
            emp.last_name AS employee_last_name,
            emp.avatar_url AS employee_avatar_url,
            cat.category_name AS employee_category,
            pos.position_name AS employee_position,
            ds.decomposition_stage_name AS stage_name,
            emp_dept.department_id AS employee_department_id,
            emp_dept.department_name AS employee_department_name,
            emp_subd.subdivision_id AS employee_subdivision_id,
            emp_subd.subdivision_name AS employee_subdivision_name,
            emp.employment_rate AS employee_employment_rate
           FROM loadings l
             JOIN profiles emp ON l.loading_responsible = emp.user_id
             LEFT JOIN departments emp_dept ON emp.department_id = emp_dept.department_id
             LEFT JOIN subdivisions emp_subd ON emp_dept.subdivision_id = emp_subd.subdivision_id
             LEFT JOIN categories cat ON emp.category_id = cat.category_id
             LEFT JOIN positions pos ON emp.position_id = pos.position_id
             LEFT JOIN decomposition_stages ds ON l.loading_stage = ds.decomposition_stage_id
          WHERE l.is_shortage = false AND l.loading_status = 'active'::loading_status_type AND l.loading_responsible IS NOT NULL
        )
 SELECT si.subdivision_id,
    si.subdivision_name,
    si.department_id,
    si.department_name,
    si.department_head_id,
    si.department_head_name,
    si.department_head_email,
    si.department_head_avatar_url,
    si.project_id,
    si.project_name,
    si.project_status,
    si.object_id,
    si.object_name,
    si.section_id,
    si.section_name,
    si.section_description,
    si.section_type,
    si.section_start_date,
    si.section_end_date,
    si.default_capacity,
    si.responsible_id,
    si.responsible_first_name,
    si.responsible_last_name,
    si.responsible_avatar_url,
    le.loading_id,
    le.loading_start,
    le.loading_finish,
    le.loading_rate,
    le.loading_comment,
    le.loading_stage,
    le.stage_name,
    le.employee_id,
    le.employee_first_name,
    le.employee_last_name,
    le.employee_avatar_url,
    le.employee_category,
    le.employee_position,
    NULL::date AS capacity_date,
    NULL::numeric AS capacity_value,
    le.employee_department_id,
    le.employee_department_name,
    le.employee_subdivision_id,
    le.employee_subdivision_name,
    le.employee_employment_rate,
    si.capacity_overrides
   FROM sections_with_info si
     LEFT JOIN loadings_enriched le ON si.section_id = le.loading_section;
