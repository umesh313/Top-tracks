do $$
declare
  g text[] := array['pop','hip-hop','rnb','afrobeats','latin','rock','electronic','k-pop','country','indie'];
  gn text[] := array['Pop','Hip-Hop','R&B','Afrobeats','Latin','Rock','Electronic','K-Pop','Country','Indie'];
  gh int[] := array[330,30,290,95,15,0,190,310,40,160];
  gcs text[] := array['US,GB,CA,AU','US,GB,CA','US,GB','NG,GB','MX,BR,ES','US,GB,AU','FR,GB,US','KR,JP','US,CA','GB,US,FR,IN,JP'];
  fn text[] := array['Nova','Kairo','Luma','Ezra','Sable','Juno','Theo','Mara','Rio','Zadie','Okon','Yuna','Felix','Ines','Dante','Amara','Cass','Leon','Sienna','Kofi','Mina','Arlo','Vee','Tomas','Remy','Isla','Jett','Noor','Bash','Celine'];
  ln text[] := array['Vale','Rivers','Okafor','Moon','Hart','Sol','Kane','Lux','Park','Rey','Stone','Ashby','Cruz','Wilde','Bloom'];
  bands text[] := array['The Glass Parade','Static Hearts','Neon Saints','Velvet Static','Low Orbit','Paper Kings','Cold Harbour','Midnight Choir','Sundial','Lake District','Ghost Atlas','Copper Sky','BLVCK ROSE','HYPERLIGHT','Eleven Moons'];
  w1 text[] := array['Midnight','Golden','Electric','Velvet','Paper','Neon','Silent','Wild','Broken','Satellite','Summer','Glass','Fever','Honey','Gravity','Crimson','Lucid','Ocean','Static','Cherry','Echo','Dusk','Paradise','Chrome','Faded','Sugar','Diamond','Rebel','Lonely','Infinite'];
  w2 text[] := array['Hearts','Signals','Roads','Dreams','Lights','Waves','City','Fire','Skies','Rain','Love','Season','Motion','Bloom','Ghosts','Rush','Mirror','Hours','Gold','Heat','Letters','Sirens','Tides','Pulse','Run'];
  start date := date '2026-07-13';
  nm text; gi int; cc text; aid uuid; alb uuid; pop float; k int; t text; tries int; i int; j int; w int;
