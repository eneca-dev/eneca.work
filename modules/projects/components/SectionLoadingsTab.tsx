"use client"

import { useEffect, useState } from "react"
import { Calendar, RefreshCw, Users } from "lucide-react"
import type { Loading } from "@/modules/planning/types"
import { fetchSectionLoadings } from "@/modules/planning/api/planning"

interface SectionLoadingsTabProps {
  sectionId: string
}

export default function SectionLoadingsTab({ sectionId }: SectionLoadingsTabProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<Loading[]>([])

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

  const formatDate = (d: Date) => new Date(d).toLocaleDateString("ru-RU")

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Загрузки раздела</h3>
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

      <div className="space-y-2">
        {items.map((l) => (
          <div key={l.id} className="p-3 rounded border bg-card">
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
              </div>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">Ставка: {l.rate}</div>
          </div>
        ))}
      </div>
    </div>
  )
}


