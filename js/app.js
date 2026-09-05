// UIの描画とイベント処理をまとめたモジュール。
// 曲データベースは非同期(DB.getAllSongs())になったため、
// 曲データが必要な描画関数はすべてasyncにしてある。

const GENDER_LABEL = { male: '男性', female: '女性', group: 'グループ' };
const GENRE_LABEL = { pop: 'ポップ', ballad: 'バラード', rock: 'ロック' };
const ERA_LABEL = { old: '昔の曲', recent: '最近の曲' };
const DIFFICULTY_LABEL = { easy: '易しい', medium: '普通', hard: '難しい' };
const RANGE_LEVEL_LABEL = { low: '低め', medium: '普通', high: '高め' };

let activeFilters = new Set();
let searchQuery = '';

function joysoundBadgeHtml(joysound) {
  if (joysound === true) return '<span class="badge joysound-yes">JOYSOUND: 配信中</span>';
  if (joysound === false) return '<span class="badge joysound-no">JOYSOUND: 配信なし</span>';
  return '<span class="badge joysound-unknown">JOYSOUND: 不明</span>';
}

// ---------- ナビゲーション ----------

async function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  document.getElementById(`view-${name}`).classList.remove('hidden');
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.nav === name);
  });
  if (name === 'home') await renderHome();
  if (name === 'mysongs') await renderHistory();
  if (name === 'recommend') await renderRecommendations();
  if (name === 'profile') await renderProfile();
  if (name === 'addsong') renderCustomSongs();
}

document.querySelectorAll('[data-nav]').forEach(el => {
  el.addEventListener('click', () => showView(el.dataset.nav));
});

// ---------- ホーム ----------

