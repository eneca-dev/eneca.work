import { UserCircle, Users } from 'lucide-react'
import type { FilterConfig } from '@/modules/inline-filter'

/**
 * Доска всегда показывает ровно один отдел. Фильтры команды, проекта и метки
 * здесь не имеют эквивалента, поэтому намеренно не предлагаются.
 */
export const EMPLOYMENT_BOARD_FILTER_CONFIG: FilterConfig = {
  keys: {
    'отдел': {
      field: 'department_id',
      label: 'Отдел',
      icon: Users,
      color: 'blue',
    },
    'сотрудник': {
      field: 'employee_id',
      label: 'Сотрудник',
      icon: UserCircle,
      color: 'rose',
    },
  },
  placeholder: 'Фильтр: отдел:"Отдел развития" сотрудник:"Имя"',
}
