# Отчёт по задачам Worksection — план реализации

**Ветка:** `feature/Sb-01`
**Дата:** 2026-08-06

Отдельная вкладка с отчётом по задачам 3-го уровня Worksection, доступная одному пользователю.
Данные приходят из Worksection собственной синхронизацией, наша основная модель данных не участвует.

---

## 1. Границы: что НЕ трогаем

| Что | Затрагиваем |
|---|---|
| Существующие таблицы, вьюхи, `v_resource_graph` | ❌ |
| Существующий синк `ws-to-work/sync/` | ❌ |
| Модуль `permissions`, `roles`, `role_permissions` | ❌ |
| Модули `budgets`, `budgets-page`, `resource-graph` | ❌ |
| `TASKS_FILTER_CONFIG`, общий `InlineFilter` | ❌ |
| Новая таблица + новый модуль + 3 аддитивные правки | ✅ |

Если новая вкладка сломается — не пострадает ничего, кроме неё.

---

## 2. Доступ — персональный, без ролей

Ролевая система для этого не подходит: право нужно **одному человеку**, а не роли.
Заводить роль-однодневку — лишняя сущность. Делаем персональный список, по тому же
принципу «проверка в RLS», что и в остальном проекте, но без ролей и без `SECURITY DEFINER`.

```sql
create table public.ws_task_report_access (
  user_id uuid primary key references public.profiles(user_id) on delete cascade
);

alter table public.ws_task_report_access enable row level security;

-- каждый видит ТОЛЬКО свою строку:
--  1) список тех, у кого есть доступ, не утекает наружу
--  2) подзапрос в политике отчёта работает без SECURITY DEFINER
create policy ws_task_report_access_select
  on public.ws_task_report_access
  for select to authenticated
  using (user_id = auth.uid());

insert into public.ws_task_report_access (user_id)
values ('21e83443-be88-4653-87af-b5e4f2d4ed0b');  -- Дмитрий Голиков
```

Почему так, а не иначе:

- **Не роль** — право персональное, ровно как просили.
- **Не `SECURITY DEFINER`** — не нужен: политика на access-таблице разрешает
  ровно ту строку, которую ищет подзапрос.
- **Не хардкод UUID в политике** — добавить второго человека это `insert`,
  без миграции, деплоя и правки кода в двух местах.
- **Не колонка в `profiles`** — эту таблицу пишет синхронизация пользователей,
  плюс колонка на каждую фичу не масштабируется.

Одна таблица, одна политика, ноль функций.

---

## 3. Миграция

`supabase/migrations/2026-08-06_ws_task_report.sql`

### Таблица отчёта

```sql
create table public.ws_task_report (
  ws_task_id        text primary key,      -- ID задачи 3-го уровня в Worksection
  ws_task_name      text not null,
  ws_object_id      text,                  -- задача 1-го уровня
  ws_object_name    text,
  ws_section_id     text,                  -- задача 2-го уровня (контекст)
  ws_section_name   text,
  ws_project_id     text not null,
  ws_project_name   text,
  responsible_email text,
  responsible_name  text,
  department        text,                  -- отдел из WS group по маппингу
  ws_status         text not null,         -- 'active' | 'done'
  date_added        timestamptz,           -- дата открытия
  date_closed       timestamptz,           -- дата закрытия
  total_hours       numeric(10,2) not null default 0,
  total_money       numeric(14,2) not null default 0,
  planned_budget    numeric(14,2),         -- max_money из WS, null = не задан
  synced_at         timestamptz not null default now()
);

create index ws_task_report_department_idx on public.ws_task_report (department);
create index ws_task_report_status_idx     on public.ws_task_report (ws_status);
```

Триграммный индекс по названию не делаем: `pg_trgm` в проекте не установлен,
а при ~15 тыс. строк обычный `ilike '%слово%'` отрабатывает за миллисекунды.

Отдельной таблицы прогонов нет — «обновлено» берётся из `max(synced_at)`,
ошибки и прогресс видны в `/api/logs` самого синка.

### RLS

```sql
alter table public.ws_task_report enable row level security;

create policy ws_task_report_select
  on public.ws_task_report
  for select to authenticated
  using (exists (
    select 1 from public.ws_task_report_access a
    where a.user_id = auth.uid()
  ));

-- политик на insert/update/delete нет: пишет только service_role, он RLS обходит
```

