# Индексы и оптимизация базы данных

Данный документ содержит описание всех индексов и рекомендации по оптимизации производительности базы данных.

## Основные индексы

### Индексы таблицы loadings

#### idx_loadings_responsible_status
```sql
CREATE INDEX idx_loadings_responsible_status 
ON loadings (loading_responsible, loading_status);
```
**Назначение:** Оптимизация запросов по ответственному сотруднику и статусу загрузки.
**Используется в:** Представления `active_loadings`, `view_employee_workloads`, функция статистики.

#### idx_loadings_section_status
```sql
CREATE INDEX idx_loadings_section_status 
ON loadings (loading_section, loading_status);
```
**Назначение:** Быстрый поиск загрузок по разделу и статусу.
**Используется в:** Запросы планирования, отчеты по разделам.

#### idx_loadings_dates
```sql
CREATE INDEX idx_loadings_dates 
ON loadings (loading_start, loading_finish);
```
**Назначение:** Оптимизация запросов по датам загрузки.
**Используется в:** Календарные представления, планирование ресурсов.

#### idx_loadings_task_status
```sql
CREATE INDEX idx_loadings_task_status 
ON loadings (loading_task, loading_status) 
WHERE loading_task IS NOT NULL;
```
**Назначение:** Частичный индекс для загрузок, привязанных к конкретным задачам.
**Используется в:** Детализация загрузок по задачам.

### Индексы таблицы profiles

#### idx_profiles_department_team
```sql
CREATE INDEX idx_profiles_department_team 
ON profiles (department_id, team_id);
```
**Назначение:** Быстрый поиск сотрудников по отделу и команде.
**Используется в:** Организационные отчеты, фильтрация сотрудников.

#### idx_profiles_role
```sql
CREATE INDEX idx_profiles_role 
ON profiles (role_id);
```
**Назначение:** Поиск пользователей по ролям.
**Используется в:** Система авторизации, административные функции.

#### idx_profiles_email
```sql
CREATE UNIQUE INDEX idx_profiles_email 
ON profiles (email) 
WHERE email IS NOT NULL;
```
**Назначение:** Уникальность email адресов и быстрый поиск по email.
**Используется в:** Аутентификация, поиск пользователей.

### Индексы таблицы sections

#### idx_sections_project
```sql
CREATE INDEX idx_sections_project 
ON sections (section_project_id);
```
**Назначение:** Быстрый поиск разделов по проекту.
**Используется в:** Представления проектов, планирование.

#### idx_sections_responsible
```sql
CREATE INDEX idx_sections_responsible 
ON sections (section_responsible);
```
**Назначение:** Поиск разделов по ответственному.
**Используется в:** Персональные дашборды, отчеты.

#### idx_sections_object
```sql
CREATE INDEX idx_sections_object 
ON sections (section_object_id) 
WHERE section_object_id IS NOT NULL;
```
**Назначение:** Связь разделов с объектами.
**Используется в:** Иерархическая структура проектов.

### Индексы таблицы tasks

#### idx_tasks_section
```sql
CREATE INDEX idx_tasks_section 
ON tasks (task_parent_section);
```
**Назначение:** Быстрый поиск задач по разделу.
**Используется в:** Представления разделов, планирование задач.

#### idx_tasks_responsible_status
```sql
CREATE INDEX idx_tasks_responsible_status 
ON tasks (task_responsible, task_status);
```
**Назначение:** Поиск задач по исполнителю и статусу.
**Используется в:** Персональные задачи, отчеты о выполнении.

#### idx_tasks_dates
```sql
CREATE INDEX idx_tasks_dates 
ON tasks (task_start_date, task_end_date) 
WHERE task_start_date IS NOT NULL;
```
**Назначение:** Временные запросы по задачам.
**Используется в:** Календарное планирование, дедлайны.

### Индексы таблицы projects

#### idx_projects_manager
```sql
CREATE INDEX idx_projects_manager 
ON projects (project_manager);
```
**Назначение:** Поиск проектов по менеджеру.
**Используется в:** Управленческие отчеты.

