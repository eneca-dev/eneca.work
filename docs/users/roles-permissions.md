roles: id, name, description
permissions: id, name, description
role_permissions: id, role_id, permission_id
user_roles: user_id, role_id

Пользователь связан с ролями через user_roles.
Роль связана с правами через role_permissions.
Права описывают доступы.

Чтобы узнать права пользователя:
1. user_roles → роли пользователя
2. role_permissions → права ролей
3. permissions → описание прав 