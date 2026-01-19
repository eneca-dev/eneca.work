# Исправление использования globals.css

## 1. Фоны страниц (bg-card вместо hardcoded)

### Dashboard Layout
`app/(dashboard)/layout.tsx:98`
- Было: `bg-[#0a0f14]`
- Стало: `bg-background`

### Dashboard page (главная)
`app/(dashboard)/page.tsx:11`
- Было: `bg-white dark:bg-gray-800`
- Стало: `bg-card`
- Убрано: `px-4 md:px-0` (padding перенесён внутрь компонентов)

### Feedback page
`app/(dashboard)/feedback/page.tsx:11`
- Добавлено: `bg-card min-h-screen` (wrapper на всю ширину)
- Структура: wrapper с bg-card → container → content

### Feedback Analytics
`modules/feedback-analytics/components/FeedbackAnalyticsPage.tsx`
- Строка 65: `dark:bg-[rgb(17_24_39)]` → `bg-card`
- Строка 76: `bg-white dark:bg-[rgb(15_23_42)]` → `bg-popover`
- Строка 85,95: `!border-gray-200 dark:!border-slate-600` → `!border-border`

### Заметки (Notions)
`modules/notions/components/NotesBlock.tsx:444`
- Было: `h-[calc(100vh-58px)] max-h-[calc(100vh-58px)]`
- Стало: `h-full max-h-full bg-card`

### Пользователи
`app/(dashboard)/users/page.tsx:5`
- Было: `px-4 md:px-6 py-6`
- Стало: `px-4 md:px-6 py-6 bg-card min-h-screen`

### Календарь
`modules/calendar/CalendarPage.tsx:185`
- Было: `bg-white dark:bg-gray-900`
- Стало: `bg-card`

### Задачи/Канбан/График/Отделы/Бюджеты
`modules/tasks/components/TasksView.tsx:59`
- Было: `bg-background`
- Стало: `bg-card`

### Документация
`modules/user-docs/components/DocumentationLayout.tsx`
- Было: `bg-background dark:bg-[rgb(31,41,55)]` (4 места)
- Стало: `bg-card`

## 2. Высота компонентов (calc(100vh-58px) → h-full)

### MyWorkWidget loading/error states
`modules/my-work/components/MyWorkWidget.tsx`
- Строка 143: Card `h-[calc(100vh-58px)]` → div `h-full`
- Строка 162: Card `h-[calc(100vh-58px)]` → div `h-full`
- Убраны импорты: `Card, CardContent, CardHeader, CardTitle, Briefcase`
- Структура изменена на аналогичную loaded state

### NotesBlock
`modules/notions/components/NotesBlock.tsx:444`
- Включено в раздел 1 (фоны)

## 3. Структура MyWorkWidget

### Замена Card на div
`modules/my-work/components/MyWorkWidget.tsx`
- Loading state (143-157): Card → div с header + content
- Error state (162-176): Card → div с header + content
- Иконка: Briefcase → Calendar
- Структура унифицирована с loaded state

## 4. Скругления блоков (rounded-lg)

### WorkTasksChart
`modules/my-work/components/WorkTasksChart.tsx:228`
- Добавлено: `rounded-lg`
- Убрано: `border border-gray-100 dark:border-slate-500/20`

### DeadlinesBlock
`modules/my-work/components/DeadlinesBlock.tsx`
- Строка 105 (пустое): добавлено `rounded-lg`
- Строка 135-166: обернут ScrollableContainer в `bg-gray-50 dark:bg-slate-600/20 rounded-lg p-4`

### ResponsibilitiesBlock
`modules/my-work/components/ResponsibilitiesBlock.tsx:90`
- Добавлено: `rounded-lg`

### UserLoadingsList wrapper
`modules/my-work/components/MyWorkWidget.tsx:224`
- Список обернут в `bg-gray-50 dark:bg-slate-600/20 rounded-lg p-4`