async function renderHome() {
  const history = DB.getHistory();
  const songDB = await DB.getAllSongs();
  const profile = computeVoiceProfile(history, songDB, DB.getMeasuredRange());
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

async function renderHistory() {
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

document.getElementById('history-list').addEventListener('click', async e => {
  const btn = e.target.closest('[data-action="delete-history"]');
  if (!btn) return;
  if (confirm('この記録を削除しますか？')) {
    DB.deleteHistory(btn.dataset.id);
    await renderHistory();
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

async function populateSongSelect() {
  const songs = await DB.getAllSongs();
  historySongSelect.innerHTML = '<option value="">-- 選択しない（手入力） --</option>' +
    songs.map(s => `<option value="${s.id}">${escapeHtml(s.title)} / ${escapeHtml(s.artist)}</option>`).join('');
}

historySongSelect.addEventListener('change', async () => {
  const songs = await DB.getAllSongs();
  const song = songs.find(s => s.id === historySongSelect.value);
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

async function openHistoryModal() {
  await populateSongSelect();
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

document.getElementById('add-history-form').addEventListener('submit', async e => {
  e.preventDefault();
  if (!selectedEase) {
    alert('歌いやすさを選択してください');
    return;
  }
  const songId = historySongSelect.value || null;
  const songs = await DB.getAllSongs();
  const song = songId ? songs.find(s => s.id === songId) : null;
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
    genre: song ? song.genre : null,
  });
  closeHistoryModal();
  await renderHistory();
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
      <div class="badge-row">
        <span class="badge note">キー変更後の音域: ${displayNote(rec.transposedLow)}〜${displayNote(rec.transposedHigh)}</span>
        ${joysoundBadgeHtml(song.joysound)}
      </div>
      <p class="song-reason">${escapeHtml(rec.reason)}</p>
    </div>
  `;
}

function songMatchesFilters(song) {
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    if (!song.title.toLowerCase().includes(q) && !song.artist.toLowerCase().includes(q)) return false;
  }
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

async function renderRecommendations() {
  const loading = document.getElementById('recommend-loading');
  const list = document.getElementById('recommend-list');
  const empty = document.getElementById('recommend-empty');
  loading.classList.remove('hidden');
  list.innerHTML = '';
  empty.classList.add('hidden');

  const history = DB.getHistory();
  const allSongs = await DB.getAllSongs();
  const songs = allSongs.filter(songMatchesFilters);
  const recs = computeRecommendations(songs, history, DB.getMeasuredRange());

  loading.classList.add('hidden');
  if (recs.length === 0) {
    empty.classList.remove('hidden');
    return;
  }
  list.innerHTML = recs.map(recommendationCardHtml).join('');
}

document.getElementById('filter-bar').addEventListener('click', async e => {
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
  await renderRecommendations();
});

let searchDebounceTimer = null;
document.getElementById('recommend-search').addEventListener('input', e => {
  searchQuery = e.target.value.trim();
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => renderRecommendations(), 200);
});

// ---------- ボイス分析 ----------

const ENVELOPE_SOURCE_LABEL = {
  mic: 'マイク測定',
  history: '歌唱履歴から推定',
  default: '一般的な目安',
};

async function renderProfile() {
  const history = DB.getHistory();
  const songDB = await DB.getAllSongs();
  const measuredRange = DB.getMeasuredRange();
  const profile = computeVoiceProfile(history, songDB, measuredRange);
  const el = document.getElementById('profile-content');

  if (!profile) {
    el.innerHTML = '<p class="empty-msg">まだ記録がありません。マイクで測定するか、曲を記録するとボイス分析が表示されます。</p>';
    return;
  }

  const easiestHtml = profile.easiestSongs.length
    ? profile.easiestSongs.map(h => `
        <li>${escapeHtml(h.title)} / ${escapeHtml(h.artist)} — ${formatKey(h.keyAdjust)}・歌いやすさ${'★'.repeat(h.ease)}</li>
      `).join('')
    : '<li>まだ記録がありません</li>';

  const envelopeText = `${displayNote(midiToNote(profile.vocalEnvelope.low))}〜${displayNote(midiToNote(profile.vocalEnvelope.high))}`;

  el.innerHTML = `
    <div class="profile-card">
      <div class="profile-label">快適な音域（${ENVELOPE_SOURCE_LABEL[profile.vocalEnvelope.source]}）</div>
      <div class="profile-value" style="font-size:20px">${envelopeText}</div>
      ${measuredRange ? '<button class="small-btn danger" id="clear-mic-range" style="margin-top:10px">マイク測定結果をクリア</button>' : ''}
    </div>
    <div class="profile-card">
      <div class="profile-label">得意なキー調整</div>
      <div class="profile-value">${profile.count ? formatKey(profile.comfortableKey) : '記録なし'}</div>
    </div>
    <div class="profile-card">
      <div class="profile-label">平均カラオケスコア</div>
      <div class="profile-value">${profile.avgScore !== null ? profile.avgScore : '記録なし'}</div>
    </div>
    <div class="profile-card">
      <div class="profile-label">キーの傾向</div>
      <div class="profile-value" style="font-size:17px">${profile.count ? tendencyLabel(profile.tendency) : '記録なし'}</div>
    </div>
    <div class="profile-card">
      <div class="profile-label">歌いやすかった曲 トップ3</div>
      <ul class="profile-list">${easiestHtml}</ul>
    </div>
  `;

  const clearBtn = document.getElementById('clear-mic-range');
  if (clearBtn) {
    clearBtn.addEventListener('click', async () => {
      if (confirm('マイク測定結果を削除しますか？')) {
        DB.clearMeasuredRange();
        await renderProfile();
      }
    });
  }
}

// ---------- 楽曲を追加 ----------

document.getElementById('add-song-form').addEventListener('submit', e => {
  e.preventDefault();
  const lowestNote = document.getElementById('song-lowest-note').value.trim();
  const highestNote = document.getElementById('song-highest-note').value.trim();
  if (noteToMidi(lowestNote) === null || noteToMidi(highestNote) === null) {
    alert('音名は「A3」「C#4」のような形式で入力してください');
    return;
  }
  const joysoundRaw = document.getElementById('song-joysound').value;
  DB.addCustomSong({
    title: document.getElementById('song-title').value.trim(),
    artist: document.getElementById('song-artist').value.trim(),
    gender: document.getElementById('song-gender').value,
    genre: document.getElementById('song-genre').value,
    era: document.getElementById('song-era').value,
    lowestNote,
    highestNote,
    difficulty: document.getElementById('song-difficulty').value,
    originalKey: document.getElementById('song-original-key').value.trim() || null,
    joysound: joysoundRaw === '' ? null : joysoundRaw === 'true',
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
        <span class="badge">難易度: ${DIFFICULTY_LABEL[song.difficulty]}</span>
      </div>
      <div class="badge-row">
        <span class="badge note">音域: ${displayNote(song.lowestNote)}〜${displayNote(song.highestNote)} (${RANGE_LEVEL_LABEL[rangeLevelFromNotes(song.highestNote)]})</span>
        ${joysoundBadgeHtml(song.joysound)}
      </div>
      ${song.originalKey ? `<p class="song-notes">原曲キー情報: ${escapeHtml(song.originalKey)}</p>` : ''}
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

// ---------- マイク測定モーダル ----------

const micModal = document.getElementById('mic-modal');
const micStepIntro = document.getElementById('mic-step-intro');
const micStepRecording = document.getElementById('mic-step-recording');
const micStepResult = document.getElementById('mic-step-result');
const micError = document.getElementById('mic-error');

let micReadings = [];
let micAutoStopTimer = null;
let micPendingResult = null;

function showMicStep(step) {
  micStepIntro.classList.toggle('hidden', step !== 'intro');
  micStepRecording.classList.toggle('hidden', step !== 'recording');
  micStepResult.classList.toggle('hidden', step !== 'result');
}

function showMicError(message) {
  micError.textContent = message;
  micError.classList.remove('hidden');
}

function openMicModal() {
  micError.classList.add('hidden');
  showMicStep('intro');
  micModal.classList.remove('hidden');
}

function closeMicModal() {
  PitchDetector.stop();
  clearTimeout(micAutoStopTimer);
  micModal.classList.add('hidden');
}

document.getElementById('open-mic-measure').addEventListener('click', openMicModal);
document.getElementById('mic-cancel-btn').addEventListener('click', closeMicModal);

document.getElementById('mic-start-btn').addEventListener('click', async () => {
  if (!PitchDetector.isSupported()) {
    showMicError('お使いのブラウザ、または接続(HTTPSが必要)ではマイク機能を利用できません。');
    return;
  }
  micError.classList.add('hidden');
  micReadings = [];
  document.getElementById('mic-live-note').textContent = '-';
  document.getElementById('mic-live-sub').textContent = '声を出してください…';
  document.getElementById('mic-live-low').textContent = '最低音: -';
  document.getElementById('mic-live-high').textContent = '最高音: -';

  try {
    await PitchDetector.start(onMicPitch);
  } catch (err) {
    showMicError('マイクへのアクセスが許可されませんでした。ブラウザの設定でマイクを許可してください。');
    return;
  }
  showMicStep('recording');
  // 万一止め忘れても60秒でマイクを止める安全装置
  micAutoStopTimer = setTimeout(() => finishMicRecording(), 60000);
});

function onMicPitch(freq) {
  if (freq === null) return;
  const midi = freqToMidi(freq);
  micReadings.push(midi);

  document.getElementById('mic-live-note').textContent = displayNote(midiToNote(Math.round(midi)));
  document.getElementById('mic-live-sub').textContent = `検出中… (${Math.round(freq)} Hz)`;

  const low = Math.round(Math.min(...micReadings));
  const high = Math.round(Math.max(...micReadings));
  document.getElementById('mic-live-low').textContent = `最低音: ${displayNote(midiToNote(low))}`;
  document.getElementById('mic-live-high').textContent = `最高音: ${displayNote(midiToNote(high))}`;
}

function finishMicRecording() {
  clearTimeout(micAutoStopTimer);
  PitchDetector.stop();

  // ノイズや一瞬の外れ値を除くため、上下5%を切り捨てた範囲を採用する
  if (micReadings.length < 30) {
    showMicStep('intro');
    showMicError('検出できた声が少なすぎました。マイクに向かって、はっきり長めに声を出してもう一度お試しください。');
    return;
  }
  const sorted = [...micReadings].sort((a, b) => a - b);
  const low = Math.round(sorted[Math.floor(sorted.length * 0.05)]);
  const high = Math.round(sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)]);

  micPendingResult = { low, high, sampleCount: micReadings.length };
  document.getElementById('mic-result-range').textContent =
    `${displayNote(midiToNote(low))}〜${displayNote(midiToNote(high))}`;
  showMicStep('result');
}

document.getElementById('mic-stop-btn').addEventListener('click', finishMicRecording);

document.getElementById('mic-retry-btn').addEventListener('click', () => {
  micPendingResult = null;
  showMicStep('intro');
});

document.getElementById('mic-save-btn').addEventListener('click', async () => {
  if (!micPendingResult) return;
  DB.saveMeasuredRange(micPendingResult);
  micModal.classList.add('hidden');
  await renderProfile();
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
