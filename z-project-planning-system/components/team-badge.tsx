"use client"

import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Users } from "lucide-react"

interface TeamBadgeProps {
  teamName: string
  size?: "sm" | "md"
}

export function TeamBadge({ teamName, size = "md" }: TeamBadgeProps) {
  if (!teamName) return null

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={`
              ${size === "sm" ? "text-[10px] px-1.5 py-0" : "text-xs px-2 py-0.5"} 
              font-medium bg-slate-100 text-slate-700 border-slate-200 
              dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600
              flex items-center gap-1
            `}
          >
            <Users size={size === "sm" ? 10 : 12} className="text-slate-500 dark:text-slate-300" />
            <span>{teamName}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="right" className="bg-white dark:bg-slate-800 p-2 shadow-lg border-0">
          <p className="text-sm dark:text-slate-200">Команда: {teamName}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

