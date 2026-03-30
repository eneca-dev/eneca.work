# Аудит производительности приложения — 02.03.2026

## Контекст проблемы

После логина пользователь сразу видел в консоли ошибки `429 Too Many Requests` на эндпоинте `/_relay`. Приложение отправляло слишком много запросов одновременно при старте, что приводило к rate-limiting со стороны Sentry и создавало лишнюю нагрузку на Supabase.

---

## Исправленные проблемы

### 1. Sentry: 100% трейсинг перегружал сервер

**Файлы:** `instrumentation-client.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`

**В чём была проблема:**
Параметр `tracesSampleRate` был установлен в `1` (100%). Это означало, что **каждый HTTP-запрос** приложения генерировал дополнительный POST-запрос на Sentry через tunnel `/_relay`. При 20+ запросах при старте это создавало ещё 20+ запросов к Sentry, и их сервер отвечал `429 Too Many Requests`.

Дополнительно были включены:
- `enableLogs: true` — экспериментальная фича Sentry для structured logging, которая увеличивала размер каждого payload
- `replaysOnErrorSampleRate: 1.0` — записывались видео-реплеи 100% сессий с ошибками, что потребляло квоту

**Как влияло на приложение:**
- Ошибки `429` в консоли сразу после логина
- Замедление загрузки из-за конкуренции за сетевой канал
- Быстрый расход квоты Sentry

**Что изменили:**
- `tracesSampleRate: 1` → `0.1` (10% трейсов — достаточно для performance-метрик)
- `enableLogs: true` → `false` (вернули дефолт, не влияет на отслеживание ошибок)
- `replaysSessionSampleRate: 0.1` → `0.05` (5% сессий записываются)
- `replaysOnErrorSampleRate: 1.0` → `0.5` (50% сессий с ошибками записываются)

**Что НЕ затронуто:**
- `Sentry.captureException()` — ошибки отправляются всегда на 100%
- `Sentry.captureMessage()` — сообщения отправляются всегда
- Автоматический перехват необработанных исключений — работает как раньше
- Error boundaries — работают как раньше

---

### 2. Sentry tunnel `/_relay` проходил через auth middleware

**Файл:** `middleware.ts`

**В чём была проблема:**
Sentry настроен с `tunnelRoute: "/_relay"` — все клиентские события Sentry отправляются через сервер Next.js (чтобы обходить ad-блокеры). Но маршрут `/_relay` не был исключён из middleware matcher, и каждый Sentry-запрос проходил через `updateSession()` — функцию проверки/обновления auth-сессии Supabase.

**Как влияло на приложение:**
- Каждый Sentry event (а их десятки при старте) делал лишнее обращение к Supabase Auth
- Если сессия невалидна — Sentry events могли теряться
- Лишняя нагрузка на сервер

**Что изменили:**
Добавили `_relay` в исключения middleware matcher:
```
"/((?!_next/static|_next/image|_relay|favicon.ico|...).*)"
```

**Результат:** Sentry tunnel работает напрямую, без лишних auth-проверок.

---

### 3. ReferencePrefetch: 5 параллельных запросов при старте

**Файл:** `modules/cache/providers/reference-prefetch.tsx`

**В чём была проблема:**
Компонент `ReferencePrefetch` монтировался в `ClientProviders` и при старте приложения **одновременно** отправлял 5 запросов за справочными данными (категории работ, уровни сложности, статусы, типы чекпоинтов, пользователи). Эти 5 запросов стреляли параллельно с auth-запросами, permissions-запросами и Realtime WebSocket — суммарно ~15-20 запросов в первые 500мс.

Дополнительно:
- Не проверялась авторизация — запросы летели даже на странице логина
- `staleTime: static` (10 мин) — справочники перезагружались каждые 10 минут, хотя они почти никогда не меняются

**Как влияло на приложение:**
- Конкуренция за сетевой канал при старте
- Вместе с Sentry traces — двойная нагрузка (запрос + трейс каждого запроса)
- Суммарный шквал вызывал 429 от Sentry

**Что изменили:**
- Добавлена проверка `isAuthenticated` — не загружаем справочники для неавторизованных
- Запросы выполняются **последовательно** с паузой 300мс между ними (не параллельно)
- Загрузка откладывается через `requestIdleCallback` — ждём пока браузер освободится
- `staleTime` изменён на `infinity` — справочники загружаются один раз за сессию

**Результат:** Вместо 5 одновременных запросов в момент логина — последовательная фоновая загрузка после того как основной UI уже отрисован.

---

### 4. `supabase` в dependency arrays вызывал лишние запросы

**Файлы:** `modules/users/components/current-user-card.tsx`, `modules/chat/hooks/useChat.ts`, `modules/calendar/hooks/useCalendarEvents.ts`

**В чём была проблема:**
В теле компонентов/хуков вызывался `const supabase = createClient()` и затем `supabase` передавался в dependency arrays useEffect/useCallback. Хотя `createBrowserClient` из `@supabase/ssr` внутри использует singleton, ссылка на объект в зависимостях useEffect могла приводить к лишним перезапускам эффектов.

