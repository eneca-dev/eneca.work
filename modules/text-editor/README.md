# Text Editor Module

Модуль редактора текста на основе TipTap.

## Компоненты

### TipTapEditor
Основной редактор текста с полным набором инструментов форматирования.

**Возможности:**
- Заголовки (H1-H3)
- Форматирование текста (жирный, курсив, подчеркивание, зачеркнутый)
- Выделение текста цветом
- Маркированные и нумерованные списки
- Списки задач с чекбоксами
- Цитаты и блоки кода
- Таблицы
- Автосохранение
- Горячие клавиши

**Использование:**
```tsx
import { TipTapEditor } from '@/modules/text-editor'

<TipTapEditor
  initialValue="# Заголовок\n\nТекст заметки"
  onSave={(content) => console.log(content)}
  onCancel={() => console.log('Отмена')}
  showTitle={true}
  autoFocus={true}
/>
```

### TipTapNoteModal
Модальное окно с TipTap редактором для создания/редактирования заметок.

**Использование:**
```tsx
import { TipTapNoteModal } from '@/modules/text-editor'

<TipTapNoteModal
  open={isOpen}
  onOpenChange={setIsOpen}
  notion={notion}
  onSave={handleSave}
  mode="edit"
/>
```

### QuickTipTapNote
Упрощенный редактор для быстрого создания заметок.

**Использование:**
```tsx
import { QuickTipTapNote } from '@/modules/text-editor'

<QuickTipTapNote
  onSave={handleSave}
  onCancel={handleCancel}
  placeholder="Введите текст заметки..."
/>
```

## Горячие клавиши

- `Ctrl+S` / `Cmd+S` - Сохранить
- `Ctrl+B` / `Cmd+B` - Жирный текст
- `Ctrl+I` / `Cmd+I` - Курсив
- `Ctrl+U` / `Cmd+U` - Подчеркивание
- `Escape` - Отмена/закрытие

## Формат данных

Редактор работает с markdown-совместимым форматом:

```markdown
# Заголовок заметки

Обычный текст с **жирным** и *курсивом*.

- Маркированный список
- Другой пункт

1. Нумерованный список
2. Другой пункт

- [ ] Задача 1
- [x] Выполненная задача

> Цитата

`Код`

| Колонка 1 | Колонка 2 |
|-----------|-----------|
| Ячейка 1  | Ячейка 2  |
```

## Зависимости

- @tiptap/react
- @tiptap/starter-kit
- @tiptap/extension-underline
- @tiptap/extension-highlight
- @tiptap/extension-task-list
- @tiptap/extension-task-item
- @tiptap/extension-table
- @tiptap/extension-typography
- @tiptap/extension-placeholder
- @tiptap/extension-text-style
- @tiptap/extension-color 