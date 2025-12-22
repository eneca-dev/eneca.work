# Реализация Drag and Drop в Kanban Board

## Обзор

В этом проекте используется **нативный HTML5 Drag and Drop API** вместо библиотек типа dnd-kit. Это обеспечивает плавные переходы без "отката" карточек.

## Почему происходит "откат" при использовании dnd-kit?

### Проблема с optimistic updates

Когда вы используете dnd-kit и видите откат карточки:

```
Перетаскивание → Карточка в новом месте → Откат на старое место (< 1 сек) → Появление в новом месте
```

Это происходит из-за неправильной последовательности обновления состояния:

1. **dnd-kit сначала показывает карточку в новом месте** (optimistic update через transform/translate)
2. **Ваш обработчик onDragEnd вызывается** и начинает обновлять состояние
3. **React перерисовывает компонент** на основе старого состояния (карточка возвращается)
4. **Состояние обновляется** и React снова перерисовывает (карточка появляется в новом месте)

### Почему в нашей реализации нет отката?

## Архитектура нашего решения

### 1. Использование нативного HTML5 API

Вместо dnd-kit мы используем нативные события:
- `onDragStart` - начало перетаскивания
- `onDragOver` - движение над целевой областью
- `onDrop` - отпускание карточки

### 2. Мгновенное синхронное обновление состояния

**Ключевое отличие:** Мы обновляем состояние **синхронно** в обработчике `handleDrop`:

```typescript
const handleDrop = (targetColumnId: string, taskIndex: number, swimlane: string, e: React.DragEvent) => {
  e.preventDefault()
  
  // 1. Валидация
  if (draggedTask && draggedTask.swimlane !== swimlane) {
    // Показываем ошибку и выходим
    return
  }

  // 2. НЕМЕДЛЕННОЕ обновление состояния (синхронно)
  const newColumns = columns
    .map((column) => {
      // Удаляем из исходной колонки
      if (column.id === sourceColumnId) {
        return {
          ...column,
          tasks: column.tasks.filter((t) => t.id !== taskId),
        }
      }
      return column
    })
    .map((column) => {
      // Добавляем в целевую колонку
      if (column.id === targetColumnId) {
        const updatedTask = { ...task, status: targetColumn.title }
        // ... логика вставки в правильную позицию ...
        return {
          ...column,
          tasks: rebuiltTasks,
        }
      }
      return column
    })

  // 3. Устанавливаем новое состояние СРАЗУ
  setColumns(newColumns)
  
  // 4. Очищаем состояние перетаскивания
  setDraggedTask(null)
}
```

### 3. Визуальная обратная связь через draggedTask

Мы храним состояние перетаскиваемой карточки:

```typescript
const [draggedTask, setDraggedTask] = useState<{
  taskId: string
  sourceColumnId: string
  swimlane: string
} | null>(null)
```

Это позволяет:
- Скрыть оригинальную карточку во время перетаскивания
- Показать placeholder или preview
- Предотвратить визуальные конфликты

## Пошаговый процесс переноса карточки

### Шаг 1: Начало перетаскивания (handleDragStart)

```typescript
const handleDragStart = (taskId: string, sourceColumnId: string, swimlane: string, e: React.DragEvent) => {
  // Сохраняем информацию о перетаскиваемой карточке
  setDraggedTask({ taskId, sourceColumnId, swimlane })
  
  // Настраиваем нативное drag событие
  e.dataTransfer.effectAllowed = "move"
  e.dataTransfer.setData("taskSource", JSON.stringify({...}))
}
```

**Результат:** Карточка начинает перетаскиваться, состояние `draggedTask` установлено.

### Шаг 2: Движение над целевой областью (handleDragOver)

```typescript
const handleDragOver = (columnId: string, taskIndex: number, swimlane: string, e: React.DragEvent) => {
  e.preventDefault() // ОБЯЗАТЕЛЬНО! Иначе drop не сработает
  
  // Проверяем, можно ли сюда переместить
  if (draggedTask && draggedTask.swimlane !== swimlane) {
    e.dataTransfer.dropEffect = "none" // Показываем "запрещено"
    return
  }
  
  e.dataTransfer.dropEffect = "move" // Показываем "разрешено"
}
```

**Результат:** Курсор меняется на "move" или "not-allowed".

### Шаг 3: Отпускание карточки (handleDrop)

```typescript
const handleDrop = (targetColumnId: string, taskIndex: number, swimlane: string, e: React.DragEvent) => {
  e.preventDefault()
  
  // Извлекаем данные о перетаскиваемой карточке
  const { taskId, sourceColumnId } = draggedTask
  
  // КРИТИЧНО: Создаем НОВЫЙ массив колонок с обновленными данными
  const newColumns = columns.map(...)
  
  // МГНОВЕННО обновляем состояние
  setColumns(newColumns)
  
  // Очищаем draggedTask
  setDraggedTask(null)
}
```

