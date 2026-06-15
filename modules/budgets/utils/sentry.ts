/**
 * Sentry helper для модуля бюджетов.
 *
 * Централизует отправку ошибок в Sentry с единым форматом контекста.
 * Отправляем только неожиданные ошибки — ошибки авторизации и валидации не отправляем.
 */

import * as Sentry from '@sentry/nextjs'

interface BudgetErrorContext {
  action: string
  [key: string]: unknown
}

/**
 * Отправляет неожиданную ошибку в Sentry с контекстом действия.
 * Используется в catch-блоках и при ошибках БД.
 */
export function captureBudgetError(
  error: unknown,
  context: BudgetErrorContext,
): void {
  Sentry.withScope((scope) => {
    scope.setTag('module', 'budgets')
    scope.setTag('action', context.action)
    scope.setContext('budget_action', context)
    Sentry.captureException(error)
  })
}
