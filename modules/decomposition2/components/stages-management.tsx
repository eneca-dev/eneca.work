"use client";

import type React from "react";
import { useState, useRef, useEffect } from "react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Trash2, Plus, Copy, ClipboardPaste, GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Textarea } from "./ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Input } from "./ui/input";
import { DatePicker } from "./ui/date-picker";
import { useToast } from "../hooks/use-toast";

// Типы данных
type Decomposition = {
  id: string;
  description: string;
  typeOfWork: string;
  difficulty: string;
  responsible: string;
  plannedHours: number;
  progress: number;
  status: string;
  completionDate: string;
};

type Stage = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  decompositions: Decomposition[];
};

// Опции для выпадающих списков
const TYPE_OF_WORK_OPTIONS = ["Аналитика", "Проектирование", "Разработка", "Тестирование", "Документация"];
const DIFFICULTY_OPTIONS = ["Низкая", "Средняя", "Высокая"];
const STATUS_OPTIONS = ["Не начато", "В работе", "Завершено", "Приостановлено"];
const RESPONSIBLE_OPTIONS = ["Иванов И.И.", "Петров П.П.", "Сидоров С.С.", "Козлов К.К.", "Смирнов С.М."];

// Моковые данные
const initialStages: Stage[] = [
  {
    id: "1",
    name: "Подготовительный этап",
    startDate: "2024-01-01",
    endDate: "2024-01-31",
    decompositions: [
      {
        id: "1-1",
        description: "Анализ требований",
        typeOfWork: "Аналитика",
        difficulty: "Средняя",
        responsible: "Иванов И.И.",
        plannedHours: 40,
        progress: 100,
        status: "Завершено",
        completionDate: "2024-01-15",
      },
      {
        id: "1-2",
        description: "Проектирование архитектуры",
        typeOfWork: "Проектирование",
        difficulty: "Высокая",
        responsible: "Петров П.П.",
        plannedHours: 60,
        progress: 80,
        status: "В работе",
        completionDate: "2024-01-25",
      },
    ],
  },
  {
    id: "2",
    name: "Разработка",
    startDate: "2024-02-01",
    endDate: "2024-03-31",
    decompositions: [
      {
        id: "2-1",
        description: "Разработка бэкенда",
        typeOfWork: "Разработка",
        difficulty: "Высокая",
        responsible: "Сидоров С.С.",
        plannedHours: 120,
        progress: 50,
        status: "В работе",
        completionDate: "2024-03-15",
      },
      {
        id: "2-2",
        description: "Разработка фронтенда",
        typeOfWork: "Разработка",
        difficulty: "Средняя",
        responsible: "Козлов К.К.",
        plannedHours: 100,
        progress: 30,
        status: "В работе",
        completionDate: "2024-03-20",
      },
    ],
  },
];

const getDifficultyColor = (difficulty: string) => {
  const colors: Record<string, string> = {
    Низкая: "bg-emerald-100 hover:bg-emerald-200 text-emerald-900",
    Средняя: "bg-amber-100 hover:bg-amber-200 text-amber-900",
    Высокая: "bg-rose-100 hover:bg-rose-200 text-rose-900",
  };
  return colors[difficulty] || "bg-muted/60 hover:bg-muted/80";
};

const getProgressColor = (progress: number) => {
  if (progress === 0) return "bg-gray-100 hover:bg-gray-200 text-gray-900";
  if (progress <= 30) return "bg-red-100 hover:bg-red-200 text-red-900";
  if (progress <= 70) return "bg-yellow-100 hover:bg-yellow-200 text-yellow-900";
  return "bg-green-100 hover:bg-green-200 text-green-900";
};

const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    "Не начато": "bg-slate-100 hover:bg-slate-200 text-slate-900",
    "В работе": "bg-sky-100 hover:bg-sky-200 text-sky-900",
    Завершено: "bg-emerald-100 hover:bg-emerald-200 text-emerald-900",
    Приостановлено: "bg-orange-100 hover:bg-orange-200 text-orange-900",
  };
  return colors[status] || "bg-muted/60 hover:bg-muted/80";
};

