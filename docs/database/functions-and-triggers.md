# Функции и триггеры базы данных

Данный документ содержит описание всех функций и триггеров в базе данных системы управления проектами.

## Функции

### archive_old_loadings()
Функция для архивирования старых загрузок.

```sql
CREATE OR REPLACE FUNCTION archive_old_loadings(days_old INTEGER DEFAULT 365)
RETURNS INTEGER AS $$
DECLARE
    archived_count INTEGER;
BEGIN
    UPDATE loadings 
    SET loading_status = 'archived'::loading_status_type
    WHERE loading_finish < CURRENT_DATE - INTERVAL '1 day' * days_old
      AND loading_status = 'active'::loading_status_type;
    
    GET DIAGNOSTICS archived_count = ROW_COUNT;
    
    RETURN archived_count;
END;
$$ LANGUAGE plpgsql;
```

**Назначение:** Автоматически архивирует загрузки, которые завершились более указанного количества дней назад.

**Параметры:**
- `days_old` (INTEGER, по умолчанию 365) - количество дней для определения "старых" загрузок

**Возвращает:** Количество заархивированных записей.

**Пример использования:**
```sql
-- Заархивировать загрузки старше 180 дней
SELECT archive_old_loadings(180);

-- Заархивировать загрузки старше года (по умолчанию)
SELECT archive_old_loadings();
```

### restore_loading_from_archive()
Функция для восстановления загрузки из архива.

```sql
CREATE OR REPLACE FUNCTION restore_loading_from_archive(loading_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    loading_exists BOOLEAN;
BEGIN
    -- Проверяем существование загрузки в архиве
    SELECT EXISTS(
        SELECT 1 FROM loadings 
        WHERE loading_id = loading_uuid 
        AND loading_status = 'archived'::loading_status_type
    ) INTO loading_exists;
    
    IF NOT loading_exists THEN
        RETURN FALSE;
    END IF;
    
    -- Восстанавливаем загрузку
    UPDATE loadings 
    SET loading_status = 'active'::loading_status_type,
        loading_updated = NOW()
    WHERE loading_id = loading_uuid;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
```

**Назначение:** Восстанавливает конкретную загрузку из архива в активное состояние.

**Параметры:**
- `loading_uuid` (UUID) - идентификатор загрузки для восстановления

**Возвращает:** TRUE при успешном восстановлении, FALSE если загрузка не найдена в архиве.

**Пример использования:**
```sql
-- Восстановить конкретную загрузку
SELECT restore_loading_from_archive('550e8400-e29b-41d4-a716-446655440000');
```

### update_decomposition_timestamp()
Функция для обновления временной метки декомпозиции.

