-- SQL для импорта проекта 2-П-28/24-[3 очередь] БАТ-2
-- Стадия: С
-- Дата создания: 2025-01-27

-- Начинаем транзакцию
BEGIN;

-- 1. Создаем проект
INSERT INTO projects (
    project_id,
    project_name,
    project_description,
    project_status,
    project_created,
    project_updated
) VALUES (
    gen_random_uuid(),
    '2-П-28/24-[3 очередь] БАТ-2',
    'Проект БАТ-2, 3 очередь, стадия С',
    'active',
    now(),
    now()
);

-- Получаем ID созданного проекта
DO $$
DECLARE
    project_uuid uuid;
    stage_c_uuid uuid;
    
    -- Объекты
    tom1_uuid uuid;
    tom2_uuid uuid;
    tom3_uuid uuid;
    tom4_uuid uuid;
    tom5_uuid uuid;
    tom6_uuid uuid;
    tom7_uuid uuid;
    tom8_uuid uuid;
    tom9_uuid uuid;
    
BEGIN
    -- Получаем ID проекта
    SELECT project_id INTO project_uuid 
    FROM projects 
    WHERE project_name = '2-П-28/24-[3 очередь] БАТ-2';
    
    -- Создаем стадию С (если не существует)
    INSERT INTO stages (
        stage_id,
        stage_name,
        stage_description,
        stage_project_id,
        stage_created,
        stage_updated
    ) VALUES (
        gen_random_uuid(),
        'С',
        'Стадия С - Рабочая документация',
        project_uuid,
        now(),
        now()
    ) ON CONFLICT (stage_name, stage_project_id) DO NOTHING
    RETURNING stage_id INTO stage_c_uuid;
    
    -- Если стадия уже существовала, получаем её ID
    IF stage_c_uuid IS NULL THEN
        SELECT stage_id INTO stage_c_uuid 
        FROM stages 
        WHERE stage_name = 'С' AND stage_project_id = project_uuid;
    END IF;
    
    -- 2. Создаем объекты (тома)
    
    -- Том 1. Генеральный план
    INSERT INTO objects (
        object_id,
        object_name,
        object_description,
        object_project_id,
        object_stage_id,
        object_created,
        object_updated
    ) VALUES (
        gen_random_uuid(),
        'Том 1. Генеральный план',
        'Генеральный план и транспорт',
        project_uuid,
        stage_c_uuid,
        now(),
        now()
    ) RETURNING object_id INTO tom1_uuid;
    
    -- Том 2. Внутриплощадочные и внеплощадочные сети и сооружения
    INSERT INTO objects (
        object_id,
        object_name,
        object_description,
        object_project_id,
        object_stage_id,
        object_created,
        object_updated
    ) VALUES (
        gen_random_uuid(),
        'Том 2. Внутриплощадочные и внеплощадочные сети и сооружения',
        'Внутриплощадочные и внеплощадочные сети и сооружения',
        project_uuid,
        stage_c_uuid,
        now(),
        now()
    ) RETURNING object_id INTO tom2_uuid;
    
    -- Том 3 (2Т4). Узел пробоотбора из железнодорожных вагонов совмещенный с визировочной лабораторией
    INSERT INTO objects (
        object_id,
        object_name,
        object_description,
        object_project_id,
        object_stage_id,
        object_created,
        object_updated
    ) VALUES (
        gen_random_uuid(),
        'Том 3 (2Т4). Узел пробоотбора из железнодорожных вагонов совмещенный с визировочной лабораторией',
        'Узел пробоотбора из железнодорожных вагонов совмещенный с визировочной лабораторией',
        project_uuid,
        stage_c_uuid,
        now(),
        now()
    ) RETURNING object_id INTO tom3_uuid;
    
    -- Том 4 (18). Погрузочно-разгрузочный узел в железнодорожный транспорт (реконструкция)
    INSERT INTO objects (
        object_id,
        object_name,
        object_description,
        object_project_id,
        object_stage_id,
        object_created,
        object_updated
    ) VALUES (
        gen_random_uuid(),
        'Том 4 (18). Погрузочно-разгрузочный узел в железнодорожный транспорт (реконструкция)',
        'Погрузочно-разгрузочный узел в железнодорожный транспорт (реконструкция)',
        project_uuid,
        stage_c_uuid,
        now(),
        now()
    ) RETURNING object_id INTO tom4_uuid;
    
    -- Том 5 (2Т6). Узел погрузки железнодорожного транспорта
    INSERT INTO objects (
        object_id,
        object_name,
        object_description,
        object_project_id,
        object_stage_id,
        object_created,
        object_updated
    ) VALUES (
        gen_random_uuid(),
        'Том 5 (2Т6). Узел погрузки железнодорожного транспорта',
        'Узел погрузки железнодорожного транспорта',
        project_uuid,
        stage_c_uuid,
        now(),
        now()
    ) RETURNING object_id INTO tom5_uuid;
    
    -- Том 6 (2Т3). Узел разгрузки железнодорожных вагонов
    INSERT INTO objects (
        object_id,
        object_name,
        object_description,
        object_project_id,
        object_stage_id,
        object_created,
        object_updated
    ) VALUES (
        gen_random_uuid(),
        'Том 6 (2Т3). Узел разгрузки железнодорожных вагонов',
        'Узел разгрузки железнодорожных вагонов',
        project_uuid,
        stage_c_uuid,
        now(),
        now()
    ) RETURNING object_id INTO tom6_uuid;
    
    -- Том 7. Эстакады конвейерные. Норийная вышка.
    INSERT INTO objects (
        object_id,
        object_name,
        object_description,
        object_project_id,
        object_stage_id,
        object_created,
        object_updated
    ) VALUES (
        gen_random_uuid(),
        'Том 7. Эстакады конвейерные. Норийная вышка.',
        'Эстакады конвейерные. Норийная вышка.',
        project_uuid,
        stage_c_uuid,
        now(),
        now()
    ) RETURNING object_id INTO tom7_uuid;
    
    -- Том 8. Пути железнодорожные - Трансэлектропроект
    INSERT INTO objects (
        object_id,
        object_name,
        object_description,
        object_project_id,
        object_stage_id,
        object_created,
        object_updated
    ) VALUES (
        gen_random_uuid(),
        'Том 8. Пути железнодорожные - Трансэлектропроект',
        'Пути железнодорожные - Трансэлектропроект',
        project_uuid,
        stage_c_uuid,
        now(),
        now()
    ) RETURNING object_id INTO tom8_uuid;
    
    -- Том 9. Сметная документация
    INSERT INTO objects (
        object_id,
        object_name,
        object_description,
        object_project_id,
        object_stage_id,
        object_created,
        object_updated
    ) VALUES (
        gen_random_uuid(),
        'Том 9. Сметная документация',
        'Сметная документация',
        project_uuid,
        stage_c_uuid,
        now(),
        now()
    ) RETURNING object_id INTO tom9_uuid;
    
    -- 3. Создаем разделы (без назначения ответственных)
    
    -- Том 1 - разделы
    INSERT INTO sections (
        section_name,
        section_description,
        section_project_id,
        section_object_id,
        section_created,
        section_updated
    ) VALUES 
    ('П-28/24-ГП-3 Генеральный план и транспорт', 'Генеральный план и транспорт', project_uuid, tom1_uuid, now(), now());
    
    -- Том 2 - разделы
    INSERT INTO sections (
        section_name,
        section_description,
        section_project_id,
        section_object_id,
        section_created,
        section_updated
    ) VALUES 
    ('П-28/24-ЭС-3 Электроснабжение наружное', 'Электроснабжение наружное', project_uuid, tom2_uuid, now(), now()),
    ('П-28/24-НСС-3 Наружные сети связи', 'Наружные сети связи', project_uuid, tom2_uuid, now(), now()),
    ('П-28/24-НВК-3 Наружные сети водоснабжения и канализации', 'Наружные сети водоснабжения и канализации', project_uuid, tom2_uuid, now(), now());
    
    -- Том 3 (2Т4) - разделы
    INSERT INTO sections (
        section_name,
        section_description,
        section_project_id,
        section_object_id,
        section_created,
        section_updated
    ) VALUES 
    ('П-28/24-2Т4-ТХ-3 Технологические решения', 'Технологические решения', project_uuid, tom3_uuid, now(), now()),
    ('П-28/24-2Т4-АР-3 Архитектурные решения', 'Архитектурные решения', project_uuid, tom3_uuid, now(), now()),
    ('П-28/24-2Т4-КЖ-3 Конструкции железобетонные', 'Конструкции железобетонные', project_uuid, tom3_uuid, now(), now()),
    ('П-28/24-2Т4-КМ-3 Конструкции металлические', 'Конструкции металлические', project_uuid, tom3_uuid, now(), now()),
    ('П-28/24-2Т4-ЭОМ-3 Электроснабжение, электроосвещение и молниезащита', 'Электроснабжение, электроосвещение и молниезащита', project_uuid, tom3_uuid, now(), now()),
    ('П-28/24-2Т4-СС-3 Системы связи', 'Системы связи', project_uuid, tom3_uuid, now(), now()),
    ('П-28/24-2Т4-СВН-3 Система видеонаблюдения', 'Система видеонаблюдения', project_uuid, tom3_uuid, now(), now()),
    ('П-28/24-2Т4-СКУД-3 Система контроля и управления доступом', 'Система контроля и управления доступом', project_uuid, tom3_uuid, now(), now()),
    ('П-28/24-2Т4-ВК-3 Водоснабжение и канализация', 'Водоснабжение и канализация', project_uuid, tom3_uuid, now(), now()),
    ('П-28/24-2Т4-СПС-3 Система пожарной сигнализации', 'Система пожарной сигнализации', project_uuid, tom3_uuid, now(), now());
    
    -- Том 4 (18) - разделы
    INSERT INTO sections (
        section_name,
        section_description,
        section_project_id,
        section_object_id,
        section_created,
        section_updated
    ) VALUES 
    ('П-28/24-18-ТХ-3 Технологические решения', 'Технологические решения', project_uuid, tom4_uuid, now(), now()),
    ('П-28/24-18-АР-3 Архитектурные решения', 'Архитектурные решения', project_uuid, tom4_uuid, now(), now()),
    ('П-28/24-18-КЖ-3 Конструкции железобетонные', 'Конструкции железобетонные', project_uuid, tom4_uuid, now(), now()),
    ('П-28/24-18-КМ-3 Конструкции металлические', 'Конструкции металлические', project_uuid, tom4_uuid, now(), now()),
    ('П-28/24-18-ЭОМ-3 Электроснабжение', 'Электроснабжение', project_uuid, tom4_uuid, now(), now()),
    ('П-28/24-18-СВН-3 Система видеонаблюдения', 'Система видеонаблюдения', project_uuid, tom4_uuid, now(), now()),
    ('П-28/24-18-АТХ-3 Автоматизация технологических решений', 'Автоматизация технологических решений', project_uuid, tom4_uuid, now(), now()),
    ('П-28/24-18-ВС-3 Воздухоснабжение', 'Воздухоснабжение', project_uuid, tom4_uuid, now(), now());
    
    -- Том 5 (2Т6) - разделы
    INSERT INTO sections (
        section_name,
        section_description,
        section_project_id,
        section_object_id,
        section_created,
        section_updated
    ) VALUES 
    ('П-28/24-2КЭ2.7.1, 2КЭ2.9, 2КЭ2.8, 2Т6-ТХ-3 Технологические решения', 'Технологические решения', project_uuid, tom5_uuid, now(), now()),
    ('П-28/24-2Т6-АР-3 Архитектурно-строительные решения', 'Архитектурно-строительные решения', project_uuid, tom5_uuid, now(), now()),
    ('П-28/24-2Т6-КЖ-3 Конструкции железобетонные', 'Конструкции железобетонные', project_uuid, tom5_uuid, now(), now()),
    ('П-28/24-2Т6-ЭОМ-3 Электроснабжение, электроосвещение и молниезащита', 'Электроснабжение, электроосвещение и молниезащита', project_uuid, tom5_uuid, now(), now()),
    ('П-28/24-2Т6-СВН-3 Система видеонаблюдения', 'Система видеонаблюдения', project_uuid, tom5_uuid, now(), now()),
    ('П-28/24-2Т6-АТХ-3 Автоматизация технологических решений', 'Автоматизация технологических решений', project_uuid, tom5_uuid, now(), now()),
    ('П-28/24-2Т6-ВС-3 Воздухоснабжение', 'Воздухоснабжение', project_uuid, tom5_uuid, now(), now());
    
    -- Том 6 (2Т3) - разделы
    INSERT INTO sections (
        section_name,
        section_description,
        section_project_id,
        section_object_id,
        section_created,
        section_updated
    ) VALUES 
    ('П-28/24-2Т3-ТХ-3 Технологические решения', 'Технологические решения', project_uuid, tom6_uuid, now(), now()),
    ('П-28/24-2Т3-АР-3 Архитектурные решения', 'Архитектурные решения', project_uuid, tom6_uuid, now(), now()),
    ('П-28/24-2Т3-КМ-3 Конструкции металлические', 'Конструкции металлические', project_uuid, tom6_uuid, now(), now()),
    ('П-28/24-2Т3-КЖ-3 Конструкции железобетонные', 'Конструкции железобетонные', project_uuid, tom6_uuid, now(), now()),
    ('П-28/24-2Т3-ЭОМ-3 Электроснабжение, электроосвещение и молниезащита', 'Электроснабжение, электроосвещение и молниезащита', project_uuid, tom6_uuid, now(), now()),
    ('П-28/24-2Т3-СВН-3 Система видеонаблюдения', 'Система видеонаблюдения', project_uuid, tom6_uuid, now(), now()),
    ('П-28/24-2Т3-АТХ-3 Автоматизация технологических решений', 'Автоматизация технологических решений', project_uuid, tom6_uuid, now(), now()),
    ('П-28/24-2Т3-ВС-3 Воздухоснабжение', 'Воздухоснабжение', project_uuid, tom6_uuid, now(), now()),
    ('П-28/24-2Т3-ОВ-3 Система вентиляции', 'Система вентиляции', project_uuid, tom6_uuid, now(), now());
    
    -- Том 7 - разделы
    INSERT INTO sections (
        section_name,
        section_description,
        section_project_id,
        section_object_id,
        section_created,
        section_updated
    ) VALUES 
    ('П-28/24-2КЭ2.7.1,2.8,2.9-КЖ-3 Конструкции железобетонные', 'Конструкции железобетонные', project_uuid, tom7_uuid, now(), now()),
    ('П-28/24-2КЭ2.7.1,2.8,2.9-КМ-3 Конструкции металлические', 'Конструкции металлические', project_uuid, tom7_uuid, now(), now()),
    ('П-28/24-2КЭ2.7.1, 2КЭ2.9, 2КЭ2.8-ЭОМ-3 Электроснабжение', 'Электроснабжение', project_uuid, tom7_uuid, now(), now());
    
    -- Том 9 - разделы
    INSERT INTO sections (
        section_name,
        section_description,
        section_project_id,
        section_object_id,
        section_created,
        section_updated
    ) VALUES 
    ('П-28/24-СМ-3', 'Сметная документация', project_uuid, tom9_uuid, now(), now()),
    ('Смета комплекта КЖ по поз.2Т6', 'Смета комплекта КЖ по поз.2Т6', project_uuid, tom9_uuid, now(), now()),
    ('Смета комплекта ОВ по поз. 2Т3', 'Смета комплекта ОВ по поз. 2Т3', project_uuid, tom9_uuid, now(), now());
    
    RAISE NOTICE 'Проект "2-П-28/24-[3 очередь] БАТ-2" успешно импортирован с % разделами', 
        (SELECT COUNT(*) FROM sections WHERE section_project_id = project_uuid);
    
END $$;

-- Завершаем транзакцию
COMMIT;

-- Проверяем результат
SELECT 
    p.project_name,
    st.stage_name,
    o.object_name,
    s.section_name
FROM projects p
LEFT JOIN stages st ON st.stage_project_id = p.project_id
LEFT JOIN objects o ON o.object_project_id = p.project_id
LEFT JOIN sections s ON s.section_project_id = p.project_id AND s.section_object_id = o.object_id
WHERE p.project_name = '2-П-28/24-[3 очередь] БАТ-2'
ORDER BY st.stage_name, o.object_name, s.section_name; 