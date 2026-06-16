import type { MockProject } from './types'

// Базовая дата: 2026-06-16
export const MOCK_PROJECTS: MockProject[] = [
  {
    id: 'p1',
    name: 'Офисный центр «Альфа»',
    color: '#1e7260',
    objects: [
      {
        id: 'o1',
        name: 'Корпус А (административный)',
        sections: [
          {
            id: 's1',
            name: 'АР — Архитектурные решения',
            stages: [
              { id: 'st1', name: 'Концепция', startDate: '2026-05-01', endDate: '2026-05-25' },
              { id: 'st2', name: 'Рабочие чертежи', startDate: '2026-05-20', endDate: '2026-07-10' },
              { id: 'st3', name: 'Согласование', startDate: '2026-07-01', endDate: '2026-07-28' },
              { id: 'st4', name: 'Авторский надзор', startDate: null, endDate: null },
              { id: 'st5', name: 'Рецензия', startDate: null, endDate: null },
            ],
          },
          {
            id: 's2',
            name: 'КЖ — Конструкции железобетонные',
            stages: [
              { id: 'st6', name: 'Фундамент', startDate: '2026-05-10', endDate: '2026-06-15' },
              { id: 'st7', name: 'Каркас', startDate: '2026-06-10', endDate: '2026-08-05' },
              { id: 'st8', name: 'Перекрытия', startDate: '2026-07-20', endDate: '2026-09-01' },
              { id: 'st9', name: 'Доп. расчёты', startDate: null, endDate: null },
            ],
          },
          {
            id: 's3',
            name: 'ОВ — Отопление и вентиляция',
            stages: [
              { id: 'st10', name: 'Проектирование', startDate: '2026-06-01', endDate: '2026-07-15' },
              { id: 'st11', name: 'Монтаж', startDate: '2026-08-01', endDate: '2026-09-20' },
              { id: 'st12', name: 'Пусконаладка', startDate: null, endDate: null },
              { id: 'st13', name: 'Резерв', startDate: null, endDate: null },
            ],
          },
          {
            id: 's4',
            name: 'ВК — Водоснабжение и канализация',
            stages: [
              { id: 'st14a', name: 'Водоснабжение', startDate: '2026-05-20', endDate: '2026-06-30' },
              { id: 'st14b', name: 'Канализация', startDate: '2026-06-25', endDate: '2026-07-30' },
              { id: 'st14c', name: 'Ливневая канализация', startDate: '2026-07-15', endDate: '2026-08-20' },
              { id: 'st14d', name: 'Согласование', startDate: null, endDate: null },
            ],
          },
          {
            id: 's5',
            name: 'ЭС — Электроснабжение',
            stages: [
              { id: 'st15a', name: 'Силовое электроснабжение', startDate: '2026-06-01', endDate: '2026-07-20' },
              { id: 'st15b', name: 'Слаботочные системы', startDate: '2026-06-20', endDate: '2026-07-25' },
              { id: 'st15c', name: 'Освещение', startDate: '2026-07-10', endDate: '2026-08-15' },
              { id: 'st15d', name: 'Молниезащита', startDate: null, endDate: null },
            ],
          },
        ],
      },
      {
        id: 'o2',
        name: 'Корпус Б (технический)',
        sections: [
          {
            id: 's6',
            name: 'КМ — Конструкции металлические',
            stages: [
              { id: 'st16a', name: 'Рабочая документация', startDate: '2026-05-15', endDate: '2026-06-30' },
              { id: 'st16b', name: 'Изготовление', startDate: '2026-07-01', endDate: '2026-08-15' },
              { id: 'st16c', name: 'Монтаж', startDate: '2026-08-10', endDate: '2026-09-10' },
            ],
          },
          {
            id: 's7',
            name: 'АР — Архитектурные решения',
            stages: [
              { id: 'st17a', name: 'Планировки', startDate: '2026-05-05', endDate: '2026-06-05' },
              { id: 'st17b', name: 'Фасады', startDate: '2026-05-25', endDate: '2026-06-25' },
              { id: 'st17c', name: 'Разрезы', startDate: '2026-06-10', endDate: '2026-07-10' },
              { id: 'st17d', name: 'Авторский надзор', startDate: null, endDate: null },
            ],
          },
          {
            id: 's8',
            name: 'ГП — Генеральный план',
            stages: [
              { id: 'st18a', name: 'Ситуационный план', startDate: '2026-05-01', endDate: '2026-05-20' },
              { id: 'st18b', name: 'Разбивочный чертёж', startDate: '2026-05-15', endDate: '2026-06-10' },
              { id: 'st18c', name: 'Благоустройство', startDate: '2026-07-01', endDate: '2026-08-30' },
              { id: 'st18d', name: 'Озеленение', startDate: '2026-08-15', endDate: '2026-09-20' },
              { id: 'st18e', name: 'Согласование', startDate: null, endDate: null },
            ],
          },
        ],
      },
      {
        id: 'o3',
        name: 'Паркинг подземный',
        sections: [
          {
            id: 's9',
            name: 'КЖ — Конструкции железобетонные',
            stages: [
              { id: 'st19a', name: 'Котлован', startDate: '2026-05-10', endDate: '2026-06-01' },
              { id: 'st19b', name: 'Фундаментная плита', startDate: '2026-05-25', endDate: '2026-06-20' },
              { id: 'st19c', name: 'Стены', startDate: '2026-06-15', endDate: '2026-07-25' },
              { id: 'st19d', name: 'Перекрытие', startDate: '2026-07-20', endDate: '2026-08-25' },
            ],
          },
          {
            id: 's10',
            name: 'ОВ — Вентиляция паркинга',
            stages: [
              { id: 'st20a', name: 'Проектирование', startDate: '2026-06-10', endDate: '2026-07-05' },
              { id: 'st20b', name: 'Монтаж воздуховодов', startDate: '2026-07-20', endDate: '2026-08-20' },
              { id: 'st20c', name: 'Пусконаладка', startDate: null, endDate: null },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'p2',
    name: 'ЖК «Берёзовая роща»',
    color: '#7c5cbf',
    objects: [
      {
        id: 'o4',
        name: 'Секция 1 (1–9 этаж)',
        sections: [
          {
            id: 's11',
            name: 'АР — Архитектурные решения',
            stages: [
              { id: 'st21a', name: 'Эскиз', startDate: '2026-06-01', endDate: '2026-06-20' },
              { id: 'st21b', name: 'Проектная документация', startDate: '2026-06-15', endDate: '2026-07-31' },
              { id: 'st21c', name: 'Согласование в ГГЭ', startDate: '2026-08-01', endDate: '2026-09-15' },
              { id: 'st21d', name: 'Замечания ГГЭ', startDate: null, endDate: null },
              { id: 'st21e', name: 'Дополнения', startDate: null, endDate: null },
            ],
          },
          {
            id: 's12',
            name: 'КЖ — Конструкции железобетонные',
            stages: [
              { id: 'st22a', name: 'Фундамент', startDate: '2026-05-20', endDate: '2026-06-25' },
              { id: 'st22b', name: 'Стеновые панели', startDate: '2026-06-20', endDate: '2026-08-10' },
              { id: 'st22c', name: 'Перекрытия типовые', startDate: '2026-07-01', endDate: '2026-08-20' },
              { id: 'st22d', name: 'Кровля', startDate: '2026-08-15', endDate: '2026-09-30' },
            ],
          },
          {
            id: 's13',
            name: 'ВК — Водоснабжение и канализация',
            stages: [
              { id: 'st23a', name: 'Ввод в здание', startDate: '2026-06-05', endDate: '2026-06-30' },
              { id: 'st23b', name: 'Разводка по этажам', startDate: '2026-07-01', endDate: '2026-08-15' },
              { id: 'st23c', name: 'Тестирование', startDate: null, endDate: null },
            ],
          },
        ],
      },
      {
        id: 'o5',
        name: 'Секция 2 (1–12 этаж)',
        sections: [
          {
            id: 's14',
            name: 'АР — Архитектурные решения',
            stages: [
              { id: 'st24a', name: 'Концепция', startDate: '2026-06-10', endDate: '2026-07-05' },
              { id: 'st24b', name: 'Рабочая документация', startDate: '2026-07-01', endDate: '2026-08-25' },
              { id: 'st24c', name: 'Авторский надзор', startDate: null, endDate: null },
            ],
          },
          {
            id: 's15',
            name: 'ЭС — Электроснабжение',
            stages: [
              { id: 'st25a', name: 'Проектирование ВРУ', startDate: '2026-06-15', endDate: '2026-07-10' },
              { id: 'st25b', name: 'Этажные щиты', startDate: '2026-07-05', endDate: '2026-08-01' },
              { id: 'st25c', name: 'Слаботочка', startDate: '2026-07-20', endDate: '2026-08-20' },
              { id: 'st25d', name: 'Диспетчеризация', startDate: '2026-08-10', endDate: '2026-09-10' },
              { id: 'st25e', name: 'Согласование', startDate: null, endDate: null },
            ],
          },
        ],
      },
      {
        id: 'o6',
        name: 'Благоустройство территории',
        sections: [
          {
            id: 's16',
            name: 'ГП — Генеральный план',
            stages: [
              { id: 'st26a', name: 'Дорожки и проезды', startDate: '2026-07-01', endDate: '2026-08-01' },
              { id: 'st26b', name: 'Детские площадки', startDate: '2026-07-20', endDate: '2026-08-25' },
              { id: 'st26c', name: 'Парковка', startDate: '2026-08-01', endDate: '2026-09-01' },
              { id: 'st26d', name: 'Озеленение', startDate: '2026-08-20', endDate: '2026-09-30' },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'p3',
    name: 'Торговый центр «Меридиан»',
    color: '#c0763a',
    objects: [
      {
        id: 'o7',
        name: 'Главный торговый корпус',
        sections: [
          {
            id: 's17',
            name: 'АР — Архитектурные решения',
            stages: [
              { id: 'st27a', name: 'Концепция фасадов', startDate: '2026-05-01', endDate: '2026-05-28' },
              { id: 'st27b', name: 'Интерьеры ТЦ', startDate: '2026-05-15', endDate: '2026-06-20' },
              { id: 'st27c', name: 'Рабочие чертежи', startDate: '2026-06-10', endDate: '2026-07-31' },
              { id: 'st27d', name: 'Авторский надзор', startDate: null, endDate: null },
            ],
          },
          {
            id: 's18',
            name: 'КЖ — Конструкции железобетонные',
            stages: [
              { id: 'st28a', name: 'Фундамент', startDate: '2026-05-05', endDate: '2026-06-10' },
              { id: 'st28b', name: 'Колонны и ригели', startDate: '2026-06-01', endDate: '2026-07-15' },
              { id: 'st28c', name: 'Перекрытия 1 уровень', startDate: '2026-07-01', endDate: '2026-08-10' },
              { id: 'st28d', name: 'Перекрытия 2 уровень', startDate: '2026-07-25', endDate: '2026-09-01' },
            ],
          },
          {
            id: 's19',
            name: 'ОВ — Кондиционирование',
            stages: [
              { id: 'st29a', name: 'Приточная вентиляция', startDate: '2026-06-20', endDate: '2026-07-20' },
              { id: 'st29b', name: 'Вытяжная вентиляция', startDate: '2026-07-10', endDate: '2026-08-10' },
              { id: 'st29c', name: 'Кондиционирование', startDate: '2026-07-25', endDate: '2026-08-30' },
              { id: 'st29d', name: 'Пусконаладка', startDate: null, endDate: null },
            ],
          },
          {
            id: 's20',
            name: 'ПБ — Пожарная безопасность',
            stages: [
              { id: 'st30a', name: 'Эвакуационные пути', startDate: '2026-06-01', endDate: '2026-06-25' },
              { id: 'st30b', name: 'Пожаротушение', startDate: '2026-06-20', endDate: '2026-07-20' },
              { id: 'st30c', name: 'Сигнализация', startDate: '2026-07-10', endDate: '2026-08-05' },
              { id: 'st30d', name: 'Согласование МЧС', startDate: null, endDate: null },
            ],
          },
        ],
      },
      {
        id: 'o8',
        name: 'Фудкорт (3 этаж)',
        sections: [
          {
            id: 's21',
            name: 'ТХ — Технологические решения',
            stages: [
              { id: 'st31a', name: 'Расстановка оборудования', startDate: '2026-06-15', endDate: '2026-07-10' },
              { id: 'st31b', name: 'Вентиляция кухонь', startDate: '2026-07-01', endDate: '2026-08-01' },
              { id: 'st31c', name: 'Жироуловители', startDate: '2026-07-20', endDate: '2026-08-15' },
              { id: 'st31d', name: 'Согласование', startDate: null, endDate: null },
            ],
          },
          {
            id: 's22',
            name: 'АР — Отделка и интерьер',
            stages: [
              { id: 'st32a', name: 'Концепция дизайна', startDate: '2026-05-20', endDate: '2026-06-15' },
              { id: 'st32b', name: 'Рабочая документация', startDate: '2026-06-10', endDate: '2026-07-20' },
              { id: 'st32c', name: 'Авторский надзор', startDate: null, endDate: null },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'p4',
    name: 'Школа №47 (реконструкция)',
    color: '#2563a8',
    objects: [
      {
        id: 'o9',
        name: 'Главный учебный корпус',
        sections: [
          {
            id: 's23',
            name: 'АР — Архитектурные решения',
            stages: [
              { id: 'st33a', name: 'Обследование здания', startDate: '2026-05-01', endDate: '2026-05-20' },
              { id: 'st33b', name: 'Концепция реконструкции', startDate: '2026-05-15', endDate: '2026-06-10' },
              { id: 'st33c', name: 'Проектная документация', startDate: '2026-06-01', endDate: '2026-07-25' },
              { id: 'st33d', name: 'Рабочие чертежи', startDate: '2026-07-15', endDate: '2026-09-10' },
              { id: 'st33e', name: 'Авторский надзор', startDate: null, endDate: null },
            ],
          },
          {
            id: 's24',
            name: 'КЖ — Усиление конструкций',
            stages: [
              { id: 'st34a', name: 'Обследование несущих', startDate: '2026-05-05', endDate: '2026-05-25' },
              { id: 'st34b', name: 'Проект усиления', startDate: '2026-05-20', endDate: '2026-06-20' },
              { id: 'st34c', name: 'Рабочая документация', startDate: '2026-06-15', endDate: '2026-07-30' },
            ],
          },
          {
            id: 's25',
            name: 'ОВ — Замена системы отопления',
            stages: [
              { id: 'st35a', name: 'Демонтаж старой системы', startDate: '2026-07-01', endDate: '2026-07-20' },
              { id: 'st35b', name: 'Новая разводка', startDate: '2026-07-15', endDate: '2026-08-20' },
              { id: 'st35c', name: 'Радиаторы и тёплый пол', startDate: '2026-08-10', endDate: '2026-09-10' },
              { id: 'st35d', name: 'Промывка и опрессовка', startDate: null, endDate: null },
            ],
          },
        ],
      },
      {
        id: 'o10',
        name: 'Спортивный зал',
        sections: [
          {
            id: 's26',
            name: 'АР — Внутренняя отделка',
            stages: [
              { id: 'st36a', name: 'Демонтаж', startDate: '2026-06-15', endDate: '2026-07-01' },
              { id: 'st36b', name: 'Стяжка пола', startDate: '2026-07-01', endDate: '2026-07-20' },
              { id: 'st36c', name: 'Покрытие', startDate: '2026-07-18', endDate: '2026-08-10' },
              { id: 'st36d', name: 'Стены и потолок', startDate: '2026-08-01', endDate: '2026-09-01' },
            ],
          },
          {
            id: 's27',
            name: 'ЭС — Электроснабжение',
            stages: [
              { id: 'st37a', name: 'Замена кабельных линий', startDate: '2026-06-20', endDate: '2026-07-15' },
              { id: 'st37b', name: 'Освещение', startDate: '2026-07-10', endDate: '2026-08-05' },
              { id: 'st37c', name: 'Аварийное освещение', startDate: null, endDate: null },
            ],
          },
        ],
      },
    ],
  },
]
