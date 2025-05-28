"use client"
import EntityTab from "./EntityTab"

const categoriesConfig = {
  entityName: "категории",
  entityNamePlural: "категориями",
  tableName: "categories",
  idField: "category_id",
  nameField: "category_name",
  searchPlaceholder: "Поиск категорий...",
  createButtonText: "Создать категорию",
  createModalTitle: "Создать категорию",
  editModalTitle: "Редактировать категорию",
  deleteModalTitle: "Удаление категории",
  emptyStateMessage: "Категории не созданы",
  notFoundMessage: "Категории по вашему запросу не найдены",
  createFirstButtonText: "Создать первую категорию"
}

export default function CategoriesTabNew() {
  return <EntityTab config={categoriesConfig} />
} 