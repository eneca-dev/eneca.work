# Checkpoints Module Review — 23 декабря 2025

**Дата ревью:** 2025-12-23
**Модуль:** `modules/checkpoints` + `modules/modals/components/checkpoint`
**Агенты:** Cache Guardian, Clean Code Guardian
**Статус:** ⚠️ Требуются исправления

---

## Executive Summary

Модуль checkpoints в целом следует архитектуре проекта и правильно использует систему кеширования `modules/cache`. Однако обнаружено **2 критические ошибки** в архитектуре кеширования и **значительное дублирование кода** (~600 строк) между модальными окнами.

### Оценка по категориям

| Категория | Оценка | Комментарий |
|-----------|--------|-------------|
| Cache Architecture | 🔴 Critical Issues | 2 нарушения архитектуры |
| Code Quality | 🟡 Warnings | Дублирование кода, размер компонентов |
| TypeScript | 🟡 Warnings | Дублирование типов |
| Structure | 🟢 Approved | Модульная структура соблюдена |
| Documentation | 🟢 Approved | Хорошее покрытие JSDoc |

---

## ⚡ Краткое резюме исправлений

### Что нужно исправить (High Priority):

**1. CheckpointEditModal — убрать прямой импорт useQueryClient**
- **Проблема:** Компонент напрямую манипулирует кешем через `queryClient.setQueryData`
- **Визуально:** Description перестанет auto-sync при вводе, будет сохраняться только по кнопке
- **Зачем:** Архитектурное нарушение, конфликты с автоматической инвалидацией
- **Время:** ~15 минут (удалить 20 строк кода)

**2. CheckpointCreateModal — заменить useEffect на хук**
- **Проблема:** Data fetching в useEffect вместо использования cache модуля
- **Визуально:** Модалка будет открываться мгновенно (данные из кеша), меньше loading spinners
- **Зачем:** Anti-pattern, нет кеширования, ручное управление состоянием, race conditions
- **Время:** ~30 минут (создать хук + рефакторинг компонента)

### Результат после исправлений:
- ✅ Полное соответствие архитектуре `modules/cache`
- ✅ Лучшая производительность (кеширование, instant updates)
- ✅ Меньше технического долга
- ✅ Проще поддерживать и тестировать

---

## 🔴 КРИТИЧЕСКИЕ ОШИБКИ (Must Fix)

### 1. Прямой импорт `useQueryClient` в CheckpointEditModal

**Файл:** `modules/modals/components/checkpoint/CheckpointEditModal.tsx`
**Строки:** 18, 259, 317-336

**Проблема:**
```typescript
import { useQueryClient } from '@tanstack/react-query'

// ...
const queryClient = useQueryClient()
queryClient.setQueryData<Checkpoint>(
  queryKeys.checkpoints.detail(checkpointId),
  { ...currentCached, description: debouncedDescription }
)
```

**Нарушение:** Прямое использование `@tanstack/react-query` в компонентах ЗАПРЕЩЕНО согласно архитектуре `modules/cache`.

**Почему это критично:**
1. **Архитектурное нарушение:** Обход централизованной системы кеширования ведет к непредсказуемому поведению
2. **Потеря контроля:** Manual cache updates могут конфликтовать с автоматической инвалидацией
3. **Технический долг:** Усложняет будущую миграцию и поддержку кеш-системы
4. **Нарушение Single Responsibility:** Компонент не должен управлять кешем напрямую

**Визуальные изменения после исправления:**
- **ДО:** Description автоматически синхронизируется с кешем при вводе (с debounce 500ms)
- **ПОСЛЕ:** Description сохраняется только при клике на кнопку "Сохранить"
- **Влияние на UX:** Минимальное - пользователь привык сохранять через кнопку
- **Альтернатива:** Можно добавить локальный preview без синхронизации с глобальным кешем

**Решение:**
Удалить импорт `useQueryClient` и useEffect (строки 18, 259, 317-336). Description будет сохраняться через `useUpdateCheckpoint` при нажатии "Сохранить". Если нужна live preview — использовать контекст или dedicated hook из cache модуля.

---

### 2. Data Fetching в useEffect (Anti-Pattern)

**Файл:** `modules/modals/components/checkpoint/CheckpointCreateModal.tsx`
**Строки:** 417-468

