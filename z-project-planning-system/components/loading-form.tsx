"use client"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Check, ChevronsUpDown } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import type { Project, Task, Loading } from "@/types/project-types"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { formatDateForInput } from "@/lib/date-utils"
import { useEffect, useState } from "react"
import {
  mockProfiles,
  getFullName,
  getTeamName,
  getCategoryCode,
  getProfileById,
  getPositionName,
  getDepartmentName,
} from "@/data/mock-profiles"

interface LoadingFormProps {
  task: Task | null
  project: Project | null
  loading?: Loading | null
  onSubmit: (loading: Loading) => void
  onCancel: () => void
  onDelete?: (loadingId: string) => void
}

// Обновленная схема валидации
const formSchema = z
  .object({
    user_id: z.string().min(1, "Executor is required"),
    date_start: z.string().min(1, "Start date is required"),
    date_end: z.string().min(1, "End date is required"),
    rate: z.coerce.number().min(0.1).max(2),
  })
  .refine(
    (data) => {
      const start = new Date(data.date_start)
      const end = new Date(data.date_end)
      return start <= end
    },
    {
      message: "End date must be after or equal to start date",
      path: ["date_end"],
    },
  )

export function LoadingForm({ task, project, loading, onSubmit, onCancel, onDelete }: LoadingFormProps) {
  const today = formatDateForInput(new Date())
  const isEditing = !!loading
  const [selectedExecutor, setSelectedExecutor] = useState<string | null>(null)
  const [executorDetails, setExecutorDetails] = useState<{
    team: string
    category: string
    department: string
    position: string
  } | null>(null)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      user_id: "",
      date_start: today,
      date_end: today,
      rate: 1,
    },
  })

  // Обработчик выбора исполнителя
  const handleExecutorChange = (executorId: string) => {
    form.setValue("user_id", executorId)
    setSelectedExecutor(executorId)

    // Получаем данные о выбранном исполнителе
    const profile = getProfileById(executorId)
    if (profile) {
      setExecutorDetails({
        team: getTeamName(profile),
        category: getCategoryCode(profile),
        department: getDepartmentName(profile),
        position: getPositionName(profile),
      })
    }
  }

  // Fill form with data when editing
  useEffect(() => {
    if (loading) {
      form.reset({
        user_id: loading.user_id,
        date_start: formatDateForInput(new Date(loading.date_start)),
        date_end: formatDateForInput(new Date(loading.date_end)),
        rate: loading.rate,
      })

      // Устанавливаем выбранного исполнителя и его данные
      setSelectedExecutor(loading.user_id)
      const profile = getProfileById(loading.user_id)
      if (profile) {
        setExecutorDetails({
          team: getTeamName(profile),
          category: getCategoryCode(profile),
          department: getDepartmentName(profile),
          position: getPositionName(profile),
        })
      }
    }
  }, [loading, form])

  // Form submission handler
  const handleSubmit = (values: z.infer<typeof formSchema>) => {
    if (!task) return

    // Получаем данные о выбранном исполнителе
    const profile = getProfileById(values.user_id)
    if (!profile) return

    const updatedLoading: Loading = {
      id: loading ? loading.id : `loading-${Date.now()}`,
      task_id: task.id,
      user_id: values.user_id,
      date_start: new Date(values.date_start),
      date_end: new Date(values.date_end),
      rate: values.rate,
      type: "Fact", // Always set type to Fact
    }

    onSubmit(updatedLoading)
  }

  // Delete loading handler
  const handleDelete = () => {
    if (loading && onDelete) {
      onDelete(loading.id)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        {task && (
          <div className="mb-4">
            <h3 className="font-medium text-gray-800">Task: {task.name}</h3>
          </div>
        )}

        <FormField
          control={form.control}
          name="user_id"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel className="text-gray-700">Executor</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      role="combobox"
                      className={cn("w-full justify-between", !field.value && "text-muted-foreground")}
                    >
                      {field.value
                        ? (() => {
                            const profile = getProfileById(field.value)
                            if (!profile) return "Select executor"
                            return (
                              <div className="flex items-center gap-2">
                                <Avatar className="h-6 w-6">
                                  <AvatarImage src={profile.avatar_url} alt={getFullName(profile)} />
                                  <AvatarFallback>{getFullName(profile).substring(0, 2)}</AvatarFallback>
                                </Avatar>
                                <span>{getFullName(profile)}</span>
                              </div>
                            )
                          })()
                        : "Select executor"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0">
                  <Command>
                    <CommandInput placeholder="Search executor..." />
                    <CommandEmpty>No executor found.</CommandEmpty>
                    <CommandList>
                      <CommandGroup>
                        {mockProfiles.map((profile) => (
                          <CommandItem
                            key={profile.user_id}
                            value={profile.user_id}
                            onSelect={() => {
                              handleExecutorChange(profile.user_id)
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={profile.avatar_url} alt={getFullName(profile)} />
                                <AvatarFallback>{getFullName(profile).substring(0, 2)}</AvatarFallback>
                              </Avatar>
                              <div className="flex flex-col">
                                <span className="font-medium">{getFullName(profile)}</span>
                                <span className="text-xs text-gray-500">
                                  {getPositionName(profile)} • {getTeamName(profile)}
                                </span>
                              </div>
                            </div>
                            <Check
                              className={cn(
                                "ml-auto h-4 w-4",
                                field.value === profile.user_id ? "opacity-100" : "opacity-0",
                              )}
                            />
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <FormMessage className="text-red-500" />
            </FormItem>
          )}
        />

        {/* Отображение информации о выбранном исполнителе */}
        {executorDetails && (
          <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-md">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Department</p>
              <p className="font-medium">{executorDetails.department}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Team</p>
              <p className="font-medium">{executorDetails.team}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Position</p>
              <p className="font-medium">{executorDetails.position}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Category</p>
              <p className="font-medium">{executorDetails.category}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="date_start"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-gray-700">Start Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} className="focus:ring-[#1e7260] focus:border-[#1e7260]" />
                </FormControl>
                <FormMessage className="text-red-500" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="date_end"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-gray-700">End Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} className="focus:ring-[#1e7260] focus:border-[#1e7260]" />
                </FormControl>
                <FormMessage className="text-red-500" />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="rate"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-gray-700">Rate</FormLabel>
              <Select
                onValueChange={(value) => field.onChange(Number.parseFloat(value))}
                defaultValue={field.value.toString()}
              >
                <FormControl>
                  <SelectTrigger className="focus:ring-[#1e7260] focus:border-[#1e7260]">
                    <SelectValue placeholder="Select rate" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="0.25">0.25</SelectItem>
                  <SelectItem value="0.5">0.5</SelectItem>
                  <SelectItem value="0.75">0.75</SelectItem>
                  <SelectItem value="1">1.0</SelectItem>
                  <SelectItem value="1.25">1.25</SelectItem>
                  <SelectItem value="1.5">1.5</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage className="text-red-500" />
            </FormItem>
          )}
        />

        <div className="flex justify-between space-x-2 pt-4">
          {isEditing && onDelete && (
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              Delete
            </Button>
          )}
          <div className="flex justify-end space-x-2 ml-auto">
            <Button type="button" variant="outline" onClick={onCancel} className="border-gray-300 hover:bg-gray-50">
              Cancel
            </Button>
            <Button type="submit" className="bg-[#1e7260] hover:bg-[#175a4c] text-white">
              {isEditing ? "Update" : "Add"} Loading
            </Button>
          </div>
        </div>
      </form>
    </Form>
  )
}

