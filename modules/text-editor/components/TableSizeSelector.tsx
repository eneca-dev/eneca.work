'use client'

import React, { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Table as TableIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TableSizeSelectorProps {
  onSelect: (rows: number, cols: number) => void
  maxRows?: number
  maxCols?: number
}

export function TableSizeSelector({ 
  onSelect, 
  maxRows = 10, 
  maxCols = 10 
}: TableSizeSelectorProps) {
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null)
  const [isOpen, setIsOpen] = useState(false)

  const handleCellHover = useCallback((row: number, col: number) => {
    setHoveredCell({ row, col })
  }, [])

  const handleCellClick = useCallback((row: number, col: number) => {
    onSelect(row + 1, col + 1)
    setIsOpen(false)
    setHoveredCell(null)
  }, [onSelect])

  const handleMouseLeave = useCallback(() => {
    setHoveredCell(null)
  }, [])

  const getSizeText = () => {
    if (!hoveredCell) return 'Выберите размер таблицы'
    return `${hoveredCell.row + 1} × ${hoveredCell.col + 1}`
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          title="Вставить таблицу"
        >
          <TableIcon className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-4 bg-popover border-border" align="start">
        <div className="space-y-3">
          {/* Заголовок с размером */}
          <div className="text-sm font-medium text-center text-foreground">
            {getSizeText()}
          </div>
          
          {/* Сетка для выбора размера */}
          <div 
            className="table-size-grid"
            style={{
              '--grid-cols': `repeat(${maxCols}, 1fr)`,
              '--grid-rows': `repeat(${maxRows}, 1fr)`
            } as React.CSSProperties}
            onMouseLeave={handleMouseLeave}
          >
            {Array.from({ length: maxRows }, (_, row) =>
              Array.from({ length: maxCols }, (_, col) => (
                <div
                  key={`${row}-${col}`}
                  className={cn(
                    'w-4 h-4 border border-border cursor-pointer transition-colors',
                    hoveredCell && row <= hoveredCell.row && col <= hoveredCell.col
                      ? 'bg-primary border-primary'
                      : 'bg-card hover:bg-accent'
                  )}
                  onMouseEnter={() => handleCellHover(row, col)}
                  onClick={() => handleCellClick(row, col)}
                />
              ))
            )}
          </div>
          
          {/* Дополнительная информация */}
          <div className="text-xs text-muted-foreground text-center">
            Нажмите на ячейку, чтобы создать таблицу
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
} 