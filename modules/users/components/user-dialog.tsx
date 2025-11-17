"use client"

import React, { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Country, City } from "country-state-city"
import { Modal, ModalButton } from '@/components/modals'
import { Save, Plus, Building2, Users } from 'lucide-react'
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { updateUser, getDepartments, getTeams, getPositions, getCategories } from "@/services/org-data-service"
import { getAllRoles, assignRoleToUser, revokeRoleFromUser, getUserRoles } from "@/modules/permissions/supabase/supabasePermissions"
import type { Role } from "@/modules/permissions/types"
// УДАЛЕНО: import getUserRoleAndPermissions - используем новую систему permissions
import type { User, Department, Team, Position, Category } from "@/types/db"
import { toast } from "@/components/ui/use-toast"
import { useUserStore } from "@/stores/useUserStore"
import { createClient } from "@/utils/supabase/client"
import { useAdminPermissions } from "@/modules/users/admin/hooks/useAdminPermissions"
import { useUserPermissions } from "../hooks/useUserPermissions"
import { useUserPermissionsSync } from "@/modules/permissions"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import * as Sentry from "@sentry/nextjs"

interface UserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: User | null
  onUserUpdated?: () => void
  isSelfEdit?: boolean
}

function UserDialog({ open, onOpenChange, user, onUserUpdated, isSelfEdit = false }: UserDialogProps) {
  const [formData, setFormData] = useState<Partial<User & { firstName?: string; lastName?: string }>>({
    firstName: "",
    lastName: "",
    email: "",
    position: "",
    department: "",
    team: "",
    category: "",
    workLocation: "office",
    country: "",
    city: "",
    salary: 0,
    employmentRate: 1,
  })

  const [departments, setDepartments] = useState<Department[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [filteredTeams, setFilteredTeams] = useState<Team[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [countries, setCountries] = useState<{ code: string; name: string }[]>([])
  const [cities, setCities] = useState<{ name: string }[]>([])
  const [selectedCountryCode, setSelectedCountryCode] = useState<string>("")
  
  // Состояние для ролей пользователя (новая система)
  const [userRoles, setUserRoles] = useState<Array<{
    roleId: string
    roleName: string
    assignedAt: string
    assignedByName?: string
  }>>([])
  
  // Состояние для управления ролями
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])
  const [isManagingRoles, setIsManagingRoles] = useState(false)
  const [isRolesModalOpen, setIsRolesModalOpen] = useState(false)
  const [tempSelectedRoles, setTempSelectedRoles] = useState<string[]>([])
  const [isSavingRoles, setIsSavingRoles] = useState(false)
  
  // Добавляем состояния для поиска
  const [countrySearch, setCountrySearch] = useState("")
  const [citySearch, setCitySearch] = useState("")
  const [filteredCountries, setFilteredCountries] = useState<{ code: string; name: string }[]>([])
  const [filteredCities, setFilteredCities] = useState<{ name: string }[]>([])
  const [countrySelectOpen, setCountrySelectOpen] = useState(false)
  const [citySelectOpen, setCitySelectOpen] = useState(false)

  // Refs для автофокуса на поля поиска
  const countrySearchRef = useRef<HTMLInputElement | null>(null)
  const citySearchRef = useRef<HTMLInputElement | null>(null)

  const setUser = useUserStore((state) => state.setUser)
  const currentUserId = useUserStore((state) => state.id)
  const currentUserProfile = useUserStore((state) => state.profile)
  const { canChangeRoles, canAddAdminRole } = useAdminPermissions()
  const { canEditAllUsers, canEditStructures, canEditTeam, canEditDepartment, canEditSubdivision, canAssignRoles, canAssignAdminRole, isAdmin, isUser, isSubdivisionHead, canEditSalaryAll, canEditSalarySubdivision, canEditSalaryDepartment, isDepartmentHead } = useUserPermissions()
  // Возможность перезагрузить permissions-store после изменения ролей
  const { reloadPermissions } = useUserPermissionsSync()

  // Определяем, может ли пользователь редактировать роли
  // Для редактирования чужих ролей нужно разрешение users.assign_roles (canAssignRoles)
  // Для редактирования своих ролей нужно быть администратором
  const canEditRoles = isSelfEdit
    ? isAdmin  // Только администраторы могут менять свои роли
    : canAssignRoles  // Для других пользователей нужно разрешение users.assign_roles

  // Определяем, может ли пользователь редактировать отдел
  // Администраторы и руководители подразделений могут менять отдел
  const canEditDepartmentField = isAdmin || canEditAllUsers || canEditSubdivision

  // Определяем, может ли пользователь редактировать команду
  // Администраторы, руководители подразделений и руководители отделов могут менять команду
  const canEditTeamField = isAdmin || canEditAllUsers || canEditSubdivision || canEditDepartment

  // Определяем, может ли пользователь редактировать должность и категорию
  // При самостоятельном редактировании только роли выше user могут редактировать должность и категорию
  // При редактировании других пользователей проверяем разрешение на редактирование всех пользователей, подразделения или отдела
  const canEditPositionAndCategory = isSelfEdit ? !isUser : (canEditAllUsers || canEditSubdivision || canEditDepartment)

  // Определяем, может ли пользователь редактировать местоположение (расположение, страна, город)
  // При самостоятельном редактировании все пользователи могут редактировать местоположение
  // При редактировании других пользователей проверяем разрешение на редактирование всех пользователей, подразделения или отдела
  const canEditLocationFields = isSelfEdit ? true : (canEditAllUsers || canEditSubdivision || canEditDepartment)

  // Определяем, может ли пользователь редактировать только команду (для users.edit.team)
  // Если есть users.edit.department или users.edit.all, то это не "только команда"
  const canEditOnlyTeam = !isSelfEdit && canEditTeam && !canEditAllUsers && !canEditDepartment

  // Определяем, может ли пользователь редактировать структуры (команды, отделы, должности, категории)
  // Это разрешение позволяет создавать новые структуры в процессе редактирования
  const canEditStructureData = canEditStructures

  // Определяем, может ли пользователь редактировать ставку и загруженность
  // Админ с полными правами может редактировать всех
  // Руководитель подразделения может редактировать сотрудников своего подразделения
  // Руководитель отдела может редактировать только сотрудников своего отдела
  const canEditSalaryFields = React.useMemo(() => {
    // Админ с полными правами может редактировать всех
    if (canEditSalaryAll) return true

    // Руководитель подразделения может редактировать сотрудников своего подразделения
    if (canEditSalarySubdivision) {
      const currentSubdivisionId = currentUserProfile?.subdivisionId || (currentUserProfile as any)?.subdivision_id
      const targetSubdivisionId = user?.subdivisionId

      // Если не известны ID подразделений, запрещаем редактирование
      if (!currentSubdivisionId || !targetSubdivisionId) return false

      return currentSubdivisionId === targetSubdivisionId
    }

    // Руководитель отдела может редактировать только своего отдела
    if (canEditSalaryDepartment) {
      const currentDepartmentId = currentUserProfile?.departmentId
      const targetDepartmentId = user?.departmentId

      // Если не известны ID отделов, запрещаем редактирование
      if (!currentDepartmentId || !targetDepartmentId) return false

      return currentDepartmentId === targetDepartmentId
    }

    return false
  }, [canEditSalaryAll, canEditSalarySubdivision, canEditSalaryDepartment, currentUserProfile, user])

  // Определяем, редактирует ли пользователь свой собственный профиль
  const isEditingOwnProfile = user?.id === currentUserId

  // Загрузка справочных данных
  useEffect(() => {
    async function loadReferenceData() {
      try {
        const [departmentsData, teamsData, positionsData, categoriesData, rolesData] = await Sentry.startSpan({ name: 'Users/UserDialog loadReferenceData', op: 'ui.load' }, async () => Promise.all([
          getDepartments(),
          getTeams(),
          getPositions(),
          getCategories(),
          getAllRoles()
        ]))
        
        console.log("=== UserDialog: Загружены справочные данные ===")
        console.log("departments:", departmentsData)
        console.log("teams:", teamsData)
        console.log("positions:", positionsData)
        console.log("categories:", categoriesData)
        console.log("roles:", rolesData)
        
        setDepartments(departmentsData)
        setTeams(teamsData)
        setPositions(positionsData)
        setCategories(categoriesData)
        setRoles(rolesData)
        
        // Загружаем страны
        const countriesData = Country.getAllCountries().map(c => ({
          code: c.isoCode,
          name: c.name
        }))
        setCountries(countriesData)
        setFilteredCountries(countriesData)
        
      } catch (error) {
        console.error("Ошибка загрузки справочных данных:", error)
        toast({
          title: "Ошибка",
          description: "Не удалось загрузить справочные данные",
          variant: "destructive",
        })
        
        // Устанавливаем пустые массивы при ошибке для предотвращения ошибок рендеринга
        setDepartments([])
        setTeams([])
        setFilteredTeams([])
        setPositions([])
        setCategories([])
        setRoles([])
      }
    }
    
    loadReferenceData()
  }, [])

  // Функция для загрузки ролей пользователя
  const loadUserRoles = async (userId: string) => {
    try {
      const result = await Sentry.startSpan({ name: 'Users/UserDialog loadUserRoles', op: 'ui.load', attributes: { user_id: userId } }, async () => getUserRoles(userId))
      if (result.error) {
        console.error("Ошибка загрузки ролей пользователя:", result.error)
        return
      }
      
      console.log("UserDialog: Загружены роли пользователя:", result.roles)
      setUserRoles(result.roles)
      
      // Устанавливаем выбранные роли для управления
      const roleIds = result.roles.map(r => r.roleId)
      setSelectedRoles(roleIds)
      console.log("UserDialog: Установлены selectedRoles:", roleIds)
    } catch (error) {
      console.error("Ошибка загрузки ролей пользователя:", error)
    }
  }

  // Загрузка стран/городов
  useEffect(() => {
    if (!open) return
    const all = Country.getAllCountries().map(c => ({ code: c.isoCode, name: c.name }))
    setCountries(all)
    setFilteredCountries(all)
  }, [open])

  // Фильтрация стран по поиску
  useEffect(() => {
    if (!countrySearch.trim()) {
      setFilteredCountries(countries)
    } else {
      const filtered = countries.filter(country =>
        country.name.toLowerCase().includes(countrySearch.toLowerCase())
      )
      setFilteredCountries(filtered)
    }
  }, [countrySearch, countries])

  useEffect(() => {
    if (!selectedCountryCode) {
      setCities([])
      setFilteredCities([])
      return
    }
    const loaded = City.getCitiesOfCountry(selectedCountryCode) || []
    // Дедупликация по названию города с дополнительной проверкой
    const seenNames = new Set<string>()
    const unique: { name: string }[] = []

    for (const c of loaded) {
      // Проверяем и нормализуем название города
      const normalizedName = c.name.trim()
      if (normalizedName && !seenNames.has(normalizedName)) {
        seenNames.add(normalizedName)
        unique.push({ name: normalizedName })
      }
    }

    // Сортируем для консистентности
    unique.sort((a, b) => a.name.localeCompare(b.name))

    setCities(unique)
    setFilteredCities(unique)
  }, [selectedCountryCode])

  // Фильтрация городов по поиску
  useEffect(() => {
    if (!citySearch.trim()) {
      setFilteredCities(cities)
    } else {
      const filtered = cities.filter(city =>
        city.name.toLowerCase().includes(citySearch.toLowerCase())
      )
      setFilteredCities(filtered)
    }
  }, [citySearch, cities])

  // Автофокус на поле поиска стран при открытии
  useEffect(() => {
    if (countrySelectOpen) {
      setTimeout(() => {
        if (countrySearchRef.current) {
          countrySearchRef.current.focus()
        }
      }, 100)
    }
  }, [countrySelectOpen])

  // Автофокус на поле поиска городов при открытии
  useEffect(() => {
    if (citySelectOpen && selectedCountryCode) {
      setTimeout(() => {
        if (citySearchRef.current) {
          citySearchRef.current.focus()
        }
      }, 100)
    }
  }, [citySelectOpen, selectedCountryCode])

  // Загрузка данных пользователя при открытии диалога
  useEffect(() => {
    if (open && user) {
      console.log("=== UserDialog: Загрузка данных пользователя ===")
      console.log("user:", user)
      console.log("user.team:", user.team)
      console.log("user.team type:", typeof user.team)
      console.log("user.department:", user.department)
      console.log("user.department type:", typeof user.department)
      
      // Загружаем роли пользователя
      loadUserRoles(user.id)
      
      // Устанавливаем данные формы
      const firstName = user.name?.split(' ')[0] || ""
      const lastName = user.name?.split(' ').slice(1).join(' ') || ""
      
      setFormData({
        firstName,
        lastName,
        email: user.email || "",
        position: user.position || "",
        department: user.department || "",
        team: user.team || "",
        category: user.category || "",
        role: user.role || "",
        workLocation: user.workLocation || "office",
        country: user.country || "",
        city: user.city || "",
        salary: user.salary || 0,
        employmentRate: user.employmentRate || 1,
      })
      
      console.log("=== UserDialog: Установлены данные формы ===")
      console.log("formData.team:", user.team || "")
      console.log("formData.department:", user.department || "")
      
      // Устанавливаем страну
      if (user.country) {
        const foundCountry = countries.find(c => c.name === user.country)
        if (foundCountry) {
          setSelectedCountryCode(foundCountry.code)
          // Загружаем города для выбранной страны
          const citiesData = City.getCitiesOfCountry(foundCountry.code)?.map(c => ({ name: c.name })) || []
          setCities(citiesData)
          setFilteredCities(citiesData)
        }
      }
      
      // Роли теперь управляются отдельно через handleRoleToggle
      
      // Инициализируем filteredTeams на основе отдела пользователя
      if (user.department && user.department !== "") {
        const departmentId = departments.find((d) => d.name === user.department)?.id
        if (departmentId) {
          const filtered = teams.filter((t) => t.departmentId === departmentId)
          setFilteredTeams(filtered)
        }
      } else {
        setFilteredTeams([])
      }

      // Для пользователей с canEditOnlyTeam блокируем изменение отдела
      if (canEditOnlyTeam && user.department) {
        setFormData((prev) => ({
          ...prev,
          department: user.department // Фиксируем отдел пользователя
        }))
      }
    }
  }, [open, user, countries, roles, canEditRoles, departments, teams, canEditOnlyTeam])
  // Фильтрация команд по выбранному отделу
  useEffect(() => {
    console.log("=== UserDialog: Фильтрация команд ===")
    console.log("formData.department:", formData.department)
    console.log("formData.team:", formData.team)
    console.log("departments:", departments)
    console.log("teams:", teams)
    
    if (formData.department && formData.department !== "") {
      const departmentId = departments.find((d) => d.name === formData.department)?.id
      console.log("Найденный departmentId:", departmentId)
      
      const filtered = teams.filter((t) => t.departmentId === departmentId)
      console.log("Отфильтрованные команды:", filtered)
      setFilteredTeams(filtered)

      // Если выбранная команда не принадлежит выбранному отделу, сбрасываем её
      if (formData.team && formData.team !== "") {
        const teamExists = filtered.some((t) => t.name === formData.team)
        console.log("Команда найдена по имени:", teamExists)
        
        if (!teamExists) {
          console.log("Сбрасываем команду, так как она не принадлежит отделу")
          setFormData((prev) => ({ ...prev, team: "" }))
        }
      }
    } else {
      console.log("Отдел не выбран, сбрасываем команду и показываем пустой список")
      setFilteredTeams([])
      // Сбрасываем команду при сбросе отдела
      if (formData.team && formData.team !== "") {
        setFormData((prev) => ({ ...prev, team: "" }))
      }
    }
  }, [formData.department, departments, teams])

  const handleChange = (field: string, value: string | boolean | number) => {
    setFormData((prev) => {
      let processedValue = value
      
      // Преобразуем специальные значения в пустые строки для внутреннего состояния
      if (field === "department" && value === "no-department") {
        processedValue = ""
      } else if (field === "team" && value === "no-team") {
        processedValue = ""
      }
      
      const newData = { ...prev, [field]: processedValue }
      
      // При изменении отдела сбрасываем команду
      if (field === "department") {
        newData.team = ""
      }
      
      return newData
    })
  }

  // Управление ролями теперь только через модальное окно

  // Функция для сохранения изменений ролей
  const handleSaveRoles = async () => {
    if (!user?.id) return
    
    setIsSavingRoles(true)
    let addedCount = 0
    let removedCount = 0
    try {
      // Получаем текущие роли пользователя
      const currentRoleIds = userRoles.map(ur => ur.roleId)
      
      // Роли для добавления
      const rolesToAdd = tempSelectedRoles.filter(roleId => !currentRoleIds.includes(roleId))
      
      // Роли для удаления
      const rolesToRemove = currentRoleIds.filter(roleId => !tempSelectedRoles.includes(roleId))
      
      // Проверяем что после удаления у пользователя останется хотя бы одна роль
      if (rolesToRemove.length > 0 && tempSelectedRoles.length === 0) {
        toast({
          title: "Невозможно удалить все роли",
          description: "У пользователя должна быть хотя бы одна роль",
          variant: "destructive",
        })
        setIsSavingRoles(false)
        return
      }
      
      console.log("=== handleSaveRoles ===")
      console.log("currentRoleIds:", currentRoleIds)
      console.log("tempSelectedRoles:", tempSelectedRoles)
      console.log("rolesToAdd:", rolesToAdd)
      console.log("rolesToRemove:", rolesToRemove)
      
      let success = true
      
      // Добавляем новые роли
      for (const roleId of rolesToAdd) {
        const result = await Sentry.startSpan({ name: 'Users/UserDialog assignRole', op: 'db.write', attributes: { role_id: roleId, user_id: user.id } }, async () => assignRoleToUser(user.id, roleId, currentUserId || undefined))
        if (result) {
          addedCount++
        } else {
          success = false
          break
        }
      }
      
      // Удаляем роли
      for (const roleId of rolesToRemove) {
        const result = await Sentry.startSpan({ name: 'Users/UserDialog revokeRole', op: 'db.write', attributes: { role_id: roleId, user_id: user.id } }, async () => revokeRoleFromUser(user.id, roleId))
        if (result) {
          removedCount++
        } else {
          success = false
          break
        }
      }
      
      if (success) {
        // Обновляем список ролей пользователя
        await loadUserRoles(user.id)
        
        // Обновляем tempSelectedRoles для синхронизации с основным интерфейсом
        // После loadUserRoles selectedRoles уже обновлены
        setTempSelectedRoles(selectedRoles)
        
        toast({
          title: "Успешно",
          description: `Роли обновлены: добавлено ${addedCount}, удалено ${removedCount}`,
        })
        // Перезагружаем permissions-store для текущего пользователя,
        // чтобы страница debug и гварды сразу увидели актуальные права
        reloadPermissions()
        
        // Закрываем модальное окно
        setIsRolesModalOpen(false)
      } else {
        toast({
          title: "Ошибка",
          description: "Не удалось обновить роли",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Ошибка при сохранении ролей:', error)
      toast({
        title: "Ошибка",
        description: "Произошла ошибка при сохранении ролей",
        variant: "destructive",
      })
    } finally {
      setIsSavingRoles(false)
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
        console.log("canEditPositionAndCategory:", canEditPositionAndCategory);
        console.log("canEditLocationFields:", canEditLocationFields);
        console.log("isEditingOwnProfile:", isEditingOwnProfile);
        console.log("Отправляемые данные формы:", formData);
        
        // Подготавливаем данные для отправки, исключая проблемные поля
        const updateData: any = {
          firstName: formData.firstName,
          lastName: formData.lastName,
          country: formData.country,
          city: formData.city,
          workLocation: formData.workLocation,
        }

        // Обновляем email только если он действительно изменился
        const trimmedEmail = (formData.email || "").trim()
        const currentEmail = (user.email || "").trim()
        if (trimmedEmail && trimmedEmail !== currentEmail) {
          updateData.email = trimmedEmail
        }
        
        // Добавляем отдел если пользователь может его редактировать
        if (canEditDepartmentField) {
          // Отдел - может быть пустым (null)
          updateData.department = formData.department && formData.department !== "" ? formData.department : null
        }

        // Добавляем команду если пользователь может её редактировать
        if (canEditTeamField) {
          // Если пользователь не может редактировать отдел (department_head или team_lead),
          // нужна валидация, что команда принадлежит отделу пользователя
          if (!canEditDepartmentField && formData.team && formData.team !== "") {
            // Находим команду в списке доступных команд
            const selectedTeam = teams.find(team => team.name === formData.team)

            if (!selectedTeam) {
              console.error("UserDialog: Выбранная команда не найдена в списке команд")
              toast({
                title: "Ошибка валидации",
                description: "Выбранная команда не существует или недоступна",
                variant: "destructive"
              })
              setIsLoading(false)
              return
            }

            // Находим департамент редактируемого пользователя
            const userDepartment = departments.find(dept => dept.name === user.department)

            if (!userDepartment) {
              console.error("UserDialog: Департамент пользователя не найден")
              toast({
                title: "Ошибка валидации",
                description: "Не удалось определить департамент пользователя",
                variant: "destructive"
              })
              setIsLoading(false)
              return
            }

            // Проверяем, что команда принадлежит тому же департаменту, что и редактируемый пользователь
            if (selectedTeam.departmentId !== userDepartment.id) {
              console.error("UserDialog: Попытка кросс-департаментного назначения команды")
              toast({
                title: "Ошибка валидации",
                description: "Команда должна принадлежать тому же департаменту, что и пользователь",
                variant: "destructive"
              })
              setIsLoading(false)
              return
            }
          }

          // Команда - может быть пустой (null) независимо от отдела
          updateData.team = formData.team && formData.team !== "" ? formData.team : null
        }

        // Добавляем должность и категорию если пользователь может редактировать эти поля
        if (canEditPositionAndCategory) {
          if (formData.position) updateData.position = formData.position
          if (formData.category) updateData.category = formData.category
        }

        // Добавляем ставку и загруженность только если пользователь администратор
        if (canEditSalaryFields) {
          if (formData.salary !== undefined) updateData.salary = formData.salary
          if (formData.employmentRate !== undefined) updateData.employmentRate = formData.employmentRate
        }

        // Роли управляются через модальное окно
        
        console.log("Итоговые данные для updateUser:", updateData);
        
        await Sentry.startSpan({ name: 'Users/UserDialog updateUser', op: 'db.write', attributes: { user_id: user.id } }, async () => updateUser(user.id, updateData))
        console.log("updateUser завершен успешно");
        
        // Обновляем Zustand ТОЛЬКО если пользователь редактирует свой профиль
        if (isEditingOwnProfile) {
          console.log("Обновляем Zustand для собственного профиля");
          // Получаем свежие данные пользователя из базы
          const freshSupabase = createClient();
          const { data: freshProfile, error: profileError } = await Sentry.startSpan({ name: 'Users/UserDialog loadFreshProfile', op: 'db.read', attributes: { user_id: user.id } }, async () =>
            freshSupabase
              .from("profiles")
              .select("*")
              .eq("user_id", user.id)
              .single()
          )
          
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
                country: freshProfile.country_name,
                city: freshProfile.city_name,
                // Роли управляются через модальное окно
                avatar_url: freshProfile.avatar_url,
              },
            })
            
            // УДАЛЕНО: Legacy обновление разрешений через getUserRoleAndPermissions
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

  // Функция для сброса поиска
  const resetSearch = () => {
    setCountrySearch("")
    setCitySearch("")
    setCountrySelectOpen(false)
    setCitySelectOpen(false)
  }

  return (
    <Modal isOpen={open} onClose={() => {
      onOpenChange(false)
      resetSearch()
    }} size="xl" className="max-h-[95vh] flex flex-col">
      <form onSubmit={handleSubmit} className="flex flex-col h-full">
        <Modal.Header 
          title={isSelfEdit ? "Настройки профиля" : "Редактирование пользователя"}
          subtitle={
            isSelfEdit
              ? "Измените информацию о своем профиле и нажмите Сохранить, когда закончите."
              : "Измените информацию о пользователе и нажмите Сохранить, когда закончите."
          }
        />
        <Modal.Body className="flex-1 min-h-0 overflow-y-auto">
          <div className="grid gap-3 py-3">
            {/* Имя и Фамилия в одну строку */}
            <div className="grid grid-cols-1 md:grid-cols-4 items-start gap-3">
              <Label className="text-right md:col-span-1 col-span-full pt-2">Имя и Фамилия</Label>
              <div className="md:col-span-3 col-span-full grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => handleChange("firstName", e.target.value)}
                  placeholder="Имя"
                  required
                  disabled={!isSelfEdit && !canEditAllUsers && !canEditSubdivision && !canEditDepartment && !canEditTeam}
                  className="h-9"
                />
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => handleChange("lastName", e.target.value)}
                  placeholder="Фамилия"
                  required
                  disabled={!isSelfEdit && !canEditAllUsers && !canEditSubdivision && !canEditDepartment && !canEditTeam}
                  className="h-9"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 items-start gap-3">
              <Label htmlFor="email" className="text-right md:col-span-1 col-span-full pt-2">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleChange("email", e.target.value)}
                className="md:col-span-3 col-span-full h-9"
                disabled
                readOnly
                title="Изменение email временно заблокировано"
              />
            </div>
            
            {/* Роли пользователя */}
            <div className="grid grid-cols-1 md:grid-cols-4 items-start gap-3">
              <Label className="text-right md:col-span-1 col-span-full pt-2">Роли пользователя</Label>
              <div className="md:col-span-3 col-span-full">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  {/* Текущие роли - только отображение, без возможности удаления */}
                  <div className="flex flex-wrap gap-2 flex-1 min-w-0">
                    {userRoles && userRoles.length > 0 ? userRoles.map((role) => (
                      <div key={role.roleId} className="group relative">
                        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 max-w-full">
                          <span className="truncate">{role.roleName}</span>
                        </span>
                        {/* Tooltip с информацией о роли */}
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                          Назначена: {new Date(role.assignedAt).toLocaleDateString()}
                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                        </div>
                      </div>
                    )) : (
                      <span className="text-sm text-gray-500">Роли не назначены</span>
                    )}
                  </div>
                  
                  {/* Кнопка добавления ролей */}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Инициализируем tempSelectedRoles текущими ролями пользователя
                      const currentRoleIds = userRoles.map(ur => ur.roleId)
                      setTempSelectedRoles(currentRoleIds)
                      setIsRolesModalOpen(true)
                    }}
                    disabled={!canEditRoles}
                    className="h-8 w-8 p-0 flex-shrink-0 self-start sm:self-center"
                    title={!canEditRoles ? (isSelfEdit ? "Только администраторы могут менять свои роли" : "У вас нет прав на назначение ролей") : "Управление ролями"}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
            
            {/* Отдел и Команда в одну строку */}
            <div className="grid grid-cols-1 md:grid-cols-4 items-start gap-3">
              <Label className="text-right md:col-span-1 col-span-full flex items-center gap-2 pt-2">
                <Building2 className="h-4 w-4" />
                Отдел и Команда
              </Label>
              <div className="md:col-span-3 col-span-full grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Select
                  value={formData.department}
                  onValueChange={(value) => handleChange("department", value)}
                  disabled={!canEditDepartmentField}
                >
                  <SelectTrigger className={!formData.department ? "border-orange-200 bg-orange-50" : ""}>
                    <SelectValue placeholder="Выберите отдел" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no-department" className="text-orange-600">
                      <span className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        Без отдела
                      </span>
                    </SelectItem>
                    {departments && departments.length > 0 ? departments.map((department) => (
                      <SelectItem key={department.id} value={department.name}>
                        <span className="flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          {department.name}
                        </span>
                      </SelectItem>
                    )) : (
                      <SelectItem value="loading-departments" disabled>Загрузка отделов...</SelectItem>
                    )}
                  </SelectContent>
                </Select>

                <Select
                  value={formData.team}
                  onValueChange={(value) => handleChange("team", value)}
                  disabled={!canEditTeamField || !formData.department}
                >
                  <SelectTrigger className={!formData.team ? "border-blue-200 bg-blue-50" : ""}>
                    <SelectValue placeholder={formData.department ? "Выберите команду" : "Сначала выберите отдел"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no-team" className="text-blue-600">
                      <span className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Без команды
                      </span>
                    </SelectItem>
                    {filteredTeams && filteredTeams.length > 0 ? filteredTeams.map((team) => (
                      <SelectItem key={team.id} value={team.name}>
                        <span className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          {team.name}
                        </span>
                      </SelectItem>
                    )) : formData.department ? (
                      <SelectItem value="no-teams" disabled>Нет команд в отделе</SelectItem>
                    ) : (
                      <SelectItem value="select-department-first" disabled>Сначала выберите отдел</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              {/* Информационное сообщение */}
              <div className="md:col-span-4 col-span-full">
                <div className="text-xs text-gray-500 bg-gray-50 dark:bg-gray-800 p-2 rounded-md">
                  <div className="flex items-start gap-2">
                    <div className="w-1 h-1 bg-gray-400 rounded-full mt-2 flex-shrink-0"></div>
                    <div className="min-w-0">
                      <strong>Логика назначения:</strong> Команда может быть назначена только при выбранном отделе. 
                      Если отдел не выбран, команда автоматически сбрасывается.
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* Должность и Категория в одну строку */}
            <div className="grid grid-cols-1 md:grid-cols-4 items-start gap-3">
              <Label className="text-right md:col-span-1 col-span-full pt-2">Должность и Категория</Label>
              <div className="md:col-span-3 col-span-full grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Select
                  value={formData.position}
                  onValueChange={(value) => handleChange("position", value)}
                  disabled={!canEditPositionAndCategory}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите должность" />
                  </SelectTrigger>
                  <SelectContent>
                    {positions && positions.length > 0 ? positions.map((position) => (
                      <SelectItem key={position.id} value={position.name}>
                        {position.name}
                      </SelectItem>
                    )) : (
                      <SelectItem value="loading-positions" disabled>Загрузка должностей...</SelectItem>
                    )}
                  </SelectContent>
                </Select>

                <Select
                  value={formData.category}
                  onValueChange={(value) => handleChange("category", value)}
                  disabled={!canEditPositionAndCategory}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите категорию" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories && categories.length > 0 ? categories.map((category) => (
                      <SelectItem key={category.id} value={category.name}>
                        {category.name}
                      </SelectItem>
                    )) : (
                      <SelectItem value="loading-categories" disabled>Загрузка категорий...</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Ставка и Загруженность в одну строку */}
            <div className="grid grid-cols-1 md:grid-cols-4 items-start gap-3">
              <Label className="text-right md:col-span-1 col-span-full pt-2">Ставка и Загруженность</Label>
              <div className="md:col-span-3 col-span-full grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Input
                    id="salary"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.salary || 0}
                    onChange={(e) => handleChange("salary", parseFloat(e.target.value) || 0)}
                    placeholder="Введите ставку"
                    disabled={!canEditSalaryFields}
                    className="h-9"
                    title={!canEditSalaryFields ? "Недостаточно прав для редактирования ставки" : ""}
                  />
                  <p className="text-xs text-gray-500">Ставка {!canEditSalaryFields && <span className="text-orange-600">(недоступно для редактирования)</span>}</p>
                </div>

                <div className="space-y-1">
                  <Select
                    value={formData.employmentRate?.toString() || "1"}
                    onValueChange={(value) => handleChange("employmentRate", parseFloat(value))}
                    disabled={!canEditSalaryFields}
                  >
                    <SelectTrigger title={!canEditSalaryFields ? "Недостаточно прав для редактирования загруженности" : ""}>
                      <SelectValue placeholder="Выберите загруженность" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0.25">25% (0.25)</SelectItem>
                      <SelectItem value="0.5">50% (0.5)</SelectItem>
                      <SelectItem value="0.75">75% (0.75)</SelectItem>
                      <SelectItem value="1">100% (1.0)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">Процент загруженности {!canEditSalaryFields && <span className="text-orange-600">(недоступно для редактирования)</span>}</p>
                </div>
              </div>
            </div>


            <div className="grid grid-cols-1 md:grid-cols-4 items-start gap-3">
              <Label htmlFor="workLocation" className="text-right md:col-span-1 col-span-full pt-2">
                Расположение
              </Label>
              <Select
                value={formData.workLocation}
                onValueChange={(value) => handleChange("workLocation", value as "office" | "remote" | "hybrid")}
                disabled={!canEditLocationFields}
              >
                <SelectTrigger id="workLocation" className="md:col-span-3 col-span-full">
                  <SelectValue placeholder="Выберите расположение" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="office">В офисе</SelectItem>
                  <SelectItem value="remote">Удаленно</SelectItem>
                  <SelectItem value="hybrid">Гибридный формат</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 items-start gap-3">
              <Label htmlFor="country" className="text-right md:col-span-1 col-span-full pt-2">
                Страна
              </Label>
              <Select
                value={selectedCountryCode}
                onValueChange={(code) => {
                  setSelectedCountryCode(code)
                  const found = countries.find(c => c.code === code)
                  setFormData(prev => ({ ...prev, country: found?.name || "", city: "" }))
                  // Сбрасываем поиск при выборе
                  setCountrySearch("")
                  setCitySearch("")
                  setCountrySelectOpen(false)
                }}
                open={countrySelectOpen}
                onOpenChange={setCountrySelectOpen}
                disabled={!canEditLocationFields}
              >
                <SelectTrigger id="country" className="md:col-span-3 col-span-full">
                  <SelectValue placeholder="Выберите страну" />
                </SelectTrigger>
                <SelectContent>
                  {/* Поле поиска по странам */}
                  <div className="p-2 border-b">
                    <Input
                      id="country-search"
                      ref={countrySearchRef}
                      placeholder="Поиск по странам..."
                      value={countrySearch}
                      onChange={(e) => setCountrySearch(e.target.value)}
                      className="w-full border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                      onKeyDown={(e) => {
                        // Предотвращаем обработку клавиш в Select при фокусе на Input
                        e.stopPropagation();
                        
                        // Обработка Enter для выбора первой страны из списка
                        if (e.key === 'Enter' && filteredCountries.length > 0) {
                          const firstCountry = filteredCountries[0];
                          setSelectedCountryCode(firstCountry.code);
                          setFormData(prev => ({ ...prev, country: firstCountry.name, city: "" }));
                          setCountrySearch("");
                          setCitySearch("");
                          setCountrySelectOpen(false);
                        }
                      }}
                    />
                  </div>
                  {filteredCountries && filteredCountries.length > 0 ? filteredCountries.map((c) => (
                    <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                  )) : (
                    <SelectItem value="loading-countries" disabled>Загрузка стран...</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 items-start gap-3">
              <Label htmlFor="city" className="text-right md:col-span-1 col-span-full pt-2">
                Город
              </Label>
              <Select
                value={formData.city || ""}
                onValueChange={(value) => {
                  handleChange("city", value)
                  // Сбрасываем поиск при выборе
                  setCitySearch("")
                  setCitySelectOpen(false)
                }}
                disabled={!selectedCountryCode || !canEditLocationFields}
                open={citySelectOpen}
                onOpenChange={setCitySelectOpen}
              >
                <SelectTrigger id="city" className="md:col-span-3 col-span-full">
                  <SelectValue placeholder={selectedCountryCode ? "Выберите город" : "Сначала выберите страну"} />
                </SelectTrigger>
                <SelectContent>
                  {/* Поле поиска по городам */}
                  <div className="p-2 border-b">
                    <Input
                      id="city-search"
                      ref={citySearchRef}
                      placeholder="Поиск по городам..."
                      value={citySearch}
                      onChange={(e) => setCitySearch(e.target.value)}
                      className="w-full border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                      disabled={!selectedCountryCode}
                      onKeyDown={(e) => {
                        // Предотвращаем обработку клавиш в Select при фокусе на Input
                        e.stopPropagation();
                        
                        // Обработка Enter для выбора первого города из списка
                        if (e.key === 'Enter' && filteredCities.length > 0) {
                          const firstCity = filteredCities[0];
                          handleChange("city", firstCity.name);
                          setCitySearch("");
                          setCitySelectOpen(false);
                        }
                      }}
                    />
                  </div>
                  {filteredCities && filteredCities.length > 0 ? filteredCities.map((c) => (
                    <SelectItem key={`city-${c.name}`} value={c.name}>{c.name}</SelectItem>
                  )) : (
                    <SelectItem value="loading-cities" disabled>Загрузка городов...</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>




          </div>
        </Modal.Body>
        
        <Modal.Footer className="flex-shrink-0">
          <div className="flex flex-col sm:flex-row justify-between w-full gap-3">
            <div></div>

            {/* Кнопки управления справа */}
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <ModalButton 
                type="button" 
                variant="cancel"
                onClick={() => {
                  onOpenChange(false)
                  resetSearch()
                }} 
                disabled={isLoading}
                className="w-full sm:w-auto"
              >
                Отмена
              </ModalButton>
              <ModalButton 
                type="submit" 
                variant="success"
                loading={isLoading}
                icon={<Save />}
                className="w-full sm:w-auto"
              >
                {isLoading ? "Сохранение..." : "Сохранить"}
              </ModalButton>
            </div>
          </div>
        </Modal.Footer>
      </form>

      {/* Модальное окно управления ролями */}
      <Modal isOpen={isRolesModalOpen} onClose={() => setIsRolesModalOpen(false)} size="xl" className="max-h-[90vh] flex flex-col">
        <Modal.Header 
          title="Управление ролями пользователя"
          subtitle={`Назначение ролей для ${user?.name || 'пользователя'}`}
        />
        <Modal.Body className="flex-1 min-h-0 overflow-y-auto">
          <div className="space-y-3">
            {/* Текущие роли */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Текущие роли:</Label>
              <div className="flex flex-wrap gap-2 min-w-0">
                {userRoles && userRoles.length > 0 ? userRoles.map((role) => (
                  <div key={role.roleId} className="inline-flex items-center px-3 py-1 rounded-md text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 max-w-full">
                    <span className="truncate">{role.roleName}</span>
                  </div>
                )) : (
                  <span className="text-sm text-gray-500">Роли не назначены</span>
                )}
              </div>
            </div>

            {/* Доступные роли для добавления */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Доступные роли:</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-64 overflow-y-auto border rounded-md p-3">
                {roles && roles.length > 0 ? roles.map((role) => {
                  const isSelected = tempSelectedRoles.includes(role.id)
                  // Отключаем чекбокс если это последняя роль пользователя
                  const isLastRole = isSelected && tempSelectedRoles.length === 1
                  // Определяем, является ли роль admin ролью (по имени содержит "admin")
                  const isAdminRole = role.name.toLowerCase().includes('admin')
                  // Отключаем чекбокс admin роли, если нет разрешения
                  const isAdminRoleDisabled = isAdminRole && !canAssignAdminRole

                  // Определяем, является ли роль subdivision_head
                  const isSubdivisionHeadRole = role.name === 'subdivision_head'
                  // Отключаем чекбокс subdivision_head роли, если нет разрешения (только админы могут назначать)
                  const isSubdivisionHeadRoleDisabled = isSubdivisionHeadRole && !canAssignAdminRole

                  // Определяем, является ли роль department_head
                  const isDepartmentHeadRole = role.name === 'department_head'
                  // Отключаем чекбокс department_head роли, если нет разрешения (админы или subdivision_head могут назначать)
                  const isDepartmentHeadRoleDisabled = isDepartmentHeadRole && !canAssignAdminRole && !isSubdivisionHead

                  // Определяем, является ли роль project_manager
                  const isProjectManagerRole = role.name === 'project_manager'
                  // Отключаем чекбокс project_manager роли, если нет разрешения (только админы могут назначать)
                  const isProjectManagerRoleDisabled = isProjectManagerRole && !canAssignAdminRole

                  return (
                    <div key={role.id} className={`flex items-start space-x-3 p-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 min-w-0 ${(isLastRole || isAdminRoleDisabled || isSubdivisionHeadRoleDisabled || isDepartmentHeadRoleDisabled || isProjectManagerRoleDisabled) ? 'opacity-50' : ''}`}>
                      <input
                        type="checkbox"
                        id={`modal-role-${role.id}`}
                        checked={isSelected}
                        disabled={isLastRole || isAdminRoleDisabled || isSubdivisionHeadRoleDisabled || isDepartmentHeadRoleDisabled || isProjectManagerRoleDisabled}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setTempSelectedRoles(prev => [...prev, role.id])
                          } else {
                            setTempSelectedRoles(prev => prev.filter(id => id !== role.id))
                          }
                        }}
                        className="mt-1 rounded flex-shrink-0"
                      />
                      <label htmlFor={`modal-role-${role.id}`} className={`text-sm cursor-pointer flex-1 min-w-0 ${(isLastRole || isAdminRoleDisabled || isSubdivisionHeadRoleDisabled || isDepartmentHeadRoleDisabled || isProjectManagerRoleDisabled) ? 'cursor-not-allowed' : ''}`}>
                        <span className="font-medium block truncate">{role.name}</span>
                        {role.description && (
                          <span className="text-xs text-gray-500 block mt-1 overflow-hidden text-ellipsis line-clamp-2">{role.description}</span>
                        )}
                        {isLastRole && (
                          <span className="text-xs text-orange-600 block mt-1">Нельзя удалить последнюю роль</span>
                        )}
                        {isAdminRoleDisabled && (
                          <span className="text-xs text-red-600 block mt-1">Нет прав на назначение admin роли</span>
                        )}
                        {isSubdivisionHeadRoleDisabled && (
                          <span className="text-xs text-red-600 block mt-1">Нет прав на назначение роли руководителя подразделения</span>
                        )}
                        {isDepartmentHeadRoleDisabled && (
                          <span className="text-xs text-red-600 block mt-1">Нет прав на назначение роли начальника отдела</span>
                        )}
                        {isProjectManagerRoleDisabled && (
                          <span className="text-xs text-red-600 block mt-1">Нет прав на назначение роли руководителя проекта</span>
                        )}
                      </label>
                    </div>
                  )
                }) : (
                  <span className="text-sm text-gray-500 col-span-2">Роли не загружены</span>
                )}
              </div>
            </div>
          </div>
        </Modal.Body>
        
        <Modal.Footer className="flex-shrink-0">
          <div className="flex flex-col sm:flex-row gap-2 w-full">
            <ModalButton 
              type="button" 
              variant="cancel"
              onClick={() => {
                // Сбрасываем к исходному состоянию
                const currentRoleIds = userRoles.map(ur => ur.roleId)
                setTempSelectedRoles(currentRoleIds)
                setIsRolesModalOpen(false)
              }}
              className="w-full sm:w-auto"
            >
              Отмена
            </ModalButton>
            <ModalButton 
              type="button" 
              variant="success"
              onClick={handleSaveRoles}
              disabled={isSavingRoles}
              icon={isSavingRoles ? undefined : <Save className="h-4 w-4" />}
              className="w-full sm:w-auto"
            >
              {isSavingRoles ? 'Сохранение...' : 'Сохранить'}
            </ModalButton>
          </div>
        </Modal.Footer>
      </Modal>
    </Modal>
  )
}

export { UserDialog }
export default Sentry.withProfiler(UserDialog, { name: 'UserDialog' })
