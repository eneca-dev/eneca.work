/**
 * Инструменты для работы с проектами
 */

import { DatabaseService } from '../services/database.js';
import type { CreateProjectInput, UpdateProjectInput } from '../types/eneca.js';

const dbService = new DatabaseService();

// ===== СОЗДАНИЕ ПРОЕКТА =====

export const createProjectTool = {
  name: "create_project",
  description: "Создать новый проект",
  inputSchema: {
    type: "object",
    properties: {
      project_name: {
        type: "string",
        description: "Название проекта (обязательно)"
      },
      project_description: {
        type: "string",
        description: "Описание проекта"
      },
      project_manager_name: {
        type: "string",
        description: "Имя менеджера проекта (будет выполнен поиск по имени/email)"
      },
      project_lead_engineer_name: {
        type: "string",
        description: "Имя главного инженера (будет выполнен поиск по имени/email)"
      },
      client_name: {
        type: "string",
        description: "Название заказчика (будет выполнен поиск по названию)"
      }
    },
    required: ["project_name"]
  }
};

export async function handleCreateProject(args: any) {
  try {
    const projectName = String(args.project_name).trim();

    // Проверяем уникальность названия проекта
    const existingProjectCheck = await dbService.validateUniqueProjectByName(projectName);
    if (existingProjectCheck !== 'not_found') {
      if (existingProjectCheck === 'multiple_found') {
        return {
          content: [{
            type: "text",
            text: `Найдено несколько проектов с названием "${projectName}". Выберите другое название.`
          }]
        };
      } else {
        return {
          content: [{
            type: "text",
            text: `Проект с названием "${projectName}" уже существует. Выберите другое название.`
          }]
        };
      }
    }

    const input: CreateProjectInput = {
      project_name: projectName,
      project_description: args.project_description ? String(args.project_description).trim() : undefined
    };

    // Поиск менеджера проекта
    if (args.project_manager_name) {
      const users = await dbService.searchUsersByQuery(String(args.project_manager_name).trim());
      if (users.length === 0) {
        return {
          content: [{
            type: "text",
            text: `Пользователь с именем "${args.project_manager_name}" не найден`
          }]
        };
      }
      if (users.length > 1) {
        const usersList = users.map(u => `• ${u.full_name.trim() || `${u.first_name} ${u.last_name}`.trim()} (${u.email})`).join('\n');
        return {
          content: [{
            type: "text",
            text: `Найдено несколько пользователей с именем "${args.project_manager_name}":\n${usersList}\nУточните имя или используйте email.`
          }]
        };
      }
      input.project_manager = users[0].user_id;
    }

    // Поиск главного инженера
    if (args.project_lead_engineer_name) {
      const users = await dbService.searchUsersByQuery(String(args.project_lead_engineer_name).trim());
      if (users.length === 0) {
        return {
          content: [{
            type: "text",
            text: `Пользователь с именем "${args.project_lead_engineer_name}" не найден`
          }]
        };
      }
      if (users.length > 1) {
        const usersList = users.map(u => `• ${u.full_name.trim() || `${u.first_name} ${u.last_name}`.trim()} (${u.email})`).join('\n');
        return {
          content: [{
            type: "text",
            text: `Найдено несколько пользователей с именем "${args.project_lead_engineer_name}":\n${usersList}\nУточните имя или используйте email.`
          }]
        };
      }
      input.project_lead_engineer = users[0].user_id;
    }

    // Поиск заказчика
    if (args.client_name) {
      const client = await dbService.findClientByName(String(args.client_name).trim());
      if (!client) {
        return {
          content: [{
            type: "text",
            text: `Заказчик с названием "${args.client_name}" не найден`
          }]
        };
      }
      input.client_id = client.client_id;
    }

    const result = await dbService.createProject(input);
    
    return {
      content: [{
        type: "text",
        text: result.success ? 
          `${result.message}\nПроект "${projectName}" успешно создан` :
          `${result.message}`
      }]
    };

  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Ошибка создания проекта: ${error}`
      }]
    };
  }
}

// ===== ПОИСК ПРОЕКТОВ =====

export const searchProjectsTool = {
  name: "search_projects",
  description: "Поиск проектов по различным критериям",
  inputSchema: {
    type: "object",
    properties: {
      project_name: {
        type: "string",
        description: "Название проекта (частичное совпадение)"
      },
      manager_name: {
        type: "string",
        description: "Имя менеджера проекта"
      },
      client_name: {
        type: "string",
        description: "Название заказчика"
      },
      status: {
        type: "string",
        enum: ["active", "archive", "paused", "canceled"],
        description: "Статус проекта"
      },
      limit: {
        type: "number",
        description: "Лимит результатов",
        default: 10
      }
    }
  }
};

export async function handleSearchProjects(args: any) {
  try {
    const filters: any = {};
    
    if (args.limit) {
      filters.limit = Number(args.limit);
    }
    
    if (args.status) {
      filters.status = String(args.status);
    }

    // Поиск по менеджеру
    if (args.manager_name) {
      const users = await dbService.searchUsersByQuery(String(args.manager_name).trim());
      if (users.length === 0) {
        return {
          content: [{
            type: "text",
            text: `Менеджер с именем "${args.manager_name}" не найден`
          }]
        };
      }
      if (users.length > 1) {
        const usersList = users.map(u => `• ${u.full_name.trim() || `${u.first_name} ${u.last_name}`.trim()} (${u.email})`).join('\n');
        return {
          content: [{
            type: "text",
            text: `Найдено несколько пользователей с именем "${args.manager_name}":\n${usersList}\nУточните имя.`
          }]
        };
      }
      filters.manager = users[0].user_id;
    }

    // Поиск по заказчику
    if (args.client_name) {
      const client = await dbService.findClientByName(String(args.client_name).trim());
      if (!client) {
        return {
          content: [{
            type: "text",
            text: `Заказчик с названием "${args.client_name}" не найден`
          }]
        };
      }
      filters.client_id = client.client_id;
    }

    let projects: any[] = [];

    if (args.project_name) {
      // Поиск по названию проекта
      projects = await dbService.searchProjectsByName(String(args.project_name).trim());
      
      // Применяем дополнительные фильтры
      if (filters.manager) {
        projects = projects.filter(p => p.project_manager === filters.manager);
      }
      if (filters.client_id) {
        projects = projects.filter(p => p.client_id === filters.client_id);
      }
      if (filters.status) {
        projects = projects.filter(p => p.project_status === filters.status);
      }
    } else {
      // Общий поиск через listProjects
      const result = await dbService.listProjects(filters);
      if (!result.success) {
        return {
          content: [{
            type: "text",
            text: `${result.message}`
          }]
        };
      }
      projects = result.data || [];
    }

    if (projects.length === 0) {
      return {
        content: [{
          type: "text",
          text: "Проекты не найдены по указанным критериям"
        }]
      };
    }

    const projectsText = projects.map((project, index) => 
      `${index + 1}. **${project.project_name}**\n` +
      `   Статус: ${project.project_status}\n` +
      `   Создан: ${project.project_created ? new Date(project.project_created).toLocaleDateString() : 'Неизвестно'}\n` +
      `   ${project.project_description ? `Описание: ${project.project_description}\n` : ''}`
    ).join('\n');

    return {
      content: [{
        type: "text",
        text: `Найдено проектов: ${projects.length}\n\n${projectsText}`
      }]
    };

  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Ошибка поиска проектов: ${error}`
      }]
    };
  }
}

