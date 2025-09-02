BEGIN;

ALTER TABLE IF EXISTS public.sections
  ADD COLUMN IF NOT EXISTS last_responsible_updated TIMESTAMP WITH TIME ZONE NULL,
  ADD COLUMN IF NOT EXISTS last_status_updated TIMESTAMP WITH TIME ZONE NULL;

CREATE INDEX IF NOT EXISTS idx_sections_last_responsible_updated ON public.sections(last_responsible_updated);
CREATE INDEX IF NOT EXISTS idx_sections_last_status_updated ON public.sections(last_status_updated);

CREATE OR REPLACE FUNCTION public.update_sections_field_timestamps()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.section_responsible IS DISTINCT FROM NEW.section_responsible THEN
        NEW.last_responsible_updated := NOW();
    END IF;

    IF OLD.section_status_id IS DISTINCT FROM NEW.section_status_id THEN
        NEW.last_status_updated := NOW();
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sections_timestamps ON public.sections;

CREATE TRIGGER trigger_sections_timestamps
    BEFORE UPDATE ON public.sections
    FOR EACH ROW
    EXECUTE FUNCTION public.update_sections_field_timestamps();

COMMIT;

