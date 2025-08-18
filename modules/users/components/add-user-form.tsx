"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { getDepartments, getTeams, getPositions, getCategories, getAvailableRoles } from "@/services/org-data-service"
import { createUserViaAPI } from "@/services/user-api"
import type { Department, Team, Position, Category } from "@/types/db"
import { toast } from "sonner"
import { useAdminPermissions } from "@/modules/users/admin/hooks/useAdminPermissions"
import { UserPlus, AlertCircle } from "lucide-react"

interface AddUserFormData {
  email: string
  firstName: string
  lastName: string
  department: string
  team: string
  position: string
  category: string
  role: string
  roleId: string
  workLocation: "office" | "remote" | "hybrid"
  address: string
}

interface AddUserFormProps {
  onUserAdded?: () => void
}

const DEFAULT_PASSWORD = "enecaworkPass"

export function AddUserForm({ onUserAdded }: AddUserFormProps) {
  const [formData, setFormData] = useState<AddUserFormData>({
    email: "",
    firstName: "",
    lastName: "",
    department: "",
    team: "",
    position: "",
    category: "",
    role: "",
    roleId: "",
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
  const [isDataLoaded, setIsDataLoaded] = useState(false)

  const { canChangeRoles, canAddAdminRole } = useAdminPermissions()

  // Загрузка справочных данных
  useEffect(() => {
    async function loadReferenceData() {
      try {
        setIsLoading(true)
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

        // Загружаем роли
        const availableRoles = await getAvailableRoles(canAddAdminRole)
        setRoles(availableRoles)

        setIsDataLoaded(true)
      } catch (error) {
        console.error("Ошибка загрузки справочных данных:", error)
        toast.error("Не удалось загрузить справочные данные")
      } finally {
        setIsLoading(false)
      }
    }

    loadReferenceData()
  }, [canAddAdminRole])

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

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    
    // Если изменяется роль, обновляем roleId
    if (field === "role") {
      const selectedRole = roles.find(r => r.name === value)
      setFormData((prev) => ({ ...prev, roleId: selectedRole?.id || "" }))
    }
  }

  const resetForm = () => {
    setFormData({
      email: "",
      firstName: "",
      lastName: "",
      department: "",
      team: "",
      position: "",
      category: "",
      role: "",
      roleId: "",
      workLocation: "office",
      address: "",
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Валидация обязательных полей
    if (!formData.email.trim()) {
      toast.error("Email обязателен для заполнения")
      return
    }
    if (!formData.firstName.trim()) {
      toast.error("Имя обязательно для заполнения") 
      return
    }
    if (!formData.lastName.trim()) {
      toast.error("Фамилия обязательна для заполнения")
      return
    }
    
    setIsLoading(true)
    
    try {
      console.log("Создание пользователя с данными:", formData)
      
      // Подготавливаем данные для создания пользователя
      const userData = {
        email: formData.email,
        password: DEFAULT_PASSWORD,
        firstName: formData.firstName,
        lastName: formData.lastName,
        department: formData.department || undefined,
        team: formData.team || undefined,
        position: formData.position || undefined,
        category: formData.category || undefined,
        roleId: formData.roleId || undefined,
        workLocation: formData.workLocation,
        address: formData.address || undefined,
      }
      
      const result = await createUserViaAPI(userData)
      
      if (result.success) {
        toast.success("Пользователь успешно добавлен")
      } else {
        throw new Error(result.error || "Неизвестная ошибка API")
      }
      resetForm()
      if (onUserAdded) {
        onUserAdded()
      }
    } catch (error) {
      console.error("Ошибка при создании пользователя:", error)
      
      let errorMessage = "Неизвестная ошибка"
      if (error instanceof Error) {
        if (error.message.includes("уже существует")) {
          errorMessage = "Пользователь с таким email уже существует в системе"
        } else if (error.message.includes("duplicate key")) {
          errorMessage = "Этот пользователь уже зарегистрирован в системе"
        } else if (error.message.includes("Не авторизован")) {
          errorMessage = "Нет прав для создания пользователей. Обратитесь к администратору."
        } else {
          errorMessage = error.message
        }
      }
      
      toast.error(`Не удалось создать пользователя: ${errorMessage}`)
    } finally {
      setIsLoading(false)
    }
  }

  if (!isDataLoaded) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Ручное добавление пользователя
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mx-auto mb-2"></div>
              <p className="text-gray-500">Загрузка справочных данных...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          Ручное добавление пользователя
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Новому пользователю будет автоматически назначен пароль: <strong>{DEFAULT_PASSWORD}</strong>. 
              Не забудьте сообщить его пользователю для первого входа в систему.
              <br />
              <br />
              <strong>Важно:</strong> Email должен быть уникальным - пользователь с таким же email не должен существовать в системе.
            </AlertDescription>
          </Alert>

          {/* Email */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="email" className="text-right">Email <span className="text-red-500">*</span></Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleChange("email", e.target.value)}
              className="col-span-3"
              placeholder="user@eneca.work"
              required
            />
          </div>

          {/* Пароль (только для отображения) */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="password" className="text-right">Пароль</Label>
            <Input
              id="password"
              type="text"
              value={DEFAULT_PASSWORD}
              className="col-span-3"
              disabled
              readOnly
            />
          </div>

          {/* Имя */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="firstName" className="text-right">Имя <span className="text-red-500">*</span></Label>
            <Input
              id="firstName"
              value={formData.firstName}
              onChange={(e) => handleChange("firstName", e.target.value)}
              className="col-span-3"
              required
            />
          </div>

          {/* Фамилия */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="lastName" className="text-right">Фамилия <span className="text-red-500">*</span></Label>
            <Input
              id="lastName"
              value={formData.lastName}
              onChange={(e) => handleChange("lastName", e.target.value)}
              className="col-span-3"
              required
            />
          </div>

          {/* Отдел */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="department" className="text-right">Отдел</Label>
            <Select
              value={formData.department}
              onValueChange={(value) => handleChange("department", value)}
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

          {/* Команда */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="team" className="text-right">Команда</Label>
            <Select
              value={formData.team}
              onValueChange={(value) => handleChange("team", value)}
              disabled={!formData.department}
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

          {/* Должность */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="position" className="text-right">Должность</Label>
            <Select
              value={formData.position}
              onValueChange={(value) => handleChange("position", value)}
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

          {/* Категория */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="category" className="text-right">Категория</Label>
            <Select
              value={formData.category}
              onValueChange={(value) => handleChange("category", value)}
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

          {/* Роль (если есть разрешение) */}
          {canChangeRoles && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="role" className="text-right">Роль</Label>
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

          {/* Расположение */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="workLocation" className="text-right">Расположение</Label>
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

          {/* Адрес */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="address" className="text-right">Адрес</Label>
            <Textarea
              id="address"
              value={formData.address}
              onChange={(e) => handleChange("address", e.target.value)}
              className="col-span-3"
              placeholder="Укажите адрес"
              rows={2}
            />
          </div>

          {/* Кнопки */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={resetForm}
              disabled={isLoading}
            >
              Очистить форму
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="min-w-[120px]"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Добавление...
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Добавить
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
