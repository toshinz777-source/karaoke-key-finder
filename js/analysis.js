// 履歴データから「ボイスプロファイル」と「おすすめ曲」を計算するモジュール。
//
// これまでは「音域レベル(低い/普通/高い)」という大まかな区分と
// 平均キー調整だけでおすすめを決めていたが、ここでは実際の
// 最低音・最高音（半音単位のMIDI番号）を移調して比較する方式に変えた。
// 判定ロジックはルールベースのままだが、将来ここをAIベースの
// 推薦ロジックに差し替える場合も、入出力（曲データベースの配列と
// 履歴の配列を受け取り、おすすめ配列を返す）は変えずに済むようにしてある。

const DIFFICULTY_NUM = { easy: 1, medium: 2, hard: 3 };

const KEY_LABELS = {
  '-5': '-5', '-4': '-4', '-3': '-3', '-2': '-2', '-1': '-1',
  '0': '原曲キー',
  '1': '+1', '2': '+2', '3': '+3', '4': '+4', '5': '+5',
};

// キー調整の探索範囲（カラオケ機の一般的な調整幅に合わせる）
const KEY_CANDIDATES = [0, -1, 1, -2, 2, -3, 3, -4, 4, -5, 5];

// 「快適な音域」からどれだけ外れても許容するか（半音）
const RANGE_TOLERANCE = 2;
// 快適な音域と判定する曲を探す際、中心音の近さの許容範囲（半音）
const SIMILAR_SONG_TOLERANCE = 4;

