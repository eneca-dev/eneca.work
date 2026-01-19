"use client"

import { useState, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import { usePlanningStore } from "../../stores/usePlanningStore"
import { createShortageLoading, supabase } from "@/lib/supabase-client"

interface AddShortageModalProps {
  teamId: string
  teamName: string
  departmentId?: string
  departmentName?: string
  theme: string
  onClose: () => void
}

export function AddShortageModal({ teamId, teamName, departmentId, departmentName, theme, onClose }: AddShortageModalProps) {
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split("T")[0])
  const [endDate, setEndDate] = useState<string>(new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0])
  const [rate, setRate] = useState<number>(1)
  const [description, setDescription] = useState<string>("")
  const [isSaving, setIsSaving] = useState(false)
  const [projectId, setProjectId] = useState<string>("")
  const [sectionId, setSectionId] = useState<string>("")
  const [projects, setProjects] = useState<{ project_id: string; project_name: string }[]>([])
  const [sections, setSections] = useState<{ section_id: string; section_name: string }[]>([])
  // Поиск проекта
  const [projectSearchTerm, setProjectSearchTerm] = useState("")
  const [showProjectDropdown, setShowProjectDropdown] = useState(false)
  const dropdownTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  // Стадии и объекты
  const [stages, setStages] = useState<{ stage_id: string; stage_name: string }[]>([])
  const [objects, setObjects] = useState<{ object_id: string; object_name: string }[]>([])
  const [selectedStageId, setSelectedStageId] = useState<string>("")
  const [selectedObjectId, setSelectedObjectId] = useState<string>("")

  const refreshSections = usePlanningStore((s) => s.fetchSections)
  const fetchDepartments = usePlanningStore((s) => s.fetchDepartments)

  const handleSave = async () => {
    setIsSaving(true)
    try {
      if (!projectId || !sectionId) throw new Error("Выберите проект и раздел")
      const res = await createShortageLoading({
        startDate,
        endDate,
        rate,
        departmentId: departmentId || null,
        teamId,
        sectionId,
        description,
      })
      if (!res.success) throw new Error(res.error || "Не удалось создать дефицит")
      await refreshSections()
      await fetchDepartments()
      onClose()
    } catch (e) {
      console.error(e)
    } finally {
      setIsSaving(false)
    }
  }

  // Загружаем список активных проектов при открытии модалки
  // и обнуляем разделы при смене проекта
  // (аналогично модалке обычной загрузки, но без поиска)
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const { data, error } = await supabase
          .from("projects")
          .select("project_id, project_name")
          .eq("project_status", "active")
          .order("project_name")
        if (!error) setProjects(data || [])
      } catch (e) {
        console.error("Ошибка загрузки проектов для дефицита:", e)
      }
    }
    loadProjects()
  }, [])

  // Вспомогательная функция: подгрузить разделы по проекту + фильтрам
  const fetchSectionsForProject = async (pId: string, stageId?: string, objectId?: string) => {
    if (!pId) { setSections([]); return }
    try {
      let query = supabase
        .from("view_section_hierarchy")
        .select("section_id, section_name")
        .eq("project_id", pId)
        .order("section_name")
      if (stageId) query = query.eq("stage_id", stageId)
      if (objectId) query = query.eq("object_id", objectId)
      const { data } = await query
      setSections((data || []).map((r:any)=>({ section_id: r.section_id, section_name: r.section_name })))
    } catch (e) {
      console.error("Ошибка загрузки разделов по фильтрам:", e)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className={cn("rounded-lg p-6 w-[460px] max-w-[90vw]", theme === "dark" ? "bg-slate-800" : "bg-white")}>        
        <h3 className={cn("text-lg font-semibold mb-4", theme === "dark" ? "text-slate-200" : "text-slate-800")}>Создать дефицит</h3>

        <div className="space-y-3">
          <div className={cn("text-sm", theme === "dark" ? "text-slate-300" : "text-slate-700")}>Команда: {teamName}</div>
          {departmentName && (
            <div className={cn("text-sm", theme === "dark" ? "text-slate-300" : "text-slate-700")}>Отдел: {departmentName}</div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="project-search-container relative">
              <label className={cn("block text-sm mb-1", theme === "dark" ? "text-slate-300" : "text-slate-700")}>Проект</label>
              <div className="relative">
                <input
                  type="text"
                  value={projectSearchTerm}
                  onChange={(e) => {
                    setProjectSearchTerm(e.target.value)
                    setShowProjectDropdown(true)
                  }}
                  onFocus={() => setShowProjectDropdown(true)}
                  onBlur={() => {
                    if (dropdownTimeoutRef.current) clearTimeout(dropdownTimeoutRef.current)
                    dropdownTimeoutRef.current = setTimeout(() => setShowProjectDropdown(false), 200)
                  }}
                  placeholder="Поиск проекта..."
                  disabled={isSaving}
                  className={cn(
                    "w-full text-sm rounded border px-3 py-2",
                    theme === "dark"
                      ? "bg-slate-700 border-slate-600 text-slate-200"
                      : "bg-white border-slate-300 text-slate-800",
                    isSaving ? "opacity-50 cursor-not-allowed" : "",
                  )}
                />

                {showProjectDropdown && (projects?.length || 0) > 0 && (
                  <div
                    className={cn(
                      "absolute z-10 w-full mt-1 max-h-60 overflow-auto rounded border",
                      theme === "dark" ? "bg-slate-800 border-slate-600" : "bg-white border-slate-300",
                    )}
                  >
                    {(projectSearchTerm.trim() === ""
                      ? projects.slice(0, 10)
                      : projects
                          .filter((p) => p.project_name.toLowerCase().includes(projectSearchTerm.toLowerCase()))
                          .slice(0, 10)
                    ).map((project) => (
                      <div
                        key={project.project_id}
                        onMouseDown={async () => {
                          setProjectId(project.project_id)
                          setProjectSearchTerm(project.project_name)
                          setShowProjectDropdown(false)
                          setSectionId("")
                          // Стадии
                          const { data: stageRows } = await supabase
                            .from("stages")
                            .select("stage_id, stage_name")
                            .eq("stage_project_id", project.project_id)
                            .order("stage_name")
                          setStages(stageRows || [])
                          // Объекты (уникальные) и разделы
                          const { data: hier } = await supabase
                            .from("view_section_hierarchy")
                            .select("section_id, section_name, object_id, object_name")
                            .eq("project_id", project.project_id)
                          const objectsMap = new Map<string, { object_id: string; object_name: string }>()
                          const sectionsList: { section_id: string; section_name: string }[] = []
                          ;(hier || []).forEach((r: any) => {
                            if (r.section_id && r.section_name) sectionsList.push({ section_id: r.section_id, section_name: r.section_name })
                            if (r.object_id && r.object_name && !objectsMap.has(r.object_id)) objectsMap.set(r.object_id, { object_id: r.object_id, object_name: r.object_name })
                          })
                          setObjects(Array.from(objectsMap.values()).sort((a, b) => a.object_name.localeCompare(b.object_name)))
                          setSections(sectionsList.sort((a, b) => a.section_name.localeCompare(b.section_name)))
                          // Сбрасываем фильтры
                          setSelectedStageId("")
                          setSelectedObjectId("")
                        }}
                        className={cn(
                          "px-3 py-2 cursor-pointer text-sm",
                          theme === "dark" ? "hover:bg-slate-600 text-slate-200" : "hover:bg-slate-50 text-slate-800",
                        )}
                      >
                        {project.project_name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className={cn("block text-sm mb-1", theme === "dark" ? "text-slate-300" : "text-slate-700")}>Стадия</label>
              <select className={cn("w-full text-sm rounded border px-3 py-2", theme === "dark" ? "bg-slate-700 border-slate-600 text-slate-200" : "bg-white border-slate-300 text-slate-800")} value={selectedStageId} onChange={(e)=>{
                const v = e.target.value
                setSelectedStageId(v)
                fetchSectionsForProject(projectId, v || undefined, selectedObjectId || undefined)
              }} disabled={!projectId}>
                <option value="">Любая</option>
                {stages.map(s => (<option key={s.stage_id} value={s.stage_id}>{s.stage_name}</option>))}
              </select>
            </div>
            <div>
              <label className={cn("block text-sm mb-1", theme === "dark" ? "text-slate-300" : "text-slate-700")}>Объект</label>
              <select className={cn("w-full text-sm rounded border px-3 py-2", theme === "dark" ? "bg-slate-700 border-slate-600 text-slate-200" : "bg-white border-slate-300 text-slate-800")} value={selectedObjectId} onChange={(e)=>{
                const v = e.target.value
                setSelectedObjectId(v)
                fetchSectionsForProject(projectId, selectedStageId || undefined, v || undefined)
              }} disabled={!projectId}>
                <option value="">Любой</option>
                {objects.map(o => (<option key={o.object_id} value={o.object_id}>{o.object_name}</option>))}
              </select>
            </div>
            <div>
              <label className={cn("block text-sm mb-1", theme === "dark" ? "text-slate-300" : "text-slate-700")}>Раздел</label>
              <select className={cn("w-full text-sm rounded border px-3 py-2", theme === "dark" ? "bg-slate-700 border-slate-600 text-slate-200" : "bg-white border-slate-300 text-slate-800")} value={sectionId} onChange={(e)=>setSectionId(e.target.value)} disabled={!projectId}>
                <option value="">Выберите раздел</option>
                {sections.map(s => (
                  <option key={s.section_id} value={s.section_id}>{s.section_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={cn("block text-sm mb-1", theme === "dark" ? "text-slate-300" : "text-slate-700")}>Дата начала</label>
              <input type="date" value={startDate} onChange={(e)=>setStartDate(e.target.value)} disabled={isSaving} className={cn("w-full text-sm rounded border px-3 py-2", theme === "dark" ? "bg-slate-700 border-slate-600 text-slate-200" : "bg-white border-slate-300 text-slate-800")} />
            </div>
            <div>
              <label className={cn("block text-sm mb-1", theme === "dark" ? "text-slate-300" : "text-slate-700")}>Дата окончания</label>
              <input type="date" value={endDate} onChange={(e)=>setEndDate(e.target.value)} disabled={isSaving} className={cn("w-full text-sm rounded border px-3 py-2", theme === "dark" ? "bg-slate-700 border-slate-600 text-slate-200" : "bg-white border-slate-300 text-slate-800")} />
            </div>
          </div>
          <div>
            <label className={cn("block text-sm mb-1", theme === "dark" ? "text-slate-300" : "text-slate-700")}>Ставка</label>
            <input type="number" step="0.1" min="0.1" value={rate} onChange={(e)=>setRate(parseFloat(e.target.value))} disabled={isSaving} className={cn("w-full text-sm rounded border px-3 py-2", theme === "dark" ? "bg-slate-700 border-slate-600 text-slate-200" : "bg-white border-slate-300 text-slate-800")} />
          </div>
          <div>
            <label className={cn("block text-sm mb-1", theme === "dark" ? "text-slate-300" : "text-slate-700")}>Комментарий</label>
            <input type="text" value={description} onChange={(e)=>setDescription(e.target.value)} disabled={isSaving} className={cn("w-full text-sm rounded border px-3 py-2", theme === "dark" ? "bg-slate-700 border-slate-600 text-slate-200" : "bg-white border-slate-300 text-slate-800")} />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} disabled={isSaving} className={cn("px-4 py-2 text-sm rounded border", theme === "dark" ? "border-slate-600 text-slate-300 hover:bg-slate-700" : "border-slate-300 text-slate-600 hover:bg-slate-50")}>Отмена</button>
          <button onClick={handleSave} disabled={isSaving} className={cn("px-4 py-2 text-sm rounded", theme === "dark" ? "bg-red-600 text-white hover:bg-red-700" : "bg-red-500 text-white hover:bg-red-600")}>{isSaving?"Сохранение...":"Создать"}</button>
        </div>
      </div>
    </div>
  )
}


