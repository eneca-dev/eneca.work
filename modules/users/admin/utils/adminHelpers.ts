// Вспомогательные функции для админ-панели

export function checkAdminAccess(permissions: string[]): boolean {
  return permissions?.includes("can_view_user_admin_panel") ?? false
}

export function formatAdminError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return "Произошла неизвестная ошибка"
}

export function getAdminTabTitle(tab: string): string {
  const titles: Record<string, string> = {
    departments: "Отделы",
    teams: "Команды", 
    positions: "Должности",
    categories: "Категории",
    roles: "Управление ролями"
  }
  return titles[tab] || tab
} 