**Проблема:**
```typescript
useEffect(() => {
  async function loadSections() {
    if (!isOpen) return
    setSectionsLoading(true)
    try {
      const result = await getProjectStructure()
      // ... processing data
    } catch (error) {
      console.error('[CheckpointCreateModal] Error loading sections:', error)
    } finally {
      setSectionsLoading(false)
    }
  }
  loadSections()
}, [isOpen, sectionId])
```

**Нарушение:** Компоненты НЕ должны использовать `useEffect` для загрузки данных. Вместо этого должны использоваться хуки из cache модуля.

**Почему это критично:**
1. **Anti-pattern:** useEffect для data fetching — устаревший паттерн, который React Query решает из коробки
2. **Нет кеширования:** Данные загружаются каждый раз при открытии модалки
3. **Ручное управление состоянием:** Loading/error states управляются вручную (дублирование логики)
4. **Race conditions:** Возможны проблемы при быстром открытии/закрытии модалки
5. **Нет автоматической инвалидации:** Устаревшие данные не обновляются автоматически

**Визуальные изменения после исправления:**
- **ДО:**
  - Данные загружаются каждый раз при открытии модалки
  - Пользователь видит loading spinner при каждом открытии
  - Нет кеширования между открытиями
- **ПОСЛЕ:**
  - Данные загружаются один раз и кешируются на 3 минуты (staleTime: 'medium')
  - При повторном открытии модалки данные появляются мгновенно из кеша
  - Background refetch обновляет данные, если они устарели
  - Лучший UX благодаря instant updates
- **Влияние на производительность:**
  - Меньше запросов к БД
  - Быстрее открытие модалки (instant из кеша)

**Решение:**
Создать хук с использованием `createCacheQuery`:

```typescript
// В modules/checkpoints/hooks/use-project-structure.ts
export const useProjectStructure = createCacheQuery({
  queryKey: () => queryKeys.projects.structure(),
  queryFn: getProjectStructure,
  staleTime: 'medium', // 3 минуты кеширования
})

// В компоненте:
const { data: projectStructure, isLoading: structureLoading } = useProjectStructure()
```

Затем обработать `projectStructure` в `useMemo` вместо `useEffect`.

---

## 🟡 ПРЕДУПРЕЖДЕНИЯ (Рекомендации)

### 1. Дублирование кода между модалками (~70%)

**Файлы:**
- `CheckpointCreateModal.tsx` (955 строк)
- `CheckpointEditModal.tsx` (955 строк)

**Проблема:** Примерно **600 строк кода дублируются** между двумя модальными окнами:

| Компонент | Create Modal | Edit Modal | Дублирование |
|-----------|-------------|------------|--------------|
| `SectionMultiSelect` | Строки 217-377 | Строки 72-232 | 100% |
| `PRESET_COLORS` | Строки 36-47 | Строки 38-49 | 100% |
| `CHECKPOINT_ICONS` | Строки 50-64 | Строки 52-66 | 100% |
| Выбор типа чекпоинта | ~150 строк | ~150 строк | 95% |
| Форма полей | ~200 строк | ~200 строк | 80% |

**Рекомендация:**
Создать shared компоненты в `modules/checkpoints/components/modals/shared/`:
- `IconPicker.tsx`
- `ColorPicker.tsx`
- `SectionMultiSelect.tsx`
- `CheckpointTypeSelector.tsx`

**Потенциальная экономия:** ~600 строк кода (~40% сокращение).

---

### 2. Дублирование определений типов

**Файлы:**
- `modules/checkpoints/actions/checkpoints.ts` (строки 49-72)
- `modules/checkpoints/types/index.ts`

**Проблема:** Интерфейс `Checkpoint` определён в двух местах с небольшими различиями:

```typescript
// actions/checkpoints.ts
linked_sections: Array<{ section_id: string; section_name: string }>

// types/index.ts
linked_sections: LinkedSection[]  // включает section_code
```

**Рекомендация:**
Удалить определение `Checkpoint` из `actions/checkpoints.ts` и импортировать из `types/`:

```typescript
// actions/checkpoints.ts
import type { Checkpoint, AuditEntry } from '../types'
```

---

### 3. Размер компонентов

**Файл:** `modules/checkpoints/components/CheckpointMarker.tsx` (~657 строк)

