"use client"

import type React from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useState, useEffect } from "react"
import { Textarea } from "@/components/ui/textarea"
import { updateUser, getDepartments, getTeams, getPositions, getCategories } from "@/services/org-data-service"
import type { User, Department, Team, Position, Category } from "@/types/db"
import { toast } from "@/components/ui/use-toast"
import { useUserStore } from "@/stores/useUserStore"
import { createClient } from "@/utils/supabase/client"

interface UserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: User | null
  onUserUpdated?: () => void
  isSelfEdit?: boolean
}

export function UserDialog({ open, onOpenChange, user, onUserUpdated, isSelfEdit = false }: UserDialogProps) {
  const [formData, setFormData] = useState<Partial<User & { firstName?: string; lastName?: string }>>({
    firstName: "",
    lastName: "",
    email: "",
    position: "",
    department: "",
    team: "",
    category: "",
    isActive: true,
    workLocation: "office",
    address: "",
  })

  const [departments, setDepartments] = useState<Department[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [filteredTeams, setFilteredTeams] = useState<Team[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const setUser = useUserStore((state) => state.setUser)

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
  }, [open])

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
      setFormData({
        firstName,
        lastName,
        email: user.email,
        position: user.position,
        department: user.department,
        team: user.team,
        category: user.category,
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
        isActive: true,
        workLocation: "office",
        address: "",
      })
    }
  }, [user, open])

  // Фильтрация команд по выбранному отделу
  useEffect(() => {
    if (formData.department) {
      const departmentId = departments.find((d) => d.name === formData.department)?.id
      setFilteredTeams(teams.filter((t) => t.departmentId === departmentId))

      // Если выбранная команда не принадлежит выбранному отделу, сбрасываем её
      if (formData.team) {
        const teamExists = filteredTeams.some((t) => t.name === formData.team)
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
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      if (user) {
        await updateUser(user.id, {
          ...formData,
          name: undefined, // не отправляем name
        })
        
        // Обновляем Zustand ТОЛЬКО если пользователь редактирует свой профиль
        if (isSelfEdit) {
          // Получаем свежие данные пользователя из базы
          const freshSupabase = createClient();
          const { data: freshProfile } = await freshSupabase
            .from("profiles")
            .select("*")
            .eq("user_id", user.id)
            .single()
          
          if (freshProfile) {
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
              },
            })
          }
        }
        
        toast({
          title: "Успешно",
          description: isSelfEdit ? "Ваш профиль успешно обновлен" : "Пользователь успешно обновлен",
        })
        onOpenChange(false)
        if (onUserUpdated) {
          onUserUpdated()
        }
      }
    } catch (error) {
      console.error("Ошибка при сохранении пользователя:", error)
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить пользователя",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Определяем, какие поля доступны для редактирования в режиме самостоятельного редактирования
  const canEditOrganizationalFields = !isSelfEdit

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isSelfEdit ? "Настройки профиля" : "Редактирование пользователя"}</DialogTitle>
            <DialogDescription>
              {isSelfEdit
                ? "Измените информацию о своем профиле и нажмите Сохранить, когда закончите."
                : "Измените информацию о пользователе и нажмите Сохранить, когда закончите."}
            </DialogDescription>
          </DialogHeader>
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
                    <SelectItem key={team.id} value={team.name}>
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
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Отмена
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Сохранение..." : "Сохранить"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
