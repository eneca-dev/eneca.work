// Экспорты модуля дашборда проекта

export { default as InlineDashboard } from './InlineDashboard';

// Компоненты
export * as DashboardCards from './components/cards';
export * as DashboardUI from './components/ui';

// Хуки
export * from './hooks';

// Типы
export * from './types';

// Стор
export { useDashboardStore } from './stores/useDashboardStore';