// ===== ПОЛУЧЕНИЕ ДЕТАЛЕЙ ПРОЕКТА =====

export const getProjectDetailsTool = {
  name: "get_project_details",
  description: "Получить подробную информацию о проекте",
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

export async function handleGetProjectDetails(args: any) {
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

    // Получаем дополнительную информацию
    const stagesResult = await dbService.listStages({ project_id: project.project_id });
    const stages = stagesResult.success ? stagesResult.data : [];

    let detailsText = `**ПРОЕКТ: ${project.project_name}**\n\n`;
    detailsText += `**Основная информация:**\n`;
    detailsText += `• Статус: ${project.project_status}\n`;
    detailsText += `• Создан: ${project.project_created ? new Date(project.project_created).toLocaleDateString() : 'Неизвестно'}\n`;
    detailsText += `• Обновлен: ${project.project_updated ? new Date(project.project_updated).toLocaleDateString() : 'Неизвестно'}\n`;
    
    if (project.project_description) {
      detailsText += `• Описание: ${project.project_description}\n`;
    }

    detailsText += `\n**Структура:**\n`;
    detailsText += `• Стадий: ${stages?.length || 0}\n`;

    if (stages && stages.length > 0) {
      detailsText += `\n**Стадии:**\n`;
      stages.forEach((stage: any, index: number) => {
        detailsText += `${index + 1}. ${stage.stage_name}\n`;
        if (stage.stage_description) {
          detailsText += `   Описание: ${stage.stage_description}\n`;
        }
      });
    }

    return {
      content: [{
        type: "text",
        text: detailsText
      }]
    };

  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `❌ Ошибка получения деталей проекта: ${error}`
      }]
    };
  }
}

// ===== ОБНОВЛЕНИЕ ПРОЕКТА =====

export const updateProjectTool = {
  name: "update_project",
  description: "Обновление существующего проекта",
  inputSchema: {
    type: "object",
    properties: {
      current_name: {
        type: "string",
        description: "Текущее название проекта для поиска"
      },
      new_name: {
        type: "string",
        description: "Новое название проекта (опционально)"
      },
      description: {
        type: "string",
        description: "Новое описание проекта (опционально)"
      },
      manager_name: {
        type: "string",
        description: "Новый менеджер проекта (имя для поиска, опционально)"
      },
      lead_engineer_name: {
        type: "string",
        description: "Новый главный инженер (имя для поиска, опционально)"
      },
      status: {
        type: "string",
        description: "Новый статус проекта (active, archive, paused, canceled, опционально)"
      },
      client_name: {
        type: "string",
        description: "Новый клиент (название для поиска, опционально)"
      }
    },
    required: ["current_name"]
  }
};

