"use client"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from "@/components/ui/table"
import { createClient } from "@/utils/supabase/client"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Check, Loader2, X, Save, Trash, AlertTriangle, Info } from "lucide-react"
import { useNotification } from "@/lib/notification-context"

// Константы
const ROLE_NAME_MAX_LENGTH = 20;
const ROLE_DESCRIPTION_MAX_LENGTH = 50;

// Интерфейсы и типы для системы ролей и разрешений
interface Role {
  id: string;
  name: string;
  description?: string;
}

interface Permission {
  id: string;
  name: string;
  description?: string;
}

interface RolePermission {
  role_id: string;
  permission_id: string;
}

// Отслеживание изменений в матрице разрешений до сохранения
interface PendingChange {
  roleId: string;
  permissionId: string;
  action: 'add' | 'remove'; // add - добавление разрешения, remove - удаление
}

/**
 * Генерирует уникальный идентификатор для новых записей
 * @returns UUID v4 строка
 */
function generateUUID(): string {
  return crypto.randomUUID();
}

/**
 * Компонент управления ролями и разрешениями
 * Позволяет создавать/удалять роли и управлять их разрешениями через матрицу
 */
export default function RolesTab() {
  // Основное состояние
  const [roles, setRoles] = useState<Role[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([])
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)

  // Модальные окна
  const [createRoleModalOpen, setCreateRoleModalOpen] = useState(false)
  const [deleteRoleModalOpen, setDeleteRoleModalOpen] = useState(false)
  const [deleteConfirmModalOpen, setDeleteConfirmModalOpen] = useState(false)
  const [saveChangesModalOpen, setSaveChangesModalOpen] = useState(false)
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [selectedRoleId, setSelectedRoleId] = useState("")

  // Данные для создания роли
  const [newRoleName, setNewRoleName] = useState("")
  const [newRoleDescription, setNewRoleDescription] = useState("")

  const notification = useNotification()
  
  // Мемоизируем функцию загрузки данных
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      
      const [rolesResult, permissionsResult, rolePermissionsResult] = await Promise.all([
        supabase.from("roles").select("id, name, description").order("name"),
        supabase.from("permissions").select("id, name, description").order("name"),
        supabase.from("role_permissions").select("role_id, permission_id")
      ])
      
      if (rolesResult.error) {
        console.error('Ошибка при загрузке ролей:', rolesResult.error)
        notification.error("Ошибка загрузки ролей", rolesResult.error.message)
        return
      }
      
      if (permissionsResult.error) {
        console.error('Ошибка при загрузке разрешений:', permissionsResult.error)
        notification.error("Ошибка загрузки разрешений", permissionsResult.error.message)
        return
      }
      
      if (rolePermissionsResult.error) {
        console.error('Ошибка при загрузке связей роль-разрешение:', rolePermissionsResult.error)
        notification.error("Ошибка загрузки связей", rolePermissionsResult.error.message)
        return
      }
      
      setRoles(rolesResult.data || [])
      setPermissions(permissionsResult.data || [])
      setRolePermissions(rolePermissionsResult.data || [])
    } catch (error) {
      console.error('Общая ошибка при загрузке данных:', error)
      notification.error("Ошибка загрузки данных", "Неизвестная ошибка")
    } finally {
      setLoading(false)
    }
  }, [notification])

  // Загружаем данные при монтировании компонента
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Мемоизируем отфильтрованные роли
  const filteredRoles = useMemo(() => {
    return roles.filter(role =>
      role.name.toLowerCase().includes(search.toLowerCase())
    )
  }, [roles, search])

  // Проверяем наличие несохраненных изменений
  const hasChanges = useMemo(() => {
    return pendingChanges.length > 0
  }, [pendingChanges])

  /**
   * Проверяет наличие разрешения у роли
   * @param roleId - ID роли
   * @param permissionId - ID разрешения
   * @returns true если разрешение есть у роли
   */
  const checkHasPermission = useCallback((roleId: string, permissionId: string) => {
    return rolePermissions.some(rp => rp.role_id === roleId && rp.permission_id === permissionId)
  }, [rolePermissions])

  /**
   * Находит ожидающее изменение для комбинации роль-разрешение
   * Используется для отображения промежуточного состояния в матрице
   */
  const getPendingChange = useCallback((roleId: string, permissionId: string) => {
    return pendingChanges.find(change => 
      change.roleId === roleId && change.permissionId === permissionId
    )
  }, [pendingChanges])

  /**
   * Определяет стиль ячейки матрицы на основе текущего состояния и ожидающих изменений
   * - Зеленый: разрешение будет добавлено
   * - Серый: разрешение будет удалено
   * - Черный: активное разрешение
   * - Белый: неактивное разрешение
   */
  const getCellStyle = useCallback((hasPermission: boolean, pendingChange?: PendingChange) => {
    if (pendingChange) {
      if (pendingChange.action === 'add') {
        return "bg-green-500 text-white hover:bg-green-600"
      } else {
        return "bg-gray-400 text-white hover:bg-gray-500"
      }
    }
    
    if (hasPermission) {
      return "bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
    }
    
    return "border border-gray-300 bg-white hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700"
  }, [])

  const getCellIcon = useCallback((hasPermission: boolean, pendingChange?: PendingChange) => {
    if (pendingChange) {
      if (pendingChange.action === 'add') {
        return <Check className="h-4 w-4" />
      } else {
        return <X className="h-4 w-4" />
      }
    }
    
    if (hasPermission) {
      return <Check className="h-4 w-4" />
    }
    
    return null
  }, [])

  /**
   * Обработчик клика по ячейке матрицы
   * Добавляет или удаляет изменение в список ожидающих изменений
   * Изменения применяются только после нажатия кнопки "Сохранить"
   */
  const handleCellClick = useCallback((roleId: string, permissionId: string) => {
    const hasPermission = checkHasPermission(roleId, permissionId)
    const existingChangeIndex = pendingChanges.findIndex(change => 
      change.roleId === roleId && change.permissionId === permissionId
    )
    
    if (existingChangeIndex >= 0) {
      // Убираем существующее изменение если кликнули повторно
      setPendingChanges(prev => prev.filter((_, index) => index !== existingChangeIndex))
    } else {
      // Добавляем новое изменение
      const action = hasPermission ? 'remove' : 'add'
      setPendingChanges(prev => [...prev, { roleId, permissionId, action }])
    }
  }, [checkHasPermission, pendingChanges])

  const handleCreateRole = useCallback(() => {
    setNewRoleName("")
    setNewRoleDescription("")
    setCreateRoleModalOpen(true)
  }, [])

  const handleDeleteRole = useCallback(() => {
    setSelectedRoleId("")
    setDeleteRoleModalOpen(true)
  }, [])

  const handleSaveChanges = useCallback(() => {
    if (hasChanges) {
      setSaveChangesModalOpen(true)
    }
  }, [hasChanges])

  // Обработчики модальных окон
  const handleCreateRoleSubmit = useCallback(async () => {
    if (!newRoleName.trim()) {
      notification.error("Validation Error", "Role name cannot be empty")
      return
    }

    if (newRoleName.trim().length > ROLE_NAME_MAX_LENGTH) {
      notification.error("Validation Error", `Role name must not exceed ${ROLE_NAME_MAX_LENGTH} characters`)
      return
    }

    if (newRoleDescription.trim().length > ROLE_DESCRIPTION_MAX_LENGTH) {
      notification.error("Validation Error", `Role description must not exceed ${ROLE_DESCRIPTION_MAX_LENGTH} characters`)
      return
    }

    // Check for duplicate role names (case-insensitive)
    const existingRole = roles.find(role => 
      role.name.toLowerCase() === newRoleName.trim().toLowerCase()
    )
    
    if (existingRole) {
      notification.error("Validation Error", "A role with this name already exists")
      return
    }

    try {
      setLoading(true)
      const supabase = createClient()
      
      const { error } = await supabase
        .from("roles")
        .insert({
          id: generateUUID(),
          name: newRoleName.trim(),
          description: newRoleDescription.trim() || null
        })
      
      if (error) {
        notification.error("Role Creation Error", error.message)
        return
      }
      
      notification.success("Role Created", `Role "${newRoleName}" was successfully created`)
      setCreateRoleModalOpen(false)
      await fetchData()
    } catch (error) {
      console.error('Error creating role:', error)
      notification.error("Role Creation Error", "Unknown error occurred")
    } finally {
      setLoading(false)
    }
  }, [newRoleName, newRoleDescription, notification, fetchData, roles])

  const handleDeleteRoleConfirm = useCallback(() => {
    const role = roles.find(r => r.id === selectedRoleId)
    if (role) {
      setSelectedRole(role)
      setDeleteRoleModalOpen(false)
      setDeleteConfirmModalOpen(true)
    }
  }, [selectedRoleId, roles])

  const handleDeleteRoleExecute = useCallback(async () => {
    if (!selectedRole) return

    try {
      setLoading(true)
      const supabase = createClient()
      
      // Сначала удаляем все связи роли с разрешениями
      await supabase
        .from("role_permissions")
        .delete()
        .eq("role_id", selectedRole.id)
      
      // Затем удаляем саму роль
      const { error } = await supabase
        .from("roles")
        .delete()
        .eq("id", selectedRole.id)
      
      if (error) {
        notification.error("Ошибка удаления роли", error.message)
        return
      }
      
      notification.success("Роль удалена", `Роль "${selectedRole.name}" успешно удалена`)
      setDeleteConfirmModalOpen(false)
      setSelectedRole(null)
      await fetchData()
    } catch (error) {
      console.error('Ошибка при удалении роли:', error)
      notification.error("Ошибка удаления роли", "Неизвестная ошибка")
    } finally {
      setLoading(false)
    }
  }, [selectedRole, notification, fetchData])

  /**
   * Saves all accumulated changes to the database using optimized batch operations
   * Uses bulk operations for better performance and atomicity
   */
  const handleSaveChangesExecute = useCallback(async () => {
    try {
      setLoading(true)
      const supabase = createClient()
      
      const toInsert = []
      const toDeleteIds = []
      
      // Separate changes into insert and delete operations
      for (const change of pendingChanges) {
        if (change.action === 'add') {
          toInsert.push({
            id: generateUUID(),
            role_id: change.roleId,
            permission_id: change.permissionId
          })
        } else {
          // Collect IDs for bulk delete
          const existingPermission = rolePermissions.find(rp => 
            rp.role_id === change.roleId && rp.permission_id === change.permissionId
          )
          if (existingPermission) {
            toDeleteIds.push({ role_id: change.roleId, permission_id: change.permissionId })
          }
        }
      }
      
      // Execute operations
      if (toInsert.length > 0) {
        const { error: insertError } = await supabase.from("role_permissions").insert(toInsert)
        if (insertError) {
          notification.error("Error adding permissions", insertError.message)
          return
        }
      }
      
      // Use optimized bulk delete for better performance
      if (toDeleteIds.length > 0) {
        const deletePromises = toDeleteIds.map(item => 
          supabase
            .from("role_permissions")
            .delete()
            .eq("role_id", item.role_id)
            .eq("permission_id", item.permission_id)
        );
        
        const results = await Promise.all(deletePromises);
        const errors = results.filter(r => r.error);
        
        if (errors.length > 0) {
          notification.error("Error removing permissions", 
            `Failed to remove ${errors.length} permissions`);
          return;
        }
      }
      
      // Update data and clear changes
      await fetchData()
      setPendingChanges([])
      setSaveChangesModalOpen(false)
      
      notification.success("Changes Saved", "Role permissions have been successfully updated")
    } catch (error) {
      console.error('Error saving changes:', error)
      notification.error("Save Error", "Unknown error occurred")
    } finally {
      setLoading(false)
    }
  }, [pendingChanges, notification, fetchData, rolePermissions])

  // Рендер матрицы разрешений
  const renderPermissionMatrix = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Загрузка данных...
        </div>
      )
    }

    if (permissions.length === 0 || filteredRoles.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          {permissions.length === 0 ? "Разрешения не найдены" : "Роли не найдены"}
        </div>
      )
    }

    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-80 text-left">
                Разрешения
              </TableHead>
              {filteredRoles.map(role => (
                <TableHead key={role.id} className="w-32 text-center">
                  <span className="truncate" title={role.name}>
                    {role.name}
                  </span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {permissions.map(permission => (
              <TableRow key={permission.id} className="hover:bg-transparent">
                <TableCell className="w-80 font-medium">
                  <div className="flex items-center gap-2">
                    <span className="truncate">{permission.name}</span>
                    {permission.description && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent 
                            className="max-w-xs bg-green-50 border-green-200 text-green-800 dark:bg-green-900/50 dark:border-green-700 dark:text-green-200"
                            side="top"
                          >
                            <p className="text-sm">{permission.description}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </TableCell>
                {filteredRoles.map(role => (
                  <TableCell key={`${role.id}-${permission.id}`} className="w-32 text-center">
                    {renderPermissionCell(role.id, permission.id)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  const renderPermissionCell = (roleId: string, permissionId: string) => {
    const hasPermission = checkHasPermission(roleId, permissionId)
    const pendingChange = getPendingChange(roleId, permissionId)
    const cellStyle = getCellStyle(hasPermission, pendingChange)
    const icon = getCellIcon(hasPermission, pendingChange)
    
    // Находим объекты роли и разрешения
    const permission = permissions.find(p => p.id === permissionId)
    const role = roles.find(r => r.id === roleId)
    
    return (
      <div className="flex justify-center items-center">
        <button
          className={`w-8 h-8 rounded border flex items-center justify-center transition-colors ${cellStyle}`}
          onClick={() => handleCellClick(roleId, permissionId)}
          disabled={loading}
          aria-label={`${hasPermission ? 'Remove' : 'Add'} permission${permission?.name ? ` ${permission.name}` : ''} for role${role?.name ? ` ${role.name}` : ''}`}
        >
          {icon}
        </button>
      </div>
    )
  }

  // Рендер модальных окон
  const renderCreateRoleModal = () => (
    <Dialog open={createRoleModalOpen} onOpenChange={setCreateRoleModalOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Создание роли</DialogTitle>
          <DialogDescription>
            Добавление новой роли в таблицу "roles"
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Input
              placeholder="Название роли"
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              disabled={loading}
              maxLength={ROLE_NAME_MAX_LENGTH}
            />
          </div>
          <div>
            <Input
              placeholder="Описание (опционально)"
              value={newRoleDescription}
              onChange={(e) => setNewRoleDescription(e.target.value)}
              disabled={loading}
              maxLength={ROLE_DESCRIPTION_MAX_LENGTH}
            />
          </div>
        </div>
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => setCreateRoleModalOpen(false)}
            disabled={loading}
          >
            <X className="mr-2 h-4 w-4" /> Отменить
          </Button>
          <Button 
            onClick={handleCreateRoleSubmit}
            disabled={loading || !newRoleName.trim() || newRoleName.trim().length > ROLE_NAME_MAX_LENGTH || newRoleDescription.trim().length > ROLE_DESCRIPTION_MAX_LENGTH}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Создание...
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" /> Сохранить
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  const renderDeleteRoleModal = () => (
    <Dialog open={deleteRoleModalOpen} onOpenChange={setDeleteRoleModalOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Удаление роли</DialogTitle>
          <DialogDescription>
            Выберите роль для удаления
          </DialogDescription>
        </DialogHeader>
        <Select value={selectedRoleId} onValueChange={setSelectedRoleId} disabled={loading}>
          <SelectTrigger>
            <SelectValue placeholder="Выберите роль" />
          </SelectTrigger>
          <SelectContent>
            {roles.map(role => (
              <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => setDeleteRoleModalOpen(false)}
            disabled={loading}
          >
            <X className="mr-2 h-4 w-4" /> Отменить
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleDeleteRoleConfirm}
            disabled={loading || !selectedRoleId}
          >
            <Trash className="mr-2 h-4 w-4" /> Удалить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  const renderDeleteConfirmModal = () => (
    <Dialog open={deleteConfirmModalOpen} onOpenChange={setDeleteConfirmModalOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-destructive mr-2" />
            Удаление роли
          </DialogTitle>
          <DialogDescription>
            Вы уверены, что хотите удалить роль "{selectedRole?.name}"? 
            Это действие нельзя отменить.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => setDeleteConfirmModalOpen(false)}
            disabled={loading}
          >
            <X className="mr-2 h-4 w-4" /> Отменить
          </Button>
          <Button 
            variant="default"
            onClick={handleDeleteRoleExecute}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Удаление...
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" /> Подтвердить
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  const renderSaveChangesModal = () => (
    <Dialog open={saveChangesModalOpen} onOpenChange={setSaveChangesModalOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Сохранение изменений</DialogTitle>
          <DialogDescription>
            Вы уверены, что хотите сохранить эти изменения? 
            Это действие нельзя отменить.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => setSaveChangesModalOpen(false)}
            disabled={loading}
          >
            <X className="mr-2 h-4 w-4" /> Отменить
          </Button>
          <Button 
            onClick={handleSaveChangesExecute}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Сохранение...
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" /> Сохранить
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  return (
    <div className="mb-6 space-y-6">
      {/* Верхний блок с заголовком и кнопками */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <CardTitle className="text-xl font-semibold">Управление ролями</CardTitle>
            <div className="flex justify-end gap-2">
              <Input
                placeholder="Поиск ролей..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-xs"
                disabled={loading}
              />
              <Button onClick={handleCreateRole} disabled={loading}>
                Создать роль
              </Button>
              <Button variant="destructive" onClick={handleDeleteRole} disabled={loading}>
                Удалить роль
              </Button>
              <Button 
                variant={hasChanges ? "default" : "secondary"} 
                size="icon"
                className="h-10 w-10 min-w-10 p-0"
                disabled={!hasChanges || loading}
                onClick={handleSaveChanges}
                title="Сохранить изменения"
              >
                <Save className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Таблица-матрица разрешений */}
      <Card>
        <CardContent className="p-0">
          {renderPermissionMatrix()}
        </CardContent>
      </Card>

      {/* Модальные окна */}
      {renderCreateRoleModal()}
      {renderDeleteRoleModal()}
      {renderDeleteConfirmModal()}
      {renderSaveChangesModal()}
    </div>
  )
} 