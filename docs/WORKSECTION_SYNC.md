# Синхронизация с Worksection в основном приложении

## Описание

В основное приложение eneca.work добавлена функциональность синхронизации с Worksection через интеграционный сервис ws-to-work-integration.

## Компоненты

### 1. Хук `useWorksectionSync`

**Расположение:** `hooks/useWorksectionSync.ts`

Переиспользуемый хук для выполнения синхронизации с Worksection.

```typescript
const { isSyncing, syncStatus, syncWithWorksection } = useWorksectionSync()
```

**Возвращает:**
- `isSyncing: boolean` - статус выполнения синхронизации
- `syncStatus: 'idle' | 'success' | 'error'` - результат синхронизации
- `syncWithWorksection: () => Promise<SyncResult | null>` - функция запуска синхронизации

### 2. Компонент `SyncButton`

**Расположение:** `components/ui/sync-button.tsx`

Переиспользуемая кнопка синхронизации с различными вариантами отображения.

```typescript
<SyncButton 
  size="md"
  theme="light"
  variant="default"
  showText={true}
  onSyncComplete={() => console.log('Синхронизация завершена')}
/>
```

**Пропсы:**
- `size?: 'sm' | 'md' | 'lg'` - размер кнопки
- `variant?: 'default' | 'outline' | 'ghost'` - вариант стиля
- `showText?: boolean` - показывать ли текст
- `onSyncComplete?: () => void` - колбэк после успешной синхронизации
- `theme?: 'light' | 'dark'` - тема оформления

## Интеграция в модулях

### Модуль Projects

Кнопка синхронизации добавлена в заголовок фильтров (`modules/projects/filters/ProjectsFilters.tsx`):

```typescript
<SyncButton 
  size="md"
  theme={theme}
  showText={true}
/>
```

## Функциональность

### Процесс синхронизации

1. **Запуск**: Пользователь нажимает кнопку "Синхронизировать с Worksection"
2. **Выполнение**: Отправляется POST-запрос на `https://ws-to-work-integration-eneca-7cab192e5438.herokuapp.com/api/sync/full`
3. **Обратная связь**: 
   - Во время синхронизации: анимация загрузки, кнопка заблокирована
   - При успехе: зеленый цвет кнопки, диалог с результатами
   - При ошибке: красный цвет кнопки, диалог с описанием ошибки

### Обработка результатов

При успешной синхронизации показывается диалог с детальной статистикой:
- Количество созданных записей
- Количество обновленных записей  
- Количество ошибок
- Время выполнения
- Предложение обновить страницу

### Обработка ошибок

При ошибках показывается диалог с:
- Описанием ошибки
- Рекомендациями по устранению
- Проверкой состояния сервиса ws-to-work-integration

## Требования

1. **Сервис ws-to-work-integration** должен быть доступен на Heroku
2. **Настройки API Worksection** должны быть корректно сконфигурированы
3. **Подключение к интернету** для доступа к API Worksection

## Использование в других модулях

Для добавления синхронизации в другие модули:

1. Импортировать компонент:
```typescript
import { SyncButton } from '@/components/ui/sync-button'
```

2. Добавить в нужное место:
```typescript
<SyncButton 
  size="sm"
  variant="outline"
  theme={theme}
/>
```

## Мониторинг

- Все операции синхронизации логируются в консоль браузера
- Детальные логи доступны в веб-интерфейсе ws-to-work-integration на Heroku
- Статистика операций отображается в диалогах результатов 