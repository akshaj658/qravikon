-- Preserve each existing project's message history as its initial conversation.
begin;

create table public.copilot_conversations (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New conversation' check (length(title) between 1 and 120),
  last_message_preview text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, project_id, user_id)
);

create index idx_copilot_conversations_project_updated
  on public.copilot_conversations(project_id, updated_at desc);
create index idx_copilot_conversations_user_project
  on public.copilot_conversations(user_id, project_id);

alter table public.copilot_conversations enable row level security;

create policy "Users can view own Copilot conversations"
  on public.copilot_conversations for select
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.projects p
      where p.id = copilot_conversations.project_id
        and p.user_id = auth.uid()
    )
  );

create policy "Users can create own Copilot conversations"
  on public.copilot_conversations for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.projects p
      where p.id = copilot_conversations.project_id
        and p.user_id = auth.uid()
    )
  );

create policy "Users can update own Copilot conversations"
  on public.copilot_conversations for update
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.projects p
      where p.id = copilot_conversations.project_id
        and p.user_id = auth.uid()
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.projects p
      where p.id = copilot_conversations.project_id
        and p.user_id = auth.uid()
    )
  );

create policy "Users can delete own Copilot conversations"
  on public.copilot_conversations for delete
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.projects p
      where p.id = copilot_conversations.project_id
        and p.user_id = auth.uid()
    )
  );

alter table public.messages
  add column conversation_id uuid;

with message_groups as (
  select
    project_id,
    user_id,
    min(created_at) as first_message_at,
    (array_agg(content order by created_at asc, id asc)
      filter (where role = 'user'))[1] as first_user_message,
    (array_agg(content order by created_at desc, id desc))[1] as latest_message
  from public.messages
  group by project_id, user_id
)
insert into public.copilot_conversations (
  project_id,
  user_id,
  title,
  last_message_preview,
  created_at,
  updated_at
)
select
  mg.project_id,
  mg.user_id,
  case
    when nullif(btrim(regexp_replace(btrim(mg.first_user_message), '\s+', ' ', 'g')), '') is null
      then 'Imported conversation'
    when length(regexp_replace(btrim(mg.first_user_message), '\s+', ' ', 'g')) > 120
      then left(regexp_replace(btrim(mg.first_user_message), '\s+', ' ', 'g'), 117) || '…'
    else regexp_replace(btrim(mg.first_user_message), '\s+', ' ', 'g')
  end,
  left(regexp_replace(btrim(mg.latest_message), '\s+', ' ', 'g'), 160),
  mg.first_message_at,
  coalesce(max(m.created_at), mg.first_message_at)
from message_groups mg
join public.messages m
  on m.project_id = mg.project_id
  and m.user_id = mg.user_id
group by mg.project_id, mg.user_id, mg.first_message_at, mg.first_user_message, mg.latest_message;

update public.messages m
set conversation_id = c.id
from public.copilot_conversations c
where c.project_id = m.project_id
  and c.user_id = m.user_id;

alter table public.messages
  alter column conversation_id set not null,
  add constraint messages_conversation_project_user_fkey
    foreign key (conversation_id, project_id, user_id)
    references public.copilot_conversations(id, project_id, user_id)
    on delete cascade;

create index idx_messages_conversation_created
  on public.messages(conversation_id, created_at, id);

drop policy if exists "Users can view own messages" on public.messages;
drop policy if exists "Users can insert own messages" on public.messages;

create policy "Users can view own conversation messages"
  on public.messages for select
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.copilot_conversations c
      where c.id = messages.conversation_id
        and c.project_id = messages.project_id
        and c.user_id = auth.uid()
    )
  );

create policy "Users can insert own conversation messages"
  on public.messages for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.copilot_conversations c
      where c.id = messages.conversation_id
        and c.project_id = messages.project_id
        and c.user_id = auth.uid()
    )
  );

commit;
