-- Outbound notification log.
--
-- Every transactional email is recorded, sent or not, so the owner can see what
-- a customer was told and spot a provider outage without reading server logs.

create table if not exists notifications (
  id text primary key,
  to_email text not null,
  template text not null,
  subject text not null,
  status text not null default 'queued',
  transport text not null default 'log',
  error text,
  user_id text references users(id) on delete set null,
  order_id text references orders(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists notifications_created_idx on notifications (created_at);
create index if not exists notifications_to_idx on notifications (to_email);
