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
- loading_status (loading_status_type, NOT NULL, default: 'active') - Статус загрузки: active - активная, archived - архивная

## Тип loading_status_type
Перечисление статусов загрузок для разделения активных и архивных записей.

- 'active' - Активная загрузка
- 'archived' - Архивная загрузка

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
Это представление предоставляет полную информацию о загрузке каждого сотрудника с улучшенной обработкой организационной структуры:
- Персональные данные сотрудника, включая должность и контактную информацию
- **Умная обработка имен**: автоматическое формирование полного имени из email, если имя/фамилия пустые
- **Двойная структура департаментов/команд**: оригинальные данные (могут быть NULL) и финальные (всегда заполнены)
- **Виртуальные департаменты/команды**: создание "Без отдела"/"Без команды" для неназначенных сотрудников
- Детализированные данные о загрузках на разделы проектов
- Статистика общей загрузки сотрудника

#### Ключевые поля:
**Персональные данные:**
- **user_id**: Уникальный идентификатор пользователя (uuid)
- **first_name**: Имя сотрудника (text)
- **last_name**: Фамилия сотрудника (text)
- **full_name**: Полное имя с умной обработкой пустых значений (text)
- **email**: Email сотрудника (text)
- **avatar_url**: URL аватара (text)
- **work_format**: Формат работы (work_format_type)
- **employment_rate**: Ставка занятости (numeric)

**Должность и роли:**
- **position_id**: ID должности (uuid)
- **position_name**: Название должности (text)
- **category_id**: ID категории (uuid)
- **category_name**: Название категории (text)
- **role_id**: ID роли (uuid)
- **role_name**: Название роли (text)

**Организационная структура (оригинальные данные):**
- **original_team_id**: Оригинальный ID команды (uuid, может быть NULL)
- **original_team_name**: Оригинальное название команды (text, может быть NULL)
- **original_department_id**: Оригинальный ID департамента (uuid, может быть NULL)
- **original_department_name**: Оригинальное название департамента (text, может быть NULL)

**Организационная структура (финальные данные):**
- **final_team_id**: Финальный ID команды (uuid, всегда заполнен)
- **final_team_name**: Финальное название команды (text, всегда заполнено)
- **final_department_id**: Финальный ID департамента (uuid, всегда заполнен)
- **final_department_name**: Финальное название департамента (text, всегда заполнено)

**Данные загрузок:**
- **loading_id**: ID загрузки (uuid)
- **loading_section**: ID раздела загрузки (uuid)
- **loading_start**: Дата начала загрузки (date)
- **loading_finish**: Дата окончания загрузки (date)
- **loading_rate**: Коэффициент загрузки (numeric)
- **loading_status**: Статус загрузки (loading_status_type)

**Данные проектов:**
- **section_name**: Название раздела (text)
- **project_name**: Название проекта (text)
- **project_status**: Статус проекта (project_status_enum)

**Статистика:**
- **has_loadings**: Флаг наличия загрузок (boolean)
- **loadings_count**: Количество загрузок сотрудника (bigint)

#### Особенности:
- **Умная обработка имен**: если `first_name` и `last_name` пустые, в `full_name` используется часть email до символа `@`
- **Виртуальная структура**: сотрудники без департамента/команды автоматически попадают в "Без отдела"/"Без команды"
- **Двойные данные**: оригинальные поля показывают реальное состояние БД, финальные - всегда заполнены для удобства отображения
- **Полная детализация**: включает все данные о сотруднике, его загрузках и связанных проектах

#### Применение:
- Планирование и распределение ресурсов на уровне департаментов и команд
- Мониторинг загруженности специалистов различных должностей
- Составление отчетов о занятости сотрудников по проектам
- Выявление незагруженных или перегруженных специалистов
- Анализ организационной структуры с учетом неназначенных сотрудников

