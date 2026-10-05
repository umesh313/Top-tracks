ALTER TABLE public.artists ADD COLUMN musicbrainz_id uuid;
CREATE UNIQUE INDEX artists_musicbrainz_id_key ON public.artists (musicbrainz_id) WHERE musicbrainz_id IS NOT NULL;

ALTER TABLE public.albums ADD COLUMN musicbrainz_release_group_id uuid;
CREATE UNIQUE INDEX albums_musicbrainz_release_group_id_key ON public.albums (musicbrainz_release_group_id) WHERE musicbrainz_release_group_id IS NOT NULL;

ALTER TABLE public.songs ADD COLUMN musicbrainz_recording_id uuid;
ALTER TABLE public.songs ADD COLUMN isrc text;
CREATE UNIQUE INDEX songs_musicbrainz_recording_id_key ON public.songs (musicbrainz_recording_id) WHERE musicbrainz_recording_id IS NOT NULL;
CREATE INDEX songs_isrc_idx ON public.songs (isrc) WHERE isrc IS NOT NULL;

GRANT INSERT, UPDATE ON public.albums TO authenticated;
CREATE POLICY "admin write albums" ON public.albums FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

COMMENT ON COLUMN public.artists.musicbrainz_id IS 'Stable MusicBrainz artist identifier used for catalog deduplication.';
COMMENT ON COLUMN public.albums.musicbrainz_release_group_id IS 'Stable MusicBrainz release-group identifier used for catalog deduplication.';
COMMENT ON COLUMN public.songs.musicbrainz_recording_id IS 'Stable MusicBrainz recording identifier used for catalog deduplication.';
COMMENT ON COLUMN public.songs.isrc IS 'International Standard Recording Code when supplied by MusicBrainz.';