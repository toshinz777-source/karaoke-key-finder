const STORAGE_KEY = "toothCheckHistory";

const QUESTIONS = [
  {
    id: "location",
    type: "single",
    title: "Where is the pain?",
    options: [
      { value: "upper-left", label: "Upper left" },
      { value: "upper-right", label: "Upper right" },
      { value: "lower-left", label: "Lower left" },
      { value: "lower-right", label: "Lower right" },
      { value: "not-sure", label: "Not sure" }
    ]
  },
  {
    id: "triggers",
    type: "multi",
    title: "What triggers the pain?",
    subtitle: "Select all that apply",
    options: [
      { value: "sweet", label: "Sweet food" },
      { value: "cold", label: "Cold drinks" },
      { value: "hot", label: "Hot drinks" },
      { value: "chewing", label: "Chewing" },
      { value: "brushing", label: "Brushing" },
      { value: "none", label: "Pain without any trigger" },
      { value: "other", label: "Other" }
    ]
  },
  {
    id: "painScore",
    type: "slider",
    title: "How strong is the pain?",
    min: 0,
    max: 10
  },
  {
    id: "duration",
    type: "single",
    title: "How long does the pain usually last?",
    options: [
      { value: "seconds", label: "A few seconds" },
      { value: "under-1-min", label: "Less than 1 minute" },
      { value: "several-min", label: "Several minutes" },
      { value: "over-30-min", label: "More than 30 minutes" },
      { value: "constant", label: "Constant pain" }
    ]
  },
  {
    id: "frequency",
    type: "single",
    title: "How often does it happen?",
    options: [
      { value: "first-time", label: "First time" },
      { value: "occasionally", label: "Occasionally" },
      { value: "every-day", label: "Every day" },
      { value: "several-times-day", label: "Several times a day" }
    ]
  },
  {
    id: "nightPain",
    type: "yesno",
    title: "Does the pain wake you up at night?"
  },
  {
    id: "swelling",
    type: "yesno",
    title: "Is there swelling in the gum, face, or jaw?"
  },
  {
    id: "feverUnwell",
    type: "yesno",
    title: "Do you have fever or feel unwell?"
  },
  {
    id: "pus",
    type: "yesno",
    title: "Is there pus, bad taste, or discharge near the tooth?"
  },
  {
    id: "swallowBreath",
    type: "yesno",
    title: "Is it difficult to swallow or breathe?"
  }
];

const DURATION_ORDER = { seconds: 0, "under-1-min": 1, "several-min": 2, "over-30-min": 3, constant: 4 };
const FREQUENCY_ORDER = { "first-time": 0, occasionally: 1, "every-day": 2, "several-times-day": 3 };

const DISCLAIMER_TEXT = "This app does not diagnose dental conditions and is not a substitute for a dentist or doctor.";

let quizState = { step: 0, answers: {} };

function labelFor(questionId, value) {
  const question = QUESTIONS.find((q) => q.id === questionId);
  if (!question || !question.options) return value;
  const opt = question.options.find((o) => o.value === value);
  return opt ? opt.label : value;
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

function saveHistoryList(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    /* localStorage unavailable; history simply won't persist */
  }
}

function addHistoryEntry(entry) {
  const list = loadHistory();
  list.push(entry);
  saveHistoryList(list);
  return list;
}

function formatDate(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/* ---------------- Screen navigation ---------------- */

const screens = {
  home: document.getElementById("screen-home"),
  quiz: document.getElementById("screen-quiz"),
  result: document.getElementById("screen-result"),
  history: document.getElementById("screen-history"),
  summary: document.getElementById("screen-summary")
};

const quizTopbar = document.getElementById("quiz-topbar");
const navButtons = document.querySelectorAll(".nav-btn");

function showScreen(name) {
  Object.entries(screens).forEach(([key, el]) => {
    el.classList.toggle("hidden", key !== name);
  });
  quizTopbar.classList.toggle("hidden", name !== "quiz");

  const navKey = name === "result" ? "quiz" : name;
  navButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.nav === navKey);
  });

  window.scrollTo({ top: 0 });
}

navButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.nav;
    if (target === "home") showScreen("home");
    else if (target === "quiz") startQuiz();
    else if (target === "history") {
      renderHistoryScreen();
      showScreen("history");
    } else if (target === "summary") {
      renderSummaryScreen();
      showScreen("summary");
    }
  });
});

document.getElementById("btn-start-check").addEventListener("click", startQuiz);
document.getElementById("btn-back").addEventListener("click", goBack);

/* ---------------- Quiz flow ---------------- */

function startQuiz() {
  quizState = { step: 0, answers: { triggers: [] } };
  showScreen("quiz");
  renderQuestion();
}

function goBack() {
  if (quizState.step > 0) {
    quizState.step -= 1;
    renderQuestion();
  } else {
    showScreen("home");
  }
}

function advance() {
  if (quizState.step < QUESTIONS.length - 1) {
    quizState.step += 1;
    renderQuestion();
  } else {
    finishQuiz();
  }
}

const questionContainer = document.getElementById("question-container");
const progressFill = document.getElementById("progress-fill");
const stepLabel = document.getElementById("step-label");

function renderQuestion() {
  const q = QUESTIONS[quizState.step];
  progressFill.style.width = `${(quizState.step / QUESTIONS.length) * 100}%`;
  stepLabel.textContent = `Step ${quizState.step + 1} of ${QUESTIONS.length}`;

  questionContainer.innerHTML = "";

  const title = document.createElement("h2");
  title.className = "question-title";
  title.textContent = q.title;
  questionContainer.appendChild(title);

  if (q.subtitle) {
    const sub = document.createElement("p");
    sub.className = "question-subtitle";
    sub.textContent = q.subtitle;
    questionContainer.appendChild(sub);
  }

  if (q.type === "single") renderSingleChoice(q);
  else if (q.type === "multi") renderMultiChoice(q);
  else if (q.type === "slider") renderSlider(q);
  else if (q.type === "yesno") renderYesNo(q);
}

function renderSingleChoice(q) {
  const list = document.createElement("div");
  list.className = "option-list";

  q.options.forEach((opt) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "option-btn";
    btn.innerHTML = `<span>${opt.label}</span><span class="option-check">&#10003;</span>`;
    btn.addEventListener("click", () => {
      quizState.answers[q.id] = opt.value;
      btn.classList.add("selected");
      setTimeout(advance, 120);
    });
    list.appendChild(btn);
  });

  questionContainer.appendChild(list);
}

function renderMultiChoice(q) {
  const selected = new Set(quizState.answers[q.id] || []);

  const list = document.createElement("div");
  list.className = "option-list";

  q.options.forEach((opt) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "option-btn";
    if (selected.has(opt.value)) btn.classList.add("selected");
    btn.innerHTML = `<span>${opt.label}</span><span class="option-check">&#10003;</span>`;
    btn.addEventListener("click", () => {
      if (selected.has(opt.value)) selected.delete(opt.value);
      else selected.add(opt.value);
      btn.classList.toggle("selected");
      quizState.answers[q.id] = Array.from(selected);
      nextBtn.disabled = selected.size === 0;
    });
    list.appendChild(btn);
  });

  questionContainer.appendChild(list);

  const wrap = document.createElement("div");
  wrap.className = "next-btn-wrap";
  const nextBtn = document.createElement("button");
  nextBtn.type = "button";
  nextBtn.className = "btn-primary";
  nextBtn.textContent = "Next";
  nextBtn.disabled = selected.size === 0;
  nextBtn.addEventListener("click", advance);
  wrap.appendChild(nextBtn);
  questionContainer.appendChild(wrap);
}