Особенно критично в `useChat.ts` — supabase был в deps у 4 хуков (2 useEffect + 2 useCallback), а в `useCalendarEvents.ts` — в 4 useCallback deps.

**Как влияло на приложение:**
- Потенциально лишние рефетчи данных при ре-рендерах
- Нестабильные ссылки на callbacks из-за cascading deps (fetchEvents → createEvent → editEvent → removeEvent)

**Что изменили:**
- `const supabase = createClient()` → `const supabaseRef = useRef(createClient())`
- Все обращения: `supabase.from(...)` → `supabaseRef.current.from(...)`
- Убрали `supabase` из всех dependency arrays

**Результат:** Стабильные ссылки, эффекты запускаются только когда реально меняются данные (userId, conversationId и т.д.).

---

### 5. Агрессивные refetch-интервалы на дашборде

**Файлы:** `modules/dashboard/hooks/useAutoRefresh.ts`, `modules/dashboard/hooks/useProjectStatistics.ts`, `modules/dashboard/hooks/useProjectInfo.ts`

**В чём была проблема:**

| Хук | Интервал | Проблема |
|-----|----------|----------|
| `useAutoRefresh` | Каждые **30 секунд** | Весь дашборд перезагружался 2 раза в минуту |
| `useProjectStatistics` | `refetchInterval: 2 мин` + `refetchOnWindowFocus` | Статистика проекта обновлялась каждые 2 минуты автоматически |
| `useProjectInfo` | `refetchInterval: 5 мин` + `refetchOnWindowFocus` | Информация о проекте обновлялась каждые 5 минут автоматически |

При этом в приложении уже есть **Realtime подписки** через Supabase, которые автоматически инвалидируют кэш при изменениях в БД. Polling интервалы были избыточны.

**Как влияло на приложение:**
- Постоянный фоновый трафик к Supabase даже когда данные не менялись
- При переключении вкладки — все queries перезагружались одновременно

**Что изменили:**
- `useAutoRefresh`: 30 сек → 5 мин
- `useProjectStatistics`: убран `refetchInterval`, `staleTime` увеличен до 5 мин
- `useProjectInfo`: убран `refetchInterval`, `staleTime` увеличен до 10 мин

**Результат:** Данные обновляются через Realtime (мгновенно при изменениях) + при навигации. Polling убран как избыточный.

---

### 6. Глобальный `refetchOnWindowFocus: true` вызывал шквал запросов

**Файл:** `modules/cache/client/query-client.ts`

**В чём была проблема:**
В глобальной конфигурации TanStack Query было установлено `refetchOnWindowFocus: true` и `refetchOnReconnect: 'always'`. Это означало, что **каждое** переключение вкладки в браузере (Alt+Tab) вызывало перезагрузку **всех** активных queries — десятки запросов одновременно.

**Как влияло на приложение:**
- Переключился на вкладку → шквал запросов к Supabase
- Если пользователь часто переключает вкладки — постоянная нагрузка
- Вместе с polling интервалами — двойная работа

**Что изменили:**
- `refetchOnWindowFocus: true` → `false`
- `refetchOnReconnect: 'always'` → `true` (мягче — только при потере и восстановлении соединения)

**Результат:** Переключение вкладок больше не вызывает запросов. Актуальность данных обеспечивается Realtime подписками.

---

## Суммарный эффект

**До исправлений** (при логине):
```
~20 запросов к Supabase + ~20 Sentry traces через /_relay = ~40 запросов в первые 500мс
+ каждые 30 сек polling дашборда
+ каждый Alt+Tab — шквал refetch всех queries
```

**После исправлений:**
```
Auth + Permissions запросы (необходимые)
+ справочники загружаются последовательно в фоне после idle
+ Sentry шлёт трейсы только для 10% запросов
+ /_relay не проходит через auth middleware
+ нет polling, нет refetchOnWindowFocus
+ Realtime обеспечивает актуальность данных
+ My Work: 3 запроса вместо 8 (объединены view + убраны дубли)
+ Chat: 2 запроса вместо 4 (убраны дубли)
```

## Что не сломано

- Отслеживание ошибок в Sentry — работает на 100% (captureException, unhandled errors)
- Session Replay — работает (с уменьшенной выборкой)
- Performance traces — работают (10% выборка, достаточно для метрик)
- Данные дашборда — обновляются через Realtime при изменениях в БД
- Справочники — загружаются один раз за сессию (staleTime: infinity)
- Chat, Calendar, Users — функциональность не изменена, только оптимизированы deps

---

### 7. Дублирование запросов при старте из-за Zustand persist

**Файлы:** `modules/my-work/hooks/useMyWorkData.ts`, `modules/chat/hooks/useChat.ts`

**В чём была проблема:**
Zustand store `useUserStore` использует `persist` middleware, которое сохраняет `userId` в localStorage и асинхронно восстанавливает его при загрузке. При старте приложения возникала гонка (race condition):

