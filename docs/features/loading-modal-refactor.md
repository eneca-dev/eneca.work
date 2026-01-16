# LoadingModal-2: Рефакторинг модалки загрузки сотрудников

## Цель

Создать новую модалку `loading-modal-2` для управления загрузками сотрудников с использованием современного стека (server actions, TanStack Query, optimistic updates), сохранив всю бизнес-логику из существующей реализации. Модалка будет размещена в `modules/modals/components/loading-modal-2/` по аналогии с другими модалками модуля.

## Проблемы текущей реализации

1. **Большой размер компонента** - 3113 строк кода в одном файле
2. **Прямые запросы к Supabase** - нет централизованного управления кешем
3. **Сложная логика состояний** - множественные useState и useEffect с риском race conditions
4. **Отсутствие optimistic updates** - плохой UX при создании/редактировании
5. **Нет переиспользования** - вся логика в одном месте
6. **Сложность поддержки** - тяжело отлаживать и расширять

## Целевая архитектура

### Структура файлов (по аналогии с `modules/modals`)

```
modules/modals/
├── actions/
│   ├── loadings.ts                     # CRUD для загрузок (создание, обновление, архивация, удаление)
│   ├── projects-tree.ts                # Загрузка дерева проектов и иерархии
│   └── index.ts                        # Экспорт actions
├── components/
│   └── loading-modal-2/
│       ├── LoadingModal2.tsx           # Главный контейнер (< 100 строк)
│       ├── ProjectTreePanel.tsx        # Левая панель с деревом проектов
│       ├── ProjectTreeNode.tsx         # Узел дерева (рекурсивный компонент)
│       ├── ProjectTreeSearch.tsx       # Поиск по проектам
│       ├── ProjectTreeToolbar.tsx      # Тулбар с кнопками (обновить, фильтры)
│       ├── ProjectTreeNavigation.tsx   # Навигационные действия (перейти к декомпозиции)
│       ├── LoadingFormPanel.tsx        # Правая панель с формой
│       ├── LoadingForm.tsx             # Форма создания/редактирования
│       ├── LoadingFormHeader.tsx       # Заголовок формы с breadcrumbs
│       ├── EmployeeSelector.tsx        # Поиск и выбор сотрудника
│       ├── DateRangeSelector.tsx       # Выбор дат с календарем
│       ├── RateSelector.tsx            # Выбор ставки загрузки
│       ├── LoadingFormActions.tsx      # Кнопки действий
│       ├── dialogs/
│       │   ├── ArchiveConfirmDialog.tsx
│       │   ├── DeleteWarningDialog.tsx
│       │   ├── DeleteConfirmDialog.tsx
│       │   └── index.ts
│       ├── types.ts                    # Локальные типы компонентов
│       ├── constants.ts                # Константы (RATES, viewModes и т.д.)
│       └── index.ts                    # Экспорт компонентов
├── hooks/
│   ├── useProjectsList.ts              # Query: список проектов с фильтрацией
│   ├── useProjectTree.ts               # Query: дерево проекта (lazy loading)
│   ├── useEmployeeSearch.ts            # Query: поиск сотрудников с debounce
│   ├── useLoadingMutations.ts          # Mutations: CRUD для загрузок
│   ├── useDecompositionStageMutations.ts # Mutations: создание этапа
│   ├── useLoadingForm.ts               # Управление состоянием формы
│   ├── useLoadingModal2.ts             # Управление состоянием модалки
│   └── index.ts                        # Экспорт hooks
└── types/
    └── index.ts                        # Добавить типы для loading-modal-2
```

### Server Actions (в `modules/modals/actions/`)
- `createLoading` - создание новой загрузки
- `updateLoading` - обновление загрузки
- `archiveLoading` - архивация загрузки (soft delete)
- `deleteLoading` - удаление загрузки (hard delete)
- `fetchProjectTree` - загрузка дерева конкретного проекта
- `fetchProjectsList` - загрузка списка проектов с фильтрацией по департаменту
- `createDecompositionStage` - создание нового этапа декомпозиции

