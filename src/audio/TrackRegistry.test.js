import { TrackRegistry } from "./TrackRegistry.js";

describe("TrackRegistry", () => {
  it("returns the full bundled track list", () => {
    const registry = new TrackRegistry();
    const tracks = registry.listTracks();

    expect(tracks).toHaveLength(11);
    expect(tracks[0].id).toBe("track01");
    expect(tracks[10].title).toBe("Cooking Up");
  });

  it("resolves tracks by id and exposes file paths", () => {
    const registry = new TrackRegistry();
    const track = registry.getTrackById("track05");

    expect(track).toBeDefined();
    expect(track.filename).toBe("05 - Nobody's Brand.mp3");
    expect(track.src).toBe("./audio/05 - Nobody's Brand.mp3");
  });

  it("returns null for unknown ids", () => {
    const registry = new TrackRegistry();
    expect(registry.getTrackById("unknown")).toBeNull();
  });
});
