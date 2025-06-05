# Представления (Views) базы данных

Данный документ содержит описание всех представлений в базе данных системы управления проектами.

## Список представлений

### Загрузки и планирование
- **[active_loadings](#active_loadings)** - активные загрузки сотрудников
- **[archived_loadings](#archived_loadings)** - архивные загрузки сотрудников  
- **[loading_statistics](#loading_statistics)** - статистика по загрузкам с группировкой по статусам

### Организационная структура
- **[view_department_heads](#view_department_heads)** - руководители отделов
- **[view_employees](#view_employees)** - расширенная информация о сотрудниках
- **[view_employee_workloads](#view_employee_workloads)** - рабочие нагрузки сотрудников
- **[view_profiles_extended](#view_profiles_extended)** - расширенные профили пользователей

### Статистика отделов
- **[view_department_statistics](#view_department_statistics)** - статистика по отделам

### Проекты
- **[view_projects_with_ws_data](#view_projects_with_ws_data)** - проекты с данными из Worksection
- **[view_sections_with_details](#view_sections_with_details)** - разделы проектов с подробной информацией
- **[view_tasks_with_details](#view_tasks_with_details)** - задачи с подробной информацией

### Отчеты пользователей
- **[view_user_reports_with_authors](#view_user_reports_with_authors)** - отчеты пользователей с информацией об авторах

### Поручения
- **[view_assignments_with_details](#view_assignments_with_details)** - поручения с подробной информацией

### Календарь
- **[view_calendar_events_with_users](#view_calendar_events_with_users)** - события календаря с информацией о создателях

### Декомпозиция
- **[view_decompositions_with_details](#view_decompositions_with_details)** - декомпозиции с подробной информацией
- **[view_decomposition_templates_with_details](#view_decomposition_templates_with_details)** - шаблоны декомпозиции

## Загрузки и планирование

### active_loadings
Представление активных загрузок сотрудников.

```sql
SELECT 
    loading_id,
    loading_responsible,
    loading_section,
    loading_start,
    loading_finish,
    loading_rate,
    loading_created,
    loading_updated,
    loading_task,
    loading_status
FROM loadings
WHERE loading_status = 'active'::loading_status_type;
```

**Назначение:** Отображает только активные загрузки, исключая архивные записи.

### archived_loadings
Представление архивных загрузок сотрудников.

```sql
SELECT 
    loading_id,
    loading_responsible,
    loading_section,
    loading_start,
    loading_finish,
    loading_rate,
    loading_created,
    loading_updated,
    loading_task,
    loading_status
FROM loadings
WHERE loading_status = 'archived'::loading_status_type;
```

**Назначение:** Отображает только архивные загрузки для анализа и отчетности.

### loading_statistics
Статистика по загрузкам с группировкой по статусам.

```sql
SELECT 
    loading_status,
    count(*) AS total_count,
    avg(loading_rate) AS avg_rate,
    sum(loading_rate) AS total_rate,
    min(loading_start) AS earliest_start,
    max(loading_finish) AS latest_finish
FROM loadings
GROUP BY loading_status;
```

**Назначение:** Предоставляет агрегированную статистику по загрузкам для аналитики и отчетов.

## Организационная структура

### view_department_heads
Представление руководителей отделов.

```sql
SELECT DISTINCT 
    d.department_id,
    d.department_name,
    p.user_id,
    p.first_name,
    p.last_name,
    p.email
FROM departments d
JOIN profiles p ON d.department_id = p.department_id
JOIN roles r ON p.role_id = r.id
WHERE r.name = 'Руководитель отдела';
```

**Назначение:** Отображает информацию о руководителях отделов для административных функций.

### view_employees
Расширенная информация о сотрудниках с организационной структурой.

```sql
SELECT 
    p.user_id,
    p.first_name,
    p.last_name,
    p.email,
    p.work_format,
    p.employment_rate,
    p.salary,
    p.is_hourly,
    d.department_name,
    t.team_name,
    pos.position_name,
    cat.category_name,
    r.name as role_name
FROM profiles p
LEFT JOIN departments d ON p.department_id = d.department_id
LEFT JOIN teams t ON p.team_id = t.team_id
LEFT JOIN positions pos ON p.position_id = pos.position_id
LEFT JOIN categories cat ON p.category_id = cat.category_id
LEFT JOIN roles r ON p.role_id = r.id;
```

**Назначение:** Предоставляет полную информацию о сотрудниках с их организационной принадлежностью.

### view_employee_workloads
Рабочие нагрузки сотрудников с детализацией по проектам.

```sql
SELECT 
    p.user_id,
    p.first_name,
    p.last_name,
    l.loading_start,
    l.loading_finish,
    l.loading_rate,
    s.section_name,
    pr.project_name,
    t.task_name,
    l.loading_status
FROM profiles p
JOIN loadings l ON p.user_id = l.loading_responsible
JOIN sections s ON l.loading_section = s.section_id
JOIN projects pr ON s.section_project_id = pr.project_id
LEFT JOIN tasks t ON l.loading_task = t.task_id
WHERE l.loading_status = 'active'::loading_status_type;
```

**Назначение:** Показывает текущие рабочие нагрузки сотрудников с привязкой к проектам и задачам.

### view_profiles_extended
Расширенные профили пользователей с дополнительной информацией.

```sql
SELECT 
    p.*,
    d.department_name,
    t.team_name,
    pos.position_name,
    cat.category_name,
    r.name as role_name,
    r.description as role_description
FROM profiles p
LEFT JOIN departments d ON p.department_id = d.department_id
LEFT JOIN teams t ON p.team_id = t.team_id
LEFT JOIN positions pos ON p.position_id = pos.position_id
LEFT JOIN categories cat ON p.category_id = cat.category_id
LEFT JOIN roles r ON p.role_id = r.id;
```

**Назначение:** Предоставляет полную информацию о профилях пользователей с расшифровкой всех связанных данных.

## Статистика отделов

### view_department_statistics
Статистика по отделам: количество сотрудников, проектов и загрузок.

```sql
SELECT 
    d.department_id,
    d.department_name,
    COUNT(DISTINCT p.user_id) as employee_count,
    COUNT(DISTINCT pr.project_id) as project_count,
    COUNT(DISTINCT l.loading_id) as active_loading_count,
    AVG(p.employment_rate) as avg_employment_rate,
    SUM(l.loading_rate) as total_loading_rate
FROM departments d
LEFT JOIN profiles p ON d.department_id = p.department_id
LEFT JOIN sections s ON EXISTS (
    SELECT 1 FROM profiles p2 
    WHERE p2.department_id = d.department_id 
    AND p2.user_id = s.section_responsible
)
LEFT JOIN projects pr ON s.section_project_id = pr.project_id
LEFT JOIN loadings l ON s.section_id = l.loading_section 
    AND l.loading_status = 'active'::loading_status_type
GROUP BY d.department_id, d.department_name;
```

**Назначение:** Предоставляет агрегированную статистику по отделам для управленческой отчетности.

## Проекты

### view_projects_with_ws_data
Проекты с данными из Worksection.

```sql
SELECT 
    p.project_id,
    p.project_name,
    p.project_description,
    p.project_status,
    p.project_created,
    pm.first_name as manager_first_name,
    pm.last_name as manager_last_name,
    pe.first_name as engineer_first_name,
    pe.last_name as engineer_last_name,
    c.client_name,
    ws.name as ws_project_name,
    ws.status as ws_status,
    ws.manager_email as ws_manager_email
FROM projects p
LEFT JOIN profiles pm ON p.project_manager = pm.user_id
LEFT JOIN profiles pe ON p.project_lead_engineer = pe.user_id
LEFT JOIN clients c ON p.client_id = c.client_id
LEFT JOIN ws_projects ws ON p.project_name = ws.name;
```

**Назначение:** Объединяет данные проектов из основной системы с данными из Worksection.

### view_sections_with_details
Разделы проектов с подробной информацией.

```sql
SELECT 
    s.section_id,
    s.section_name,
    s.section_description,
    s.section_type,
    s.section_start_date,
    s.section_end_date,
    p.project_name,
    resp.first_name as responsible_first_name,
    resp.last_name as responsible_last_name,
    o.object_name,
    st.stage_name,
    COUNT(t.task_id) as task_count,
    COUNT(l.loading_id) as loading_count
FROM sections s
LEFT JOIN projects p ON s.section_project_id = p.project_id
LEFT JOIN profiles resp ON s.section_responsible = resp.user_id
LEFT JOIN objects o ON s.section_object_id = o.object_id
LEFT JOIN stages st ON o.object_stage_id = st.stage_id
LEFT JOIN tasks t ON s.section_id = t.task_parent_section
LEFT JOIN loadings l ON s.section_id = l.loading_section 
    AND l.loading_status = 'active'::loading_status_type
GROUP BY s.section_id, s.section_name, s.section_description, s.section_type,
         s.section_start_date, s.section_end_date, p.project_name,
         resp.first_name, resp.last_name, o.object_name, st.stage_name;
```

**Назначение:** Предоставляет детальную информацию о разделах проектов с агрегированными данными.

### view_tasks_with_details
Задачи с подробной информацией о проектах и исполнителях.

```sql
SELECT 
    t.task_id,
    t.task_name,
    t.task_description,
    t.task_type,
    t.task_status,
    t.task_start_date,
    t.task_end_date,
    t.task_completed,
    s.section_name,
    p.project_name,
    resp.first_name as responsible_first_name,
    resp.last_name as responsible_last_name,
    resp.email as responsible_email,
    COUNT(l.loading_id) as loading_count,
    SUM(l.loading_rate) as total_loading_rate
FROM tasks t
LEFT JOIN sections s ON t.task_parent_section = s.section_id
LEFT JOIN projects p ON s.section_project_id = p.project_id
LEFT JOIN profiles resp ON t.task_responsible = resp.user_id
LEFT JOIN loadings l ON t.task_id = l.loading_task 
    AND l.loading_status = 'active'::loading_status_type
GROUP BY t.task_id, t.task_name, t.task_description, t.task_type, t.task_status,
         t.task_start_date, t.task_end_date, t.task_completed, s.section_name,
         p.project_name, resp.first_name, resp.last_name, resp.email;
```

**Назначение:** Показывает задачи с контекстной информацией о проектах и загрузках.

## Отчеты пользователей

### view_user_reports_with_authors
Отчеты пользователей с информацией об авторах.

```sql
SELECT 
    ur.user_report_id,
    ur.user_report_short_description,
    ur.user_report_detailed_description,
    ur.user_report_created_at,
    p.first_name as author_first_name,
    p.last_name as author_last_name,
    p.email as author_email,
    d.department_name as author_department,
    pos.position_name as author_position
FROM user_reports ur
JOIN profiles p ON ur.user_report_created_by = p.user_id
LEFT JOIN departments d ON p.department_id = d.department_id
LEFT JOIN positions pos ON p.position_id = pos.position_id
ORDER BY ur.user_report_created_at DESC;
```