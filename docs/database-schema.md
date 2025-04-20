# Схема базы данных (public)

## Таблица profiles
- user_id (uuid, PK, FK → auth.users.id)
- first_name (text)
- last_name (text)
- department_id (uuid, FK → departments.department_id)
- team_id (uuid, FK → teams.team_id)
- position_id (uuid, FK → positions.position_id)
- email (text)
- created_at (timestamptz)
- category_id (uuid, FK → categories.category_id)
- role_id (uuid, FK → roles.id)
- work_format (work_format_type: 'Гибридный', 'В офисе', 'Удаленно')
- address (text)
- employment_rate (numeric, default 1)  # Employment rate: 0.25, 0.5, 0.75, 1, 1.25
- salary (numeric, default 0)           # Salary
- is_hourly (boolean, default true)     # Hourly payment

## Таблица departments
- department_id (uuid, PK)
- ws_department_id (integer)
- department_name (text)

## Таблица teams
- team_id (uuid, PK)
- ws_team_id (integer)
- team_name (text)
- department_id (uuid, FK → departments.department_id)

## Таблица positions
- position_id (uuid, PK)
- ws_position_id (integer)
- position_name (text)

## Таблица categories
- category_id (uuid, PK)
- ws_category_id (integer)
- category_name (text)

## Таблица roles
- id (uuid, PK)
- name (text, уникальное)
- description (text)
- created_at (timestamptz)

## Таблица permissions
- id (uuid, PK)
- name (text, уникальное)
- description (text)
- created_at (timestamptz)
    - payments.view — доступ к просмотру страницы оплаты
    - payments.edit — доступ к редактированию информации об оплате

## Таблица role_permissions
- id (uuid, PK)
- role_id (uuid, FK → roles.id)
- permission_id (uuid, FK → permissions.id)
- created_at (timestamptz)

## Таблица user_roles
- user_id (uuid, FK → profiles.user_id)
- role_id (uuid, FK → roles.id)
- PRIMARY KEY (user_id, role_id)

## Тип work_format_type
- 'Гибридный'
- 'В офисе'
- 'Удаленно'

---

**Связи:**
- profiles.department_id → departments.department_id
- profiles.team_id → teams.team_id
- profiles.position_id → positions.position_id
- profiles.category_id → categories.category_id
- profiles.role_id → roles.id
- user_roles.user_id → profiles.user_id
- user_roles.role_id → roles.id
- role_permissions.role_id → roles.id
- role_permissions.permission_id → permissions.id
