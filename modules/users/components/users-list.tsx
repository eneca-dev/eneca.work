"use client"

import React, { useState, useMemo, useCallback, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Edit,
  MoreHorizontal,
  Search,
  Trash,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Home,
  Building2,
  Briefcase,
  Users,
  Tag,
  RotateCcw,
  DollarSign,
  Network,
  X,
  RefreshCw,
} from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { UserDialog } from "./user-dialog"
import { deleteUser } from "@/services/org-data-service"
import type { User, UserWithRoles } from "@/types/db"
import { toast } from "@/components/ui/use-toast"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useUserPermissions } from "../hooks/useUserPermissions"
import { useUserStore } from "@/stores/useUserStore"
import { Separator } from "@/components/ui/separator"
import { EmptyState } from "@/components/ui/empty-state"
import { DeleteUserConfirm } from "./DeleteUserConfirm"
import { createClient } from "@/utils/supabase/client"
import { cn } from "@/lib/utils"
import * as Sentry from "@sentry/nextjs"

interface UsersListProps {
  users: User[]
  onUserUpdated?: () => void
  onRefresh?: () => Promise<void>
  isRefreshing?: boolean
}

// Тип для группировки (восстановлен из оригинала)
type GroupBy = "none" | "subdivisions"

// Функция для получения информации о расположении (восстановлена из оригинала)
const getWorkLocationInfo = (location: string | null) => {
  if (!location) {
    return { icon: null, label: "Не указано" }
  }
  
  switch (location) {
    case "office":
      return { icon: <Building2 className="h-4 w-4 mr-2 text-blue-600 dark:text-blue-400" />, label: "В офисе" }
    case "remote":
      return { icon: <Home className="h-4 w-4 mr-2 text-green-600 dark:text-green-400" />, label: "Удаленно" }
    case "hybrid":
      return { icon: <Briefcase className="h-4 w-4 mr-2 text-purple-600 dark:text-purple-400" />, label: "Гибридный" }
    default:
      return { icon: null, label: location }
  }
}

