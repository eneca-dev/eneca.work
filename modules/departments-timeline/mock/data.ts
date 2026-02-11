/**
 * Mock Data — Иерархия Отделов для UI/UX прототипа
 *
 * Отдел → Проект → Объект/Раздел → Сотрудники
 * Безличные загрузки полностью убраны.
 */

import type { DeptHierarchyDepartment } from '../types/hierarchy'

/**
 * Моковые данные для прототипа
 *
 * 3 отдела, ~7 проектов, ~15 объект/разделов, ~30 сотрудников
 */
export const MOCK_DEPARTMENTS: DeptHierarchyDepartment[] = [
  // ===========================
  // Отдел конструктивных решений
  // ===========================
  {
    id: 'dept-1',
    name: 'Отдел конструктивных решений',
    employeeCount: 14,
    projects: [
      {
        id: 'proj-1',
        name: 'П-47/25 ЖК «Восход»',
        employeeCount: 8,
        objectSections: [
          {
            id: 'os-1',
            objectName: 'Корпус А',
            sectionName: 'КР - Конструктивные решения',
            capacity: 4,
            employees: [
              {
                id: 'emp-1',
                employeeName: 'Иванов А.П.',
                position: 'Ведущий инженер',
                startDate: '2026-01-20',
                endDate: '2026-03-10',
                rate: 1,
                stageName: 'Моделирование',
              },
              {
                id: 'emp-2',
                employeeName: 'Петрова М.С.',
                position: 'Инженер-конструктор',
                startDate: '2026-02-01',
                endDate: '2026-03-20',
                rate: 0.5,
              },
              {
                id: 'emp-3',
                employeeName: 'Козлов Д.В.',
                position: 'Инженер',
                startDate: '2026-02-10',
                endDate: '2026-04-01',
                rate: 0.75,
              },
              {
                id: 'emp-12',
                employeeName: 'Громов И.Н.',
                position: 'Инженер-конструктор',
                startDate: '2026-01-15',
                endDate: '2026-02-28',
                rate: 1,
                stageName: 'Расчёты',
              },
            ],
          },
          {
            id: 'os-2',
            objectName: 'Корпус Б',
            sectionName: 'КР - Конструктивные решения',
            capacity: 3,
            employees: [
              {
                id: 'emp-4',
                employeeName: 'Сидоров Е.А.',
                position: 'Инженер-конструктор',
                startDate: '2026-01-20',
                endDate: '2026-03-10',
                rate: 1,
                stageName: 'Расчёты',
              },
              {
                id: 'emp-5',
                employeeName: 'Николаева О.И.',
                position: 'Архитектор',
                startDate: '2026-02-01',
                endDate: '2026-03-20',
                rate: 0.5,
              },
              {
                id: 'emp-6',
                employeeName: 'Морозов К.Л.',
                position: 'Инженер',
                startDate: '2026-02-10',
                endDate: '2026-04-01',
                rate: 0.75,
              },
            ],
          },
          {
            id: 'os-5',
            objectName: 'Подземный паркинг',
            sectionName: 'КР - Конструктивные решения',
            capacity: 2,
            employees: [
              {
                id: 'emp-13',
                employeeName: 'Волков С.А.',
                position: 'Ведущий инженер',
                startDate: '2026-02-15',
                endDate: '2026-04-15',
                rate: 1,
                stageName: 'Моделирование',
              },
            ],
          },
        ],
      },
      {
        id: 'proj-4',
        name: 'ПР-33/26 ТЦ «Меркурий»',
        employeeCount: 6,
        objectSections: [
          {
            id: 'os-6',
            objectName: 'Торговый зал',
            sectionName: 'КР - Конструктивные решения',
            capacity: 3,
            employees: [
              {
                id: 'emp-14',
                employeeName: 'Орлова Т.В.',
                position: 'Инженер-конструктор',
                startDate: '2026-01-10',
                endDate: '2026-03-01',
                rate: 1,
                stageName: 'Проектирование',
              },
              {
                id: 'emp-15',
                employeeName: 'Фёдоров А.Г.',
                position: 'Инженер',
                startDate: '2026-02-01',
                endDate: '2026-03-15',
                rate: 0.5,
              },
              {
                id: 'emp-16',
                employeeName: 'Зайцев П.М.',
                position: 'Инженер',
                startDate: '2026-02-20',
                endDate: '2026-04-10',
                rate: 0.75,
                stageName: 'Расчёты',
              },
            ],
          },
          {
            id: 'os-7',
            objectName: 'Складской комплекс',
            sectionName: 'КР - Конструктивные решения',
            capacity: 3,
            employees: [
              {
                id: 'emp-17',
                employeeName: 'Борисов В.В.',
                position: 'Ведущий инженер',
                startDate: '2026-01-25',
                endDate: '2026-03-20',
                rate: 1,
              },
              {
                id: 'emp-18',
                employeeName: 'Алексеева М.А.',
                position: 'Инженер-конструктор',
                startDate: '2026-02-10',
                endDate: '2026-04-01',
                rate: 0.5,
                stageName: 'Чертежи',
              },
              {
                id: 'emp-19',
                employeeName: 'Дмитриев Р.Н.',
                position: 'Инженер',
                startDate: '2026-03-01',
                endDate: '2026-04-20',
                rate: 0.25,
              },
            ],
          },
        ],
      },
    ],
  },

  // ===========================
  // Отдел инженерных систем
  // ===========================
  {
    id: 'dept-2',
    name: 'Отдел инженерных систем',
    employeeCount: 11,
    projects: [
      {
        id: 'proj-2',
        name: 'ПР-12/25 БЦ «Горизонт»',
        employeeCount: 5,
        objectSections: [
          {
            id: 'os-3',
            objectName: 'Основное здание',
            sectionName: 'ОВ - Отопление и вентиляция',
            capacity: 3,
            employees: [
              {
                id: 'emp-7',
                employeeName: 'Кузнецов В.А.',
                position: 'Ведущий инженер ОВ',
                startDate: '2026-01-25',
                endDate: '2026-03-15',
                rate: 1,
                stageName: 'Проектирование',
              },
              {
                id: 'emp-8',
                employeeName: 'Лебедева А.С.',
                position: 'Инженер ОВ',
                startDate: '2026-02-10',
                endDate: '2026-03-30',
                rate: 1,
              },
              {
                id: 'emp-9',
                employeeName: 'Соколов И.М.',
                position: 'Инженер ВК',
                startDate: '2026-02-20',
                endDate: '2026-04-15',
                rate: 0.5,
              },
            ],
          },
          {
            id: 'os-8',
            objectName: 'Основное здание',
            sectionName: 'ВК - Водоснабжение и канализация',
            capacity: 2,
            employees: [
              {
                id: 'emp-20',
                employeeName: 'Григорьев Л.О.',
                position: 'Инженер ВК',
                startDate: '2026-02-01',
                endDate: '2026-03-25',
                rate: 1,
                stageName: 'Проектирование',
              },
              {
                id: 'emp-21',
                employeeName: 'Смирнова Е.К.',
                position: 'Инженер ВК',
                startDate: '2026-02-15',
                endDate: '2026-04-05',
                rate: 0.5,
              },
            ],
          },
        ],
      },
      {
        id: 'proj-3',
        name: 'П-47/25 ЖК «Восход»',
        employeeCount: 4,
        objectSections: [
          {
            id: 'os-4',
            objectName: 'Корпус А',
            sectionName: 'ВК - Водоснабжение и канализация',
            capacity: 2,
            employees: [
              {
                id: 'emp-10',
                employeeName: 'Тихонова Е.В.',
                position: 'Инженер ОВ',
                startDate: '2026-03-01',
                endDate: '2026-04-30',
                rate: 1,
                stageName: 'Проектирование',
              },
              {
                id: 'emp-11',
                employeeName: 'Белова Н.Р.',
                position: 'Инженер-конструктор',
                startDate: '2026-03-15',
                endDate: '2026-04-20',
                rate: 0.5,
              },
            ],
          },
          {
            id: 'os-9',
            objectName: 'Корпус Б',
            sectionName: 'ОВ - Отопление и вентиляция',
            capacity: 2,
            employees: [
              {
                id: 'emp-22',
                employeeName: 'Андреев К.С.',
                position: 'Инженер ОВ',
                startDate: '2026-02-05',
                endDate: '2026-03-20',
                rate: 0.75,
                stageName: 'Расчёты',
              },
              {
                id: 'emp-23',
                employeeName: 'Макарова О.В.',
                position: 'Инженер ОВ',
                startDate: '2026-03-01',
                endDate: '2026-04-25',
                rate: 1,
              },
            ],
          },
        ],
      },
      {
        id: 'proj-5',
        name: 'ПР-33/26 ТЦ «Меркурий»',
        employeeCount: 2,
        objectSections: [
          {
            id: 'os-10',
            objectName: 'Торговый зал',
            sectionName: 'ОВ - Отопление и вентиляция',
            capacity: 2,
            employees: [
              {
                id: 'emp-24',
                employeeName: 'Яковлев Д.А.',
                position: 'Ведущий инженер ОВ',
                startDate: '2026-01-15',
                endDate: '2026-03-05',
                rate: 1,
                stageName: 'Проектирование',
              },
              {
                id: 'emp-25',
                employeeName: 'Панова И.С.',
                position: 'Инженер ОВ',
                startDate: '2026-02-01',
                endDate: '2026-03-20',
                rate: 0.5,
              },
            ],
          },
        ],
      },
    ],
  },

  // ===========================
  // Отдел архитектурных решений
  // ===========================
  {
    id: 'dept-3',
    name: 'Отдел архитектурных решений',
    employeeCount: 9,
    projects: [
      {
        id: 'proj-6',
        name: 'П-47/25 ЖК «Восход»',
        employeeCount: 5,
        objectSections: [
          {
            id: 'os-11',
            objectName: 'Корпус А',
            sectionName: 'АР - Архитектурные решения',
            capacity: 3,
            employees: [
              {
                id: 'emp-26',
                employeeName: 'Ковалёва И.Д.',
                position: 'Главный архитектор',
                startDate: '2026-01-10',
                endDate: '2026-03-15',
                rate: 1,
                stageName: 'Концепция',
              },
              {
                id: 'emp-27',
                employeeName: 'Романов А.Б.',
                position: 'Архитектор',
                startDate: '2026-01-20',
                endDate: '2026-03-30',
                rate: 1,
                stageName: 'Моделирование',
              },
              {
                id: 'emp-28',
                employeeName: 'Степанова В.Г.',
                position: 'Архитектор',
                startDate: '2026-02-15',
                endDate: '2026-04-10',
                rate: 0.5,
              },
            ],
          },
          {
            id: 'os-12',
            objectName: 'Корпус Б',
            sectionName: 'АР - Архитектурные решения',
            capacity: 2,
            employees: [
              {
                id: 'emp-29',
                employeeName: 'Титов Н.Е.',
                position: 'Архитектор',
                startDate: '2026-02-01',
                endDate: '2026-04-01',
                rate: 0.75,
                stageName: 'Чертежи',
              },
              {
                id: 'emp-30',
                employeeName: 'Воробьёва С.М.',
                position: 'Архитектор',
                startDate: '2026-02-20',
                endDate: '2026-04-15',
                rate: 0.5,
              },
            ],
          },
        ],
      },
      {
        id: 'proj-7',
        name: 'ПР-55/26 Жилой дом «Луч»',
        employeeCount: 4,
        objectSections: [
          {
            id: 'os-13',
            objectName: 'Секция 1',
            sectionName: 'АР - Архитектурные решения',
            capacity: 2,
            employees: [
              {
                id: 'emp-31',
                employeeName: 'Егоров М.К.',
                position: 'Ведущий архитектор',
                startDate: '2026-01-05',
                endDate: '2026-02-28',
                rate: 1,
                stageName: 'Концепция',
              },
              {
                id: 'emp-32',
                employeeName: 'Новикова Д.Л.',
                position: 'Архитектор',
                startDate: '2026-01-15',
                endDate: '2026-03-10',
                rate: 0.5,
              },
            ],
          },
          {
            id: 'os-14',
            objectName: 'Секция 2',
            sectionName: 'АР - Архитектурные решения',
            capacity: 2,
            employees: [
              {
                id: 'emp-33',
                employeeName: 'Кравцов А.И.',
                position: 'Архитектор',
                startDate: '2026-02-10',
                endDate: '2026-04-05',
                rate: 1,
                stageName: 'Моделирование',
              },
              {
                id: 'emp-34',
                employeeName: 'Полякова Р.Т.',
                position: 'Архитектор',
                startDate: '2026-03-01',
                endDate: '2026-04-30',
                rate: 0.75,
              },
            ],
          },
        ],
      },
    ],
  },
]

