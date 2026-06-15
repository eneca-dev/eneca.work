---
id: "bug-DH-09"
status: "done"
priority: "high"
assignee: "Дмитрий Хуцишвили"
epic: "bug"
dueDate: null
created: "2026-06-15T14:25:00.000Z"
modified: "2026-06-15T15:03:32.000Z"
completedAt: "2026-06-15T15:03:32.000Z"
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
