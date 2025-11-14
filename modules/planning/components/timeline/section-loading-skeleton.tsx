"use client"

import { cn } from "@/lib/utils"

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
                "p-3 flex flex-col justify-center border-b border-r",
                theme === "dark"
                  ? "border-slate-700 bg-slate-800"
                  : "border-slate-200 bg-white"
              )}
              style={{
                width: `${totalFixedWidth}px`,
                minWidth: `${totalFixedWidth}px`,
              }}
            >
              {/* Chevron + Название раздела */}
              <div className="flex items-center mb-2">
                <div
                  className={cn(
                    "w-5 h-5 rounded mr-2",
                    theme === "dark" ? "bg-slate-700" : "bg-slate-200"
                  )}
                />
                <div
                  className={cn(
                    "h-4 rounded",
                    theme === "dark" ? "bg-slate-700" : "bg-slate-200"
                  )}
                  style={{ width: `${150 + idx * 20}px` }}
                />
              </div>

              {/* Вторая строка: Ответственный, этап, даты */}
              <div className="flex items-center gap-2 ml-7">
                {/* Ответственный */}
                <div
                  className={cn(
                    "h-3 rounded",
                    theme === "dark" ? "bg-slate-700" : "bg-slate-200"
                  )}
                  style={{ width: `${80 + idx * 10}px` }}
                />
                {/* Этап */}
                <div
                  className={cn(
                    "h-3 rounded",
                    theme === "dark" ? "bg-slate-700" : "bg-slate-200"
                  )}
                  style={{ width: "60px" }}
                />
                {/* Даты */}
                <div
                  className={cn(
                    "h-3 rounded",
                    theme === "dark" ? "bg-slate-700" : "bg-slate-200"
                  )}
                  style={{ width: "100px" }}
                />
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
                    "border-r relative border-b",
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
                        right: "2px",
                        height: "24px",
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
