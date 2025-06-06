# Таблицы базы данных

Данный документ содержит описание всех таблиц в базе данных системы управления проектами.

## Организационная структура

### departments
Таблица отделов компании.

| Поле | Тип | Описание |
|------|-----|----------|
| department_id | uuid | Уникальный идентификатор отдела (PK) |
| ws_department_id | integer | ID отдела в Worksection |
| department_name | text | Название отдела |

### teams
Таблица команд внутри отделов.

| Поле | Тип | Описание |
|------|-----|----------|
| team_id | uuid | Уникальный идентификатор команды (PK) |
| ws_team_id | integer | ID команды в Worksection |
| team_name | text | Название команды |
| department_id | uuid | Ссылка на отдел (FK → departments.department_id) |

### positions
Таблица должностей.

| Поле | Тип | Описание |
|------|-----|----------|
| position_id | uuid | Уникальный идентификатор должности (PK) |
| ws_position_id | integer | ID должности в Worksection |
| position_name | text | Название должности |

### categories
Таблица категорий сотрудников.

| Поле | Тип | Описание |
|------|-----|----------|
| category_id | uuid | Уникальный идентификатор категории (PK) |
| ws_category_id | integer | ID категории в Worksection |
| category_name | text | Название категории |

## Система ролей и разрешений

### roles
Таблица ролей пользователей.

| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid | Уникальный идентификатор роли (PK) |
| name | text | Название роли (уникальное) |
| description | text | Описание роли |
| created_at | timestamptz | Дата создания |

### permissions
Таблица разрешений системы.

| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid | Уникальный идентификатор разрешения (PK) |
| name | text | Название разрешения (уникальное) |
| description | text | Описание разрешения |
| created_at | timestamptz | Дата создания |

### role_permissions
Связующая таблица ролей и разрешений.

| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid | Уникальный идентификатор записи (PK) |
| role_id | uuid | Ссылка на роль (FK → roles.id) |
| permission_id | uuid | Ссылка на разрешение (FK → permissions.id) |
| created_at | timestamptz | Дата создания |

### user_roles
Связующая таблица пользователей и ролей.

| Поле | Тип | Описание |
|------|-----|----------|
| user_id | uuid | Ссылка на пользователя (PK, FK → profiles.user_id) |
| role_id | uuid | Ссылка на роль (PK, FK → roles.id) |

## Профили пользователей

### profiles
Основная таблица профилей пользователей.

| Поле | Тип | Описание |
|------|-----|----------|
| user_id | uuid | Уникальный идентификатор пользователя (PK, FK → auth.users.id) |
| first_name | text | Имя |
| last_name | text | Фамилия |
| department_id | uuid | Ссылка на отдел (FK → departments.department_id) |
| team_id | uuid | Ссылка на команду (FK → teams.team_id) |
| position_id | uuid | Ссылка на должность (FK → positions.position_id) |
| email | text | Email адрес |
| created_at | timestamptz | Дата создания профиля |
| category_id | uuid | Ссылка на категорию (FK → categories.category_id) |
| role_id | uuid | Ссылка на роль (FK → roles.id) |
| work_format | work_format_type | Формат работы (Гибридный, В офисе, Удаленно) |
| address | text | Адрес |
| employment_rate | numeric | Коэффициент занятости (по умолчанию 1) |
| salary | numeric | Зарплата (по умолчанию 0) |
| is_hourly | boolean | Почасовая оплата (по умолчанию true) |
| avatar_url | text | URL аватара |

### work_schedules
Рабочие расписания пользователей по дням недели.

| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid | Уникальный идентификатор записи (PK) |
| user_id | uuid | Ссылка на пользователя (FK → profiles.user_id) |
| day_of_week | integer | День недели (0-воскресенье, 1-понедельник, ..., 6-суббота) |
| start_time | time | Время начала рабочего дня |
| end_time | time | Время окончания рабочего дня |
| is_working_day | boolean | Является ли день рабочим (по умолчанию true) |
| created_at | timestamptz | Дата создания |
| updated_at | timestamptz | Дата обновления |

## Проекты и клиенты

### clients
Таблица заказчиков проектов.

