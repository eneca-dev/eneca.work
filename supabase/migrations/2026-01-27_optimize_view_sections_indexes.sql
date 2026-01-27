-- Оптимизация индексов для view_sections_with_loadings
-- Цель: ускорить JOIN между loadings и decomposition_stages

-- 1. Composite индекс для быстрого поиска этапов по секции
CREATE INDEX IF NOT EXISTS idx_decomposition_stages_section_stage_composite
ON decomposition_stages(decomposition_stage_section_id, decomposition_stage_id)
WHERE decomposition_stage_section_id IS NOT NULL;

-- 2. Индекс для loadings с фильтром по статусу (partial index)
CREATE INDEX IF NOT EXISTS idx_loadings_stage_active
ON loadings(loading_stage, loading_responsible)
WHERE loading_status = 'active' AND loading_stage IS NOT NULL;

-- 3. Индекс для loadings напрямую по секции
CREATE INDEX IF NOT EXISTS idx_loadings_section_active
ON loadings(loading_section, loading_responsible)
WHERE loading_status = 'active' AND loading_section IS NOT NULL;

-- 4. Composite индекс для фильтрации по ответственному и статусу
CREATE INDEX IF NOT EXISTS idx_loadings_responsible_status_composite
ON loadings(loading_responsible, loading_status, loading_start, loading_finish)
WHERE loading_status = 'active';

-- Комментарий для документации
COMMENT ON INDEX idx_decomposition_stages_section_stage_composite IS
'Ускоряет JOIN в view_sections_with_loadings для связи секций и этапов';

COMMENT ON INDEX idx_loadings_stage_active IS
'Ускоряет поиск активных загрузок по этапам декомпозиции';

COMMENT ON INDEX idx_loadings_section_active IS
'Ускоряет поиск активных загрузок напрямую по секциям';

COMMENT ON INDEX idx_loadings_responsible_status_composite IS
'Оптимизирует запросы My Work для фильтрации по пользователю';
