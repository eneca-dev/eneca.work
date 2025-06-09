# План развития базы данных

## Перспективные представления (Views)

### 1. Представление для главных инженеров проектов (`view_lead_engineers`)
**Статус:** Планируется к реализации
**Описание:** Аналогично представлению менеджеров, но для главных инженеров проектов

```sql
CREATE OR REPLACE VIEW view_lead_engineers AS
SELECT DISTINCT
    p.project_lead_engineer as engineer_id,
    prof.first_name,
    prof.last_name,
    CONCAT(prof.first_name, ' ', prof.last_name) as engineer_name,
    prof.avatar_url,
    COUNT(p.project_id) as projects_count
FROM projects p
INNER JOIN profiles prof ON p.project_lead_engineer = prof.user_id
WHERE p.project_status = 'active'
    AND p.project_lead_engineer IS NOT NULL
GROUP BY p.project_lead_engineer, prof.first_name, prof.last_name, prof.avatar_url
ORDER BY engineer_name;
```

### 2. Представление для ответственных за разделы (`view_section_responsibles`)
**Статус:** Планируется к реализации
**Описание:** Показывает всех ответственных за разделы с количеством разделов

```sql
CREATE OR REPLACE VIEW view_section_responsibles AS
SELECT DISTINCT
    s.section_responsible as responsible_id,
    prof.first_name,
    prof.last_name,
    CONCAT(prof.first_name, ' ', prof.last_name) as responsible_name,
    prof.avatar_url,
    COUNT(s.section_id) as sections_count
FROM sections s
INNER JOIN profiles prof ON s.section_responsible = prof.user_id
INNER JOIN projects p ON s.section_project_id = p.project_id
WHERE p.project_status = 'active'
    AND s.section_responsible IS NOT NULL
GROUP BY s.section_responsible, prof.first_name, prof.last_name, prof.avatar_url
ORDER BY responsible_name;
```

### 3. Представление для разделов с ответственными (`view_sections_with_responsibles`)
**Статус:** Планируется к реализации
**Описание:** Детальная информация о разделах с данными ответственных

```sql
CREATE OR REPLACE VIEW view_sections_with_responsibles AS
SELECT 
    s.section_id,
    s.section_name,
    s.section_responsible as responsible_id,
    prof.first_name as responsible_first_name,
    prof.last_name as responsible_last_name,
    CONCAT(prof.first_name, ' ', prof.last_name) as responsible_name,
    p.project_name,
    p.project_id
FROM sections s
INNER JOIN profiles prof ON s.section_responsible = prof.user_id
INNER JOIN projects p ON s.section_project_id = p.project_id
WHERE p.project_status = 'active'
    AND s.section_responsible IS NOT NULL
ORDER BY p.project_name, s.section_name;
```

### 4. Представление для задач с ответственными (`view_tasks_with_responsibles`)
**Статус:** Планируется к реализации
**Описание:** Детальная информация о задачах с данными ответственных

```sql
CREATE OR REPLACE VIEW view_tasks_with_responsibles AS
SELECT 
    t.task_id,
    t.task_name,
    t.task_responsible as responsible_id,
    prof.first_name as responsible_first_name,
    prof.last_name as responsible_last_name,
    CONCAT(prof.first_name, ' ', prof.last_name) as responsible_name,
    s.section_name,
    p.project_name,
    t.task_status
FROM tasks t
INNER JOIN profiles prof ON t.task_responsible = prof.user_id
INNER JOIN sections s ON t.task_parent_section = s.section_id
INNER JOIN projects p ON s.section_project_id = p.project_id
WHERE p.project_status = 'active'
    AND t.task_responsible IS NOT NULL
ORDER BY p.project_name, s.section_name, t.task_name;
```

## Реализованные представления

### ✅ `view_project_managers`
**Статус:** Реализовано
**Описание:** Показывает всех менеджеров проектов с количеством активных проектов

### ✅ `view_manager_projects`
**Статус:** Реализовано
**Описание:** Показывает все активные проекты с информацией о менеджерах

## Преимущества использования представлений

1. **Упрощение запросов** - не нужно каждый раз делать JOIN между таблицами
2. **Производительность** - PostgreSQL может оптимизировать запросы к представлениям
3. **Безопасность** - можно предоставить доступ к представлениям вместо прямого доступа к таблицам
4. **Консистентность** - одинаковая логика для получения данных во всем приложении
5. **Удобство разработки** - готовые структуры данных для фронтенда
