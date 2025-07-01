import { createClient } from "@/utils/supabase/client"

/**
 * Получить roleId и разрешения пользователя по userId
 * @param userId string
 * @param supabaseClient - опциональный экземпляр клиента Supabase
 * @returns { roleId: string | null, permissions: string[] }
 */
export async function getUserRoleAndPermissions(userId: string, supabaseClient?: any) {
  console.log("getUserRoleAndPermissions вызвана с userId:", userId);
  
  try {
    const supabase = supabaseClient || createClient();
    
    // Получаем roleId из profiles
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role_id")
      .eq("user_id", userId)
      .single();
    
    if (profileError || !profile?.role_id) {
      console.error("Ошибка при получении профиля:", profileError);
      return { roleId: null, permissions: [] };
    }
    
    const roleId = profile.role_id;
    
    // Получаем разрешения для роли
    const { data: rolePermissions, error: permissionsError } = await supabase
      .from("role_permissions")
      .select(`
        permissions(name)
      `)
      .eq("role_id", roleId);
    
    if (permissionsError) {
      console.error("Ошибка при получении разрешений:", permissionsError);
      return { roleId, permissions: [] };
    }
    
    const permissions = rolePermissions
      ?.map((rp: any) => rp.permissions?.name)
      .filter(Boolean) || [];
    
    console.log("Возвращаемые данные:", { roleId, permissions });
    return { roleId, permissions };
    
  } catch (error) {
    console.error("Непредвиденная ошибка в getUserRoleAndPermissions:", error);
    return { roleId: null, permissions: [] };
  }
} 