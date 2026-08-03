// background.js — Manifest V3 service worker.
// Two jobs: (1) let the toolbar icon open the side panel, (2) receive
// "contract detected" events from the Gmail content script, kick off
// analysis, and hand results to the side panel.

chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

// Allows content-scripts/gmail-detector.js to open the panel itself
// (required because sidePanel.open must be called from a user gesture).
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

const API_BASE = "https://api.contractlens.ai"; // TODO: point at your real backend

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "CONTRACT_DETECTED") {
    // IMPORTANT: sidePanel.open() must be called synchronously, in the
    // same tick as the message arrives, or Chrome no longer treats it as
    // tied to the user's click and silently refuses to open it. Do this
    // BEFORE any await — that's why it's the very first line here rather
    // than inside the async handler below.
    if (sender.tab) {
      chrome.sidePanel.open({ tabId: sender.tab.id }).catch((err) => {
        console.error("sidePanel.open failed:", err);
      });
    }

    handleContractDetected(message.payload, sender.tab)
      .then(sendResponse)
      .catch((err) => sendResponse({ error: String(err) }));
    return true; // keep the message channel open for the async response
  }
});

async function handleContractDetected(payload, tab) {
  // payload: { fileName, fileUrl, mimeType }
  // Stash a "pending" state immediately so the side panel can show a
  // loading state the instant the user opens it. (Panel is already
  // opening in parallel above — this just fills it in.)
  await chrome.storage.local.set({
    activeContract: { status: "analyzing", fileName: payload.fileName },
  });

  const analysis = await analyzeContract(payload);

  await chrome.storage.local.set({
    activeContract: { status: "done", fileName: payload.fileName, analysis },
  });

  return { ok: true };
}

async function analyzeContract(payload) {
  // --- Real integration (once the backend exists) ---
  // const res = await fetch(`${API_BASE}/v1/analyze`, {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify({ fileUrl: payload.fileUrl, fileName: payload.fileName }),
  // });
  // if (!res.ok) throw new Error(`Analysis failed: ${res.status}`);
  // return res.json();

  // --- Mock response so the extension is demoable before the backend ships ---
  await new Promise((r) => setTimeout(r, 1200));
  return mockAnalysis(payload.fileName);
}

function mockAnalysis(fileName) {
  return {
    fileName,
    overallRisk: "medium",
    clauses: [
      {
        title: "Non-compete",
        risk: "high",
        summary: "Restricts you from working with competitors for 24 months — longer than the 6-12 month norm for freelance agreements.",
        suggestedEdit: "Reduce the restriction period to 6 months and limit it to direct competitors named in the agreement.",
      },
      {
        title: "Payment terms",
        risk: "medium",
        summary: "Net-60 payment terms are slower than the Net-15/30 typical for contracts of this size.",
        suggestedEdit: "Request Net-30 with a 1.5% late fee after 30 days.",
      },
      {
        title: "IP assignment",
        risk: "low",
        summary: "Standard work-for-hire language, consistent with market norms.",
        suggestedEdit: null,
      },
    ],
  };
}