function formatKey(n) {
  return KEY_LABELS[String(n)] || (n > 0 ? `+${n}` : `${n}`);
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function mode(arr) {
  const counts = {};
  let best = null, bestCount = 0;
  arr.forEach(v => {
    counts[v] = (counts[v] || 0) + 1;
    if (counts[v] > bestCount) {
      bestCount = counts[v];
      best = v;
    }
  });
  return best;
}

function tendencyLabel(tendency) {
  if (tendency === 'lower') return '原曲より低いキーを好む傾向があります';
  if (tendency === 'higher') return '原曲より高いキーを好む傾向があります';
  return '原曲キーに近いキーを好む傾向があります';
}

// 履歴の各記録について、参照している曲が見つかり、かつ音名が
// 有効な場合のみ「実際に歌った音域（移調後）」を計算して返す
function resolveHistoryNoteRange(entry, songDB) {
  if (!entry.songId) return null;
  const song = songDB.find(s => s.id === entry.songId);
  if (!song) return null;
  const low = noteToMidi(song.lowestNote);
  const high = noteToMidi(song.highestNote);
  if (low === null || high === null) return null;
  return { low: low + entry.keyAdjust, high: high + entry.keyAdjust, entry, song };
}

// 履歴からボイスプロファイル（傾向）を計算する。
// songDBを渡すことで、履歴が参照する曲の音名から
// 「実際に歌えた音域」を逆算できるようにしている。
function computeVoiceProfile(history, songDB) {
  if (!history || history.length === 0) return null;

  const avgEase = history.reduce((s, h) => s + h.ease, 0) / history.length;

  const withScore = history.filter(h => h.score !== null && h.score !== undefined && h.score !== '');
  const avgScore = withScore.length
    ? Math.round(withScore.reduce((s, h) => s + Number(h.score), 0) / withScore.length)
    : null;

  // 歌いやすさ4以上の曲を「快適な曲」として扱う
  const comfortable = history.filter(h => h.ease >= 4);
  const basis = comfortable.length ? comfortable : history;
  const comfortableKey = Math.round(basis.reduce((s, h) => s + h.keyAdjust, 0) / basis.length);

  const avgKeyAll = history.reduce((s, h) => s + h.keyAdjust, 0) / history.length;
  let tendency = 'neutral';
  if (avgKeyAll <= -0.5) tendency = 'lower';
  else if (avgKeyAll >= 0.5) tendency = 'higher';

  const easiestSongs = [...history]
    .sort((a, b) => (b.ease - a.ease) || ((b.score || 0) - (a.score || 0)))
    .slice(0, 3);

  const dominantGender = mode(comfortable.map(h => h.gender).filter(Boolean));
  const dominantGenre = mode(comfortable.map(h => h.genre).filter(Boolean));

  // 快適に歌えた曲の「実際の音域（移調後）」を集めて、
  // ユーザーの快適な音域(vocalEnvelope)を推定する
  const noteEntries = comfortable
    .map(h => resolveHistoryNoteRange(h, songDB))
    .filter(Boolean);

  let vocalEnvelope;
  if (noteEntries.length) {
    vocalEnvelope = {
      low: Math.round(noteEntries.reduce((s, e) => s + e.low, 0) / noteEntries.length),
      high: Math.round(noteEntries.reduce((s, e) => s + e.high, 0) / noteEntries.length),
      fromHistory: true,
    };
  } else {
    // 履歴に音名を解決できる曲がない場合の一般的なデフォルト音域
    vocalEnvelope = { low: noteToMidi('G3'), high: noteToMidi('D5'), fromHistory: false };
  }

  return {
    avgEase, avgScore, comfortableKey, tendency, easiestSongs,
    dominantGender, dominantGenre, vocalEnvelope, comfortableNoteEntries: noteEntries,
    count: history.length,
  };
}

// 曲データベースと履歴から、おすすめ曲リストを計算する。
// 各曲について、快適な音域に最もよく収まるキー調整を探索し、
// そのフィット具合を一致度の主な根拠にする。
function computeRecommendations(songDB, history) {
  const profile = computeVoiceProfile(history, songDB);

  const avgEase = profile ? profile.avgEase : 3;
  const comfortLevel = avgEase >= 4 ? 3 : avgEase >= 2.5 ? 2 : 1;
  const envelope = profile ? profile.vocalEnvelope : { low: noteToMidi('G3'), high: noteToMidi('D5'), fromHistory: false };

  return songDB.map(song => {
    const lowMidi = noteToMidi(song.lowestNote);
    const highMidi = noteToMidi(song.highestNote);

    // このキー調整で歌ったときの「はみ出し具合」からフィットスコアを出す。
    // 最高音が快適な上限を超える方(overshootHigh)を重めに減点する。
    // ほとんどの人にとって、低い音より高い音の方がカラオケの難所になるため。
    function fitScoreFor(k) {
      const lk = lowMidi + k;
      const hk = highMidi + k;
      const overshootHigh = Math.max(0, hk - envelope.high - RANGE_TOLERANCE);
      const undershootLow = Math.max(0, envelope.low - RANGE_TOLERANCE - lk);
      const penalty = overshootHigh * 8 + undershootLow * 5;
      return clamp(100 - penalty, 0, 100);
    }

    let bestKey = 0, bestFit = -Infinity;
    for (const k of KEY_CANDIDATES) {
      const fit = fitScoreFor(k);
      if (fit > bestFit) {
        bestFit = fit;
        bestKey = k;
      }
    }

    const difficultyNum = DIFFICULTY_NUM[song.difficulty] ?? 2;
    const alignBonus = 15 - Math.abs(comfortLevel - difficultyNum) * 10;
    const genderBonus = (profile && profile.dominantGender && profile.dominantGender === song.gender) ? 8 : 0;
    const genreBonus = (profile && profile.dominantGenre && profile.dominantGenre === song.genre) ? 5 : 0;

    const matchPercent = clamp(
      Math.round(bestFit * 0.8 + Math.max(0, alignBonus) * 0.6 + genderBonus + genreBonus),
      40, 98
    );

    const transposedLow = midiToNote(lowMidi + bestKey);
    const transposedHigh = midiToNote(highMidi + bestKey);

    let reason;
    if (!profile) {
      reason = '歌唱履歴がまだないので、一般的に歌いやすいとされる音域を基準におすすめしています。まずは何曲か記録してみましょう。';
    } else {
      // 「快適な曲」の中から、移調後の音域が最も近い曲を探し、
      // 具体的な曲名を理由に使えないか試す
      const candidateCenter = (lowMidi + bestKey + highMidi + bestKey) / 2;
      let nearest = null, nearestDist = Infinity;
      for (const e of profile.comfortableNoteEntries) {
        if (e.song.id === song.id) continue; // 自分自身は「似ている曲」として参照しない
        const dist = Math.abs(candidateCenter - (e.low + e.high) / 2);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearest = e;
        }
      }

      if (nearest && nearestDist <= SIMILAR_SONG_TOLERANCE) {
        reason = `「${nearest.entry.title}」を気持ちよく歌えたあなたの声域に近い曲です。`;
      } else {
        reason = `あなたが快適に出せる音域(${displayNote(midiToNote(envelope.low))}〜${displayNote(midiToNote(envelope.high))})に、` +
          `この曲を${formatKey(bestKey)}にしたときの音域(${displayNote(transposedLow)}〜${displayNote(transposedHigh)})がよく収まります。`;
      }
      if (genderBonus > 0) reason += ' 得意なタイプの歌手の曲でもあります。';
      if (genreBonus > 0) reason += ' よく歌うジャンルの曲でもあります。';
    }

    return { song, recommendedKey: bestKey, matchPercent, transposedLow, transposedHigh, reason };
  }).sort((a, b) => b.matchPercent - a.matchPercent);
}