#### Пример использования:
```sql
-- Анализ загруженности сотрудников по департаментам
SELECT 
    final_department_name,
    COUNT(DISTINCT user_id) AS employees_count,
    SUM(CASE WHEN has_loadings THEN 1 ELSE 0 END) AS employees_with_loadings,
    AVG(loadings_count) AS avg_loadings_per_employee
FROM 
    view_employee_workloads
GROUP BY 
    final_department_name;

-- Найти незагруженных сотрудников с реальными должностями
SELECT DISTINCT
    full_name,
    position_name,
    final_department_name,
    final_team_name
FROM 
    view_employee_workloads
WHERE 
    has_loadings = false
    AND position_name != 'Без должности'
ORDER BY final_department_name, full_name;

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

-- Сравнение оригинальной и финальной структуры
SELECT 
    full_name,
    original_department_name,
    final_department_name,
    original_team_name,
    final_team_name
FROM 
    view_employee_workloads
WHERE 
    original_department_name IS NULL 
    OR original_team_name IS NULL;
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

### view_employees
Представление для работы с сотрудниками с полной детализированной информацией. Предоставляет комплексный доступ к данным о персонале с информацией из всех связанных справочников.

#### Описание:
Это представление объединяет данные из таблицы profiles с информацией из всех связанных справочников:
- Персональные данные сотрудника с умной обработкой пустых имен
- Информация о должности, департаменте, команде и категории
- Данные о системной роли и правах доступа
- Визуальные элементы: аватар сотрудника

#### Ключевые поля:
- **user_id**: Уникальный идентификатор пользователя (uuid)
- **first_name**: Имя сотрудника (text)
- **last_name**: Фамилия сотрудника (text)
- **full_name**: Полное имя с умной обработкой пустых значений (text)
- **email**: Email сотрудника (text)
- **avatar_url**: URL аватара (text)
- **work_format**: Формат работы (work_format_type)
- **employment_rate**: Ставка занятости (numeric)
- **position_id**: ID должности (uuid)
- **position_name**: Название должности (text)
- **department_id**: ID департамента (uuid)
- **department_name**: Название департамента (text)
- **team_id**: ID команды (uuid)
- **team_name**: Название команды (text)
- **category_id**: ID категории (uuid)
- **category_name**: Название категории (text)
- **role_id**: ID роли (uuid)
- **role_name**: Название роли (text)
- **role_description**: Описание роли (text)

#### Особенности:
- **Умная обработка имен**: если `first_name` и `last_name` пустые, в `full_name` используется часть email до символа `@`
- **Полная информация**: включает все данные из связанных справочников
- **Сортировка**: по департаменту, команде, фамилии и имени

#### Применение:
- Отображение списков сотрудников в интерфейсах
- Назначение ответственных на проекты и задачи
- Аналитические отчеты по персоналу
- Управление правами доступа

#### Пример использования:
```sql
-- Получить всех сотрудников с должностями
SELECT full_name, position_name, department_name, team_name 
FROM view_employees 
WHERE position_name != 'Без должности';

-- Найти сотрудников конкретного департамента
SELECT full_name, position_name, email 
FROM view_employees 
WHERE department_name = 'ВК';

-- Получить руководителей проектов
SELECT full_name, email, avatar_url 
FROM view_employees 
WHERE position_name LIKE '%руководитель%';
```

### view_profiles_extended
Расширенное представление таблицы profiles с присоединенными данными из справочников. Предоставляет все поля исходной таблицы плюс расшифровки внешних ключей.

#### Описание:
Это представление расширяет таблицу profiles, добавляя читаемые названия из связанных справочников:
- Все исходные поля таблицы profiles
- Названия должности, департамента, команды, категории и роли
- Вычисляемое поле full_name с умной обработкой пустых значений

#### Ключевые поля:
- Все поля таблицы **profiles** (user_id, first_name, last_name, email, и т.д.)
- **position_name**: Название должности (text)
- **department_name**: Название департамента (text)
- **team_name**: Название команды (text)
- **category_name**: Название категории (text)
- **role_name**: Название роли (text)
- **full_name**: Полное имя с умной обработкой (text)

#### Применение:
- Замена прямых запросов к таблице profiles в случаях, когда нужны названия справочников
- API endpoints для получения данных сотрудников
- Компоненты выбора ответственных лиц
- Отчеты и экспорт данных

#### Пример использования:
```sql
-- Использовать вместо profiles для получения полной информации
SELECT user_id, full_name, email, position_name, department_name 
FROM view_profiles_extended 
WHERE email LIKE '%@enecagroup.com';

