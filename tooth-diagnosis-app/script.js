const symptomGrid = document.getElementById("symptom-grid");
const form = document.getElementById("symptom-form");
const screenCheck = document.getElementById("screen-check");
const screenResult = document.getElementById("screen-result");
const resultList = document.getElementById("result-list");
const urgentBanner = document.getElementById("urgent-banner");
const btnRetry = document.getElementById("btn-retry");

function renderSymptoms() {
  symptomGrid.innerHTML = SYMPTOMS.map((s) => `
    <label class="symptom-card" for="${s.id}">
      <input type="checkbox" id="${s.id}" name="${s.id}">
      <span>${s.label}</span>
    </label>
  `).join("");
}

function diagnose(selectedIds) {
  const scores = {};

  selectedIds.forEach((id) => {
    const mappings = SYMPTOM_CONDITION_MAP[id] || [];
    mappings.forEach(({ condition, weight }) => {
      scores[condition] = (scores[condition] || 0) + weight;
    });
  });

  const ranked = Object.entries(scores)
    .map(([key, score]) => ({ key, score, ...CONDITIONS[key] }))
    .sort((a, b) => b.score - a.score);

  return ranked;
}

function renderResults(ranked) {
  const hasUrgent = ranked.some((r) => r.urgent && r.score > 0);
  urgentBanner.classList.toggle("hidden", !hasUrgent);

  if (ranked.length === 0) {
    resultList.innerHTML = `
      <div class="result-card result-empty">
        <h3>該当する症状がありませんでした</h3>
        <p>今のところ気になる症状は選択されていません。違和感が出てきたら、いつでも再チェックしてください。</p>
      </div>
    `;
    return;
  }

  const top = ranked.slice(0, 3);
  resultList.innerHTML = top.map((r) => `
    <div class="result-card ${r.urgent ? "result-urgent" : ""}">
      <h3>${r.name}</h3>
      <p class="result-desc">${r.description}</p>
      <p class="result-advice"><strong>アドバイス：</strong>${r.advice}</p>
    </div>
  `).join("");
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const selectedIds = SYMPTOMS
    .map((s) => s.id)
    .filter((id) => document.getElementById(id).checked);

  const ranked = diagnose(selectedIds);
  renderResults(ranked);

  screenCheck.classList.add("hidden");
  screenResult.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
});

btnRetry.addEventListener("click", () => {
  form.reset();
  screenResult.classList.add("hidden");
  screenCheck.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
});

renderSymptoms();