### UserLoadingsList пустое состояние
`modules/my-work/components/UserLoadingsList.tsx:65`
- Было: без rounded
- Стало: `rounded-lg` добавлен к wrapper

## 5. Удаление border у главных контейнеров

### WorkTasksChart
`modules/my-work/components/WorkTasksChart.tsx:228`
- Убрано: `border border-gray-100 dark:border-slate-500/20`

### UserLoadingsList пустое
`modules/my-work/components/UserLoadingsList.tsx:65`
- Убрано: `rounded-lg border border-gray-100 dark:border-slate-500/20`
- Оставлено: только фон и padding

### DeadlinesBlock пустое
`modules/my-work/components/DeadlinesBlock.tsx:105`
- Убрано: `rounded-lg border border-gray-100 dark:border-slate-500/20`
- Добавлено: только `rounded-lg`

### ResponsibilitiesBlock
`modules/my-work/components/ResponsibilitiesBlock.tsx:90`
- Убрано: `rounded-lg border border-gray-100 dark:border-slate-500/20`
- Добавлено: только `rounded-lg`

## 6. Auth модуль (Фаза 2)

### Auth Layout
`app/auth/layout.tsx`
- Строка 17: `bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800` → `bg-background`
- Строка 23: `bg-white dark:bg-gray-800` → `bg-card`
- Строка 34: `bg-white dark:bg-gray-800` → `bg-card`
- Строка 36: `border-gray-100 dark:border-gray-700` → `border-border`
- Строка 41: `text-gray-700 dark:text-gray-300` → `text-foreground`
- Строка 43: `text-gray-500 dark:text-gray-400` → `text-muted-foreground`
- Строка 50: `text-gray-500 dark:text-gray-400` → `text-muted-foreground`

### Login Page
`app/auth/login/page.tsx`
- Строка 178: `dark:text-gray-100` → `text-foreground`
- Строка 238: `dark:border-gray-700` → `border-border`
- Строка 241: `bg-white dark:bg-gray-800` → `bg-card`

### Reset Password Page
`app/auth/reset-password/page.tsx`
- Строки 214, 220, 233, 262, 271: `dark:text-gray-100` → `text-foreground` (replace_all)
- Строка 342: `bg-gray-50 border border-gray-200 dark:bg-gray-800/30 dark:border-gray-700` → `bg-muted border border-border`
- Строка 343: `text-gray-700 dark:text-gray-300` → `text-foreground`

## 7. Announcements модуль (Фаза 2)

### RichTextEditor
`modules/announcements/components/RichTextEditor.tsx`
- Строка 58: `border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800` → `border-border bg-muted` (панель форматирования)
- Строка 98: `border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 dark:text-gray-100` → `border-border bg-background text-foreground` (textarea)
- Строка 103: `text-gray-500 dark:text-gray-400` → `text-muted-foreground` (подсказка)

## 8. Calendar модуль (Фаза 2)

### Calendar Page (главная страница календаря)
`modules/calendar/CalendarPage.tsx`
- Строка 138: Добавлена обертка `<div className="bg-card min-h-screen">` вокруг всего контента
- Строка 220: Закрывающий `</div>` для обертки
- **Проблема:** Страница не имела фона, виден был черный `bg-background` из layout
- **Решение:** Обернул весь контент в `bg-card min-h-screen` для серого фона как на других страницах

### Mini Calendar
`modules/calendar/components/mini-calendar.tsx`
- Строки 385, 391: `hover:bg-gray-100 dark:hover:bg-slate-600` → `hover:bg-accent` (кнопки навигации)
- Строка 499: `bg-gray-50 dark:bg-slate-700 dark:border-slate-500` → `bg-muted` (input)
- Строка 380: `bg-background` → `bg-card` (основной контейнер календаря)
- Строка 503: `bg-background` → `bg-popover` (всплывающий календарь)

### Calendar Grid
`modules/calendar/components/calendar-grid.tsx`
- Строка 202: `border-gray-300 dark:border-border/60` → `border-border`
- Строка 203: `border-gray-200 dark:border-muted/60` → `border-border/60`

