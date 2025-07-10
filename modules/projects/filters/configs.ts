import { FilterConfigs } from './types'

// Конфигурация для планирования
export const planningConfig: FilterConfigs = {
  manager: {
    id: 'manager',
    label: 'Руководитель проекта',
    fetchFunction: 'loadManagers'
  },
  project: {
    id: 'project',
    label: 'Проект',
    dependencies: ['manager'],
    fetchFunction: 'loadProjects'
  },
  stage: {
    id: 'stage',
    label: 'Этап',
    dependencies: ['project'],
    fetchFunction: 'loadStages'
  },
  object: {
    id: 'object',
    label: 'Объект',
    dependencies: ['stage'],
    fetchFunction: 'loadObjects'
  },
  department: {
    id: 'department',
    label: 'Отдел',
    fetchFunction: 'loadDepartments'
  },
  team: {
    id: 'team',
    label: 'Команда',
    dependencies: ['department'],
    fetchFunction: 'loadTeams'
  },
  employee: {
    id: 'employee',
    label: 'Сотрудник',
    dependencies: ['team'],
    fetchFunction: 'loadEmployees'
  }
}

// Конфигурация для проектов (точная копия планирования)
export const projectsConfig: FilterConfigs = {
  manager: {
    id: 'manager',
    label: 'Руководитель проекта',
    fetchFunction: 'loadManagers'
  },
  project: {
    id: 'project',
    label: 'Проект',
    dependencies: ['manager'],
    fetchFunction: 'loadProjects'
  },
  stage: {
    id: 'stage',
    label: 'Стадия',
    dependencies: ['project'],
    fetchFunction: 'loadStages'
  },
  object: {
    id: 'object',
    label: 'Объект',
    dependencies: ['stage'],
    fetchFunction: 'loadObjects'
  },
  department: {
    id: 'department',
    label: 'Отдел',
    fetchFunction: 'loadDepartments'
  },
  team: {
    id: 'team',
    label: 'Команда',
    dependencies: ['department'],
    fetchFunction: 'loadTeams'
  },
  employee: {
    id: 'employee',
    label: 'Сотрудник',
    dependencies: ['team'],
    fetchFunction: 'loadEmployees'
  }
}

// Конфигурация для таймлайна
export const timelineConfig: FilterConfigs = {
  manager: {
    id: 'manager',
    label: 'Руководитель проекта',
    fetchFunction: 'loadManagers'
  },
  project: {
    id: 'project',
    label: 'Проект',
    dependencies: ['manager'],
    fetchFunction: 'loadProjects'
  },
  stage: {
    id: 'stage',
    label: 'Этап',
    dependencies: ['project'],
    fetchFunction: 'loadStages'
  },
  department: {
    id: 'department',
    label: 'Отдел',
    fetchFunction: 'loadDepartments'
  },
  team: {
    id: 'team',
    label: 'Команда',
    dependencies: ['department'],
    fetchFunction: 'loadTeams'
  },
  employee: {
    id: 'employee',
    label: 'Сотрудник',
    dependencies: ['team'],
    fetchFunction: 'loadEmployees'
  }
}

// Конфигурация для рабочей нагрузки
export const workloadConfig: FilterConfigs = {
  department: {
    id: 'department',
    label: 'Отдел',
    fetchFunction: 'loadDepartments'
  },
  team: {
    id: 'team',
    label: 'Команда',
    dependencies: ['department'],
    fetchFunction: 'loadTeams'
  },
  employee: {
    id: 'employee',
    label: 'Сотрудник',
    dependencies: ['team'],
    fetchFunction: 'loadEmployees'
  },
  project: {
    id: 'project',
    label: 'Проект',
    fetchFunction: 'loadProjects'
  }
}

// Конфигурация для пользователей
export const userConfig: FilterConfigs = {
  department: {
    id: 'department',
    label: 'Отдел',
    fetchFunction: 'loadDepartments'
  },
  team: {
    id: 'team',
    label: 'Команда',
    dependencies: ['department'],
    fetchFunction: 'loadTeams'
  }
} 