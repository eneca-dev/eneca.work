import "https://deno.land/std@0.152.0/dotenv/load.ts";
import { serve } from "https://deno.land/std@0.191.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.3";

// Ожидаемые переменные окружения
const SUPABASE_URL = Deno.env.get("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY");
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("SUPABASE_URL or SERVICE_ROLE_KEY is missing");
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Хелпер для CORS заголовков
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey'
};

interface FilterOptions {
  departmentId?: string;
  positionId?: string;
  roleId?: string;
  teamId?: string;
  workFormat?: string;
  categoryId?: string;
  isHourly?: boolean;
}

type RequestBody = {
  entityType: string;
  payload: Record<string, unknown>;
  userIds?: string[];
  filters?: FilterOptions;
};

// Сопоставление ключей API → названия колонок в базе
const filterMapping: Record<keyof FilterOptions, string> = {
  departmentId:   'department_id',
  positionId:     'position_id',
  roleId:         'role_id',
  teamId:         'team_id',
  workFormat:     'work_format',
  categoryId:     'category_id',
  isHourly:       'is_hourly',
};

serve(async (req: Request) => {
  const { pathname } = new URL(req.url);
  
  // CORS для браузера
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders
    });
  }

  if (req.method !== "POST") {
    return new Response("Not Found", { status: 404, headers: corsHeaders });
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400, headers: corsHeaders });
  }

  const { entityType, payload, userIds, filters } = body;
  if (!entityType || typeof payload !== 'object') {
    return new Response("Missing required fields", { status: 400, headers: corsHeaders });
  }

  // 1. Определяем список пользователей
  console.log('📥 Получен запрос:', { entityType, payload, userIds: userIds?.length, filters });
  
  let targetUserIds: string[] | undefined = userIds;
  if ((!targetUserIds || targetUserIds.length === 0) && filters) {
    // Собираем объект для match()
    const matchObj: Record<string, unknown> = {};
    for (const key of Object.keys(filters) as (keyof FilterOptions)[]) {
      const value = filters[key];
      if (value != null) {
        matchObj[filterMapping[key]] = value;
      }
    }
    // Выполняем запрос
    const { data: profiles, error: profErr } = await supabase
      .from('profiles')
      .select('user_id')
      .match(matchObj);

    if (profErr) {
      console.error('Error fetching profiles:', profErr);
      return new Response('Profile fetch error', { status: 500, headers: corsHeaders });
    }
    targetUserIds = profiles!.map((p: { user_id: string }) => p.user_id);
  }

  if (!targetUserIds || targetUserIds.length === 0) {
    console.log('❌ Нет пользователей для отправки уведомлений');
    return new Response("No users to notify", { status: 400, headers: corsHeaders });
  }
  
  console.log('👥 Список пользователей для уведомлений:', targetUserIds.length);
  console.log('👥 Первые 5 пользователей:', targetUserIds.slice(0, 5));
  
  // Проверяем, включен ли конкретный пользователь (для отладки)
  const testUserId = '5f115156-6362-492f-b202-ac0da43b80d9';
  const isTestUserIncluded = targetUserIds.includes(testUserId);
  console.log('🔍 Тестовый пользователь включен:', isTestUserIncluded, testUserId);

  // 2. Находим тип сущности
  const { data: etData, error: etErr } = await supabase
    .from('entity_types')
    .select('id')
    .eq('entity_name', entityType)
    .maybeSingle();

  if (etErr) {
    console.error('Error fetching entity type:', etErr);
    return new Response('Could not fetch entity type', { status: 500, headers: corsHeaders });
  }

  if (!etData?.id) {
    console.error('Entity type not found:', entityType);
    return new Response('Entity type not found', { status: 400, headers: corsHeaders });
  }

  const entityTypeId = etData.id;

  // 3. Создаём уведомление
  console.log('📝 Создаем уведомление:', { entityTypeId, payload });
  
  const { data: notif, error: notifErr } = await supabase
    .from('notifications')
    .insert({
      entity_type_id: entityTypeId,
      payload,
      rendered_text: null,
    })
    .select('id')
    .single();

  if (notifErr || !notif) {
    console.error('❌ Error inserting notification:', notifErr);
    return new Response('Could not create notification', { status: 500, headers: corsHeaders });
  }
  const notificationId = notif.id;
  console.log('✅ Уведомление создано:', notificationId);

  // 4. Создаём записи в user_notifications
  const records = targetUserIds.map((uid) => ({
    notification_id: notificationId,
    user_id: uid,
  }));
  
  console.log('📋 Создаем записи в user_notifications:', records.length);
  console.log('📋 Первые 3 записи:', records.slice(0, 3));
  
  const { data: insertedRecords, error: unErr } = await supabase
    .from('user_notifications')
    .insert(records)
    .select('id, user_id');

  if (unErr) {
    console.error('❌ Error inserting user notifications:', unErr);
    return new Response('Could not notify users', { status: 500, headers: corsHeaders });
  }
  
  console.log('✅ Записи в user_notifications созданы:', insertedRecords?.length || 0);
  if (insertedRecords && insertedRecords.length > 0) {
    console.log('✅ Первые 3 созданные записи:', insertedRecords.slice(0, 3));
  }

  // 5. Возвращаем результат
  return new Response(JSON.stringify({ notificationId }), {
    status: 201,
    headers: { 
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  });
});