export async function handleUpdateProject(args: any) {
  try {
    const currentName = String(args.current_name).trim();
    
    // Поиск проекта
    const project = await dbService.findProjectByNameExact(currentName);
    
    if (!project) {
      return {
        content: [{
          type: "text",
          text: `Проект с названием "${currentName}" не найден`
        }]
      };
    }

    // Подготовка данных для обновления
    const updateData: UpdateProjectInput = {
      project_id: project.project_id
    };

    // Обработка нового названия
    if (args.new_name) {
      const newName = String(args.new_name).trim();
      if (newName !== currentName) {
        const uniqueCheck = await dbService.validateUniqueProjectByNameForUpdate(newName, project.project_id);
        if (uniqueCheck === 'duplicate') {
          return {
            content: [{
              type: "text",
              text: `Проект с названием "${newName}" уже существует`
            }]
          };
        }
        updateData.project_name = newName;
      }
    }

    // Обработка описания
    if (args.description !== undefined) {
      updateData.project_description = String(args.description).trim() || undefined;
    }

    // Обработка менеджера
    if (args.manager_name) {
      const users = await dbService.searchUsersByQuery(String(args.manager_name).trim());
      if (users.length === 0) {
        return {
          content: [{
            type: "text",
            text: `Пользователь с именем "${args.manager_name}" не найден`
          }]
        };
      }
      if (users.length > 1) {
        const usersList = users.map(u => `• ${u.full_name.trim() || `${u.first_name} ${u.last_name}`.trim()} (${u.email})`).join('\n');
        return {
          content: [{
            type: "text",
            text: `Найдено несколько пользователей с именем "${args.manager_name}":\n${usersList}\nУточните имя.`
          }]
        };
      }
      updateData.project_manager = users[0].user_id;
    }

    // Обработка главного инженера
    if (args.lead_engineer_name) {
      const users = await dbService.searchUsersByQuery(String(args.lead_engineer_name).trim());
      if (users.length === 0) {
        return {
          content: [{
            type: "text",
            text: `Пользователь с именем "${args.lead_engineer_name}" не найден`
          }]
        };
      }
      if (users.length > 1) {
        const usersList = users.map(u => `• ${u.full_name.trim() || `${u.first_name} ${u.last_name}`.trim()} (${u.email})`).join('\n');
        return {
          content: [{
            type: "text",
            text: `Найдено несколько пользователей с именем "${args.lead_engineer_name}":\n${usersList}\nУточните имя.`
          }]
        };
      }
      updateData.project_lead_engineer = users[0].user_id;
    }

    // Обработка статуса
    if (args.status) {
      const status = String(args.status).trim().toLowerCase();
      if (!dbService.validateProjectStatus(status)) {
        return {
          content: [{
            type: "text",
            text: `Неверный статус "${args.status}". Доступные: active, archive, paused, canceled`
          }]
        };
      }
      updateData.project_status = status;
    }

    // Обработка клиента
    if (args.client_name) {
      const client = await dbService.findClientByName(String(args.client_name).trim());
      if (!client) {
        return {
          content: [{
            type: "text",
            text: `Клиент с названием "${args.client_name}" не найден`
          }]
        };
      }
      updateData.client_id = client.client_id;
    }

    // Выполнение обновления
    const result = await dbService.updateProject(updateData);

    if (!result.success) {
      return {
        content: [{
          type: "text",
          text: `Ошибка обновления проекта: ${result.message}`
        }]
      };
    }

    // Формирование ответа о том, что изменилось
    const changes = [];
    if (updateData.project_name) changes.push(`Название: "${currentName}" → "${updateData.project_name}"`);
    if (updateData.project_description !== undefined) changes.push(`Описание: обновлено`);
    if (updateData.project_manager) changes.push(`Менеджер: обновлен`);
    if (updateData.project_lead_engineer) changes.push(`Главный инженер: обновлен`);
    if (updateData.project_status) changes.push(`Статус: ${updateData.project_status}`);
    if (updateData.client_id) changes.push(`Клиент: обновлен`);

    return {
      content: [{
        type: "text",
        text: `Проект "${currentName}" успешно обновлен\n\nИзменения:\n${changes.join('\n')}`
      }]
    };

  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Ошибка обновления проекта: ${error}`
      }]
    };
  }
}

// Экспорт всех инструментов проектов
export const projectTools = [
  createProjectTool,
  searchProjectsTool,
  getProjectDetailsTool,
  updateProjectTool
];

export const projectHandlers = {
  create_project: handleCreateProject,
  search_projects: handleSearchProjects,
  get_project_details: handleGetProjectDetails,
  update_project: handleUpdateProject
}; 