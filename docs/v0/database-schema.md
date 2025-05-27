# Схема базы данных (public)

## Таблица profiles
Хранит информацию о сотрудниках компании, их должностях, департаментах и ролях в системе. Является центральной таблицей для управления персоналом и доступом.

- user_id (uuid, PK, FK → auth.users.id)
- first_name (text, NOT NULL)
- last_name (text, NOT NULL)
- department_id (uuid, NOT NULL, FK → departments.department_id)
- team_id (uuid, NOT NULL, FK → teams.team_id)
- position_id (uuid, NOT NULL, FK → positions.position_id)
- email (text, NOT NULL)
- created_at (timestamptz, NOT NULL, default: timezone('utc', now()))
- category_id (uuid, NOT NULL, FK → categories.category_id)
- role_id (uuid, NOT NULL, FK → roles.id)
- work_format (work_format_type: 'Гибридный', 'В офисе', 'Удаленно')
- address (text)
- employment_rate (numeric, default: 1)  # Employment rate: 0.25, 0.5, 0.75, 1, 1.25
- salary (numeric, default: 0)
- is_hourly (boolean, default: true)
- avatar_url (text)

## Таблица departments
Справочник департаментов компании. Используется для структурирования организации и ролевого доступа.

- department_id (uuid, PK)
- ws_department_id (integer)
- department_name (text)

## Таблица teams
Справочник команд внутри департаментов. Позволяет более детально структурировать организацию для управления проектами.

- team_id (uuid, PK)
- ws_team_id (integer)
- team_name (text)
- department_id (uuid, FK → departments.department_id)

## Таблица positions
Справочник должностей сотрудников. Определяет формальную позицию сотрудника в компании.

- position_id (uuid, PK)
- ws_position_id (integer)
- position_name (text)

## Таблица categories
Справочник категорий сотрудников. Используется для классификации специалистов по уровню квалификации.

- category_id (uuid, PK)
- ws_category_id (integer)
- category_name (text)

## Таблица roles
Системные роли пользователей. Определяет набор разрешений для работы в системе.

- id (uuid, PK, default: gen_random_uuid())
- name (text, NOT NULL, уникальное)
- description (text)
- created_at (timestamptz, NOT NULL, default: timezone('utc', now()))

## Таблица permissions
Конкретные разрешения, которые могут быть назначены ролям. Позволяет гибко настраивать доступ к функциям системы.

- id (uuid, PK, default: gen_random_uuid())
- name (text, NOT NULL, уникальное)
- description (text, NOT NULL)
- created_at (timestamptz, NOT NULL, default: timezone('utc', now()))

## Таблица role_permissions
Связующая таблица между ролями и разрешениями. Определяет, какие разрешения доступны для каждой роли.

- id (uuid, PK, default: gen_random_uuid())
- role_id (uuid, NOT NULL, FK → roles.id)
- permission_id (uuid, NOT NULL, FK → permissions.id)
- created_at (timestamptz, NOT NULL, default: timezone('utc', now()))

## Таблица user_roles
Связующая таблица между пользователями и ролями. Позволяет назначать пользователям несколько ролей.

- user_id (uuid, FK → profiles.user_id)
- role_id (uuid, FK → roles.id)
- PRIMARY KEY (user_id, role_id)

## Тип work_format_type
Перечисление форматов работы сотрудников.

- 'Гибридный'
- 'В офисе'
- 'Удаленно'

## Таблица clients
Хранит информацию о заказчиках проектов. Позволяет вести учет клиентов и связывать их с проектами.

- client_id (uuid, PK, default: gen_random_uuid())
- client_name (text, NOT NULL) - Название заказчика
- client_description (text) - Описание заказчика
- client_contact_person (text) - Контактное лицо
- client_phone (text) - Телефон
- client_email (text) - Email
- client_address (text) - Адрес
- client_created (timestamptz, default: now()) - Дата и время создания записи о заказчике
- client_updated (timestamptz, default: now()) - Дата и время последнего обновления записи о заказчике

## Таблица contracts
Хранит информацию о договорах с заказчиками. Связывает заказчиков с проектами через формальные договорные отношения.

