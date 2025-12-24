# Модуль бизнес-модалок

Централизованные модальные окна для бизнес-сущностей, переиспользуемые во всём приложении.

## Концепция

Модалки для работы с бизнес-сущностями (бюджеты, отчёты, разделы и т.д.) используются в разных модулях:
- **Бюджет** — можно создать в планировании, канбане, модалке раздела
- **Отчёт о работе** — из графика ресурсов, планирования, дашборда
- **Загрузка сотрудника** — из планирования, канбана, профиля сотрудника
- **Декомпозиция** — этапы и задачи раздела с drag-and-drop

Чтобы не дублировать код, все бизнес-модалки живут здесь.

## Структура

```
modules/modals/
├── actions/
│   ├── index.ts                      # Public API actions
│   ├── updateSection.ts              # Server Action для обновления раздела
│   ├── getDecompositionStage.ts      # Bootstrap данных декомпозиции (RPC)
│   ├── updateDecompositionStage.ts   # CRUD для этапов декомпозиции
│   ├── updateDecompositionItem.ts    # CRUD для задач декомпозиции
│   ├── readinessCheckpoints.ts       # CRUD для контрольных точек готовности
│   ├── getWorkCategories.ts          # Справочник: категории работ
│   ├── getDifficultyLevels.ts        # Справочник: уровни сложности
│   └── getStageStatuses.ts           # Справочник: статусы этапов
├── components/
│   ├── budget/
│   │   ├── BudgetCreateModal.tsx     # Создание бюджета
│   │   └── index.ts
│   ├── checkpoint/
│   │   ├── CheckpointCreateModal.tsx # Создание контрольной точки
│   │   └── index.ts
│   ├── loading/
│   │   ├── LoadingModal.tsx          # Модалка загрузки сотрудника
│   │   └── index.ts
│   ├── progress/
│   │   ├── ProgressUpdateDialog.tsx  # Диалог обновления прогресса
│   │   └── index.ts
│   ├── section/
│   │   ├── SectionModal.tsx          # Главная модалка раздела (slide-in panel)
│   │   ├── SectionMetrics.tsx        # Компонент метрик План/Факт/Бюджет
│   │   ├── StatusDropdown.tsx        # Выпадающий список статусов
│   │   ├── ResponsibleDropdown.tsx   # Выбор ответственного с поиском
│   │   ├── DateRangeInput.tsx        # Ввод диапазона дат
│   │   ├── tabs/
│   │   │   ├── OverviewTab.tsx       # Вкладка "Обзор"
│   │   │   ├── TasksTab.tsx          # Вкладка "Задачи" (декомпозиция)
│   │   │   ├── ReadinessTab.tsx      # Вкладка "Готовность"
│   │   │   └── index.ts
│   │   ├── decomposition/
│   │   │   ├── StagesManager.tsx     # Управление этапами и задачами
│   │   │   ├── StageCard.tsx         # Карточка этапа (collapsible)
│   │   │   ├── StageHeader.tsx       # Заголовок этапа с actions
│   │   │   ├── StageResponsibles.tsx # Аватары ответственных
│   │   │   ├── DecompositionTable.tsx # Таблица задач
│   │   │   ├── DecompositionRow.tsx  # Строка задачи (editable)
│   │   │   ├── dialogs/
│   │   │   │   ├── AssignResponsiblesDialog.tsx
│   │   │   │   ├── DeleteConfirmDialog.tsx
│   │   │   │   ├── MoveItemsDialog.tsx
│   │   │   │   ├── PasteDialog.tsx   # Вставка из Excel
│   │   │   │   └── index.ts
│   │   │   ├── constants.ts          # Константы (ширина колонок и т.д.)
│   │   │   ├── types.ts              # Типы декомпозиции
│   │   │   ├── utils.ts              # Хелперы
│   │   │   └── index.ts
│   │   └── index.ts
│   ├── stage/
│   │   ├── StageModal.tsx            # Модалка стадии проекта
│   │   ├── ResponsiblesDropdown.tsx  # Выбор ответственных (multi)
│   │   └── index.ts
│   ├── task/
│   │   ├── TaskCreateModal.tsx       # Создание задачи декомпозиции
│   │   ├── TaskSidebar.tsx           # Боковая панель задачи
│   │   └── index.ts
│   └── worklog/
│       ├── WorkLogCreateModal.tsx    # Создание отчёта о работе
│       └── index.ts
├── hooks/
│   ├── index.ts                      # Public API hooks
│   ├── useModal.ts                   # Базовый хук управления модалками
│   ├── useUpdateSection.ts           # Mutation: обновление раздела
│   ├── useDecompositionStage.ts      # Query: bootstrap данных декомпозиции
│   ├── useUpdateDecompositionStage.ts # Mutations: CRUD этапов
│   ├── useUpdateDecompositionItem.ts # Mutations: CRUD задач
│   ├── useReadinessCheckpoints.ts    # Query + Mutations: контрольные точки
│   ├── useWorkCategories.ts          # Query: категории работ
│   ├── useDifficultyLevels.ts        # Query: уровни сложности
│   └── useStageStatuses.ts           # Query: статусы этапов
├── types/
│   └── index.ts                      # BaseModalProps и другие типы
├── stores/
│   └── modal-store.ts                # Zustand store для глобального управления
├── DESIGN_GUIDE.md                   # Дизайн-гайд (цвета, типографика)
└── index.ts                          # Public API
```

