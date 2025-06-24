import { FilterConfigs } from './types'

// Конфигурация для модуля передачи заданий
export const taskTransferConfig: FilterConfigs = {
  project: {
    id: 'project',
    label: 'Проект',
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
  specialist: {
    id: 'specialist',
    label: 'Сотрудник',
    dependencies: ['team'],
    fetchFunction: 'loadSpecialists'
  }
} 