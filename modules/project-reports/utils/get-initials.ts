/**
 * Получить инициалы из имени и фамилии
 */
export function getInitials(firstName?: string | null, lastName?: string | null): string {
  const first = firstName?.[0] || ''
  const last = lastName?.[0] || ''
  return (first + last).toUpperCase() || '?'
}