/**
 * Mock-список сотрудников для селектора в модалке
 */
export interface MockEmployee {
  id: string
  name: string
  position: string
}

export const MOCK_EMPLOYEES: MockEmployee[] = [
  { id: 'memp-1', name: 'Иванов А.П.', position: 'Ведущий инженер' },
  { id: 'memp-2', name: 'Петрова М.С.', position: 'Инженер-конструктор' },
  { id: 'memp-3', name: 'Козлов Д.В.', position: 'Инженер' },
  { id: 'memp-4', name: 'Сидоров Е.А.', position: 'Инженер-конструктор' },
  { id: 'memp-5', name: 'Николаева О.И.', position: 'Архитектор' },
  { id: 'memp-6', name: 'Морозов К.Л.', position: 'Инженер' },
  { id: 'memp-7', name: 'Кузнецов В.А.', position: 'Ведущий инженер ОВ' },
  { id: 'memp-8', name: 'Лебедева А.С.', position: 'Инженер ОВ' },
  { id: 'memp-9', name: 'Соколов И.М.', position: 'Инженер ВК' },
  { id: 'memp-10', name: 'Тихонова Е.В.', position: 'Инженер ОВ' },
  { id: 'memp-11', name: 'Белова Н.Р.', position: 'Инженер-конструктор' },
  { id: 'memp-12', name: 'Громов И.Н.', position: 'Инженер-конструктор' },
  { id: 'memp-13', name: 'Волков С.А.', position: 'Ведущий инженер' },
  { id: 'memp-14', name: 'Орлова Т.В.', position: 'Инженер-конструктор' },
  { id: 'memp-15', name: 'Фёдоров А.Г.', position: 'Инженер' },
  { id: 'memp-16', name: 'Зайцев П.М.', position: 'Инженер' },
  { id: 'memp-17', name: 'Борисов В.В.', position: 'Ведущий инженер' },
  { id: 'memp-18', name: 'Алексеева М.А.', position: 'Инженер-конструктор' },
  { id: 'memp-19', name: 'Ковалёва И.Д.', position: 'Главный архитектор' },
  { id: 'memp-20', name: 'Романов А.Б.', position: 'Архитектор' },
]
