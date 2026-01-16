# Аудит модулей проекта

Пожалуйста, отметь статус каждого модуля:
- `[KEEP]` — оставить (актуальный, используется)
- `[DELETE]` — удалить полностью
- `[REFACTOR]` — требует рефакторинга
- `[MERGE]` — объединить с другим модулем (укажи с каким)

---

## Модули в меню (sidebar.tsx)

| Модуль | Путь | Статус |
|--------|------|--------|
| `dashboard` | /dashboard | [KEEP] |
| `projects` | /dashboard/projects | [DELETE] |
| `planning` | /dashboard/planning | [DELETE] |
| `kanban` | /dashboard/kanban | [KEEP] |
| `notions` | /dashboard/notions | [KEEP] |
| `reports` | /dashboard/reports | [REFACTOR] |
| `feedback-analytics` | /dashboard/feedback-analytics (по доступу) | [KEEP] |
| `user-docs` | /dashboard/user-docs | [KEEP] |
| `feedback` | /dashboard/report | [KEEP] |
| `users` | /dashboard/users | [KEEP] |

---

## Страницы dashboard (не в главном меню)

| Модуль/Страница | Путь | Статус |
|-----------------|------|--------|
| `cache-test` | /dashboard/cache-test | [DELETE] |
| `calendar` | /dashboard/calendar | [REFACTOR] |
| `dev/tasks` | /dashboard/dev/tasks | [KEEP] |
| `normokontrol` | /dashboard/normokontrol | [DELETE] |
| `planning-analytics` | /dashboard/planning-analytics | [REFACTOR] |
| `progress` | /dashboard/progress | [ANALYZE] |
| `settings` | /dashboard/settings | [ANALYZE] |
| `task-transfer` | /dashboard/task-transfer | [DELETE] |

---

## Все модули (/modules/)

### Core / Infrastructure
| Модуль | Описание | Статус |
|--------|----------|--------|
| `auth` | Аутентификация | [KEEP] |
| `cache` | Централизованный кэш TanStack Query | [KEEP] |
| `permissions` | Система прав доступа | [KEEP] |
| `notifications` | Уведомления real-time | [KEEP] |

### Планирование / Resource Graph
| Модуль | Описание | Статус |
|--------|----------|--------|
| `planning` | Основной модуль планирования | [DELETE] |
| `resource-graph` | Resource Graph (новый) | [KEEP] |
| `departments-timeline` | Timeline по отделам | [KEEP] |
| `checkpoints` | Чекпоинты проектов | [KEEP] |
| `inline-filter` | Фильтры для resource graph | [KEEP] |
| `personal-planning-graph` | Личный график планирования | [DELETE] |
| `planning-analytics` | Аналитика планирования | [KEEP] |

### Проекты / Задачи
| Модуль | Описание | Статус |
|--------|----------|--------|
| `projects` | Управление проектами | [DELETE] |
| `kanban` | Канбан-доска | [KEEP] |
| `tasks` | Задачи | [KEEP] |
| `task-transfer` | Перенос задач | [ANALYZE] |
| `my-work` | Мои задачи | [KEEP] |
| `comments` | Комментарии | [KEEP] |

### Декомпозиция
| Модуль | Описание | Статус |
|--------|----------|--------|
| `decomposition` | Декомпозиция | [ANALYZE] |
| `decomposition2` | Декомпозиция v2 | [ANALYZE] |
| `decomposition-templates` | Шаблоны декомпозиции | [ANALYZE] |
| `dec-templates` | Шаблоны декомпозиции (дубль?) | [ANALYZE] |

### Бюджеты
| Модуль | Описание | Статус |
|--------|----------|--------|
| `budgets` | Core бюджетов | [KEEP] |
| `budgets-page` | UI страницы бюджетов | [KEEP] |

### UI / Modals
| Модуль | Описание | Статус |
|--------|----------|--------|
| `modals` | Централизованные модалки | [KEEP] |
| `text-editor` | TipTap редактор | [KEEP] |

### Отчёты / Аналитика
| Модуль | Описание | Статус |
|--------|----------|--------|
| `reports` | Отчёты | [REFACTOR] |
| `project-reports` | Отчёты по проектам | [KEEP] |
| `section-analytics` | Аналитика разделов | [ANALYZE] |
| `feedback-analytics` | Аналитика фидбека | [KEEP] |

### Пользователи / HR
| Модуль | Описание | Статус |
|--------|----------|--------|
| `users` | Управление пользователями | [KEEP] |
| `vacation-management` | Управление отпусками | [DELETE] |

### Вспомогательные
| Модуль | Описание | Статус |
|--------|----------|--------|
| `dashboard` | Dashboard карточки | [KEEP] |
| `calendar` | Календарь | [REFACTOR] |
| `chat` | AI чат-бот | [KEEP] |
| `notions` | Заметки | [KEEP] |
| `feedback` | Форма обратной связи | [KEEP] |
| `user-docs` | Пользовательская документация | [KEEP] |
| `announcements` | Объявления | [KEEP] |
| `normokontrol` | Нормоконтроль | [DELETE] |

