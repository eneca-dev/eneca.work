import { PERMISSIONS } from './permissions'

// Определение ключевых ролей системы
export const ROLE_NAMES = {
  ADMIN: 'admin',
  DEPARTMENT_HEAD: 'department_head', 
  PROJECT_MANAGER: 'project_manager',
  TEAM_LEAD: 'team_lead',
  SPECIALIST: 'specialist',
  JUNIOR_SPECIALIST: 'junior_specialist',
  USER: 'user' // Базовая роль (пока оставляем для совместимости)
} as const

// Описания ролей
export const ROLE_DESCRIPTIONS = {
  [ROLE_NAMES.ADMIN]: 'Администратор системы - полные права управления системой',
  [ROLE_NAMES.DEPARTMENT_HEAD]: 'Руководитель отдела - управление крупными подразделениями',
  [ROLE_NAMES.PROJECT_MANAGER]: 'Руководитель проекта - управление конкретными проектами', 
  [ROLE_NAMES.TEAM_LEAD]: 'Руководитель команды - управление небольшими рабочими группами',
  [ROLE_NAMES.SPECIALIST]: 'Специалист - основной рабочий персонал компании',
  [ROLE_NAMES.JUNIOR_SPECIALIST]: 'Младший специалист/стажер с ограниченными правами',
  [ROLE_NAMES.USER]: 'Базовая роль пользователя системы'
} as const

// Цветовое кодирование ролей
export const ROLE_COLORS = {
  [ROLE_NAMES.ADMIN]: '#dc2626',           // 🔴 Красный
  [ROLE_NAMES.DEPARTMENT_HEAD]: '#ea580c', // 🟠 Оранжевый
  [ROLE_NAMES.PROJECT_MANAGER]: '#0ea5e9', // 🔵 Голубой
  [ROLE_NAMES.TEAM_LEAD]: '#059669',       // 🟢 Зеленый
  [ROLE_NAMES.SPECIALIST]: '#4338ca',      // 🔷 Синий
  [ROLE_NAMES.JUNIOR_SPECIALIST]: '#6b7280', // ⚪ Серый
  [ROLE_NAMES.USER]: '#64748b'             // Темно-серый
} as const