**Проблема:** Компонент превышает рекомендуемый размер (~150 строк) и содержит:
- Константы (строки 89-198) → можно в `constants.ts`
- Icon mapping (строки 103-198) → можно в `utils/icon-map.ts`
- Types (строки 210-243) → должны быть в `types/`
- Helper function `getLucideIcon` → можно в `utils/`

**Рекомендация:**
Создать структуру:
```
modules/checkpoints/
  utils/
    checkpoint-icons.ts    # Icon mapping и CHECKPOINT_ICONS
    date-utils.ts          # formatDateLocal
    status-utils.ts        # calculateCheckpointStatus, STATUS_COLORS
  constants/
    checkpoint-constants.ts # OVERLAP_OFFSET, MARKER_RADIUS
```

---

### 4. DEBUG флаг в production коде

**Файл:** `modules/checkpoints/components/CheckpointVerticalLinks.tsx`
**Строка:** 13

```typescript
const DEBUG = true // Set to true for development debugging
```

**Рекомендация:** Удалить или заменить на environment-based логирование (например, через Sentry).

---

### 5. Расположение модалок

**Текущее:** `modules/modals/components/checkpoint/`
**Ожидается:** `modules/checkpoints/components/modals/`

**Проблема:** Нарушает module-first архитектуру проекта.

**Рекомендация:** Переместить модальные окна в модуль checkpoints.

---

## 🟢 ОДОБРЕННЫЕ ПАТТЕРНЫ

### Server Actions (`checkpoints.ts`)

✅ Все actions возвращают `Promise<ActionResult<T>>`
✅ Директива `'use server'` присутствует
✅ Sentry tracing с `Sentry.startSpan()`
✅ Permission checks через `canManageCheckpoint()`
✅ Audit trail для всех мутаций
✅ FIFO cleanup для audit entries (лимит 50)
✅ Корректная обработка ошибок с `try/catch`

### Hooks (`use-checkpoints.ts`)

✅ Используются factory hooks из `modules/cache`:
- `createCacheQuery` для списков
- `createDetailCacheQuery` для деталей
- `createCacheMutation` для create/update
- `createUpdateMutation` для complete
- `createDeleteMutation` для delete

✅ Query keys из `queryKeys.checkpoints.*`
✅ StaleTime с semantic values (`'fast'`, `'medium'`)
✅ Create/Update используют invalidation (НЕ optimistic)
✅ Complete/Delete используют optimistic updates
✅ Правильные `invalidateKeys` для связанных кешей

### Документация

✅ Отличное покрытие JSDoc с примерами `@example`
✅ Русские комментарии соответствуют стандартам проекта
✅ Чёткое разделение секций с comment headers

---

## 📊 Сводка по проверкам

### Cache Guardian Report

| Критерий | Статус |
|----------|--------|
| ActionResult wrapper | 🟢 PASS |
| 'use server' directive | 🟢 PASS |
| Sentry tracing | 🟢 PASS |
| Auth checks | 🟢 PASS |
| Permission checks | 🟢 PASS |
| Audit trail | 🟢 PASS |
| Hook factory usage | 🟢 PASS |
| Query keys from factory | 🟢 PASS |
| Create/Update = invalidation | 🟢 PASS |
| Complete/Delete = optimistic | 🟢 PASS |
| No direct supabase in components | 🟢 PASS |
| No useQuery/useMutation direct | 🔴 **FAIL** (CheckpointEditModal) |
| No useEffect for data fetching | 🔴 **FAIL** (CheckpointCreateModal) |

### Clean Code Guardian Report

| Категория | Статус | Проблемы |
|-----------|--------|----------|
| Structure & Modularity | 🟡 Warning | Modal location, missing utils/constants |
| TypeScript Strictness | 🟡 Warning | Дублирование типов, inconsistent naming |
| Naming Conventions | 🟢 Approved | Минорные проблемы с именами переменных |
| Documentation | 🟢 Approved | Хорошее покрытие JSDoc |
| DRY Principle | 🔴 Critical | ~600 строк дублируются в модалках |
| Component Size | 🟡 Warning | CheckpointMarker.tsx > 150 строк |

---

## 🎯 План исправлений (Приоритеты)

### 🔴 High Priority (Технический долг)

