/**
 * Budget Management Page
 *
 * Перенаправляет на страницу задач с вкладкой бюджетов.
 * Route: /budget
 */

import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Бюджет проекта | eneca.work',
  description: 'Управление бюджетом и декомпозиция трудозатрат',
}

export default function BudgetPage() {
  // Перенаправляем на страницу задач с вкладкой бюджетов
  redirect('/tasks')
}
