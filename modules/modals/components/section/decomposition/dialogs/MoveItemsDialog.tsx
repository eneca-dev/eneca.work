'use client'

/**
 * MoveItemsDialog - Диалог перемещения задач между этапами
 */

import { useState } from 'react'
import { MoveRight } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Stage } from '../types'

// ============================================================================
// Types
// ============================================================================

interface MoveItemsDialogProps {
  isOpen: boolean
  onClose: () => void
  stages: Stage[]
  currentStageId: string
  selectedItemsCount: number
  onMove: (targetStageId: string | null) => void
}

// ============================================================================
// Component
// ============================================================================

export function MoveItemsDialog({
  isOpen,
  onClose,
  stages,
  currentStageId,
  selectedItemsCount,
  onMove,
}: MoveItemsDialogProps) {
  const [targetStageId, setTargetStageId] = useState<string | null>(null)

  // Filter out current stage
  const availableStages = stages.filter((s) => s.id !== currentStageId)

  // Handle move
  const handleMove = () => {
    onMove(targetStageId)
    onClose()
  }

  // Reset state when dialog opens
  const handleOpenChange = (open: boolean) => {
    if (open) {
      setTargetStageId(null)
    } else {
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MoveRight className="h-5 w-5" />
            Переместить задачи
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            Выбрано задач: <span className="font-medium text-foreground">{selectedItemsCount}</span>
          </p>

          <div className="space-y-2">
            <label className="text-sm font-medium">Переместить в этап:</label>
            <Select
              value={targetStageId || 'none'}
              onValueChange={(value) => setTargetStageId(value === 'none' ? null : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Выберите этап" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  <span className="text-muted-foreground">Без этапа</span>
                </SelectItem>
                {availableStages.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    {stage.name}
                    <span className="text-muted-foreground ml-2">
                      ({stage.decompositions.length} задач)
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={handleMove}>Переместить</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
