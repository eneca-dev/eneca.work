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