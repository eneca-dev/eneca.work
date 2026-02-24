/**
 * Единый маппинг иконок для модуля checkpoints
 *
 * Все иконки импортируются явно (не через wildcard) для оптимизации bundle size.
 * Это экономит ~50-100KB в production build.
 */

import {
  Flag,
  Bookmark,
  Star,
  AlertCircle,
  CheckCircle,
  Calendar,
  Clock,
  Target,
  Trophy,
  Award,
  FileCheck,
  FileText,
  Send,
  ArrowRightFromLine,
  Milestone,
  Rocket,
  Zap,
  Bell,
  Eye,
  Lock,
  Unlock,
  Shield,
  Heart,
  ThumbsUp,
  MessageSquare,
  CircleCheck,
  CircleDot,
  Hourglass,
  Timer,
  AlarmCheck,
  Sparkles,
  Flame,
  Bolt,
  TrendingUp,
  Activity,
  BarChart3,
  PieChart,
  LineChart,
  GitCommit,
  GitBranch,
  Users,
  User,
  UserCheck,
  Crown,
  Gem,
  Diamond,
  Box,
  Package,
  Inbox,
  Archive,
  FolderCheck,
  FolderOpen,
  Files,
  ClipboardCheck,
  Layers,
  CircleAlert,
  TriangleAlert,
  Info,
  HelpCircle,
  Ban,
  XCircle,
  MinusCircle,
  PlusCircle,
  Play,
  Pause,
  CircleDashed,
  Check,
  type LucideIcon,
} from 'lucide-react'

/**
 * Маппинг названий иконок на компоненты Lucide
 *
 * Используется в:
 * - CheckpointMarker.tsx - отображение маркеров
 * - IconColorPicker.tsx - выбор иконки
 * - CheckpointTypeSelector.tsx - отображение типов
 */
export const ICON_MAP: Record<string, LucideIcon> = {
  // Основные иконки чекпоинтов
  Flag,
  Bookmark,
  Star,
  AlertCircle,
  CheckCircle,
  Calendar,
  Clock,
  Target,
  Trophy,
  Award,

  // Документы и файлы
  FileCheck,
  FileText,
  Files,
  FolderCheck,
  FolderOpen,
  ClipboardCheck,

  // Действия и события
  Send,
  ArrowRightFromLine,
  Milestone,
  Rocket,
  Zap,
  Bell,

  // Состояния и индикаторы
  Eye,
  Lock,
  Unlock,
  Shield,
  Heart,
  ThumbsUp,
  MessageSquare,
  CircleCheck,
  CircleDot,

  // Время
  Hourglass,
  Timer,
  AlarmCheck,

  // Специальные эффекты
  Sparkles,
  Flame,
  Bolt,

  // Графики и аналитика
  TrendingUp,
  Activity,
  BarChart3,
  PieChart,
  LineChart,

  // Git и версионирование
  GitCommit,
  GitBranch,

  // Пользователи
  Users,
  User,
  UserCheck,

  // Награды
  Crown,
  Gem,
  Diamond,

  // Организация
  Box,
  Package,
  Inbox,
  Archive,
  Layers,

  // Предупреждения
  CircleAlert,
  TriangleAlert,
  Info,
  HelpCircle,
  Ban,
  XCircle,
  MinusCircle,
  PlusCircle,

  // Управление
  Play,
  Pause,

  // Вспомогательные
  CircleDashed,
  Check,
}

/**
 * Получить компонент иконки по названию
 *
 * @param iconName - Название иконки (например, 'Flag', 'Calendar')
 * @param fallback - Fallback иконка (по умолчанию HelpCircle)
 * @returns Компонент иконки Lucide
 *
 * @example
 * ```tsx
 * const IconComponent = getIcon('Flag')
 * return <IconComponent size={16} />
 * ```
 */
export function getIcon(iconName: string | null | undefined, fallback: LucideIcon = HelpCircle): LucideIcon {
  if (!iconName) return fallback
  return ICON_MAP[iconName] || fallback
}

// Re-export иконок для прямого использования
export {
  Flag,
  Check,
  CircleDashed,
  HelpCircle,
  type LucideIcon,
}