1. AuthProvider устанавливает `userId` через `setUser()` → `useEffect([userId])` срабатывает **первый раз**
2. Persist middleware восстанавливает состояние из localStorage → может вызвать повторную эмиссию `userId` → `useEffect([userId])` срабатывает **второй раз**

В результате все хуки, зависящие от `userId`, отправляли **двойной набор запросов**.

**Как влияло на приложение:**
- `useMyWorkData`: 4 запроса × 2 = **8 запросов** вместо 3 (было 4 из-за дубля view)
- `useChat`: 2 запроса × 2 = **4 запроса** вместо 2
- Итого **~7 лишних запросов** при каждом логине

**Что изменили:**

**useMyWorkData.ts:**
- Добавлен `lastFetchedUserIdRef` + `isFetchingRef` — если данные уже загружаются/загружены для этого userId, повторный fetch пропускается
- Проверка `lastFetchedUserIdRef.current !== targetUserId` после await — если userId изменился пока шли запросы, результат игнорируется
- `fetchUserAnalytics` и `fetchUserResponsibilities` **объединены в один запрос** `fetchAnalyticsAndResponsibilities` — оба обращались к `view_my_work_analytics`, теперь 1 запрос вместо 2
- Функции fetch вынесены из компонента на уровень модуля — не пересоздаются при ре-рендерах
- `userId` читается через примитивный селектор `useUserStore(state => state.id)` вместо деструктурирования всего store

**useChat.ts:**
- Добавлен `initUserIdRef` — если инициализация уже выполнена для этого userId, повторная пропускается
- Проверка `initUserIdRef.current !== userId` после await

**Результат:**
- `useMyWorkData`: 3 запроса (было 8) — `get_user_active_loadings`, `view_my_work_analytics`, `view_work_logs_enriched`
- `useChat`: 2 запроса (было 4) — `chat_conversations`, `chat_messages`
- Экономия: **~7 запросов** при старте

---

## Что не сломано

- Отслеживание ошибок в Sentry — работает на 100% (captureException, unhandled errors)
- Session Replay — работает (с уменьшенной выборкой)
- Performance traces — работают (10% выборка, достаточно для метрик)
- Данные дашборда — обновляются через Realtime при изменениях в БД
- Справочники — загружаются один раз за сессию (staleTime: infinity)
- Chat, Calendar, Users — функциональность не изменена, только оптимизированы deps
- My Work — данные загружаются так же, только без дублирования
- `refetch()` в useMyWorkData работает — сбрасывает guard и принудительно перезагружает данные

---

### 8. Сломанный JOIN в useTasksData вызывал ошибку 400

**Файлы:** `modules/my-work/components/MyWorkWidget.tsx`, `modules/my-work/components/UserLoadingsList.tsx`, `modules/my-work/index.ts`

**В чём была проблема:**
При клике на загрузку в виджете "Моя работа" хук `useTasksData` отправлял запрос к таблице `assignments` с JOIN на `view_section_hierarchy` через PostgREST hint синтаксис (`from_section:view_section_hierarchy!from_section_id(...)`). Этот запрос **всегда** возвращал `400 Bad Request`, потому что PostgREST не поддерживает JOIN с view через `!hint` — нужен явный foreign key, которого нет.

После ошибки запускался fallback, который загружал **ВСЮ** таблицу `view_section_hierarchy` и **ВСЕ** profiles — избыточно и медленно.

**Как влияло на приложение:**
- Ошибка 400 в консоли при каждом клике на загрузку
- 4 лишних запроса при каждом клике (1 сломанный + 3 fallback)
- Загрузка всех секций и профилей для обогащения одного задания

**Что изменили:**
- Убрали `useTasksData` из `MyWorkWidget` — запрос к `assignments` больше не отправляется
- Убрали секцию "Задания" из `UserLoadingsList` — UI не показывает пустой/сломанный блок
- Убрали экспорт `useTasksData` из `modules/my-work/index.ts`
- Оставили файл `useTasksData.ts` на месте — будет использован когда таблица `assignments` получит FK на `sections`

**Что не затронуто:**
- Загрузки по-прежнему кликабельные
- Секция "Декомпозиции" работает как раньше
- Страница `/tasks` **не затронута** — она использует отдельный модуль `modules/tasks/`

---

## Затронутые файлы (17 файлов)

| Файл | Изменение |
|------|-----------|
| `instrumentation-client.ts` | Sentry client config: sample rates |
| `sentry.server.config.ts` | Sentry server config: sample rates |
| `sentry.edge.config.ts` | Sentry edge config: sample rates |
| `middleware.ts` | Исключение `_relay` из middleware |
| `modules/cache/providers/reference-prefetch.tsx` | Последовательная отложенная загрузка справочников |
| `modules/cache/client/query-client.ts` | Глобальные defaults TanStack Query |
| `modules/users/components/current-user-card.tsx` | supabase → useRef, убран из deps |
| `modules/chat/hooks/useChat.ts` | supabase → useRef, убран из deps + dedup guard |
| `modules/calendar/hooks/useCalendarEvents.ts` | supabase → useRef, убран из deps |
| `modules/dashboard/hooks/useAutoRefresh.ts` | Интервал 30 сек → 5 мин |
| `modules/dashboard/hooks/useProjectStatistics.ts` | Убран refetchInterval |
| `modules/dashboard/hooks/useProjectInfo.ts` | Убран refetchInterval |
| `modules/my-work/hooks/useMyWorkData.ts` | Объединены 2 запроса к view в 1 + dedup guard |
| `modules/my-work/components/MyWorkWidget.tsx` | Убран useTasksData, убран вызов fetchTasksForSection |
| `modules/my-work/components/UserLoadingsList.tsx` | Убрана секция "Задания" и связанные props |
| `modules/my-work/index.ts` | Убран экспорт useTasksData |

