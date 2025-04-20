// Экспорт основных компонентов модуля для использования в основном приложении
import UsersPage from "./pages/users-page"
import UsersList from "./components/users-list"
import PaymentList from "./components/payment-list"
import UserAnalytics from "./components/user-analytics"
import { CurrentUserCard } from "./components/current-user-card"
import { UserDialog } from "./components/user-dialog"
import { PaymentDialog } from "./components/payment-dialog"
import { PaymentAccessCheck } from "./components/payment-access-check"
import { UserFilters } from "./components/user-filters"
import {
  getUsers,
  getDepartments,
  getTeams,
  getPositions,
  getCategories,
  updateUser,
  deleteUser,
  checkPaymentAccess,
} from "./lib/data-service"
import type { User, Department, Team, Position, Category } from "./lib/types"

// Экспортируем все компоненты и функции
export {
  UsersPage,
  UsersList,
  PaymentList,
  UserAnalytics,
  CurrentUserCard,
  UserDialog,
  PaymentDialog,
  PaymentAccessCheck,
  UserFilters,
  getUsers,
  getDepartments,
  getTeams,
  getPositions,
  getCategories,
  updateUser,
  deleteUser,
  checkPaymentAccess,
}

// Экспортируем типы
export type { User, Department, Team, Position, Category }
