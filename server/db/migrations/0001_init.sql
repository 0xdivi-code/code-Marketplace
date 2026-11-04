-- Kiln initial schema. Written to be idempotent so the runner can retry safely.

create table if not exists users (
  id text primary key,
  email text not null,
  password_hash text not null,
  name text not null,
  role text not null default 'customer' check (role in ('customer','admin','owner')),
  status text not null default 'active' check (status in ('active','suspended')),
  email_verified_at timestamptz,
  totp_secret text,
  totp_enabled_at timestamptz,
  recovery_codes jsonb default '[]'::jsonb,
  last_login_at timestamptz,
  country text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists users_email_key on users (lower(email));

create table if not exists sessions (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  token_hash text not null,
  scope text not null default 'customer' check (scope in ('customer','admin')),
  user_agent text,
  ip text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create unique index if not exists sessions_token_key on sessions (token_hash);
create index if not exists sessions_user_idx on sessions (user_id);

create table if not exists auth_tokens (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  kind text not null check (kind in ('verify_email','reset_password','admin_2fa_challenge')),
  token_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists auth_tokens_token_key on auth_tokens (token_hash);
create index if not exists auth_tokens_user_idx on auth_tokens (user_id);

create table if not exists categories (
  id text primary key,
  slug text not null,
  name text not null,
  blurb text not null default '',
  parent_id text,
  "from" text not null default '#17392b',
  "to" text not null default '#3d7a58',
  glyph text not null default 'layers',
  image_path text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists categories_slug_key on categories (slug);
create index if not exists categories_parent_idx on categories (parent_id);

create table if not exists authors (
  id text primary key,
  slug text not null,
  name text not null,
  role text not null default '',
  bio text not null default '',
  verified boolean not null default false,
  avatar text not null default 'KS',
  avatar_path text,
  items integer not null default 0,
  sales integer not null default 0,
  rating integer not null default 0,
  joined text not null default '',
  location text not null default '',
  links jsonb default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create unique index if not exists authors_slug_key on authors (slug);

create table if not exists products (
  id text primary key,
  slug text not null,
  name text not null,
  tagline text not null default '',
  description text not null default '',
  category_id text references categories(id) on delete set null,
  author_id text references authors(id) on delete set null,
  stack jsonb not null default '[]'::jsonb,
  tags jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('published','draft','review','archived')),
  price integer not null default 0,
  compare_at integer,
  free boolean not null default false,
  featured boolean not null default false,
  trending boolean not null default false,
  "new" boolean not null default false,
  bestseller boolean not null default false,
  license text not null default 'Regular',
  rating integer not null default 0,
  reviews integer not null default 0,
  sales integer not null default 0,
  views integer not null default 0,
  version text not null default '1.0.0',
  released text not null default '',
  updated text not null default '',
  art_from text not null default '#17392b',
  art_to text not null default '#3d7a58',
  art_ink text not null default '#eef4e9',
  art_kind text not null default 'window',
  cover_path text,
  gallery jsonb default '[]'::jsonb,
  features jsonb default '[]'::jsonb,
  highlights jsonb default '[]'::jsonb,
  includes jsonb default '[]'::jsonb,
  requirements jsonb default '[]'::jsonb,
  seo_title text,
  seo_description text,
  position integer not null default 0,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists products_slug_key on products (slug);
create index if not exists products_status_idx on products (status);
create index if not exists products_category_idx on products (category_id);

create table if not exists product_versions (
  id text primary key,
  product_id text not null references products(id) on delete cascade,
  version text not null,
  notes jsonb default '[]'::jsonb,
  released_at text not null default '',
  is_current boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index if not exists product_versions_unique on product_versions (product_id, version);
create index if not exists product_versions_product_idx on product_versions (product_id);

create table if not exists product_files (
  id text primary key,
  product_id text not null references products(id) on delete cascade,
  version_id text references product_versions(id) on delete set null,
  kind text not null default 'source_zip' check (kind in ('source_zip','image','document')),
  storage_key text not null,
  original_name text not null,
  mime_type text not null,
  bytes integer not null default 0,
  checksum text not null,
  created_at timestamptz not null default now()
);
create index if not exists product_files_product_idx on product_files (product_id);

create table if not exists pricing_tiers (
  id text primary key,
  product_id text not null references products(id) on delete cascade,
  license text not null check (license in ('personal','commercial','extended')),
  name text not null,
  price integer not null default 0,
  compare_at integer,
  summary text not null default '',
  seats text not null default '',
  includes jsonb default '[]'::jsonb,
  popular boolean not null default false,
  position integer not null default 0
);
create unique index if not exists pricing_tiers_unique on pricing_tiers (product_id, license);

create table if not exists licenses (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  product_id text not null references products(id) on delete cascade,
  license text not null check (license in ('personal','commercial','extended')),
  order_id text,
  status text not null default 'active' check (status in ('active','revoked')),
  granted_by text not null default 'purchase' check (granted_by in ('purchase','manual','free')),
  revoked_at timestamptz,
  revoked_reason text,
  created_at timestamptz not null default now()
);
create unique index if not exists licenses_unique on licenses (user_id, product_id);
create index if not exists licenses_user_idx on licenses (user_id);

create table if not exists orders (
  id text primary key,
  number text not null,
  user_id text references users(id) on delete set null,
  email text not null,
  name text not null default '',
  status text not null default 'pending' check (status in ('pending','paid','refunded','cancelled')),
  subtotal integer not null default 0,
  discount integer not null default 0,
  tax integer not null default 0,
  total integer not null default 0,
  currency text not null default 'USD',
  coupon_code text,
  country text,
  vat_number text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists orders_number_key on orders (number);
create index if not exists orders_user_idx on orders (user_id);

create table if not exists order_items (
  id text primary key,
  order_id text not null references orders(id) on delete cascade,
  product_id text references products(id) on delete set null,
  product_name text not null,
  product_slug text not null,
  license text not null check (license in ('personal','commercial','extended')),
  unit_price integer not null default 0,
  quantity integer not null default 1
);
create index if not exists order_items_order_idx on order_items (order_id);

create table if not exists payments (
  id text primary key,
  order_id text not null references orders(id) on delete cascade,
  provider text not null default 'stripe' check (provider in ('stripe','paypal','bank','manual')),
  mode text not null default 'demo' check (mode in ('live','test','demo')),
  status text not null default 'pending' check (status in ('pending','succeeded','failed','refunded')),
  amount integer not null default 0,
  fee integer not null default 0,
  reference text,
  created_at timestamptz not null default now()
);
create index if not exists payments_order_idx on payments (order_id);

create table if not exists downloads (
  id text primary key,
  user_id text references users(id) on delete set null,
  product_id text references products(id) on delete set null,
  file_id text references product_files(id) on delete set null,
  version text,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists downloads_user_idx on downloads (user_id);
create index if not exists downloads_product_idx on downloads (product_id);

create table if not exists reviews (
  id text primary key,
  product_id text not null references products(id) on delete cascade,
  user_id text references users(id) on delete set null,
  author text not null,
  initials text not null default '',
  rating integer not null default 5,
  title text not null default '',
  body text not null default '',
  helpful integer not null default 0,
  verified boolean not null default false,
  status text not null default 'published' check (status in ('pending','published','rejected')),
  created_at timestamptz not null default now()
);
create index if not exists reviews_product_idx on reviews (product_id);

create table if not exists coupons (
  id text primary key,
  code text not null,
  kind text not null default 'percent' check (kind in ('percent','fixed')),
  value integer not null default 0,
  uses integer not null default 0,
  "limit" integer not null default 100,
  expires_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists coupons_code_key on coupons (upper(code));

create table if not exists collections (
  id text primary key,
  slug text not null,
  name text not null,
  blurb text not null default '',
  "from" text not null default '#17392b',
  "to" text not null default '#4b8a64',
  image_path text,
  created_at timestamptz not null default now()
);
create unique index if not exists collections_slug_key on collections (slug);

create table if not exists collection_items (
  collection_id text not null references collections(id) on delete cascade,
  product_id text not null references products(id) on delete cascade,
  position integer not null default 0,
  primary key (collection_id, product_id)
);

create table if not exists homepage_sections (
  id text primary key,
  key text not null,
  label text not null,
  enabled boolean not null default true,
  position integer not null default 0,
  config jsonb default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create unique index if not exists homepage_sections_key on homepage_sections (key);

create table if not exists announcements (
  id text primary key,
  text text not null,
  href text,
  active boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists pages (
  id text primary key,
  slug text not null,
  title text not null,
  kind text not null default 'page' check (kind in ('page','policy','faq')),
  body text not null default '',
  excerpt text not null default '',
  category text not null default '',
  read_minutes integer not null default 4,
  status text not null default 'published' check (status in ('published','draft')),
  image_path text,
  "from" text not null default '#17392b',
  "to" text not null default '#4b8a64',
  position integer not null default 0,
  published_at text not null default '',
  updated_at timestamptz not null default now()
);
create unique index if not exists pages_slug_key on pages (slug);

create table if not exists settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists activity_log (
  id text primary key,
  actor_id text references users(id) on delete set null,
  actor text not null default 'System',
  action text not null,
  target text not null default '',
  kind text not null default 'settings' check (kind in ('product','order','customer','settings','content','promo','auth')),
  ip text,
  created_at timestamptz not null default now()
);
create index if not exists activity_created_idx on activity_log (created_at);

-- brute-force protection
create table if not exists rate_limits (
  key text primary key,
  count integer not null default 0,
  window_start timestamptz not null default now()
);

-- one-off marker that demo data was seeded, so seeding is safe to re-run
create table if not exists seed_state (
  key text primary key,
  applied_at timestamptz not null default now()
);
