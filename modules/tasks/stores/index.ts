/**
 * Tasks Module - Stores
 *
 * Экспорт stores и конфигурации для страницы Задачи
 */

import { Building2, Users, FolderKanban, Tag, UsersRound, UserCircle } from 'lucide-react'
import type { FilterConfig } from '@/modules/inline-filter'

// ============================================================================
// Re-export Tabs Store
// ============================================================================

export {
  useTasksTabsStore,
  VIEW_MODE_ICONS,
  getTabIcon,
  MAX_USER_TABS,
  type TaskTab,
  type TasksViewMode,
  type TabIconName,
  type CreateTabInput,
  type UpdateTabInput,
} from './tabs-store'

// ============================================================================
// Unified Filter Config (используется в InlineFilter и компонентах)
// ============================================================================

export const TASKS_FILTER_CONFIG: FilterConfig = {
  keys: {
    'подразделение': {
      field: 'subdivision_id',
      label: 'Подразделение',
      icon: Building2,
      color: 'violet',
    },
    'отдел': {
      field: 'department_id',
      label: 'Отдел',
      icon: Users,
      color: 'blue',
    },
    'команда': {
      field: 'team_id',
      label: 'Команда',
      icon: UsersRound,
      color: 'cyan',
    },
    'ответственный': {
      field: 'responsible_id',
      label: 'Ответственный',
      icon: UserCircle,
      color: 'rose',
    },
    'проект': {
      field: 'project_id',
      label: 'Проект',
      icon: FolderKanban,
      color: 'amber',
    },
    'метка': {
      field: 'tag_id',
      label: 'Метка проекта',
      multiple: true,
      icon: Tag,
      color: 'emerald',
    },
  },
  placeholder: 'Фильтр: подразделение:"ОВ" проект:"Название"',
}
