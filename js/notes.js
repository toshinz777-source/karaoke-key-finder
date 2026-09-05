// 音名⇔半音（MIDI番号）変換と、移調・音域レベル判定を行う純粋関数群。
// キー調整（-5〜+5）は「半音何個分ずらすか」に対応しており、
// このモジュールの計算がおすすめエンジン(analysis.js)の土台になる。

const NOTE_TO_PITCH_CLASS = {
  C: 0, 'C#': 1, DB: 1,
  D: 2, 'D#': 3, EB: 3,
  E: 4,
  F: 5, 'F#': 6, GB: 6,
  G: 7, 'G#': 8, AB: 8,
  A: 9, 'A#': 10, BB: 10,
  B: 11,
};

const PITCH_CLASS_TO_NAME = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// "A3" "C#4" "Bb2" のような表記をMIDI番号(C4=60)に変換する
function noteToMidi(note) {
  const match = /^([A-Ga-g])([#b]?)(-?\d+)$/.exec(note.trim());
  if (!match) return null;
  const [, letter, accidental, octaveStr] = match;
  const key = (letter + accidental).toUpperCase();
  const pitchClass = NOTE_TO_PITCH_CLASS[key];
  if (pitchClass === undefined) return null;
  const octave = Number(octaveStr);
  return (octave + 1) * 12 + pitchClass;
}

function midiToNote(midi) {
  const pitchClass = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${PITCH_CLASS_TO_NAME[pitchClass]}${octave}`;
}

// semitones分だけ移調した音名を返す（キー調整+2なら2半音上げる、など）
function transposeNote(note, semitones) {
  const midi = noteToMidi(note);
  if (midi === null) return null;
  return midiToNote(midi + semitones);
}

// 表示用に # を ♯ に変換する
function displayNote(note) {
  if (!note) return '?';
  return note.replace('#', '♯');
}

// 最高音から大まかな音域レベル(low/medium/high)を判定する。
// 保存された固定値ではなく最高音から都度導出することで、
// 「最高音を更新したのに音域ラベルだけ古いまま」というズレを防ぐ。
function rangeLevelFromNotes(highestNote) {
  const midi = noteToMidi(highestNote);
  if (midi === null) return 'medium';
  if (midi <= noteToMidi('C4')) return 'low';
  if (midi <= noteToMidi('F#4')) return 'medium';
  return 'high';
}

// 半音差を「あと何音上/下まで出せるか」のようなざっくりした距離として使う
function semitoneDistance(noteA, noteB) {
  const a = noteToMidi(noteA);
  const b = noteToMidi(noteB);
  if (a === null || b === null) return null;
  return Math.abs(a - b);
}

// マイクのピッチ検出(pitch.js)が返す周波数(Hz)をMIDI番号に変換する
function freqToMidi(freq) {
  return 69 + 12 * Math.log2(freq / 440);
}
