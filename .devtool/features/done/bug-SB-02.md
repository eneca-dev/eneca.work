---
id: "bug-SB-02"
status: "done"
priority: "medium"
assignee: "Саша Бирило"
epic: "bug"
dueDate: null
created: "2026-06-17T12:00:00.000Z"
modified: "2026-08-18T11:27:13.919Z"
completedAt: "2026-08-18T11:27:13.919Z"
labels: ["v1.5.0"]
order: "a14G"
---
# bug-SB-02 Двойной рендер `<RealtimeSync />` → двойная подписка на канал `cache-sync`

## Проблема

`<RealtimeSync />` рендерился в **двух** местах одновременно:
- `modules/cache/providers/query-provider.tsx` (по умолчанию, `disableRealtime=false`)
- `app/ClientProviders.tsx` (явно, после `AuthProvider`)

А `ClientProviders` оборачивает детей в `<QueryProvider>` → внутри одного дерева два инстанса `RealtimeSync`, оба создают канал `cache-sync` и вешают обработчики `postgres_changes`. Каждое realtime-событие обрабатывается дважды → дублирование инвалидаций (в консоли каждое `[RealtimeSync] UPDATE on ...` логируется по два раза). Под React StrictMode гонка mount/unmount двух инстансов на одном именованном канале может приводить к нестабильной доставке (вероятная причина «иногда не работает realtime» из bug-VT-16).

Module-level singleton guard в `realtime-sync.tsx` частично гасит дубль, но сам двойной рендер остаётся хрупким и легко ломается будущей правкой.

## Как воспроизвести
1. Открыть приложение, DevTools → Console.
2. Изменить что-либо (или дождаться realtime-события).
3. Каждое `[RealtimeSync] UPDATE on <table>` появляется дважды.

## Решение

Рендерить `<RealtimeSync />` ровно один раз — в `app/ClientProviders.tsx` (после `AuthProvider`, чтобы подписка стартовала после установки сессии). Убрать его из `QueryProvider`.

## Что сделано

`modules/cache/providers/query-provider.tsx` — убран рендер `<RealtimeSync />` + импорт + неиспользуемый проп `disableRealtime`. `QueryProvider` используется только в `ClientProviders` (проверено грепом), поэтому единственный инстанс `RealtimeSync` остаётся в `ClientProviders`. Канал `cache-sync` теперь один, события обрабатываются один раз.

## На что смотреть ревьюеру
1. Перезапустить dev-сервер, открыть Console: `[RealtimeSync] UPDATE on ...` логируется **один** раз (не два).
2. Realtime по-прежнему работает (правка в одной вкладке → обновление в другой).
3. `[RealtimeSync] Subscription status: SUBSCRIBED` появляется один раз.

## Связанные
- Снимает хрупкость, на которую опирался bug-VT-16 (realtime бюджетов).
- Замечание (вне этого тикета): поток realtime по всем таблицам в консоли — это нормальная рассылка изменений всей команды (firehose), не дубль. Сам объём широких инвалидаций (`*.all`) — кандидат на отдельную оптимизацию.