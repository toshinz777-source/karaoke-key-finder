// データアクセス層。
//
// 曲データベースは data/songs.json から非同期に読み込む前提にしてある。
// 今はサンプル43曲のJSONファイルだが、インターフェースは
// 「getAllSongs()が曲の配列を返すPromise」だけなので、将来的に
//   - 数千曲規模の外部JSONやAPIに songs.json を差し替える
//   - JOYSOUND楽曲検索APIの結果をマージする
// といった変更をしても、呼び出し側(app.js/analysis.js)は変更不要。
// 履歴(history)と自分で追加した曲(customSongs)はこれまで通り
// localStorageに保存する（ログイン不要のMVP方針を維持）。

const STORAGE_KEYS = {
  history: 'kkf_history',
  customSongs: 'kkf_custom_songs',
  measuredRange: 'kkf_measured_range',
};

const SONGS_DATA_URL = 'data/songs.json';

// 曲データベース本体を保持する場所。将来ここを
// 「JOYSOUND検索結果」や「サーバーAPIのレスポンス」に差し替えても、
// getAllSongs()を呼ぶ側のコードは変わらない。
const SongSource = {
  _cache: null,

  async getBuiltInSongs() {
    if (this._cache) return this._cache;
    const res = await fetch(SONGS_DATA_URL);
    if (!res.ok) throw new Error(`曲データベースの読み込みに失敗しました (${res.status})`);
    this._cache = await res.json();
    return this._cache;
  },

  // --- 拡張ポイント（未実装） ---
  // 本物のJOYSOUND検索や大規模DBに接続する際は、ここに実装を追加し、
  // getAllSongs()内でマージする形にする。今は呼ばれても空配列を返すだけ。
  async searchJoysound(_query) {
    return [];
  },
};

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// 古いバージョンで保存されたカスタム曲(音域レベルのみ・音名なし)でも
// 落ちないように、音名が無ければ一般的な音域で補う
function withNoteDefaults(song) {
  return {
    lowestNote: 'A3',
    highestNote: 'D5',
    originalKey: null,
    joysound: null,
    ...song,
  };
}

const DB = {
  async getBuiltInSongs() {
    const songs = await SongSource.getBuiltInSongs();
    return songs.map(withNoteDefaults);
  },

  getCustomSongs() {
    return loadJSON(STORAGE_KEYS.customSongs, []).map(withNoteDefaults);
  },

  async getAllSongs() {
    const [builtIn, custom] = [await this.getBuiltInSongs(), this.getCustomSongs()];
    return [...builtIn, ...custom];
  },

  addCustomSong(song) {
    const songs = loadJSON(STORAGE_KEYS.customSongs, []);
    const newSong = { id: 'c' + Date.now(), ...song };
    songs.push(newSong);
    saveJSON(STORAGE_KEYS.customSongs, songs);
    return newSong;
  },

  deleteCustomSong(id) {
    const songs = loadJSON(STORAGE_KEYS.customSongs, []).filter(s => s.id !== id);
    saveJSON(STORAGE_KEYS.customSongs, songs);
  },

  getHistory() {
    return loadJSON(STORAGE_KEYS.history, [])
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  },

  addHistory(entry) {
    const history = loadJSON(STORAGE_KEYS.history, []);
    const newEntry = { id: 'h' + Date.now(), date: new Date().toISOString(), ...entry };
    history.push(newEntry);
    saveJSON(STORAGE_KEYS.history, history);
    return newEntry;
  },

  deleteHistory(id) {
    const history = loadJSON(STORAGE_KEYS.history, []).filter(h => h.id !== id);
    saveJSON(STORAGE_KEYS.history, history);
  },

  // マイクで測定した声域(半音/MIDI番号)。{low, high, measuredAt, sampleCount}
  getMeasuredRange() {
    return loadJSON(STORAGE_KEYS.measuredRange, null);
  },

  saveMeasuredRange(range) {
    saveJSON(STORAGE_KEYS.measuredRange, { ...range, measuredAt: new Date().toISOString() });
  },

  clearMeasuredRange() {
    localStorage.removeItem(STORAGE_KEYS.measuredRange);
  },
};