### UI Calendar
`modules/calendar/components/ui/calendar.tsx`
- Строка 44: `border-gray-300 dark:border-gray-600` → `border-border`

### Dropdown Menu
`modules/calendar/components/ui/dropdown-menu.tsx`
- Строки 45, 233: `bg-white text-gray-900 border border-gray-300` → `bg-popover text-popover-foreground border border-border` (content + subcontent)
- Строка 77: `focus:bg-gray-100 focus:text-gray-900` → `focus:bg-accent focus:text-accent-foreground` (item)
- Строки 95, 131: `focus:bg-gray-100 focus:text-gray-900` → `focus:bg-accent focus:text-accent-foreground` (checkbox + radio)
- Строка 173: `bg-gray-300` → `bg-border` (separator)
- Строка 187: `text-gray-500` → `text-muted-foreground` (shortcut)
- Строка 214: `focus:bg-gray-100 focus:text-gray-900 data-[state=open]:bg-gray-100 data-[state=open]:text-gray-900` → `focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground` (sub-trigger)

### Popover
`modules/calendar/components/ui/popover.tsx`
- Строка 38: `bg-white text-gray-900 border border-gray-300` → `bg-popover text-popover-foreground border border-border`

### Alert Dialog
`modules/calendar/components/ui/alert-dialog.tsx`
- Строка 57: `bg-background` → `bg-popover` (модалка предупреждения)
- **Причина:** Модалки должны использовать `bg-popover`, а не `bg-background`

### Dialog
`modules/calendar/components/ui/dialog.tsx`
- Строка 66: `bg-background` → `bg-popover` (модалка диалога)
- **Причина:** Модалки должны использовать `bg-popover`, а не `bg-background`

### Calendar Header
`modules/calendar/components/calendar-header.tsx`
- 3 замены: `hover:bg-gray-100 dark:hover:bg-gray-600` → `hover:bg-accent` (кнопки навигации по месяцам)

### Button (UI компонент)
`modules/calendar/components/ui/button.tsx`
- 2 замены: убраны `dark:bg-gray-800` из secondary и outline вариантов
- Теперь использует только `bg-card` без dark override

### Input (UI компонент)
`modules/calendar/components/ui/input.tsx`
- Строка 13: `bg-gray-50 dark:bg-gray-700` → `bg-muted` (фон input поля)

### Textarea (UI компонент)
`modules/calendar/components/ui/textarea.tsx`
- Строка 13: `bg-gray-50 dark:bg-gray-700` → `bg-muted` (фон textarea)

### Unified Event Form
`modules/calendar/components/unified-event-form.tsx`
- Строка 174: `border-gray-400 bg-gray-100 dark:border-gray-600 dark:bg-gray-700` → `border-border bg-muted` (checkbox)

### Unified Events List
`modules/calendar/components/unified-events-list.tsx`
- Строки 324, 325, 326: `text-gray-500` → `text-muted-foreground` (прошедшие события)
- Строка 333: `bg-gray-100 text-gray-800` → `bg-muted text-muted-foreground` (badge личного события)

### Unified Work Schedule Form
`modules/calendar/components/unified-work-schedule-form.tsx`
- Строки 48, 122, 132: `dark:bg-muted dark:text-gray-300` → удалены (уже есть bg-muted и text-muted-foreground)

## 9. Users модуль (Фаза 3)

