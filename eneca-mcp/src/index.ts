#!/usr/bin/env node

/**
 * Eneca MCP Server
 * Сервер Model Context Protocol для системы планирования проектов Eneca
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Импортируем наши типы и сервис
import { DatabaseService } from "./services/database.js";
import type { 
  CreateSectionInput,
  Project,
  Stage,
  ObjectEntity
} from "./types/eneca.js";

// Импорт всех инструментов
import { projectTools, projectHandlers } from './tools/projects.js';
import { stageTools, stageHandlers } from './tools/stages.js';
import { objectTools, objectHandlers } from './tools/objects.js';
import { sectionTools, sectionHandlers } from './tools/sections.js';

// Создаем экземпляр сервиса базы данных
const dbService = new DatabaseService();

// Создание сервера
const server = new Server(
  {
    name: 'eneca-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      resources: {},
      tools: {},
      prompts: {},
    },
  }
);

// Объединение всех инструментов
const allTools = [
  ...projectTools,
  ...stageTools,
  ...objectTools,
  ...sectionTools
];

// Объединение всех обработчиков
const allHandlers = {
  ...projectHandlers,
  ...stageHandlers,
  ...objectHandlers,
  ...sectionHandlers
};

/**
 * Обработчик для списка доступных инструментов
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: allTools,
  };
});

/**
 * Обработчик вызова инструментов
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  try {
    // Поиск обработчика
    const handler = allHandlers[name as keyof typeof allHandlers];
    
    if (!handler) {
      throw new Error(`Инструмент "${name}" не найден`);
    }

    // Вызов обработчика
    return await handler(args || {});
    
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Ошибка выполнения инструмента "${name}": ${error}`
      }]
    };
  }
});

/**
 * Обработчик для списка ресурсов
 */
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: []
  };
});

/**
 * Обработчик чтения ресурсов
 */
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  throw new Error("Ресурсы не поддерживаются");
});

/**
 * Обработчик для списка промптов
 */
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: []
  };
});

/**
 * Обработчик промптов
 */
server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  throw new Error("Промпты не поддерживаются");
});

/**
 * Главная функция для запуска сервера
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  // Информационные сообщения убраны, чтобы не попадать в Error output MCP inspector
  // Сервер запущен и готов к работе
}

main().catch(console.error);
