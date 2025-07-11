# Система уведомлений в реальном времени

## Обзор

Система уведомлений обеспечивает доставку и отображение уведомлений в реальном времени с использованием **Supabase Realtime** и автоматическое прочтение через **Intersection Observer API**.

## Архитектура

### Компоненты
- `NotificationsProvider` - Провайдер для инициализации системы
- `NotificationBell` - Иконка уведомлений с счетчиком
- `NotificationsPanel` - Панель со списком уведомлений
- `NotificationItem` - Элемент уведомления с автоматическим прочтением

### Store
- `useNotificationsStore` - Zustand store для управления состоянием
- `useNotifications` - Хук для удобного использования

## Функциональность

### Realtime подписка
```typescript
// Автоматическая подписка на новые уведомления
const subscription = supabase
  .channel('realtime:user_notifications')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public', 
    table: 'user_notifications',
    filter: `user_id=eq.${currentUserId}`
  }, handleNewNotification)
  .subscribe()
```

### Автоматическое прочтение
```typescript
// Intersection Observer для автоматического прочтения
const observer = new IntersectionObserver(
  ([entry]) => {
    if (entry.isIntersecting) {
      markAsReadInDB(notificationId)
    }
  },
  { threshold: 0.5 }
)
```

## Использование

### Инициализация
Провайдер автоматически подключается в `ClientProviders`:

```typescript
<NotificationsProvider>
  {children}
</NotificationsProvider>
```

### Компоненты
```typescript
import { NotificationBell } from '@/modules/notifications'

// Иконка уведомлений
<NotificationBell />
```

### Store
```typescript
import { useNotificationsStore } from '@/stores/useNotificationsStore'

const { notifications, unreadCount, markAsRead } = useNotificationsStore()
```

## API Edge Function

### Отправка уведомлений
```typescript
// POST /notifications
{
  "entityType": "task_assigned",
  "payload": {
    "title": "Новая задача",
    "message": "Вам назначена задача",
    "type": "info"
  },
  "userIds": ["user-id-1", "user-id-2"]
}
```

### Фильтрация получателей
```typescript
{
  "entityType": "announcement",
  "payload": { ... },
  "filters": {
    "departmentId": "dept-id",
    "roleId": "role-id"
  }
}
```

## Структура базы данных

### Таблицы
- `notifications` - Основные уведомления
- `user_notifications` - Связь уведомлений с пользователями
- `entity_types` - Типы сущностей

### Поля
```sql
-- notifications
id, entity_type_id, payload, rendered_text, created_at, updated_at

-- user_notifications  
id, notification_id, user_id, is_read, created_at

-- entity_types
id, entity_name
```

## Типы данных

### Notification (UI)
```typescript
interface Notification {
  id: string              // ID из user_notifications
  notificationId: string  // ID из notifications
  title: string
  message: string
  createdAt: Date
  isRead: boolean
  type?: 'info' | 'warning' | 'error' | 'success'
  payload?: Record<string, any>
  entityType?: string
}
```

### Payload
```typescript
interface NotificationPayload {
  title?: string
  message?: string
  description?: string
  type?: 'info' | 'warning' | 'error' | 'success'
  action?: {
    type: string
    url?: string
    data?: Record<string, any>
  }
  metadata?: Record<string, any>
}
```

## Особенности

### Ограничения
- **Отписка запрещена** - пользователи не могут отказаться от уведомлений
- **Автоматическое прочтение** - уведомления помечаются прочитанными при появлении на экране
- **Realtime обязателен** - система работает только с активной подпиской

### Оптимизация
- Intersection Observer отключается после первого срабатывания
- Realtime канал переиспользуется для всех уведомлений
- Данные кэшируются в Zustand store

## Debugging

### Логи
```typescript
console.log('Получено новое уведомление:', payload)
console.log('Уведомление стало видимым:', notificationId)
```

### Store DevTools
Используйте Redux DevTools для отладки состояния:
```typescript
// В браузере
window.__REDUX_DEVTOOLS_EXTENSION__
```

## Примеры использования

### Отправка уведомления
```typescript
// Через Edge Function
await fetch('/api/notifications', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    entityType: 'project_created',
    payload: {
      title: 'Проект создан',
      message: 'Новый проект "Веб-приложение" успешно создан',
      type: 'success'
    },
    userIds: ['user-1', 'user-2']
  })
})
```

### Ручное прочтение
```typescript
const { markAsRead } = useNotificationsStore()
markAsRead(userNotificationId)
```

### Загрузка уведомлений
```typescript
const { fetchNotifications } = useNotificationsStore()
await fetchNotifications()
``` 