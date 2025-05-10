"use client"

import { useState } from "react"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Check, Building2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Department } from "@/types/project-types"
import { availableDepartments, getDepartmentBgColor, getDepartmentTextColor } from "@/data/departments"
import { DepartmentBadge } from "./department-badge"

interface DepartmentSelectorProps {
  value?: Department
  onChange: (department: Department) => void
  isCollapsed?: boolean
}

export function DepartmentSelector({ value, onChange, isCollapsed = false }: DepartmentSelectorProps) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "p-0 h-auto",
            isCollapsed ? "w-8 h-8 flex items-center justify-center" : "w-full justify-start",
            !value && "text-slate-500",
          )}
        >
          {value ? (
            <div className={cn("flex items-center", isCollapsed ? "justify-center" : "gap-2")}>
              {isCollapsed ? (
                <div
                  className="h-7 w-7 rounded-full flex items-center justify-center"
                  style={{
                    backgroundColor: getDepartmentBgColor(value),
                    border: `1px solid ${getDepartmentTextColor(value)}`,
                  }}
                >
                  <span className="text-xs font-medium" style={{ color: getDepartmentTextColor(value) }}>
                    {value === "Без отдела" ? "БО" : value.substring(0, 2)}
                  </span>
                </div>
              ) : (
                <>
                  <DepartmentBadge department={value} />
                </>
              )}
            </div>
          ) : (
            <div className={cn("flex items-center", isCollapsed ? "justify-center" : "gap-2 w-full")}>
              {isCollapsed ? (
                <div className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center">
                  <Building2 size={14} className="text-slate-400" />
                </div>
              ) : (
                <>
                  <Building2 size={14} className="text-slate-400" />
                  <span className="text-xs">Выбрать</span>
                </>
              )}
            </div>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[200px]">
        <Command>
          <CommandInput placeholder="Поиск отдела..." />
          <CommandEmpty>Отдел не найден.</CommandEmpty>
          <CommandList>
            <CommandGroup heading="Отделы">
              {availableDepartments.map((department) => (
                <CommandItem
                  key={department}
                  value={department}
                  onSelect={() => {
                    onChange(department)
                    setOpen(false)
                  }}
                >
                  <div className="flex items-center gap-2">
                    <DepartmentBadge department={department} />
                  </div>
                  <Check className={cn("ml-auto h-4 w-4", value === department ? "opacity-100" : "opacity-0")} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

