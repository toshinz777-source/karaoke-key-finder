// 症状データと、症状→考えられる原因のマッピング定義
// 医学的な確定診断ではなく、一般的な傾向に基づく簡易チェック用のデータです。

const SYMPTOMS = [
  { id: "cold_hot_pain", label: "冷たいもの・熱いものがしみる" },
  { id: "sweet_pain", label: "甘いものを食べるとしみる・痛む" },
  { id: "biting_pain", label: "噛んだときに痛む" },
  { id: "constant_ache", label: "何もしなくてもズキズキ痛む" },
  { id: "visible_hole", label: "歯に黒い点や穴、欠けが見える" },
  { id: "bleeding_gums", label: "歯みがきで歯ぐきから血が出る" },
  { id: "swollen_gums", label: "歯ぐきが腫れている・赤い" },
  { id: "receding_gums", label: "歯ぐきが下がってきた気がする" },
  { id: "bad_breath", label: "口臭が気になる" },
  { id: "loose_tooth", label: "歯がグラグラする" },
  { id: "pus", label: "歯ぐきから膿のようなものが出る" },
  { id: "wisdom_area_pain", label: "一番奥の歯の周りが腫れて痛い" },
  { id: "jaw_pain", label: "口を開けると顎が痛い・音が鳴る" },
  { id: "face_swelling", label: "顔が腫れてきた" },
  { id: "night_grinding", label: "朝起きたときに顎や歯が疲れている（歯ぎしり・食いしばりの自覚）" }
];

// 各症状が示唆する疾患と重み、緊急フラグ
const CONDITIONS = {
  sensitivity: {
    name: "知覚過敏",
    description: "エナメル質のすり減りや歯ぐきの後退により、刺激が歯にしみやすくなっている可能性があります。",
    advice: "しみる症状が続く場合は知覚過敏用の歯みがき粉を試し、改善しなければ歯科医院で相談しましょう。",
    urgent: false
  },
  cavity: {
    name: "むし歯（う蝕）",
    description: "痛みや穴、しみる症状はむし歯が進行しているサインの可能性があります。",
    advice: "自然に治ることはないため、早めに歯科医院を受診して確認してもらいましょう。",
    urgent: false
  },
  pulpitis: {
    name: "歯髄炎の疑い（むし歯の進行）",
    description: "何もしなくてもズキズキ痛む場合、歯の神経（歯髄）まで炎症が及んでいる可能性があります。",
    advice: "強い自発痛は放置すると悪化しやすいため、できるだけ早く歯科医院を受診してください。",
    urgent: false
  },
  gingivitis: {
    name: "歯肉炎・歯周病",
    description: "歯ぐきからの出血や腫れ、口臭は歯肉炎や歯周病の初期〜中期症状としてよく見られます。",
    advice: "毎日の丁寧な歯みがきに加え、歯科医院でのクリーニング・検診をおすすめします。",
    urgent: false
  },
  periodontitis_advanced: {
    name: "進行した歯周病の疑い",
    description: "歯のグラつきや歯ぐきの後退、膿などは歯周病が進行しているサインの可能性があります。",
    advice: "歯を支える骨が失われている可能性があるため、早めに歯科医院で検査を受けてください。",
    urgent: false
  },
  pericoronitis: {
    name: "智歯周囲炎（親知らず周囲の炎症）",
    description: "親知らずなど一番奥の歯の周囲が腫れて痛む場合、智歯周囲炎の可能性があります。",
    advice: "炎症が強い場合は自己判断せず、早めに歯科・口腔外科を受診してください。",
    urgent: false
  },
  tmj_disorder: {
    name: "顎関節症の疑い",
    description: "口を開けたときの痛みや音は、顎関節や咀嚼筋への負担が原因の可能性があります。",
    advice: "食いしばりや歯ぎしりの癖がある場合は特に注意し、歯科医院で相談しましょう。",
    urgent: false
  },
  abscess: {
    name: "歯性膿瘍・感染の疑い",
    description: "膿が出る、顔が腫れるといった症状は、歯の根の周囲で感染が進んでいる可能性があります。",
    advice: "感染が全身に広がるおそれもあるため、できるだけ早く歯科・口腔外科を受診してください。",
    urgent: true
  }
};

// symptomId -> [{ condition: CONDITIONS のキー, weight: 数値 }]
const SYMPTOM_CONDITION_MAP = {
  cold_hot_pain: [{ condition: "sensitivity", weight: 2 }, { condition: "cavity", weight: 1 }],
  sweet_pain: [{ condition: "cavity", weight: 2 }],
  biting_pain: [{ condition: "cavity", weight: 2 }, { condition: "pulpitis", weight: 1 }],
  constant_ache: [{ condition: "pulpitis", weight: 3 }, { condition: "cavity", weight: 1 }],
  visible_hole: [{ condition: "cavity", weight: 3 }],
  bleeding_gums: [{ condition: "gingivitis", weight: 3 }],
  swollen_gums: [{ condition: "gingivitis", weight: 2 }, { condition: "abscess", weight: 1 }],
  receding_gums: [{ condition: "periodontitis_advanced", weight: 2 }, { condition: "sensitivity", weight: 1 }],
  bad_breath: [{ condition: "gingivitis", weight: 1 }, { condition: "cavity", weight: 1 }],
  loose_tooth: [{ condition: "periodontitis_advanced", weight: 3 }],
  pus: [{ condition: "abscess", weight: 3 }, { condition: "periodontitis_advanced", weight: 1 }],
  wisdom_area_pain: [{ condition: "pericoronitis", weight: 3 }],
  jaw_pain: [{ condition: "tmj_disorder", weight: 3 }],
  face_swelling: [{ condition: "abscess", weight: 3 }],
  night_grinding: [{ condition: "tmj_disorder", weight: 2 }, { condition: "sensitivity", weight: 1 }]
};
