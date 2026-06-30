---
id: "bug-SB-06"
status: "review"
priority: "medium"
assignee: "Саша Бирило"
epic: "bug"
dueDate: null
created: "2026-06-26T09:00:00.000Z"
modified: "2026-06-26T09:00:00.000Z"
completedAt: null
labels: ["v1.5.0"]
order: "a22"
---
# bug-SB-06 Чистка шумных Sentry-ошибок: getFilterContext Auth error + «Object captured» в календаре

## Проблема

Топ потока ошибок в Sentry (и алертов в Telegram через `telega_errors_repeated`) занимали события, которые **не являются багами приложения**, а штатными/сетевыми состояниями. Из-за этого:
- мониторинг зашумлён ложными сигналами;
- за шумом **теряются настоящие сбои**;
- счётчики раздуты (часть ошибок логировалась дважды).

Разбирались два типа (Realtime — самый частый — **намеренно отложен**, он архитектурный: 24 подписки на одном канале, см. конец).

### Тип 1: `getFilterContext: Auth error` (~1623 события, 0 affected)
`getFilterContext` — «привратник» прав доступа, зовётся в ~25 местах. Первым делом делает `supabase.auth.getUser()`. Когда у запроса нет активной сессии, возвращается ошибка, и код логировал её как `captureMessage(level: warning)`.

**Реальная причина (подтверждена локально):** ошибка — это `AuthSessionMissingError` (`status: 400`, `message: "Auth session missing!"`). Возникает, когда access-токен истёк/отсутствует. Это **штатное состояние**: `middleware` (`utils/supabase/middleware.ts`) уже обрабатывает его редиректом на `/auth/login`, а сам `getFilterContext` всё равно отклоняет доступ (`return success:false`). То есть лог дублировал то, что middleware уже разруливает.

В Sentry текст был скрыт (`[Filtered]`), поэтому тип подтвердили временным `console.log` на dev: все события — `AuthSessionMissingError`.

### Тип 2: `Object captured as exception with keys: code, details, hint, message` (~360/мес, 26 юзеров)
Источник — клиентские fetch-хуки `useCalendarEvents.fetchEvents` и `useWorkSchedule.fetchWorkSchedules`. **Важно про частоту:** их вызывает не редко посещаемая страница календаря (`CalendarPage`), а виджет `WeeklyCalendar` (`components/weekly-calendar.tsx`), встроенный в боковую панель (`components/sidebar.tsx`) — а сайдбар присутствует на **всех** страницах дашборда (включая `/tasks`). Поэтому в Sentry эти события идут с `transaction: /tasks` и затрагивают много юзеров. Три отдельные проблемы:
1. **Двойное логирование** — ошибка ловилась в `if (error)` (lvl `db_error`) → `throw` → повторно в `catch` (lvl `unexpected_error`). Одно падение = два события.
2. **Сырой объект в Sentry** — `captureException(error)` получал PostgrestError-объект без стека → Sentry не мог сгруппировать → каша «Object captured» / «`<anonymous>`».
3. **Обрыв сети как ошибка БД** — `TypeError: Failed to fetch` (юзер ушёл со страницы / моргнула сеть) логировался с `error_type: 'db_error'`.

## Что сделано

### Фикс 1 — `modules/permissions/server/get-filter-context.ts`
Разделили два случая в обработке `authError`:
- `AuthSessionMissingError` → `Sentry.addBreadcrumb` (тихий след, **не создаёт событие**);
- любой **другой** auth-сбой (недоступность Auth-сервиса, повреждённый токен) → `captureMessage` как раньше (**остаётся видимым**).

Поведение и защита **не изменены**: проверка та же, доступ так же отклоняется.

### Фикс 2 — новый помощник + два хука
- **`lib/report-supabase-error.ts`** (новый): классифицирует ошибку Supabase и логирует **ровно один раз**:
  - сетевой обрыв (`Failed to fetch` и т.п.) → `addBreadcrumb` (не ошибка);
  - реальная ошибка БД → `captureException(new Error(message))` с `fingerprint: ['supabase-error', module, action]`.
- **`fingerprint`** обязателен: иначе обёртка `new Error()` дала бы всем ошибкам стек самого помощника, и Sentry свалил бы их в одну группу. Fingerprint группирует по месту вызова (`fetch_events` / `fetch_work_schedules`).
- **`useCalendarEvents.ts` / `useWorkSchedule.ts`**: из `if (error)` убран `captureException` (оставлен `throw`), в `catch` — единственный вызов `reportSupabaseError`. `setError` + `toast` сохранены (UX не изменён).

## Почему так (принцип)
Не «выключаем мониторинг», а **перестаём классифицировать штатные/сетевые состояния как ошибки приложения**; настоящие ошибки остаются видимыми и становятся читаемее (понятный `Error` вместо сырого объекта, один лог вместо двух).

## Проверка
- **Тип 1:** локальный `console.log` на dev → все события `AuthSessionMissingError / 400 / "Auth session missing!"`. После фикса событие в Sentry по этому случаю не создаётся (`addBreadcrumb` не шлёт запрос).
- **Тип 2:** при нормальной сети календарь грузится штатно (рабочий путь не сломан). Для обрыва именно одного запроса нужен «Block request domain: supabase.co» в DevTools (offline+reload не подходит — не грузится сам сайт). Окончательное подтверждение — в проде: группа «Object captured» по календарю перестаёт расти.

## Затронутые файлы
- `modules/permissions/server/get-filter-context.ts` — разделение auth-случаев.
- `lib/report-supabase-error.ts` — **новый** помощник.
- `modules/calendar/hooks/useCalendarEvents.ts` — `fetchEvents`.
- `modules/calendar/hooks/useWorkSchedule.ts` — `fetchWorkSchedules`.

## На заметку ревьюеру / на будущее
- ⚠️ **Слепое пятно:** все `Failed to fetch` теперь молчат, а правило алертов по массовости (`>N юзеров`) было **откатано**. Если Supabase массово ляжет именно на этих запросах — это не будет видно в данных логах. Учесть при возврате к настройке алертов / uptime-мониторинга.
- Тем же помощником стоит починить остальные места с тем же паттерном (двойной лог / сырой объект):
  - `loadUserProfile` (`modules/auth/components/AuthProvider.tsx`) — `Failed to fetch` профиля (issue ENECA-YK);
  - мутации календаря `createEvent` / `removeEvent` (двойной лог там тоже есть).
- Классификация сети идёт по тексту сообщения (`NETWORK_ERROR_RE`) — при появлении новых формулировок обрыва дополнить регэксп.

## Связанные
- **bug-SB-05** — ускорение `getFilterContext` (`auth.getUser` → `getClaims`): другая сторона той же функции, но про скорость, не про шум.
- Realtime (`Realtime connection failed / channel closed`) — **отложен**: архитектурное (24 подписки на одном канале `cache-sync`, дефолтный timeout 10с). Требует разбивки каналов / увеличения timeout / реакции на `visibilitychange` + тестирования.
