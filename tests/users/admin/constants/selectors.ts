/**
 * Selectors for Admin Panel tests
 *
 * Based on actual component structure from:
 * - AdminPanel.tsx
 * - SubdivisionsTab.tsx
 * - DepartmentsTab.tsx
 * - TeamsTab.tsx
 * - PositionsTab.tsx (EntityTab)
 * - CategoriesTab.tsx (EntityTab)
 * - EntityModal.tsx
 * - DeleteConfirmModal.tsx
 * - SubdivisionHeadModal.tsx
 * - DepartmentHeadModal.tsx
 * - TeamHeadModal.tsx
 * - RemoveHeadConfirmModal.tsx
 */

export const SELECTORS = {
  // ===========================================================================
  // Admin Panel Tabs
  // ===========================================================================
  TABS: {
    // Admin panel tabs have mb-6 class to differentiate from main user tabs
    LIST: '[role="tablist"].mb-6',
    SUBDIVISIONS: '[role="tab"]:has-text("Подразделения")',
    DEPARTMENTS: '[role="tab"]:has-text("Отделы")',
    TEAMS: '[role="tab"]:has-text("Команды")',
    POSITIONS: '[role="tab"]:has-text("Должности")',
    CATEGORIES: '[role="tab"]:has-text("Категории")',
    ROLES: '[role="tab"]:has-text("Управление ролями")',
  },

  // ===========================================================================
  // Common Table Elements (used in all tabs)
  // ===========================================================================
  TABLE: {
    CONTAINER: 'table',
    HEADER: 'thead',
    BODY: 'tbody',
    ROW: 'tr',
    CELL: 'td',
    HEADER_CELL: 'th',
  },

  // ===========================================================================
  // Common Controls (search, buttons)
  // ===========================================================================
  CONTROLS: {
    // Search inputs by placeholder
    SEARCH_SUBDIVISIONS: 'input[placeholder="Поиск подразделений..."]',
    SEARCH_DEPARTMENTS: 'input[placeholder="Поиск отделов..."]',
    SEARCH_TEAMS: 'input[placeholder="Поиск команд..."]',
    SEARCH_POSITIONS: 'input[placeholder="Поиск должностей..."]',
    SEARCH_CATEGORIES: 'input[placeholder="Поиск категорий..."]',

    // Create buttons
    CREATE_SUBDIVISION: 'button:has-text("Создать подразделение")',
    CREATE_DEPARTMENT: 'button:has-text("Создать отдел")',
    CREATE_TEAM: 'button:has-text("Создать команду")',
    CREATE_POSITION: 'button:has-text("Создать должность")',
    CREATE_CATEGORY: 'button:has-text("Создать категорию")',

    // Action buttons in table rows
    EDIT_BTN: 'button:has-text("Изменить")',
    DELETE_BTN: 'button:has-text("Удалить")',
    ASSIGN_TO_TEAM_BTN: 'button:has-text("Назначить в команду")',

    // Refresh button
    REFRESH_BTN: 'button:has-text("Обновить")',
    REFRESH_BTN_LOADING: 'button:has-text("Обновление...")',
  },

  // ===========================================================================
  // Head Management (Subdivisions, Departments, Teams)
  // ===========================================================================
  HEAD_MANAGEMENT: {
    // Edit button for head (pencil icon in head column)
    EDIT_HEAD_BTN: 'button:has(svg.lucide-edit-2)',
    // Popover actions
    ASSIGN_HEAD: 'button:has-text("Назначить")',
    CHANGE_HEAD: 'button:has-text("Сменить")',
    REMOVE_HEAD: 'button:has-text("Убрать")',
    // Head display
    HEAD_NOT_ASSIGNED: ':has-text("Не назначен")',
  },

  // ===========================================================================
  // Entity Modal (Create/Edit)
  // ===========================================================================
  ENTITY_MODAL: {
    MODAL: '[role="dialog"]',
    TITLE: '[role="dialog"] h2, [role="dialog"] [class*="text-lg"]',

    // Form inputs - EntityModal uses nameField as id
    NAME_INPUT_SUBDIVISION: '[role="dialog"] input#subdivision_name',
    NAME_INPUT_DEPARTMENT: '[role="dialog"] input#department_name',
    NAME_INPUT_TEAM: '[role="dialog"] input#team_name',
    NAME_INPUT_POSITION: '[role="dialog"] input#position_name',
    NAME_INPUT_CATEGORY: '[role="dialog"] input#category_name',

    // Generic input (by examining structure)
    NAME_INPUT: '[role="dialog"] input:not([type="checkbox"])',

    // Extra fields (select dropdowns)
    SUBDIVISION_SELECT: '[role="dialog"] button:has-text("Выберите")',
    DEPARTMENT_SELECT: '[role="dialog"] button:has-text("Выберите")',

    // Validation errors
    ERROR_MESSAGE: '[role="dialog"] .text-red-500',

    // Buttons
    CANCEL_BTN: '[role="dialog"] button:has-text("Отмена")',
    SAVE_BTN: '[role="dialog"] button:has-text("Сохранить")',
    SAVE_BTN_LOADING: '[role="dialog"] button:has-text("Сохранение...")',
  },

  // ===========================================================================
  // Delete Confirm Modal
  // ===========================================================================
  DELETE_MODAL: {
    // Find delete modal by the "Удалить" button (RemoveHeadModal has "Убрать" instead)
    MODAL: '[role="dialog"]:has(button:has-text("Удалить"))',
    TITLE: '[role="dialog"] h2, [role="dialog"] [class*="text-lg"]',
    MESSAGE: '[role="dialog"] p',
    CANCEL_BTN: '[role="dialog"] button:has-text("Отмена")',
    DELETE_BTN: '[role="dialog"] button:has-text("Удалить")',
    DELETE_BTN_LOADING: '[role="dialog"] button:has-text("Удаление...")',
  },

  // ===========================================================================
  // Head Assignment Modal (Subdivisions, Departments, Teams)
  // ===========================================================================
  HEAD_MODAL: {
    MODAL: '[role="dialog"]:has(button:has-text("Назначить"))',
    SEARCH_INPUT: '[role="dialog"] input[placeholder*="Поиск"]',
    USER_LIST: '[role="dialog"] .overflow-y-auto',
    USER_ITEM: '[role="dialog"] .cursor-pointer',
    USER_SELECTED: '[role="dialog"] .border-primary',
    CANCEL_BTN: '[role="dialog"] button:has-text("Отмена")',
    ASSIGN_BTN: '[role="dialog"] button:has-text("Назначить")',
    ASSIGN_BTN_LOADING: '[role="dialog"] button:has-text("Назначение...")',
  },

  // ===========================================================================
  // Remove Head Confirm Modal
  // ===========================================================================
  REMOVE_HEAD_MODAL: {
    // Find remove head modal by the "Убрать" button (DeleteModal has "Удалить" instead)
    MODAL: '[role="dialog"]:has(button:has-text("Убрать"))',
    CANCEL_BTN: '[role="dialog"] button:has-text("Отменить")',
    REMOVE_BTN: '[role="dialog"] button:has-text("Убрать")',
    REMOVE_BTN_LOADING: '[role="dialog"] button:has-text("Удаление...")',
  },

  // ===========================================================================
  // Teams Tab specific (department filter buttons)
  // ===========================================================================
  TEAMS_TAB: {
    ALL_DEPARTMENTS_BTN: 'button:has-text("Все отделы")',
    DEPARTMENT_FILTER_BTN: '.flex.flex-wrap.gap-2 button',
  },

  // ===========================================================================
  // Empty states
  // ===========================================================================
  EMPTY_STATE: {
    MESSAGE: '.text-center.text-muted-foreground',
    CREATE_FIRST_BTN: 'button:has-text("Создать перв")', // matches "Создать первое/первую/первый"
  },

  // ===========================================================================
  // Loading states
  // ===========================================================================
  LOADING: {
    SKELETON: '.animate-pulse',
    SPINNER: '.animate-spin',
  },

  // ===========================================================================
  // Toast notifications (Sonner)
  // ===========================================================================
  TOAST: {
    SUCCESS: '[data-sonner-toast][data-type="success"]',
    ERROR: '[data-sonner-toast][data-type="error"]',
    CONTAINER: '[data-sonner-toaster]',
  },
} as const

