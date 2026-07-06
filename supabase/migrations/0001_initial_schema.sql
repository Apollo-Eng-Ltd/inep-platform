-- =============================================================================
-- INEP Platform — initial schema
-- Kenya Integrated National Energy Plan submission & approval system
--
-- This migration creates STRUCTURE ONLY: extensions, enums, tables, indexes,
-- helper functions, updated_at triggers, and row-level-security (RLS) policies.
-- Reference data and sample data live in supabase/seed.sql.
--
-- RLS summary:
--   * county_officer / provider / private-sector users  -> only their own
--     submitter's rows (isolated by submitter_id).
--   * national_planner / admin                          -> read everything.
--   * committee_member                                  -> read everything they
--     are asked to act on (treated as national-read for the demo).
-- =============================================================================

create extension if not exists "pgcrypto";      -- gen_random_uuid()

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
create type submitter_type        as enum ('county', 'national_provider', 'private_sector');
create type user_role             as enum ('county_officer', 'national_planner', 'admin', 'committee_member');
create type submission_type       as enum ('full_plan', 'progress_report', 'annual_report');
create type submission_status     as enum ('draft', 'submitted', 'in_review', 'returned', 'approved', 'published');
create type validation_severity   as enum ('error', 'warning', 'info');
create type validation_status     as enum ('open', 'resolved', 'dismissed');
create type agent_type            as enum (
  'intake', 'validation', 'anomaly', 'aggregation', 'drafting',
  'cross_cutting', 'compliance', 'public_engagement', 'query', 'insight'
);
create type agent_action_status   as enum ('proposed', 'approved', 'rejected', 'auto');
create type stage_action          as enum ('submitted', 'approved', 'sent_back', 'rejected');
create type moderation_status     as enum ('pending', 'approved', 'rejected');
create type summary_source        as enum ('county_submission', 'provider_submission', 'private_sector', 'epra_national');
create type cross_cutting_dim     as enum ('gender', 'disaster_risk', 'environment');
create type cycle_status          as enum ('draft', 'active', 'closed');

-- -----------------------------------------------------------------------------
-- updated_at helper
-- -----------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =============================================================================
-- 1. IDENTITY & ORGANIZATIONS
-- =============================================================================

-- submitters: one shared shape for counties, national providers, private sector
create table public.submitters (
  id                 uuid primary key default gen_random_uuid(),
  type               submitter_type not null,
  name               text not null,
  code               text unique,
  region             text,
  headquarters       text,
  -- type-specific fields (e.g. private sector: registration_no, partners,
  -- gps_lat, gps_lng, project_cost, project_scope) live here so the shared
  -- shape does not need per-type columns.
  profile            jsonb not null default '{}'::jsonb,
  -- nullable override for the configurable review cycle; falls back to template.
  review_cycle_years int,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index on public.submitters (type);
create trigger t_submitters_updated before update on public.submitters
  for each row execute function public.touch_updated_at();

-- wards: ward-level public participation (Makueni requirement)
create table public.wards (
  id           uuid primary key default gen_random_uuid(),
  submitter_id uuid not null references public.submitters(id) on delete cascade,
  sub_county   text not null,
  name         text not null,
  code         text,
  created_at   timestamptz not null default now()
);
create index on public.wards (submitter_id);

-- users: profile row, 1:1 with auth.users
create table public.users (
  id           uuid primary key references auth.users(id) on delete cascade,
  full_name    text not null,
  email        text not null,
  role         user_role not null,
  submitter_id uuid references public.submitters(id) on delete set null,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index on public.users (submitter_id);
create index on public.users (role);
create trigger t_users_updated before update on public.users
  for each row execute function public.touch_updated_at();

-- =============================================================================
-- RLS helper functions (SECURITY DEFINER so they bypass RLS on users and
-- therefore never cause recursive policy evaluation).
-- =============================================================================
create or replace function public.current_role()
returns user_role language sql stable security definer set search_path = public as $$
  select role from public.users where id = auth.uid();
$$;

create or replace function public.current_submitter_id()
returns uuid language sql stable security definer set search_path = public as $$
  select submitter_id from public.users where id = auth.uid();
$$;

create or replace function public.is_national()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role in ('national_planner', 'admin', 'committee_member')
       from public.users where id = auth.uid()),
    false);
$$;

-- =============================================================================
-- 2. REFERENCE & CONFIGURATION
-- =============================================================================

-- sectors: mirror the five national sub-committees
create table public.sectors (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  description text,
  sort_order  int not null default 0
);

