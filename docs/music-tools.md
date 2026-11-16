# Discover and Set Breakdown

The three navigation links are **Set Planner**, **Discover**, and **Set Breakdown**. The existing planner still requires an account. The new read-only tools are public, do not write to the database, and do not use paid AI calls.

## Discover

- Search the live Deezer catalog by title and artist. Choose a recording by title, version, artist, album, and duration.
- Supported pasted links: canonical HTTPS Deezer tracks, Spotify tracks, and YouTube song videos. Deezer links resolve to an exact recording. Spotify/YouTube metadata seeds a catalog search; the user must choose the intended version. Albums, playlists, short redirect links, and arbitrary hosts are rejected.
- Suggestions come from Deezer's artist radio and are ranked by absolute catalog BPM distance if both recordings have BPM. This is **artist-based discovery, not song-level audio similarity**. The page explains this and offers auditioning guidance; it does not claim a guaranteed beatmatch.
- Track identities, art, preview URLs, and available BPM come from catalog results. Zero BPM means missing. This provider has no key data, so keys are shown as unavailable. There are no generated song names or invented exact musical attributes.
- Previews may be unavailable by region or expire; catalog/listening links remain available. Playing one preview pauses the others.

## Set Breakdown

- Accepts public YouTube video URLs. Uses the public watch-page description and duration without retrieving audio. If `YOUTUBE_API_KEY` is configured, uses YouTube Data API v3 `videos.list` (`snippet,contentDetails`) instead. The key is optional and server-only; it is not required for the tested first version.
- A description-access error is shown as an error, never as proof that a tracklist does not exist. Public page metadata is best-effort: YouTube can change its page format or limit server access. The API-key option is the more stable integration.
- Parses timestamps before or after an artist–title entry, preserves remix text, sorts cues, retains unknown IDs, flags duplicate timestamps as ambiguous, and separates intro/interview/outro sections. A pasted tracklist can replace the description, clearly labelled user-supplied and unverified.
- Automatic retrieval only checks the video description, **not comments or external tracklist sites**. A tracklist posted elsewhere can be pasted manually. No claim is made that an entire video has no tracklist anywhere.
- Cue and timeline buttons reload the embedded player at the selected second. A timestamped YouTube link is provided when embedding is restricted. Browser autoplay restrictions may require pressing Play after jumping.
- A cue marks a posted track entry. Timeline blocks span to the next cue for navigation only. They do not prove that a track plays throughout that interval, and no identification-coverage percentage is shown. Exact blend boundaries are unknown unless the source explicitly supplies a timestamp range labelled transition/blend/mix in/mix out.
- Missing leading sections and unknown tracks remain striped. Unposted changes can also occur between known cues. At most 199 cues are retained; an oversized tracklist gets a final unprocessed section and warning.
- For up to 12 named entries, exact normalized artist **and full version title** must match before attaching catalog BPM/listening metadata. This conservative matching deliberately leaves ambiguous remixes and collaborations unmatched.
- BPM is posted or catalog recording metadata, not measured DJ playback tempo. Explicitly posted energy values are retained. Otherwise, if BPM exists, a **tempo-only energy estimate** maps 70–180 BPM linearly to 1–10, clamped to that range. This is not measured loudness or musical intensity. Estimated points/lines are labelled; missing values are blank and lines do not bridge missing cues.
- Spotify, SoundCloud, and YouTube destinations are labelled **Search** unless the posted track row includes a valid direct platform URL, in which case they are labelled **Posted link** (not independently verified). An exact catalog match adds a direct Deezer link. No cross-platform identity match is fabricated.

## Audio recognition is not enabled

A complete recognition pipeline would require an account/API token for a service such as AudD, an appropriate long-file/enterprise plan, and a supported, authorized audio source accepted by that service. Provider support for the particular source must be confirmed before enabling it; a public YouTube URL alone is not permission or a guarantee of audio access. Recognition also would not by itself establish exact blend boundaries, musical keys, or an energy curve. No audio downloader, paid recognition service, or new credentials were added.

## Reliability and limits

Provider requests use fixed origins, validated IDs, a 12-second timeout, response-size limits, a short bounded memory cache, and no redirect following. API requests are same-origin checked with a 40 KB body limit and a best-effort per-instance rate limit. The latter is not a distributed abuse-prevention service. Catalog enrichment is bounded to 12 tracks. If catalog enrichment fails, the source cues are still returned with a warning.

## Validation (2026-11-16)

- `npm test`: 21 tests passed, including the existing planner runtime tests and new URL safety, version preservation, timestamps, ambiguous overlaps, explicit transition ranges, provenance, missing-data and provider-error tests.
- `npm run test:music:live`: passed against real public services. Provider results can change.
  - Discover: **Daft Punk – One More Time**, Deezer ID `3135553`. Search returned 15 choices; recommendation lookup returned 8 real songs with catalog links and previews. Some suggestions had BPM and others correctly did not. The seed had no catalog BPM.
  - [Ben Böhmer above Cappadocia for Cercle](https://www.youtube.com/watch?v=RvRhUHTV_8k): duration **1:24:28**, **14 posted track cues**, **1 interview section**, **0 explicit blend ranges**. Only 1 cue acquired an exact catalog BPM match in this run; other curve data remained missing.
  - [Four Tet (live set), Boiler Room London](https://www.youtube.com/watch?v=Ca6pjR2TLns): duration **1:17:40**, **no timestamped tracklist in its description**, **1 unidentified full-length section**, **no invented songs, BPM, energy, or transitions**.
- Next.js and its matching `@next/env` package were patched from 16.4.4 to 16.4.6 because the existing dependency advisory interrupted fresh production builds. Registry advisory [GHSA-mfr8-8qww-v76h](https://github.com/advisories/GHSA-mfr8-8qww-v76h) concerns `use cache` functions called through `unstable_cache()`. The package-lock update reported zero vulnerabilities.
- The final production build on Next.js 16.4.6 passed without the security warning. All three supported song-link forms (Deezer, Spotify, YouTube) were also checked live with One More Time and returned the intended catalog recording among the choices.
- Browser QA: song search and exact-version selection returned eight suggestions; clicking Cappadocia's **6:20** cue changed the embed to `start=380` and the player reported **6:21** elapsed. Four Tet's no-tracklist result showed a striped unidentified span and empty charts. Its embed was unavailable in this browser; the timestamped external YouTube fallback remained available. A 390 px viewport had no document overflow.
- HTTP validation: unsupported catalog URL **400**, spoofed YouTube hostname **400**, cross-origin request **403**.

## Provider references

- [Deezer API](https://developers.deezer.com/api)
- [YouTube video metadata](https://developers.google.com/youtube/v3/docs/videos/list)
- [YouTube embedded-player parameters](https://developers.google.com/youtube/player_parameters)
- [AudD recognition documentation](https://docs.audd.io/)