-- Группировка по департаментам
SELECT department_name, COUNT(*) as employees_count 
FROM view_profiles_extended 
GROUP BY department_name;
```

### active_loadings
Представление для работы с активными загрузками. Отображает только загрузки со статусом 'active' с дополнительной информацией о временном статусе.

#### Описание:
Это представление фильтрует загрузки по статусу 'active' и добавляет временную классификацию:
- Все поля из таблицы loadings для активных записей
- Дополнительное поле time_status для классификации по времени

#### Ключевые поля:
- Все поля таблицы loadings
- **time_status**: Временной статус ('Завершена', 'Текущая', 'Будущая')

#### Применение:
- Отображение только активных загрузок в интерфейсе
- Планирование текущих и будущих работ
- Исключение архивных данных из основных отчетов

### archived_loadings
Представление для работы с архивными загрузками. Отображает только загрузки со статусом 'archived'.

#### Описание:
Это представление фильтрует загрузки по статусу 'archived' и добавляет метку архивного статуса:
- Все поля из таблицы loadings для архивных записей
- Фиксированное поле time_status со значением 'Архивная'

#### Ключевые поля:
- Все поля таблицы loadings
- **time_status**: Всегда 'Архивная'

#### Применение:
- Просмотр архивных данных
- Аналитика по завершенным проектам
- Восстановление данных из архива

### loading_statistics
Представление для получения статистики по загрузкам с группировкой по статусам.

#### Описание:
Это представление предоставляет агрегированную статистику по загрузкам:
- Группировка по статусу загрузки (active/archived)
- Подсчет количества записей по временным категориям
- Расчет временных диапазонов и средних значений

#### Ключевые поля:
- **loading_status**: Статус загрузки ('active' или 'archived')
- **total_count**: Общее количество загрузок в статусе
- **completed_count**: Количество завершенных загрузок
- **current_count**: Количество текущих загрузок
- **future_count**: Количество будущих загрузок
- **earliest_start**: Самая ранняя дата начала
- **latest_finish**: Самая поздняя дата окончания
- **avg_rate**: Средний коэффициент нагрузки

#### Применение:
- Аналитические панели и дашборды
- Отчеты о распределении загрузок
- Мониторинг активности по проектам
- Планирование архивирования данных

## Функции управления загрузками

### archive_old_loadings(days_threshold INTEGER DEFAULT 30)
Функция для автоматического архивирования старых загрузок.

#### Параметры:
- **days_threshold**: Количество дней с момента окончания загрузки для архивирования (по умолчанию 30)

#### Возвращает:
- **archived_count**: Количество заархивированных записей
- **message**: Сообщение о результате операции

#### Применение:
```sql
-- Архивировать загрузки старше 30 дней
SELECT * FROM archive_old_loadings();

-- Архивировать загрузки старше 60 дней
SELECT * FROM archive_old_loadings(60);
```

### restore_loading_from_archive(loading_uuid UUID)
Функция для восстановления загрузки из архива.

#### Параметры:
- **loading_uuid**: UUID загрузки для восстановления

#### Возвращает:
- **success**: Флаг успешности операции
- **message**: Сообщение о результате операции

#### Применение:
```sql
-- Восстановить конкретную загрузку из архива
SELECT * FROM restore_loading_from_archive('550e8400-e29b-41d4-a716-446655440000');
```

## Индексы для оптимизации

### Индексы таблицы loadings
Для оптимизации запросов по статусам загрузок созданы следующие индексы:

- **idx_loadings_status**: Индекс по полю loading_status для быстрой фильтрации активных/архивных загрузок
- **idx_loadings_status_finish_date**: Составной индекс по loading_status и loading_finish для оптимизации запросов с фильтрацией по статусу и дате окончания
- **idx_loadings_active_date_range**: Индекс по диапазону дат для активных загрузок (loading_start, loading_finish) с условием loading_status = 'active'

#### Применение индексов:
```sql
-- Быстрый поиск активных загрузок
SELECT * FROM loadings WHERE loading_status = 'active';

-- Оптимизированный поиск архивных загрузок по дате
SELECT * FROM loadings 
WHERE loading_status = 'archived' 
AND loading_finish < '2025-01-01';

