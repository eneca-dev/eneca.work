import { PERMISSIONS, DATA_CONSTRAINTS } from './permissions'

// Шаблоны ролей с наборами разрешений
export const ROLE_TEMPLATES = {
  ADMIN: {
    permissions: [
      // Полные права на все модули
      ...Object.values(PERMISSIONS.PROJECTS),
      ...Object.values(PERMISSIONS.USERS),
      ...Object.values(PERMISSIONS.PLANNING),
      ...Object.values(PERMISSIONS.CALENDAR),
      ...Object.values(PERMISSIONS.ANNOUNCEMENTS)
    ],
    constraints: [
      DATA_CONSTRAINTS.PROJECTS.ALL,
      DATA_CONSTRAINTS.DEPARTMENTS.ALL,
      DATA_CONSTRAINTS.TEAMS.ALL,
      DATA_CONSTRAINTS.USERS.ALL
    ]
  },
  
  PROJECT_MANAGER: {
    permissions: [
      // Проекты - только управляемые
      PERMISSIONS.PROJECTS.VIEW_MANAGED,
      PERMISSIONS.PROJECTS.EDIT_MANAGED,
      PERMISSIONS.PROJECTS.ASSIGN_RESPONSIBLE,
      
      // Пользователи - просмотр всех
      PERMISSIONS.USERS.VIEW_ALL,
      
      // Планирование - полный доступ
      PERMISSIONS.PLANNING.VIEW_ALL,
      PERMISSIONS.PLANNING.EDIT_LOADINGS,
      PERMISSIONS.PLANNING.CREATE_PLAN_LOADINGS,
      PERMISSIONS.PLANNING.MANAGE_SECTIONS,
      
      // Календарь - базовый + личные события
      PERMISSIONS.CALENDAR.VIEW,
      PERMISSIONS.CALENDAR.CREATE_PERSONAL,
      PERMISSIONS.CALENDAR.EDIT_PERSONAL,
      
      // Объявления - просмотр
      PERMISSIONS.ANNOUNCEMENTS.VIEW
    ],
    constraints: [
      DATA_CONSTRAINTS.PROJECTS.MANAGED,
      DATA_CONSTRAINTS.DEPARTMENTS.ALL,
      DATA_CONSTRAINTS.TEAMS.ALL,
      DATA_CONSTRAINTS.USERS.ALL
    ]
  },
  
  DEPARTMENT_HEAD: {
    permissions: [
      // Проекты - просмотр всех
      PERMISSIONS.PROJECTS.VIEW_ALL,
      
      // Пользователи - управление отделом
      PERMISSIONS.USERS.VIEW_ALL,
      PERMISSIONS.USERS.EDIT_DEPARTMENT,
      PERMISSIONS.USERS.ASSIGN_ROLES,
      
      // Планирование - отдел
      PERMISSIONS.PLANNING.VIEW_ALL,
      PERMISSIONS.PLANNING.EDIT_LOADINGS,
      
      // Календарь - глобальные события
      PERMISSIONS.CALENDAR.VIEW,
      PERMISSIONS.CALENDAR.CREATE_PERSONAL,
      PERMISSIONS.CALENDAR.CREATE_GLOBAL,
      PERMISSIONS.CALENDAR.EDIT_PERSONAL,
      PERMISSIONS.CALENDAR.EDIT_GLOBAL,
      
      // Объявления - создание
      PERMISSIONS.ANNOUNCEMENTS.VIEW,
      PERMISSIONS.ANNOUNCEMENTS.CREATE,
      PERMISSIONS.ANNOUNCEMENTS.EDIT_OWN
    ],
    constraints: [
      DATA_CONSTRAINTS.PROJECTS.ALL,
      DATA_CONSTRAINTS.DEPARTMENTS.OWN,
      DATA_CONSTRAINTS.TEAMS.DEPARTMENT,
      DATA_CONSTRAINTS.USERS.DEPARTMENT
    ]
  },
  
  TEAM_LEAD: {
    permissions: [
      // Проекты - участвующие
      PERMISSIONS.PROJECTS.VIEW_PARTICIPATED,
      
      // Пользователи - команда
      PERMISSIONS.USERS.VIEW_ALL,
      PERMISSIONS.USERS.EDIT_TEAM,
      
      // Планирование - команда
      PERMISSIONS.PLANNING.VIEW_TEAM,
      PERMISSIONS.PLANNING.EDIT_LOADINGS,
      
      // Календарь - личные события
      PERMISSIONS.CALENDAR.VIEW,
      PERMISSIONS.CALENDAR.CREATE_PERSONAL,
      PERMISSIONS.CALENDAR.EDIT_PERSONAL,
      
      // Объявления - просмотр
      PERMISSIONS.ANNOUNCEMENTS.VIEW
    ],
    constraints: [
      DATA_CONSTRAINTS.PROJECTS.PARTICIPATED,
      DATA_CONSTRAINTS.DEPARTMENTS.OWN,
      DATA_CONSTRAINTS.TEAMS.OWN,
      DATA_CONSTRAINTS.USERS.TEAM
    ]
  },
  
  USER: {
    permissions: [
      // Проекты - только участвующие
      PERMISSIONS.PROJECTS.VIEW_PARTICIPATED,
      
      // Пользователи - только себя
      PERMISSIONS.USERS.VIEW_SELF,
      PERMISSIONS.USERS.EDIT_SELF,
      
      // Планирование - только свое
      PERMISSIONS.PLANNING.VIEW_OWN,
      
      // Календарь - личные события
      PERMISSIONS.CALENDAR.VIEW,
      PERMISSIONS.CALENDAR.CREATE_PERSONAL,
      PERMISSIONS.CALENDAR.EDIT_PERSONAL,
      PERMISSIONS.CALENDAR.DELETE_PERSONAL,
      
      // Объявления - просмотр
      PERMISSIONS.ANNOUNCEMENTS.VIEW
    ],
    constraints: [
      DATA_CONSTRAINTS.PROJECTS.PARTICIPATED,
      DATA_CONSTRAINTS.DEPARTMENTS.OWN,
      DATA_CONSTRAINTS.TEAMS.OWN,
      DATA_CONSTRAINTS.USERS.SELF
    ]
  }
} as const

// Системные роли, которые нельзя удалять
export const SYSTEM_ROLES = ['admin', 'user'] as const

// Роли, которые могут назначать другие роли
export const ROLE_ASSIGNERS = ['admin', 'department_head'] as const

// Проверка является ли роль системной
export const isSystemRole = (roleName: string): boolean => {
  return SYSTEM_ROLES.includes(roleName as any)
}

// Может ли пользователь назначать роли
export const canAssignRoles = (userRole: string): boolean => {
  return ROLE_ASSIGNERS.includes(userRole as any)
}

// Получение разрешений для роли
export const getRolePermissions = (roleName: string): string[] => {
  const roleKey = roleName.toUpperCase().replace(/[^A-Z]/g, '_') as keyof typeof ROLE_TEMPLATES
  return [...(ROLE_TEMPLATES[roleKey]?.permissions || [])]
}

// Получение ограничений для роли
export const getRoleConstraints = (roleName: string): string[] => {
  const roleKey = roleName.toUpperCase().replace(/[^A-Z]/g, '_') as keyof typeof ROLE_TEMPLATES
  return [...(ROLE_TEMPLATES[roleKey]?.constraints || [])]
} 