// マイク入力からリアルタイムに基本周波数(ピッチ)を検出するモジュール。
// DOM操作は一切行わず、ブラウザのWeb Audio APIだけを扱う。
// app.js側は onPitch コールバックで周波数(Hz)を受け取り、
// UI表示や音域(最低音・最高音)の集計を行う。
//
// 「マイク音域測定」は、README/analysis.jsで想定していた
// 「computeVoiceProfileのvocalEnvelopeと同じ{low, high}の形を作る、
// 履歴に頼らない別の入力源」という拡張ポイントの実装にあたる。

// 声として現実的な周波数範囲外は誤検出とみなして無視する
const MIN_VOICE_FREQ = 65;   // 約C2
const MAX_VOICE_FREQ = 1050; // 約C6

const PitchDetector = {
  _audioContext: null,
  _stream: null,
  _analyser: null,
  _buffer: null,
  _rafId: null,
  _running: false,

  isSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia &&
      (window.AudioContext || window.webkitAudioContext));
  },

  // onPitch(freqOrNull) は毎フレーム呼ばれる。有効なピッチが取れなければnullを渡す。
  async start(onPitch) {
    if (this._running) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this._audioContext = new AudioContextClass();
    this._stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const source = this._audioContext.createMediaStreamSource(this._stream);
    this._analyser = this._audioContext.createAnalyser();
    this._analyser.fftSize = 2048;
    this._buffer = new Float32Array(this._analyser.fftSize);
    source.connect(this._analyser);

    this._running = true;
    const loop = () => {
      if (!this._running) return;
      this._analyser.getFloatTimeDomainData(this._buffer);
      const freq = autoCorrelate(this._buffer, this._audioContext.sampleRate);
      const valid = freq > 0 && freq >= MIN_VOICE_FREQ && freq <= MAX_VOICE_FREQ;
      onPitch(valid ? freq : null);
      this._rafId = requestAnimationFrame(loop);
    };
    loop();
  },

  stop() {
    this._running = false;
    if (this._rafId) cancelAnimationFrame(this._rafId);
    if (this._stream) this._stream.getTracks().forEach(t => t.stop());
    if (this._audioContext) this._audioContext.close();
    this._audioContext = null;
    this._stream = null;
    this._analyser = null;
  },
};

// 自己相関(autocorrelation)による基本周波数推定（ACF2+法）。
// 無音/雑音なら-1を返す。歌声のような周期性のある波形に対して
// 軽量かつそこそこ安定して動く、ピッチ検出の定番手法。
function autoCorrelate(buf, sampleRate) {
  const size = buf.length;

  let rms = 0;
  for (let i = 0; i < size; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / size);
  if (rms < 0.01) return -1; // 無音とみなす

  // 波形の前後にある無音に近い部分を切り詰める
  const threshold = 0.2;
  let start = 0;
  for (let i = 0; i < size / 2; i++) {
    if (Math.abs(buf[i]) < threshold) { start = i; break; }
  }
  let end = size - 1;
  for (let i = 1; i < size / 2; i++) {
    if (Math.abs(buf[size - i]) < threshold) { end = size - i; break; }
  }
  const trimmed = buf.slice(start, end);
  const n = trimmed.length;
  if (n < 2) return -1;

  const correlations = new Array(n).fill(0);
  for (let lag = 0; lag < n; lag++) {
    let sum = 0;
    for (let i = 0; i < n - lag; i++) sum += trimmed[i] * trimmed[i + lag];
    correlations[lag] = sum;
  }

  // 相関が最初に減少から増加に転じる位置から先で、最大値を探す
  let d = 0;
  while (d + 1 < n && correlations[d] > correlations[d + 1]) d++;

  let maxVal = -1, maxLag = -1;
  for (let i = d; i < n; i++) {
    if (correlations[i] > maxVal) {
      maxVal = correlations[i];
      maxLag = i;
    }
  }
  if (maxLag <= 0) return -1;

  // 放物線補間でラグをサブサンプル精度に補正する
  const x1 = correlations[maxLag - 1] ?? correlations[maxLag];
  const x2 = correlations[maxLag];
  const x3 = correlations[maxLag + 1] ?? correlations[maxLag];
  const a = (x1 + x3 - 2 * x2) / 2;
  const b = (x3 - x1) / 2;
  const refinedLag = a ? maxLag - b / (2 * a) : maxLag;

  return sampleRate / refinedLag;
}