### Hooks (в `modules/modals/hooks/`)
- `useProjectsList` - список проектов с фильтрацией (my/all)
- `useProjectTree` - дерево проекта (lazy loading)
- `useEmployeeSearch` - поиск сотрудников с debounce (300ms)
- `useLoadingMutations` - все мутации для загрузок (create, update, archive, delete)
- `useDecompositionStageMutations` - мутация создания этапа
- `useLoadingForm` - управление состоянием формы с валидацией
- `useLoadingModal2` - управление состоянием модалки (открытие/закрытие)

### Компоненты (в `modules/modals/components/loading-modal-2/`)
- `LoadingModal2.tsx` - главный контейнер (< 100 строк)
- `ProjectTreePanel.tsx` - левая панель с деревом проектов
- `ProjectTreeNode.tsx` - узел дерева (рекурсивный)
- `ProjectTreeSearch.tsx` - поиск по проектам
- `ProjectTreeToolbar.tsx` - тулбар (обновить, фильтры)
- `ProjectTreeNavigation.tsx` - навигация к декомпозиции (переход на /tasks)
- `LoadingFormPanel.tsx` - правая панель с формой
- `LoadingForm.tsx` - форма создания/редактирования
- `LoadingFormHeader.tsx` - заголовок формы с breadcrumbs
- `EmployeeSelector.tsx` - поиск и выбор сотрудника
- `DateRangeSelector.tsx` - выбор дат с календарем
- `RateSelector.tsx` - выбор ставки загрузки
- `LoadingFormActions.tsx` - кнопки действий
- `dialogs/` - диалоги подтверждения (архивация, удаление)

## Этапы реализации

### Этап 1: Настройка инфраструктуры (Server Actions + Query Keys)

**Описание:**
Создать базовую инфраструктуру для работы с загрузками - server actions, query keys, типы.

**Затрагиваемые файлы:**
- `modules/modals/actions/loadings.ts` (новый)
- `modules/modals/actions/projects-tree.ts` (новый)
- `modules/modals/actions/index.ts` (обновление - добавить экспорт)
- `modules/modals/types/index.ts` (обновление - добавить типы для loading-modal-2)
- `modules/cache/queryKeys.ts` (обновление - добавить ключи для загрузок и проектов)

**Зависимости:** нет

**Задачи:**
1. Создать server actions для CRUD операций с загрузками в `modules/modals/actions/loadings.ts`
2. Создать server actions для работы с деревом проектов в `modules/modals/actions/projects-tree.ts`
3. Использовать существующий поиск сотрудников из `modules/cache` (useUsers)
4. Определить query keys в `modules/cache/queryKeys.ts` для загрузок и проектов
5. Создать TypeScript типы в `modules/modals/types/index.ts`
6. Добавить обработку ошибок и ActionResult wrapper
7. Экспортировать actions в `modules/modals/actions/index.ts`

**Критерии готовности:**
- [ ] Все server actions возвращают ActionResult
- [ ] Query keys определены через factory pattern
- [ ] Типы покрывают все операции
- [ ] Обработка ошибок через try-catch + Sentry

---

### Этап 2: Хуки TanStack Query с кешированием

**Описание:**
Создать React hooks на базе TanStack Query для работы с данными через server actions.

**Затрагиваемые файлы:**
- `modules/modals/hooks/useProjectsList.ts` (новый)
- `modules/modals/hooks/useProjectTree.ts` (новый)
- `modules/modals/hooks/useLoadingMutations.ts` (новый)
- `modules/modals/hooks/useDecompositionStageMutations.ts` (новый)
- `modules/modals/hooks/index.ts` (обновление - добавить экспорт)

**Зависимости:** Этап 1

**Задачи:**
1. Создать query hooks через createCacheQuery/createDetailCacheQuery factory
2. Настроить stale time и cache time для каждого хука:
   - `useProjectsList`: staleTime 5 минут, cacheTime 10 минут (относительно статичные данные)
   - `useProjectTree`: staleTime 3 минуты, cacheTime 10 минут (может обновляться другими пользователями)
   - `useEmployeeSearch`: staleTime 10 минут, cacheTime 15 минут (справочные данные)
   - `useLoadingMutations`: автоматическая invalidation после мутаций