### Dev / Test
| Модуль | Описание | Статус |
|--------|----------|--------|
| `dev-tasks` | Страница задач для разработки | [KEEP] |
| `cache-test` | Тестирование кэша | [DELETE] |

### Прочее (возможно устаревшее)
| Модуль | Описание | Статус |
|--------|----------|--------|
| `filters` | Фильтры (старые?) | [ANALYZE] |
| `filter-permissions` | Права на фильтры | [ANALYZE] |
| `statuses-tags` | Статусы и теги | [ANALYZE] |

---

## Модули с module.meta.json (активная разработка)

- `budgets`
- `budgets-page`
- `checkpoints`
- `departments-timeline`
- `inline-filter`
- `kanban`
- `modals`
- `resource-graph`

---

## Примечания

После заполнения статусов я:
1. Удалю модули с `[DELETE]`
2. Очищу импорты и зависимости
3. Удалю соответствующие страницы в `/app/`
4. Обновлю меню в `sidebar.tsx`
5. Проверю билд

---

## Результаты анализа [ANALYZE] модулей

### 1. `progress` (страница)
**Рекомендация: DELETE**
- Это просто iframe на внешний сервис `https://project-dynamic.vercel.app/`
- Не связан с кодовой базой
- Если внешний сервис нужен — оставить, иначе удалить

### 2. `settings` (страница)
**Рекомендация: DELETE или KEEP как заглушку**
- Пустая страница-заглушка с заголовком "Настройки аккаунта"
- Нет реального функционала
- Если планируются настройки — оставить скелет, иначе удалить

### 3. `task-transfer` (модуль)
**Рекомендация: DELETE (вместе с projects)**
- Используется **только** в модуле `projects` (7 импортов)
- Страница `/dashboard/task-transfer` — тоже часть projects
- Если `projects` удаляется → `task-transfer` тоже удаляется
- Большой модуль (72KB store.ts + 21KB page)

### 4. `decomposition` (модуль)
**Рекомендация: DELETE**
- **НЕ импортируется никуда** в проекте
- Полностью заменён на `decomposition2`
- Содержит устаревший код (35KB DecompositionPage.tsx)

### 5. `decomposition2` (модуль)
**Рекомендация: KEEP**
- Активно используется в `SectionPanel.tsx`
- Содержит актуальный компонент `SectionDecomposition2Tab`
- Большой файл `stages-management.tsx` (141KB) — возможно требует рефакторинга

### 6. `decomposition-templates` (модуль)
**Рекомендация: DELETE**
- Импортируется только в 1 файле (`SectionDecompositionTab.tsx`)
- **Этот файл — часть `projects`**, который удаляется
- Старое API (простой экспорт types + TemplatesPanel)
- Заменён на `dec-templates`

### 7. `dec-templates` (модуль)
**Рекомендация: KEEP**
- Импортируется в 4 файлах (modals, decomposition2)
- Новое API с Server Actions и хуками
- Актуальная версия шаблонов декомпозиции

### 8. `section-analytics` (модуль)
**Рекомендация: DELETE (вместе с projects)**
- Используется только в `ProjectsTree.tsx` (модуль projects)
- Если `projects` удаляется → `section-analytics` не нужен

### 9. `filters` (модуль)
**Рекомендация: KEEP**
- Содержит `locks/index.ts` — утилиты блокировки фильтров
- Используется в 3 integration файлах (reports, planning, projects)
- **НО:** если `planning` и `projects` удаляются, останется только `reports`
- Оставить, пересмотреть после удаления модулей

### 10. `filter-permissions` (модуль)
**Рекомендация: DELETE**
- Содержит **только README.md** (10KB документации)
- Нет реального кода
- Это план/документация для будущей реализации
- Не импортируется никуда

### 11. `statuses-tags` (модуль)
**Рекомендация: CONDITIONAL**
- Используется в **9 файлах** (modals, planning, projects)
- Компоненты статусов секций (`statuses/` подпапка)
- **НО:** большинство импортов из `planning` и `projects` (оба на удаление)
- Если `modals` использует — оставить
- Проверить после удаления planning/projects

---

## Итоговые рекомендации

### Точно DELETE:
- `progress` (страница) — внешний iframe
- `settings` (страница) — пустая заглушка
- `task-transfer` (модуль) — привязан к projects
- `decomposition` (модуль) — устаревший, не используется
- `decomposition-templates` (модуль) — привязан к projects
- `section-analytics` (модуль) — привязан к projects
- `filter-permissions` (модуль) — только документация

### Точно KEEP:
- `decomposition2` — актуальная декомпозиция
- `dec-templates` — актуальные шаблоны
- `filters` — утилиты блокировок

### Требует решения:
- `statuses-tags` — проверить после удаления planning/projects

---

**Подтверди решения и я начну очистку!**
