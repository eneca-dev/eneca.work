"use client"

import React, { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Country, City } from "country-state-city"
import { createUserViaAPI } from "@/services/user-api"
import {
  useAllReferenceData,
} from "@/modules/cache"
import { toast } from "sonner"
import { useAdminPermissions } from "@/modules/users/admin/hooks/useAdminPermissions"
import { UserPlus, AlertCircle } from "lucide-react"
import * as Sentry from "@sentry/nextjs"

interface AddUserFormData {
  email: string
  firstName: string
  lastName: string
  subdivision: string
  department: string
  team: string
  position: string
  category: string
  role: string
  roleId: string
  workLocation: "office" | "remote" | "hybrid"
  country: string
  city: string
}

interface AddUserFormProps {
  onUserAdded?: () => void
}

const DEFAULT_PASSWORD = "enecaworkPass"

function AddUserForm({ onUserAdded }: AddUserFormProps) {
  const [formData, setFormData] = useState<AddUserFormData>({
    email: "",
    firstName: "",
    lastName: "",
    subdivision: "",
    department: "",
    team: "",
    position: "",
    category: "",
    role: "",
    roleId: "",
    workLocation: "office",
    country: "",
    city: "",
  })

  const { canChangeRoles, canAddAdminRole } = useAdminPermissions()

  // Справочные данные — 1 batch-запрос вместо 6 отдельных
  const { subdivisions, departments, teams, positions, categories, roles: allRoles, isLoading: isRefLoading } = useAllReferenceData()
  const isSubdivisionsLoading = isRefLoading
  const isRolesLoading = isRefLoading

  // Фильтруем роли: исключаем admin если нет разрешения
  const roles = useMemo(() => {
    if (canAddAdminRole) return allRoles
    return allRoles.filter(role => role.name !== 'admin')
  }, [allRoles, canAddAdminRole])

  const [isLoading, setIsLoading] = useState(false)
  const isDataLoaded = !isSubdivisionsLoading && !isRolesLoading

  // Состояния для стран и городов
  const [selectedCountryCode, setSelectedCountryCode] = useState<string>("")
  const [countrySearch, setCountrySearch] = useState("")
  const [citySearch, setCitySearch] = useState("")
  const [countrySelectOpen, setCountrySelectOpen] = useState(false)
  const [citySelectOpen, setCitySelectOpen] = useState(false)

  // Derived state: страны и города (country-state-city — синхронная in-memory библиотека)
  const countries = useMemo(() => Country.getAllCountries().map(c => ({ code: c.isoCode, name: c.name })), [])

  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return countries
    const lc = countrySearch.toLowerCase()
    return countries.filter(c => c.name.toLowerCase().includes(lc))
  }, [countries, countrySearch])

  const cities = useMemo(() => {
    if (!selectedCountryCode) return []
    const loaded = City.getCitiesOfCountry(selectedCountryCode) || []
    const seen = new Set<string>()
    const unique: { name: string }[] = []
    for (const c of loaded) {
      if (!seen.has(c.name)) {
        seen.add(c.name)
        unique.push({ name: c.name })
      }
    }
    return unique
  }, [selectedCountryCode])

  const filteredCities = useMemo(() => {
    if (!citySearch.trim()) return cities
    const lc = citySearch.toLowerCase()
    return cities.filter(c => c.name.toLowerCase().includes(lc))
  }, [cities, citySearch])

  // Фильтрация отделов по выбранному подразделению (derived state)
  const filteredDepartments = useMemo(() => {
    if (formData.subdivision && formData.subdivision !== "") {
      const subdivisionId = subdivisions.find((s) => s.name === formData.subdivision)?.id
      return departments.filter((d) => d.subdivisionId === subdivisionId)
    }
    return departments
  }, [formData.subdivision, subdivisions, departments])

  // Фильтрация команд по выбранному отделу (derived state)
  const filteredTeams = useMemo(() => {
    if (formData.department) {
      const departmentId = filteredDepartments.find((d) => d.name === formData.department)?.id
      return teams.filter((t) => t.departmentId === departmentId)
    }
    return []
  }, [formData.department, filteredDepartments, teams])

  const handleChange = (field: string, value: string) => {
    if (field === 'email' || field === 'firstName' || field === 'lastName') {
      Sentry.addBreadcrumb({ category: 'ui.input', level: 'info', message: 'AddUserForm: change', data: { field } })
    }

    // При изменении подразделения сбрасываем отдел и команду
    if (field === "subdivision") {
      setFormData((prev) => ({ ...prev, [field]: value, department: "", team: "" }))
    }
    // При изменении отдела сбрасываем команду
    else if (field === "department") {
      setFormData((prev) => ({ ...prev, [field]: value, team: "" }))
    }
    else {
      setFormData((prev) => ({ ...prev, [field]: value }))
    }

    // Если изменяется роль, обновляем roleId (используется для назначения в user_roles)
    if (field === "role") {
      const selectedRole = roles.find(r => r.name === value)
      setFormData((prev) => ({ ...prev, roleId: selectedRole?.id || "" }))
    }
  }

  const resetForm = () => {
    Sentry.addBreadcrumb({ category: 'ui.action', level: 'info', message: 'AddUserForm: reset form' })
    setFormData({
      email: "",
      firstName: "",
      lastName: "",
      subdivision: "",
      department: "",
      team: "",
      position: "",
      category: "",
      role: "",
      roleId: "",
      workLocation: "office",
      country: "",
      city: "",
    })
    setSelectedCountryCode("")
    setCountrySearch("")
    setCitySearch("")
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
    if (!formData.team) {
      toast.error("Команда обязательна для заполнения")
      return
    }

    setIsLoading(true)
    
    try {
      // Подготавливаем данные для создания пользователя
      const userData = {
        email: formData.email,
        password: DEFAULT_PASSWORD,
        firstName: formData.firstName,
        lastName: formData.lastName,
        subdivision: formData.subdivision || undefined,
        department: formData.department || undefined,
        team: formData.team || undefined,
        position: formData.position || undefined,
        category: formData.category || undefined,
        roleId: formData.roleId || undefined,
        workLocation: formData.workLocation,
        country: formData.country || undefined,
        city: formData.city || undefined,
      }
      
      Sentry.addBreadcrumb({ category: 'ui.submit', level: 'info', message: 'AddUserForm: submit create user' })      
      const result = await Sentry.startSpan({ name: 'Users/AddUserForm createUserViaAPI', op: 'http' }, async () => createUserViaAPI(userData))
      
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
      Sentry.captureException(error, {
        tags: { module: 'users', component: 'AddUserForm', action: 'create_user' },
      })

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

          {/* Подразделение */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="subdivision" className="text-right">Подразделение</Label>
            <Select
              value={formData.subdivision}
              onValueChange={(value) => handleChange("subdivision", value)}
            >
              <SelectTrigger id="subdivision" className="col-span-3">
                <SelectValue placeholder="Выберите подразделение" />
              </SelectTrigger>
              <SelectContent>
                {subdivisions.map((subdivision) => (
                  <SelectItem key={subdivision.id} value={subdivision.name}>
                    {subdivision.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Отдел */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="department" className="text-right">Отдел</Label>
            <Select
              value={formData.department}
              onValueChange={(value) => handleChange("department", value)}
              disabled={!formData.subdivision}
            >
              <SelectTrigger id="department" className="col-span-3">
                <SelectValue placeholder={formData.subdivision ? "Выберите отдел" : "Сначала выберите подразделение"} />
              </SelectTrigger>
              <SelectContent>
                {filteredDepartments.map((department) => (
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

          {/* Страна */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="country" className="text-right">Страна</Label>
            <Select
              value={selectedCountryCode}
              onValueChange={(code) => {
                setSelectedCountryCode(code)
                const found = countries.find(c => c.code === code)
                handleChange("country", found?.name || "")
                handleChange("city", "")
                setCountrySearch("")
                setCitySearch("")
                setCountrySelectOpen(false)
              }}
              open={countrySelectOpen}
              onOpenChange={setCountrySelectOpen}
            >
              <SelectTrigger id="country" className="col-span-3">
                <SelectValue placeholder="Выберите страну" />
              </SelectTrigger>
              <SelectContent>
                {/* Поле поиска по странам */}
                <div className="p-2 border-b">
                  <Input
                    id="country-search"
                    placeholder="Поиск по странам..."
                    value={countrySearch}
                    onChange={(e) => setCountrySearch(e.target.value)}
                    className="w-full border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === 'Enter' && filteredCountries.length > 0) {
                        const firstCountry = filteredCountries[0];
                        setSelectedCountryCode(firstCountry.code);
                        handleChange("country", firstCountry.name);
                        handleChange("city", "");
                        setCountrySearch("");
                        setCitySearch("");
                        setCountrySelectOpen(false);
                      }
                    }}
                  />
                </div>
                {filteredCountries.map((c) => (
                  <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Город */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="city" className="text-right">Город</Label>
            <Select
              value={formData.city || ""}
              onValueChange={(value) => {
                handleChange("city", value)
                setCitySearch("")
                setCitySelectOpen(false)
              }}
              disabled={!selectedCountryCode}
              open={citySelectOpen}
              onOpenChange={setCitySelectOpen}
            >
              <SelectTrigger id="city" className="col-span-3">
                <SelectValue placeholder={selectedCountryCode ? "Выберите город" : "Сначала выберите страну"} />
              </SelectTrigger>
              <SelectContent>
                {/* Поле поиска по городам */}
                <div className="p-2 border-b">
                  <Input
                    id="city-search"
                    placeholder="Поиск по городам..."
                    value={citySearch}
                    onChange={(e) => setCitySearch(e.target.value)}
                    className="w-full border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                    disabled={!selectedCountryCode}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === 'Enter' && filteredCities.length > 0) {
                        const firstCity = filteredCities[0];
                        handleChange("city", firstCity.name);
                        setCitySearch("");
                        setCitySelectOpen(false);
                      }
                    }}
                  />
                </div>
                {filteredCities.map((c) => (
                  <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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

export default Sentry.withProfiler(AddUserForm, { name: 'AddUserForm' })