### Users List
`modules/users/components/users-list.tsx`
- Строка 624: `bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-white hover:bg-slate-300 dark:hover:bg-slate-600` → `bg-muted text-muted-foreground hover:bg-accent` (Badge подразделения)
- Строка 639: `hover:bg-slate-300/50 dark:hover:bg-slate-500/50` → `hover:bg-accent/50` (кнопка X)
- Строка 1348: `bg-slate-100/80 dark:bg-slate-900/60 hover:bg-slate-100/80 hover:dark:bg-slate-900/60` → `bg-muted/80 hover:bg-muted/80` (заголовок подразделения)
- Строка 1374: `bg-slate-50/70 dark:bg-slate-800/50 hover:bg-slate-50/70 hover:dark:bg-slate-800/50` → `bg-muted/50 hover:bg-muted/50` (заголовок отдела)
- Строка 1398: `bg-slate-100/50 dark:bg-slate-800/30 hover:bg-slate-100/50 hover:dark:bg-slate-800/30` → `bg-muted/30 hover:bg-muted/30` (заголовок команды)

### User Filters
`modules/users/components/user-filters.tsx`
- 6 строк: `hover:bg-gray-50 dark:hover:bg-gray-800` → `hover:bg-accent` (CollapsibleTrigger для всех фильтров)

### Roles Tab
`modules/users/admin/components/RolesTab.tsx`
- Строка 176: `bg-gray-400 text-white hover:bg-gray-500` → `bg-muted text-foreground hover:bg-accent` (pending remove permission)
- Строка 181: `bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200` → `bg-primary text-primary-foreground hover:bg-primary/90` (активное разрешение)
- Строка 184: `border border-gray-300 bg-white hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700` → `border border-border bg-card hover:bg-accent` (неактивное разрешение)
- Строка 525: `bg-gray-50 dark:bg-gray-800/50 text-xs font-semibold text-gray-600 dark:text-gray-300` → `bg-muted text-xs font-semibold text-muted-foreground` (заголовок категории)
- Строка 541: `bg-gray-900 border-gray-700 text-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100` → `bg-popover border-border text-popover-foreground` (tooltip)
- Строка 795: `bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-700` → `bg-muted text-muted-foreground border border-border` (badge "Только просмотр")

### User Dialog
`modules/users/components/user-dialog.tsx`
- Строка 896: `bg-gray-900 text-white` → `bg-popover text-popover-foreground border border-border` (tooltip роли)
- Строка 1005: `text-gray-500 bg-gray-50 dark:bg-gray-800` → `text-muted-foreground bg-muted` (информационный блок)
- Строка 1007: `bg-gray-400` → `bg-muted-foreground` (bullet point)
- Строка 1320: `hover:bg-gray-50 dark:hover:bg-gray-800` → `hover:bg-accent` (hover роли)

### Payment List
`modules/users/components/payment-list.tsx`
- Строка 163: `bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300` → `bg-muted text-muted-foreground` (badge занятости по умолчанию)
- Строка 251: `bg-gray-50 dark:bg-gray-800/50` → `bg-muted/50` (футер таблицы)
- Строка 281: `bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800/70` → `bg-muted/50 hover:bg-muted/70` (заголовок группы)

### Delete User Confirm
`modules/users/components/DeleteUserConfirm.tsx`
- Строка 57: `bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700` → `bg-popover border border-border` (dialog)
- Строка 101: `border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700` → `border-border text-foreground hover:bg-accent` (кнопка отмены)

## 10. Notifications модуль (Фаза 3)

### Notifications Panel
`modules/notifications/components/NotificationsPanel.tsx`
- Строка 475: `bg-background` → `bg-card` (панель уведомлений)
- **Проблема:** Панель показывала черный фон вместо серого
- **Решение:** Заменил `bg-background` на `bg-card` для правильной семантики