---

## Аудит модуля `/tasks` и дочерних модулей

### 9. Zustand store destructuring в TasksTabs, KanbanBoard

**Файлы:** `modules/tasks/components/TasksTabs.tsx`, `modules/kanban/components/KanbanBoard.tsx`

**В чём была проблема:**
Компоненты использовали деструктурирование всего Zustand store:
```typescript
// TasksTabs — подписка на весь store
const { tabs, activeTabId, setActiveTab, deleteTab } = useTasksTabsStore()

// KanbanBoardInternal — подписка на весь store
const { collapsedSections, showEmptySwimlanes, toggleSectionCollapse } = useKanbanUIStore()

// KanbanBoard standalone — подписка на весь store
const { filterString, setFilterString, getQueryParams } = useKanbanFiltersStore()
```

При любом изменении **любого** поля store — компонент перерендеривался, даже если использовал только 3 из 10 полей.

**Как влияло на приложение:**
- TasksTabs: ре-рендер при каждом изменении tabs store (включая reorder, canCreateTab и т.д.)
- KanbanBoard: ре-рендер при любом изменении UI/filter store (включая не используемые поля)

**Что изменили:**
Заменили деструктурирование на индивидуальные селекторы:
```typescript
// TasksTabs
const tabs = useTasksTabsStore((s) => s.tabs)
const activeTabId = useTasksTabsStore((s) => s.activeTabId)
const setActiveTab = useTasksTabsStore((s) => s.setActiveTab)
const deleteTab = useTasksTabsStore((s) => s.deleteTab)

// KanbanBoardInternal
const collapsedSections = useKanbanUIStore((s) => s.collapsedSections)
const showEmptySwimlanes = useKanbanUIStore((s) => s.showEmptySwimlanes)
const toggleSectionCollapse = useKanbanUIStore((s) => s.toggleSectionCollapse)

// KanbanBoard standalone
const filterString = useKanbanFiltersStore((s) => s.filterString)
const setFilterString = useKanbanFiltersStore((s) => s.setFilterString)
const getQueryParams = useKanbanFiltersStore((s) => s.getQueryParams)
```

**Дополнительно в TasksTabs:**
- Добавлен `useMemo` для `sortedTabs` — сортировка не пересчитывается без изменения `tabs`
- Добавлен `useCallback` для всех обработчиков (handleAddClick, handleEditClick, handleDeleteClick, handleModalClose)

**Дополнительно в TasksView:**
- `handleFilterChange` обёрнут в `useCallback` с `[updateActiveTabFilters]`
- Закомментированы неиспользуемые импорты и JSX для timeline/budgets (мёртвый код v2.0.0)

---

### 10. Полная подписка на `capacityOverrides` в sections-page

**Файлы:** `modules/sections-page/stores/useSectionsPageUIStore.ts`, `modules/sections-page/components/rows/DepartmentRow.tsx`, `modules/sections-page/components/rows/ProjectRow.tsx`

**В чём была проблема:**
`DepartmentRow` и `ProjectRow` подписывались на **весь** объект `capacityOverrides` из Zustand store:
```typescript
const capacityOverrides = useSectionsPageUIStore((s) => s.capacityOverrides)
```

Объект `capacityOverrides` содержит overrides для **всех** разделов на странице. При изменении override в одном разделе — **все** строки отделов и проектов перерендеривались, включая те, чьи разделы не затронуты.

**Как влияло на приложение:**
- Изменение capacity в одном разделе → каскадный ре-рендер всех DepartmentRow и ProjectRow на странице
- Каждый ре-рендер пересчитывает `useMemo` для агрегированной ёмкости
- На странице с 10 отделами × 5 проектов = 50+ лишних ре-рендеров при каждом изменении

**Что изменили:**

1. **Новый хук** `useMultipleSectionsCapacityOverrides(sectionIds)` в store:
```typescript
export function useMultipleSectionsCapacityOverrides(
  sectionIds: string[]
): Record<string, Record<string, number>> {
  return useSectionsPageUIStore(
    useShallow((state) => {
      const result: Record<string, Record<string, number>> = {}
      for (const id of sectionIds) {
        const overrides = state.capacityOverrides[id]
        if (overrides) result[id] = overrides
      }
      return result
    })
  )
}
```

