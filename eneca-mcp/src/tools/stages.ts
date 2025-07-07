/**
 * Инструменты для работы со стадиями проектов
 */

import { DatabaseService } from '../services/database.js';
import type { CreateStageInput, UpdateStageInput } from '../types/eneca.js';

const dbService = new DatabaseService();

// ===== СОЗДАНИЕ СТАДИИ =====

export const createStageTool = {
  name: "create_stage",
  description: "Создать новую стадию в проекте",
  inputSchema: {
    type: "object",
    properties: {
      stage_name: {
        type: "string",
        description: "Название стадии (обязательно)"
      },
      stage_description: {
        type: "string",
        description: "Описание стадии"
      },
      project_name: {
        type: "string",
        description: "Название проекта (обязательно)"
      }
    },
    required: ["stage_name", "project_name"]
  }
};

export async function handleCreateStage(args: any) {
  try {
    const stageName = String(args.stage_name).trim();
    const projectName = String(args.project_name).trim();

    // Поиск проекта по названию
    const projectResult = await dbService.validateUniqueProjectByName(projectName);
    
    if (projectResult === 'not_found') {
      return {
        content: [{
          type: "text",
          text: `Проект с названием "${projectName}" не найден`
        }]
      };
    }
    
    if (projectResult === 'multiple_found') {
      return {
        content: [{
          type: "text",
          text: `Найдено несколько проектов с названием "${projectName}". Уточните название или используйте поиск проектов для выбора конкретного.`
        }]
      };
    }

    const project = projectResult;

    // Проверяем уникальность названия стадии в проекте
    const existingStageCheck = await dbService.validateUniqueStageByName(stageName, project.project_id);
    if (existingStageCheck !== 'not_found') {
      if (existingStageCheck === 'multiple_found') {
        return {
          content: [{
            type: "text",
            text: `В проекте "${project.project_name}" существует несколько стадий с названием "${stageName}". Выберите другое название.`
          }]
        };
      } else {
        return {
          content: [{
            type: "text",
            text: `В проекте "${project.project_name}" уже существует стадия с названием "${stageName}". Выберите другое название.`
          }]
        };
      }
    }

    const input: CreateStageInput = {
      stage_name: stageName,
      stage_description: args.stage_description ? String(args.stage_description).trim() : undefined,
      stage_project_id: project.project_id
    };

    const result = await dbService.createStage(input);
    
    return {
      content: [{
        type: "text",
        text: result.success ? 
          `${result.message}\nСтадия "${stageName}" успешно создана в проекте "${project.project_name}"` :
          `${result.message}`
      }]
    };

  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Ошибка создания стадии: ${error}`
      }]
    };
  }
}

// ===== ПОИСК СТАДИЙ =====

export const searchStagesTool = {
  name: "search_stages",
  description: "Поиск стадий по названию и проекту",
  inputSchema: {
    type: "object",
    properties: {
      stage_name: {
        type: "string",
        description: "Название стадии (частичное совпадение)"
      },
      project_name: {
        type: "string",
        description: "Название проекта для фильтрации"
      },
      limit: {
        type: "number",
        description: "Лимит результатов",
        default: 10
      }
    }
  }
};

export async function handleSearchStages(args: any) {
  try {
    let projectId: string | undefined = undefined;

    // Поиск проекта если указан
    if (args.project_name) {
      const projectResult = await dbService.validateUniqueProjectByName(String(args.project_name).trim());
      
      if (projectResult === 'not_found') {
        return {
          content: [{
            type: "text",
            text: `Проект с названием "${args.project_name}" не найден`
          }]
        };
      }
      
      if (projectResult === 'multiple_found') {
        return {
          content: [{
            type: "text",
            text: `Найдено несколько проектов с названием "${args.project_name}". Уточните название или используйте поиск проектов.`
          }]
        };
      }

      projectId = projectResult.project_id;
    }

    let stages: any[] = [];

    if (args.stage_name) {
      // Поиск по названию стадии
      stages = await dbService.searchStagesByName(String(args.stage_name).trim(), projectId);
    } else if (projectId) {
      // Получение всех стадий проекта
      const result = await dbService.listStages({ project_id: projectId, limit: args.limit || 10 });
      if (!result.success) {
        return {
          content: [{
            type: "text",
            text: `${result.message}`
          }]
        };
      }
      stages = result.data || [];
    } else {
      return {
        content: [{
          type: "text",
          text: "Укажите название стадии или название проекта для поиска"
        }]
      };
    }

    if (stages.length === 0) {
      return {
        content: [{
          type: "text",
          text: "Стадии не найдены по указанным критериям"
        }]
      };
    }

    const stagesText = stages.map((stage, index) => 
      `${index + 1}. **${stage.stage_name}**\n` +
      `   Проект: ${stage.stage_project_id}\n` +
      `   Создана: ${stage.stage_created ? new Date(stage.stage_created).toLocaleDateString() : 'Неизвестно'}\n` +
      `   ${stage.stage_description ? `Описание: ${stage.stage_description}\n` : ''}`
    ).join('\n');

    return {
      content: [{
        type: "text",
        text: `Найдено стадий: ${stages.length}\n\n${stagesText}`
      }]
    };

  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Ошибка поиска стадий: ${error}`
      }]
    };
  }
}

// ===== ПОЛУЧЕНИЕ СТРУКТУРЫ ПРОЕКТА =====

export const getProjectStructureTool = {
  name: "get_project_structure",
  description: "Получить полную структуру проекта со всеми стадиями, объектами и разделами",
  inputSchema: {
    type: "object",
    properties: {
      project_name: {
        type: "string",
        description: "Название проекта"
      }
    },
    required: ["project_name"]
  }
};

