import type { Department as DepartmentType } from "@/types/project-types"

// Обновим список доступных отделов, убрав скобки из названий
export const availableDepartments: DepartmentType[] = [
  "Группа управления проектами",
  "Архитектурный отдел",
  "Отдел водоснабжения и канализации",
  "Отдел электроснабжения (Гражд. объекты)",
  "Без отдела",
  "",
]

// Обновим цвета для отделов
export const departmentColors: Record<
  DepartmentType,
  { bg: string; text: string; border: string; darkBg?: string; darkText?: string; darkBorder?: string }
> = {
  "Группа управления проектами": {
    bg: "#E6F7FF",
    text: "#0072B5",
    border: "#91D5FF",
    darkBg: "#0C4A6E",
    darkText: "#7DD3FC",
    darkBorder: "#0284C7",
  },
  "Архитектурный отдел": {
    bg: "#F6FFED",
    text: "#52C41A",
    border: "#B7EB8F",
    darkBg: "#1A4731",
    darkText: "#86EFAC",
    darkBorder: "#22C55E",
  },
  "Отдел водоснабжения и канализации": {
    bg: "#E6FFFB",
    text: "#13C2C2",
    border: "#87E8DE",
    darkBg: "#134E4A",
    darkText: "#5EEAD4",
    darkBorder: "#14B8A6",
  },
  "Отдел электроснабжения (Гражд. объекты)": {
    bg: "#FFF7E6",
    text: "#FA8C16",
    border: "#FFD591",
    darkBg: "#451A03",
    darkText: "#FDBA74",
    darkBorder: "#F97316",
  },
  "Без отдела": {
    bg: "#F0F0F0",
    text: "#595959",
    border: "#D9D9D9",
    darkBg: "#262626",
    darkText: "#A3A3A3",
    darkBorder: "#525252",
  },
  "": {
    bg: "#F5F5F5",
    text: "#8C8C8C",
    border: "#D9D9D9",
    darkBg: "#262626",
    darkText: "#A3A3A3",
    darkBorder: "#525252",
  },
}

// Получение цвета фона для отдела
export function getDepartmentBgColor(department: DepartmentType): string {
  const isDarkMode = typeof document !== "undefined" && document.documentElement.classList.contains("dark")
  return isDarkMode && departmentColors[department]?.darkBg
    ? departmentColors[department].darkBg!
    : departmentColors[department]?.bg || "#F5F5F5"
}

// Получение цвета текста для отдела
export function getDepartmentTextColor(department: DepartmentType): string {
  const isDarkMode = typeof document !== "undefined" && document.documentElement.classList.contains("dark")
  return isDarkMode && departmentColors[department]?.darkText
    ? departmentColors[department].darkText!
    : departmentColors[department]?.text || "#8C8C8C"
}

// Получение цвета границы для отдела
export function getDepartmentBorderColor(department: DepartmentType): string {
  const isDarkMode = typeof document !== "undefined" && document.documentElement.classList.contains("dark")
  return isDarkMode && departmentColors[department]?.darkBorder
    ? departmentColors[department].darkBorder!
    : departmentColors[department]?.border || "#D9D9D9"
}

export type Department = DepartmentType

