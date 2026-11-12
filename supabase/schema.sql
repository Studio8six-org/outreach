-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.
-- The app reaches these tables only through the server (direct Postgres link), never from the browser.

create table if not exists leads (
  id               integer generated always as identity primary key,
  business         text not null,
  type             text not null default '',
  website          text not null default '',
  website_key      text not null unique,
  email            text not null default '',
  phone            text not null default '',
  socials          jsonb not null default '{}',
  address          text not null default '',
  city             text not null default '',
  pitch            text not null default '',
  priority         integer not null default 0,
  stage            text check (stage in ('first','followup1','followup2','responded','no_response')),
  selected_by      text,
  selected_at      timestamptz,
  stage_changed_at timestamptz,
  notes            text not null default '',
  created_at       timestamptz not null default now()
);

create table if not exists events (
  id          integer generated always as identity primary key,
  lead_id     integer not null references leads(id) on delete cascade,
  user_email  text not null default '',
  from_stage  text,
  to_stage    text,
  created_at  timestamptz not null default now()
);
create index if not exists events_lead_idx on events (lead_id, id desc);

-- Nobody can read these tables through Supabase's public API. Only the server's own link can.
alter table leads  enable row level security;
alter table events enable row level security;
