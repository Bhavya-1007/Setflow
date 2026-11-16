# Discover and Set Breakdown

The three navigation links are **Set Planner**, **Discover**, and **Set Breakdown**. The existing planner still requires an account. The new read-only tools are public, do not write to the database, and do not use paid AI calls.

## Discover

- Search the live Deezer catalog by title and artist. Choose a recording by title, version, artist, album, and duration.
- Supported pasted links: canonical HTTPS Deezer tracks, Spotify tracks, and YouTube song videos. Deezer links resolve to an exact recording. Spotify/YouTube metadata seeds a catalog search; the user must choose the intended version. Albums, playlists, short redirect links, and arbitrary hosts are rejected.
- Suggestions come from Deezer's artist radio and are ranked by absolute catalog BPM distance if both recordings have BPM. This is **artist-based discovery, not song-level audio similarity**. The page explains this and offers auditioning guidance; it does not claim a guaranteed beatmatch.
- Track identities, art, preview URLs, and available BPM come from catalog results. Zero BPM means missing. This provider has no key data, so keys are shown as unavailable. There are no generated song names or invented exact musical attributes.
- Previews may be unavailable by region or expire; catalog/listening links remain available. Playing one preview pauses the others.

## Set Breakdown: audio access

**Current link-only audio coverage: zero YouTube URLs**, including Cappadocia and Four Tet. Analyze retrieves available published labels, reports unsupported audio access and offers a file fallback. Metadata and embedded playback do not supply analyzable audio.

Provider review (2026-11-16): YouTube Data API supplies metadata; its IFrame API controls playback without delivering raw audio/PCM. AudD Enterprise and ACRCloud document recognition from submitted sources, but no raw-audio delivery entitlement for arbitrary public YouTube URLs was verified. Enabling link-only analysis requires a documented audio-delivery endpoint, confirmed coverage and permissions, and any required credentials. Project permission alone does not create that endpoint. No paid service or new credentials were added.

## Local audio analysis

Files stay on the user's device. Web Audio decodes the file; a module worker analyzes 30-second segments at 11025 Hz. Limits are 200 MiB, 8 seconds to 2 hours, mono/stereo, subject to browser codec and memory support. Entire-file decoding may exceed memory on smaller devices. The louder channel is selected to avoid stereo phase cancellation.

- BPM as played: spectral-flux autocorrelation over 70–180 BPM, with low/medium confidence and half/double-time ambiguity. Weak evidence returns unavailable.
- Estimated key: chroma/profile matching with unavailable output for ambiguous or insufficient tonal evidence. Confidence is heuristic, not a calibrated probability.
- Relative energy: RMS level normalized within this file (10th–90th percentile), not catalog energy or perceived musical excitement. Silence stays unavailable and near-constant levels are neutral.
- Likely transition windows: changes in level, timbre and tonal features in five-second windows. All candidates are low confidence; drops, breakdowns and edits can look similar. These are not measured blend boundaries.
- Unknown songs retain measurements. Posted labels are applied only when users declare that the file matches the video and optionally supply an offset. Alignment is user-supplied and unverified.
- Segment clicks seek local audio, or the YouTube embed when alignment is enabled. Timestamped external links handle restricted embedding.

These are prototype heuristic measurements, not a validated professional audio analyzer. No song fingerprint recognition is enabled.

## Published labels

Public watch-page descriptions are parsed without retrieving audio. Optional server-side YOUTUBE_API_KEY uses videos.list for metadata only. Public page access is best-effort; missing metadata is a warning, not evidence that no tracklist exists. Pasted labels work independently. Retrieval checks descriptions, not comments/external sites.

The parser preserves versions, unknown IDs, ambiguous duplicate timestamps and non-song sections. Entry timestamps do not establish blend boundaries. At most 199 cues are retained. Up to 12 named cues receive conservative exact artist/full-title catalog matching. Catalog/posted BPM is displayed separately, never used as measured tempo or energy. The previous tempo-only energy proxy is removed. Spotify, SoundCloud and YouTube links are labelled Search or Posted link; posted links are not independently verified identity matches.

Provider requests use fixed origins, validated IDs, timeouts, size limits, bounded caching and no redirects. APIs enforce same-origin requests, a 40 KB body limit and best-effort per-instance rate limiting.

## Validation (2026-11-16)

- node --test: 28 passing tests, including existing planner tests, silence/uncertainty, known synthetic tempo/key, relative levels, transition candidates, unsupported audio access and metadata recovery.
- Production build passes with Next.js 16.4.6.
- Live Discover regression: Daft Punk – One More Time (Deezer 3135553), 15 choices and 8 real recommendations.
- Cappadocia RvRhUHTV_8k: 14 published track cues plus interview; **audio unsupported**, no measured results. Local metadata duration 1:24:28.
- Four Tet Ca6pjR2TLns: no timestamped description tracklist, unidentified section; **audio unsupported**, no invented measurements. Local metadata duration 1:17:40.
- Browser fallback: a generated 60-second test file (not either real mix) decoded and ran through the worker: 119.9/150.3 BPM, C major/D minor, relative energy 0/100, transition candidate 0:22–0:37 around the known 30-second change. Unknown names retained measurements. Clicking the second segment played local audio at 30.2 seconds. Enabling alignment for a navigation-only test set the iframe to start=30; this does not establish that the fixture is actual video audio.
- Actual DJ-mix measurement accuracy remains unvalidated: no authorized source audio file or verified URL audio provider was available. Synthetic tests validate pipeline behavior, not real-world accuracy.
- Vercel may omit video duration; missing metadata remains labelled unavailable. Preview authentication is unchanged.

## Provider references

- [YouTube metadata](https://developers.google.com/youtube/v3/docs/videos/list)
- [YouTube IFrame API](https://developers.google.com/youtube/iframe_api_reference)
- [YouTube developer policies](https://developers.google.com/youtube/terms/developer-policies)
- [AudD Enterprise](https://docs.audd.io/enterprise/)
- [ACRCloud file scanning](https://docs.acrcloud.com/reference/console-api/file-scanning)
