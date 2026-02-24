import type { CheckpointStatus } from '../types'

/**
 * Цвета статусов чекпоинтов
 */
export const STATUS_COLORS: Record<CheckpointStatus, string> = {
  pending: '#eab308',        // yellow-500
  overdue: '#ef4444',        // red-500
  completed_late: '#f97316', // orange-500
  completed: '#22c55e',      // green-500
}

/**
 * Вычислить статус чекпоинта на основе даты завершения и дедлайна
 * @param completedAt - Дата завершения (ISO string или null)
 * @param checkpointDate - Дата дедлайна (ISO string)
 * @returns Статус чекпоинта
 */
export function calculateCheckpointStatus(
  completedAt: string | null,
  checkpointDate: string
): CheckpointStatus {
  const now = new Date()
  now.setHours(0, 0, 0, 0) // Сброс времени для корректного сравнения дат

  const deadline = new Date(checkpointDate)
  deadline.setHours(0, 0, 0, 0)

  if (completedAt) {
    const completed = new Date(completedAt)
    completed.setHours(0, 0, 0, 0)

    // Выполнен в срок или с опозданием
    return completed <= deadline ? 'completed' : 'completed_late'
  }

  // Не выполнен: просрочен или ожидается
  return now > deadline ? 'overdue' : 'pending'
}

/**
 * Получить читаемое название статуса
 * @param status - Статус чекпоинта
 * @returns Название статуса на русском
 */
export function getStatusLabel(status: CheckpointStatus): string {
  const labels: Record<CheckpointStatus, string> = {
    pending: 'Ожидается',
    overdue: 'Просрочен',
    completed_late: 'Выполнен с опозданием',
    completed: 'Выполнен',
  }
  return labels[status]
}
