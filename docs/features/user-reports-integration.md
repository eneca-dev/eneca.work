# Интеграция сообщений о проблемах в модуль feedback-analytics

## Цель

Добавить возможность просмотра сообщений о проблемах пользователей (таблица `user_reports`) в модуль `feedback-analytics` с переключением между режимами просмотра: опросы пользователей и сообщения о проблемах.

## Бизнес-требования

- Отображать сообщения о проблемах с именем, фамилией пользователя и временем создания
- Переключатель между режимами: "Ответы пользователей" ↔ "Сообщения о проблемах"
- Кнопка переключения слева от кнопки "Фильтры", стилизована как кнопка фильтров
- При переключении: строка поиска остаётся, фильтры заменяются на сортировку по дате
- Режим "только просмотр" (без прав доступа)
- 4 блока статистики сверху остаются без изменений

## Этапы реализации

### Этап 1: Backend - API endpoint для user_reports

**Описание:**
Создать API endpoint `/api/feedback-analytics/user-reports` для получения данных о сообщениях пользователей.

**Затрагиваемые файлы:**
- `app/api/feedback-analytics/user-reports/route.ts` (новый)

**Зависимости:** Нет

**Детали:**
- GET endpoint с пагинацией (page, limit)
- Проверка доступа через `feedback_analytics_access`
- JOIN с таблицей `profiles` для получения first_name, last_name
- Сортировка по умолчанию: по дате создания (desc)
- Поддержка параметра `sortOrder` (asc/desc)
- Возвращаемые поля:
  - user_report_id
  - user_report_short_description
  - user_report_detailed_description
  - user_report_created_at
  - first_name, last_name (из profiles)

---

### Этап 2: Types - TypeScript типы для user_reports

**Описание:**
Добавить TypeScript типы для работы с сообщениями о проблемах.

**Затрагиваемые файлы:**
- `modules/feedback-analytics/services/feedbackAnalyticsService.ts` (обновление)

**Зависимости:** Этап 1

**Детали:**
- Добавить интерфейс `UserReport`:
  ```typescript
  export type UserReport = {
    user_report_id: string
    user_report_short_description: string
    user_report_detailed_description: string | null
    user_report_created_at: string
    first_name: string
    last_name: string
  }
  ```
- Добавить тип для статистики user_reports (при необходимости)

---

### Этап 3: Hooks - Хук для загрузки user_reports

**Описание:**
Создать React hook для загрузки и управления данными user_reports.

**Затрагиваемые файлы:**
- `modules/feedback-analytics/hooks/useUserReports.ts` (новый)

**Зависимости:** Этап 1, Этап 2

**Детали:**
- Аналогичная структура с `useFeedbackAnalytics`
- Поддержка сортировки по дате (asc/desc)
- Проверка доступа
- Обработка ошибок
- Функция `refresh()`

---

### Этап 4: UI - Компонент списка user_reports

**Описание:**
Создать компонент для отображения списка сообщений о проблемах.

**Затрагиваемые файлы:**
- `modules/feedback-analytics/components/UserReportsList.tsx` (новый)

**Зависимости:** Этап 2, Этап 3

**Детали:**
- Аналогичный дизайн с `FeedbackCommentsList`
- Карточки для каждого сообщения:
  - Имя, фамилия пользователя (жирным)
  - Краткое описание (user_report_short_description)
  - Подробное описание (user_report_detailed_description) - если есть
  - Дата создания (справа)
- Поиск по имени пользователя или тексту сообщения
- Кнопка сортировки: "Сначала новые" ↔ "Сначала старые"
- Скелетон-загрузка

---

### Этап 5: UI - Переключатель режимов

**Описание:**
Добавить переключатель между режимами "Ответы пользователей" и "Сообщения о проблемах".

**Затрагиваемые файлы:**
- `modules/feedback-analytics/components/FeedbackAnalyticsPage.tsx` (обновление)

**Зависимости:** Этап 3, Этап 4

**Детали:**
- State для режима просмотра: `viewMode: 'feedback' | 'reports'`
- Кнопка переключения слева от кнопки "Фильтры":
  - Стиль: как кнопка "Фильтры" (outline, size sm)
  - Иконка: MessageSquare или AlertCircle
  - Текст: "Сообщения о проблемах" / "Ответы пользователей"
- При переключении:
  - Если `viewMode === 'feedback'`: показываем FeedbackCommentsList с фильтрами
  - Если `viewMode === 'reports'`: показываем UserReportsList с сортировкой
- 4 блока статистики (FeedbackStats) остаются без изменений
- Кнопки "Добавить" и "Обновить" работают в обоих режимах

---

### Этап 6: Интеграция и полировка UI

**Описание:**
Финальная интеграция, тестирование и полировка UI.

**Затрагиваемые файлы:**
- `modules/feedback-analytics/components/FeedbackAnalyticsPage.tsx` (обновление)
- `modules/feedback-analytics/components/UserReportsList.tsx` (обновление)

**Зависимости:** Все предыдущие этапы

**Детали:**
- Проверка консистентности стилей dark/light mode
- Адаптивность (mobile/desktop)
- Проверка поиска и сортировки
- Проверка состояний загрузки/ошибок
- Проверка пустых состояний ("Нет сообщений")

---

## Критерии готовности

- [x] API endpoint `/api/feedback-analytics/user-reports` работает и возвращает данные ✅
- [x] TypeScript типы добавлены и используются везде ✅
- [x] Hook `useUserReports` загружает данные и поддерживает сортировку ✅
- [x] Компонент `UserReportsList` корректно отображает сообщения ✅
- [x] Переключатель режимов работает ✅
- [x] Поиск работает по имени пользователя и тексту сообщения ✅
- [x] Сортировка по дате работает (новые/старые) ✅
- [x] Кнопка переключения стилизована как кнопка фильтров ✅
- [x] UI адаптивен и работает в dark/light режимах ✅

## Технические детали

### База данных
- Таблица: `user_reports`
- Поля:
  - `user_report_id` (uuid, PK)
  - `user_report_short_description` (text)
  - `user_report_detailed_description` (text, nullable)
  - `user_report_created_by` (uuid, FK → profiles)
  - `user_report_created_at` (timestamp)

### Архитектурные решения
- Не использовать cache module (следовать существующему паттерну с прямыми fetch)
- Переиспользовать компоненты UI (Card, Input, Button)
- Следовать существующей структуре папок модуля
- Не добавлять новые права доступа (использовать существующий `feedback_analytics_access`)