## Архитектура загрузки данных

### Bootstrap Pattern (оптимизация)

Для модалки раздела используется паттерн bootstrap — загрузка всех данных одним RPC-запросом:

```typescript
// actions/getDecompositionStage.ts
export async function getDecompositionBootstrap(sectionId: string) {
  // Один запрос возвращает:
  // - stages: этапы декомпозиции
  // - items: задачи декомпозиции
  // - categories: справочник категорий работ
  // - difficulties: справочник уровней сложности
  // - statuses: справочник статусов этапов
  // - profiles: профили для ответственных
}

// hooks/useDecompositionStage.ts
export const useDecompositionBootstrap = createDetailCacheQuery({
  queryKey: (sectionId) => queryKeys.decomposition.bootstrap(sectionId),
  queryFn: getDecompositionBootstrap,
  staleTime: staleTimePresets.fast,
})
```

**Преимущества:**
- 1 HTTP запрос вместо 6
- Консистентные данные
- Быстрый Time-to-Interactive

### Employees (отдельный запрос)

Сотрудники загружаются отдельно, так как нужны дополнительные данные (аватары, должности):

```typescript
export const useEmployees = createCacheQuery<Employee[], void>({
  queryKey: () => queryKeys.employees.list(),
  queryFn: getEmployees,
  staleTime: staleTimePresets.medium,
})
```

## Cache Module Integration

Все hooks используют фабрики из cache module:

```typescript
// Query хуки
import { createDetailCacheQuery, createCacheQuery, queryKeys } from '@/modules/cache'

// Mutation хуки
import { createCacheMutation, createSimpleMutation, queryKeys } from '@/modules/cache'
```

### Пример mutation с optimistic update

```typescript
// hooks/useUpdateDecompositionItem.ts
export const useUpdateDecompositionItem = createCacheMutation<UpdateItemInput, ItemResult>({
  mutationFn: updateDecompositionItem,
  invalidateKeys: () => [
    queryKeys.decomposition.all,
    queryKeys.sections.all,
  ],
})
```

## Realtime синхронизация

Таблицы декомпозиции подписаны на realtime обновления:

| Таблица | Инвалидируемые ключи |
|---------|---------------------|
| `decomposition_stages` | `decomposition.all`, `sections.all`, `resourceGraph.all`, `kanban.all` |
| `decomposition_items` | `decomposition.all`, `sections.all`, `resourceGraph.all`, `kanban.all` |
| `section_readiness_checkpoints` | `resourceGraph.all` |
| `section_readiness_snapshots` | `resourceGraph.all` |

## Server Actions

Все Server Actions:
- Возвращают `ActionResult<T>`
- Содержат auth checks
- Типизированы строго (без `any`)

