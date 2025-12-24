-- Add stage metrics columns to project_reports
-- These columns store snapshot metrics calculated at report creation time

ALTER TABLE project_reports
ADD COLUMN actual_readiness NUMERIC CHECK (actual_readiness >= 0 AND actual_readiness <= 100),
ADD COLUMN planned_readiness NUMERIC CHECK (planned_readiness >= 0 AND planned_readiness <= 100),
ADD COLUMN budget_spent NUMERIC CHECK (budget_spent >= 0);

COMMENT ON COLUMN project_reports.actual_readiness IS 'Фактическая готовность стадии (%) на момент создания отчета';
COMMENT ON COLUMN project_reports.planned_readiness IS 'Плановая готовность стадии (%) на момент создания отчета';
COMMENT ON COLUMN project_reports.budget_spent IS 'Процент расхода бюджета стадии (%) на момент создания отчета';
