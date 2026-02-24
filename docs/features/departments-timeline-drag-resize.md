# Drag-to-Resize для загрузок в departments-timeline

## Цель

Интегрировать функциональность изменения сроков загрузок (loadings) путем перетаскивания краев в модуль `departments-timeline`, переиспользуя существующую реализацию из модуля `resource-graph`.

## Контекст

В модуле `resource-graph` уже реализован полноценный механизм drag-to-resize:
- Хук `useTimelineResize` — управление drag-состоянием, snap-to-grid, preview
- Компонент `LoadingBars` — отображение loading bars с resize handles
- Паттерн: LoadingBars → useTimelineResize → onLoadingResize callback → mutation hook → server action

Необходимо адаптировать этот механизм под структуру данных `departments-timeline`:
- `Department → Team → Employee → Loading[]`
- Другие типы Loading (разные поля)
- Другая структура кеша (иерархическая)

## Этапы реализации

### Этап 1: Добавить Server Action для обновления дат

**Описание:**
Создать `updateLoadingDates` action в `modules/departments-timeline/actions/index.ts` для обновления `start_date` и `finish_date` в таблице `loadings`.

**Затрагиваемые файлы:**
- `modules/departments-timeline/actions/index.ts`

**Зависимости:**
- Нет (независимый этап)

**Детали реализации:**
```typescript
export async function updateLoadingDates(
  loadingId: string,
  startDate: string,
  finishDate: string
): Promise<ActionResult<{ loadingId: string; startDate: string; finishDate: string }>>
```

- Валидация: `loadingId`, `startDate`, `finishDate` обязательны
- Проверка: `startDate <= finishDate`
- Обновление через Supabase с RLS
- Возврат успешного результата с переданными данными

### Этап 2: Добавить Mutation Hook с оптимистичным обновлением

**Описание:**
Создать `useUpdateLoadingDates` mutation hook в `modules/departments-timeline/hooks/index.ts` через `createCacheMutation` с оптимистичным обновлением кеша.

**Затрагиваемые файлы:**
- `modules/departments-timeline/hooks/index.ts`

**Зависимости:**
- Этап 1 (нужен action `updateLoadingDates`)

**Детали реализации:**
```typescript
interface UpdateLoadingDatesInput {
  loadingId: string
  employeeId: string // для поиска в кеше
  startDate: string
  finishDate: string
}

export const useUpdateLoadingDates = createCacheMutation<
  UpdateLoadingDatesInput,
  { loadingId: string; startDate: string; finishDate: string }
>({
  mutationFn: ({ loadingId, startDate, finishDate }) =>
    updateLoadingDates(loadingId, startDate, finishDate),

  optimisticUpdate: {
    queryKey: queryKeys.departmentsTimeline.all,
    updater: (oldData, input) => {
      // Рекурсивно обновить loading в Department[] → Team[] → Employee[] → Loading[]
    },
  },
})
```

- Создать helper `updateLoadingDatesInEmployeeCache` для рекурсивного обновления
- Использовать `employeeId` для поиска нужного сотрудника в иерархии
- Обновить `loading.startDate` и `loading.endDate`

### Этап 3: Интегрировать LoadingBars в EmployeeRow

**Описание:**
Заменить существующий рендеринг loading bars в компоненте `EmployeeRow` на использование компонента `LoadingBars` из `resource-graph`.

**Затрагиваемые файлы:**
- `modules/departments-timeline/components/timeline/EmployeeRow.tsx`

**Зависимости:**
- Этап 2 (нужен hook `useUpdateLoadingDates`)

**Детали реализации:**

**3.1. Импорты:**
- Добавить `LoadingBars` из `@/modules/resource-graph/components/timeline/LoadingBars`
- Добавить `useUpdateLoadingDates` из `../../hooks`
- Импортировать типы `Loading as ResourceGraphLoading` из `@/modules/resource-graph/types`

**3.2. Type Conversion Helper:**
Создать функцию для конвертации типов:
```typescript
function convertToResourceGraphLoading(
  loading: Loading,
  employeeId: string
): ResourceGraphLoading {
  return {
    id: loading.id,
    stageId: loading.stageId,
    startDate: loading.startDate,
    finishDate: loading.endDate, // endDate → finishDate
    rate: loading.rate,
    comment: loading.comment || null,
    status: 'active',
    isShortage: false,
    employee: {
      id: loading.employeeId || employeeId,
      firstName: loading.responsibleName?.split(' ')[0] || null,
      lastName: loading.responsibleName?.split(' ').slice(1).join(' ') || null,
      name: loading.responsibleName || null,
      avatarUrl: loading.responsibleAvatarUrl || null,
    },
    // Дополнительные поля из departments-timeline Loading
    projectId: loading.projectId,
    projectName: loading.projectName,
    objectId: loading.objectId,
    objectName: loading.objectName,
    sectionId: loading.sectionId,
    sectionName: loading.sectionName,
    stageName: loading.stageName,
  }
}
```