function renderSlider(q) {
  const current = quizState.answers[q.id] !== undefined ? quizState.answers[q.id] : 0;
  quizState.answers[q.id] = current;

  const wrap = document.createElement("div");
  wrap.className = "slider-wrap";

  const valueDisplay = document.createElement("div");
  valueDisplay.className = "slider-value";
  valueDisplay.textContent = current;
  wrap.appendChild(valueDisplay);

  const scaleLabel = document.createElement("div");
  scaleLabel.className = "slider-scale-label";
  scaleLabel.textContent = "0 = no pain, 10 = worst pain imaginable";
  wrap.appendChild(scaleLabel);

  const input = document.createElement("input");
  input.type = "range";
  input.min = q.min;
  input.max = q.max;
  input.step = 1;
  input.value = current;
  input.addEventListener("input", () => {
    valueDisplay.textContent = input.value;
    quizState.answers[q.id] = Number(input.value);
  });
  wrap.appendChild(input);

  const endpoints = document.createElement("div");
  endpoints.className = "slider-endpoints";
  endpoints.innerHTML = `<span>${q.min}</span><span>${q.max}</span>`;
  wrap.appendChild(endpoints);

  questionContainer.appendChild(wrap);

  const btnWrap = document.createElement("div");
  btnWrap.className = "next-btn-wrap";
  const nextBtn = document.createElement("button");
  nextBtn.type = "button";
  nextBtn.className = "btn-primary";
  nextBtn.textContent = "Next";
  nextBtn.addEventListener("click", advance);
  btnWrap.appendChild(nextBtn);
  questionContainer.appendChild(btnWrap);
}

function renderYesNo(q) {
  const list = document.createElement("div");
  list.className = "yesno-list";

  ["yes", "no"].forEach((value) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `yesno-btn ${value}-btn`;
    btn.textContent = value === "yes" ? "Yes" : "No";
    btn.addEventListener("click", () => {
      quizState.answers[q.id] = value;
      btn.classList.add("selected");
      setTimeout(advance, 120);
    });
    list.appendChild(btn);
  });

  questionContainer.appendChild(list);
}

/* ---------------- Result logic ---------------- */

function computeResult(a) {
  const difficultBreathingOrSwallowing = a.swallowBreath === "yes";
  const severeFacialSwelling = a.swelling === "yes" && (a.feverUnwell === "yes" || difficultBreathingOrSwallowing);

  const isRed =
    a.swelling === "yes" ||
    a.feverUnwell === "yes" ||
    a.pus === "yes" ||
    difficultBreathingOrSwallowing ||
    (a.duration === "constant" && a.painScore >= 7);

  if (isRed) {
    return {
      level: "red",
      badge: "Urgent Dental Care",
      icon: "🚨",
      message:
        "These symptoms can sometimes be associated with dental problems that need urgent attention and should be checked by a dentist as soon as possible. If you cannot be seen quickly, contact an emergency dental or medical service.",
      extraUrgent: difficultBreathingOrSwallowing || severeFacialSwelling ? "Seek urgent medical or dental care now." : null
    };
  }

  const isYellow =
    a.frequency === "every-day" ||
    a.frequency === "several-times-day" ||
    a.painScore >= 4 ||
    a.duration === "over-30-min" ||
    a.duration === "constant" ||
    (a.triggers || []).includes("none") ||
    (a.triggers || []).includes("chewing") ||
    a.nightPain === "yes";

  if (isYellow) {
    return {
      level: "yellow",
      badge: "Book a Dentist Soon",
      icon: "⚠️",
      message:
        "Your symptoms should be checked by a dentist soon. Tooth pain that keeps returning may be caused by decay, sensitivity, a cracked tooth, or another dental problem.",
      extraUrgent: null
    };
  }

  return {
    level: "green",
    badge: "Monitor / Routine Dental Check",
    icon: "🙂",
    message:
      "Your symptoms do not appear urgent, but recurring tooth sensitivity can still need dental assessment. Consider booking a routine dental check if the problem continues.",
    extraUrgent: null
  };
}

function finishQuiz() {
  const a = quizState.answers;
  const result = computeResult(a);

  const entry = {
    date: new Date().toISOString(),
    location: a.location,
    triggers: a.triggers || [],
    painScore: a.painScore,
    duration: a.duration,
    frequency: a.frequency,
    nightPain: a.nightPain,
    swelling: a.swelling,
    feverUnwell: a.feverUnwell,
    pus: a.pus,
    swallowBreath: a.swallowBreath,
    level: result.level
  };

  const list = addHistoryEntry(entry);
  const worsening = detectWorsening(list);

  renderResultScreen(result, worsening);
  showScreen("result");
}

