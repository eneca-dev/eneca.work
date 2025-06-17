# 🪟 Система модальных окон

Переиспользуемая система модальных окон с единым дизайном и поведением для enterprise-приложения.

## 📁 Структура

```
components/modals/
├── base/                    # Базовые компоненты
│   ├── Modal.tsx           # Основной компонент (композитный API)
│   ├── ModalOverlay.tsx    # Фон и обработка событий
│   ├── ModalHeader.tsx     # Заголовок с кнопкой закрытия
│   ├── ModalBody.tsx       # Основное содержимое
│   ├── ModalFooter.tsx     # Кнопки действий
│   ├── ModalProvider.tsx   # Context Provider
│   └── useModal.ts         # Хуки для работы
├── examples/               # Примеры использования
│   ├── SimpleModalExample.tsx
│   └── FormModalExample.tsx
├── types.ts               # TypeScript типы
├── animations.ts          # Анимации и стили
├── index.ts              # Экспорты
└── README.md             # Документация
```

## 🚀 Быстрый старт

### 1. Простое использование

```tsx
import { Modal, useModalState } from '@/components/modals'

function MyComponent() {
  const { isOpen, openModal, closeModal } = useModalState()

  return (
    <>
      <button onClick={openModal}>Открыть модальное окно</button>

      <Modal isOpen={isOpen} onClose={closeModal}>
        <Modal.Header title="Заголовок" onClose={closeModal} />
        <Modal.Body>
          <p>Содержимое модального окна</p>
        </Modal.Body>
        <Modal.Footer>
          <button onClick={closeModal}>Закрыть</button>
        </Modal.Footer>
      </Modal>
    </>
  )
}
```

### 2. Модальное окно с формой

```tsx
import { Modal, useModalState } from '@/components/modals'
import { useState } from 'react'

function FormModal() {
  const { isOpen, openModal, closeModal } = useModalState()
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    // Логика отправки
    setLoading(false)
    closeModal()
  }

  return (
    <Modal isOpen={isOpen} onClose={closeModal} size="lg">
      <Modal.Header title="Редактирование" onClose={closeModal} />
      
      <form onSubmit={handleSubmit}>
        <Modal.Body>
          {/* Поля формы */}
        </Modal.Body>
        
        <Modal.Footer>
          <button type="button" onClick={closeModal}>Отмена</button>
          <button type="submit" disabled={loading}>
            {loading ? 'Сохранение...' : 'Сохранить'}
          </button>
        </Modal.Footer>
      </form>
    </Modal>
  )
}
```

## 🎛️ API Reference

### Modal (основной компонент)

```tsx
interface ModalProps {
  isOpen: boolean                    // Состояние открытия
  onClose: () => void               // Функция закрытия
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'  // Размер
  closeOnOverlayClick?: boolean     // Закрытие по клику вне (по умолчанию true)
  closeOnEscape?: boolean           // Закрытие по ESC (по умолчанию true)
  showCloseButton?: boolean         // Показать кнопку закрытия (по умолчанию true)
  className?: string                // Дополнительные CSS классы
  children: ReactNode               // Содержимое
}
```

### Modal.Header

```tsx
interface ModalHeaderProps {
  title: string                     // Заголовок (обязательно)
  subtitle?: string                 // Подзаголовок
  onClose?: () => void             // Функция закрытия
  showCloseButton?: boolean        // Показать кнопку X
  className?: string               // Дополнительные CSS классы
}
```

### Modal.Body

```tsx
interface ModalBodyProps {
  children: ReactNode              // Содержимое
  className?: string               // Дополнительные CSS классы
  padding?: boolean                // Применить отступы (по умолчанию true)
}
```

### Modal.Footer

```tsx
interface ModalFooterProps {
  children: ReactNode              // Кнопки и другие элементы
  className?: string               // Дополнительные CSS классы
  align?: 'left' | 'center' | 'right' | 'between'  // Выравнивание (по умолчанию 'right')
}
```

### ModalButton

Стандартизированный компонент кнопки для модальных окон с консистентным дизайном:

```tsx
interface ModalButtonProps {
  children: ReactNode              // Текст кнопки
  onClick?: () => void            // Обработчик клика
  disabled?: boolean              // Состояние отключения (по умолчанию false)
  loading?: boolean               // Состояние загрузки с анимацией (по умолчанию false)
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'cancel'  // Вариант стиля
  type?: 'button' | 'submit' | 'reset'  // Тип кнопки (по умолчанию 'button')
  className?: string              // Дополнительные CSS классы
  icon?: ReactNode                // Иконка для кнопки
}
```

**Варианты стилей:**
- `primary` - синяя кнопка для основных действий
- `secondary` - серая кнопка для второстепенных действий  
- `success` - **зеленая кнопка для действий сохранения** ✅
- `danger` - красная кнопка для опасных действий (удаление)
- `cancel` - прозрачная кнопка для отмены

**Пример использования:**
```tsx
<Modal.Footer>
  <ModalButton variant="cancel" onClick={closeModal}>
    Отмена
  </ModalButton>
  <ModalButton 
    variant="success" 
    onClick={handleSave}
    loading={saving}
    icon={<Save />}
  >
    {saving ? 'Сохранение...' : 'Сохранить'}
  </ModalButton>
</Modal.Footer>
```

## 🎣 Хуки

### useModalState

Простой хук для управления состоянием модального окна:

```tsx
const { isOpen, openModal, closeModal, toggleModal } = useModalState(false)
```

### useModal (будущее)

Хук для работы с глобальным провайдером модальных окон:

```tsx
const { openModal, closeModal, isModalOpen } = useModal()

// Открытие зарегистрированного модального окна
openModal('editProject', { projectId: '123' })
```

## 🎨 Размеры модальных окон

- `sm` - 384px (max-w-sm)
- `md` - 448px (max-w-md) - по умолчанию
- `lg` - 672px (max-w-2xl)
- `xl` - 896px (max-w-4xl)
- `full` - 95% экрана (max-w-[95vw])

## ✨ Возможности

### Автоматические функции
- ✅ Блокировка скролла body при открытии
- ✅ Закрытие по клавише ESC
- ✅ Закрытие по клику вне модального окна
- ✅ Focus management для доступности
- ✅ Portal рендеринг в document.body
- ✅ Поддержка темной темы

### Дизайн
- ✅ Консистентный стиль согласно Design System
- ✅ Адаптивный дизайн для мобильных устройств
- ✅ Плавные анимации появления/исчезновения
- ✅ Поддержка различных размеров

### Доступность (a11y)
- ✅ Правильные ARIA атрибуты
- ✅ Управление фокусом
- ✅ Поддержка screen readers
- ✅ Keyboard navigation

## 🔄 Миграция существующих модальных окон

### До (старый способ)
```tsx
// Дублированная логика в каждом компоненте
const [isOpen, setIsOpen] = useState(false)
// Собственная реализация overlay, ESC, блокировки скролла
```

### После (новый способ)
```tsx
import { Modal, useModalState } from '@/components/modals'

const { isOpen, openModal, closeModal } = useModalState()
// Вся логика уже реализована в системе
```

## 🧪 Примеры

Смотрите папку `examples/` для полных примеров использования:
- `SimpleModalExample.tsx` - базовое модальное окно
- `FormModalExample.tsx` - модальное окно с формой и валидацией

## 🎯 Лучшие практики

1. **Используйте композитный API** для гибкости
2. **Всегда предоставляйте onClose** для доступности
3. **Используйте правильные размеры** для контента
4. **Добавляйте loading состояния** для форм
5. **Валидируйте данные** перед отправкой
6. **Очищайте состояние** при закрытии

## 🚧 Roadmap

- [ ] Глобальный ModalProvider для программного управления
- [ ] Стекинг нескольких модальных окон
- [ ] Анимации с Framer Motion
- [ ] Lazy loading модальных окон
- [ ] Предустановленные шаблоны (confirm, alert, prompt)
- [ ] Drag & drop для перемещения модальных окон 