- contract_id (uuid, PK, default: gen_random_uuid()) - Уникальный идентификатор договора
- contract_number (text, NOT NULL) - Номер договора
- contract_name (text, NOT NULL) - Название договора
- contract_description (text) - Описание договора
- contract_client_id (uuid, FK → clients.client_id) - Ссылка на заказчика
- contract_project_id (uuid, FK → projects.project_id) - Ссылка на проект
- contract_created (timestamptz, default: now()) - Дата и время создания записи о договоре
- contract_updated (timestamptz, default: now()) - Дата и время последнего обновления записи о договоре

## Таблица projects
Основные проекты компании. Центральная таблица для управления проектной деятельностью.

- project_id (uuid, PK, default: gen_random_uuid())
- project_name (text, NOT NULL)
- project_description (text)
- project_manager (uuid, FK → profiles.user_id)
- project_lead_engineer (uuid, FK → profiles.user_id)
- project_status (project_status_enum, default: 'active')
- project_created (timestamptz, default: now())
- project_updated (timestamptz, default: now())
- client_id (uuid, FK → clients.client_id) - Ссылка на заказчика проекта

## Тип project_status_enum
Перечисление возможных статусов проектов.

- 'active'
- 'archive'
- 'paused'
- 'canceled'

## Таблица stages
Справочник стадий проектов. Позволяет классифицировать объекты по стадии проектирования.

- stage_id (uuid, PK, default: gen_random_uuid()) - Уникальный идентификатор стадии
- stage_name (text, NOT NULL) - Название стадии
- stage_description (text) - Описание стадии

## Таблица objects
Объекты проектирования в рамках стадий. Группирует разделы проекта по физическим объектам строительства.

- object_id (uuid, PK, default: gen_random_uuid()) - Уникальный идентификатор объекта
- object_name (text, NOT NULL) - Название объекта
- object_description (text) - Описание объекта
- object_stage_id (uuid, FK → stages.stage_id) - Ссылка на стадию
- object_responsible (uuid, FK → profiles.user_id) - Ответственный
- object_start_date (timestamptz) - Дата начала
- object_end_date (timestamptz) - Дата окончания
- object_created (timestamptz, default: now()) - Дата и время создания записи об объекте
- object_updated (timestamptz, default: now()) - Дата и время последнего обновления записи об объекте

## Таблица sections
Разделы проектной документации. Представляет конкретные части проекта, по которым ведется работа.

- section_id (uuid, PK, default: gen_random_uuid())
- section_name (text, NOT NULL)
- section_description (text)
- section_responsible (uuid, FK → profiles.user_id)
- section_project_id (uuid, NOT NULL, FK → projects.project_id) - Ссылка на проект, к которому относится раздел
- section_created (timestamptz, default: now())
- section_updated (timestamptz, default: now())
- section_object_id (uuid, FK → objects.object_id) - Ссылка на объект
- section_type (text) - Тип раздела (например, "ГУП" или обычный)
- section_start_date (timestamptz) - Дата начала работ по разделу
- section_end_date (timestamptz) - Дата окончания работ по разделу

## Таблица tasks
Задачи в рамках разделов проекта. Представляет конкретные работы, которые выполняются сотрудниками.

- task_id (uuid, PK, default: gen_random_uuid())
- task_name (text, NOT NULL)
- task_description (text)
- task_responsible (uuid, FK → profiles.user_id)
- task_parent_section (uuid, NOT NULL, FK → sections.section_id)
- task_created (timestamptz, default: now())
- task_updated (timestamptz, default: now())
- task_completed (timestamptz)
- task_type (text) - Тип задачи (curation, development)
- task_start_date (timestamptz) - Дата начала выполнения задачи
- task_end_date (timestamptz) - Дата окончания выполнения задачи
- task_status (text, default: 'active') - Статус задачи

## Таблица loadings
Фактические загрузки сотрудников. Учитывает реальное время, затраченное сотрудниками на выполнение работ.