| Поле | Тип | Описание |
|------|-----|----------|
| client_id | uuid | Уникальный идентификатор заказчика (PK) |
| client_name | text | Название заказчика |
| client_description | text | Описание заказчика |
| client_contact_person | text | Контактное лицо заказчика |
| client_phone | text | Телефон заказчика |
| client_email | text | Email заказчика |
| client_address | text | Адрес заказчика |
| client_created | timestamptz | Дата создания записи |
| client_updated | timestamptz | Дата обновления записи |

### stages
Таблица стадий проектов.

| Поле | Тип | Описание |
|------|-----|----------|
| stage_id | uuid | Уникальный идентификатор стадии (PK) |
| stage_name | text | Название стадии |
| stage_description | text | Описание стадии |

### objects
Таблица объектов в стадиях проектов.

| Поле | Тип | Описание |
|------|-----|----------|
| object_id | uuid | Уникальный идентификатор объекта (PK) |
| object_name | text | Название объекта |
| object_description | text | Описание объекта |
| object_stage_id | uuid | Ссылка на стадию (FK → stages.stage_id) |
| object_responsible | uuid | Ответственный за объект (FK → profiles.user_id) |
| object_start_date | timestamptz | Дата начала работ по объекту |
| object_end_date | timestamptz | Дата окончания работ по объекту |
| object_created | timestamptz | Дата создания записи |
| object_updated | timestamptz | Дата обновления записи |

### projects
Основная таблица проектов.

| Поле | Тип | Описание |
|------|-----|----------|
| project_id | uuid | Уникальный идентификатор проекта (PK) |
| project_name | text | Название проекта |
| project_description | text | Описание проекта |
| project_manager | uuid | Руководитель проекта (FK → profiles.user_id) |
| project_lead_engineer | uuid | Главный инженер проекта (FK → profiles.user_id) |
| project_status | project_status_enum | Статус проекта (active, archive, paused, canceled) |
| project_created | timestamptz | Дата создания |
| project_updated | timestamptz | Дата обновления |
| client_id | uuid | Ссылка на заказчика (FK → clients.client_id) |

### contracts
Таблица договоров с заказчиками.

| Поле | Тип | Описание |
|------|-----|----------|
| contract_id | uuid | Уникальный идентификатор договора (PK) |
| contract_number | text | Номер договора |
| contract_name | text | Название договора |
| contract_description | text | Описание договора |
| contract_client_id | uuid | Ссылка на заказчика (FK → clients.client_id) |
| contract_project_id | uuid | Ссылка на проект (FK → projects.project_id) |
| contract_created | timestamptz | Дата создания записи |
| contract_updated | timestamptz | Дата обновления записи |

### sections
Разделы проектов.

| Поле | Тип | Описание |
|------|-----|----------|
| section_id | uuid | Уникальный идентификатор раздела (PK) |
| section_name | text | Название раздела |
| section_description | text | Описание раздела |
| section_responsible | uuid | Ответственный за раздел (FK → profiles.user_id) |
| section_project_id | uuid | Ссылка на проект (FK → projects.project_id) |
| section_created | timestamptz | Дата создания |
| section_updated | timestamptz | Дата обновления |
| section_object_id | uuid | Ссылка на объект (FK → objects.object_id) |
| section_type | text | Тип раздела (например, "ГУП" или обычный) |
| section_start_date | timestamptz | Дата начала работ по разделу |
| section_end_date | timestamptz | Дата окончания работ по разделу |

### tasks
Задачи в разделах проектов.

| Поле | Тип | Описание |
|------|-----|----------|
| task_id | uuid | Уникальный идентификатор задачи (PK) |
| task_name | text | Название задачи |
| task_description | text | Описание задачи |
| task_responsible | uuid | Ответственный за задачу (FK → profiles.user_id) |
| task_parent_section | uuid | Родительский раздел (FK → sections.section_id) |
| task_created | timestamptz | Дата создания |
| task_updated | timestamptz | Дата обновления |
| task_completed | timestamptz | Дата завершения |
| task_type | text | Тип задачи (curation, development) |
| task_start_date | timestamptz | Дата начала выполнения задачи |
| task_end_date | timestamptz | Дата окончания выполнения задачи |
| task_status | text | Статус задачи (по умолчанию 'active') |

## Планирование и загрузки

### plan_loadings
Плановые загрузки, создаваемые менеджерами для разделов.