### Notification Item
`modules/notifications/components/NotificationItem.tsx`
- Строка 106: `bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-500` → `bg-card border-border` (карточка уведомления)
- Строка 108: `hover:bg-gray-100 dark:hover:bg-gray-700/40` → `hover:bg-accent` (hover карточки)
- Строка 109: `bg-gray-100 dark:bg-gray-700/40` → `bg-accent` (выбранное уведомление)
- Строка 125: `bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600` → `bg-card border border-border` (action buttons container)
- Строка 131: `text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300` → `text-muted-foreground hover:text-foreground` (кнопка закрыть)
- Строка 139: `text-gray-500 hover:text-blue-600` → `text-muted-foreground hover:text-primary` (кнопка редактировать)
- Строка 141: `text-blue-600` → `text-primary` (активная кнопка редактировать)
- Строка 148: `text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300` → `text-muted-foreground hover:text-foreground` (кнопка прочитать все)
- Строка 157: `text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300` → `text-muted-foreground hover:text-foreground` (кнопка удалить)
- Строка 171: `text-gray-900 dark:text-gray-100` → `text-card-foreground` (заголовок уведомления)
- Строка 176: `text-gray-600 dark:text-gray-400` → `text-muted-foreground` (текст сообщения с ссылкой)
- Строка 180: `text-gray-600 dark:text-gray-400` → `text-muted-foreground` (текст сообщения без ссылки)
- Строка 189: `text-gray-500 dark:text-gray-500` → `text-muted-foreground` (время "только что")
- Строка 194: `text-gray-500 dark:text-gray-500` → `text-muted-foreground` (относительное время)
- Строка 196: `text-gray-500 dark:text-gray-500` → `text-muted-foreground` (абсолютное время)

## Итого изменений

**Файлов изменено:** 40
**Модулей исправлено:** 6
- Dashboard pages (13 файлов) - Фаза 1
  - Основные страницы: layout, page, feedback, users
  - Компоненты: MyWorkWidget, DeadlinesBlock, ResponsibilitiesBlock, UserLoadingsList, WorkTasksChart
  - Другие модули: FeedbackAnalytics, NotesBlock, TasksView, DocumentationLayout
- Auth module (3 файла) - Фаза 2
- Announcements module (1 файл) - Фаза 2
- Calendar module (15 файлов) - Фаза 2
  - CalendarPage.tsx (главная страница) ⭐
  - mini-calendar.tsx (+ дополнительные исправления) ⭐
  - calendar-grid.tsx
  - calendar-header.tsx ⭐ (навигация по месяцам)
  - ui/calendar.tsx
  - ui/dropdown-menu.tsx
  - ui/popover.tsx
  - ui/alert-dialog.tsx ⭐
  - ui/dialog.tsx ⭐
  - ui/button.tsx ⭐ (убраны dark: overrides)
  - ui/input.tsx ⭐ (bg-muted)
  - ui/textarea.tsx ⭐ (bg-muted)
  - unified-event-form.tsx
  - unified-events-list.tsx
  - unified-work-schedule-form.tsx
- **Users module (6 файлов) - Фаза 3**
  - users-list.tsx (таблица пользователей)
  - user-filters.tsx (фильтры)
  - RolesTab.tsx (роли и разрешения)
  - user-dialog.tsx (модалка редактирования)
  - payment-list.tsx (список выплат)
  - DeleteUserConfirm.tsx (подтверждение удаления)
- **Notifications module (2 файла) - Фаза 3** ⭐
  - NotificationsPanel.tsx (bg-card fix)
  - NotificationItem.tsx (17 замен цветов)

**Основные изменения:**
- Замена hardcoded цветов на CSS переменные (bg-card, bg-background, bg-popover, bg-muted, bg-accent, border-border, text-foreground, text-muted-foreground)
- Исправление высот (calc(100vh-58px) → h-full)
- Унификация структуры компонентов (Card → div)
- Добавление скруглений блоков (rounded-lg)
- Удаление лишних borders у главных контейнеров
- Удаление dark: вариантов в пользу единых CSS переменных
- Замена focus/hover состояний на accent colors
- **Правильная семантика фонов:**
  - `bg-background` = основной фон приложения (layout)
  - `bg-card` = фон страниц и компонентов
  - `bg-popover` = фон модалок и всплывающих элементов
  - `bg-muted` = приглушенный фон второстепенных блоков

**⚠️ Замечание:**
Некоторые ui/ компоненты имеют изменения только в line endings (LF → CRLF), без изменений кода. Это нормально и можно коммитить.
