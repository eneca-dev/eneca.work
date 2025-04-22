"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Users } from "lucide-react"
import { useEffect, useState } from "react"
import {
  getUsersByDepartment,
  getUsersByTeam,
  getUsersByCategory,
  getActiveUsersCount,
  getInactiveUsersCount,
  getUsersJoinedByMonth,
  getTopDepartments,
  getTopTeams,
} from "@/services/org-data-service"
import { toast } from "@/components/ui/use-toast"

export default function UserAnalytics() {
  const [departmentData, setDepartmentData] = useState<{ name: string; value: number }[]>([])
  const [teamData, setTeamData] = useState<{ name: string; value: number }[]>([])
  const [categoryData, setCategoryData] = useState<{ name: string; value: number }[]>([])
  const [monthlyData, setMonthlyData] = useState<{ name: string; value: number }[]>([])
  const [topDepartments, setTopDepartments] = useState<{ name: string; count: number }[]>([])
  const [topTeams, setTopTeams] = useState<{ name: string; count: number }[]>([])
  const [activeUsers, setActiveUsers] = useState(0)
  const [inactiveUsers, setInactiveUsers] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"]

  useEffect(() => {
    async function loadAnalyticsData() {
      try {
        setIsLoading(true)

        // Загрузка данных для аналитики
        const deptData = (await getUsersByDepartment()) || {}
        const teamData = (await getUsersByTeam()) || {}
        const catData = (await getUsersByCategory()) || {}
        const monthData = (await getUsersJoinedByMonth()) || {}
        const topDepts = (await getTopDepartments()) || []
        const topTeamsData = (await getTopTeams()) || []
        const activeCount = (await getActiveUsersCount()) || 0
        const inactiveCount = (await getInactiveUsersCount()) || 0

        // Преобразование данных в формат для графиков
        setDepartmentData(Object.entries(deptData).map(([name, value]) => ({ name, value })))
        setTeamData(Object.entries(teamData).map(([name, value]) => ({ name, value })))
        setCategoryData(Object.entries(catData).map(([name, value]) => ({ name, value })))
        setMonthlyData(Object.entries(monthData).map(([name, value]) => ({ name, value })))
        setTopDepartments(topDepts)
        setTopTeams(topTeamsData)
        setActiveUsers(activeCount)
        setInactiveUsers(inactiveCount)
      } catch (error) {
        console.error("Ошибка загрузки аналитических данных:", error)
        toast({
          title: "Ошибка",
          description: "Не удалось загрузить аналитические данные",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    loadAnalyticsData()
  }, [])

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto"></div>
          <p className="mt-4 text-gray-500">Загрузка аналитических данных...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Аналитика пользователей</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Всего пользователей</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeUsers + inactiveUsers}</div>
            <p className="text-xs text-muted-foreground">
              Активных: {activeUsers} / Неактивных: {inactiveUsers}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Отделов</CardTitle>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-4 w-4 text-muted-foreground"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{departmentData.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Команд</CardTitle>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-4 w-4 text-muted-foreground"
            >
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teamData.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Категорий</CardTitle>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-4 w-4 text-muted-foreground"
            >
              <rect width="20" height="14" x="2" y="5" rx="2" />
              <path d="M2 10h20" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{categoryData.length}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="departments">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="departments">По отделам</TabsTrigger>
          <TabsTrigger value="teams">По командам</TabsTrigger>
          <TabsTrigger value="categories">По категориям</TabsTrigger>
          <TabsTrigger value="timeline">Динамика</TabsTrigger>
        </TabsList>

        <TabsContent value="departments" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Распределение по отделам</CardTitle>
                <CardDescription>Количество сотрудников в каждом отделе</CardDescription>
              </CardHeader>
              <CardContent className="pl-2">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={departmentData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {departmentData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Топ отделов</CardTitle>
                <CardDescription>Отделы с наибольшим количеством сотрудников</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={topDepartments}>
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#0088FE" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="teams" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Распределение по командам</CardTitle>
                <CardDescription>Количество сотрудников в каждой команде</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={teamData} layout="vertical">
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={150} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#00C49F" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Топ команд</CardTitle>
                <CardDescription>Команды с наибольшим количеством сотрудников</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={topTeams}>
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#00C49F" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Распределение по категориям</CardTitle>
              <CardDescription>Количество сотрудников в каждой категории</CardDescription>
            </CardHeader>
            <CardContent className="pl-2">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Динамика добавления пользователей</CardTitle>
              <CardDescription>Количество новых пользователей по месяцам</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyData}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#8884D8" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