2. **DepartmentRow** — подписка сужена до своих разделов:
```typescript
const allSections = useMemo(
  () => department.projects.flatMap((p) => p.objectSections),
  [department.projects]
)
const sectionIds = useMemo(() => allSections.map((os) => os.sectionId), [allSections])
const capacityOverrides = useMultipleSectionsCapacityOverrides(sectionIds)
```

3. **ProjectRow** — аналогичная замена:
```typescript
const sectionIds = useMemo(
  () => project.objectSections.map((os) => os.sectionId),
  [project.objectSections]
)
const capacityOverrides = useMultipleSectionsCapacityOverrides(sectionIds)
```

**Результат:** Компонент перерендеривается только когда меняются overrides **его** разделов, а не всех.

---

### 11. `hasChanges` использовал `useCallback` вместо `useMemo` в модалке загрузки

**Файл:** `modules/modals/hooks/useLoadingModal.ts`

**В чём была проблема:**
`hasChanges` был определён как `useCallback`:
```typescript
const hasChanges = useCallback((): boolean => {
  // ... Date parsing, string comparisons, float math
}, [mode, formData, initialLoading, selectedSectionId])
```
Но в return хука вызывался на **каждом рендере**:
```typescript
return { hasChanges: hasChanges() }
```

`useCallback` мемоизирует **ссылку на функцию**, а не результат. Вызов `hasChanges()` в return statement означал, что вычисление (создание Date объектов, форматирование строк, сравнения) выполнялось при **каждом рендере**.

**Что изменили:**
- `useCallback` → `useMemo` — мемоизирует **результат**, а не функцию
- `hasChanges: hasChanges()` → `hasChanges: hasChanges` — больше не вызывается на каждом рендере

**Дополнительно:**
- Удалены 3 `console.log` — один из них выполнялся на **каждом рендере** хука (строка 132), создавая объект для логирования

---

### 12. Чистые функции пересоздавались внутри тел компонентов модалки загрузки

**Файлы:** `modules/modals/components/loading-modal-new/LoadingModalNew.tsx`, `modules/modals/components/loading-modal-new/LoadingForm.tsx`, `modules/modals/components/loading-modal-new/ProjectTree.tsx`

**В чём была проблема:**
Чистые функции без closure-зависимостей определялись внутри тел компонентов и пересоздавались на каждом рендере:

| Файл | Функция | Описание |
|------|---------|----------|
| `LoadingModalNew.tsx` | `getIcon()` | Маппинг type → Lucide icon |
| `LoadingForm.tsx` | `getIcon()` | Дублирование той же функции |
| `ProjectTree.tsx` | `collectAllNodeIds()` | Рекурсивный сбор ID узлов дерева |
| `ProjectTree.tsx` | `getStageColor()` | Маппинг стадии проекта → Tailwind классы |
| `ProjectTree.tsx` | `getNodeColor()` | Маппинг типа узла → Tailwind классы |

`ProjectItem` рендерится для каждого проекта в списке — пересоздание 3 функций × N проектов на каждом рендере.

**Что изменили:**
- `getIcon` → вынесен как `getBreadcrumbIcon` + `BREADCRUMB_ICON_MAP` за пределы обоих компонентов
- `collectAllNodeIds`, `getStageColor`, `getNodeColor` → вынесены за пределы `ProjectItem` в module scope

---

## Затронутые файлы (аудит /tasks) — 10 файлов

| Файл | Изменение |
|------|-----------|
| `modules/tasks/components/TasksTabs.tsx` | Индивидуальные Zustand-селекторы, useMemo, useCallback |
| `modules/tasks/components/TasksView.tsx` | useCallback для handleFilterChange, закомментирован мёртвый код |
| `modules/kanban/components/KanbanBoard.tsx` | Индивидуальные селекторы для useKanbanUIStore и useKanbanFiltersStore |
| `modules/sections-page/stores/useSectionsPageUIStore.ts` | Новый хук useMultipleSectionsCapacityOverrides с useShallow |
| `modules/sections-page/components/rows/DepartmentRow.tsx` | Scoped подписка на capacityOverrides через useShallow |
| `modules/sections-page/components/rows/ProjectRow.tsx` | Scoped подписка на capacityOverrides через useShallow |
| `modules/modals/hooks/useLoadingModal.ts` | hasChanges: useCallback → useMemo, убраны console.log |
| `modules/modals/components/loading-modal-new/LoadingModalNew.tsx` | getIcon → hoisted getBreadcrumbIcon |
| `modules/modals/components/loading-modal-new/LoadingForm.tsx` | getIcon → hoisted getBreadcrumbIcon |
| `modules/modals/components/loading-modal-new/ProjectTree.tsx` | collectAllNodeIds, getStageColor, getNodeColor → hoisted |

---

## Аудит CRUD загрузок — 03.03.2026

### 13. Баг: `isMovingBetweenEmployees` всегда true → crash при пустом departments cache

**Файл:** `modules/modals/hooks/useLoadingMutations.ts`

**В чём была проблема:**
При перемещении загрузки между разделами на табе "Разделы" в консоли появлялась ошибка:
```
❌ [UPDATE onMutate] НЕ МОГУ добавить загрузку - originalLoading отсутствует!
```

