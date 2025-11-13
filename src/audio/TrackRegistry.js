const TRACK_LIST = [
  {
    id: "track01",
    title: "Shiny City",
    artist: "Emergent Properties",
    filename: "01 - Shiny City.mp3"
  },
  {
    id: "track02",
    title: "Shadowline",
    artist: "Emergent Properties",
    filename: "02 - Shadowline.mp3"
  },
  {
    id: "track03",
    title: "Glass Feed",
    artist: "Emergent Properties",
    filename: "03 - Glass Feed.mp3"
  },
  {
    id: "track04",
    title: "Pressure Line",
    artist: "Emergent Properties",
    filename: "04 - Pressure Line.mp3"
  },
  {
    id: "track05",
    title: "Nobody's Brand",
    artist: "Emergent Properties",
    filename: "05 - Nobody's Brand.mp3"
  },
  {
    id: "track06",
    title: "Reload Reload",
    artist: "Emergent Properties",
    filename: "06 - Reload Reload.mp3"
  },
  {
    id: "track07",
    title: "Bit by Bit",
    artist: "Emergent Properties",
    filename: "07 - Bit by Bit.mp3"
  },
  {
    id: "track08",
    title: "Like Water",
    artist: "Emergent Properties",
    filename: "08 - Like Water.mp3"
  },
  {
    id: "track09",
    title: "Grooving Out",
    artist: "Emergent Properties",
    filename: "09 - Grooving Out.mp3"
  },
  {
    id: "track10",
    title: "Built Different",
    artist: "Emergent Properties",
    filename: "10 - Built Different.mp3"
  },
  {
    id: "track11",
    title: "Cooking Up",
    artist: "Emergent Properties",
    filename: "11 - Cooking Up.mp3"
  }
];

const AUDIO_BASE_PATH = "./audio";

export class TrackRegistry {
  constructor(trackList = TRACK_LIST) {
    this._tracks = trackList.map((track, index) => {
      const id = track.id ?? `track${String(index + 1).padStart(2, "0")}`;
      const defaultPresetId = track.defaultPresetId ?? `${id}-default`;
      const presetFile = track.presetFile ?? `${id}.json`;
      return {
        ...track,
        id,
        index,
        src: this._buildSrc(track.filename),
        defaultPresetId,
        presetFile
      };
    });
  }

  listTracks() {
    return this._tracks.slice();
  }

  getTrackById(trackId) {
    if (!trackId) return null;
    return this._tracks.find((track) => track.id === trackId) ?? null;
  }

  getDefaultTrack() {
    return this._tracks[0] ?? null;
  }

  _buildSrc(filename) {
    if (!filename) {
      throw new Error("Track filename is required");
    }
    return `${AUDIO_BASE_PATH}/${filename}`;
  }
}