-- Эффективный поиск пересечений дат для активных загрузок
SELECT * FROM loadings 
WHERE loading_status = 'active' 
AND loading_start <= '2025-06-01' 
AND loading_finish >= '2025-05-01';
```

### view_department_statistics
Представление для получения агрегированной статистики по департаментам и командам. Предоставляет комплексный анализ организационной структуры и загруженности персонала.

#### Описание:
Это представление создает сводную статистику по каждому департаменту:
- Количественные показатели по сотрудникам и загрузкам
- Процентные метрики загруженности
- Детализированная информация по командам в формате JSON
- Анализ распределения должностей

#### Ключевые поля:
- **final_department_id**: ID департамента (uuid)
- **final_department_name**: Название департамента (text)
- **total_employees**: Общее количество сотрудников (bigint)
- **employees_with_loadings**: Количество сотрудников с загрузками (bigint)
- **teams_count**: Количество команд в департаменте (bigint)
- **total_loadings**: Общее количество загрузок в департаменте (numeric)
- **avg_employment_rate**: Средняя ставка занятости (numeric)
- **employees_with_positions**: Сотрудники с назначенными должностями (bigint)
- **loading_percentage**: Процент загруженных сотрудников (numeric)
- **teams_info**: Детальная информация по командам (json)

#### Структура teams_info:
```json
[
  {
    "team_id": "uuid",
    "team_name": "string",
    "employees": number,
    "employees_with_loadings": number,
    "total_loadings": number
  }
]
```

#### Применение:
- Аналитические дашборды для руководства
- Планирование реорганизации департаментов
- Мониторинг эффективности использования ресурсов
- Отчеты о структуре организации

#### Пример использования:
```sql
-- Топ департаментов по загруженности
SELECT 
    final_department_name,
    total_employees,
    loading_percentage,
    total_loadings
FROM 
    view_department_statistics
ORDER BY 
    loading_percentage DESC;

-- Департаменты с низкой загруженностью
SELECT 
    final_department_name,
    total_employees,
    employees_with_loadings,
    loading_percentage
FROM 
    view_department_statistics
WHERE 
    loading_percentage < 50
    AND final_department_name != 'Без отдела';

-- Анализ команд в департаменте
SELECT 
    final_department_name,
    json_array_elements(teams_info) as team_info
FROM 
    view_department_statistics
WHERE 
    final_department_name = 'ВК';
```

## Таблица decomposition_templates
Хранит шаблоны декомпозиции работ для различных департаментов. Позволяет создавать стандартизированные структуры задач для типовых проектов.

- decomposition_template_id (uuid, PK, default: gen_random_uuid()) - Уникальный идентификатор шаблона
- decomposition_template_name (text, NOT NULL) - Название шаблона декомпозиции
- decomposition_department_id (uuid, NOT NULL, FK → departments.department_id) - Ссылка на департамент
- decomposition_template_creator_id (uuid, NOT NULL, FK → profiles.user_id) - Создатель шаблона
- decomposition_template_created_at (timestamptz, NOT NULL, default: now()) - Дата создания шаблона
- decomposition_template_content (jsonb, NOT NULL) - Содержимое шаблона в формате JSON

## Таблица decompositions
Хранит фактические декомпозиции работ для конкретных разделов проектов. Представляет структурированное разбиение работ на подзадачи.

- decomposition_id (uuid, PK, default: gen_random_uuid()) - Уникальный идентификатор декомпозиции
- decomposition_creator_id (uuid, NOT NULL, FK → profiles.user_id) - Создатель декомпозиции
- decomposition_section_id (uuid, NOT NULL, FK → sections.section_id) - Ссылка на раздел проекта
- decomposition_content (jsonb, NOT NULL) - Содержимое декомпозиции в формате JSON

## Индексы для оптимизации производительности

### Индексы таблицы user_reports
Для оптимизации запросов к отчетам пользователей созданы следующие индексы:

- **idx_user_reports_created_by**: Индекс по полю user_report_created_by для быстрого поиска отчетов по автору
- **idx_user_reports_created_at**: Индекс по полю user_report_created_at с DESC сортировкой для оптимизации запросов с сортировкой по дате

#### Применение индексов:
```sql
-- Быстрый поиск отчетов конкретного пользователя
SELECT * FROM user_reports WHERE user_report_created_by = 'user_uuid';

-- Оптимизированная сортировка по дате создания
SELECT * FROM user_reports ORDER BY user_report_created_at DESC LIMIT 10;

-- Эффективный поиск отчетов за период
SELECT * FROM user_reports 
WHERE user_report_created_at >= '2025-01-01' 
AND user_report_created_at < '2025-02-01'
ORDER BY user_report_created_at DESC;
```

## Функции и процедуры

### Функции управления загрузками

#### archive_old_loadings(days_threshold INTEGER DEFAULT 30)
Функция для автоматического архивирования старых загрузок.

**Параметры:**
- **days_threshold**: Количество дней с момента окончания загрузки для архивирования (по умолчанию 30)

**Возвращает:**
- **archived_count**: Количество заархивированных записей
- **message**: Сообщение о результате операции

**Применение:**
```sql
-- Архивировать загрузки старше 30 дней
SELECT * FROM archive_old_loadings();

