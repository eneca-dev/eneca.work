/**
 * Employment Board - Types
 *
 * Доска занятости отдела: активные проекты + сотрудники отдела.
 */

/** Сотрудник отдела */
export interface BoardEmployee {
  id: string
  name: string
  avatarUrl: string | null
  positionName: string | null
  teamName: string | null
}

/** Как сотрудник попал на карточку проекта */
export type PlacementSource = 'loading' | 'manual'

/** Сотрудник, размещённый на карточке проекта */
export interface BoardProjectEmployee extends BoardEmployee {
  source: PlacementSource
  /** Суммарная ставка активных загрузок на этот проект (только для source='loading') */
  rate: number | null
  /** Локальное подтверждение ручного изменения ещё ожидается от сервера. */
  isPending?: boolean
}

/** Карточка проекта на доске */
export interface BoardProject {
  id: string
  name: string
  /** Проект попал на доску вручную (нет активных загрузок отдела) */
  isPinned: boolean
  employees: BoardProjectEmployee[]
  /** Локальное подтверждение закрепления ещё ожидается от сервера. */
  isPending?: boolean
}

/** Данные доски занятости отдела */
export interface EmploymentBoard {
  departmentId: string
  departmentName: string
  projects: BoardProject[]
  /** Все сотрудники отдела (для правой панели) */
  employees: BoardEmployee[]
  /** ID сотрудников без единого размещения — «свободные» */
  unassignedEmployeeIds: string[]
}

export interface PinProjectInput {
  departmentId: string
  projectId: string
  /** Название известно в поисковой выдаче и нужно для мгновенного показа карточки. */
  projectName?: string
}

export interface PlacementInput {
  departmentId: string
  projectId: string
  employeeId: string
}
