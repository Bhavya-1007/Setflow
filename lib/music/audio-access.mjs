import { youtubeId } from './providers.mjs';

// Coverage is deliberately empty until an actual audio-delivery integration is verified.
// Recognition metadata, iframe playback and public visibility are not raw-audio sources.
export function youtubeAudioAccess(url) {
  return { videoId: youtubeId(url), status: 'unsupported', code: 'NO_VERIFIED_AUDIO_SOURCE',
    supported: false, supportedYouTubeIds: [],
    message: 'Audio analysis from this YouTube link is unavailable. No verified audio-delivery integration is connected. A public video or posted tracklist does not provide analyzable audio.',
    fallback: 'Choose a mix audio file below. It is analyzed on your device; the file is not uploaded to SetFlow.',
    coverage: 'Currently no YouTube URLs support link-only audio analysis, including the Cappadocia and Four Tet test sets. Video playback and published track labels may still be available.',
  };
}