3. Реализовать мутации с optimistic updates через createCacheMutation
4. Настроить invalidation queries при мутациях
5. Добавить обработку ошибок в хуках
6. Использовать существующий useUsers из `modules/cache` для сотрудников
7. Экспортировать hooks в `modules/modals/hooks/index.ts`

**Критерии готовности:**
- [ ] Все query hooks через createCacheQuery/createDetailCacheQuery
- [ ] Мутации через createCacheMutation с optimistic updates
- [ ] Query invalidation настроен корректно
- [ ] Error states обрабатываются
- [ ] Hooks экспортированы в public API

---

### Этап 3: Базовые UI компоненты (атомарные)

**Описание:**
Создать переиспользуемые UI компоненты для модалки (селекторы, инпуты, кнопки).

**Затрагиваемые файлы:**
- `modules/modals/components/loading-modal-2/EmployeeSelector.tsx` (новый)
- `modules/modals/components/loading-modal-2/DateRangeSelector.tsx` (новый)
- `modules/modals/components/loading-modal-2/RateSelector.tsx` (новый)
- `modules/modals/components/loading-modal-2/LoadingFormActions.tsx` (новый)
- `modules/modals/components/loading-modal-2/constants.ts` (новый)
- `modules/modals/components/loading-modal-2/types.ts` (новый)

**Зависимости:** Этап 2

**Задачи:**
1. Создать EmployeeSelector с поиском и dropdown (использовать useUsers)
2. Создать DateRangeSelector с валидацией и расчетом рабочих дней
3. Создать RateSelector с предустановленными значениями (0.2, 0.25, 0.5, 0.75, 1) и ручным вводом
4. Создать LoadingFormActions с кнопками и валидацией
5. Создать constants.ts с RATES, режимами просмотра и т.д.
6. Создать types.ts с локальными типами компонентов
7. Добавить accessibility (ARIA labels, keyboard navigation)
8. Следовать DESIGN_GUIDE.md для стилей

**Критерии готовности:**
- [ ] Все компоненты < 150 строк
- [ ] Компоненты переиспользуемые и изолированные
- [ ] Валидация работает корректно
- [ ] Keyboard navigation реализована
- [ ] Темная/светлая тема поддерживается

---

### Этап 4: Компонент дерева проектов (левая панель)

**Описание:**
Создать компонент навигации по иерархии проектов с lazy loading и кешированием.

**Затрагиваемые файлы:**
- `modules/modals/components/loading-modal-2/ProjectTreePanel.tsx` (новый)
- `modules/modals/components/loading-modal-2/ProjectTreeNode.tsx` (новый)
- `modules/modals/components/loading-modal-2/ProjectTreeSearch.tsx` (новый)
- `modules/modals/components/loading-modal-2/ProjectTreeToolbar.tsx` (новый)
- `modules/modals/components/loading-modal-2/ProjectTreeNavigation.tsx` (новый)

**Зависимости:** Этап 2, Этап 3

**Задачи:**
1. Создать ProjectTreePanel с двумя режимами (Мои/Все проекты)
2. Создать рекурсивный ProjectTreeNode для отображения иерархии
3. Реализовать lazy loading детей узлов при раскрытии
4. Добавить поиск по проектам (ProjectTreeSearch)
5. Создать тулбар с кнопками обновления (ProjectTreeToolbar)
6. Создать ProjectTreeNavigation с кнопкой "Перейти к декомпозиции"
7. Реализовать навигацию на /tasks с параметрами:
   - Вкладка "Бюджеты" (budget)
   - Фильтр по projectId
   - Раскрытие всех детей указанного раздела (sectionId)
   - Подсветка целевого раздела
8. Добавить создание нового этапа декомпозиции
9. Реализовать автоматический выбор этапа по stageId из props

