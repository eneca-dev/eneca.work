/**
 * Profile Transformation Utilities
 *
 * Утилиты для преобразования ProfileRow в domain типы
 */

/**
 * Преобразует ProfileRow в объект createdBy для отчетов
 *
 * @param profile - Profile row из Supabase
 * @returns Объект createdBy с полным именем и аватаром
 */
export function transformProfileToCreatedBy(
  profile: {
    user_id: string
    first_name: string | null
    last_name: string | null
    avatar_url: string | null
  } | null
) {
  return {
    id: profile?.user_id || '',
    firstName: profile?.first_name || null,
    lastName: profile?.last_name || null,
    name: profile
      ? `${profile.last_name || ''} ${profile.first_name || ''}`.trim() || null
      : null,
    avatarUrl: profile?.avatar_url || null,
  }
}
