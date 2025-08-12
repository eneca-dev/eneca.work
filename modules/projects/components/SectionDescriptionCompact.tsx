"use client"

import React, { useEffect, useState } from "react"
import { createClient } from "@/utils/supabase/client"
import { Calendar, User } from "lucide-react"
import { Avatar } from "./Avatar"

interface Props {
  sectionId: string
}

interface SectionRow {
  section_name: string
  section_description: string | null
  section_responsible: string | null
  section_start_date: string | null
  section_end_date: string | null
  section_statuses?: { id: string; name: string; color: string | null } | null
}

const supabase = createClient()

export default function SectionDescriptionCompact({ sectionId }: Props) {
  const [loading, setLoading] = useState(true)
  const [row, setRow] = useState<SectionRow | null>(null)
  const [responsibleName, setResponsibleName] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from("sections")
          .select(`section_name, section_description, section_responsible, section_start_date, section_end_date, section_statuses:section_status_id (id, name, color)`) 
          .eq("section_id", sectionId)
          .single()
        if (!error && data) {
          setRow(data as any)
          if (data.section_responsible) {
            const prof = await supabase
              .from("profiles")
              .select("first_name, last_name, email")
              .eq("user_id", data.section_responsible)
              .single()
            if (prof.data) {
              setResponsibleName(`${prof.data.first_name} ${prof.data.last_name}`.trim() || prof.data.email)
            }
          }
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [sectionId])

  const formatDate = (d?: string | null) => {
    if (!d) return "—"
    try { return new Date(d).toLocaleDateString("ru-RU") } catch { return "—" }
  }

  if (loading) return <div className="text-xs text-slate-500">Загрузка...</div>
  if (!row) return <div className="text-xs text-slate-500">Данные недоступны</div>

  return (
    <div className="space-y-3">
      {/* Статус и сроки */}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        {row.section_statuses?.name && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border dark:border-slate-600" title="Статус">
            <span className="w-2 h-2 rounded-full" style={{backgroundColor: row.section_statuses?.color || '#64748b'}}/>
            <span className="dark:text-slate-200">{row.section_statuses?.name}</span>
          </span>
        )}
        <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300">
          <Calendar className="w-3 h-3" />
          {formatDate(row.section_start_date)} — {formatDate(row.section_end_date)}
        </span>
      </div>

      {/* Ответственный */}
      {row.section_responsible && (
        <div className="flex items-center gap-2 text-xs">
          <User className="w-3 h-3 text-emerald-600" />
          <Avatar name={responsibleName || ""} size="sm" />
          <span className="dark:text-slate-200">{responsibleName}</span>
        </div>
      )}

      {/* Описание */}
      {row.section_description ? (
        <div className="text-xs leading-relaxed dark:text-slate-200 whitespace-pre-wrap" style={{display:'-webkit-box', WebkitLineClamp:6, WebkitBoxOrient:'vertical' as const, overflow:'hidden', overflowWrap:'anywhere'}}>
          {row.section_description}
        </div>
      ) : (
        <div className="text-xs text-slate-500">Описание не заполнено</div>
      )}
    </div>
  )
}

