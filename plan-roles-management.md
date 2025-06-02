# План реализации вкладки "Управление ролями" в панели администратора

## Обзор задачи
Добавить новую вкладку "Управление ролями" в панель администратора с полным функционалом для управления ролями и разрешениями через интерактивную таблицу.

## Структура базы данных
Уже существующие таблицы:
- `roles` (id, name, description, created_at)
- `permissions` (id, name, description, created_at)  
- `role_permissions` (id, role_id, permission_id, created_at)

## Файлы для создания/изменения

### 1. Новые файлы
#### 1.1 `app/dashboard/admin/RolesTab.tsx` - единственный новый файл
- Основной компонент вкладки управления ролями (аналогично `CategoriesTab.tsx`)
- Включает ВСЮ логику в одном файле:
  - Поиск ролей
  - Кнопки создания и удаления ролей
  - Кнопка сохранения (только иконка, активна при изменениях)
  - Интерактивная таблица-матрица разрешений
  - Модальные окна для создания/удаления ролей
  - Модальное окно подтверждения сохранения изменений

### 2. Изменения существующих файлов
#### 2.1 `app/dashboard/admin/AdminPanel.tsx`
- Добавить импорт `RolesTab`
- Добавить новую вкладку после "Категории"
- Добавить контент вкладки

## Детальная реализация

### 3. Структура RolesTab.tsx

#### 3.1 Интерфейсы и типы
```typescript
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

interface PendingChange {
  roleId: string;
  permissionId: string;
  action: 'add' | 'remove';
}
```

#### 3.2 Состояние компонента
```typescript
const [roles, setRoles] = useState<Role[]>([])
const [permissions, setPermissions] = useState<Permission[]>([])
const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([])
const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([])
const [search, setSearch] = useState("")
const [loading, setLoading] = useState(false)

// Модальные окна
const [createRoleModalOpen, setCreateRoleModalOpen] = useState(false)
const [deleteRoleModalOpen, setDeleteRoleModalOpen] = useState(false)
const [saveChangesModalOpen, setSaveChangesModalOpen] = useState(false)
const [selectedRole, setSelectedRole] = useState<Role | null>(null)
```

#### 3.3 Структура компонента (аналогично CategoriesTab)
```jsx
return (
  <div className="mb-6 space-y-6">
    {/* Верхний блок с заголовком и кнопками */}
    <Card>
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <CardTitle className="text-xl font-semibold">Управление ролями</CardTitle>
          <div className="flex justify-end gap-2">
            <Input placeholder="Поиск ролей..." value={search} onChange={...} />
            <Button onClick={handleCreateRole}>Создать роль</Button>
            <Button variant="destructive" onClick={handleDeleteRole}>Удалить роль</Button>
            <Button 
              variant={hasChanges ? "default" : "secondary"} 
              size="icon"
              disabled={!hasChanges}
              onClick={handleSaveChanges}
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
    {renderModals()}
  </div>
)
```

#### 3.4 Матрица разрешений (внутри RolesTab)
```jsx
const renderPermissionMatrix = () => {
  return (
    <div className="overflow-auto max-h-96">
      <table className="w-full">
        <thead className="bg-gray-50 sticky top-0">
          <tr>
            <th className="w-1/4 p-3 text-left font-medium">Разрешения</th>
            {filteredRoles.map(role => (
              <th key={role.id} className="p-3 text-center font-medium min-w-32">
                {role.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {permissions.map(permission => (
            <tr key={permission.id} className="border-t">
              <td className="p-3 font-medium">{permission.name}</td>
              {filteredRoles.map(role => (
                <td key={`${role.id}-${permission.id}`} className="p-3 text-center">
                  {renderPermissionCell(role.id, permission.id)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const renderPermissionCell = (roleId: string, permissionId: string) => {
  const hasPermission = checkHasPermission(roleId, permissionId)
  const pendingChange = getPendingChange(roleId, permissionId)
  
  const cellStyle = getCellStyle(hasPermission, pendingChange)
  const icon = getCellIcon(hasPermission, pendingChange)
  
  return (
    <button
      className={`w-8 h-8 rounded border flex items-center justify-center transition-colors ${cellStyle}`}
      onClick={() => handleCellClick(roleId, permissionId)}
    >
      {icon}
    </button>
  )
}
```

### 4. Модальные окна (внутри RolesTab)

#### 4.1 Создание роли
```jsx
const renderCreateRoleModal = () => (
  <Dialog open={createRoleModalOpen} onOpenChange={setCreateRoleModalOpen}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Создание роли</DialogTitle>
        <DialogDescription>Добавление новой роли в таблицу "roles"</DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <Input
          placeholder="Название роли"
          value={newRoleName}
          onChange={(e) => setNewRoleName(e.target.value)}
        />
        <Input
          placeholder="Описание (опционально)"
          value={newRoleDescription}
          onChange={(e) => setNewRoleDescription(e.target.value)}
        />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => setCreateRoleModalOpen(false)}>
          <X className="mr-2 h-4 w-4" /> Отменить
        </Button>
        <Button onClick={handleCreateRoleSubmit}>
          <Check className="mr-2 h-4 w-4" /> Сохранить
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
)
```