function renderResultScreen(result, worsening) {
  const content = document.getElementById("result-content");
  content.innerHTML = "";

  const icon = document.createElement("div");
  icon.className = "result-icon";
  icon.textContent = result.icon;
  content.appendChild(icon);

  const badge = document.createElement("div");
  badge.className = `result-badge ${result.level}`;
  badge.textContent = result.badge;
  content.appendChild(badge);

  const message = document.createElement("p");
  message.className = "result-message";
  message.textContent = result.message;
  content.appendChild(message);

  if (result.extraUrgent) {
    const urgent = document.createElement("div");
    urgent.className = "result-urgent";
    urgent.textContent = result.extraUrgent;
    content.appendChild(urgent);
  }

  if (worsening) {
    const trend = document.createElement("div");
    trend.className = "trend-warning";
    trend.textContent = "Your symptoms appear to be getting worse. Consider booking a dentist.";
    content.appendChild(trend);
  }

  const disclaimer = document.createElement("p");
  disclaimer.className = "result-disclaimer";
  disclaimer.textContent = DISCLAIMER_TEXT;
  content.appendChild(disclaimer);

  const actions = document.createElement("div");
  actions.className = "result-actions";

  const summaryBtn = document.createElement("button");
  summaryBtn.type = "button";
  summaryBtn.className = "btn-primary";
  summaryBtn.textContent = "Create Dentist Summary";
  summaryBtn.addEventListener("click", () => {
    renderSummaryScreen();
    showScreen("summary");
  });
  actions.appendChild(summaryBtn);

  const historyBtn = document.createElement("button");
  historyBtn.type = "button";
  historyBtn.className = "btn-secondary";
  historyBtn.textContent = "View History";
  historyBtn.addEventListener("click", () => {
    renderHistoryScreen();
    showScreen("history");
  });
  actions.appendChild(historyBtn);

  const homeBtn = document.createElement("button");
  homeBtn.type = "button";
  homeBtn.className = "btn-secondary";
  homeBtn.textContent = "Back to Home";
  homeBtn.addEventListener("click", () => showScreen("home"));
  actions.appendChild(homeBtn);

  content.appendChild(actions);
}

/* ---------------- Trend detection ---------------- */

function detectWorsening(list) {
  if (list.length < 2) return false;
  const sorted = [...list].sort((a, b) => new Date(a.date) - new Date(b.date));
  const prev = sorted[sorted.length - 2];
  const latest = sorted[sorted.length - 1];

  if (latest.painScore > prev.painScore) return true;
  if (DURATION_ORDER[latest.duration] > DURATION_ORDER[prev.duration]) return true;
  if (FREQUENCY_ORDER[latest.frequency] > FREQUENCY_ORDER[prev.frequency]) return true;
  if (latest.nightPain === "yes" && prev.nightPain === "no") return true;
  if (latest.swelling === "yes" && prev.swelling === "no") return true;

  return false;
}

/* ---------------- History screen ---------------- */