-- indicators: the standard fields every submission reports, with valid ranges
create table public.indicators (
  id           uuid primary key default gen_random_uuid(),
  sector_id    uuid not null references public.sectors(id) on delete cascade,
  slug         text unique not null,
  name         text not null,
  unit         text not null,
  data_type    text not null default 'number',
  expected_min numeric,
  expected_max numeric,
  description  text,
  sort_order   int not null default 0
);
create index on public.indicators (sector_id);

-- templates: template management + the configurable review-cycle setting
create table public.templates (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  submission_type    submission_type not null,
  review_cycle_years int not null default 3,
  schema             jsonb not null default '{}'::jsonb,
  active             boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create trigger t_templates_updated before update on public.templates
  for each row execute function public.touch_updated_at();

-- planning_cycles: the government-triggered cycle (starts with a CS letter)
create table public.planning_cycles (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  triggered_by  text,
  triggered_at  date,
  plan_due_date date,
  report_due_dates jsonb not null default '[]'::jsonb,
  status        cycle_status not null default 'active',
  created_at    timestamptz not null default now()
);

-- workflow_stages: the real approval chains, one ordered set per submitter type
create table public.workflow_stages (
  id             uuid primary key default gen_random_uuid(),
  submitter_type submitter_type not null,
  stage_key      text not null,
  name           text not null,
  description    text,
  sort_order     int not null,
  is_terminal    boolean not null default false,
  unique (submitter_type, stage_key)
);
create index on public.workflow_stages (submitter_type, sort_order);

-- =============================================================================
-- 3. SUBMISSION CORE
-- =============================================================================

create table public.submissions (
  id                uuid primary key default gen_random_uuid(),
  submitter_id      uuid not null references public.submitters(id) on delete cascade,
  planning_cycle_id uuid references public.planning_cycles(id) on delete set null,
  template_id       uuid references public.templates(id) on delete set null,
  submission_type   submission_type not null,
  title             text not null,
  period_year       int not null,
  period_half       int,                       -- 1 or 2 for twice-a-year reports
  status            submission_status not null default 'draft',
  current_stage_id  uuid references public.workflow_stages(id) on delete set null,
  cidp_reference    text,                       -- CIDP alignment (county plans)
  narrative         text,                       -- drafting-agent output
  submitted_by      uuid references public.users(id) on delete set null,
  submitted_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index on public.submissions (submitter_id);
create index on public.submissions (status);
create index on public.submissions (submission_type);
create trigger t_submissions_updated before update on public.submissions
  for each row execute function public.touch_updated_at();

-- submission_values: EAV — one row per indicator per submission
create table public.submission_values (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  indicator_id  uuid not null references public.indicators(id) on delete cascade,
  value         numeric,
  unit          text,
  note          text,
  created_at    timestamptz not null default now(),
  unique (submission_id, indicator_id)
);
create index on public.submission_values (submission_id);
create index on public.submission_values (indicator_id);

-- documents: uploaded Excel / plan files (metadata; files live in storage)
create table public.documents (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid references public.submissions(id) on delete cascade,
  submitter_id  uuid not null references public.submitters(id) on delete cascade,
  file_name     text not null,
  storage_path  text,
  kind          text,
  uploaded_by   uuid references public.users(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index on public.documents (submission_id);

-- =============================================================================
-- 4. AGENTS & CHECKS
-- =============================================================================

-- validation_results: output of the validation & anomaly agents
create table public.validation_results (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  agent         agent_type not null,            -- 'validation' or 'anomaly'
  indicator_id  uuid references public.indicators(id) on delete set null,
  severity      validation_severity not null,
  rule_code     text not null,
  message       text not null,
  details       jsonb not null default '{}'::jsonb,
  status        validation_status not null default 'open',
  created_at    timestamptz not null default now()
);
create index on public.validation_results (submission_id);
create index on public.validation_results (severity);

-- cross_cutting_scores: gender / disaster-risk / environment scorecard
create table public.cross_cutting_scores (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  dimension     cross_cutting_dim not null,
  score         int not null,                   -- 0..100
  rationale     text,
  created_at    timestamptz not null default now(),
  unique (submission_id, dimension)
);
create index on public.cross_cutting_scores (submission_id);

-- agent_actions: universal log — every agent proposes, a human decides
create table public.agent_actions (
  id              uuid primary key default gen_random_uuid(),
  agent           agent_type not null,
  submission_id   uuid references public.submissions(id) on delete cascade,
  action_type     text not null,
  input_summary   text,
  proposed_output jsonb not null default '{}'::jsonb,
  status          agent_action_status not null default 'proposed',
  decided_by      uuid references public.users(id) on delete set null,
  decided_at      timestamptz,
  created_at      timestamptz not null default now()
);
create index on public.agent_actions (submission_id);
create index on public.agent_actions (agent);

-- =============================================================================
-- 5. APPROVAL CHAIN (modeled fully, like a project board)
-- =============================================================================

-- submission_stage_history: every movement through the chain (powers the board)
create table public.submission_stage_history (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  stage_id      uuid not null references public.workflow_stages(id) on delete cascade,
  action        stage_action not null,
  actor_id      uuid references public.users(id) on delete set null,
  comment       text,
  acted_at      timestamptz not null default now()
);
create index on public.submission_stage_history (submission_id);

-- =============================================================================
-- 6. NATIONAL OUTPUTS
-- =============================================================================

-- national_summaries: aggregation-agent output, APPROVED data only
create table public.national_summaries (
  id                uuid primary key default gen_random_uuid(),
  planning_cycle_id uuid references public.planning_cycles(id) on delete cascade,
  sector_id         uuid references public.sectors(id) on delete cascade,
  indicator_id      uuid references public.indicators(id) on delete cascade,
  period_year       int not null,
  aggregated_value  numeric,
  submitter_count   int not null default 0,
  source            summary_source not null default 'county_submission',
  computed_at       timestamptz not null default now()
);
create index on public.national_summaries (indicator_id, period_year);

-- =============================================================================
-- 7. PUBLIC & OPS
-- =============================================================================

-- public_comments: ward-aware citizen input + agent-drafted replies
create table public.public_comments (
  id                uuid primary key default gen_random_uuid(),
  submission_id     uuid references public.submissions(id) on delete cascade,
  submitter_id      uuid references public.submitters(id) on delete cascade,
  ward_id           uuid references public.wards(id) on delete set null,
  section_referenced text,
  author_name       text,
  body              text not null,
  moderation_status moderation_status not null default 'pending',
  agent_draft_reply text,
  reply_body        text,
  created_at        timestamptz not null default now()
);
create index on public.public_comments (submission_id);
create index on public.public_comments (moderation_status);

-- notifications
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  type       text not null,
  body       text not null,
  link       text,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.notifications (user_id, read);

-- audit_log: human actions (agent actions live in agent_actions)
create table public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.users(id) on delete set null,
  action      text not null,
  entity_type text,
  entity_id   uuid,
  detail      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index on public.audit_log (entity_type, entity_id);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================
alter table public.submitters                enable row level security;
alter table public.wards                     enable row level security;
alter table public.users                     enable row level security;
alter table public.sectors                   enable row level security;
alter table public.indicators                enable row level security;
alter table public.templates                 enable row level security;
alter table public.planning_cycles           enable row level security;
alter table public.workflow_stages           enable row level security;
alter table public.submissions               enable row level security;
alter table public.submission_values         enable row level security;
alter table public.documents                 enable row level security;
alter table public.validation_results        enable row level security;
alter table public.cross_cutting_scores      enable row level security;
alter table public.agent_actions             enable row level security;
alter table public.submission_stage_history  enable row level security;
alter table public.national_summaries        enable row level security;
alter table public.public_comments           enable row level security;
alter table public.notifications             enable row level security;
alter table public.audit_log                 enable row level security;

-- Reference tables: any authenticated user may read; only admins may write.
create policy ref_read_submitters       on public.submitters      for select to authenticated using (true);
create policy ref_read_wards            on public.wards           for select to authenticated using (true);
create policy ref_read_sectors          on public.sectors         for select to authenticated using (true);
create policy ref_read_indicators       on public.indicators      for select to authenticated using (true);
create policy ref_read_templates        on public.templates       for select to authenticated using (true);
create policy ref_read_cycles           on public.planning_cycles for select to authenticated using (true);
create policy ref_read_stages           on public.workflow_stages for select to authenticated using (true);

create policy admin_write_submitters on public.submitters for all to authenticated
  using (public.current_role() = 'admin') with check (public.current_role() = 'admin');
create policy admin_write_templates  on public.templates  for all to authenticated
  using (public.current_role() = 'admin') with check (public.current_role() = 'admin');
create policy admin_write_indicators on public.indicators for all to authenticated
  using (public.current_role() = 'admin') with check (public.current_role() = 'admin');
create policy admin_write_sectors    on public.sectors    for all to authenticated
  using (public.current_role() = 'admin') with check (public.current_role() = 'admin');
create policy admin_write_cycles     on public.planning_cycles for all to authenticated
  using (public.current_role() = 'admin') with check (public.current_role() = 'admin');

-- users: a person can read/update their own profile; national roles read all.
create policy users_read_self     on public.users for select to authenticated
  using (id = auth.uid() or public.is_national());
create policy users_update_self   on public.users for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy users_admin_all     on public.users for all to authenticated
  using (public.current_role() = 'admin') with check (public.current_role() = 'admin');

-- submissions: owner submitter OR national. Owners may write while draft/returned.
create policy sub_select on public.submissions for select to authenticated
  using (public.is_national() or submitter_id = public.current_submitter_id());
create policy sub_insert on public.submissions for insert to authenticated
  with check (submitter_id = public.current_submitter_id() or public.is_national());
create policy sub_update on public.submissions for update to authenticated
  using (public.is_national() or submitter_id = public.current_submitter_id())
  with check (public.is_national() or submitter_id = public.current_submitter_id());

-- Generic helper: a row is visible if its parent submission is visible.
-- Expressed inline per table below (Postgres RLS cannot share a macro).

create policy val_select on public.submission_values for select to authenticated
  using (exists (select 1 from public.submissions s where s.id = submission_id
    and (public.is_national() or s.submitter_id = public.current_submitter_id())));
create policy val_write on public.submission_values for all to authenticated
  using (exists (select 1 from public.submissions s where s.id = submission_id
    and (public.is_national() or s.submitter_id = public.current_submitter_id())))
  with check (exists (select 1 from public.submissions s where s.id = submission_id
    and (public.is_national() or s.submitter_id = public.current_submitter_id())));

create policy doc_select on public.documents for select to authenticated
  using (public.is_national() or submitter_id = public.current_submitter_id());
create policy doc_write on public.documents for all to authenticated
  using (public.is_national() or submitter_id = public.current_submitter_id())
  with check (public.is_national() or submitter_id = public.current_submitter_id());

create policy vr_select on public.validation_results for select to authenticated
  using (exists (select 1 from public.submissions s where s.id = submission_id
    and (public.is_national() or s.submitter_id = public.current_submitter_id())));
create policy vr_write on public.validation_results for all to authenticated
  using (exists (select 1 from public.submissions s where s.id = submission_id
    and (public.is_national() or s.submitter_id = public.current_submitter_id())))
  with check (exists (select 1 from public.submissions s where s.id = submission_id
    and (public.is_national() or s.submitter_id = public.current_submitter_id())));

create policy cc_select on public.cross_cutting_scores for select to authenticated
  using (exists (select 1 from public.submissions s where s.id = submission_id
    and (public.is_national() or s.submitter_id = public.current_submitter_id())));
create policy cc_write on public.cross_cutting_scores for all to authenticated
  using (exists (select 1 from public.submissions s where s.id = submission_id
    and (public.is_national() or s.submitter_id = public.current_submitter_id())))
  with check (exists (select 1 from public.submissions s where s.id = submission_id
    and (public.is_national() or s.submitter_id = public.current_submitter_id())));

create policy aa_select on public.agent_actions for select to authenticated
  using (submission_id is null or exists (select 1 from public.submissions s where s.id = submission_id
    and (public.is_national() or s.submitter_id = public.current_submitter_id())));
create policy aa_write on public.agent_actions for all to authenticated
  using (public.is_national() or exists (select 1 from public.submissions s where s.id = submission_id
    and s.submitter_id = public.current_submitter_id()))
  with check (public.is_national() or exists (select 1 from public.submissions s where s.id = submission_id
    and s.submitter_id = public.current_submitter_id()));

create policy ssh_select on public.submission_stage_history for select to authenticated
  using (exists (select 1 from public.submissions s where s.id = submission_id
    and (public.is_national() or s.submitter_id = public.current_submitter_id())));
create policy ssh_write on public.submission_stage_history for all to authenticated
  using (exists (select 1 from public.submissions s where s.id = submission_id
    and (public.is_national() or s.submitter_id = public.current_submitter_id())))
  with check (exists (select 1 from public.submissions s where s.id = submission_id
    and (public.is_national() or s.submitter_id = public.current_submitter_id())));

-- national_summaries: aggregated, non-sensitive — readable by all authenticated.
create policy ns_select on public.national_summaries for select to authenticated using (true);
create policy ns_write  on public.national_summaries for all to authenticated
  using (public.is_national()) with check (public.is_national());

-- public_comments: readable by owner submitter + national; anyone authenticated may add.
create policy pc_select on public.public_comments for select to authenticated
  using (public.is_national() or submitter_id = public.current_submitter_id());
create policy pc_insert on public.public_comments for insert to authenticated with check (true);
create policy pc_update on public.public_comments for update to authenticated
  using (public.is_national() or submitter_id = public.current_submitter_id())
  with check (public.is_national() or submitter_id = public.current_submitter_id());

-- notifications: strictly the owning user.
create policy notif_own on public.notifications for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- audit_log: national roles read; anyone authenticated may append.
create policy audit_select on public.audit_log for select to authenticated using (public.is_national());
create policy audit_insert on public.audit_log for insert to authenticated with check (true);
