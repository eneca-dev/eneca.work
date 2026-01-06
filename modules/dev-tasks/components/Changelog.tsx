'use client'

import { memo, useState, useEffect } from 'react'
import { History, ChevronDown, ChevronRight, Package } from 'lucide-react'
import { getChangelog, type ChangelogEntry } from '../actions'

interface ChangelogProps {
  className?: string
}

export const Changelog = memo(function Changelog({ className }: ChangelogProps) {
  const [entries, setEntries] = useState<ChangelogEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function load() {
      const result = await getChangelog()
      if (result.success) {
        setEntries(result.entries)
        // Expand first module by default
        if (result.entries.length > 0) {
          setExpandedModules(new Set([result.entries[0].moduleName]))
        }
      }
      setIsLoading(false)
    }
    load()
  }, [])

  const toggleModule = (moduleName: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev)
      if (next.has(moduleName)) {
        next.delete(moduleName)
      } else {
        next.add(moduleName)
      }
      return next
    })
  }

  // Group entries by module
  const entriesByModule = entries.reduce(
    (acc, entry) => {
      if (!acc[entry.moduleName]) {
        acc[entry.moduleName] = {
          displayName: entry.moduleDisplayName,
          entries: [],
        }
      }
      acc[entry.moduleName].entries.push(entry)
      return acc
    },
    {} as Record<string, { displayName: string; entries: ChangelogEntry[] }>
  )

  if (isLoading) {
    return (
      <div className={className}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <History className="h-4 w-4 animate-pulse" />
          <span>Загрузка changelog...</span>
        </div>
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className={className}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <History className="h-4 w-4" />
          <span>Нет записей в changelog</span>
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      <div className="flex items-center gap-2 mb-3">
        <History className="h-4 w-4" />
        <span className="text-sm font-medium">Changelog</span>
        <span className="text-xs text-muted-foreground">({entries.length} записей)</span>
      </div>

      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        {Object.entries(entriesByModule).map(([moduleName, { displayName, entries: moduleEntries }]) => {
          const isExpanded = expandedModules.has(moduleName)

          return (
            <div key={moduleName} className="rounded-lg border bg-muted/30">
              <button
                onClick={() => toggleModule(moduleName)}
                className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-muted/50 transition-colors rounded-lg"
              >
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <Package className="h-3.5 w-3.5 text-primary" />
                <span className="text-sm font-medium">{displayName}</span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {moduleEntries.length} версий
                </span>
              </button>

              {isExpanded && (
                <div className="px-3 pb-3 space-y-3">
                  {moduleEntries.map((entry, idx) => (
                    <div key={`${entry.version}-${idx}`} className="pl-6 border-l-2 border-primary/20">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                          v{entry.version}
                        </span>
                        <span className="text-xs text-muted-foreground">{entry.date}</span>
                      </div>
                      <ul className="space-y-0.5">
                        {entry.changes.map((change, changeIdx) => (
                          <li key={changeIdx} className="text-xs text-muted-foreground flex gap-1.5">
                            <span className="text-primary">•</span>
                            <span>{change}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
})
