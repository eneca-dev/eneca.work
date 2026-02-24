# Дизайн-гайд модальных окон

Этот документ описывает принципы дизайна для модальных окон модуля `modules/modals`.
Стиль вдохновлён визуальным языком графика ресурсов (resource-graph).

---

## Общие принципы

### Философия
- **Компактность** — минимум пространства, максимум информации
- **Тёмная тема** — все модалки используют тёмную палитру
- **Полупрозрачность** — фоны и границы с opacity
- **Фокус на данных** — минимум декора, акцент на контенте

---

## Цветовая палитра

### Фоны
```
Overlay:        bg-black/60 backdrop-blur-sm
Modal:          bg-slate-900/95 backdrop-blur-md
Inputs:         bg-slate-800/50
Hover states:   bg-slate-800
```

### Границы
```
Modal border:   border-slate-700/50
Input border:   border-slate-700
Dividers:       border-slate-700/50
Focus ring:     ring-slate-600/50
```

### Текст
```
Primary:        text-slate-200 / text-slate-300
Secondary:      text-slate-400
Muted:          text-slate-500 / text-slate-600
Labels:         text-slate-400 uppercase tracking-wide
```

### Акценты
```
Primary action: bg-amber-500 hover:bg-amber-400 text-slate-900
Selected state: border-amber-500/50 bg-amber-500/10 text-amber-400
Warning:        text-amber-500/80
Success:        text-green-400
Error:          text-red-400
```

### Цветовые индикаторы
Для бизнес-сущностей используются их собственные цвета:
- Бюджеты: `amber-500`
- Загрузки: `blue-500`
- Отчёты: `green-500`
- Статусы: цвет из БД

---

## Типографика

### Размеры шрифтов
```
Labels (uppercase): text-[10px] font-medium uppercase tracking-wide
Buttons:            text-[11px] font-medium
Inputs:             text-xs (12px)
Header title:       text-xs font-medium
Header subtitle:    text-[10px]
```

### Правила
- Все лейблы — `uppercase` с `tracking-wide`
- Моноширинный шрифт для чисел: `font-mono`
- Никаких шрифтов крупнее `text-sm` внутри модалки

---

## Компоненты

### Overlay
```tsx
<div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
```

### Modal Container
```tsx
<div className={cn(
  'w-full max-w-xl',                    // Ширина
  'bg-slate-900/95 backdrop-blur-md',   // Фон
  'border border-slate-700/50',         // Граница
  'rounded-lg shadow-2xl shadow-black/50' // Тень
)} />
```

### Header
```tsx
<div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700/50">
  <div className="flex items-center gap-2">
    <Icon className="w-4 h-4 text-amber-500" />
    <span className="text-xs font-medium text-slate-300">Заголовок</span>
    <span className="text-[10px] text-slate-500">·</span>
    <span className="text-[10px] text-slate-400">Контекст</span>
  </div>
  <button className="p-1 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded">
    <X className="w-4 h-4" />
  </button>
</div>
```

### Body
```tsx
<div className="px-4 py-3">
  {/* Контент */}
</div>
```

### Footer
```tsx
<div className="flex items-center justify-end gap-2 px-4 py-2.5 border-t border-slate-700/50">
  {/* Кнопки */}
</div>
```

### Input
```tsx
<input
  className={cn(
    'w-full px-2.5 py-1.5 text-xs',
    'bg-slate-800/50 border border-slate-700',
    'rounded text-slate-200',
    'placeholder:text-slate-600',
    'focus:outline-none focus:border-slate-600 focus:ring-1 focus:ring-slate-600/50',
    'transition-colors'
  )}
/>
```

### Textarea
```tsx
<textarea
  rows={3}
  className={cn(
    'w-full px-2.5 py-1.5 text-xs',
    'bg-slate-800/50 border border-slate-700',
    'rounded text-slate-200 resize-none',
    'placeholder:text-slate-600',
    'focus:outline-none focus:border-slate-600 focus:ring-1 focus:ring-slate-600/50',
    'transition-colors'
  )}
/>
```

