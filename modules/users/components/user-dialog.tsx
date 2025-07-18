"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Modal, ModalButton } from '@/components/modals'
import { Save } from 'lucide-react'
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { updateUser, getDepartments, getTeams, getPositions, getCategories, getAvailableRoles } from "@/services/org-data-service"
import { getUserRoleAndPermissions } from "@/utils/role-utils"
import type { User, Department, Team, Position, Category } from "@/types/db"
import { toast } from "@/components/ui/use-toast"
import { useUserStore } from "@/stores/useUserStore"
import { createClient } from "@/utils/supabase/client"
import { useAdminPermissions } from "@/modules/users/admin/hooks/useAdminPermissions"
import { useUserPermissions } from "../hooks/useUserPermissions"

interface UserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: User | null
  onUserUpdated?: () => void
  isSelfEdit?: boolean
}

export function UserDialog({ open, onOpenChange, user, onUserUpdated, isSelfEdit = false }: UserDialogProps) {
  const [formData, setFormData] = useState<Partial<User & { firstName?: string; lastName?: string; roleId?: string }>>({
    firstName: "",
    lastName: "",
    email: "",
    position: "",
    department: "",
    team: "",
    category: "",
    role: "",
    roleId: "",
    isActive: true,
    workLocation: "office",
    address: "",
  })

  const [departments, setDepartments] = useState<Department[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [filteredTeams, setFilteredTeams] = useState<Team[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [roles, setRoles] = useState<{ id: string; name: string; description?: string }[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const setUser = useUserStore((state) => state.setUser)
  const currentUserId = useUserStore((state) => state.id)
  const { canChangeRoles, canAddAdminRole } = useAdminPermissions()
  const { canEditAllUsers, canEditStructures } = useUserPermissions()

  // Определяем, может ли пользователь редактировать роли
  const canEditRoles = !isSelfEdit && (canChangeRoles || canAddAdminRole)

  // Определяем, может ли пользователь редактировать организационные поля
  // При самостоятельном редактировании все пользователи могут редактировать все поля своего профиля
  // При редактировании других пользователей проверяем разрешение на редактирование всех пользователей
  const canEditOrganizationalFields = isSelfEdit ? true : canEditAllUsers

  // Определяем, может ли пользователь редактировать структуры (команды, отделы, должности, категории)
  // Это разрешение позволяет создавать новые структуры в процессе редактирования
  const canEditStructureData = canEditStructures

  // Определяем, редактирует ли пользователь свой собственный профиль
  const isEditingOwnProfile = user?.id === currentUserId

  // Загрузка справочных данных
  useEffect(() => {
    async function loadReferenceData() {
      try {
        const [depts, allTeams, pos, cats] = await Promise.all([
          getDepartments(),
          getTeams(),
          getPositions(),
          getCategories(),
        ])

        setDepartments(depts)
        setTeams(allTeams)
        setPositions(pos)
        setCategories(cats)

        // Загружаем роли только если пользователь может их редактировать
        if (canEditRoles) {
          const availableRoles = await getAvailableRoles(canAddAdminRole)
          setRoles(availableRoles)
        }
      } catch (error) {
        console.error("Ошибка загрузки справочных данных:", error)
        toast({
          title: "Ошибка",
          description: "Не удалось загрузить справочные данные",
          variant: "destructive",
        })
      }
    }

    if (open) {
      loadReferenceData()
    }
  }, [open, canEditRoles, canAddAdminRole])

  // Изменим установку данных пользователя при открытии диалога
  useEffect(() => {
    if (user) {
      // Разделяем имя на firstName и lastName, если они есть
      let firstName = ""
      let lastName = ""
      if (user.name) {
        const parts = user.name.split(" ")
        firstName = parts[0] || ""
        lastName = parts.slice(1).join(" ") || ""
      }

      // Получаем ID роли по её имени
      const roleId = roles.find(r => r.name === user.role)?.id || ""
      
      // Устанавливаем значение роли для Select (роль как есть, без fallback на "none")
      const roleValue = user.role || ""

      // Получаем ID команды по её названию
      const teamId = teams.find(t => t.name === user.team)?.id || ""

      setFormData({
        firstName,
        lastName,
        email: user.email,
        position: user.position,
        department: user.department,
        team: teamId, // Теперь используем ID команды
        category: user.category,
        role: roleValue,
        roleId,
        isActive: user.isActive,
        workLocation: user.workLocation,
        address: user.address,
      })
    } else {
      setFormData({
        firstName: "",
        lastName: "",
        email: "",
        position: "",
        department: "",
        team: "",
        category: "",
        role: "",
        roleId: "",
        isActive: true,
        workLocation: "office",
        address: "",
      })
    }
  }, [user, open, roles])

  // Фильтрация команд по выбранному отделу
  useEffect(() => {
    if (formData.department) {
      const departmentId = departments.find((d) => d.name === formData.department)?.id
      setFilteredTeams(teams.filter((t) => t.departmentId === departmentId))

      // Если выбранная команда не принадлежит выбранному отделу, сбрасываем её
      if (formData.team) {
        const teamExists = filteredTeams.some((t) => t.id === formData.team)
        if (!teamExists) {
          setFormData((prev) => ({ ...prev, team: "" }))
        }
      }
    } else {
      setFilteredTeams(teams)
    }
  }, [formData.department, departments, teams])

  const handleChange = (field: string, value: string | boolean | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    
    // Если изменяется роль, обновляем roleId
    if (field === "role") {
      const selectedRole = roles.find(r => r.name === value)
      setFormData((prev) => ({ ...prev, roleId: selectedRole?.id || "" }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      if (user) {
        console.log("=== UserDialog: handleSubmit ===");
        console.log("isSelfEdit:", isSelfEdit);
        console.log("canEditAllUsers:", canEditAllUsers);
        console.log("canEditOrganizationalFields:", canEditOrganizationalFields);
        console.log("isEditingOwnProfile:", isEditingOwnProfile);
        console.log("Отправляемые данные формы:", formData);
        
        // Подготавливаем данные для отправки, исключая проблемные поля
        const updateData: any = {
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          address: formData.address,
          workLocation: formData.workLocation,
        }
        
        // Добавляем организационные поля только если пользователь может их редактировать
        if (canEditOrganizationalFields) {
          if (formData.department) updateData.department = formData.department
          if (formData.team) {
            // Преобразуем ID команды обратно в название для API
            const selectedTeam = teams.find(t => t.id === formData.team)
            if (selectedTeam) {
              updateData.team = selectedTeam.name
            }
          }
          if (formData.position) updateData.position = formData.position
          if (formData.category) updateData.category = formData.category
          // Добавляем roleId если пользователь может редактировать роли И роль выбрана
          if (canEditRoles && formData.roleId) updateData.roleId = formData.roleId
          // ВРЕМЕННО ОТКЛЮЧЕНО: колонка is_active отсутствует в таблице profiles
          // TODO: Раскомментировать после добавления колонки is_active
          // if (formData.isActive !== undefined) updateData.isActive = formData.isActive
        }
        
        console.log("Итоговые данные для updateUser:", updateData);
        
        await updateUser(user.id, updateData)
        console.log("updateUser завершен успешно");
        
        // Обновляем Zustand ТОЛЬКО если пользователь редактирует свой профиль
        if (isEditingOwnProfile) {
          console.log("Обновляем Zustand для собственного профиля");
          // Получаем свежие данные пользователя из базы
          const freshSupabase = createClient();
          const { data: freshProfile, error: profileError } = await freshSupabase
            .from("profiles")
            .select("*")
            .eq("user_id", user.id)
            .single()
          
          if (profileError) {
            console.error("Ошибка получения обновленного профиля:", profileError);
          } else if (freshProfile) {
            console.log("Полученный обновленный профиль:", freshProfile);
            
            // Обновляем профиль в Zustand
            setUser({
              id: freshProfile.user_id,
              email: freshProfile.email,
              name: [freshProfile.first_name, freshProfile.last_name].filter(Boolean).join(" "),
              profile: {
                firstName: freshProfile.first_name,
                lastName: freshProfile.last_name,
                departmentId: freshProfile.department_id,
                teamId: freshProfile.team_id,
                positionId: freshProfile.position_id,
                categoryId: freshProfile.category_id,
                workFormat: freshProfile.work_format,
                salary: freshProfile.salary,
                isHourly: freshProfile.is_hourly,
                employmentRate: freshProfile.employment_rate,
                address: freshProfile.address,
                roleId: freshProfile.role_id,
                avatar_url: freshProfile.avatar_url,
              },
            })
            
            // Всегда обновляем разрешения при редактировании собственного профиля
            // (не только при изменении роли, т.к. разрешения могли измениться в БД)
            const { roleId, permissions } = await getUserRoleAndPermissions(user.id, freshSupabase)
            if (roleId) {
              useUserStore.getState().setRoleAndPermissions(roleId, permissions)
              console.log("Разрешения обновлены для пользователя:", { roleId, permissions })
            }
          }
        } else {
          console.log("Не обновляем Zustand, так как редактируем другого пользователя");
        }
        
        toast({
          title: "Успешно",
          description: isEditingOwnProfile ? "Ваш профиль успешно обновлен" : "Пользователь успешно обновлен",
        })
        onOpenChange(false)
        if (onUserUpdated) {
          console.log("Вызываем onUserUpdated callback");
          onUserUpdated()
        } else {
          console.log("onUserUpdated callback отсутствует");
        }
      }
    } catch (error) {
      console.error("Ошибка при сохранении пользователя:", error)
      toast({
        title: "Ошибка",
        description: `Не удалось сохранить пользователя: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Modal isOpen={open} onClose={() => onOpenChange(false)} size="lg">
      <form onSubmit={handleSubmit}>
        <Modal.Header 
          title={isSelfEdit ? "Настройки профиля" : "Редактирование пользователя"}
          subtitle={
            isSelfEdit
              ? "Измените информацию о своем профиле и нажмите Сохранить, когда закончите."
              : "Измените информацию о пользователе и нажмите Сохранить, когда закончите."
          }
        />
        <Modal.Body>
          <div className="grid gap-4 py-4">
            {/* Существующие поля формы */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="firstName" className="text-right">Имя</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => handleChange("firstName", e.target.value)}
                className="col-span-3"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="lastName" className="text-right">Фамилия</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => handleChange("lastName", e.target.value)}
                className="col-span-3"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleChange("email", e.target.value)}
                className="col-span-3"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="department" className="text-right">
                Отдел
              </Label>
              <Select
                value={formData.department}
                onValueChange={(value) => handleChange("department", value)}
                disabled={!canEditOrganizationalFields}
              >
                <SelectTrigger id="department" className="col-span-3">
                  <SelectValue placeholder="Выберите отдел" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((department) => (
                    <SelectItem key={department.id} value={department.name}>
                      {department.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="team" className="text-right">
                Команда
              </Label>
              <Select
                value={formData.team}
                onValueChange={(value) => handleChange("team", value)}
                disabled={!formData.department || !canEditOrganizationalFields}
              >
                <SelectTrigger id="team" className="col-span-3">
                  <SelectValue placeholder="Выберите команду" />
                </SelectTrigger>
                <SelectContent>
                  {filteredTeams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="position" className="text-right">
                Должность
              </Label>
              <Select
                value={formData.position}
                onValueChange={(value) => handleChange("position", value)}
                disabled={!canEditOrganizationalFields}
              >
                <SelectTrigger id="position" className="col-span-3">
                  <SelectValue placeholder="Выберите должность" />
                </SelectTrigger>
                <SelectContent>
                  {positions.map((position) => (
                    <SelectItem key={position.id} value={position.name}>
                      {position.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="category" className="text-right">
                Категория
              </Label>
              <Select
                value={formData.category}
                onValueChange={(value) => handleChange("category", value)}
                disabled={!canEditOrganizationalFields}
              >
                <SelectTrigger id="category" className="col-span-3">
                  <SelectValue placeholder="Выберите категорию" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.name}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {canEditRoles && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="role" className="text-right">
                  Роль
                </Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => handleChange("role", value)}
                >
                  <SelectTrigger id="role" className="col-span-3">
                    <SelectValue placeholder="Выберите роль" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.name}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="workLocation" className="text-right">
                Расположение
              </Label>
              <Select
                value={formData.workLocation}
                onValueChange={(value) => handleChange("workLocation", value as "office" | "remote" | "hybrid")}
              >
                <SelectTrigger id="workLocation" className="col-span-3">
                  <SelectValue placeholder="Выберите расположение" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="office">В офисе</SelectItem>
                  <SelectItem value="remote">Удаленно</SelectItem>
                  <SelectItem value="hybrid">Гибридный формат</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="address" className="text-right">
                Адрес
              </Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) => handleChange("address", e.target.value)}
                className="col-span-3"
                placeholder="Укажите адрес"
                rows={2}
              />
            </div>

            {!isSelfEdit && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="isActive" className="text-right">
                  Активен
                </Label>
                <div className="flex items-center space-x-2 col-span-3">
                  <Switch
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) => handleChange("isActive", checked)}
                  />
                  <Label htmlFor="isActive">{formData.isActive ? "Да" : "Нет"}</Label>
                </div>
              </div>
            )}
          </div>
        </Modal.Body>
        
        <Modal.Footer>
          <ModalButton 
            type="button" 
            variant="cancel"
            onClick={() => onOpenChange(false)} 
            disabled={isLoading}
          >
            Отмена
          </ModalButton>
          <ModalButton 
            type="submit" 
            variant="success"
            loading={isLoading}
            icon={<Save />}
          >
            {isLoading ? "Сохранение..." : "Сохранить"}
          </ModalButton>
        </Modal.Footer>
      </form>
    </Modal>
  )
}