После миграции — `npm run db:types`.

---

## 4. Синхронизация — внутри `ws-to-work`, отдельной папкой

Размещаем в существующем приложении: WS-клиент, логгер, конфиг, Docker, деплой и ключи
уже есть и работают. Но изолированно — свои файлы, свой эндпоинт, своё расписание.

```
d:\ws-to-work\
├── sync/                     # существующий синк — НЕ ТРОГАЕМ
├── services/worksection.js   # переиспользуем на чтение
├── utils/logger.js           # переиспользуем на чтение
├── config/env.js             # переиспользуем на чтение
├── task-report/              # ← новое
│   ├── report-sync.js        # логика синка
│   ├── departments.js        # маппинг WS group → отдел (копия из ws-users-to-work)
│   ├── supabase.js           # свой клиент, только своя таблица
│   └── scheduler.js          # своё расписание, свой флаг блокировки
└── app.js                    # +2 строки: роут и инициализация расписания
```

### Эндпоинт

`POST /api/task-report/sync` — **отвечает сразу** («запущено»), работа идёт в фоне.
Статус и логи — через существующий `GET /api/logs`.

Так специально: у существующего `/api/sync` есть баг — он `await`-ит весь синк
и только потом отвечает ([app.js:88](file:///d:/ws-to-work/app.js)), а в nginx-конфиге из
`DEPLOY.md` не задан `proxy_read_timeout` (дефолт 60 сек). Отсюда «обрубание по времени»:
nginx рвёт соединение, в браузере 504, хотя контейнер продолжает работать.
Крон-запуск идёт внутри процесса, без HTTP, поэтому по расписанию не рвётся.
Эту ошибку не повторяем.

### Расписание

Своя cron-задача, свой флаг `reportSyncInProgress`, независимый от основного синка.

Время: **4:30 по Минску, будни** (`30 4 * * 1-5`). Основной синк занимает слоты
0:00, 3:00, 6:00, 9:00…, наш прогон 3–5 минут — попадаем ровно между 3:00 и 6:00,
за rate limit не конкурируем.

### Алгоритм `report-sync.js`

1. `get_users` → построить карту `email → group → department` по маппингу
   16 отделов. Незамапленные группы (декрет, админы, клиенты) дают `department = null`.
2. `get_projects` → оставить проекты с тегом `eneca.work sync` / `eneca.work sync OS`,
   отбросить начинающиеся с `!`.
3. По каждому проекту, **с паузой `SYNC_DELAY_MS` между проектами**:
   1. `get_tasks(id_project)` → обойти дерево, собрать задачи 3-го уровня:
      `id, name, status, date_added, user_to.email, max_money` + имена родителей.
      Тип проекта определяем через `determineProjectSyncType`, как в основном синке:
      - **standard**: объект = задача 1-го уровня, раздел = 2-го, задача = 3-го
      - **os**: объекта нет, в `ws_object_name` пишем имя проекта
   2. Пропустить: имя начинается с `!`; `user_to` пустой / `ANY` / `NOONE`
   3. `get_costs(id_project)` → сгруппировать по `task.id`:
      `total_hours = Σ time`, `total_money = Σ money`, `date_closed` из вложенного task
   4. Для задач со `status = 'done'`, у которых `date_closed` не нашлась в costs —
      точечный `get_task(id_task)`
   5. Слить, проставить `department` по email, upsert батчами по 500
4. По завершении полного прогона удалить устаревшие строки:
   `delete from ws_task_report where synced_at < <время старта прогона>`
   — так уходят задачи, удалённые или потерявшие ответственного в Worksection.

### Защита от rate limit

Копируем подход основного синка: пауза `SYNC_DELAY_MS` между проектами,
ретрай с экспоненциальной задержкой на «Too many requests», `SYNC_MAX_RETRIES`.

Урок из вскрытия: в `costs-sync.js` **не было ни одной паузы**, и именно шаг с отчётами
умер 30.04.2026 — тихо, без следов в базе. Здесь паузы обязательны, а любая ошибка
пишется в лог и видна через `/api/logs`.

**Оценка:** 131 проект × 2 вызова + паузы ≈ 3–5 минут на полный прогон.

---

## 5. Страница в eneca.work

### Новый модуль `modules/ws-task-report/` — 8 файлов

```
actions/index.ts              # getWsTaskReport(filters), hasWsReportAccess()
hooks/index.ts                # через фабрики modules/cache
components/WsTaskReportView.tsx
components/ReportTable.tsx
types/index.ts
index.ts
module.meta.json
README.md
```

### Правки в существующем — 3 файла, только добавление

| Файл | Что |
|---|---|
| `modules/tasks/stores/tabs-store.ts` | `TasksViewMode` += `'wsreport'`, запись в `SYSTEM_TABS` |
| `modules/tasks/components/TasksTabs.tsx` | иконка в `VIEW_MODE_ICON_MAP`, скрытие вкладки без доступа |
| `modules/tasks/components/TasksView.tsx` | рендер вкладки, скрыть общий `InlineFilter` на ней |

> **Подводный камень:** `SYSTEM_TABS` персистятся в localStorage и принудительно
> восстанавливаются в `merge` (tabs-store.ts, строки 343–361). Фильтровать вкладку
> нужно **на рендере**, а не в сторе — иначе она осядет в localStorage у всех.

### Интерфейс

Шапка: `Отчёт по задачам Worksection` · `Обновлено: 06.08.2026 04:33 · 170 задач`

Фильтры:
- поиск по названию задачи, debounce 300 мс → `ilike` в Server Action
- отдел: по умолчанию отдел текущего пользователя, можно снять
- статус: все / открытые / закрытые

Таблица, 8 колонок:

| Объект | Задача | Дата открытия | Статус | Дата закрытия | Часы | Плановый бюджет | Сумма, BYN |
|---|---|---|---|---|---|---|---|

Сортировка по колонкам, итоговая строка (Σ часов, Σ суммы), скелетон, пустое состояние.
Даты через `formatMinskDate` из `lib/timezone-utils.ts`, суммы в BYN.

### Три барьера доступа

1. RLS в базе — главный
2. проверка в Server Action
3. скрытие вкладки в UI

Приложение **не знает о существовании синка**: никаких межсервисных вызовов,
кнопки «Обновить» нет. Синк по расписанию, страница только читает таблицу.
Упадёт синк — страница покажет данные постарше и честную дату, но не сломается.

---

## 6. Фазы

| Фаза | Что | Проверка |
|---|---|---|
| **1** | Миграция + `npm run db:types` | таблицы созданы, RLS работает, типы подхватились |
| **2** | `task-report/` в ws-to-work, первый прогон | сверить руками 5–10 задач с Worksection |
| **3** | Модуль + страница + таблица | данные видны, фильтры работают |
| **4** | Доступ и вкладка | Голиков видит, остальные нет; проверить прямой вызов action чужим пользователем |
| **5** | Аудит + документация | Security / TypeScript / Clean Code Guardian, README обоих проектов |

Коммит после каждой фазы.

---

## 7. Что проверяем на первом прогоне

1. **`group` заполнен у всех?** Незамапленные группы дадут `department = null`,
   такие задачи выпадут из фильтра по отделу.
2. **`max_money`** — действительно ли это то, что называют плановым бюджетом.
3. **OS-проекты** — как выглядят реальные строки, корректно ли имя проекта в «Объекте».
4. **`date_closed`** — сколько задач потребовало точечного `get_task`, не бьёт ли это по времени.
5. **Rate limit** — стартуем с паузы 1000 мс, корректируем по логам.

---

## 8. Итого

| | Файлов |
|---|---|
| Миграция в eneca.work | 1 |
| Новые файлы в ws-to-work | 4 (+2 строки в `app.js`) |
| Новые файлы модуля | 8 |
| Аддитивные правки | 3 |

Изменений в существующих данных и логике — ноль.

---

## 9. Побочная находка (вне этой задачи)

nginx в `DEPLOY.md` проксирует на порт **3001**, а приложение с 30.01.2026 слушает
**3004** (коммит `8671f4b`, healthcheck в `docker-compose.yml` тоже 3004).
Инструкция разошлась с кодом — стоит проверить боевую конфигурацию.

Отдельно: синхронизация отчётов (`work_logs`) в основном приложении не работает
с 30.04.2026. К этой задаче отношения не имеет, но на «Израсходовано» в бюджетах влияет.