function SortableStage({
  stage,
  selectedStages,
  selectedDecompositions,
  toggleStageSelection,
  toggleSelectAllInStage,
  toggleDecompositionSelection,
  deleteStage,
  deleteDecomposition,
  addDecomposition,
  updateStage,
  updateDecomposition,
  onDecompositionDragEnd,
  focusedDecompositionId,
  pendingNewDecompositionId,
  onDecompositionInteract,
}: {
  stage: Stage;
  selectedStages: Set<string>;
  selectedDecompositions: Set<string>;
  toggleStageSelection: (id: string) => void;
  toggleSelectAllInStage: (stageId: string) => void;
  toggleDecompositionSelection: (id: string) => void;
  deleteStage: (id: string) => void;
  deleteDecomposition: (stageId: string, decompId: string) => void;
  addDecomposition: (stageId: string, opts?: { pending?: boolean }) => void;
  updateStage: (stageId: string, updates: Partial<Stage>) => void;
  updateDecomposition: (stageId: string, decompId: string, updates: Partial<Decomposition>) => void;
  onDecompositionDragEnd: (stageId: string, event: DragEndEvent) => void;
  focusedDecompositionId: string | null;
  pendingNewDecompositionId: string | null;
  onDecompositionInteract: (decompId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stage.id });
  const { toast } = useToast();
  const [isCopying, setIsCopying] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const stageNameRef = useRef<HTMLTextAreaElement | null>(null);

  const adjustStageNameHeight = () => {
    const el = stageNameRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  useEffect(() => {
    adjustStageNameHeight();
  }, [stage.name]);

  const stageDecompositionIds = stage.decompositions.map((d) => d.id);
  const isAllSelectedInStage = stageDecompositionIds.length > 0 && stageDecompositionIds.every((id) => selectedDecompositions.has(id));
  const hasAnySelectedInStage = stageDecompositionIds.some((id) => selectedDecompositions.has(id));

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  } as React.CSSProperties;

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const copyStage = async () => {
    setIsCopying(true);
    setTimeout(() => setIsCopying(false), 200);

    try {
      let stageData = `Этап: ${stage.name}\nДата начала: ${stage.startDate}\nДата завершения: ${stage.endDate}\n\n`;
      stageData += "Декомпозиции:\n";
      stageData += "| Описание | Тип работ | Сложность | Ответственный | Часы | Прогресс | Статус | Дата |\n";
      stageData += "|---|---|---|---|---|---|---|---|\n";

      stage.decompositions.forEach((decomp) => {
        stageData += `| ${decomp.description} | ${decomp.typeOfWork} | ${decomp.difficulty} | ${decomp.responsible} | ${decomp.plannedHours} | ${decomp.progress}% | ${decomp.status} | ${decomp.completionDate} |\n`;
      });

      await navigator.clipboard.writeText(stageData);

      toast({
        title: "Успешно",
        description: "Этап скопирован в буфер обмена",
      });
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось скопировать этап",
        variant: "destructive",
      });
    }
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`relative p-3 shadow-sm border-border/40 ${
        selectedStages.has(stage.id) ? "ring-1 ring-primary/20 border-primary/40 bg-muted/40" : ""
      }`}
    >
      <div className="mb-2 flex items-center gap-3">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing opacity-40 hover:opacity-100 transition-opacity"
        >
          <GripVertical className="h-6 w-5 text-muted-foreground" />
        </div>
        <input
          type="checkbox"
          checked={selectedStages.has(stage.id)}
          onChange={() => toggleStageSelection(stage.id)}
          className="h-4 w-4 rounded"
        />
        <div className="flex-1">
          <Textarea
            ref={stageNameRef}
            value={stage.name}
            onChange={(e) => {
              updateStage(stage.id, { name: (e.target as HTMLTextAreaElement).value });
            }}
            onInput={adjustStageNameHeight}
            onFocus={() => setIsEditingName(true)}
            onBlur={() => setIsEditingName(false)}
            placeholder="Новый этап"
            rows={1}
            className={`text-lg font-semibold border-0 outline-none px-3 py-1 rounded-md transition-colors focus:outline-none focus:ring-0 resize-none overflow-hidden min-h-9 ${
              isEditingName
                ? "bg-primary/5 ring-2 ring-primary/40 ring-offset-1 ring-offset-background"
                : "bg-transparent hover:bg-muted/40"
            }`}
          />
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground/70">
          <DatePicker
            value={stage.startDate}
            onChange={(val) => updateStage(stage.id, { startDate: val })}
            triggerClassName="h-6 px-2"
            openOnToday
            plainTrigger
          />
          <span className="text-muted-foreground/40">→</span>
          <DatePicker
            value={stage.endDate}
            onChange={(val) => updateStage(stage.id, { endDate: val })}
            triggerClassName="h-6 px-2"
            openOnToday
            plainTrigger
          />
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={copyStage}
          className={`h-8 px-3 hover:bg-primary/10 transition-all active:scale-95 ${isCopying ? "scale-95" : ""}`}
        >
          <Copy className="h-4 w-4 mr-1.5" />
          Копировать
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => deleteStage(stage.id)}
          className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive transition-all"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {stage.decompositions.length > 0 && (
        <div
          className={`absolute top-2 left-2 transition-opacity ${
            hasAnySelectedInStage ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          <Button
            variant="outline"
            size="sm"
            onClick={() => toggleSelectAllInStage(stage.id)}
            className="h-8 px-3 text-xs"
          >
            {isAllSelectedInStage ? "Снять выбор в этапе" : "Выбрать все в этапе"}
          </Button>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={(event) => onDecompositionDragEnd(stage.id, event)}
      >
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/30">
                <th className="w-8 pb-2 pt-0"></th>
                <th className="w-8 pb-2 pt-0"></th>
                <th className="pb-2 pt-0 px-2 text-left font-medium text-muted-foreground text-xs uppercase tracking-wide">
                  Описание
                </th>
                <th className="pb-2 pt-0 px-2 text-left font-medium text-muted-foreground text-xs uppercase tracking-wide">
                  Тип работ
                </th>
                <th className="pb-2 pt-0 px-2 text-left font-medium text-muted-foreground text-xs uppercase tracking-wide">
                  Сложность
                </th>
                <th className="pb-2 pt-0 px-2 text-left font-medium text-muted-foreground text-xs uppercase tracking-wide">
                  Ответственный
                </th>
                <th className="pb-2 pt-0 px-2 text-left font-medium text-muted-foreground text-xs uppercase tracking-wide">
                  Часы
                </th>
                <th className="pb-2 pt-0 px-2 text-left font-medium text-muted-foreground text-xs uppercase tracking-wide">
                  Прогресс
                </th>
                <th className="pb-2 pt-0 px-2 text-left font-medium text-muted-foreground text-xs uppercase tracking-wide">
                  Статус
                </th>
                <th className="pb-2 pt-0 px-2 text-left font-medium text-muted-foreground text-xs uppercase tracking-wide">
                  Дата
                </th>
                <th className="w-8 pb-2 pt-0"></th>
              </tr>
            </thead>
            <tbody>
              <SortableContext items={stage.decompositions.map((d) => d.id)} strategy={verticalListSortingStrategy}>
                {stage.decompositions.map((decomp) => (
                  <SortableDecompositionRow
                    key={decomp.id}
                    decomposition={decomp}
                    stageId={stage.id}
                    isChecked={selectedStages.has(stage.id) || selectedDecompositions.has(decomp.id)}
                    isHighlighted={selectedStages.has(stage.id) || selectedDecompositions.has(decomp.id)}
                    selectionDisabled={selectedStages.has(stage.id)}
                    onToggleSelection={toggleDecompositionSelection}
                    onDelete={deleteDecomposition}
                    onUpdate={updateDecomposition}
                    autoFocus={focusedDecompositionId === decomp.id}
                    onDateConfirmed={() => addDecomposition(stage.id, { pending: true })}
                    onInteract={onDecompositionInteract}
                    isPendingNew={pendingNewDecompositionId === decomp.id}
                  />
                ))}
              </SortableContext>
            </tbody>
          </table>
        </div>
      </DndContext>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => addDecomposition(stage.id)}
        className="mt-2 h-8 text-xs text-muted-foreground hover:text-foreground"
      >
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Добавить декомпозицию
      </Button>
    </Card>
  );
}

function SortableDecompositionRow({
  decomposition,
  stageId,
  isChecked,
  isHighlighted,
  selectionDisabled,
  onToggleSelection,
  onDelete,
  onUpdate,
  autoFocus,
  onDateConfirmed,
  onInteract,
  isPendingNew,
}: {
  decomposition: Decomposition;
  stageId: string;
  isChecked: boolean;
  isHighlighted: boolean;
  selectionDisabled: boolean;
  onToggleSelection: (id: string) => void;
  onDelete: (stageId: string, decompId: string) => void;
  onUpdate: (stageId: string, decompId: string, updates: Partial<Decomposition>) => void;
  autoFocus: boolean;
  onDateConfirmed: () => void;
  onInteract: (decompId: string) => void;
  isPendingNew: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: decomposition.id,
  });
  const rowRef = useRef<HTMLTableRowElement | null>(null);
  const typeOfWorkTriggerRef = useRef<HTMLButtonElement | null>(null);
  const difficultyTriggerRef = useRef<HTMLButtonElement | null>(null);
  const responsibleTriggerRef = useRef<HTMLButtonElement | null>(null);
  const progressTriggerRef = useRef<HTMLButtonElement | null>(null);
  const statusTriggerRef = useRef<HTMLButtonElement | null>(null);
  const plannedHoursInputRef = useRef<HTMLInputElement | null>(null);
  const completionDateTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [openTypeOfWork, setOpenTypeOfWork] = useState(false);
  const [openDifficulty, setOpenDifficulty] = useState(false);
  const [openResponsible, setOpenResponsible] = useState(false);
  const [openProgress, setOpenProgress] = useState(false);
  const [openStatus, setOpenStatus] = useState(false);
  const lastClosedSelectRef = useRef<string | null>(null);
  const [interacted, setInteracted] = useState(false);
  const descriptionRef = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    const el = descriptionRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [decomposition.description]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  } as React.CSSProperties;

  const focusNextFrom = (currentEl: Element | null | undefined) => {
    if (!rowRef.current || !currentEl) return;
    const focusableElements = rowRef.current.querySelectorAll(
      'textarea, input[type="text"], input[type="number"], input[type="date"], button[role="combobox"]'
    );
    const currentIndex = Array.from(focusableElements).indexOf(currentEl as Element);
    const nextElement = focusableElements[currentIndex + 1] as HTMLElement | undefined;
    if (nextElement) {
      nextElement.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !(e as React.KeyboardEvent).shiftKey && !(e as React.KeyboardEvent).ctrlKey) {
      e.preventDefault();
      const rawTarget = e.target as HTMLElement | null;
      const targetEl = rawTarget?.closest(
        'button[role="combobox"], textarea, input[type="text"], input[type="number"], input[type="date"]'
      ) as HTMLElement | null;

      if (targetEl?.getAttribute("role") === "combobox") {
        targetEl.click();
        return;
      }
      focusNextFrom(targetEl as Element);
    }
  };

  const markInteracted = () => {
    if (!interacted) {
      setInteracted(true);
      onInteract(decomposition.id);
    }
  };

  return (
    <tr
      ref={(node) => {
        setNodeRef(node as unknown as HTMLElement);
        rowRef.current = node as HTMLTableRowElement;
      }}
      style={style}
      className={`group border-b border-border/20 last:border-0 hover:bg-muted/30 transition-colors ${
        isHighlighted ? "bg-primary/5 hover:bg-primary/10" : ""
      }`}
      onFocus={() => {
        markInteracted();
      }}
      onBlur={() => {
        if (!isPendingNew) return;
        setTimeout(() => {
          const stillInside = rowRef.current?.contains(document.activeElement);
          if (!stillInside && !interacted) {
            onDelete(stageId, decomposition.id);
          }
        }, 80);
      }}
    >
      <td className="py-1.5 px-2">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-40 hover:opacity-100 transition-opacity"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
      </td>
      <td className="py-1.5 px-2">
        <input
          type="checkbox"
          checked={isChecked}
          onChange={() => !selectionDisabled && onToggleSelection(decomposition.id)}
          className="h-4 w-4 rounded"
          disabled={selectionDisabled}
        />
      </td>
      <td className="py-1.5 px-2">
        <Textarea
          ref={descriptionRef}
          value={decomposition.description}
          onChange={(e) => {
            onUpdate(stageId, decomposition.id, { description: (e.target as HTMLTextAreaElement).value });
            markInteracted();
          }}
          onKeyDown={handleKeyDown}
          className="min-h-[24px] h-auto min-w-[180px] border-0 bg-muted/60 hover:bg-muted/80 focus:bg-muted focus:placeholder-transparent shadow-none rounded-lg px-3 py-1 text-xs resize-none overflow-hidden"
          rows={1}
          autoFocus={autoFocus}
          placeholder="Новая декомпозиция"
          onInput={(e) => {
            const target = (e.target as HTMLTextAreaElement);
            target.style.height = "auto";
            target.style.height = target.scrollHeight + "px";
          }}
        />
      </td>
      <td className="py-1.5 px-2">
        <Select
          open={openTypeOfWork}
          onOpenChange={(v) => {
            setOpenTypeOfWork(v);
            if (!v) lastClosedSelectRef.current = "typeOfWork";
          }}
          value={decomposition.typeOfWork}
          onValueChange={(value) => {
            onUpdate(stageId, decomposition.id, { typeOfWork: value });
            markInteracted();
            setOpenTypeOfWork(false);
            setTimeout(() => {
              focusNextFrom(typeOfWorkTriggerRef.current);
            }, 0);
          }}
        >
          <SelectTrigger
            className={`h-6 min-h-0 py-0 px-2 leading-none text-xs [&_span]:leading-none border-0 shadow-none rounded-full bg-muted/60 hover:bg-muted/80 w-[120px] ${openTypeOfWork ? "ring-1 ring-ring/40 ring-offset-2" : ""}`}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (lastClosedSelectRef.current === "typeOfWork") {
                lastClosedSelectRef.current = null;
                return;
              }
              setOpenTypeOfWork(true);
            }}
            ref={typeOfWorkTriggerRef as unknown as React.Ref<HTMLButtonElement>}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent
            onPointerDownOutside={() => {
              try {
                typeOfWorkTriggerRef.current?.blur();
              } catch {}
            }}
            onCloseAutoFocus={(e) => {
              e.preventDefault();
              try {
                typeOfWorkTriggerRef.current?.blur();
              } catch {}
            }}
          >
            {TYPE_OF_WORK_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="py-1.5 px-2">
        <Select
          open={openDifficulty}
          onOpenChange={(v) => {
            setOpenDifficulty(v);
            if (!v) lastClosedSelectRef.current = "difficulty";
          }}
          value={decomposition.difficulty}
          onValueChange={(value) => {
            onUpdate(stageId, decomposition.id, { difficulty: value });
            markInteracted();
            setOpenDifficulty(false);
            setTimeout(() => {
              focusNextFrom(difficultyTriggerRef.current);
            }, 0);
          }}
        >
          <SelectTrigger
            className={`h-6 min-h-0 py-0 px-2 leading-none text-xs [&_span]:leading-none border-0 shadow-none rounded-full w-[100px] ${getDifficultyColor(decomposition.difficulty)} ${openDifficulty ? "ring-1 ring-ring/40 ring-offset-2" : ""}`}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (lastClosedSelectRef.current === "difficulty") {
                lastClosedSelectRef.current = null;
                return;
              }
              setOpenDifficulty(true);
            }}
            ref={difficultyTriggerRef as unknown as React.Ref<HTMLButtonElement>}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent
            onPointerDownOutside={() => {
              try {
                difficultyTriggerRef.current?.blur();
              } catch {}
            }}
            onCloseAutoFocus={(e) => {
              e.preventDefault();
              try {
                difficultyTriggerRef.current?.blur();
              } catch {}
            }}
          >
            {DIFFICULTY_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="py-1.5 px-2">
        <Select
          open={openResponsible}
          onOpenChange={(v) => {
            setOpenResponsible(v);
            if (!v) lastClosedSelectRef.current = "responsible";
          }}
          value={decomposition.responsible}
          onValueChange={(value) => {
            onUpdate(stageId, decomposition.id, { responsible: value });
            markInteracted();
            setOpenResponsible(false);
            setTimeout(() => {
              if (plannedHoursInputRef.current) {
                plannedHoursInputRef.current.focus();
                plannedHoursInputRef.current.select?.();
              } else {
                focusNextFrom(responsibleTriggerRef.current);
              }
            }, 50);
          }}
        >
          <SelectTrigger
            className={`h-6 min-h-0 py-0 px-2 leading-none text-xs [&_span]:leading-none border-0 shadow-none rounded-full bg-muted/60 hover:bg-muted/80 w-[130px] ${openResponsible ? "ring-1 ring-ring/40 ring-offset-2" : ""}`}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (lastClosedSelectRef.current === "responsible") {
                lastClosedSelectRef.current = null;
                return;
              }
              setOpenResponsible(true);
            }}
            ref={responsibleTriggerRef as unknown as React.Ref<HTMLButtonElement>}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent
            onPointerDownOutside={() => {
              try {
                responsibleTriggerRef.current?.blur();
              } catch {}
            }}
            onCloseAutoFocus={(e) => {
              e.preventDefault();
              try {
                responsibleTriggerRef.current?.blur();
              } catch {}
            }}
          >
            {RESPONSIBLE_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="py-1.5 px-2">
        <Input
          type="number"
          value={decomposition.plannedHours}
          onChange={(e) => {
            onUpdate(stageId, decomposition.id, { plannedHours: Number.parseInt((e.target as HTMLInputElement).value) || 0 });
            markInteracted();
          }}
          onKeyDown={handleKeyDown}
          className="h-6 w-[80px] border-0 bg-muted/60 hover:bg-muted/80 focus:bg-muted shadow-none rounded-full px-3 text-xs"
          ref={plannedHoursInputRef}
        />
      </td>
      <td className="py-1.5 px-2">
        <Select
          open={openProgress}
          onOpenChange={(v) => {
            setOpenProgress(v);
            if (!v) lastClosedSelectRef.current = "progress";
          }}
          value={decomposition.progress.toString()}
          onValueChange={(value) => {
            onUpdate(stageId, decomposition.id, { progress: Number.parseInt(value) });
            markInteracted();
            setOpenProgress(false);
            setTimeout(() => {
              focusNextFrom(progressTriggerRef.current);
            }, 0);
          }}
        >
          <SelectTrigger
            className={`h-6 min-h-0 py-0 px-2 leading-none text-xs [&_span]:leading-none border-0 shadow-none rounded-full w-[70px] ${getProgressColor(decomposition.progress)} ${openProgress ? "ring-1 ring-ring/40 ring-offset-2" : ""}`}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (lastClosedSelectRef.current === "progress") {
                lastClosedSelectRef.current = null;
                return;
              }
              setOpenProgress(true);
            }}
            ref={progressTriggerRef as unknown as React.Ref<HTMLButtonElement>}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent
            onPointerDownOutside={() => {
              try {
                progressTriggerRef.current?.blur();
              } catch {}
            }}
            onCloseAutoFocus={(e) => {
              e.preventDefault();
              try {
                progressTriggerRef.current?.blur();
              } catch {}
            }}
          >
            {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((value) => (
              <SelectItem key={value} value={value.toString()}>
                {value}%
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="py-1.5 px-2">
        <Select
          open={openStatus}
          onOpenChange={(v) => {
            setOpenStatus(v);
            if (!v) lastClosedSelectRef.current = "status";
          }}
          value={decomposition.status}
          onValueChange={(value) => {
            onUpdate(stageId, decomposition.id, { status: value });
            markInteracted();
            setOpenStatus(false);
            setTimeout(() => {
              if (completionDateTriggerRef.current) {
                completionDateTriggerRef.current.focus();
              } else {
                focusNextFrom(statusTriggerRef.current);
              }
            }, 50);
          }}
        >
          <SelectTrigger
            className={`h-6 min-h-0 py-0 px-2 leading-none text-xs [&_span]:leading-none border-0 shadow-none rounded-full w-[115px] ${getStatusColor(decomposition.status)} ${openStatus ? "ring-1 ring-ring/40 ring-offset-2" : ""}`}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (lastClosedSelectRef.current === "status") {
                lastClosedSelectRef.current = null;
                return;
              }
              setOpenStatus(true);
            }}
            ref={statusTriggerRef as unknown as React.Ref<HTMLButtonElement>}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent
            onPointerDownOutside={() => {
              try {
                statusTriggerRef.current?.blur();
              } catch {}
            }}
            onCloseAutoFocus={(e) => {
              e.preventDefault();
              try {
                statusTriggerRef.current?.blur();
              } catch {}
            }}
          >
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="py-1.5 px-2">
        <DatePicker
          value={decomposition.completionDate}
          onChange={(val) => {
            onUpdate(stageId, decomposition.id, { completionDate: val });
            markInteracted();
            setTimeout(() => {
              onDateConfirmed();
            }, 30);
          }}
          triggerClassName="w-[125px]"
          onKeyDown={handleKeyDown}
          triggerRef={completionDateTriggerRef as unknown as React.Ref<HTMLButtonElement>}
        />
      </td>
      <td className="py-1.5 px-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(stageId, decomposition.id)}
          className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all active:scale-95"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </td>
    </tr>
  );
}

export default function StagesManagement() {
  const [stages, setStages] = useState<Stage[]>(initialStages);
  const [selectedStages, setSelectedStages] = useState<Set<string>>(new Set());
  const [selectedDecompositions, setSelectedDecompositions] = useState<Set<string>>(new Set());
  const [showPasteDialog, setShowPasteDialog] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const { toast } = useToast();
  const [isCopying, setIsCopying] = useState(false);
  const [focusedDecompositionId, setFocusedDecompositionId] = useState<string | null>(null);
  const [pendingNewDecomposition, setPendingNewDecomposition] = useState<{ stageId: string; decompId: string } | null>(null);
  const [showMoveDialog, setShowMoveDialog] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const addStage = () => {
    const newStage: Stage = {
      id: Date.now().toString(),
      name: "Новый этап",
      startDate: new Date().toISOString().split("T")[0],
      endDate: new Date().toISOString().split("T")[0],
      decompositions: [],
    };
    setStages([...stages, newStage]);
  };

  const deleteStage = (stageId: string) => {
    setStages(stages.filter((s) => s.id !== stageId));
    setSelectedStages((prev) => {
      const newSet = new Set(prev);
      newSet.delete(stageId);
      return newSet;
    });
  };

  const addDecomposition = (stageId: string, opts?: { pending?: boolean }) => {
    const stageRef = stages.find((s) => s.id === stageId);
    if (opts?.pending && stageRef) {
      const hasEmpty = stageRef.decompositions.some((d) => (d.description ?? "").trim() === "");
      if (hasEmpty) {
        return;
      }
    }

    const newId = `${stageId}-${Date.now()}`;
    const newDecomposition: Decomposition = {
      id: newId,
      description: "",
      typeOfWork: "Разработка",
      difficulty: "Средняя",
      responsible: "",
      plannedHours: 0,
      progress: 0,
      status: "Не начато",
      completionDate: new Date().toISOString().split("T")[0],
    };

    setStages(
      stages.map((stage) =>
        stage.id === stageId ? { ...stage, decompositions: [...stage.decompositions, newDecomposition] } : stage
      )
    );
    setFocusedDecompositionId(newId);
    if (opts?.pending) {
      setPendingNewDecomposition({ stageId, decompId: newId });
    } else {
      setPendingNewDecomposition(null);
    }
  };

  const deleteDecomposition = (stageId: string, decompId: string) => {
    setStages(
      stages.map((stage) =>
        stage.id === stageId
          ? { ...stage, decompositions: stage.decompositions.filter((d) => d.id !== decompId) }
          : stage
      )
    );
    setSelectedDecompositions((prev) => {
      const newSet = new Set(prev);
      newSet.delete(decompId);
      return newSet;
    });
    if (pendingNewDecomposition && pendingNewDecomposition.decompId === decompId) {
      setPendingNewDecomposition(null);
    }
  };

  const toggleStageSelection = (stageId: string) => {
    setSelectedStages((prev) => {
      const next = new Set(prev);
      if (next.has(stageId)) next.delete(stageId);
      else next.add(stageId);
      return next;
    });
  };

  const toggleDecompositionSelection = (decompId: string) => {
    setSelectedDecompositions((prev) => {
      const next = new Set(prev);
      if (next.has(decompId)) next.delete(decompId);
      else next.add(decompId);
      return next;
    });
  };

  const updateStage = (stageId: string, updates: Partial<Stage>) => {
    setStages(stages.map((s) => (s.id === stageId ? { ...s, ...updates } : s)));
  };

  const updateDecomposition = (stageId: string, decompId: string, updates: Partial<Decomposition>) => {
    setStages(
      stages.map((stage) =>
        stage.id === stageId
          ? {
              ...stage,
              decompositions: stage.decompositions.map((d) => (d.id === decompId ? { ...d, ...updates } : d)),
            }
          : stage
      )
    );
  };

  const handleStageDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setStages((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleDecompositionDragEnd = (stageId: string, event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setStages((stagesState) =>
        stagesState.map((stage) => {
          if (stage.id === stageId) {
            const oldIndex = stage.decompositions.findIndex((d) => d.id === active.id);
            const newIndex = stage.decompositions.findIndex((d) => d.id === over.id);
            return {
              ...stage,
              decompositions: arrayMove(stage.decompositions, oldIndex, newIndex),
            };
          }
          return stage;
        })
      );
    }
  };

  const handleDecompositionInteract = (decompId: string) => {
    if (pendingNewDecomposition && pendingNewDecomposition.decompId === decompId) {
      setPendingNewDecomposition(null);
    }
  };

  const handlePaste = () => {
    if (!pasteText.trim()) {
      toast({
        title: "Ошибка",
        description: "Пожалуйста, вставьте данные для импорта",
        variant: "destructive",
      });
      return;
    }

    try {
      const lines = pasteText.trim().split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);

      const today = new Date().toISOString().split("T")[0];
      const isSeparatorRow = (parts: string[]) => parts.length > 0 && parts.every((p) => /^-+$/.test(p));
      const isHeader = (first: string) => /название\s+этапа/i.test(first);
      const normalizeDate = (val?: string) => {
        const raw = (val ?? "").trim();
        if (!raw) return today;
        const m = raw.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})$/);
        if (m) {
          const dd = m[1].padStart(2, "0");
          const mm = m[2].padStart(2, "0");
          const yyyy = m[3].length === 2 ? `20${m[3]}` : m[3];
          return `${yyyy}-${mm}-${dd}`;
        }
        const d = new Date(raw);
        return Number.isNaN(d.getTime()) ? today : d.toISOString().split("T")[0];
      };
      const parseProgress = (val?: string) => {
        const raw = (val ?? "").toString().trim();
        if (!raw) return 0;
        const m = raw.match(/(\d{1,3})/);
        const n = m ? Number.parseInt(m[1], 10) : Number.NaN;
        if (Number.isNaN(n)) return 0;
        return Math.max(0, Math.min(100, n));
      };

      const stageRows: Array<{ name: string; startDate?: string; endDate?: string }> = [];
      const stageMap = new Map<string, { stage: Partial<Stage>; decompositions: Decomposition[] }>();

      const splitRow = (line: string): string[] => {
        if (line.includes("|")) {
          const arr = line.split("|").map((p) => p.trim());
          if (arr.length && arr[0] === "") arr.shift();
          if (arr.length && arr[arr.length - 1] === "") arr.pop();
          return arr;
        }
        if (line.includes("\t")) {
          return line.split("\t").map((p) => p.trim());
        }
        return line.split(";").map((p) => p.trim());
      };

      for (const line of lines) {
        const parts = splitRow(line);

        if (parts.length === 0) continue;
        if (isSeparatorRow(parts)) continue;

        if (isHeader(parts[0])) continue;

        if (parts.length >= 9) {
          const [stageName, description, typeOfWork, difficulty, responsible, plannedHours, progressStr, status, completionDate] = parts;

          if (!stageMap.has(stageName)) {
            stageMap.set(stageName, { stage: { name: stageName }, decompositions: [] });
          }

          const decomposition: Decomposition = {
            id: `${Date.now()}-${Math.random()}`,
            description,
            typeOfWork,
            difficulty,
            responsible,
            plannedHours: Number.parseInt(plannedHours ?? "") || 0,
            progress: parseProgress(progressStr),
            status,
            completionDate: normalizeDate(completionDate),
          };

          stageMap.get(stageName)!.decompositions.push(decomposition);
          continue;
        } else if (parts.length >= 8) {
          const [stageName, description, typeOfWork, difficulty, responsible, plannedHours, status, completionDate] = parts;

          if (!stageMap.has(stageName)) {
            stageMap.set(stageName, { stage: { name: stageName }, decompositions: [] });
          }

          const decomposition: Decomposition = {
            id: `${Date.now()}-${Math.random()}`,
            description,
            typeOfWork,
            difficulty,
            responsible,
            plannedHours: Number.parseInt(plannedHours ?? "") || 0,
            progress: 0,
            status,
            completionDate: normalizeDate(completionDate),
          };

          stageMap.get(stageName)!.decompositions.push(decomposition);
          continue;
        }

        if (parts.length >= 3) {
          const [stageName, startDate, endDate] = parts;
          stageRows.push({ name: stageName, startDate: normalizeDate(startDate), endDate: normalizeDate(endDate) });
          continue;
        }
      }

      const newStages = [...stages];
      let createdStagesCount = 0;
      let importedDecompsCount = 0;

      for (const row of stageRows) {
        const existing = newStages.find((s) => s.name === row.name);
        if (existing) {
          if (row.startDate) existing.startDate = row.startDate;
          if (row.endDate) existing.endDate = row.endDate;
        } else {
          newStages.push({
            id: Date.now().toString() + Math.random(),
            name: row.name,
            startDate: row.startDate ?? today,
            endDate: row.endDate ?? today,
            decompositions: [],
          });
          createdStagesCount += 1;
        }
      }

      stageMap.forEach((data, stageName) => {
        const existingStage = newStages.find((s) => s.name === stageName);
        if (existingStage) {
          existingStage.decompositions.push(...data.decompositions);
        } else {
          newStages.push({
            id: Date.now().toString() + Math.random(),
            name: stageName,
            startDate: today,
            endDate: today,
            decompositions: data.decompositions,
          });
          createdStagesCount += 1;
        }
        importedDecompsCount += data.decompositions.length;
      });

      setStages(newStages);
      setPasteText("");
      setShowPasteDialog(false);

      const descParts = [] as string[];
      if (importedDecompsCount > 0) descParts.push(`декомпозиций: ${importedDecompsCount}`);
      if (createdStagesCount > 0 || stageRows.length > 0) descParts.push(`этапов создано/обновлено: ${createdStagesCount}`);

      toast({
        title: "Успешно",
        description: descParts.length > 0 ? `Импортировано ${descParts.join(", ")}` : "Данные обработаны",
      });
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось импортировать данные. Проверьте формат.",
        variant: "destructive",
      });
    }
  };

  const handleCopy = async () => {
    setIsCopying(true);
    setTimeout(() => setIsCopying(false), 200);

    try {
      let decompositionTable =
        "| Название этапа | Описание декомпозиции (название) | Тип работ | Сложность | Отвественный | Плановые часы | Статус | Дата (декомпозиции) |\n";
      decompositionTable += "|---|---|---|---|---|---|---|---|\n";

      stages.forEach((stage) => {
        stage.decompositions.forEach((decomp) => {
          decompositionTable += `| ${stage.name} | ${decomp.description} | ${decomp.typeOfWork} | ${decomp.difficulty} | ${decomp.responsible} | ${decomp.plannedHours} | ${decomp.status} | ${decomp.completionDate} |\n`;
        });
      });

      let stageTable = "\n\n| Название этапа | Дата начала этапа | Дата завершения этапа |\n";
      stageTable += "|---|---|---|\n";

      stages.forEach((stage) => {
        stageTable += `| ${stage.name} | ${stage.startDate} | ${stage.endDate} |\n`;
      });

      const fullText = decompositionTable + stageTable;

      await navigator.clipboard.writeText(fullText);

      toast({
        title: "Успешно",
        description: "Данные скопированы в буфер обмена",
      });
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось скопировать данные",
        variant: "destructive",
      });
    }
  };

  const bulkDeleteStages = () => {
    if (selectedStages.size === 0) {
      toast({
        title: "Ошибка",
        description: "Не выбраны этапы для удаления",
        variant: "destructive",
      });
      return;
    }

    setStages(stages.filter((s) => !selectedStages.has(s.id)));
    setSelectedStages(new Set());

    toast({
      title: "Успешно",
      description: `Удалено этапов: ${selectedStages.size}`,
    });
  };

  const bulkDeleteDecompositions = () => {
    if (selectedDecompositions.size === 0) {
      toast({ title: "Ошибка", description: "Не выбраны декомпозиции для удаления", variant: "destructive" });
      return;
    }

    const count = selectedDecompositions.size;

    setStages(
      stages.map((stage) => ({
        ...stage,
        decompositions: stage.decompositions.filter((d) => !selectedDecompositions.has(d.id)),
      }))
    );
    setSelectedDecompositions(new Set());

    toast({ title: "Успешно", description: `Удалено декомпозиций: ${count}` });
  };

  const selectAllStages = () => {
    if (selectedStages.size === stages.length) {
      setSelectedStages(new Set());
    } else {
      setSelectedStages(new Set(stages.map((s) => s.id)));
    }
  };

  const selectAllDecompositions = () => {
    const allDecompIds = stages.flatMap((s) => s.decompositions.map((d) => d.id));

    if (selectedDecompositions.size === allDecompIds.length) {
      setSelectedDecompositions(new Set());
    } else {
      setSelectedDecompositions(new Set(allDecompIds));
    }
  };

  const toggleSelectAllInStage = (stageId: string) => {
    const stage = stages.find((s) => s.id === stageId);
    if (!stage) return;
    const ids = stage.decompositions.map((d) => d.id);
    const allSelected = ids.length > 0 && ids.every((id) => selectedDecompositions.has(id));
    setSelectedDecompositions((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        ids.forEach((id) => next.delete(id));
      } else {
        ids.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const moveSelectedDecompositionsToStage = (targetStageId: string) => {
    if (!targetStageId) return;
    if (selectedDecompositions.size === 0) {
      toast({ title: "Ошибка", description: "Не выбраны декомпозиции", variant: "destructive" });
      return;
    }
    setStages((prev) => {
      const toMove = new Map<string, Decomposition>();
      prev.forEach((stage) => {
        stage.decompositions.forEach((d) => {
          if (selectedDecompositions.has(d.id)) toMove.set(d.id, d);
        });
      });
      const next = prev.map((stage) => {
        if (stage.id === targetStageId) {
          return { ...stage, decompositions: [...stage.decompositions, ...Array.from(toMove.values())] };
        }
        return { ...stage, decompositions: stage.decompositions.filter((d) => !toMove.has(d.id)) };
      });
      return next;
    });
    setSelectedDecompositions(new Set());
    toast({ title: "Успешно", description: "Декомпозиции перемещены" });
  };

  const duplicateSelectedDecompositions = () => {
    if (selectedDecompositions.size === 0) {
      toast({ title: "Ошибка", description: "Не выбраны декомпозиции", variant: "destructive" });
      return;
    }
    setStages((prev) =>
      prev.map((stage) => {
        const toDuplicate = stage.decompositions.filter((d) => selectedDecompositions.has(d.id));
        if (toDuplicate.length === 0) return stage;
        const clones = toDuplicate.map((d) => ({ ...d, id: `${stage.id}-${Date.now()}-${Math.random()}` }));
        return { ...stage, decompositions: [...stage.decompositions, ...clones] };
      })
    );
    setSelectedDecompositions(new Set());
    toast({ title: "Успешно", description: "Декомпозиции продублированы" });
  };

  const eligibleTargetStages = stages.filter((stage) =>
    stage.decompositions.every((d) => !selectedDecompositions.has(d.id))
  );

  const copySelectedStagesToClipboard = async () => {
    if (selectedStages.size === 0) {
      toast({ title: "Ошибка", description: "Не выбраны этапы", variant: "destructive" });
      return;
    }
    try {
      let text = "";
      stages.forEach((stage) => {
        if (!selectedStages.has(stage.id)) return;
        text += `Этап: ${stage.name}\nДата начала: ${stage.startDate}\nДата завершения: ${stage.endDate}\n\n`;
        text += "Декомпозиции:\n";
        text += "| Описание | Тип работ | Сложность | Ответственный | Часы | Прогресс | Статус | Дата |\n";
        text += "|---|---|---|---|---|---|---|---|\n";
        stage.decompositions.forEach((d) => {
          text += `| ${d.description} | ${d.typeOfWork} | ${d.difficulty} | ${d.responsible} | ${d.plannedHours} | ${d.progress}% | ${d.status} | ${d.completionDate} |\n`;
        });
        text += "\n\n";
      });
      await navigator.clipboard.writeText(text);
      toast({ title: "Успешно", description: "Этапы скопированы в буфер обмена" });
    } catch (e) {
      toast({ title: "Ошибка", description: "Не удалось скопировать", variant: "destructive" });
    }
  };

  const duplicateSelectedStages = () => {
    if (selectedStages.size === 0) {
      toast({ title: "Ошибка", description: "Не выбраны этапы", variant: "destructive" });
      return;
    }
    setStages((prev) => {
      const clones: Stage[] = [];
      prev.forEach((stage) => {
        if (!selectedStages.has(stage.id)) return;
        const newStageId = `${Date.now()}-${Math.random()}`;
        const newStage: Stage = {
          id: newStageId,
          name: `${stage.name} (Копия)`,
          startDate: stage.startDate,
          endDate: stage.endDate,
          decompositions: stage.decompositions.map((d) => ({
            ...d,
            id: `${newStageId}-${Date.now()}-${Math.random()}`,
          })),
        };
        clones.push(newStage);
      });
      return [...prev, ...clones];
    });
    setSelectedStages(new Set());
    toast({ title: "Успешно", description: "Этапы продублированы" });
  };

  return (
    <div className="min-h-[60vh] bg-background p-4">
      <div className="mx-auto max-w-7xl">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-foreground">Управление этапами</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowPasteDialog(true)} className="h-9">
              <ClipboardPaste className="mr-2 h-4 w-4" />
              Вставить
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className={`h-9 bg-transparent transition-transform active:scale-95 ${isCopying ? "scale-95" : ""}`}
            >
              <Copy className="mr-2 h-4 w-4" />
              Копировать
            </Button>
            <Button onClick={addStage} size="sm" className="h-9">
              <Plus className="mr-2 h-4 w-4" />
              Добавить этап
            </Button>
          </div>
        </div>

        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
          <Card
            className={`pointer-events-auto p-3 shadow-lg border-border/60 transition-all duration-200 ${
              selectedDecompositions.size > 0 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
            }`}
            aria-hidden={!(selectedDecompositions.size > 0)}
          >
            <div className="flex items-center gap-4">
              {selectedDecompositions.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Декомпозиции:</span>
                  <span className="text-sm font-medium">{selectedDecompositions.size}</span>
                  <Button variant="outline" size="sm" onClick={selectAllDecompositions} className="h-8 text-xs">
                    {selectedDecompositions.size === stages.flatMap((s) => s.decompositions).length ? "Снять выбор" : "Выбрать все"}
                  </Button>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      className="h-8 text-xs"
                      disabled={selectedDecompositions.size === 0}
                      onClick={() => setShowMoveDialog(true)}
                    >
                      Переместить
                    </Button>
                    <Button variant="secondary" size="sm" className="h-8 text-xs" onClick={copySelectedStagesToClipboard}>
                      <Copy className="mr-1.5 h-3.5 w-3.5" />Копировать
                    </Button>
                    <Button size="sm" className="h-8 text-xs" onClick={duplicateSelectedDecompositions}>
                      <Plus className="mr-1.5 h-3.5 w-3.5" />Дублировать
                    </Button>
                    <Button variant="destructive" size="sm" className="h-8 text-xs" onClick={bulkDeleteDecompositions}>
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />Удалить
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>

        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
          <Card
            className={`pointer-events-auto p-3 shadow-lg border-border/60 transition-all duration-200 ${
              selectedStages.size > 0 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
            }`}
            aria-hidden={!(selectedStages.size > 0)}
          >
            <div className="flex items-center gap-4">
              {selectedStages.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Этапы:</span>
                  <span className="text-sm font-medium">{selectedStages.size}</span>
                  <Button variant="outline" size="sm" onClick={selectAllStages} className="h-8 text-xs">
                    {selectedStages.size === stages.length ? "Снять выбор" : "Выбрать все этапы"}
                  </Button>
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" size="sm" className="h-8 text-xs" onClick={copySelectedStagesToClipboard}>
                      <Copy className="mr-1.5 h-3.5 w-3.5" />Копировать
                    </Button>
                    <Button size="sm" className="h-8 text-xs" onClick={duplicateSelectedStages}>
                      <Plus className="mr-1.5 h-3.5 w-3.5" />Дублировать
                    </Button>
                    <Button variant="destructive" size="sm" className="h-8 text-xs" onClick={bulkDeleteStages}>
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />Удалить
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleStageDragEnd}>
          <SortableContext items={stages.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {stages.map((stage) => (
                <SortableStage
                  key={stage.id}
                  stage={stage}
                  selectedStages={selectedStages}
                  selectedDecompositions={selectedDecompositions}
                  toggleStageSelection={toggleStageSelection}
                  toggleSelectAllInStage={toggleSelectAllInStage}
                  toggleDecompositionSelection={toggleDecompositionSelection}
                  deleteStage={deleteStage}
                  deleteDecomposition={deleteDecomposition}
                  addDecomposition={addDecomposition}
                  updateStage={updateStage}
                  updateDecomposition={updateDecomposition}
                  onDecompositionDragEnd={handleDecompositionDragEnd}
                  focusedDecompositionId={focusedDecompositionId}
                  pendingNewDecompositionId={
                    pendingNewDecomposition && pendingNewDecomposition.stageId === stage.id
                      ? pendingNewDecomposition.decompId
                      : null
                  }
                  onDecompositionInteract={handleDecompositionInteract}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <Dialog open={showPasteDialog} onOpenChange={setShowPasteDialog}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Вставить данные</DialogTitle>
              <DialogDescription className="text-sm">
                Вставьте табличные данные в формате: Название этапа | Описание | Тип работ | Сложность | Ответственный |
                Плановые часы | Прогресс | Статус | Дата
              </DialogDescription>
            </DialogHeader>
            <Textarea
              value={pasteText}
              onChange={(e) => setPasteText((e.target as HTMLTextAreaElement).value)}
              placeholder="Вставьте данные здесь..."
              className="min-h-[300px] font-sans text-sm border border-border/60"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowPasteDialog(false)}>
                Отмена
              </Button>
              <Button onClick={handlePaste}>Импортировать</Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showMoveDialog} onOpenChange={setShowMoveDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Переместить в этап</DialogTitle>
              <DialogDescription className="text-sm">
                Выберите этап, в который перенести выбранные декомпозиции
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto">
              {eligibleTargetStages.length > 0 ? (
                eligibleTargetStages.map((s) => (
                  <Button
                    key={s.id}
                    variant="outline"
                    className="justify-start"
                    onClick={() => {
                      moveSelectedDecompositionsToStage(s.id);
                      setShowMoveDialog(false);
                    }}
                  >
                    {s.name}
                  </Button>
                ))
              ) : (
                <div className="text-sm text-muted-foreground">Нет доступных этапов</div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowMoveDialog(false)}>
                Отмена
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}


