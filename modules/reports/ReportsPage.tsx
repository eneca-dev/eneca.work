"use client"

import { useEffect, useState } from "react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Filter, Users, Building2, FolderOpen, Calendar as CalendarIcon } from "lucide-react"
import { createClient } from "@/utils/supabase/client"

interface WorkLogRow {
  work_log_id: string
  work_log_date: string
  author_name: string
  section_name: string | null
  decomposition_item_description: string | null
  work_category_name: string | null
  work_log_hours: number
  work_log_hourly_rate: number
  work_log_amount: number
}

const supabase = createClient()

export default function ReportsPage() {
  const [rows, setRows] = useState<WorkLogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [authors, setAuthors] = useState<Array<{ author_id: string; author_name: string }>>([])
  const [authorId, setAuthorId] = useState<string>("")
  // Визуальные фильтры (дизайн, без логики)
  const [orgOpen, setOrgOpen] = useState(true)
  const [projOpen, setProjOpen] = useState(true)
  const [timeOpen, setTimeOpen] = useState(true)
  const [deptId, setDeptId] = useState("")
  const [teamId, setTeamId] = useState("")
  const [employeeId, setEmployeeId] = useState("")
  const [projectId, setProjectId] = useState("")
  const [stageId, setStageId] = useState("")
  const [objectId, setObjectId] = useState("")
  const [sectionIdFilter, setSectionIdFilter] = useState("")
  const [periodPreset, setPeriodPreset] = useState<"m"|"pm"|"y"|"custom">("m")
  const [dateFrom, setDateFrom] = useState<string>("")
  const [dateTo, setDateTo] = useState<string>("")

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      let query = supabase
        .from("view_work_logs_enriched")
        .select("work_log_id, work_log_date, author_name, section_name, decomposition_item_description, work_category_name, work_log_hours, work_log_hourly_rate, work_log_amount, author_id")
        .order("work_log_date", { ascending: false })
        .limit(1000)
      if (authorId) {
        query = query.eq('author_id', authorId)
      }
      const { data, error } = await query
      if (!error && data) {
        setRows(
          (data as any[]).map((r) => ({
            work_log_id: r.work_log_id,
            work_log_date: r.work_log_date,
            author_name: r.author_name,
            section_name: r.section_name,
            decomposition_item_description: r.decomposition_item_description,
            work_category_name: r.work_category_name,
            work_log_hours: Number(r.work_log_hours || 0),
            work_log_hourly_rate: Number(r.work_log_hourly_rate || 0),
            work_log_amount: Number(r.work_log_amount || 0),
          }))
        )
      }
      setLoading(false)
    }
    load()
  }, [authorId])

  // Загрузка авторов для фильтра
  useEffect(() => {
    const loadAuthors = async () => {
      const { data, error } = await supabase
        .from('view_work_logs_enriched')
        .select('author_id, author_name')
        .order('author_name', { ascending: true })
      if (!error && data) {
        const map = new Map<string, string>()
        for (const r of data as any[]) {
          if (r.author_id) map.set(r.author_id, r.author_name as string)
        }
        setAuthors(Array.from(map.entries()).map(([author_id, author_name]) => ({ author_id, author_name })))
      }
    }
    loadAuthors()
  }, [])

  return (
    <div className="px-0 py-4">
      <div className="sticky top-0 z-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-700 px-3 md:px-6 py-2">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <h1 className="text-sm md:text-lg font-semibold whitespace-nowrap mr-1 md:mr-3">Отчёты</h1>

          {/* Кнопка: Автор */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 text-xs md:text-sm hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap">
                <Users className="h-4 w-4" /> Автор
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[220px] p-0">
              <div className="p-2">
                <select
                  value={authorId}
                  onChange={e => setAuthorId(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-slate-300 dark:border-slate-700 rounded-md dark:bg-slate-900 dark:text-white"
                >
                  <option value="">Все</option>
                  {authors.map(a => (
                    <option key={a.author_id} value={a.author_id}>{a.author_name}</option>
                  ))}
                </select>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Кнопка: Организация */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 text-xs md:text-sm hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap">
                <Building2 className="h-4 w-4" /> Организация
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[280px] p-0">
              <div className="p-2 space-y-2">
                <select value={deptId} onChange={e=>setDeptId(e.target.value)} className="w-full px-2 py-1.5 text-sm border border-slate-300 dark:border-slate-700 rounded-md dark:bg-slate-900 dark:text-white">
                  <option>Отдел</option>
                </select>
                <select value={teamId} onChange={e=>setTeamId(e.target.value)} className="w-full px-2 py-1.5 text-sm border border-slate-300 dark:border-slate-700 rounded-md dark:bg-slate-900 dark:text-white">
                  <option>Команда</option>
                </select>
                <select value={employeeId} onChange={e=>setEmployeeId(e.target.value)} className="w-full px-2 py-1.5 text-sm border border-slate-300 dark:border-slate-700 rounded-md dark:bg-slate-900 dark:text-white">
                  <option>Сотрудник</option>
                </select>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Кнопка: Проект */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 text-xs md:text-sm hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap">
                <FolderOpen className="h-4 w-4" /> Проект
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[320px] p-0">
              <div className="p-2 space-y-2">
                <select value={projectId} onChange={e=>setProjectId(e.target.value)} className="w-full px-2 py-1.5 text-sm border border-slate-300 dark:border-slate-700 rounded-md dark:bg-slate-900 dark:text-white">
                  <option>Проект</option>
                </select>
                <div className="grid grid-cols-3 gap-2">
                  <select value={stageId} onChange={e=>setStageId(e.target.value)} className="px-2 py-1.5 text-sm border border-slate-300 dark:border-slate-700 rounded-md dark:bg-slate-900 dark:text-white">
                    <option>Стадия</option>
                  </select>
                  <select value={objectId} onChange={e=>setObjectId(e.target.value)} className="px-2 py-1.5 text-sm border border-slate-300 dark:border-slate-700 rounded-md dark:bg-slate-900 dark:text-white">
                    <option>Объект</option>
                  </select>
                  <select value={sectionIdFilter} onChange={e=>setSectionIdFilter(e.target.value)} className="px-2 py-1.5 text-sm border border-slate-300 dark:border-slate-700 rounded-md dark:bg-slate-900 dark:text-white">
                    <option>Раздел</option>
                  </select>
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Кнопка: Период */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 text-xs md:text-sm hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap">
                <CalendarIcon className="h-4 w-4" /> Период
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[320px] p-0">
              <div className="p-2 space-y-2">
                <div className="flex flex-wrap gap-2">
                  {[
                    {key:'m',label:'Текущий месяц'},
                    {key:'pm',label:'Прошлый месяц'},
                    {key:'y',label:'Год'},
                  ].map(p => (
                    <button
                      key={p.key}
                      onClick={()=>setPeriodPreset(p.key as any)}
                      className={`text-xs px-2 py-1 rounded border ${periodPreset===p.key ? 'bg-emerald-600 text-white border-emerald-600' : 'border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                    >{p.label}</button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400 ml-1">c</span>
                  <input type="date" value={dateFrom} onChange={e=>{setPeriodPreset('custom'); setDateFrom(e.target.value)}} className="px-2 py-1.5 text-sm border border-slate-300 dark:border-slate-700 rounded-md dark:bg-slate-900 dark:text-white" />
                  <span className="text-xs text-slate-500 dark:text-slate-400">по</span>
                  <input type="date" value={dateTo} onChange={e=>{setPeriodPreset('custom'); setDateTo(e.target.value)}} className="px-2 py-1.5 text-sm border border-slate-300 dark:border-slate-700 rounded-md dark:bg-slate-900 dark:text-white" />
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="overflow-x-auto border-y border-x-0 rounded-none dark:border-slate-700">
        <table className="min-w-full w-full table-fixed border-collapse text-[11px] sm:text-xs md:text-sm leading-tight">
          <colgroup>
            {[
              'w-[9%]',   // Дата
              'w-[12%]',  // Автор
              'w-[14%]',  // Раздел
              'w-[14%]',  // Категория
              'w-[30%]',  // Декомпозиция
              'w-[9%]',   // Часы
              'w-[12%]',  // Сумма
            ].map((cls, i) => (
              <col key={i} className={cls} />
            ))}
          </colgroup>
          <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200">
            <tr>
              <th className="px-1.5 md:px-2 lg:px-3 py-1.5 text-left border-b whitespace-nowrap pl-3 md:pl-6">Дата</th>
              <th className="px-1.5 md:px-2 lg:px-3 py-1.5 text-left border-b whitespace-nowrap">Автор</th>
              <th className="px-1.5 md:px-2 lg:px-3 py-1.5 text-left border-b whitespace-nowrap">Раздел</th>
              <th className="px-1.5 md:px-2 lg:px-3 py-1.5 text-left border-b whitespace-nowrap">Категория</th>
              <th className="px-1.5 md:px-2 lg:px-3 py-1.5 text-left border-b">Строка декомпозиции</th>
              <th className="px-1.5 md:px-2 lg:px-3 py-1.5 text-right border-b whitespace-nowrap">Часы</th>
              <th className="px-1.5 md:px-2 lg:px-3 py-1.5 text-right border-b whitespace-nowrap pr-4 sm:pr-6 md:pr-10 lg:pr-12">Сумма, ₽</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-1.5 md:px-2 lg:px-3 py-3" colSpan={6}>Загрузка...</td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.work_log_id} className="odd:bg-slate-50/40 dark:odd:bg-slate-800/40">
                  <td className="px-1.5 md:px-2 lg:px-3 py-1.5 whitespace-nowrap pl-3 md:pl-6">{new Date(r.work_log_date).toLocaleDateString('ru-RU')}</td>
                  <td className="px-1.5 md:px-2 lg:px-3 py-1.5 whitespace-nowrap max-w-[110px] sm:max-w-[140px] md:max-w-[160px] truncate" title={r.author_name}>{r.author_name}</td>
                  <td className="px-1.5 md:px-2 lg:px-3 py-1.5 whitespace-nowrap max-w-[160px] sm:max-w-[200px] md:max-w-[220px] truncate" title={r.section_name || ''}>{r.section_name || '—'}</td>
                  <td className="px-1.5 md:px-2 lg:px-3 py-1.5 whitespace-nowrap max-w-[140px] sm:max-w-[170px] md:max-w-[190px] truncate" title={r.work_category_name || ''}>{r.work_category_name || '—'}</td>
                  <td className="px-1.5 md:px-2 lg:px-3 py-1.5 align-top">
                    <div
                      className="truncate text-slate-700 dark:text-slate-200 max-w-[300px] sm:max-w-[360px] md:max-w-[480px] lg:max-w-[560px] xl:max-w-[680px]"
                      title={r.decomposition_item_description || ''}
                    >
                      {r.decomposition_item_description || '—'}
                    </div>
                  </td>
                  <td className="px-1.5 md:px-2 lg:px-3 py-1.5 text-right tabular-nums whitespace-nowrap">{r.work_log_hours.toFixed(2)}</td>
                  <td className="px-1.5 md:px-2 lg:px-3 py-1.5 text-right tabular-nums whitespace-nowrap pr-4 sm:pr-6 md:pr-10 lg:pr-12">{r.work_log_amount.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

