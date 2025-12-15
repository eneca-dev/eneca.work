# Улучшения модуля планирования

## Цель

Улучшить UX модуля планирования (modules/planning):
1. **Визуальные улучшения отображения загрузок**: непрерывность полосок через выходные, минимальная высота, отображение комментариев
2. **Исправление проблемы с правами**: устранить сохранение прав и фильтров предыдущего пользователя при смене юзера

## Этапы реализации

### Этап 1: Непрерывное отображение загрузок через выходные

**Описание:**
- Полоски загрузки должны быть непрерывными от начала до конца (не прерываться на выходных)
- На выходных: полупрозрачная заливка + пунктирная граница (верх/низ)

**Затрагиваемые файлы:**
- `modules/planning/components/timeline/loading-bars-utils.ts` — функция `calculateBarRenders()`
- `modules/planning/components/timeline/department-row.tsx` — компонент `EmployeeRow` (рендер баров)

**Зависимости:** Нет

**Детали реализации:**
- Удалить разбиение на сегменты по рабочим дням в `calculateBarRenders()` (строки 375-398)
- Вместо `splitPeriodByWorkingDays()` создавать один непрерывный сегмент от `actualStartIdx` до `actualEndIdx`
- В рендере бара добавить проверку для каждой ячейки: если `timeUnit.isWorkingDay === false`, применить стили:
  - `opacity: 0.5` для полупрозрачности
  - `border-top: 2px dashed` и `border-bottom: 2px dashed` для пунктирных границ

---

### Этап 2: Увеличение минимальной высоты полоски загрузки

**Описание:**
- Минимальная высота должна гарантировать читаемость текста даже при ставке 0.1
- Высота полоски для других ставок пропорционально увеличивается

**Затрагиваемые файлы:**
- `modules/planning/components/timeline/department-row.tsx` — константа `BASE_BAR_HEIGHT` в `EmployeeRow`

**Зависимости:** Этап 1

**Детали реализации:**
- Текущее значение `BASE_BAR_HEIGHT = 56` (высота для ставки 1.0)
- Высота для ставки 0.1: `56 * 0.1 = 5.6px` — недостаточно для текста 8-10px
- **Новое значение:** `BASE_BAR_HEIGHT = 140` (для ставки 0.1 → 14px, достаточно для текста)
- Проверить, что все расчёты высоты строки (`actualRowHeight`) корректно работают с новым значением

**Тестирование:**
- Загрузка со ставкой 0.1 должна быть минимум 14px высотой
- Текст 8-10px должен читаться без обрезки

---

### Этап 3: Отображение комментария на полоске загрузки

**Описание:**
- Вывести комментарий на полоску загрузки (кусочек текста + полный текст при наведении)
- Комментарий увеличивает высоту полоски, что влияет на расчёт `actualRowHeight`

**Затрагиваемые файлы:**
- `modules/planning/types.ts` — интерфейс `Loading` (уже есть поле `comment?`)
- `modules/planning/components/timeline/loading-bars-utils.ts` — обновить `BarPeriod` для передачи `comment`
- `modules/planning/components/timeline/department-row.tsx` — рендер комментария в баре (строки 894-1117)

**Зависимости:** Этап 2

**Детали реализации:**

1. **Передача комментария в `BarPeriod`:**
   - В функции `loadingsToPeriods()` добавить `comment: loading.comment` в возвращаемый объект
   - Обновить интерфейс `BarPeriod` в `loading-bars-utils.ts`:
     ```typescript
     export interface BarPeriod {
       // ... существующие поля
       comment?: string
     }
     ```

2. **Расчёт высоты с комментарием:**
   - Если `bar.period.comment` существует, добавить к высоте бара дополнительную строку:
     ```typescript
     const hasComment = !!bar.period.comment
     const commentHeight = hasComment ? 16 : 0 // Высота одной строки комментария
     const barHeight = BASE_BAR_HEIGHT * (bar.period.rate || 1) + commentHeight
     ```
   - Обновить расчёт `actualRowHeight` с учётом `commentHeight`

3. **Рендер комментария:**
   - После основного содержимого бара добавить блок с комментарием:
     ```tsx
     {bar.period.comment && (
       <div
         className="absolute bottom-0 left-0 right-0 px-1 py-0.5"
         style={{ height: '16px' }}
         title={bar.period.comment} // Полный текст при наведении
       >
         <span className="text-[8px] text-white/80 truncate block">
           {bar.period.comment}
         </span>
       </div>
     )}
     ```

4. **Обновить tooltip:**
   - В `formatBarTooltip()` добавить строку с комментарием, если он есть:
     ```typescript
     if (period.comment) lines.push(`Комментарий: ${period.comment}`)
     ```

