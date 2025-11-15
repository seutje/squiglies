import { describe, expect, test, beforeEach, afterEach, jest } from "@jest/globals";
import { AudioManager, AudioState } from "./AudioManager.js";

if (typeof globalThis.CustomEvent !== "function") {
  class CustomEventPolyfill extends Event {
    constructor(type, params = {}) {
      super(type, params);
      this.detail = params.detail ?? null;
    }
  }
  globalThis.CustomEvent = CustomEventPolyfill;
}

class MockAudioBufferSourceNode {
  constructor() {
    this.start = jest.fn();
    this.stop = jest.fn();
    this.connect = jest.fn();
    this.disconnect = jest.fn();
    this.onended = null;
    this.buffer = null;
  }
}

class MockAudioContext {
  constructor() {
    this.currentTime = 5;
    this.state = "running";
    this.destination = {};
    this.createBufferSource = jest.fn(() => new MockAudioBufferSourceNode());
    this.createGain = jest.fn(() => ({
      gain: { value: 1 },
      connect: jest.fn(),
      disconnect: jest.fn()
    }));
    this.resume = jest.fn(async () => {});
  }

  advanceTime(seconds) {
    this.currentTime += seconds;
  }
}

describe("AudioManager playback delay", () => {
  let manager;
  let context;

  beforeEach(() => {
    manager = new AudioManager({ trackRegistry: { getTrackById: () => null } });
    context = new MockAudioContext();
    manager.audioContext = context;
    manager.currentBuffer = { duration: 120 };
    manager.state = AudioState.READY;
    manager.dispatchEvent = jest.fn();
    jest.spyOn(manager, "_startTimeUpdates").mockImplementation(() => {});
    jest.spyOn(manager, "_emitTimeUpdate").mockImplementation(() => {});
    jest.spyOn(manager, "_emitMessage").mockImplementation(() => {});
    jest.spyOn(manager, "_emitError").mockImplementation(() => {});
    jest.spyOn(manager, "_getGainNode").mockReturnValue({ connect: jest.fn() });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("delays playback by one second when starting from rest", async () => {
    const baseTime = context.currentTime;
    await manager.play();
    const expectedStart = baseTime + manager._startDelaySeconds;
    expect(manager.sourceNode.start).toHaveBeenCalledWith(expectedStart, 0);
    expect(manager.playbackStartTime).toBeCloseTo(expectedStart, 5);
    expect(manager.state).toBe(AudioState.PLAYING);
  });

  test("resumes immediately when continuing from a paused offset", async () => {
    manager.pauseOffset = 12;
    const baseTime = context.currentTime;
    await manager.play();
    expect(manager.sourceNode.start).toHaveBeenCalledWith(baseTime, 12);
    expect(manager.playbackStartTime).toBeCloseTo(baseTime - 12, 5);
  });

  test("seeking to the start while playing reapplies the lead-in delay", async () => {
    await manager.play();
    context.advanceTime(0.5);
    manager.seek(0);
    const latestSource = manager.sourceNode;
    const expectedStart = context.currentTime + manager._startDelaySeconds;
    expect(latestSource.start).toHaveBeenCalledWith(expectedStart, 0);
  });
});

describe("AudioManager track sequencing", () => {
  let manager;
  let registry;

  beforeEach(() => {
    registry = {
      getTrackById: () => null,
      getNextTrack: jest.fn()
    };
    manager = new AudioManager({ trackRegistry: registry });
    manager.dispatchEvent = jest.fn();
    jest.spyOn(manager, "_emitTimeUpdate").mockImplementation(() => {});
    jest.spyOn(manager, "_emitError").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("playNextTrack loads and plays the next bundled track", async () => {
    manager.currentTrack = { id: "track01" };
    registry.getNextTrack.mockReturnValue({ id: "track02" });
    const loadSpy = jest.spyOn(manager, "loadTrack").mockResolvedValue({});
    const playSpy = jest.spyOn(manager, "play").mockResolvedValue();

    const result = await manager.playNextTrack();

    expect(registry.getNextTrack).toHaveBeenCalledWith("track01");
    expect(loadSpy).toHaveBeenCalledWith("track02");
    expect(playSpy).toHaveBeenCalled();
    expect(result).toEqual({ id: "track02" });
  });

  test("playNextTrack returns null when no additional tracks are available", async () => {
    registry.getNextTrack.mockReturnValue(null);
    const loadSpy = jest.spyOn(manager, "loadTrack").mockResolvedValue({});
    const playSpy = jest.spyOn(manager, "play").mockResolvedValue();

    const result = await manager.playNextTrack();

    expect(result).toBeNull();
    expect(loadSpy).not.toHaveBeenCalled();
    expect(playSpy).not.toHaveBeenCalled();
  });

  test("_handlePlaybackEnded auto-advances to the next bundled track", () => {
    manager.currentTrack = { id: "track03" };
    manager.currentBuffer = { duration: 200 };
    jest.spyOn(manager, "_teardownSource").mockImplementation(() => {});
    jest.spyOn(manager, "_setState").mockImplementation(() => {});
    const advanceSpy = jest.spyOn(manager, "playNextTrack").mockResolvedValue(null);

    manager._handlePlaybackEnded();

    expect(advanceSpy).toHaveBeenCalled();
  });

  test("_autoAdvanceToNextTrack skips user-loaded tracks", () => {
    manager.currentTrack = { id: "user-track", isUserTrack: true };
    const advanceSpy = jest.spyOn(manager, "playNextTrack").mockResolvedValue(null);

    manager._autoAdvanceToNextTrack();

    expect(advanceSpy).not.toHaveBeenCalled();
  });
});
