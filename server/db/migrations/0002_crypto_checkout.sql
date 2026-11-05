-- Crypto checkout, developer licences, download tokens and webhook ledger.
--
-- Every statement is idempotent: the runner retries a whole file if it fails
-- part way, so `if not exists` guards are mandatory rather than stylistic.

/* ------------------------------------------------------- licence catalogue */

-- A fourth tier ("developer") joins personal/commercial/extended. The existing
-- CHECK constraints are replaced rather than dropped, so a row can never carry
-- a tier the application does not understand.
do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'licenses_license_check'
  ) then
    alter table licenses drop constraint licenses_license_check;
  end if;
  alter table licenses
    add constraint licenses_license_check
    check (license in ('personal', 'commercial', 'extended', 'developer'));
end $$;

do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'order_items_license_check'
  ) then
    alter table order_items drop constraint order_items_license_check;
  end if;
  alter table order_items
    add constraint order_items_license_check
    check (license in ('personal', 'commercial', 'extended', 'developer'));
end $$;

do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'pricing_tiers_license_check'
  ) then
    alter table pricing_tiers drop constraint pricing_tiers_license_check;
  end if;
  alter table pricing_tiers
    add constraint pricing_tiers_license_check
    check (license in ('personal', 'commercial', 'extended', 'developer'));
end $$;

/* ------------------------------------------------------------ order extras */

-- The reference a customer quotes to support, and the certificate number.
alter table orders add column if not exists reference text;
alter table orders add column if not exists paid_at timestamptz;
alter table orders add column if not exists refunded_at timestamptz;
alter table orders add column if not exists refund_reason text;
alter table orders add column if not exists idempotency_key text;

create unique index if not exists orders_idempotency_key
  on orders (idempotency_key) where idempotency_key is not null;

-- Snapshot of what each line actually cost after discount, so a receipt stays
-- truthful even if the coupon row is later edited or deleted.
alter table order_items add column if not exists discount integer not null default 0;

/* --------------------------------------------------------------- payments */

-- Widen the provider/mode/status vocabularies for crypto gateways. The old
-- constraints would reject 'nowpayments', so replace them wholesale.
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'payments_provider_check') then
    alter table payments drop constraint payments_provider_check;
  end if;
  alter table payments
    add constraint payments_provider_check
    check (provider in ('stripe', 'paypal', 'bank', 'manual', 'nowpayments', 'crypto_manual', 'free'));
end $$;

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'payments_mode_check') then
    alter table payments drop constraint payments_mode_check;
  end if;
  alter table payments
    add constraint payments_mode_check
    check (mode in ('live', 'test', 'demo'));
end $$;

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'payments_status_check') then
    alter table payments drop constraint payments_status_check;
  end if;
  alter table payments
    add constraint payments_status_check
    check (status in ('pending', 'waiting', 'confirming', 'succeeded', 'partially_paid', 'failed', 'expired', 'refunded'));
end $$;

alter table payments add column if not exists provider_ref text;
alter table payments add column if not exists pay_currency text;
alter table payments add column if not exists pay_amount numeric(24, 10);
alter table payments add column if not exists pay_address text;
alter table payments add column if not exists payin_hash text;
alter table payments add column if not exists network text;
alter table payments add column if not exists actually_paid numeric(24, 10);
alter table payments add column if not exists expires_at timestamptz;
alter table payments add column if not exists invoice_url text;
alter table payments add column if not exists raw_status text;
alter table payments add column if not exists updated_at timestamptz not null default now();

create unique index if not exists payments_provider_ref
  on payments (provider, provider_ref) where provider_ref is not null;

/* ------------------------------------------------------ payment attempts */

-- One row per hosted invoice we hand out. Kept separate from `payments` so a
-- single order can be retried in a different coin without muddling history.
create table if not exists payment_sessions (
  id text primary key,
  order_id text not null references orders(id) on delete cascade,
  provider text not null default 'nowpayments',
  mode text not null default 'test',
  pay_currency text not null,
  network text,
  price_amount integer not null,
  price_currency text not null default 'usd',
  pay_amount numeric(24, 10),
  pay_address text,
  invoice_url text,
  provider_ref text,
  purchase_id text,
  status text not null default 'waiting',
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_sessions_order_idx on payment_sessions (order_id);
create unique index if not exists payment_sessions_ref on payment_sessions (provider, provider_ref)
  where provider_ref is not null;

/* ---------------------------------------------------------- webhook ledger */

-- Every inbound hook, verified or not. The unique key on the provider's
-- delivery digest is what makes duplicate deliveries a no-op.
create table if not exists webhook_events (
  id text primary key,
  provider text not null,
  event_key text,
  signature_ok boolean not null default false,
  status text,
  order_number text,
  payment_ref text,
  payload jsonb,
  note text,
  created_at timestamptz not null default now()
);

-- Plain unique index rather than a partial one: Postgres can only infer an
-- arbiter index for ON CONFLICT if it is unconditional. Dropped first because an
-- earlier revision of this file created it as partial.
drop index if exists webhook_events_dedupe;
create unique index if not exists webhook_events_dedupe
  on webhook_events (provider, event_key);
create index if not exists webhook_events_created_idx on webhook_events (created_at);

/* --------------------------------------------------------- download tokens */

-- Signed, single-use-ish, expiring links. The token is stored hashed.
create table if not exists download_tokens (
  id text primary key,
  token_hash text not null,
  user_id text references users(id) on delete cascade,
  product_id text references products(id) on delete cascade,
  file_id text references product_files(id) on delete set null,
  version text,
  expires_at timestamptz not null,
  used_at timestamptz,
  max_uses integer not null default 3,
  uses integer not null default 0,
  ip text,
  created_at timestamptz not null default now()
);

create unique index if not exists download_tokens_hash on download_tokens (token_hash);
create index if not exists download_tokens_user_idx on download_tokens (user_id);

/* ------------------------------------------------------------- promotions */

-- Coupons gain scope: a code can be limited to one product or one category.
alter table coupons add column if not exists product_slug text;
alter table coupons add column if not exists category_slug text;
alter table coupons add column if not exists min_subtotal integer not null default 0;
alter table coupons add column if not exists once_per_customer boolean not null default true;

-- Product-level sale pricing (time bounded), separate from `compare_at` which
-- is presentational.
alter table products add column if not exists sale_price integer;
alter table products add column if not exists sale_ends_at timestamptz;

/* ------------------------------------------------------------------ admin */

-- Provider credentials live in settings, encrypted at rest by the column type
-- choice being plain jsonb but never returned to the browser.
create table if not exists license_terms (
  id text primary key,
  license text not null unique,
  name text not null,
  summary text not null default '',
  terms text not null default '',
  seats text not null default '',
  position integer not null default 0,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

/* -------------------------------------------------------- activity kinds */

-- Payment and download events need their own categories so the admin activity
-- log can filter them without falling back to "settings".
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'activity_log_kind_check') then
    alter table activity_log drop constraint activity_log_kind_check;
  end if;
  alter table activity_log
    add constraint activity_log_kind_check
    check (kind in ('product','order','customer','settings','content','promo','auth','payment','download','refund'));
end $$;

/* --------------------------------------------------- webhook event kinds */

-- Nothing to widen here yet; the table is new. The index below is what makes
-- replayed deliveries a cheap no-op.
create index if not exists webhook_events_order_idx on webhook_events (order_number);