begin
  perform setseed(0.42);
  insert into public.genres select g[x], gn[x], gh[x] from generate_subscripts(g,1) x;
  insert into public.countries values ('US','United States','🇺🇸'),('GB','United Kingdom','🇬🇧'),('NG','Nigeria','🇳🇬'),('KR','South Korea','🇰🇷'),('BR','Brazil','🇧🇷'),('MX','Mexico','🇲🇽'),('IN','India','🇮🇳'),('CA','Canada','🇨🇦'),('FR','France','🇫🇷'),('JP','Japan','🇯🇵'),('AU','Australia','🇦🇺'),('ES','Spain','🇪🇸');
  create temp table sp(id uuid, rel int, strength float, decay float, viral float, radiom float, peak float) on commit drop;
  for i in 1..65 loop
    if i <= 15 then nm := bands[i];
    else loop nm := fn[1+floor(random()*30)::int] || ' ' || ln[1+floor(random()*15)::int];
      exit when not exists (select 1 from public.artists where name = nm); end loop; end if;
    gi := 1+floor(random()*10)::int;
    cc := (string_to_array(gcs[gi], ','))[1+floor(random()*array_length(string_to_array(gcs[gi], ','),1))::int];
    pop := random();
    insert into public.artists(slug,name,country_code,genre_id,hue,bio,monthly_listeners)
      values (lower(replace(nm,' ','-')), nm, cc, g[gi], floor(random()*360)::int,
        nm || ' is a ' || gn[gi] || ' act. Demo profile — SONGBOARD sample data.', (800000 + random()*90000000)::bigint)
      returning id into aid;
    insert into public.albums(artist_id,title,release_date) values (aid, w1[1+floor(random()*30)::int] || ' ' || w2[1+floor(random()*25)::int], start - (floor(random()*280)::int)) returning id into alb;
    k := 1 + floor(pop*4)::int;
    for j in 1..k loop
      loop
        t := case when random() < .7 then w1[1+floor(random()*30)::int] || ' ' || w2[1+floor(random()*25)::int] else w2[1+floor(random()*25)::int] end;
        exit when not exists (select 1 from public.songs where title = t);
      end loop;
      w := floor(random()*42)::int - 30;
      insert into public.songs(slug,title,artist_id,album_id,genre_id,country_code,release_date,duration_sec,hue)
        values (lower(replace(t||'-'||nm,' ','-')), t, aid, alb, g[gi], cc, start + w*7, 140+floor(random()*120)::int, floor(random()*360)::int)
        returning id into aid;
      insert into sp values (aid, w, (0.3+pop*0.7)*(0.4+random()*0.9), 0.03+random()*0.09, 0.5+random()*1.1, 0.5+random()*0.9, 1+random()*4);
      select a.id into aid from public.artists a where a.name = nm;
    end loop;
  end loop;

  insert into public.chart_weeks(id, week_start) select x, start + (x-1)*7 from generate_series(1,12) x;
  perform setval('chart_weeks_id_seq', 12);

  for w in 1..12 loop
    insert into public.song_metrics(song_id,week_id,streaming,radio,social,search,people_up,people_down)
    select id, w, round(strength*c*(0.88+random()*0.24)*4000000), round(strength*radiom*c2*(0.88+random()*0.24)*30000),
      round(strength*viral*c*(case when age<3 then 1.6 else 1 end)*(0.88+random()*0.24)*500000),
      round(strength*c*(case when age<2 then 1.4 else 1 end)*(0.88+random()*0.24)*100000),
      up, round(up*(0.05+random()*0.3))
    from (select *, (w-1-rel) age,
      least(1, ((w-1-rel)+1)/peak) * exp(-decay*greatest(0,(w-1-rel)-peak)) c,
      case when w-2-rel < 0 then 0 else least(1, ((w-2-rel)+1)/peak) * exp(-decay*greatest(0,(w-2-rel)-peak)) end c2,
      0 up from sp) s
    where age >= 0 and c > 0.02;
    update public.song_metrics m set people_up = round(sp.strength*sp.viral*(200+random()*700)*least(1, ((w-1-sp.rel)+1)/sp.peak)), people_down = 0
      from sp where m.song_id = sp.id and m.week_id = w;
    update public.song_metrics set people_down = round(people_up*(0.05+random()*0.3)) where week_id = w;

    insert into public.chart_entries
    with mx as (select max(streaming) ms, max(radio) mr, max(social) mso, max(search) mse, max(greatest(0,people_up-0.5*people_down)) mp from public.song_metrics where week_id = w),
    sc as (select m.song_id, 100*m.streaming/nullif(mx.ms,0) s, 100*m.radio/nullif(mx.mr,0) r, 100*m.social/nullif(mx.mso,0) so,
      100*m.search/nullif(mx.mse,0) se, 100*greatest(0,m.people_up-0.5*m.people_down)/nullif(mx.mp,0) p
      from public.song_metrics m, mx where m.week_id = w),
    sb as (select *, (s*40+r*25+so*10+se*5)/80.0 chart, (s*40+r*25+p*20+so*10+se*5)/100.0 total from sc),
    rk as (select *, row_number() over (order by total desc) rnk from sb)
    select w, rk.song_id, rk.rnk, pe.rank, least(coalesce((select min(peak_rank) from public.chart_entries x where x.song_id=rk.song_id), 999), rk.rnk),
      coalesce((select count(*) from public.chart_entries x where x.song_id=rk.song_id),0)+1,
      round(total::numeric,2), round(chart::numeric,2), round(p::numeric,2),
      round(case when pe.songboard_score is null then 60 else greatest(0,least(100,50+(total-pe.songboard_score)*4)) end::numeric,2),
      round(s::numeric,2), round(r::numeric,2), round(so::numeric,2), round(se::numeric,2)
    from rk left join public.chart_entries pe on pe.song_id = rk.song_id and pe.week_id = w-1
    where rk.rnk <= 100;
  end loop;

  insert into public.battles(song_a, song_b)
  select a.song_id, b.song_id from public.chart_entries a join public.chart_entries b on b.week_id=12 and b.rank=a.rank+1
  where a.week_id=12 and a.rank in (1,3,5,7);
end $$;