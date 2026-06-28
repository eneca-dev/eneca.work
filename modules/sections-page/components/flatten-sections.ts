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

export function flattenSections(departments: Department[], expanded: Set<string>): SectFlatRow[] {
  const out: SectFlatRow[] = []

  for (const dept of departments) {
    out.push({ kind: 'dept', key: `dept:${dept.id}`, dept })
    if (!expanded.has(`department-${dept.id}`)) continue

    for (const project of dept.projects) {
      out.push({ kind: 'project', key: `proj:${project.id}`, project })
      if (!expanded.has(`project-${project.id}`)) continue

      for (const os of project.objectSections) {
        out.push({ kind: 'objectSection', key: `os:${os.id}`, objectSection: os, projectId: project.id })
        if (!expanded.has(`objectSection-${os.id}`)) continue

        for (const emp of groupEmployees(os)) {
          out.push({
            kind: 'employee',
            key: `emp:${os.id}:${emp.employeeId}`,
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
  }

  return out
}
