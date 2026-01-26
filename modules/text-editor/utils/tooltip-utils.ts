/**
 * Утилиты для работы с tooltip уведомлениями в редакторе
 */

export type TooltipState = {
  show: boolean
  message: string
  duration: number
}

export type TooltipSetter = (state: TooltipState | ((prev: TooltipState) => TooltipState)) => void

/**
 * Показывает tooltip с заданным сообщением и длительностью
 */
export function showTooltip(
  setTooltipState: TooltipSetter,
  message: string,
  duration: number = 3000
) {
  setTooltipState({
    show: true,
    message,
    duration
  })

  setTimeout(() => {
    setTooltipState(prev => ({ ...prev, show: false }))
  }, duration)
}

/**
 * Предопределенные сообщения для tooltip
 */
export const TOOLTIP_MESSAGES = {
  TABLE_BLOCKED: 'Невозможно создать таблицу внутри таблицы',
  TABLE_PIPE_WARNING: 'По техническим причинам все символы "|" внутри таблицы будут заменены на "/"',
  BLOCKQUOTE_TASK_BLOCKED: 'Невозможно создать чекбокс внутри цитаты',
  BLOCKQUOTE_LIST_BLOCKED: 'Невозможно создать список внутри цитаты',
  BLOCKQUOTE_LIST_WARNING: 'Списки внутри цитаты удаляются после закрытия заметки. Вы можете потерять данные. Постарайтесь избегать списков внутри цитат',
  BLOCKQUOTE_HEADER_WARNING: 'Заголовки внутри цитаты будут преобразованы в обычный текст после закрытия заметки',
  CODE_BLOCK_LIST_BLOCKED: 'Невозможно создать список внутри блока кода',
  TASK_LIST_TAB_BLOCKED: 'Невозможно создать отступ в чекбоксе. Используйте клавиши со стрелками для навигации',
} as const

/**
 * Хелперы для часто используемых tooltip
 */
export function createTooltipHelpers(setTooltipState: TooltipSetter) {
  return {
    showTableBlockedTooltip: () =>
      showTooltip(setTooltipState, TOOLTIP_MESSAGES.TABLE_BLOCKED, 3000),

    showTablePipeWarningTooltip: () =>
      showTooltip(setTooltipState, TOOLTIP_MESSAGES.TABLE_PIPE_WARNING, 5000),

    showBlockquoteTaskBlockedTooltip: () =>
      showTooltip(setTooltipState, TOOLTIP_MESSAGES.BLOCKQUOTE_TASK_BLOCKED, 3000),

    showBlockquoteListBlockedTooltip: () =>
      showTooltip(setTooltipState, TOOLTIP_MESSAGES.BLOCKQUOTE_LIST_BLOCKED, 3000),

    showBlockquoteListWarningTooltip: () =>
      showTooltip(setTooltipState, TOOLTIP_MESSAGES.BLOCKQUOTE_LIST_WARNING, 5000),

    showBlockquoteHeaderWarningTooltip: () =>
      showTooltip(setTooltipState, TOOLTIP_MESSAGES.BLOCKQUOTE_HEADER_WARNING, 4000),

    showCodeBlockListBlockedTooltip: () =>
      showTooltip(setTooltipState, TOOLTIP_MESSAGES.CODE_BLOCK_LIST_BLOCKED, 3000),

    showTaskListTabBlockedTooltip: () =>
      showTooltip(setTooltipState, TOOLTIP_MESSAGES.TASK_LIST_TAB_BLOCKED, 3000),
  }
}
