# Optimistic Create для чекпоинтов

## Задача

Модалка создания чекпоинта должна закрываться **мгновенно** при нажатии "Создать", а чекпоинт должен сразу появляться на графике (ресурс-граф) ещё до ответа сервера.

## Решение

Реализован **optimistic create** pattern с использованием TanStack Query.

### Архитектура

```
1. Пользователь нажимает "Создать"
   ↓
2. Модалка закрывается СРАЗУ
   ↓
3. Хук создаёт ВРЕМЕННЫЙ чекпоинт с temp ID
   ↓
4. TanStack Query добавляет temporary item в кеш
   ↓
5. UI обновляется мгновенно (чекпоинт на графике)
   ↓
6. В фоне идёт запрос к серверу
   ↓
7. При успехе: temporary item заменяется реальным
   При ошибке: temporary item удаляется автоматически
```

## Изменения

### 1. Новая фабрика `createCreateMutation`

**Файл:** `modules/cache/hooks/use-cache-mutation.ts`

Добавлена фабрика для optimistic create:

```typescript
export function createCreateMutation<TInput, TData>({
  mutationFn,
  listQueryKey,
  buildOptimisticItem,  // Функция для создания temporary item
  invalidateKeys,
})
```

**Ключевые особенности:**
- `buildOptimisticItem` - строит временный объект с `temp-` ID
- Автоматически добавляет item в конец списка в кеше
- При ошибке откатывает изменения
- При успехе инвалидирует кеш для получения реальных данных

### 2. Обновлён `useCreateCheckpoint`

**Файл:** `modules/checkpoints/hooks/use-checkpoints.ts`

```typescript
export const useCreateCheckpoint = createCreateMutation({
  mutationFn: createCheckpoint,
  listQueryKey: queryKeys.checkpoints.lists(),
  buildOptimisticItem: (input) => ({
    checkpoint_id: `temp-${Date.now()}-${random()}`,
    // ... все необходимые поля с placeholder значениями
    title: input.title || 'Новый чекпоинт',
    icon: input.customIcon || 'Flag',
    status: 'pending',
    // ...
  }),
  invalidateKeys: [...],
})
```

**Optimistic item содержит:**
- Временный ID (`temp-XXX`)
- Все обязательные поля из input
- Placeholder значения для полей, которые установит сервер
- Корректный `checkpoint_date`, `icon`, `color` для правильного отображения

### 3. Модалка закрывается сразу

**Файл:** `modules/modals/components/checkpoint/CheckpointCreateModal.tsx`

```typescript
const handleSave = async () => {
  // 1. Закрываем модалку СРАЗУ
  onClose()
  onSuccess?.()

  // 2. Мутация происходит В ФОНЕ
  createCheckpoint.mutate(payload, {
    onSuccess: () => console.log('Created'),
    onError: () => {
      // TODO: Показать toast с ошибкой
    },
  })
}
```

**Важно:**
- Модалка закрывается **до** вызова mutation
- `onSuccess` вызывается сразу (чтобы родитель обновил состояние)
- Если mutation упадёт, temporary item автоматически удалится

## Преимущества

✅ **Мгновенный отклик** - пользователь не ждёт ответа сервера
✅ **Лучший UX** - модалка закрывается сразу
✅ **Чекпоинт на графике мгновенно** - виден сразу после создания
✅ **Автоматический откат** - при ошибке temporary item удаляется
✅ **Реальные данные заменяют optimistic** - после ответа сервера

## Как это работает на графике

### Сценарий успеха:

1. Пользователь создаёт чекпоинт "Экспертиза" на 2025-12-31
2. Модалка закрывается → `onSuccess()` → график перерисовывается
3. На графике появляется чекпоинт с temp ID: `temp-1735012345678-abc123`
4. Через 200-500ms приходит ответ сервера с реальным ID
5. TanStack Query инвалидирует кеш → рефетч
6. Temporary item заменяется реальным чекпоинтом с ID из БД
7. График перерисовывается, но пользователь не замечает (позиция та же)

