// UIの描画とイベント処理をまとめたモジュール。

const GENDER_LABEL = { male: '男性', female: '女性', group: 'グループ' };
const GENRE_LABEL = { pop: 'ポップ', ballad: 'バラード', rock: 'ロック' };
const ERA_LABEL = { old: '昔の曲', recent: '最近の曲' };
const RANGE_LABEL = { low: '低め', medium: '普通', high: '高め' };
const DIFFICULTY_LABEL = { easy: '易しい', medium: '普通', hard: '難しい' };

let activeFilters = new Set();

// ---------- ナビゲーション ----------

function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  document.getElementById(`view-${name}`).classList.remove('hidden');
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.nav === name);
  });
  if (name === 'home') renderHome();
  if (name === 'mysongs') renderHistory();
  if (name === 'recommend') renderRecommendations();
  if (name === 'profile') renderProfile();
  if (name === 'addsong') renderCustomSongs();
}

document.querySelectorAll('[data-nav]').forEach(el => {
  el.addEventListener('click', () => showView(el.dataset.nav));
});

// ---------- ホーム ----------

function renderHome() {
  const history = DB.getHistory();
  const profile = computeVoiceProfile(history);
  document.getElementById('home-count').textContent = history.length;
  document.getElementById('home-key').textContent = profile ? formatKey(profile.comfortableKey) : '-';
  document.getElementById('home-score').textContent = profile && profile.avgScore !== null ? profile.avgScore : '-';
}

// ---------- マイ楽曲 ----------

function historyCardHtml(entry) {
  return `
    <div class="song-card" data-id="${entry.id}">
      <p class="song-title">${escapeHtml(entry.title)}</p>
      <p class="song-artist">${escapeHtml(entry.artist)}</p>
      <div class="badge-row">
        <span class="badge key">キー: ${formatKey(entry.keyAdjust)}</span>
        ${entry.score !== null && entry.score !== undefined && entry.score !== '' ? `<span class="badge score">スコア ${entry.score}</span>` : ''}
        <span class="badge ease">歌いやすさ ${'★'.repeat(entry.ease)}${'☆'.repeat(5 - entry.ease)}</span>
      </div>
      ${entry.notes ? `<p class="song-notes">${escapeHtml(entry.notes)}</p>` : ''}
      <div class="card-actions">
        <button class="small-btn danger" data-action="delete-history" data-id="${entry.id}">削除する</button>
      </div>
    </div>
  `;
}

function renderHistory() {
  const history = DB.getHistory();
  const list = document.getElementById('history-list');
  const empty = document.getElementById('history-empty');
  if (history.length === 0) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  list.innerHTML = history.map(historyCardHtml).join('');
}

document.getElementById('history-list').addEventListener('click', e => {
  const btn = e.target.closest('[data-action="delete-history"]');
  if (!btn) return;
  if (confirm('この記録を削除しますか？')) {
    DB.deleteHistory(btn.dataset.id);
    renderHistory();
  }
});

// ---------- 履歴追加モーダル ----------

const historyModal = document.getElementById('history-modal');
const historySongSelect = document.getElementById('history-song-select');
const historyKeySelect = document.getElementById('history-key');
const easeSelect = document.getElementById('history-ease');
let selectedEase = 0;

function populateKeySelect() {
  historyKeySelect.innerHTML = '';
  for (let k = -5; k <= 5; k++) {
    const opt = document.createElement('option');
    opt.value = k;
    opt.textContent = formatKey(k);
    if (k === 0) opt.selected = true;
    historyKeySelect.appendChild(opt);
  }
}
populateKeySelect();

function populateSongSelect() {
  const songs = DB.getAllSongs();
  historySongSelect.innerHTML = '<option value="">-- 選択しない（手入力） --</option>' +
    songs.map(s => `<option value="${s.id}">${escapeHtml(s.title)} / ${escapeHtml(s.artist)}</option>`).join('');
}

historySongSelect.addEventListener('change', () => {
  const song = DB.getAllSongs().find(s => s.id === historySongSelect.value);
  if (song) {
    document.getElementById('history-title').value = song.title;
    document.getElementById('history-artist').value = song.artist;
  }
});

easeSelect.addEventListener('click', e => {
  const btn = e.target.closest('button');
  if (!btn) return;
  selectedEase = Number(btn.dataset.val);
  [...easeSelect.children].forEach(b => b.classList.toggle('selected', b === btn));
});

function openHistoryModal() {
  populateSongSelect();
  document.getElementById('add-history-form').reset();
  populateKeySelect();
  selectedEase = 0;
  [...easeSelect.children].forEach(b => b.classList.remove('selected'));
  historyModal.classList.remove('hidden');
}

function closeHistoryModal() {
  historyModal.classList.add('hidden');
}

document.getElementById('open-add-history').addEventListener('click', openHistoryModal);
document.getElementById('cancel-history').addEventListener('click', closeHistoryModal);

document.getElementById('add-history-form').addEventListener('submit', e => {
  e.preventDefault();
  if (!selectedEase) {
    alert('歌いやすさを選択してください');
    return;
  }
  const songId = historySongSelect.value || null;
  const song = songId ? DB.getAllSongs().find(s => s.id === songId) : null;
  const scoreRaw = document.getElementById('history-score').value;
  DB.addHistory({
    songId,
    title: document.getElementById('history-title').value.trim(),
    artist: document.getElementById('history-artist').value.trim(),
    keyAdjust: Number(historyKeySelect.value),
    score: scoreRaw === '' ? null : Number(scoreRaw),
    ease: selectedEase,
    notes: document.getElementById('history-notes').value.trim(),
    gender: song ? song.gender : null,
  });
  closeHistoryModal();
  renderHistory();
});

