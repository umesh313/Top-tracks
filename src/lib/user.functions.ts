import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { computeChart, type PrevEntry, type RawMetrics } from "./chart-engine";
import { providers } from "./providers";

export const castVote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { songId: string; value: 1 | -1 | 0 }) =>
    z
      .object({
        songId: z.string().uuid(),
        value: z.union([z.literal(1), z.literal(-1), z.literal(0)]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const week = new Date();
    const day = (week.getUTCDay() + 6) % 7;
    week.setUTCDate(week.getUTCDate() - day);
    const ws = week.toISOString().slice(0, 10);
    if (data.value === 0) {
      await supabase
        .from("votes")
        .delete()
        .eq("user_id", userId)
        .eq("song_id", data.songId)
        .eq("week_start", ws);
      return { ok: true };
    }
    const { error } = await supabase
      .from("votes")
      .upsert(
        { user_id: userId, song_id: data.songId, value: data.value, week_start: ws },
        { onConflict: "user_id,song_id,week_start" },
      );
    if (error)
      return {
        ok: false,
        error: error.message.includes("limit") ? "Daily vote limit reached" : "Could not save vote",
      };
    return { ok: true };
  });

export const getMyState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: votes }, { data: follows }, { data: bv }, { data: isAdmin }] = await Promise.all(
      [
        supabase.from("votes").select("song_id,value,week_start").eq("user_id", userId),
        supabase.from("follows").select("target_type,target_id").eq("user_id", userId),
        supabase.from("battle_votes").select("battle_id,choice").eq("user_id", userId),
        supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
      ],
    );
    return {
      userId,
      votes: votes ?? [],
      follows: follows ?? [],
      battleVotes: bv ?? [],
      isAdmin: !!isAdmin,
    };
  });

export const toggleFollow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { type: "song" | "artist"; id: string }) =>
    z.object({ type: z.enum(["song", "artist"]), id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ex } = await supabase
      .from("follows")
      .select("target_id")
      .eq("user_id", userId)
      .eq("target_type", data.type)
      .eq("target_id", data.id)
      .maybeSingle();
    if (ex)
      await supabase
        .from("follows")
        .delete()
        .eq("user_id", userId)
        .eq("target_type", data.type)
        .eq("target_id", data.id);
    else
      await supabase
        .from("follows")
        .insert({ user_id: userId, target_type: data.type, target_id: data.id });
    return { following: !ex };
  });

export const voteBattle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { battleId: string; choice: string }) =>
    z.object({ battleId: z.string().uuid(), choice: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("battle_votes")
      .insert({ battle_id: data.battleId, choice: data.choice, user_id: context.userId });
    return { ok: !error };
  });

export const makePrediction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { songId: string; targetWeek: string }) =>
    z
      .object({ songId: z.string().uuid(), targetWeek: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("predictions")
      .upsert(
        { user_id: context.userId, song_id: data.songId, target_week: data.targetWeek },
        { onConflict: "user_id,target_week" },
      );
    return { ok: !error };
  });

export const getProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: profile }, { data: votes }, { data: follows }, { data: preds }, { data: bv }] =
      await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabase
          .from("votes")
          .select("value,week_start,created_at,song:songs(slug,title,hue,artist:artists(name))")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase.from("follows").select("target_type,target_id").eq("user_id", userId),
        supabase
          .from("predictions")
          .select("target_week,song:songs(slug,title)")
          .eq("user_id", userId)
          .order("target_week", { ascending: false }),
        supabase.from("battle_votes").select("battle_id").eq("user_id", userId),
      ]);
    const ids = (follows ?? []).map((f) => f.target_id);
    const [{ data: fs }, { data: fa }] = await Promise.all([
      supabase
        .from("songs")
        .select("id,slug,title,hue")
        .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
      supabase
        .from("artists")
        .select("id,slug,name,hue")
        .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
    ]);
    const v = votes ?? [];
    const badges = [
      { id: "first-vote", name: "First Vote", earned: v.length >= 1, hint: "Cast your first vote" },
      { id: "voice", name: "Voice of the People", earned: v.length >= 10, hint: "Cast 10 votes" },
      {
        id: "battle",
        name: "Battle Tested",
        earned: (bv ?? []).length >= 3,
        hint: "Vote in 3 song battles",
      },
      {
        id: "oracle",
        name: "Oracle",
        earned: (preds ?? []).length >= 1,
        hint: "Make a chart prediction",
      },
      {
        id: "curator",
        name: "Curator",
        earned: ids.length >= 5,
        hint: "Follow 5 songs or artists",
      },
    ];
    return {
      profile,
      votes: v,
      followedSongs: fs ?? [],
      followedArtists: fa ?? [],
      predictions: preds ?? [],
      badges,
    };
  });