**Тестирование:**
- Загрузка с комментарием должна быть выше на 16px
- При наведении на комментарий показывается полный текст
- Без комментария высота бара не меняется

---

### Этап 4: Исправление проблемы с правами при смене пользователя ✅

**Статус:** ВЫПОЛНЕНО

**Описание:**
- При смене пользователя остаются права предыдущего юзера
- Фильтры настраиваются на основе старых прав
- Проблема: данные в Zustand сторах персистятся в `localStorage` и не очищаются при logout/смене пользователя

**Затрагиваемые файлы:**
- `stores/useUserStore.ts` — метод `clearUser()` / `setUser()` ✅
- `modules/planning/stores/usePlanningStore.ts` — очистка фильтров и состояния ✅
- `modules/permissions/store/usePermissionsStore.ts` — очистка прав ✅
- `modules/permissions/integration/userStoreSync.ts` — синхронизация при смене пользователя ✅
- `components/sidebar.tsx` — логика logout ✅

**Зависимости:** Нет (независимая задача)

**Детали реализации:**

#### 4.1. Анализ проблемы:

**Текущая ситуация:**
1. `useUserStore` использует `persist` middleware → данные сохраняются в `localStorage` с ключом `user-storage`
2. При logout вызывается `clearUser()`, который очищает только state в памяти
3. `usePlanningStore` также использует `persist` → фильтры сохраняются
4. При следующем login Zustand восстанавливает данные из `localStorage` **до** того, как новый пользователь установлен

**Корень проблемы:**
- Zustand `persist` middleware восстанавливает state из `localStorage` при инициализации стора
- `clearUser()` очищает только state в памяти, но не удаляет данные из `localStorage`
- При следующем входе старые данные загружаются обратно

#### 4.2. Решение:

**4.2.1. Очистка `localStorage` в `useUserStore.clearUser()`:**

В `stores/useUserStore.ts` обновить метод `clearUser()`:

```typescript
clearUser: () => {
  // Очищаем state
  set({
    id: null,
    email: null,
    name: null,
    profile: null,
    isAuthenticated: false
  })

  // ВАЖНО: Очищаем localStorage для предотвращения восстановления старых данных
  if (typeof window !== 'undefined') {
    localStorage.removeItem('user-storage')
  }
}
```

**4.2.2. Очистка прав в `usePermissionsStore`:**

Проверить, что в `modules/permissions/store/usePermissionsStore.ts` метод `clearPermissions()` также очищает `localStorage` (если используется persist).

**4.2.3. Очистка фильтров планирования:**

В `modules/planning/stores/usePlanningStore.ts` добавить метод `resetFiltersAndState()`:

```typescript
resetFiltersAndState: () => {
  set({
    syncState: {
      ...initialState.syncState,
      currentFilters: {
        subdivisionId: null,
        projectId: null,
        departmentId: null,
        teamId: null,
        managerId: null,
        employeeId: null,
        stageId: null,
        objectId: null,
      },
      lastAppliedFilters: null,
    },
    expandedDepartments: {},
    expandedTeams: {},
    expandedEmployees: {},
    sections: [],
    departments: [],
  })

  // Очистить localStorage если используется persist
  if (typeof window !== 'undefined') {
    localStorage.removeItem('planning-storage') // Проверить актуальное имя ключа
  }
}
```

**4.2.4. Интеграция очистки в `userStoreSync.ts`:**

В `modules/permissions/integration/userStoreSync.ts` обновить логику:

```typescript
useEffect(() => {
  const cleanup = () => {
    if (activeChannel) {
      activeChannel.unsubscribe()
      activeChannel = null
    }
    activeUserId = null
    ensuredRoleForUserId = null

    // НОВОЕ: Очистить права при выходе
    setPermissions([])
  }

  // На логауте или отсутствии userId — отписываемся и очищаем
  if (!isAuthenticated || !userId) {
    cleanup()
    return cleanup
  }

  // НОВОЕ: Если сменился пользователь — очистить фильтры планирования
  if (activeUserId && activeUserId !== userId) {
    // Вызвать reset фильтров планирования
    const { resetFiltersAndState } = usePlanningStore.getState()
    resetFiltersAndState?.()
  }

  // ... остальная логика
}, [isAuthenticated, userId, setPermissions, reloadPermissions])
```

**4.2.5. Убедиться в правильном порядке очистки при logout:**

В компоненте с кнопкой logout (например, `components/sidebar.tsx`):