#### idx_projects_status
```sql
CREATE INDEX idx_projects_status 
ON projects (project_status);
```
**Назначение:** Фильтрация проектов по статусу.
**Используется в:** Активные/архивные проекты.

#### idx_projects_client
```sql
CREATE INDEX idx_projects_client 
ON projects (client_id) 
WHERE client_id IS NOT NULL;
```
**Назначение:** Поиск проектов по заказчику.
**Используется в:** Клиентские отчеты.

### Индексы таблицы assignments

#### idx_assignments_project
```sql
CREATE INDEX idx_assignments_project 
ON assignments (project_id);
```
**Назначение:** Поиск поручений по проекту.

#### idx_assignments_sections
```sql
CREATE INDEX idx_assignments_sections 
ON assignments (from_section_id, to_section_id);
```
**Назначение:** Поиск поручений между разделами.

#### idx_assignments_status_dates
```sql
CREATE INDEX idx_assignments_status_dates 
ON assignments (status, due_date);
```
**Назначение:** Поиск поручений по статусу и срокам.

### Индексы таблицы calendar_events

#### idx_calendar_events_dates
```sql
CREATE INDEX idx_calendar_events_dates 
ON calendar_events (calendar_event_date_start, calendar_event_date_end);
```
**Назначение:** Быстрый поиск событий по датам.

#### idx_calendar_events_user_type
```sql
CREATE INDEX idx_calendar_events_user_type 
ON calendar_events (calendar_event_created_by, calendar_event_type) 
WHERE calendar_event_created_by IS NOT NULL;
```
**Назначение:** Поиск событий по пользователю и типу.

### Индексы таблицы user_reports

#### idx_user_reports_author_date
```sql
CREATE INDEX idx_user_reports_author_date 
ON user_reports (user_report_created_by, user_report_created_at);
```
**Назначение:** Поиск отчетов по автору и дате.

### Индексы для декомпозиции

#### idx_decompositions_section
```sql
CREATE INDEX idx_decompositions_section 
ON decompositions (decomposition_section_id);
```
**Назначение:** Поиск декомпозиций по разделу.

#### idx_decomposition_templates_department
```sql
CREATE INDEX idx_decomposition_templates_department 
ON decomposition_templates (decomposition_department_id);
```
**Назначение:** Поиск шаблонов по отделу.

### Индексы для системных таблиц

#### idx_webhook_events_processed
```sql
CREATE INDEX idx_webhook_events_processed 
ON webhook_events (processed, received_at);
```
**Назначение:** Поиск необработанных событий.

#### idx_migrations_name
```sql
CREATE UNIQUE INDEX idx_migrations_name 
ON migrations (name);
```
**Назначение:** Уникальность названий миграций.

## Составные индексы для сложных запросов

### idx_loadings_complex_filter
```sql
CREATE INDEX idx_loadings_complex_filter 
ON loadings (loading_responsible, loading_status, loading_start, loading_finish);
```
**Назначение:** Оптимизация сложных фильтров в представлениях загрузок.

### idx_profiles_full_org_structure
```sql
CREATE INDEX idx_profiles_full_org_structure 
ON profiles (department_id, team_id, position_id, role_id);
```
**Назначение:** Быстрая фильтрация по полной организационной структуре.

## Индексы для полнотекстового поиска

### idx_projects_fulltext
```sql
CREATE INDEX idx_projects_fulltext 
ON projects USING gin(to_tsvector('russian', project_name || ' ' || COALESCE(project_description, '')));
```
**Назначение:** Полнотекстовый поиск по проектам.

### idx_tasks_fulltext
```sql
CREATE INDEX idx_tasks_fulltext 
ON tasks USING gin(to_tsvector('russian', task_name || ' ' || COALESCE(task_description, '')));
```
**Назначение:** Полнотекстовый поиск по задачам.

### idx_sections_fulltext
```sql
CREATE INDEX idx_sections_fulltext 
ON sections USING gin(to_tsvector('russian', section_name || ' ' || COALESCE(section_description, '')));
```
**Назначение:** Полнотекстовый поиск по разделам.

