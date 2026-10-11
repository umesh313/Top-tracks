alter table public.chart_weeks
  add column status text not null default 'published'
    check (status in ('generating', 'published', 'failed')),
  add column source text not null default 'legacy'
    check (source in ('lastfm', 'demo', 'legacy')),
  add column generated_at timestamptz;

update public.chart_weeks cw
set source = 'demo'
where exists (
  select 1
  from public.chart_entries ce
  join public.songs s on s.id = ce.song_id
  join public.artists a on a.id = s.artist_id
  where ce.week_id = cw.id
    and a.bio like '%Demo profile%SONGBOARD sample data%'
);

create index chart_weeks_published_source_week
  on public.chart_weeks(source, status, week_start desc);

create or replace function public.prevent_published_chart_week_changes()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status = 'published' then
    raise exception 'Published chart weeks are immutable';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger chart_weeks_immutable
before update or delete on public.chart_weeks
for each row execute function public.prevent_published_chart_week_changes();

create or replace function public.prevent_published_chart_data_changes()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  previous_status text;
  target_status text;
begin
  if tg_op <> 'INSERT' then
    select status into previous_status
    from public.chart_weeks
    where id = old.week_id;
    if previous_status is distinct from 'generating' then
      raise exception 'Chart data can only be changed while its week is generating';
    end if;
  end if;

  if tg_op <> 'DELETE' then
    select status into target_status
    from public.chart_weeks
    where id = new.week_id;
    if target_status is distinct from 'generating' then
      raise exception 'Chart data can only be changed while its week is generating';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger chart_entries_immutable
before insert or update or delete on public.chart_entries
for each row execute function public.prevent_published_chart_data_changes();

create trigger song_metrics_immutable
before insert or update or delete on public.song_metrics
for each row execute function public.prevent_published_chart_data_changes();

create or replace function public.publish_chart_snapshot(
  p_week_start date,
  p_metrics jsonb,
  p_entries jsonb
)
returns table (
  week_id integer,
  week_start date,
  entries integer,
  already_published boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_week_id integer;
  target_status text;
  target_source text;
  entry_count integer;
begin
  if p_week_start is null
    or jsonb_typeof(p_metrics) is distinct from 'array'
    or jsonb_typeof(p_entries) is distinct from 'array' then
    raise exception 'A week start date, metrics array, and entries array are required';
  end if;

  if jsonb_array_length(p_metrics) = 0 or jsonb_array_length(p_entries) = 0 then
    raise exception 'A chart snapshot must contain metrics and ranked entries';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_week_start::text, 0));

  select cw.id, cw.status, cw.source
    into target_week_id, target_status, target_source
  from public.chart_weeks cw
  where cw.week_start = p_week_start
  for update;

  if target_week_id is not null
    and target_status = 'published'
    and target_source = 'lastfm' then
    select count(*)::integer into entry_count
    from public.chart_entries ce
    where ce.week_id = target_week_id;

    return query
      select target_week_id, p_week_start, entry_count, true;
    return;
  end if;

  if target_week_id is not null
    and (target_status = 'published' or target_source = 'demo') then
    raise exception 'Published chart history cannot be overwritten';
  end if;

  if target_week_id is null then
    insert into public.chart_weeks(week_start, status, source, generated_at)
      values (p_week_start, 'generating', 'lastfm', now())
      returning id into target_week_id;
  else
    update public.chart_weeks
      set source = 'lastfm', status = 'generating', generated_at = now()
      where id = target_week_id;
    delete from public.chart_entries where chart_entries.week_id = target_week_id;
    delete from public.song_metrics where song_metrics.week_id = target_week_id;
  end if;

  insert into public.song_metrics(
    song_id, week_id, streaming, radio, social, search, people_up, people_down
  )
  select m.song_id, target_week_id, m.streaming, m.radio, m.social, m.search, m.people_up, m.people_down
  from jsonb_to_recordset(p_metrics) as m(
    song_id uuid,
    streaming numeric,
    radio numeric,
    social numeric,
    search numeric,
    people_up integer,
    people_down integer
  );

  insert into public.chart_entries(
    week_id, song_id, rank, prev_rank, peak_rank, weeks_on_chart,
    songboard_score, chart_score, people_score, momentum_score,
    streaming_score, radio_score, social_score, search_score
  )
  select target_week_id, e.song_id, e.rank, e.prev_rank, e.peak_rank, e.weeks_on_chart,
    e.songboard_score, e.chart_score, e.people_score, e.momentum_score,
    e.streaming_score, e.radio_score, e.social_score, e.search_score
  from jsonb_to_recordset(p_entries) as e(
    song_id uuid,
    rank integer,
    prev_rank integer,
    peak_rank integer,
    weeks_on_chart integer,
    songboard_score numeric,
    chart_score numeric,
    people_score numeric,
    momentum_score numeric,
    streaming_score numeric,
    radio_score numeric,
    social_score numeric,
    search_score numeric
  );

  select count(*)::integer into entry_count
  from public.chart_entries ce
  where ce.week_id = target_week_id;

  update public.chart_weeks
    set status = 'published', generated_at = now()
    where id = target_week_id;

  return query
    select target_week_id, p_week_start, entry_count, false;
end;
$$;

revoke all on function public.publish_chart_snapshot(date, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.publish_chart_snapshot(date, jsonb, jsonb) to service_role;