- loading_id (uuid, PK, default: gen_random_uuid()) - Уникальный идентификатор записи нагрузки
- loading_responsible (uuid, FK → profiles.user_id) - Ссылка на профиль ответственного сотрудника
- loading_section (uuid, FK → sections.section_id) - Ссылка на раздел проекта, к которому относится нагрузка
- loading_start (date, NOT NULL) - Дата начала нагрузки
- loading_finish (date, NOT NULL) - Дата окончания нагрузки
- loading_rate (numeric) - Коэффициент нагрузки (1 или 1.25)
- loading_created (timestamptz, default: now()) - Дата и время создания записи
- loading_updated (timestamptz, default: now()) - Дата и время последнего обновления записи
- loading_task (uuid, FK → tasks.task_id) - Ссылка на задачу, к которой относится нагрузка

## Таблица plan_loadings
Плановые загрузки, создаваемые менеджерами. Используется для планирования необходимых ресурсов на проект.

- plan_loading_id (uuid, PK, default: gen_random_uuid())
- plan_loading_section (uuid, FK → sections.section_id)
- plan_loading_start (date, NOT NULL)
- plan_loading_finish (date, NOT NULL)
- plan_loading_rate (numeric, NOT NULL) # Количество ставок (например, 4 ставки = 4 человека по 8 часов в день)
- plan_loading_created (timestamptz, default: now())
- plan_loading_updated (timestamptz, default: now())
- plan_loading_created_by (uuid, FK → auth.users.id) # Менеджер, создавший плановую загрузку
- plan_loading_description (text) # Описание плановой загрузки
- plan_loading_status (varchar, default: 'active') # Статус: active, completed, cancelled

## Таблица assignments
Задания между разделами проектов. Используется для отслеживания передачи работ между разделами.

- assignment_id (uuid, PK, default: gen_random_uuid())
- project_id (uuid, FK → projects.project_id)
- from_section_id (uuid, FK → sections.section_id)
- to_section_id (uuid, FK → sections.section_id)
- text (text, NOT NULL) - Текст задания
- created_at (timestamp)
- updated_at (timestamp)
- due_date (date) - Срок выполнения
- link (text) - Ссылка на дополнительные материалы
- created_by (uuid) - Кто создал задание
- updated_by (uuid) - Кто обновил задание
- status (assignment_status, default: 'Создано') - Статус задания
- planned_transmitted_date (date) - Плановая дата передачи
- planned_duration_date (date) - Плановая дата продолжительности
- actual_transmitted_date (date) - Фактическая дата передачи
- actual_accepted_date (date) - Фактическая дата принятия
- actual_worked_out_date (date) - Фактическая дата выполнения
- actual_agreed_date (date) - Фактическая дата согласования

## Тип assignment_status
Перечисление возможных статусов заданий.

- 'Создано'
- 'Передано'
- 'Принято'
- 'Выполнено'
- 'Согласовано'

## Таблица calendar_events
Хранит события и отметки дней для отображения в календаре (переносы, праздники, отпуска и т.д.).

- calendar_event_id (uuid, PK, default: gen_random_uuid()) - Уникальный идентификатор записи
- calendar_event_type (calendar_event_type_enum) - Тип события: 'Отгул', 'Больничный', 'Перенос', 'Отпуск', 'Праздник', 'Событие'
- calendar_event_comment (text) - Название праздника, комментарий к отпуску и т.д.
- calendar_event_is_global (boolean, default: false) - Является ли событие глобальным
- calendar_event_is_weekday (boolean) - Является ли день рабочим (может быть установлено только если calendar_event_is_global = true)
- calendar_event_created_by (uuid, FK → profiles.user_id) - Ссылка на пользователя, создавшего событие
- calendar_event_date_start (timestamptz) - Дата и (опционально) время начала
- calendar_event_date_end (timestamptz) - Дата и (опционально) время окончания для многодневных событий

## Тип calendar_event_type_enum
Перечисление типов событий календаря.

- 'Отгул'
- 'Больничный'
- 'Перенос'
- 'Отпуск'
- 'Праздник'
- 'Событие'

## Таблицы интеграции с Worksection
Следующие таблицы используются для интеграции с системой Worksection и не предназначены для прямого использования в продакшне:

### Таблица ws_projects
- id (uuid, PK)
- name (text)
- status (text)
- manager_email (text)
- date_added (timestamp)
- date_closed (timestamp)
- tags (jsonb)
- user_from (jsonb)
- user_to (jsonb)
- ws_id (text, уникальное)
- page (text)

### Таблица ws_tasks
- id (uuid, PK)
- ws_project_id (text, FK → ws_projects.ws_id)
- name (text)
- status (text)
- assignee_email (text)
- date_added (timestamp)
- date_closed (timestamp)
- date_end (timestamp)
- date_start (timestamp)
- tags (jsonb)
- user_from (jsonb)
- user_to (jsonb)
- ws_id (text)

### Таблица ws_subtasks
- id (uuid, PK)
- ws_subtask_id (text)
- ws_task_id (text)
- name (text)
- description (text)
- status (text)
- created_at (timestamp)
- updated_at (timestamp)
- assignee_email (text)

### Таблицы маппинга
Таблицы, используемые для связи между Worksection и внутренней системой:

#### Таблица ws_project_mappings
- id (uuid, PK)
- ws_project_id (text, NOT NULL, уникальное)
- created_at (timestamptz, default: now())

#### Таблица ws_task_mappings
- id (uuid, PK)
- ws_task_id (text, NOT NULL, уникальное)
- created_at (timestamptz, default: now())

#### Таблица ws_subtask_mappings
- id (uuid, PK)
- ws_subtask_id (text, NOT NULL, уникальное)
- created_at (timestamptz, default: now())

### Таблица webhook_events
Хранит информацию о вебхук-событиях от Worksection:
- id (uuid, PK, default: gen_random_uuid())
- event_type (text)
- payload (jsonb)
- received_at (timestamp, default: now())
- processed (boolean, default: false)
- error (text)

### Таблица migrations
Хранит информацию о выполненных миграциях:
- id (integer, PK)
- name (text, NOT NULL, уникальное)
- applied_at (timestamptz, default: now(), NOT NULL)

## Представления

### view_projects_with_ws_data
Представление, объединяющее данные проектов с данными из Worksection для упрощения интеграции.

### view_sections_with_ws_data
Представление, объединяющее данные разделов с данными из Worksection для упрощения интеграции.

### view_tasks_with_ws_data
Представление, объединяющее данные задач с данными из Worksection для упрощения интеграции.

### view_loadings
Представление для удобного доступа к данным загрузок, включая дополнительную информацию для отчетности:
- Информация о сотруднике (имя, email)
- Информация о департаменте, команде, должности
- Информация о разделе и проекте
- Расчетные поля для часов и взвешенных часов

### view_section_hierarchy
Представление для комплексного анализа иерархии проектной структуры, центрированное вокруг раздела. Объединяет информацию из разных уровней иерархии (от заказчика до ответственных специалистов) в одну сущность.

#### Описание:
Это представление создает единую точку доступа к полной информации о разделе и связанных с ним сущностях:
- Иерархия: заказчик → проект → объект → стадия → раздел
- Ответственные лица: ГИП (project_lead_engineer), руководитель проекта, ответственный за раздел
- Организационная структура: департамент и команда ответственного за раздел
- Данные о загрузке: сводка о фактической загрузке, количестве задач и статусе плановой загрузки
- Визуальные элементы: аватары ответственных лиц (ГИП, руководитель проекта, ответственный за раздел)

#### Ключевые поля:
- **Основные идентификаторы**: section_id, object_id, stage_id, project_id, client_id
- **Наименования**: section_name, object_name, stage_name, project_name, client_name
- **Ответственные лица**: project_lead_engineer_name, project_manager_name, section_responsible_name
- **Аватары ответственных лиц**: project_lead_engineer_avatar, project_manager_avatar, section_responsible_avatar
- **Организационная структура**: responsible_department_name, responsible_team_name
- **Статистика**: total_loading_rate, tasks_count, latest_plan_loading_status

