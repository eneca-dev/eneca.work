/**
 * Selectors for Users module tests
 *
 * Based on actual component structure from users-list.tsx and users-page.tsx
 */
export const SELECTORS = {
  // Page containers
  PAGE: {
    USERS_PAGE: '.px-0.pt-0.pb-0',
    CURRENT_USER_CARD: '.mb-6',
    TABS_CONTAINER: '[role="tablist"]',
    LOADING_SPINNER: '.animate-spin',
  },

  // Tabs
  TABS: {
    LIST: '[role="tab"]:has-text("Список пользователей")',
    ADD_USER: '[role="tab"]:has-text("Ручное добавление")',
    ANALYTICS: '[role="tab"]:has-text("Аналитика")',
    ADMIN: '[role="tab"]:has-text("Администратор")',
  },

  // Users List
  USERS_LIST: {
    CARD: '.w-full', // Card wrapper
    TABLE: 'table',
    TABLE_ROW: 'tr',
    TABLE_CELL: 'td',
    EMPTY_STATE: ':has-text("Пользователи не найдены")',
  },

  // Search
  SEARCH: {
    INPUT: 'input[placeholder="Поиск сотрудников"]',
  },

  // Filter buttons (tooltips with icons)
  FILTERS: {
    // Subdivision filter button (Network icon)
    SUBDIVISION_BTN: 'button:has(svg.lucide-network)',
    // Department filter button (Building2 icon)
    DEPARTMENT_BTN: 'button:has(svg.lucide-building-2)',
    // Team filter button (first Users icon)
    TEAM_BTN: 'button:has(svg.lucide-users):nth-of-type(1)',
    // Position filter button (Briefcase icon)
    POSITION_BTN: 'button:has(svg.lucide-briefcase)',
    // Category filter button (Tag icon)
    CATEGORY_BTN: 'button:has(svg.lucide-tag)',
    // Role filter button (second Users icon)
    ROLE_BTN: 'button:has(svg.lucide-users):nth-of-type(2)',
    // Location filter button (Home icon)
    LOCATION_BTN: 'button:has(svg.lucide-home)',
    // Reset filters button (RotateCcw icon)
    RESET_BTN: 'button:has(svg.lucide-rotate-ccw)',
  },

  // Filter dropdowns
  FILTER_DROPDOWN: {
    CONTENT: '[role="menu"]',
    SEARCH_INPUT: '[role="menu"] input',
    CHECKBOX: '[role="menu"] input[type="checkbox"]',
    LABEL: '[role="menu"] label',
  },

  // Filter chips (badges)
  FILTER_CHIPS: {
    SUBDIVISION: '.bg-slate-200, .bg-slate-700', // Badge for selected subdivision
    REMOVE_BTN: 'button:has(svg.lucide-x)',
  },

  // Grouping
  GROUPING: {
    DROPDOWN_TRIGGER: 'button:has-text("Без группировки"), button:has-text("Подразделения")',
    NO_GROUPING: '[role="menuitem"]:has-text("Без группировки")',
    BY_SUBDIVISIONS: '[role="menuitem"]:has-text("Подразделения")',
    // Group headers in table
    SUBDIVISION_HEADER: 'tr:has(svg.lucide-network)',
    DEPARTMENT_HEADER: 'tr:has(svg.lucide-building-2)',
    TEAM_HEADER: 'tr:has(svg.lucide-users)',
    // Expand/collapse icons
    EXPAND_ICON: 'svg.lucide-chevron-right',
    COLLAPSE_ICON: 'svg.lucide-chevron-down',
  },

  // Pagination
  PAGINATION: {
    PREV_BTN: 'button:has(svg.lucide-chevron-left)',
    NEXT_BTN: 'button:has(svg.lucide-chevron-right)',
    PAGE_INFO: ':has-text(" из ")',
    SHOW_ALL_BTN: 'button:has-text("Показать всех")',
    PAGINATE_BTN: 'button:has-text("Пагинация")',
  },

  // Refresh button
  REFRESH: {
    BTN: 'button:has-text("Обновить")',
    BTN_LOADING: 'button:has-text("Обновление...")',
  },

  // User row elements
  USER_ROW: {
    AVATAR: '.h-8.w-8', // Avatar
    NAME: '.font-medium',
    EMAIL: '.text-gray-400',
    MENU_BTN: 'button:has(svg.lucide-more-horizontal)',
  },

  // Add User Form
  ADD_USER_FORM: {
    EMAIL_INPUT: '#email',
    FIRST_NAME_INPUT: '#firstName',
    LAST_NAME_INPUT: '#lastName',
    SUBDIVISION_SELECT: '#subdivision',
    DEPARTMENT_SELECT: '#department',
    TEAM_SELECT: '#team',
    POSITION_SELECT: '#position',
    CATEGORY_SELECT: '#category',
    ROLE_SELECT: '#role',
    WORK_LOCATION_SELECT: '#workLocation',
    COUNTRY_SELECT: '#country',
    CITY_SELECT: '#city',
    SUBMIT_BTN: 'button[type="submit"]',
    RESET_BTN: 'button:has-text("Очистить форму")',
  },

  // Edit User Dialog (Modal)
  // Note: Dialog uses id attributes for inputs, not name attributes
  EDIT_USER_DIALOG: {
    MODAL: '[role="dialog"]',
    // Title can be "Редактирование пользователя" or "Настройки профиля" depending on mode
    TITLE: '[role="dialog"] h2',
    CLOSE_BTN: '[role="dialog"] button[aria-label="Закрыть"]',

    // Form fields - use id selectors (not name)
    FIRST_NAME_INPUT: '[role="dialog"] input#firstName',
    LAST_NAME_INPUT: '[role="dialog"] input#lastName',
    EMAIL_INPUT: '[role="dialog"] input#email',

    // Role badges
    ROLE_BADGE: '[role="dialog"] .inline-flex.items-center.px-2.py-1',
    ADD_ROLE_BTN: '[role="dialog"] button:has(svg.lucide-plus)',

    // Dropdowns - using more flexible selectors
    SUBDIVISION_DROPDOWN: '[role="dialog"] button:has-text("подразделение"), [role="dialog"] button:has-text("Непроизводственные")',
    DEPARTMENT_DROPDOWN: '[role="dialog"] button:has-text("отдел"), [role="dialog"] button:has-text("Выберите отдел")',
    TEAM_DROPDOWN: '[role="dialog"] button:has-text("команду"), [role="dialog"] button:has-text("Выберите команду")',
    POSITION_DROPDOWN: '[role="dialog"] button:has-text("должность"), [role="dialog"] button:has-text("Выберите должность")',
    CATEGORY_DROPDOWN: '[role="dialog"] button:has-text("категорию"), [role="dialog"] button:has-text("Выберите категорию")',
    WORKLOAD_DROPDOWN: '[role="dialog"] button:has-text("загруженность"), [role="dialog"] button:has-text("%")',
    LOCATION_DROPDOWN: '[role="dialog"] button#workLocation',
    COUNTRY_DROPDOWN: '[role="dialog"] button#country',
    CITY_DROPDOWN: '[role="dialog"] button#city',

    // Rate/Salary input - use id selector
    RATE_INPUT: '[role="dialog"] input#salary',
    RATE_LABEL: '[role="dialog"] :has-text("Ставка BYN/час")',

    // Buttons
    CANCEL_BTN: '[role="dialog"] button:has-text("Отмена")',
    SAVE_BTN: '[role="dialog"] button:has-text("Сохранить")',

    // Helper text
    TEAM_ASSIGNMENT_HINT: '[role="dialog"] :has-text("Команда может быть назначена")',
  },
} as const

/**
 * Routes
 */
export const ROUTES = {
  USERS: '/dashboard/users',
  USERS_LIST: '/dashboard/users?tab=list',
  USERS_ADD: '/dashboard/users?tab=add-user',
  USERS_ANALYTICS: '/dashboard/users?tab=analytics',
  USERS_ADMIN: '/dashboard/users?tab=admin',
} as const

/**
 * LocalStorage keys
 */
export const STORAGE_KEYS = {
  USERS_LIST_STATE: 'users_list_state_v1',
} as const

/**
 * Timeouts
 */
export const TIMEOUTS = {
  PAGE_LOAD: 30000,
  DATA_LOAD: 10000,
  FILTER_APPLY: 1000,
  ANIMATION: 500,
  HYDRATION: 5000,
} as const

/**
 * Filter types for type safety
 */
export type FilterType = 'SUBDIVISION' | 'DEPARTMENT' | 'TEAM' | 'POSITION' | 'CATEGORY' | 'ROLE' | 'LOCATION'

/**
 * Tab types
 */
export type TabType = 'list' | 'add-user' | 'analytics' | 'admin'