function renderHistoryScreen() {
  const list = loadHistory();
  const trendWarningEl = document.getElementById("trend-warning");
  const listEl = document.getElementById("history-list");

  const worsening = detectWorsening(list);
  trendWarningEl.classList.toggle("hidden", !worsening);
  if (worsening) {
    trendWarningEl.textContent = "Your symptoms appear to be getting worse. Consider booking a dentist.";
  }

  listEl.innerHTML = "";

  if (list.length === 0) {
    const empty = document.createElement("p");
    empty.className = "history-empty";
    empty.textContent = "No checks recorded yet. Complete a check to start your history.";
    listEl.appendChild(empty);
    return;
  }

  const sorted = [...list].sort((a, b) => new Date(b.date) - new Date(a.date));

  sorted.forEach((entry) => {
    const card = document.createElement("div");
    card.className = "history-card";

    const top = document.createElement("div");
    top.className = "history-card-top";

    const date = document.createElement("span");
    date.className = "history-date";
    date.textContent = formatDate(entry.date);
    top.appendChild(date);

    const resultInfo = computeResult(entry);
    const dot = document.createElement("span");
    dot.className = `history-result-dot ${entry.level}`;
    dot.textContent = resultInfo.badge;
    top.appendChild(dot);

    card.appendChild(top);

    const body = document.createElement("div");
    body.className = "history-card-body";
    const triggerLabels = (entry.triggers || []).map((t) => labelFor("triggers", t)).join(", ") || "No trigger reported";
    body.innerHTML = `
      ${labelFor("location", entry.location)}<br>
      ${triggerLabels}<br>
      Pain ${entry.painScore}/10 &middot; ${labelFor("duration", entry.duration)}<br>
      Frequency: ${labelFor("frequency", entry.frequency)}
    `;
    card.appendChild(body);

    listEl.appendChild(card);
  });

  const clearWrap = document.createElement("div");
  clearWrap.className = "history-clear";
  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.className = "link-btn";
  clearBtn.textContent = "Clear all history";
  clearBtn.addEventListener("click", () => {
    if (confirm("Delete all saved symptom checks from this device? This cannot be undone.")) {
      saveHistoryList([]);
      renderHistoryScreen();
    }
  });
  clearWrap.appendChild(clearBtn);
  listEl.appendChild(clearWrap);
}

/* ---------------- Dentist summary screen ---------------- */

function buildSummaryText(entry, firstDateLabel) {
  const triggerLabels = (entry.triggers || []).map((t) => labelFor("triggers", t)).join(", ") || "None reported";
  return [
    "Dental Symptom Summary",
    `Location: ${labelFor("location", entry.location)}`,
    `Trigger: ${triggerLabels}`,
    `Pain level: ${entry.painScore}/10`,
    `Duration: ${labelFor("duration", entry.duration)}`,
    `Frequency: ${labelFor("frequency", entry.frequency)}`,
    `Night pain: ${entry.nightPain === "yes" ? "Yes" : "No"}`,
    `Swelling: ${entry.swelling === "yes" ? "Yes" : "No"}`,
    `Symptoms started: ${firstDateLabel}`
  ].join("\n");
}

function renderSummaryScreen() {
  const container = document.getElementById("summary-content");
  container.innerHTML = "";

  const list = loadHistory();
  if (list.length === 0) {
    const empty = document.createElement("p");
    empty.className = "summary-empty";
    empty.textContent = "No checks recorded yet. Complete a check first to create a dentist summary.";
    container.appendChild(empty);
    return;
  }

  const sorted = [...list].sort((a, b) => new Date(a.date) - new Date(b.date));
  const latest = sorted[sorted.length - 1];
  const first = sorted[0];

  const summaryText = buildSummaryText(latest, formatDate(first.date));

  const box = document.createElement("div");
  box.className = "summary-box";
  box.textContent = summaryText;
  container.appendChild(box);

  const actions = document.createElement("div");
  actions.className = "summary-actions";

  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.className = "btn-primary";
  copyBtn.textContent = "Copy to Clipboard";
  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(summaryText);
      feedback.textContent = "Copied to clipboard.";
    } catch (e) {
      feedback.textContent = "Could not copy automatically. Please select and copy the text above.";
    }
    setTimeout(() => (feedback.textContent = ""), 3000);
  });
  actions.appendChild(copyBtn);

  const downloadBtn = document.createElement("button");
  downloadBtn.type = "button";
  downloadBtn.className = "btn-secondary";
  downloadBtn.textContent = "Download as Text File";
  downloadBtn.addEventListener("click", () => {
    const blob = new Blob([summaryText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "dental-symptom-summary.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
  actions.appendChild(downloadBtn);

  container.appendChild(actions);

  const feedback = document.createElement("p");
  feedback.className = "copy-feedback";
  container.appendChild(feedback);
}

/* ---------------- Init ---------------- */

showScreen("home");