-- Архивировать загрузки старше 60 дней
SELECT * FROM archive_old_loadings(60);
```

#### restore_loading_from_archive(loading_uuid UUID)
Функция для восстановления загрузки из архива.

**Параметры:**
- **loading_uuid**: UUID загрузки для восстановления

**Возвращает:**
- **success**: Флаг успешности операции
- **message**: Сообщение о результате операции

**Применение:**
```sql
-- Восстановить конкретную загрузку из архива
SELECT * FROM restore_loading_from_archive('550e8400-e29b-41d4-a716-446655440000');
```

## Типы данных и перечисления

### loading_status_type
Перечисление статусов загрузок для разделения активных и архивных записей.

- **'active'** - Активная загрузка, участвует в текущем планировании
- **'archived'** - Архивная загрузка, исключена из активного планирования

### calendar_event_type_enum
Перечисление типов событий календаря для отметки особых дней.

- **'Отгул'** - День отгула сотрудника
- **'Больничный'** - Больничный лист
- **'Перенос'** - Перенесенный рабочий день
- **'Отпуск'** - Отпуск сотрудника
- **'Праздник'** - Праздничный день
- **'Событие'** - Корпоративное или иное событие

### assignment_status
Перечисление возможных статусов заданий между разделами.

- **'Создано'** - Задание создано, но еще не передано
- **'Передано'** - Задание передано исполнителю
- **'Принято'** - Задание принято к исполнению
- **'Выполнено'** - Задание выполнено
- **'Согласовано'** - Задание согласовано и закрыто

## Рекомендации по использованию

### Работа с загрузками
1. **Используйте представления** вместо прямых запросов к таблицам для получения агрегированных данных
2. **Архивируйте старые загрузки** регулярно для поддержания производительности
3. **Используйте индексы** при фильтрации по датам и статусам

### Планирование ресурсов
1. **view_employee_workloads** - для анализа загруженности сотрудников
2. **view_department_statistics** - для анализа эффективности департаментов
3. **loading_statistics** - для общей статистики по проекту

### Отчетность
1. **view_section_hierarchy** - для комплексного анализа проектной структуры
2. **view_user_reports_with_authors** - для системы обратной связи
3. **view_manager_projects** - для отчетов руководства

## Таблица user_reports
Хранит отчеты пользователей о проблемах, ошибках и предложениях по улучшению системы. Позволяет пользователям сообщать о найденных проблемах и отслеживать их решение.

- user_report_id (uuid, PK, default: gen_random_uuid()) - Уникальный идентификатор отчета
- user_report_short_description (text, NOT NULL) - Краткое описание проблемы или предложения
- user_report_detailed_description (text) - Подробное описание проблемы или предложения
- user_report_created_by (uuid, NOT NULL, FK → profiles.user_id) - Ссылка на пользователя, создавшего отчет
- user_report_created_at (timestamptz, NOT NULL, default: timezone('utc', now())) - Дата и время создания отчета

### view_user_reports_with_authors
Представление для работы с отчетами пользователей, включающее полную информацию об авторах отчетов.

#### Описание:
Это представление объединяет данные из таблицы user_reports с информацией о пользователях, создавших отчеты:
- Основные данные отчета
- Персональные данные автора отчета с умной обработкой имен
- Информация о должности, департаменте и команде автора
- Визуальные элементы: аватар автора

#### Ключевые поля:
- **user_report_id**: Уникальный идентификатор отчета (uuid)
- **user_report_short_description**: Краткое описание (text)
- **user_report_detailed_description**: Подробное описание (text)
- **user_report_created_by**: ID автора отчета (uuid)
- **user_report_created_at**: Дата и время создания (timestamptz)
- **author_first_name**: Имя автора (text)
- **author_last_name**: Фамилия автора (text)
- **author_full_name**: Полное имя автора с умной обработкой (text)
- **author_email**: Email автора (text)
- **author_avatar_url**: URL аватара автора (text)
- **author_position_name**: Должность автора (text)
- **author_department_name**: Департамент автора (text)
- **author_team_name**: Команда автора (text)

#### Применение:
- Отображение списка отчетов с информацией об авторах
- Система обратной связи и багтрекинга
- Аналитика по типам проблем и активности пользователей
- Интерфейсы администрирования и поддержки

#### Пример использования:
```sql
-- Получить все отчеты с информацией об авторах
SELECT 
    user_report_short_description,
    author_full_name,
    author_position_name,
    user_report_created_at
FROM 
    view_user_reports_with_authors
ORDER BY 
    user_report_created_at DESC;

