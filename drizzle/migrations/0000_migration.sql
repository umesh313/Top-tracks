create type public.app_role as enum ('admin','moderator','user');

create table public.genres (id text primary key, name text not null, hue int not null default 0);
create table public.countries (code text primary key, name text not null, flag text not null);
create table public.artists (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null, name text not null,
  country_code text references public.countries(code),
  genre_id text references public.genres(id),
  hue int not null default 0, bio text, monthly_listeners bigint not null default 0,
  created_at timestamptz not null default now());
create table public.albums (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.artists(id) on delete cascade,
  title text not null, release_date date);
create table public.songs (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null, title text not null,
  artist_id uuid not null references public.artists(id) on delete cascade,
  album_id uuid references public.albums(id) on delete set null,
  genre_id text references public.genres(id),
  country_code text references public.countries(code),
  release_date date, duration_sec int not null default 200, hue int not null default 0,
  created_at timestamptz not null default now());
create table public.chart_weeks (
  id serial primary key, week_start date unique not null,
  created_at timestamptz not null default now());
create table public.song_metrics (
  song_id uuid not null references public.songs(id) on delete cascade,
  week_id int not null references public.chart_weeks(id) on delete cascade,
  streaming numeric not null default 0, radio numeric not null default 0,
  social numeric not null default 0, search numeric not null default 0,
  people_up int not null default 0, people_down int not null default 0,
  primary key (song_id, week_id));
create table public.chart_entries (
  week_id int not null references public.chart_weeks(id) on delete cascade,
  song_id uuid not null references public.songs(id) on delete cascade,
  rank int not null, prev_rank int, peak_rank int not null, weeks_on_chart int not null default 1,
  songboard_score numeric not null, chart_score numeric not null, people_score numeric not null,
  momentum_score numeric not null, streaming_score numeric not null, radio_score numeric not null,
  social_score numeric not null, search_score numeric not null,
  primary key (week_id, song_id));
create index on public.chart_entries(week_id, rank);
create index on public.chart_entries(song_id);
create table public.scoring_config (
  id int primary key default 1 check (id = 1),
  streaming numeric not null default 40, radio numeric not null default 25,
  people numeric not null default 20, social numeric not null default 10, search numeric not null default 5,
  updated_at timestamptz not null default now());
insert into public.scoring_config(id) values (1);

create table public.profiles (
  id uuid primary key, display_name text, created_at timestamptz not null default now());
create table public.user_roles (
  id uuid primary key default gen_random_uuid(), user_id uuid not null, role app_role not null,
  unique(user_id, role));
create table public.votes (
  id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid(),
  song_id uuid not null references public.songs(id) on delete cascade,
  week_start date not null default (date_trunc('week', now())::date),
  value smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  unique(user_id, song_id, week_start));
create table public.follows (
  user_id uuid not null default auth.uid(), target_type text not null check (target_type in ('song','artist')),
  target_id uuid not null, created_at timestamptz not null default now(),
  primary key (user_id, target_type, target_id));
create table public.battles (
  id uuid primary key default gen_random_uuid(),
  song_a uuid not null references public.songs(id) on delete cascade,
  song_b uuid not null references public.songs(id) on delete cascade,
  created_at timestamptz not null default now());
create table public.battle_votes (
  battle_id uuid not null references public.battles(id) on delete cascade,
  user_id uuid not null default auth.uid(), choice uuid not null,
  created_at timestamptz not null default now(), primary key (battle_id, user_id));
create table public.predictions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid(),
  target_week date not null, song_id uuid not null references public.songs(id) on delete cascade,
  created_at timestamptz not null default now(), unique(user_id, target_week));

-- grants
grant select on public.genres, public.countries, public.artists, public.albums, public.songs,
  public.chart_weeks, public.song_metrics, public.chart_entries, public.scoring_config, public.battles to anon, authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant select, insert, update on public.profiles to authenticated;
grant select on public.user_roles to authenticated;
grant select, insert, delete on public.votes, public.follows, public.battle_votes, public.predictions to authenticated;
grant update on public.votes to authenticated;
grant insert, update, delete on public.artists, public.songs, public.scoring_config to authenticated;

alter table public.genres enable row level security;
alter table public.countries enable row level security;
alter table public.artists enable row level security;
alter table public.albums enable row level security;
alter table public.songs enable row level security;
alter table public.chart_weeks enable row level security;
alter table public.song_metrics enable row level security;
alter table public.chart_entries enable row level security;
alter table public.scoring_config enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.votes enable row level security;
alter table public.follows enable row level security;
alter table public.battles enable row level security;
alter table public.battle_votes enable row level security;
alter table public.predictions enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;

create policy "public read" on public.genres for select using (true);
create policy "public read" on public.countries for select using (true);
create policy "public read" on public.artists for select using (true);
create policy "public read" on public.albums for select using (true);
create policy "public read" on public.songs for select using (true);
create policy "public read" on public.chart_weeks for select using (true);
create policy "public read" on public.song_metrics for select using (true);
create policy "public read" on public.chart_entries for select using (true);
create policy "public read" on public.scoring_config for select using (true);
create policy "public read" on public.battles for select using (true);
create policy "admin write artists" on public.artists for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "admin write songs" on public.songs for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "admin write config" on public.scoring_config for update to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid());
create policy "own profile insert" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid());
create policy "own roles read" on public.user_roles for select to authenticated using (user_id = auth.uid());
create policy "own votes" on public.votes for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own follows" on public.follows for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own battle votes" on public.battle_votes for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own predictions" on public.predictions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- anti-abuse: max 60 votes per user per day; vote week forced to current week
create or replace function public.enforce_vote_rules() returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.week_start := date_trunc('week', now())::date;
  new.user_id := auth.uid();
  if tg_op = 'INSERT' and (select count(*) from public.votes where user_id = auth.uid() and created_at > now() - interval '1 day') >= 60 then
    raise exception 'Daily vote limit reached';
  end if;
  return new;
end $$;
create trigger votes_rules before insert or update on public.votes for each row execute function public.enforce_vote_rules();

create or replace function public.enforce_battle_choice() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.battles b where b.id = new.battle_id and new.choice in (b.song_a, b.song_b)) then
    raise exception 'Invalid choice';
  end if;
  new.user_id := auth.uid();
  return new;
end $$;
create trigger battle_choice before insert on public.battle_votes for each row execute function public.enforce_battle_choice();

-- aggregated public vote counts (no user data exposed)
create or replace function public.vote_totals(_week date default date_trunc('week', now())::date)
returns table(song_id uuid, up bigint, down bigint) language sql stable security definer set search_path = public as $$
  select song_id, count(*) filter (where value = 1), count(*) filter (where value = -1)
  from public.votes where week_start = _week group by song_id $$;
create or replace function public.battle_totals()
returns table(battle_id uuid, choice uuid, n bigint) language sql stable security definer set search_path = public as $$
  select battle_id, choice, count(*) from public.battle_votes group by battle_id, choice $$;
grant execute on function public.vote_totals(date), public.battle_totals() to anon, authenticated;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, display_name) values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)));
  insert into public.user_roles(user_id, role) values (new.id, 'user');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();