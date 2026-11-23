-- Dragør Eagles · applied to the "stillwork supabase" project on 15 Nov 2026 (kept here for reference)
create table if not exists hoops_players (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 40),
  created_at timestamptz not null default now()
);

create table if not exists hoops_checkins (
  player_id uuid not null references hoops_players(id) on delete cascade,
  game_date date not null,
  status text not null check (status in ('in', 'maybe', 'out')),
  updated_at timestamptz not null default now(),
  primary key (player_id, game_date)
);

alter table hoops_players enable row level security;
alter table hoops_checkins enable row level security;

-- Anyone with the link can read the squad, join, and check in or out. Nobody can delete from the site.
create policy "eagles read players" on hoops_players for select using (true);
create policy "eagles join" on hoops_players for insert with check (true);
create policy "eagles read checkins" on hoops_checkins for select using (true);
create policy "eagles check in" on hoops_checkins for insert with check (true);
create policy "eagles change check-in" on hoops_checkins for update using (true) with check (true);

-- 23 Nov 2026: 'maybe' added to the status check (migration hoops_checkins_allow_maybe)
