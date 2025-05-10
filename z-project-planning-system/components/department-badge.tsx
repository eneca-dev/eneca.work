"use client"

import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  type Department,
  getDepartmentBgColor,
  getDepartmentTextColor,
  getDepartmentBorderColor,
} from "@/data/departments"

interface DepartmentBadgeProps {
  department: Department
  size?: "sm" | "md"
}

export function DepartmentBadge({ department, size = "md" }: DepartmentBadgeProps) {
  if (!department) return null

  const bgColor = getDepartmentBgColor(department)
  const textColor = getDepartmentTextColor(department)
  const borderColor = getDepartmentBorderColor(department)

  // Форматируем название отдела, убирая скобки в начале
  const formattedName = department.replace(/^$$[^)]+$$\s*/, "")

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={`
              ${size === "sm" ? "text-[10px] px-1.5 py-0" : "text-xs px-2 py-0.5"} 
              font-medium dark:font-semibold max-w-[150px] truncate overflow-hidden
              pr-3
            `}
            style={{
              backgroundColor: bgColor,
              color: textColor,
              borderColor: borderColor,
            }}
          >
            {formattedName}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="right" className="bg-white dark:bg-slate-800 p-2 shadow-lg border-0">
          <p className="text-sm dark:text-slate-200">Отдел: {department}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