**3.3. TimelineRange Helper:**
Создать функцию для расчета range из dayCells:
```typescript
function calculateTimelineRange(dayCells: DayCell[]): TimelineRange {
  if (dayCells.length === 0) {
    const today = new Date()
    return { start: today, end: today, totalDays: 0 }
  }

  return {
    start: dayCells[0].date,
    end: dayCells[dayCells.length - 1].date,
    totalDays: dayCells.length,
  }
}
```

**3.4. Resize Callback:**
Добавить в компонент:
```typescript
const updateLoadingDates = useUpdateLoadingDates()

const handleLoadingResize = useCallback(
  (loadingId: string, startDate: string, finishDate: string) => {
    updateLoadingDates.mutate({
      loadingId,
      employeeId: employee.id,
      startDate,
      finishDate,
    })
  },
  [employee.id, updateLoadingDates]
)
```

**3.5. Заменить рендеринг:**
- Преобразовать `employee.loadings` → `resourceGraphLoadings` через helper
- Вычислить `timelineRange` из `dayCells`
- Заменить существующий блок с loading bars на:
```tsx
<LoadingBars
  loadings={resourceGraphLoadings}
  range={timelineRange}
  timelineWidth={timelineWidth}
  onLoadingResize={handleLoadingResize}
/>
```

**3.6. Что оставить без изменений:**
- Sidebar с аватаром и именем сотрудника
- Background cells (фоновые ячейки дней)
- Логику расчета высоты строки (может потребоваться адаптация)
- Обработчик `handleCreateLoading` для кнопки добавления загрузки

### Этап 4: Проверка типов и совместимости

**Описание:**
Убедиться что типы совместимы, при необходимости добавить re-export или type guards.

**Затрагиваемые файлы:**
- `modules/departments-timeline/types/index.ts` (опционально)

**Зависимости:**
- Этап 3 (после интеграции станет ясно, что нужно)

**Детали реализации:**
- Проверить что все используемые поля из `resource-graph.Loading` доступны
- Если нужно, добавить `export type { TimelineRange } from '@/modules/resource-graph/types'`
- Убедиться что `LoadingBars` корректно работает с нашими данными

## Критерии готовности

### Функциональные требования
- [ ] Server action `updateLoadingDates` корректно обновляет даты в БД через RLS
- [ ] Mutation hook `useUpdateLoadingDates` выполняет оптимистичное обновление кеша
- [ ] LoadingBars отображается в EmployeeRow с корректными данными
- [ ] При наведении на края loading bar появляются resize handles
- [ ] Drag-to-resize работает с snap-to-grid (привязка к дням)
- [ ] Во время drag отображается preview с новыми датами
- [ ] После отпускания мыши вызывается mutation с новыми датами
- [ ] Optimistic update немедленно обновляет UI
- [ ] При успехе сервера изменения сохраняются
- [ ] При ошибке сервера происходит rollback к старым данным
- [ ] Клик на loading bar (не на handle) открывает модалку редактирования
- [ ] Кнопка создания новой загрузки продолжает работать

### Технические требования
- [ ] `npm run build` проходит без ошибок
- [ ] `npm run lint` проходит без ошибок
- [ ] Нет TypeScript ошибок
- [ ] Нет console warnings в браузере
- [ ] Использованы существующие паттерны проекта
- [ ] Нет дублирования кода
- [ ] Следование cache module patterns

### Тестирование
- [ ] Ручное тестирование: drag левого края loading
- [ ] Ручное тестирование: drag правого края loading
- [ ] Ручное тестирование: drag с выходом за границы timeline
- [ ] Ручное тестирование: drag на 1 день (минимум)
- [ ] Ручное тестирование: клик на bar открывает модалку
- [ ] Ручное тестирование: создание новой загрузки работает
- [ ] Проверка что высота строки корректна при перекрытии loadings
- [ ] Проверка что non-working days overlay отображается корректно

## Потенциальные проблемы и решения

### Проблема 1: Разные структуры Loading типов
**Решение:** Type conversion helper `convertToResourceGraphLoading`

### Проблема 2: TimelineRange vs DayCell[]
**Решение:** Helper `calculateTimelineRange` для вычисления из dayCells

### Проблема 3: Оптимистичное обновление в иерархической структуре
**Решение:** Рекурсивный updater `updateLoadingDatesInEmployeeCache` с иммутабельными обновлениями

### Проблема 4: Высота строки может измениться
**Решение:** Использовать `calculateLoadingsRowHeight` из resource-graph или адаптировать существующую логику

### Проблема 5: Конфликт событий click и drag
**Решение:** LoadingBars уже реализует `wasRecentlyDragging` flag для предотвращения клика после drag

### Проблема 6: Разные query keys для кеша
**Решение:** Использовать `queryKeys.departmentsTimeline.all` для инвалидации всего дерева

## Примечания

- Сохранить существующую кастомную визуализацию (цвета, иконки, комментарии)
- LoadingBars должен интегрироваться без ломки текущего UI
- Убедиться что существующие handlers (`handleLoadingClick`, `handleCreateLoading`) продолжают работать
- Проверить что permissions корректно применяются (только владельцы команд могут редактировать)