**Критерии готовности:**
- [ ] Lazy loading работает корректно
- [ ] Фильтрация "Мои/Все проекты" работает
- [ ] Поиск фильтрует дерево в реальном времени
- [ ] Создание этапа через модалку работает
- [ ] Автоматический выбор и раскрытие работает
- [ ] Навигация на /tasks открывает вкладку "Бюджеты"
- [ ] Фильтр по проекту применяется автоматически
- [ ] Целевой раздел разворачивается со всеми детьми
- [ ] Целевой раздел подсвечивается визуально
- [ ] Кеш обновляется при изменениях
- [ ] Breadcrumbs отображают путь к узлу

---

### Этап 5: Форма загрузки (правая панель)

**Описание:**
Создать компонент формы для создания/редактирования загрузки с валидацией и оптимистичными обновлениями.

**Затрагиваемые файлы:**
- `modules/modals/components/loading-modal-2/LoadingFormPanel.tsx` (новый)
- `modules/modals/components/loading-modal-2/LoadingForm.tsx` (новый)
- `modules/modals/components/loading-modal-2/LoadingFormHeader.tsx` (новый)
- `modules/modals/hooks/useLoadingForm.ts` (новый)
- `modules/modals/hooks/index.ts` (обновление)

**Зависимости:** Этап 3, Этап 4

**Задачи:**
1. Создать LoadingFormPanel с двумя состояниями (выбор этапа / форма)
2. Создать LoadingForm с полями (сотрудник, даты, ставка, комментарий)
3. Реализовать валидацию формы (Zod schema)
4. Создать LoadingFormHeader с breadcrumbs и названием этапа
5. Реализовать двухэтапный процесс создания (выбор → форма)
6. Добавить хук useLoadingForm для управления состоянием формы
7. Реализовать отслеживание изменений (hasChanges) в режиме редактирования

**Критерии готовности:**
- [ ] Валидация через Zod работает
- [ ] Двухэтапный процесс создания реализован
- [ ] Форма отслеживает изменения
- [ ] Error messages отображаются корректно
- [ ] Loading states обрабатываются
- [ ] Форма сбрасывается после успешного сохранения

---

### Этап 6: Главный контейнер LoadingModal2

**Описание:**
Создать главный компонент модалки, объединяющий все части с двухпанельной структурой.

**Затрагиваемые файлы:**
- `modules/modals/components/loading-modal-2/LoadingModal2.tsx` (новый)
- `modules/modals/components/loading-modal-2/index.ts` (новый)
- `modules/modals/hooks/useLoadingModal2.ts` (новый)
- `modules/modals/hooks/index.ts` (обновление)
- `modules/modals/index.ts` (обновление - экспорт LoadingModal2)

**Зависимости:** Этап 4, Этап 5

**Задачи:**
1. Создать LoadingModal2 с двухпанельной структурой (40% / 60%)
2. Реализовать два режима: create и edit
3. Создать хук useLoadingModal2 для управления состоянием модалки
4. Реализовать открытие/закрытие с анимацией
5. Добавить обработку клавиатуры (ESC для закрытия)
6. Реализовать навигацию на страницу /tasks при клике "Перейти к декомпозиции"
7. Передать в URL параметры: tab=budget, projectId, sectionId, highlightSection=true
8. Добавить обработку успешных операций (уведомления через useUiStore, закрытие)
9. Экспортировать в `modules/modals/index.ts`
10. Следовать DESIGN_GUIDE.md (overlay, panel, focus states)

**Критерии готовности:**
- [ ] LoadingModal2 < 100 строк (только композиция)
- [ ] Два режима (create/edit) работают корректно
- [ ] Keyboard shortcuts работают (ESC)
- [ ] Анимация открытия/закрытия плавная
- [ ] Навигация на /tasks работает с корректными параметрами
- [ ] URL содержит tab, projectId, sectionId, highlightSection
- [ ] Уведомления отображаются после операций
- [ ] Экспортирован в public API модуля

