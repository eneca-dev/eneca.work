# Модуль бизнес-модалок

Централизованные модальные окна для бизнес-сущностей, переиспользуемые во всём приложении.

## Концепция

Модалки для работы с бизнес-сущностями (бюджеты, отчёты, разделы и т.д.) используются в разных модулях:
- **Бюджет** — можно создать в планировании, канбане, модалке раздела
- **Отчёт о работе** — из графика ресурсов, планирования, дашборда
- **Загрузка сотрудника** — из планирования, канбана, профиля сотрудника

Чтобы не дублировать код, все бизнес-модалки живут здесь.

## Структура

```
modules/modals/
├── actions/
│   └── updateSection.ts         # Server Action для обновления раздела
├── components/
│   ├── budget/
│   │   └── BudgetCreateModal.tsx
│   ├── progress/
│   │   └── ProgressUpdateDialog.tsx
│   ├── section/                  # ✅ Рефакторинг завершён
│   │   ├── SectionModal.tsx      # Главная модалка раздела (575 строк)
│   │   ├── SectionMetrics.tsx    # Компонент метрик с тултипами
│   │   ├── StatusDropdown.tsx    # Выпадающий список статусов
│   │   ├── ResponsibleDropdown.tsx # Выбор ответственного с поиском
│   │   └── DateRangeInput.tsx    # Ввод диапазона дат
│   ├── worklog/
│   │   └── WorkLogCreateModal.tsx
│   ├── stage/                    # (planned)
│   ├── item/                     # (planned)
│   ├── loading/                  # (planned)
│   └── employee/                 # (planned)
├── hooks/
│   ├── useUpdateSection.ts       # Mutation hook для обновления раздела
│   ├── useProgressUpdateModal.ts
│   └── index.ts
├── types/
│   └── index.ts                  # BaseModalProps и другие типы
├── stores/
│   └── modal-store.ts            # Zustand store для глобального управления
├── DESIGN_GUIDE.md               # Дизайн-гайд (цвета, типографика, компоненты)
└── index.ts                      # Public API
```

## Архитектура SectionModal (Reference Implementation)

SectionModal — эталонная реализация slide-in panel модалки с соблюдением всех паттернов.

### Используемые паттерны

#### 1. Cache Module Integration
```tsx
// Данные загружаются через cache hooks
import { useUsers, type CachedUser } from '@/modules/cache'
const { data: users, isLoading } = useUsers()

// Мутации через cache mutation hooks
import { useUpdateSection } from '../../hooks/useUpdateSection'
const updateMutation = useUpdateSection()

// Мутация с автоматической инвалидацией кеша
await updateMutation.mutateAsync({
  sectionId,
  data: { name: 'Новое название' },
})
```

#### 2. Mutation Hook (useUpdateSection)
```tsx
// modules/modals/hooks/useUpdateSection.ts
import { createSimpleMutation, queryKeys } from '@/modules/cache'
import { updateSection } from '../actions/updateSection'

export const useUpdateSection = createSimpleMutation<UpdateSectionParams, void>({
  mutationFn: async ({ sectionId, data }) => updateSection(sectionId, data),
  invalidateKeys: [
    [...queryKeys.sections.all],
    [...queryKeys.resourceGraph.all],
    [...queryKeys.projects.all],
  ],
})
```

#### 3. Form Handling (react-hook-form + zod)
```tsx
const sectionFormSchema = z.object({
  name: z.string().min(1, 'Название обязательно'),
  description: z.string().optional(),
  statusId: z.string().nullable().optional(),
  responsibleId: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
})

const form = useForm<SectionFormData>({
  resolver: zodResolver(sectionFormSchema),
  defaultValues: { ... },
})
```

#### 4. Accessibility
```tsx
// Focus trap
import * as FocusScope from '@radix-ui/react-focus-scope'
<FocusScope.Root trapped={isAnimating} loop>

// ARIA attributes
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="section-modal-title"
>

// Label associations
<label htmlFor="section-name" className="sr-only">Название</label>
<input id="section-name" {...form.register('name')} />

// Semantic HTML
<header> / <main> / <section aria-labelledby="...">
```

#### 5. Animation Pattern
```tsx
const [isVisible, setIsVisible] = useState(false)
const [isAnimating, setIsAnimating] = useState(false)

useEffect(() => {
  if (isOpen) {
    setIsVisible(true)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setIsAnimating(true))
    })
  } else {
    setIsAnimating(false)
    const timer = setTimeout(() => setIsVisible(false), ANIMATION_DURATION)
    return () => clearTimeout(timer)
  }
}, [isOpen])
```

### Извлечённые компоненты

| Компонент | Строк | Ответственность |
|-----------|-------|-----------------|
| `StatusDropdown` | 168 | Выбор статуса с listbox pattern |
| `ResponsibleDropdown` | 207 | Выбор пользователя с поиском |
| `DateRangeInput` | 121 | Два date input с иконками |
| `SectionMetrics` | 218 | Метрики План/Факт/Бюджет с тултипами |

