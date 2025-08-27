-- Удаляем legacy-колонку profiles.role_id и внешний ключ
-- Безопасно: сначала проверим наличие колонки
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'profiles' 
      AND column_name = 'role_id'
  ) THEN
    -- Удаляем внешний ключ если существует
    BEGIN
      EXECUTE 'ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_id_fkey';
    EXCEPTION WHEN others THEN
      -- игнорируем, если уже отсутствует
      NULL;
    END;
    -- Удаляем колонку
    EXECUTE 'ALTER TABLE public.profiles DROP COLUMN role_id';
  END IF;
END$$;


