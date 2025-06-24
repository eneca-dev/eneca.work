# TipTap Интеграция в Модуле Заметок

## Обзор

Интегрированный современный TipTap редактор для создания и редактирования заметок с расширенными возможностями форматирования.

## Основные Компоненты

### 1. TipTapEditor
Основной компонент редактора с полным набором инструментов.

**Возможности:**
- ✅ Форматирование текста (жирный, курсив, подчеркнутый, зачеркнутый)
- ✅ Заголовки (H1, H2, H3)
- ✅ Списки (маркированный, нумерованный, задачи)
- ✅ Выделение текста (highlight)
- ✅ Цитаты и код
- ✅ Таблицы
- ✅ Отмена/повтор действий
- ✅ Горячие клавиши
- ✅ Автосохранение

**Использование:**
```tsx
import { TipTapEditor } from '@/modules/notions'

<TipTapEditor
  initialValue="# Заголовок\n\nТекст заметки..."
  onSave={(content) => console.log('Сохранено:', content)}
  onCancel={() => console.log('Отменено')}
  showTitle={true}
  autoFocus={true}
/>
```

### 2. TipTapNoteModal
Модальное окно для редактирования заметок.

**Использование:**
```tsx
import { TipTapNoteModal } from '@/modules/notions'

<TipTapNoteModal
  open={isModalOpen}
  onOpenChange={setIsModalOpen}
  notion={selectedNotion}
  onSave={handleSave}
  mode="edit" // или "create"
/>
```

## Интеграция в NotesBlock

В компоненте `NotesBlock` доступны две кнопки:
- **"Добавить (старый)"** - использует старый RichTextEditor
- **"Добавить (TipTap)"** - использует новый TipTap редактор

В каждой карточке заметки добавлена синяя кнопка редактирования для открытия TipTap редактора.

## Горячие Клавиши

- **Ctrl/Cmd + S** - Сохранить
- **Ctrl/Cmd + B** - Жирный текст
- **Ctrl/Cmd + I** - Курсив
- **Ctrl/Cmd + U** - Подчеркнутый
- **Ctrl/Cmd + 1/2/3** - Заголовки H1/H2/H3
- **Escape** - Отмена/закрытие

## Форматы Данных

### Входные данные
Редактор принимает markdown-подобный формат:
```markdown
# Заголовок заметки

Обычный текст с **жирным** и *курсивом*.

- Элемент списка 1
- Элемент списка 2

- [ ] Задача 1
- [x] Выполненная задача

> Цитата

`код`
```

### Выходные данные
Редактор возвращает тот же формат для сохранения в базе данных.

## Расширения TipTap

Установленные расширения:
- `@tiptap/starter-kit` - базовая функциональность
- `@tiptap/extension-underline` - подчеркивание
- `@tiptap/extension-highlight` - выделение
- `@tiptap/extension-task-list` - список задач
- `@tiptap/extension-task-item` - элементы задач
- `@tiptap/extension-text-style` - стили текста
- `@tiptap/extension-color` - цвета
- `@tiptap/extension-typography` - типографика
- `@tiptap/extension-placeholder` - placeholder
- `@tiptap/extension-table` - таблицы
- `@tiptap/extension-table-*` - элементы таблиц
- `@tiptap/extension-link` - ссылки
- `@tiptap/extension-image` - изображения

## Стилизация

Редактор использует Tailwind CSS с кастомными стилями для:
- Списка задач с чекбоксами
- Таблиц с границами
- Hover эффектов для кнопок панели инструментов
- Адаптивного дизайна

## Автосохранение

Функции автосохранения:
- При потере фокуса (blur)
- При закрытии браузера/приложения
- При навигации на другие страницы
- Индикатор несохраненных изменений

## Будущие Улучшения

Планируемые возможности:
- [ ] Поддержка изображений (drag & drop)
- [ ] Совместное редактирование
- [ ] Темы для редактора
- [ ] Экспорт в PDF/Word
- [ ] Интеграция с AI для автодополнения

## Миграция со Старого Редактора

Данные полностью совместимы между старым RichTextEditor и новым TipTap редактором, поскольку оба используют markdown-формат для хранения.

## Примеры Использования

### Создание заметки
```tsx
const handleCreateNote = () => {
  setTipTapMode('create')
  setTipTapNotion(null)
  setShowTipTapModal(true)
}
```

### Редактирование заметки
```tsx
const handleEditNote = (notion: Notion) => {
  setTipTapMode('edit')
  setTipTapNotion(notion)
  setShowTipTapModal(true)
}
```

### Сохранение
```tsx
const handleSave = async (content: string) => {
  if (mode === 'create') {
    await createNotion({ notion_content: content })
  } else {
    await updateNotion(notion.notion_id, { notion_content: content })
  }
}
``` 