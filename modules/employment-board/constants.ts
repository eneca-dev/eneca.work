/**
 * Employment Board - Constants
 *
 * Отдельный файл, а не actions/index.ts: из файла с 'use server'
 * разрешено экспортировать только async-функции.
 */

/** Разрешение на просмотр доски занятости */
export const EMPLOYMENT_BOARD_VIEW = 'employment_board.view'

/** Разрешение на изменение доски (закрепление проектов, размещение сотрудников) */
export const EMPLOYMENT_BOARD_EDIT = 'employment_board.edit'

export type EmploymentBoardPermission =
  | typeof EMPLOYMENT_BOARD_VIEW
  | typeof EMPLOYMENT_BOARD_EDIT
