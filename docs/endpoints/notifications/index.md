# Notifications API

## Обзор

Supabase Edge Function для создания и рассылки уведомлений пользователям системы.

## Дополнительная документация

- [Географическая фильтрация](./geo-filtering.md) - Фильтрация уведомлений по городам и странам

**URL:** `/functions/v1/notifications`  
**Метод:** `POST`  
**Тип контента:** `application/json`

## Описание

Эндпоинт создает уведомление в системе и отправляет его указанным пользователям или пользователям, отфильтрованным по определенным критериям.

## Заголовки

```
Content-Type: application/json
Authorization: Bearer [YOUR_TOKEN]
```

## Параметры запроса

### Обязательные параметры

| Параметр | Тип | Описание |
|----------|-----|----------|
| `entityType` | string | Тип сущности для которой создается уведомление |
| `payload` | NotificationPayload | Данные уведомления |

### Необязательные параметры

| Параметр | Тип | Описание |
|----------|-----|----------|
| `userIds` | string[] | Массив ID пользователей для отправки уведомления |
| `filters` | FilterOptions | Фильтры для автоматического подбора пользователей |

### Объект FilterOptions

| Поле | Тип | Описание |
|------|-----|----------|
| `departmentId` | string | ID отдела |
| `positionId` | string | ID позиции |
| `roleId` | string | ID роли |
| `teamId` | string | ID команды |
| `workFormat` | string | Формат работы |
| `categoryId` | string | ID категории |
| `isHourly` | boolean | Признак почасовой работы |
| `cityId` | string | ID города |
| `countryId` | string | ID страны |

### Объект NotificationPayload

| Поле | Тип | Обязательность | Описание |
|------|-----|----------------|----------|
| `title` | string | Необязательно | Заголовок уведомления |
| `message` | string | Необязательно | Основное сообщение уведомления |
| `description` | string | Необязательно | Дополнительное описание (альтернатива message) |
| `type` | 'info' \| 'warning' \| 'error' \| 'success' | Необязательно | Тип уведомления (по умолчанию: 'info') |
| `action` | ActionObject | Необязательно | Действие, связанное с уведомлением |
| `metadata` | Record<string, any> | Необязательно | Дополнительные метаданные |
| `assignment` | AssignmentPayload | Необязательно | Данные для уведомлений о передаче заданий |
| `announcement` | AnnouncementPayload | Необязательно | Данные для уведомлений-объявлений |

### Объект ActionObject

| Поле | Тип | Обязательность | Описание |
|------|-----|----------------|----------|
| `type` | string | Обязательно | Тип действия (например, 'navigate', 'modal', 'external') |
| `url` | string | Необязательно | URL для навигации или внешняя ссылка |
| `data` | Record<string, any> | Необязательно | Дополнительные данные для действия |

### Объект AssignmentPayload

| Поле | Тип | Обязательность | Описание |
|------|-----|----------------|----------|
| `project` | string | Обязательно | Название проекта |
| `from_section` | string | Обязательно | Раздел, откуда передаются задания |
| `amount` | number | Обязательно | Количество переданных заданий |

### Объект AnnouncementPayload

| Поле | Тип | Обязательность | Описание |
|------|-----|----------------|----------|
| `user_name` | string | Обязательно | Имя пользователя, создавшего объявление |
| `title` | string | Обязательно | Заголовок объявления |
| `body` | string | Обязательно | Текст объявления |

## Примеры запросов

### Отправка уведомления конкретным пользователям

```json
{
  "entityType": "task_assignment",
  "payload": {
    "title": "Новая задача назначена",
    "message": "Вам назначена новая задача 'Разработка API'",
    "type": "info",
    "action": {
      "type": "navigate",
      "url": "/tasks",
      "data": {
        "taskId": "123e4567-e89b-12d3-a456-426614174000"
      }
    },
    "metadata": {
      "taskId": "123e4567-e89b-12d3-a456-426614174000",
      "priority": "high"
    }
  },
  "userIds": [
    "5f115156-6362-492f-b202-ac0da43b80d9",
    "7a225167-7473-593a-b313-537eb44b91e0"
  ]
}
```

### Отправка уведомления с фильтрами

```json
{
  "entityType": "department_announcement",
  "payload": {
    "title": "Объявление для отдела",
    "message": "Важное объявление для всех сотрудников отдела разработки",
    "type": "info",
    "action": {
      "type": "navigate",
      "url": "/dashboard/announcements"
    }
  },
  "filters": {
    "departmentId": "dev-dept-123",
    "workFormat": "remote"
  }
}
```

### Отправка уведомления пользователям из определенного города