Причина — двойная:
1. `isMovingBetweenEmployees` определялся как `input.employeeId !== undefined`, но `handleSave` в модалке **всегда** передаёт `employeeId` (даже если сотрудник не менялся). Поэтому флаг был **всегда true**.
2. Первый проход искал загрузку в departments cache, но если пользователь на табе "Разделы" — departments cache **пуст**. `originalLoading` оставался `null` → ошибка во втором проходе.

**Что изменили:**
1. Первый проход теперь **всегда** выполняется (не условно по `isMovingBetweenEmployees`)
2. `isMovingBetweenEmployees` определяется **после** нахождения загрузки — сравнение текущего и нового `employeeId`:
```typescript
const isMovingBetweenEmployees = !!(
  input.employeeId && originalEmployeeId && input.employeeId !== originalEmployeeId
)
```
3. Если загрузка не найдена в departments cache (`!loadingFound`) — optimistic update пропускается (данные обновятся через `invalidateQueries`)
4. Убран дублирующий поиск `originalLoading` из второго прохода
5. Убран `console.error` для невозможного теперь error-case

---

### 14. `hasErrorRef` в useMyWorkData — убрана зависимость `error` из useCallback

**Файл:** `modules/my-work/hooks/useMyWorkData.ts`

**В чём была проблема:**
`fetchAllData` имел `error` в dependency array `useCallback`. При ошибке → `setError` → `fetchAllData` пересоздаётся → `refetch` пересоздаётся. Хотя бесконечного цикла не было (useEffect с eslint-disable), `refetch` лишний раз пересоздавался при каждой ошибке.

**Что изменили:**
- Добавлен `hasErrorRef = useRef(false)` — ref-зеркало для `error` state
- Guard на строке 148 читает `hasErrorRef.current` вместо `error` из замыкания
- `error` убран из deps `useCallback` → пустой массив `[]`
- `hasErrorRef` синхронизируется: `true` при catch, `false` при начале нового fetch
- Обновлён eslint-disable комментарий

---

### 15. Лишняя инвалидация `projects.all` во всех CRUD мутациях загрузок

**Файл:** `modules/modals/hooks/useLoadingMutations.ts`

**В чём была проблема:**
Все 4 мутации (create, update, archive, delete) выполняли 4 лишние операции с `projects.all` cache:
- `cancelQueries({ queryKey: queryKeys.projects.all })` — прерывал текущий refetch проектов
- `getQueriesData({ queryKey: queryKeys.projects.all })` — делал snapshot данных
- `invalidateQueries({ queryKey: queryKeys.projects.all })` — принудительный refetch проектов
- `previousProjectsData` rollback в `onError` — откат данных

Но **ни одна мутация не модифицировала projects cache оптимистично** — поиск `setQueriesData.*projects` / `setQueryData.*projects` дал **0 результатов**. Realtime config для таблицы `loadings` тоже не инвалидирует `projects.all` — подтверждение что проекты не зависят от загрузок.

**Что изменили:**
- Убран `cancelQueries` для `projects.all` из 4 мутаций
- Убран `getQueriesData` snapshot для `projects.all` из 4 мутаций
- Убран `invalidateQueries` для `projects.all` из 4 onSuccess handlers
- Убран `previousProjectsData` rollback из 4 onError handlers
- Убрано поле `previousProjectsData` из типа `OptimisticContext`

**Результат:** Минус 16 лишних операций (4 на каждую мутацию × 4 мутации).

---

### 16. ~30 debug console.log в модуле модалок

**Файлы:** `modules/modals/actions/projects-tree-rpc.ts`, `modules/modals/actions/projects-tree.ts`, `modules/modals/actions/decomposition-stages.ts`, `modules/modals/hooks/useProjectsList.ts`, `modules/modals/hooks/useProjectTree.ts`, `modules/modals/components/checkpoint/CheckpointCreateModal.tsx`

**В чём была проблема:**
Server actions и hooks содержали ~30 debug-логов с таймингами (`performance.now()`), dump данных и emoji-префиксами:
```
📡 [fetchProjectsListRPC] Начало запроса: {...}
⏱️ [fetchProjectsListRPC] Client created: 12.34ms
⏱️ [fetchProjectsListRPC] RPC completed: 45.67ms
✅ [fetchProjectsListRPC] Total time: 58.01ms | Projects: 42
🔧 buildTree start: { totalNodes: 150, ... }
🔍 buildTree debug: { rootsCount: 1, ... }
🌲 Построено дерево проекта: { nodesFlat: 150, ... }
```

Эти логи вызывались при **каждом** открытии модалки загрузки и при каждом выборе проекта в дереве.

**Что изменили:**
- Убраны все `console.log` с таймингами и debug-информацией
- Убраны переменные `performance.now()` / `startTime` / `queryTime` / `totalTime` и т.д.
- Оставлены `console.error` для реальных ошибок (Supabase errors, unexpected errors)
- Оставлены `console.warn` для проблем с данными (дублирующиеся ID в breadcrumbs)

---