**Результат:** 
- Карточка **моментально** исчезает из старой колонки
- Карточка **моментально** появляется в новой колонке
- Никакого "отката" нет

## Почему это работает без отката?

### 1. Нативный API не делает optimistic updates

HTML5 Drag and Drop не перемещает DOM элементы автоматически. Браузер просто:
- Показывает ghost image карточки при перетаскивании
- Вызывает события dragover, drop
- **НЕ меняет DOM** до тех пор, пока вы сами не обновите состояние

### 2. Синхронное обновление состояния

`setColumns(newColumns)` вызывается синхронно в обработчике `onDrop`. React:
- Получает новое состояние
- Планирует перерисовку
- Перерисовывает компонент **один раз** с уже обновленным состоянием

Не происходит промежуточной перерисовки со старым состоянием.

### 3. Иммутабельные обновления

Мы создаем **новый массив** колонок:

```typescript
const newColumns = columns.map(...).map(...)
```

Это гарантирует, что React правильно обнаружит изменения и выполнит один чистый ре-рендер.

## Как исправить проблему с dnd-kit

Если вы используете dnd-kit и видите откат, вот решения:

### Решение 1: Используйте состояние activeId правильно

```typescript
const [activeId, setActiveId] = useState(null)

function handleDragEnd(event) {
  const { active, over } = event
  
  if (!over) {
    setActiveId(null)
    return
  }
  
  // КРИТИЧНО: Сначала обновляем данные
  setItems((items) => {
    const oldIndex = items.findIndex((item) => item.id === active.id)
    const newIndex = items.findIndex((item) => item.id === over.id)
    
    return arrayMove(items, oldIndex, newIndex)
  })
  
  // Потом очищаем activeId
  setActiveId(null)
}
```

### Решение 2: Используйте layoutEffect для синхронного обновления

```typescript
useLayoutEffect(() => {
  if (activeId === null && items !== prevItems) {
    // Обновление произошло, можно снять блокировку UI
  }
}, [activeId, items])
```

### Решение 3: Отключите анимацию в dnd-kit во время перехода

```typescript
<DndContext
  onDragEnd={handleDragEnd}
  modifiers={[/* ... */]}
>
  <SortableContext 
    items={items}
    strategy={verticalListSortingStrategy}
  >
    {items.map((item) => (
      <SortableItem 
        key={item.id} 
        id={item.id}
        transition={null} // Отключаем transition
      />
    ))}
  </SortableContext>
</DndContext>
```

### Решение 4: Используйте нативный HTML5 API (как у нас)

Самое простое решение - отказаться от dnd-kit в пользу нативного API:

```typescript
// Вместо <DndContext> и <Draggable>
<div
  draggable
  onDragStart={(e) => handleDragStart(item.id, e)}
  onDragOver={(e) => handleDragOver(e)}
  onDrop={(e) => handleDrop(columnId, e)}
>
  {/* Контент карточки */}
</div>
```

## Сравнение подходов

| Аспект | Нативный HTML5 API (наш) | dnd-kit |
|--------|--------------------------|---------|
| **Размер бандла** | 0 KB (встроен в браузер) | ~20-30 KB |
| **Сложность настройки** | Низкая | Средняя-высокая |
| **Optimistic updates** | Не нужны | Встроены (могут вызвать откат) |
| **Кастомизация анимаций** | Ограничена | Полная |
| **Touch/Mobile поддержка** | Требует полифиллов | Встроена |
| **Accessibility** | Требует ручной настройки | Встроена |
| **Производительность** | Отличная | Хорошая |

## Код компонентов

### TaskCard с нативным DnD

```typescript
<div
  draggable
  onDragStart={(e) => onDragStart(task.id, column.id, task.swimlane || '', e)}
  className="cursor-move"
>
  {/* Контент карточки */}
</div>
```

### Column (drop zone)

```typescript
<div
  onDragOver={(e) => onDragOver(column.id, index, swimlane, e)}
  onDrop={(e) => onDrop(column.id, index, swimlane, e)}
>
  {tasks.map((task, index) => (
    <TaskCard key={task.id} task={task} />
  ))}
</div>
```

## Рекомендации

1. **Для простых канбан-досок:** Используйте нативный HTML5 API
2. **Для сложных сценариев (multi-drag, nested lists):** Используйте dnd-kit с правильной настройкой
3. **Всегда обновляйте состояние синхронно** в обработчике drop/dragEnd
4. **Создавайте новые массивы/объекты** при обновлении состояния (иммутабельность)
5. **Очищайте состояние перетаскивания** после завершения операции

## Заключение

Наша реализация использует нативный HTML5 Drag and Drop API с синхронным обновлением состояния, что полностью устраняет проблему "отката" карточек. Ключ к успеху - это мгновенное обновление состояния в обработчике `onDrop` без промежуточных состояний или асинхронных операций.
