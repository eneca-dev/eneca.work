---
id: "bug-DH-09"
status: "todo"
priority: "high"
assignee: "Дмитрий Хуцишвили"
epic: "bug"
dueDate: null
created: "2026-06-15T14:25:00.000Z"
modified: "2026-06-15T16:18:54.000Z"
completedAt: null
labels: ["v1.5.0"]
order: "b9"
---
# bug-DH-09 Ошибка CHANNEL_ERROR от RealtimeSync в консоли

## Описание
При тестировании страницы `/tasks` в консоли появляется ошибка, связанная с работой подписок Supabase:
`[log] [RealtimeSync] Subscription status: CHANNEL_ERROR Error: mismatch between server and client bindings for postgres changes`
`[warn] [RealtimeSync] Channel error/timeout, attempting reconnect...`

## Возможные причины
- Несоответствие параметров подписки (таблица, фильтры) с настройками RLS или публикациями на стороне сервера базы данных.
- Неправильная конфигурация RealtimeSync.

## Ссылки
- Найдено во время тестирования задачи: `test-DH-05` (Сценарий S5).

## Решение (2026-06-15)
Убран дубль `<RealtimeSync/>`: `QueryProvider` рендерил его по умолчанию И
`app/ClientProviders.tsx` рендерил второй — обе инстанции джойнили один канал
`'cache-sync'` с дублирующимися postgres_changes-биндингами → `CHANNEL_ERROR:
mismatch between server and client bindings`. Теперь `ClientProviders` передаёт
`<QueryProvider disableRealtime>`; остаётся ровно один `<RealtimeSync/>` (внутри
NoSSR + после AuthProvider). Баг был пре-существующим (коммит 61b9486, дек 2025),
не из фичи bug-DH-01. Сборка проходит.

## Переоткрыт (2026-06-15, после ручного теста)
Тестировщик: `CHANNEL_ERROR ... mismatch between server and client bindings` остался.
Удаление дубля было верным, но НЕДОСТАТОЧНЫМ. Систематический дебаг:
- Все 24 таблицы из `realtimeSubscriptions` ЕСТЬ в публикации `supabase_realtime`
  (проверено SQL) → гипотеза «таблицы нет в публикации» ОТВЕРГНУТА.
- В конфиге нет `filter` и нет дублей `table+event` → не из-за фильтров/дублей конфига.
- Второго канала `'cache-sync'` в репо нет (`useChat`/`userStoreSync` — другие топики).
- Дев-сервер имеет исправленный код (один `<RealtimeSync/>`), но ошибка осталась.
**Ведущая гипотеза:** DEV React Strict Mode (`reactStrictMode` по умолчанию true) → двойной
mount/cleanup `RealtimeSync` → асинхронный `removeChannel` гонится с повторным `subscribe`
→ транзиентный дубль join `'cache-sync'` на одном сокете → CHANNEL_ERROR → авто-reconnect
успешен (поэтому ошибка «мелькает» и чинится сама).
**Решающая проверка:** прод-сборка (`npm run start`). Нет ошибки в проде → это dev-артефакт
Strict Mode (чинить идемпотентным/защищённым cleanup подписки). Есть и в проде → копать
RLS/Realtime Authorization (сервер дропает часть биндингов → рассинхрон по индексу).

## Результат прод-теста (2026-06-15) — Strict Mode ОПРОВЕРГНУТ
Прогон в прод-сборке (`npm run start`): `console.warn` «Channel error/timeout, attempting
reconnect» **присутствует и в проде** (детальный `console.log` со словом `mismatch` Next в
проде вырезает, но сам отвал канала есть). → Гипотеза «безобидный dev-артефакт Strict Mode»
**отклонена**. Причина **серверная**: Realtime регистрирует МЕНЬШЕ postgres_changes-биндингов,
чем клиент шлёт (24), → рассинхрон по индексу в `realtime-js` → CHANNEL_ERROR.

## План фикса (DH-09)

### Этап 0 — Точная локализация (ОБЯЗАТЕЛЬНО первым, без него не фиксить)
Цель: узнать, сколько биндингов реально вернул сервер vs 24, и КАКАЯ таблица дропается.
- **0a. Инструментирование:** в `modules/cache/realtime/realtime-sync.tsx` временно логировать
  через `console.warn` (НЕ `log` — вырезается в проде): число клиентских биндингов и длину
  `postgres_changes` в ответе join. Несовпадение длин = подтверждение «сервер дропнул N».
- **0b. Бисект конфига:** половинить массив `realtimeSubscriptions` (24→12→6→…), пока
  `CHANNEL_ERROR` не исчезнет, — так вычислить таблицу(ы)-виновника. Дёшево, БД не трогает.

### Этап 1 — Серверная диагностика таблицы-виновника
- RLS включён на таблице? Есть ли policy, разрешающая realtime/`authenticated` SELECT?
  (Realtime Authorization гейтит postgres_changes — без policy сервер дропает биндинг.)
- `REPLICA IDENTITY` таблицы (для UPDATE/DELETE).
- Членство в публикации `supabase_realtime` (уже подтверждено для всех 24).
- Проверить, не упираемся ли в лимит числа postgres_changes-биндингов на ОДИН канал
  (известная проблема при многих биндингах на одном топике).

### Этап 2 — Фикс (выбор по результату Этапа 1)
- Таблица без realtime-RLS → добавить policy (через миграцию, с апрувом) ЛИБО убрать таблицу
  из `realtimeSubscriptions`, если realtime по ней не нужен.
- Если лимит биндингов на канал → разбить 24 подписки на несколько каналов
  (`cache-sync-1/2/3` по ~8) — один битый биндинг тогда не роняет весь канал.
- Сделать `RealtimeSync` устойчивым: изоляция сбоя одного биндинга от остальных.

### Этап 3 — Диагностика/DX
- Заменить `console.log('[RealtimeSync] Subscription status', …)` на `console.warn`/structured
  (+ Sentry breadcrumb), иначе в проде детализация mismatch теряется (подтверждено тестом).

### Этап 4 — Верификация
- Прод-сборка: в Console нет `CHANNEL_ERROR`, статус доходит до `SUBSCRIBED`.
- Realtime-инвалидация работает: изменить запись в БД → соответствующий UI обновился.

### Агенты (по CLAUDE.md)
Realtime Guardian (подписки/cleanup), DB Architect + Security Guardian (RLS policy, если фикс в БД).

> Не входит в DH-09: deep-link **DH-08** и tab-scope realtime **DH-10** — отдельные тикеты.
