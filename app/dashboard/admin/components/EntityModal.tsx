"use client"
import { useCallback, useEffect, useMemo, useState } from "react"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createClient } from "@/utils/supabase/client"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Check, Loader2, X } from "lucide-react"
import { useNotification } from "@/lib/notification-context"

// Типы для сущностей
interface BaseEntity {
  id: string;
  name: string;
}

interface Department extends BaseEntity {
  department_id: string;
  department_name: string;
  ws_department_id?: number | null;
}

interface Team extends BaseEntity {
  team_id: string;
  team_name: string;
  department_id?: string;
  departmentId?: string; // Для совместимости с текущим кодом
  ws_team_id?: number | null;
}

interface Position extends BaseEntity {
  position_id: string;
  position_name: string;
  ws_position_id?: number | null;
}

interface Category extends BaseEntity {
  category_id: string;
  category_name: string;
  ws_category_id?: number | null;
}

// Типы для передачи данных в EntityModal
interface EntityData {
  [key: string]: string | number | null;
}

// Обобщенный тип для всех сущностей
type Entity = Department | Team | Position | Category | EntityData;

// Тип для дополнительных полей формы
interface ExtraField {
  name: string;
  label: string;
  type: "text" | "select";
  options?: { id: string; name: string }[];
}

interface EntityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  mode: "create" | "edit";
  table: string;
  idField: string;
  nameField: string;
  entity?: Entity;
  extraFields?: ExtraField[];
  onSuccess: () => void;
}

type FormValues = {
  name: string;
  [key: string]: string;
}

// Конфигурация ws полей для разных таблиц
const WS_ID_MAPPING: Record<string, string> = {
  "departments": "ws_department_id",
  "teams": "ws_team_id",
  "positions": "ws_position_id",
  "categories": "ws_category_id"
};

