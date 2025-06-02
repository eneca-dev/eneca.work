"use client"
import EntityTab from "./EntityTab"

const positionsConfig = {
  entityName: "должности",
  entityNamePlural: "должностями",
  tableName: "positions",
  idField: "position_id",
  nameField: "position_name",
  searchPlaceholder: "Поиск должностей...",
  createButtonText: "Создать должность",
  createModalTitle: "Создать должность",
  editModalTitle: "Редактировать должность",
  deleteModalTitle: "Удаление должности",
  emptyStateMessage: "Должности не созданы",
  notFoundMessage: "Должности по вашему запросу не найдены",
  createFirstButtonText: "Создать первую должность"
}

export default function PositionsTabNew() {
  return <EntityTab config={positionsConfig} />
} 