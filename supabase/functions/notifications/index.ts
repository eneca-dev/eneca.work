import "https://deno.land/std@0.152.0/dotenv/load.ts";
import { serve } from "https://deno.land/std@0.152.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.3";

// Ожидаемые переменные окружения
const SUPABASE_URL = Deno.env.get("NEXT_PUBLIC_SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing");
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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

serve(async (req) => {
  const url = new URL(req.url);
  if (req.method !== "POST" || url.pathname !== "/notifications") {
    return new Response("Not Found", { status: 404 });
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const { entityType, payload, userIds, filters } = body;
  if (!entityType || typeof payload !== 'object') {
    return new Response("Missing required fields", { status: 400 });
  }

  // 1. Определяем список пользователей
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
      return new Response('Profile fetch error', { status: 500 });
    }
    targetUserIds = profiles!.map((p: { user_id: string }) => p.user_id);
  }

  if (!targetUserIds || targetUserIds.length === 0) {
    return new Response("No users to notify", { status: 400 });
  }

  // 2. Находим или создаём тип сущности
  const { data: etData, error: etErr } = await supabase
    .from('entity_types')
    .select('id')
    .eq('entity_name', entityType)
    .maybeSingle();

  if (etErr) {
    console.error('Error fetching entity type:', etErr);
    return new Response('Could not fetch entity type', { status: 500 });
  }

  let entityTypeId = etData?.id;
  if (!entityTypeId) {
    const { data: newEt, error: createEtErr } = await supabase
      .from('entity_types')
      .insert({ entity_name: entityType })
      .select('id')
      .single();
    if (createEtErr || !newEt) {
      console.error('Error creating entity type:', createEtErr);
      return new Response('Could not create entity type', { status: 500 });
    }
    entityTypeId = newEt.id;
  }

  // 3. Создаём уведомление
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
    console.error('Error inserting notification:', notifErr);
    return new Response('Could not create notification', { status: 500 });
  }
  const notificationId = notif.id;

  // 4. Создаём записи в user_notifications
  const records = targetUserIds.map((uid) => ({
    notification_id: notificationId,
    user_id: uid,
  }));
  const { error: unErr } = await supabase
    .from('user_notifications')
    .insert(records);

  if (unErr) {
    console.error('Error inserting user notifications:', unErr);
    return new Response('Could not notify users', { status: 500 });
  }

  // 5. Возвращаем результат
  return new Response(JSON.stringify({ notificationId }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' }
  });
});