export async function handleGetProjectStructure(args: any) {
  try {
    const projectName = String(args.project_name).trim();

    const projectResult = await dbService.validateUniqueProjectByName(projectName);
    
    if (projectResult === 'not_found') {
      return {
        content: [{
          type: "text",
          text: `Проект с названием "${projectName}" не найден`
        }]
      };
    }
    
    if (projectResult === 'multiple_found') {
      return {
        content: [{
          type: "text",
          text: `Найдено несколько проектов с названием "${projectName}". Используйте поиск проектов для выбора конкретного.`
        }]
      };
    }

    const project = projectResult;

    // Получаем стадии проекта
    const stagesResult = await dbService.listStages({ project_id: project.project_id });
    const stages = stagesResult.success ? stagesResult.data || [] : [];

    let structureText = `**СТРУКТУРА ПРОЕКТА: ${project.project_name}**\n\n`;

    if (stages.length === 0) {
      structureText += "В проекте пока нет стадий\n";
      return {
        content: [{
          type: "text",
          text: structureText
        }]
      };
    }

    // Для каждой стадии получаем объекты и разделы
    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i];
      structureText += `**${i + 1}. ${stage.stage_name}**\n`;
      
      if (stage.stage_description) {
        structureText += `   Описание: ${stage.stage_description}\n`;
      }

      // Получаем объекты стадии
      const objectsResult = await dbService.searchObjectsByName('', stage.stage_id);
      
      if (objectsResult.length === 0) {
        structureText += `   Объектов пока нет\n\n`;
        continue;
      }

      structureText += `   Объектов: ${objectsResult.length}\n`;

      // Выводим первые 3 объекта
      const objectsToShow = objectsResult.slice(0, 3);
      for (const obj of objectsToShow) {
        structureText += `   • ${obj.object_name}\n`;
        
        // Получаем разделы объекта
        const sectionsResult = await dbService.listSections({ object_id: obj.object_id });
        const sections = sectionsResult.success ? sectionsResult.data || [] : [];
        
        if (sections.length > 0) {
          structureText += `     Разделов: ${sections.length}\n`;
        }
      }

      if (objectsResult.length > 3) {
        structureText += `   ... и еще ${objectsResult.length - 3} объектов\n`;
      }

      structureText += `\n`;
    }

    return {
      content: [{
        type: "text",
        text: structureText
      }]
    };

  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Ошибка получения структуры проекта: ${error}`
      }]
    };
  }
}

// ===== ОБНОВЛЕНИЕ СТАДИИ =====

export const updateStageTool = {
  name: "update_stage",
  description: "Обновление существующей стадии",
  inputSchema: {
    type: "object",
    properties: {
      current_name: {
        type: "string",
        description: "Текущее название стадии для поиска"
      },
      project_name: {
        type: "string",
        description: "Название проекта, в котором находится стадия"
      },
      new_name: {
        type: "string",
        description: "Новое название стадии (опционально)"
      },
      description: {
        type: "string",
        description: "Новое описание стадии (опционально)"
      }
    },
    required: ["current_name", "project_name"]
  }
};

export async function handleUpdateStage(args: any) {
  try {
    const currentName = String(args.current_name).trim();
    const projectName = String(args.project_name).trim();
    
    // Поиск проекта
    const project = await dbService.findProjectByNameExact(projectName);
    
    if (!project) {
      return {
        content: [{
          type: "text",
          text: `Проект с названием "${projectName}" не найден`
        }]
      };
    }

    // Поиск стадии
    const stage = await dbService.findStageByNameExact(currentName, project.project_id);
    
    if (!stage) {
      return {
        content: [{
          type: "text",
          text: `Стадия с названием "${currentName}" не найдена в проекте "${projectName}"`
        }]
      };
    }

    // Подготовка данных для обновления
    const updateData: UpdateStageInput = {
      stage_id: stage.stage_id
    };

    // Обработка нового названия
    if (args.new_name) {
      const newName = String(args.new_name).trim();
      if (newName !== currentName) {
        const uniqueCheck = await dbService.validateUniqueStageByNameForUpdate(newName, project.project_id, stage.stage_id);
        if (uniqueCheck === 'duplicate') {
          return {
            content: [{
              type: "text",
              text: `Стадия с названием "${newName}" уже существует в проекте "${projectName}"`
            }]
          };
        }
        updateData.stage_name = newName;
      }
    }

    // Обработка описания
    if (args.description !== undefined) {
      updateData.stage_description = String(args.description).trim() || undefined;
    }

    // Выполнение обновления
    const result = await dbService.updateStage(updateData);

    if (!result.success) {
      return {
        content: [{
          type: "text",
          text: `Ошибка обновления стадии: ${result.message}`
        }]
      };
    }

    // Формирование ответа о том, что изменилось
    const changes = [];
    if (updateData.stage_name) changes.push(`Название: "${currentName}" → "${updateData.stage_name}"`);
    if (updateData.stage_description !== undefined) changes.push(`Описание: обновлено`);

    return {
      content: [{
        type: "text",
        text: `Стадия "${currentName}" в проекте "${projectName}" успешно обновлена\n\nИзменения:\n${changes.join('\n')}`
      }]
    };

  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Ошибка обновления стадии: ${error}`
      }]
    };
  }
}

// Экспорт всех инструментов стадий
export const stageTools = [
  createStageTool,
  searchStagesTool,
  getProjectStructureTool,
  updateStageTool
];

export const stageHandlers = {
  create_stage: handleCreateStage,
  search_stages: handleSearchStages,
  get_project_structure: handleGetProjectStructure,
  update_stage: handleUpdateStage
}; 