## Рекомендации по оптимизации

### 1. Мониторинг производительности

```sql
-- Запрос для поиска медленных запросов
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    rows
FROM pg_stat_statements 
WHERE mean_time > 100 
ORDER BY mean_time DESC 
LIMIT 10;
```

### 2. Анализ использования индексов

```sql
-- Проверка неиспользуемых индексов
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes 
WHERE idx_tup_read = 0 
AND idx_tup_fetch = 0;
```

### 3. Статистика по таблицам

```sql
-- Обновление статистики для оптимизатора
ANALYZE;

-- Детальная статистика по конкретной таблице
ANALYZE VERBOSE loadings;
```

### 4. Настройки конфигурации

Рекомендуемые настройки PostgreSQL для оптимальной производительности:

```sql
-- Увеличение рабочей памяти для сложных запросов
SET work_mem = '256MB';

-- Оптимизация для аналитических запросов
SET enable_hashjoin = on;
SET enable_mergejoin = on;

-- Настройка планировщика
SET random_page_cost = 1.1;
SET effective_cache_size = '4GB';
```

### 5. Партиционирование больших таблиц

Для таблицы `loadings` при большом объеме данных:

```sql
-- Создание партиционированной таблицы по датам
CREATE TABLE loadings_partitioned (
    LIKE loadings INCLUDING ALL
) PARTITION BY RANGE (loading_start);

-- Создание партиций по годам
CREATE TABLE loadings_2024 PARTITION OF loadings_partitioned
    FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

CREATE TABLE loadings_2025 PARTITION OF loadings_partitioned
    FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
```

### 6. Оптимизация запросов

#### Использование EXPLAIN для анализа планов выполнения

```sql
-- Анализ плана выполнения запроса
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM view_employee_workloads 
WHERE user_id = '550e8400-e29b-41d4-a716-446655440000';
```

#### Оптимизация JOIN операций

```sql
-- Использование EXISTS вместо IN для больших наборов данных
SELECT p.* FROM profiles p 
WHERE EXISTS (
    SELECT 1 FROM loadings l 
    WHERE l.loading_responsible = p.user_id 
    AND l.loading_status = 'active'
);
```

### 7. Кэширование результатов

Для часто используемых агрегированных данных:

```sql
-- Материализованное представление для статистики отделов
CREATE MATERIALIZED VIEW mv_department_statistics AS
SELECT * FROM view_department_statistics;

-- Создание индекса на материализованном представлении
CREATE INDEX idx_mv_department_statistics_dept 
ON mv_department_statistics (department_id);

-- Обновление материализованного представления
REFRESH MATERIALIZED VIEW mv_department_statistics;
```

### 8. Регулярное обслуживание

```sql
-- Еженедельное обслуживание
VACUUM ANALYZE;

-- Ежемесячное полное обслуживание
VACUUM FULL;
REINDEX DATABASE your_database_name;
```

## Мониторинг производительности

### Ключевые метрики для отслеживания

1. **Время выполнения запросов** - среднее время выполнения критических запросов
2. **Использование индексов** - процент запросов, использующих индексы
3. **Блокировки** - количество и длительность блокировок
4. **Размер кэша** - эффективность использования буферного кэша
5. **I/O операции** - количество операций чтения/записи

### Автоматические задачи обслуживания

```sql
-- Создание задачи для автоматического обновления статистики
CREATE OR REPLACE FUNCTION maintenance_update_statistics()
RETURNS void AS $$
BEGIN
    -- Обновление статистики
    ANALYZE;
    
    -- Очистка старых данных
    PERFORM cleanup_old_webhook_events(30);
    
    -- Архивирование старых загрузок
    PERFORM archive_old_loadings(365);
    
    RAISE NOTICE 'Регулярное обслуживание завершено';
END;
$$ LANGUAGE plpgsql;
```

Эти индексы и рекомендации обеспечивают оптимальную производительность базы данных при работе с большими объемами данных и сложными запросами. 