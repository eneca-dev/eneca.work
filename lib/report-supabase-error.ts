import * as Sentry from '@sentry/nextjs'

/** Ошибка запроса к Supabase (PostgrestError) — обычный объект без стека. */
interface SupabaseLikeError {
  message?: string
  code?: string
  details?: string
  hint?: string
}

/** Признаки оборванного/сетевого запроса (не сбой приложения, а уход со страницы / моргнувшая сеть). */
const NETWORK_ERROR_RE =
  /failed to fetch|networkerror|network error|load failed|the operation was aborted|aborted/i

/**
 * Классифицирует и логирует ошибку запроса к Supabase РОВНО ОДИН раз.
 *
 * Supabase возвращает ошибку обычным объектом ({ code, details, hint, message }) без стека.
 * Если передать его напрямую в Sentry.captureException, Sentry не может построить группировку
 * и сваливает разные ошибки в кашу «Object captured as exception». Поэтому здесь:
 *   - сетевой обрыв (юзер ушёл со страницы / моргнула сеть) НЕ считаем сбоем приложения —
 *     фиксируем тихий breadcrumb;
 *   - настоящую ошибку БД (RLS, ограничение и т.п.) оборачиваем в Error с понятным сообщением,
 *     чтобы Sentry сгруппировал её корректно.
 */
export function reportSupabaseError(
  error: unknown,
  context: { module: string; action: string; extra?: Record<string, unknown> }
): void {
  const err = (error ?? {}) as SupabaseLikeError
  const message = err.message || 'Unknown Supabase error'
  const isNetwork = NETWORK_ERROR_RE.test(message)

  if (isNetwork) {
    Sentry.addBreadcrumb({
      category: context.module,
      level: 'info',
      message: `${context.action}: запрос оборван (сеть / уход со страницы), не сбой приложения`,
      data: { error: message },
    })
    return
  }

  // Настоящая ошибка БД — оборачиваем в Error, чтобы Sentry показал понятное сообщение.
  // fingerprint фиксирует группировку по МЕСТУ вызова (module + action), иначе Sentry
  // сгруппировал бы все ошибки по стеку этого файла-помощника и свалил бы их в одну кучу.
  const dbError = new Error(message)
  dbError.name = 'SupabaseError'
  Sentry.captureException(dbError, {
    tags: { module: context.module, action: context.action, error_type: 'db_error' },
    fingerprint: ['supabase-error', context.module, context.action],
    extra: { code: err.code, details: err.details, hint: err.hint, ...context.extra },
  })
}