/**
 * Routes for Admin Panel
 */
export const ROUTES = {
  USERS: '/dashboard/users',
  ADMIN: '/dashboard/users?tab=admin',
} as const

/**
 * Test data prefixes and names
 *
 * IMPORTANT: Names must follow validation rule:
 * Only Russian letters, digits, spaces, and hyphens are allowed
 */
export const TEST_DATA = {
  PREFIX: 'АВТОТЕСТ-',

  // Full names for test entities
  SUBDIVISION: 'АВТОТЕСТ-Подразделение',
  DEPARTMENT: 'АВТОТЕСТ-Отдел',
  TEAM: 'АВТОТЕСТ-Команда',
  POSITION: 'АВТОТЕСТ-Должность',
  CATEGORY: 'АВТОТЕСТ-Категория',

  // Updated names (for edit tests)
  SUBDIVISION_UPDATED: 'АВТОТЕСТ-Подразделение-2',
  DEPARTMENT_UPDATED: 'АВТОТЕСТ-Отдел-2',
  TEAM_UPDATED: 'АВТОТЕСТ-Команда-2',
  POSITION_UPDATED: 'АВТОТЕСТ-Должность-2',
  CATEGORY_UPDATED: 'АВТОТЕСТ-Категория-2',
} as const

/**
 * Empty state messages when search returns no results
 */
export const EMPTY_STATE_MESSAGES = {
  SUBDIVISIONS: 'Подразделения по вашему запросу не найдены',
  DEPARTMENTS: 'Отделы по вашему запросу не найдены',
  TEAMS: 'Команды по вашему запросу не найдены',
  POSITIONS: 'Должности по вашему запросу не найдены',
  CATEGORIES: 'Категории по вашему запросу не найдены',
} as const

/**
 * Timeouts for various operations
 */
export const TIMEOUTS = {
  PAGE_LOAD: 30000,
  DATA_LOAD: 10000,
  MODAL_ANIMATION: 500,
  TOAST_VISIBLE: 3000,
  DEBOUNCE: 300,
  SHORT: 500,
  MEDIUM: 1000,
  LONG: 3000,
} as const

/**
 * Tab types for type safety
 */
export type AdminTabType = 'subdivisions' | 'departments' | 'teams' | 'positions' | 'categories' | 'roles'

/**
 * Entity types for CRUD operations
 */
export type EntityType = 'subdivision' | 'department' | 'team' | 'position' | 'category'
