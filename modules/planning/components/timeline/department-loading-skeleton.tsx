"use client"

import { cn } from "@/lib/utils"

// Канонические ширины колонок - должны соответствовать department-row.tsx
const COLUMN_WIDTHS = {
  section: 430,  // Ширина для раздела
  object: 120,   // Фиксированная ширина для объекта (скрыт по умолчанию)
} as const

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
  const sectionWidth = COLUMN_WIDTHS.section

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
                  "p-3 flex items-center border-r h-full",
                  theme === "dark"
                    ? "border-slate-700 bg-slate-800"
                    : "border-slate-200 bg-white"
                )}
                style={{
                  width: `${sectionWidth}px`,
                  minWidth: `${sectionWidth}px`,
                }}
              >
                {/* Контент с отступом 16px слева (как в department-row) */}
                <div className="flex items-center w-full" style={{ paddingLeft: '16px' }}>
                  {/* Chevron */}
                  <div
                    className={cn(
                      "w-4 h-4 rounded mr-2 flex-shrink-0",
                      theme === "dark" ? "bg-slate-700" : "bg-slate-200"
                    )}
                  />
                  {/* Иконка отдела */}
                  <div
                    className={cn(
                      "w-5 h-5 rounded mr-3 flex-shrink-0",
                      theme === "dark" ? "bg-slate-700" : "bg-slate-200"
                    )}
                  />
                  {/* Название отдела */}
                  <div
                    className={cn(
                      "h-4 rounded mr-2",
                      theme === "dark" ? "bg-slate-700" : "bg-slate-200"
                    )}
                    style={{ width: `${120 + idx * 30}px` }}
                  />
                  {/* Бейдж актуальности */}
                  <div
                    className={cn(
                      "h-4 w-16 rounded mr-2 flex-shrink-0",
                      theme === "dark" ? "bg-slate-600" : "bg-slate-200"
                    )}
                  />
                  {/* Термометр справа */}
                  <div className="ml-auto flex-shrink-0" style={{ width: '40px' }}>
                    <div
                      className={cn(
                        "rounded-sm",
                        theme === "dark" ? "bg-slate-700" : "bg-slate-200"
                      )}
                      style={{ height: `${rowHeight - 14}px`, width: '100%' }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Ячейки таймлайна */}
            <div className="flex-1 flex w-full" style={{ flexWrap: "nowrap" }}>
              {Array.from({ length: timeUnitsCount }).map((_, i) => (
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
                    "p-2 flex items-center border-r h-full",
                    theme === "dark"
                      ? "border-slate-700 bg-slate-900"
                      : "border-slate-200 bg-slate-50"
                  )}
                  style={{
                    width: `${sectionWidth}px`,
                    minWidth: `${sectionWidth}px`,
                  }}
                >
                  {/* Контент с отступом 40px слева (вложенный уровень) */}
                  <div className="flex items-center w-full" style={{ paddingLeft: '40px' }}>
                    {/* Chevron команды */}
                    <div
                      className={cn(
                        "w-4 h-4 rounded mr-2 flex-shrink-0",
                        theme === "dark" ? "bg-slate-700" : "bg-slate-200"
                      )}
                    />
                    {/* Иконка команды */}
                    <div
                      className={cn(
                        "w-4 h-4 rounded mr-2 flex-shrink-0",
                        theme === "dark" ? "bg-slate-700" : "bg-slate-200"
                      )}
                    />
                    {/* Название команды */}
                    <div
                      className={cn(
                        "h-3 rounded",
                        theme === "dark" ? "bg-slate-700" : "bg-slate-200"
                      )}
                      style={{ width: `${80 + teamIdx * 20}px` }}
                    />
                    {/* Термометр команды */}
                    <div className="ml-auto flex-shrink-0" style={{ width: '36px' }}>
                      <div
                        className={cn(
                          "rounded-sm",
                          theme === "dark" ? "bg-slate-700" : "bg-slate-200"
                        )}
                        style={{ height: `${reducedRowHeight - 14}px`, width: '100%' }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Ячейки таймлайна */}
              <div className="flex-1 flex w-full" style={{ flexWrap: "nowrap" }}>
                {Array.from({ length: timeUnitsCount }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "border-r relative",
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
