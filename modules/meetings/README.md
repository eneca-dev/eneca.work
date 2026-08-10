# Meetings (Созвоны)

Read-only просмотр **протоколов созвонов**, которые генерирует Teams-бот (recall.ai): список, поиск, просмотр структурированного протокола и скачивание `.docx`.

Пункт сайдбара — «Встречи», роут `/meetings`.

> **Источник данных:** таблица `meeting_reports` в **отдельном** Supabase-проекте (не основном). Доступ — серверный, через service-role клиент в Server Actions. Realtime отключён (бот пишет асинхронно; свежесть — через refetch/инвалидацию).

## Архитектура данных

```
Teams-бот → meeting_reports (отдельный Supabase)
                 │  service-role (server-only)
   modules/meetings/server/meetings-client.ts
                 │
   actions/reports.ts  (getMeetingReports, auth-проверка в основном проекте)
                 │  ActionResult<MeetingReport[]>
   hooks/use-meeting-reports.ts  (createSimpleCacheQuery)
                 │
   components/*  (read-only UI)
```

## Структура

```
modules/meetings/
├── index.ts
├── types.ts                 # MeetingReport, ProtocolReport (report jsonb) и пр.
├── search.ts                # searchReports() — поиск по теме/участникам/содержимому
├── highlight.ts             # splitHighlight() + HIGHLIGHT_CLASS
├── utils.ts                 # форматирование дат
├── store.ts                 # useMeetingsStore — только UI-состояние (выбор/поиск)
├── server/
│   └── meetings-client.ts   # service-role клиент к meetings-проекту (SERVER-ONLY)
├── actions/
│   └── reports.ts           # 'use server' — getMeetingReports
├── hooks/
│   └── use-meeting-reports.ts
└── components/
    ├── MeetingsPanel.tsx        # 2 панели (список | просмотр), адаптив
    ├── FolderFilterBar.tsx      # фильтр по папке (Select) + управление папками
    ├── FoldersManagerDialog.tsx # модалка: создать/переименовать/удалить папки
    ├── FolderAssignSelect.tsx   # назначить открытый созвон в папку
    ├── MeetingsList.tsx         # поиск + счётчик + список + состояния (loading/error/empty)
    ├── MeetingReportRow.tsx     # строка созвона
    ├── ReportViewer.tsx         # рендер протокола (report jsonb) + скачать .docx
    ├── InlineInput.tsx          # инлайн-поле «создать/переименовать»
    ├── ConfirmDialog.tsx        # подтверждение удаления (AlertDialog)
    ├── HighlightedText.tsx
    └── MeetingsSearchBar.tsx
```

## Ключевые концепции

- **Read-only.** Протоколы создаёт бот; приложение их только показывает/ищет/даёт скачать. CRUD протоколов нет.
- **Видимость:** созвон видит **владелец** (пригласивший бота — `meeting_reports.invited_by_email` = `profiles.email` текущего пользователя) **или** тот, кому созвон **расшарен**. Владелец помечается флагом `isOwner` (с сервера).
- **Шеринг:** владелец открывает доступ выбранным пользователям eneca.work (кнопка «Поделиться» → пикер из `useUsers`). Шеры хранятся в meetings-проекте (`meeting_report_shares`, `shared_with_user_id` = `profiles.user_id`). Право шерить проверяется на сервере (только владелец).
- **Данные через TanStack Query** (`useMeetingReports`), UI-состояние — в Zustand (`selectedReportId`, `searchQuery`).
- **Просмотр протокола** рендерит `report` (jsonb) как структуру: summary, участники, обсуждение, открытые вопросы, риски; плюс кнопки скачать `protocol_docx_url` / `transcript_docx_url`.
- **Поиск** клиентский по теме, участникам и содержимому протокола; совпадения в теме подсвечиваются.
- **Папки (локальный прототип):** группировка созвонов в папки + фильтр по папке. Хранятся в **localStorage** браузера (`zustand/persist`, ключ `meetings-folders`) — без бэкенда и привязки к серверу. Назначение созвона в папку — селект в шапке просмотра. Когда подключим реальные проекты, хранилище заменится на БД.
- **Безопасность:** service-role ключ только на сервере (`MEETINGS_SUPABASE_SERVICE_ROLE_KEY`), в клиентский бандл не попадает. Server Action требует авторизации в основном проекте.

## Окружение (.env.local)

```
MEETINGS_SUPABASE_URL=...                  # URL meetings-проекта
MEETINGS_SUPABASE_SERVICE_ROLE_KEY=...      # service-role, SERVER-ONLY (не NEXT_PUBLIC)
```

## Зависимости от meetings-проекта (выполнить SQL — см. `sql/meetings-project-setup.sql`)

1. `ALTER TABLE meeting_reports ADD COLUMN invited_by_email text;` — и **бот заполняет** email пригласившего (в том же регистре, что `profiles.email`; рекомендуется lowercase).
2. Таблица `meeting_report_shares` (создаётся тем же скриптом).

**Важно:** видимость теперь = «владелец или расшаренные». Пока бот не заполняет `invited_by_email`, владельцев нет → список будет **пустым** у всех. Это ожидаемо до доработки бота.

## Следующие шаги

- Загрузка/повторная генерация `.docx` — на стороне бота; приложение только ссылается на готовые URL.
- При переходе на реальные проекты (вместо локальных папок) — заменить localStorage-хранилище папок на БД.
