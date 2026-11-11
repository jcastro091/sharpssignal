alter table public.customer_tracked_plays
  add column if not exists notes text not null default '' check (char_length(notes) <= 2000),
  add column if not exists tags text[] not null default '{}' check (cardinality(tags) <= 10);
comment on column public.customer_tracked_plays.notes is 'Private owner-written context; treated as data, never model instructions.';
comment on column public.customer_tracked_plays.tags is 'Private owner-selected labels for filtering and deterministic result grouping.';