### Label
```tsx
<label className="block text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1.5">
  Название поля
</label>
```

### Select/Chip Button
```tsx
<button
  className={cn(
    'flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium',
    'border transition-all duration-150',
    isSelected
      ? 'border-amber-500/50 bg-amber-500/10 text-amber-400'
      : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600 hover:text-slate-300'
  )}
>
  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
  {label}
  {isSelected && <Check className="w-3 h-3 text-amber-500" />}
</button>
```

### Primary Button
```tsx
<button
  className={cn(
    'flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded',
    'text-slate-900 bg-amber-500 hover:bg-amber-400',
    'transition-colors',
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500'
  )}
>
  <Icon className="w-3 h-3" />
  Действие
</button>
```

### Secondary/Cancel Button
```tsx
<button
  className={cn(
    'px-3 py-1.5 text-[11px] font-medium rounded',
    'text-slate-400 hover:text-slate-300',
    'border border-slate-700 hover:border-slate-600',
    'bg-slate-800/50 hover:bg-slate-800',
    'transition-colors'
  )}
>
  Отмена
</button>
```

---

## Раскладка

### 2-колоночная форма
```tsx
<div className="grid grid-cols-2 gap-3 items-end">
  <div className="space-y-3">{/* Левая колонка */}</div>
  <div className="space-y-3">{/* Правая колонка */}</div>
</div>
```

### Выравнивание
- `items-end` для выравнивания полей по нижней границе
- `gap-3` между полями (12px)
- `space-y-3` для вертикальных отступов внутри колонок

### Отступы
```
Header/Footer:  px-4 py-2.5
Body:           px-4 py-3
Input padding:  px-2.5 py-1.5
Label margin:   mb-1.5
```

---

## Анимации

### Overlay
- Появление: `fade-in`
- Исчезновение: `fade-out`

### Modal
```tsx
className={cn(
  'transform transition-all duration-200',
  isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
)}
```

### Интерактивные элементы
- `transition-colors` для hover-эффектов
- `transition-all duration-150` для chip buttons

---

## Иконки

### Размеры
```
Header icon:    w-4 h-4
Button icon:    w-3 h-3
Indicator:      w-2 h-2
Close button:   w-4 h-4
```

### Библиотека
Используем `lucide-react`:
- `X` — закрытие
- `Check` — выбор
- `Loader2` — загрузка (с `animate-spin`)
- `AlertCircle` — предупреждение
- `Wallet` — бюджеты
- `Plus` — добавление

---

## Accessibility

### Клавиатура
- `Escape` для закрытия (если реализовано)
- Focus trap внутри модалки

### ARIA
```tsx
<div role="dialog" aria-modal="true" aria-labelledby="modal-title">
```

### Focus states
- Все интерактивные элементы имеют видимый focus ring
- `focus:ring-1 focus:ring-slate-600/50`

---

## Примеры использования

### Простая модалка подтверждения
```tsx
// Компактная, без формы
// max-w-sm, одна колонка
```

### Форма создания сущности
```tsx
// max-w-xl, две колонки
// Пример: BudgetCreateModal
```

### Модалка просмотра
```tsx
// max-w-2xl, больше места для контента
// Только кнопка "Закрыть"
```

---

## Чеклист для новой модалки

- [ ] Использует тёмную палитру `slate-900/95`
- [ ] Границы с opacity `slate-700/50`
- [ ] Лейблы `text-[10px] uppercase tracking-wide`
- [ ] Кнопки `text-[11px]`
- [ ] Инпуты `text-xs` с `bg-slate-800/50`
- [ ] Амберный акцент для primary action
- [ ] Иконка сущности в header
- [ ] Компактные отступы `px-4 py-2.5`
- [ ] Анимация `scale` при открытии