| Поле | Тип | Описание |
|------|-----|----------|
| plan_loading_id | uuid | Уникальный идентификатор плановой загрузки (PK) |
| plan_loading_section | uuid | Ссылка на раздел (FK → sections.section_id) |
| plan_loading_start | date | Дата начала плановой загрузки |
| plan_loading_finish | date | Дата окончания плановой загрузки |
| plan_loading_rate | numeric | Количество ставок (например, 4 ставки = 4 человека по 8 часов в день) |
| plan_loading_created | timestamptz | Дата создания |
| plan_loading_updated | timestamptz | Дата обновления |
| plan_loading_created_by | uuid | Создатель записи (FK → auth.users.id) |
| plan_loading_description | text | Описание плановой загрузки |
| plan_loading_status | varchar | Статус плановой загрузки (по умолчанию 'active') |

### loadings
Фактические загрузки сотрудников по задачам.

| Поле | Тип | Описание |
|------|-----|----------|
| loading_id | uuid | Уникальный идентификатор записи нагрузки (PK) |
| loading_responsible | uuid | Ответственный сотрудник (FK → profiles.user_id) |
| loading_section | uuid | Раздел проекта (FK → sections.section_id) |
| loading_start | date | Дата начала нагрузки |
| loading_finish | date | Дата окончания нагрузки |
| loading_rate | numeric | Коэффициент нагрузки (1 или 1.25) |
| loading_created | timestamptz | Дата создания записи |
| loading_updated | timestamptz | Дата обновления записи |
| loading_task | uuid | Ссылка на задачу (FK → tasks.task_id) |
| loading_status | loading_status_type | Статус загрузки (active, archived) |

## Поручения

### assignments
Таблица поручений между разделами.

| Поле | Тип | Описание |
|------|-----|----------|
| assignment_id | uuid | Уникальный идентификатор поручения (PK) |
| project_id | uuid | Ссылка на проект (FK → projects.project_id) |
| from_section_id | uuid | Раздел-отправитель (FK → sections.section_id) |
| to_section_id | uuid | Раздел-получатель (FK → sections.section_id) |
| text | text | Текст поручения |
| created_at | timestamp | Дата создания |
| updated_at | timestamp | Дата обновления |
| due_date | date | Срок выполнения |
| link | text | Ссылка |
| created_by | uuid | Создатель поручения |
| updated_by | uuid | Последний редактор |
| status | assignment_status | Статус (Создано, Передано, Принято, Выполнено, Согласовано) |
| planned_transmitted_date | date | Планируемая дата передачи |
| planned_duration_date | date | Планируемая дата выполнения |
| actual_transmitted_date | date | Фактическая дата передачи |
| actual_accepted_date | date | Фактическая дата принятия |
| actual_worked_out_date | date | Фактическая дата выполнения |
| actual_agreed_date | date | Фактическая дата согласования |

## Календарь и события

### calendar_events
События и отметки дней для отображения в календаре.

| Поле | Тип | Описание |
|------|-----|----------|
| calendar_event_id | uuid | Уникальный идентификатор записи (PK) |
| calendar_event_type | calendar_event_type_enum | Тип события (Отгул, Больничный, Перенос, Отпуск, Праздник, Событие) |
| calendar_event_comment | text | Название праздника, комментарий к отпуску и т.д. |
| calendar_event_is_global | boolean | Является ли событие глобальным для всей компании |
| calendar_event_is_weekday | boolean | Является ли день рабочим (только для глобальных событий) |
| calendar_event_created_by | uuid | Создатель события (FK → profiles.user_id) |
| calendar_event_date_start | timestamptz | Дата и время начала события |
| calendar_event_date_end | timestamptz | Дата и время окончания события |
| calendar_event_created_at | timestamptz | Дата создания записи |

## Декомпозиция

### decomposition_templates
Шаблоны декомпозиции для отделов.

| Поле | Тип | Описание |
|------|-----|----------|
| decomposition_template_id | uuid | Уникальный идентификатор шаблона (PK) |
| decomposition_template_name | text | Название шаблона |
| decomposition_department_id | uuid | Ссылка на отдел (FK → departments.department_id) |
| decomposition_template_creator_id | uuid | Создатель шаблона (FK → profiles.user_id) |
| decomposition_template_created_at | timestamptz | Дата создания |
| decomposition_template_content | jsonb | Содержимое шаблона в формате JSON |

### decompositions
Декомпозиции разделов проектов.

