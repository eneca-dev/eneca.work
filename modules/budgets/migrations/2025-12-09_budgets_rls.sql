-- ============================================================================
-- Migration: Budgets System - RLS Policies
-- Description: Row Level Security for budget tables
-- Date: 2025-12-09
-- ============================================================================

-- ============================================================================
-- 1. BUDGET_TAGS - справочник тегов
-- ============================================================================

ALTER TABLE budget_tags ENABLE ROW LEVEL SECURITY;

-- Теги видят все авторизованные пользователи
CREATE POLICY budget_tags_select_policy ON budget_tags
FOR SELECT USING (auth.uid() IS NOT NULL);

-- Управление тегами только с правом budgets.manage_tags
CREATE POLICY budget_tags_insert_policy ON budget_tags
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN role_permissions rp ON rp.role_id = ur.role_id
    JOIN permissions perm ON perm.id = rp.permission_id
    WHERE ur.user_id = auth.uid() AND perm.name = 'budgets.manage_tags'
  )
);

CREATE POLICY budget_tags_update_policy ON budget_tags
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN role_permissions rp ON rp.role_id = ur.role_id
    JOIN permissions perm ON perm.id = rp.permission_id
    WHERE ur.user_id = auth.uid() AND perm.name = 'budgets.manage_tags'
  )
);

CREATE POLICY budget_tags_delete_policy ON budget_tags
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN role_permissions rp ON rp.role_id = ur.role_id
    JOIN permissions perm ON perm.id = rp.permission_id
    WHERE ur.user_id = auth.uid() AND perm.name = 'budgets.manage_tags'
  )
);

-- ============================================================================
-- 2. BUDGETS - основная таблица
-- ============================================================================

ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

-- Политика просмотра: сложная логика доступа
CREATE POLICY budgets_select_policy ON budgets
FOR SELECT USING (
  -- 1. Админ с правом budgets.view.all видит всё
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN role_permissions rp ON rp.role_id = ur.role_id
    JOIN permissions perm ON perm.id = rp.permission_id
    WHERE ur.user_id = auth.uid() AND perm.name = 'budgets.view.all'
  )
  -- 2. Для бюджетов разделов
  OR (
    entity_type = 'section' AND (
      -- Ответственный за раздел
      EXISTS (
        SELECT 1 FROM sections s
        WHERE s.section_id = budgets.entity_id
        AND s.section_responsible = auth.uid()
      )
      -- Начальник отдела сотрудников на разделе
      OR EXISTS (
        SELECT 1 FROM loadings l
        JOIN profiles p ON l.loading_responsible = p.user_id
        JOIN departments d ON p.department_id = d.department_id
        WHERE l.loading_section = budgets.entity_id
        AND d.department_head_id = auth.uid()
      )
      -- Менеджер или ГИП проекта
      OR EXISTS (
        SELECT 1 FROM sections s
        JOIN projects pr ON pr.project_id = s.section_project_id
        WHERE s.section_id = budgets.entity_id
        AND (pr.project_manager = auth.uid() OR pr.project_lead_engineer = auth.uid())
      )
    )
  )
  -- 3. Для бюджетов проектов
  OR (
    entity_type = 'project' AND EXISTS (
      SELECT 1 FROM projects pr
      WHERE pr.project_id = budgets.entity_id
      AND (pr.project_manager = auth.uid() OR pr.project_lead_engineer = auth.uid())
    )
  )
  -- 4. Для бюджетов объектов
  OR (
    entity_type = 'object' AND EXISTS (
      SELECT 1 FROM objects o
      JOIN projects pr ON pr.project_id = o.object_project_id
      WHERE o.object_id = budgets.entity_id
      AND (pr.project_manager = auth.uid() OR pr.project_lead_engineer = auth.uid())
    )
  )
  -- 5. Для бюджетов стадий
  OR (
    entity_type = 'stage' AND EXISTS (
      SELECT 1 FROM stages st
      JOIN projects pr ON pr.project_id = st.stage_project_id
      WHERE st.stage_id = budgets.entity_id
      AND (pr.project_manager = auth.uid() OR pr.project_lead_engineer = auth.uid())
    )
  )
);

-- Политика создания: нужно право budgets.create
CREATE POLICY budgets_insert_policy ON budgets
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN role_permissions rp ON rp.role_id = ur.role_id
    JOIN permissions perm ON perm.id = rp.permission_id
    WHERE ur.user_id = auth.uid() AND perm.name = 'budgets.create'
  )
);

-- Политика обновления: нужно право budgets.edit
CREATE POLICY budgets_update_policy ON budgets
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN role_permissions rp ON rp.role_id = ur.role_id
    JOIN permissions perm ON perm.id = rp.permission_id
    WHERE ur.user_id = auth.uid() AND perm.name = 'budgets.edit'
  )
);

-- Политика удаления: нужно право budgets.delete
CREATE POLICY budgets_delete_policy ON budgets
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN role_permissions rp ON rp.role_id = ur.role_id
    JOIN permissions perm ON perm.id = rp.permission_id
    WHERE ur.user_id = auth.uid() AND perm.name = 'budgets.delete'
  )
);

-- ============================================================================
-- 3. BUDGET_VERSIONS - история версий
-- ============================================================================

ALTER TABLE budget_versions ENABLE ROW LEVEL SECURITY;

-- Просмотр: наследуем от родительского бюджета (если видишь бюджет - видишь версии)
CREATE POLICY budget_versions_select_policy ON budget_versions
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM budgets b
    WHERE b.budget_id = budget_versions.budget_id
  )
);

-- Создание версий: нужно право budgets.edit
CREATE POLICY budget_versions_insert_policy ON budget_versions
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN role_permissions rp ON rp.role_id = ur.role_id
    JOIN permissions perm ON perm.id = rp.permission_id
    WHERE ur.user_id = auth.uid() AND perm.name = 'budgets.edit'
  )
);

-- Обновление версий: нужно право budgets.edit
CREATE POLICY budget_versions_update_policy ON budget_versions
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN role_permissions rp ON rp.role_id = ur.role_id
    JOIN permissions perm ON perm.id = rp.permission_id
    WHERE ur.user_id = auth.uid() AND perm.name = 'budgets.edit'
  )
);

-- ============================================================================
-- 4. BUDGET_TAG_LINKS - связь бюджетов с тегами
-- ============================================================================

ALTER TABLE budget_tag_links ENABLE ROW LEVEL SECURITY;

-- Просмотр: если видишь бюджет - видишь его теги
CREATE POLICY budget_tag_links_select_policy ON budget_tag_links
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM budgets b
    WHERE b.budget_id = budget_tag_links.budget_id
  )
);

-- Управление связями: нужно право budgets.edit
CREATE POLICY budget_tag_links_insert_policy ON budget_tag_links
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN role_permissions rp ON rp.role_id = ur.role_id
    JOIN permissions perm ON perm.id = rp.permission_id
    WHERE ur.user_id = auth.uid() AND perm.name = 'budgets.edit'
  )
);

CREATE POLICY budget_tag_links_delete_policy ON budget_tag_links
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN role_permissions rp ON rp.role_id = ur.role_id
    JOIN permissions perm ON perm.id = rp.permission_id
    WHERE ur.user_id = auth.uid() AND perm.name = 'budgets.edit'
  )
);