### 17. Удалён закомментированный мёртвый код в TasksView

**Файл:** `modules/tasks/components/TasksView.tsx`

**В чём была проблема:**
В предыдущей сессии аудита код timeline/budgets был закомментирован. Code review указал, что закомментированный код должен быть удалён, а не оставлен.

**Что изменили:**
- Удалены закомментированные импорты `ResourceGraphInternal` и `BudgetsViewInternal`
- Удалены закомментированные JSX-блоки для timeline и budgets viewMode

---

## Затронутые файлы (аудит CRUD загрузок) — 10 файлов

| Файл | Изменение |
|------|-----------|
| `modules/modals/hooks/useLoadingMutations.ts` | Fix isMovingBetweenEmployees, убран projects.all, убран console.error |
| `modules/my-work/hooks/useMyWorkData.ts` | hasErrorRef вместо error в deps, обновлён eslint-disable комментарий |
| `modules/modals/actions/projects-tree-rpc.ts` | Убраны ~6 console.log с таймингами |
| `modules/modals/actions/projects-tree.ts` | Убраны ~11 console.log с таймингами и data dump |
| `modules/modals/actions/decomposition-stages.ts` | Убраны 2 console.log |
| `modules/modals/hooks/useProjectsList.ts` | Убраны 4 console.log с debug и таймингами |
| `modules/modals/hooks/useProjectTree.ts` | Убраны 3 console.log (buildTree debug + tree dump) |
| `modules/modals/components/checkpoint/CheckpointCreateModal.tsx` | Убран console.log в onSuccess |
| `modules/tasks/components/TasksView.tsx` | Удалён закомментированный мёртвый код (imports + JSX) |

---

## Аудит модуля `/users` — 06.03.2026

### 18. Несуществующий тип `User` из `@/types/db`

**Файлы:** `modules/users/components/current-user-card.tsx`, `modules/users/components/user-dialog.tsx`, `modules/users/components/users-list.tsx`, `modules/users/components/user-filters.tsx`, `modules/users/components/payment-list.tsx`

**В чём была проблема:**
5 компонентов импортировали `import type { User } from "@/types/db"`, но этот тип **не существует** в файле `types/db.ts` — он был удалён при регенерации типов (`npm run db:types`). TypeScript не выдавал ошибку на build, потому что ошибки были замаскированы другими pre-existing ошибками.

При этом в `modules/users/lib/types.ts` уже существовал интерфейс `User`, но с другой структурой (DB-ориентированный: `first_name`, `department_id`), тогда как компоненты ожидали презентационный формат (`name`, `department`, `team`).

**Что изменили:**
- Создан общий интерфейс `UserPresentation` в `modules/users/lib/types.ts` с точными полями презентационного формата
- Все 5 компонентов переведены на `import type { UserPresentation as User } from "@/modules/users/lib/types"`
- В `payment-list.tsx` дополнительно исправлен именованный импорт `{ PaymentDialog }` → default import `PaymentDialog`

---

### 19. camelCase vs snake_case в обращениях к `UserProfile` (Zustand store)

**Файлы:** `modules/users/components/user-dialog.tsx`, `modules/users/components/users-list.tsx`

**В чём была проблема:**
Код обращался к полям `UserProfile` через camelCase (`subdivisionId`, `departmentId`, `teamId`), но интерфейс `UserProfile` в `stores/useUserStore.ts` использует snake_case (`subdivision_id`, `department_id`, `team_id`). Это приводило к TypeScript ошибкам и потенциально к runtime-багам — проверки прав (`canEditSalary`, `canViewRate`) всегда получали `undefined` вместо реальных ID.

**user-dialog.tsx:**
```typescript
// Было (не работало — поля не существуют):
currentUserProfile?.subdivisionId
currentUserProfile?.departmentId

// Стало:
currentUserProfile?.subdivision_id
currentUserProfile?.department_id
```

**users-list.tsx:**
```typescript
// Было:
profile?.departmentId || profile?.department_id
profile?.teamId || profile?.team_id
profile?.subdivisionId || (profile as any)?.subdivision_id

// Стало:
profile?.department_id
profile?.team_id
profile?.subdivision_id
```

---

### 20. camelCase в `setUser` profile при обновлении профиля

**Файл:** `modules/users/components/user-dialog.tsx`

**В чём была проблема:**
После сохранения профиля, обновление Zustand store использовало camelCase ключи и несуществующие поля:
```typescript
// Было:
profile: {
  firstName: freshProfile.first_name,      // ❌ UserProfile не имеет firstName
  lastName: freshProfile.last_name,         // ❌
  departmentId: freshProfile.department_id, // ❌
  country: freshProfile.country_name,       // ❌ profiles table не имеет country_name
  city: freshProfile.city_name,             // ❌ profiles table не имеет city_name
}

// Стало:
profile: {
  first_name: freshProfile.first_name,
  last_name: freshProfile.last_name,
  department_id: freshProfile.department_id,
  city_id: freshProfile.city_id,
  // country/city_name не доступны из profiles — используем city_id
}
```

