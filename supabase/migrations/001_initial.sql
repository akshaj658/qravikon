-- Qravikon Database Migrations
-- Apply with: psql $SUPABASE_URL -f migrations/001_initial.sql
-- Or via Supabase Dashboard > SQL Editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── Profiles ──────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── Projects ──────────────────────────────────────────────────────────────
create table if not exists public.projects (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null check (length(name) between 1 and 100),
  original_idea text not null check (length(original_idea) >= 10),
  idea_summary text,
  assumptions text[] default '{}',
  current_stage integer not null default 0 check (current_stage between 0 and 8),
  overall_status text not null default 'intake'
    check (overall_status in ('intake', 'in_progress', 'complete', 'archived')),
  verdict text check (verdict in ('GO', 'PIVOT', 'DROP')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_projects_user_id on public.projects(user_id);
create index idx_projects_updated_at on public.projects(updated_at desc);

alter table public.projects enable row level security;

create policy "Users can view own projects"
  on public.projects for select
  using (auth.uid() = user_id);

create policy "Users can insert own projects"
  on public.projects for insert
  with check (auth.uid() = user_id);

create policy "Users can update own projects"
  on public.projects for update
  using (auth.uid() = user_id);

create policy "Users can delete own projects"
  on public.projects for delete
  using (auth.uid() = user_id);

-- ─── Workflow Stages ───────────────────────────────────────────────────────
create table if not exists public.workflow_stages (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects on delete cascade,
  stage_key text not null check (stage_key in (
    'idea_clarification', 'viability', 'target_customer', 'market_sizing',
    'competitors', 'differentiation', 'gtm', 'final_report'
  )),
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'approved', 'skipped', 'needs_revision')),
  input_data jsonb default '{}',
  result_data jsonb default '{}',
  approval_notes text,
  approved_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (project_id, stage_key)
);

create index idx_workflow_stages_project_id on public.workflow_stages(project_id);

alter table public.workflow_stages enable row level security;

create policy "Users can view own stages"
  on public.workflow_stages for select
  using (
    exists (
      select 1 from public.projects p
      where p.id = workflow_stages.project_id
        and p.user_id = auth.uid()
    )
  );

create policy "Users can insert own stages"
  on public.workflow_stages for insert
  with check (
    exists (
      select 1 from public.projects p
      where p.id = workflow_stages.project_id
        and p.user_id = auth.uid()
    )
  );

create policy "Users can update own stages"
  on public.workflow_stages for update
  using (
    exists (
      select 1 from public.projects p
      where p.id = workflow_stages.project_id
        and p.user_id = auth.uid()
    )
  );

-- ─── Sources ───────────────────────────────────────────────────────────────
create table if not exists public.sources (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects on delete cascade,
  stage_key text,
  url text not null,
  title text not null,
  evidence_summary text,
  published_date text,
  retrieved_at timestamptz not null default now()
);

create index idx_sources_project_id on public.sources(project_id);

alter table public.sources enable row level security;

create policy "Users can view own sources"
  on public.sources for select
  using (
    exists (
      select 1 from public.projects p
      where p.id = sources.project_id
        and p.user_id = auth.uid()
    )
  );

create policy "Users can insert own sources"
  on public.sources for insert
  with check (
    exists (
      select 1 from public.projects p
      where p.id = sources.project_id
        and p.user_id = auth.uid()
    )
  );

-- ─── Messages (Copilot chat) ───────────────────────────────────────────────
create table if not exists public.messages (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index idx_messages_project_id on public.messages(project_id);
create index idx_messages_created_at on public.messages(created_at);

alter table public.messages enable row level security;

create policy "Users can view own messages"
  on public.messages for select
  using (auth.uid() = user_id);

create policy "Users can insert own messages"
  on public.messages for insert
  with check (auth.uid() = user_id);
