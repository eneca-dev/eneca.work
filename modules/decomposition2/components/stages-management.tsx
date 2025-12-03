"use client";

import type React from "react";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/utils/supabase/client";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Plus, Copy, ClipboardPaste, GripVertical, Loader2, ChevronDown, ChevronRight, Clock, Calendar, FolderOpen, Save, ChevronsDown, ChevronsUp, X } from "lucide-react";
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Input } from "./ui/input";
import { DatePicker } from "./ui/date-picker";
import { DateRangePicker, type DateRange } from "@/modules/projects/components/DateRangePicker";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "../hooks/use-toast";
import { DecompositionStagesChart } from "@/modules/projects/components/DecompositionStagesChart";
import { TemplatesDialog, SaveTemplateDialog, applyTemplate, saveTemplate, type TemplateStage } from "@/modules/dec-templates";
import { usePermissionsStore } from "@/modules/permissions/store/usePermissionsStore";
import { useUserStore } from "@/stores/useUserStore";

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
  completionDate: string | null;
};

type Stage = {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  description: string | null;
  statusId: string | null;
  responsibles: string[];
  decompositions: Decomposition[];
};

// Дополнительные типы из БД
type WorkCategory = { work_category_id: string; work_category_name: string };
type DifficultyLevel = { difficulty_id: string; difficulty_abbr: string; difficulty_definition: string };
type SectionStatus = { id: string; name: string; color: string; description: string | null };
type Profile = { user_id: string; first_name: string; last_name: string; email: string };
type Employee = {
  user_id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  position_name: string | null;
  avatar_url: string | null;
  team_name: string | null;
  department_name: string | null;
  employment_rate: number | null;
};

// Пропсы
type StagesManagementProps = {
  sectionId: string;
  onOpenLog?: (itemId: string) => void;
};

// Вспомогательные функции для работы с датами
function parseISODateString(iso: string | null): Date | null {
  if (!iso) return null;
  const date = new Date(iso);
  return isNaN(date.getTime()) ? null : date;
}

function formatISODateString(date: Date | null): string | null {
  if (!date) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const getDifficultyColor = (difficulty: string) => {
  const colors: Record<string, string> = {
    Низкая: "bg-emerald-100 hover:bg-emerald-200 text-emerald-900",
    Средняя: "bg-amber-100 hover:bg-amber-200 text-amber-900",
    Высокая: "bg-rose-100 hover:bg-rose-200 text-rose-900",
  };
  return colors[difficulty] || "bg-muted/60 hover:bg-muted/80";
};

const getProgressColor = (progress: number) => {
  if (progress === 0)
    return "bg-gray-100 hover:bg-gray-200 text-gray-900 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-100";
  if (progress <= 30)
    return "bg-red-100 hover:bg-red-200 text-red-900 dark:bg-red-900/30 dark:hover:bg-red-900/40 dark:text-red-200";
  if (progress <= 70)
    return "bg-yellow-100 hover:bg-yellow-200 text-yellow-900 dark:bg-yellow-900/30 dark:hover:bg-yellow-900/40 dark:text-yellow-200";
  return "bg-green-100 hover:bg-green-200 text-green-900 dark:bg-green-900/30 dark:hover:bg-green-900/40 dark:text-green-200";
  if (progress === 0)
    return "bg-gray-100 hover:bg-gray-200 text-gray-900 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-100";
  if (progress <= 30)
    return "bg-red-100 hover:bg-red-200 text-red-900 dark:bg-red-900/30 dark:hover:bg-red-900/40 dark:text-red-200";
  if (progress <= 70)
    return "bg-yellow-100 hover:bg-yellow-200 text-yellow-900 dark:bg-yellow-900/30 dark:hover:bg-yellow-900/40 dark:text-yellow-200";
  return "bg-green-100 hover:bg-green-200 text-green-900 dark:bg-green-900/30 dark:hover:bg-green-900/40 dark:text-green-200";
};

const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    "Не начато": "bg-slate-100 hover:bg-slate-200 text-slate-900 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200",
    "План": "bg-blue-100 hover:bg-blue-200 text-blue-900 dark:bg-blue-900/30 dark:hover:bg-blue-900/40 dark:text-blue-200",
    "Планируется": "bg-blue-100 hover:bg-blue-200 text-blue-900 dark:bg-blue-900/30 dark:hover:bg-blue-900/40 dark:text-blue-200",
    "Запланировано": "bg-blue-100 hover:bg-blue-200 text-blue-900 dark:bg-blue-900/30 dark:hover:bg-blue-900/40 dark:text-blue-200",
    "В работе": "bg-sky-100 hover:bg-sky-200 text-sky-900 dark:bg-sky-900/30 dark:hover:bg-sky-900/40 dark:text-sky-200",
    "На проверке": "bg-violet-100 hover:bg-violet-200 text-violet-900 dark:bg-violet-900/30 dark:hover:bg-violet-900/40 dark:text-violet-200",
    "В ожидании": "bg-amber-100 hover:bg-amber-200 text-amber-900 dark:bg-amber-900/30 dark:hover:bg-amber-900/40 dark:text-amber-200",
    "Ожидание": "bg-amber-100 hover:bg-amber-200 text-amber-900 dark:bg-amber-900/30 dark:hover:bg-amber-900/40 dark:text-amber-200",
    "Приостановлено": "bg-orange-100 hover:bg-orange-200 text-orange-900 dark:bg-orange-900/30 dark:hover:bg-orange-900/40 dark:text-orange-200",
    "Пауза": "bg-orange-100 hover:bg-orange-200 text-orange-900 dark:bg-orange-900/30 dark:hover:bg-orange-900/40 dark:text-orange-200",
    "Заблокировано": "bg-red-100 hover:bg-red-200 text-red-900 dark:bg-red-900/30 dark:hover:bg-red-900/40 dark:text-red-200",
    "Отменено": "bg-rose-100 hover:bg-rose-200 text-rose-900 dark:bg-rose-900/30 dark:hover:bg-rose-900/40 dark:text-rose-200",
    "Завершено": "bg-emerald-100 hover:bg-emerald-200 text-emerald-900 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/40 dark:text-emerald-200",
    "Готово": "bg-emerald-100 hover:bg-emerald-200 text-emerald-900 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/40 dark:text-emerald-200",
    "Сделано": "bg-emerald-100 hover:bg-emerald-200 text-emerald-900 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/40 dark:text-emerald-200",
  };
  return colors[status] || "bg-muted/60 hover:bg-muted/80 dark:bg-muted/30 dark:hover:bg-muted/40";
};

// Вычислить плановые часы этапа
const calculateStagePlannedHours = (stage: Stage): number => {
  return stage.decompositions.reduce((sum, dec) => sum + dec.plannedHours, 0);
};

// Вычислить фактические часы этапа
const calculateStageActualHours = (stage: Stage, actualByItemId: Record<string, number>): number => {
  return stage.decompositions.reduce((sum, dec) => {
    return sum + (actualByItemId[dec.id] || 0);
  }, 0);
};

// Вычислить процент готовности этапа по формуле
const calculateStageProgress = (stage: Stage): number => {
  const totalPlanned = calculateStagePlannedHours(stage);
  if (totalPlanned === 0) return 0;

  const weightedProgress = stage.decompositions.reduce((sum, dec) => {
    return sum + (dec.plannedHours / totalPlanned) * (dec.progress / 100);
  }, 0);

  return Math.round(weightedProgress * 100); // Возвращаем в процентах
};

// Цвет прогресс-бара
const getProgressBarColor = (progress: number): string => {
  if (progress === 0) return 'bg-gray-400 dark:bg-gray-600';
  if (progress <= 30) return 'bg-red-500 dark:bg-red-600';
  if (progress <= 70) return 'bg-yellow-500 dark:bg-yellow-600';
  return 'bg-green-500 dark:bg-green-600';
};


// Компонент для отображения ответственных на этапе
function StageResponsibles({
  responsibles,
  employees,
  onAdd,
  onRemove,
}: {
  responsibles: string[];
  employees: Employee[];
  onAdd: () => void;
  onRemove: (userId: string) => void;
}) {
  const responsibleEmployees = employees.filter(emp => responsibles.includes(emp.user_id));

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {responsibleEmployees.map((emp) => (
        <div
          key={emp.user_id}
          className="flex items-center gap-1.5 bg-primary/10 dark:bg-primary/20 hover:bg-primary/15 dark:hover:bg-primary/25 px-2.5 py-1 rounded-full border border-primary/20 transition-colors group"
        >
          <div className="flex items-center gap-1.5">
            {emp.avatar_url ? (
              <img
                src={emp.avatar_url}
                alt={emp.full_name}
                className="h-5 w-5 rounded-full object-cover"
              />
            ) : (
              <div className="h-5 w-5 rounded-full bg-primary/30 dark:bg-primary/40 flex items-center justify-center text-[10px] font-semibold text-primary-foreground">
                {emp.first_name?.[0]}{emp.last_name?.[0]}
              </div>
            )}
            <span className="text-xs font-medium text-foreground">
              {emp.first_name} {emp.last_name}
            </span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove(emp.user_id);
            }}
            className="opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/20 rounded-full p-0.5"
            title="Удалить ответственного"
          >
            <svg className="h-3 w-3 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
      <button
        onClick={onAdd}
        className="flex items-center justify-center h-7 w-7 rounded-full bg-muted/60 hover:bg-muted/80 dark:bg-muted/40 dark:hover:bg-muted/60 border border-border/40 hover:border-primary/40 transition-colors group"
        title="Добавить ответственного"
      >
        <Plus className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
      </button>
    </div>
  );
}