// Функция для генерации UUID
function generateUUID(): string {
  // Простая реализация UUID v4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export default function EntityModal({
  open,
  onOpenChange,
  title,
  mode,
  table,
  idField,
  nameField,
  entity,
  extraFields = [],
  onSuccess,
}: EntityModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [formInitialized, setFormInitialized] = useState(false)
  const notification = useNotification()
  
  // Мемоизируем схему валидации для предотвращения ненужных пересчетов
  const formSchema = useMemo(() => {
    return z.object({
      name: z.string().min(2, "Название должно содержать не менее 2 символов"),
      ...Object.fromEntries(
        extraFields.map((field) => [
          field.name, 
          field.type === "select" 
            ? z.string().min(1, `${field.label} обязательно`)
            : z.string().min(2, `${field.label} должно содержать не менее 2 символов`)
        ])
      )
    }).passthrough();
  }, [extraFields]);

  // Мемоизируем начальные значения формы
  const defaultValues = useMemo(() => {
    return {
      name: "",
      ...Object.fromEntries(
        extraFields.map((field) => [field.name, ""])
      )
    };
  }, [extraFields]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  // Инициализируем форму только один раз при открытии модального окна
  useEffect(() => {
    if (open && !formInitialized) {
      if (mode === "edit" && entity) {
        const values: FormValues = {
          name: String(entity[nameField as keyof typeof entity] || entity.name || ""),
          ...Object.fromEntries(
            extraFields.map((field) => [field.name, String(entity[field.name as keyof typeof entity] || "")])
          )
        };
        form.reset(values);
      } else if (mode === "create") {
        form.reset(defaultValues);
      }
      setFormInitialized(true);
    } else if (!open) {
      // Сбрасываем флаг инициализации при закрытии окна
      setFormInitialized(false);
    }
  }, [open, mode, entity, extraFields, form, defaultValues, nameField, formInitialized]);

  // Функция для получения следующего доступного ws_id
  const getNextWsId = useCallback(async (tableName: string): Promise<number | null> => {
    const wsField = WS_ID_MAPPING[tableName];
    if (!wsField) return null;
    
    const supabase = createClient();
    const { data } = await supabase
      .from(tableName)
      .select(wsField)
      .order(wsField, { ascending: false })
      .limit(1);
    
    if (data && data.length > 0) {
      const value = data[0][wsField as keyof typeof data[0]];
      if (typeof value === 'number') {
        return value + 1;
      }
    }
    return 100000; // Начальное значение, если нет записей
  }, []);

  // Мемоизируем функцию отправки формы
  const onSubmit = useCallback(async (values: FormValues) => {
    if (isLoading) return;
    
    try {
      setIsLoading(true);
      const supabase = createClient();
      
      if (mode === "create") {
        // Получаем ws_id, если нужно
        const wsField = WS_ID_MAPPING[table];
        const newWsId = wsField ? await getNextWsId(table) : null;
        
        // Создаем объект с данными
        const newEntity: EntityData = {
          // Явно генерируем UUID для ID (т.к. у нас была ошибка с автоматическим ID)
          [idField]: generateUUID(),
          [nameField]: values.name,
          ...Object.fromEntries(
            extraFields.map((field) => [field.name, values[field.name]])
          )
        };
        
        // Добавляем ws_ поле, если оно есть
        if (wsField && newWsId !== null) {
          newEntity[wsField] = newWsId;
        }
        
        // Выполняем запрос на добавление записи
        const { data, error } = await supabase
          .from(table)
          .insert(newEntity)
          .select();
        
        if (error) {
          console.error(`Ошибка при создании в таблице ${table}:`, error);
          notification.error(`Не удалось создать запись в таблице ${table}`, error);
          throw error;
        }
        
        notification.success("Запись успешно создана", `Добавлена запись "${values.name}" в таблицу ${table}`);
      } else {
        if (!entity || !entity[idField as keyof typeof entity]) {
          throw new Error("Отсутствует ID для обновления");
        }
        
        const { error } = await supabase
          .from(table)
          .update({
            [nameField]: values.name,
            ...Object.fromEntries(
              extraFields.map((field) => [field.name, values[field.name]])
            )
          })
          .eq(idField, entity[idField as keyof typeof entity] as string);
        
        if (error) {
          console.error(`Ошибка при обновлении в таблице ${table}:`, error);
          notification.error(`Не удалось обновить запись в таблице ${table}`, error);
          throw error;
        }
        
        notification.success("Запись успешно обновлена", `Изменения для "${values.name}" сохранены`);
      }
      
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Ошибка:", error);
      notification.error(
        "Произошла ошибка при сохранении данных", 
        error instanceof Error ? error : "Неизвестная ошибка"
      );
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, mode, table, nameField, idField, extraFields, entity, onSuccess, onOpenChange, getNextWsId]);

  // Мемоизируем описание модального окна
  const description = useMemo(() => {
    if (mode === "create") return `Добавление нового элемента в таблицу "${table}"`;
    return `Редактирование существующего элемента в таблице "${table}"`;
  }, [mode, table]);

  // Создаем стабильную функцию для закрытия модального окна
  const handleClose = useCallback(() => {
    if (!isLoading) {
      onOpenChange(false);
    }
  }, [isLoading, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Название</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {extraFields.map((extraField) => (
              <FormField
                key={extraField.name}
                control={form.control}
                name={extraField.name}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{extraField.label}</FormLabel>
                    <FormControl>
                      {extraField.type === "select" ? (
                        <Select
                          onValueChange={field.onChange}
                          value={field.value || ""}
                          disabled={isLoading}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={`Выберите ${extraField.label.toLowerCase()}`} />
                          </SelectTrigger>
                          <SelectContent>
                            {extraField.options?.map((option) => (
                              <SelectItem key={option.id} value={option.id}>
                                {option.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input {...field} disabled={isLoading} />
                      )}
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
            
            <DialogFooter>
              <div className="flex gap-2 justify-end w-full">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleClose}
                  disabled={isLoading}
                >
                  <X className="mr-2 h-4 w-4" /> Отмена
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Сохранение...
                    </>
                  ) : (
                    <>
                      <Check className="mr-2 h-4 w-4" /> {mode === "create" ? "Создать" : "Сохранить"}
                    </>
                  )}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
} 