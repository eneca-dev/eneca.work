// Константы разрешений с модульной структурой

export const PERMISSIONS = {
  // Проекты
  PROJECTS: {
    VIEW_ALL: 'projects.view.all',
    VIEW_MANAGED: 'projects.view.managed',
    VIEW_PARTICIPATED: 'projects.view.participated',
    CREATE: 'projects.create',
    EDIT_ALL: 'projects.edit.all',
    EDIT_MANAGED: 'projects.edit.managed',
    EDIT_OWN: 'projects.edit.own',
    DELETE: 'projects.delete',
    ASSIGN_RESPONSIBLE: 'projects.assign_responsible',
    ADMIN: 'projects.admin'
  },
  
  // Пользователи
  USERS: {
    VIEW_ALL: 'users.view.all',
    VIEW_DEPARTMENT: 'users.view.department',
    VIEW_TEAM: 'users.view.team',
    VIEW_SELF: 'users.view.self',
    EDIT_ALL: 'users.edit.all',
    EDIT_DEPARTMENT: 'users.edit.department',
    EDIT_TEAM: 'users.edit.team',
    EDIT_SELF: 'users.edit.self',
    CREATE: 'users.create',
    DELETE: 'users.delete',
    ADMIN_PANEL: 'users.admin_panel',
    ASSIGN_ROLES: 'users.assign_roles',
    ASSIGN_ADMIN_ROLE: 'users.assign_admin_role',
    // Управление структурой
    MANAGE_ROLES: 'users.manage.roles',
    MANAGE_DEPARTMENTS: 'users.manage.departments',
    MANAGE_TEAMS: 'users.manage.teams',
    MANAGE_POSITIONS: 'users.manage.positions',
    MANAGE_CATEGORIES: 'users.manage.categories'
  },
  
  // Планирование
  PLANNING: {
    VIEW_ALL: 'planning.view.all',
    VIEW_DEPARTMENT: 'planning.view.department',
    VIEW_TEAM: 'planning.view.team',
    VIEW_OWN: 'planning.view.own',
    EDIT_LOADINGS: 'planning.edit.loadings',
    CREATE_PLAN_LOADINGS: 'planning.create.plan_loadings',
    MANAGE_SECTIONS: 'planning.manage.sections',
    ADMIN: 'planning.admin'
  },
  
  // Календарь
  CALENDAR: {
    VIEW: 'calendar.view',
    CREATE_PERSONAL: 'calendar.create.personal',
    CREATE_GLOBAL: 'calendar.create.global',
    EDIT_PERSONAL: 'calendar.edit.personal',
    EDIT_GLOBAL: 'calendar.edit.global',
    DELETE_PERSONAL: 'calendar.delete.personal',
    DELETE_GLOBAL: 'calendar.delete.global',
    MANAGE_WORK_SCHEDULE: 'calendar.manage.work_schedule',
    ADMIN: 'calendar.admin'
  },
  
  // Объявления
  ANNOUNCEMENTS: {
    VIEW: 'announcements.view',
    CREATE: 'announcements.create',
    EDIT_ALL: 'announcements.edit.all',
    EDIT_OWN: 'announcements.edit.own',
    DELETE_ALL: 'announcements.delete.all',
    DELETE_OWN: 'announcements.delete.own',
    ADMIN: 'announcements.admin'
  },
  
  // Иерархические статусы (для фильтров)
  HIERARCHY: {
    IS_ADMIN: 'hierarchy.is_admin',
    IS_DEPARTMENT_HEAD: 'hierarchy.is_department_head',
    IS_PROJECT_MANAGER: 'hierarchy.is_project_manager',
    IS_TEAM_LEAD: 'hierarchy.is_team_lead',
    IS_USER: 'hierarchy.is_user'
  }
} as const

export const DATA_CONSTRAINTS = {
  // Проекты
  PROJECTS: {
    ALL: 'projects.scope.all',
    MANAGED: 'projects.scope.managed',
    PARTICIPATED: 'projects.scope.participated'
  },
  
  // Отделы
  DEPARTMENTS: {
    ALL: 'departments.scope.all',
    OWN: 'departments.scope.own',
    MANAGED: 'departments.scope.managed'
  },
  
  // Команды
  TEAMS: {
    ALL: 'teams.scope.all',
    DEPARTMENT: 'teams.scope.department',
    OWN: 'teams.scope.own'
  },
  
  // Пользователи
  USERS: {
    ALL: 'users.scope.all',
    DEPARTMENT: 'users.scope.department',
    TEAM: 'users.scope.team',
    SELF: 'users.scope.self'
  }
} as const

// Утилиты для работы с разрешениями
export const getPermissionParts = (permission: string) => {
  const parts = permission.split('.')
  return {
    module: parts[0],
    action: parts[1],
    scope: parts[2] || 'all'
  }
}

export const buildPermission = (module: string, action: string, scope?: string) => {
  return scope ? `${module}.${action}.${scope}` : `${module}.${action}`
}

// Проверка является ли разрешение системным
export const isSystemPermission = (permission: string): boolean => {
  const systemPermissions: string[] = [
    PERMISSIONS.USERS.ADMIN_PANEL,
    PERMISSIONS.USERS.ASSIGN_ADMIN_ROLE
  ]
  return systemPermissions.includes(permission)
} 