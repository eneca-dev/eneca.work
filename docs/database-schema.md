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

- id (uuid, PK)
- name (text, уникальное)
- description (text)
- created_at (timestamptz)
    - payments.view — доступ к просмотру страницы оплаты
    - payments.edit — доступ к редактированию информации об оплате

## Таблица role_permissions
Связующая таблица между ролями и разрешениями. Определяет, какие разрешения доступны для каждой роли.

- id (uuid, PK)
- role_id (uuid, FK → roles.id)
- permission_id (uuid, FK → permissions.id)
- created_at (timestamptz)

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
- client_created (timestamptz, default: now())
- client_updated (timestamptz, default: now())

## Таблица contracts
Хранит информацию о договорах с заказчиками. Связывает заказчиков с проектами через формальные договорные отношения.

- contract_id (uuid, PK, default: gen_random_uuid())
- contract_number (text, NOT NULL) - Номер договора
- contract_name (text, NOT NULL) - Название договора
- contract_description (text) - Описание договора
- contract_client_id (uuid, FK → clients.client_id) - Ссылка на заказчика
- contract_project_id (uuid, FK → projects.project_id) - Ссылка на проект
- contract_created (timestamptz, default: now())
- contract_updated (timestamptz, default: now())

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

- stage_id (uuid, PK, default: gen_random_uuid())
- stage_name (text, NOT NULL) - Название стадии
- stage_description (text) - Описание стадии

## Таблица objects
Объекты проектирования в рамках стадий. Группирует разделы проекта по физическим объектам строительства.

- object_id (uuid, PK, default: gen_random_uuid())
- object_name (text, NOT NULL) - Название объекта
- object_description (text) - Описание объекта
- object_stage_id (uuid, FK → stages.stage_id) - Ссылка на стадию
- object_responsible (uuid, FK → profiles.user_id) - Ответственный
- object_start_date (timestamptz) - Дата начала
- object_end_date (timestamptz) - Дата окончания
- object_created (timestamptz, default: now())
- object_updated (timestamptz, default: now())

## Таблица sections
Разделы проектной документации. Представляет конкретные части проекта, по которым ведется работа.

- section_id (uuid, PK, default: gen_random_uuid())
- section_name (text, NOT NULL)
- section_description (text)
- section_responsible (uuid, FK → profiles.user_id)
- section_project_id (uuid, NOT NULL, FK → projects.project_id)
- section_created (timestamptz, default: now())
- section_updated (timestamptz, default: now())
- section_object_id (uuid, FK → objects.object_id) - Ссылка на объект
- section_type (text) - Тип раздела (например, "ГУП" или обычный)
- section_start_date (timestamptz) - Дата начала
- section_end_date (timestamptz) - Дата окончания

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
- task_start_date (timestamptz) - Дата начала
- task_end_date (timestamptz) - Дата окончания
- task_status (text, default: 'active') - Статус задачи

## Таблица loadings
Фактические загрузки сотрудников. Учитывает реальное время, затраченное сотрудниками на выполнение работ.

- loading_id (uuid, PK, default: gen_random_uuid())
- loading_responsible (uuid, FK → profiles.user_id)
- loading_section (uuid, FK → sections.section_id)
- loading_start (timestamptz, NOT NULL)
- loading_finish (timestamptz, NOT NULL)
- loading_rate (numeric)
- loading_created (timestamptz, default: now())
- loading_updated (timestamptz, default: now())

## Таблица plan_loadings
Плановые загрузки, создаваемые менеджерами. Используется для планирования необходимых ресурсов на проект.

- plan_loading_id (uuid, PK, default: gen_random_uuid())
- plan_loading_section (uuid, FK → sections.section_id)
- plan_loading_start (timestamptz, NOT NULL)
- plan_loading_finish (timestamptz, NOT NULL)
- plan_loading_rate (numeric, NOT NULL) # Количество ставок (например, 4 ставки = 4 человека по 8 часов в день)
- plan_loading_created (timestamptz, default: now())
- plan_loading_updated (timestamptz, default: now())
- plan_loading_created_by (uuid, FK → auth.users.id) # Менеджер, создавший плановую загрузку
- plan_loading_description (text) # Описание плановой загрузки
- plan_loading_status (varchar, default: 'active') # Статус: active, completed, cancelled

## Представления

### view_projects_with_ws_data
Представление, объединяющее данные проектов с данными из Worksection для упрощения интеграции.

### view_sections_with_ws_data
Представление, объединяющее данные разделов с данными из Worksection для упрощения интеграции.

### view_tasks_with_ws_data
Представление, объединяющее данные задач с данными из Worksection для упрощения интеграции.

### view_loadings
Представление для удобного доступа к данным загрузок, включая дополнительную информацию для отчетности.

---

**Связи:**
- profiles.department_id → departments.department_id
- profiles.team_id → teams.team_id
- profiles.position_id → positions.position_id
- profiles.category_id → categories.category_id
- profiles.role_id → roles.id
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
- plan_loadings.plan_loading_section → sections.section_id
- plan_loadings.plan_loading_created_by → auth.users.id
