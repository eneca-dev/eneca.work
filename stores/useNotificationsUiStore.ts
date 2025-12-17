import { create } from 'zustand'

/**
 * UI-only store для модуля уведомлений
 *
 * ВАЖНО: Этот store НЕ хранит данные уведомлений!
 * Данные управляются через TanStack Query (modules/notifications/hooks/use-notifications.ts)
 *
 * Этот store управляет только UI состоянием:
 * - Открыта ли панель
 * - Ширина панели
 * - Hover состояние
 * - Callback для обновления модулей
 */

interface NotificationsUiStore {
  // Panel state
  isPanelOpen: boolean
  panelWidthPx: number

  // Hover tracking (для стабильного hover при скролле)
  hoveredNotificationId: string | null
  lastPointerPosition: { x: number; y: number } | null

  // Module integration callback
  onModuleUpdate: ((entityType: string) => void) | null

  // Actions - Panel
  openPanel: () => void
  closePanel: () => void
  togglePanel: () => void
  setPanelWidth: (width: number) => void

  // Actions - Hover
  setHoveredNotification: (id: string | null) => void
  clearHoveredNotification: () => void
  setPointerPosition: (x: number, y: number) => void
  clearPointerPosition: () => void

  // Actions - Module integration
  setModuleUpdateCallback: (callback: ((entityType: string) => void) | null) => void
}

export const useNotificationsUiStore = create<NotificationsUiStore>((set) => ({
  // Initial state
  isPanelOpen: false,
  panelWidthPx: 420,
  hoveredNotificationId: null,
  lastPointerPosition: null,
  onModuleUpdate: null,

  // Panel actions
  openPanel: () => set({ isPanelOpen: true }),
  closePanel: () => set({ isPanelOpen: false }),
  togglePanel: () => set((state) => ({ isPanelOpen: !state.isPanelOpen })),
  setPanelWidth: (width: number) => set({ panelWidthPx: width }),

  // Hover actions
  setHoveredNotification: (id: string | null) => set({ hoveredNotificationId: id }),
  clearHoveredNotification: () => set({ hoveredNotificationId: null, lastPointerPosition: null }),
  setPointerPosition: (x: number, y: number) => set({ lastPointerPosition: { x, y } }),
  clearPointerPosition: () => set({ lastPointerPosition: null }),

  // Module integration
  setModuleUpdateCallback: (callback: ((entityType: string) => void) | null) =>
    set({ onModuleUpdate: callback }),
}))
