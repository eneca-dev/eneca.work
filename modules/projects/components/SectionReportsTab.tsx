"use client"

import React, { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Calendar as CalendarIcon } from 'lucide-react'
import { DateRangePicker, type DateRange } from '@/modules/projects/components/DateRangePicker'

interface SectionReportsTabProps {
  sectionId: string
}

interface WorkLogRow {
  work_log_id: string
  work_log_date: string
  author_name: string
  decomposition_item_description: string | null
  work_category_name: string | null
  work_log_description: string | null
  work_log_hours: number
  work_log_hourly_rate: number
  work_log_amount: number
}

const supabase = createClient()

export default function SectionReportsTab({ sectionId }: SectionReportsTabProps) {
  const [rows, setRows] = useState<WorkLogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState<string>("")
  const [dateTo, setDateTo] = useState<string>("")
  const [range, setRange] = useState<DateRange | null>(null)
  const [preset, setPreset] = useState<'7d' | 'm' | 'q' | 'y' | 'all'>('m')

  const formatLocalYMD = (d: Date): string => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  // Устанавливаем диапазон по пресету
  useEffect(() => {
    const now = new Date()
    const to = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    let from: Date | null = null
    if (preset === '7d') {
      from = new Date(to)
      from.setDate(from.getDate() - 6)
    } else if (preset === 'm') {
      from = new Date(to.getFullYear(), to.getMonth(), 1)
    } else if (preset === 'q') {
      const qStartMonth = Math.floor(to.getMonth() / 3) * 3
      from = new Date(to.getFullYear(), qStartMonth, 1)
    } else if (preset === 'y') {
      from = new Date(to.getFullYear(), 0, 1)
    } else if (preset === 'all') {
      from = null
    }
    if (preset === 'all') {
      setDateFrom('')
      setDateTo('')
      setRange(null)
    } else {
      setDateFrom(from ? formatLocalYMD(from) : '')
      setDateTo(formatLocalYMD(to))
      setRange({ from: from || null, to })
    }
  }, [preset])

  const fetchLogs = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('view_work_logs_enriched')
        .select(
          'work_log_id, work_log_date, author_name, decomposition_item_description, work_category_name, work_log_description, work_log_hours, work_log_hourly_rate, work_log_amount'
        )
        .eq('section_id', sectionId)
        .order('work_log_date', { ascending: false })

      if (dateFrom) query = query.gte('work_log_date', dateFrom)
      if (dateTo) query = query.lte('work_log_date', dateTo)

      const { data, error } = await query
      if (error) throw error
      setRows((data as any[]) || [])
    } catch (e) {
      console.error('Ошибка загрузки отчётов по разделу:', e)
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!sectionId) return
    fetchLogs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId, dateFrom, dateTo])

  // Группировка по строкам декомпозиции (по описанию)
  const groups = useMemo(() => {
    const map = new Map<string, WorkLogRow[]>()
    for (const r of rows) {
      const key = r.decomposition_item_description || 'Без строки'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(r)
    }
    return Array.from(map.entries()).map(([key, list]) => ({ key, list }))
  }, [rows])

  const totalHours = useMemo(() => rows.reduce((s, r) => s + Number(r.work_log_hours || 0), 0), [rows])
  const totalAmount = useMemo(() => rows.reduce((s, r) => s + Number(r.work_log_amount || 0), 0), [rows])

  return (
    <div className="h-full flex flex-col">
      {/* Панель фильтров по времени */}
      <div className="mb-2 flex items-center gap-2">
        <div className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 p-1 bg-white dark:bg-slate-900">
          {[
            { k: '7d', t: '7д' },
            { k: 'm', t: 'Месяц' },
            { k: 'q', t: 'Квартал' },
            { k: 'y', t: 'Год' },
            { k: 'all', t: 'Все' },
          ].map(({ k, t }) => (
            <button
              key={k}
              onClick={() => setPreset(k as any)}
              className={`px-2 py-1 text-xs rounded ${preset === k ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'}`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 p-1 bg-white dark:bg-slate-900 h-[30px]">
            <DateRangePicker
              value={range}
              onChange={(r) => {
                setRange(r)
                const fromStr = r?.from ? formatLocalYMD(new Date(r.from.getFullYear(), r.from.getMonth(), r.from.getDate())) : ''
                const toStr = r?.to ? formatLocalYMD(new Date(r.to.getFullYear(), r.to.getMonth(), r.to.getDate())) : ''
                setDateFrom(fromStr)
                setDateTo(toStr)
              }}
              placeholder="Выберите период"
              calendarWidth="500px"
              inputWidth="180px"
              inputClassName="bg-transparent border-0 focus:outline-none focus:ring-0 outline-none text-xs h-[22px] leading-[22px] px-2 py-0 m-0"
            />
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
          <div>Часы: <span className="font-medium text-slate-900 dark:text-slate-100">{totalHours.toFixed(2)}</span></div>
          <div>Сумма: <span className="font-medium text-slate-900 dark:text-slate-100">{totalAmount.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}</span></div>
        </div>
      </div>

      {/* Список сгруппированный по строкам декомпозиции */}
      <div className="flex-1 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-900">
        {loading ? (
          <div className="flex items-center justify-center h-24 text-slate-500 dark:text-slate-400 text-sm">Загрузка...</div>
        ) : rows.length === 0 ? (
          <div className="p-4 text-sm text-slate-500 dark:text-slate-400">Нет отчётов за выбранный период</div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {groups.map(({ key, list }) => {
              const groupHours = list.reduce((s, r) => s + Number(r.work_log_hours || 0), 0)
              const groupAmount = list.reduce((s, r) => s + Number(r.work_log_amount || 0), 0)
              return (
                <div key={key}>
                  <div className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-800/60">
                    <div className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">{key}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">{groupHours.toFixed(2)} ч · {groupAmount.toLocaleString('ru-BY', { style: 'currency', currency: 'BYN', maximumFractionDigits: 0 })}</div>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {list.map((r) => (
                      <div key={r.work_log_id} className="grid grid-cols-[90px_1fr_120px_80px] gap-2 items-center px-3 py-1.5">
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">{new Date(r.work_log_date).toLocaleDateString('ru-RU')}</div>
                        <div className="text-[12px] dark:text-slate-100">
                          <div className="truncate">{r.work_log_description || 'Без описания'}</div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{r.author_name}{r.work_category_name ? ` · ${r.work_category_name}` : ''}</div>
                        </div>
                        <div className="text-[11px] text-right tabular-nums text-slate-600 dark:text-slate-300">{Number(r.work_log_hours || 0).toFixed(2)} ч</div>
                        <div className="text-[11px] text-right tabular-nums text-slate-600 dark:text-slate-300">{Number(r.work_log_amount || 0).toLocaleString('ru-BY', { style: 'currency', currency: 'BYN', maximumFractionDigits: 0 })}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}


