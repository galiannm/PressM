export const INTENT = {
  PLAY: "play",
  SKIP: "skip",
  QUEUE: "queue",
  UNKNOWN: "unknown",
};

export const PROVIDER = {
  SPOTIFY: "spotify",
  APPLE_MUSIC: "apple_music",
  YOUTUBE: "youtube",
};

const PROVIDER_ALIASES = {
  spotify: PROVIDER.SPOTIFY,
  "apple music": PROVIDER.APPLE_MUSIC,
  apple: PROVIDER.APPLE_MUSIC,
  youtube: PROVIDER.YOUTUBE,
  yt: PROVIDER.YOUTUBE,
};

// Matches: "on spotify", "on apple music", "on youtube", "on yt"
const PROVIDER_SUFFIX_RE = /\s+on\s+(spotify|apple\s+music|apple|youtube|yt)$/i;

// Matches: "skip", "next", "skip song", "next song", "skip track", "next track"
const SKIP_RE = /^(skip|next)(\s+(song|track))?$/i;

// Matches: "play ..."
const PLAY_RE = /^play\s+(.+)$/i;

// Matches: "queue ...", "cue ...", "insert ..."
// "cue" and "q" are common Whisper mishearings of "queue"
const QUEUE_PREFIX_RE = /^(?:queue|cue|q|insert)\s+(.+)$/i;

// Matches: "add ... to queue/cue", "add ... to the queue/cue"
const QUEUE_ADD_RE = /^add\s+(.+?)\s+to\s+(?:the\s+)?(?:queue|cue)$/i;

// Matches leading "my " indicating user library
const LIBRARY_RE = /^my\s+/i;

/**
 * Parse a raw voice transcript into a structured command.
 *
 * @param {string} raw
 * @returns {{ intent: string, query: string|null, provider: string|null, isLibrary: boolean }}
 */
export function parseCommand(raw) {
  // Normalise: lowercase, strip trailing punctuation
  const text = raw.trim().toLowerCase().replace(/[.,!?]+$/, "");

  // 1. Skip
  if (SKIP_RE.test(text)) {
    return { intent: INTENT.SKIP, query: null, provider: null, isLibrary: false };
  }

  // 2. Extract "on <provider>" suffix before matching the rest
  let provider = null;
  let body = text;
  const providerMatch = text.match(PROVIDER_SUFFIX_RE);
  if (providerMatch) {
    const alias = providerMatch[1].toLowerCase();
    provider = PROVIDER_ALIASES[alias] ?? null;
    body = text.slice(0, providerMatch.index).trim();
  }

  // 3. Play
  const playMatch = body.match(PLAY_RE);
  if (playMatch) {
    let query = playMatch[1].trim();
    const isLibrary = LIBRARY_RE.test(query);
    if (isLibrary) query = query.replace(LIBRARY_RE, "").trim();
    return { intent: INTENT.PLAY, query, provider, isLibrary };
  }

  // 4. Queue (prefix form)
  const queuePrefixMatch = body.match(QUEUE_PREFIX_RE);
  if (queuePrefixMatch) {
    return { intent: INTENT.QUEUE, query: queuePrefixMatch[1].trim(), provider, isLibrary: false };
  }

  // 5. Queue (add ... to queue form)
  const queueAddMatch = body.match(QUEUE_ADD_RE);
  if (queueAddMatch) {
    return { intent: INTENT.QUEUE, query: queueAddMatch[1].trim(), provider, isLibrary: false };
  }

  return { intent: INTENT.UNKNOWN, query: text, provider, isLibrary: false };
}
