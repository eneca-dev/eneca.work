'use client'

/**
 * PasteDialog - Диалог вставки задач из Excel
 */

import { useState, useMemo } from 'react'
import { ClipboardPaste, AlertCircle, Check } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { WorkCategory, DifficultyLevel, ParsedPasteItem } from '../types'
import { LABEL_TO_CATEGORY_MAP } from '../constants'

// ============================================================================
// Types
// ============================================================================

interface PasteDialogProps {
  isOpen: boolean
  onClose: () => void
  onPaste: (items: ParsedPasteItem[]) => void
  workCategories: WorkCategory[]
  difficultyLevels: DifficultyLevel[]
}

// ============================================================================
// Parser
// ============================================================================

function parseExcelData(
  text: string,
  workCategories: WorkCategory[],
  difficultyLevels: DifficultyLevel[]
): { items: ParsedPasteItem[]; errors: string[] } {
  const items: ParsedPasteItem[] = []
  const errors: string[] = []

  const lines = text.trim().split('\n')

  lines.forEach((line, index) => {
    const cols = line.split('\t')

    // Expected format: Description, Type, Difficulty, Hours
    // Or: Description, Hours (simplified)
    if (cols.length < 2) {
      errors.push(`Строка ${index + 1}: недостаточно данных`)
      return
    }

    const description = cols[0]?.trim()
    if (!description) {
      errors.push(`Строка ${index + 1}: пустое описание`)
      return
    }

    let typeOfWork = ''
    let workCategoryId = ''
    let difficulty = ''
    let difficultyId = ''
    let plannedHours = 0

    if (cols.length >= 4) {
      // Full format: Description, Type, Difficulty, Hours
      const typeLabel = cols[1]?.trim().toUpperCase()
      const diffLabel = cols[2]?.trim().toUpperCase()
      const hoursStr = cols[3]?.trim()

      // Map type label to category
      const mappedType = LABEL_TO_CATEGORY_MAP[typeLabel]
      if (mappedType) {
        const cat = workCategories.find((c) => c.work_category_name === mappedType)
        if (cat) {
          typeOfWork = cat.work_category_name
          workCategoryId = cat.work_category_id
        }
      }

      // Map difficulty
      const diff = difficultyLevels.find(
        (d) => d.difficulty_abbr.toUpperCase() === diffLabel
      )
      if (diff) {
        difficulty = diff.difficulty_abbr
        difficultyId = diff.difficulty_id
      }

      plannedHours = parseFloat(hoursStr) || 0
    } else {
      // Simplified format: Description, Hours
      const hoursStr = cols[1]?.trim()
      plannedHours = parseFloat(hoursStr) || 0

      // Use default category
      if (workCategories.length > 0) {
        typeOfWork = workCategories[0].work_category_name
        workCategoryId = workCategories[0].work_category_id
      }
    }

    items.push({
      description,
      typeOfWork,
      workCategoryId,
      difficulty,
      difficultyId,
      plannedHours,
    })
  })

  return { items, errors }
}

// ============================================================================
// Component
// ============================================================================

export function PasteDialog({
  isOpen,
  onClose,
  onPaste,
  workCategories,
  difficultyLevels,
}: PasteDialogProps) {
  const [text, setText] = useState('')

  // Parse pasted text
  const { items, errors } = useMemo(
    () => parseExcelData(text, workCategories, difficultyLevels),
    [text, workCategories, difficultyLevels]
  )

  // Handle paste
  const handlePaste = () => {
    if (items.length > 0) {
      onPaste(items)
      setText('')
      onClose()
    }
  }

  // Reset state when dialog opens
  const handleOpenChange = (open: boolean) => {
    if (open) {
      setText('')
    } else {
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardPaste className="h-5 w-5" />
            Вставить из Excel
          </DialogTitle>
          <DialogDescription>
            Скопируйте данные из Excel и вставьте в поле ниже. Формат: Описание, Тип работы (MNG/CLC/MDL200/DRW/GTS), Сложность (К/ВС/ГС), Часы
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Textarea
            placeholder="Вставьте данные из Excel (Ctrl+V)..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="min-h-[200px] font-mono text-sm"
          />

          {/* Preview */}
          {items.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Check className="h-4 w-4 text-green-500" />
                Распознано задач: {items.length}
              </div>
              <ScrollArea className="h-[150px] border rounded-md">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="px-2 py-1 text-left">Описание</th>
                      <th className="px-2 py-1 text-left w-24">Тип</th>
                      <th className="px-2 py-1 text-left w-16">Слож.</th>
                      <th className="px-2 py-1 text-right w-16">Часы</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.slice(0, 10).map((item, i) => (
                      <tr key={i} className="border-b">
                        <td className="px-2 py-1 truncate max-w-[300px]">{item.description}</td>
                        <td className="px-2 py-1">{item.typeOfWork || '—'}</td>
                        <td className="px-2 py-1">{item.difficulty || '—'}</td>
                        <td className="px-2 py-1 text-right">{item.plannedHours}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {items.length > 10 && (
                  <p className="px-2 py-1 text-muted-foreground">
                    ...и ещё {items.length - 10} задач
                  </p>
                )}
              </ScrollArea>
            </div>
          )}

          {/* Errors */}
          {errors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-medium mb-1">Ошибки парсинга:</p>
                <ul className="list-disc list-inside text-xs">
                  {errors.slice(0, 5).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
                {errors.length > 5 && (
                  <p className="text-xs mt-1">...и ещё {errors.length - 5} ошибок</p>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={handlePaste} disabled={items.length === 0}>
            Вставить ({items.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
