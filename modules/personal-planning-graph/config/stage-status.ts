import { CheckCircle2, PlayCircle, CircleDashed, PauseCircle, Search, Inbox } from "lucide-react"
import type { StageStatus } from "../types"

export interface StageStatusInfo {
  label: string
  icon: typeof CheckCircle2
  colorClass: string
  bgClass: string
}

export const stageStatusConfig: Record<StageStatus, StageStatusInfo> = {
  backlog: {
    label: "Бэклог",
    icon: Inbox,
    colorClass: "text-slate-400",
    bgClass: "bg-slate-400/20",
  },
  plan: {
    label: "План",
    icon: CircleDashed,
    colorClass: "text-violet-500",
    bgClass: "bg-violet-500/20",
  },
  in_progress: {
    label: "В работе",
    icon: PlayCircle,
    colorClass: "text-blue-500",
    bgClass: "bg-blue-500/20",
  },
  paused: {
    label: "Пауза",
    icon: PauseCircle,
    colorClass: "text-amber-500",
    bgClass: "bg-amber-500/20",
  },
  review: {
    label: "Проверка",
    icon: Search,
    colorClass: "text-cyan-500",
    bgClass: "bg-cyan-500/20",
  },
  done: {
    label: "Готово",
    icon: CheckCircle2,
    colorClass: "text-green-500",
    bgClass: "bg-green-500/20",
  },
}

export function getStageStatusInfo(status: StageStatus): StageStatusInfo {
  return stageStatusConfig[status]
}