#### Применение:
- Аналитические панели для руководителей и менеджеров проектов
- Отчеты о структуре проектов и распределении ответственности
- Поиск и фильтрация разделов с учетом всей иерархии проектной структуры
- Аудит назначения ответственных и загрузки ресурсов

#### Пример использования:
```sql
-- Получить все разделы с ответственными лицами и данными о загрузке
SELECT 
    section_name, 
    project_name, 
    project_lead_engineer_name, 
    project_manager_name, 
    section_responsible_name,
    total_loading_rate,
    tasks_count
FROM 
    view_section_hierarchy
WHERE 
    project_status = 'active';

-- Найти разделы без назначенных ответственных
SELECT 
    section_name, 
    project_name
FROM 
    view_section_hierarchy
WHERE 
    section_responsible_id IS NULL;

-- Анализ загрузки по отделам
SELECT 
    responsible_department_name,
    COUNT(section_id) AS sections_count,
    SUM(total_loading_rate) AS total_department_loading
FROM 
    view_section_hierarchy
GROUP BY 
    responsible_department_name;
```

### view_sections_with_loadings
Представление, обогащающее данные о разделах детальной информацией о загрузках сотрудников. Обеспечивает детализированный анализ распределения ресурсов на уровне разделов и персонала.

#### Описание:
Это представление объединяет информацию из представления view_section_hierarchy с данными о фактических загрузках сотрудников по каждому разделу:
- Базовые данные раздела и его положение в иерархии проекта
- Детализированные данные о загрузках сотрудников (период, коэффициент нагрузки)
- Информация о сотрудниках, назначенных на загрузки
- Визуальные элементы: аватары всех ответственных лиц, включая исполнителей загрузок

#### Ключевые поля:
- **Данные раздела**: section_id, section_name, project_id, project_name и другие поля из view_section_hierarchy
- **Данные загрузки**: loading_id, loading_responsible, loading_start, loading_finish, loading_rate
- **Данные о сотруднике**: responsible_first_name, responsible_last_name, responsible_avatar
- **Аватары ответственных лиц проекта**: project_lead_engineer_avatar, project_manager_avatar, section_responsible_avatar
- **Расчетные поля**: has_loadings (флаг наличия загрузок), loadings_count (количество загрузок для раздела)

### view_employee_workloads
Представление для анализа загрузки сотрудников по проектам и разделам. Ориентировано на мониторинг занятости персонала и планирование ресурсов с акцентом на сотрудника, а не на структуру проекта.

#### Описание:
Это представление предоставляет полную информацию о загрузке каждого сотрудника:
- Персональные данные сотрудника, включая должность и контактную информацию
- Организационная структура: департамент и команда
- Детализированные данные о загрузках на разделы проектов
- Статистика общей загрузки сотрудника

#### Ключевые поля:
- **Данные сотрудника**: user_id, first_name, last_name, email, position_name, avatar_url
- **Организационная структура**: team_id, team_name, department_id, department_name
- **Параметры загрузки**: loading_id, loading_section, loading_start, loading_finish, loading_rate
- **Данные проекта/раздела**: section_name, project_name, project_status
- **Статистика занятости**: has_loadings, loadings_count, employment_rate

#### Применение:
- Планирование и распределение ресурсов на уровне департаментов и команд
- Мониторинг загруженности специалистов различных должностей
- Составление отчетов о занятости сотрудников по проектам
- Выявление незагруженных или перегруженных специалистов

#### Пример использования:
```sql
-- Анализ загруженности сотрудников по департаментам
SELECT 
    department_name,
    COUNT(DISTINCT user_id) AS employees_count,
    SUM(CASE WHEN has_loadings THEN 1 ELSE 0 END) AS employees_with_loadings,
    AVG(loadings_count) AS avg_loadings_per_employee
FROM 
    view_employee_workloads
GROUP BY 
    department_name;

-- Найти незагруженных сотрудников
SELECT 
    first_name || ' ' || last_name AS employee_name,
    position_name,
    department_name,
    team_name
FROM 
    view_employee_workloads
WHERE 
    has_loadings = false
GROUP BY 
    user_id, first_name, last_name, position_name, department_name, team_name;

-- Анализ загрузки по проектам и должностям
SELECT 
    project_name,
    position_name,
    COUNT(DISTINCT user_id) AS employees_count,
    SUM(loading_rate) AS total_loading
FROM 
    view_employee_workloads
WHERE 
    project_id IS NOT NULL
GROUP BY 
    project_name, position_name
ORDER BY 
    project_name, total_loading DESC;
```

