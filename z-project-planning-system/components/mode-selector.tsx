"use client"

import { CommandItem } from "@/components/ui/command"

import { useState, useEffect } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Check, ChevronDown } from "lucide-react"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandList } from "@/components/ui/command"
import { cn } from "@/lib/utils"
import { mockDepartments, mockProfiles, getFullName } from "@/data/mock-profiles"
import type { ViewMode } from "./mode-switcher"

interface ModeSelectorProps {
  mode: ViewMode
  selectedId: string | null
  onSelect: (id: string) => void
}

export function ModeSelector({ mode, selectedId, onSelect }: ModeSelectorProps) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Array<{ id: string; name: string }>>([])
  const [searchTerm, setSearchTerm] = useState("")

  // Update items based on mode
  useEffect(() => {
    if (mode === "department") {
      // For department mode, show departments
      setItems(
        mockDepartments.map((dept) => ({
          id: dept.department_id,
          name: dept.department_name,
        })),
      )
    } else {
      // For manager mode, show managers (unique users with GIP or RP positions)
      const managers = mockProfiles
        .filter((profile) => profile.position_id === "gip" || profile.position_id === "rp")
        .map((profile) => ({
          id: profile.user_id,
          name: getFullName(profile),
        }))
      setItems(managers)
    }
  }, [mode])

  // Get the name of the selected item with a more descriptive placeholder
  const selectedName = selectedId
    ? items.find((item) => item.id === selectedId)?.name || ""
    : mode === "department"
      ? "Все отделы"
      : "Все менеджеры"

  // Filter items by search term
  const filteredItems = searchTerm
    ? items.filter((item) => item.name.toLowerCase().includes(searchTerm.toLowerCase()))
    : items

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-7 px-1 py-0 text-xs border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 min-w-0 max-w-[90px]"
        >
          <span className="truncate max-w-[60px] inline-block">{selectedName}</span>
          <ChevronDown className="ml-0.5 h-3 w-3 shrink-0 opacity-50 flex-shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0 dark:bg-slate-800">
        <Command className="dark:bg-slate-800">
          <CommandInput
            placeholder={mode === "department" ? "Поиск отдела..." : "Поиск менеджера..."}
            onValueChange={setSearchTerm}
            className="h-8 dark:bg-slate-800 dark:text-slate-200"
          />
          <CommandEmpty className="text-xs py-2 text-center text-slate-500 dark:text-slate-400">
            {mode === "department" ? "Отдел не найден" : "Менеджер не найден"}
          </CommandEmpty>
          <CommandList className="max-h-[200px]">
            <CommandGroup>
              {filteredItems.map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.name}
                  onSelect={() => {
                    onSelect(item.id)
                    setOpen(false)
                  }}
                  className="text-xs dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  {item.name}
                  <Check className={cn("ml-auto h-3 w-3", selectedId === item.id ? "opacity-100" : "opacity-0")} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