```typescript
// Пример структуры
export async function updateDecompositionStage(
  input: UpdateStageInput
): Promise<ActionResult<StageResult>> {
  const supabase = await createClient()

  // Auth check
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'Не авторизован' }
  }

  // ... логика
}
```

## Паттерны использования

### 1. Локальное использование (в компоненте)

```tsx
import { BudgetCreateModal } from '@/modules/modals'

function SectionCard({ sectionId }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
        Добавить бюджет
      </Button>

      <BudgetCreateModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        entityType="section"
        entityId={sectionId}
        entityName="Раздел АР"
        onSuccess={() => toast.success('Бюджет создан')}
      />
    </>
  )
}
```

### 2. Глобальное использование (через store)

```tsx
import { useModalStore } from '@/modules/modals'

function AnyComponent() {
  const openBudgetModal = useModalStore(s => s.openBudgetModal)

  return (
    <Button onClick={() => openBudgetModal({ sectionId: '123' })}>
      Добавить бюджет
    </Button>
  )
}
```

## Конвенции

### Именование

- `*CreateModal` — создание сущности
- `*EditModal` — редактирование существующей
- `*ViewModal` — просмотр (read-only)
- `*Modal` — универсальная модалка (view + edit)
- `*Sidebar` — боковая панель
- `*Dialog` — небольшой диалог
- `*DeleteConfirm` — подтверждение удаления

### Props модалок

```tsx
interface BaseModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}
```

### Валюта

- Единственная валюта: **BYN** (белорусский рубль)
- Формат: `1.2M BYN`, `123K BYN`, `999 BYN`
- Никогда не использовать ₽ или другие символы

## Зависимости

- `@/modules/cache` — query/mutation hooks, realtime
- `@radix-ui/react-focus-scope` — focus trap
- `react-hook-form` + `zod` — формы
- `zustand` — глобальный store (опционально)
- `@dnd-kit` — drag-and-drop в декомпозиции

## Accessibility Checklist

- [x] `role="dialog"` и `aria-modal="true"`
- [x] `aria-labelledby` связан с заголовком
- [x] Focus trap (FocusScope.Root)
- [x] Escape закрывает модалку
- [x] `aria-label` на кнопке закрытия
- [x] Labels связаны с inputs через `htmlFor/id`
- [x] `role="listbox"` и `aria-selected` в dropdowns
- [x] Loading states с aria-label

## Roadmap

### Завершено
- [x] SectionModal (slide-in panel с табами)
- [x] SectionMetrics (План/Факт/Бюджет)
- [x] StatusDropdown, ResponsibleDropdown, DateRangeInput
- [x] useUpdateSection hook
- [x] BudgetCreateModal
- [x] ProgressUpdateDialog
- [x] CheckpointCreateModal
- [x] LoadingModal
- [x] StageModal
- [x] TaskCreateModal, TaskSidebar
- [x] WorkLogCreateModal
- [x] **Декомпозиция раздела:**
  - [x] StagesManager — управление этапами
  - [x] DecompositionTable — таблица задач
  - [x] Drag-and-drop (items + stages)
  - [x] Inline editing
  - [x] Bulk actions (перемещение, удаление)
  - [x] Вставка из Excel (PasteDialog)
  - [x] Назначение ответственных
- [x] Bootstrap data loading (оптимизация)
- [x] Auth checks во всех Server Actions
- [x] Типизация RPC ответов (без `any`)

### Планируется
- [ ] GlobalModals компонент
- [ ] useModalStore для глобального управления
- [ ] Keyboard shortcuts (Cmd+B для бюджета и т.д.)
- [ ] Undo/Redo для декомпозиции

## Дизайн-гайд

Подробные правила оформления модалок см. в [DESIGN_GUIDE.md](./DESIGN_GUIDE.md).

### Быстрая справка

```
Overlay:        bg-black/35 backdrop-blur-[2px]
Panel:          bg-gradient-to-b from-slate-900 to-slate-950
Labels:         text-[10px] font-medium text-slate-400 uppercase tracking-wider
Focus:          border-amber-500/50 ring-2 ring-amber-500/15
Primary action: text-amber-400 hover:bg-amber-500/10
```