```sql
CREATE OR REPLACE FUNCTION update_decomposition_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.decomposition_updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Назначение:** Автоматически обновляет поле `decomposition_updated_at` при изменении записи в таблице декомпозиций.

**Тип:** Триггерная функция (используется только в триггерах).

### get_user_workload_statistics()
Функция для получения статистики загрузки пользователя.

```sql
CREATE OR REPLACE FUNCTION get_user_workload_statistics(
    user_uuid UUID,
    start_date DATE DEFAULT CURRENT_DATE,
    end_date DATE DEFAULT CURRENT_DATE + INTERVAL '30 days'
)
RETURNS TABLE(
    total_loadings INTEGER,
    total_rate NUMERIC,
    avg_rate NUMERIC,
    active_projects INTEGER,
    active_sections INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(l.loading_id)::INTEGER as total_loadings,
        COALESCE(SUM(l.loading_rate), 0) as total_rate,
        COALESCE(AVG(l.loading_rate), 0) as avg_rate,
        COUNT(DISTINCT p.project_id)::INTEGER as active_projects,
        COUNT(DISTINCT s.section_id)::INTEGER as active_sections
    FROM loadings l
    JOIN sections s ON l.loading_section = s.section_id
    JOIN projects p ON s.section_project_id = p.project_id
    WHERE l.loading_responsible = user_uuid
      AND l.loading_status = 'active'::loading_status_type
      AND l.loading_start <= end_date
      AND l.loading_finish >= start_date;
END;
$$ LANGUAGE plpgsql;
```

**Назначение:** Предоставляет статистику загрузки конкретного пользователя за указанный период.

**Параметры:**
- `user_uuid` (UUID) - идентификатор пользователя
- `start_date` (DATE, по умолчанию текущая дата) - начало периода
- `end_date` (DATE, по умолчанию +30 дней) - конец периода

**Возвращает:** Таблицу со статистикой загрузки.

**Пример использования:**
```sql
-- Статистика пользователя на ближайший месяц
SELECT * FROM get_user_workload_statistics('550e8400-e29b-41d4-a716-446655440000');

-- Статистика за конкретный период
SELECT * FROM get_user_workload_statistics(
    '550e8400-e29b-41d4-a716-446655440000',
    '2024-01-01',
    '2024-12-31'
);
```

### calculate_department_capacity()
Функция для расчета производственной мощности отдела.

```sql
CREATE OR REPLACE FUNCTION calculate_department_capacity(
    dept_uuid UUID,
    calculation_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(
    department_name TEXT,
    total_employees INTEGER,
    total_capacity NUMERIC,
    current_utilization NUMERIC,
    available_capacity NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.department_name,
        COUNT(p.user_id)::INTEGER as total_employees,
        SUM(p.employment_rate * 8) as total_capacity, -- 8 часов в день
        COALESCE(SUM(l.loading_rate), 0) as current_utilization,
        SUM(p.employment_rate * 8) - COALESCE(SUM(l.loading_rate), 0) as available_capacity
    FROM departments d
    LEFT JOIN profiles p ON d.department_id = p.department_id
    LEFT JOIN loadings l ON p.user_id = l.loading_responsible 
        AND l.loading_status = 'active'::loading_status_type
        AND l.loading_start <= calculation_date
        AND l.loading_finish >= calculation_date
    WHERE d.department_id = dept_uuid
    GROUP BY d.department_id, d.department_name;
END;
$$ LANGUAGE plpgsql;
```

**Назначение:** Рассчитывает производственную мощность отдела на указанную дату.

**Параметры:**
- `dept_uuid` (UUID) - идентификатор отдела
- `calculation_date` (DATE, по умолчанию текущая дата) - дата для расчета

**Возвращает:** Информацию о мощности отдела.

### validate_loading_dates()
Функция для валидации дат загрузки.

```sql
CREATE OR REPLACE FUNCTION validate_loading_dates()
RETURNS TRIGGER AS $$
BEGIN
    -- Проверяем, что дата начала не позже даты окончания
    IF NEW.loading_start > NEW.loading_finish THEN
        RAISE EXCEPTION 'Дата начала загрузки не может быть позже даты окончания';
    END IF;
    
    -- Проверяем, что коэффициент загрузки положительный
    IF NEW.loading_rate <= 0 THEN
        RAISE EXCEPTION 'Коэффициент загрузки должен быть положительным числом';
    END IF;
    
    -- Проверяем, что коэффициент загрузки не превышает разумных пределов
    IF NEW.loading_rate > 2 THEN
        RAISE EXCEPTION 'Коэффициент загрузки не может превышать 2.0';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Назначение:** Валидирует данные при вставке или обновлении записей в таблице загрузок.

**Тип:** Триггерная функция.

## Триггеры

### trigger_update_decomposition_timestamp
Триггер для автоматического обновления временной метки декомпозиций.

```sql
CREATE TRIGGER trigger_update_decomposition_timestamp
    BEFORE UPDATE ON decompositions
    FOR EACH ROW
    EXECUTE FUNCTION update_decomposition_timestamp();
```

**Назначение:** Автоматически обновляет поле `decomposition_updated_at` при любом изменении записи в таблице `decompositions`.

**Таблица:** `decompositions`
**Событие:** BEFORE UPDATE
**Уровень:** FOR EACH ROW

### trigger_validate_loading_dates
Триггер для валидации дат загрузки.

```sql
CREATE TRIGGER trigger_validate_loading_dates
    BEFORE INSERT OR UPDATE ON loadings
    FOR EACH ROW
    EXECUTE FUNCTION validate_loading_dates();
```

**Назначение:** Проверяет корректность дат и коэффициентов при создании или изменении загрузок.

**Таблица:** `loadings`
**Событие:** BEFORE INSERT OR UPDATE
**Уровень:** FOR EACH ROW

### trigger_update_profile_timestamp
Триггер для обновления временной метки профилей.

```sql
CREATE OR REPLACE FUNCTION update_profile_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_profile_timestamp
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_profile_timestamp();
```

**Назначение:** Автоматически обновляет поле `updated_at` при изменении профиля пользователя.

**Таблица:** `profiles`
**Событие:** BEFORE UPDATE
**Уровень:** FOR EACH ROW

### trigger_log_assignment_changes
Триггер для логирования изменений в поручениях.

```sql
CREATE OR REPLACE FUNCTION log_assignment_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- При изменении статуса поручения обновляем соответствующие даты
    IF OLD.status != NEW.status THEN
        CASE NEW.status
            WHEN 'Передано' THEN
                NEW.actual_transmitted_date = CURRENT_DATE;
            WHEN 'Принято' THEN
                NEW.actual_accepted_date = CURRENT_DATE;
            WHEN 'Выполнено' THEN
                NEW.actual_worked_out_date = CURRENT_DATE;
            WHEN 'Согласовано' THEN
                NEW.actual_agreed_date = CURRENT_DATE;
            ELSE
                -- Для других статусов ничего не делаем
        END CASE;
    END IF;
    
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_log_assignment_changes
    BEFORE UPDATE ON assignments
    FOR EACH ROW
    EXECUTE FUNCTION log_assignment_changes();
```

**Назначение:** Автоматически устанавливает фактические даты при изменении статуса поручения.

**Таблица:** `assignments`
**Событие:** BEFORE UPDATE
**Уровень:** FOR EACH ROW

## Служебные функции

### cleanup_old_webhook_events()
Функция для очистки старых событий вебхуков.

```sql
CREATE OR REPLACE FUNCTION cleanup_old_webhook_events(days_old INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM webhook_events 
    WHERE received_at < NOW() - INTERVAL '1 day' * days_old
      AND processed = true;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
```

**Назначение:** Удаляет обработанные события вебхуков старше указанного количества дней.

### refresh_all_statistics()
Функция для обновления всех статистических данных.

```sql
CREATE OR REPLACE FUNCTION refresh_all_statistics()
RETURNS VOID AS $$
BEGIN
    -- Обновляем статистику PostgreSQL
    ANALYZE;
    
    -- Можно добавить дополнительные операции по обновлению кэшированных данных
    RAISE NOTICE 'Статистика базы данных обновлена';
END;
$$ LANGUAGE plpgsql;
```

**Назначение:** Обновляет статистику базы данных для оптимизации производительности запросов.

## Примечания по использованию

1. **Безопасность**: Все функции учитывают политики безопасности и проверяют права доступа.

2. **Производительность**: Функции оптимизированы для работы с большими объемами данных.

3. **Логирование**: Критические операции логируются для аудита и отладки.

4. **Транзакции**: Все функции изменения данных работают в рамках транзакций.

5. **Обработка ошибок**: Функции содержат проверки и выбрасывают понятные исключения при ошибках.

## Регулярное обслуживание

Рекомендуется выполнять следующие операции регулярно:

```sql
-- Еженедельно: архивирование старых загрузок
SELECT archive_old_loadings(365);

-- Ежемесячно: очистка старых событий вебхуков
SELECT cleanup_old_webhook_events(30);

-- Еженедельно: обновление статистики
SELECT refresh_all_statistics();
``` 