---

### Этап 7: Операции редактирования (архивация, удаление)

**Описание:**
Реализовать функционал архивации и удаления загрузок с подтверждениями и optimistic updates.

**Затрагиваемые файлы:**
- `modules/modals/components/loading-modal-2/dialogs/ArchiveConfirmDialog.tsx` (новый)
- `modules/modals/components/loading-modal-2/dialogs/DeleteWarningDialog.tsx` (новый)
- `modules/modals/components/loading-modal-2/dialogs/DeleteConfirmDialog.tsx` (новый)
- `modules/modals/components/loading-modal-2/dialogs/index.ts` (новый)
- Обновление `LoadingFormActions.tsx` для интеграции диалогов

**Зависимости:** Этап 6

**Задачи:**
1. Создать диалог подтверждения архивации
2. Создать диалог предупреждения перед удалением
3. Создать финальный диалог подтверждения удаления
4. Реализовать трехступенчатый процесс удаления
5. Добавить optimistic updates для архивации/удаления
6. Реализовать откат при ошибке (rollback)
7. Добавить обновление store после успешных операций

**Критерии готовности:**
- [ ] Трехступенчатый процесс удаления работает
- [ ] Optimistic updates для архивации работают
- [ ] Rollback при ошибках работает корректно
- [ ] Store обновляется после операций
- [ ] Модалка закрывается после успешной операции

---

### Этап 8: Интеграция и тестирование

**Описание:**
Интегрировать новую модалку LoadingModal2 в существующий код, провести тестирование. Старая LoadingModal остается до полной миграции.

**Затрагиваемые файлы:**
- Места использования: найти все импорты старой `LoadingModal`
- Тестовые интеграции в основных местах использования
- Документация: обновить README модуля modals

**Зависимости:** Этап 7

**Задачи:**
1. Найти все места использования старой LoadingModal (Grep)
2. Создать тестовые интеграции LoadingModal2 в 1-2 местах
3. Протестировать все сценарии использования (create/edit/archive/delete)
4. Проверить работу с деревом проектов и lazy loading
5. Убедиться что optimistic updates работают
6. Обновить `modules/modals/README.md` с описанием LoadingModal2
7. Создать план миграции остальных мест на LoadingModal2 (отдельная задача)

**Критерии готовности:**
- [ ] LoadingModal2 работает в тестовых местах
- [ ] Все сценарии протестированы (create/edit/archive/delete)
- [ ] Lazy loading дерева работает корректно
- [ ] Optimistic updates работают без ошибок
- [ ] Документация обновлена (README.md)
- [ ] Нет регрессий в функционале
- [ ] План миграции создан

---

## Критерии готовности всей фичи

### Функциональные требования
- [ ] Создание загрузки работает с optimistic updates
- [ ] Редактирование загрузки с отслеживанием изменений
- [ ] Архивация загрузки с подтверждением
- [ ] Удаление загрузки с трехступенчатым процессом
- [ ] Навигация по дереву проектов с lazy loading
- [ ] Фильтрация "Мои/Все проекты" работает корректно
- [ ] Поиск по проектам и сотрудникам
- [ ] Создание этапа декомпозиции из модалки
- [ ] Автоматический выбор этапа при передаче stageId
- [ ] Навигация на /tasks с параметрами (tab, projectId, sectionId)
- [ ] Раскрытие дерева раздела и всех его детей на странице /tasks
- [ ] Подсветка целевого раздела с автоматическим скроллом
- [ ] Расчет рабочих дней с учетом календаря
- [ ] Валидация всех полей формы
- [ ] Обработка всех ошибок с уведомлениями

### Технические требования
- [ ] Все server actions через ActionResult wrapper
- [ ] Все query hooks через createCacheQuery factory
- [ ] Optimistic updates для всех мутаций
- [ ] Query invalidation настроен корректно
- [ ] Компоненты < 150 строк каждый
- [ ] TypeScript strict mode без ошибок
- [ ] Нет прямых запросов к Supabase из компонентов
- [ ] Обработка ошибок через Sentry
- [ ] Кеширование работает корректно
- [ ] Нет race conditions