### view_project_managers
Представление для анализа менеджеров проектов и их загруженности. Предоставляет агрегированную информацию о менеджерах и количестве активных проектов под их управлением.

#### Описание:
Это представление объединяет данные о менеджерах проектов с подсчетом количества активных проектов:
- Персональные данные менеджера проекта
- Визуальные элементы: аватар менеджера
- Статистика: количество активных проектов под управлением

#### Ключевые поля:
- **manager_id**: Уникальный идентификатор менеджера (uuid)
- **first_name**: Имя менеджера (text)
- **last_name**: Фамилия менеджера (text)
- **manager_name**: Полное имя менеджера (text)
- **avatar_url**: URL аватара менеджера (text)
- **projects_count**: Количество активных проектов (bigint)

#### Применение:
- Мониторинг загруженности менеджеров проектов
- Распределение новых проектов между менеджерами
- Аналитические панели для руководства
- Планирование ресурсов управления проектами

### view_manager_projects
Представление для детального анализа проектов с информацией о менеджерах. Обеспечивает полную картину активных проектов и их руководителей.

#### Описание:
Это представление объединяет данные активных проектов с информацией о назначенных менеджерах:
- Основные данные проекта
- Персональные данные менеджера проекта
- Визуальные элементы: аватар менеджера
- Временные метки создания и обновления проекта

#### Ключевые поля:
- **project_id**: Уникальный идентификатор проекта (uuid)
- **project_name**: Название проекта (text)
- **project_description**: Описание проекта (text)
- **project_status**: Статус проекта (project_status_enum)
- **project_created**: Дата создания проекта (timestamptz)
- **project_updated**: Дата последнего обновления проекта (timestamptz)
- **manager_id**: Уникальный идентификатор менеджера (uuid)
- **manager_first_name**: Имя менеджера (text)
- **manager_last_name**: Фамилия менеджера (text)
- **manager_name**: Полное имя менеджера (text)
- **manager_avatar**: URL аватара менеджера (text)

#### Применение:
- Отображение списка проектов с ответственными менеджерами
- Поиск и фильтрация проектов по менеджерам
- Отчеты о проектной деятельности
- Интерфейсы управления проектами

**Связи:**
- profiles.department_id → departments.department_id
- profiles.team_id → teams.team_id
- profiles.position_id → positions.position_id
- profiles.category_id → categories.category_id
- profiles.role_id → roles.id
- profiles.user_id → auth.users.id
- user_roles.user_id → profiles.user_id
- user_roles.role_id → roles.id
- role_permissions.role_id → roles.id
- role_permissions.permission_id → permissions.id
- projects.project_manager → profiles.user_id
- projects.project_lead_engineer → profiles.user_id
- projects.client_id → clients.client_id
- contracts.contract_client_id → clients.client_id
- contracts.contract_project_id → projects.project_id
- objects.object_stage_id → stages.stage_id
- objects.object_responsible → profiles.user_id
- sections.section_responsible → profiles.user_id
- sections.section_project_id → projects.project_id
- sections.section_object_id → objects.object_id
- tasks.task_responsible → profiles.user_id
- tasks.task_parent_section → sections.section_id
- loadings.loading_responsible → profiles.user_id
- loadings.loading_section → sections.section_id
- loadings.loading_task → tasks.task_id
- plan_loadings.plan_loading_section → sections.section_id
- plan_loadings.plan_loading_created_by → auth.users.id
- assignments.project_id → projects.project_id
- assignments.from_section_id → sections.section_id
- assignments.to_section_id → sections.section_id
- ws_tasks.ws_project_id → ws_projects.ws_id
- calendar_events.calendar_event_created_by → profiles.user_id
