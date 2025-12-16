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
├── components/
│   ├── budget/              # Модалки бюджетов
│   │   ├── BudgetCreateModal.tsx
│   │   ├── BudgetEditModal.tsx
│   │   └── BudgetViewModal.tsx
│   ├── worklog/             # Модалки отчётов о работе
│   │   ├── WorkLogCreateModal.tsx
│   │   ├── WorkLogEditModal.tsx
│   │   └── WorkLogViewModal.tsx
│   ├── section/             # Модалки разделов
│   │   ├── SectionViewModal.tsx
│   │   └── SectionEditModal.tsx
│   ├── stage/               # Модалки этапов декомпозиции
│   ├── item/                # Модалки задач
│   ├── loading/             # Модалки загрузок сотрудников
│   └── employee/            # Модалки сотрудников
├── hooks/
│   ├── useBudgetModal.ts    # Хук для управления модалкой бюджета
│   ├── useWorkLogModal.ts
│   └── index.ts
├── types/
│   └── index.ts             # Типы для модалок
├── stores/
│   └── modal-store.ts       # Zustand store для глобального управления
└── index.ts                 # Public API
```

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

Модалки используют мутации из соответствующих модулей:

```tsx
// BudgetCreateModal.tsx
import { useCreateBudget } from '@/modules/budgets'

function BudgetCreateModal({ onSuccess, ...props }) {
  const { mutate, isPending } = useCreateBudget()

  const onSubmit = (data) => {
    mutate(data, {
      onSuccess: () => {
        onSuccess?.()
      }
    })
  }
  // ...
}
```

## Зависимости

Модуль использует:
- `@/components/modals` — базовые компоненты (Modal, ModalHeader, etc.)
- `@/modules/cache` — для мутаций и данных
- `react-hook-form` + `zod` — для форм
- `zustand` — для глобального store (опционально)

## Roadmap

### Фаза 1: Основные модалки
- [ ] BudgetCreateModal
- [ ] BudgetEditModal
- [ ] WorkLogCreateModal
- [ ] WorkLogEditModal

### Фаза 2: Модалки сущностей
- [ ] SectionViewModal
- [ ] SectionEditModal
- [ ] StageViewModal
- [ ] ItemEditModal
- [ ] LoadingCreateModal

### Фаза 3: Улучшения
- [ ] GlobalModals компонент
- [ ] useModalStore для глобального управления
- [ ] Keyboard shortcuts (Cmd+B для бюджета и т.д.)
- [ ] Prefetch данных при hover

## Пример полной модалки

```tsx
'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Modal, ModalButton } from '@/components/modals'
import { useCreateBudget } from '@/modules/budgets'

const schema = z.object({
  name: z.string().min(1, 'Название обязательно'),
  amount: z.number().min(0, 'Сумма должна быть положительной'),
  typeId: z.string().uuid('Выберите тип бюджета'),
})

type FormData = z.infer<typeof schema>

interface BudgetCreateModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  sectionId: string
}

export function BudgetCreateModal({
  isOpen,
  onClose,
  onSuccess,
  sectionId,
}: BudgetCreateModalProps) {
  const { mutate, isPending } = useCreateBudget()

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      amount: 0,
      typeId: '',
    },
  })

  const handleSubmit = form.handleSubmit((data) => {
    mutate(
      { ...data, sectionId },
      {
        onSuccess: () => {
          form.reset()
          onSuccess?.()
        },
      }
    )
  })

  const handleClose = () => {
    form.reset()
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="md">
      <Modal.Header title="Новый бюджет" onClose={handleClose} />

      <form onSubmit={handleSubmit}>
        <Modal.Body>
          {/* Form fields */}
        </Modal.Body>

        <Modal.Footer>
          <ModalButton variant="cancel" onClick={handleClose}>
            Отмена
          </ModalButton>
          <ModalButton
            variant="success"
            type="submit"
            loading={isPending}
          >
            Создать
          </ModalButton>
        </Modal.Footer>
      </form>
    </Modal>
  )
}
```