### Производительность
- [ ] Lazy loading дерева работает быстро
- [ ] Debounce в поиске (300ms)
- [ ] Нет лишних ре-рендеров
- [ ] Кеш используется эффективно
- [ ] Bundle size не увеличился значительно

### UX/UI
- [ ] Анимации плавные
- [ ] Loading states отображаются
- [ ] Error messages понятные
- [ ] Уведомления информативные
- [ ] Keyboard navigation работает
- [ ] Темная/светлая тема поддерживается
- [ ] Responsive на разных экранах

---

## Технический стек

### Core
- React 18+
- TypeScript (strict mode)
- Next.js App Router

### State Management
- TanStack Query v5 (кеширование, мутации)
- Zustand (глобальное состояние для модалок)

### Data Layer
- Server Actions (вместо прямых запросов к Supabase)
- Supabase (только в server actions)
- Zod (валидация)

### UI
- Tailwind CSS
- Radix UI (диалоги, dropdown)
- Lucide React (иконки)
- React Hook Form (управление формами)

### Utilities
- date-fns (работа с датами)
- Sentry (мониторинг ошибок)

---

## Навигация к декомпозиции

### Требования
При клике на кнопку "Перейти к декомпозиции" в дереве проектов должна происходить навигация на страницу /tasks со следующим поведением:

### URL параметры
```typescript
/tasks?tab=budget&projectId={projectId}&sectionId={sectionId}&highlightSection=true
```

Где:
- `tab=budget` - открывает вкладку "Бюджеты"
- `projectId={projectId}` - ID проекта для фильтрации
- `sectionId={sectionId}` - ID раздела, который нужно развернуть и подсветить
- `highlightSection=true` - флаг для активации визуальной подсветки

### Поведение на странице /tasks

1. **Переключение вкладки**: Автоматически открыть вкладку "Бюджеты"
2. **Применение фильтра**: Установить фильтр по projectId
3. **Раскрытие дерева**:
   - Найти раздел с sectionId
   - Развернуть всех его детей (рекурсивно)
   - Развернуть всех родителей до корня
4. **Подсветка**:
   - Применить визуальную подсветку к разделу (например, мягкий border, изменение фона)
   - Скроллить к разделу, чтобы он был виден
   - Подсветка должна исчезнуть через 2-3 секунды или при клике

### Компонент ProjectTreeNavigation

```typescript
interface ProjectTreeNavigationProps {
  projectId: string;
  sectionId: string;
  sectionName: string;
}

// Использование Next.js router для навигации
const handleNavigateToDecomposition = () => {
  router.push(
    `/tasks?tab=budget&projectId=${projectId}&sectionId=${sectionId}&highlightSection=true`
  );
};
```

### Интеграция на странице /tasks

На странице /tasks необходимо:
1. Читать URL параметры при загрузке
2. Если есть `sectionId` и `highlightSection=true`:
   - Найти раздел в дереве бюджета
   - Развернуть путь к нему
   - Применить стили подсветки
   - Выполнить скролл к элементу
3. Очистить параметр `highlightSection` из URL после применения

---

## Паттерны проекта для соблюдения

1. **Server Actions возвращают ActionResult:**
   ```typescript
   type ActionResult<T> =
     | { success: true; data: T }
     | { success: false; error: string }
   ```

2. **Query Keys через factory:**
   ```typescript
   export const loadingQueryKeys = {
     all: ['loadings'] as const,
     lists: () => [...loadingQueryKeys.all, 'list'] as const,
     list: (filters: string) => [...loadingQueryKeys.lists(), filters] as const,
   }
   ```

