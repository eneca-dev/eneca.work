/**
 * Flatten дерева Отделов в плоский список строк для виртуализации.
 *
 * Порядок 1:1 с прежним рекурсивным рендером (DepartmentsTimeline IIFE + DepartmentRow/TeamRow):
 * группа-разделитель → отделы; раскрытый отдел → [ВК: подгруппы гражд/пром] команды;
 * раскрытая команда → сотрудники (лид первым).
 *
 * Возвращает дескрипторы (без JSX) — VirtualList рендерит их через renderItem.
 */

import type { Department, Employee, Team, TreeNodeType } from '../../types'

export type DeptFlatRow =
  | { kind: 'groupDivider'; key: string; label: string }
  | { kind: 'subgroupDivider'; key: string; label: string }
  | { kind: 'dept'; key: string; dept: Department; index: number }
  | { kind: 'team'; key: string; team: Team }
  | { kind: 'employee'; key: string; employee: Employee; isTeamLead: boolean }

export interface DeptGroup {
  key: string
  label: string
  items: Department[]
}

/** ВК: команды 1/3/4 — гражданское направление, остальные — промышленное. */
const CIVIL_VK_TEAMS = new Set(['ВК - 1', 'ВК - 3', 'ВК - 4'])

/** Сотрудники команды: тимлид первым, остальные в исходном порядке. */
function sortTeamEmployees(team: Team): Employee[] {
  const employees = [...team.employees]
  const leadIndex = team.teamLeadId
    ? employees.findIndex((e) => e.id === team.teamLeadId)
    : -1
  if (leadIndex > 0) {
    const [lead] = employees.splice(leadIndex, 1)
    employees.unshift(lead)
  }
  return employees
}

export function flattenDepartments(
  groups: DeptGroup[],
  expandedNodes: Record<TreeNodeType, Set<string>>,
): DeptFlatRow[] {
  const out: DeptFlatRow[] = []
  let deptIndex = 0

  const pushTeam = (team: Team) => {
    out.push({ kind: 'team', key: `team:${team.id}`, team })
    if (!expandedNodes.team.has(team.id)) return
    for (const emp of sortTeamEmployees(team)) {
      out.push({
        kind: 'employee',
        key: `emp:${team.id}:${emp.id}`,
        employee: emp,
        isTeamLead: emp.id === team.teamLeadId,
      })
    }
  }

  for (const group of groups) {
    if (group.items.length === 0) continue
    out.push({ kind: 'groupDivider', key: `gd:${group.key}`, label: group.label })

    for (const dept of group.items) {
      out.push({ kind: 'dept', key: `dept:${dept.id}`, dept, index: deptIndex++ })
      if (!expandedNodes.department.has(dept.id)) continue

      // ВК: вперёд гражд-команды с мягким разделителем перед пром-группой.
      if (dept.name === 'ВК') {
        const civil = dept.teams.filter((t) => CIVIL_VK_TEAMS.has(t.name))
        const prom = dept.teams.filter((t) => !CIVIL_VK_TEAMS.has(t.name))
        if (civil.length > 0 && prom.length > 0) {
          out.push({ kind: 'subgroupDivider', key: `sd:${dept.id}:civil`, label: 'Гражданское' })
          civil.forEach(pushTeam)
          out.push({ kind: 'subgroupDivider', key: `sd:${dept.id}:prom`, label: 'Промышленное' })
          prom.forEach(pushTeam)
          continue
        }
      }

      dept.teams.forEach(pushTeam)
    }
  }

  return out
}