**Как влияло на приложение:**
- После сохранения профиля Zustand store получал объект с неизвестными ключами
- Реальные данные профиля в store не обновлялись до перезагрузки страницы

---

### 21. Nullable поля из DB views не приводились к strict типам

**Файлы:** `modules/cache/actions/reference-data.ts`, `modules/users/admin/components/TeamHeadModal.tsx`, `modules/users/hooks/useUserAnalytics.ts`

**В чём была проблема:**
Supabase автогенерированные типы из views возвращают nullable поля (`string | null`), но интерфейсы в коде ожидали strict `string`. Это создавало TypeScript ошибки при маппинге.

**reference-data.ts** — 6 функций + batch function:
```typescript
// Было:
name: d.department_name,  // string | null → CachedDepartment.name: string ❌

// Стало:
name: d.department_name ?? "",
```
Исправлены маппинги для departments, teams, positions, categories, subdivisions — и в индивидуальных функциях, и в `getAllReferenceData`.

**TeamHeadModal.tsx:**
- Интерфейс `Team`: `departmentId: string` → `string | null`, `departmentName: string` → `string | null` (поля не обязательны для модалки)
- `view_users` query: убран неиспользуемый `team_name` из `.select()`
- Добавлен `.filter()` с type guard для nullable `user_id`/`email` из view

**useUserAnalytics.ts:**
```typescript
// Было — name: string | null не совместим с AnalyticsDataPoint.name: string:
return { departmentData, teamData, categoryData, monthlyData, activeUsers }

// Стало:
const clean = <T extends { name: string | null }>(items: T[]) =>
  items.filter((i): i is T & { name: string } => i.name != null)
return { departmentData: clean(departmentData), ... }
```

---

### 22. Переименование пропа `fallbackUser` → `user` в CurrentUserCard

**Файлы:** `modules/users/components/current-user-card.tsx`, `modules/users/pages/users-page.tsx`

**В чём была проблема:**
Проп `fallbackUser` вводил в заблуждение — он не является "fallback", а единственный источник данных пользователя из родительского TanStack Query.

**Что изменили:**
- Интерфейс: `fallbackUser: User` → `user: UserPresentation`
- Деструктуризация: `{ fallbackUser }` → `{ user: userProp }`
- Внутренние ссылки: `fallbackUser` → `userProp`
- Родительский компонент: `<CurrentUserCard fallbackUser={{...}}` → `<CurrentUserCard user={{...}}`

---

### 23. Silent error catch в ReferencePrefetch

**Файл:** `modules/cache/providers/reference-prefetch.tsx`

**В чём была проблема:**
Ошибка batch prefetch справочников проглатывалась без логирования:
```typescript
} catch {
  // Не критично — хуки загрузят данные при необходимости
}
```

**Что изменили:**
Добавлен Sentry breadcrumb для отслеживания:
```typescript
} catch (err) {
  Sentry.addBreadcrumb({ category: 'prefetch', level: 'warning', message: 'Batch reference prefetch failed', data: { error: String(err) } })
}
```

Не влияет на runtime — breadcrumb записывается локально и попадает в Sentry только если позже произойдёт реальная ошибка.

---

### 24. `getWorkLocationInfo` не принимал `undefined`

**Файл:** `modules/users/components/users-list.tsx`

**В чём была проблема:**
Функция `getWorkLocationInfo(location: string | null)` вызывалась с `user.workLocation`, который имеет тип `"office" | "remote" | "hybrid" | undefined`. TypeScript ошибка: `undefined` не совместим с `string | null`.

**Что изменили:**
`(location: string | null)` → `(location: string | null | undefined)`

---

## Затронутые файлы (аудит /users) — 13 файлов

| Файл | Изменение |
|------|-----------|
| `modules/users/lib/types.ts` | Новый интерфейс `UserPresentation` |
| `modules/users/components/current-user-card.tsx` | `fallbackUser` → `user`, импорт User → UserPresentation |
| `modules/users/components/user-dialog.tsx` | Импорт User → UserPresentation, fix camelCase → snake_case для UserProfile, fix setUser profile |
| `modules/users/components/users-list.tsx` | Импорт User → UserPresentation, fix camelCase → snake_case, getWorkLocationInfo accepts undefined |
| `modules/users/components/user-filters.tsx` | Импорт User → UserPresentation |
| `modules/users/components/payment-list.tsx` | Импорт User → UserPresentation, fix PaymentDialog default import |
| `modules/users/pages/users-page.tsx` | Проп `fallbackUser` → `user` |
| `modules/users/hooks/useUserAnalytics.ts` | Фильтрация nullable names из DB |
| `modules/users/admin/components/TeamHeadModal.tsx` | Team interface nullable fields, убран team_name из select, type guard для user_id/email |
| `modules/users/admin/components/TeamsTab.tsx` | Исправлена передача team prop в TeamHeadModal |
| `modules/cache/actions/reference-data.ts` | `?? ""` для nullable полей во всех маппингах |
| `modules/cache/providers/reference-prefetch.tsx` | Sentry breadcrumb вместо silent catch |
