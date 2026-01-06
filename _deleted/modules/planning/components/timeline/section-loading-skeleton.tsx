"use client"

import { cn } from "@/lib/utils"

// Канонические ширины колонок - должны соответствовать timeline-row.tsx
const COLUMN_WIDTHS = {
  section: 430,  // Ширина для раздела
  object: 120,   // Фиксированная ширина для объекта (скрыт по умолчанию)
} as const

interface SectionLoadingSkeletonProps {
  theme: string
  rowHeight: number
  cellWidth: number
  totalFixedWidth: number
  timeUnitsCount: number
  count?: number
}

export function SectionLoadingSkeleton({
  theme,
  rowHeight,
  cellWidth,
  totalFixedWidth,
  timeUnitsCount,
  count = 5,
}: SectionLoadingSkeletonProps) {
  // Используем константу для консистентности
  const sectionWidth = COLUMN_WIDTHS.section

  return (
    <>
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className={cn(
            "flex min-w-full border-b animate-pulse",
            theme === "dark" ? "border-slate-700" : "border-slate-200"
          )}
          style={{
            height: `${rowHeight}px`,
            animationDelay: `${idx * 50}ms`
          }}
        >
          {/* Фиксированные столбцы */}
          <div
            className={cn("sticky left-0 z-20 flex")}
            style={{
              height: `${rowHeight}px`,
              width: `${totalFixedWidth}px`,
            }}
          >
            <div
              className={cn(
                "p-2 flex items-center border-r h-full",
                theme === "dark"
                  ? "border-slate-700 bg-slate-800"
                  : "border-slate-200 bg-white"
              )}
              style={{
                width: `${sectionWidth}px`,
                minWidth: `${sectionWidth}px`,
              }}
            >
              {/* Контент с отступом 60px слева (как в timeline-row) */}
              <div className="flex items-center w-full" style={{ paddingLeft: '60px' }}>
                {/* Аватар */}
                <div
                  className={cn(
                    "w-6 h-6 rounded-full mr-2 flex-shrink-0",
                    theme === "dark" ? "bg-slate-700" : "bg-slate-200"
                  )}
                />

                {/* Название раздела */}
                <div
                  className={cn(
                    "h-4 rounded mr-2",
                    theme === "dark" ? "bg-slate-700" : "bg-slate-200"
                  )}
                  style={{ width: `${100 + (idx % 3) * 30}px`, maxWidth: '165px' }}
                />

                {/* Счётчик загрузок */}
                <div
                  className={cn(
                    "h-4 w-6 rounded mr-2 flex-shrink-0",
                    theme === "dark" ? "bg-slate-600" : "bg-slate-200"
                  )}
                />

                {/* Правая часть: даты и информация */}
                <div className="flex flex-col gap-1 ml-auto text-xs">
                  {/* Даты */}
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "h-3 rounded",
                        theme === "dark" ? "bg-slate-700" : "bg-slate-200"
                      )}
                      style={{ width: "55px" }}
                    />
                  </div>
                  {/* Стадия и отдел */}
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "h-3 rounded",
                        theme === "dark" ? "bg-slate-700" : "bg-slate-200"
                      )}
                      style={{ width: "40px" }}
                    />
                    <div
                      className={cn(
                        "h-3 rounded",
                        theme === "dark" ? "bg-slate-700" : "bg-slate-200"
                      )}
                      style={{ width: "50px" }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Ячейки таймлайна */}
          <div className="flex-1 flex w-full" style={{ flexWrap: "nowrap" }}>
            {Array.from({ length: timeUnitsCount }).map((_, i) => {
              // Создаем случайные полоски загрузки для эффекта
              const hasBar = (i + idx) % 7 === 0
              const barWidth = 3 + (idx % 3)

              return (
                <div
                  key={i}
                  className={cn(
                    "border-r relative",
                    theme === "dark" ? "border-slate-700" : "border-slate-200"
                  )}
                  style={{
                    height: `${rowHeight}px`,
                    width: `${cellWidth}px`,
                    minWidth: `${cellWidth}px`,
                    flexShrink: 0,
                  }}
                >
                  {hasBar && i + barWidth < timeUnitsCount && (
                    <div
                      className={cn(
                        "absolute top-1/2 -translate-y-1/2 rounded",
                        theme === "dark" ? "bg-slate-700" : "bg-slate-200"
                      )}
                      style={{
                        left: "2px",
                        height: "40px",
                        width: `${cellWidth * barWidth - 4}px`,
                        opacity: 0.6,
                      }}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </>
  )
}