function UsersList({ users, onUserUpdated, onRefresh, isRefreshing = false }: UsersListProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [groupBy, setGroupBy] = useState<GroupBy>("subdivisions")
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    // Lazy initialization - восстанавливаем expandedGroups сразу из localStorage
    if (typeof window !== 'undefined') {
      try {
        const savedState = localStorage.getItem('users_list_state_v1')
        if (savedState) {
          const parsed = JSON.parse(savedState)
          return parsed.expandedGroups || {}
        }
      } catch (e) {
        console.warn('Не удалось восстановить expandedGroups:', e)
      }
    }
    return {}
  })
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [userToDelete, setUserToDelete] = useState<User | null>(null)
  const [filters, setFilters] = useState({
    subdivisions: [] as string[],
    departments: [] as string[],
    teams: [] as string[],
    categories: [] as string[],
    positions: [] as string[],
    workLocations: [] as string[],
    roles: [] as string[],
  })
  
  // Состояния пагинации
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(100)
  const [showAll, setShowAll] = useState(false)
  
  // Состояния для поиска в dropdown фильтрах
  const [searchSubdivisionDropdown, setSearchSubdivisionDropdown] = useState("")
  const [searchDepartmentDropdown, setSearchDepartmentDropdown] = useState("")
  const [searchTeamDropdown, setSearchTeamDropdown] = useState("")
  const [searchPositionDropdown, setSearchPositionDropdown] = useState("")
  const [searchCategoryDropdown, setSearchCategoryDropdown] = useState("")
  const [searchRoleDropdown, setSearchRoleDropdown] = useState("")
  const [searchLocationDropdown, setSearchLocationDropdown] = useState("")
  
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Получаем разрешения пользователя
  const { profile, id: viewerId } = useUserStore()
  const {
    canEditAllUsers,
    canEditSubdivision,
    canEditTeam,
    canEditDepartment,
    canViewRateSelf,
    canViewRateTeam,
    canViewRateDepartment,
    canViewRateSubdivision,
    canViewRateAll,
    isAdmin, // Добавляем проверку на администратора
  } = useUserPermissions()

  const viewerDeptId = profile?.departmentId || profile?.department_id || null
  const viewerTeamId = profile?.teamId || profile?.team_id || null
  const viewerSubdivisionId = profile?.subdivisionId || (profile as any)?.subdivision_id || null

  const canEditUser = (u: User) => {
    // Запрещаем редактирование своего профиля через список пользователей
    // Свой профиль редактируется только через "Настройки профиля"
    if (u.id === viewerId) return false

    if (canEditAllUsers) return true
    // Для users.edit.subdivision: проверяем, что пользователь в том же подразделении
    if (canEditSubdivision && viewerSubdivisionId && u.subdivisionId && u.subdivisionId === viewerSubdivisionId) return true
    // Для users.edit.team: проверяем, что пользователь в том же отделе
    if (canEditTeam && viewerDeptId && u.departmentId && u.departmentId === viewerDeptId) return true
    if (canEditDepartment && viewerDeptId && (u as any).departmentId && (u as any).departmentId === viewerDeptId) return true
    return false
  }

  const canViewRate = (u: User) => {
    if (canViewRateAll) return true
    if (canViewRateSelf && u.id === viewerId) return true
    if (canViewRateSubdivision && viewerSubdivisionId && u.subdivisionId && u.subdivisionId === viewerSubdivisionId) return true
    if (canViewRateTeam && viewerTeamId && (u as any).teamId && (u as any).teamId === viewerTeamId) return true
    if (canViewRateDepartment && viewerDeptId && (u as any).departmentId && (u as any).departmentId === viewerDeptId) return true
    return false
  }

  // ОПТИМИЗАЦИЯ: Мемоизируем фильтрацию пользователей (как в оригинале, но оптимизированно)
  const filteredUsers = useMemo(() => {
    let filtered = users

    // Применяем поиск
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      filtered = filtered.filter(user =>
        user.name?.toLowerCase().includes(searchLower) ||
        user.email?.toLowerCase().includes(searchLower) ||
        user.department?.toLowerCase().includes(searchLower) ||
        user.team?.toLowerCase().includes(searchLower) ||
        user.position?.toLowerCase().includes(searchLower) ||
        user.category?.toLowerCase().includes(searchLower) ||
        user.role?.toLowerCase().includes(searchLower) ||
        (user.salary && user.salary.toString().includes(searchLower))
      )
    }

    // Применяем фильтры
    if (filters.subdivisions.length > 0) {
      filtered = filtered.filter(user => user.subdivision && filters.subdivisions.includes(user.subdivision))
    }
    if (filters.departments.length > 0) {
      filtered = filtered.filter(user => user.department && filters.departments.includes(user.department))
    }
    if (filters.teams.length > 0) {
      filtered = filtered.filter(user => user.team && filters.teams.includes(user.team))
    }
    if (filters.categories.length > 0) {
      filtered = filtered.filter(user => user.category && filters.categories.includes(user.category))
    }
    if (filters.positions.length > 0) {
      filtered = filtered.filter(user => user.position && filters.positions.includes(user.position))
    }
    if (filters.workLocations.length > 0) {
      filtered = filtered.filter(user => user.workLocation && filters.workLocations.includes(user.workLocation))
    }
    if (filters.roles.length > 0) {
      filtered = filtered.filter(user => user.role && filters.roles.includes(user.role))
    }


    return filtered
  }, [users, searchTerm, filters])

  // ОПТИМИЗАЦИЯ: Мемоизируем пагинированные пользователи
  const paginatedUsers = useMemo(() => {
    if (showAll) return filteredUsers
    
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return filteredUsers.slice(startIndex, endIndex)
  }, [filteredUsers, currentPage, itemsPerPage, showAll])

  // Вычисляем общее количество страниц
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage)

  // ОПТИМИЗАЦИЯ: Мемоизируем группировку пользователей
  const groupedUsers = useMemo(() => {
    // Группировка всегда работает со всем отфильтрованным списком
    const usersToGroup = filteredUsers

    if (groupBy === "none") {
      return { "": filteredUsers }
    }

    if (groupBy === "subdivisions") {
      // Трехуровневая группировка: Подразделения → Отделы → Команды
      const threeLevel: Record<string, Record<string, Record<string, User[]>>> = {}
      usersToGroup.forEach((user) => {
        const subdivision = user.subdivision || "Без подразделения"
        const department = user.department || "Без отдела"
        const team = user.team || "Без команды"

        if (!threeLevel[subdivision]) {
          threeLevel[subdivision] = {}
        }
        if (!threeLevel[subdivision][department]) {
          threeLevel[subdivision][department] = {}
        }
        if (!threeLevel[subdivision][department][team]) {
          threeLevel[subdivision][department][team] = []
        }
        threeLevel[subdivision][department][team].push(user)
      })
      return threeLevel
    }

    return { "": filteredUsers }
  }, [filteredUsers, groupBy])

  // Проверяем, будет ли показана колонка действий для хотя бы одного пользователя
  const shouldShowActionsColumn = useMemo(() => {
    if (canEditAllUsers) return true
    return filteredUsers.some(user => canEditUser(user))
  }, [canEditAllUsers, filteredUsers, canEditUser])

  // ОПТИМИЗАЦИЯ: Мемоизируем обработчики
  const handleEditUser = useCallback((user: User) => {
    setSelectedUser(user)
    setIsDialogOpen(true)
  }, [])

  const handleDeleteUser = useCallback(async (userId: string) => {
    Sentry.addBreadcrumb({ category: 'ui.action', level: 'info', message: 'UsersList: delete user confirm', data: { user_id: userId } })
    setIsDeleting(userId)
    try {
      await Sentry.startSpan({ name: 'Users/UsersList deleteUser', op: 'ui.action', attributes: { user_id: userId } }, async () => {
        await deleteUser(userId)
      })
      toast({
        title: "Успех",
        description: "Пользователь успешно удален",
      })
      if (onUserUpdated) {
        onUserUpdated()
      }
    } catch (error) {
      console.error("Ошибка удаления пользователя:", error)
      toast({
        title: "Ошибка",
        description: error instanceof Error ? error.message : "Не удалось удалить пользователя",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(null)
    }
  }, [onUserUpdated])

  const handleDialogClose = useCallback(() => {
    setIsDialogOpen(false)
    setSelectedUser(null)
  }, [])

  const handleUserUpdated = useCallback(() => {
    handleDialogClose()
    if (onUserUpdated) {
      onUserUpdated()
    }
  }, [handleDialogClose, onUserUpdated])

  // Функция для переключения состояния развернутости группы
  const toggleGroup = useCallback((groupName: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupName]: !prev[groupName],
    }))
  }, [])

  // ОПТИМИЗАЦИЯ: Мемоизируем функции пагинации
  const handlePrevPage = useCallback(() => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1)
    }
  }, [currentPage])

  const handleNextPage = useCallback(() => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1)
    }
  }, [currentPage, totalPages])

  const handleToggleShowAll = useCallback(() => {
    setShowAll(!showAll)
    setCurrentPage(1) // Сбрасываем на первую страницу
  }, [showAll])

  const openDeleteDialog = useCallback((user: User) => {
    setUserToDelete(user)
    setDeleteDialogOpen(true)
  }, [])

  // Сброс на первую страницу при изменении фильтров
  useEffect(() => {
    setCurrentPage(1)
  }, [filters, searchTerm])

  // Восстановление состояния из URL и localStorage при монтировании
  useEffect(() => {
    try {
      // 1) Пытаемся восстановить из URL параметров
      const urlSearch = searchParams?.get('search') || ''
      const urlGroup = (searchParams?.get('group') as GroupBy) || 'none'
      const urlSubdivs = searchParams ? searchParams.getAll('subdivs') : []
      const urlDepts = searchParams ? searchParams.getAll('depts') : []
      const urlTeams = searchParams ? searchParams.getAll('teams') : []
      const urlCats = searchParams ? searchParams.getAll('cats') : []
      const urlPos = searchParams ? searchParams.getAll('pos') : []
      const urlRoles = searchParams ? searchParams.getAll('roles') : []
      const urlLocs = searchParams ? searchParams.getAll('locs') : []

      const hasAnyUrlState = Boolean(
        urlSearch ||
        (urlGroup && urlGroup !== 'none') ||
        urlSubdivs.length || urlDepts.length || urlTeams.length || urlCats.length || urlPos.length || urlRoles.length || urlLocs.length
      )

      // Определяем подразделение текущего пользователя для автофильтрации
      const currentUser = users.find(u => u.id === viewerId)
      const currentUserSubdivision = currentUser?.subdivision

      if (hasAnyUrlState) {
        setSearchTerm(urlSearch)
        if (urlGroup === 'none' || urlGroup === 'subdivisions') {
          setGroupBy(urlGroup)
        }
        setFilters({
          subdivisions: urlSubdivs,
          departments: urlDepts,
          teams: urlTeams,
          categories: urlCats,
          positions: urlPos,
          roles: urlRoles,
          workLocations: urlLocs,
        })
      } else if (currentUserSubdivision && !isAdmin) {
        // 2) Если в URL нет И пользователь НЕ админ — устанавливаем фильтр по подразделению текущего пользователя
        // Админ видит всех пользователей без автоматической фильтрации
        // (игнорируем localStorage для приоритетной фильтрации)
        setFilters({
          subdivisions: [currentUserSubdivision],
          departments: [],
          teams: [],
          categories: [],
          positions: [],
          workLocations: [],
          roles: [],
        })
      }
    } catch (e) {
      // Игнорируем ошибки восстановления состояния
      console.warn('Не удалось восстановить состояние списка пользователей:', e)
      Sentry.captureException(e, { tags: { module: 'users', component: 'UsersList', action: 'restore_state', error_type: 'unexpected' } })
    }
    // Выполняем при монтировании и при изменении прав администратора
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin])

  // Сохранение состояния в URL и localStorage при изменениях
  useEffect(() => {
    try {
      // Обновляем URLSearchParams на основе текущих searchParams, сохраняя посторонние параметры (например, tab)
      const params = new URLSearchParams(searchParams?.toString() || '')

      // Поиск
      if (searchTerm && searchTerm.trim()) {
        params.set('search', searchTerm.trim())
      } else {
        params.delete('search')
      }

      // Группировка
      if (groupBy && groupBy !== 'none') {
        params.set('group', groupBy)
      } else {
        params.delete('group')
      }

      // Хэлпер для многозначных параметров
      const setMulti = (key: string, values: string[]) => {
        params.delete(key)
        for (const v of values) {
          if (v && v.trim()) params.append(key, v)
        }
      }

      setMulti('subdivs', filters.subdivisions)
      setMulti('depts', filters.departments)
      setMulti('teams', filters.teams)
      setMulti('cats', filters.categories)
      setMulti('pos', filters.positions)
      setMulti('roles', filters.roles)
      setMulti('locs', filters.workLocations)

      const newQuery = params.toString()
      const currentQuery = typeof window !== 'undefined' ? window.location.search.replace(/^\?/, '') : ''
      if (newQuery !== currentQuery) {
        // В проде смена searchParams через router.replace вызывает ремоунт всей страницы (RSC навигация)
        // Нам нужна только синхронизация URL без навигации. Используем history.replaceState.
        if (typeof window !== 'undefined') {
          const newUrl = `${pathname}${newQuery ? `?${newQuery}` : ''}`
          const currentUrl = `${window.location.pathname}${window.location.search}`
          if (newUrl !== currentUrl) {
            window.history.replaceState(null, '', newUrl)
          }
        }
      }

      // Дублируем в localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem(
          'users_list_state_v1',
          JSON.stringify({ search: searchTerm, groupBy, filters, expandedGroups })
        )
      }
    } catch (e) {
      console.warn('Не удалось сохранить состояние списка пользователей:', e)
      Sentry.captureException(e, { tags: { module: 'users', component: 'UsersList', action: 'persist_state', error_type: 'unexpected' } })
    }
  }, [searchTerm, groupBy, filters, expandedGroups, router, pathname, searchParams])

  // Функция сброса всех фильтров
  const handleResetFilters = useCallback(() => {
    // Получаем подразделение текущего пользователя для не-админов
    const currentUser = users.find(u => u.id === viewerId)
    const currentUserSubdivision = currentUser?.subdivision

    // Для не-админов сохраняем фильтр по подразделению
    const subdivisionsFilter = (!isAdmin && currentUserSubdivision)
      ? [currentUserSubdivision]
      : []

    // Сбрасываем все фильтры (кроме подразделения для не-админов)
    setFilters({
      subdivisions: subdivisionsFilter,
      departments: [],
      teams: [],
      categories: [],
      positions: [],
      workLocations: [],
      roles: [],
    })

    // Сбрасываем поисковые строки в dropdown'ах
    setSearchSubdivisionDropdown("")
    setSearchDepartmentDropdown("")
    setSearchTeamDropdown("")
    setSearchPositionDropdown("")
    setSearchCategoryDropdown("")
    setSearchRoleDropdown("")
    setSearchLocationDropdown("")

    // Сбрасываем основной поиск
    setSearchTerm("")
  }, [isAdmin, users, viewerId])

  // Проверяем есть ли активные фильтры
  const hasActiveFilters = useMemo(() => {
    return searchTerm.length > 0 || 
           Object.values(filters).some(filterArray => filterArray.length > 0)
  }, [searchTerm, filters])

  // Функция для получения пагинированных пользователей из группы
  const getPaginatedUsersFromGroup = useCallback((groupUsers: User[]) => {
    // Если включена группировка или показать всех - показываем всех пользователей группы
    if (groupBy !== "none" || showAll) {
      return groupUsers
    }
    
    // Только для режима "без группировки" применяем пагинацию к группе
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return groupUsers.slice(startIndex, endIndex)
  }, [groupBy, showAll, currentPage, itemsPerPage])

  // Получение инициалов для аватара
  const getInitials = useCallback((name: string) => {
    return name
      .split(' ')
      .map(part => part.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }, [])

  return (
    <TooltipProvider>
      <Card className="w-full">
             <CardHeader className="pb-4 px-4">
         {/* Адаптивная строка с фильтрами */}
         <div className="flex items-center gap-0.5 flex-wrap w-full border-b border-border pb-4">
           {/* Поиск */}
           <div className="relative">
             <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Поиск сотрудников"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
               className="pl-8 w-52 h-7"
                />
              </div>

           <Separator orientation="vertical" className="h-3 opacity-40" />

           {/* Фильтр по подразделениям */}
           <TooltipProvider>
             <Tooltip>
               <TooltipTrigger asChild>
                 <DropdownMenu>
                   <DropdownMenuTrigger asChild>
                     <Button variant="ghost" size="sm" className="h-7 px-1 text-xs">
                       <Network className="h-4 w-4" />
                       {filters.subdivisions.length > 0 && (
                         <span className="ml-1 text-xs text-blue-600">({filters.subdivisions.length})</span>
                       )}
                     </Button>
                   </DropdownMenuTrigger>
                   <DropdownMenuContent align="start" className="w-64">
                     <div className="p-2 space-y-2">
                       <Input
                         placeholder="Поиск подразделений..."
                         className="h-8 text-xs"
                         value={searchSubdivisionDropdown}
                         onChange={(e) => setSearchSubdivisionDropdown(e.target.value)}
                       />
                       <div className="max-h-32 overflow-y-auto space-y-1">
                         {[...new Set(users.map(u => u.subdivision).filter((s): s is string => Boolean(s)))]
                           .sort()
                           .filter(subdiv => subdiv.toLowerCase().includes(searchSubdivisionDropdown.toLowerCase()))
                           .map(subdiv => {
                             // Для не-админов блокируем изменение фильтра подразделения
                             const isDisabled = !isAdmin
                             return (
                           <div key={subdiv} className="flex items-center space-x-2">
                             <input
                               type="checkbox"
                               id={`subdiv-${subdiv}`}
                               checked={filters.subdivisions.includes(subdiv)}
                               disabled={isDisabled}
                               onChange={(e) => {
                                 if (isAdmin) {
                                   const newSubdivs = e.target.checked
                                     ? [...filters.subdivisions, subdiv]
                                     : filters.subdivisions.filter(s => s !== subdiv)
                                   setFilters({...filters, subdivisions: newSubdivs})
                                 }
                               }}
                               className="rounded"
                             />
                             <label htmlFor={`subdiv-${subdiv}`} className={`text-xs ${isDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                               {subdiv}
                             </label>
                           </div>
                             )
                           })}
                       </div>
                     </div>
                   </DropdownMenuContent>
                 </DropdownMenu>
               </TooltipTrigger>
               <TooltipContent>
                 <p>Фильтр по подразделениям</p>
               </TooltipContent>
             </Tooltip>
           </TooltipProvider>

           {/* Чип с выбранным подразделением */}
           {filters.subdivisions.length > 0 && (
             <Badge
               variant="secondary"
               className="h-7 px-2 text-xs flex items-center gap-1 bg-muted text-muted-foreground hover:bg-accent"
             >
               <span>
                 {filters.subdivisions.length === 1
                   ? filters.subdivisions[0]
                   : `${filters.subdivisions[0]} +${filters.subdivisions.length - 1}`
                 }
               </span>
               {/* Показываем кнопку удаления только для администраторов */}
               {isAdmin && (
                 <button
                   onClick={(e) => {
                     e.stopPropagation()
                     setFilters({...filters, subdivisions: []})
                   }}
                   className="ml-1 hover:bg-accent/50 rounded-full p-0.5 transition-colors"
                 >
                   <X className="h-3 w-3" />
                 </button>
               )}
             </Badge>
           )}

           <Separator orientation="vertical" className="h-3 opacity-40" />

           {/* Фильтр по отделам */}
           <TooltipProvider>
             <Tooltip>
               <TooltipTrigger asChild>
                 <DropdownMenu>
                   <DropdownMenuTrigger asChild>
                     <Button variant="ghost" size="sm" className="h-7 px-1 text-xs">
                       <Building2 className="h-4 w-4" />
                       {filters.departments.length > 0 && (
                         <span className="ml-1 text-xs text-blue-600">({filters.departments.length})</span>
                       )}
                     </Button>
                   </DropdownMenuTrigger>
                   <DropdownMenuContent align="start" className="w-64">
                     <div className="p-2 space-y-2">
                       <Input
                         placeholder="Поиск отделов..."
                         className="h-8 text-xs"
                         value={searchDepartmentDropdown}
                         onChange={(e) => setSearchDepartmentDropdown(e.target.value)}
                       />
                       <div className="max-h-32 overflow-y-auto space-y-1">
                         {[...new Set(users.map(u => u.department).filter((d): d is string => Boolean(d)))]
                           .sort()
                           .filter(dept => dept.toLowerCase().includes(searchDepartmentDropdown.toLowerCase()))
                           .map(dept => (
                           <div key={dept} className="flex items-center space-x-2">
                             <input
                               type="checkbox"
                               id={`dept-${dept}`}
                               checked={filters.departments.includes(dept)}
                               onChange={(e) => {
                                 const newDepts = e.target.checked
                                   ? [...filters.departments, dept]
                                   : filters.departments.filter(d => d !== dept)
                                 setFilters({...filters, departments: newDepts})
                               }}
                               className="rounded"
                             />
                             <label htmlFor={`dept-${dept}`} className="text-xs cursor-pointer">
                               {dept}
                             </label>
                           </div>
                         ))}
                       </div>
                     </div>
                   </DropdownMenuContent>
                 </DropdownMenu>
               </TooltipTrigger>
               <TooltipContent>
                 <p>Фильтр по отделам</p>
               </TooltipContent>
             </Tooltip>
           </TooltipProvider>

           <Separator orientation="vertical" className="h-3 opacity-40" />

           {/* Фильтр по командам */}
           <TooltipProvider>
             <Tooltip>
               <TooltipTrigger asChild>
                 <DropdownMenu>
                   <DropdownMenuTrigger asChild>
                     <Button variant="ghost" size="sm" className="h-7 px-1 text-xs">
                       <Users className="h-4 w-4" />
                       {filters.teams.length > 0 && (
                         <span className="ml-1 text-xs text-blue-600">({filters.teams.length})</span>
                       )}
                     </Button>
                   </DropdownMenuTrigger>
                   <DropdownMenuContent align="start" className="w-64">
                     <div className="p-2 space-y-2">
                       <Input 
                         placeholder="Поиск команд..." 
                         className="h-8 text-xs"
                         value={searchTeamDropdown}
                         onChange={(e) => setSearchTeamDropdown(e.target.value)}
                       />
                       <div className="max-h-32 overflow-y-auto space-y-1">
                         {[...new Set(users.map(u => u.team).filter((t): t is string => Boolean(t)))]
                           .sort()
                           .filter(team => team.toLowerCase().includes(searchTeamDropdown.toLowerCase()))
                           .map(team => (
                           <div key={team} className="flex items-center space-x-2">
                             <input
                               type="checkbox"
                               id={`team-${team}`}
                               checked={filters.teams.includes(team)}
                               onChange={(e) => {
                                 const newTeams = e.target.checked
                                   ? [...filters.teams, team]
                                   : filters.teams.filter(t => t !== team)
                                 setFilters({...filters, teams: newTeams})
                               }}
                               className="rounded"
                             />
                             <label htmlFor={`team-${team}`} className="text-xs cursor-pointer">
                               {team}
                             </label>
                           </div>
                         ))}
                       </div>
                     </div>
                   </DropdownMenuContent>
                 </DropdownMenu>
               </TooltipTrigger>
               <TooltipContent>
                 <p>Фильтр по командам</p>
               </TooltipContent>
             </Tooltip>
           </TooltipProvider>

           <Separator orientation="vertical" className="h-3 opacity-40" />

           {/* Фильтр по должностям */}
           <TooltipProvider>
             <Tooltip>
               <TooltipTrigger asChild>
                 <DropdownMenu>
                   <DropdownMenuTrigger asChild>
                     <Button variant="ghost" size="sm" className="h-7 px-1 text-xs">
                       <Briefcase className="h-4 w-4" />
                       {filters.positions.length > 0 && (
                         <span className="ml-1 text-xs text-blue-600">({filters.positions.length})</span>
                       )}
                     </Button>
                   </DropdownMenuTrigger>
                   <DropdownMenuContent align="start" className="w-64">
                     <div className="p-2 space-y-2">
                       <Input 
                         placeholder="Поиск должностей..." 
                         className="h-8 text-xs"
                         value={searchPositionDropdown}
                         onChange={(e) => setSearchPositionDropdown(e.target.value)}
                       />
                       <div className="max-h-32 overflow-y-auto space-y-1">
                         {[...new Set(users.map(u => u.position).filter((p): p is string => Boolean(p)))]
                           .sort()
                           .filter(position => position.toLowerCase().includes(searchPositionDropdown.toLowerCase()))
                           .map(position => (
                           <div key={position} className="flex items-center space-x-2">
                             <input
                               type="checkbox"
                               id={`position-${position}`}
                               checked={filters.positions.includes(position)}
                               onChange={(e) => {
                                 const newPositions = e.target.checked
                                   ? [...filters.positions, position]
                                   : filters.positions.filter(p => p !== position)
                                 setFilters({...filters, positions: newPositions})
                               }}
                               className="rounded"
                             />
                             <label htmlFor={`position-${position}`} className="text-xs cursor-pointer">
                               {position}
                             </label>
                           </div>
                         ))}
                       </div>
                     </div>
                   </DropdownMenuContent>
                 </DropdownMenu>
               </TooltipTrigger>
               <TooltipContent>
                 <p>Фильтр по должностям</p>
               </TooltipContent>
             </Tooltip>
           </TooltipProvider>

           <Separator orientation="vertical" className="h-3 opacity-40" />

           {/* Фильтр по категориям */}
           <TooltipProvider>
             <Tooltip>
               <TooltipTrigger asChild>
                 <DropdownMenu>
                   <DropdownMenuTrigger asChild>
                     <Button variant="ghost" size="sm" className="h-7 px-1 text-xs">
                       <Tag className="h-4 w-4" />
                       {filters.categories.length > 0 && (
                         <span className="ml-1 text-xs text-blue-600">({filters.categories.length})</span>
                       )}
                     </Button>
                   </DropdownMenuTrigger>
                   <DropdownMenuContent align="start" className="w-64">
                     <div className="p-2 space-y-2">
                       <Input 
                         placeholder="Поиск категорий..." 
                         className="h-8 text-xs"
                         value={searchCategoryDropdown}
                         onChange={(e) => setSearchCategoryDropdown(e.target.value)}
                       />
                       <div className="max-h-32 overflow-y-auto space-y-1">
                         {[...new Set(users.map(u => u.category).filter((c): c is string => Boolean(c)))]
                           .sort()
                           .filter(category => category.toLowerCase().includes(searchCategoryDropdown.toLowerCase()))
                           .map(category => (
                           <div key={category} className="flex items-center space-x-2">
                             <input
                               type="checkbox"
                               id={`category-${category}`}
                               checked={filters.categories.includes(category)}
                               onChange={(e) => {
                                 const newCategories = e.target.checked
                                   ? [...filters.categories, category]
                                   : filters.categories.filter(c => c !== category)
                                 setFilters({...filters, categories: newCategories})
                               }}
                               className="rounded"
                             />
                             <label htmlFor={`category-${category}`} className="text-xs cursor-pointer">
                               {category}
                             </label>
                           </div>
                         ))}
                       </div>
                     </div>
                   </DropdownMenuContent>
                 </DropdownMenu>
               </TooltipTrigger>
               <TooltipContent>
                 <p>Фильтр по категориям</p>
               </TooltipContent>
             </Tooltip>
           </TooltipProvider>

           <Separator orientation="vertical" className="h-3 opacity-40" />

           {/* Фильтр по ролям */}
           <TooltipProvider>
             <Tooltip>
               <TooltipTrigger asChild>
                 <DropdownMenu>
                   <DropdownMenuTrigger asChild>
                     <Button variant="ghost" size="sm" className="h-7 px-1 text-xs">
                      <Users className="h-4 w-4" />
                       {filters.roles.length > 0 && (
                         <span className="ml-1 text-xs text-blue-600">({filters.roles.length})</span>
                       )}
                     </Button>
                   </DropdownMenuTrigger>
                   <DropdownMenuContent align="start" className="w-64">
                     <div className="p-2 space-y-2">
                       <Input 
                         placeholder="Поиск ролей..." 
                         className="h-8 text-xs"
                         value={searchRoleDropdown}
                         onChange={(e) => setSearchRoleDropdown(e.target.value)}
                       />
                       <div className="max-h-32 overflow-y-auto space-y-1">
                         {[...new Set(users.map(u => u.role).filter((r): r is string => Boolean(r)))]
                           .sort()
                           .filter(role => role.toLowerCase().includes(searchRoleDropdown.toLowerCase()))
                           .map(role => (
                           <div key={role} className="flex items-center space-x-2">
                             <input
                               type="checkbox"
                               id={`role-${role}`}
                               checked={filters.roles.includes(role as string)}
                               onChange={(e) => {
                                 const newRoles = e.target.checked
                                   ? [...filters.roles, role as string]
                                   : filters.roles.filter(r => r !== role)
                                 setFilters({...filters, roles: newRoles})
                               }}
                               className="rounded"
                             />
                             <label htmlFor={`role-${role}`} className="text-xs cursor-pointer">
                               {role}
                             </label>
                           </div>
                         ))}
                       </div>
                     </div>
                   </DropdownMenuContent>
                 </DropdownMenu>
               </TooltipTrigger>
               <TooltipContent>
                 <p>Фильтр по ролям</p>
               </TooltipContent>
             </Tooltip>
           </TooltipProvider>

           <Separator orientation="vertical" className="h-3 opacity-40" />

           

           {/* Фильтр по расположению */}
           <TooltipProvider>
             <Tooltip>
               <TooltipTrigger asChild>
                 <DropdownMenu>
                   <DropdownMenuTrigger asChild>
                     <Button variant="ghost" size="sm" className="h-7 px-1 text-xs">
                       <Home className="h-4 w-4" />
                       {filters.workLocations.length > 0 && (
                         <span className="ml-1 text-xs text-blue-600">({filters.workLocations.length})</span>
                       )}
                     </Button>
                   </DropdownMenuTrigger>
                   <DropdownMenuContent align="start" className="w-64">
                     <div className="p-2 space-y-2">
                       <Input 
                         placeholder="Поиск расположений..." 
                         className="h-8 text-xs"
                         value={searchLocationDropdown}
                         onChange={(e) => setSearchLocationDropdown(e.target.value)}
                       />
                       <div className="max-h-32 overflow-y-auto space-y-1">
                         {[...new Set(users.map(u => u.workLocation).filter((l): l is "office" | "remote" | "hybrid" => Boolean(l)))]
                           .sort()
                           .filter(location => {
                             const locationInfo = getWorkLocationInfo(location)
                             if (!locationInfo) return false
                             return locationInfo.label.toLowerCase().includes(searchLocationDropdown.toLowerCase()) ||
                                    location.toLowerCase().includes(searchLocationDropdown.toLowerCase())
                           })
                           .map(location => (
                           <div key={location} className="flex items-center space-x-2">
                             <input
                               type="checkbox"
                               id={`location-${location}`}
                               checked={filters.workLocations.includes(location)}
                               onChange={(e) => {
                                 const newLocations = e.target.checked
                                   ? [...filters.workLocations, location]
                                   : filters.workLocations.filter(l => l !== location)
                                 setFilters({...filters, workLocations: newLocations})
                               }}
                               className="rounded"
                             />
                             <label htmlFor={`location-${location}`} className="text-xs cursor-pointer">
                               {getWorkLocationInfo(location)?.label || location}
                             </label>
                           </div>
                         ))}
                       </div>
                     </div>
                   </DropdownMenuContent>
                 </DropdownMenu>
               </TooltipTrigger>
               <TooltipContent>
                 <p>Фильтр по расположению</p>
               </TooltipContent>
             </Tooltip>
           </TooltipProvider>

           {/* Кнопка сброса фильтров */}
           <TooltipProvider>
             <Tooltip>
               <TooltipTrigger asChild>
                 <Button
                   variant="ghost"
                   size="sm"
                   className="h-7 w-7 p-0 text-xs"
                   onClick={handleResetFilters}
                   disabled={!hasActiveFilters}
                 >
                   <RotateCcw className="h-4 w-4" />
                 </Button>
               </TooltipTrigger>
               <TooltipContent>
                 <p>Сброс фильтров</p>
               </TooltipContent>
             </Tooltip>
           </TooltipProvider>

          {/* Группировка */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                {groupBy === "none" ? "Без группировки" : "Подразделения → Отделы → Команды"}
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => setGroupBy("none")}>
                Без группировки
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setGroupBy("subdivisions")}>
                Подразделения → Отделы → Команды
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Кнопка обновления */}
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs ml-auto gap-1 transition-all duration-200"
            onClick={onRefresh || onUserUpdated}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <>
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current"></div>
                Обновление...
              </>
            ) : (
              <>
                <RefreshCw className="h-3 w-3" />
                Обновить
              </>
            )}
          </Button>

          {/* Кнопка показать всех - скрываем при группировке */}
          {groupBy === "none" && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-1 text-xs whitespace-nowrap"
              onClick={handleToggleShowAll}
            >
              {showAll ? "Пагинация" : "Показать всех"}
            </Button>
          )}

          {/* Навигация по страницам - скрываем при группировке */}
          {groupBy === "none" && !showAll && totalPages > 1 && (
            <>
              <div className="flex items-center gap-0.5 text-xs text-muted-foreground">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={handlePrevPage}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-3 w-3" />
                </Button>
                
                <span className="whitespace-nowrap">
                  {currentPage} из {totalPages}
                </span>
                
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-3 w-3" />
                </Button>
             </div>
            </>
          )}
          </div>
       </CardHeader>
      
      <CardContent className="p-4">
        {(showAll ? filteredUsers : paginatedUsers).length === 0 ? (
          <EmptyState
            title="Пользователи не найдены"
            description={
              searchTerm || Object.values(filters).some(f => f.length > 0)
                ? "Попробуйте изменить критерии поиска или фильтры"
                : "В системе нет пользователей"
            }
          />
        ) : (
          <div>
            <Table className="table-auto w-full">
                <TableHeader>
                  <TableRow>
                  {groupBy === "subdivisions" ? (
                    // Заголовки для режима "Подразделения → Отделы → Команды"
                    <>
                      <TableHead className="text-xs px-0.5 sm:px-0.5 md:px-1 lg:px-1 xl:px-2 2xl:px-4 min-w-32">
                        <div className="flex items-center space-x-1">
                          <Users className="h-3 w-3" />
                          <span>Пользователь</span>
                        </div>
                      </TableHead>
                      <TableHead className="text-xs px-0.5 sm:px-0.5 md:px-1 lg:px-1 xl:px-2 2xl:px-4 hidden lg:table-cell min-w-36">
                        <div className="flex items-center space-x-1">
                          <Briefcase className="h-3 w-3" />
                          <span>Должность</span>
                        </div>
                      </TableHead>
                      <TableHead className="text-xs px-0.5 sm:px-0.5 md:px-1 lg:px-1 xl:px-2 2xl:px-4 hidden lg:table-cell min-w-28">
                        <div className="flex items-center space-x-1">
                          <Tag className="h-3 w-3" />
                          <span>Категория</span>
                        </div>
                      </TableHead>
                      {/* TEMPORARILY HIDDEN: Salary column header */}
                      {/* <TableHead className="text-xs px-0.5 sm:px-0.5 md:px-1 lg:px-1 xl:px-2 2xl:px-4 hidden lg:table-cell min-w-16">
                        <div className="flex items-center space-x-1">
                          <DollarSign className="h-3 w-3" />
                          <span>Ставка</span>
                        </div>
                      </TableHead> */}
                      <TableHead className="text-xs px-0.5 sm:px-0.5 md:px-1 lg:px-1 xl:px-2 2xl:px-4 min-w-20">
                        <div className="flex items-center space-x-1">
                          <Tag className="h-3 w-3" />
                          <span>Роль</span>
                        </div>
                      </TableHead>
                      <TableHead className="text-xs px-0.5 sm:px-0.5 md:px-1 lg:px-1 xl:px-2 2xl:px-4 w-12">
                        <div className="flex items-center justify-center space-x-1">
                          <Home className="h-3 w-3" />
                        </div>
                      </TableHead>
                      {shouldShowActionsColumn && <TableHead className="w-12 px-1"></TableHead>}
                    </>
                  ) : (
                    // Заголовки для режима "Без группировки"
                    <>
                      <TableHead className="text-xs px-0.5 sm:px-0.5 md:px-1 lg:px-1 xl:px-2 2xl:px-4 min-w-32">
                        <div className="flex items-center space-x-1">
                          <Users className="h-3 w-3" />
                          <span>Пользователь</span>
                        </div>
                      </TableHead>
                      <TableHead className="text-xs px-0.5 sm:px-0.5 md:px-1 lg:px-1 xl:px-2 2xl:px-4 min-w-36">
                        <div className="flex items-center space-x-1">
                          <Network className="h-3 w-3" />
                          <span>Подразделение</span>
                        </div>
                      </TableHead>
                      <TableHead className="text-xs px-0.5 sm:px-0.5 md:px-1 lg:px-1 xl:px-2 2xl:px-4 min-w-36">
                        <div className="flex items-center space-x-1">
                          <Building2 className="h-3 w-3" />
                          <span>Отдел</span>
                        </div>
                      </TableHead>
                      <TableHead className="text-xs px-0.5 sm:px-0.5 md:px-1 lg:px-1 xl:px-2 2xl:px-4 hidden lg:table-cell min-w-36">
                        <div className="flex items-center space-x-1">
                          <Briefcase className="h-3 w-3" />
                          <span>Должность</span>
                        </div>
                      </TableHead>
                      {/* TEMPORARILY HIDDEN: Salary column header (no grouping mode) */}
                      {/* <TableHead className="text-xs px-0.5 sm:px-0.5 md:px-1 lg:px-1 xl:px-2 2xl:px-4 hidden lg:table-cell min-w-16">
                        <div className="flex items-center space-x-1">
                          <span>Ставка</span>
                        </div>
                      </TableHead> */}
                      <TableHead className="text-xs px-0.5 sm:px-0.5 md:px-1 lg:px-1 xl:px-2 2xl:px-4 min-w-20">
                        <div className="flex items-center space-x-1">
                          <Tag className="h-3 w-3" />
                          <span>Роль</span>
                        </div>
                      </TableHead>
                      <TableHead className="text-xs px-0.5 sm:px-0.5 md:px-1 lg:px-1 xl:px-2 2xl:px-4 w-12">
                        <div className="flex items-center justify-center space-x-1">
                          <Home className="h-3 w-3" />
                        </div>
                      </TableHead>
                      {shouldShowActionsColumn && <TableHead className="w-12 px-1"></TableHead>}
                    </>
                  )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                {groupBy === "none" ? (
                  // Без группировки
                  Object.entries(groupedUsers as Record<string, User[]>).map(([groupName, groupUsers]) => (
                      <React.Fragment key={groupName}>
                        {getPaginatedUsersFromGroup(groupUsers).map((user) => {
                            const workLocationInfo = getWorkLocationInfo(user.workLocation)

                            return (
                              <TableRow key={user.id} className="h-12">
                                <TableCell className="text-xs sm:text-sm lg:text-base px-0.5 sm:px-0.5 md:px-1 lg:px-1 xl:px-2 2xl:px-4 py-1">
                                  <div className="flex items-center space-x-1">
                                    <Avatar className="h-8 w-8">
                                      <AvatarImage src={user.avatar_url || ""} alt={user.name} />
                                      <AvatarFallback className="text-xs">
                                        {getInitials(user.name)}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0 flex-1">
                                      <div className="font-medium text-xs sm:text-sm">
                                        <span className="block sm:truncate sm:max-w-24 md:max-w-32 lg:max-w-40 xl:max-w-48 2xl:max-w-none">{user.name}</span>
                                      </div>
                                      <div className="text-xs text-muted-foreground hidden sm:block">
                                        <span className="block sm:truncate sm:max-w-24 md:max-w-32 lg:max-w-40 xl:max-w-48 2xl:max-w-none text-[10px]">{user.email}</span>
                                      </div>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="text-xs sm:text-sm lg:text-base px-0.5 sm:px-0.5 md:px-1 lg:px-1 xl:px-2 2xl:px-4 py-1">
                                  <span className="block text-xs sm:text-sm">
                                    {user.subdivision || '—'}
                                  </span>
                                </TableCell>
                                <TableCell className="text-xs sm:text-sm lg:text-base px-0.5 sm:px-0.5 md:px-1 lg:px-1 xl:px-2 2xl:px-4 py-1">
                                  <div className="flex flex-col space-y-0.5">
                                    <span className="block text-xs sm:text-sm font-medium">
                                      {user.department || '—'}
                                    </span>
                                    <span className="block text-xs text-muted-foreground">
                                      {user.team || '—'}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-xs sm:text-sm lg:text-base px-0.5 sm:px-0.5 md:px-1 lg:px-1 xl:px-2 2xl:px-4 hidden lg:table-cell py-1">
                                  <div className="flex flex-col space-y-0.5">
                                    <span className="block text-xs sm:text-sm font-medium">
                                      {user.position || '—'}
                                    </span>
                                    <span className="block text-xs text-muted-foreground">
                                      {user.category || '—'}
                                    </span>
                                  </div>
                                </TableCell>
                                {/* TEMPORARILY HIDDEN: Salary cell */}
                                {/* <TableCell className="text-xs sm:text-sm lg:text-base px-0.5 sm:px-0.5 md:px-1 lg:px-1 xl:px-2 2xl:px-4 hidden lg:table-cell py-1">
                                  <div className="text-center">
                                    <span className="text-xs sm:text-sm font-medium">
                                      {canViewRate(user) && user.salary ? (
                                        <>
                                          <span>{user.salary}</span>
                                          <span className="text-[10px] text-muted-foreground ml-1">{user.isHourly ? 'BYN/ч' : 'BYN'}</span>
                                        </>
                                      ) : '—'}
                                    </span>
                                  </div>
                                </TableCell> */}

                                <TableCell className="text-xs sm:text-sm lg:text-base px-0.5 sm:px-0.5 md:px-1 lg:px-1 xl:px-2 2xl:px-4 py-1">
                                  <div className="flex flex-col items-start space-y-0.5">
                                    {user.role ? (
                                      // Если есть несколько ролей (разделены запятыми), показываем их отдельными чипами
                                      user.role.includes(',') ? (
                                        user.role.split(',').map((role: string, index: number) => (
                                          <Badge key={`${user.id}-role-${role.trim()}-${index}`} variant="secondary" className="text-xs">
                                            {role.trim()}
                                          </Badge>
                                        ))
                                      ) : (
                                        // Если одна роль, показываем как обычно
                                        <Badge variant="secondary" className="text-xs">
                                          {user.role}
                                        </Badge>
                                      )
                                    ) : (
                                      <Badge variant="secondary" className="text-xs">
                                        —
                                      </Badge>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-xs sm:text-sm lg:text-base px-0.5 sm:px-0.5 md:px-1 lg:px-1 xl:px-2 2xl:px-4 py-1 w-8">
                                  <div className="flex justify-center">
                                    {workLocationInfo?.icon || (
                                      <span className="text-muted-foreground text-xs">—</span>
                                    )}
                                  </div>
                                </TableCell>
                                {(canEditAllUsers || canEditUser(user)) && (
                                  <TableCell className="w-12 px-1 py-1">
                                    <div className="flex justify-end">
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button variant="ghost" size="icon" className="h-8 w-8">
                                            <MoreHorizontal className="h-4 w-4" />
                                            <span className="sr-only">Меню</span>
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                          <DropdownMenuItem onClick={() => {
                                            Sentry.addBreadcrumb({ category: 'ui.open', level: 'info', message: 'UsersList: open edit user', data: { user_id: user.id } })
                                            handleEditUser(user)
                                          }}>
                                            <Edit className="mr-2 h-4 w-4" />
                                            Редактировать
                                          </DropdownMenuItem>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem
                                            className="text-red-600 dark:text-red-400"
                                            onClick={() => {
                                              Sentry.addBreadcrumb({ category: 'ui.open', level: 'info', message: 'UsersList: open delete confirm', data: { user_id: user.id } })
                                              openDeleteDialog(user)
                                            }}
                                            disabled={isDeleting === user.id}
                                          >
                                            <Trash className="mr-2 h-4 w-4" />
                                            {isDeleting === user.id ? "Удаление..." : "Удалить"}
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </div>
                                  </TableCell>
                                )}
                              </TableRow>
                            )
                          })}
                        </React.Fragment>
                      ))
                ) : (
                  // Трехуровневая группировка (подразделения -> отделы -> команды)
                  Object.entries(groupedUsers as Record<string, Record<string, Record<string, User[]>>>).map(
                    ([subdivision, departments]) => (
                      <React.Fragment key={subdivision}>
                        {/* Заголовок подразделения */}
                        <TableRow className="bg-muted/80 hover:bg-muted/80">
                          <TableCell colSpan={shouldShowActionsColumn ? 7 : 6} className="py-2.5 px-4">
                            <div
                              className="flex items-center cursor-pointer font-bold text-foreground"
                              onClick={() => toggleGroup(subdivision)}
                            >
                              {expandedGroups[subdivision] ? (
                                <ChevronDown className="h-4 w-4 mr-2" />
                              ) : (
                                <ChevronRight className="h-4 w-4 mr-2" />
                              )}
                              <Network className="h-4 w-4 mr-2 text-muted-foreground" />
                              <span className="text-sm">{subdivision}</span>
                              <span className="ml-2 text-[11px] text-muted-foreground">
                                {Object.values(departments).reduce((sum, deptTeams) =>
                                  sum + Object.values(deptTeams).reduce((teamSum, teamUsers) => teamSum + teamUsers.length, 0), 0
                                )}
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>

                        {expandedGroups[subdivision] &&
                          Object.entries(departments).map(([department, teams]) => (
                            <React.Fragment key={`${subdivision}-${department}`}>
                              {/* Заголовок отдела */}
                              <TableRow className="bg-muted/50 hover:bg-muted/50">
                                <TableCell colSpan={shouldShowActionsColumn ? 7 : 6} className="py-2 pl-8 pr-4">
                                  <div
                                    className="flex items-center cursor-pointer font-semibold text-foreground"
                                    onClick={() => toggleGroup(`${subdivision}-${department}`)}
                                  >
                                    {expandedGroups[`${subdivision}-${department}`] ? (
                                      <ChevronDown className="h-4 w-4 mr-2" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4 mr-2" />
                                    )}
                                    <Building2 className="h-4 w-4 mr-2 text-muted-foreground" />
                                    <span className="text-sm">{department}</span>
                                    <span className="ml-2 text-[11px] text-muted-foreground">
                                      {Object.values(teams).reduce((sum, teamUsers) => sum + teamUsers.length, 0)}
                                    </span>
                                  </div>
                                </TableCell>
                              </TableRow>

                              {expandedGroups[`${subdivision}-${department}`] &&
                                Object.entries(teams).map(([team, teamUsers]) => (
                                  <React.Fragment key={`${subdivision}-${department}-${team}`}>
                                    {/* Заголовок команды */}
                                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                                      <TableCell colSpan={shouldShowActionsColumn ? 7 : 6} className="py-1.5 pl-16 pr-4">
                                        <div
                                          className="flex items-center text-[13px] font-medium text-foreground cursor-pointer"
                                          onClick={() => toggleGroup(`${subdivision}-${department}-${team}`)}
                                        >
                                          {expandedGroups[`${subdivision}-${department}-${team}`] ? (
                                            <ChevronDown className="h-3.5 w-3.5 mr-2" />
                                          ) : (
                                            <ChevronRight className="h-3.5 w-3.5 mr-2" />
                                          )}
                                          <Users className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                                          <span>{team}</span>
                                          <span className="ml-2 text-[11px] text-muted-foreground">{teamUsers.length}</span>
                                        </div>
                                      </TableCell>
                                    </TableRow>

                                    {/* Пользователи команды */}
                                    {expandedGroups[`${subdivision}-${department}-${team}`] &&
                                      getPaginatedUsersFromGroup(teamUsers).map((user) => {
                                        const workLocationInfo = getWorkLocationInfo(user.workLocation)

                                        return (
                                          <TableRow key={user.id} className="pl-20 h-12">
                                            {/* Пользователь */}
                                            <TableCell className="pl-6 sm:pl-10 lg:pl-20 text-xs sm:text-sm lg:text-base px-0.5 sm:px-0.5 md:px-1 lg:px-1 xl:px-2 2xl:px-4 py-1">
                                              <div className="flex items-center space-x-1">
                                                <Avatar className="h-8 w-8">
                                                  <AvatarImage src={user.avatar_url || ""} alt={user.name} />
                                                  <AvatarFallback className="text-xs">
                                                    {getInitials(user.name)}
                                                  </AvatarFallback>
                                                </Avatar>
                                                <div className="min-w-0 flex-1">
                                                  <div className="font-medium text-xs sm:text-sm">
                                                    <span className="block sm:truncate sm:max-w-20 md:max-w-28 lg:max-w-36 xl:max-w-44 2xl:max-w-none">{user.name}</span>
                                                  </div>
                                                  <div className="text-xs text-muted-foreground hidden sm:block">
                                                    <span className="block sm:truncate sm:max-w-20 md:max-w-28 lg:max-w-36 xl:max-w-44 2xl:max-w-none text-[10px]">{user.email}</span>
                                                  </div>
                                                </div>
                                              </div>
                                            </TableCell>
                                            {/* Должность */}
                                            <TableCell className="text-xs sm:text-sm lg:text-base px-0.5 sm:px-0.5 md:px-1 lg:px-1 xl:px-2 2xl:px-4 hidden lg:table-cell py-1">
                                              <span className="block lg:truncate lg:max-w-18 xl:max-w-28 2xl:max-w-none text-xs sm:text-sm">{user.position || '—'}</span>
                                            </TableCell>
                                            {/* Категория */}
                                            <TableCell className="text-xs sm:text-sm lg:text-base px-0.5 sm:px-0.5 md:px-1 lg:px-1 xl:px-2 2xl:px-4 hidden lg:table-cell py-1">
                                              <span className="block lg:truncate lg:max-w-16 xl:max-w-24 2xl:max-w-none text-xs sm:text-sm">{user.category || '—'}</span>
                                            </TableCell>
                                            {/* TEMPORARILY HIDDEN: Salary cell (expanded view) */}
                                            {/* Ставка */}
                                            {/* <TableCell className="text-xs sm:text-sm lg:text-base px-0.5 sm:px-0.5 md:px-1 lg:px-1 xl:px-2 2xl:px-4 hidden lg:table-cell py-1">
                                              <div className="text-center">
                                                <span className="text-xs sm:text-sm font-medium">
                                                  {canViewRate(user) && user.salary ? (
                                                    <>
                                                      <span>{user.salary}</span>
                                                      <span className="text-[10px] text-muted-foreground ml-1">{user.isHourly ? 'BYN/ч' : 'BYN'}</span>
                                                    </>
                                                  ) : '—'}
                                                </span>
                                              </div>
                                            </TableCell> */}
                                            {/* Роль */}
                                            <TableCell className="text-xs sm:text-sm lg:text-base px-0.5 sm:px-0.5 md:px-1 lg:px-1 xl:px-2 2xl:px-4 py-1">
                                              <div className="flex flex-col items-start space-y-0.5">
                                                {user.role ? (
                                                  <Badge variant="secondary" className="text-xs">
                                                    {user.role}
                                                  </Badge>
                                                ) : (
                                                  <Badge variant="secondary" className="text-xs">
                                                    —
                                                  </Badge>
                                                )}
                                              </div>
                                            </TableCell>
                                            {/* Значок дома */}
                                            <TableCell className="text-xs sm:text-sm lg:text-base px-0.5 sm:px-0.5 md:px-1 lg:px-1 xl:px-2 2xl:px-4 py-1 w-8">
                                              <div className="flex justify-center">
                                                {workLocationInfo?.icon || (
                                                  <span className="text-muted-foreground text-xs">—</span>
                                                )}
                                              </div>
                                            </TableCell>
                                            {(canEditAllUsers || canEditUser(user)) && (
                                              <TableCell className="w-12 px-1 py-1">
                                                <div className="flex justify-end">
                                                  <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                      <Button variant="ghost" size="icon" className="h-8 w-8">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                        <span className="sr-only">Меню</span>
                                                      </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                      <DropdownMenuItem onClick={() => {
                                                        Sentry.addBreadcrumb({ category: 'ui.open', level: 'info', message: 'UsersList: open edit user', data: { user_id: user.id } })
                                                        handleEditUser(user)
                                                      }}>
                                                        <Edit className="mr-2 h-4 w-4" />
                                                        Редактировать
                                                      </DropdownMenuItem>
                                                      <DropdownMenuSeparator />
                                                      <DropdownMenuItem
                                                        className="text-red-600 dark:text-red-400"
                                                        onClick={() => {
                                                          Sentry.addBreadcrumb({ category: 'ui.open', level: 'info', message: 'UsersList: open delete confirm', data: { user_id: user.id } })
                                                          openDeleteDialog(user)
                                                        }}
                                                        disabled={isDeleting === user.id}
                                                      >
                                                        <Trash className="mr-2 h-4 w-4" />
                                                        {isDeleting === user.id ? "Удаление..." : "Удалить"}
                                                      </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                  </DropdownMenu>
                                                </div>
                                              </TableCell>
                                            )}
                                          </TableRow>
                                        )
                                      })}
                                  </React.Fragment>
                                ))}
                            </React.Fragment>
                          ))}
                      </React.Fragment>
                    )
                  )
                )}
                </TableBody>
              </Table>
            </div>
        )}
        </CardContent>

      {/* Диалог редактирования пользователя */}
      <UserDialog
        open={isDialogOpen}
        onOpenChange={handleDialogClose}
        user={selectedUser}
        onUserUpdated={handleUserUpdated}
      />

      {/* Диалог подтверждения удаления */}
      <DeleteUserConfirm
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        user={userToDelete}
        onConfirm={async () => {
          if (userToDelete) {
            Sentry.addBreadcrumb({ category: 'ui.confirm', level: 'info', message: 'UsersList: confirm delete user', data: { user_id: userToDelete.id } })
          }
          if (userToDelete) {
            await handleDeleteUser(userToDelete.id)
            setDeleteDialogOpen(false)
          }
        }}
      />
    </Card>
    </TooltipProvider>
  )
}

export default Sentry.withProfiler(UsersList, { name: 'UsersList' })
