-- Bundles: several products sold together for one price.
--
-- Idempotent like every other file here: the runner retries a whole file when
-- it fails part way, so every statement must be safe to run twice.

create table if not exists bundles (
  id text primary key,
  slug text not null,
  name text not null,
  tagline text not null default '',
  description text not null default '',
  price integer not null default 0,
  compare_at integer,
  license text not null default 'personal'
    check (license in ('personal', 'commercial', 'extended', 'developer')),
  active boolean not null default true,
  featured boolean not null default false,
  art_from text not null default '#17392b',
  art_to text not null default '#3d7a58',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists bundles_slug_key on bundles (slug);

create table if not exists bundle_items (
  id text primary key,
  bundle_id text not null references bundles (id) on delete cascade,
  product_id text not null references products (id) on delete cascade,
  position integer not null default 0
);

create unique index if not exists bundle_items_unique on bundle_items (bundle_id, product_id);
create index if not exists bundle_items_bundle_idx on bundle_items (bundle_id);

-- An order line can point at a bundle instead of a product. Nullable, so every
-- existing row keeps meaning exactly what it did before.
alter table order_items add column if not exists bundle_id text references bundles (id) on delete set null;
alter table order_items alter column product_id drop not null;
