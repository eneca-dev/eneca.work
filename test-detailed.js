const { makeWorksectionRequest } = require('./test-worksection');
require('dotenv').config({ path: './ws.env' });

async function testDetailedAPI() {
    console.log('🔬 Детальное исследование Worksection API');
    console.log('==========================================');
    console.log('');

    try {
        // 1. Получаем список активных проектов
        console.log('📁 Получение только активных проектов...');
        const activeProjects = await makeWorksectionRequest('get_projects', { 
            status: 'active' 
        });
        
        if (activeProjects.statusCode === 200 && activeProjects.data.status === 'ok') {
            const projects = activeProjects.data.data || [];
            const active = projects.filter(p => p.status === 'active');
            
            console.log(`✅ Найдено ${active.length} активных проектов из ${projects.length} общих`);
            
            if (active.length > 0) {
                console.log('   Первые 5 активных проектов:');
                active.slice(0, 5).forEach((project, index) => {
                    console.log(`   ${index + 1}. ${project.name}`);
                    console.log(`      ID: ${project.id}, Статус: ${project.status}`);
                    console.log(`      Создан: ${project.date_added}`);
                    console.log('');
                });
                
                // Получаем задачи для первого активного проекта
                const firstProject = active[0];
                console.log(`📋 Получение задач для проекта "${firstProject.name}"...`);
                
                const tasks = await makeWorksectionRequest('get_tasks', {
                    id_project: firstProject.id
                });
                
                if (tasks.statusCode === 200 && tasks.data.status === 'ok') {
                    console.log(`✅ Получено ${tasks.data.data?.length || 0} задач`);
                    
                    if (tasks.data.data && tasks.data.data.length > 0) {
                        console.log('   Первые 3 задачи:');
                        tasks.data.data.slice(0, 3).forEach((task, index) => {
                            console.log(`   ${index + 1}. ${task.name}`);
                            console.log(`      ID: ${task.id}, Статус: ${task.status}`);
                            console.log(`      Создана: ${task.date_added}`);
                            console.log(`      Приоритет: ${task.priority || 'не указан'}`);
                        });
                    }
                } else {
                    console.log('❌ Ошибка получения задач:', tasks.data);
                }
            }
        } else {
            console.log('❌ Ошибка получения проектов:', activeProjects.data);
        }
        
        console.log('');
        
        // 2. Тестируем получение команд/групп
        console.log('👥 Попытка получения команд...');
        const teams = await makeWorksectionRequest('get_teams');
        
        if (teams.statusCode === 200) {
            if (teams.data.status === 'ok') {
                console.log(`✅ Получено ${teams.data.data?.length || 0} команд`);
                if (teams.data.data && teams.data.data.length > 0) {
                    teams.data.data.slice(0, 3).forEach((team, index) => {
                        console.log(`   ${index + 1}. ${team.name || team.title} (ID: ${team.id})`);
                    });
                }
            } else {
                console.log('❌ Метод get_teams не поддерживается:', teams.data.message);
            }
        }
        
        console.log('');
        
        // 3. Тестируем получение пользователей другим способом
        console.log('👤 Попытка получения участников проекта...');
        if (activeProjects.data.data && activeProjects.data.data.length > 0) {
            const firstProject = activeProjects.data.data.find(p => p.status === 'active') || activeProjects.data.data[0];
            
            const projectMembers = await makeWorksectionRequest('get_project_members', {
                id_project: firstProject.id
            });
            
            if (projectMembers.statusCode === 200) {
                if (projectMembers.data.status === 'ok') {
                    console.log(`✅ Получены участники проекта "${firstProject.name}"`);
                    console.log(`   Количество участников: ${projectMembers.data.data?.length || 0}`);
                    
                    if (projectMembers.data.data && projectMembers.data.data.length > 0) {
                        projectMembers.data.data.slice(0, 5).forEach((member, index) => {
                            console.log(`   ${index + 1}. ${member.name || member.email}`);
                            console.log(`      Email: ${member.email}`);
                            console.log(`      Роль: ${member.user_role || 'не указана'}`);
                        });
                    }
                } else {
                    console.log('❌ Метод get_project_members не поддерживается:', projectMembers.data.message);
                }
            }
        }
        
        console.log('');
        console.log('🎯 Резюме:');
        console.log('   ✅ get_projects - работает отлично');
        console.log('   ✅ get_tasks - работает для получения задач проекта');
        console.log('   ❌ get_account_info - не поддерживается');
        console.log('   ❌ get_members - не поддерживается');
        console.log('   ❓ get_teams - нужно проверить');
        console.log('   ❓ get_project_members - нужно проверить');

    } catch (error) {
        console.error('💥 Ошибка:', error.message);
    }
}

// Запускаем детальное тестирование
testDetailedAPI(); 