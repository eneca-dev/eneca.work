"use client";

import React, { useMemo, useRef, useState } from "react";
import type { ReportDay, AssignmentPlanEvents, AssignmentPlannedEventItem, ReportDayTotal } from "../types";

interface ReportsLast7ChartProps {
  reportsLast7: ReportDay[] | null;
  reportsLast7Totals?: ReportDayTotal[] | null;
  assignmentPlanEventsLast10?: AssignmentPlanEvents[] | null;
}

type DayData = {
  date: Date;
  key: string; // YYYY-MM-DD
  label: string; // DD.MM
  totalHours: number;
  entries: { name: string; hours: number }[];
};

export const ReportsLast7Chart: React.FC<ReportsLast7ChartProps> = ({ reportsLast7, reportsLast7Totals, assignmentPlanEventsLast10 }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const MAX_BAR_PX = 152;
  const CHART_HEIGHT = MAX_BAR_PX + 20;
  const BAR_GAP = 6;
  const TOOLTIP_WIDTH = 260;
  const LABEL_SPACE_PX = 20; // высота подписи даты + отступ
  const CM_PX = 38; // ~1 см на большинстве дисплеев (96dpi -> 1cm ≈ 37.8px)
  const totalsMap = useMemo(() => {
    const m = new Map<string, number>();
    if (Array.isArray(reportsLast7Totals)) {
      for (const t of reportsLast7Totals) {
        m.set(t.date, Number(t.total_hours || 0));
      }
    }
    return m;
  }, [reportsLast7Totals]);

  const last7: DayData[] = useMemo(() => {
    const parse = (r: ReportDay): DayData => {
      const key = r.date; // YYYY-MM-DD
      const d = new Date(key);
      const label = `${d.getDate().toString().padStart(2, "0")}.${(d.getMonth() + 1)
        .toString()
        .padStart(2, "0")}`;
      const rawEntries = Array.isArray(r.entries)
        ? r.entries.map((e) => ({ name: String(e.name), hours: Number(e.hours || 0) }))
        : [];
      // Для тултипа показываем только те строки, где часы по отчётам > 0
      const nonZeroEntries = rawEntries.filter((e) => e.hours > 0);
      // Высоту столбика считаем по сумме часов; если есть totals из БД — используем его как источник истины
      const totalHours = totalsMap.has(key)
        ? Number(totalsMap.get(key) || 0)
        : rawEntries.reduce((s, x) => s + x.hours, 0);
      return { date: d, key, label, totalHours, entries: nonZeroEntries.sort((a, b) => b.hours - a.hours) };
    };
    return Array.isArray(reportsLast7) ? reportsLast7.map(parse) : [];
  }, [reportsLast7, totalsMap]);

  // Вычисляем верхнюю границу: округляем максимум вверх до удобной ступени
  const rawMax = Math.max(...last7.map((d) => d.totalHours), 0);
  // Пикселей на 1 час: максимум всегда равен MAX_BAR_PX
  const pxPerHour = rawMax > 0 ? MAX_BAR_PX / rawMax : 0;

  type TooltipEntry = { name?: string; hours?: number; title?: string; status?: string };
  const [tooltip, setTooltip] = useState<{ visible: boolean; x: number; y: number; entries: TooltipEntry[] }>(
    { visible: false, x: 0, y: 0, entries: [] }
  );

  const tooltipListRef = useRef<HTMLDivElement | null>(null);

  const handleWheelScrollTooltip = (e: React.WheelEvent) => {
    if (!tooltip.visible) return;
    if (tooltipListRef.current) {
      tooltipListRef.current.scrollTop += e.deltaY;
    }
  };

  const truncate = (s?: string, max: number = 20): string => {
    const str = String(s || "");
    return str.length > max ? str.slice(0, max) + "..." : str;
  };

  return (
    <div ref={containerRef} className="bg-white dark:bg-[rgb(15,23,42)] border border-slate-200 dark:border-white/20 rounded-sm px-4 pt-4 pb-2 h-full flex flex-col shadow-lg transition-all duration-300 relative select-none">
      <div className="text-muted-foreground text-sm mb-3">График отчетов</div>

      <div className="flex items-end w-full" style={{ height: CHART_HEIGHT, gap: BAR_GAP }} onWheel={handleWheelScrollTooltip}>
        {last7.map((d, idx) => {
          const pxHeight = Math.round(d.totalHours * pxPerHour);
          const barPx = Math.max(d.totalHours > 0 ? 6 : 2, Math.min(MAX_BAR_PX, pxHeight));
          const barWidth = `calc((100% - ${BAR_GAP * Math.max(0, last7.length - 1)}px) / ${Math.max(1, last7.length)})`;
          const eventsForDay: AssignmentPlannedEventItem[] = Array.isArray(assignmentPlanEventsLast10)
            ? (assignmentPlanEventsLast10.find((e)=>e.date===d.key)?.events || [])
            : [];
          return (
            <div key={d.key} className="flex flex-col items-center relative" style={{ width: barWidth }}>
              <div
                className="w-full transition-[height,background-color] duration-500 ease-out rounded-[2px] bg-emerald-600/80 hover:bg-emerald-500"
                style={{ height: `${barPx}px`, minHeight: d.totalHours > 0 ? 6 : 2, cursor: d.totalHours > 0 ? "pointer" : "default" }}
                onMouseEnter={(e) => {
                  const barRect = (e.target as HTMLElement).getBoundingClientRect();
                  const spaceRight = window.innerWidth - barRect.right;
                  const margin = 8;
                  const placeRight = spaceRight >= TOOLTIP_WIDTH + margin;
                  let left = placeRight ? (barRect.right + margin) : (barRect.left - TOOLTIP_WIDTH - margin);
                  let top = barRect.top + barRect.height / 2;
                  top = Math.max(16, Math.min(top, window.innerHeight - 16));
                  setTooltip({ visible: d.totalHours > 0, x: left, y: top, entries: d.entries });
                }}
                onMouseMove={(e) => {
                  const barRect = (e.target as HTMLElement).getBoundingClientRect();
                  const spaceRight = window.innerWidth - barRect.right;
                  const margin = 8;
                  const placeRight = spaceRight >= TOOLTIP_WIDTH + margin;
                  let left = placeRight ? (barRect.right + margin) : (barRect.left - TOOLTIP_WIDTH - margin);
                  let top = barRect.top + barRect.height / 2;
                  top = Math.max(16, Math.min(top, window.innerHeight - 16));
                  setTooltip((t) => ({ ...t, x: left, y: top }));
                }}
                onMouseLeave={() => setTooltip((t) => ({ ...t, visible: false }))}
                onWheel={handleWheelScrollTooltip}
                aria-label={`Всего часов: ${d.totalHours}`}
              />
              {/* Лейбл над баром: слева точка-события (если есть), справа сумма часов */}
              <div
                className="absolute flex items-center gap-1 select-none"
                style={{
                  bottom: `${barPx < CM_PX
                    ? barPx + LABEL_SPACE_PX + 8
                    : Math.max(LABEL_SPACE_PX + 10, LABEL_SPACE_PX + barPx - 12)
                  }px`
                }}
              >
                {eventsForDay.length > 0 && (
                  <span
                    className="inline-block w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-400"
                    onMouseEnter={(e)=>{
                      const rect = (e.target as HTMLElement).getBoundingClientRect();
                      const margin=8; let left = rect.left + rect.width/2 + margin; let top = rect.top;
                      setTooltip({
                        visible:true,
                        x:left,
                        y:top,
                        entries: eventsForDay.map((ev)=>({
                          title: ev.title,
                          status: ev.kind==='planned_transfer' ? 'Плановая передача' : 'Плановое завершение',
                          from: ev.from_section_name,
                          to: ev.to_section_name,
                        }))
                      })
                    }}
                    onMouseLeave={()=>setTooltip(t=>({ ...t, visible:false }))}
                  />
                )}
                <span className="text-[10px] text-slate-700 dark:text-gray-300">{d.totalHours.toFixed(1)}</span>
              </div>
              {(() => {
                const day = new Date(d.key).getDay();
                const isWeekend = day === 0 || day === 6;
                return (
                  <div className={`mt-2 text-[10px] ${isWeekend ? 'text-red-500 dark:text-red-400' : 'text-slate-900 dark:text-muted-foreground'}`}>{d.label}</div>
                );
              })()}
            </div>
          );
        })}
      </div>

      {tooltip.visible && (
        <div
          className="fixed z-50 rounded-[2px] shadow-xl border bg-white text-slate-900 border-slate-200 dark:bg-gray-900 dark:text-white dark:border-white/20"
          style={{ left: tooltip.x, top: tooltip.y, transform: 'translateY(-50%)' }}
        >
          <div
            ref={tooltipListRef}
            className="overflow-x-hidden p-3"
            style={{ width: TOOLTIP_WIDTH }}
          >
            {tooltip.entries.length === 0 ? (
              <div className="text-xs text-slate-500 dark:text-gray-300">Нет данных</div>
            ) : (
              <div className="space-y-1">
                {tooltip.entries.map((e, i: number) => {
                  const leftText = truncate(e.name ?? e.title ?? '', 20)
                  const rightText = typeof e.hours === 'number' ? `${e.hours.toFixed(2)} ч` : (e.status ?? '')
                  return (
                    <div key={i} className="flex items-center justify-between gap-2">
                      <div className="flex flex-col max-w-[180px] flex-1 min-w-0">
                        <span className="text-xs truncate text-slate-700 dark:text-gray-200">{leftText}</span>
                        {((e as any).from || (e as any).to) && (
                          <span className="text-[10px] text-slate-500 dark:text-gray-300 truncate">{truncate((e as any).from, 15) || '—'} → {truncate((e as any).to, 15) || '—'}</span>
                        )}
                      </div>
                      {rightText && <span className="text-xs font-semibold text-slate-900 dark:text-gray-100 whitespace-nowrap text-right">{rightText}</span>}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsLast7Chart;


