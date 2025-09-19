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
import { Check, Loader2, X, Save, Trash, AlertTriangle, Info, Key } from "lucide-react"
import { useNotification } from "@/lib/notification-context"
import { validateEntityName, validateRoleName, checkDuplicateName, getDuplicateErrorMessage } from "@/utils/validation"

const ROLE_NAME_MAX_LENGTH = 20
const ROLE_DESCRIPTION_MAX_LENGTH = 50
const PROTECTED_ROLES = ['user', 'admin']
const READ_ONLY = true // Вкладка только для просмотра: без создания/удаления/редактирования

interface Role {
  id: string
  name: string
  description?: string
}

interface Permission {
  id: string
  name: string
  description?: string
}

interface RolePermission {
  role_id: string
  permission_id: string
}

interface PendingChange {
  roleId: string
  permissionId: string
  action: 'add' | 'remove'
}

function generateUUID(): string {
  return crypto.randomUUID()
}

export default function RolesTab() {
  const [roles, setRoles] = useState<Role[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([])
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)

  const [createRoleModalOpen, setCreateRoleModalOpen] = useState(false)
  const [deleteRoleModalOpen, setDeleteRoleModalOpen] = useState(false)
  const [deleteConfirmModalOpen, setDeleteConfirmModalOpen] = useState(false)
  const [saveChangesModalOpen, setSaveChangesModalOpen] = useState(false)
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [selectedRoleId, setSelectedRoleId] = useState("")

  const [newRoleName, setNewRoleName] = useState("")
  const [newRoleDescription, setNewRoleDescription] = useState("")
  const [roleValidation, setRoleValidation] = useState<{isValid: boolean, errors: string[], normalizedValue: string}>({isValid: true, errors: [], normalizedValue: ""})

  const notification = useNotification()
  
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

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Живая валидация названия роли
  useEffect(() => {
    const validation = validateRoleName(newRoleName)
    setRoleValidation(validation)
  }, [newRoleName])

  // Проверка дубликатов ролей
  const roleDuplicateError = useMemo(() => {
    if (!newRoleName.trim() || !roleValidation.isValid) return null
    
    const existingNames = roles.map(role => role.name)
    const isDuplicate = checkDuplicateName(roleValidation.normalizedValue, existingNames)
    
    return isDuplicate ? getDuplicateErrorMessage("role") : null
  }, [newRoleName, roleValidation, roles])

  const filteredRoles = useMemo(() => {
    return roles.filter(role =>
      role.name.toLowerCase().includes(search.toLowerCase())
    )
  }, [roles, search])

  const hasChanges = useMemo(() => {
    return READ_ONLY ? false : pendingChanges.length > 0
  }, [pendingChanges])

  const checkHasPermission = useCallback((roleId: string, permissionId: string) => {
    return rolePermissions.some(rp => rp.role_id === roleId && rp.permission_id === permissionId)
  }, [rolePermissions])

  const getPendingChange = useCallback((roleId: string, permissionId: string) => {
    return pendingChanges.find(change => 
      change.roleId === roleId && change.permissionId === permissionId
    )
  }, [pendingChanges])

  const getCellStyle = useCallback((hasPermission: boolean, pendingChange?: PendingChange) => {
    if (READ_ONLY) {
      return hasPermission
        ? "bg-emerald-500 text-white border-emerald-600"
        : "border border-gray-300 dark:border-gray-600 bg-transparent"
    }

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

  const isProtectedRole = useCallback((roleName: string) => {
    return PROTECTED_ROLES.includes(roleName.toLowerCase())
  }, [])

  const handleCellClick = useCallback((roleId: string, permissionId: string) => {
    const role = roles.find(r => r.id === roleId)
    
    if (role && isProtectedRole(role.name)) {
      const roleDisplayName = role.name === 'admin' ? 'администратора' : 'пользователя'
      notification.error(
        "Действие запрещено", 
        `Роль ${roleDisplayName} нельзя изменить или удалить`
      )
      return
    }

    const hasPermission = checkHasPermission(roleId, permissionId)
    const existingChangeIndex = pendingChanges.findIndex(change => 
      change.roleId === roleId && change.permissionId === permissionId
    )
    
    if (existingChangeIndex >= 0) {
      setPendingChanges(prev => prev.filter((_, index) => index !== existingChangeIndex))
    } else {
      const action = hasPermission ? 'remove' : 'add'
      setPendingChanges(prev => [...prev, { roleId, permissionId, action }])
    }
  }, [checkHasPermission, pendingChanges, roles, isProtectedRole, notification])

  const handleCreateRole = useCallback(() => {
    setNewRoleName("")
    setNewRoleDescription("")
    setRoleValidation({isValid: true, errors: [], normalizedValue: ""})
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

  const handleCreateRoleSubmit = useCallback(async () => {
    // Валидация с помощью специальной функции для ролей
    const validation = validateRoleName(newRoleName)
    
    if (!validation.isValid) {
      notification.error("Ошибка валидации", validation.errors[0])
      return
    }

    if (newRoleDescription.trim().length > ROLE_DESCRIPTION_MAX_LENGTH) {
      notification.error("Ошибка валидации", `Описание роли не может быть длиннее ${ROLE_DESCRIPTION_MAX_LENGTH} символов`)
      return
    }

    // Проверка дубликатов
    const existingNames = roles.map(role => role.name)
    const isDuplicate = checkDuplicateName(validation.normalizedValue, existingNames)
    
    if (isDuplicate) {
      notification.error("Ошибка валидации", getDuplicateErrorMessage("role"))
      return
    }

    try {
      setLoading(true)
      const supabase = createClient()
      
      const { error } = await supabase
        .from("roles")
        .insert({
          id: generateUUID(),
          name: validation.normalizedValue,
          description: newRoleDescription.trim() || null
        })
      
      if (error) {
        notification.error("Role Creation Error", error.message)
        return
      }
      
      notification.success("Role Created", `Role "${newRoleName}" was successfully created`)
      setCreateRoleModalOpen(false)
      setNewRoleName("")
      setNewRoleDescription("")
      setRoleValidation({isValid: true, errors: [], normalizedValue: ""})
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
      
      await supabase
        .from("role_permissions")
        .delete()
        .eq("role_id", selectedRole.id)
      
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

  const handleSaveChangesExecute = useCallback(async () => {
    try {
      setLoading(true)
      const supabase = createClient()
      
      const toInsert = []
      const toDeleteIds = []
      
      for (const change of pendingChanges) {
        if (change.action === 'add') {
          toInsert.push({
            id: generateUUID(),
            role_id: change.roleId,
            permission_id: change.permissionId
          })
        } else {
          const existingPermission = rolePermissions.find(rp => 
            rp.role_id === change.roleId && rp.permission_id === change.permissionId
          )
          if (existingPermission) {
            toDeleteIds.push({ role_id: change.roleId, permission_id: change.permissionId })
          }
        }
      }
      
      const successfulInserts = []
      const successfulDeletes = []
      
      try {
        if (toInsert.length > 0) {
          const { data: insertedData, error: insertError } = await supabase
            .from("role_permissions")
            .insert(toInsert)
            .select()
          
          if (insertError) {
            throw new Error(`Ошибка добавления разрешений: ${insertError.message}`)
          }
          
          successfulInserts.push(...(insertedData || []))
        }
        
        if (toDeleteIds.length > 0) {
          for (const item of toDeleteIds) {
            const { error: deleteError } = await supabase
              .from("role_permissions")
              .delete()
              .eq("role_id", item.role_id)
              .eq("permission_id", item.permission_id)
            
            if (deleteError) {
              throw new Error(`Ошибка удаления разрешения: ${deleteError.message}`)
            }
            
            successfulDeletes.push(item)
          }
        }
        
        await fetchData()
        setPendingChanges([])
        setSaveChangesModalOpen(false)
        
        notification.success("Изменения сохранены", "Разрешения ролей успешно обновлены")
        
      } catch (operationError) {
        console.error('Ошибка при выполнении операций:', operationError)
        
        try {
          if (successfulInserts.length > 0) {
            const rollbackIds = successfulInserts.map(item => item.id)
            await supabase
              .from("role_permissions")
              .delete()
              .in("id", rollbackIds)
          }
          
          if (successfulDeletes.length > 0) {
            const rollbackInserts = successfulDeletes.map(item => ({
              id: generateUUID(),
              role_id: item.role_id,
              permission_id: item.permission_id
            }))
            await supabase
              .from("role_permissions")
              .insert(rollbackInserts)
          }
          
          notification.error("Ошибка сохранения", 
            "Операция отменена, изменения откатаны. Попробуйте еще раз.")
        } catch (rollbackError) {
          console.error('Ошибка отката:', rollbackError)
          notification.error("Критическая ошибка", 
            "Не удалось откатить изменения. Обновите страницу и попробуйте снова.")
        }
        
        await fetchData()
      }
      
    } catch (error) {
      console.error('Критическая ошибка при сохранении изменений:', error)
      notification.error("Ошибка сохранения", 
        "Произошла неизвестная ошибка. Попробуйте обновить страницу.")
    } finally {
      setLoading(false)
    }
  }, [pendingChanges, notification, fetchData, rolePermissions])

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

    // Группируем permissions по категории (префикс до точки)
    const groups = permissions.reduce((acc: Record<string, Permission[]>, p) => {
      const category = (p.name.includes('.') ? p.name.split('.')[0] : 'Общее') || 'Общее'
      if (!acc[category]) acc[category] = []
      acc[category].push(p)
      return acc
    }, {} as Record<string, Permission[]>)

    const orderedGroupEntries = Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]))

    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-64 text-left text-sm">
                Разрешения
              </TableHead>
              {filteredRoles.map(role => (
                <TableHead key={role.id} className="w-24 text-center text-xs">
                  <div className="flex items-center justify-center gap-1" title={role.name}>
                    <span className="truncate">
                      {role.name}
                    </span>
                    {isProtectedRole(role.name) && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Key className="h-3 w-3 stroke-[1.5] fill-transparent dark:stroke-white stroke-black" />
                          </TooltipTrigger>
                          <TooltipContent 
                            className="bg-green-600 border-green-700 text-white dark:bg-green-800 dark:border-green-900 dark:text-green-100"
                            side="top"
                          >
                            <p className="text-sm">Защищенная роль</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {orderedGroupEntries.map(([category, items]) => (
              <>
                <TableRow key={`cat-${category}`}>
                  <TableCell colSpan={1 + filteredRoles.length} className="bg-gray-50 dark:bg-gray-800/50 text-xs font-semibold text-gray-600 dark:text-gray-300">
                    {category}
                  </TableCell>
                </TableRow>
                {items.map(permission => (
                  <TableRow key={permission.id} className="hover:bg-transparent">
                    <TableCell className="w-64 font-medium text-sm">
                      <div className="flex items-center gap-2">
                        <span className="truncate">{permission.name}</span>
                        {permission.description && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent 
                                className="max-w-xs bg-gray-900 border-gray-700 text-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
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
                      <TableCell key={`${role.id}-${permission.id}`} className="w-24 text-center">
                        {renderPermissionCell(role.id, permission.id)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </>
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
    
    const permission = permissions.find(p => p.id === permissionId)
    const role = roles.find(r => r.id === roleId)
    
    if (READ_ONLY) {
      const roIcon = hasPermission ? <Check className="h-3 w-3" /> : null
      return (
        <div className="flex justify-center items-center">
          <div
            className={`w-6 h-6 rounded-md flex items-center justify-center ${cellStyle} cursor-default select-none`}
            aria-hidden
            title={hasPermission ? 'Разрешение есть' : 'Разрешение отсутствует'}
          >
            {roIcon}
          </div>
        </div>
      )
    }

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

  const renderCreateRoleModal = () => (
    <Dialog open={createRoleModalOpen} onOpenChange={(open) => {
      setCreateRoleModalOpen(open)
      if (!open) {
        setNewRoleName("")
        setNewRoleDescription("")
        setRoleValidation({isValid: true, errors: [], normalizedValue: ""})
      }
    }}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Создание роли</DialogTitle>
          <DialogDescription>
            Введите название новой роли и при необходимости добавьте её описание. 
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Input
              placeholder="Название роли"
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              disabled={loading}
              className={!roleValidation.isValid ? "border-red-500" : ""}
            />
            {roleValidation.errors.length > 0 && (
              <p className="text-sm text-red-500 mt-1">{roleValidation.errors[0]}</p>
            )}
            {roleDuplicateError && roleValidation.errors.length === 0 && (
              <p className="text-sm text-red-500 mt-1">{roleDuplicateError}</p>
            )}
          </div>
          <div>
            <Input
              placeholder="Описание"
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
            disabled={loading || !roleValidation.isValid || !!roleDuplicateError || !newRoleName.trim() || newRoleDescription.trim().length > ROLE_DESCRIPTION_MAX_LENGTH}
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
            Выберите роль, которую хотите удалить. Обратите внимание, что системные роли (Администратор и Пользователь) удалить нельзя.
          </DialogDescription>
        </DialogHeader>
        <Select value={selectedRoleId} onValueChange={setSelectedRoleId} disabled={loading}>
          <SelectTrigger>
            <SelectValue placeholder="Выберите роль" />
          </SelectTrigger>
          <SelectContent>
            {roles.filter(role => !isProtectedRole(role.name)).map(role => (
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
            Вы собираетесь удалить роль "{selectedRole?.name}". Это действие приведет к удалению всех связанных разрешений и не может быть отменено. Пользователи с этой ролью потеряют соответствующие права доступа.
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
            Вы внесли изменения в разрешения ролей. После сохранения эти изменения вступят в силу немедленно и повлияют на права доступа пользователей с измененными ролями.
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
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <CardTitle className="text-xl font-semibold">Роли и разрешения</CardTitle>
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-700">Только просмотр</span>
            </div>
            <div className="flex justify-end gap-2">
              <Input
                placeholder="Поиск ролей..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-xs h-8 text-sm"
                disabled={loading}
              />
              {/* Управляющие действия скрыты в режиме только чтение */}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {renderPermissionMatrix()}
        </CardContent>
      </Card>

      {/* Модальные окна действий отключены в режиме только чтение */}
    </div>
  )
} 