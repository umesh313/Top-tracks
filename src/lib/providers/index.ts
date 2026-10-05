/**
 * Data provider abstraction. The chart engine only sees normalised RawMetrics;
 * Real Last.fm providers drive the chart (see ./lastfm).
 */
import { LastFmRadio, LastFmSearch, LastFmSocial, LastFmStreaming } from "./lastfm";

export type SongSnapshot = {
  songId: string;
  previous?: number;
  ageWeeks: number;
  /** Identifying info used by real providers (e.g. Last.fm lookups). */
  artist?: string | null;
  title?: string | null;
  mbid?: string | null;
};

export interface DataProvider {
  readonly name: string;
  /** Returns a raw metric value per song for the target week. */
  fetchWeek(songs: SongSnapshot[], seed: number): Promise<Map<string, number>>;
}
export type StreamingProvider = DataProvider;
export type RadioProvider = DataProvider;
export type SocialProvider = DataProvider;
export type SearchProvider = DataProvider;

/** Real Last.fm providers drive the chart. */

export const providers = {
  streaming: LastFmStreaming as StreamingProvider,
  radio: LastFmRadio as RadioProvider,
  social: LastFmSocial as SocialProvider,
  search: LastFmSearch as SearchProvider,
};