3. **Hooks через createCacheQuery с настройками кеша:**
   ```typescript
   // Список проектов (относительно статичные данные)
   export const useProjectsList = createCacheQuery({
     queryKey: projectQueryKeys.list,
     queryFn: fetchProjectsListAction,
     staleTime: 5 * 60 * 1000,  // 5 минут
     cacheTime: 10 * 60 * 1000, // 10 минут
   })

   // Дерево проекта (может обновляться другими пользователями)
   export const useProjectTree = createCacheQuery({
     queryKey: projectQueryKeys.tree,
     queryFn: fetchProjectTreeAction,
     staleTime: 3 * 60 * 1000,  // 3 минуты
     cacheTime: 10 * 60 * 1000, // 10 минут
   })

   // Поиск сотрудников (справочные данные)
   export const useEmployeeSearch = createCacheQuery({
     queryKey: employeeQueryKeys.search,
     queryFn: searchEmployeesAction,
     staleTime: 10 * 60 * 1000, // 10 минут
     cacheTime: 15 * 60 * 1000, // 15 минут
   })
   ```

4. **Optimistic Updates в мутациях:**
   ```typescript
   useMutation({
     mutationFn: createLoadingAction,
     onMutate: async (newLoading) => {
       // Cancel queries
       // Snapshot previous value
       // Optimistically update
     },
     onError: (err, variables, context) => {
       // Rollback
     },
     onSettled: () => {
       // Invalidate queries
     },
   })
   ```

5. **Компоненты < 150 строк:**
   - Выносить логику в хуки
   - Разбивать на подкомпоненты
   - Использовать композицию

---

## Риски и митигация

| Риск | Вероятность | Воздействие | Митигация |
|------|------------|-------------|-----------|
| Race conditions при lazy loading | Средняя | Высокое | Использовать query cancellation в TanStack Query |
| Потеря функционала при миграции | Средняя | Высокое | Детальное тестирование каждого этапа, чек-листы |
| Проблемы с производительностью | Низкая | Среднее | Профилирование, мемоизация, виртуализация если нужно |
| Сложность отката изменений | Низкая | Высокое | Постепенная миграция, feature flag для новой модалки |
| Конфликты с существующим store | Средняя | Среднее | Минимальные изменения в usePlanningStore |

---

## Оценка трудозатрат

| Этап | Оценка | Сложность |
|------|---------|-----------|
| Этап 1: Server Actions | 4-6 часов | Средняя |
| Этап 2: Query Hooks | 4-6 часов | Средняя |
| Этап 3: UI компоненты | 6-8 часов | Средняя |
| Этап 4: Дерево проектов | 8-12 часов | Высокая |
| Этап 5: Форма загрузки | 6-8 часов | Средняя |
| Этап 6: Главный контейнер | 4-6 часов | Средняя |
| Этап 7: Архивация/удаление | 4-6 часов | Средняя |
| Этап 8: Интеграция | 4-6 часов | Средняя |
| **Итого** | **40-58 часов** | - |

---

## Следующие шаги

1. ✅ Создать план (текущий документ)
2. ⏳ Вызвать агента Pragmatic Architect для валидации плана
3. ⏳ Получить подтверждение от разработчика
4. ⏳ Начать реализацию с Этапа 1

---

## Примечания

- Документ будет обновляться по мере прохождения этапов
- Каждый этап должен заканчиваться коммитом
- После каждого этапа вызывать соответствующих агентов (Cache Guardian, Clean Code Guardian)
- Следовать паттернам из `docs/main-pipeline.md`

### Поведение кеша при изменениях другими пользователями

**Важно:** При текущей архитектуре без real-time подписок, изменения сделанные другими пользователями (например, создание нового этапа декомпозиции) **не отобразятся моментально**.

Обновление данных произойдет:
1. **Автоматически** - когда истечет `staleTime` (для дерева проектов - через 3 минуты)
2. **Вручную** - при клике на кнопку "Обновить" в ProjectTreeToolbar
3. **После собственных мутаций** - при создании/редактировании загрузки (query invalidation)

Если требуется real-time синхронизация, необходимо добавить:
- Supabase Realtime подписки на изменения в таблицах
- Автоматическую invalidation queries при получении событий от других пользователей
- Это должно быть реализовано в отдельном этапе (не входит в текущий план)