1. **Исправить прямой импорт useQueryClient** в CheckpointEditModal

   **Зачем фиксить:**
   - Обход централизованной системы кеширования → непредсказуемое поведение
   - Manual cache updates конфликтуют с автоматической инвалидацией
   - Усложняет будущую миграцию кеш-системы
   - Компонент не должен управлять кешем напрямую

   **Визуальные изменения:**
   - Description теперь сохраняется только при клике "Сохранить" (было: auto-sync с debounce 500ms)
   - Влияние на UX: минимальное, пользователь привык сохранять через кнопку

   **Шаги исправления:**

   **Шаг 1.1:** Удалить импорт `useQueryClient`
   - Файл: [CheckpointEditModal.tsx](modules/modals/components/checkpoint/CheckpointEditModal.tsx#L18)
   - Удалить строку 18: `import { useQueryClient } from '@tanstack/react-query'`

   **Шаг 1.2:** Удалить получение queryClient
   - Файл: [CheckpointEditModal.tsx](modules/modals/components/checkpoint/CheckpointEditModal.tsx#L259)
   - Удалить строку 259: `const queryClient = useQueryClient()`

   **Шаг 1.3:** Удалить useEffect для real-time sync description
   - Файл: [CheckpointEditModal.tsx](modules/modals/components/checkpoint/CheckpointEditModal.tsx#L317-L336)
   - Удалить строки 317-336 (весь блок `useEffect` с `queryClient.setQueryData`)

   **Шаг 1.4:** Убрать зависимость от `debouncedDescription`
   - Файл: [CheckpointEditModal.tsx](modules/modals/components/checkpoint/CheckpointEditModal.tsx)
   - Найти и удалить `useDebouncedValue` для description, если он больше не используется
   - Проверить, нет ли других useEffect, зависящих от `debouncedDescription`

   **Шаг 1.5:** (Опционально) Если требуется live preview
   - Вариант A: Использовать локальный state для preview (без синхронизации с кешем)
   - Вариант B: Создать dedicated hook в `modules/cache` для optimistic updates description
   - Вариант C: Использовать React Context для shared state между компонентами

   **Проверка после исправления:**
   - ✅ Нет импортов из `@tanstack/react-query` в компоненте
   - ✅ Description сохраняется только при submit формы через `useUpdateCheckpoint`
   - ✅ Нет manual cache manipulation через `queryClient.setQueryData`
   - ✅ Компонент работает корректно без errors

2. **Заменить useEffect на хук** в CheckpointCreateModal

   **Зачем фиксить:**
   - useEffect для data fetching — устаревший anti-pattern
   - Нет кеширования → данные загружаются при каждом открытии модалки
   - Ручное управление loading/error states (дублирование логики)
   - Риск race conditions при быстром открытии/закрытии
   - Нет автоматической инвалидации устаревших данных

   **Визуальные изменения:**
   - **Производительность:** Модалка открывается мгновенно (данные из кеша)
   - **Первое открытие:** Loading spinner (как сейчас)
   - **Повторные открытия:** Instant — данные уже в кеше (сейчас: всегда loading)
   - **Background updates:** Данные автоматически обновляются, если устарели (>3 мин)
   - **Меньше запросов к БД:** Кеш на 3 минуты (staleTime: 'medium')

   **Шаги исправления:**

   **Шаг 2.1:** Добавить query key для project structure
   - Файл: [query-keys.ts](modules/cache/keys/query-keys.ts)
   - Найти секцию `projects:` (около строки 86)
   - Добавить новый ключ:
     ```typescript
     projects: {
       // ... existing keys
       structure: () => [...queryKeys.projects.all, 'structure'] as const,
     }
     ```

   **Шаг 2.2:** Создать хук `useProjectStructure`
   - Создать файл: `modules/checkpoints/hooks/use-project-structure.ts`
   - Реализовать хук:
     ```typescript
     import { createCacheQuery, queryKeys } from '@/modules/cache'
     import { getProjectStructure } from '@/modules/resource-graph/actions'

     export const useProjectStructure = createCacheQuery({
       queryKey: () => queryKeys.projects.structure(),
       queryFn: getProjectStructure,
       staleTime: 'medium', // 3 минуты
     })
     ```

   **Шаг 2.3:** Экспортировать хук
   - Файл: [modules/checkpoints/hooks/index.ts](modules/checkpoints/hooks/index.ts)
   - Добавить экспорт:
     ```typescript
     export * from './use-project-structure'
     ```

   **Шаг 2.4:** Заменить useEffect на хук в компоненте
   - Файл: [CheckpointCreateModal.tsx](modules/modals/components/checkpoint/CheckpointCreateModal.tsx#L417-L468)
   - Удалить строки 417-468 (весь блок `useEffect` с `loadSections`)
   - Удалить state `sectionsLoading` и `setSectionsLoading`
   - Добавить импорт и использование хука:
     ```typescript
     import { useProjectStructure } from '@/modules/checkpoints/hooks'

     // В компоненте:
     const { data: projectStructureResult, isLoading: structureLoading } = useProjectStructure()
     ```

   **Шаг 2.5:** Обработать данные в useMemo
   - Файл: [CheckpointCreateModal.tsx](modules/modals/components/checkpoint/CheckpointCreateModal.tsx)
   - Создать `useMemo` для обработки структуры проекта:
     ```typescript
     const { projectSections, projectId } = useMemo(() => {
       if (!projectStructureResult?.success || !projectStructureResult.data || !sectionId || !isOpen) {
         return { projectSections: [], projectId: null }
       }

       const { sections, objects, stages } = projectStructureResult.data

       const currentSection = sections.find((s) => s.id === sectionId)
       if (!currentSection?.objectId) return { projectSections: [], projectId: null }

       const currentObject = objects.find((o) => o.id === currentSection.objectId)
       if (!currentObject?.stageId) return { projectSections: [], projectId: null }

       const currentStage = stages.find((s) => s.id === currentObject.stageId)
       if (!currentStage?.projectId) return { projectSections: [], projectId: null }

       const projectStages = stages.filter((s) => s.projectId === currentStage.projectId)
       const stageIds = new Set(projectStages.map((s) => s.id))

       const projectObjects = objects.filter((o) => o.stageId && stageIds.has(o.stageId))
       const objectIds = new Set(projectObjects.map((o) => o.id))

       const filteredSections = sections
         .filter((s) => s.objectId && objectIds.has(s.objectId))
         .map((s) => ({ id: s.id, name: s.name, objectId: s.objectId }))

       return {
         projectSections: filteredSections,
         projectId: currentStage.projectId,
       }
     }, [projectStructureResult, sectionId, isOpen])
     ```

   **Шаг 2.6:** Удалить старый state
   - Файл: [CheckpointCreateModal.tsx](modules/modals/components/checkpoint/CheckpointCreateModal.tsx)
   - Удалить `const [projectSections, setProjectSections] = useState(...)`
   - Удалить `const [projectId, setProjectId] = useState(...)`
   - Удалить `const [sectionsLoading, setSectionsLoading] = useState(...)`

   **Шаг 2.7:** Обновить использование loading state
   - Файл: [CheckpointCreateModal.tsx](modules/modals/components/checkpoint/CheckpointCreateModal.tsx)
   - Заменить все `sectionsLoading` на `structureLoading`

   **Проверка после исправления:**
   - ✅ Нет useEffect для загрузки данных в компоненте
   - ✅ Используется хук `useProjectStructure` из cache модуля
   - ✅ Обработка данных вынесена в `useMemo`
   - ✅ Данные кешируются через TanStack Query
   - ✅ Компонент корректно отображает loading state
   - ✅ Список разделов проекта загружается и фильтруется правильно

3. **Создать shared компоненты для модалок**
   - Экономия ~600 строк кода
   - Компоненты: IconPicker, ColorPicker, SectionMultiSelect, CheckpointTypeSelector

### 🟡 Medium Priority (Качество кода)

4. **Унифицировать Checkpoint type definitions**
   - Использовать только `types/index.ts`
   - Удалить дубликат из `actions/checkpoints.ts`

5. **Создать `utils/` директорию**
   - `checkpoint-icons.ts` (icon mapping)
   - `date-utils.ts` (formatDateLocal)
   - `status-utils.ts` (calculateCheckpointStatus, STATUS_COLORS)

6. **Создать `constants/` директорию**
   - `checkpoint-constants.ts` (OVERLAP_OFFSET, MARKER_RADIUS, etc.)

7. **Переместить модалки**
   - Из `modules/modals/components/checkpoint/`
   - В `modules/checkpoints/components/modals/`

### 🟢 Low Priority (Clean Code)

8. **Удалить DEBUG флаг** из CheckpointVerticalLinks.tsx

9. **Извлечь inline CSS** в Tailwind config или CSS modules

10. **Разбить CheckpointMarker.tsx** на меньшие компоненты

---

## 📈 Метрики модуля

### Размеры файлов

| Файл | Строки | Статус |
|------|--------|--------|
| `actions/checkpoints.ts` | 1147 | ✅ OK |
| `hooks/use-checkpoints.ts` | 271 | ✅ OK |
| `CheckpointMarker.tsx` | 657 | ⚠️ Большой |
| `CheckpointVerticalLinks.tsx` | 395 | ⚠️ Можно оптимизировать |
| `CheckpointCreateModal.tsx` | 955 | 🔴 Критично большой |
| `CheckpointEditModal.tsx` | 955 | 🔴 Критично большой |

### Дублирование кода

- **Общее дублирование:** ~600 строк (~32% от общего кода модалок)
- **Потенциальная оптимизация:** 40% сокращение при рефакторинге

### TypeScript Coverage

- ✅ Strict mode compliance
- ⚠️ Дублирование типов (2 определения Checkpoint)
- ⚠️ Inconsistent naming (camelCase vs snake_case в input types)

---

## 🔗 Связанные файлы

### Основные файлы модуля
```
modules/checkpoints/
├── actions/
│   ├── checkpoints.ts (1147 строк)
│   ├── checkpoint-types.ts
│   └── index.ts
├── components/
│   ├── CheckpointMarker.tsx (657 строк)
│   └── CheckpointVerticalLinks.tsx (395 строк)
├── context/
│   └── CheckpointLinksContext.tsx
├── hooks/
│   ├── use-checkpoints.ts (271 строк)
│   ├── use-checkpoint-types.ts
│   ├── use-can-manage-checkpoint.ts
│   └── index.ts
├── types/
│   └── index.ts
└── index.ts
```

### Модальные окна (требуется перемещение)
```
modules/modals/components/checkpoint/
├── CheckpointCreateModal.tsx (955 строк)
└── CheckpointEditModal.tsx (955 строк)
```

---

## 💡 Рекомендации на будущее

1. **Code Review чекпоинт:** Добавить pre-commit hook для проверки прямых импортов `@tanstack/react-query` вне `modules/cache`

2. **Component Size Limit:** Настроить ESLint правило для ограничения размера компонентов (рекомендуется 150-200 строк)

3. **DRY Principle:** При создании новых модалок сразу выделять shared компоненты, чтобы избежать дублирования

4. **Type Centralization:** Все типы модуля должны быть в `types/index.ts`, actions должны импортировать их оттуда

5. **Debug Tooling:** Использовать environment variables вместо hardcoded DEBUG флагов

---

## 📝 Заключение

Модуль checkpoints демонстрирует **хорошую архитектуру** в части Server Actions и использования cache системы, но имеет **2 критических нарушения** и **значительный технический долг** в виде дублирования кода модалок.

### Критические исправления (Must Fix):

**1. CheckpointEditModal — useQueryClient (15 мин)**
- Удалить прямую манипуляцию кешем
- Визуально: Description сохраняется по кнопке вместо auto-sync
- Зачем: Архитектурное нарушение, конфликты инвалидации

**2. CheckpointCreateModal — useEffect (30 мин)**
- Заменить на хук из cache модуля
- Визуально: Мгновенное открытие модалки (кеширование)
- Зачем: Anti-pattern, нет кеша, race conditions

### Ожидаемый результат:

**Технические улучшения:**
- ✅ Полное соответствие архитектуре `modules/cache`
- ✅ Централизованное управление кешем
- ✅ Автоматическая инвалидация данных
- ✅ Меньше технического долга

**UX улучшения:**
- ✅ Быстрее открытие модалок (instant из кеша)
- ✅ Меньше loading spinners
- ✅ Автоматические background updates
- ✅ Меньше запросов к БД

**При рефакторинге модалок (опционально):**
- ✅ Сокращение кода на ~600 строк (~40%)
- ✅ Улучшение maintainability и DRY
- ✅ Переиспользуемые компоненты

### Время на исправления:
- **Критические ошибки (1-2):** ~45 минут
- **Рефакторинг модалок (3):** ~2-3 часа
- **Остальные improvements:** ~1-2 часа

---

**Ревьюеры:**
- Cache Guardian (Agent ID: a07df32)
- Clean Code Guardian (Agent ID: a3e9adb)

**Следующий шаг:** Приступить к исправлениям согласно детальному плану выше или создать GitHub issues для отслеживания прогресса.
