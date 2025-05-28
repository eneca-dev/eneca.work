"use client"
import EntityTab from "./EntityTab"

const departmentsConfig = {
  entityName: "отдела",
  entityNamePlural: "отделами",
  tableName: "departments",
  idField: "department_id",
  nameField: "department_name",
  searchPlaceholder: "Поиск отделов...",
  createButtonText: "Создать отдел",
  createModalTitle: "Создать отдел",
  editModalTitle: "Редактировать отдел",
  deleteModalTitle: "Удаление отдела",
  emptyStateMessage: "Отделы не созданы",
  notFoundMessage: "Отделы по вашему запросу не найдены",
  createFirstButtonText: "Создать первый отдел"
}

export default function DepartmentsTabNew() {
  return <EntityTab config={departmentsConfig} />
} 