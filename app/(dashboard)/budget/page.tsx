/**
 * Budget Management Page
 *
 * Страница управления бюджетом проекта
 * Route: /budget
 */

import { BudgetTable } from '@/modules/budget-management'

export const metadata = {
  title: 'Бюджет проекта | eneca.work',
  description: 'Управление бюджетом и декомпозиция трудозатрат',
}

export default function BudgetPage() {
  return <BudgetTable />
}
