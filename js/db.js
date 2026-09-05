// 曲データベースと履歴の保存を担当するモジュール
// 将来的にサーバーDBやJOYSOUND連携に差し替えやすいよう、
// 「読み書きのインターフェース」をこのファイルに閉じ込めている。

const STORAGE_KEYS = {
  history: 'kkf_history',
  customSongs: 'kkf_custom_songs',
};

// サンプルの日本語カラオケ楽曲データベース（初期データ）
const DEFAULT_SONGS = [
  { id: 's1', title: 'Lemon', artist: '米津玄師', gender: 'male', genre: 'pop', era: 'recent', range: 'high', difficulty: 'medium' },
  { id: 's2', title: '前前前世', artist: 'RADWIMPS', gender: 'male', genre: 'rock', era: 'recent', range: 'high', difficulty: 'hard' },
  { id: 's3', title: '花束を君に', artist: '宇多田ヒカル', gender: 'female', genre: 'ballad', era: 'recent', range: 'medium', difficulty: 'medium' },
  { id: 's4', title: '恋', artist: '星野源', gender: 'male', genre: 'pop', era: 'recent', range: 'medium', difficulty: 'easy' },
  { id: 's5', title: '紅蓮華', artist: 'LiSA', gender: 'female', genre: 'rock', era: 'recent', range: 'high', difficulty: 'hard' },
  { id: 's6', title: 'First Love', artist: '宇多田ヒカル', gender: 'female', genre: 'ballad', era: 'old', range: 'medium', difficulty: 'medium' },
  { id: 's7', title: '世界に一つだけの花', artist: 'SMAP', gender: 'group', genre: 'pop', era: 'old', range: 'medium', difficulty: 'easy' },
  { id: 's8', title: '川の流れのように', artist: '美空ひばり', gender: 'female', genre: 'ballad', era: 'old', range: 'medium', difficulty: 'medium' },
  { id: 's9', title: 'リンダリンダ', artist: 'THE BLUE HEARTS', gender: 'male', genre: 'rock', era: 'old', range: 'high', difficulty: 'hard' },
  { id: 's10', title: '366日', artist: 'HY', gender: 'male', genre: 'ballad', era: 'recent', range: 'low', difficulty: 'easy' },
  { id: 's11', title: 'Pretender', artist: 'Official髭男dism', gender: 'male', genre: 'pop', era: 'recent', range: 'high', difficulty: 'hard' },
  { id: 's12', title: '打上花火', artist: 'DAOKO×米津玄師', gender: 'group', genre: 'pop', era: 'recent', range: 'medium', difficulty: 'medium' },
  { id: 's13', title: 'さくら', artist: '森山直太朗', gender: 'male', genre: 'ballad', era: 'old', range: 'medium', difficulty: 'medium' },
  { id: 's14', title: '香水', artist: '瑛人', gender: 'male', genre: 'pop', era: 'recent', range: 'low', difficulty: 'easy' },
  { id: 's15', title: 'TSUNAMI', artist: 'サザンオールスターズ', gender: 'male', genre: 'rock', era: 'old', range: 'medium', difficulty: 'medium' },
];

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

const DB = {
  getCustomSongs() {
    return loadJSON(STORAGE_KEYS.customSongs, []);
  },

  getAllSongs() {
    return [...DEFAULT_SONGS, ...this.getCustomSongs()];
  },

  addCustomSong(song) {
    const songs = this.getCustomSongs();
    const newSong = { id: 'c' + Date.now(), ...song };
    songs.push(newSong);
    saveJSON(STORAGE_KEYS.customSongs, songs);
    return newSong;
  },

  deleteCustomSong(id) {
    const songs = this.getCustomSongs().filter(s => s.id !== id);
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
};