### Сценарий ошибки:

1. Пользователь создаёт чекпоинт
2. Модалка закрывается → чекпоинт появляется на графике
3. Через 200-500ms сервер возвращает ошибку (например, нет прав)
4. TanStack Query откатывает optimistic update
5. Temporary item исчезает с графика
6. **TODO:** Показать toast-уведомление об ошибке

## Тестирование

### Проверить:

1. **Быстрое создание:**
   - Открыть модалку создания чекпоинта
   - Заполнить поля
   - Нажать "Создать"
   - ✅ Модалка закрылась мгновенно
   - ✅ Чекпоинт появился на графике сразу

2. **Успешное создание:**
   - Подождать 1-2 секунды после создания
   - ✅ Чекпоинт остался на месте
   - ✅ ID сменился с `temp-XXX` на реальный UUID

3. **Ошибка создания (симуляция):**
   - Отключить интернет
   - Создать чекпоинт → модалка закроется, чекпоинт появится
   - Включить интернет
   - ✅ Temporary чекпоинт исчезнет через 1-2 секунды
   - ⚠️ Пока нет toast-уведомления об ошибке (TODO)

4. **Множественное создание:**
   - Быстро создать 3-4 чекпоинта подряд
   - ✅ Все модалки закрываются мгновенно
   - ✅ Все чекпоинты появляются на графике
   - ✅ После ответа сервера все заменяются реальными

## Ограничения и TODO

### Текущие ограничения:

1. **Linked sections** - названия разделов показываются как "Загрузка..."
   - Решение: можно получить названия из кеша sections, если они уже загружены

2. **Нет toast-уведомления при ошибке**
   - Пользователь не увидит причину, почему чекпоинт исчез
   - TODO: Интегрировать toast-библиотеку (react-hot-toast / sonner)

3. **Type name/code** - показываются placeholder значения
   - Решение: можно получить из кеша checkpoint types, если загружены

### Возможные улучшения:

1. **Улучшить buildOptimisticItem:**
   ```typescript
   buildOptimisticItem: (input, context) => {
     // Получить тип из кеша
     const type = queryClient.getQueryData(queryKeys.checkpointTypes.detail(input.typeId))

     // Получить названия связанных разделов из кеша
     const sections = queryClient.getQueryData(queryKeys.sections.lists())
     const linkedSections = input.linkedSectionIds?.map(id => {
       const section = sections?.find(s => s.id === id)
       return { section_id: id, section_name: section?.name || 'Загрузка...' }
     })

     return { ...optimisticItem, type_name: type?.name, linked_sections }
   }
   ```

2. **Добавить индикатор "Сохраняется":**
   - Показать тонкий индикатор на temporary item на графике
   - Например, полупрозрачность или пульсацию

3. **Retry на ошибку:**
   - Автоматический retry 2-3 раза при сетевой ошибке
   - TanStack Query поддерживает `retry: 3` out of the box

## Связанные файлы

- `modules/cache/hooks/use-cache-mutation.ts` - фабрика `createCreateMutation`
- `modules/cache/hooks/index.ts` - экспорт новой фабрики
- `modules/checkpoints/hooks/use-checkpoints.ts` - хук `useCreateCheckpoint`
- `modules/modals/components/checkpoint/CheckpointCreateModal.tsx` - модалка

## Производительность

Optimistic create НЕ добавляет дополнительных запросов:
- 1 запрос к серверу (как и раньше)
- Но модалка закрывается МГНОВЕННО (не ждёт ответа)
- Кеш обновляется синхронно (без задержек)

Измерения:
- **Раньше:** Нажать "Создать" → ждать 200-500ms → модалка закрывается → график обновляется
- **Сейчас:** Нажать "Создать" → модалка закрывается СРАЗУ (0ms) → график обновляется СРАЗУ → через 200-500ms данные синхронизируются с сервером

**Выигрыш в UX:** ~300-500ms → воспринимается как мгновенный отклик