// Шаблоны ролей с их разрешениями (соответствие БД)
export const ROLE_TEMPLATES = {
  [ROLE_NAMES.ADMIN]: {
    permissions: [
      // Hierarchy
      PERMISSIONS.HIERARCHY.IS_ADMIN,
      
      // Users - полные права
      PERMISSIONS.USERS.ADMIN_PANEL,
      PERMISSIONS.USERS.VIEW_ALL,
      PERMISSIONS.USERS.CREATE,
      PERMISSIONS.USERS.EDIT_ALL,
      PERMISSIONS.USERS.DELETE,
      PERMISSIONS.USERS.ASSIGN_ROLES,
      PERMISSIONS.USERS.ASSIGN_ADMIN_ROLE,
      
      // Projects - полные права
      PERMISSIONS.PROJECTS.VIEW_ALL,
      PERMISSIONS.PROJECTS.CREATE,
      PERMISSIONS.PROJECTS.EDIT_ALL,
      PERMISSIONS.PROJECTS.DELETE,
      
      // Planning - полные права
      PERMISSIONS.PLANNING.VIEW_ALL,
      PERMISSIONS.PLANNING.EDIT_LOADINGS,
      PERMISSIONS.PLANNING.CREATE_PLAN_LOADINGS,
      
      // Calendar - полные права
      PERMISSIONS.CALENDAR.VIEW,
      PERMISSIONS.CALENDAR.CREATE_PERSONAL,
      PERMISSIONS.CALENDAR.EDIT_PERSONAL,
      PERMISSIONS.CALENDAR.CREATE_GLOBAL,
      PERMISSIONS.CALENDAR.EDIT_GLOBAL,
      
      // Announcements - полные права
      PERMISSIONS.ANNOUNCEMENTS.VIEW,
      PERMISSIONS.ANNOUNCEMENTS.CREATE,
      PERMISSIONS.ANNOUNCEMENTS.EDIT_ALL
    ]
  },

  [ROLE_NAMES.DEPARTMENT_HEAD]: {
    permissions: [
      // Hierarchy
      PERMISSIONS.HIERARCHY.IS_DEPARTMENT_HEAD,
      
      // Users - управление отделом
      PERMISSIONS.USERS.VIEW_ALL,
      PERMISSIONS.USERS.EDIT_ALL,
      PERMISSIONS.USERS.ASSIGN_ROLES,
      
      // Projects - просмотр всех
      PERMISSIONS.PROJECTS.VIEW_ALL,
      
      // Planning - отдел
      PERMISSIONS.PLANNING.VIEW_ALL,
      PERMISSIONS.PLANNING.EDIT_LOADINGS,
      
      // Calendar - глобальные события
      PERMISSIONS.CALENDAR.VIEW,
      PERMISSIONS.CALENDAR.CREATE_PERSONAL,
      PERMISSIONS.CALENDAR.EDIT_PERSONAL,
      PERMISSIONS.CALENDAR.CREATE_GLOBAL,
      PERMISSIONS.CALENDAR.EDIT_GLOBAL,
      
      // Announcements - создание
      PERMISSIONS.ANNOUNCEMENTS.VIEW,
      PERMISSIONS.ANNOUNCEMENTS.CREATE
    ]
  },

  [ROLE_NAMES.PROJECT_MANAGER]: {
    permissions: [
      // Hierarchy
      PERMISSIONS.HIERARCHY.IS_PROJECT_MANAGER,
      
      // Users - просмотр всех
      PERMISSIONS.USERS.VIEW_ALL,
      
      // Projects - управляемые проекты
      PERMISSIONS.PROJECTS.VIEW_ALL,
      PERMISSIONS.PROJECTS.EDIT_ALL,
      
      // Planning - полный доступ
      PERMISSIONS.PLANNING.VIEW_ALL,
      PERMISSIONS.PLANNING.EDIT_LOADINGS,
      PERMISSIONS.PLANNING.CREATE_PLAN_LOADINGS,
      
      // Calendar - личные события
      PERMISSIONS.CALENDAR.VIEW,
      PERMISSIONS.CALENDAR.CREATE_PERSONAL,
      PERMISSIONS.CALENDAR.EDIT_PERSONAL,
      
      // Announcements - просмотр
      PERMISSIONS.ANNOUNCEMENTS.VIEW
    ]
  },

  [ROLE_NAMES.TEAM_LEAD]: {
    permissions: [
      // Hierarchy
      PERMISSIONS.HIERARCHY.IS_TEAM_LEAD,
      
      // Users - просмотр всех
      PERMISSIONS.USERS.VIEW_ALL,
      
      // Projects - участвующие
      PERMISSIONS.PROJECTS.VIEW_ALL,
      
      // Planning - команда
      PERMISSIONS.PLANNING.VIEW_ALL,
      PERMISSIONS.PLANNING.EDIT_LOADINGS,
      
      // Calendar - личные события
      PERMISSIONS.CALENDAR.VIEW,
      PERMISSIONS.CALENDAR.CREATE_PERSONAL,
      PERMISSIONS.CALENDAR.EDIT_PERSONAL,
      
      // Announcements - просмотр
      PERMISSIONS.ANNOUNCEMENTS.VIEW
    ]
  },

  [ROLE_NAMES.SPECIALIST]: {
    permissions: [
      // Hierarchy
      PERMISSIONS.HIERARCHY.IS_USER,
      
      // Users - просмотр всех
      PERMISSIONS.USERS.VIEW_ALL,
      
      // Projects - участвующие
      PERMISSIONS.PROJECTS.VIEW_ALL,
      
      // Planning - просмотр
      PERMISSIONS.PLANNING.VIEW_ALL,
      
      // Calendar - личные события
      PERMISSIONS.CALENDAR.VIEW,
      PERMISSIONS.CALENDAR.CREATE_PERSONAL,
      PERMISSIONS.CALENDAR.EDIT_PERSONAL,
      
      // Announcements - просмотр
      PERMISSIONS.ANNOUNCEMENTS.VIEW
    ]
  },

  [ROLE_NAMES.JUNIOR_SPECIALIST]: {
    permissions: [
      // Hierarchy
      PERMISSIONS.HIERARCHY.IS_USER,
      
      // Users - просмотр всех (в будущем ограничим)
      PERMISSIONS.USERS.VIEW_ALL,
      
      // Projects - просмотр всех (в будущем ограничим)
      PERMISSIONS.PROJECTS.VIEW_ALL,
      
      // Calendar - только личные события
      PERMISSIONS.CALENDAR.VIEW,
      PERMISSIONS.CALENDAR.CREATE_PERSONAL,
      PERMISSIONS.CALENDAR.EDIT_PERSONAL,
      
      // Announcements - просмотр
      PERMISSIONS.ANNOUNCEMENTS.VIEW
    ]
  },

  [ROLE_NAMES.USER]: {
    permissions: [
      // Hierarchy
      PERMISSIONS.HIERARCHY.IS_USER,
      
      // Users - просмотр всех
      PERMISSIONS.USERS.VIEW_ALL,
      
      // Projects - участвующие
      PERMISSIONS.PROJECTS.VIEW_ALL,
      
      // Planning - просмотр
      PERMISSIONS.PLANNING.VIEW_ALL,
      
      // Calendar - личные события
      PERMISSIONS.CALENDAR.VIEW,
      PERMISSIONS.CALENDAR.CREATE_PERSONAL,
      PERMISSIONS.CALENDAR.EDIT_PERSONAL,
      
      // Announcements - просмотр
      PERMISSIONS.ANNOUNCEMENTS.VIEW
    ]
  }
} as const

// Системные роли (нельзя удалить)
export const SYSTEM_ROLES = [
  ROLE_NAMES.ADMIN,
  ROLE_NAMES.USER
] as const