```typescript
const handleLogout = async () => {
  try {
    // 1. Очистить store (это также очистит localStorage)
    useUserStore.getState().clearUser()

    // 2. Очистить права
    usePermissionsStore.getState().clearPermissions()

    // 3. Очистить фильтры планирования
    usePlanningStore.getState().resetFiltersAndState?.()

    // 4. Суpabase logout
    await supabase.auth.signOut()

    // 5. Редирект
    router.push('/auth/login')
  } catch (error) {
    console.error('Logout error:', error)
  }
}
```

**Дополнительное исправление (обнаружено при тестировании):**

Проблема: Существует отдельный `useFilterStore` (modules/planning/filters/store.ts) с persist в `'filter-store'`, который не очищался.

Решение: Добавлена очистка `localStorage.removeItem('filter-store')` в метод `resetFiltersAndState()` (строка 3054):

```typescript
// modules/planning/stores/usePlanningStore.ts
if (typeof window !== 'undefined') {
  localStorage.removeItem('planning-data-storage')
  localStorage.removeItem('planning-view-storage-v2')
  localStorage.removeItem('planning-columns-storage')
  localStorage.removeItem('workload-storage')
  localStorage.removeItem('filter-store') // ← ДОБАВЛЕНО
}
```

**Тестирование:**
1. Залогиниться как User A → установить фильтры планирования → выйти
2. Проверить localStorage → ключ `filter-store` должен быть удалён ✅
3. Залогиниться как User B → проверить что:
   - Фильтры сброшены ✅
   - Права соответствуют User B ✅
   - `localStorage` не содержит данных User A ✅
   - Данные отображаются без фильтров предыдущего пользователя ✅
4. Повторить для нескольких пользователей

---

## Критерии готовности

- [ ] Полоски загрузки непрерывны от начала до конца (включая выходные)
- [ ] На выходных: полупрозрачная заливка + пунктирная линия на границах (верх/низ)
- [ ] Минимальная высота полоски достаточна для отображения текста даже при ставке 0.1
- [ ] Комментарий отображается на полоске загрузки (частично, полностью - при наведении)
- [ ] Высота полоски с комментарием корректно увеличивается и влияет на расчёт высоты строки
- [ ] При смене пользователя корректно сбрасываются права предыдущего юзера
- [ ] Фильтры планирования настраиваются на основе актуальных прав текущего пользователя
- [ ] `localStorage` очищается при logout для всех сторов (user, permissions, planning)
- [ ] `npm run build` проходит успешно
- [ ] Ручное тестирование пройдено

## Порядок реализации

1. **Этапы 1-3** можно выполнять последовательно (визуальные улучшения)
2. **Этап 4** независимая задача, можно делать параллельно

**Рекомендуемый порядок:**
- Сначала **Этап 4** (критичная проблема с правами)
- Затем **Этапы 1-3** (визуальные улучшения)
__________________
Коммит 1: 3af83b1 — "белые полосы на выходные с пунктиром"
Затронутые файлы:
modules/planning/components/timeline/loading-bars-utils.ts
modules/planning/components/timeline/department-row.tsx
Изменения в loading-bars-utils.ts (строки 371-393)
Что было:
// Разбиваем на сегменты по рабочим дням
const segments = splitPeriodByWorkingDays(actualStartIdx, actualEndIdx, timeUnits)

// Создаем отдельный рендер для каждого сегмента
for (const segment of segments) {
  const left = (timeUnits[segment.startIdx]?.left ?? segment.startIdx * cellWidth) + HORIZONTAL_GAP / 2
  
  let width = 0
  for (let idx = segment.startIdx; idx <= segment.endIdx; idx++) {
    width += timeUnits[idx]?.width ?? cellWidth
  }
  width -= HORIZONTAL_GAP
  
  renders.push({
    period,
    startIdx: segment.startIdx,
    endIdx: segment.endIdx,
    left,
    width,
    layer,
    color,
  })
}
Что стало:
// Создаем один непрерывный бар от начала до конца (включая нерабочие дни)
const left = (timeUnits[actualStartIdx]?.left ?? actualStartIdx * cellWidth) + HORIZONTAL_GAP / 2

// Вычисляем ширину всего периода суммированием ширин всех ячеек
let width = 0
for (let idx = actualStartIdx; idx <= actualEndIdx; idx++) {
  width += timeUnits[idx]?.width ?? cellWidth
}
width -= HORIZONTAL_GAP

