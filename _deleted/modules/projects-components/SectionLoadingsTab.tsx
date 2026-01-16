"use client"

import { useEffect, useMemo, useState } from "react"
import { Calendar, RefreshCw, Users, Layers, ChevronDown, Trash2 } from "lucide-react"
import type { Loading } from "@/modules/planning/types"
import { fetchSectionLoadings } from "@/modules/planning/api/planning"
import { supabase } from "@/lib/supabase-client"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { usePlanningStore } from "@/modules/planning/stores/usePlanningStore"

interface SectionLoadingsTabProps {
  sectionId: string
}

export default function SectionLoadingsTab({ sectionId }: SectionLoadingsTabProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<Loading[]>([])
  const [stageNames, setStageNames] = useState<Record<string, string>>({})
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const deleteLoadingInStore = usePlanningStore((s) => s.deleteLoading)

  const load = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await fetchSectionLoadings(sectionId)
      setItems(Array.isArray(data) ? data : [])
    } catch (e: any) {
      setError(e?.message || "Не удалось загрузить загрузки")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (sectionId) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId])

  // Подтягиваем названия этапов для загрузок (если доступны stageId)
  useEffect(() => {
    const loadStageNames = async () => {
      const uniqueStageIds = Array.from(
        new Set((items || []).map((i) => i.stageId).filter((v): v is string => Boolean(v)))
      )
      if (uniqueStageIds.length === 0) {
        setStageNames({})
        return
      }

      const { data, error } = await supabase
        .from("decomposition_stages")
        .select("decomposition_stage_id, decomposition_stage_name")
        .in("decomposition_stage_id", uniqueStageIds)

      if (error) {
        // Не критично для UI — оставим идентификаторы
        return
      }

      const map: Record<string, string> = {}
      for (const row of data || []) {
        map[row.decomposition_stage_id as string] = row.decomposition_stage_name as string
      }
      setStageNames(map)
    }

    loadStageNames()
  }, [items])

  const formatDate = (d: Date) => new Date(d).toLocaleDateString("ru-RU")

  // Группируем загрузки по этапам
  const grouped = useMemo(() => {
    const groups: Record<string, Loading[]> = {}
    for (const l of items) {
      const key = l.stageId || "__no_stage__"
      ;(groups[key] ||= []).push(l)
    }
    Object.values(groups).forEach((arr) => arr.sort((a, b) => a.startDate.getTime() - b.startDate.getTime()))
    return groups
  }, [items])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-foreground">Загрузки раздела</h3>
        <button
          onClick={load}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border hover:bg-muted"
        >
          <RefreshCw className="h-3 w-3" /> Обновить
        </button>
      </div>

      {isLoading && (
        <div className="text-sm text-muted-foreground">Загрузка...</div>
      )}

      {error && !isLoading && (
        <div className="text-sm text-destructive">{error}</div>
      )}

      {!isLoading && !error && items.length === 0 && (
        <div className="text-sm text-muted-foreground">Нет активных загрузок для этого раздела</div>
      )}

      <div className="space-y-5">
        {Object.entries(grouped).map(([stageId, list]) => {
          const isCollapsed = Boolean(collapsed[stageId])
          const title = stageId === "__no_stage__" ? "Без этапа" : (stageNames[stageId] || "Этап")
          // Подсчёты для саммари по этапу
          const msPerDay = 24 * 60 * 60 * 1000
          const daysBetweenInclusive = (a: Date, b: Date) => {
            const start = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime()
            const end = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime()
            const diff = Math.max(0, Math.floor((end - start) / msPerDay))
            return diff + 1
          }
          const stageCount = list.length
          const stageRate = list.reduce((acc, l) => acc + (l.rate || 0), 0)
          const uniqueEmployees = new Set(list.map((l) => l.responsibleId).filter(Boolean)).size
          const stagePersonDays = list.reduce((acc, l) => acc + (l.rate || 0) * daysBetweenInclusive(l.startDate, l.endDate), 0)
          const minStart = list.reduce((min, l) => (min && min < l.startDate ? min : l.startDate), list[0]?.startDate)
          const maxEnd = list.reduce((max, l) => (max && max > l.endDate ? max : l.endDate), list[0]?.endDate)
          const totalDays = minStart && maxEnd ? daysBetweenInclusive(minStart, maxEnd) : 0
          const avgRatePerDay = totalDays > 0 ? stagePersonDays / totalDays : 0

          return (
            <div key={stageId} className="space-y-2">
              <div className="flex items-center justify-between px-2 py-1.5 rounded-md bg-muted border">
                <div className="flex items-center gap-2 text-foreground text-sm md:text-base font-semibold">
                  <button
                    type="button"
                    aria-label={isCollapsed ? "Развернуть" : "Свернуть"}
                    aria-expanded={!isCollapsed}
                    onClick={() => setCollapsed((prev) => ({ ...prev, [stageId]: !prev[stageId] }))}
                    className="p-1 rounded hover:bg-accent text-muted-foreground"
                  >
                    <ChevronDown className={`h-4 w-4 transform transition-transform ${isCollapsed ? "-rotate-90" : "rotate-0"}`} />
                  </button>
                  <Layers className="h-4 w-4 text-primary" />
                  <span>{title}</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded border bg-card text-[11px] md:text-xs text-muted-foreground">
                    Загрузок в этапе: {stageCount.toLocaleString('ru-RU')}
                  </span>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded border bg-card text-[11px] md:text-xs text-muted-foreground">
                    Ставок в этапе: {stageRate.toLocaleString('ru-RU')}
                  </span>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded border bg-card text-[11px] md:text-xs text-muted-foreground">
                    Сотрудников в этапе: {uniqueEmployees.toLocaleString('ru-RU')}
                  </span>
                  {minStart && maxEnd && (
                    <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded border bg-card text-[11px] md:text-xs text-muted-foreground">
                      Период этапа: {formatDate(minStart)} — {formatDate(maxEnd)}
                    </span>
                  )}
                  <span className="hidden md:inline-flex items-center px-1.5 py-0.5 rounded border bg-card text-[11px] md:text-xs text-muted-foreground">
                    Средняя ставка в день: {Number.isFinite(avgRatePerDay) ? (Number.isInteger(avgRatePerDay) ? avgRatePerDay : avgRatePerDay.toFixed(2)) : 0}
                  </span>
                </div>
              </div>
              {!isCollapsed && list.map((l) => (
                <div key={l.id} className="p-3 rounded border bg-card group">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4 text-primary" />
                      <span className="font-medium">{l.responsibleName || "Не указан"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>
                        {formatDate(l.startDate)} — {formatDate(l.endDate)}
                      </span>
                      <ConfirmDialog
                        title="Удалить загрузку?"
                        description={(
                          <span>
                            Вы уверены, что хотите удалить загрузку по этапу <strong>{title}</strong> сотрудника <strong>{l.responsibleName || "Не указан"}</strong> со ставкой <strong>{l.rate}</strong> за период <strong>{formatDate(l.startDate)} — {formatDate(l.endDate)}</strong>? Это действие нельзя отменить.
                          </span>
                        )}
                        confirmLabel="Удалить"
                        cancelLabel="Отмена"
                        variant="destructive"
                        onConfirm={async () => {
                          try {
                            const result = await deleteLoadingInStore(l.id)
                            if (!result?.success) {
                              console.error("Не удалось удалить загрузку", result?.error)
                              return
                            }
                            setItems((prev) => prev.filter((it) => it.id !== l.id))
                          } catch (err) {
                            console.error("Ошибка удаления загрузки", err)
                          }
                        }}
                      >
                        <button
                          className="ml-1 inline-flex items-center justify-center h-6 w-6 rounded opacity-0 group-hover:opacity-100 transition-all hover:bg-red-100 text-red-600"
                          title="Удалить загрузку"
                          onClick={(e) => { e.stopPropagation() }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </ConfirmDialog>
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">Ставка: {l.rate}</div>
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}