// Компонент для отображения только аватаров ответственных (компактный вид)
function StageResponsiblesAvatars({
  responsibles,
  employees,
  onAdd,
}: {
  responsibles: string[];
  employees: Employee[];
  onAdd: () => void;
}) {
  const responsibleEmployees = employees.filter(emp => responsibles.includes(emp.user_id));

  return (
    <TooltipProvider>
      <div className="flex items-center">
        {responsibleEmployees.map((emp, index) => (
          <Tooltip key={emp.user_id} delayDuration={300}>
            <TooltipTrigger asChild>
              <div
                className="relative"
                style={{
                  marginLeft: index === 0 ? 0 : '-8px',
                  zIndex: responsibleEmployees.length - index,
                }}
              >
                {emp.avatar_url ? (
                  <img
                    src={emp.avatar_url}
                    alt={emp.full_name}
                    className="h-7 w-7 rounded-full object-cover border-2 border-background hover:border-primary/40 transition-colors cursor-pointer"
                  />
                ) : (
                  <div className="h-7 w-7 rounded-full bg-primary dark:bg-primary flex items-center justify-center text-[10px] font-semibold text-primary-foreground border-2 border-background hover:border-primary/40 transition-colors cursor-pointer">
                    {emp.first_name?.[0]}{emp.last_name?.[0]}
                  </div>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">{emp.first_name} {emp.last_name}</p>
              {emp.position_name && <p className="text-xs text-muted-foreground">{emp.position_name}</p>}
            </TooltipContent>
          </Tooltip>
        ))}
        <button
          onClick={onAdd}
          className="flex items-center justify-center h-7 w-7 rounded-full bg-muted hover:bg-muted/80 dark:bg-muted dark:hover:bg-muted/80 border-2 border-background hover:border-primary/40 transition-colors"
          style={{
            marginLeft: responsibleEmployees.length > 0 ? '-8px' : 0,
            zIndex: 0,
          }}
          title="Добавить ответственного"
        >
          <Plus className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
    </TooltipProvider>
  );
}

// Диалог для выбора ответственных
function AssignResponsiblesDialog({
  open,
  onOpenChange,
  currentResponsibles,
  employees,
  isLoading,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentResponsibles: string[];
  employees: Employee[];
  isLoading: boolean;
  onSave: (selectedIds: string[]) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(currentResponsibles));
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (open) {
      setSelectedIds(new Set(currentResponsibles));
      setSearchQuery('');
    }
  }, [open, currentResponsibles]);

  const filteredEmployees = employees.filter(emp => {
    const fullName = `${emp.first_name} ${emp.last_name}`.toLowerCase();
    const query = searchQuery.toLowerCase();
    return fullName.includes(query) || emp.email.toLowerCase().includes(query);
  });

  const toggleEmployee = (userId: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        // Ограничение: максимум 5 сотрудников
        if (newSet.size >= 5) {
          return prev;
        }
        newSet.add(userId);
      }
      return newSet;
    });
  };

  const handleSave = () => {
    onSave(Array.from(selectedIds));
    onOpenChange(false);
  };

  const maxReached = selectedIds.size >= 5;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] dark:bg-[rgb(15,23,42)]">
        <DialogHeader>
          <DialogTitle>Назначить ответственных на этап</DialogTitle>
          <DialogDescription>
            Выберите сотрудников, которые будут ответственными за этот этап
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            placeholder="Поиск по имени или email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full dark:bg-slate-700"
          />
          {selectedIds.size > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {employees
                .filter(emp => selectedIds.has(emp.user_id))
                .map(emp => (
                  <div
                    key={emp.user_id}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-900/70 dark:bg-emerald-950/70 text-white text-xs font-medium"
                  >
                    {emp.avatar_url ? (
                      <img
                        src={emp.avatar_url}
                        alt={emp.full_name}
                        className="h-5 w-5 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-5 w-5 rounded-full bg-emerald-700 dark:bg-emerald-600 flex items-center justify-center text-[9px] font-semibold text-white">
                        {emp.first_name?.[0]}{emp.last_name?.[0]}
                      </div>
                    )}
                    <span>{emp.first_name} {emp.last_name}</span>
                    <button
                      onClick={() => toggleEmployee(emp.user_id)}
                      className="hover:bg-white/20 rounded-full p-0.5 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
            </div>
          )}
          <div className="max-h-[400px] overflow-y-auto space-y-2 pr-2">
            <TooltipProvider>
              {filteredEmployees.map((emp) => {
                const isSelected = selectedIds.has(emp.user_id);
                const isDisabled = maxReached && !isSelected;

                return (
                  <div
                    key={emp.user_id}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                      isSelected
                        ? 'bg-primary/10 border-primary/40 cursor-pointer'
                        : isDisabled
                        ? 'bg-muted/20 border-border/20 opacity-50 cursor-default'
                        : 'bg-muted/30 border-border/40 hover:bg-muted/50 cursor-pointer'
                    }`}
                    onClick={() => !isDisabled && toggleEmployee(emp.user_id)}
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => !isDisabled && toggleEmployee(emp.user_id)}
                            onClick={(e) => e.stopPropagation()}
                            disabled={isDisabled}
                          />
                        </div>
                      </TooltipTrigger>
                      {isDisabled && (
                        <TooltipContent className="text-xs bg-slate-700 dark:bg-slate-700 border-slate-600">
                          <p>Нельзя выбрать больше 5 сотрудников</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                    {emp.avatar_url ? (
                      <img
                        src={emp.avatar_url}
                        alt={emp.full_name}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-primary/30 dark:bg-primary/40 flex items-center justify-center text-sm font-semibold text-primary-foreground">
                        {emp.first_name?.[0]}{emp.last_name?.[0]}
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="font-medium text-sm">{emp.full_name}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        {emp.position_name && <span>{emp.position_name}</span>}
                        {emp.department_name && (
                          <>
                            {emp.position_name && <span>•</span>}
                            <span>{emp.department_name}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </TooltipProvider>
            {filteredEmployees.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                Сотрудники не найдены
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-between items-center pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            Выбрано: {selectedIds.size}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="dark:bg-slate-600 dark:hover:bg-slate-500">
              Отмена
            </Button>
            <Button onClick={handleSave} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Сохранить'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

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
  updateStageResponsibles,
  updateDecomposition,
  onDecompositionDragEnd,
  focusedDecompositionId,
  pendingNewDecompositionId,
  onDecompositionInteract,
  typeOfWorkOptions,
  difficultyOptions,
  responsibleOptions,
  statusOptions,
  statuses,
  employees,
  formatProfileLabel,
  isCollapsed,
  onToggleCollapse,
  onOpenLog,
  actualByItemId,
}: {
  stage: Stage;
  selectedStages: Set<string>;
  selectedDecompositions: Set<string>;
  toggleStageSelection: (id: string) => void;
  toggleSelectAllInStage: (stageId: string) => void;
  toggleDecompositionSelection: (id: string) => void;
  deleteStage: (id: string) => void;
  deleteDecomposition: (stageId: string, decompId: string) => void;
  addDecomposition: (stageId: string, opts?: { pending?: boolean; initialCompletionDate?: string }) => void;
  updateStage: (stageId: string, updates: Partial<Stage>) => void;
  updateStageResponsibles: (stageId: string, responsibles: string[]) => void;
  updateDecomposition: (stageId: string, decompId: string, updates: Partial<Decomposition>) => void;
  onDecompositionDragEnd: (stageId: string, event: DragEndEvent) => void;
  focusedDecompositionId: string | null;
  pendingNewDecompositionId: string | null;
  onDecompositionInteract: (decompId: string) => void;
  typeOfWorkOptions: string[];
  difficultyOptions: string[];
  responsibleOptions: string[];
  statusOptions: string[];
  statuses: SectionStatus[];
  employees: Employee[];
  formatProfileLabel: (p: { first_name: string; last_name: string; email: string | null | undefined }) => string;
  isCollapsed: boolean;
  onToggleCollapse: (stageId: string) => void;
  onOpenLog?: (itemId: string) => void;
  actualByItemId: Record<string, number>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stage.id });
  const { toast } = useToast();
  const [isEditingName, setIsEditingName] = useState(false);
  const [showResponsiblesDialog, setShowResponsiblesDialog] = useState(false);
  const [isUpdatingResponsibles, setIsUpdatingResponsibles] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
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
    try {
      const statusName = stage.statusId ? statuses.find(s => s.id === stage.statusId)?.name || 'Нет' : 'Нет';
      let stageData = `Этап: ${stage.name}\nОписание: ${stage.description || 'Нет описания'}\nСтатус: ${statusName}\nДата начала: ${stage.startDate}\nДата завершения: ${stage.endDate}\n\n`;
      stageData += "Декомпозиции:\n";
      stageData += "| Описание | Тип работ | Сложность | Ответственный | Часы | Прогресс | Статус | Дата |\n";
      stageData += "|---|---|---|---|---|---|---|---|\n";

      stage.decompositions.forEach((decomp) => {
        stageData += `| ${decomp.description} | ${decomp.typeOfWork} | ${decomp.difficulty} | ${decomp.responsible} | ${decomp.plannedHours} | ${decomp.progress}% | ${decomp.status} | ${decomp.completionDate || ''} |\n`;
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
      className={`relative ${isCollapsed ? "p-2" : "p-3"} shadow border border-border/60 bg-card/90 dark:bg-muted/20 ${
        selectedStages.has(stage.id) ? "ring-1 ring-primary/20 border-primary/40 bg-muted/40 dark:bg-muted/35" : ""
      }`}
    >
      <div className={`flex items-start ${isCollapsed ? "mb-1 gap-1" : "mb-2 gap-2"}`}>
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing opacity-40 hover:opacity-100 transition-opacity pt-2"
        >
          <GripVertical className="h-6 w-5 text-muted-foreground" />
        </div>
        <Checkbox
          checked={selectedStages.has(stage.id)}
          onCheckedChange={() => toggleStageSelection(stage.id)}
          className="bg-transparent data-[state=checked]:bg-transparent data-[state=checked]:text-primary mt-3"
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onToggleCollapse(stage.id)}
          className={`${isCollapsed ? "h-6 w-6" : "h-7 w-7"} p-0 mt-2`}
          title={isCollapsed ? "Развернуть декомпозиции" : "Свернуть декомпозиции"}
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
        <div className="flex-1">
          <div
            className="flex items-center gap-3"
            onMouseEnter={() => !isCollapsed && setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            <div className="flex items-center">
              <StageResponsiblesAvatars
                responsibles={stage.responsibles}
                employees={employees}
                onAdd={() => setShowResponsiblesDialog(true)}
              />
            </div>
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
              className={`${isCollapsed ? "text-base min-h-7 py-0.5 translate-y-[3px]" : "text-lg min-h-9 py-1"} flex-1 font-semibold border-0 outline-none px-3 rounded-md transition-colors focus:outline-none focus:ring-0 resize-none overflow-hidden ${
                isEditingName
                  ? "bg-primary/5 ring-2 ring-primary/40 ring-offset-1 ring-offset-background"
                  : "bg-transparent hover:bg-muted/40"
              }`}
            />
            {!isCollapsed && (
              <>
                <Select
                  value={stage.statusId || undefined}
                  onValueChange={(value) => {
                    updateStage(stage.id, { statusId: value || null });
                  }}
                >
                  <SelectTrigger
                    className={`h-6 min-h-0 py-0 px-2 text-xs border-0 shadow-none rounded-full w-[115px] ${
                      stage.statusId
                        ? getStatusColor(statuses.find(s => s.id === stage.statusId)?.name || '')
                        : 'bg-muted/60 hover:bg-muted/80'
                    }`}
                  >
                    <SelectValue placeholder="Статус" />
                  </SelectTrigger>
                  <SelectContent className="bg-background dark:bg-slate-700">
                    {statuses
                      .filter(s => ['План', 'В работе', 'Пауза', 'Проверка', 'Готово'].includes(s.name))
                      .map((status) => (
                        <SelectItem key={status.id} value={status.id}>
                          {status.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </>
            )}
            <div className="relative">
              <DateRangePicker
                value={{
                  from: parseISODateString(stage.startDate),
                  to: parseISODateString(stage.endDate)
                }}
                onChange={(range: DateRange) => {
                  updateStage(stage.id, {
                    startDate: formatISODateString(range.from),
                    endDate: formatISODateString(range.to)
                  });
                }}
                calendarWidth="500px"
                inputWidth="200px"
                inputClassName="w-full pl-3 pr-8 h-6 rounded-full bg-muted/60 hover:bg-muted/80 border-0 text-xs text-foreground cursor-pointer focus:outline-none shadow-none"
              />
              <Calendar className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            </div>
          </div>
          {!isCollapsed && (
            <>
              <div
                className={`transition-all duration-300 ease-in-out overflow-hidden ${
                  isHovered ? 'max-h-28 opacity-100' : 'max-h-0 opacity-0'
                }`}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
              >
                <div className="flex items-center gap-2 mt-2">
                  <Textarea
                    value={stage.description || ''}
                    onChange={(e) => {
                      updateStage(stage.id, { description: e.target.value });
                    }}
                    placeholder="Описание этапа"
                    rows={2}
                    className="flex-1 text-sm min-h-[48px] max-h-20 overflow-y-auto rounded-md px-3 py-1.5 bg-muted/30 dark:bg-muted/20 hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 resize-none"
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {stage.decompositions.length > 0 && !isCollapsed && (
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

      {!isCollapsed && (
        <>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={(event) => onDecompositionDragEnd(stage.id, event)}
          >
            <div className="overflow-x-auto ml-8">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/30">
                    <th className="w-6 pb-2 pt-0"></th>
                    <th className="w-6 pb-2 pt-0"></th>
                    <th className="w-6 pb-2 pt-0"></th>
                    <th className="pb-2 pt-0 px-1 text-left font-medium text-muted-foreground text-xs uppercase tracking-wide">
                      Описание
                    </th>
                    <th className="pb-2 pt-0 px-1 text-left font-medium text-muted-foreground text-xs uppercase tracking-wide">
                      Тип работ
                    </th>
                    <th className="pb-2 pt-0 px-1 text-left font-medium text-muted-foreground text-xs uppercase tracking-wide">
                      Сложность
                    </th>
                    <th className="pb-2 pt-0 px-1 text-left font-medium text-muted-foreground text-xs uppercase tracking-wide whitespace-nowrap">
                      Факт ч./План ч.
                    </th>
                    <th className="pb-2 pt-0 px-1 text-left font-medium text-muted-foreground text-xs uppercase tracking-wide">
                      Прогресс
                    </th>
                    <th className="w-6 pb-2 pt-0"></th>
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
                        onDateConfirmed={(val) => addDecomposition(stage.id, { pending: true, initialCompletionDate: val })}
                        onInteract={onDecompositionInteract}
                        isPendingNew={pendingNewDecompositionId === decomp.id}
                        typeOfWorkOptions={typeOfWorkOptions}
                        difficultyOptions={difficultyOptions}
                        responsibleOptions={responsibleOptions}
                        statusOptions={statusOptions}
                        employees={employees}
                        formatProfileLabel={formatProfileLabel}
                        onOpenLog={onOpenLog}
                        actualByItemId={actualByItemId}
                      />
                    ))}
                  </SortableContext>
                </tbody>
              </table>
            </div>
          </DndContext>

{stage.decompositions.length > 0 ? (
            <div className="ml-8 pt-2 pb-1">
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => addDecomposition(stage.id)}
                  className="h-8 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Добавить декомпозицию
                </Button>
                <div className="flex items-center gap-6 mr-10 border-t-2 border-border/30 pt-2">
                  <div className="flex items-center gap-1">
                    <div className="h-6 w-[48px] flex items-center justify-center bg-muted/40 rounded-full px-2 text-xs text-center text-muted-foreground tabular-nums font-medium">
                      {calculateStageActualHours(stage, actualByItemId).toFixed(1)}
                    </div>
                    <span className="text-xs text-muted-foreground/50">/</span>
                    <div className="h-6 w-[48px] flex items-center justify-center bg-muted/40 rounded-full px-2 text-xs text-center text-muted-foreground tabular-nums font-medium">
                      {calculateStagePlannedHours(stage).toFixed(1)}
                    </div>
                  </div>
                  <div className="h-6 w-[52px] flex items-center justify-center bg-muted/40 rounded-full px-2 text-xs text-muted-foreground tabular-nums font-semibold">
                    {calculateStageProgress(stage)}%
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => addDecomposition(stage.id)}
              className="mt-2 h-8 text-xs text-muted-foreground hover:text-foreground"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Добавить декомпозицию
            </Button>
          )}
        </>
      )}

      <AssignResponsiblesDialog
        open={showResponsiblesDialog}
        onOpenChange={setShowResponsiblesDialog}
        currentResponsibles={stage.responsibles}
        employees={employees}
        isLoading={isUpdatingResponsibles}
        onSave={async (selectedIds) => {
          setIsUpdatingResponsibles(true);
          await updateStageResponsibles(stage.id, selectedIds);
          setIsUpdatingResponsibles(false);
        }}
      />
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
  typeOfWorkOptions,
  difficultyOptions,
  responsibleOptions,
  statusOptions,
  employees,
  formatProfileLabel,
  onOpenLog,
  actualByItemId,
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
  onDateConfirmed: (dateISO: string) => void;
  onInteract: (decompId: string) => void;
  isPendingNew: boolean;
  typeOfWorkOptions: string[];
  difficultyOptions: string[];
  responsibleOptions: string[];
  statusOptions: string[];
  employees: Employee[];
  formatProfileLabel: (p: { first_name: string; last_name: string; email: string | null | undefined }) => string;
  onOpenLog?: (itemId: string) => void;
  actualByItemId: Record<string, number>;
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
  const [openStatus, setOpenStatus] = useState(false);
  const lastClosedSelectRef = useRef<string | null>(null);
  const [interacted, setInteracted] = useState(false);
  const descriptionRef = useRef<HTMLTextAreaElement | null>(null);
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState<string>(decomposition.responsible || "");
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState<boolean>(false);
  const responsibleContainerRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [dropdownPos, setDropdownPos] = useState<{ left: number; top: number; width: number; openUp: boolean }>({ left: 0, top: 0, width: 0, openUp: false });
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const filteredEmployees = useMemo(() => {
    const q = employeeSearchTerm.trim().toLowerCase();
    const list = (employees || []).filter((emp) => {
      if (!q) return true;
      return (
        (emp.full_name || `${emp.first_name} ${emp.last_name}`)?.toLowerCase().includes(q) ||
        (emp.email || '').toLowerCase().includes(q)
      );
    });
    return list.slice(0, 10);
  }, [employees, employeeSearchTerm]);
  const updateDropdownPosition = useCallback(() => {
    const el = responsibleContainerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const openUp = (window.innerHeight - rect.bottom) < 260;
    const computedTop = openUp ? Math.max(8, rect.top - 260) : rect.bottom + 4;
    setDropdownPos({ left: rect.left, top: computedTop, width: rect.width, openUp });
  }, []);
  useEffect(() => {
    if (!showEmployeeDropdown) return;
    updateDropdownPosition();
    const handler = () => updateDropdownPosition();
    window.addEventListener("scroll", handler, true);
    window.addEventListener("resize", handler);
    return () => {
      window.removeEventListener("scroll", handler, true);
      window.removeEventListener("resize", handler);
    };
  }, [showEmployeeDropdown, updateDropdownPosition]);
  useEffect(() => {
    if (showEmployeeDropdown) {
      setHighlightedIndex(filteredEmployees.length > 0 ? 0 : -1);
    }
  }, [employeeSearchTerm, showEmployeeDropdown, filteredEmployees.length]);
  useEffect(() => {
    if (!showEmployeeDropdown) return;
    if (highlightedIndex < 0) return;
    const el = dropdownRef.current?.querySelector(`[data-index="${highlightedIndex}"]`) as HTMLElement | null;
    if (el) {
      el.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex, showEmployeeDropdown]);
  useEffect(() => {
    if (!showEmployeeDropdown) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (responsibleContainerRef.current?.contains(t)) return;
      if (dropdownRef.current?.contains(t)) return;
      setShowEmployeeDropdown(false);
      setOpenResponsible(false);
    };
    document.addEventListener("mousedown", onDown, true);
    return () => document.removeEventListener("mousedown", onDown, true);
  }, [showEmployeeDropdown]);
  useEffect(() => {
    setEmployeeSearchTerm(decomposition.responsible || "");
  }, [decomposition.responsible]);

  const selectEmployee = useCallback((emp: Employee) => {
    const label = formatProfileLabel({ first_name: emp.first_name, last_name: emp.last_name, email: emp.email });
    onUpdate(stageId, decomposition.id, { responsible: label });
    setEmployeeSearchTerm(label);
    markInteracted();
    setShowEmployeeDropdown(false);
    setOpenResponsible(false);
    setTimeout(() => {
      if (plannedHoursInputRef.current) {
        plannedHoursInputRef.current.focus();
        plannedHoursInputRef.current.select?.();
      } else {
        focusNextFrom(responsibleTriggerRef.current);
      }
    }, 50);
  }, [formatProfileLabel, onUpdate, stageId, decomposition.id]);
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

  // Блокировка редактирования при прогрессе 100%
  const isCompleted = decomposition.progress === 100;

  return (
    <tr
      ref={(node) => {
        setNodeRef(node as unknown as HTMLElement);
        rowRef.current = node as HTMLTableRowElement;
      }}
      style={style}
      className={`group border-b border-border/20 last:border-0 hover:bg-muted/30 dark:hover:bg-muted/20 transition-colors ${
        isHighlighted ? "bg-primary/5 hover:bg-primary/10 dark:bg-primary/15 dark:hover:bg-primary/20" : ""
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
      <td className="py-1 px-1">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-40 hover:opacity-100 transition-opacity"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
      </td>
      <td className="py-1 px-1">
        <Checkbox
          checked={isChecked}
          onCheckedChange={() => !selectionDisabled && onToggleSelection(decomposition.id)}
          className="bg-transparent data-[state=checked]:bg-transparent data-[state=checked]:text-primary"
          disabled={selectionDisabled}
        />
      </td>
      <td className="py-1 px-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!isCompleted) onOpenLog?.(decomposition.id);
          }}
          disabled={isCompleted}
          className={`flex items-center justify-center h-6 w-6 rounded-full transition-colors ${
            isCompleted
              ? 'bg-muted/40 text-muted-foreground cursor-default opacity-50'
              : 'bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'
          }`}
          title={isCompleted ? "Задача завершена (100%)" : "Добавить отчет"}
        >
          <Clock className="h-3.5 w-3.5" />
        </button>
      </td>
      <td className="py-1 px-1">
        <Textarea
          ref={descriptionRef}
          value={decomposition.description}
          onChange={(e) => {
            onUpdate(stageId, decomposition.id, { description: (e.target as HTMLTextAreaElement).value });
            markInteracted();
          }}
          onKeyDown={handleKeyDown}
          className={`min-h-[24px] h-auto min-w-[600px] border-0 shadow-none rounded-lg px-3 py-1 text-xs resize-none overflow-hidden ${
            isCompleted
              ? 'bg-muted/30 cursor-default opacity-60'
              : 'bg-muted/60 hover:bg-muted/80 focus:bg-muted focus:placeholder-transparent'
          }`}
          rows={1}
          autoFocus={autoFocus && !isCompleted}
          placeholder={isCompleted ? "" : "Новая задача"}
          disabled={isCompleted}
          readOnly={isCompleted}
          onInput={(e) => {
            const target = (e.target as HTMLTextAreaElement);
            target.style.height = "auto";
            target.style.height = target.scrollHeight + "px";
          }}
        />
      </td>
      <td className="py-1 px-1">
        <Select
          open={openTypeOfWork && !isCompleted}
          onOpenChange={(v) => {
            if (isCompleted) return;
            setOpenTypeOfWork(v);
            if (!v) lastClosedSelectRef.current = "typeOfWork";
          }}
          value={decomposition.typeOfWork}
          onValueChange={(value) => {
            if (isCompleted) return;
            onUpdate(stageId, decomposition.id, { typeOfWork: value });
            markInteracted();
            setOpenTypeOfWork(false);
            setTimeout(() => {
              focusNextFrom(typeOfWorkTriggerRef.current);
            }, 0);
          }}
          disabled={isCompleted}
        >
          <SelectTrigger
            disabled={isCompleted}
            className={`h-6 min-h-0 py-0 px-2 leading-none text-xs [&_span]:leading-none border-0 shadow-none rounded-full w-[160px] whitespace-nowrap ${
              isCompleted
                ? 'bg-muted/30 cursor-default opacity-60'
                : 'bg-muted/60 hover:bg-muted/80'
            } ${openTypeOfWork ? "ring-1 ring-ring/40 ring-offset-2" : ""}`}
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
            className="bg-background dark:bg-slate-700"
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
            {typeOfWorkOptions.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="py-1 px-1">
        <Select
          open={openDifficulty && !isCompleted}
          onOpenChange={(v) => {
            if (isCompleted) return;
            setOpenDifficulty(v);
            if (!v) lastClosedSelectRef.current = "difficulty";
          }}
          value={decomposition.difficulty}
          onValueChange={(value) => {
            if (isCompleted) return;
            onUpdate(stageId, decomposition.id, { difficulty: value });
            markInteracted();
            setOpenDifficulty(false);
            setTimeout(() => {
              focusNextFrom(difficultyTriggerRef.current);
            }, 0);
          }}
          disabled={isCompleted}
        >
          <SelectTrigger
            disabled={isCompleted}
            className={`h-6 min-h-0 py-0 px-2 leading-none text-xs [&_span]:leading-none border-0 shadow-none rounded-full w-[75px] ${
              isCompleted ? 'bg-muted/30 cursor-default opacity-60' : getDifficultyColor(decomposition.difficulty)
            } ${openDifficulty ? "ring-1 ring-ring/40 ring-offset-2" : ""}`}
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
            className="bg-background dark:bg-slate-700"
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
            {difficultyOptions.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="py-1 pl-1 pr-1">
        <div className="flex items-center gap-1">
          <div className="h-6 w-[48px] flex items-center justify-center border-0 bg-muted/40 shadow-none rounded-full px-2 text-xs text-center text-muted-foreground tabular-nums">
            {Number(actualByItemId[decomposition.id] || 0).toFixed(2)}
          </div>
          <span className="text-xs text-muted-foreground/50">/</span>
          <Input
            type="number"
            value={decomposition.plannedHours}
            onChange={(e) => {
              const val = e.target.value;
              const num = parseFloat(val);
              onUpdate(stageId, decomposition.id, { plannedHours: isNaN(num) || num < 0 ? 0 : num });
              markInteracted();
            }}
            onInput={(e) => {
              const input = e.target as HTMLInputElement;
              // Удаляем невалидные символы
              let cleaned = input.value.replace(/[^0-9.]/g, '');

              // Удаляем ведущие нули (но оставляем 0 перед точкой, например "0.5")
              if (cleaned.startsWith('0') && cleaned.length > 1 && cleaned[1] !== '.') {
                cleaned = cleaned.replace(/^0+/, '');
                // Если после удаления осталась пустая строка или только точка, добавляем 0
                if (cleaned === '' || cleaned === '.') {
                  cleaned = '0' + cleaned;
                }
              }

              input.value = cleaned;
            }}
            onFocus={() => {
              // Не выделяем текст при фокусе
            }}
            onKeyDown={handleKeyDown}
            className={`h-6 w-[48px] border-0 shadow-none rounded-full px-2 text-xs text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
              isCompleted
                ? 'bg-muted/30 cursor-default opacity-60'
                : 'bg-muted/60 hover:bg-muted/80 focus:bg-muted'
            }`}
            disabled={isCompleted}
            readOnly={isCompleted}
            ref={plannedHoursInputRef}
          />
        </div>
      </td>
      <td className="py-1 px-1">
        <Input
          ref={progressTriggerRef as unknown as React.Ref<HTMLInputElement>}
          type="number"
          min={0}
          max={100}
          value={decomposition.progress}
          onChange={(e) => {
            if (isCompleted) return;
            const val = e.target.value;
            const num = parseFloat(val);
            const validNum = isNaN(num) || num < 0 ? 0 : Math.min(num, 100);
            onUpdate(stageId, decomposition.id, { progress: validNum });
            markInteracted();
          }}
          onInput={(e) => {
            if (isCompleted) return;
            const input = e.target as HTMLInputElement;
            // Удаляем невалидные символы (оставляем цифры и точку)
            let cleaned = input.value.replace(/[^0-9.]/g, '');

            // Ограничиваем целую часть: максимум 2 цифры, кроме случая "100"
            const parts = cleaned.split('.');
            let integerPart = parts[0];
            const decimalPart = parts[1];

            if (integerPart.length > 2) {
              // Если начинается с "10", разрешаем только "100"
              if (integerPart.startsWith('10')) {
                integerPart = integerPart[2] === '0' ? '100' : '10';
              } else {
                // Любое другое двузначное число - обрезаем до 2 цифр
                integerPart = integerPart.slice(0, 2);
              }
            }

            cleaned = integerPart + (decimalPart !== undefined ? '.' + decimalPart : '');

            // Удаляем ведущие нули (но оставляем 0 перед точкой, например "0.5")
            if (cleaned.startsWith('0') && cleaned.length > 1 && cleaned[1] !== '.') {
              cleaned = cleaned.replace(/^0+/, '');
              // Если после удаления осталась пустая строка или только точка, добавляем 0
              if (cleaned === '' || cleaned === '.') {
                cleaned = '0' + cleaned;
              }
            }

            // Проверяем максимальное значение 100
            const num = parseFloat(cleaned);
            if (!isNaN(num) && num > 100) {
              cleaned = '100';
            }

            input.value = cleaned;
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            // Не выделяем текст при фокусе
          }}
          className={`h-6 w-[48px] border-0 shadow-none rounded-full px-2 text-xs text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
            isCompleted
              ? 'bg-muted/30 cursor-default opacity-60'
              : 'bg-muted/60 hover:bg-muted/80 focus:bg-muted'
          }`}
          placeholder="%"
          disabled={isCompleted}
          readOnly={isCompleted}
        />
      </td>
    </tr>
  );
}


export default function StagesManagement({ sectionId, onOpenLog }: StagesManagementProps) {
  const supabase = useMemo(() => createClient(), []);
  const [stages, setStages] = useState<Stage[]>([]);
  const [categories, setCategories] = useState<WorkCategory[]>([]);
  const [difficulties, setDifficulties] = useState<DifficultyLevel[]>([]);
  const [statuses, setStatuses] = useState<SectionStatus[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState<boolean>(false);
  const [selectedStages, setSelectedStages] = useState<Set<string>>(new Set());
  const [selectedDecompositions, setSelectedDecompositions] = useState<Set<string>>(new Set());
  const [showPasteDialog, setShowPasteDialog] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const { toast } = useToast();
  const [focusedDecompositionId, setFocusedDecompositionId] = useState<string | null>(null);
  const [pendingNewDecomposition, setPendingNewDecomposition] = useState<{ stageId: string; decompId: string } | null>(null);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [collapsedStageIds, setCollapsedStageIds] = useState<Set<string>>(new Set());
  const [actualByItemId, setActualByItemId] = useState<Record<string, number>>({});

  // State для шаблонов
  const [templatesDialogOpen, setTemplatesDialogOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);

  // Состояния для подтверждения удаления
  const [stageToDelete, setStageToDelete] = useState<string | null>(null);
  const [decompToDelete, setDecompToDelete] = useState<{ stageId: string; decompId: string } | null>(null);
  const [deleteStageDialogOpen, setDeleteStageDialogOpen] = useState(false);
  const [deleteDecompDialogOpen, setDeleteDecompDialogOpen] = useState(false);
  const [bulkDeleteStagesDialogOpen, setBulkDeleteStagesDialogOpen] = useState(false);
  const [bulkDeleteDecompsDialogOpen, setBulkDeleteDecompsDialogOpen] = useState(false);

  // Хуки для пользователя и разрешений
  const { id: userId } = useUserStore();
  const hasPermission = usePermissionsStore(state => state.hasPermission);
  const hasManagePermission = hasPermission('dec.templates.manage');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Маппинги имён в id для БД
  const categoryNameToId = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach(c => map.set(c.work_category_name, c.work_category_id));
    return map;
  }, [categories]);
  const difficultyNameToId = useMemo(() => {
    const map = new Map<string, string>();
    difficulties.forEach(d => map.set(d.difficulty_abbr, d.difficulty_id));
    return map;
  }, [difficulties]);
  const statusNameToId = useMemo(() => {
    const map = new Map<string, string>();
    statuses.forEach(s => map.set(s.name, s.id));
    return map;
  }, [statuses]);
  const { profileNameToId, responsibleOptions, formatProfileLabel } = useMemo(() => {
    const nameCounts = new Map<string, number>();
    profiles.forEach((p) => {
      const base = `${p.first_name} ${p.last_name}`.trim() || p.email;
      nameCounts.set(base, (nameCounts.get(base) || 0) + 1);
    });

    const map = new Map<string, string>();
    const labels: string[] = [];
    const mkLabel = (p: { first_name: string; last_name: string; email: string | null | undefined }) => {
      const base = `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || (p.email ?? '');
      const label = (nameCounts.get(base)! > 1 && p.email) ? `${base} (${p.email})` : base;
      return label;
    };
    profiles.forEach((p) => {
      const label = mkLabel(p);
      map.set(label, p.user_id);
      labels.push(label);
    });
    return { profileNameToId: map, responsibleOptions: labels, formatProfileLabel: mkLabel };
  }, [profiles]);

  const typeOfWorkOptions = useMemo(() => categories.map(c => c.work_category_name), [categories]);
  const difficultyOptions = useMemo(() => difficulties.map(d => d.difficulty_abbr), [difficulties]);
  const statusOptions = useMemo(() => statuses.map(s => s.name), [statuses]);
  // responsibleOptions формируются вместе с profileNameToId, чтобы метки были уникальны

  // Дефолтный статус для новых этапов
  const defaultStageStatusId = useMemo(() => {
    return statuses.find(s => /план/i.test(s.name))?.id || statuses[0]?.id || null;
  }, [statuses]);

  const chartStages = useMemo(() =>
    stages
      .filter((s) => s.id !== "__no_stage__")
      .map((s) => ({
        id: s.id,
        name: s.name,
        start: s.startDate,
        finish: s.endDate,
        description: null as string | null,
      })),
    [stages]
  );

  // Загрузка данных из БД
  useEffect(() => {
    if (!sectionId) return;
    const load = async () => {
      try {
        const { data, error } = await supabase.rpc('get_decomposition_bootstrap', { p_section_id: sectionId });
        if (error) throw error;
        const json: any = data as any;
        const cats = json?.categories || [];
        const diffs = json?.difficultyLevels || [];
        const stats = json?.statuses || [];
        const profs = json?.profiles || [];
        const stgsRaw = (json?.stages || []) as any[];
        const itemsRaw = (json?.items || []) as any[];
        setCategories(cats);
        setDifficulties(diffs);
        setStatuses(stats);
        setProfiles(profs);
        // Построим локальные этапы
        const stageMap = new Map<string, Stage>();
        stgsRaw.forEach(s => {
          stageMap.set(s.decomposition_stage_id, {
            id: s.decomposition_stage_id,
            name: s.decomposition_stage_name,
            startDate: s.decomposition_stage_start || null,
            endDate: s.decomposition_stage_finish || null,
            description: s.decomposition_stage_description || null,
            statusId: s.decomposition_stage_status_id || null,
            responsibles: s.decomposition_stage_responsibles || [],
            decompositions: [],
          });
        });
        itemsRaw.forEach(it => {
          const stageId = it.decomposition_item_stage_id || '__no_stage__';
          if (stageId === '__no_stage__' && !stageMap.has('__no_stage__')) {
            stageMap.set('__no_stage__', { id: '__no_stage__', name: 'Без этапа', startDate: null, endDate: null, description: null, statusId: null, responsibles: [], decompositions: [] });
          }
          const stage = stageMap.get(stageId);
          if (!stage) return;
          const respName = it.profiles ? ((it.profiles.first_name + ' ' + it.profiles.last_name).trim() || it.profiles.email) : '';
          const statusName = it.section_statuses ? it.section_statuses.name : '';
          const decomp: Decomposition = {
            id: it.decomposition_item_id,
            description: it.decomposition_item_description || '',
            typeOfWork: (cats.find((c: any) => c.work_category_id === it.decomposition_item_work_category_id)?.work_category_name) || '',
            difficulty: (diffs.find((d: any) => d.difficulty_id === it.decomposition_item_difficulty_id)?.difficulty_abbr) || '',
            responsible: respName,
            plannedHours: Number(it.decomposition_item_planned_hours || 0),
            progress: Number(it.decomposition_item_progress || 0),
            status: statusName || '',
            completionDate: it.decomposition_item_planned_due_date || null,
          };
          stage.decompositions.push(decomp);
        });
        // Сортировка по order — в itemsRaw он есть, но для простоты оставим текущее добавление
        setStages(Array.from(stageMap.values()));
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Ошибка загрузки декомпозиции 2:', e);
      } finally {
        setIsInitialLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId]);

  // Загрузка фактических часов из work_logs
  useEffect(() => {
    const loadActuals = async () => {
      if (stages.length === 0) {
        setActualByItemId({});
        return;
      }
      const allItemIds = stages.flatMap(s => s.decompositions.map(d => d.id));
      if (allItemIds.length === 0) {
        setActualByItemId({});
        return;
      }
      try {
        const { data, error } = await supabase.rpc('get_work_logs_agg_for_items', { p_item_ids: allItemIds });
        if (error) throw error;
        const hoursById: Record<string, number> = {};
        for (const row of (data as any[]) || []) {
          const key = row.decomposition_item_id as string;
          hoursById[key] = Number(row.actual_hours || 0);
        }
        setActualByItemId(hoursById);
      } catch (e) {
        console.error('Ошибка агрегации work_logs:', e);
        setActualByItemId({});
      }
    };
    loadActuals();
  }, [stages, supabase]);

  // Загрузка сотрудников для поиска (view_users)
  useEffect(() => {
    let aborted = false;
    const fetchEmployees = async () => {
      setIsLoadingEmployees(true);
      try {
        const { data, error } = await supabase
          .from('view_users')
          .select(`
            user_id,
            first_name,
            last_name,
            full_name,
            email,
            position_name,
            avatar_url,
            team_name,
            department_name,
            employment_rate
          `)
          .order('full_name');
        if (error) throw error;
        if (!aborted) setEmployees((data as Employee[]) || []);
      } catch {
        if (!aborted) setEmployees([]);
      } finally {
        if (!aborted) setIsLoadingEmployees(false);
      }
    };
    fetchEmployees();
    return () => {
      aborted = true;
    };
  }, [supabase]);

  const addStage = async () => {
    try {
      const nextOrder = (stages
        .filter(s => s.id !== '__no_stage__')
        .length) + 1;
      const { data, error } = await supabase
        .from('decomposition_stages')
        .insert({
          decomposition_stage_section_id: sectionId,
          decomposition_stage_name: 'Новый этап',
          decomposition_stage_start: new Date().toISOString().split('T')[0],
          decomposition_stage_finish: new Date().toISOString().split('T')[0],
          decomposition_stage_description: null,
          decomposition_stage_status_id: defaultStageStatusId,
          decomposition_stage_order: nextOrder,
        })
        .select('decomposition_stage_id, decomposition_stage_name, decomposition_stage_start, decomposition_stage_finish, decomposition_stage_description, decomposition_stage_status_id')
        .single();
      if (error) throw error;
      const row = data as any;
      const newStage: Stage = {
        id: row.decomposition_stage_id,
        name: row.decomposition_stage_name,
        startDate: row.decomposition_stage_start || null,
        endDate: row.decomposition_stage_finish || null,
        description: row.decomposition_stage_description || null,
        statusId: row.decomposition_stage_status_id || null,
        responsibles: [],
        decompositions: [],
      };
      setStages(prev => [...prev, newStage]);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Ошибка создания этапа:', e);
    }
  };

  // Функция-обёртка для открытия диалога подтверждения удаления этапа
  const deleteStage = (stageId: string) => {
    setStageToDelete(stageId);
    setDeleteStageDialogOpen(true);
  };

  // Функция фактического удаления этапа
  const confirmDeleteStage = async () => {
    if (!stageToDelete) return;

    try {
      if (stageToDelete === '__no_stage__') {
        // Удаляем все элементы без этапа в рамках текущего раздела, самого этапа в БД нет
        const { error: noStageItemsErr } = await supabase
          .from('decomposition_items')
          .delete()
          .eq('decomposition_item_section_id', sectionId)
          .is('decomposition_item_stage_id', null);
        if (noStageItemsErr) throw noStageItemsErr;
      } else {
        // Сначала удаляем все декомпозиции этого этапа, затем сам этап
        const { error: itemsErr } = await supabase
          .from('decomposition_items')
          .delete()
          .eq('decomposition_item_stage_id', stageToDelete);
        if (itemsErr) throw itemsErr;

        const { error: stageErr } = await supabase
          .from('decomposition_stages')
          .delete()
          .eq('decomposition_stage_id', stageToDelete);
        if (stageErr) throw stageErr;
      }

      // Обновляем локальное состояние и снимаем выбор с удалённых сущностей
      const removedDecompIds = new Set<string>();
      const nextStages = stages.filter((s) => s.id !== stageToDelete);
      const deletedStage = stages.find((s) => s.id === stageToDelete);
      if (deletedStage) {
        deletedStage.decompositions.forEach((d) => removedDecompIds.add(d.id));
      }
      setStages(nextStages);
      setSelectedStages((prev) => {
        const newSet = new Set(prev);
        newSet.delete(stageToDelete);
        return newSet;
      });
      if (removedDecompIds.size > 0) {
        setSelectedDecompositions((prev) => {
          const next = new Set(prev);
          removedDecompIds.forEach((id) => next.delete(id));
          return next;
        });
      }
      toast({ title: 'Успешно', description: 'Этап удалён' });
      setDeleteStageDialogOpen(false);
      setStageToDelete(null);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Ошибка удаления этапа:', e);
      toast({ title: 'Ошибка', description: 'Не удалось удалить этап', variant: 'destructive' });
    }
  };

  const addDecomposition = async (stageId: string, opts?: { pending?: boolean; initialCompletionDate?: string }) => {
    const stageRef = stages.find((s) => s.id === stageId);
    if (opts?.pending && stageRef) {
      const hasEmpty = stageRef.decompositions.some((d) => (d.description ?? "").trim() === "");
      if (hasEmpty) {
        return;
      }
    }
    try {
      const nextOrder = (stageRef?.decompositions.length || 0);
      // дефолты из списков
      const defCategoryName = typeOfWorkOptions[0] || '';
      const defCategoryId = categoryNameToId.get(defCategoryName) || null;
      const defDifficultyName = difficultyOptions[0] || '';
      const defDifficultyId = defDifficultyName ? (difficultyNameToId.get(defDifficultyName) || null) : null;
      const defStatusName = (statuses.find((s) => /план/i.test(s.name))?.name ?? statusOptions[0]) || '';
      const defStatusId = defStatusName ? (statusNameToId.get(defStatusName) || null) : null;

      const { data, error } = await supabase
        .from('decomposition_items')
        .insert({
          decomposition_item_section_id: sectionId,
          decomposition_item_description: '',
          decomposition_item_work_category_id: defCategoryId,
          decomposition_item_planned_hours: 0,
          decomposition_item_order: nextOrder,
          decomposition_item_planned_due_date: opts?.initialCompletionDate ?? new Date().toISOString().split('T')[0],
          decomposition_item_responsible: null,
          decomposition_item_status_id: defStatusId,
          decomposition_item_progress: 0,
          decomposition_item_stage_id: stageId === '__no_stage__' ? null : stageId,
          decomposition_item_difficulty_id: defDifficultyId,
        })
        .select('decomposition_item_id')
        .single();
      if (error) throw error;
      const newId = (data as any).decomposition_item_id as string;
      const newDecomposition: Decomposition = {
        id: newId,
        description: '',
        typeOfWork: defCategoryName,
        difficulty: defDifficultyName,
        responsible: '',
        plannedHours: 0,
        progress: 0,
        status: defStatusName,
        completionDate: opts?.initialCompletionDate ?? new Date().toISOString().split('T')[0],
      };
      setStages((prev) =>
        prev.map((stage) =>
          stage.id === stageId ? { ...stage, decompositions: [...stage.decompositions, newDecomposition] } : stage
        )
      );
      setFocusedDecompositionId(newId);
      if (opts?.pending) {
        setPendingNewDecomposition({ stageId, decompId: newId });
      } else {
        setPendingNewDecomposition(null);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Ошибка добавления строки:', e);
    }
  };

  // Функция-обёртка для открытия диалога подтверждения удаления декомпозиции
  const deleteDecomposition = (stageId: string, decompId: string) => {
    setDecompToDelete({ stageId, decompId });
    setDeleteDecompDialogOpen(true);
  };

  // Функция фактического удаления декомпозиции
  const confirmDeleteDecomposition = async () => {
    if (!decompToDelete) return;

    try {
      const { error } = await supabase
        .from('decomposition_items')
        .delete()
        .eq('decomposition_item_id', decompToDelete.decompId);
      if (error) throw error;
      setStages(
        stages.map((stage) =>
          stage.id === decompToDelete.stageId
            ? { ...stage, decompositions: stage.decompositions.filter((d) => d.id !== decompToDelete.decompId) }
            : stage
        )
      );
      setSelectedDecompositions((prev) => {
        const newSet = new Set(prev);
        newSet.delete(decompToDelete.decompId);
        return newSet;
      });
      if (pendingNewDecomposition && pendingNewDecomposition.decompId === decompToDelete.decompId) {
        setPendingNewDecomposition(null);
      }
      toast({ title: 'Успешно', description: 'Строка декомпозиции удалена' });
      setDeleteDecompDialogOpen(false);
      setDecompToDelete(null);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Ошибка удаления строки:', e);
      toast({ title: 'Ошибка', description: 'Не удалось удалить строку декомпозиции', variant: 'destructive' });
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

  const updateStage = async (stageId: string, updates: Partial<Stage>) => {
    setStages(stages.map((s) => (s.id === stageId ? { ...s, ...updates } : s)));
    if (stageId === '__no_stage__') return;
    try {
      const payload: any = {};
      if (updates.name !== undefined) payload.decomposition_stage_name = updates.name;
      if (updates.startDate !== undefined) payload.decomposition_stage_start = updates.startDate;
      if (updates.endDate !== undefined) payload.decomposition_stage_finish = updates.endDate;
      if (updates.description !== undefined) payload.decomposition_stage_description = updates.description;
      if (updates.statusId !== undefined) payload.decomposition_stage_status_id = updates.statusId;
      if (Object.keys(payload).length === 0) return;
      const { error } = await supabase
        .from('decomposition_stages')
        .update(payload)
        .eq('decomposition_stage_id', stageId);
      if (error) throw error;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Ошибка обновления этапа:', e);
    }
  };

  const updateStageResponsibles = async (stageId: string, responsibles: string[]) => {
    // Оптимистичное обновление
    setStages(stages.map((s) => (s.id === stageId ? { ...s, responsibles } : s)));
    if (stageId === '__no_stage__') return;
    try {
      const { error } = await supabase
        .from('decomposition_stages')
        .update({ decomposition_stage_responsibles: responsibles })
        .eq('decomposition_stage_id', stageId);
      if (error) throw error;
      toast({ title: 'Успешно', description: 'Ответственные обновлены' });
    } catch (e) {
      // Откатываем при ошибке
      const originalStage = stages.find(s => s.id === stageId);
      if (originalStage) {
        setStages(stages.map((s) => (s.id === stageId ? originalStage : s)));
      }
      console.error('Ошибка обновления ответственных:', e);
      toast({ title: 'Ошибка', description: 'Не удалось обновить ответственных', variant: 'destructive' });
    }
  };

  const updateDecomposition = async (stageId: string, decompId: string, updates: Partial<Decomposition>) => {
    setStages((prev) =>
      prev.map((stage) =>
        stage.id === stageId
          ? {
              ...stage,
              decompositions: stage.decompositions.map((d) => (d.id === decompId ? { ...d, ...updates } : d)),
            }
          : stage
      )
    );
    try {
      const payload: any = {};
      if (updates.description !== undefined) payload.decomposition_item_description = updates.description;
      if (updates.typeOfWork !== undefined) payload.decomposition_item_work_category_id = categoryNameToId.get(updates.typeOfWork) || null;
      if (updates.difficulty !== undefined) payload.decomposition_item_difficulty_id = difficultyNameToId.get(updates.difficulty) || null;
      if (updates.responsible !== undefined) payload.decomposition_item_responsible = updates.responsible ? (profileNameToId.get(updates.responsible) || null) : null;
      if (updates.plannedHours !== undefined) {
        const hours = Number(updates.plannedHours);
        payload.decomposition_item_planned_hours = isNaN(hours) || hours < 0 ? 0 : hours;
      }
      if (updates.progress !== undefined) {
        const progress = Number(updates.progress);
        payload.decomposition_item_progress = isNaN(progress) || progress < 0 ? 0 : Math.min(progress, 100);
      }
      if (updates.status !== undefined) payload.decomposition_item_status_id = statusNameToId.get(updates.status) || null;
      if (updates.completionDate !== undefined) payload.decomposition_item_planned_due_date = updates.completionDate || null;
      if (Object.keys(payload).length === 0) return;
      const { error } = await supabase
        .from('decomposition_items')
        .update(payload)
        .eq('decomposition_item_id', decompId);
      if (error) throw error;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Ошибка обновления строки:', e);
    }
  };

  const handleStageDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = stages.findIndex((item) => item.id === active.id);
      const newIndex = stages.findIndex((item) => item.id === over.id);
      const updated = arrayMove(stages, oldIndex, newIndex);
      setStages(updated);
      try {
        // пропускаем '__no_stage__'
        const realStages = updated.filter(s => s.id !== '__no_stage__');
        await Promise.all(realStages.map((s, idx) => supabase
          .from('decomposition_stages')
          .update({ decomposition_stage_order: idx + 1 })
          .eq('decomposition_stage_id', s.id)
        ));
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Ошибка обновления порядка этапов:', e);
      }
    }
  };

  const handleDecompositionDragEnd = async (stageId: string, event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const updatedStages = stages.map((stage) => {
          if (stage.id === stageId) {
            const oldIndex = stage.decompositions.findIndex((d) => d.id === active.id);
            const newIndex = stage.decompositions.findIndex((d) => d.id === over.id);
            return {
              ...stage,
              decompositions: arrayMove(stage.decompositions, oldIndex, newIndex),
            };
          }
          return stage;
        });
      setStages(updatedStages);
      // Обновим порядок в БД
      try {
        const target = updatedStages.find((s) => s.id === stageId);
        const items = target?.decompositions || [];
        await Promise.all(items.map((it, index) => supabase
          .from('decomposition_items')
          .update({ decomposition_item_order: index })
          .eq('decomposition_item_id', it.id)
        ));
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Ошибка обновления порядка строк:', e);
      }
    }
  };

  const handleDecompositionInteract = (decompId: string) => {
    if (pendingNewDecomposition && pendingNewDecomposition.decompId === decompId) {
      setPendingNewDecomposition(null);
    }
  };

  const handlePaste = async () => {
    if (!pasteText.trim()) {
      toast({
        title: "Ошибка",
        description: "Пожалуйста, вставьте данные для импорта",
        variant: "destructive",
      });
      return;
    }

    try {
      // Значения по умолчанию на случай пустых полей в вставке
      const defaultCategoryId = categories[0]?.work_category_id ?? null;
      const defaultDifficultyId = difficulties[0]?.difficulty_id ?? null;
      const defaultStatusId =
        (statuses.find((s) => /план/i.test(s.name))?.id) ?? statuses[0]?.id ?? null;

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

      // 1) Построим карту существующих этапов по названию (только реальные, без "__no_stage__")
      const existingByName = new Map<string, { id: string; startDate: string | null; endDate: string | null; decompositionsCount: number }>();
      stages.filter((s) => s.id !== "__no_stage__").forEach((s) => {
        existingByName.set(s.name, { id: s.id, startDate: s.startDate ?? null, endDate: s.endDate ?? null, decompositionsCount: s.decompositions.length });
      });

      // Соберём список имён этапов из вставки
      const stageNamesFromPaste = new Set<string>();
      stageRows.forEach((r) => stageNamesFromPaste.add(r.name));
      stageMap.forEach((_, name) => stageNamesFromPaste.add(name));

      // 2) Создадим недостающие этапы
      const toCreate: Array<{ name: string; start: string; finish: string; order: number }> = [];
      const realStagesCount = stages.filter((s) => s.id !== "__no_stage__").length;
      let orderBase = realStagesCount;
      for (const name of stageNamesFromPaste) {
        if (!existingByName.has(name)) {
          const row = stageRows.find((r) => r.name === name);
          toCreate.push({ name, start: row?.startDate ?? today, finish: row?.endDate ?? today, order: ++orderBase });
        }
      }

      if (toCreate.length > 0) {
        const { data: created, error: createErr } = await supabase
          .from('decomposition_stages')
          .insert(toCreate.map((x) => ({
            decomposition_stage_section_id: sectionId,
            decomposition_stage_name: x.name,
            decomposition_stage_start: x.start,
            decomposition_stage_finish: x.finish,
            decomposition_stage_order: x.order,
          })))
          .select('decomposition_stage_id, decomposition_stage_name, decomposition_stage_start, decomposition_stage_finish');
        if (createErr) throw createErr;
        (created as any[]).forEach((row) => {
          existingByName.set(row.decomposition_stage_name, {
            id: row.decomposition_stage_id,
            startDate: row.decomposition_stage_start || null,
            endDate: row.decomposition_stage_finish || null,
            decompositionsCount: 0,
          });
        });
      }

      // 3) Обновим даты этапов, если пришли изменения
      const updates = stageRows
        .map((r) => ({
          id: existingByName.get(r.name)?.id,
          start: r.startDate,
          end: r.endDate,
        }))
        .filter((u) => Boolean(u.id)) as Array<{ id: string; start?: string; end?: string }>;

      await Promise.all(
        updates.map((u) =>
          supabase
            .from('decomposition_stages')
            .update({
              ...(u.start ? { decomposition_stage_start: u.start } : {}),
              ...(u.end ? { decomposition_stage_finish: u.end } : {}),
            })
            .eq('decomposition_stage_id', u.id!)
        )
      );

      // 4) Подготовим и вставим декомпозиции
      type PendingItem = { stageId: string | null; payload: any };
      const itemsToInsert: PendingItem[] = [];
      const perStageOrder = new Map<string, number>();
      stages.forEach((s) => {
        if (s.id === "__no_stage__") return;
        perStageOrder.set(s.id, s.decompositions.length);
      });

      stageMap.forEach((data, stageName) => {
        const info = existingByName.get(stageName);
        const targetStageId = info?.id ?? null; // теоретически всегда есть после создавания
        let order = targetStageId ? (perStageOrder.get(targetStageId) ?? 0) : 0;
        for (const d of data.decompositions) {
          const categoryId = (d.typeOfWork ? (categoryNameToId.get(d.typeOfWork) || null) : null) ?? defaultCategoryId;
          const difficultyId = (d.difficulty ? (difficultyNameToId.get(d.difficulty) || null) : null) ?? defaultDifficultyId;
          const statusId = (d.status ? (statusNameToId.get(d.status) || null) : null) ?? defaultStatusId;
          const responsibleId = d.responsible ? (profileNameToId.get(d.responsible) || null) : null;

          const payload: any = {
            decomposition_item_section_id: sectionId,
            decomposition_item_description: d.description || '',
            decomposition_item_work_category_id: categoryId,
            decomposition_item_planned_hours: Number(d.plannedHours) || 0,
            decomposition_item_order: order++,
            decomposition_item_planned_due_date: d.completionDate || today,
            decomposition_item_responsible: responsibleId,
            decomposition_item_status_id: statusId,
            decomposition_item_progress: Number(d.progress) || 0,
            decomposition_item_stage_id: targetStageId, // null означает "без этапа"
            decomposition_item_difficulty_id: difficultyId,
          };
          itemsToInsert.push({ stageId: targetStageId, payload });
        }
        if (targetStageId) perStageOrder.set(targetStageId, order);
      });

      if (itemsToInsert.length > 0) {
        const { error: itemsErr } = await supabase
          .from('decomposition_items')
          .insert(itemsToInsert.map((i) => i.payload));
        if (itemsErr) throw itemsErr;
      }

      // 5) Обновим локальное состояние, перезагрузив из БД, чтобы гарантировать корректные id и данные
      try {
        const { data, error } = await supabase.rpc('get_decomposition_bootstrap', { p_section_id: sectionId });
        if (error) throw error;
        const json: any = data as any;
        const cats = json?.categories || [];
        const diffs = json?.difficultyLevels || [];
        const stats = json?.statuses || [];
        const profs = json?.profiles || [];
        const stgsRaw = (json?.stages || []) as any[];
        const itemsRaw = (json?.items || []) as any[];
        setCategories(cats);
        setDifficulties(diffs);
        setStatuses(stats);
        setProfiles(profs);
        const stageMapReload = new Map<string, Stage>();
        stgsRaw.forEach(s => {
          stageMapReload.set(s.decomposition_stage_id, {
            id: s.decomposition_stage_id,
            name: s.decomposition_stage_name,
            startDate: s.decomposition_stage_start || null,
            endDate: s.decomposition_stage_finish || null,
            description: s.decomposition_stage_description || null,
            statusId: s.decomposition_stage_status_id || null,
            responsibles: s.decomposition_stage_responsibles || [],
            decompositions: [],
          });
        });
        itemsRaw.forEach(it => {
          const stageId = it.decomposition_item_stage_id || '__no_stage__';
          if (stageId === '__no_stage__' && !stageMapReload.has('__no_stage__')) {
            stageMapReload.set('__no_stage__', { id: '__no_stage__', name: 'Без этапа', startDate: null, endDate: null, description: null, statusId: null, responsibles: [], decompositions: [] });
          }
          const stage = stageMapReload.get(stageId);
          if (!stage) return;
          const respName = it.profiles ? ((it.profiles.first_name + ' ' + it.profiles.last_name).trim() || it.profiles.email) : '';
          const statusName = it.section_statuses ? it.section_statuses.name : '';
          const decomp: Decomposition = {
            id: it.decomposition_item_id,
            description: it.decomposition_item_description || '',
            typeOfWork: (cats.find((c: any) => c.work_category_id === it.decomposition_item_work_category_id)?.work_category_name) || '',
            difficulty: (diffs.find((d: any) => d.difficulty_id === it.decomposition_item_difficulty_id)?.difficulty_abbr) || '',
            responsible: respName,
            plannedHours: Number(it.decomposition_item_planned_hours || 0),
            progress: Number(it.decomposition_item_progress || 0),
            status: statusName || '',
            completionDate: it.decomposition_item_planned_due_date || null,
          };
          stage.decompositions.push(decomp);
        });
        setStages(Array.from(stageMapReload.values()));
      } catch {
        // Если перезагрузка не удалась, оставим текущее состояние как есть
      }

      setPasteText("");
      setShowPasteDialog(false);

      const importedDecompsCount = Array.from(stageMap.values()).reduce((acc, v) => acc + v.decompositions.length, 0);
      const createdStagesCount = toCreate.length;
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
    try {
      let decompositionTable =
        "| Название этапа | Описание декомпозиции (название) | Тип работ | Сложность | Отвественный | Плановые часы | Статус | Дата (декомпозиции) |\n";
      decompositionTable += "|---|---|---|---|---|---|---|---|\n";

      stages.forEach((stage) => {
        stage.decompositions.forEach((decomp) => {
          decompositionTable += `| ${stage.name} | ${decomp.description} | ${decomp.typeOfWork} | ${decomp.difficulty} | ${decomp.responsible} | ${decomp.plannedHours} | ${decomp.status} | ${decomp.completionDate || ''} |\n`;
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

  // Handlers для работы с шаблонами
  const handleApplyTemplate = async (templateId: string) => {
    try {
      // Подготовить статусы для передачи в applyTemplate
      const statusesForTemplate = statuses.map(s => ({ id: s.id, name: s.name }));
      const newStages = await applyTemplate(templateId, sectionId, statusesForTemplate);
      // Преобразовать newStages, добавив поле responsibles для совместимости с локальным типом Stage
      const newStagesWithResponsibles = newStages.map(stage => ({
        ...stage,
        responsibles: [] as string[]
      }));
      // Добавить новые этапы в state БЕЗ перезагрузки страницы
      setStages([...stages, ...newStagesWithResponsibles]);
      toast({
        title: "Успешно",
        description: "Шаблон успешно применен",
      });
    } catch (error) {
      console.error('Ошибка применения шаблона:', error);
      const errorMessage = error instanceof Error ? error.message : 'Не удалось применить шаблон';
      toast({
        title: "Ошибка",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleSaveTemplate = async (departmentId: string, name: string) => {
    if (!userId) {
      toast({
        title: "Ошибка",
        description: "Пользователь не авторизован",
        variant: "destructive",
      });
      return;
    }

    try {
      // Подготовить этапы для сохранения (исключить __no_stage__)
      const validStages = stages.filter(s => s.id !== '__no_stage__');

      const templateStages: TemplateStage[] = validStages.map((stage, index) => ({
        name: stage.name,
        order: index,
        items: stage.decompositions.map((decomp, itemIndex) => {
          const categoryId = categoryNameToId.get(decomp.typeOfWork);
          if (!categoryId) {
            throw new Error(`Категория работы "${decomp.typeOfWork}" не найдена в справочнике`);
          }
          const difficultyId = difficultyNameToId.get(decomp.difficulty) || null;

          return {
            description: decomp.description,
            workCategoryId: categoryId,
            workCategoryName: decomp.typeOfWork,
            difficultyId: difficultyId,
            difficultyName: decomp.difficulty || null,
            plannedHours: decomp.plannedHours,
          };
        })
      }));

      await saveTemplate(name, departmentId, templateStages, userId);

      toast({
        title: "Успешно",
        description: "Шаблон успешно сохранен",
      });
    } catch (error) {
      console.error('Ошибка сохранения шаблона:', error);
      const errorMessage = error instanceof Error ? error.message : 'Не удалось сохранить шаблон';
      toast({
        title: "Ошибка",
        description: errorMessage,
        variant: "destructive",
      });
      throw error;
    }
  };

  const confirmBulkDeleteStages = async () => {
    if (selectedStages.size === 0) {
      toast({
        title: "Ошибка",
        description: "Не выбраны этапы для удаления",
        variant: "destructive",
      });
      return;
    }

    setBulkDeleteStagesDialogOpen(false);

    const allIds = Array.from(selectedStages);
    const realIds = allIds.filter((id) => id !== "__no_stage__");
    const includeNoStage = allIds.includes("__no_stage__");

    try {
      // 1) Удаляем декомпозиции реальных этапов
      if (realIds.length > 0) {
        const { error: itemsErr } = await supabase
          .from('decomposition_items')
          .delete()
          .in('decomposition_item_stage_id', realIds);
        if (itemsErr) throw itemsErr;
      }

      // 1b) Удаляем элементы без этапа для текущего раздела, если выбран "Без этапа"
      if (includeNoStage) {
        const { error: noStageItemsErr } = await supabase
          .from('decomposition_items')
          .delete()
          .eq('decomposition_item_section_id', sectionId)
          .is('decomposition_item_stage_id', null);
        if (noStageItemsErr) throw noStageItemsErr;
      }

      // 2) Удаляем сами этапы (только реальные)
      if (realIds.length > 0) {
        const { error: stagesErr } = await supabase
          .from('decomposition_stages')
          .delete()
          .in('decomposition_stage_id', realIds);
        if (stagesErr) throw stagesErr;
      }

      setStages((prev) => prev.filter((s) => !selectedStages.has(s.id)));
      setSelectedStages(new Set());
      setSelectedDecompositions(new Set());

      const deletedCount = realIds.length + (includeNoStage ? 1 : 0);
      toast({
        title: "Успешно",
        description: `Удалено этапов: ${deletedCount}`,
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Ошибка пакетного удаления этапов:', e);
      toast({ title: "Ошибка", description: "Не удалось удалить этапы", variant: "destructive" });
    }
  };

  const confirmBulkDeleteDecompositions = async () => {
    if (selectedDecompositions.size === 0) {
      toast({ title: "Ошибка", description: "Не выбраны декомпозиции для удаления", variant: "destructive" });
      return;
    }

    setBulkDeleteDecompsDialogOpen(false);

    const ids = Array.from(selectedDecompositions);
    const count = ids.length;

    try {
      const { error } = await supabase
        .from('decomposition_items')
        .delete()
        .in('decomposition_item_id', ids);
      if (error) throw error;

      setStages((prev) =>
        prev.map((stage) => ({
          ...stage,
          decompositions: stage.decompositions.filter((d) => !selectedDecompositions.has(d.id)),
        }))
      );
      setSelectedDecompositions(new Set());

      toast({ title: "Успешно", description: `Удалено декомпозиций: ${count}` });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Ошибка пакетного удаления декомпозиций:', e);
      toast({ title: "Ошибка", description: "Не удалось удалить декомпозиции", variant: "destructive" });
    }
  };

  // Функции-обертки для открытия диалогов подтверждения
  const bulkDeleteStages = () => {
    if (selectedStages.size === 0) {
      toast({
        title: "Ошибка",
        description: "Не выбраны этапы для удаления",
        variant: "destructive",
      });
      return;
    }
    setBulkDeleteStagesDialogOpen(true);
  };

  const bulkDeleteDecompositions = () => {
    if (selectedDecompositions.size === 0) {
      toast({ title: "Ошибка", description: "Не выбраны декомпозиции для удаления", variant: "destructive" });
      return;
    }
    setBulkDeleteDecompsDialogOpen(true);
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
        const statusName = stage.statusId ? statuses.find(s => s.id === stage.statusId)?.name || 'Нет' : 'Нет';
        text += `Этап: ${stage.name}\nОписание: ${stage.description || 'Нет описания'}\nСтатус: ${statusName}\nДата начала: ${stage.startDate}\nДата завершения: ${stage.endDate}\n\n`;
        text += "Декомпозиции:\n";
        text += "| Описание | Тип работ | Сложность | Ответственный | Часы | Прогресс | Статус | Дата |\n";
        text += "|---|---|---|---|---|---|---|---|\n";
        stage.decompositions.forEach((d) => {
          text += `| ${d.description} | ${d.typeOfWork} | ${d.difficulty} | ${d.responsible} | ${d.plannedHours} | ${d.progress}% | ${d.status} | ${d.completionDate || ''} |\n`;
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
          description: stage.description,
          statusId: stage.statusId,
          responsibles: stage.responsibles,
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

  const toggleStageCollapsed = (stageId: string) => {
    setCollapsedStageIds((prev) => {
      const next = new Set(prev);
      if (next.has(stageId)) next.delete(stageId);
      else next.add(stageId);
      return next;
    });
  };

  const collapseAllStages = () => {
    setCollapsedStageIds(new Set(stages.map((s) => s.id)));
  };

  const expandAllStages = () => {
    setCollapsedStageIds(new Set());
  };

  return (
    <div className="min-h-[60vh] bg-background dark:bg-slate-900 relative px-4 pb-4 pt-2">
      <div className="w-full">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-foreground">Управление этапами</h1>

            {/* Левая группа - иконки */}
            <div className="flex gap-1 ml-2">
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopy}
                className="h-8 w-8 bg-transparent"
                title="Копировать"
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowPasteDialog(true)}
                className="h-8 w-8 bg-transparent"
                title="Вставить"
              >
                <ClipboardPaste className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  const allCollapsed = stages.length > 0 && stages.every((s) => collapsedStageIds.has(s.id));
                  allCollapsed ? expandAllStages() : collapseAllStages();
                }}
                className="h-8 w-8 bg-transparent"
                title={stages.length > 0 && stages.every((s) => collapsedStageIds.has(s.id)) ? "Развернуть все" : "Свернуть все"}
              >
                {stages.length > 0 && stages.every((s) => collapsedStageIds.has(s.id))
                  ? <ChevronsUp className="h-4 w-4" />
                  : <ChevronsDown className="h-4 w-4" />
                }
              </Button>
            </div>
          </div>

          {/* Правая группа - текстовые кнопки */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9 bg-transparent transition-transform active:scale-95"
              onClick={() => setTemplatesDialogOpen(true)}
            >
              <FolderOpen className="mr-2 h-4 w-4" />
              Применить шаблон
            </Button>
            {hasManagePermission && (
              <Button
                variant="outline"
                size="sm"
                className="h-9 bg-transparent transition-transform active:scale-95"
                onClick={() => setSaveDialogOpen(true)}
                disabled={stages.length === 0 || stages.every(s => s.id === '__no_stage__')}
              >
                <Save className="mr-2 h-4 w-4" />
                Сохранить как шаблон
              </Button>
            )}
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
                  updateStageResponsibles={updateStageResponsibles}
                  updateDecomposition={updateDecomposition}
                  onDecompositionDragEnd={handleDecompositionDragEnd}
                  focusedDecompositionId={focusedDecompositionId}
                  pendingNewDecompositionId={
                    pendingNewDecomposition && pendingNewDecomposition.stageId === stage.id
                      ? pendingNewDecomposition.decompId
                      : null
                  }
                  onDecompositionInteract={handleDecompositionInteract}
                  typeOfWorkOptions={typeOfWorkOptions}
                  difficultyOptions={difficultyOptions}
                  responsibleOptions={responsibleOptions}
                  statusOptions={statusOptions}
                  statuses={statuses}
                  employees={employees}
                  formatProfileLabel={formatProfileLabel}
                  isCollapsed={collapsedStageIds.has(stage.id)}
                  onToggleCollapse={toggleStageCollapsed}
                  onOpenLog={onOpenLog}
                  actualByItemId={actualByItemId}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <div className="mt-6">
          <DecompositionStagesChart stages={chartStages} />
        </div>

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

        {/* Диалоги шаблонов */}
        <TemplatesDialog
          isOpen={templatesDialogOpen}
          onClose={() => setTemplatesDialogOpen(false)}
          onApply={handleApplyTemplate}
          hasManagePermission={hasManagePermission}
        />

        <SaveTemplateDialog
          isOpen={saveDialogOpen}
          onClose={() => setSaveDialogOpen(false)}
          onSave={handleSaveTemplate}
        />

        {/* Диалог подтверждения удаления этапа */}
        <AlertDialog open={deleteStageDialogOpen} onOpenChange={setDeleteStageDialogOpen}>
          <AlertDialogContent className="dark:!bg-slate-800 dark:!border-slate-600">
            <AlertDialogHeader>
              <AlertDialogTitle>Удалить этап?</AlertDialogTitle>
              <AlertDialogDescription>
                Вы уверены, что хотите удалить этот этап? Все декомпозиции в этом этапе также будут удалены. Это действие нельзя отменить.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => { setDeleteStageDialogOpen(false); setStageToDelete(null); }}>
                Отмена
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDeleteStage}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Удалить
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Диалог подтверждения удаления строки декомпозиции */}
        <AlertDialog open={deleteDecompDialogOpen} onOpenChange={setDeleteDecompDialogOpen}>
          <AlertDialogContent className="dark:!bg-slate-800 dark:!border-slate-600">
            <AlertDialogHeader>
              <AlertDialogTitle>Удалить строку декомпозиции?</AlertDialogTitle>
              <AlertDialogDescription>
                Вы уверены, что хотите удалить эту строку декомпозиции? Это действие нельзя отменить.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => { setDeleteDecompDialogOpen(false); setDecompToDelete(null); }}>
                Отмена
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDeleteDecomposition}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Удалить
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Диалог подтверждения массового удаления этапов */}
        <AlertDialog open={bulkDeleteStagesDialogOpen} onOpenChange={setBulkDeleteStagesDialogOpen}>
          <AlertDialogContent className="dark:!bg-slate-800 dark:!border-slate-600">
            <AlertDialogHeader>
              <AlertDialogTitle>Удалить выбранные этапы?</AlertDialogTitle>
              <AlertDialogDescription>
                Вы уверены, что хотите удалить {selectedStages.size} {selectedStages.size === 1 ? 'этап' : 'этапов'}? Все декомпозиции в этих этапах также будут удалены. Это действие нельзя отменить.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setBulkDeleteStagesDialogOpen(false)}>
                Отмена
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmBulkDeleteStages}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Удалить
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Диалог подтверждения массового удаления декомпозиций */}
        <AlertDialog open={bulkDeleteDecompsDialogOpen} onOpenChange={setBulkDeleteDecompsDialogOpen}>
          <AlertDialogContent className="dark:!bg-slate-800 dark:!border-slate-600">
            <AlertDialogHeader>
              <AlertDialogTitle>Удалить выбранные декомпозиции?</AlertDialogTitle>
              <AlertDialogDescription>
                Вы уверены, что хотите удалить {selectedDecompositions.size} {selectedDecompositions.size === 1 ? 'декомпозицию' : 'декомпозиций'}? Это действие нельзя отменить.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setBulkDeleteDecompsDialogOpen(false)}>
                Отмена
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmBulkDeleteDecompositions}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Удалить
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      {isInitialLoading && (
        <div className="absolute inset-0 z-50 grid place-items-center bg-background/60">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
