/**
 * Selectors for Resource Graph filters
 *
 * Using data-testid attributes for reliable element selection
 */
export const SELECTORS = {
  // Page
  PAGE: {
    FILTERS_CONTAINER: '[data-testid="resource-graph-filters"]',
    GRAPH_CONTAINER: '[data-testid="resource-graph-content"]',
  },

  // Filter selects
  FILTERS: {
    MANAGER: '[data-testid="filter-manager"]',
    PROJECT: '[data-testid="filter-project"]',
    SUBDIVISION: '[data-testid="filter-subdivision"]',
    DEPARTMENT: '[data-testid="filter-department"]',
    TEAM: '[data-testid="filter-team"]',
    EMPLOYEE: '[data-testid="filter-employee"]',
  },

  // Tags
  TAGS: {
    CONTAINER: '[data-testid="tags-container"]',
    TAG_BUTTON: (tagId: string) => `[data-testid="tag-${tagId}"]`,
    TAG_RESET: '[data-testid="tags-reset"]',
  },

  // Reset buttons
  RESET: {
    ALL: '[data-testid="reset-all-filters"]',
    PROJECT: '[data-testid="reset-project-filters"]',
    ORG: '[data-testid="reset-org-filters"]',
  },

  // Loading states
  LOADING: {
    SPINNER: '[data-testid="loading-spinner"]',
    SKELETON: '[data-testid="loading-skeleton"]',
  },
} as const

/**
 * Routes
 */
export const ROUTES = {
  LOGIN: '/auth/login',
  RESOURCE_GRAPH: '/resource-graph',
} as const

/**
 * LocalStorage keys
 */
export const STORAGE_KEYS = {
  FILTERS: 'resource-graph-filters',
} as const

/**
 * Timeouts
 */
export const TIMEOUTS = {
  FILTER_APPLY: 2000,
  DATA_LOAD: 5000,
  ANIMATION: 500,
} as const
