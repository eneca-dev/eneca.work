-- ============================================================================
-- Миграция: Рефакторинг тегов в типы бюджетов
-- Дата: 2025-12-09
-- Описание: Переименование budget_tags в budget_types и упрощение связи
-- ============================================================================

-- Шаг 1: Переименовываем таблицу budget_tags в budget_types
ALTER TABLE budget_tags RENAME TO budget_types;

-- Шаг 2: Переименовываем колонку tag_id в type_id
ALTER TABLE budget_types RENAME COLUMN tag_id TO type_id;

-- Шаг 3: Переименовываем constraints и индексы
ALTER INDEX budget_tags_pkey RENAME TO budget_types_pkey;
ALTER INDEX budget_tags_name_key RENAME TO budget_types_name_key;

-- Шаг 4: Добавляем поле budget_type_id в таблицу budgets (сначала nullable)
ALTER TABLE budgets
ADD COLUMN budget_type_id UUID REFERENCES budget_types(type_id) ON DELETE RESTRICT;

-- Шаг 5: Мигрируем данные из budget_tag_links в budgets.budget_type_id
-- Берём первый тег для каждого бюджета (если их несколько)
UPDATE budgets b
SET budget_type_id = (
  SELECT btl.tag_id
  FROM budget_tag_links btl
  WHERE btl.budget_id = b.budget_id
  ORDER BY btl.assigned_at
  LIMIT 1
);

-- Шаг 6: Удаляем таблицу budget_tag_links (больше не нужна)
DROP TABLE IF EXISTS budget_tag_links;

-- Шаг 7: Делаем budget_type_id обязательным (NOT NULL)
ALTER TABLE budgets
ALTER COLUMN budget_type_id SET NOT NULL;

-- Шаг 8: Создаём индекс для budget_type_id
CREATE INDEX idx_budgets_budget_type_id ON budgets(budget_type_id);

-- Шаг 9: Пересоздаём view v_cache_budgets_current
DROP VIEW IF EXISTS v_cache_budgets_current CASCADE;

CREATE VIEW v_cache_budgets_current AS
SELECT
  -- Основные поля бюджета
  b.budget_id,
  b.entity_type,
  b.entity_id,
  b.name,
  b.is_active,
  b.created_by,
  b.created_at,
  b.updated_at,

  -- Текущая версия (effective_to IS NULL)
  bv.version_id,
  bv.planned_amount,
  bv.effective_from,
  bv.comment AS version_comment,
  bv.created_by AS version_created_by,
  bv.created_at AS version_created_at,

  -- Расчётные поля (сумма из work_logs)
  COALESCE(wl_sum.spent_amount, 0) AS spent_amount,
  bv.planned_amount - COALESCE(wl_sum.spent_amount, 0) AS remaining_amount,
  CASE
    WHEN bv.planned_amount > 0
    THEN (COALESCE(wl_sum.spent_amount, 0) / bv.planned_amount * 100)
    ELSE 0
  END AS spent_percentage,

  -- Тип бюджета (вместо массива тегов)
  bt.type_id,
  bt.name AS type_name,
  bt.color AS type_color,
  bt.description AS type_description

FROM budgets b

-- Текущая версия (effective_to IS NULL)
INNER JOIN budget_versions bv
  ON bv.budget_id = b.budget_id
  AND bv.effective_to IS NULL

-- Тип бюджета (опционально)
LEFT JOIN budget_types bt
  ON bt.type_id = b.budget_type_id

-- Подсчёт расходов из work_logs
LEFT JOIN (
  SELECT
    budget_id,
    SUM(work_log_amount) AS spent_amount
  FROM work_logs
  WHERE budget_id IS NOT NULL
  GROUP BY budget_id
) wl_sum ON wl_sum.budget_id = b.budget_id

WHERE b.is_active = true;

-- Комментарий
COMMENT ON VIEW v_cache_budgets_current IS
'Кеширующий view: активные бюджеты с текущей версией, расходом и типом';

-- Шаг 9: Пересоздаём view v_cache_budget_tags → v_cache_budget_types
DROP VIEW IF EXISTS v_cache_budget_tags CASCADE;

CREATE VIEW v_cache_budget_types AS
SELECT
  bt.type_id,
  bt.name,
  bt.color,
  bt.description,
  bt.is_active,
  bt.created_at,
  COUNT(b.budget_id) AS usage_count
FROM budget_types bt
LEFT JOIN budgets b
  ON b.budget_type_id = bt.type_id
  AND b.is_active = true
GROUP BY bt.type_id, bt.name, bt.color, bt.description, bt.is_active, bt.created_at
ORDER BY bt.name;

-- Комментарий
COMMENT ON VIEW v_cache_budget_types IS
'Кеширующий view: типы бюджетов с количеством использований';

-- Шаг 10: Обновляем RLS политики для budget_types (переименование из budget_tags)
-- Удаляем старые политики
DROP POLICY IF EXISTS budget_tags_select ON budget_types;
DROP POLICY IF EXISTS budget_tags_insert ON budget_types;
DROP POLICY IF EXISTS budget_tags_update ON budget_types;
DROP POLICY IF EXISTS budget_tags_delete ON budget_types;

-- Создаём новые политики с правильными именами
-- SELECT: Все авторизованные пользователи могут просматривать типы
CREATE POLICY budget_types_select ON budget_types
FOR SELECT
TO authenticated
USING (true);

-- INSERT: Только с правом budgets.manage_types
CREATE POLICY budget_types_insert ON budget_types
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN role_permissions rp ON rp.role_id = ur.role_id
    JOIN permissions p ON p.permission_id = rp.permission_id
    WHERE ur.user_id = auth.uid()
      AND p.name = 'budgets.manage_types'
  )
);

-- UPDATE: Только с правом budgets.manage_types
CREATE POLICY budget_types_update ON budget_types
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN role_permissions rp ON rp.role_id = ur.role_id
    JOIN permissions p ON p.permission_id = rp.permission_id
    WHERE ur.user_id = auth.uid()
      AND p.name = 'budgets.manage_types'
  )
);

-- DELETE: Только с правом budgets.manage_types
CREATE POLICY budget_types_delete ON budget_types
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN role_permissions rp ON rp.role_id = ur.role_id
    JOIN permissions p ON p.permission_id = rp.permission_id
    WHERE ur.user_id = auth.uid()
      AND p.name = 'budgets.manage_types'
  )
);

-- Шаг 11: Обновляем permission (переименование)
UPDATE permissions
SET
  name = 'budgets.manage_types',
  description = 'Управление типами бюджетов'
WHERE name = 'budgets.manage_tags';

-- Шаг 12: Обновляем триггер updated_at для budget_types
DROP TRIGGER IF EXISTS set_updated_at ON budget_types;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON budget_types
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Готово!