#### 4.2 Удаление роли
```jsx
const renderDeleteRoleModal = () => (
  <Dialog open={deleteRoleModalOpen} onOpenChange={setDeleteRoleModalOpen}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Удаление роли</DialogTitle>
        <DialogDescription>Выберите роль для удаления</DialogDescription>
      </DialogHeader>
      <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
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
        <Button variant="outline" onClick={() => setDeleteRoleModalOpen(false)}>
          <X className="mr-2 h-4 w-4" /> Отменить
        </Button>
        <Button variant="destructive" onClick={handleDeleteRoleConfirm}>
          <Trash className="mr-2 h-4 w-4" /> Удалить
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
)
```

#### 4.3 Подтверждение удаления (второе окно)
```jsx
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
        <Button variant="outline" onClick={() => setDeleteConfirmModalOpen(false)}>
          <X className="mr-2 h-4 w-4" /> Отменить
        </Button>
        <Button variant="destructive" onClick={handleDeleteRoleExecute}>
          <Check className="mr-2 h-4 w-4" /> Подтвердить
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
)
```

#### 4.4 Сохранение изменений
```jsx
const renderSaveChangesModal = () => (
  <Dialog open={saveChangesModalOpen} onOpenChange={setSaveChangesModalOpen}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Сохранение изменений</DialogTitle>
        <DialogDescription>
          Вы уверены, что хотите сохранить эти изменения? 
          Это действие нельзя отменить.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" onClick={() => setSaveChangesModalOpen(false)}>
          <X className="mr-2 h-4 w-4" /> Отменить
        </Button>
        <Button onClick={handleSaveChangesExecute}>
          <Check className="mr-2 h-4 w-4" /> Сохранить
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
)
```

### 5. API функции (внутри RolesTab)

#### 5.1 Загрузка данных
```typescript
const fetchData = useCallback(async () => {
  setLoading(true)
  try {
    const supabase = createClient()
    
    const [rolesResult, permissionsResult, rolePermissionsResult] = await Promise.all([
      supabase.from("roles").select("id, name, description").order("name"),
      supabase.from("permissions").select("id, name, description").order("name"),
      supabase.from("role_permissions").select("role_id, permission_id")
    ])
    
    if (rolesResult.data) setRoles(rolesResult.data)
    if (permissionsResult.data) setPermissions(permissionsResult.data)
    if (rolePermissionsResult.data) setRolePermissions(rolePermissionsResult.data)
  } catch (error) {
    notification.error("Ошибка загрузки данных", error)
  } finally {
    setLoading(false)
  }
}, [])
```

#### 5.2 Сохранение изменений матрицы
```typescript
const handleSaveChangesExecute = useCallback(async () => {
  try {
    setLoading(true)
    const supabase = createClient()
    
    const toInsert = []
    const toDelete = []
    
    for (const change of pendingChanges) {
      if (change.action === 'add') {
        toInsert.push({
          id: generateUUID(),
          role_id: change.roleId,
          permission_id: change.permissionId
        })
      } else {
        // Найти ID записи для удаления
        const existing = rolePermissions.find(rp => 
          rp.role_id === change.roleId && rp.permission_id === change.permissionId
        )
        if (existing) {
          toDelete.push({ role_id: change.roleId, permission_id: change.permissionId })
        }
      }
    }
    
    // Выполнить операции
    if (toInsert.length > 0) {
      await supabase.from("role_permissions").insert(toInsert)
    }
    
    if (toDelete.length > 0) {
      for (const del of toDelete) {
        await supabase
          .from("role_permissions")
          .delete()
          .eq("role_id", del.role_id)
          .eq("permission_id", del.permission_id)
      }
    }
    
    // Обновить данные и очистить изменения
    await fetchData()
    setPendingChanges([])
    setSaveChangesModalOpen(false)
    
    notification.success("Изменения сохранены", "Разрешения ролей успешно обновлены")
  } catch (error) {
    notification.error("Ошибка сохранения", error)
  } finally {
    setLoading(false)
  }
}, [pendingChanges, rolePermissions, fetchData])
```

### 6. Порядок реализации

1. **Этап 1**: Создать `RolesTab.tsx` с базовой структурой и загрузкой данных
2. **Этап 2**: Реализовать модальные окна создания и удаления ролей
3. **Этап 3**: Создать матрицу разрешений с базовым отображением
4. **Этап 4**: Добавить интерактивность к ячейкам матрицы
5. **Этап 5**: Реализовать сохранение изменений
6. **Этап 6**: Добавить вкладку в `AdminPanel.tsx`
7. **Этап 7**: Тестирование и полировка

### 7. Используемые иконки (lucide-react)
- `Check` - галочка
- `X` - крестик  
- `Save` - сохранение
- `Trash` - удаление
- `AlertTriangle` - предупреждение

Этот упрощенный план следует существующей архитектуре и создает минимум новых файлов, сохраняя всю логику в одном компоненте `RolesTab.tsx`. 