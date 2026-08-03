// sidepanel/sidepanel.js
// Renders whatever is currently in chrome.storage.local.activeContract,
// and re-renders live as background.js updates it (analyzing -> done).

const els = {
  empty: document.getElementById("cl-empty"),
  loading: document.getElementById("cl-loading"),
  loadingFile: document.getElementById("cl-loading-file"),
  result: document.getElementById("cl-result"),
  filename: document.getElementById("cl-filename"),
  overallBadge: document.getElementById("cl-overall-badge"),
  clauses: document.getElementById("cl-clauses"),
};

function showOnly(state) {
  els.empty.hidden = state !== "empty";
  els.loading.hidden = state !== "loading";
  els.result.hidden = state !== "done";
}

function render(activeContract) {
  if (!activeContract) {
    showOnly("empty");
    return;
  }

  if (activeContract.status === "analyzing") {
    els.loadingFile.textContent = `Analyzing ${activeContract.fileName}…`;
    showOnly("loading");
    return;
  }

  if (activeContract.status === "done") {
    const { analysis } = activeContract;
    els.filename.textContent = analysis.fileName;
    els.overallBadge.textContent = analysis.overallRisk;
    els.overallBadge.className = `cl-badge ${analysis.overallRisk}`;

    els.clauses.innerHTML = "";
    analysis.clauses.forEach((clause) => {
      els.clauses.appendChild(renderClause(clause));
    });

    showOnly("done");
  }
}

function renderClause(clause) {
  const card = document.createElement("div");
  card.className = `cl-clause ${clause.risk}`;

  const head = document.createElement("div");
  head.className = "cl-clause-head";
  head.innerHTML = `
    <span class="cl-clause-title">${escapeHtml(clause.title)}</span>
    <span class="cl-clause-risk ${clause.risk}">${clause.risk}</span>
  `;
  card.appendChild(head);

  const summary = document.createElement("p");
  summary.className = "cl-clause-summary";
  summary.textContent = clause.summary;
  card.appendChild(summary);

  if (clause.suggestedEdit) {
    const box = document.createElement("div");
    box.className = "cl-edit-box";
    box.innerHTML = `<span class="cl-edit-label">Suggested edit</span>`;
    const text = document.createElement("span");
    text.textContent = clause.suggestedEdit;
    box.appendChild(text);
    card.appendChild(box);

    const copyBtn = document.createElement("button");
    copyBtn.className = "cl-copy-btn";
    copyBtn.textContent = "Copy suggested edit";
    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(clause.suggestedEdit).then(() => {
        copyBtn.textContent = "Copied";
        setTimeout(() => (copyBtn.textContent = "Copy suggested edit"), 1500);
      });
    });
    card.appendChild(copyBtn);
  }

  return card;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// Initial paint.
chrome.storage.local.get("activeContract", ({ activeContract }) => {
  render(activeContract);
});

// Live updates while the panel stays open (e.g. analyzing -> done).
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.activeContract) {
    render(changes.activeContract.newValue);
  }
});
