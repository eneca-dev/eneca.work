import { Diamond, FileCheck, ArrowRightFromLine, ArrowLeftToLine, CheckCircle2, Flag } from "lucide-react"
import type { MilestoneType } from "../types"

export interface MilestoneConfig {
  label: string
  icon: typeof Diamond
  bgClass: string
  borderClass: string
  textClass: string
}

export const milestoneConfig: Record<MilestoneType, MilestoneConfig> = {
  expertise_submission: {
    label: "Экспертиза",
    icon: FileCheck,
    bgClass: "bg-purple-500",
    borderClass: "border-purple-400",
    textClass: "text-purple-500",
  },
  task_transfer_out: {
    label: "Выдача",
    icon: ArrowRightFromLine,
    bgClass: "bg-orange-500",
    borderClass: "border-orange-400",
    textClass: "text-orange-500",
  },
  task_transfer_in: {
    label: "Приём",
    icon: ArrowLeftToLine,
    bgClass: "bg-sky-500",
    borderClass: "border-sky-400",
    textClass: "text-sky-500",
  },
  approval: {
    label: "Согласование",
    icon: CheckCircle2,
    bgClass: "bg-emerald-500",
    borderClass: "border-emerald-400",
    textClass: "text-emerald-500",
  },
  deadline: {
    label: "Дедлайн",
    icon: Flag,
    bgClass: "bg-red-500",
    borderClass: "border-red-400",
    textClass: "text-red-500",
  },
}
