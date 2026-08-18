/**
 * Flatten дерева «Разделы» в плоский список строк для виртуализации.
 *
 * Порядок 1:1 с прежним рекурсивным рендером (SectionsPageInternal + Department/Project/ObjectSection/Employee):
 * отдел → [раскрыт] проекты → [раскрыт] объект-разделы → [раскрыт] сотрудники
 * (сотрудники сгруппированы по employeeId из загрузок раздела, как в ObjectSectionRow).
 *
 * Возвращает дескрипторы (без JSX) — VirtualList рендерит их через renderItem.
 */

import type { Department, Project, ObjectSection, SectionLoading } from '../types'
import { hasActivityInPeriod, hasEmployeeLoadingInPeriod, type DateRange } from '../utils/period-activity'

/** Сгруппированный по сотруднику набор загрузок раздела (как employeesWithLoadings в ObjectSectionRow). */
export interface SectEmployee {
  employeeId: string
  employeeName: string
  employeeAvatarUrl: string | null
  employeeTeamId: string | null
  employeeDepartmentId: string | null
  employeeDepartmentName: string | null
  employeePosition: string | null
  employeeCategory: string | null
  employeeEmploymentRate: number | null
  loadings: SectionLoading[]
}

export type SectFlatRow =
  | { kind: 'dept'; key: string; dept: Department }
  | { kind: 'project'; key: string; project: Project }
  | { kind: 'objectSection'; key: string; objectSection: ObjectSection; projectId: string }
  | {
      kind: 'employee'
      key: string
      employee: SectEmployee
      sectionId: string
      sectionName: string
      projectId: string
      projectName: string
      objectId: string
      objectName: string
    }
  /**
   * Свёрнутая по умолчанию группа проектов отдела, исключённых из основного списка.
   * Без периода в календаре — «Завершённые» (Project.isStale, 3+ мес. без активности).
   * С заданным периодом — «Нет загрузок за период» (см. hasActivityInPeriod).
   */
  | { kind: 'staleGroup'; key: string; departmentId: string; count: number; label: string; title: string }

/** Группировка загрузок раздела по сотруднику (порядок первого появления). */
export function groupEmployees(os: ObjectSection): SectEmployee[] {
  const map = new Map<string, SectEmployee>()
  for (const loading of os.loadings) {
    const empId = loading.employeeId
    if (!map.has(empId)) {
      map.set(empId, {
        employeeId: empId,
        employeeName: loading.employeeName,
        employeeAvatarUrl: loading.employeeAvatarUrl ?? null,
        employeeTeamId: loading.employeeTeamId ?? null,
        employeeDepartmentId: loading.employeeDepartmentId,
        employeeDepartmentName: loading.employeeDepartmentName,
        employeePosition: loading.employeePosition ?? null,
        employeeCategory: loading.employeeCategory ?? null,
        employeeEmploymentRate: loading.employeeEmploymentRate ?? null,
        loadings: [],
      })
    }
    map.get(empId)!.loadings.push(loading)
  }
  return Array.from(map.values())
}

/** Ключ узла раскрытия группы «старых» проектов отдела — для useSectionsPageUIStore */
export function staleGroupNodeId(departmentId: string): string {
  return `staleGroup-${departmentId}`
}

// deptId в ключах ниже: один и тот же проект/раздел может легитимно попасть в ДВА
// отдела разом (отдел ответственного + отдел сотрудника — см. "полное дублирование"
// в getSectionsHierarchy), поэтому project.id/os.id сами по себе не уникальны
// в плоском списке всех отделов — без deptId React получал два ряда с одним key.
function pushProjectRows(
  out: SectFlatRow[],
  deptId: string,
  project: Project,
  expanded: Set<string>,
  activePeriod?: DateRange | null
): void {
  out.push({ kind: 'project', key: `proj:${deptId}:${project.id}`, project })
  if (!expanded.has(`project-${project.id}`)) return

  for (const os of project.objectSections) {
    out.push({ kind: 'objectSection', key: `os:${deptId}:${os.id}`, objectSection: os, projectId: project.id })
    if (!expanded.has(`objectSection-${os.id}`)) continue

    const employees = groupEmployees(os).filter(
      (emp) => !activePeriod || hasEmployeeLoadingInPeriod(emp.loadings, activePeriod)
    )
    for (const emp of employees) {
      out.push({
        kind: 'employee',
        key: `emp:${deptId}:${os.id}:${emp.employeeId}`,
        employee: emp,
        sectionId: os.sectionId,
        sectionName: os.sectionName,
        projectId: project.id,
        projectName: project.name,
        objectId: os.objectId,
        objectName: os.objectName,
      })
    }
  }
}

export function flattenSections(
  departments: Department[],
  expanded: Set<string>,
  activePeriod?: DateRange | null
): SectFlatRow[] {
  const out: SectFlatRow[] = []

  // Критерий сворачивания в группу и её подпись зависят от того, задан ли в
  // календаре конкретный период: без периода — isStale (от сегодня), с периодом —
  // отсутствие загрузок/ёмкости именно в нём (см. hasActivityInPeriod). Сортировка
  // при этом не меняется — только состав "основного" списка против свёрнутого.
  const isExcluded = activePeriod
    ? (p: Project) => !hasActivityInPeriod(p, activePeriod)
    : (p: Project) => p.isStale
  const groupLabel = activePeriod ? 'Нет загрузок за период' : 'Завершённые'
  const groupTitle = activePeriod
    ? 'Проекты без загрузок и введённой ёмкости за выбранный в календаре период'
    : 'Проекты без активности 3+ месяца и без запланированных загрузок'

  for (const dept of departments) {
    out.push({ kind: 'dept', key: `dept:${dept.id}`, dept })
    if (!expanded.has(`department-${dept.id}`)) continue

    // Относительный порядок внутри каждой группы сохраняется как пришёл с сервера
    // (там уже отсортировано по актуальности загрузок — см. compareProjectsByActuality).
    const activeProjects = dept.projects.filter((p) => !isExcluded(p))
    const excludedProjects = dept.projects.filter((p) => isExcluded(p))

    for (const project of activeProjects) {
      pushProjectRows(out, dept.id, project, expanded, activePeriod)
    }

    if (excludedProjects.length > 0) {
      const groupNodeId = staleGroupNodeId(dept.id)
      // key (двоеточие) — React-ключ ряда, следует конвенции соседних kind
      // ('dept:', 'proj:', 'os:', 'emp:' — см. выше и pushProjectRows).
      // groupNodeId (дефис, из staleGroupNodeId) — id узла в useSectionsPageUIStore,
      // следует конвенции expand/collapse-ключей ('department-', 'project-' и т.д.).
      // Разные разделители — по замыслу, это два независимых пространства имён.
      out.push({
        kind: 'staleGroup',
        key: `staleGroup:${dept.id}`,
        departmentId: dept.id,
        count: excludedProjects.length,
        label: groupLabel,
        title: groupTitle,
      })
      if (expanded.has(groupNodeId)) {
        for (const project of excludedProjects) {
          pushProjectRows(out, dept.id, project, expanded, activePeriod)
        }
      }
    }
  }

  return out
}
