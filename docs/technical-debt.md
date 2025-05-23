# Технический долг

## Проблема с серверным Supabase клиентом (`utils/supabase/server.ts`)

- В файле реализован серверный клиент Supabase с поддержкой cookies через функцию `cookies()` из `next/headers`.
- В текущей реализации возможна ошибка: объект cookies может быть Promise, а не объект с методами `get` и `set`, что приведёт к ошибкам выполнения.
- На данный момент cookies работают корректно, вероятно, из-за использования других механизмов (middleware, client-side cookies и т.д.).
- Файл используется только в `app/auth/callback/route.ts` и не влияет на основную работу приложения.
- Необходимо:
  - Проверить актуальность реализации под используемую версию Next.js.
  - При необходимости исправить типизацию и работу с cookies.
  - Удалить или оптимизировать файл, если серверный клиент не используется.

> Этот момент зафиксирован как технический долг для последующего анализа и возможного рефакторинга. 