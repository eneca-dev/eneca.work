"use client"

import { cn } from "@/lib/utils"

interface DepartmentLoadingSkeletonProps {
  theme: string
  rowHeight: number
  cellWidth: number
  totalFixedWidth: number
  timeUnitsCount: number
  count?: number
}

export function DepartmentLoadingSkeleton({
  theme,
  rowHeight,
  cellWidth,
  totalFixedWidth,
  timeUnitsCount,
  count = 3,
}: DepartmentLoadingSkeletonProps) {
  const reducedRowHeight = Math.floor(rowHeight * 0.75)

  return (
    <>
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="min-w-full">
          {/* Скелет строки отдела */}
          <div
            className={cn(
              "flex min-w-full border-b animate-pulse",
              theme === "dark" ? "border-slate-700" : "border-slate-200"
            )}
            style={{ height: `${rowHeight}px` }}
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
                  "p-3 flex items-center border-b border-r",
                  theme === "dark"
                    ? "border-slate-700 bg-slate-800"
                    : "border-slate-200 bg-white"
                )}
                style={{
                  width: `${totalFixedWidth}px`,
                  minWidth: `${totalFixedWidth}px`,
                }}
              >
                {/* Иконка */}
                <div
                  className={cn(
                    "w-5 h-5 rounded mr-3",
                    theme === "dark" ? "bg-slate-700" : "bg-slate-200"
                  )}
                />
                {/* Название отдела */}
                <div className="flex-1">
                  <div
                    className={cn(
                      "h-4 rounded mb-1",
                      theme === "dark" ? "bg-slate-700" : "bg-slate-200"
                    )}
                    style={{ width: `${120 + idx * 30}px` }}
                  />
                  <div
                    className={cn(
                      "h-3 rounded",
                      theme === "dark" ? "bg-slate-700" : "bg-slate-200"
                    )}
                    style={{ width: `${80 + idx * 20}px` }}
                  />
                </div>
              </div>
            </div>

            {/* Ячейки таймлайна */}
            <div className="flex-1 flex w-full" style={{ flexWrap: "nowrap" }}>
              {Array.from({ length: timeUnitsCount }).map((_, i) => (
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
                  {/* Случайные полоски загрузки для эффекта */}
                  {i % 5 === idx % 5 && (
                    <div
                      className={cn(
                        "absolute bottom-2 left-1 right-1 rounded-sm",
                        theme === "dark" ? "bg-slate-700" : "bg-slate-200"
                      )}
                      style={{
                        height: `${20 + (i % 3) * 10}px`,
                        opacity: 0.5,
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Скелеты команд (2-3 на отдел) */}
          {Array.from({ length: 2 + (idx % 2) }).map((_, teamIdx) => (
            <div
              key={`team-${teamIdx}`}
              className={cn(
                "flex min-w-full border-b animate-pulse",
                theme === "dark" ? "border-slate-700" : "border-slate-200"
              )}
              style={{
                height: `${reducedRowHeight}px`,
                animationDelay: `${teamIdx * 100}ms`
              }}
            >
              {/* Фиксированные столбцы */}
              <div
                className={cn("sticky left-0 z-20 flex")}
                style={{
                  height: `${reducedRowHeight}px`,
                  width: `${totalFixedWidth}px`,
                }}
              >
                <div
                  className={cn(
                    "p-2 flex items-center border-b border-r",
                    theme === "dark"
                      ? "border-slate-700 bg-slate-900"
                      : "border-slate-200 bg-slate-50"
                  )}
                  style={{
                    width: `${totalFixedWidth}px`,
                    paddingLeft: "20px",
                  }}
                >
                  {/* Иконка команды */}
                  <div
                    className={cn(
                      "w-4 h-4 rounded mr-2",
                      theme === "dark" ? "bg-slate-700" : "bg-slate-200"
                    )}
                  />
                  {/* Название команды */}
                  <div
                    className={cn(
                      "h-3 rounded",
                      theme === "dark" ? "bg-slate-700" : "bg-slate-200"
                    )}
                    style={{ width: `${60 + teamIdx * 20}px` }}
                  />
                </div>
              </div>

              {/* Ячейки таймлайна */}
              <div className="flex-1 flex w-full" style={{ flexWrap: "nowrap" }}>
                {Array.from({ length: timeUnitsCount }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "border-r relative border-b",
                      theme === "dark" ? "border-slate-700" : "border-slate-200"
                    )}
                    style={{
                      height: `${reducedRowHeight}px`,
                      width: `${cellWidth}px`,
                      minWidth: `${cellWidth}px`,
                      flexShrink: 0,
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
    </>
  )
}