/* ---------------- Admin ---------------- */
async function assertAdmin(supabase: { rpc: (...a: never[]) => unknown }, userId: string) {
  const { data } = await (
    supabase.rpc as unknown as (f: string, a: object) => Promise<{ data: boolean }>
  )("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

const weightsSchema = z.object({
  streaming: z.number().min(0).max(100),
  radio: z.number().min(0).max(100),
  people: z.number().min(0).max(100),
  social: z.number().min(0).max(100),
  search: z.number().min(0).max(100),
});

export const updateWeights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof weightsSchema>) => weightsSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    const { error } = await context.supabase
      .from("scoring_config")
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateSong = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; title: string }) =>
    z.object({ id: z.string().uuid(), title: z.string().trim().min(1).max(120) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    const { error } = await context.supabase
      .from("songs")
      .update({ title: data.title })
      .eq("id", data.id);
    return { ok: !error };
  });

export const updateArtist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; name: string; bio: string }) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().trim().min(1).max(120),
        bio: z.string().max(1000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    const { error } = await context.supabase
      .from("artists")
      .update({ name: data.name, bio: data.bio })
      .eq("id", data.id);
    return { ok: !error };
  });

/** Publishes the current week's chart once, using the preceding published snapshot for movement. */
export const generateChart = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const now = new Date();
    const currentWeek = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    currentWeek.setUTCDate(currentWeek.getUTCDate() - ((currentWeek.getUTCDay() + 6) % 7));
    const weekStart = currentWeek.toISOString().slice(0, 10);

    const { data: existingWeek, error: existingError } = await db
      .from("chart_weeks")
      .select("id,week_start,status,source")
      .eq("week_start", weekStart)
      .maybeSingle();
    if (existingError) throw new Error(`Could not inspect chart week: ${existingError.message}`);
    if (existingWeek?.status === "published") {
      if (existingWeek.source !== "lastfm") {
        throw new Error(`Chart week ${weekStart} is already published and cannot be overwritten`);
      }
      const { count, error } = await db
        .from("chart_entries")
        .select("song_id", { count: "exact", head: true })
        .eq("week_id", existingWeek.id);
      if (error) throw new Error(`Could not inspect published chart entries: ${error.message}`);
      return {
        weekId: existingWeek.id,
        weekStart: existingWeek.week_start,
        entries: count ?? 0,
        alreadyPublished: true,
      };
    }

    const { data: priorWeeks, error: priorWeeksError } = await db
      .from("chart_weeks")
      .select("id,week_start")
      .eq("status", "published")
      .eq("source", "lastfm")
      .lt("week_start", weekStart)
      .order("week_start", { ascending: false });
    if (priorWeeksError)
      throw new Error(`Could not load published chart history: ${priorWeeksError.message}`);
    const last = priorWeeks?.[0] ?? null;
    const priorWeekIds = (priorWeeks ?? []).map((w) => w.id);
    const [
      { data: cfg, error: cfgError },
      { data: prevMetrics, error: metricsError },
      { data: prevEntries, error: entriesError },
      { data: songs, error: songsError },
      { data: votes, error: votesError },
    ] = await Promise.all([
      db.from("scoring_config").select("*").eq("id", 1).single(),
      last
        ? db.from("song_metrics").select("*").eq("week_id", last.id)
        : Promise.resolve({ data: [], error: null }),
      priorWeekIds.length
        ? db
            .from("chart_entries")
            .select("week_id,song_id,rank,songboard_score,peak_rank,weeks_on_chart")
            .in("week_id", priorWeekIds)
        : Promise.resolve({ data: [], error: null }),
      db.from("songs").select("id,title,musicbrainz_recording_id,artist:artists(name)"),
      db.from("votes").select("song_id,value").eq("week_start", weekStart),
    ]);
    if (cfgError) throw new Error(`Could not load scoring configuration: ${cfgError.message}`);
    if (metricsError)
      throw new Error(`Could not load previous chart metrics: ${metricsError.message}`);
    if (entriesError)
      throw new Error(`Could not load previous chart entries: ${entriesError.message}`);
    if (songsError)
      throw new Error(`Could not load songs for chart generation: ${songsError.message}`);
    if (votesError)
      throw new Error(`Could not load votes for chart generation: ${votesError.message}`);
    if (!cfg) throw new Error("Chart scoring configuration is missing");

    const pm = new Map((prevMetrics ?? []).map((m) => [m.song_id, m]));
    const seed = Number(weekStart.replaceAll("-", ""));
    const snapList = (songs ?? []).map((s) => ({
      songId: s.id,
      ageWeeks: 0,
      artist: s.artist?.name ?? null,
      title: s.title,
      mbid: s.musicbrainz_recording_id ?? null,
    }));
    const [st, ra, so, se] = await Promise.all([
      providers.streaming.fetchWeek(snapList, seed),
      providers.radio.fetchWeek(snapList, seed),
      providers.social.fetchWeek(snapList, seed),
      providers.search.fetchWeek(snapList, seed),
    ]);
    for (const [name, values] of [
      ["streaming", st],
      ["radio", ra],
      ["social", so],
      ["search", se],
    ] as const) {
      if (
        values.size === 0 ||
        ![...values.values()].some((value) => Number.isFinite(value) && value > 0)
      ) {
        throw new Error(`Chart generation stopped: Last.fm returned no usable ${name} metrics`);
      }
    }
    const realVotes = new Map<string, { up: number; down: number }>();
    for (const v of votes ?? []) {
      const r = realVotes.get(v.song_id) ?? { up: 0, down: 0 };
      if (v.value > 0) r.up++;
      else r.down++;
      realVotes.set(v.song_id, r);
    }
    const metrics: RawMetrics[] = [...st.keys()].map((id) => {
      const p = pm.get(id);
      const rv = realVotes.get(id) ?? { up: 0, down: 0 };
      return {
        songId: id,
        streaming: st.get(id)!,
        radio: ra.get(id)!,
        social: so.get(id)!,
        search: se.get(id)!,
        peopleUp: Math.round(Number(p?.people_up ?? 0) * 0.9) + rv.up * 10,
        peopleDown: Math.round(Number(p?.people_down ?? 0) * 0.9) + rv.down * 10,
      };
    });
    if (
      metrics.some((metric) =>
        [
          metric.streaming,
          metric.radio,
          metric.social,
          metric.search,
          metric.peopleUp,
          metric.peopleDown,
        ].some((value) => !Number.isFinite(value) || value < 0),
      )
    ) {
      throw new Error(
        "Chart generation stopped: provider or vote metrics contained invalid values",
      );
    }
    const prev = new Map<string, PrevEntry>();
    const peaks = new Map<string, { peak: number; woc: number }>();
    for (const e of prevEntries ?? []) {
      const x = peaks.get(e.song_id) ?? { peak: 999, woc: 0 };
      peaks.set(e.song_id, { peak: Math.min(x.peak, e.peak_rank), woc: x.woc + 1 });
    }
    const { data: lastEntries, error: lastEntriesError } = last
      ? await db.from("chart_entries").select("song_id,rank,songboard_score").eq("week_id", last.id)
      : { data: [], error: null };
    if (lastEntriesError)
      throw new Error(`Could not load the preceding chart week: ${lastEntriesError.message}`);
    const lastSet = new Set((lastEntries ?? []).map((e) => e.song_id));
    for (const e of lastEntries ?? []) {
      const peak = peaks.get(e.song_id);
      prev.set(e.song_id, {
        rank: e.rank,
        songboardScore: Number(e.songboard_score),
        peakRank: peak?.peak ?? e.rank,
        weeksOnChart: peak?.woc ?? e.weeks_on_chart,
      });
    }
    const prevForEngine = new Map<string, PrevEntry>();
    for (const [k, v] of prev) if (lastSet.has(k)) prevForEngine.set(k, v);
    const entries = computeChart(metrics, prevForEngine, cfg!);
    for (const e of entries) {
      const pk = peaks.get(e.songId);
      if (pk && !lastSet.has(e.songId)) {
        e.peakRank = Math.min(pk.peak, e.rank);
        e.weeksOnChart = pk.woc + 1;
      }
    }
    const { data: published, error: publishError } = await db.rpc("publish_chart_snapshot", {
      p_week_start: weekStart,
      p_metrics: metrics.map((m) => ({
        song_id: m.songId,
        streaming: m.streaming,
        radio: m.radio,
        social: m.social,
        search: m.search,
        people_up: m.peopleUp,
        people_down: m.peopleDown,
      })),
      p_entries: entries.map((e) => ({
        song_id: e.songId,
        rank: e.rank,
        prev_rank: e.prevRank,
        peak_rank: e.peakRank,
        weeks_on_chart: e.weeksOnChart,
        songboard_score: e.songboardScore,
        chart_score: e.chartScore,
        people_score: e.peopleScore,
        momentum_score: e.momentumScore,
        streaming_score: e.streamingScore,
        radio_score: e.radioScore,
        social_score: e.socialScore,
        search_score: e.searchScore,
      })),
    });
    if (publishError) throw new Error(`Could not publish chart snapshot: ${publishError.message}`);
    const result = Array.isArray(published) ? published[0] : published;
    if (!result) throw new Error("Chart snapshot publication returned no result");
    return {
      weekId: result.week_id,
      weekStart: result.week_start,
      entries: result.entries,
      alreadyPublished: result.already_published,
    };
  });