| Поле | Тип | Описание |
|------|-----|----------|
| decomposition_id | uuid | Уникальный идентификатор декомпозиции (PK) |
| decomposition_creator_id | uuid | Создатель декомпозиции (FK → profiles.user_id) |
| decomposition_section_id | uuid | Ссылка на раздел (FK → sections.section_id) |
| decomposition_content | jsonb | Содержимое декомпозиции в формате JSON |

## Отчеты пользователей

### user_reports
Отчеты пользователей о проблемах и предложениях.

| Поле | Тип | Описание |
|------|-----|----------|
| user_report_id | uuid | Уникальный идентификатор отчета (PK) |
| user_report_short_description | text | Краткое описание проблемы или предложения |
| user_report_detailed_description | text | Подробное описание проблемы или предложения |
| user_report_created_by | uuid | Создатель отчета (FK → profiles.user_id) |
| user_report_created_at | timestamptz | Дата создания отчета |

## Интеграция с Worksection

### ws_projects
Проекты из Worksection (не использовать в продакшене).

| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid | Уникальный идентификатор (PK) |
| name | text | Название проекта |
| status | text | Статус проекта |
| manager_email | text | Email менеджера |
| date_added | timestamp | Дата добавления |
| date_closed | timestamp | Дата закрытия |
| tags | jsonb | Теги |
| user_from | jsonb | Пользователь-отправитель (поле Worksection) |
| user_to | jsonb | Пользователь-получатель (поле Worksection) |
| ws_id | text | ID в Worksection (уникальное) |
| page | text | Страница (поле Worksection) |

### ws_tasks
Задачи из Worksection (не использовать в продакшене).

| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid | Уникальный идентификатор (PK) |
| ws_project_id | text | ID проекта в Worksection (FK → ws_projects.ws_id) |
| name | text | Название задачи |
| status | text | Статус задачи |
| assignee_email | text | Email исполнителя |
| date_added | timestamp | Дата добавления |
| date_closed | timestamp | Дата закрытия |
| date_end | timestamp | Дата окончания |
| date_start | timestamp | Дата начала |
| tags | jsonb | Теги |
| user_from | jsonb | Пользователь-отправитель |
| user_to | jsonb | Пользователь-получатель |
| ws_id | text | ID в Worksection |

### ws_subtasks
Подзадачи из Worksection (не использовать в продакшене).

| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid | Уникальный идентификатор (PK) |
| ws_subtask_id | text | ID подзадачи в Worksection |
| ws_task_id | text | ID задачи в Worksection |
| name | text | Название подзадачи |
| description | text | Описание |
| status | text | Статус |
| created_at | timestamp | Дата создания |
| updated_at | timestamp | Дата обновления |
| assignee_email | text | Email исполнителя |

### ws_project_mappings
Маппинг проектов Worksection.

| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid | Уникальный идентификатор (PK) |
| ws_project_id | text | ID проекта в Worksection (уникальное) |
| created_at | timestamptz | Дата создания |

### ws_task_mappings
Маппинг задач Worksection.

| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid | Уникальный идентификатор (PK) |
| ws_task_id | text | ID задачи в Worksection (уникальное) |
| created_at | timestamptz | Дата создания |

### ws_subtask_mappings
Маппинг подзадач Worksection.

| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid | Уникальный идентификатор (PK) |
| ws_subtask_id | text | ID подзадачи в Worksection (уникальное) |
| created_at | timestamptz | Дата создания |

## Системные таблицы

### webhook_events
События вебхуков.

| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid | Уникальный идентификатор (PK) |
| event_type | text | Тип события |
| payload | jsonb | Полезная нагрузка события |
| received_at | timestamp | Время получения (по умолчанию now()) |
| processed | boolean | Обработано ли событие (по умолчанию false) |
| error | text | Ошибка обработки |

### migrations
Таблица миграций.

| Поле | Тип | Описание |
|------|-----|----------|
| id | integer | Уникальный идентификатор (PK, автоинкремент) |
| name | text | Название миграции (уникальное) |
| applied_at | timestamptz | Дата применения (по умолчанию now()) |

## Типы данных (ENUM)

### work_format_type
- Гибридный
- В офисе
- Удаленно

### project_status_enum
- active
- archive
- paused
- canceled

### loading_status_type
- active
- archived

### assignment_status
- Создано
- Передано
- Принято
- Выполнено
- Согласовано

### calendar_event_type_enum
- Отгул
- Больничный
- Перенос
- Отпуск
- Праздник
- Событие 