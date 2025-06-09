-- SQL для исправления структуры базы данных
-- Приведение к правильной иерархии: Проект → Стадия → Объект → Раздел

BEGIN;

-- 1. Добавляем недостающие поля в таблицу stages
ALTER TABLE stages 
ADD COLUMN IF NOT EXISTS stage_project_id uuid REFERENCES projects(project_id),
ADD COLUMN IF NOT EXISTS stage_created timestamp with time zone DEFAULT now(),
ADD COLUMN IF NOT EXISTS stage_updated timestamp with time zone DEFAULT now();

-- 2. Добавляем недостающие поля в таблицу objects  
ALTER TABLE objects
ADD COLUMN IF NOT EXISTS object_project_id uuid REFERENCES projects(project_id);

-- 3. Создаем индексы для производительности
CREATE INDEX IF NOT EXISTS idx_stages_project_id ON stages(stage_project_id);
CREATE INDEX IF NOT EXISTS idx_objects_project_id ON objects(object_project_id);
CREATE INDEX IF NOT EXISTS idx_objects_stage_id ON objects(object_stage_id);
CREATE INDEX IF NOT EXISTS idx_sections_project_id ON sections(section_project_id);
CREATE INDEX IF NOT EXISTS idx_sections_object_id ON sections(section_object_id);

-- 4. Добавляем ограничения для обеспечения целостности данных
-- Убеждаемся, что стадия принадлежит тому же проекту, что и объект
ALTER TABLE objects 
ADD CONSTRAINT IF NOT EXISTS check_object_stage_project 
CHECK (
    object_stage_id IS NULL OR 
    EXISTS (
        SELECT 1 FROM stages s 
        WHERE s.stage_id = object_stage_id 
        AND s.stage_project_id = object_project_id
    )
);

-- Убеждаемся, что раздел принадлежит тому же проекту, что и объект
ALTER TABLE sections
ADD CONSTRAINT IF NOT EXISTS check_section_object_project
CHECK (
    section_object_id IS NULL OR
    EXISTS (
        SELECT 1 FROM objects o
        WHERE o.object_id = section_object_id
        AND o.object_project_id = section_project_id
    )
);

-- 5. Создаем уникальные ограничения для предотвращения дублирования
ALTER TABLE stages 
ADD CONSTRAINT IF NOT EXISTS unique_stage_name_per_project 
UNIQUE (stage_name, stage_project_id);

ALTER TABLE objects
ADD CONSTRAINT IF NOT EXISTS unique_object_name_per_stage
UNIQUE (object_name, object_stage_id);

-- 6. Обновляем существующие данные (если есть)
-- Связываем существующие стадии с проектами (если данные уже есть)
UPDATE stages 
SET stage_project_id = (
    SELECT DISTINCT o.object_project_id 
    FROM objects o 
    WHERE o.object_stage_id = stages.stage_id
    LIMIT 1
)
WHERE stage_project_id IS NULL 
AND EXISTS (
    SELECT 1 FROM objects o 
    WHERE o.object_stage_id = stages.stage_id 
    AND o.object_project_id IS NOT NULL
);

COMMIT;

-- Проверяем результат
SELECT 
    'projects' as table_name,
    COUNT(*) as record_count
FROM projects
UNION ALL
SELECT 
    'stages' as table_name,
    COUNT(*) as record_count  
FROM stages
UNION ALL
SELECT 
    'objects' as table_name,
    COUNT(*) as record_count
FROM objects  
UNION ALL
SELECT 
    'sections' as table_name,
    COUNT(*) as record_count
FROM sections;

-- Проверяем правильность иерархии
SELECT 
    p.project_name,
    s.stage_name,
    o.object_name,
    COUNT(sec.section_id) as sections_count
FROM projects p
LEFT JOIN stages s ON s.stage_project_id = p.project_id
LEFT JOIN objects o ON o.object_project_id = p.project_id AND o.object_stage_id = s.stage_id
LEFT JOIN sections sec ON sec.section_project_id = p.project_id AND sec.section_object_id = o.object_id
GROUP BY p.project_id, p.project_name, s.stage_id, s.stage_name, o.object_id, o.object_name
ORDER BY p.project_name, s.stage_name, o.object_name; 