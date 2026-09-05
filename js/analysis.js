// 履歴データから「ボイスプロファイル」と「おすすめ曲」を計算するモジュール。
// 今はシンプルなルールベースの計算だが、将来的にここをAIベースの
// 推薦ロジックに差し替えられるよう、入出力を単純な配列/オブジェクトにしている。

const RANGE_LEVEL_NUM = { low: 1, medium: 2, high: 3 };
const DIFFICULTY_NUM = { easy: 1, medium: 2, hard: 3 };

const KEY_LABELS = {
  '-5': '-5', '-4': '-4', '-3': '-3', '-2': '-2', '-1': '-1',
  '0': '原曲キー',
  '1': '+1', '2': '+2', '3': '+3', '4': '+4', '5': '+5',
};

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

// 履歴からボイスプロファイル（傾向）を計算する
function computeVoiceProfile(history) {
  if (!history || history.length === 0) return null;

  const avgEase = history.reduce((s, h) => s + h.ease, 0) / history.length;

  const withScore = history.filter(h => h.score !== null && h.score !== undefined && h.score !== '');
  const avgScore = withScore.length
    ? Math.round(withScore.reduce((s, h) => s + Number(h.score), 0) / withScore.length)
    : null;

  // 歌いやすさ4以上の曲を「快適な曲」として、そのキー調整の平均を得意なキーとする
  const comfortable = history.filter(h => h.ease >= 4);
  const basis = comfortable.length ? comfortable : history;
  const comfortableKey = Math.round(basis.reduce((s, h) => s + h.keyAdjust, 0) / basis.length);

  // 全履歴のキー調整の平均から、低め/高めの傾向を判定する
  const avgKeyAll = history.reduce((s, h) => s + h.keyAdjust, 0) / history.length;
  let tendency = 'neutral';
  if (avgKeyAll <= -0.5) tendency = 'lower';
  else if (avgKeyAll >= 0.5) tendency = 'higher';

  const easiestSongs = [...history]
    .sort((a, b) => (b.ease - a.ease) || ((b.score || 0) - (a.score || 0)))
    .slice(0, 3);

  const dominantGender = mode(comfortable.length ? comfortable.map(h => h.gender).filter(Boolean) : []);

  return { avgEase, avgScore, comfortableKey, tendency, easiestSongs, dominantGender, count: history.length };
}

function tendencyLabel(tendency) {
  if (tendency === 'lower') return '原曲より低いキーを好む傾向があります';
  if (tendency === 'higher') return '原曲より高いキーを好む傾向があります';
  return '原曲キーに近いキーを好む傾向があります';
}

// 曲データベースと履歴から、おすすめ曲リストを計算する
function computeRecommendations(songDB, history) {
  const profile = computeVoiceProfile(history);

  const comfortableKey = profile ? profile.comfortableKey : 0;
  const avgEase = profile ? profile.avgEase : 3;
  const comfortLevel = avgEase >= 4 ? 3 : avgEase >= 2.5 ? 2 : 1;

  return songDB.map(song => {
    const rangeNum = RANGE_LEVEL_NUM[song.range] ?? 2;
    // 音域が高いほどキーを下げ、低いほど上げる方向で基準を調整する
    const rangeOffset = 2 - rangeNum;
    const recommendedKey = clamp(comfortableKey + rangeOffset, -5, 5);

    const difficultyNum = DIFFICULTY_NUM[song.difficulty] ?? 2;
    const alignBonus = 15 - Math.abs(comfortLevel - difficultyNum) * 10;

    const genderBonus = (profile && profile.dominantGender && profile.dominantGender === song.gender) ? 8 : 0;

    const matchPercent = clamp(Math.round(75 + alignBonus + genderBonus), 40, 98);

    let reason;
    if (!profile) {
      reason = '歌唱履歴がまだないので、歌いやすいと言われる曲を紹介しています。まずは何曲か記録してみましょう。';
    } else {
      reason = `あなたが快適に歌える${formatKey(comfortableKey)}に近いキー感の曲です。`;
      if (genderBonus > 0) {
        reason += ' 得意なタイプの歌手の曲でもあります。';
      }
    }

    return { song, recommendedKey, matchPercent, reason };
  }).sort((a, b) => b.matchPercent - a.matchPercent);
}