## Паттерны использования

### 1. Локальное использование (в компоненте)

```tsx
import { BudgetCreateModal, useBudgetModal } from '@/modules/modals'

function SectionCard({ sectionId }) {
  const { isOpen, open, close, data } = useBudgetModal()

  return (
    <>
      <Button onClick={() => open({ sectionId })}>
        Добавить бюджет
      </Button>

      <BudgetCreateModal
        isOpen={isOpen}
        onClose={close}
        sectionId={data?.sectionId}
        onSuccess={() => {
          close()
          toast.success('Бюджет создан')
        }}
      />
    </>
  )
}
```

### 2. Глобальное использование (через store)

```tsx
// Из любого места в приложении
import { useModalStore } from '@/modules/modals'

function AnyComponent() {
  const openBudgetModal = useModalStore(s => s.openBudgetModal)

  return (
    <Button onClick={() => openBudgetModal({ sectionId: '123' })}>
      Добавить бюджет
    </Button>
  )
}

// В layout/providers — глобальный рендер модалок
import { GlobalModals } from '@/modules/modals'

function Layout({ children }) {
  return (
    <>
      {children}
      <GlobalModals />
    </>
  )
}
```

## Конвенции

### Именование

- `*CreateModal` — создание сущности
- `*EditModal` — редактирование существующей
- `*ViewModal` — просмотр (read-only)
- `*Modal` — универсальная модалка (view + edit)
- `*DeleteConfirm` — подтверждение удаления

### Props модалок

Каждая модалка принимает стандартный набор props:

```tsx
interface BaseModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void  // Callback после успешного действия
}

// Для Create модалок
interface CreateModalProps extends BaseModalProps {
  // Контекст создания (к чему привязываем)
  sectionId?: string
  stageId?: string
  // ...
}

// Для Edit/View модалок
interface EditModalProps extends BaseModalProps {
  // ID сущности для загрузки
  id: string
}
```

### Состояния формы

Все модалки с формами должны:
- Показывать loading при отправке
- Показывать ошибки валидации
- Блокировать повторную отправку
- Очищать форму при закрытии

### Мутации

Модалки используют мутации через cache module:

```tsx
// hooks/useUpdateSection.ts
import { createSimpleMutation, queryKeys } from '@/modules/cache'

export const useUpdateSection = createSimpleMutation({
  mutationFn: updateSection,
  invalidateKeys: [
    [...queryKeys.sections.all],
    [...queryKeys.resourceGraph.all],
  ],
})

// В компоненте
const updateMutation = useUpdateSection()

const handleSave = async (data) => {
  await updateMutation.mutateAsync({ sectionId, data })
  onSuccess?.()
}
```

## Зависимости

Модуль использует:
- `@/modules/cache` — для мутаций, данных и инвалидации кеша
- `@radix-ui/react-focus-scope` — для focus trap
- `react-hook-form` + `zod` — для форм
- `zustand` — для глобального store (опционально)
- `@/modules/resource-graph/utils` — shared helpers (getInitials)

## Accessibility Checklist

Все модалки должны соответствовать:

- [x] `role="dialog"` и `aria-modal="true"`
- [x] `aria-labelledby` связан с заголовком
- [x] Focus trap (FocusScope.Root)
- [x] Escape закрывает модалку
- [x] `aria-label` на кнопке закрытия
- [x] Labels связаны с inputs через `htmlFor/id`
- [x] `role="listbox"` и `aria-selected` в dropdowns
- [x] Loading states с aria-label
- [x] `role="alert"` для сообщений об ошибках

## Roadmap

### Завершено
- [x] SectionModal (slide-in panel)
- [x] SectionMetrics
- [x] StatusDropdown
- [x] ResponsibleDropdown
- [x] DateRangeInput
- [x] useUpdateSection hook
- [x] BudgetCreateModal
- [x] ProgressUpdateDialog

### В процессе
- [ ] Миграция useSectionStatuses на cache module

### Планируется
- [ ] WorkLogCreateModal / WorkLogEditModal
- [ ] LoadingCreateModal
- [ ] GlobalModals компонент
- [ ] useModalStore для глобального управления
- [ ] Keyboard shortcuts (Cmd+B для бюджета и т.д.)

## Дизайн-гайд

Подробные правила оформления модалок (цвета, типографика, компоненты) см. в [DESIGN_GUIDE.md](./DESIGN_GUIDE.md).

### Быстрая справка

```
Overlay:        bg-black/35 backdrop-blur-[2px]
Panel:          bg-gradient-to-b from-slate-900 to-slate-950
Labels:         text-[10px] font-medium text-slate-400 uppercase tracking-wider
Focus:          border-amber-500/50 ring-2 ring-amber-500/15
Primary action: text-amber-400 hover:bg-amber-500/10
```