// Роли, которые может назначать каждая роль
export const ROLE_ASSIGNERS = {
  [ROLE_NAMES.ADMIN]: [
    ROLE_NAMES.DEPARTMENT_HEAD,
    ROLE_NAMES.PROJECT_MANAGER,
    ROLE_NAMES.TEAM_LEAD,
    ROLE_NAMES.SPECIALIST,
    ROLE_NAMES.JUNIOR_SPECIALIST,
    ROLE_NAMES.USER
  ],
  [ROLE_NAMES.DEPARTMENT_HEAD]: [
    ROLE_NAMES.PROJECT_MANAGER,
    ROLE_NAMES.TEAM_LEAD,
    ROLE_NAMES.SPECIALIST,
    ROLE_NAMES.JUNIOR_SPECIALIST
  ],
  [ROLE_NAMES.PROJECT_MANAGER]: [
    ROLE_NAMES.SPECIALIST,
    ROLE_NAMES.JUNIOR_SPECIALIST
  ]
} as const

// Иерархический уровень ролей (для сортировки)
export const ROLE_HIERARCHY_LEVEL = {
  [ROLE_NAMES.ADMIN]: 1,
  [ROLE_NAMES.DEPARTMENT_HEAD]: 2,
  [ROLE_NAMES.PROJECT_MANAGER]: 3,
  [ROLE_NAMES.TEAM_LEAD]: 4,
  [ROLE_NAMES.SPECIALIST]: 5,
  [ROLE_NAMES.JUNIOR_SPECIALIST]: 6,
  [ROLE_NAMES.USER]: 7
} as const

// Утилиты для работы с ролями
export const isSystemRole = (roleName: string): boolean => {
  return SYSTEM_ROLES.includes(roleName as any)
}

export const canUserAssignRoles = (userRole: string): string[] => {
  const roles = ROLE_ASSIGNERS[userRole as keyof typeof ROLE_ASSIGNERS]
  return roles ? [...roles] : []
}

export const getRolePermissions = (roleName: string): string[] => {
  const roleKey = roleName as keyof typeof ROLE_TEMPLATES
  return [...(ROLE_TEMPLATES[roleKey]?.permissions || [])]
}

export const getRoleDescription = (roleName: string): string => {
  return ROLE_DESCRIPTIONS[roleName as keyof typeof ROLE_DESCRIPTIONS] || roleName
}

export const getRoleColor = (roleName: string): string => {
  return ROLE_COLORS[roleName as keyof typeof ROLE_COLORS] || '#64748b'
}

export const getRoleHierarchyLevel = (roleName: string): number => {
  return ROLE_HIERARCHY_LEVEL[roleName as keyof typeof ROLE_HIERARCHY_LEVEL] || 999
}

export const sortRolesByImportance = (roles: string[]): string[] => {
  return roles.sort((a, b) => getRoleHierarchyLevel(a) - getRoleHierarchyLevel(b))
}

export const canAssignRole = (assignerRole: string, targetRole: string): boolean => {
  const allowedRoles = canUserAssignRoles(assignerRole)
  return allowedRoles.includes(targetRole)
}

export const validateRoleName = (name: string): { isValid: boolean; errors: string[]; normalizedValue: string } => {
  const errors: string[] = []
  
  if (!name?.trim()) {
    errors.push('Название роли обязательно')
  }
  
  if (name && name.trim().length < 2) {
    errors.push('Название роли должно содержать минимум 2 символа')
  }
  
  if (name && name.trim().length > 50) {
    errors.push('Название роли не может быть длиннее 50 символов')
  }
  
  const normalizedValue = name?.trim().toLowerCase().replace(/\s+/g, '_') || ''
  
  return {
    isValid: errors.length === 0,
    errors,
    normalizedValue
  }
}

export const validateRoleDescription = (description: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = []
  
  if (description && description.trim().length > 200) {
    errors.push('Описание роли не может быть длиннее 200 символов')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

export const checkRoleConflicts = (permissions: string[]): string[] => {
  const conflicts: string[] = []
  
  // Проверка на конфликтующие разрешения
  const hasAdminPanel = permissions.includes(PERMISSIONS.USERS.ADMIN_PANEL as string)
  const hasAssignAdminRole = permissions.includes(PERMISSIONS.USERS.ASSIGN_ADMIN_ROLE as string)
  
  if (hasAssignAdminRole && !hasAdminPanel) {
    conflicts.push('Назначение роли админа требует доступа к админ панели')
  }
  
  return conflicts
}

export const getRecommendedRoles = (userPermissions: string[]): string[] => {
  const recommendations: string[] = []
  
  // Проверяем соответствие permissions пользователя существующим ролям
  for (const [roleName, roleData] of Object.entries(ROLE_TEMPLATES)) {
    const rolePermissions = [...roleData.permissions] as string[]
    const matchingPermissions = userPermissions.filter(p => rolePermissions.includes(p))
    const matchPercentage = matchingPermissions.length / rolePermissions.length
    
    if (matchPercentage > 0.8) { // 80% совпадение
      recommendations.push(roleName)
    }
  }
  
  return sortRolesByImportance(recommendations)
} 