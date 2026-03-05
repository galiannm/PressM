import { describe, it, expect } from "vitest";
import { parseCommand, INTENT, PROVIDER } from "./parser.js";

describe("skip", () => {
  it.each(["skip", "next", "Skip", "NEXT", "skip song", "next song", "skip track", "next track"])(
    '"%s" → skip intent',
    (input) => {
      const result = parseCommand(input);
      expect(result.intent).toBe(INTENT.SKIP);
      expect(result.query).toBeNull();
      expect(result.provider).toBeNull();
    }
  );
});

describe("play — basic", () => {
  it("play Blinding Lights", () => {
    expect(parseCommand("play Blinding Lights")).toMatchObject({
      intent: INTENT.PLAY,
      query: "blinding lights",
      provider: null,
      isLibrary: false,
    });
  });

  it("play Interstellar soundtrack", () => {
    expect(parseCommand("play Interstellar soundtrack")).toMatchObject({
      intent: INTENT.PLAY,
      query: "interstellar soundtrack",
      isLibrary: false,
    });
  });

  it("play jazz music", () => {
    expect(parseCommand("play jazz music")).toMatchObject({
      intent: INTENT.PLAY,
      query: "jazz music",
    });
  });

  it("strips trailing punctuation", () => {
    expect(parseCommand("play Bohemian Rhapsody.")).toMatchObject({
      intent: INTENT.PLAY,
      query: "bohemian rhapsody",
    });
  });
});

describe("play — library aware", () => {
  it("play my workout playlist", () => {
    expect(parseCommand("play my workout playlist")).toMatchObject({
      intent: INTENT.PLAY,
      query: "workout playlist",
      isLibrary: true,
    });
  });

  it("play my chill playlist", () => {
    expect(parseCommand("play my chill playlist")).toMatchObject({
      intent: INTENT.PLAY,
      query: "chill playlist",
      isLibrary: true,
    });
  });

  it("play my gym mix", () => {
    expect(parseCommand("play my gym mix")).toMatchObject({
      intent: INTENT.PLAY,
      query: "gym mix",
      isLibrary: true,
    });
  });
});

describe("play — provider selection", () => {
  it("play Never Gonna Give You Up on Spotify", () => {
    expect(parseCommand("play Never Gonna Give You Up on Spotify")).toMatchObject({
      intent: INTENT.PLAY,
      query: "never gonna give you up",
      provider: PROVIDER.SPOTIFY,
      isLibrary: false,
    });
  });

  it("play lofi hip hop on YouTube", () => {
    expect(parseCommand("play lofi hip hop on YouTube")).toMatchObject({
      intent: INTENT.PLAY,
      query: "lofi hip hop",
      provider: PROVIDER.YOUTUBE,
    });
  });

  it("play Daft Punk on Apple Music", () => {
    expect(parseCommand("play Daft Punk on Apple Music")).toMatchObject({
      intent: INTENT.PLAY,
      query: "daft punk",
      provider: PROVIDER.APPLE_MUSIC,
    });
  });

  it("play Daft Punk on Apple (short form)", () => {
    expect(parseCommand("play Daft Punk on Apple")).toMatchObject({
      intent: INTENT.PLAY,
      provider: PROVIDER.APPLE_MUSIC,
    });
  });

  it("play something on yt", () => {
    expect(parseCommand("play lo-fi beats on yt")).toMatchObject({
      intent: INTENT.PLAY,
      provider: PROVIDER.YOUTUBE,
    });
  });
});

describe("play — library + provider", () => {
  it("play my gym mix on Spotify", () => {
    expect(parseCommand("play my gym mix on Spotify")).toMatchObject({
      intent: INTENT.PLAY,
      query: "gym mix",
      provider: PROVIDER.SPOTIFY,
      isLibrary: true,
    });
  });
});

describe("queue", () => {
  it("insert Midnight City", () => {
    expect(parseCommand("insert Midnight City")).toMatchObject({
      intent: INTENT.QUEUE,
      query: "midnight city",
    });
  });

  it("queue Midnight City", () => {
    expect(parseCommand("queue Midnight City")).toMatchObject({
      intent: INTENT.QUEUE,
      query: "midnight city",
    });
  });

  it("add Time by Pink Floyd to queue", () => {
    expect(parseCommand("add Time by Pink Floyd to queue")).toMatchObject({
      intent: INTENT.QUEUE,
      query: "time by pink floyd",
    });
  });

  it("add song to the queue", () => {
    expect(parseCommand("add Stairway to Heaven to the queue")).toMatchObject({
      intent: INTENT.QUEUE,
      query: "stairway to heaven",
    });
  });

  it("cue Midnight City (Whisper mishearing)", () => {
    expect(parseCommand("cue Midnight City")).toMatchObject({
      intent: INTENT.QUEUE,
      query: "midnight city",
    });
  });

  it("add song to cue (Whisper mishearing)", () => {
    expect(parseCommand("add Time by Pink Floyd to cue")).toMatchObject({
      intent: INTENT.QUEUE,
      query: "time by pink floyd",
    });
  });

  it("queue with provider", () => {
    expect(parseCommand("queue Midnight City on Spotify")).toMatchObject({
      intent: INTENT.QUEUE,
      query: "midnight city",
      provider: PROVIDER.SPOTIFY,
    });
  });
});

describe("unknown", () => {
  it("gibberish returns unknown intent", () => {
    expect(parseCommand("blah blah blah")).toMatchObject({
      intent: INTENT.UNKNOWN,
    });
  });

  it("empty-ish input", () => {
    expect(parseCommand("  ")).toMatchObject({
      intent: INTENT.UNKNOWN,
    });
  });
});