-- Найти отчеты от конкретного департамента
SELECT 
    user_report_short_description,
    author_full_name,
    user_report_created_at
FROM 
    view_user_reports_with_authors
WHERE 
    author_department_name = 'ВК';

-- Статистика отчетов по департаментам
SELECT 
    author_department_name,
    COUNT(*) as reports_count
FROM 
    view_user_reports_with_authors
GROUP BY 
    author_department_name
ORDER BY 
    reports_count DESC;
```

## Безопасность и контроль доступа

### Row Level Security (RLS)
В системе включена политика безопасности на уровне строк для следующих таблиц:

#### Основные таблицы с RLS:
- **projects** - Доступ к проектам ограничен в зависимости от роли пользователя
- **tasks** - Доступ к задачам контролируется на основе принадлежности к проекту
- **clients** - Доступ к данным клиентов ограничен
- **contracts** - Доступ к договорам контролируется
- **stages** - Доступ к стадиям проектов ограничен
- **objects** - Доступ к объектам проектирования контролируется

#### Таблицы интеграции с Worksection:
- **ws_projects** - Данные проектов из Worksection
- **ws_tasks** - Данные задач из Worksection  
- **ws_subtasks** - Данные подзадач из Worksection

### Рекомендации по безопасности:
1. **Используйте представления** для доступа к данным вместо прямых запросов к таблицам
2. **Проверяйте права доступа** перед выполнением операций изменения данных
3. **Логируйте критические операции** через систему аудита
4. **Используйте параметризованные запросы** для предотвращения SQL-инъекций

## Миграции и версионирование

### Таблица migrations
Система отслеживает все примененные миграции через специальную таблицу:

- **id** (integer, PK) - Уникальный идентификатор миграции
- **name** (text, NOT NULL, уникальное) - Название миграции
- **applied_at** (timestamptz, NOT NULL, default: now()) - Дата применения миграции

### Процесс миграций:
1. Каждая миграция имеет уникальное имя в формате `YYYY_MM_DD_description`
2. Миграции применяются последовательно и не могут быть отменены
3. Система автоматически отслеживает примененные миграции
4. Повторное применение миграции невозможно

## Мониторинг и производительность

### Ключевые метрики для мониторинга:
1. **Количество активных загрузок** - отслеживание через `loading_statistics`
2. **Производительность запросов** - мониторинг медленных запросов к представлениям
3. **Размер таблиц** - контроль роста данных, особенно `loadings` и `user_reports`
4. **Использование индексов** - анализ эффективности созданных индексов

### Рекомендации по оптимизации:
1. **Регулярное архивирование** старых загрузок через `archive_old_loadings()`
2. **Анализ планов выполнения** для сложных запросов к представлениям
3. **Мониторинг блокировок** при массовых операциях с данными
4. **Регулярное обновление статистики** для оптимизатора запросов

## Интеграция с внешними системами

### Worksection Integration
Система интегрирована с платформой управления проектами Worksection через:

#### Таблицы синхронизации:
- **ws_projects** - Проекты из Worksection
- **ws_tasks** - Задачи из Worksection
- **ws_subtasks** - Подзадачи из Worksection

#### Таблицы маппинга:
- **ws_project_mappings** - Связь между внутренними проектами и Worksection
- **ws_task_mappings** - Связь между внутренними задачами и Worksection
- **ws_subtask_mappings** - Связь между внутренними подзадачами и Worksection

#### Система вебхуков:
- **webhook_events** - Обработка событий от Worksection
- Автоматическая синхронизация изменений
- Обработка ошибок интеграции

### API и представления интеграции:
- **view_projects_with_ws_data** - Проекты с данными Worksection
- **view_sections_with_ws_data** - Разделы с данными Worksection  
- **view_tasks_with_ws_data** - Задачи с данными Worksection

## Заключение

Данная схема базы данных обеспечивает:

✅ **Полное управление проектами** - от клиентов до конкретных задач  
✅ **Гибкое планирование ресурсов** - с поддержкой активных и архивных загрузок  
✅ **Организационную структуру** - департаменты, команды, должности  
✅ **Систему отчетности** - через мощные представления и аналитику  
✅ **Интеграцию с внешними системами** - Worksection и другие  
✅ **Безопасность данных** - RLS и контроль доступа  
✅ **Масштабируемость** - оптимизированные индексы и архивирование  

Система готова для использования в производственной среде и поддерживает все основные бизнес-процессы управления проектами и ресурсами.
