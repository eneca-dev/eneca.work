"use client"

export interface DepartmentInfo {
  department_id: string
  ws_department_id: number
  department_name: string
}

export const mockDepartments: DepartmentInfo[] = [
  {
    department_id: "gup",
    ws_department_id: 1,
    department_name: "Группа управления проектами",
  },
  {
    department_id: "ar",
    ws_department_id: 2,
    department_name: "Архитектурный отдел",
  },
  {
    department_id: "vk",
    ws_department_id: 3,
    department_name: "Отдел водоснабжения и канализации",
  },
  {
    department_id: "es",
    ws_department_id: 4,
    department_name: "Отдел электроснабжения (Гражд. объекты)",
  },
]

