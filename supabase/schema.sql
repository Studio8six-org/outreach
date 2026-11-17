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

-- Website analytics: one row per thing a visitor does on the studio8six site (a page view, an enquiry sent,
-- a free audit asked for, a click on "Book a call"). No names, emails, IP addresses or cookies are stored.
-- session_id is a random label made in the visitor's browser tab; it is gone when the tab closes.
create table if not exists analytics_events (
  id            bigint generated always as identity primary key,
  created_at    timestamptz not null default now(),
  kind          text not null check (kind in ('pageview','enquiry','audit','booking')),
  session_id    text not null,
  page          text not null default '/',
  source        text not null default 'direct',
  medium        text not null default 'none',
  campaign      text not null default '',
  referrer_host text not null default '',
  device        text not null default 'unknown',
  country       text not null default ''
);
create index if not exists analytics_events_time_idx on analytics_events (created_at desc);
create index if not exists analytics_events_kind_time_idx on analytics_events (kind, created_at desc);

alter table analytics_events enable row level security;
