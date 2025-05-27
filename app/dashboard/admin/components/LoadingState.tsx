"use client"
import { Skeleton } from "@/components/ui/skeleton"

interface LoadingStateProps {
  /** Количество строк для имитации */
  rowCount?: number
  /** Количество колонок для имитации */
  columnCount?: number
  /** Определяет, должен ли заголовок иметь скелетон */
  withHeader?: boolean
}

export default function LoadingState({ 
  rowCount = 5, 
  columnCount = 3,
  withHeader = true 
}: LoadingStateProps) {
  return (
    <div className="w-full space-y-6">
      {withHeader && (
        <div className="flex flex-col md:flex-row justify-between gap-4 p-6">
          <Skeleton className="h-8 w-48" />
          <div className="flex gap-2 justify-end">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
      )}
      
      <div className="w-full px-6">
        <div className="flex mb-4 border-b pb-2">
          {Array.from({ length: columnCount }).map((_, i) => (
            <Skeleton key={`header-${i}`} className="h-6 flex-1 mr-4" />
          ))}
        </div>
        
        {Array.from({ length: rowCount }).map((_, rowIndex) => (
          <div key={`row-${rowIndex}`} className="flex py-4 border-b">
            {Array.from({ length: columnCount }).map((_, colIndex) => (
              <Skeleton 
                key={`cell-${rowIndex}-${colIndex}`} 
                className={`h-5 flex-1 mr-4 ${colIndex === 0 ? "w-1/2" : ""}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
} 