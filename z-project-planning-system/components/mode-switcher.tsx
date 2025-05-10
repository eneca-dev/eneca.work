"use client"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Users, Building2 } from "lucide-react"
import { cn } from "@/lib/utils"

export type ViewMode = "manager" | "department"

interface ModeSwitcherProps {
  mode: ViewMode
  onChange: (mode: ViewMode) => void
}

export function ModeSwitcher({ mode, onChange }: ModeSwitcherProps) {
  return (
    <div className="flex items-center bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden h-7">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => onChange("manager")}
              className={cn(
                "p-1 flex items-center justify-center",
                mode === "manager"
                  ? "bg-slate-100 dark:bg-slate-700 text-primary"
                  : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/70",
              )}
            >
              <Users size={14} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Режим менеджера
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => onChange("department")}
              className={cn(
                "p-1 flex items-center justify-center",
                mode === "department"
                  ? "bg-slate-100 dark:bg-slate-700 text-primary"
                  : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/70",
              )}
            >
              <Building2 size={14} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Режим отдела
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}

