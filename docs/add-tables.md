# Дополнительные таблицы для базы данных

## Таблица clients (Заказчики)
- client_id (uuid, PK, default: gen_random_uuid())
- client_name (text, NOT NULL) - Название заказчика
- client_description (text) - Описание заказчика
- client_contact_person (text) - Контактное лицо
- client_phone (text) - Телефон
- client_email (text) - Email
- client_address (text) - Адрес
- client_created (timestamptz, default: now())
- client_updated (timestamptz, default: now())

## Таблица contracts (Договоры)
- contract_id (uuid, PK, default: gen_random_uuid())
- contract_number (text, NOT NULL) - Номер договора
- contract_name (text, NOT NULL) - Название договора
- contract_description (text) - Описание договора
- contract_client_id (uuid, FK → clients.client_id) - Ссылка на заказчика
- contract_project_id (uuid, FK → projects.project_id) - Ссылка на проект
- contract_created (timestamptz, default: now())
- contract_updated (timestamptz, default: now())

## Таблица stages (Стадии)
- stage_id (uuid, PK, default: gen_random_uuid())
- stage_name (text, NOT NULL) - Название стадии
- stage_description (text) - Описание стадии

## Таблица objects (Объекты)
- object_id (uuid, PK, default: gen_random_uuid())
- object_name (text, NOT NULL) - Название объекта
- object_description (text) - Описание объекта
- object_stage_id (uuid, FK → stages.stage_id) - Ссылка на стадию
- object_responsible (uuid, FK → profiles.user_id) - Ответственный
- object_start_date (timestamptz) - Дата начала
- object_end_date (timestamptz) - Дата окончания
- object_created (timestamptz, default: now())
- object_updated (timestamptz, default: now())

## Таблица sections (Обновленная структура)
Таблица sections будет изменена:
- section_id (uuid, PK, default: gen_random_uuid())
- section_name (text, NOT NULL) - Название раздела
- section_description (text) - Описание раздела
- section_responsible (uuid, FK → profiles.user_id) - Ответственный за раздел
- section_object_id (uuid, FK → objects.object_id) - Ссылка на объект (вместо section_parent_project)
- section_type (text) - Тип раздела (например, "ГУП" или обычный)
- section_start_date (timestamptz) - Дата начала
- section_end_date (timestamptz) - Дата окончания
- section_created (timestamptz, default: now())
- section_updated (timestamptz, default: now())

## Таблица tasks (Задачи)
- task_id (uuid, PK, default: gen_random_uuid())
- task_name (text, NOT NULL) - Название задачи
- task_type (text, NOT NULL) - Тип задачи (curation, development)
- task_section_id (uuid, FK → sections.section_id) - Ссылка на раздел
- task_responsible (uuid, FK → profiles.user_id) - Ответственный
- task_start_date (timestamptz) - Дата начала
- task_end_date (timestamptz) - Дата окончания
- task_status (text, default: 'active') - Статус задачи
- task_created (timestamptz, default: now())
- task_updated (timestamptz, default: now())

## Связи между таблицами
- clients → projects (один ко многим: один заказчик может иметь несколько проектов)
- contracts → clients (многие к одному: несколько договоров могут быть с одним заказчиком)
- contracts → projects (многие к одному: несколько договоров могут относиться к одному проекту)
- objects → stages (многие к одному: несколько объектов могут быть в одной стадии)
- sections → objects (многие к одному: несколько разделов могут быть в одном объекте)
- tasks → sections (многие к одному: несколько задач могут быть в одном разделе)
- loadings и plan_loadings будут связаны с tasks для учета фактической и плановой загрузки

## Изменения в существующих таблицах
- В таблице projects добавить поле client_id (uuid, FK → clients.client_id) для связи с заказчиком
- Обновить связи в таблице loadings и plan_loadings для работы с новой структурой