renders.push({
  period,
  startIdx: actualStartIdx,
  endIdx: actualEndIdx,
  left,
  width,
  layer,
  color,
})
Результат:
Убрано разбиение загрузки на отдельные сегменты по рабочим дням
Теперь создается один непрерывный бар от actualStartIdx до actualEndIdx, который охватывает весь период загрузки включая выходные дни
Изменения в department-row.tsx
1. Добавлен расчет позиций нерабочих дней (строки 894-931):
// Вычисляем позиции нерабочих дней внутри бара
const HORIZONTAL_GAP = 6
const nonWorkingDayRanges: Array<{ left: number; width: number }> = []
let currentRangeStart: number | null = null
let currentRangeWidth = 0

for (let cellIdx = bar.startIdx; cellIdx <= bar.endIdx; cellIdx++) {
  const unit = timeUnits[cellIdx]
  const isNonWorking = unit?.isWorkingDay === false

  if (isNonWorking) {
    if (currentRangeStart === null) {
      // Начинаем новый диапазон нерабочих дней
      // Вычитаем HORIZONTAL_GAP / 2 для выравнивания с вертикальной сеткой
      currentRangeStart = (unit.left ?? 0) - (timeUnits[bar.startIdx]?.left ?? 0) - HORIZONTAL_GAP / 2
    }
    currentRangeWidth += unit.width ?? 0
  } else {
    if (currentRangeStart !== null) {
      // Завершаем текущий диапазон
      // Уменьшаем ширину на 2px справа для отступа от правой границы
      nonWorkingDayRanges.push({
        left: currentRangeStart,
        width: currentRangeWidth - 2,
      })
      currentRangeStart = null
      currentRangeWidth = 0
    }
  }
}

// Завершаем последний диапазон если был
if (currentRangeStart !== null) {
  nonWorkingDayRanges.push({
    left: currentRangeStart,
    width: currentRangeWidth - 4,
  })
}
Логика:
Проходим по всем ячейкам от bar.startIdx до bar.endIdx
Группируем последовательные нерабочие дни в диапазоны { left, width }
Позиция left вычисляется относительно начала бара с учетом выравнивания по вертикальной сетке (вычитаем HORIZONTAL_GAP / 2)
Ширина уменьшается на 2-4px справа для визуального отступа
2. Добавлен position: relative к контейнеру бара (строка 941):
className={cn(
  "absolute rounded transition-all duration-200 pointer-events-auto",
  "flex items-center",
  "relative", // ← Добавлено для корректной работы absolute overlay
  bar.period.type === "loading" && "cursor-pointer hover:brightness-110"
)}
3. Добавлен рендер overlay для нерабочих дней (строки 969-983):
{/* Overlay для нерабочих дней (высветление + пунктирные границы) */}
{nonWorkingDayRanges.map((range, rangeIdx) => (
  <div
    key={`non-working-${rangeIdx}`}
    className="absolute pointer-events-none"
    style={{
      left: `${range.left}px`,
      width: `${range.width}px`,
      top: '-1px',
      bottom: '-1px',
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      borderTop: `3px dashed ${bar.color}`,
      borderBottom: `3px dashed ${bar.color}`,
    }}
  />
))}
Визуальный эффект:
Полупрозрачная белая заливка поверх бара на нерабочих днях (rgba(255, 255, 255, 0.2))
Пунктирные границы сверху и снизу толщиной 3px, цвет соответствует цвету бара
Overlay растянут на всю высоту бара (top: '-1px', bottom: '-1px')
pointer-events-none — клики проходят сквозь overlay на сам бар
Коммит 2: d2018c3 — "полоски на темной теме"
Затронутые файлы:
modules/planning/components/timeline/department-row.tsx
Изменения в department-row.tsx (строки 969, 979)
Что было:
{/* Overlay для нерабочих дней (высветление + пунктирные границы) */}
...
backgroundColor: 'rgba(255, 255, 255, 0.2)',
Что стало:
{/* Overlay для нерабочих дней (затемнение/высветление + пунктирные границы) */}
...
backgroundColor: theme === 'dark' ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.2)',
Результат:
В светлой теме overlay остался белым (высветление): rgba(255, 255, 255, 0.2)
В темной теме overlay стал черным (затемнение): rgba(0, 0, 0, 0.2)
Это обеспечивает визуальное различие нерабочих дней в обеих темах
Итоговый результат изменений
До:
Полоски загрузки разбивались на отдельные сегменты только для рабочих дней
На выходных/праздниках полоска прерывалась (были разрывы)
После:
Полоски загрузки непрерывные от начала до конца (один сплошной бар)
На нерабочих днях (выходные/праздники) применяется визуальное различие:
Полупрозрачная заливка (затемнение в темной теме, высветление в светлой)
Пунктирные границы сверху и снизу в цвет бара (толщина 3px)
Overlay точно выровнен с вертикальной сеткой таймлайна