// ---------- おすすめ ----------

function recommendationCardHtml(rec) {
  const song = rec.song;
  return `
    <div class="song-card">
      <p class="song-title">${escapeHtml(song.title)}</p>
      <p class="song-artist">${escapeHtml(song.artist)}</p>
      <div class="badge-row">
        <span class="badge key">おすすめキー: ${formatKey(rec.recommendedKey)}</span>
        <span class="badge match">一致度 ${rec.matchPercent}%</span>
        <span class="badge">難易度: ${DIFFICULTY_LABEL[song.difficulty]}</span>
      </div>
      <p class="song-reason">${escapeHtml(rec.reason)}</p>
    </div>
  `;
}

function songMatchesFilters(song) {
  if (activeFilters.size === 0) return true;
  for (const f of activeFilters) {
    const [type, value] = f.split(':');
    if (type === 'gender' && song.gender !== value) return false;
    if (type === 'genre' && song.genre !== value) return false;
    if (type === 'era' && song.era !== value) return false;
    if (type === 'difficulty' && song.difficulty !== value) return false;
  }
  return true;
}

function renderRecommendations() {
  const history = DB.getHistory();
  const songs = DB.getAllSongs().filter(songMatchesFilters);
  const recs = computeRecommendations(songs, history);
  const list = document.getElementById('recommend-list');
  const empty = document.getElementById('recommend-empty');
  if (recs.length === 0) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  list.innerHTML = recs.map(recommendationCardHtml).join('');
}

document.getElementById('filter-bar').addEventListener('click', e => {
  const chip = e.target.closest('.filter-chip');
  if (!chip) return;
  const f = chip.dataset.filter;
  if (activeFilters.has(f)) {
    activeFilters.delete(f);
    chip.classList.remove('active');
  } else {
    activeFilters.add(f);
    chip.classList.add('active');
  }
  renderRecommendations();
});

// ---------- ボイス分析 ----------

function renderProfile() {
  const history = DB.getHistory();
  const profile = computeVoiceProfile(history);
  const el = document.getElementById('profile-content');

  if (!profile) {
    el.innerHTML = '<p class="empty-msg">まだ記録がありません。曲を記録するとボイス分析が表示されます。</p>';
    return;
  }

  const easiestHtml = profile.easiestSongs.map(h => `
    <li>${escapeHtml(h.title)} / ${escapeHtml(h.artist)} — ${formatKey(h.keyAdjust)}・歌いやすさ${'★'.repeat(h.ease)}</li>
  `).join('');

  el.innerHTML = `
    <div class="profile-card">
      <div class="profile-label">得意なキー調整</div>
      <div class="profile-value">${formatKey(profile.comfortableKey)}</div>
    </div>
    <div class="profile-card">
      <div class="profile-label">平均カラオケスコア</div>
      <div class="profile-value">${profile.avgScore !== null ? profile.avgScore : '記録なし'}</div>
    </div>
    <div class="profile-card">
      <div class="profile-label">キーの傾向</div>
      <div class="profile-value" style="font-size:17px">${tendencyLabel(profile.tendency)}</div>
    </div>
    <div class="profile-card">
      <div class="profile-label">歌いやすかった曲 トップ3</div>
      <ul class="profile-list">${easiestHtml}</ul>
    </div>
  `;
}

// ---------- 楽曲を追加 ----------

document.getElementById('add-song-form').addEventListener('submit', e => {
  e.preventDefault();
  DB.addCustomSong({
    title: document.getElementById('song-title').value.trim(),
    artist: document.getElementById('song-artist').value.trim(),
    gender: document.getElementById('song-gender').value,
    genre: document.getElementById('song-genre').value,
    era: document.getElementById('song-era').value,
    range: document.getElementById('song-range').value,
    difficulty: document.getElementById('song-difficulty').value,
  });
  e.target.reset();
  renderCustomSongs();
});

function customSongCardHtml(song) {
  return `
    <div class="song-card" data-id="${song.id}">
      <p class="song-title">${escapeHtml(song.title)}</p>
      <p class="song-artist">${escapeHtml(song.artist)}</p>
      <div class="badge-row">
        <span class="badge">${GENDER_LABEL[song.gender]}</span>
        <span class="badge">${GENRE_LABEL[song.genre]}</span>
        <span class="badge">${ERA_LABEL[song.era]}</span>
        <span class="badge">音域: ${RANGE_LABEL[song.range]}</span>
        <span class="badge">難易度: ${DIFFICULTY_LABEL[song.difficulty]}</span>
      </div>
      <div class="card-actions">
        <button class="small-btn danger" data-action="delete-song" data-id="${song.id}">削除する</button>
      </div>
    </div>
  `;
}

function renderCustomSongs() {
  const songs = DB.getCustomSongs();
  const list = document.getElementById('custom-song-list');
  const empty = document.getElementById('custom-song-empty');
  if (songs.length === 0) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  list.innerHTML = songs.map(customSongCardHtml).join('');
}

document.getElementById('custom-song-list').addEventListener('click', e => {
  const btn = e.target.closest('[data-action="delete-song"]');
  if (!btn) return;
  if (confirm('この曲を削除しますか？')) {
    DB.deleteCustomSong(btn.dataset.id);
    renderCustomSongs();
  }
});

// ---------- ユーティリティ ----------

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------- 初期表示 ----------

renderHome();
