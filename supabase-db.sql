-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.announcements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  header text NOT NULL,
  text text,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT announcements_pkey PRIMARY KEY (id),
  CONSTRAINT announcements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(user_id)
);
CREATE TABLE public.assignment_audit (
  audit_id uuid NOT NULL DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL,
  changed_by uuid,
  changed_at timestamp with time zone DEFAULT now(),
  operation_type character varying NOT NULL CHECK (operation_type::text = 'UPDATE'::text),
  field_name character varying NOT NULL,
  old_value text,
  new_value text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT assignment_audit_pkey PRIMARY KEY (audit_id),
  CONSTRAINT assignment_audit_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES public.assignments(assignment_id),
  CONSTRAINT assignment_audit_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES auth.users(id)
);
CREATE TABLE public.assignments (
  assignment_id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid,
  from_section_id uuid,
  to_section_id uuid,
  created_at timestamp without time zone,
  updated_at timestamp without time zone,
  due_date date,
  link text,
  created_by uuid,
  updated_by uuid,
  status USER-DEFINED DEFAULT 'Создано'::assignment_status,
  planned_transmitted_date date,
  planned_duration integer,
  actual_transmitted_date date,
  actual_accepted_date date,
  actual_worked_out_date date,
  actual_agreed_date date,
  title character varying NOT NULL DEFAULT ''::character varying,
  description text,
  CONSTRAINT assignments_pkey PRIMARY KEY (assignment_id),
  CONSTRAINT assignments_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(project_id),
  CONSTRAINT assignments_from_section_id_fkey FOREIGN KEY (from_section_id) REFERENCES public.sections(section_id),
  CONSTRAINT assignments_to_section_id_fkey FOREIGN KEY (to_section_id) REFERENCES public.sections(section_id)
);
CREATE TABLE public.calendar_events (
  calendar_event_id uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  calendar_event_type USER-DEFINED NOT NULL,
  calendar_event_comment text,
  calendar_event_is_global boolean NOT NULL DEFAULT false,
  calendar_event_is_weekday boolean,
  calendar_event_created_by uuid,
  calendar_event_date_start timestamp with time zone NOT NULL,
  calendar_event_date_end timestamp with time zone,
  calendar_event_created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT calendar_events_pkey PRIMARY KEY (calendar_event_id),
  CONSTRAINT calendar_events_calendar_event_created_by_fkey FOREIGN KEY (calendar_event_created_by) REFERENCES public.profiles(user_id)
);
CREATE TABLE public.categories (
  ws_category_id integer,
  category_name text UNIQUE,
  category_id uuid NOT NULL,
  CONSTRAINT categories_pkey PRIMARY KEY (category_id)
);
CREATE TABLE public.chat_conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  task_id uuid,
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'closed'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT chat_conversations_pkey PRIMARY KEY (id),
  CONSTRAINT chat_conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT chat_conversations_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(task_id)
);
CREATE TABLE public.chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role = ANY (ARRAY['user'::text, 'assistant'::text, 'system'::text])),
  kind text NOT NULL CHECK (kind = ANY (ARRAY['message'::text, 'thinking'::text, 'tool'::text, 'observation'::text])),
  content text NOT NULL,
  step_index integer,
  run_id text,
  is_final boolean NOT NULL DEFAULT false,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT chat_messages_pkey PRIMARY KEY (id),
  CONSTRAINT chat_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.chat_conversations(id),
  CONSTRAINT chat_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.cities (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  country_id uuid NOT NULL,
  CONSTRAINT cities_pkey PRIMARY KEY (id),
  CONSTRAINT fk_cities_country FOREIGN KEY (country_id) REFERENCES public.countries(id)
);
CREATE TABLE public.clients (
  client_id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_name text NOT NULL,
  client_description text,
  client_contact_person text,
  client_phone text,
  client_email text,
  client_address text,
  client_created timestamp with time zone NOT NULL DEFAULT now(),
  client_updated timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT clients_pkey PRIMARY KEY (client_id)
);
CREATE TABLE public.contracts (
  contract_id uuid NOT NULL DEFAULT gen_random_uuid(),
  contract_number text NOT NULL,
  contract_name text NOT NULL,
  contract_description text,
  contract_client_id uuid,
  contract_project_id uuid,
  contract_created timestamp with time zone NOT NULL DEFAULT now(),
  contract_updated timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT contracts_pkey PRIMARY KEY (contract_id),
  CONSTRAINT contracts_contract_client_id_fkey FOREIGN KEY (contract_client_id) REFERENCES public.clients(client_id),
  CONSTRAINT contracts_contract_project_id_fkey FOREIGN KEY (contract_project_id) REFERENCES public.projects(project_id)
);
CREATE TABLE public.countries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  CONSTRAINT countries_pkey PRIMARY KEY (id)
);
CREATE TABLE public.dec_template_stages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  stage_order integer NOT NULL DEFAULT 0,
  items jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(items) = 'array'::text),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT dec_template_stages_pkey PRIMARY KEY (id),
  CONSTRAINT dec_template_stages_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.dec_templates(id)
);
CREATE TABLE public.dec_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  department_id uuid NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT dec_templates_pkey PRIMARY KEY (id),
  CONSTRAINT dec_templates_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(department_id),
  CONSTRAINT dec_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(user_id)
);
CREATE TABLE public.decomposition_difficulty_levels (
  difficulty_id uuid NOT NULL DEFAULT gen_random_uuid(),
  difficulty_abbr text NOT NULL UNIQUE CHECK (length(TRIM(BOTH FROM difficulty_abbr)) > 0),
  difficulty_definition text NOT NULL UNIQUE CHECK (length(TRIM(BOTH FROM difficulty_definition)) > 0),
  difficulty_weight smallint NOT NULL UNIQUE CHECK (difficulty_weight > 0),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT decomposition_difficulty_levels_pkey PRIMARY KEY (difficulty_id)
);
CREATE TABLE public.decomposition_items (
  decomposition_item_id uuid NOT NULL DEFAULT gen_random_uuid(),
  decomposition_item_section_id uuid NOT NULL,
  decomposition_item_description text NOT NULL,
  decomposition_item_work_category_id uuid NOT NULL,
  decomposition_item_planned_hours numeric NOT NULL CHECK (decomposition_item_planned_hours >= 0::numeric),
  decomposition_item_planned_due_date date,
  decomposition_item_order integer NOT NULL DEFAULT 0,
  decomposition_item_created_by uuid,
  decomposition_item_created_at timestamp with time zone NOT NULL DEFAULT now(),
  decomposition_item_updated_at timestamp with time zone NOT NULL DEFAULT now(),
  decomposition_item_responsible uuid,
  decomposition_item_status_id uuid,
  decomposition_item_progress integer DEFAULT 0 CHECK (decomposition_item_progress >= 0 AND decomposition_item_progress <= 100),
  decomposition_item_stage_id uuid,
  decomposition_item_difficulty_id uuid,
  CONSTRAINT decomposition_items_pkey PRIMARY KEY (decomposition_item_id),
  CONSTRAINT decomposition_items_decomposition_item_section_id_fkey FOREIGN KEY (decomposition_item_section_id) REFERENCES public.sections(section_id),
  CONSTRAINT decomposition_items_decomposition_item_work_category_id_fkey FOREIGN KEY (decomposition_item_work_category_id) REFERENCES public.work_categories(work_category_id),
  CONSTRAINT decomposition_items_decomposition_item_responsible_fkey FOREIGN KEY (decomposition_item_responsible) REFERENCES public.profiles(user_id),
  CONSTRAINT decomposition_items_decomposition_item_stage_id_fkey FOREIGN KEY (decomposition_item_stage_id) REFERENCES public.decomposition_stages(decomposition_stage_id),
  CONSTRAINT decomposition_items_decomposition_item_created_by_fkey FOREIGN KEY (decomposition_item_created_by) REFERENCES public.profiles(user_id),
  CONSTRAINT decomposition_items_decomposition_item_status_id_fkey FOREIGN KEY (decomposition_item_status_id) REFERENCES public.section_statuses(id),
  CONSTRAINT decomposition_items_difficulty_fkey FOREIGN KEY (decomposition_item_difficulty_id) REFERENCES public.decomposition_difficulty_levels(difficulty_id)
);
CREATE TABLE public.decomposition_stages (
  decomposition_stage_id uuid NOT NULL DEFAULT gen_random_uuid(),
  decomposition_stage_section_id uuid NOT NULL,
  decomposition_stage_name text NOT NULL,
  decomposition_stage_description text,
  decomposition_stage_start date,
  decomposition_stage_finish date,
  decomposition_stage_order integer DEFAULT 0,
  decomposition_stage_status_id uuid,
  decomposition_stage_created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  decomposition_stage_responsibles ARRAY DEFAULT '{}'::uuid[],
  CONSTRAINT decomposition_stages_pkey PRIMARY KEY (decomposition_stage_id),
  CONSTRAINT decomposition_stages_decomposition_stage_section_id_fkey FOREIGN KEY (decomposition_stage_section_id) REFERENCES public.sections(section_id),
  CONSTRAINT decomposition_stages_decomposition_stage_status_id_fkey FOREIGN KEY (decomposition_stage_status_id) REFERENCES public.section_statuses(id),
  CONSTRAINT decomposition_stages_decomposition_stage_created_by_fkey FOREIGN KEY (decomposition_stage_created_by) REFERENCES public.profiles(user_id)
);
CREATE TABLE public.decomposition_template_items (
  decomposition_template_item_id uuid NOT NULL DEFAULT gen_random_uuid(),
  decomposition_template_item_template_id uuid NOT NULL,
  decomposition_template_item_description text NOT NULL,
  decomposition_template_item_work_category_id uuid NOT NULL,
  decomposition_template_item_planned_hours numeric NOT NULL DEFAULT 0,
  decomposition_template_item_due_offset_days integer,
  decomposition_template_item_order integer NOT NULL DEFAULT 0,
  decomposition_template_item_responsible uuid,
  decomposition_template_item_status_id uuid,
  decomposition_template_item_progress integer DEFAULT 0 CHECK (decomposition_template_item_progress >= 0 AND decomposition_template_item_progress <= 100),
  CONSTRAINT decomposition_template_items_pkey PRIMARY KEY (decomposition_template_item_id),
  CONSTRAINT decomposition_template_items_decomposition_template_item_t_fkey FOREIGN KEY (decomposition_template_item_template_id) REFERENCES public.decomposition_templates(decomposition_template_id),
  CONSTRAINT decomposition_template_items_decomposition_template_item_w_fkey FOREIGN KEY (decomposition_template_item_work_category_id) REFERENCES public.work_categories(work_category_id),
  CONSTRAINT decomposition_template_items_decomposition_template_item_r_fkey FOREIGN KEY (decomposition_template_item_responsible) REFERENCES public.profiles(user_id),
  CONSTRAINT decomposition_template_items_decomposition_template_item_s_fkey FOREIGN KEY (decomposition_template_item_status_id) REFERENCES public.section_statuses(id)
);
CREATE TABLE public.decomposition_templates (
  decomposition_template_id uuid NOT NULL DEFAULT gen_random_uuid(),
  decomposition_template_name text NOT NULL,
  decomposition_department_id uuid NOT NULL,
  decomposition_template_creator_id uuid,
  decomposition_template_created_at timestamp with time zone NOT NULL DEFAULT now(),
  decomposition_template_content jsonb NOT NULL DEFAULT '[]'::jsonb,
  decomposition_template_description text,
  decomposition_template_is_active boolean NOT NULL DEFAULT true,
  decomposition_template_updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT decomposition_templates_pkey PRIMARY KEY (decomposition_template_id),
  CONSTRAINT decomposition_templates_decomposition_department_id_fkey FOREIGN KEY (decomposition_department_id) REFERENCES public.departments(department_id),
  CONSTRAINT decomposition_templates_decomposition_template_creator_id_fkey FOREIGN KEY (decomposition_template_creator_id) REFERENCES public.profiles(user_id)
);
CREATE TABLE public.departments (
  ws_department_id integer,
  department_name text UNIQUE,
  department_id uuid NOT NULL,
  department_head_id uuid,
  subdivision_id uuid NOT NULL,
  CONSTRAINT departments_pkey PRIMARY KEY (department_id),
  CONSTRAINT departments_department_head_id_fkey FOREIGN KEY (department_head_id) REFERENCES public.profiles(user_id),
  CONSTRAINT departments_subdivision_id_fkey FOREIGN KEY (subdivision_id) REFERENCES public.subdivisions(subdivision_id)
);
CREATE TABLE public.documents (
  id bigint NOT NULL DEFAULT nextval('documents_id_seq'::regclass),
  content text,
  metadata jsonb,
  embedding USER-DEFINED,
  CONSTRAINT documents_pkey PRIMARY KEY (id)
);
CREATE TABLE public.entity_types (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  entity_name character varying NOT NULL UNIQUE,
  CONSTRAINT entity_types_pkey PRIMARY KEY (id)
);
CREATE TABLE public.feedback_analytics_access (
  user_id uuid NOT NULL,
  granted_at timestamp with time zone NOT NULL DEFAULT now(),
  granted_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT feedback_analytics_access_pkey PRIMARY KEY (user_id),
  CONSTRAINT feedback_analytics_access_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES auth.users(id),
  CONSTRAINT feedback_analytics_access_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.loadings (
  loading_id uuid NOT NULL DEFAULT gen_random_uuid(),
  loading_responsible uuid,
  loading_section uuid,
  loading_start date NOT NULL CHECK (loading_start::text ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'::text),
  loading_finish date NOT NULL CHECK (loading_finish::text ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'::text),
  loading_rate numeric,
  loading_created timestamp with time zone DEFAULT now(),
  loading_updated timestamp with time zone DEFAULT now(),
  loading_task uuid,
  loading_status USER-DEFINED NOT NULL DEFAULT 'active'::loading_status_type,
  is_shortage boolean NOT NULL DEFAULT false,
  shortage_department_id uuid,
  shortage_team_id uuid,
  shortage_description text,
  loading_comment text,
  loading_stage uuid NOT NULL,
  CONSTRAINT loadings_pkey PRIMARY KEY (loading_id),
  CONSTRAINT loadings_shortage_department_id_fkey FOREIGN KEY (shortage_department_id) REFERENCES public.departments(department_id),
  CONSTRAINT loadings_shortage_team_id_fkey FOREIGN KEY (shortage_team_id) REFERENCES public.teams(team_id),
  CONSTRAINT loadings_loading_task_fkey FOREIGN KEY (loading_task) REFERENCES public.tasks(task_id),
  CONSTRAINT loadings_loading_stage_fkey FOREIGN KEY (loading_stage) REFERENCES public.decomposition_stages(decomposition_stage_id),
  CONSTRAINT loadings_loading_responsible_fkey FOREIGN KEY (loading_responsible) REFERENCES public.profiles(user_id),
  CONSTRAINT loadings_loading_section_fk FOREIGN KEY (loading_section) REFERENCES public.sections(section_id)
);
CREATE TABLE public.loadings_orphans_backup (
  loading_id uuid,
  loading_responsible uuid,
  loading_section uuid,
  loading_start date,
  loading_finish date,
  loading_rate numeric,
  loading_created timestamp with time zone,
  loading_updated timestamp with time zone,
  loading_task uuid,
  loading_status USER-DEFINED,
  is_shortage boolean,
  shortage_department_id uuid,
  shortage_team_id uuid,
  shortage_description text,
  loading_comment text,
  loading_stage uuid
);
CREATE TABLE public.migrations (
  id integer NOT NULL DEFAULT nextval('migrations_id_seq'::regclass),
  name text NOT NULL UNIQUE,
  applied_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT migrations_pkey PRIMARY KEY (id)
);
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  entity_type_id uuid NOT NULL,
  payload jsonb NOT NULL,
  rendered_text text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  source_comment_id uuid,
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_entity_type_id_fkey FOREIGN KEY (entity_type_id) REFERENCES public.entity_types(id)
);
CREATE TABLE public.notions (
  notion_id uuid NOT NULL DEFAULT gen_random_uuid(),
  notion_created_by uuid NOT NULL,
  notion_created_at timestamp with time zone NOT NULL DEFAULT now(),
  notion_updated_at timestamp with time zone NOT NULL DEFAULT now(),
  notion_content text NOT NULL,
  notion_done boolean NOT NULL DEFAULT false,
  CONSTRAINT notions_pkey PRIMARY KEY (notion_id),
  CONSTRAINT notions_notion_created_by_fkey FOREIGN KEY (notion_created_by) REFERENCES public.profiles(user_id)
);
CREATE TABLE public.objects (
  object_id uuid NOT NULL DEFAULT gen_random_uuid(),
  object_name text NOT NULL,
  object_description text,
  object_stage_id uuid,
  object_responsible uuid,
  object_start_date timestamp with time zone,
  object_end_date timestamp with time zone,
  object_created timestamp with time zone DEFAULT now(),
  object_updated timestamp with time zone DEFAULT now(),
  object_project_id uuid,
  external_id text,
  external_source text DEFAULT 'worksection'::text,
  external_updated_at timestamp with time zone,
  CONSTRAINT objects_pkey PRIMARY KEY (object_id),
  CONSTRAINT objects_object_stage_id_fkey FOREIGN KEY (object_stage_id) REFERENCES public.stages(stage_id),
  CONSTRAINT objects_object_project_id_fkey FOREIGN KEY (object_project_id) REFERENCES public.projects(project_id),
  CONSTRAINT objects_object_responsible_fkey FOREIGN KEY (object_responsible) REFERENCES public.profiles(user_id)
);
CREATE TABLE public.permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT permissions_pkey PRIMARY KEY (id)
);
CREATE TABLE public.plan_loadings (
  plan_loading_id uuid NOT NULL DEFAULT gen_random_uuid(),
  plan_loading_section uuid,
  plan_loading_start date NOT NULL CHECK (plan_loading_start::text ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'::text),
  plan_loading_finish date NOT NULL CHECK (plan_loading_finish::text ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'::text),
  plan_loading_rate numeric NOT NULL,
  plan_loading_created timestamp with time zone DEFAULT now(),
  plan_loading_updated timestamp with time zone DEFAULT now(),
  plan_loading_created_by uuid,
  plan_loading_description text,
  plan_loading_status character varying DEFAULT 'active'::character varying,
  plan_loading_stage uuid,
  plan_loading_category uuid,
  CONSTRAINT plan_loadings_pkey PRIMARY KEY (plan_loading_id),
  CONSTRAINT plan_loadings_plan_loading_section_fkey FOREIGN KEY (plan_loading_section) REFERENCES public.sections(section_id),
  CONSTRAINT plan_loadings_plan_loading_created_by_fkey FOREIGN KEY (plan_loading_created_by) REFERENCES auth.users(id),
  CONSTRAINT plan_loadings_plan_loading_stage_fkey FOREIGN KEY (plan_loading_stage) REFERENCES public.decomposition_stages(decomposition_stage_id),
  CONSTRAINT plan_loadings_plan_loading_category_fkey FOREIGN KEY (plan_loading_category) REFERENCES public.categories(category_id)
);
CREATE TABLE public.positions (
  ws_position_id integer,
  position_name text UNIQUE,
  position_id uuid NOT NULL,
  CONSTRAINT positions_pkey PRIMARY KEY (position_id)
);
CREATE TABLE public.profiles (
  user_id uuid NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  department_id uuid,
  team_id uuid NOT NULL,
  position_id uuid NOT NULL,
  email text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  category_id uuid NOT NULL,
  work_format USER-DEFINED,
  employment_rate numeric DEFAULT 1,
  salary numeric DEFAULT 0,
  is_hourly boolean DEFAULT true,
  avatar_url text,
  city_id uuid,
  subdivision_id uuid,
  is_service boolean NOT NULL DEFAULT false,
  CONSTRAINT profiles_pkey PRIMARY KEY (user_id),
  CONSTRAINT profiles_department_membership_fkey FOREIGN KEY (department_id) REFERENCES public.departments(department_id),
  CONSTRAINT profiles_team_membership_fkey FOREIGN KEY (team_id) REFERENCES public.teams(team_id),
  CONSTRAINT profiles_position_id_fkey FOREIGN KEY (position_id) REFERENCES public.positions(position_id),
  CONSTRAINT profiles_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(category_id),
  CONSTRAINT profiles_city_id_fkey FOREIGN KEY (city_id) REFERENCES public.cities(id),
  CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT profiles_subdivision_id_fkey FOREIGN KEY (subdivision_id) REFERENCES public.subdivisions(subdivision_id)
);
CREATE TABLE public.project_deletion_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  project_name text NOT NULL,
  deleted_by uuid,
  deleted_at timestamp with time zone DEFAULT now(),
  deletion_stats jsonb NOT NULL,
  success boolean NOT NULL,
  error_message text,
  deleted_counts jsonb,
  CONSTRAINT project_deletion_log_pkey PRIMARY KEY (id)
);
CREATE TABLE public.project_tag_links (
  project_id uuid NOT NULL,
  tag_id uuid NOT NULL,
  assigned_at timestamp with time zone DEFAULT now(),
  CONSTRAINT project_tag_links_pkey PRIMARY KEY (project_id, tag_id),
  CONSTRAINT project_tag_links_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(project_id),
  CONSTRAINT project_tag_links_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.project_tags(tag_id)
);
CREATE TABLE public.project_tags (
  tag_id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  color text DEFAULT '#9CA3AF'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT project_tags_pkey PRIMARY KEY (tag_id)
);
CREATE TABLE public.projects (
  project_id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_name text NOT NULL,
  project_description text,
  project_manager uuid,
  project_lead_engineer uuid,
  project_status USER-DEFINED DEFAULT 'active'::project_status_enum,
  project_created timestamp with time zone DEFAULT now(),
  project_updated timestamp with time zone DEFAULT now(),
  client_id uuid,
  external_id text,
  external_source text DEFAULT 'worksection'::text,
  external_updated_at timestamp without time zone,
  CONSTRAINT projects_pkey PRIMARY KEY (project_id),
  CONSTRAINT projects_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(client_id),
  CONSTRAINT projects_project_lead_engineer_fkey FOREIGN KEY (project_lead_engineer) REFERENCES public.profiles(user_id),
  CONSTRAINT projects_project_manager_fkey FOREIGN KEY (project_manager) REFERENCES public.profiles(user_id)
);
CREATE TABLE public.role_permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL,
  permission_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT role_permissions_pkey PRIMARY KEY (id),
  CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id),
  CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(id)
);
CREATE TABLE public.roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT roles_pkey PRIMARY KEY (id)
);
CREATE TABLE public.section_comments (
  comment_id uuid NOT NULL DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL,
  author_id uuid NOT NULL,
  content text NOT NULL,
  mentions ARRAY DEFAULT '{}'::uuid[],
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT section_comments_pkey PRIMARY KEY (comment_id),
  CONSTRAINT section_comments_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.sections(section_id),
  CONSTRAINT section_comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(user_id)
);
CREATE TABLE public.section_statuses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  color character varying NOT NULL,
  description text,
  CONSTRAINT section_statuses_pkey PRIMARY KEY (id)
);
CREATE TABLE public.sections (
  section_id uuid NOT NULL DEFAULT gen_random_uuid(),
  section_name text NOT NULL,
  section_description text,
  section_responsible uuid,
  section_project_id uuid NOT NULL,
  section_created timestamp with time zone DEFAULT now(),
  section_updated timestamp with time zone DEFAULT now(),
  section_object_id uuid NOT NULL,
  section_type text,
  section_start_date timestamp with time zone,
  section_end_date timestamp with time zone,
  external_id text,
  external_source text DEFAULT 'worksection'::text,
  external_updated_at timestamp without time zone,
  section_status_id uuid,
  last_responsible_updated timestamp with time zone,
  last_status_updated timestamp with time zone,
  CONSTRAINT sections_pkey PRIMARY KEY (section_id),
  CONSTRAINT sections_section_object_id_fkey FOREIGN KEY (section_object_id) REFERENCES public.objects(object_id),
  CONSTRAINT sections_section_project_id_fkey FOREIGN KEY (section_project_id) REFERENCES public.projects(project_id),
  CONSTRAINT sections_section_statuses_id_fkey FOREIGN KEY (section_status_id) REFERENCES public.section_statuses(id),
  CONSTRAINT sections_section_responsible_fkey FOREIGN KEY (section_responsible) REFERENCES public.profiles(user_id)
);
CREATE TABLE public.sections_backup_20250829 (
  section_id uuid,
  section_name text,
  section_description text,
  section_responsible uuid,
  section_project_id uuid,
  section_created timestamp with time zone,
  section_updated timestamp with time zone,
  section_object_id uuid,
  section_type text,
  section_start_date timestamp with time zone,
  section_end_date timestamp with time zone,
  external_id text,
  external_source text,
  external_updated_at timestamp without time zone,
  section_status_id uuid,
  last_responsible_updated timestamp with time zone,
  last_status_updated timestamp with time zone
);
CREATE TABLE public.stages (
  stage_id uuid NOT NULL DEFAULT gen_random_uuid(),
  stage_name text NOT NULL,
  stage_description text,
  stage_project_id uuid,
  stage_created timestamp with time zone DEFAULT now(),
  stage_updated timestamp with time zone DEFAULT now(),
  external_id text,
  external_source text DEFAULT 'worksection'::text,
  external_updated_at timestamp without time zone,
  CONSTRAINT stages_pkey PRIMARY KEY (stage_id),
  CONSTRAINT stages_stage_project_id_fkey FOREIGN KEY (stage_project_id) REFERENCES public.projects(project_id)
);
CREATE TABLE public.subdivisions (
  subdivision_id uuid NOT NULL DEFAULT gen_random_uuid(),
  subdivision_name text NOT NULL UNIQUE,
  subdivision_head_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT subdivisions_pkey PRIMARY KEY (subdivision_id),
  CONSTRAINT subdivisions_subdivision_head_id_fkey FOREIGN KEY (subdivision_head_id) REFERENCES public.profiles(user_id)
);
CREATE TABLE public.tasks (
  task_id uuid NOT NULL DEFAULT gen_random_uuid(),
  task_name text NOT NULL,
  task_description text,
  task_responsible uuid,
  task_parent_section uuid NOT NULL,
  task_created timestamp with time zone DEFAULT now(),
  task_updated timestamp with time zone DEFAULT now(),
  task_completed timestamp with time zone,
  task_type text,
  task_start_date timestamp with time zone,
  task_end_date timestamp with time zone,
  task_status text DEFAULT 'active'::text,
  external_id text,
  external_source text DEFAULT 'worksection'::text,
  external_updated_at timestamp without time zone,
  CONSTRAINT tasks_pkey PRIMARY KEY (task_id),
  CONSTRAINT tasks_task_parent_section_fkey FOREIGN KEY (task_parent_section) REFERENCES public.sections(section_id),
  CONSTRAINT tasks_task_responsible_fkey FOREIGN KEY (task_responsible) REFERENCES public.profiles(user_id)
);
CREATE TABLE public.teams (
  ws_team_id integer,
  team_name text,
  team_id uuid NOT NULL DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL,
  team_lead_id uuid,
  CONSTRAINT teams_pkey PRIMARY KEY (team_id),
  CONSTRAINT teams_team_lead_id_fkey FOREIGN KEY (team_lead_id) REFERENCES public.profiles(user_id),
  CONSTRAINT teams_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(department_id)
);
CREATE TABLE public.teams_activity (
  activity_id uuid NOT NULL DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL,
  confirmed_by uuid NOT NULL,
  confirmed_at timestamp with time zone NOT NULL DEFAULT now(),
  activity_type text NOT NULL DEFAULT 'data_confirmed'::text,
  CONSTRAINT teams_activity_pkey PRIMARY KEY (activity_id),
  CONSTRAINT fk_team FOREIGN KEY (team_id) REFERENCES public.teams(team_id),
  CONSTRAINT fk_confirmed_by FOREIGN KEY (confirmed_by) REFERENCES public.profiles(user_id)
);
CREATE TABLE public.user_favorite_projects (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_favorite_projects_pkey PRIMARY KEY (id),
  CONSTRAINT user_favorite_projects_user_fk FOREIGN KEY (user_id) REFERENCES public.profiles(user_id),
  CONSTRAINT user_favorite_projects_project_fk FOREIGN KEY (project_id) REFERENCES public.projects(project_id)
);
CREATE TABLE public.user_feedback (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  first_name text NOT NULL,
  last_name text NOT NULL,
  show_count integer NOT NULL DEFAULT 0 CHECK (show_count >= 0),
  completed boolean NOT NULL DEFAULT false,
  score smallint CHECK (score >= 1 AND score <= 10),
  had_problems boolean,
  problem_text text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  next_survey_at timestamp with time zone,
  answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  CONSTRAINT user_feedback_pkey PRIMARY KEY (id)
);
CREATE TABLE public.user_notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL,
  user_id uuid NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  is_archived boolean DEFAULT false,
  CONSTRAINT user_notifications_pkey PRIMARY KEY (id),
  CONSTRAINT user_notifications_notification_id_fkey FOREIGN KEY (notification_id) REFERENCES public.notifications(id),
  CONSTRAINT user_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id)
);
CREATE TABLE public.user_permissions_cache (
  user_id uuid NOT NULL,
  permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_permissions_cache_pkey PRIMARY KEY (user_id),
  CONSTRAINT user_permissions_cache_user_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id)
);
CREATE TABLE public.user_reports (
  user_report_id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_report_short_description text NOT NULL,
  user_report_detailed_description text,
  user_report_created_by uuid,
  user_report_created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT user_reports_pkey PRIMARY KEY (user_report_id),
  CONSTRAINT user_reports_user_report_created_by_fkey FOREIGN KEY (user_report_created_by) REFERENCES public.profiles(user_id)
);
CREATE TABLE public.user_roles (
  user_id uuid NOT NULL,
  role_id uuid NOT NULL,
  id uuid DEFAULT gen_random_uuid(),
  assigned_at timestamp with time zone DEFAULT now(),
  assigned_by uuid,
  CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role_id),
  CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id),
  CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id),
  CONSTRAINT user_roles_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.profiles(user_id)
);
CREATE TABLE public.work_categories (
  work_category_id uuid NOT NULL DEFAULT gen_random_uuid(),
  work_category_name text NOT NULL UNIQUE,
  work_category_created_at timestamp with time zone NOT NULL DEFAULT now(),
  work_category_updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT work_categories_pkey PRIMARY KEY (work_category_id)
);
CREATE TABLE public.work_logs (
  work_log_id uuid NOT NULL DEFAULT gen_random_uuid(),
  decomposition_item_id uuid NOT NULL,
  work_log_description text NOT NULL,
  work_log_created_by uuid,
  work_log_created_at timestamp with time zone NOT NULL DEFAULT now(),
  work_log_date date NOT NULL DEFAULT CURRENT_DATE,
  work_log_hours numeric NOT NULL CHECK (work_log_hours > 0::numeric),
  work_log_hourly_rate numeric NOT NULL CHECK (work_log_hourly_rate >= 0::numeric),
  work_log_amount numeric DEFAULT (work_log_hours * work_log_hourly_rate),
  CONSTRAINT work_logs_pkey PRIMARY KEY (work_log_id),
  CONSTRAINT work_logs_decomposition_item_id_fkey FOREIGN KEY (decomposition_item_id) REFERENCES public.decomposition_items(decomposition_item_id),
  CONSTRAINT work_logs_work_log_created_by_fkey FOREIGN KEY (work_log_created_by) REFERENCES public.profiles(user_id)
);
CREATE TABLE public.work_schedules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  is_working_day boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT work_schedules_pkey PRIMARY KEY (id),
  CONSTRAINT work_schedules_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id)
);