```json
{
  "entityType": "city_announcement",
  "payload": {
    "title": "Объявление для города",
    "message": "Важное объявление для всех сотрудников из г. Киев",
    "type": "info",
    "action": {
      "type": "navigate",
      "url": "/dashboard/announcements"
    }
  },
  "filters": {
    "cityId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### Отправка уведомления пользователям из определенной страны

```json
{
  "entityType": "country_announcement",
  "payload": {
    "title": "Объявление для страны",
    "message": "Важное объявление для всех сотрудников из Украины",
    "type": "info",
    "action": {
      "type": "navigate",
      "url": "/dashboard/announcements"
    }
  },
  "filters": {
    "countryId": "223e8400-e29b-41d4-a716-446655440000"
  }
}
```

### Комбинированная фильтрация

```json
{
  "entityType": "complex_announcement",
  "payload": {
    "title": "Объявление для определенной группы",
    "message": "Объявление для удаленных сотрудников IT-отдела из Киева",
    "type": "info",
    "action": {
      "type": "navigate",
      "url": "/dashboard/announcements"
    },
    "metadata": {
      "targetGroup": "remote_developers_kyiv"
    }
  },
  "filters": {
    "departmentId": "dev-dept-123",
    "cityId": "550e8400-e29b-41d4-a716-446655440000",
    "workFormat": "remote"
  }
}
```

### Уведомление о передаче заданий (AssignmentPayload)

```json
{
  "entityType": "assignment",
  "payload": {
    "title": "Задания переданы",
    "message": "Вам передано 5 заданий",
    "type": "info",
    "action": {
      "type": "navigate",
      "url": "/tasks"
    },
    "assignment": {
      "project": "Веб-приложение",
      "from_section": "Разработка API",
      "amount": 5
    }
  },
  "userIds": [
    "5f115156-6362-492f-b202-ac0da43b80d9"
  ]
}
```

### Уведомление-объявление (AnnouncementPayload)

```json
{
  "entityType": "announcement",
  "payload": {
    "title": "Новое объявление",
    "message": "Завтра будет проведено совещание по планированию",
    "type": "info",
    "action": {
      "type": "navigate",
      "url": "/dashboard/announcements"
    },
    "announcement": {
      "user_name": "Иван Петров",
      "title": "Совещание по планированию",
      "body": "Завтра в 10:00 состоится совещание по планированию новых проектов. Приглашаются все менеджеры проектов."
    }
  },
  "filters": {
    "positionId": "project-manager-id"
  }
}
```

## Важные примечания по payload

### Гибкость структуры
- Все поля в `NotificationPayload` являются необязательными
- Можно использовать либо `message`, либо `description` для основного текста
- Поле `type` определяет стиль отображения уведомления

### Специфичные типы payload
- `AssignmentPayload` используется для уведомлений о передаче заданий
- `AnnouncementPayload` используется для объявлений от конкретных пользователей
- Специфичные payload автоматически генерируют `title` и `message` если они не указаны

### Действия (Actions)
- Поле `action` позволяет добавить интерактивность к уведомлениям
- Типы действий: `navigate`, `modal`, `external`
- Для навигации используйте `type: "navigate"` и `url`
- Дополнительные данные передаются через поле `data`

### Метаданные
- Поле `metadata` позволяет передать произвольные данные
- Используется для дополнительной логики на клиенте
- Не отображается пользователю напрямую

## Ответы

### Успешный ответ (201)

```json
{
  "notificationId": "123e4567-e89b-12d3-a456-426614174000"
}
```

### Ошибки

#### 400 Bad Request
```json
{
  "error": "Missing required fields"
}
```

#### 400 Bad Request (отсутствие пользователей)
```json
{
  "error": "No users to notify"
}
```

#### 400 Bad Request (тип сущности не найден)
```json
{
  "error": "Entity type not found"
}
```

#### 500 Internal Server Error
```json
{
  "error": "Could not create notification"
}
```

## Логика работы

1. **Валидация запроса**: Проверка обязательных полей
2. **Определение получателей**: 
   - Если указаны `userIds` - используются они
   - Если указаны `filters` - выполняется поиск пользователей в таблице `profiles`
   - Для фильтрации по городам используется связь `profiles.city_id = cities.id`
   - Для фильтрации по странам используется связь `profiles.city_id = cities.id` и `cities.country_id = countries.id`
3. **Поиск типа сущности**: Поиск в таблице `entity_types` по названию
4. **Создание уведомления**: Вставка записи в таблицу `notifications`
5. **Создание связей**: Вставка записей в таблицу `user_notifications` для каждого получателя
6. **Возврат результата**: ID созданного уведомления

## Используемые таблицы

- `entity_types` - типы сущностей
- `notifications` - уведомления
- `user_notifications` - связи пользователей с уведомлениями
- `profiles` - профили пользователей (для фильтрации)
- `cities` - города (для фильтрации по городам)
- `countries` - страны (для фильтрации по странам)

## Переменные окружения

- `NEXT_PUBLIC_SUPABASE_URL` - URL Supabase проекта
- `SERVICE_ROLE_KEY` - Ключ сервисной роли Supabase

## CORS

Эндпоинт настроен для работы с любыми источниками (`Access-Control-Allow-Origin: *`) и поддерживает методы POST и OPTIONS.

## Отладка

Функция включает подробное логирование:
- Входящие параметры
- Количество найденных пользователей
- Проверка конкретного тестового пользователя
- Результаты создания уведомлений

Для отладки используется тестовый пользователь с ID: `5f115156-6362-492f-b202-ac0da43b80d9` 